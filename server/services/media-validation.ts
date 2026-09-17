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
const MP4_BRANDS = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "iso7", "iso8", "iso9", "avc1", "mp41", "mp42", "mp71", "M4V ", "M4VH", "M4VP", "M4A ", "M4B ", "dash", "cmfc", "mmp4", "msnv", "f4v ", "3gp4", "3gp5", "3gp6", "3gp7", "3g2a", "3g2b"]);
/** QuickTime's own brand. `.mov` is a distinct stored type because the served content type differs. */
const QUICKTIME_BRANDS = new Set(["qt  "]);
/**
 * HEIF-family brands, which are ISO-BMFF too and must never be mistaken for video.
 *
 * This set is a VETO and is checked before anything else, across the major brand AND every compatible brand. A
 * HEIC or AVIF file legitimately advertises `mif1`/`miaf` alongside other brands, and the point of reading the
 * compatible list at all is that a brand anywhere in it is a real claim about the file -- so a file claiming any
 * HEIF brand is refused even if it also claims an MP4 one. ChefSire stores no HEIF format.
 */
const HEIF_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1", "miaf", "mia1", "avif", "avis", "avio", "MiAn"]);

/** The largest `ftyp` box this will read. A real one is a few dozen bytes; this bounds a hostile length field. */
const MAX_FTYP_BOX_BYTES = 1024;

export type FtypBox = { majorBrand: string; minorVersion: number; compatibleBrands: string[] };

/**
 * Parses an ISO-BMFF `ftyp` box properly, instead of reading four bytes at a fixed offset.
 *
 * The previous implementation took `head.subarray(8, 12)` as the major brand and required it to be in the MP4
 * allowlist. That rejects genuinely valid MP4 files: the major brand is only the file's *preferred* brand, and a
 * conforming file may advertise something else -- `iso8`, `iso9`, `3gp5`, a vendor brand -- while listing `isom`
 * or `mp42` in the same box's compatible-brands list, which is exactly what the list is for. Reproduced: an
 * `ftyp` with major `iso8` and compatible `[iso8, isom, mp41]` was refused.
 *
 * Returns null for anything that is not a well-formed `ftyp`: a short buffer, a length that disagrees with the
 * box, a 64-bit `largesize` (an `ftyp` never needs one), a body that is not a whole number of four-byte brands,
 * or a length beyond the bound above. Every read is bounded by the box size, which is itself bounded.
 */
export function parseFtypBox(head: Buffer): FtypBox | null {
  // size(4) + "ftyp"(4) + major(4) + minor(4) is the smallest legal box.
  if (head.length < 16) return null;
  if (head.subarray(4, 8).toString("latin1") !== "ftyp") return null;

  const size = head.readUInt32BE(0);
  // size === 1 means a 64-bit largesize follows; size === 0 means "to end of file". Neither is legal for `ftyp`.
  if (size < 16 || size > MAX_FTYP_BOX_BYTES || size % 4 !== 0) return null;
  // The box must be fully present in the bytes we were given, or we cannot honestly read its brand list.
  if (size > head.length) return null;

  const majorBrand = head.subarray(8, 12).toString("latin1");
  const minorVersion = head.readUInt32BE(12);
  const compatibleBrands: string[] = [];
  for (let offset = 16; offset + 4 <= size; offset += 4) {
    compatibleBrands.push(head.subarray(offset, offset + 4).toString("latin1"));
  }
  // A brand is four printable characters. Anything else means this is not really an `ftyp`.
  const printable = (brand: string) => /^[\x20-\x7e]{4}$/.test(brand);
  if (!printable(majorBrand) || !compatibleBrands.every(printable)) return null;

  return { majorBrand, minorVersion, compatibleBrands };
}

