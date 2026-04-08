import { Router } from "express";
import authRoutes from "./modules/auth/auth.routes.js";
import whatsappRoutes from "./modules/whatsapp/whatsapp.routes.js";
import conversationRoutes from "./modules/conversations/conversation.routes.js";
import noteRoutes from "./modules/notes/note.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/conversations", conversationRoutes);
router.use("/notes", noteRoutes);

export default router;
