import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { setSocketIO } from "./modules/realtime/socket.js";
import { initializeWhatsapp } from "./modules/whatsapp/whatsapp.service.js";

dotenv.config();

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  },
});

setSocketIO(io);

io.on("connection", (socket) => {
  console.log("[socket] conectado:", socket.id);

  socket.on("join:conversation", (conversationId) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on("disconnect", () => {
    console.log("[socket] desconectado:", socket.id);
  });
});

const PORT = Number(process.env.PORT || 3334);

server.listen(PORT, async () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
  try {
    await initializeWhatsapp();
  } catch (error) {
    console.error("Erro ao inicializar WhatsApp:", error.message);
  }
});
