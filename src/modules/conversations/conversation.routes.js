import { Router } from "express";
import * as conversationController from "./conversation.controller.js";
import { authMiddleware } from "../../core/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/", conversationController.list);
router.get("/:id", conversationController.getById);
router.get("/:id/messages", conversationController.listMessages);
router.post("/:id/assume", conversationController.assume);
router.post("/:id/close", conversationController.close);
router.post("/:id/messages", conversationController.sendMessage);

export default router;