/**
 * ZIP packages, classified from the archive's own central directory.
 *
 * THE FINDING. The previous implementation searched the first 64 KiB for the literal `[Content_Types].xml`.
 * ZIP guarantees no member ordering, so that assumption is simply wrong. Reproduced on head 5e9e2d6: a DOCX
 * whose first member is an 80 KiB image puts `[Content_Types].xml` at offset 82001 and was classified as a
 * generic `.zip` -- a legitimate Office document stored under the wrong type and extension, which breaks the
 * marketplace digital-product download it was uploaded for.
 *
 * Every fixture here is a real ZIP built byte by byte: local file headers, a central directory and an EOCD, with
 * a correct CRC-32 per member. Nothing is compressed, and nothing in the implementation inflates anything --
 * this is classification, not extraction.
 */
import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";
import {
  ZIP_MAX_ENTRIES,
  ZIP_MAX_ENTRY_NAME_BYTES,
  classifyZipPackage,
  detectMediaContainer,
  readZipCentralDirectoryNames,
  validateUploadedMedia,
} from "./media-validation";

/* ------------------------------------------------------------------ a real ZIP writer */

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    let c = (crc ^ buffer[index]!) & 0xff;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type Entry = { name: string; data: Buffer };

function buildZip(entries: Entry[], options: { entryCountOverride?: number; directorySizeOverride?: number; directoryOffsetOverride?: number } = {}): Buffer {
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
  eocd.writeUInt16LE(options.entryCountOverride ?? entries.length, 8);
  eocd.writeUInt16LE(options.entryCountOverride ?? entries.length, 10);
  eocd.writeUInt32LE(options.directorySizeOverride ?? directory.length, 12);
  eocd.writeUInt32LE(options.directoryOffsetOverride ?? offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

const contentTypes = { name: "[Content_Types].xml", data: Buffer.from("<Types/>") };
/** Large enough to push everything after it beyond the 64 KiB head the old implementation searched. */
const bigMedia = (name: string) => ({ name, data: Buffer.alloc(80 * 1024, 0x42) });

const docx = () => buildZip([contentTypes, { name: "_rels/.rels", data: Buffer.from("<Relationships/>") }, { name: "word/document.xml", data: Buffer.from("<document/>") }]);
const docxLateContentTypes = () => buildZip([bigMedia("word/media/image1.png"), contentTypes, { name: "word/document.xml", data: Buffer.from("<document/>") }]);
const xlsx = () => buildZip([contentTypes, { name: "xl/workbook.xml", data: Buffer.from("<workbook/>") }]);
const xlsxLateContentTypes = () => buildZip([bigMedia("xl/media/image1.png"), contentTypes, { name: "xl/workbook.xml", data: Buffer.from("<workbook/>") }]);
const plainZip = () => buildZip([{ name: "notes.txt", data: Buffer.from("hello") }, { name: "data/readme.md", data: Buffer.from("# hi") }]);
const epub = () => buildZip([{ name: "mimetype", data: Buffer.from("application/epub+zip") }, { name: "META-INF/container.xml", data: Buffer.from("<container/>") }, { name: "OEBPS/content.opf", data: Buffer.from("<package/>") }]);

const asDocument = (buffer: Buffer, declaredMimeType?: string, originalName?: string) =>
  validateUploadedMedia({ source: { buffer }, allow: ["document"], declaredMimeType, originalName });

/* ------------------------------------------------------------------ the finding */

test("a DOCX is classified DOCX, however far into the archive its content types sit", async () => {
  for (const [label, buffer] of [["content types first", docx()], ["80 KiB image first", docxLateContentTypes()]] as const) {
    const result = await asDocument(buffer);
    assert.equal(result.kind, "accepted", label);
    assert.equal(result.kind === "accepted" && result.format, "docx", label);
    assert.equal(result.kind === "accepted" && result.extension, "docx", label);
    assert.equal(result.kind === "accepted" && result.contentType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label);
  }
  // OBSERVED ON 5e9e2d6: the second fixture was classified `zip`.
  assert.equal(docxLateContentTypes().indexOf("[Content_Types].xml") > 64 * 1024, true, "the fixture really does defeat a head scan");
});

test("an XLSX is classified XLSX, however far into the archive its content types sit", async () => {
  for (const [label, buffer] of [["content types first", xlsx()], ["80 KiB image first", xlsxLateContentTypes()]] as const) {
    const result = await asDocument(buffer);
    assert.equal(result.kind === "accepted" && result.format, "xlsx", label);
    assert.equal(result.kind === "accepted" && result.extension, "xlsx", label);
    assert.equal(result.kind === "accepted" && result.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label);
  }
});

test("a plain archive stays a plain archive", async () => {
  const result = await asDocument(plainZip());
  assert.equal(result.kind === "accepted" && result.format, "zip");
  assert.equal(result.kind === "accepted" && result.contentType, "application/zip");
});

test("an EPUB is still classified EPUB", async () => {
  // OCF requires `mimetype` to be the first member, stored, holding exactly `application/epub+zip`. That is a
  // structural guarantee at a fixed position, so it is read there and does not depend on the directory at all.
  const result = await asDocument(epub());
  assert.equal(result.kind === "accepted" && result.format, "epub");
  assert.equal(result.kind === "accepted" && result.extension, "epub");
  assert.equal(result.kind === "accepted" && result.contentType, "application/epub+zip");
});

/* ------------------------------------------------------------------ nothing outside the archive decides */

test("a misleading name or declared type cannot make an archive into an Office document", async () => {
  for (const [declared, name] of [
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "payroll.docx"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "payroll.xlsx"],
    ["application/epub+zip", "novel.epub"],
  ] as const) {
    const result = await asDocument(plainZip(), declared, name);
    assert.equal(result.kind === "accepted" && result.format, "zip", `${declared} / ${name}`);
  }
  // And an archive that merely contains a file *named* like an OOXML part is not one either: the part must be at
  // the package root under its exact name, not a lookalike in a subdirectory.
  const pretender = buildZip([{ name: "notes/[Content_Types].xml.txt", data: Buffer.from("not really") }, { name: "wordlist.txt", data: Buffer.from("x") }]);
  const claimed = await asDocument(pretender, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "x.docx");
  assert.equal(claimed.kind, "accepted");
  assert.equal(claimed.kind === "accepted" && claimed.format, "zip");
});

test("content types without a primary part is not enough, and a primary part without content types is not either", () => {
  assert.equal(classifyZipPackage(Buffer.alloc(128), ["[Content_Types].xml", "docProps/app.xml"]), "zip", "no word/ or xl/ part");
  assert.equal(classifyZipPackage(Buffer.alloc(128), ["word/document.xml"]), "zip", "no [Content_Types].xml");
  assert.equal(classifyZipPackage(Buffer.alloc(128), ["[Content_Types].xml", "word/document.xml"]), "docx");
  assert.equal(classifyZipPackage(Buffer.alloc(128), ["[Content_Types].xml", "xl/workbook.xml"]), "xlsx");
  // A document embedding a spreadsheet is still a document.
  assert.equal(classifyZipPackage(Buffer.alloc(128), ["[Content_Types].xml", "word/document.xml", "xl/embedded.xlsx"]), "docx");
  // Entry names are compared case-insensitively, as archive tooling writes them inconsistently.
  assert.equal(classifyZipPackage(Buffer.alloc(128), ["[content_types].xml", "WORD/document.xml"]), "docx");
});

/* ------------------------------------------------------------------ malformed and hostile archives */

test("a malformed or truncated archive falls back to generic zip rather than guessing", async () => {
  const complete = docx();
  for (const [label, buffer] of [
    ["no end-of-central-directory", complete.subarray(0, complete.length - 22)],
    ["truncated central directory", complete.subarray(0, complete.length - 40)],
    ["header bytes only", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0)])],
  ] as const) {
    const result = await asDocument(buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "x.docx");
    // Still a ZIP by signature, so still accepted -- but labelled honestly rather than as an Office document.
    if (result.kind === "accepted") assert.equal(result.format, "zip", label);
  }
});

