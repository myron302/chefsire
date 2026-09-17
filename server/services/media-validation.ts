/**
 * The single boundary every user-supplied file crosses before it is stored or served.
 *
 * WHAT IT REPLACES. ChefSire's upload routes each decided for themselves what a file was, and each asked the
 * request rather than the file: `file.mimetype` (copied verbatim from the multipart part header) chose whether an
 * upload was allowed, and `path.extname(file.originalname)` chose the extension the object was persisted under.
 * Neither is evidence. Active HTML bytes declared `image/jpeg` and named `attack.html` were written into the
 * publicly served uploads directory as `<uuid>.html`, and `express.static` handed them back as `text/html` on
 * ChefSire's own origin -- stored cross-site scripting, reachable anonymously through the signup avatar field.
 *
 * WHAT IT GUARANTEES.
 *   1. The format is read from the file's own bytes. The declared MIME and the original filename are never
 *      consulted to decide whether a file is acceptable.
 *   2. The extension and the content type of the stored object come from `shared/media-types.ts`, keyed by the
 *      DETECTED format. An attacker-chosen extension cannot reach storage, so a stored object can never end in an
 *      executable extension.
 *   3. Validation happens BEFORE any byte reaches durable storage. A rejected file is never written to
 *      `UPLOADS_DIR` and never sent to R2; on the streaming path it exists only as a staged temporary file, which
 *      is removed.
 *   4. Images are additionally decoded by Sharp, so a file that merely borrows a signature, or is truncated, is
 *      refused rather than stored.
 *
 * WHAT IT DOES NOT CLAIM. Video containers are verified by their container signature and brand, not demuxed:
 * `detectMediaContainer` proves a file is an ISO-BMFF/Matroska/Ogg/RIFF-AVI container, not that every frame in it
 * decodes. That is sufficient for the property this repair is about -- such a file is not HTML, not SVG and not
 * script, and it is stored and served as video with sniffing disabled -- and the limitation is stated rather than
 * papered over. Nothing here transcodes video; that is deliberately out of scope.
 */
import { randomUUID } from "crypto";
import fs from "fs";
import sharp from "sharp";
import {
  MEDIA_TYPES,
  REJECTED_ACTIVE_EXTENSIONS,
  canonicalContentType,
  canonicalExtension,
  type MediaClass,
  type MediaFormat,
  type MediaRejectionReason,
} from "@shared/media-types";

/** How much of a file's head detection ever reads. Bounded so a 100MB video is never buffered to classify it. */
export const MEDIA_HEAD_BYTES = 64 * 1024;
/** How much of a file's tail is read, for the one format whose validity lives at the end: PDF. */
export const MEDIA_TAIL_BYTES = 4 * 1024;

/** Refuses a decompression bomb before any pixel is decoded. Mirrors the booking-document pipeline's bound. */
export const MEDIA_IMAGE_MAX_PIXELS = 100_000_000;
export const MEDIA_IMAGE_MAX_DIMENSION = 20_000;

/**
 * What the bytes themselves say the file is.
 *
 * ZIP and OLE are reported as containers rather than as a final format because several accepted document types
 * share one container: `.docx`, `.xlsx`, `.epub` and a plain `.zip` are all ZIP archives, and `.doc` and `.xls`
 * are both OLE compound files. Choosing among the members of one container family is a LABELLING decision with no
 * security content -- every member is inert in a browser and every one is served as an attachment -- so it is the
 * only place a declared value is allowed to break a tie, and only ever within the family the bytes established.
 */
export type DetectedContainer =
  | { container: "image"; format: Extract<MediaFormat, "jpeg" | "png" | "webp" | "gif"> }
  | { container: "video"; format: Extract<MediaFormat, "mp4" | "quicktime" | "webm" | "ogg" | "avi"> }
  | { container: "pdf" }
  | { container: "zip" }
  | { container: "ole" };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const EBML_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

