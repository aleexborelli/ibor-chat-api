import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

function getExtensionFromMime(mimeType = "") {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("pdf")) return "pdf";
  return "bin";
}

export async function saveBase64Media({
  base64,
  mimeType,
  originalFileName,
}) {
  const extension =
    originalFileName?.split(".").pop() || getExtensionFromMime(mimeType);

  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const relativePath = path.join("uploads", "messages", fileName);
  const absolutePath = path.resolve(relativePath);

  const buffer = Buffer.from(base64, "base64");

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    fileName: originalFileName || fileName,
    mediaUrl: `/uploads/messages/${fileName}`,
  };
}