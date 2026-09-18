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
 * The only top-level boxes this will walk PAST while looking for `ftyp`.
 *
 * All three are defined as content-free padding -- `free` and `skip` in ISO/IEC 14496-12, `wide` in the QuickTime
 * file format -- so skipping one cannot skip anything that carries meaning. Nothing else is walked past, and the
 * exclusions are deliberate: `mdat` is attacker-controlled payload of attacker-declared length, and `moov`,
 * `pnot` and `PICT` are real structure whose presence before `ftyp` would say the file is not what `ftyp` would
 * later claim. Keeping the set to the three no-op boxes means walking cannot change what a file is judged to be,
 * only whether the box that decides it is found at all.
 */
const ISO_BMFF_SKIPPABLE_BOXES = new Set(["free", "skip", "wide"]);
/** How many leading no-op boxes are walked before giving up. Real files carry at most one or two. */
const ISO_BMFF_MAX_LEADING_BOXES = 8;

/**
 * Finds the `ftyp` box in an ISO base media file, which is not always the first box.
 *
 * THE FINDING. Detection required `head.subarray(4, 8) === "ftyp"`, i.e. that `ftyp` is the file's first
 * top-level box. That is the common layout, not a guarantee: a remuxer that rewrites a file in place leaves the
 * space it reclaimed as a leading `free` box, and QuickTime writers emit `wide` as a placeholder. Reproduced on
 * head f3f29e2: `free`+`ftyp(isom)`, `skip`+`ftyp(mp42)` and `wide`+`ftyp(qt  )` were each detected as `null`,
 * and `validateUploadedMedia` refused the first with `content_mismatch` -- a valid MP4 the product accepts by
 * policy, refused at the door.
 *
 * The walk is bounded in every direction, because every number in it comes from the file:
 *
 *   - at most {@link ISO_BMFF_MAX_LEADING_BOXES} boxes are visited, so a chain of tiny boxes cannot spin;
 *   - it never reads outside `head`, which is itself capped at {@link MEDIA_HEAD_BYTES};
 *   - `size === 1` means a 64-bit `largesize` follows the type; it is read only when those eight bytes are
 *     present, as two 32-bit halves so nothing passes through a lossy conversion, and rejected unless the high
 *     word is zero and the low word is at least the 16-byte header it describes;
 *   - `size === 0` means "to end of file", so nothing can follow and there is no `ftyp` behind it;
 *   - `size` between 2 and 7 is smaller than the header it sits in, which is malformed, not a short box;
 *   - each advance must move strictly forward and land inside `head`, so neither a zero-length step nor an
 *     overflowed offset is possible.
 *
 * A `free` box large enough to push `ftyp` past the head is not searched for beyond it: the box is simply not
 * found, and the file is refused. That is the bound doing its job rather than a gap.
 *
 * NO-`ftyp` QUICKTIME IS DELIBERATELY NOT SUPPORTED. A classic `.mov` may omit `ftyp` entirely, identifying
 * itself only by its top-level atom sequence -- typically `wide`, `mdat`, `moov`. There is no safe evidence to
 * act on there. `mdat` is raw payload whose declared length routinely exceeds the bounded head, so `moov` is
 * usually not even reachable; and accepting `wide`+`mdat` as QuickTime would classify an arbitrary binary as a
 * video because it carries a familiar four-character name, which is precisely the type confusion this module
 * exists to prevent. So such a file is refused, the same as on main and on every earlier head of this branch.
 * That is a stated limitation, not a claim of support: every current writer -- iOS, macOS, ffmpeg, Premiere --
 * emits `ftyp` with the `qt  ` brand, which this detects.
 */
