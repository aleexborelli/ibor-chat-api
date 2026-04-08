import { Router } from "express";
import * as userController from "./user.controller.js";
import { authMiddleware } from "../../core/auth.middleware.js";
import { authorize } from "../../core/authorize.middleware.js";

const router = Router();

router.use(authMiddleware);
router.use(authorize("ADMIN"));

router.get("/", userController.list);
router.post("/", userController.create);
router.patch("/:id", userController.update);
router.patch("/:id/status", userController.updateStatus);

export default router;