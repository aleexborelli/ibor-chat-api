let ioInstance = null;

export function setSocketIO(io) {
  ioInstance = io;
}

export function getSocketIO() {
  return ioInstance;
}

export function emitToAll(event, payload) {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
}

export function emitToConversation(conversationId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`conversation:${conversationId}`).emit(event, payload);
}
