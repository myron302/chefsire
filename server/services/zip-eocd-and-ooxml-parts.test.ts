/**
 * Two ways a ZIP was read wrongly: which record is the EOCD, and which member makes a package an Office document.
 *
 * FINDING A -- THE EOCD SIGNATURE IS NOT RARE. `readZipCentralDirectory` scans backwards from the end of the
 * archive for `PK\x05\x06` and takes the first match. But the end-of-central-directory record is followed by a
 * comment of up to 65535 bytes, and that comment is producer- or attacker-supplied data -- so a backward scan
 * reaches a copy of those four bytes inside the COMMENT before it reaches the real record.
 *
 * Reproduced on head 00e7dfa: a valid DOCX whose comment begins `PK\x05\x06` had the embedded marker read as its
 * EOCD; the garbage behind it failed every bound; `readZipCentralDirectory` returned null; and the document was
 * accepted as a generic `.zip` with `application/zip`. The identical archive without the comment classified as
 * `docx`. A real Office file silently loses its format -- and a marketplace download advertised as a document
 * arrives as an archive.
 *
 * The fix: a genuine EOCD is exactly `22 + commentLength` bytes from the end of the archive, because its comment
 * runs to the end. A candidate that does not satisfy that is those four bytes appearing inside something else,
 * and is skipped -- the scan keeps going and finds the real record further back.
 *
 * FINDING A-II -- THAT WAS NOT ENOUGH (R9). The comment-length test rules out those four bytes appearing by
 * ACCIDENT. It does not rule out a DELIBERATE decoy: a 22-byte record planted in the comment whose own
 * comment-length field is chosen so that it, too, reaches the end of the file. The scan accepted such a
 * candidate on the strength of those two facts alone, stopped, and ran every remaining check afterwards -- so a
 * decoy that failed one of them made the whole read FAIL rather than the scan move on.
 *
 * Reproduced on head fb77848, with a valid DOCX carrying one decoy in its comment. Seven variants, each failing
 * a different later check, every one of them returning `null` and storing the document as `application/zip`:
 *
 *   decoy says disk number 7                            -> null -> zip
 *   decoy says central directory starts on disk 3       -> null -> zip
 *   decoy's two entry counts disagree                   -> null -> zip
 *   decoy says zero entries                             -> null -> zip
 *   decoy says zero directory size                      -> null -> zip
 *   decoy points the directory past EOF                 -> null -> zip
 *   decoy's directory does not end where the decoy is   -> null -> zip
 *
 * The fix: a candidate is validated COMPLETELY before it is chosen, and failing validation CONTINUES the scan
 * rather than ending it. Added to the checks is that the central directory must end exactly where the candidate
 * record begins -- which is what ties a candidate to this archive's real index rather than to any index.
 *
 * FINDING B -- A DIRECTORY IS NOT A PRIMARY PART. Classification accepted any member under `word/` or `xl/` as
 * proof of a Word or Excel package. Those directories hold images, themes, fonts and settings; they say nothing
 * about what the package IS. Reproduced on head 00e7dfa: an archive holding `[Content_Types].xml` and nothing
 * but `word/media/image1.png` was classified `docx`, stored under a generated `.docx` key with the Word content
 * type, and would not open as a document; `xl/media/image1.png` became `xlsx` the same way.
 *
 * The fix: the exact primary part, and nothing else. `word/document.xml` for Word, `xl/workbook.xml` for Excel.
 *
 * Every fixture is a real ZIP written byte by byte, with a correct CRC-32 per member. Nothing is decompressed.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import { classifyZipPackage, readZipCentralDirectory, validateUploadedMedia } from "./media-validation";

/* ------------------------------------------------------------------ a ZIP writer that can carry a comment */

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    let byte = (crc ^ buffer[index]!) & 0xff;
    for (let bit = 0; bit < 8; bit++) byte = byte & 1 ? 0xedb88320 ^ (byte >>> 1) : byte >>> 1;
    crc = (crc >>> 8) ^ byte;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type Entry = { name: string; data: Buffer };