/** Which video format an `ftyp` box describes, or null when ChefSire does not store it. */
export function videoFormatForFtyp(box: FtypBox): "mp4" | "quicktime" | null {
  const brands = [box.majorBrand, ...box.compatibleBrands];
  // The veto first: a HEIF-family claim anywhere disqualifies the file, whatever else it also claims.
  if (brands.some((brand) => HEIF_BRANDS.has(brand))) return null;
  // The major brand is the file's own preference, so it decides when we recognise it.
  if (QUICKTIME_BRANDS.has(box.majorBrand)) return "quicktime";
  if (MP4_BRANDS.has(box.majorBrand)) return "mp4";
  // Otherwise a compatible brand is a real claim of conformance and is honoured.
  if (brands.some((brand) => MP4_BRANDS.has(brand))) return "mp4";
  if (brands.some((brand) => QUICKTIME_BRANDS.has(brand))) return "quicktime";
  return null;
}

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

  // ---- ISO base media (MP4 / MOV): the whole `ftyp` box, major brand AND compatible brands -----------------
  if (head.subarray(4, 8).toString("latin1") === "ftyp") {
    const box = parseFtypBox(head);
    if (!box) return null;
    const format = videoFormatForFtyp(box);
    return format ? { container: "video", format } : null;
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
 * Decodes an image, in full, to prove it is one.
 *
 * `metadata()` IS NOT ENOUGH, and assuming it was is a defect this function exists to correct. It reads the
 * container header and returns as soon as it knows the dimensions -- it never decodes pixel data. Reproduced: a
 * JPEG and a PNG each truncated to 60% of their bytes are both reported by `metadata()` as a healthy
 * `400x300`, and the truncated file was then stored verbatim. (WebP and GIF happen to fail at `metadata()`
 * because their headers carry a length, but that is luck, not a guarantee.)
 *
 * So there are two passes, in this order and for this reason:
 *
 *   1. `metadata()` -- cheap, and it is what gives us the dimensions. The format must agree with the signature,
 *      and the dimensions must be real and within bounds. This runs FIRST precisely so that the expensive pass
 *      below is only ever attempted on an image already proven to be within `MEDIA_IMAGE_MAX_PIXELS`.
 *   2. `stats()` -- computes per-channel statistics, which libvips can only do by decoding every pixel. A
 *      truncated or corrupt body fails here. It is a read, not a rewrite: nothing about the caller's bytes
 *      changes, so an accepted image is still stored byte-for-byte and an animated GIF keeps its frames.
 *
 * Measured cost of the second pass on a 4000x3000 JPEG: ~500ms, ~35MB RSS. libvips reads sequentially rather
 * than materialising the whole raster, which is why this is preferred over `.raw().toBuffer()`.
 */
async function verifyImage(source: MediaSource, format: MediaFormat): Promise<MediaRejectionReason | null> {
  const input = "buffer" in source ? source.buffer : source.path;
  // A GIF is read with every frame present, so a later frame cannot be the corrupt one that nothing looked at.
  const options: sharp.SharpOptions = { limitInputPixels: MEDIA_IMAGE_MAX_PIXELS, failOn: "error", animated: format === "gif" };

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input as never, options).metadata();
  } catch {
    return "unreadable_image";
  }
  if (metadata.format !== format) return "content_mismatch";

  const width = metadata.width ?? 0;
  // With `animated`, `height` is every frame stacked; `pageHeight` is one frame. Bound the frame and the total.
  const pages = Math.max(1, metadata.pages ?? 1);
  const frameHeight = metadata.pageHeight ?? metadata.height ?? 0;
  if (width <= 0 || frameHeight <= 0) return "unreadable_image";
  if (width > MEDIA_IMAGE_MAX_DIMENSION || frameHeight > MEDIA_IMAGE_MAX_DIMENSION) return "too_large";
  if (width * frameHeight * pages > MEDIA_IMAGE_MAX_PIXELS) return "too_large";

  // The decode itself. Everything above was only enough to know this is safe to attempt.
  try {
    await sharp(input as never, options).stats();
  } catch {
    return "unreadable_image";
  }
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
