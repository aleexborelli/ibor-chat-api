import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: true,
        message: "Token não informado.",
      });
    }

    const [, token] = authHeader.split(" ");

    if (!token) {
      return res.status(401).json({
        error: true,
        message: "Token inválido.",
      });
    }

    const decoded = jwt.verify(token, env.jwtSecret);

    const userId = decoded.id || decoded.userId || decoded.sub;

    if (!userId) {
      return res.status(401).json({
        error: true,
        message: "Token sem identificação de usuário.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(401).json({
        error: true,
        message: "Usuário não encontrado.",
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: true,
      message: "Não autorizado.",
    });
  }
}