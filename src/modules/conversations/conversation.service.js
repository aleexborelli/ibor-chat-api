import { prisma } from "../../lib/prisma.js";
import { getWhatsappClient } from "../whatsapp/whatsapp.service.js";
import { emitToAll, emitToConversation } from "../realtime/socket.js";
import { saveBase64Media } from "../../lib/save-media.js";

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
      whatsappId: message.from,
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
    include: {
      contact: true,
      currentAssignee: true,
    },
  });

  const sentAt = new Date(message.timestamp * 1000);

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        whatsappSessionId: session.id,
        contactId: contact.id,
        status: "WAITING",
        startedAt: sentAt,
        lastMessageAt: sentAt,
        lastInboundAt: sentAt,
        unreadCount: 1,
      },
      include: {
        contact: true,
        currentAssignee: true,
      },
    });

    emitToAll("conversation:created", conversation);
  } else {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status:
          conversation.status === "CLOSED" ? "WAITING" : conversation.status,
        lastMessageAt: sentAt,
        lastInboundAt: sentAt,
        unreadCount: { increment: 1 },
        closedAt: null,
      },
      include: {
        contact: true,
        currentAssignee: true,
      },
    });

    emitToAll("conversation:updated", {
      conversationId: conversation.id,
    });
  }

  const existingMessage = await prisma.message.findUnique({
    where: { externalMessageId: message.id._serialized },
  });

  if (existingMessage) {
    return existingMessage;
  }

  let messageType = "TEXT";
let mediaUrl = null;
let mimeType = null;
let fileName = null;

if (message.type === "sticker") {
  messageType = "STICKER";
}

if (message.hasMedia) {
  const mime = message._data?.mimetype || "";

  if (mime.startsWith("image/")) {
    messageType = "IMAGE";
  } else if (mime.startsWith("audio/")) {
    messageType = "AUDIO";
  } else if (mime.startsWith("video/")) {
    messageType = "VIDEO";
  } else {
    messageType = "DOCUMENT";
  }

  mimeType = mime;
  fileName = message._data?.filename || null;

  try {
    const media = await message.downloadMedia();

    if (media?.data) {
      const savedMedia = await saveBase64Media({
        base64: media.data,
        mimeType: media.mimetype || mimeType,
        originalFileName: fileName,
      });

      mediaUrl = savedMedia.mediaUrl;
      fileName = savedMedia.fileName;
      mimeType = media.mimetype || mimeType;
    }
  } catch (error) {
    console.error("Erro ao baixar/salvar mídia:", error);
  }
}

  const savedMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      externalMessageId: message.id._serialized,
      direction: "INBOUND",
      type: messageType,
      body: message.body || null,
      mediaUrl,
      mimeType,
      fileName,
      rawPayload: message?._data ?? null,
      fromMe: false,
      sentAt,
    },
  });

  emitToConversation(conversation.id, "message:created", savedMessage);
  emitToAll("message:created", {
    conversationId: conversation.id,
    message: savedMessage,
  });

  return savedMessage;
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

  const chatId = chat?.id?._serialized || message.to || null;

  if (!chatId) {
    console.log("OUTBOUND: não foi possível resolver chatId");
    return null;
  }

  const normalizedPhone = (contactInfo?.number || "").replace(/\D/g, "");

  const contactName =
    contactInfo?.pushname || contactInfo?.name || normalizedPhone || chatId;

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
    const nextPhone = contact.phone || normalizedPhone || chatId;
    const nextName = contact.name || contactName;
    const nextPushName = contact.pushName || contactInfo?.pushname || null;

    if (
      contact.whatsappId !== chatId ||
      contact.phone !== nextPhone ||
      contact.name !== nextName ||
      contact.pushName !== nextPushName
    ) {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          whatsappId: chatId,
          phone: nextPhone,
          name: nextName,
          pushName: nextPushName,
        },
      });
    }
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      whatsappSessionId: session.id,
      contactId: contact.id,
    },
    include: {
      contact: true,
      currentAssignee: true,
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
      include: {
        contact: true,
        currentAssignee: true,
      },
    });

    emitToAll("conversation:created", conversation);
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

  emitToConversation(conversation.id, "message:created", createdMessage);
  emitToAll("message:created", {
    conversationId: conversation.id,
    message: createdMessage,
  });

  emitToAll("conversation:updated", {
    conversationId: conversation.id,
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
    where.status = { not: "CLOSED" };
    where.currentAssigneeId = userId;
  }

  if (queue === "all") {
    where.status = { not: "CLOSED" };
  }

  return prisma.conversation.findMany({
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
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function listMessagesByConversationId(conversationId) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { sentAt: "asc" },
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

  emitToAll("conversation:updated", {
    conversationId: updatedConversation.id,
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

  emitToAll("conversation:updated", {
    conversationId: updatedConversation.id,
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
      status: conversation.currentAssigneeId
        ? "IN_PROGRESS"
        : conversation.status,
    },
  });

  emitToConversation(conversation.id, "message:created", createdMessage);
  emitToAll("message:created", {
    conversationId: conversation.id,
    message: createdMessage,
  });

  emitToAll("conversation:updated", {
    conversationId: conversation.id,
  });

  return createdMessage;
}