/** ISO base media brands ChefSire treats as MP4. Anything else ISO-BMFF is refused rather than guessed at. */
const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "avc1", "mp41", "mp42", "mp71", "M4V ", "M4VP", "M4A ", "dash", "mmp4", "msnv", "f4v "]);
/** QuickTime's own brand. `.mov` is a distinct stored type because the served content type differs. */
const QUICKTIME_BRANDS = new Set(["qt  "]);

/**
 * Reads the format out of a file's bytes.
 *
 * `tail` is only needed to tell a real PDF from a file that borrowed "%PDF-": every conforming PDF carries a
 * cross-reference pointer near its end, and requiring it is far cheaper and far safer than parsing untrusted
 * document structure. When no tail is supplied the head is searched instead, which is correct for the small
 * buffers (data URIs, avatars, review photos) whose head IS the whole file.
 */
export function detectMediaContainer(head: Buffer, tail?: Buffer): DetectedContainer | null {
  if (head.length < 12) return null;

  // ---- raster images -------------------------------------------------------------------------------------
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { container: "image", format: "jpeg" };
  if (head.subarray(0, 8).equals(PNG_SIGNATURE)) return { container: "image", format: "png" };
  const gifMagic = head.subarray(0, 6).toString("latin1");
  if (gifMagic === "GIF87a" || gifMagic === "GIF89a") return { container: "image", format: "gif" };

  // ---- RIFF containers: WebP (image) and AVI (video) share one signature and differ at byte 8 -------------
  if (head.subarray(0, 4).toString("latin1") === "RIFF") {
    const riffType = head.subarray(8, 12).toString("latin1");
    if (riffType === "WEBP") return { container: "image", format: "webp" };
    if (riffType === "AVI ") return { container: "video", format: "avi" };
    return null;
  }

  // ---- ISO base media (MP4 / MOV): "ftyp" at offset 4, major brand at offset 8 ----------------------------
  if (head.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = head.subarray(8, 12).toString("latin1");
    if (QUICKTIME_BRANDS.has(brand)) return { container: "video", format: "quicktime" };
    if (MP4_BRANDS.has(brand)) return { container: "video", format: "mp4" };
    return null;
  }

  // ---- Matroska / WebM: EBML header, with the DocType naming which one ------------------------------------
  if (head.subarray(0, 4).equals(EBML_SIGNATURE)) {
    // The DocType element sits within the first EBML header, well inside the first kilobyte of any real file.
    return head.subarray(0, Math.min(head.length, 1024)).includes("webm") ? { container: "video", format: "webm" } : null;
  }

  if (head.subarray(0, 4).toString("latin1") === "OggS") return { container: "video", format: "ogg" };

  // ---- documents -----------------------------------------------------------------------------------------
  if (head.subarray(0, 5).toString("latin1") === "%PDF-") {
    const trailer = (tail ?? head).toString("latin1");
    return trailer.includes("%%EOF") || trailer.includes("startxref") ? { container: "pdf" } : null;
  }
  // A ZIP local file header. The empty-archive (PK\x05\x06) and spanned (PK\x07\x08) markers are deliberately
  // not accepted: neither carries content, and neither is something a product upload is.
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) return { container: "zip" };
  if (head.subarray(0, 8).equals(OLE_SIGNATURE)) return { container: "ole" };

  return null;
}

/** The lower-cased extension a name claims, without its dot, taking only the last path segment. */
export function declaredExtension(originalName: string | undefined): string {
  const lastSegment = (originalName ?? "").split(/[\\/]/).pop() ?? "";
  const dot = lastSegment.lastIndexOf(".");
  return dot <= 0 ? "" : lastSegment.slice(dot + 1).toLowerCase();
}

const ZIP_MEMBERS: readonly MediaFormat[] = ["docx", "xlsx", "epub", "zip"];
const OLE_MEMBERS: readonly MediaFormat[] = ["doc", "xls"];

