import { Router } from "express";
import { login, me } from "./auth.controller.js";
import { authMiddleware } from "../../core/auth.middleware.js";

const router = Router();

router.post("/login", login);
router.get("/me", authMiddleware, me);

export default router;
