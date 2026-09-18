/**
 * A ZIP describes every member twice, and a package marker only counts when both descriptions agree.
 *
 * THE FINDING. Each member has a local file header, which the member's data follows, and a central directory
 * record, which readers index from. Classification read only the directory, so an archive could advertise
 * `word/document.xml` there while the local header at that member's offset named something else entirely. Real
 * readers do not agree on such a file -- which is exactly the problem.
 *
 * REPRODUCED ON HEAD 13d0ece, with a real python-`zipfile` DOCX whose one local header was rewritten in place
 * (same length, so every offset stayed valid):
 *
 *   Python `zipfile`   namelist() lists word/document.xml, then read() raises
 *                      BadZipFile: File name in directory 'word/document.xml' and header
 *                      b'zzzz/zzzzzzzz.xml' differ.
 *   Info-ZIP `unzip`   testing: word/document.xml: mismatching "local" filename (zzzz/zzzzzzzz.xml),
 *                      continuing with "central" filename version
 *                      At least one warning-error was detected in mismatch.docx.
 *   ChefSire           accepted -> docx, extension .docx, Word content type.
 *
 * So ChefSire published a Word document that the tools which open Word documents refuse to open. The same held
 * for `xl/workbook.xml` -> xlsx. Both now fall closed to an inert generic `zip`.
 *
 * EPUB WAS ALREADY PROTECTED, and that was checked rather than assumed: on the same head `13d0ece`, an EPUB
 * whose `mimetype` local header was rewritten the same way ALREADY classified `zip`, because the OCF rule reads
 * the real local header at offset 0 and requires the index entry at offset 0 to name `mimetype`. No
 * EPUB-specific work was needed; the coverage below pins it so it stays that way.
 *
 * WHAT IS COMPARED, AND WHY ONLY THAT. The name, byte for byte -- the format has one file-name field, defined
 * once and written into both structures to name one member. CRC and sizes are deliberately NOT compared: a
 * general-purpose bit flag with bit 3 set means the local CRC-32 and both sizes are written as zero and the real
 * values live in the data descriptor and the central directory, so requiring those to agree would refuse
 * conforming archives. A data-descriptor package is covered below and still classifies.
 *
 * Every fixture is a real ZIP written byte by byte, with a correct CRC-32 per member. Nothing is decompressed.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import { readVerifiedZipCentralDirectory, readZipCentralDirectory, validateUploadedMedia } from "./media-validation";

/* ------------------------------------------------------------------ a ZIP writer whose two headers can disagree */

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    let byte = (crc ^ buffer[index]!) & 0xff;
    for (let bit = 0; bit < 8; bit++) byte = byte & 1 ? 0xedb88320 ^ (byte >>> 1) : byte >>> 1;
    crc = (crc >>> 8) ^ byte;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * One member. `name` is what the CENTRAL DIRECTORY says; the `local*` fields are what the LOCAL FILE HEADER
 * says. Leaving them out makes the two agree, which is what a conforming writer produces.
 */
type Entry = {
  name: string;
  data: Buffer;
  /** A different name in the local header. This is the disagreement the finding is about. */
  localName?: string;
  /** A local header signature that is not one. */
  localSignature?: number;
  /** A name length the local header does not have. */
  localNameLengthOverride?: number;
  /** An extra-field length the local header does not have. */
  localExtraLengthOverride?: number;
  /** Point the central record's local-header offset somewhere other than this member. */
  centralOffsetOverride?: number;
  /** Set the general purpose bit flag, e.g. bit 3 for a data descriptor. */
  flags?: number;
  /** Write the local CRC and sizes as zero, which is what bit 3 requires. */
  zeroLocalSizes?: boolean;
};

