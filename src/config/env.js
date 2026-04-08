export const env = {
  port: Number(process.env.PORT || 3334),
  jwtSecret: process.env.JWT_SECRET || "troque-essa-chave",
  whatsappSessionName: process.env.WHATSAPP_SESSION_NAME || "principal",
};
