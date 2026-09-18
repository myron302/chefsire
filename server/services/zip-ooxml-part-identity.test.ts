/**
 * OPC part identity is ASCII case-insensitive, and two members that collide under it are nonconforming.
 *
 * THE SPECIFICATION, CHECKED RATHER THAN TAKEN ON TRUST. ECMA-376 5th Edition Part 2 (Open Packaging
 * Conventions) 7.2.3.5 says of part-name comparison: "The comparison shall be ASCII case-insensitive matching."
 * Microsoft aligned `System.IO.Packaging` with exactly that in .NET 8 (dotnet/runtime#112783), having compared
 * case-sensitively before -- the same mistake this classifier made in R10, when an earlier review talked it into
 * exact matching. `[content_types].xml` and `[Content_Types].xml` name ONE part, and a reader opening the
 * package sees one part, so refusing the first spelling refuses conforming packages.
 *
 * WHAT THIS FILE REPLACES. `zip-ooxml-case-sensitivity.test.ts` encoded the opposite rule: it asserted that
 * every casing variant of a marker had to fall back to generic `zip`. That was wrong about the format, so the
 * assertions are inverted here rather than preserved.
 *
 * WHAT DID NOT CHANGE, AND MUST NOT. The primary part is still required by name: an archive holding
 * `[Content_Types].xml` and nothing but `word/media/image1.png` is still a generic archive, because a directory
 * is not a part. That was the R8 correction and it is independent of casing.
 *
 * THE FOLD IS DELIBERATELY NARROW. It is written out as an ASCII-only map rather than `toLowerCase()`, because
 * the specification says ASCII and `toLowerCase()` is Unicode-aware: it folds the Kelvin sign U+212A onto `k`,
 * so `WORD/DOCUMENT.XML` spelled with a Kelvin sign would become the Word primary part under Unicode folding
 * and is not one. Narrow folding is both spec-exact and the harder thing to spoof, and only A-Z move, so it is
 * locale-independent by construction.
 *
 * AND FOLDING MUST NOT COLLAPSE MEMBERS SILENTLY. A package holding both `word/document.xml` and
 * `WORD/DOCUMENT.XML` declares one part twice: nonconforming under OPC, and an ambiguity that leaves two
 * readers free to open different bytes under one name. Collisions are detected before any lookup and fail
 * closed to an inert generic `zip`.
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

/* ------------------------------------------------------------------ canonical packages */

test("a canonical DOCX and a canonical XLSX classify, with their canonical type and extension", async () => {
  assert.deepEqual(await classify([CONTENT_TYPES, "_rels/.rels", WORD_PRIMARY]), { format: "docx", extension: "docx", contentType: DOCX_TYPE });
  assert.deepEqual(await classify([CONTENT_TYPES, "_rels/.rels", EXCEL_PRIMARY]), { format: "xlsx", extension: "xlsx", contentType: XLSX_TYPE });
  // With the other members a real package carries, which change nothing.
  assert.equal((await classify([CONTENT_TYPES, "_rels/.rels", WORD_PRIMARY, "word/media/image1.png", "word/settings.xml", "docProps/core.xml"])).format, "docx");
  assert.equal((await classify([CONTENT_TYPES, "_rels/.rels", EXCEL_PRIMARY, "xl/worksheets/sheet1.xml", "xl/styles.xml"])).format, "xlsx");
});

/* ------------------------------------------------------------------ case variants name the same part */

test("a case-variant content-types stream names the same part", async () => {
  for (const variant of ["[content_types].xml", "[CONTENT_TYPES].XML", "[Content_types].xml", "[content_Types].XML", "[CONTENT_types].xml"]) {
    assert.equal((await classify([variant, WORD_PRIMARY])).format, "docx", `${variant} + ${WORD_PRIMARY}`);
    assert.equal((await classify([variant, EXCEL_PRIMARY])).format, "xlsx", `${variant} + ${EXCEL_PRIMARY}`);
  }
});

test("a case-variant Word primary part names the same part", async () => {
  for (const variant of ["WORD/document.xml", "Word/document.xml", "word/DOCUMENT.XML", "word/Document.xml", "WORD/DOCUMENT.XML", "wOrD/dOcUmEnT.xMl"]) {
    const result = await classify([CONTENT_TYPES, variant]);
    assert.equal(result.format, "docx", variant);
    assert.equal(result.extension, "docx", variant);
    assert.equal(result.contentType, DOCX_TYPE, variant);
  }
});

test("a case-variant Excel primary part names the same part", async () => {
  for (const variant of ["XL/workbook.xml", "Xl/workbook.xml", "xl/WORKBOOK.XML", "xl/Workbook.xml", "XL/WORKBOOK.XML"]) {
    const result = await classify([CONTENT_TYPES, variant]);
    assert.equal(result.format, "xlsx", variant);
    assert.equal(result.extension, "xlsx", variant);
    assert.equal(result.contentType, XLSX_TYPE, variant);
  }
});