function buildZip(entries: Entry[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  const offsets: number[] = [];
  let offset = 0;
  for (const entry of entries) {
    const localName = Buffer.from(entry.localName ?? entry.name, "latin1");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(entry.localSignature ?? 0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.flags ?? 0, 6);
    local.writeUInt32LE(entry.zeroLocalSizes ? 0 : crc32(entry.data), 14);
    local.writeUInt32LE(entry.zeroLocalSizes ? 0 : entry.data.length, 18);
    local.writeUInt32LE(entry.zeroLocalSizes ? 0 : entry.data.length, 22);
    local.writeUInt16LE(entry.localNameLengthOverride ?? localName.length, 26);
    local.writeUInt16LE(entry.localExtraLengthOverride ?? 0, 28);
    const block = Buffer.concat([local, localName, entry.data]);
    locals.push(block);
    offsets.push(offset);
    offset += block.length;
  }
  for (const [position, entry] of entries.entries()) {
    const centralName = Buffer.from(entry.name, "latin1");
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(entry.flags ?? 0, 8);
    header.writeUInt32LE(crc32(entry.data), 16);
    header.writeUInt32LE(entry.data.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(centralName.length, 28);
    header.writeUInt32LE(entry.centralOffsetOverride ?? offsets[position]!, 42);
    central.push(Buffer.concat([header, centralName]));
  }
  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

const part = (name: string, over: Partial<Entry> = {}): Entry => ({ name, data: Buffer.from("<x/>"), ...over });

const CONTENT_TYPES = "[Content_Types].xml";
const WORD_PRIMARY = "word/document.xml";
const EXCEL_PRIMARY = "xl/workbook.xml";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const asDocument = (buffer: Buffer, declaredMimeType?: string, originalName?: string) =>
  validateUploadedMedia({ source: { buffer }, allow: ["document"], declaredMimeType, originalName });

async function classify(entries: Entry[], declaredMimeType?: string, originalName?: string) {
  const result = await asDocument(buildZip(entries), declaredMimeType, originalName);
  return result.kind === "accepted"
    ? { format: result.format, extension: result.extension, contentType: result.contentType }
    : { format: `rejected:${result.reason}`, extension: "", contentType: "" };
}

/* ------------------------------------------------------------------ A and B: conforming packages still classify */

test("a DOCX and an XLSX whose headers agree still classify", async () => {
  assert.deepEqual(await classify([part(CONTENT_TYPES), part("_rels/.rels"), part(WORD_PRIMARY)]), { format: "docx", extension: "docx", contentType: DOCX_TYPE });
  assert.deepEqual(await classify([part(CONTENT_TYPES), part("_rels/.rels"), part(EXCEL_PRIMARY)]), { format: "xlsx", extension: "xlsx", contentType: XLSX_TYPE });
  // With the other members a real package carries, whose local headers are equally consistent.
  assert.equal((await classify([part(CONTENT_TYPES), part("_rels/.rels"), part(WORD_PRIMARY), part("word/media/image1.png"), part("docProps/core.xml")])).format, "docx");
});

/* ------------------------------------------------------------------ C and D: the finding itself */

test("a DOCX marker whose local header names something else is not a DOCX", async () => {
  // OBSERVED ON 13d0ece: `docx`, published under a `.docx` key with the Word content type, while Python's
  // zipfile raises BadZipFile on read and unzip reports a warning-error.
  for (const [label, localName] of [
    ["a different path entirely", "zzzz/zzzzzzzz.xml"],
    ["a shorter name", "a.xml"],
    ["a longer name", "word/document.xml.and.then.some.more"],
    ["a name differing in one byte", "word/documenu.xml"],
    ["an empty-looking decoy", "x"],
  ] as const) {
    const result = await classify([part(CONTENT_TYPES), part(WORD_PRIMARY, { localName })]);
    assert.equal(result.format, "zip", `${label}: ${result.format}`);
    assert.equal(result.extension, "zip", label);
    assert.equal(result.contentType, "application/zip", label);
  }
});

test("an XLSX marker whose local header names something else is not an XLSX", async () => {
  for (const localName of ["zz/zzzzzzzz.xml", "xl/workbooks.xml", "other.bin"]) {
    const result = await classify([part(CONTENT_TYPES), part(EXCEL_PRIMARY, { localName })]);
    assert.equal(result.format, "zip", localName);
    assert.equal(result.extension, "zip", localName);
  }
});

test("the content-types marker is checked too, not only the primary part", async () => {
  // It is one of the three entries that decide a format, so it is one of the three that must agree.
  assert.equal((await classify([part(CONTENT_TYPES, { localName: "[Content_Types].xm" }), part(WORD_PRIMARY)])).format, "zip");
  assert.equal((await classify([part(CONTENT_TYPES, { localName: "something/else.xml" }), part(EXCEL_PRIMARY)])).format, "zip");
});

test("the request cannot supply the agreement the archive lacks", async () => {
  for (const [declared, name] of [[DOCX_TYPE, "report.docx"], [XLSX_TYPE, "book.xlsx"]] as const) {
    const result = await classify([part(CONTENT_TYPES), part(WORD_PRIMARY, { localName: "zzzz/zzzzzzzz.xml" })], declared, name);
    assert.equal(result.format, "zip", `${declared}/${name}`);
    assert.equal(result.extension, "zip", `${declared}/${name}`);
  }
});

/* ------------------------------------------------------------------ E to I: the local header is hostile input */

test("a local header that is not one is refused", async () => {
  for (const [label, signature] of [
    ["zeroed signature", 0],
    ["a central header signature", 0x02014b50],
    ["an EOCD signature", 0x06054b50],
    ["arbitrary bytes", 0xdeadbeef],
  ] as const) {
    assert.equal((await classify([part(CONTENT_TYPES), part(WORD_PRIMARY, { localSignature: signature })])).format, "zip", label);
  }
});

test("a local-header offset outside the archive is refused", async () => {
  for (const [label, offset] of [
    ["far past the end", 0x7ffffff0],
    ["the 32-bit maximum", 0xfffffffe],
    ["just past the end", 10_000],
  ] as const) {
    assert.equal((await classify([part(CONTENT_TYPES), part(WORD_PRIMARY, { centralOffsetOverride: offset })])).format, "zip", label);
  }
});

test("a truncated local header is refused", async () => {
  // Point the marker at a position so near the end that its fixed 30-byte header cannot fit.
  const archive = buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY)]);
  const nearEnd = archive.length - 10;
  const truncated = buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY, { centralOffsetOverride: nearEnd })]);
  assert.equal((await asDocument(truncated)).kind === "accepted" && ((await asDocument(truncated)) as { format: string }).format, "zip");

  // And an archive physically cut inside the marker's local header.
  const whole = buildZip([part(WORD_PRIMARY), part(CONTENT_TYPES)]);
  const cut = whole.subarray(0, 20);
  const result = await asDocument(cut);
  if (result.kind === "accepted") assert.equal(result.format, "zip");
});

