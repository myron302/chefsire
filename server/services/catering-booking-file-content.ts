import sharp from "sharp";
import { CATERING_FILE_MAX_BYTES, type CateringFileFormat, type CateringFileKind } from "@shared/catering-booking-files";

/**
 * Content validation for booking files. Neither the browser MIME type nor the extension is evidence of anything --
 * they only decide which type the content is then required to actually be. An executable renamed .pdf fails here,
 * because ELF and MZ headers are not "%PDF-", and an SVG or HTML file never reaches this module at all: neither is
 * on the allowlist by extension or by MIME.
 */

/** Detects the type of a buffer from its own bytes, independent of anything the request claimed. */
export function detectCateringFileFormat(buffer: Buffer): CateringFileFormat | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

/**
 * A PDF must look like a real document, not merely start with the signature. Every conforming PDF carries a
 * cross-reference pointer near its end, so requiring "startxref" or "%%EOF" in the tail rejects a file that only
 * borrowed the header bytes while staying far cheaper and safer than parsing untrusted PDF structure.
 */
export function looksLikePdf(buffer: Buffer): boolean {
  if (detectCateringFileFormat(buffer) !== "pdf") return false;
  const tail = buffer.subarray(Math.max(0, buffer.length - 4096)).toString("latin1");
  return tail.includes("%%EOF") || tail.includes("startxref");
}

/** Refuses a decompression bomb before any pixel is decoded: a booking document is never this large. */
export const CATERING_IMAGE_MAX_PIXELS = 40_000_000;
export const CATERING_IMAGE_MAX_DIMENSION = 12_000;

export type CateringContentResult =
  | { kind: "accepted"; body: Buffer; byteSize: number }
  | { kind: "rejected"; reason: "content_mismatch" | "unreadable_image" | "image_too_large" | "too_large" };

const SHARP_FORMATS = { jpeg: "jpeg", png: "png", webp: "webp" } as const;

/**
 * Validates one upload's bytes against the allowlisted type its extension and declared MIME already agreed on, and
 * returns the bytes that will actually be stored.
 *
 * Raster images are decoded and re-encoded in the same format through Sharp, mirroring the safer pipeline the
 * existing image upload uses: the stored object is then something Sharp itself produced, so anything appended to or
 * embedded around the real image data -- a polyglot payload, a trailing archive, EXIF carrying scripts -- is simply
 * not in the output. The format is preserved rather than normalised to WebP so the persisted content type stays a
 * truthful description of the file the participant uploaded. Re-encoding can grow a file, so the launch maximum is
 * enforced again on the produced bytes rather than only on the input.
 *
 * PDFs are stored byte-for-byte: re-encoding a PDF would mean parsing untrusted document structure, which is a
 * larger attack surface than the signature and trailer check above. They are only ever served as attachments with
 * sniffing disabled, never rendered in the application's origin.
 */
export async function validateCateringFileContent(buffer: Buffer, kind: CateringFileKind, expectedFormat: CateringFileFormat): Promise<CateringContentResult> {
  const detected = detectCateringFileFormat(buffer);
  if (detected !== expectedFormat) return { kind: "rejected", reason: "content_mismatch" };
  if (kind === "pdf") {
    if (!looksLikePdf(buffer)) return { kind: "rejected", reason: "content_mismatch" };
    return { kind: "accepted", body: buffer, byteSize: buffer.length };
  }
  const format = SHARP_FORMATS[expectedFormat as keyof typeof SHARP_FORMATS];
  if (!format) return { kind: "rejected", reason: "content_mismatch" };
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: CATERING_IMAGE_MAX_PIXELS }).metadata();
  } catch {
    return { kind: "rejected", reason: "unreadable_image" };
  }
  // Sharp's own reading of the container must agree with the signature and with the declared type.
  if (metadata.format !== format) return { kind: "rejected", reason: "content_mismatch" };
  const width = metadata.width ?? 0; const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) return { kind: "rejected", reason: "unreadable_image" };
  if (width > CATERING_IMAGE_MAX_DIMENSION || height > CATERING_IMAGE_MAX_DIMENSION || width * height > CATERING_IMAGE_MAX_PIXELS) return { kind: "rejected", reason: "image_too_large" };
  let body: Buffer;
  try {
    const pipeline = sharp(buffer, { limitInputPixels: CATERING_IMAGE_MAX_PIXELS }).rotate();
    body = await (format === "jpeg" ? pipeline.jpeg({ quality: 88 }) : format === "png" ? pipeline.png({ compressionLevel: 9 }) : pipeline.webp({ quality: 88 })).toBuffer();
  } catch {
    return { kind: "rejected", reason: "unreadable_image" };
  }
  if (body.length <= 0) return { kind: "rejected", reason: "unreadable_image" };
  if (body.length > CATERING_FILE_MAX_BYTES) return { kind: "rejected", reason: "too_large" };
  return { kind: "accepted", body, byteSize: body.length };
}