/**
 * Picks which member of a verified container family a document is.
 *
 * The bytes already decided the container. This only chooses the label, and only among formats that are inert by
 * construction, so the worst outcome of a wrong answer is a `.docx` served as `application/zip`. Where a cheap,
 * unambiguous marker exists in the archive head it is required rather than trusted: an OOXML archive carries
 * `[Content_Types].xml` as an early member, and an EPUB carries its media type as a stored first member. A
 * declared value that the archive contradicts falls through to the honest answer, `zip`.
 */
function resolveFamilyMember(members: readonly MediaFormat[], head: Buffer, declared: { extension: string; mimeType: string }, fallback: MediaFormat | null): MediaFormat | null {
  const claimed = members.find((format) => MEDIA_TYPES[format].extension === declared.extension)
    ?? members.find((format) => MEDIA_TYPES[format].contentType === declared.mimeType);
  if (!claimed) return fallback;
  const marker = head.subarray(0, Math.min(head.length, MEDIA_HEAD_BYTES));
  if ((claimed === "docx" || claimed === "xlsx") && !marker.includes("[Content_Types].xml")) return fallback;
  if (claimed === "epub" && !marker.subarray(0, 128).includes("application/epub+zip")) return fallback;
  return claimed;
}

/** What the bytes are, expressed as one of the formats ChefSire stores. */
export function resolveMediaFormat(detected: DetectedContainer, head: Buffer, originalName?: string, declaredMimeType?: string): MediaFormat | null {
  const declared = { extension: declaredExtension(originalName), mimeType: (declaredMimeType ?? "").trim().toLowerCase() };
  switch (detected.container) {
    case "image":
    case "video":
      return detected.format;
    case "pdf":
      return "pdf";
    case "zip":
      return resolveFamilyMember(ZIP_MEMBERS, head, declared, "zip");
    case "ole":
      // There is no honest fallback: a `.doc` and a `.xls` are the same container and nothing cheap tells them
      // apart, so an OLE file that names neither is refused rather than labelled as a guess.
      return resolveFamilyMember(OLE_MEMBERS, head, declared, null);
  }
}

export type MediaValidationResult =
  | { kind: "accepted"; format: MediaFormat; mediaClass: MediaClass; contentType: string; extension: string }
  | { kind: "rejected"; reason: MediaRejectionReason };

/** Where the bytes are. A staged file is classified by reading its head and tail, never by buffering it whole. */
export type MediaSource = { buffer: Buffer } | { path: string; byteSize: number };

async function readEnds(source: MediaSource): Promise<{ head: Buffer; tail: Buffer; byteSize: number } | null> {
  if ("buffer" in source) {
    return { head: source.buffer.subarray(0, MEDIA_HEAD_BYTES), tail: source.buffer.subarray(Math.max(0, source.buffer.length - MEDIA_TAIL_BYTES)), byteSize: source.buffer.length };
  }
  let handle: fs.promises.FileHandle | undefined;
  try {
    handle = await fs.promises.open(source.path, "r");
    const byteSize = (await handle.stat()).size;
    const head = Buffer.alloc(Math.min(MEDIA_HEAD_BYTES, byteSize));
    if (head.length > 0) await handle.read(head, 0, head.length, 0);
    const tailLength = Math.min(MEDIA_TAIL_BYTES, byteSize);
    const tail = Buffer.alloc(tailLength);
    if (tailLength > 0) await handle.read(tail, 0, tailLength, byteSize - tailLength);
    return { head, tail, byteSize };
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/**
 * Decodes an image to prove it is one.
 *
 * The signature check above proves the first bytes are a JPEG/PNG/WebP/GIF header. This proves the rest of the
 * file is actually that image: Sharp's own reading of the container has to agree with the signature, and the
 * dimensions have to be real and bounded. A truncated or hand-forged image fails here.
 */
async function verifyImage(source: MediaSource, format: MediaFormat): Promise<MediaRejectionReason | null> {
  const input = "buffer" in source ? source.buffer : source.path;
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input as never, { limitInputPixels: MEDIA_IMAGE_MAX_PIXELS }).metadata();
  } catch {
    return "unreadable_image";
  }
  if (metadata.format !== format) return "content_mismatch";
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) return "unreadable_image";
  if (width > MEDIA_IMAGE_MAX_DIMENSION || height > MEDIA_IMAGE_MAX_DIMENSION || width * height > MEDIA_IMAGE_MAX_PIXELS) return "too_large";
  return null;
}

