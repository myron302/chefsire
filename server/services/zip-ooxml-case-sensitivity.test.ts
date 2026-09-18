/**
 * OPC part names are case-sensitive, and a central directory must account for all of itself.
 *
 * FINDING A -- OOXML IS NOT A CASE-INSENSITIVE FORMAT. `classifyZipPackage` lower-cased every entry name before
 * comparing it to the package markers. ECMA-376 fixes the content-types stream as `[Content_Types].xml` and the
 * primary parts as `word/document.xml` and `xl/workbook.xml`; a conforming reader looks for those names, not for
 * their case-folded shapes. Reproduced on head 4683cd9 -- every one of these was classified `docx` or `xlsx`:
 *
 *   [content_types].xml  +  word/document.xml     -> docx
 *   [Content_Types].xml  +  WORD/document.xml     -> docx
 *   [Content_Types].xml  +  word/DOCUMENT.XML     -> docx
 *   [CONTENT_TYPES].XML  +  WORD/DOCUMENT.XML     -> docx
 *   [content_types].xml  +  XL/WORKBOOK.XML       -> xlsx
 *
 * So a generic archive was published under a generated `.docx` key with the Word content type while Word would
 * not open it as a document at all -- ChefSire asserting a format its own contents deny. The fix compares the
 * markers exactly; nothing in that decision is case-folded any more.
 *
 * FINDING B -- A RECORD COUNT THAT UNDER-REPORTS PARSED A PREFIX. The entry loop runs exactly `totalEntries`
 * times, so an archive whose `directorySize` covers more records than its count admits used to be read as just
 * the first few. Reproduced on head 4683cd9: two central records with `directorySize` covering both and
 * `totalEntries` altered to 1 read as a ONE-member index -- so the members this validator saw were not the
 * members a real reader sees, which is the whole class of confusion this module exists to close. Parsing must
 * now land exactly on the end of the declared directory, or the archive is not indexed at all.
 *
 * PPTX, STATED PLAINLY. This pipeline stores no PowerPoint format -- there is no `pptx` entry in `MEDIA_TYPES` --
 * so a presentation is a generic `zip`: inert, correctly typed, served as an attachment. There is no PPTX marker
 * to compare case-sensitively. That is pinned below rather than left to be assumed, in both directions.
 *
 * Every fixture is a real ZIP written byte by byte, with a correct CRC-32 per member. Nothing is decompressed.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import { classifyZipPackage, readZipCentralDirectory, validateUploadedMedia } from "./media-validation";

/* ------------------------------------------------------------------ a ZIP writer whose count can under-report */

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
/** `totalEntriesOverride` writes a count the directory does not have, in BOTH EOCD count fields. */
type ZipOptions = { totalEntriesOverride?: number; directoryPadding?: Buffer };

