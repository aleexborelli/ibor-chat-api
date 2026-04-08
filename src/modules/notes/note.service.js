import { prisma } from "../../lib/prisma.js";
import { emitToConversation } from "../realtime/socket.js";

export async function createNote({ conversationId, userId, body }) {
  const note = await prisma.internalNote.create({
    data: {
      conversationId,
      userId,
      body,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  emitToConversation(conversationId, "note:created", note);
  return note;
}
