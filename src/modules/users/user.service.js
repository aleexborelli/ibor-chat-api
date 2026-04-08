import bcrypt from "bcrypt";
import { prisma } from "../../lib/prisma.js";

export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createUser({ name, email, password, role = "AGENT" }) {
  if (!name?.trim()) {
    throw new Error("Nome é obrigatório.");
  }

  if (!email?.trim()) {
    throw new Error("Email é obrigatório.");
  }

  if (!password?.trim()) {
    throw new Error("Senha é obrigatória.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (existingUser) {
    throw new Error("Já existe usuário com este email.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role,
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateUser(userId, { name, email, role, password }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  const data = {};

  if (typeof name === "string" && name.trim()) {
    data.name = name.trim();
  }

  if (typeof email === "string" && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: userId },
      },
    });

    if (existingUser) {
      throw new Error("Já existe outro usuário com este email.");
    }

    data.email = normalizedEmail;
  }

  if (role) {
    data.role = role;
  }

  if (typeof password === "string" && password.trim()) {
    data.passwordHash = await bcrypt.hash(password.trim(), 10);
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateUserStatus(userId, status) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  return prisma.user.update({
    where: { id: userId },
    data: { status },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}