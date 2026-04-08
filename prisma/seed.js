import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  await prisma.user.upsert({
    where: { email: "admin@visualchat.local" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@visualchat.local",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("✅ Seed executado. Login: admin@visualchat.local | Senha: 123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