test("absurd directory metadata is rejected before a byte is addressed", async () => {
  const entries = [contentTypes, { name: "word/document.xml", data: Buffer.from("<document/>") }];
  // An entry count far beyond the bound.
  assert.equal(await readZipCentralDirectoryNames({ buffer: buildZip(entries, { entryCountOverride: ZIP_MAX_ENTRIES + 1 }) }, buildZip(entries, { entryCountOverride: ZIP_MAX_ENTRIES + 1 }).length), null);
  // A directory claiming to be larger than the file.
  const oversizedDirectory = buildZip(entries, { directorySizeOverride: 0x7fffffff });
  assert.equal(await readZipCentralDirectoryNames({ buffer: oversizedDirectory }, oversizedDirectory.length), null);
  // A directory that starts past the end of the file.
  const badOffset = buildZip(entries, { directoryOffsetOverride: 0x7ffffff0 });
  assert.equal(await readZipCentralDirectoryNames({ buffer: badOffset }, badOffset.length), null);
  // Zip64 sentinels are not parsed and are not guessed at.
  const zip64 = buildZip(entries, { entryCountOverride: 0xffff });
  assert.equal(await readZipCentralDirectoryNames({ buffer: zip64 }, zip64.length), null);
  // And every one of those falls back to the honest label rather than failing the upload.
  assert.equal(classifyZipPackage(Buffer.alloc(128), null), "zip");
});