function buildZip(entries: Entry[], options: ZipOptions = {}): Buffer {
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
  const directory = Buffer.concat([...central, options.directoryPadding ?? Buffer.alloc(0)]);
  const count = options.totalEntriesOverride ?? entries.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

const part = (name: string): Entry => ({ name, data: Buffer.from("<x/>") });

const CONTENT_TYPES = "[Content_Types].xml";
const WORD_PRIMARY = "word/document.xml";
const EXCEL_PRIMARY = "xl/workbook.xml";
const POWERPOINT_PRIMARY = "ppt/presentation.xml";

const indexOf = (buffer: Buffer) => readZipCentralDirectory({ buffer }, buffer.length);
const asDocument = (buffer: Buffer, declaredMimeType?: string, originalName?: string) =>
  validateUploadedMedia({ source: { buffer }, allow: ["document"], declaredMimeType, originalName });

/** The package built from these member names, as the upload boundary decides it end to end. */
async function classify(names: readonly string[], declaredMimeType?: string, originalName?: string) {
  const result = await asDocument(buildZip(names.map(part)), declaredMimeType, originalName);
  return result.kind === "accepted"
    ? { format: result.format, extension: result.extension, contentType: result.contentType }
    : { format: `rejected:${result.reason}`, extension: "", contentType: "" };
}

/** A central-directory index carrying just these names, for the rule on its own. */
const index = (...names: string[]) => names.map((name, position) => ({
  name, flags: 0, method: 0, crc32: 0, compressedSize: 0, uncompressedSize: 0,
  localHeaderOffset: position + 1, diskNumberStart: 0, zip64: false,
}));

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/* ------------------------------------------------------------------ canonical packages still classify */

test("a canonical DOCX and a canonical XLSX classify, with their canonical type and extension", async () => {
  assert.deepEqual(await classify([CONTENT_TYPES, "_rels/.rels", WORD_PRIMARY]), { format: "docx", extension: "docx", contentType: DOCX_TYPE });
  assert.deepEqual(await classify([CONTENT_TYPES, "_rels/.rels", EXCEL_PRIMARY]), { format: "xlsx", extension: "xlsx", contentType: XLSX_TYPE });
  // With the other members a real package carries, which change nothing.
  assert.equal((await classify([CONTENT_TYPES, "_rels/.rels", WORD_PRIMARY, "word/media/image1.png", "word/settings.xml", "docProps/core.xml"])).format, "docx");
  assert.equal((await classify([CONTENT_TYPES, "_rels/.rels", EXCEL_PRIMARY, "xl/worksheets/sheet1.xml", "xl/styles.xml"])).format, "xlsx");
});

/* ------------------------------------------------------------------ the finding: every casing mutation */

test("a mis-cased content-types stream does not identify an OOXML package", async () => {
  // OBSERVED ON 4683cd9: `docx`, with a `.docx` key and the Word content type.
  for (const mutation of ["[content_types].xml", "[CONTENT_TYPES].XML", "[Content_types].xml", "[content_Types].XML", "[CONTENT_types].xml"]) {
    assert.equal((await classify([mutation, WORD_PRIMARY])).format, "zip", `${mutation} + ${WORD_PRIMARY}`);
    assert.equal((await classify([mutation, EXCEL_PRIMARY])).format, "zip", `${mutation} + ${EXCEL_PRIMARY}`);
  }
});

test("a mis-cased Word primary part does not identify a DOCX", async () => {
  // OBSERVED ON 4683cd9: every one of these was `docx`.
  for (const mutation of ["WORD/document.xml", "Word/document.xml", "word/DOCUMENT.XML", "word/Document.xml", "WORD/DOCUMENT.XML", "wOrD/dOcUmEnT.xMl"]) {
    const result = await classify([CONTENT_TYPES, mutation]);
    assert.equal(result.format, "zip", mutation);
    assert.equal(result.extension, "zip", `${mutation}: never stored under a .docx key`);
    assert.equal(result.contentType, "application/zip", `${mutation}: never given the Word content type`);
  }
});

test("a mis-cased Excel primary part does not identify an XLSX", async () => {
  for (const mutation of ["XL/workbook.xml", "Xl/workbook.xml", "xl/WORKBOOK.XML", "xl/Workbook.xml", "XL/WORKBOOK.XML"]) {
    const result = await classify([CONTENT_TYPES, mutation]);
    assert.equal(result.format, "zip", mutation);
    assert.equal(result.extension, "zip", `${mutation}: never stored under a .xlsx key`);
    assert.equal(result.contentType, "application/zip", `${mutation}: never given the Excel content type`);
  }
});

test("both markers must be exactly right -- getting one right does not carry the other", async () => {
  // The half-fixed shape this finding warns about: exact on one marker, folded on the other.
  assert.equal((await classify([CONTENT_TYPES, "WORD/document.xml"])).format, "zip", "content types exact, part mutated");
  assert.equal((await classify(["[content_types].xml", WORD_PRIMARY])).format, "zip", "part exact, content types mutated");
  assert.equal((await classify(["[content_types].xml", "WORD/document.xml"])).format, "zip", "both mutated");
  assert.equal((await classify([CONTENT_TYPES, WORD_PRIMARY])).format, "docx", "both exact");

  assert.equal((await classify([CONTENT_TYPES, "XL/workbook.xml"])).format, "zip", "content types exact, part mutated");
  assert.equal((await classify(["[CONTENT_TYPES].XML", EXCEL_PRIMARY])).format, "zip", "part exact, content types mutated");
  assert.equal((await classify([CONTENT_TYPES, EXCEL_PRIMARY])).format, "xlsx", "both exact");
});

test("the rule holds on the classifier itself, not only end to end", () => {
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, WORD_PRIMARY)), "docx");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, EXCEL_PRIMARY)), "xlsx");
  for (const names of [
    ["[content_types].xml", WORD_PRIMARY],
    [CONTENT_TYPES, "WORD/document.xml"],
    [CONTENT_TYPES, "word/DOCUMENT.XML"],
    ["[CONTENT_TYPES].XML", "WORD/DOCUMENT.XML"],
    ["[content_types].xml", "XL/WORKBOOK.XML"],
    [CONTENT_TYPES, "xl/Workbook.xml"],
  ] as const) {
    assert.equal(classifyZipPackage(Buffer.alloc(128), index(...names)), "zip", names.join(" + "));
  }
  // A mutated lookalike sitting alongside the real part changes nothing: the real part is present.
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, "WORD/document.xml", WORD_PRIMARY)), "docx");
});