test("a local header lying about its name length is refused", async () => {
  for (const [label, nameLength] of [
    ["zero", 0],
    ["beyond the bound", 5000],
    ["the 16-bit maximum", 0xffff],
    ["longer than the bytes that follow", 400],
  ] as const) {
    assert.equal((await classify([part(CONTENT_TYPES), part(WORD_PRIMARY, { localNameLengthOverride: nameLength })])).format, "zip", label);
  }
  // A length that is merely WRONG but in bounds still fails, because the name it yields is not the central name.
  assert.equal((await classify([part(CONTENT_TYPES), part(WORD_PRIMARY, { localNameLengthOverride: 4 })])).format, "zip", "short but in bounds");
});

test("a local header lying about its extra-field length is refused", async () => {
  for (const [label, extraLength] of [
    ["beyond the tolerated bound", 5000],
    ["the 16-bit maximum", 0xffff],
    ["past the end of the archive", 60000],
  ] as const) {
    assert.equal((await classify([part(CONTENT_TYPES), part(WORD_PRIMARY, { localExtraLengthOverride: extraLength })])).format, "zip", label);
  }
});

/* ------------------------------------------------------------------ J and K: the OPC rules are untouched */

test("a case-variant package is still recognised, and its local headers are still checked", async () => {
  // OPC part identity is ASCII case-insensitive (ECMA-376 Part 2 7.2.3.5), so these ARE the required parts and
  // still classify. The selection of what to verify uses the same fold DELIBERATELY -- otherwise a case variant
  // would skip the local-header check and then be used to classify, which is the hole this closes.
  assert.equal((await classify([part("[content_types].xml"), part("WORD/DOCUMENT.XML")])).format, "docx");
  assert.equal((await classify([part("[CONTENT_TYPES].XML"), part("XL/WORKBOOK.XML")])).format, "xlsx");

  // And the same packages with a mismatched local header fall closed, so the variant is not a way around it.
  assert.equal((await classify([part("[content_types].xml"), part("WORD/DOCUMENT.XML", { localName: "zzzz/zzzzzzzz.xml" })])).format, "zip");
  assert.equal((await classify([part("[CONTENT_TYPES].XML", { localName: "nope.xml" }), part("XL/WORKBOOK.XML")])).format, "zip");
  assert.equal((await classify([part("[content_types].xml"), part("WORD/DOCUMENT.XML", { localSignature: 0 })])).format, "zip");
});

test("case-colliding parts still fail closed, with or without local-header agreement", async () => {
  assert.equal((await classify([part(CONTENT_TYPES), part(WORD_PRIMARY), part("WORD/DOCUMENT.XML")])).format, "zip");
  assert.equal((await classify([part(CONTENT_TYPES), part("[content_types].xml"), part(WORD_PRIMARY)])).format, "zip");
  assert.equal((await classify([part(CONTENT_TYPES), part(EXCEL_PRIMARY), part("XL/WORKBOOK.XML")])).format, "zip");
});

test("a package with an OOXML directory but no primary part is still an archive", async () => {
  assert.equal((await classify([part(CONTENT_TYPES), part("word/media/image1.png")])).format, "zip");
  assert.equal((await classify([part(CONTENT_TYPES), part("xl/media/image1.png")])).format, "zip");
});

/* ------------------------------------------------------------------ data descriptors are not broken by this */

