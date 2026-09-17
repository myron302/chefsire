import fs from "fs";
import path from "path";
import multer from "multer";
import sharp from "sharp";
import { MEDIA_REJECTION_MESSAGES, MEDIA_REJECTION_STATUS, type MediaRejectionReason } from "@shared/media-types";
import { UPLOADS_DIR, uploadUrlPath } from "../lib/uploads-dir";
import { isR2Configured, publicUrl, uploadToR2 } from "../lib/r2";
import { generatedMediaKey, generatedMediaName, validateUploadedMedia } from "./media-validation";

export const IMAGE_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;

/**
 * Raised when an upload's own bytes are not something ChefSire accepts. It carries the client-facing status and
 * message and nothing else: no path, no key, no bucket, no stack detail from the storage layer.
 */
export class UnsupportedMediaError extends Error {
  readonly reason: MediaRejectionReason;
  readonly status: 400 | 415;
  constructor(reason: MediaRejectionReason) {
    super(MEDIA_REJECTION_MESSAGES[reason]);
    this.name = "UnsupportedMediaError";
    this.reason = reason;
    this.status = MEDIA_REJECTION_STATUS[reason];
  }
}

/**
 * A cheap pre-filter, and explicitly NOT the security decision.
 *
 * Its only job is to avoid buffering 25MB of something that could never be accepted anyway. What the file
 * actually is gets decided from its bytes in `storeUploadedImage`, after the parser has finished -- the declared
 * MIME this filter reads is copied straight out of the request and proves nothing.
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_UPLOAD_LIMIT_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) callback(null, true);
    else callback(new Error("Only JPEG, PNG, WebP, and GIF images are accepted."));
  },
});

/**
 * Verifies an uploaded image's bytes, then stores it under a name this module generated.
 *
 * Order matters and is the point: validation runs first, so nothing that fails it is ever written to
 * `UPLOADS_DIR` or sent to R2. The stored extension and the stored content type come from the DETECTED format --
 * `file.originalname` and `file.mimetype` contribute nothing to either, so an upload named `attack.html` and
 * declared `image/jpeg` is stored as a `.jpg`/`.webp` if it really is an image, and refused outright if it is not.
 */
export async function storeUploadedImage(file: Express.Multer.File): Promise<{ url: string; thumbUrl: string }> {
  const validated = await validateUploadedMedia({
    source: { buffer: file.buffer },
    allow: ["image"],
    declaredMimeType: file.mimetype,
    originalName: file.originalname,
    maxBytes: IMAGE_UPLOAD_LIMIT_BYTES,
  });
  if (validated.kind === "rejected") throw new UnsupportedMediaError(validated.reason);

  // GIF is stored as the verified original because re-encoding would flatten an animation. It is never
  // re-interpreted: the signature and Sharp both confirmed it is a GIF, the object is named `.gif` by this
  // module, and `/uploads` serves it as `image/gif` with sniffing disabled.
  if (validated.format === "gif") {
    const filename = generatedMediaName(validated.extension);
    if (isR2Configured()) {
      const key = `posts/${filename}`;
      await uploadToR2(key, file.buffer, validated.contentType);
      const url = publicUrl(key);
      return { url, thumbUrl: url };
    }
    await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);
    const url = uploadUrlPath(filename);
    return { url, thumbUrl: url };
  }

  // Every other accepted raster image is re-encoded to WebP by Sharp, so the stored object is something Sharp
  // itself produced: anything appended around the real image data -- a polyglot tail, a trailing archive, EXIF
  // carrying script -- is simply not in the output.
  const mainFilename = generatedMediaName("webp");
  const thumbFilename = mainFilename.replace(/\.webp$/, "_thumb.webp");
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

/**
 * Verifies and stores one image outside the post pipeline -- an avatar or a review photo.
 *
 * Same boundary, different destination folder and no thumbnail: these callers keep the uploader's original
 * format rather than normalising to WebP, so the stored extension is the canonical one for the DETECTED format.
 */
export async function storeVerifiedImage(
  file: Express.Multer.File,
  options: { folder: string; prefix?: string; localSubdirectory?: string; maxBytes: number },
): Promise<string> {
  const validated = await validateUploadedMedia({
    source: { buffer: file.buffer },
    allow: ["image"],
    declaredMimeType: file.mimetype,
    originalName: file.originalname,
    maxBytes: options.maxBytes,
  });
  if (validated.kind === "rejected") throw new UnsupportedMediaError(validated.reason);

  if (isR2Configured()) {
    const key = generatedMediaKey(options.folder, validated.extension, options.prefix);
    await uploadToR2(key, file.buffer, validated.contentType);
    return publicUrl(key);
  }

  const filename = generatedMediaName(validated.extension, options.prefix);
  const subdirectory = options.localSubdirectory ?? "";
  const directory = subdirectory ? path.join(UPLOADS_DIR, subdirectory) : UPLOADS_DIR;
  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(path.join(directory, filename), file.buffer);
  return uploadUrlPath(subdirectory ? `${subdirectory}/${filename}` : filename);
}