test("the request cannot supply the casing the archive lacks", async () => {
  // The declared type and filename are recorded and never believed, here as everywhere else.
  for (const [declared, name] of [[DOCX_TYPE, "report.docx"], [XLSX_TYPE, "book.xlsx"], ["application/zip", "thing.zip"]] as const) {
    const result = await classify(["[content_types].xml", "WORD/document.xml"], declared, name);
    assert.equal(result.format, "zip", `${declared}/${name}`);
    assert.equal(result.extension, "zip", `${declared}/${name}`);
  }
});

/* ------------------------------------------------------------------ PPTX: not a format this pipeline stores */

test("a presentation is a generic archive, canonical casing or not", async () => {
  // Stated rather than assumed: there is no `pptx` entry in `MEDIA_TYPES`, so there is no PPTX marker here to
  // compare case-sensitively. A presentation is inert, correctly typed and served as an attachment.
  for (const names of [
    [CONTENT_TYPES, POWERPOINT_PRIMARY],
    [CONTENT_TYPES, POWERPOINT_PRIMARY, "ppt/slides/slide1.xml", "_rels/.rels"],
    [CONTENT_TYPES, "PPT/PRESENTATION.XML"],
    ["[content_types].xml", POWERPOINT_PRIMARY],
  ] as const) {
    const result = await classify(names);
    assert.equal(result.format, "zip", names.join(" + "));
    assert.equal(result.extension, "zip");
    assert.equal(result.contentType, "application/zip");
  }
  // And it is not mistaken for a Word or Excel package either.
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, POWERPOINT_PRIMARY)), "zip");
});

/* ------------------------------------------------------------------ the central directory accounts for itself */

test("a record count that under-reports the directory is not an index", async () => {
  // OBSERVED ON 4683cd9: this read as a ONE-member index -- `[Content_Types].xml` alone -- and the rest of the
  // archive's members were invisible to the validator while a real reader sees them all.
  const underReported = buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY)], { totalEntriesOverride: 1 });
  assert.equal(await indexOf(underReported), null, "the archive is not indexed at all");
  assert.equal((await asDocument(underReported)).kind === "accepted" && ((await asDocument(underReported)) as { format: string }).format, "zip");

  // Any shortfall, at any count.
  for (const [entries, claimed] of [[3, 1], [3, 2], [5, 4], [5, 1], [2, 1]] as const) {
    const names = Array.from({ length: entries }, (_, position) => part(`member${position}.xml`));
    assert.equal(await indexOf(buildZip(names, { totalEntriesOverride: claimed })), null, `${entries} records claiming ${claimed}`);
  }

  // The honest count reads every one of them, so the rule is about agreement and not about rejecting archives.
  const honest = buildZip([part(CONTENT_TYPES), part("_rels/.rels"), part(WORD_PRIMARY)]);
  assert.deepEqual((await indexOf(honest))!.map((entry) => entry.name), [CONTENT_TYPES, "_rels/.rels", WORD_PRIMARY]);
  assert.equal((await asDocument(honest)).kind === "accepted" && ((await asDocument(honest)) as { format: string }).format, "docx");
});

test("parsing must land exactly on the end of the declared directory", async () => {
  // Over-reporting already failed, because the loop runs out of directory. Under-reporting is what needed the
  // new check. Padding after the last record fails for the same reason: the bytes and the count disagree.
  const overReported = buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY)], { totalEntriesOverride: 3 });
  assert.equal(await indexOf(overReported), null, "more entries claimed than are there");

  for (const [label, padding] of [
    ["one trailing byte", Buffer.alloc(1, 0)],
    ["a half record", Buffer.alloc(20, 0x41)],
    ["a whole record's worth of filler", Buffer.alloc(46, 0x41)],
  ] as const) {
    const padded = buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY)], { directoryPadding: padding });
    assert.equal(await indexOf(padded), null, label);
  }

  // A directory with no padding and an honest count is consumed exactly, and reads.
  assert.equal((await indexOf(buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY)])))!.length, 2);
});