test("an entry using a data descriptor still classifies, because CRC and sizes are not compared", async () => {
  // Bit 3 means the local CRC-32 and both sizes are written as ZERO and the real values live in the data
  // descriptor and the central directory. Only the NAME is compared, so such a package is unaffected.
  const descriptor = { flags: 0x0008, zeroLocalSizes: true };
  assert.equal((await classify([part(CONTENT_TYPES, descriptor), part(WORD_PRIMARY, descriptor)])).format, "docx");
  assert.equal((await classify([part(CONTENT_TYPES, descriptor), part(EXCEL_PRIMARY, descriptor)])).format, "xlsx");
  // Mixed: one member deferring its sizes, one not.
  assert.equal((await classify([part(CONTENT_TYPES), part(WORD_PRIMARY, descriptor)])).format, "docx");
  // And a data-descriptor entry whose NAME disagrees is still refused, so the exemption is only about sizes.
  assert.equal((await classify([part(CONTENT_TYPES, descriptor), part(WORD_PRIMARY, { ...descriptor, localName: "zzzz.xml" })])).format, "zip");
});

/* ------------------------------------------------------------------ EPUB: already protected, and pinned so */

test("EPUB already refused this, by its own OCF local-header rule", async () => {
  // Checked on head 13d0ece rather than assumed: a `mimetype` central entry whose local header named something
  // else ALREADY classified `zip` there, because `looksLikeEpubContainer` reads the real local header at
  // offset 0 and requires the index entry at offset 0 to name `mimetype`. Python agrees: BadZipFile,
  // "File name in directory 'mimetype' and header b'MISMATCH' differ."
  const media = Buffer.from("application/epub+zip", "latin1");
  const book = (over: Partial<Entry> = {}) => buildZip([
    { name: "mimetype", data: media, ...over },
    part("META-INF/container.xml"),
    part("OEBPS/content.opf"),
  ]);
  assert.equal((await asDocument(book())).kind === "accepted" && ((await asDocument(book())) as { format: string }).format, "epub", "a real book still reads");

  for (const [label, over] of [
    ["local header names something else", { localName: "MISMATCH" }],
    ["local header names a longer path", { localName: "META-INF/mimetype" }],
  ] as const) {
    const result = await asDocument(book(over), "application/epub+zip", "novel.epub");
    assert.equal(result.kind === "accepted" && result.format, "zip", label);
  }

  // Breaking the FIRST member's local signature fails even harder, and correctly so: those four bytes are the
  // archive's own signature at offset 0, so the file is not detected as a ZIP at all and never reaches
  // classification. Both outcomes are closed; this one just closes earlier.
  const brokenSignature = await asDocument(book({ localSignature: 0x02014b50 }), "application/epub+zip", "novel.epub");
  assert.equal(brokenSignature.kind, "rejected");
  assert.equal(brokenSignature.kind === "rejected" && brokenSignature.reason, "content_mismatch");
});

/* ------------------------------------------------------------------ the shared mechanism, directly */

test("the verified read is the index plus agreement, and the plain read still just reads the index", async () => {
  const consistent = buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY)]);
  const inconsistent = buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY, { localName: "zzzz/zzzzzzzz.xml" })]);

  // The index reader answers a question about the directory, and both archives have a readable directory.
  assert.deepEqual((await readZipCentralDirectory({ buffer: consistent }, consistent.length))!.map((entry) => entry.name), [CONTENT_TYPES, WORD_PRIMARY]);
  assert.deepEqual((await readZipCentralDirectory({ buffer: inconsistent }, inconsistent.length))!.map((entry) => entry.name), [CONTENT_TYPES, WORD_PRIMARY]);

  // The verified reader answers whether the entries that decide a format agree with the bytes they point at.
  assert.deepEqual((await readVerifiedZipCentralDirectory({ buffer: consistent }, consistent.length))!.map((entry) => entry.name), [CONTENT_TYPES, WORD_PRIMARY]);
  assert.equal(await readVerifiedZipCentralDirectory({ buffer: inconsistent }, inconsistent.length), null);
});

test("non-marker members are not verified, which is the stated scope", async () => {
  // Only entries that can decide a format are security-sensitive markers, so only those are checked. A
  // mismatched local header on an unrelated member leaves the package classified by the markers that do agree.
  // Stating this plainly rather than implying every member is cross-checked: that would cost a read per entry.
  const result = await classify([part(CONTENT_TYPES), part(WORD_PRIMARY), part("docProps/core.xml", { localName: "elsewhere.xml" })]);
  assert.equal(result.format, "docx");
});

test("the checks stay bounded: a package cannot force an unbounded number of header reads", async () => {
  // Colliding markers are refused anyway, and the number of local headers read is capped regardless, so an
  // archive packed with marker-looking entries costs a bounded amount of work.
  const many = Array.from({ length: 40 }, (_, position) => part(position % 2 === 0 ? "WORD/DOCUMENT.XML" : "word/document.xml", { data: Buffer.from(`<x${position}/>`) }));
  const before = process.memoryUsage().rss;
  assert.equal((await classify([part(CONTENT_TYPES), ...many])).format, "zip");
  assert.equal((process.memoryUsage().rss - before) / 1048576 < 64, true, "and it did not materialise the archive repeatedly");
});