export type MediaValidationRequest = {
  source: MediaSource;
  /** Which classes this particular route accepts. A route that renders media inline never passes "document". */
  allow: readonly MediaClass[];
  /** Untrusted. Recorded, never believed. Only ever breaks a tie between inert members of one container family. */
  declaredMimeType?: string;
  /** Untrusted. Never reaches a storage path. Only ever breaks the same tie. */
  originalName?: string;
  maxBytes?: number;
};

/**
 * The one function every upload path calls. Nothing is stored until this has returned `accepted`.
 */
export async function validateUploadedMedia(request: MediaValidationRequest): Promise<MediaValidationResult> {
  const ends = await readEnds(request.source);
  if (!ends) return { kind: "rejected", reason: "content_mismatch" };
  if (ends.byteSize <= 0) return { kind: "rejected", reason: "empty" };
  if (request.maxBytes !== undefined && ends.byteSize > request.maxBytes) return { kind: "rejected", reason: "too_large" };

  const detected = detectMediaContainer(ends.head, ends.tail);
  if (!detected) return { kind: "rejected", reason: "content_mismatch" };

  const format = resolveMediaFormat(detected, ends.head, request.originalName, request.declaredMimeType);
  if (!format) return { kind: "rejected", reason: "unsupported_media_type" };

  const descriptor = MEDIA_TYPES[format];
  if (!request.allow.includes(descriptor.mediaClass)) return { kind: "rejected", reason: "unsupported_media_type" };

  if (descriptor.mediaClass === "image") {
    const problem = await verifyImage(request.source, format);
    if (problem) return { kind: "rejected", reason: problem };
  }

  return { kind: "accepted", format, mediaClass: descriptor.mediaClass, contentType: canonicalContentType(format), extension: canonicalExtension(format) };
}

const ACTIVE_EXTENSIONS = new Set<string>(REJECTED_ACTIVE_EXTENSIONS);

/**
 * The name a stored object is given. Every character of it is server-generated.
 *
 * The extension must be one this module's own tables produced, and the assertion is not ceremony: it is the last
 * thing standing between a future caller that passes `path.extname(file.originalname)` and an object served as
 * `text/html` from ChefSire's origin. `prefix` is likewise constrained, so no caller can smuggle a path segment,
 * a traversal sequence or a second extension into a filename through it.
 */
export function generatedMediaName(extension: string, prefix = ""): string {
  const normalized = extension.replace(/^\./, "").toLowerCase();
  if (!/^[a-z0-9]{1,5}$/.test(normalized) || ACTIVE_EXTENSIONS.has(normalized)) {
    throw new Error("Refusing to build a storage name from an extension that was not produced by media validation");
  }
  if (!/^[a-z0-9-]*$/.test(prefix)) {
    throw new Error("Refusing to build a storage name from a prefix that is not a plain server-chosen label");
  }
  return `${prefix}${randomUUID()}.${normalized}`;
}

/** The R2 object key for a stored object. The folder is a server constant; the name is generated as above. */
export function generatedMediaKey(folder: string, extension: string, prefix = ""): string {
  if (!/^[a-z0-9-]+$/.test(folder)) {
    throw new Error("Refusing to build a storage key from a folder that is not a plain server-chosen label");
  }
  return `${folder}/${generatedMediaName(extension, prefix)}`;
}