test("both markers may vary independently, in any combination", async () => {
  assert.equal((await classify(["[content_types].xml", "WORD/DOCUMENT.XML"])).format, "docx", "both varied");
  assert.equal((await classify([CONTENT_TYPES, "WORD/document.xml"])).format, "docx", "part varied");
  assert.equal((await classify(["[CONTENT_TYPES].XML", WORD_PRIMARY])).format, "docx", "content types varied");
  assert.equal((await classify(["[CONTENT_TYPES].XML", "XL/WORKBOOK.XML"])).format, "xlsx", "both varied, workbook");
});

test("the rule holds on the classifier itself, not only end to end", () => {
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, WORD_PRIMARY)), "docx");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index("[content_types].xml", "WORD/DOCUMENT.XML")), "docx");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index("[CONTENT_TYPES].XML", "XL/WORKBOOK.XML")), "xlsx");
  // Word still wins over Excel: a document embedding a spreadsheet is still a document.
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, "WORD/DOCUMENT.XML", "xl/workbook.xml")), "docx");
});

test("only ASCII letters fold, so a Unicode lookalike is not the part", async () => {
  // `toLowerCase()` maps the Kelvin sign U+212A onto `k`; the specification says ASCII, and so does this.
  // A member spelled with one is a different part and cannot stand in for the primary part.
  const kelvin = "K"; // KELVIN SIGN
  assert.equal("WORK/DOCUMENT.XML".toLowerCase(), "work/document.xml", "Unicode folding really would do this");
  assert.equal((await classify([CONTENT_TYPES, `WOR${kelvin}/DOCUMENT.XML`])).format, "zip", "but it is not word/document.xml");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, `WOR${kelvin}/DOCUMENT.XML`)), "zip");
});

/* ------------------------------------------------------------------ colliding parts are nonconforming */

test("two members that fold to the same Word part are ambiguous and fail closed", async () => {
  for (const [label, names] of [
    ["exact and upper", [CONTENT_TYPES, WORD_PRIMARY, "WORD/DOCUMENT.XML"]],
    ["two variants, neither canonical", [CONTENT_TYPES, "Word/Document.xml", "WORD/document.XML"]],
    ["three spellings", [CONTENT_TYPES, WORD_PRIMARY, "WORD/document.xml", "word/DOCUMENT.xml"]],
    ["byte-identical duplicates", [CONTENT_TYPES, WORD_PRIMARY, WORD_PRIMARY]],
  ] as const) {
    const result = await classify(names);
    assert.equal(result.format, "zip", `${label}: ${result.format}`);
    assert.equal(result.extension, "zip", label);
    assert.equal(result.contentType, "application/zip", label);
  }
});

test("two members that fold to the same content-types stream are ambiguous and fail closed", async () => {
  assert.equal((await classify([CONTENT_TYPES, "[content_types].xml", WORD_PRIMARY])).format, "zip");
  assert.equal((await classify(["[CONTENT_TYPES].XML", "[content_types].xml", EXCEL_PRIMARY])).format, "zip");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, "[content_types].xml", WORD_PRIMARY)), "zip");
});

test("two members that fold to the same Excel part are ambiguous and fail closed", async () => {
  assert.equal((await classify([CONTENT_TYPES, EXCEL_PRIMARY, "XL/WORKBOOK.XML"])).format, "zip");
  assert.equal((await classify([CONTENT_TYPES, "Xl/Workbook.xml", "xL/wORKBOOK.xml"])).format, "zip");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, EXCEL_PRIMARY, "XL/WORKBOOK.XML")), "zip");
});

test("a collision anywhere in the package is enough, even away from the markers", async () => {
  // A package that declares any part twice is nonconforming; the ambiguity does not have to be on the part that
  // decides the format to make the package one this pipeline should not label.
  assert.equal((await classify([CONTENT_TYPES, WORD_PRIMARY, "word/media/i.png", "word/media/I.PNG"])).format, "zip");
  assert.equal((await classify([CONTENT_TYPES, EXCEL_PRIMARY, "docProps/app.xml", "docprops/APP.xml"])).format, "zip");
  // And a generic archive with a collision was already generic; nothing changes for it.
  assert.equal((await classify(["notes.txt", "NOTES.TXT"])).format, "zip");
});

/* ------------------------------------------------------------------ the R8 rule is untouched by any of this */

test("a package with an OOXML directory but no primary part is still an archive", async () => {
  for (const [label, member] of [
    ["word/media only", "word/media/image1.png"],
    ["WORD/MEDIA only", "WORD/MEDIA/IMAGE1.PNG"],
    ["word settings only", "word/settings.xml"],
    ["xl/media only", "xl/media/image1.png"],
    ["XL/MEDIA only", "XL/MEDIA/IMAGE1.PNG"],
    ["a worksheet without a workbook", "xl/worksheets/sheet1.xml"],
  ] as const) {
    assert.equal((await classify([CONTENT_TYPES, member])).format, "zip", label);
    assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, member)), "zip", label);
  }
});