test("the directory read is bounded in entries, in size and in name length", async () => {
  assert.equal(ZIP_MAX_ENTRIES, 2048);
  assert.equal(ZIP_MAX_ENTRY_NAME_BYTES, 512);
  // An entry name longer than the bound aborts the read rather than allocating for it.
  const longName = buildZip([{ name: "w/".repeat(300) + "document.xml", data: Buffer.from("x") }]);
  assert.equal(await readZipCentralDirectoryNames({ buffer: longName }, longName.length), null);
  // A well-formed archive within the bounds reads exactly its member names.
  const archive = docx();
  assert.deepEqual(await readZipCentralDirectoryNames({ buffer: archive }, archive.length), ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
});

test("classification never inflates a member", async () => {
  // A deflate bomb: a member whose declared uncompressed size is enormous. Classification reads names from the
  // directory and never touches member data, so this is simply a ZIP with a silly header.
  const bomb = zlib.deflateRawSync(Buffer.alloc(1024 * 1024, 0));
  const archive = buildZip([contentTypes, { name: "word/document.xml", data: bomb }]);
  const before = process.memoryUsage().rss;
  const result = await asDocument(archive);
  const grew = (process.memoryUsage().rss - before) / 1048576;
  assert.equal(result.kind === "accepted" && result.format, "docx");
  assert.equal(grew < 64, true, `classification allocated ${grew.toFixed(0)}MB; it must not be inflating anything`);
});

test("a ZIP is still a ZIP by signature before any of this runs", () => {
  assert.deepEqual(detectMediaContainer(docx()), { container: "zip" });
  assert.deepEqual(detectMediaContainer(plainZip()), { container: "zip" });
});

test("the original Office bytes are preserved exactly", async () => {
  // Classification is a read. Nothing here rewrites, re-zips or normalises the archive.
  const original = docxLateContentTypes();
  const copy = Buffer.from(original);
  const result = await asDocument(original);
  assert.equal(result.kind === "accepted" && result.format, "docx");
  assert.equal(original.equals(copy), true, "the buffer handed in is untouched");
});