test("an under-reported count cannot hide a member from the validator", async () => {
  // The security shape of it: an archive whose visible prefix says one thing and whose full directory says
  // another must not be indexed from the prefix. Here the hidden member is the one that decides the format.
  const hidden = buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY), part(EXCEL_PRIMARY)], { totalEntriesOverride: 2 });
  assert.equal(await indexOf(hidden), null);
  const result = await asDocument(hidden, DOCX_TYPE, "report.docx");
  assert.equal(result.kind === "accepted" && result.format, "zip");
  assert.equal(result.kind === "accepted" && result.extension, "zip");
});

/* ------------------------------------------------------------------ nothing else moved */

test("EPUB is untouched: the name is exact, and a case-variant duplicate is still refused", async () => {
  // OCF fixes the name as lower-case `mimetype`, so identity is exact -- `MIMETYPE` first is not an EPUB. But
  // two members differing only in case are one file to a case-insensitive extractor and two to a case-sensitive
  // one, so the DUPLICATE defence folds case deliberately and refuses more. Different questions, different
  // answers, both failing closed to an inert generic `zip`.
  const media = Buffer.from("application/epub+zip", "latin1");
  const book = (names: readonly string[]) => buildZip(names.map((name) => ({ name, data: name.toLowerCase() === "mimetype" ? media : Buffer.from("<x/>") })));

  const real = book(["mimetype", "META-INF/container.xml", "OEBPS/content.opf"]);
  assert.equal((await asDocument(real)).kind === "accepted" && ((await asDocument(real)) as { format: string }).format, "epub", "a real book still reads");

  for (const [label, names] of [
    ["first member is MIMETYPE", ["MIMETYPE", "META-INF/container.xml"]],
    ["first member is MimeType", ["MimeType", "META-INF/container.xml"]],
    ["a second member differing only in case", ["mimetype", "MIMETYPE", "META-INF/container.xml"]],
    ["a second member named mimetype exactly", ["mimetype", "mimetype", "META-INF/container.xml"]],
  ] as const) {
    const forged = book(names);
    const result = await asDocument(forged, "application/epub+zip", "novel.epub");
    assert.equal(result.kind === "accepted" && result.format, "zip", label);
    assert.equal(result.kind === "accepted" && result.extension, "zip", label);
  }
});

test("the EOCD-decoy defence still holds alongside these rules", async () => {
  // Preserved from R8/R9: a comment carrying an EOCD-shaped decoy that reaches EOF must not shadow the real
  // record. Asserted here too so a future change to classification cannot quietly undo it.
  const commentLength = 64;
  const comment = Buffer.alloc(commentLength, 0x41);
  const withComment = (() => {
    const base = buildZip([part(CONTENT_TYPES), part("_rels/.rels"), part(WORD_PRIMARY)]);
    const eocd = Buffer.from(base.subarray(base.length - 22));
    eocd.writeUInt16LE(commentLength, 20);
    return Buffer.concat([base.subarray(0, base.length - 22), eocd, comment]);
  })();
  assert.equal((await asDocument(withComment)).kind === "accepted" && ((await asDocument(withComment)) as { format: string }).format, "docx", "an ordinary comment");

  const decoyed = Buffer.from(withComment);
  const position = decoyed.length - commentLength + 8;
  decoyed.writeUInt32LE(0x06054b50, position);
  decoyed.writeUInt16LE(9, position + 4);       // an invalid disk number
  decoyed.writeUInt16LE(1, position + 8);
  decoyed.writeUInt16LE(1, position + 10);
  decoyed.writeUInt32LE(46, position + 12);
  decoyed.writeUInt32LE(0, position + 16);
  decoyed.writeUInt16LE(decoyed.length - position - 22, position + 20); // reaches EOF
  assert.deepEqual((await indexOf(decoyed))!.map((entry) => entry.name), [CONTENT_TYPES, "_rels/.rels", WORD_PRIMARY]);
  assert.equal((await asDocument(decoyed)).kind === "accepted" && ((await asDocument(decoyed)) as { format: string }).format, "docx");
});
