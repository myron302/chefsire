import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import sharp from "sharp";
import { UPLOADS_DIR, uploadUrlPath } from "../lib/uploads-dir";
import { isR2Configured, publicUrl, uploadToR2 } from "../lib/r2";

export const IMAGE_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_UPLOAD_LIMIT_BYTES },
  fileFilter: (_req, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) callback(null, true);
    else callback(new Error("Only JPEG, PNG, WebP, and GIF images are accepted."));
  },
});

export async function storeUploadedImage(file: Express.Multer.File): Promise<{ url: string; thumbUrl: string }> {
  if (file.mimetype === "image/gif") {
    const filename = `${randomUUID()}.gif`;
    if (isR2Configured()) {
      const key = `posts/${filename}`;
      await uploadToR2(key, file.buffer, file.mimetype);
      const url = publicUrl(key);
      return { url, thumbUrl: url };
    }
    await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);
    const url = uploadUrlPath(filename);
    return { url, thumbUrl: url };
  }

  const id = randomUUID();
  const mainFilename = `${id}.webp`;
  const thumbFilename = `${id}_thumb.webp`;
  const [mainBuffer, thumbBuffer] = await Promise.all([
    sharp(file.buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    sharp(file.buffer).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer(),
  ]);
  if (isR2Configured()) {
    const mainKey = `posts/${mainFilename}`;
    const thumbKey = `posts/${thumbFilename}`;
    await Promise.all([uploadToR2(mainKey, mainBuffer, "image/webp"), uploadToR2(thumbKey, thumbBuffer, "image/webp")]);
    return { url: publicUrl(mainKey), thumbUrl: publicUrl(thumbKey) };
  }
  await Promise.all([
    fs.promises.writeFile(path.join(UPLOADS_DIR, mainFilename), mainBuffer),
    fs.promises.writeFile(path.join(UPLOADS_DIR, thumbFilename), thumbBuffer),
  ]);
  return { url: uploadUrlPath(mainFilename), thumbUrl: uploadUrlPath(thumbFilename) };
}