export function locateFtypBox(head: Buffer): FtypBox | null {
  let offset = 0;
  for (let visited = 0; visited < ISO_BMFF_MAX_LEADING_BOXES; visited++) {
    // size(4) + type(4) is the smallest box header there is.
    if (offset + 8 > head.length) return null;
    const declaredSize = head.readUInt32BE(offset);
    const type = head.subarray(offset + 4, offset + 8).toString("latin1");
    if (type === "ftyp") return parseFtypBox(head.subarray(offset));
    if (!ISO_BMFF_SKIPPABLE_BOXES.has(type)) return null;

    let size: number;
    if (declaredSize === 1) {
      // A 64-bit `largesize` follows the type. It is read as two 32-bit halves rather than as a BigInt so that
      // no value is ever converted through a type that could lose precision: a non-zero high word means at least
      // 4 GiB, which is orders of magnitude past the bounded head, so it is refused without further arithmetic.
      if (offset + 16 > head.length) return null;
      const highWord = head.readUInt32BE(offset + 8);
      const lowWord = head.readUInt32BE(offset + 12);
      if (highWord !== 0) return null;
      if (lowWord < 16) return null; // smaller than the extended header it describes
      size = lowWord;
    } else if (declaredSize === 0) {
      return null; // extends to end of file: nothing follows it
    } else if (declaredSize < 8) {
      return null; // smaller than its own header
    } else {
      size = declaredSize;
    }

    const next = offset + size;
    if (!Number.isSafeInteger(next) || next <= offset || next > head.length) return null;
    offset = next;
  }
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

  // ---- ISO base media (MP4 / MOV): find the `ftyp` box, then read the whole of it ------------------------
  // `ftyp` is usually the first top-level box but is not required to be; `locateFtypBox` walks a bounded number
  // of leading no-op boxes to find it. See that function for why only `free`, `skip` and `wide` are walked past.
  const firstBoxType = head.subarray(4, 8).toString("latin1");
  if (firstBoxType === "ftyp" || ISO_BMFF_SKIPPABLE_BOXES.has(firstBoxType)) {
    const box = locateFtypBox(head);
    if (box) {
      const format = videoFormatForFtyp(box);
      return format ? { container: "video", format } : null;
    }
    // A file whose very first box announces itself as `ftyp` and then is not a well-formed one is not quietly
    // reconsidered as some other format -- it is refused, exactly as before this walk existed. A leading
    // `free`/`skip`/`wide` is a weaker claim, so those fall through to the detectors below rather than deciding
    // the answer: four bytes that happen to spell `free` inside an EBML or Ogg header must not veto them.
    if (firstBoxType === "ftyp") return null;
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

const OLE_MEMBERS: readonly MediaFormat[] = ["doc", "xls"];

/* ------------------------------------------------------------------ ZIP packages, read structurally */

/**
 * Bounds on reading a ZIP's own index. This is CLASSIFICATION, not extraction: no member is ever inflated, no
 * name is ever used as a path, and every number the archive supplies is checked before it is used.
 */
export const ZIP_MAX_CENTRAL_DIRECTORY_BYTES = 1024 * 1024;
export const ZIP_MAX_ENTRIES = 2048;
export const ZIP_MAX_ENTRY_NAME_BYTES = 512;
/** An end-of-central-directory record is 22 bytes plus a comment of at most 65535. */
const ZIP_EOCD_SEARCH_BYTES = 22 + 0xffff;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_FILE_SIGNATURE = 0x02014b50;

/** A Zip64 sentinel: the field's real value lives in an extra field this module deliberately does not parse. */
const ZIP64_SENTINEL_32 = 0xffffffff;

/**
 * One member as the archive's own index describes it. Every field is the archive's claim, not a verified fact --
 * verifying a claim means comparing it against the local header, which is what {@link looksLikeEpubContainer}
 * does for the one entry whose structure decides a format.
 */
export type ZipCentralEntry = {
  name: string;
  /** General purpose bit flag. Bit 3 defers the sizes to a data descriptor; bits 0, 6 and 13 concern encryption. */
  flags: number;
  /** 0 is stored (uncompressed); 8 is deflate. Nothing here ever decompresses a member. */
  method: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  /** Where this member's local file header sits. `0` is the first entry in the archive, which is what OCF rules on. */
  localHeaderOffset: number;
  diskNumberStart: number;
  /** True when a size or the offset is a Zip64 sentinel, so the value above is not the real one. */
  zip64: boolean;
};

/**
 * A ZIP's members, read from its central directory, or null when the archive cannot be indexed safely.
 *
 * WHY THE CENTRAL DIRECTORY. The previous implementation searched the first 64 KiB for the literal
 * `[Content_Types].xml`, which assumes that member comes early. ZIP guarantees no such ordering: reproduced, a
 * DOCX whose first member is an 80 KiB image puts `[Content_Types].xml` at offset 82001 and was classified as a
 * generic `.zip`, so a legitimate Office document was stored under the wrong type. The central directory is the
 * archive's own index and is where member names are supposed to be read from.
 *
 * Every field is treated as hostile: the declared directory size, entry count, name lengths and offsets are all
 * bounded and cross-checked against the real file size before a single byte is addressed. Zip64 is not parsed --
 * an archive that needs it falls back to generic `zip` rather than being guessed at, and the per-entry sentinels
 * are recorded on the entry so a caller that relies on an exact size or offset can refuse it too. Multi-disk
 * archives are refused outright: there is no second disk to read, so any field that names one is a contradiction.
 */
/** One end-of-central-directory record, after every field it declares has been checked against the archive. */
type ZipEndOfCentralDirectory = { totalEntries: number; directoryOffset: number; directorySize: number };

/**
 * How many candidates may have their central directory actually READ.
 *
 * Header validation below is cheap and runs over every signature match in the search region, which is itself
 * bounded. Reading a directory is not cheap, so only candidates that survive every header check reach that
 * point, and only this many of them do. A conforming archive has exactly one; needing more than a couple means
 * the file is carrying deliberately EOCD-shaped decoys, and the work spent on them stays bounded.
 */
const ZIP_MAX_EOCD_CANDIDATES = 8;

/**
 * One EOCD candidate, fully validated, or null if it is not a record that describes THIS archive.
 *
 * Split out for a reason (R9): every one of these checks used to run AFTER the scan had already committed to a
 * candidate, so a candidate that passed the first two checks and failed a later one made the whole read fail
 * instead of the scan moving on. Validation belongs where the choice is made.
 */
function readEndOfCentralDirectory(tail: Buffer, offset: number, tailStart: number, byteSize: number): ZipEndOfCentralDirectory | null {
  // The comment is the last thing in the archive, so a genuine record sits exactly `22 + commentLength` from
  // the end. `tail` ends at the last byte of the file, so that is this comparison.
  if (offset + 22 + tail.readUInt16LE(offset + 20) !== tail.length) return null;

  const thisDisk = tail.readUInt16LE(offset + 4);
  const directoryDisk = tail.readUInt16LE(offset + 6);
  const entriesOnThisDisk = tail.readUInt16LE(offset + 8);
  const totalEntries = tail.readUInt16LE(offset + 10);
  const directorySize = tail.readUInt32LE(offset + 12);
  const directoryOffset = tail.readUInt32LE(offset + 16);

  // Zip64 sentinels. Not parsed, and not guessed at.
  if (totalEntries === 0xffff || directorySize === ZIP64_SENTINEL_32 || directoryOffset === ZIP64_SENTINEL_32) return null;
  // A single-file upload is one disk. Anything claiming otherwise is describing bytes that are not here.
  if (thisDisk !== 0 || directoryDisk !== 0 || entriesOnThisDisk !== totalEntries) return null;
  if (totalEntries === 0 || totalEntries > ZIP_MAX_ENTRIES) return null;
  if (directorySize === 0 || directorySize > ZIP_MAX_CENTRAL_DIRECTORY_BYTES) return null;
  // The directory must actually lie inside the file, with room for itself.
  if (directoryOffset + directorySize > byteSize) return null;
  // AND it must end exactly where this record begins. The central directory is immediately followed by the
  // record that describes it, so this ties a candidate to a real directory rather than to any directory. It is
  // what stops a decoy in the comment from borrowing the archive's own index and passing for the real record.
  if (directoryOffset + directorySize !== tailStart + offset) return null;

  return { totalEntries, directoryOffset, directorySize };
}

/** The entries a validated record points at, or null when that directory is not one this will read. */
async function readCentralDirectoryEntries(source: MediaSource, record: ZipEndOfCentralDirectory): Promise<ZipCentralEntry[] | null> {
  const directory = await readRange(source, record.directoryOffset, record.directorySize);
  if (!directory || directory.length !== record.directorySize) return null;

  const entries: ZipCentralEntry[] = [];
  let cursor = 0;
  for (let entry = 0; entry < record.totalEntries; entry++) {
    // A central file header is 46 bytes before its variable-length name.
    if (cursor + 46 > directory.length) return null;
    if (directory.readUInt32LE(cursor) !== ZIP_CENTRAL_FILE_SIGNATURE) return null;
    const nameLength = directory.readUInt16LE(cursor + 28);
    const extraLength = directory.readUInt16LE(cursor + 30);
    const commentLength = directory.readUInt16LE(cursor + 32);
    if (nameLength === 0 || nameLength > ZIP_MAX_ENTRY_NAME_BYTES) return null;
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    // Every advance must move forward and stay inside the directory we read.
    if (next <= cursor || next > directory.length) return null;

    const compressedSize = directory.readUInt32LE(cursor + 20);
    const uncompressedSize = directory.readUInt32LE(cursor + 24);
    const localHeaderOffset = directory.readUInt32LE(cursor + 42);
    entries.push({
      name: directory.subarray(cursor + 46, cursor + 46 + nameLength).toString("latin1"),
      flags: directory.readUInt16LE(cursor + 8),
      method: directory.readUInt16LE(cursor + 10),
      crc32: directory.readUInt32LE(cursor + 16),
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      diskNumberStart: directory.readUInt16LE(cursor + 34),
      zip64: compressedSize === ZIP64_SENTINEL_32 || uncompressedSize === ZIP64_SENTINEL_32 || localHeaderOffset === ZIP64_SENTINEL_32,
    });
    cursor = next;
  }
  // AND the records must account for the WHOLE declared directory (R10).
  //
  // The loop runs exactly `totalEntries` times, so a record count that under-reports what is physically there
  // used to parse a PREFIX and return it as if it were the index. Reproduced: an archive holding two central
  // records, with `directorySize` covering both and `totalEntries` altered to 1, read as a single-member index
  // -- so the members this validator saw were not the members a real reader sees, which is the whole class of
  // confusion this module exists to close. Requiring the cursor to land exactly on the end of the directory
  // makes the count and the bytes agree, or the archive is not indexed at all.
  if (cursor !== directory.length) return null;
  return entries;
}

export async function readZipCentralDirectory(source: MediaSource, byteSize: number): Promise<ZipCentralEntry[] | null> {
  if (byteSize < 22) return null;
  const tailLength = Math.min(ZIP_EOCD_SEARCH_BYTES, byteSize);
  const tail = await readRange(source, byteSize - tailLength, tailLength);
  if (!tail || tail.length < 22) return null;
  const tailStart = byteSize - tail.length;

  // FINDING A CANDIDATE IS NOT CHOOSING ONE (R9).
  //
  // The EOCD is the last record, but a comment of up to 65535 bytes follows it, and that comment is producer- or
  // attacker-supplied data sitting AFTER the record -- so a backward scan meets anything shaped like an EOCD in
  // the comment before it meets the real one. R8 added the comment-length test, which rules out those four bytes
  // appearing by accident. It did not rule out a DELIBERATE decoy: a 22-byte record whose comment-length field
  // is chosen so it too reaches the end of the file. The scan took such a candidate, stopped, and every
  // remaining check ran afterwards -- so a decoy failing any of them made the whole read fail instead of the
  // scan moving on. Reproduced on head fb77848 with a valid DOCX carrying one decoy in its comment: seven
  // variants (bad disk number, bad directory disk, disagreeing entry counts, zero entries, zero directory size,
  // a directory offset past EOF, a directory that does not end at the record) each returned null, and the
  // document was stored as a generic `.zip` with `application/zip`.
  //
  // So a candidate is now validated COMPLETELY before it is chosen, and failing one does not end the search --
  // the scan keeps walking backwards to the real record behind the decoys. Only exhausting the search region
  // without a candidate whose directory actually parses is a failure.
  let attempted = 0;
  for (let offset = tail.length - 22; offset >= 0; offset--) {
    if (tail.readUInt32LE(offset) !== ZIP_EOCD_SIGNATURE) continue;
    const record = readEndOfCentralDirectory(tail, offset, tailStart, byteSize);
    if (!record) continue;
    if (++attempted > ZIP_MAX_EOCD_CANDIDATES) return null;
    const entries = await readCentralDirectoryEntries(source, record);
    if (entries) return entries;
    // Shaped like a record and pointing somewhere plausible, but its directory does not read. Keep looking.
  }
  return null;
}

/** The member names from {@link readZipCentralDirectory}, for callers that only classify by name. */
export async function readZipCentralDirectoryNames(source: MediaSource, byteSize: number): Promise<string[] | null> {
  const entries = await readZipCentralDirectory(source, byteSize);
  return entries ? entries.map((entry) => entry.name) : null;
}

/** The exact payload OCF requires, and the only thing an EPUB's first member may contain. */
const EPUB_MEDIA_TYPE = "application/epub+zip";
/** A tolerated bound on the first header's extra field. OCF says there should be none; this refuses a silly one. */
const ZIP_MAX_LOCAL_EXTRA_BYTES = 1024;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
/**
 * The only general-purpose bit an OCF `mimetype` entry may set. Bit 11 says the name is UTF-8, which some writers
 * set for every member; `mimetype` is pure ASCII, so it means nothing either way and refusing it would reject
 * conforming books. Every other bit is refused: bit 3 defers the sizes to a data descriptor, bits 0, 6 and 13
 * concern encryption, and a stored, plaintext, fixed-length entry has no business claiming any of them.
 */
const ZIP_TOLERATED_FLAG_MASK = 0x0800;

/** CRC-32 as ZIP defines it. Used on exactly one 20-byte payload, to check the index against the bytes. */
function zipCrc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    let byte = (crc ^ buffer[index]!) & 0xff;
    for (let bit = 0; bit < 8; bit++) byte = byte & 1 ? 0xedb88320 ^ (byte >>> 1) : byte >>> 1;
    crc = (crc >>> 8) ^ byte;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** The CRC-32 an OCF `mimetype` entry must carry, since its contents are fixed by the specification. */
const EPUB_MIMETYPE_CRC32 = zipCrc32(Buffer.from(EPUB_MEDIA_TYPE, "latin1"));

/** What the local file header at offset 0 says about itself, once every field has been bounds-checked. */
type ZipLocalHeader = { name: string; flags: number; method: number; crc32: number; compressedSize: number; uncompressedSize: number };

/**
 * Reads the local file header at offset 0 as an OCF `mimetype` entry, or null if it is not one.
 *
 * EPUB's Open Container Format requires the `mimetype` entry to be the FIRST entry in the archive, stored
 * uncompressed, containing exactly `application/epub+zip` and nothing else. All of those are structural facts
 * about the local file header at offset 0, so this reads them there:
 *
 *   - the local file header signature;
 *   - the general purpose bit flag, with everything but the UTF-8-name bit refused (see the mask above);
 *   - the compression method, which must be 0 (stored) -- a deflated `mimetype` is not conforming;
 *   - the file name, which must be exactly `mimetype` and nothing longer;
 *   - both declared sizes, which must equal the media type's length exactly, so a payload with extra bytes
 *     appended is refused rather than prefix-matched;
 *   - the payload itself, compared exactly, and its CRC-32, compared against the value the header declares.
 *
 * Every offset is derived from bounded, already-validated lengths and checked against the buffer before use.
 * Nothing is decompressed: a conforming `mimetype` is stored, so there is nothing to decompress.
 */
function readEpubMimetypeLocalHeader(head: Buffer): ZipLocalHeader | null {
  // 30-byte local file header + "mimetype" + the media type.
  if (head.length < 30 + 8 + EPUB_MEDIA_TYPE.length) return null;
  if (head.readUInt32LE(0) !== ZIP_LOCAL_FILE_SIGNATURE) return null;

  const flags = head.readUInt16LE(6);
  if ((flags & ~ZIP_TOLERATED_FLAG_MASK) !== 0) return null;
  const method = head.readUInt16LE(8);
  if (method !== 0) return null; // must be stored

  const nameLength = head.readUInt16LE(26);
  const extraLength = head.readUInt16LE(28);
  if (nameLength !== "mimetype".length) return null;
  if (extraLength > ZIP_MAX_LOCAL_EXTRA_BYTES) return null;

  const crc32 = head.readUInt32LE(14);
  const compressedSize = head.readUInt32LE(18);
  const uncompressedSize = head.readUInt32LE(22);
  // Stored, so both sizes are the payload length, and it must be the media type exactly -- no trailing bytes.
  if (compressedSize !== EPUB_MEDIA_TYPE.length || uncompressedSize !== EPUB_MEDIA_TYPE.length) return null;
  // The contents of this entry are fixed by the specification, so its checksum is a constant too.
  if (crc32 !== EPUB_MIMETYPE_CRC32) return null;

  if (head.subarray(30, 30 + nameLength).toString("latin1") !== "mimetype") return null;

  const payloadStart = 30 + nameLength + extraLength;
  const payloadEnd = payloadStart + EPUB_MEDIA_TYPE.length;
  if (payloadEnd > head.length) return null;
  if (head.subarray(payloadStart, payloadEnd).toString("latin1") !== EPUB_MEDIA_TYPE) return null;

  return { name: "mimetype", flags, method, crc32, compressedSize, uncompressedSize };
}

/**
 * Whether these bytes open an EPUB container, judged by the OCF rules AND by the archive's own index agreeing.
 *
 * THE FINDING. The previous version read only the local file header at offset 0. A ZIP has two descriptions of
 * every member -- that header and the central directory record the readers actually use -- and nothing had ever
 * required them to agree. Reproduced on head f3f29e2, every one of these was classified `epub` and would have
 * been stored as `.epub` with `application/epub+zip`:
 *
 *   - a conforming `mimetype` local header at offset 0 that the central directory does not list at all (the
 *     index named one member, `evil.txt`);
 *   - the same header, listed in the index under a different name (`not-a-mimetype`);
 *   - the same header, with the index pointing that member's local header at some other offset entirely;
 *   - the same header, with the index contradicting it -- deflated, sizes 5 and 999;
 *   - the same header with NO central directory at all, so the archive has no index to disagree with;
 *   - a genuine DOCX with a forged `mimetype` local header bolted on the front, which real readers open as a
 *     Word document and this classified as a book.
 *
 * Every one of those is a file whose index says it is not an EPUB, and in the last case a file that a reader
 * would open as something else -- exactly the disagreement between what a file is and what it is stored as that
 * this module exists to close.
 *
 * So the local header is now a necessary condition and not a sufficient one. The archive's own index must
 * describe the same entry, and describe it the same way: present, named `mimetype`, sitting at offset 0, stored,
 * with the same CRC-32 and both sizes, and with no flag set that the local header did not also set. `offset 0`
 * is the check that carries OCF's "first entry in the archive" rule, which is what makes `mimetype` meaningful
 * in the first place -- and exactly one entry may claim it, so an ambiguous index is refused rather than
 * resolved. Central-directory ORDER is deliberately not required: the rule is about position in the archive,
 * and the directory is free to list members in any order.
 *
 * It fails closed in every direction. A missing, truncated, Zip64, multi-disk or otherwise unreadable index
 * yields no entries, and no entries means not an EPUB -- a generic `.zip`, which is inert, correctly typed and
 * served as an attachment. Nothing is decompressed and no member name is ever used as a path.
 */
export function looksLikeEpubContainer(head: Buffer, entries: readonly ZipCentralEntry[] | null): boolean {
  const local = readEpubMimetypeLocalHeader(head);
  if (!local) return false;
  // No readable index means nothing corroborates the header, and an uncorroborated header is not evidence.
  if (!entries || entries.length === 0) return false;

  // OCF's rule is about position in the ARCHIVE, so the index entry that matters is the one at offset 0. Exactly
  // one entry may claim it: two records describing the same bytes differently is a contradiction, not a choice.
  const atStart = entries.filter((entry) => entry.localHeaderOffset === 0);
  if (atStart.length !== 1) return false;
  const indexed = atStart[0]!;

  if (indexed.zip64) return false; // a sentinel means the real offset or size is somewhere we do not parse
  if (indexed.diskNumberStart !== 0) return false;
  if (indexed.name !== "mimetype") return false;
  if (indexed.method !== local.method) return false;
  if (indexed.crc32 !== local.crc32) return false;
  if (indexed.compressedSize !== local.compressedSize) return false;
  if (indexed.uncompressedSize !== local.uncompressedSize) return false;
  // Same tolerance as the local header, and the two must agree: a data-descriptor or encryption bit set on one
  // side only is the index and the header telling different stories about how to read the very same member.
  if ((indexed.flags & ~ZIP_TOLERATED_FLAG_MASK) !== 0) return false;
  if ((indexed.flags & ~ZIP_TOLERATED_FLAG_MASK) !== (local.flags & ~ZIP_TOLERATED_FLAG_MASK)) return false;

  // And no other member may also be called `mimetype`: a second one is what a differing reader might pick up.
  //
  // THIS comparison folds case, and the one above deliberately does not. They answer different questions. The
  // check above is IDENTITY -- OCF fixes the name as lower-case `mimetype`, so only that exact string is the
  // entry the specification means. This one is an AMBIGUITY DEFENCE: two members whose names differ only in
  // case are the same file to a case-insensitive extractor and different files to a case-sensitive one, which
  // is precisely the disagreement worth refusing. Folding case here refuses strictly more, and fails closed to
  // an inert generic `zip`.
  return entries.filter((entry) => entry.name.toLowerCase() === "mimetype").length === 1;
}

/**
 * Which member of the ZIP family an archive is, decided from its own index.
 *
 * Neither the declared MIME nor the filename is consulted: an archive naming itself `report.docx` is a DOCX only
 * if it contains the parts a DOCX is made of. OOXML requires `[Content_Types].xml` at the package root, and the
 * primary part is what distinguishes Word from Excel, so both are required rather than either.
 *
 * EPUB is decided by the OCF rule, cross-checked against the same index -- see `looksLikeEpubContainer` for why
 * the local header alone was not enough. EPUB is still tried first, because a conforming EPUB carrying an
 * `[Content_Types].xml` of its own would otherwise be filed as an Office document; now that the index has to
 * corroborate the OCF header, winning that tie takes a real EPUB rather than a forged first entry.
 *
 * Every path here fails closed to generic `zip`, which is an inert, correctly typed, attachment-served format.
 */
export function classifyZipPackage(head: Buffer, entries: readonly ZipCentralEntry[] | null): MediaFormat {
  if (looksLikeEpubContainer(head, entries)) return "epub";
  if (!entries) return "zip";
  // OPC part names are CASE-SENSITIVE, so these comparisons are exact (R10).
  //
  // This used to lower-case every entry name before comparing. OOXML is not a case-insensitive format: ECMA-376
  // fixes the content-types stream as `[Content_Types].xml` and the parts as `word/document.xml` and
  // `xl/workbook.xml`, and a conforming reader looks for those names, not for their case-folded shapes.
  // Reproduced: `[content_types].xml` + `word/document.xml`, `[Content_Types].xml` + `WORD/document.xml`,
  // `[Content_Types].xml` + `word/DOCUMENT.XML` and `[CONTENT_TYPES].XML` + `WORD/DOCUMENT.XML` were all
  // classified `docx`, so a generic archive was published under a generated `.docx` key with the Word content
  // type while Word would not open it as a document at all -- ChefSire asserting a format its own contents deny.
  //
  // Nothing here is case-folded. `declaredExtension` and the declared MIME type are still lower-cased where they
  // are used, which is correct and unrelated: those are the REQUEST's claims, a media type is case-insensitive
  // by RFC 2045, and neither ever decides a ZIP's format.
  const names = entries.map((entry) => entry.name);
  const has = (name: string) => names.includes(name);
  if (!has("[Content_Types].xml")) return "zip";
  // The PRIMARY PART decides, by its exact name, and nothing else does.
  //
  // THE CATCH (R8). This used to fall back to "any member under `word/` or `xl/`", which is not a statement
  // about the package at all -- those directories hold images, themes, fonts and settings. Reproduced: an
  // archive holding `[Content_Types].xml` and nothing but `word/media/image1.png` was classified `docx` and
  // stored under a generated `.docx` key with the Word content type, so a marketplace download advertised as a
  // document would not open as one; `xl/media/image1.png` became `xlsx` the same way.
  //
  // Every Word package this pipeline stores -- .docx, .docm, .dotx, .dotm -- names its primary part
  // `word/document.xml`, and every Excel one names it `xl/workbook.xml`, so the exact check costs no real
  // format. A package with those directories and no primary part is an archive, and is stored as one.
  // Word is checked first: a document embedding a spreadsheet is still a document.
  //
  // PPTX IS NOT IN THIS TABLE, deliberately. This pipeline stores no PowerPoint format -- there is no `pptx`
  // entry in `MEDIA_TYPES` -- so a presentation is classified as a generic `zip`, which is inert, correctly
  // typed and served as an attachment. That is the behaviour on every head of this branch and on main; there is
  // no PPTX marker here to compare case-sensitively, and adding one would be adding a supported format.
  if (has("word/document.xml")) return "docx";
  if (has("xl/workbook.xml")) return "xlsx";
  return "zip";
}

/**
 * Picks which member of a verified OLE compound file a document is.
 *
 * ZIP packages are NOT decided here -- they are read structurally by `classifyZipPackage`, because an archive's
 * own index is available and is the honest source. OLE has no equally cheap discriminator: `.doc` and `.xls` are
 * the same container, and telling them apart means walking the compound-file directory. Both members are inert
 * and are served as attachments either way, so the declared value is allowed to break that one tie -- and when
 * it names neither, the file is refused rather than labelled as a guess.
 */
function resolveFamilyMember(members: readonly MediaFormat[], declared: { extension: string; mimeType: string }, fallback: MediaFormat | null): MediaFormat | null {
  const claimed = members.find((format) => MEDIA_TYPES[format].extension === declared.extension)
    ?? members.find((format) => MEDIA_TYPES[format].contentType === declared.mimeType);
  return claimed ?? fallback;
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
      // Decided structurally by `classifyZipPackage`; never from the request. This branch exists only so the
      // function is total, and a caller that reaches it without the archive index gets the honest answer.
      return "zip";
    case "ole":
      // There is no honest fallback: a `.doc` and a `.xls` are the same container and nothing cheap tells them
      // apart, so an OLE file that names neither is refused rather than labelled as a guess.
      return resolveFamilyMember(OLE_MEMBERS, declared, null);
  }
}

export type MediaValidationResult =
  | { kind: "accepted"; format: MediaFormat; mediaClass: MediaClass; contentType: string; extension: string }
  | { kind: "rejected"; reason: MediaRejectionReason };

/** Where the bytes are. A staged file is classified by reading its head and tail, never by buffering it whole. */
export type MediaSource = { buffer: Buffer } | { path: string; byteSize: number };

/** Reads a bounded window from either source kind. Used only for a ZIP's own index, never for its contents. */
async function readRange(source: MediaSource, offset: number, length: number): Promise<Buffer | null> {
  if (offset < 0 || length <= 0 || length > ZIP_MAX_CENTRAL_DIRECTORY_BYTES + ZIP_EOCD_SEARCH_BYTES) return null;
  if ("buffer" in source) {
    if (offset + length > source.buffer.length) return null;
    return source.buffer.subarray(offset, offset + length);
  }
  let handle: fs.promises.FileHandle | undefined;
  try {
    handle = await fs.promises.open(source.path, "r");
    const into = Buffer.alloc(length);
    const { bytesRead } = await handle.read(into, 0, length, offset);
    return bytesRead === length ? into : null;
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

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

  // The probe is read with `animated: true` for EVERY format, not just GIF. That is what makes `pages` the true
  // frame count rather than 1, and it is safe: a static JPEG, PNG, WebP or GIF read this way reports `pages: 1`.
  const probeOptions: sharp.SharpOptions = { limitInputPixels: MEDIA_IMAGE_MAX_PIXELS, failOn: "error", animated: true };

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input as never, probeOptions).metadata();
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
  // `width * frameHeight * pages` is the whole decode, so the pixel bound covers every frame rather than the
  // first one. A many-framed image is refused on its total cost, not waved through on its frame dimensions.
  if (width * frameHeight * pages > MEDIA_IMAGE_MAX_PIXELS) return "too_large";

  // THE DECODE, AND WHY IT FOLLOWS THE PAGE COUNT RATHER THAN THE FORMAT.
  //
  // This used to pass `animated: format === "gif"`, which decoded only the FIRST page of every other format --
  // an animated WebP's later frames were never looked at, so whatever was in them was stored unexamined.
  // Measured directly: on a two-page image whose first frame is black and second is bright, `stats()` reports a
  // mean of 0.0 while `stats({animated: true})` reports 100.0. The default read covers page 0 and nothing else,
  // for WebP and GIF alike.
  //
  // So the decision is the page count, not the format, and it holds for any multi-page raster this stack can
  // read -- including an APNG, if libvips reports one as multi-page. Every frame that survives into the stored
  // original is a frame validation has decoded.
  try {
    await sharp(input as never, { limitInputPixels: MEDIA_IMAGE_MAX_PIXELS, failOn: "error", animated: pages > 1 }).stats();
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

  // A ZIP is classified from its own central directory rather than from a head scan or from anything the request
  // claimed; every other container is decided by its signature.
  const format = detected.container === "zip"
    ? classifyZipPackage(ends.head, await readZipCentralDirectory(request.source, ends.byteSize))
    : resolveMediaFormat(detected, ends.head, request.originalName, request.declaredMimeType);
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
