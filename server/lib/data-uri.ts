import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { UPLOADS_DIR, uploadUrlPath } from "./uploads-dir";
import { isR2Configured, publicUrl, uploadToR2 } from "./r2";

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

  const mappedExt = MIME_TO_EXT[mime];
  const contentType = mappedExt ? mime : "application/octet-stream";
  const ext = mappedExt ?? "bin";
  const filename = `${randomUUID()}.${ext}`;

  if (isR2Configured()) {
    const key = `posts/${filename}`;
    await uploadToR2(key, buffer, contentType);
    return publicUrl(key);
  }

  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);

  return uploadUrlPath(filename);
}
