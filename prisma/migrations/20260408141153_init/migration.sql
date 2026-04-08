-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WhatsappSessionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'QR_PENDING', 'CONNECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AssignmentActionType" AS ENUM ('ASSIGNED', 'TRANSFERRED', 'UNASSIGNED', 'CLOSED', 'REOPENED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "status" "WhatsappSessionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "qrCode" TEXT,
    "phoneNumber" TEXT,
    "wid" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "whatsappSessionId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "pushName" TEXT,
    "profilePicUrl" TEXT,
    "whatsappId" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "whatsappSessionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "subject" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'WAITING',
    "currentAssigneeId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sentByUserId" TEXT,
    "externalMessageId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "body" TEXT,
    "mediaUrl" TEXT,
    "mimeType" TEXT,
    "fileName" TEXT,
    "rawPayload" JSONB,
    "fromMe" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationAssignment" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actionByUserId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "actionType" "AssignmentActionType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappSession_sessionKey_key" ON "WhatsappSession"("sessionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_whatsappSessionId_phone_key" ON "Contact"("whatsappSessionId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_whatsappSessionId_whatsappId_key" ON "Contact"("whatsappSessionId", "whatsappId");

-- CreateIndex
CREATE INDEX "Conversation_status_currentAssigneeId_idx" ON "Conversation"("status", "currentAssigneeId");

-- CreateIndex
CREATE INDEX "Conversation_whatsappSessionId_lastMessageAt_idx" ON "Conversation"("whatsappSessionId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_whatsappSessionId_contactId_key" ON "Conversation"("whatsappSessionId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_externalMessageId_key" ON "Message"("externalMessageId");

-- CreateIndex
CREATE INDEX "Message_conversationId_sentAt_idx" ON "Message"("conversationId", "sentAt");

-- CreateIndex
CREATE INDEX "InternalNote_conversationId_createdAt_idx" ON "InternalNote"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationAssignment_conversationId_createdAt_idx" ON "ConversationAssignment"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_whatsappSessionId_fkey" FOREIGN KEY ("whatsappSessionId") REFERENCES "WhatsappSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_whatsappSessionId_fkey" FOREIGN KEY ("whatsappSessionId") REFERENCES "WhatsappSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_currentAssigneeId_fkey" FOREIGN KEY ("currentAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationAssignment" ADD CONSTRAINT "ConversationAssignment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationAssignment" ADD CONSTRAINT "ConversationAssignment_actionByUserId_fkey" FOREIGN KEY ("actionByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
