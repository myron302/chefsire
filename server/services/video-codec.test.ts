/**
 * The codec a video actually carries, read from its box tree.
 *
 * These build ISO-BMFF boxes byte by byte rather than shipping binary fixtures or shelling out to ffmpeg, so
 * they are deterministic and need nothing installed. The parser was separately validated against real ffmpeg
 * output -- H.264 and HEVC, `hvc1` and `hev1` tagged, with `moov` both at the front and at the end -- and these
 * reproduce those same shapes, including the one that matters most: a phone video writes `moov` AFTER the
 * payload, so a parser that only reads the file's head answers "unknown" for exactly the files this is for.
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { isHdrColor, isUndecodableInBrowsers, readVideoCodecs } from "./video-codec";

function box(type: string, ...payloads: Buffer[]): Buffer {
  const body = Buffer.concat(payloads);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(body.length + 8, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, body]);
}

/** A sample description holding one entry per format given. Entry bodies are inert padding. */
function stsd(...formats: string[]): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(0, 0); // version + flags
  head.writeUInt32BE(formats.length, 4);
  const entries = formats.map((format) => {
    const entry = Buffer.alloc(24);
    entry.writeUInt32BE(24, 0);
    entry.write(format.padEnd(4, " ").slice(0, 4), 4, "latin1");
    return entry;
  });
  return box("stsd", head, ...entries);
}

function trackWith(...formats: string[]): Buffer {
  return box("trak", box("mdia", box("minf", box("stbl", stsd(...formats)))));
}

function ftyp(brand = "isom"): Buffer {
  const payload = Buffer.alloc(8);
  payload.write(brand, 0, "latin1");
  payload.writeUInt32BE(512, 4);
  return box("ftyp", payload);
}

/** `mdat` carries the payload; its size is declared and its contents must never be read. */
function mdat(bytes: number, fill = 0x41): Buffer {
  return box("mdat", Buffer.alloc(bytes, fill));
}

function moovFirst(...tracks: Buffer[]): Buffer {
  return Buffer.concat([ftyp(), box("moov", ...tracks), mdat(2048)]);
}

function moovLast(...tracks: Buffer[]): Buffer {
  return Buffer.concat([ftyp(), mdat(2048), box("moov", ...tracks)]);
}

test("H.264 is recognized whether the index is at the front or the end", async () => {
  for (const [label, file] of [["faststart", moovFirst(trackWith("avc1"))], ["as recorded", moovLast(trackWith("avc1"))]] as const) {
    const report = await readVideoCodecs({ buffer: file });
    assert.deepEqual(report, { formats: ["avc1"], hasHevc: false, hasBroadlyPlayable: true, color: null }, label);
    assert.equal(isUndecodableInBrowsers(report), false, label);
  }
});

test("HEVC is caught in both its tag spellings, and with the index at the end", async () => {
  // hvc1 and hev1 differ only in where parameter sets are stored. Neither decodes in mainstream desktop Chrome,
  // so a check that knows only one of them lets the other through -- which is the bug, not a near miss.
  for (const format of ["hvc1", "hev1", "dvh1", "dvhe"]) {
    const report = await readVideoCodecs({ buffer: moovLast(trackWith(format)) });
    assert.deepEqual(report, { formats: [format], hasHevc: true, hasBroadlyPlayable: false, color: null }, format);
    assert.equal(isUndecodableInBrowsers(report), true, format);
  }
});

test("an HEVC video track beside an audio track is still an HEVC video", async () => {
  const report = await readVideoCodecs({ buffer: moovLast(trackWith("hvc1"), trackWith("mp4a")) });
  assert.deepEqual(report?.formats, ["hvc1", "mp4a"]);
  assert.equal(report?.hasHevc, true);
  assert.equal(isUndecodableInBrowsers(report), true);
});

test("a file carrying BOTH an HEVC and an H.264 track is not refused", async () => {
  // Some writers include a compatibility track. The browser will pick the one it can decode, so refusing this
  // would reject a video that plays perfectly well.
  const report = await readVideoCodecs({ buffer: moovLast(trackWith("hvc1"), trackWith("avc1")) });
  assert.equal(report?.hasHevc, true);
  assert.equal(report?.hasBroadlyPlayable, true);
  assert.equal(isUndecodableInBrowsers(report), false, "playable by some track means playable");
});

test("unreadable structure answers unknown, and unknown is never treated as unplayable", async () => {
  // The distinction the caller depends on: null means "I could not tell", which must not become permission to
  // store something unplayable, and must not become a refusal of something fine either.
  for (const [label, buffer] of [
    ["empty", Buffer.alloc(0)],
    ["too short", Buffer.alloc(12, 9)],
    ["no moov at all", Buffer.concat([ftyp(), mdat(1024)])],
    ["moov with no sample description", Buffer.concat([ftyp(), box("moov", box("trak", box("mdia")))])],
    ["random bytes", Buffer.alloc(4096, 0xab)],
  ] as const) {
    const report = await readVideoCodecs({ buffer });
    assert.equal(report, null, label);
    assert.equal(isUndecodableInBrowsers(report), false, `${label}: unknown is not a refusal`);
  }
});

test("an unrecognized codec counts as neither playable nor HEVC rather than being guessed at", async () => {
  const report = await readVideoCodecs({ buffer: moovLast(trackWith("xyzw")) });
  assert.deepEqual(report, { formats: ["xyzw"], hasHevc: false, hasBroadlyPlayable: false, color: null });
  assert.equal(isUndecodableInBrowsers(report), false, "not knowing a codec is not knowing it fails");
});

