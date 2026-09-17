/**
 * Persists a `data:` URI that reached a create-post or create-bite body instead of going through `/api/upload`.
 *
 * WHAT IT REPLACES. The media type in a `data:` URI is simply the first token of a string the client composed, and
 * this module used to map it straight to a stored extension through a table that included
 * `"image/svg+xml": "svg"`. A post whose `imageUrl` was `data:image/svg+xml;base64,<script-bearing SVG>` was
 * written into the publicly served uploads directory as `<uuid>.svg` and served back as `image/svg+xml` on
 * ChefSire's own origin. Nothing decoded the base64 to check what it actually was, so HTML bytes declared
 * `image/png` were stored as a `.png` just as readily.
 *
 * Now the declared media type is ignored entirely. The decoded bytes are classified by
 * `validateUploadedMedia`, and the stored name and content type come from the DETECTED format. SVG is not an
 * accepted format anywhere in ChefSire, so it is refused here rather than sanitised: nothing in the product has
 * ever required a user-supplied SVG.
 */
import path from "path";
import fs from "fs/promises";
import { MEDIA_REJECTION_MESSAGES, type MediaRejectionReason } from "@shared/media-types";
import { UPLOADS_DIR, uploadUrlPath } from "./uploads-dir";
import { isR2Configured, publicUrl, uploadToR2 } from "./r2";
import { generatedMediaKey, generatedMediaName, validateUploadedMedia } from "../services/media-validation";

export const DATA_URI_MAX_BYTES = 25 * 1024 * 1024;

/** Raised when a `data:` URI's decoded bytes are not media ChefSire accepts. Carries no storage detail. */
export class UnsupportedDataUriError extends Error {
  readonly reason: MediaRejectionReason;
  constructor(reason: MediaRejectionReason) {
    super(MEDIA_REJECTION_MESSAGES[reason]);
    this.name = "UnsupportedDataUriError";
    this.reason = reason;
  }
}

export async function persistDataUri(value: string): Promise<string> {
  if (!value.startsWith("data:")) return value;

  const match = value.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return value;

  const [, , base64] = match;
  const buffer = Buffer.from(base64, "base64");

  if (buffer.length > DATA_URI_MAX_BYTES) {
    throw new Error("Data URI exceeds 25MB limit");
  }

  // The declared media type is deliberately not passed through: for a `data:` URI it is client-composed text with
  // no more standing than the base64 payload itself, and images and videos are identified by container alone.
  const validated = await validateUploadedMedia({
    source: { buffer },
    allow: ["image", "video"],
    maxBytes: DATA_URI_MAX_BYTES,
  });
  if (validated.kind === "rejected") throw new UnsupportedDataUriError(validated.reason);

  if (isR2Configured()) {
    const key = generatedMediaKey("posts", validated.extension);
    await uploadToR2(key, buffer, validated.contentType);
    return publicUrl(key);
  }

  const filename = generatedMediaName(validated.extension);
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);

  return uploadUrlPath(filename);
}
