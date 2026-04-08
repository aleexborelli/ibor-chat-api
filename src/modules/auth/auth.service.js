import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export async function login(input) {
  const data = loginSchema.parse(input);

  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    const error = new Error("Credenciais inválidas");
    error.statusCode = 401;
    throw error;
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);

  if (!valid) {
    const error = new Error("Credenciais inválidas");
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}