test("the payload is skipped by its declared size and never searched", async () => {
  // `mdat` is bulk data a member supplied. A parser that scanned it for 'stsd' could be fed a fake sample entry;
  // this one steps over the box by its declared length, so text inside the payload cannot be mistaken for
  // structure. The planted bytes below spell a complete, valid-looking H.264 sample description.
  // The planted structure sits at the very START of the payload, where a parser that descended into `mdat`
  // would meet it on its first read. Burying it behind padding would not discriminate: zero bytes do not parse
  // as a box header, so such a parser would stop before reaching it and the test would pass either way.
  const planted = Buffer.concat([box("stbl", stsd("avc1")), Buffer.alloc(64, 0)]);
  const file = Buffer.concat([ftyp(), box("mdat", planted), box("moov", trackWith("hvc1"))]);
  const report = await readVideoCodecs({ buffer: file });
  assert.deepEqual(report?.formats, ["hvc1"], "the real track, not the one planted in the payload");
  assert.equal(isUndecodableInBrowsers(report), true);
});

test("a box claiming to extend past the file is refused rather than read", async () => {
  const file = Buffer.concat([ftyp(), box("moov", trackWith("avc1"))]);
  // Overstate moov's size: the structure no longer fits the file, so there is no safe evidence to act on.
  file.writeUInt32BE(0x7fffff00, ftyp().length);
  assert.equal(await readVideoCodecs({ buffer: file }), null);
});

test("a file on disk reads the same as the same bytes in memory", async () => {
  const file = moovLast(trackWith("hvc1"));
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "codec-"));
  const filePath = path.join(dir, "clip.mp4");
  try {
    await fs.promises.writeFile(filePath, file);
    const fromDisk = await readVideoCodecs({ path: filePath, byteSize: file.length });
    const fromMemory = await readVideoCodecs({ buffer: file });
    assert.deepEqual(fromDisk, fromMemory);
    assert.equal(fromDisk?.hasHevc, true);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test("a declared byte size smaller than the file stops the walk at that boundary", async () => {
  // The caller passes the size it validated. Reading past it would mean trusting bytes nobody checked.
  const file = moovLast(trackWith("avc1"));
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "codec-"));
  const filePath = path.join(dir, "clip.mp4");
  try {
    await fs.promises.writeFile(filePath, file);
    // Truncate the declared size so `moov` falls outside it.
    assert.equal(await readVideoCodecs({ path: filePath, byteSize: ftyp().length + 16 }), null);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

/** A visual sample entry with the real 86-byte fixed header, optionally carrying a `colr` child box. */
function visualSampleEntry(format: string, color?: { primaries: number; transfer: number; matrix: number }): Buffer {
  const fixed = Buffer.alloc(86 - 8); // everything after the box header
  const children: Buffer[] = [];
  if (color) {
    const payload = Buffer.alloc(10);
    payload.write("nclx", 0, "latin1");
    payload.writeUInt16BE(color.primaries, 4);
    payload.writeUInt16BE(color.transfer, 6);
    payload.writeUInt16BE(color.matrix, 8);
    children.push(box("colr", payload));
  }
  return box(format, fixed, ...children);
}

/** An stsd whose single entry is a properly shaped visual sample entry. */
function stsdWithEntry(entry: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(1, 4);
  return box("stsd", head, entry);
}

test("HDR colour tagging is read from the sample entry's colr box", async () => {
  // HLG (transfer 18) with BT.2020 primaries (9) is what a phone records. Reading this is what decides whether
  // the video gets tone-mapped, so a parser that quietly returns null sends an HDR video through untouched.
  const file = Buffer.concat([ftyp(), mdat(512), box("moov", box("trak", box("mdia", box("minf",
    box("stbl", stsdWithEntry(visualSampleEntry("hvc1", { primaries: 9, transfer: 18, matrix: 9 })))))))]);
  const report = await readVideoCodecs({ buffer: file });
  assert.deepEqual(report?.color, { primaries: 9, transfer: 18, matrix: 9 });
  assert.equal(isHdrColor(report?.color), true);
});

test("an SDR file reports its own tagging, and a file with none reports null", async () => {
  const sdr = Buffer.concat([ftyp(), mdat(512), box("moov", box("trak", box("mdia", box("minf",
    box("stbl", stsdWithEntry(visualSampleEntry("avc1", { primaries: 1, transfer: 1, matrix: 1 })))))))]);
  const sdrReport = await readVideoCodecs({ buffer: sdr });
  assert.deepEqual(sdrReport?.color, { primaries: 1, transfer: 1, matrix: 1 });
  assert.equal(isHdrColor(sdrReport?.color), false);

  const untagged = Buffer.concat([ftyp(), mdat(512), box("moov", box("trak", box("mdia", box("minf",
    box("stbl", stsdWithEntry(visualSampleEntry("avc1")))))))]);
  const untaggedReport = await readVideoCodecs({ buffer: untagged });
  assert.equal(untaggedReport?.color, null);
  assert.equal(isHdrColor(untaggedReport?.color), false, "absent tagging is not HDR");
});

test("the colr box is not found by scanning, so text in a fixed field cannot fake it", async () => {
  // "colr" written into the 32-byte compressorname is the trap a string search falls into. The fixed fields
  // run to 86 bytes and the walk starts there, so this file has no colour tagging at all.
  const fixed = Buffer.alloc(78);
  fixed.write("colr", 40, "latin1");
  fixed.writeUInt16BE(9, 48);
  const entry = box("hvc1", fixed);
  const file = Buffer.concat([ftyp(), mdat(512), box("moov", box("trak", box("mdia", box("minf",
    box("stbl", stsdWithEntry(entry))))))]);
  const report = await readVideoCodecs({ buffer: file });
  assert.equal(report?.color, null);
});
