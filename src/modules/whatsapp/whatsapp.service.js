import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { emitToAll } from "../realtime/socket.js";
import * as conversationService from "../conversations/conversation.service.js";

const { Client, LocalAuth } = pkg;

let clientInstance = null;

async function upsertSession(data) {
  return prisma.whatsappSession.upsert({
    where: { sessionKey: env.whatsappSessionName },
    update: data,
    create: {
      name: "Sessão principal",
      sessionKey: env.whatsappSessionName,
      ...data,
    },
  });
}

export async function initializeWhatsapp() {
  if (clientInstance) return clientInstance;

  await upsertSession({ status: "CONNECTING" });

  clientInstance = new Client({
    authStrategy: new LocalAuth({ clientId: env.whatsappSessionName }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  clientInstance.on("qr", async (qr) => {
    const qrCode = await qrcode.toDataURL(qr);
    await upsertSession({ status: "QR_PENDING", qrCode });
    emitToAll("whatsapp:qr", { qrCode });
    emitToAll("whatsapp:status", { status: "QR_PENDING" });
  });

  clientInstance.on("ready", async () => {
    const info = clientInstance.info;
    await upsertSession({
      status: "CONNECTED",
      qrCode: null,
      phoneNumber: info?.wid?.user || null,
      wid: info?.wid?._serialized || null,
      connectedAt: new Date(),
      lastSeenAt: new Date(),
    });
    emitToAll("whatsapp:status", { status: "CONNECTED" });
  });

  clientInstance.on("authenticated", async () => {
    await upsertSession({ lastSeenAt: new Date() });
    emitToAll("whatsapp:status", { status: "AUTHENTICATED" });
  });

  clientInstance.on("auth_failure", async () => {
    await upsertSession({ status: "FAILED" });
    emitToAll("whatsapp:status", { status: "FAILED" });
  });

  clientInstance.on("disconnected", async () => {
    await upsertSession({ status: "DISCONNECTED" });
    emitToAll("whatsapp:status", { status: "DISCONNECTED" });
  });

  clientInstance.on("message", async (message) => {
    if (message.fromMe) return;

    try {
      await conversationService.handleIncomingWhatsappMessage(message);
    } catch (error) {
      console.error("WHATSAPP: erro no listener message");
      console.error(error);
    }
  });

  clientInstance.on("message_create", async (message) => {
    if (!message.fromMe) return;

    try {
        await conversationService.handleOutgoingWhatsappMessage(message);
    } catch (error) {
      console.error("WHATSAPP: erro no listener message_create");
      console.error(error);
    }
  });

  await clientInstance.initialize();
  return clientInstance;
}

export async function getSessionStatus() {
  return prisma.whatsappSession.findUnique({
    where: { sessionKey: env.whatsappSessionName },
  });
}

export async function getCurrentQrCode() {
  const session = await getSessionStatus();
  return session?.qrCode || null;
}

export function getWhatsappClient() {
  return clientInstance;
}

export async function disconnectSession() {
  if (!clientInstance) return;
  await clientInstance.destroy();
  clientInstance = null;
  await upsertSession({ status: "DISCONNECTED", qrCode: null });
}