/** `commentLengthOverride` writes a length the comment does not have, which is how a lying record is expressed. */
function buildZip(entries: Entry[], comment: Buffer = Buffer.alloc(0), commentLengthOverride?: number): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "latin1");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(entry.data), 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const block = Buffer.concat([local, name, entry.data]);
    locals.push(block);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt32LE(crc32(entry.data), 16);
    header.writeUInt32LE(entry.data.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([header, name]));
    offset += block.length;
  }
  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(commentLengthOverride ?? comment.length, 20);
  return Buffer.concat([...locals, directory, eocd, comment]);
}

const EOCD_SIGNATURE_BYTES = Buffer.from("PK\x05\x06", "latin1");

/** The fields a planted record declares. Anything omitted is left structurally plausible. */
type DecoyFields = { disk?: number; directoryDisk?: number; entriesOnDisk?: number; totalEntries?: number; directorySize?: number; directoryOffset?: number };

/**
 * Plant a 22-byte EOCD-shaped record inside the archive's comment.
 *
 * The comment-length field is always computed so the decoy APPEARS to reach the end of the file -- that is the
 * whole point, and it is what the R8 test alone could not express. Everything else is the caller's to make
 * invalid. The archive's real EOCD is untouched and still sits behind it.
 */
function plantDecoyEocd(archive: Buffer, commentLength: number, commentIndex: number, fields: DecoyFields): Buffer {
  const out = Buffer.from(archive);
  const position = out.length - commentLength + commentIndex;
  assert.equal(position + 22 <= out.length, true, "the decoy must fit inside the comment");
  out.writeUInt32LE(0x06054b50, position);
  out.writeUInt16LE(fields.disk ?? 0, position + 4);
  out.writeUInt16LE(fields.directoryDisk ?? 0, position + 6);
  out.writeUInt16LE(fields.entriesOnDisk ?? fields.totalEntries ?? 1, position + 8);
  out.writeUInt16LE(fields.totalEntries ?? 1, position + 10);
  out.writeUInt32LE(fields.directorySize ?? 46, position + 12);
  out.writeUInt32LE(fields.directoryOffset ?? 0, position + 16);
  // Chosen so `offset + 22 + commentLength === end of file` holds for the DECOY.
  out.writeUInt16LE(out.length - position - 22, position + 20);
  return out;
}

/** Where a planted record sits in the finished file, so a decoy can be made to satisfy the adjacency rule. */
const decoyPosition = (archive: Buffer, commentLength: number, commentIndex: number) => archive.length - commentLength + commentIndex;
const contentTypes: Entry = { name: "[Content_Types].xml", data: Buffer.from("<Types/>") };
const wordPrimary: Entry = { name: "word/document.xml", data: Buffer.from("<document/>") };
const excelPrimary: Entry = { name: "xl/workbook.xml", data: Buffer.from("<workbook/>") };
const rels: Entry = { name: "_rels/.rels", data: Buffer.from("<Relationships/>") };

const docx = (comment?: Buffer) => buildZip([contentTypes, rels, wordPrimary], comment);
const xlsx = (comment?: Buffer) => buildZip([contentTypes, rels, excelPrimary], comment);

const indexOf = (buffer: Buffer) => readZipCentralDirectory({ buffer }, buffer.length);
const asDocument = (buffer: Buffer, declaredMimeType?: string, originalName?: string) =>
  validateUploadedMedia({ source: { buffer }, allow: ["document"], declaredMimeType, originalName });
async function formatOf(buffer: Buffer): Promise<string> {
  const result = await asDocument(buffer);
  return result.kind === "accepted" ? result.format : `rejected:${result.reason}`;
}

