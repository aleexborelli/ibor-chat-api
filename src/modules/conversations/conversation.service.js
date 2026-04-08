import { prisma } from "../../lib/prisma.js";
import { getWhatsappClient } from "../whatsapp/whatsapp.service.js";
import { emitToAll, emitToConversation } from "../realtime/socket.js";

async function getMainSession() {
  const session = await prisma.whatsappSession.findFirst();
  if (!session) throw new Error("Sessão do WhatsApp ainda não criada");
  return session;
}

export async function handleIncomingWhatsappMessage(message) {
  const session = await getMainSession();
  const contactPhone = String(message.from).replace(/@c\.us$/, "");

  const contact = await prisma.contact.upsert({
    where: {
      whatsappSessionId_phone: {
        whatsappSessionId: session.id,
        phone: contactPhone,
      },
    },
    update: {
      pushName: message._data?.notifyName || null,
    },
    create: {
      whatsappSessionId: session.id,
      phone: contactPhone,
      whatsappId: message.from,
      pushName: message._data?.notifyName || null,
    },
  });

  let conversation = await prisma.conversation.findUnique({
    where: {
      whatsappSessionId_contactId: {
        whatsappSessionId: session.id,
        contactId: contact.id,
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        whatsappSessionId: session.id,
        contactId: contact.id,
        status: "WAITING",
        startedAt: new Date(),
        lastMessageAt: new Date(message.timestamp * 1000),
        lastInboundAt: new Date(message.timestamp * 1000),
        unreadCount: 1,
      },
      include: { contact: true, currentAssignee: true },
    });
    emitToAll("conversation:created", conversation);
  } else {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: conversation.status === "CLOSED" ? "WAITING" : conversation.status,
        lastMessageAt: new Date(message.timestamp * 1000),
        lastInboundAt: new Date(message.timestamp * 1000),
        unreadCount: { increment: 1 },
        closedAt: null,
      },
      include: { contact: true, currentAssignee: true },
    });
    emitToAll("conversation:updated", conversation);
  }

  const savedMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      externalMessageId: message.id._serialized,
      direction: "INBOUND",
      type: "TEXT",
      body: message.body || "",
      rawPayload: message,
      fromMe: false,
      sentAt: new Date(message.timestamp * 1000),
    },
  });

  emitToConversation(conversation.id, "message:created", savedMessage);
  emitToAll("message:created", { conversationId: conversation.id, message: savedMessage });
}

export async function handleOutgoingWhatsappMessage(message) {
  const session = await prisma.whatsappSession.findFirst({
    where: { status: "CONNECTED" },
  });

  if (!session) {
    return null;
  }

  let chat;
  let contactInfo;

  try {
    chat = await message.getChat();
    contactInfo = await message.getContact();
  } catch (error) {
    console.error("OUTBOUND: erro ao resolver chat/contato da mensagem");
    throw error;
  }

  const chatId =
    chat?.id?._serialized ||
    message.to ||
    null;

  if (!chatId) {
    console.log("OUTBOUND: não foi possível resolver chatId");
    return null;
  }

  const normalizedPhone = (contactInfo?.number || "")
    .replace(/\D/g, "");

  const contactName =
    contactInfo?.pushname ||
    contactInfo?.name ||
    normalizedPhone ||
    chatId;

  if (chat?.isGroup) {
    console.log("OUTBOUND: ignorando grupo neste momento");
    return null;
  }

  let contact = await prisma.contact.findFirst({
    where: {
      whatsappSessionId: session.id,
      OR: [
        { whatsappId: chatId },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        whatsappSessionId: session.id,
        whatsappId: chatId,
        phone: normalizedPhone || chatId,
        name: contactName,
        pushName: contactInfo?.pushname || null,
      },
    });
  } else {
    if (
      contact.whatsappId !== chatId ||
      (!contact.phone && normalizedPhone) ||
      (!contact.name && contactName)
    ) {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          whatsappId: chatId,
          phone: contact.phone || normalizedPhone || chatId,
          name: contact.name || contactName,
          pushName: contact.pushName || contactInfo?.pushname || null,
        },
      });
    }
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      whatsappSessionId: session.id,
      contactId: contact.id,
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        whatsappSessionId: session.id,
        contactId: contact.id,
        status: "WAITING",
        startedAt: new Date(),
        lastMessageAt: new Date(),
      },
    });
  }

  const externalMessageId = message.id?._serialized || null;
  const sentAt = message.timestamp
    ? new Date(message.timestamp * 1000)
    : new Date();

  if (externalMessageId) {
    const existingMessage = await prisma.message.findUnique({
      where: { externalMessageId },
    });

    if (existingMessage) {
      console.log("OUTBOUND: mensagem já existente");
      return existingMessage;
    }
  }

  const safeRawPayload = {
    id: message.id?._serialized || null,
    from: message.from || null,
    to: message.to || null,
    body: message.body || "",
    timestamp: message.timestamp || null,
    type: message.type || null,
    fromMe: !!message.fromMe,
    hasMedia: !!message.hasMedia,
    ack: typeof message.ack === "number" ? message.ack : null,
    chatId,
    contactNumber: normalizedPhone || null,
  };

  const createdMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      externalMessageId,
      direction: "OUTBOUND",
      type: "TEXT",
      body: message.body || "",
      fromMe: true,
      sentAt,
      rawPayload: safeRawPayload,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: sentAt,
      lastOutboundAt: sentAt,
    },
  });

  return createdMessage;
}

