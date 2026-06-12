import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export async function persistDataUri(value: string): Promise<string> {
  if (!value.startsWith("data:")) return value;

  const match = value.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return value;

  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, "base64");

  if (buffer.length > 25 * 1024 * 1024) {
    throw new Error("Data URI exceeds 25MB limit");
  }

  const ext = MIME_TO_EXT[mime] ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const uploadsDir = path.join(process.cwd(), "uploads");

  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  await fs.writeFile(path.join(uploadsDir, filename), buffer);

  return `/uploads/${filename}`;
}
