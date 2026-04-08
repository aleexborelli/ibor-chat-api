import { Router } from "express";
import { authMiddleware } from "../../core/auth.middleware.js";
import { createNote } from "./note.controller.js";

const router = Router();
router.use(authMiddleware);
router.post("/:conversationId", createNote);

export default router;
