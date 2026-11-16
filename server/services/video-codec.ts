/**
 * Which video codec an MP4 or QuickTime file actually carries.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A CONTAINER CHECK
 *
 * media-validation.ts answers "is this really an MP4?" by reading the `ftyp` brand. That question was already
 * answered correctly, and it is not the question that broke playback. An iPhone recording HEVC writes a
 * perfectly valid MP4 with an ordinary brand, so it passed validation, uploaded, stored, and served -- and then
 * desktop Chrome loaded it, reported readyState 4 (HAVE_ENOUGH_DATA) and raised NO error, while reporting
 * videoWidth 0 and videoHeight 0. There is no decodable video track for it, so the player showed a black box
 * with working controls. Nothing anywhere in the stack said a word.
 *
 * The brand cannot answer this. The brand describes the container's structure; the codec lives in the sample
 * description (`stsd`) inside the track, and an HEVC file and an H.264 file are indistinguishable by brand
 * alone. So this module walks the box tree to the sample entry and reads the four-character format code there:
 * `avc1`/`avc3` for H.264, `hvc1`/`hev1` for HEVC, `vp09`, `av01`, and so on.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not transcode, and it does not claim a file will play. A codec a browser supports can still fail for
 * reasons this cannot see (a profile too high, a corrupt frame, a 10-bit pixel format). The useful direction is
 * the negative one: when the codec is HEVC, this file will not play in most desktop browsers, and that is worth
 * saying at upload time instead of storing something unplayable and letting the member discover it later.
 *
 * MOOV IS USUALLY AT THE END, WHICH IS THE WHOLE DIFFICULTY
 *
 * A recording device writes `mdat` (the payload) as it records and `moov` (the index) when it stops, so `moov`
 * lands at the END of the file. Only a deliberate faststart pass moves it to the front. The 64 KiB head that
 * media-validation reads therefore does NOT contain the codec for a typical phone video, and a head-only parser
 * would answer "unknown" for exactly the files this is for. So this reads bounded windows by byte range,
 * following declared box offsets, and never loads the payload: `mdat` is skipped by its declared size, which is
 * the one box whose contents are attacker-controlled bulk data.
 *
 * Every limit below is a refusal, not a best effort. Unparseable structure returns null -- "I could not tell" --
 * and a caller must treat that as unknown rather than as permission.
 */
import * as fs from "fs";

/** A file to read, by buffer or by path. Mirrors media-validation's MediaSource so callers can pass either. */
export type VideoSource = { buffer: Buffer } | { path: string; byteSize: number };

/** Windows are small: a box header is 8-16 bytes and an `stsd` with its entries is rarely over a few hundred. */
const WINDOW_BYTES = 64 * 1024;

/** The deepest nesting this follows: moov > trak > mdia > minf > stbl > stsd is six, so eight is slack enough. */
const MAX_DEPTH = 8;

/** Boxes examined in all, across the whole tree. A file needing more than this is not a phone video. */
const MAX_BOXES = 4096;

/** Byte-range reads allowed per file. Bounds the work a hostile file can ask for, independent of box count. */
const MAX_READS = 256;

const CONTAINER_BOXES = new Set(["moov", "trak", "mdia", "minf", "stbl"]);

/** Codecs that play in current desktop browsers without a licensed decoder behind them. */
const BROADLY_PLAYABLE = new Set(["avc1", "avc3", "vp08", "vp09", "av01"]);

/** HEVC sample entry formats. `hvc1` and `hev1` differ only in where parameter sets live, not in decodability. */
const HEVC_FORMATS = new Set(["hvc1", "hev1", "hvt1", "lhv1", "dvh1", "dvhe"]);

export type VideoCodecReport = {
  /** Every video sample-entry format found, in the order encountered. Lowercased, whitespace trimmed. */
  formats: string[];
  /** True when at least one format is HEVC. */
  hasHevc: boolean;
  /** True when at least one format is broadly playable. A file can hold both; `formats` is the full answer. */
  hasBroadlyPlayable: boolean;
};

type Reader = (offset: number, length: number) => Promise<Buffer | null>;

function makeReader(source: VideoSource, byteSize: number): { read: Reader } {
  let reads = 0;
  const read: Reader = async (offset, length) => {
    if (reads++ >= MAX_READS) return null;
    if (offset < 0 || length <= 0 || length > WINDOW_BYTES) return null;
    if (offset >= byteSize) return null;
    const want = Math.min(length, byteSize - offset);
    if ("buffer" in source) return source.buffer.subarray(offset, offset + want);
    let handle: fs.promises.FileHandle | undefined;
    try {
      handle = await fs.promises.open(source.path, "r");
      const into = Buffer.alloc(want);
      const { bytesRead } = await handle.read(into, 0, want, offset);
      return bytesRead > 0 ? into.subarray(0, bytesRead) : null;
    } catch {
      return null;
    } finally {
      await handle?.close().catch(() => undefined);
    }
  };
  return { read };
}

type BoxHeader = { type: string; headerBytes: number; size: number };