test("a part must be at the package root, and a near-miss name is a different part", () => {
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, "nested/word/document.xml")), "zip");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, "word/document.xml.bak")), "zip");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, "word/documents.xml")), "zip");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, "xl/workbooks.xml")), "zip");
  // And the content-types stream is still required.
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(WORD_PRIMARY)), "zip");
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(EXCEL_PRIMARY)), "zip");
});

test("the request still cannot supply a part the archive does not have", async () => {
  for (const [declared, name] of [[DOCX_TYPE, "report.docx"], [XLSX_TYPE, "book.xlsx"]] as const) {
    const result = await classify([CONTENT_TYPES, "word/media/image1.png"], declared, name);
    assert.equal(result.format, "zip", `${declared}/${name}`);
    assert.equal(result.extension, "zip", `${declared}/${name}`);
  }
});

/* ------------------------------------------------------------------ PPTX: still not a format this pipeline stores */

test("a presentation is a generic archive, in any casing", async () => {
  // Unchanged and re-verified this round: there is no `pptx` entry in `MEDIA_TYPES`, so there is no PowerPoint
  // part to identify at all. A presentation stays inert, correctly typed and served as an attachment.
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
  assert.equal(classifyZipPackage(Buffer.alloc(128), index(CONTENT_TYPES, POWERPOINT_PRIMARY)), "zip");
});

/* ------------------------------------------------------------------ the central directory accounts for itself */

test("a record count that under-reports the directory is not an index", async () => {
  // Preserved from R10. OBSERVED ON 4683cd9: this read as a ONE-member index and the rest of the archive's
  // members were invisible to the validator while a real reader sees them all.
  const underReported = buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY)], { totalEntriesOverride: 1 });
  assert.equal(await indexOf(underReported), null, "the archive is not indexed at all");
  assert.equal((await asDocument(underReported)).kind === "accepted" && ((await asDocument(underReported)) as { format: string }).format, "zip");

  for (const [entries, claimed] of [[3, 1], [3, 2], [5, 4], [5, 1], [2, 1]] as const) {
    const names = Array.from({ length: entries }, (_, position) => part(`member${position}.xml`));
    assert.equal(await indexOf(buildZip(names, { totalEntriesOverride: claimed })), null, `${entries} records claiming ${claimed}`);
  }

  const honest = buildZip([part(CONTENT_TYPES), part("_rels/.rels"), part(WORD_PRIMARY)]);
  assert.deepEqual((await indexOf(honest))!.map((entry) => entry.name), [CONTENT_TYPES, "_rels/.rels", WORD_PRIMARY]);
  assert.equal((await asDocument(honest)).kind === "accepted" && ((await asDocument(honest)) as { format: string }).format, "docx");
});

test("parsing must land exactly on the end of the declared directory", async () => {
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

  assert.equal((await indexOf(buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY)])))!.length, 2);
});

test("an under-reported count cannot hide a member from the validator", async () => {
  const hidden = buildZip([part(CONTENT_TYPES), part(WORD_PRIMARY), part(EXCEL_PRIMARY)], { totalEntriesOverride: 2 });
  assert.equal(await indexOf(hidden), null);
  const result = await asDocument(hidden, DOCX_TYPE, "report.docx");
  assert.equal(result.kind === "accepted" && result.format, "zip");
  assert.equal(result.kind === "accepted" && result.extension, "zip");
});

/* ------------------------------------------------------------------ nothing else moved */

test("EPUB is untouched: the name is exact, and a case-variant duplicate is still refused", async () => {
  // OCF fixes the name as lower-case `mimetype`, so identity is exact -- `MIMETYPE` first is not an EPUB. The
  // DUPLICATE defence folds case deliberately, because two members differing only in case are one file to a
  // case-insensitive extractor and two to a case-sensitive one. Different questions, different answers, both
  // failing closed to an inert generic `zip`. None of this moved when OOXML identity changed.
  const media = Buffer.from("application/epub+zip", "latin1");
  // A real OCF container descriptor, because an EPUB needs one that names a Package Document that exists.
  const descriptor = Buffer.from('<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const book = (names: readonly string[]) => buildZip(names.map((name) => ({
    name,
    data: name.toLowerCase() === "mimetype" ? media : name === "META-INF/container.xml" ? descriptor : Buffer.from("<x/>"),
  })));

  const real = book(["mimetype", "META-INF/container.xml", "OEBPS/content.opf"]);
  assert.equal((await asDocument(real)).kind === "accepted" && ((await asDocument(real)) as { format: string }).format, "epub", "a real book still reads");

  for (const [label, names] of [
    ["first member is MIMETYPE", ["MIMETYPE", "META-INF/container.xml"]],
    ["first member is MimeType", ["MimeType", "META-INF/container.xml"]],
    ["a second member differing only in case", ["mimetype", "MIMETYPE", "META-INF/container.xml"]],
    ["a second member named mimetype exactly", ["mimetype", "mimetype", "META-INF/container.xml"]],
  ] as const) {
    const result = await asDocument(book(names), "application/epub+zip", "novel.epub");
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