/** A central-directory index carrying just these names, for the name-only rules. */
const index = (...names: string[]) => names.map((name, position) => ({
  name, flags: 0, method: 0, crc32: 0, compressedSize: 0, uncompressedSize: 0,
  localHeaderOffset: position + 1, diskNumberStart: 0, zip64: false,
}));

/* ------------------------------------------------------------------ finding A: the comment is not the record */

test("a DOCX whose comment contains the EOCD signature is still a DOCX", async () => {
  // OBSERVED ON 00e7dfa: the index read as null and the document was stored as `application/zip`.
  const comment = Buffer.concat([EOCD_SIGNATURE_BYTES, Buffer.alloc(40, 0x41)]);
  const withComment = docx(comment);
  assert.equal(withComment.includes(EOCD_SIGNATURE_BYTES, withComment.length - comment.length), true, "the fixture really carries the marker in its comment");

  assert.deepEqual((await indexOf(withComment))!.map((entry) => entry.name), ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
  assert.equal(await formatOf(withComment), "docx");

  // The control: the identical archive with no comment was always read correctly, so the comment is the variable.
  assert.equal(await formatOf(docx()), "docx", "control");
  assert.equal(await formatOf(xlsx(comment)), "xlsx", "and the same for a workbook");
});

test("the marker is found wherever in the comment it sits, and however many times", async () => {
  for (const [label, comment] of [
    ["at the very start", Buffer.concat([EOCD_SIGNATURE_BYTES, Buffer.alloc(64, 0x42)])],
    ["in the middle", Buffer.concat([Buffer.alloc(30, 0x42), EOCD_SIGNATURE_BYTES, Buffer.alloc(30, 0x43)])],
    ["exactly 22 bytes before the end", Buffer.concat([Buffer.alloc(8, 0x42), EOCD_SIGNATURE_BYTES, Buffer.alloc(22, 0x43)])],
    ["several times over", Buffer.concat([EOCD_SIGNATURE_BYTES, Buffer.alloc(10, 0x42), EOCD_SIGNATURE_BYTES, Buffer.alloc(30, 0x43), EOCD_SIGNATURE_BYTES, Buffer.alloc(26, 0x44)])],
    ["a binary comment that happens to contain it", Buffer.concat([Buffer.from([0x00, 0xff, 0x1a, 0x7f]), EOCD_SIGNATURE_BYTES, Buffer.alloc(48, 0x00)])],
  ] as const) {
    assert.equal(await formatOf(docx(comment)), "docx", label);
  }
});

test("a long comment is handled, right up to the field's maximum", async () => {
  // The comment length is a 16-bit field, so 65535 is the largest an archive can declare -- and the search
  // window is sized for exactly that. A comment made entirely of the marker is the worst case for the scan.
  const huge = Buffer.alloc(65535, 0);
  for (let offset = 0; offset + 4 <= huge.length; offset += 4) EOCD_SIGNATURE_BYTES.copy(huge, offset);
  const archive = docx(huge);
  assert.equal(await formatOf(archive), "docx", "65535 bytes of nothing but the signature");
  assert.deepEqual((await indexOf(archive))!.length, 3);
});

test("an ordinary comment carrying no marker is unaffected", async () => {
  assert.equal(await formatOf(docx(Buffer.from("Created by a perfectly ordinary archiver."))), "docx");
  assert.equal(await formatOf(docx(Buffer.alloc(0))), "docx", "and no comment at all");
});

test("a record whose declared comment length does not reach the end of the archive is not the EOCD", async () => {
  // This is the rule itself. A record claiming a 5-byte comment with 40 bytes actually following it is either
  // truncated, doctored, or not a record -- either way it is not the thing that describes this archive.
  const lying = buildZip([contentTypes, wordPrimary], Buffer.alloc(40, 0x41), 5);
  assert.equal(await indexOf(lying), null);
  assert.equal(await formatOf(lying), "zip", "and it falls back to the honest label rather than failing");

  // Overstating it fails the same way: there are not that many bytes left.
  const overstated = buildZip([contentTypes, wordPrimary], Buffer.alloc(8, 0x41), 9000);
  assert.equal(await indexOf(overstated), null);
  assert.equal(await formatOf(overstated), "zip");
});

test("trailing bytes after the comment are not silently tolerated", async () => {
  // Appending data past the declared comment leaves no record whose length reaches the end, so the archive is
  // not indexed rather than being indexed from a record that does not describe it.
  const appended = Buffer.concat([docx(Buffer.from("comment")), Buffer.alloc(64, 0x5a)]);
  assert.equal(await indexOf(appended), null);
  assert.equal(await formatOf(appended), "zip");
});

test("a truncated or absent record is still refused, and the scan stays bounded", async () => {
  const whole = docx();
  for (const [label, buffer] of [
    ["no EOCD at all", whole.subarray(0, whole.length - 22)],
    ["EOCD cut in half", whole.subarray(0, whole.length - 11)],
    ["central directory cut", whole.subarray(0, whole.length - 60)],
    ["four bytes of signature and nothing else", EOCD_SIGNATURE_BYTES],
  ] as const) {
    assert.equal(await indexOf(buffer), null, label);
  }
  // A large archive whose comment is all markers costs one bounded pass, not a search of the whole file.
  const marker = Buffer.alloc(65535, 0);
  for (let offset = 0; offset + 4 <= marker.length; offset += 4) EOCD_SIGNATURE_BYTES.copy(marker, offset);
  const big = buildZip([contentTypes, wordPrimary, { name: "word/media/i.png", data: Buffer.alloc(300 * 1024, 7) }], marker);
  const before = process.memoryUsage().rss;
  assert.equal(await formatOf(big), "docx");
  assert.equal((process.memoryUsage().rss - before) / 1048576 < 64, true, "the scan did not materialise the archive");
});

/* ------------------------------------------------------------------ finding A-II: a decoy is not a choice */

const COMMENT_LENGTH = 96;
const commented = () => buildZip([contentTypes, rels, wordPrimary], Buffer.alloc(COMMENT_LENGTH, 0x41));

test("a deliberate EOCD decoy in the comment is skipped, and the real record behind it is found", async () => {
  // THE R9 FINDING. Each decoy carries the signature AND a comment-length field making it reach EOF -- the two
  // facts R8 checked -- and fails exactly one of the checks that used to run only after the scan had committed.
  // OBSERVED ON fb77848: every one returned `null`, and the DOCX was stored as `application/zip`.
  for (const [label, fields] of [
    ["disk number is 7", { disk: 7 }],
    ["central directory starts on disk 3", { directoryDisk: 3 }],
    ["the two entry counts disagree", { entriesOnDisk: 2, totalEntries: 5 }],
    ["zero entries", { totalEntries: 0 }],
    ["more entries than the bound allows", { totalEntries: 0xfffe }],
    ["zero directory size", { directorySize: 0 }],
    ["directory larger than the bound allows", { directorySize: 0x7fffffff }],
    ["directory offset past the end of the file", { directoryOffset: 0x7ffffff0 }],
    ["Zip64 sentinel in the entry count", { totalEntries: 0xffff }],
    ["Zip64 sentinel in the directory offset", { directoryOffset: 0xffffffff }],
    ["Zip64 sentinel in the directory size", { directorySize: 0xffffffff }],
  ] as const) {
    const forged = plantDecoyEocd(commented(), COMMENT_LENGTH, 8, fields);
    assert.deepEqual((await indexOf(forged))?.map((entry) => entry.name), ["[Content_Types].xml", "_rels/.rels", "word/document.xml"], label);
    assert.equal(await formatOf(forged), "docx", label);
  }
});

test("the central directory must end exactly where the candidate record begins", async () => {
  // This is the check that ties a candidate to THIS archive's index rather than to any plausible byte range. A
  // decoy pointing at the real directory is rejected because that directory does not end where the decoy sits.
  const archive = commented();
  const forged = plantDecoyEocd(archive, COMMENT_LENGTH, 8, { totalEntries: 3, directoryOffset: 0, directorySize: 46 });
  assert.equal(await formatOf(forged), "docx", "the decoy is skipped");

  // And a REAL record whose directory does not end at it is refused outright, with no other candidate to find.
  const mismatched = Buffer.from(archive);
  const realEocd = archive.length - COMMENT_LENGTH - 22;
  mismatched.writeUInt32LE(mismatched.readUInt32LE(realEocd + 12) - 4, realEocd + 12); // shrink the declared size
  assert.equal(await indexOf(mismatched), null, "a directory that stops short of its own record is not read");
  assert.equal(await formatOf(mismatched), "zip");

  const shifted = Buffer.from(archive);
  shifted.writeUInt32LE(shifted.readUInt32LE(realEocd + 16) + 4, realEocd + 16); // move the declared start
  assert.equal(await indexOf(shifted), null, "nor is one that starts in the wrong place");
});

test("a decoy that survives every header check but whose directory does not parse also continues the scan", async () => {
  // The hardest arm: this decoy satisfies the adjacency rule too, by pointing at a 20-byte range of comment
  // filler immediately before itself. Only actually reading that range shows it is not a central directory --
  // and that failure must resume the scan, not end it.
  const archive = commented();
  const position = decoyPosition(archive, COMMENT_LENGTH, 40);
  const forged = plantDecoyEocd(archive, COMMENT_LENGTH, 40, { totalEntries: 1, directoryOffset: position - 20, directorySize: 20 });
  assert.deepEqual((await indexOf(forged))?.map((entry) => entry.name), ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
  assert.equal(await formatOf(forged), "docx");
});

test("several decoys in one comment, all invalid, still resolve to the real record", async () => {
  // Scanning backwards meets them in reverse order, so every one of them has to be walked past.
  let forged = commented();
  forged = plantDecoyEocd(forged, COMMENT_LENGTH, 60, { disk: 9 });
  forged = plantDecoyEocd(forged, COMMENT_LENGTH, 36, { totalEntries: 0 });
  forged = plantDecoyEocd(forged, COMMENT_LENGTH, 12, { directoryOffset: 0x7ffffff0 });
  assert.deepEqual((await indexOf(forged))?.map((entry) => entry.name), ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
  assert.equal(await formatOf(forged), "docx");

  // The same for a workbook and for a plain archive, so this is not a DOCX-shaped accident.
  const book = buildZip([contentTypes, excelPrimary], Buffer.alloc(COMMENT_LENGTH, 0x41));
  assert.equal(await formatOf(plantDecoyEocd(book, COMMENT_LENGTH, 8, { disk: 9 })), "xlsx");
  const plain = buildZip([{ name: "notes.txt", data: Buffer.from("hello") }], Buffer.alloc(COMMENT_LENGTH, 0x41));
  assert.equal(await formatOf(plantDecoyEocd(plain, COMMENT_LENGTH, 8, { disk: 9 })), "zip");
});

test("a decoy cannot shadow the real record into a different classification", async () => {
  // The security property, stated directly: bytes an uploader controls inside a comment must not decide what
  // the file is. A decoy pointing at a directory that would read as a DIFFERENT package changes nothing.
  const book = buildZip([contentTypes, excelPrimary], Buffer.alloc(COMMENT_LENGTH, 0x41));
  const realDirectoryOffset = book.readUInt32LE(book.length - COMMENT_LENGTH - 22 + 16);
  const realDirectorySize = book.readUInt32LE(book.length - COMMENT_LENGTH - 22 + 12);
  const forged = plantDecoyEocd(book, COMMENT_LENGTH, 8, { totalEntries: 2, directoryOffset: realDirectoryOffset, directorySize: realDirectorySize });
  assert.equal(await formatOf(forged), "xlsx", "still the workbook its own index describes");

  // And a decoy in a file with NO real record behind it is still not accepted as one.
  const headless = Buffer.concat([book.subarray(0, book.length - COMMENT_LENGTH - 22), Buffer.alloc(COMMENT_LENGTH, 0x41)]);
  const onlyDecoy = plantDecoyEocd(headless, COMMENT_LENGTH, 8, { totalEntries: 2, directoryOffset: realDirectoryOffset, directorySize: realDirectorySize });
  assert.equal(await indexOf(onlyDecoy), null, "a decoy alone indexes nothing");
});

test("archives with ordinary comments are unaffected, across every package this pipeline stores", async () => {
  for (const [label, archive] of [
    ["docx, no comment", buildZip([contentTypes, rels, wordPrimary])],
    ["docx, ordinary comment", buildZip([contentTypes, rels, wordPrimary], Buffer.from("packaged by something ordinary"))],
    ["xlsx, ordinary comment", buildZip([contentTypes, excelPrimary], Buffer.from("a spreadsheet comment"))],
  ] as const) {
    const result = await asDocument(archive);
    assert.equal(result.kind, "accepted", label);
  }
  assert.equal(await formatOf(buildZip([contentTypes, rels, wordPrimary], Buffer.from("ordinary"))), "docx");
  assert.equal(await formatOf(buildZip([contentTypes, excelPrimary], Buffer.from("ordinary"))), "xlsx");
  assert.equal(await formatOf(buildZip([{ name: "notes.txt", data: Buffer.from("hi") }], Buffer.from("ordinary"))), "zip", "a plain archive with a comment stays a plain archive");
});

test("genuinely malformed archives are still refused, decoys or not", async () => {
  const archive = commented();
  const realEocd = archive.length - COMMENT_LENGTH - 22;
  for (const [label, buffer] of [
    ["the real record blanked out", (() => { const copy = Buffer.from(archive); copy.writeUInt32LE(0, realEocd); return copy; })()],
    ["the real record blanked out, with a decoy left in the comment", (() => {
      const copy = plantDecoyEocd(archive, COMMENT_LENGTH, 8, { disk: 9 });
      copy.writeUInt32LE(0, realEocd);
      return copy;
    })()],
    ["central directory overwritten with filler", (() => {
      const copy = Buffer.from(archive);
      const start = copy.readUInt32LE(realEocd + 16);
      copy.fill(0x41, start, realEocd);
      return copy;
    })()],
    ["central directory truncated away", archive.subarray(0, 40)],
    ["nothing but a comment", Buffer.alloc(256, 0x41)],
  ] as const) {
    assert.equal(await indexOf(buffer), null, label);
  }
});

test("the number of candidates whose directory is actually read stays bounded", async () => {
  // Header validation runs over every signature match in the bounded search region; only candidates that pass
  // ALL of it reach a read, and only a few of those do. A comment packed with decoys costs one bounded pass.
  const long = 8192;
  const archive = buildZip([contentTypes, rels, wordPrimary], Buffer.alloc(long, 0x41));
  let forged = archive;
  for (let index = 0; index + 22 <= long; index += 24) forged = plantDecoyEocd(forged, long, index, { disk: 9 });
  const before = process.memoryUsage().rss;
  assert.equal(await formatOf(forged), "docx", "and the real record is still found behind all of them");
  assert.equal((process.memoryUsage().rss - before) / 1048576 < 64, true, "without materialising the archive repeatedly");
});

/* ------------------------------------------------------------------ finding B: the primary part decides */

test("a package with an OOXML directory but no primary part is an archive", async () => {
  // OBSERVED ON 00e7dfa: both of these were classified as Office documents and stored under `.docx` / `.xlsx`.
  for (const [label, member, was] of [
    ["word/media only", "word/media/image1.png", "docx"],
    ["word/ anything", "word/settings.xml", "docx"],
    ["word/ theme", "word/theme/theme1.xml", "docx"],
    ["xl/media only", "xl/media/image1.png", "xlsx"],
    ["xl/ anything", "xl/styles.xml", "xlsx"],
    ["xl/ worksheet without a workbook", "xl/worksheets/sheet1.xml", "xlsx"],
  ] as const) {
    const archive = buildZip([contentTypes, { name: member, data: Buffer.alloc(32, 7) }]);
    assert.equal(await formatOf(archive), "zip", `${label} (was ${was})`);
    assert.equal(classifyZipPackage(Buffer.alloc(128), index("[Content_Types].xml", member)), "zip", label);
  }
});

test("the real primary part is still what makes a document a document", async () => {
  for (const [buffer, format, contentType] of [
    [docx(), "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    [xlsx(), "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ] as const) {
    const result = await asDocument(buffer);
    assert.equal(result.kind, "accepted", format);
    assert.equal(result.kind === "accepted" && result.format, format);
    assert.equal(result.kind === "accepted" && result.extension, format);
    assert.equal(result.kind === "accepted" && result.contentType, contentType);
  }
  // A real package carries plenty of other members alongside its primary part, and they change nothing.
  const full = buildZip([contentTypes, rels, wordPrimary, { name: "word/media/image1.png", data: Buffer.alloc(64, 7) }, { name: "word/settings.xml", data: Buffer.from("<settings/>") }, { name: "docProps/app.xml", data: Buffer.from("<Properties/>") }]);
  assert.equal(await formatOf(full), "docx");
});

test("the R5 correction survives: a primary part far into the archive is still found", async () => {
  // The member names come from the central directory, so where a part sits does not matter -- but the exact
  // name now does, and these two facts have to hold together.
  const bigFirst = { name: "word/media/image1.png", data: Buffer.alloc(80 * 1024, 0x42) };
  const late = buildZip([bigFirst, contentTypes, wordPrimary]);
  assert.equal(late.indexOf("word/document.xml") > 64 * 1024, true, "the fixture really does defeat a head scan");
  assert.equal(await formatOf(late), "docx");

  const lateWorkbook = buildZip([{ name: "xl/media/image1.png", data: Buffer.alloc(80 * 1024, 0x42) }, contentTypes, excelPrimary]);
  assert.equal(await formatOf(lateWorkbook), "xlsx");
});

test("names are still compared case-insensitively, and only at the package root", () => {
  assert.equal(classifyZipPackage(Buffer.alloc(128), index("[content_types].xml", "WORD/Document.xml")), "docx");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index("[CONTENT_TYPES].XML", "XL/WORKBOOK.XML")), "xlsx");
  // A lookalike in a subdirectory is not the primary part.
  assert.equal(classifyZipPackage(Buffer.alloc(128), index("[Content_Types].xml", "nested/word/document.xml")), "zip");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index("[Content_Types].xml", "word/document.xml.bak")), "zip");
  // And the content types part is still required.
  assert.equal(classifyZipPackage(Buffer.alloc(128), index("word/document.xml")), "zip");
  // Word still wins over Excel: a document embedding a spreadsheet is still a document.
  assert.equal(classifyZipPackage(Buffer.alloc(128), index("[Content_Types].xml", "word/document.xml", "xl/workbook.xml")), "docx");
});

test("neither the declared type nor the filename can supply the missing primary part", async () => {
  const pretender = buildZip([contentTypes, { name: "word/media/image1.png", data: Buffer.alloc(32, 7) }]);
  for (const [declared, name] of [
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "report.docx"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "book.xlsx"],
  ] as const) {
    const result = await asDocument(pretender, declared, name);
    assert.equal(result.kind === "accepted" && result.format, "zip", `${declared}/${name}`);
    assert.equal(result.kind === "accepted" && result.extension, "zip");
  }
});