/**
 * Reads one box header.
 *
 * A declared size of 0 means "to the end of the file", which is legal for the last box; the caller resolves it
 * against the file size. A declared size of 1 means a 64-bit size follows the type, and a non-zero high word
 * means at least 4 GiB -- past anything this walks, so it is refused rather than converted through a type that
 * could lose precision.
 */
function readBoxHeader(window: Buffer, at: number, remainingToEnd: number): BoxHeader | null {
  if (at + 8 > window.length) return null;
  const declared = window.readUInt32BE(at);
  const type = window.subarray(at + 4, at + 8).toString("latin1");
  if (!/^[\x20-\x7e]{4}$/.test(type)) return null;

  if (declared === 1) {
    if (at + 16 > window.length) return null;
    if (window.readUInt32BE(at + 8) !== 0) return null;
    const low = window.readUInt32BE(at + 12);
    if (low < 16) return null;
    return { type, headerBytes: 16, size: low };
  }
  if (declared === 0) {
    if (remainingToEnd < 8) return null;
    return { type, headerBytes: 8, size: remainingToEnd };
  }
  if (declared < 8) return null;
  return { type, headerBytes: 8, size: declared };
}

/**
 * Reads the video sample-entry formats out of an `stsd` box's payload.
 *
 * Layout: version+flags (4), entry_count (4), then each entry as size (4) + format (4) + its own body. The
 * format code is all this needs, so entry bodies are skipped by their declared size and never interpreted.
 */
function formatsFromStsd(payload: Buffer): string[] {
  if (payload.length < 8) return [];
  const entryCount = payload.readUInt32BE(4);
  if (entryCount === 0 || entryCount > 64) return [];

  const formats: string[] = [];
  let cursor = 8;
  for (let entry = 0; entry < entryCount; entry++) {
    if (cursor + 8 > payload.length) break;
    const size = payload.readUInt32BE(cursor);
    const format = payload.subarray(cursor + 4, cursor + 8).toString("latin1").trim().toLowerCase();
    if (size < 8) break;
    if (/^[a-z0-9.\-]{2,4}$/.test(format)) formats.push(format);
    const next = cursor + size;
    if (!Number.isSafeInteger(next) || next <= cursor) break;
    cursor = next;
  }
  return formats;
}

/**
 * Reads the codecs an ISO-BMFF video declares, or null when the structure could not be read.
 *
 * null means unknown, never "fine": a caller that treats it as permission has reintroduced the silent-black-box
 * behaviour this exists to end.
 */
export async function readVideoCodecs(source: VideoSource): Promise<VideoCodecReport | null> {
  const byteSize = "buffer" in source ? source.buffer.length : source.byteSize;
  if (!Number.isSafeInteger(byteSize) || byteSize < 16) return null;

  const { read } = makeReader(source, byteSize);
  const formats: string[] = [];
  let boxesVisited = 0;

  /** Walks the boxes in [start, end), descending into container boxes and collecting any `stsd` formats. */
  const walk = async (start: number, end: number, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH) return;
    let offset = start;
    while (offset < end) {
      if (boxesVisited++ >= MAX_BOXES) return;
      const window = await read(offset, Math.min(WINDOW_BYTES, end - offset));
      if (!window || window.length < 8) return;

      const header = readBoxHeader(window, 0, end - offset);
      if (!header) return;
      const bodyStart = offset + header.headerBytes;
      const bodyBytes = header.size - header.headerBytes;
      if (bodyBytes < 0) return;
      const boxEnd = offset + header.size;
      if (!Number.isSafeInteger(boxEnd) || boxEnd <= offset || boxEnd > end) return;

      if (header.type === "stsd") {
        // The sample description is small by nature; a window is enough and bounds the read.
        const payload = bodyBytes <= window.length - header.headerBytes
          ? window.subarray(header.headerBytes, header.headerBytes + bodyBytes)
          : await read(bodyStart, Math.min(bodyBytes, WINDOW_BYTES));
        if (payload) formats.push(...formatsFromStsd(payload));
      } else if (CONTAINER_BOXES.has(header.type)) {
        await walk(bodyStart, boxEnd, depth + 1);
      }
      // Everything else -- `mdat` above all -- is skipped by its declared size and never read.

      offset = boxEnd;
    }
  };

  await walk(0, byteSize, 0);
  if (!formats.length) return null;

  // One entry per track, so a file with video and audio reports both; only the video formats are classified,
  // and an unrecognized code counts as neither playable nor HEVC rather than being guessed at.
  const unique = formats.filter((format, index) => formats.indexOf(format) === index);
  return {
    formats: unique,
    hasHevc: unique.some((format) => HEVC_FORMATS.has(format)),
    hasBroadlyPlayable: unique.some((format) => BROADLY_PLAYABLE.has(format)),
  };
}

/** True when the codecs read are ones no mainstream desktop browser will decode. Unknown is not unplayable. */
export function isUndecodableInBrowsers(report: VideoCodecReport | null): boolean {
  if (!report) return false;
  return report.hasHevc && !report.hasBroadlyPlayable;
}
