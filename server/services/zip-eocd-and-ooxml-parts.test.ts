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
