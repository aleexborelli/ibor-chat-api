import { Router } from "express";
import { authMiddleware } from "../../core/auth.middleware.js";
import {
  getStatus,
  getQrCode,
  disconnectSession
} from "./whatsapp.controller.js";

const router = Router();

router.get("/status", authMiddleware, getStatus);
router.get("/qr", authMiddleware, getQrCode);
router.post("/disconnect", authMiddleware, disconnectSession);
router.post("/start", authMiddleware, startSession);


export default router;