export async function listConversations({ userId, queue = "all" }) {
  const where = {};

  if (queue === "waiting") {
    where.status = "WAITING";
    where.currentAssigneeId = null;
  }

  if (queue === "mine") {
    where.status = {
      not: "CLOSED",
    };
    where.currentAssigneeId = userId;
  }

  if (queue === "all") {
    where.status = {
      not: "CLOSED",
    };
  }

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      contact: true,
      currentAssignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          messages: true,
          notes: true,
        },
      },
    },
    orderBy: [
      { lastMessageAt: "desc" },
      { updatedAt: "desc" },
    ],
  });

  return conversations;
}

export async function listMessagesByConversationId(conversationId) {
  return prisma.message.findMany({
    where: {
      conversationId,
    },
    orderBy: {
      sentAt: "asc",
    },
  });
}

export async function getConversationById(conversationId) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      currentAssignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      notes: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      _count: {
        select: {
          messages: true,
          notes: true,
        },
      },
    },
  });
}

export async function sendTextMessage({ conversationId, body, userId }) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  });

  if (!conversation) throw new Error("Conversa não encontrada");

  const client = getWhatsappClient();
  if (!client) throw new Error("WhatsApp não inicializado");

  const target = conversation.contact.whatsappId;
  const sent = await client.sendMessage(target, body);

  const savedMessage = await prisma.message.create({
    data: {
      conversationId,
      sentByUserId: userId,
      externalMessageId: sent.id._serialized,
      direction: "OUTBOUND",
      type: "TEXT",
      body,
      rawPayload: sent,
      fromMe: true,
      sentAt: new Date(),
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      lastOutboundAt: new Date(),
      status: "IN_PROGRESS",
      unreadCount: 0,
    },
  });

  emitToConversation(conversationId, "message:created", savedMessage);
  emitToAll("conversation:updated", { id: conversationId });

  return savedMessage;
}

export async function assumeConversation({ conversationId, userId }) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error("Conversa não encontrada.");
  }

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      currentAssigneeId: userId,
      status: "IN_PROGRESS",
      unreadCount: 0,
    },
    include: {
      contact: true,
      currentAssignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  await prisma.conversationAssignment.create({
    data: {
      conversationId,
      actionByUserId: userId,
      fromUserId: conversation.currentAssigneeId,
      toUserId: userId,
      actionType: "ASSIGNED",
    },
  });

  return updatedConversation;
}

export async function closeConversation({ conversationId, userId }) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error("Conversa não encontrada.");
  }

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
    include: {
      contact: true,
      currentAssignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  await prisma.conversationAssignment.create({
    data: {
      conversationId,
      actionByUserId: userId,
      fromUserId: conversation.currentAssigneeId,
      toUserId: null,
      actionType: "CLOSED",
    },
  });

  return updatedConversation;
}

export async function sendMessageFromConversation({
  conversationId,
  body,
  userId,
}) {
  if (!body || !body.trim()) {
    throw new Error("Mensagem obrigatória.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
    },
  });

  if (!conversation) {
    throw new Error("Conversa não encontrada.");
  }

  if (!conversation.contact) {
    throw new Error("Contato da conversa não encontrado.");
  }

  const client = getWhatsappClient();

  if (!client) {
    throw new Error("WhatsApp não inicializado.");
  }

  const whatsappId = conversation.contact.whatsappId;

  if (!whatsappId) {
    throw new Error("Contato sem whatsappId.");
  }

  const sentMessage = await client.sendMessage(whatsappId, body.trim());

  const externalMessageId = sentMessage?.id?._serialized || null;
  const sentAt = sentMessage?.timestamp
    ? new Date(sentMessage.timestamp * 1000)
    : new Date();

  if (externalMessageId) {
    const existingMessage = await prisma.message.findUnique({
      where: { externalMessageId },
    });

    if (existingMessage) {
      return existingMessage;
    }
  }

  const createdMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      sentByUserId: userId,
      externalMessageId,
      direction: "OUTBOUND",
      type: "TEXT",
      body: body.trim(),
      fromMe: true,
      sentAt,
      rawPayload: {
        id: sentMessage?.id?._serialized || null,
        from: sentMessage?.from || null,
        to: sentMessage?.to || null,
        body: sentMessage?.body || body.trim(),
        timestamp: sentMessage?.timestamp || null,
        type: sentMessage?.type || null,
        fromMe: true,
      },
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: sentAt,
      lastOutboundAt: sentAt,
      status: conversation.currentAssigneeId ? "IN_PROGRESS" : conversation.status,
    },
  });

  return createdMessage;
}