/**
 * EPUB is decided by the archive's own index, not by the first local file header alone.
 *
 * THE FINDING. `looksLikeEpubContainer` validated the local file header at offset 0 against the OCF rules --
 * signature, stored, named `mimetype`, exactly `application/epub+zip` -- and returned EPUB on that alone. A ZIP
 * carries TWO descriptions of every member: that header, and the central directory record every real reader
 * actually uses. Nothing required them to agree, so a file could present a conforming header to this validator
 * and an entirely different archive to the reader that opened it.
 *
 * WHAT REPRODUCED ON HEAD f3f29e2. Every one of these was classified `epub`, accepted, and would have been
 * stored as `.epub` with `Content-Type: application/epub+zip`:
 *
 *   central directory omits the mimetype entry (index named one member, `evil.txt`)   -> epub
 *   central directory lists it under a different name (`not-a-mimetype`)              -> epub
 *   central directory points that member's local header at offset 9999                -> epub
 *   central directory says deflated, sizes 5 and 999                                  -> epub
 *   no central directory at all (truncated after the payload)                         -> epub
 *   a genuine DOCX with a forged `mimetype` local header bolted on the front          -> epub
 *
 * The last one is the sharpest: a file that Word opens as a document, stored by ChefSire as a book.
 *
 * WHAT THE FIX REQUIRES. The local header is now necessary and not sufficient. The index must describe the same
 * entry the same way: present, at local-header offset 0 (which is what OCF's "first entry in the archive" rule
 * actually means), named `mimetype`, stored, same CRC-32, same sizes, no flag the local header did not also set,
 * on disk 0, with no Zip64 sentinel and no second claimant. Everything fails closed to generic `zip`, which is
 * inert, correctly typed and served as an attachment.
 *
 * Every fixture is a real ZIP written byte by byte, with a correct CRC-32 per member. Nothing is decompressed.
 *
 * VERIFIED AGAINST REAL TOOLING. The cross-checks below are only safe if conforming writers actually satisfy
 * them, so a book was packaged the canonical way with Info-ZIP -- `zip -X0 book.epub mimetype` followed by
 * `zip -Xr book.epub META-INF OEBPS` -- and run through the validator: its index puts `mimetype` at offset 0,
 * stored, with the correct CRC-32 and both sizes and no flags set, and it is accepted as `epub`.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import {
  ZIP_MAX_ENTRIES,
  classifyZipPackage,
  looksLikeEpubContainer,
  readZipCentralDirectory,
  validateUploadedMedia,
} from "./media-validation";

/* ------------------------------------------------------------------ a ZIP writer whose two indexes can disagree */

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
 * One member. The `central*` fields are what the CENTRAL DIRECTORY will say about it; leaving one out makes the
 * directory agree with the local header, which is what a conforming writer produces. Setting one is how a
 * disagreement between the two indexes is expressed, which is the whole subject of this file.
 */
type Entry = {
  name: string;
  data: Buffer;
  method?: number;
  flags?: number;
  omitFromCentral?: boolean;
  centralName?: string;
  centralOffset?: number;
  centralMethod?: number;
  centralFlags?: number;
  centralCrc?: number;
  centralCompressedSize?: number;
  centralUncompressedSize?: number;
  centralDisk?: number;
};

type ZipOptions = { entriesOnDiskOverride?: number; thisDiskOverride?: number; directoryDiskOverride?: number };

function buildZip(entries: Entry[], options: ZipOptions = {}): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "latin1");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.flags ?? 0, 6);
    local.writeUInt16LE(entry.method ?? 0, 8);
    local.writeUInt32LE(crc32(entry.data), 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const block = Buffer.concat([local, name, entry.data]);
    locals.push(block);

    if (!entry.omitFromCentral) {
      const centralName = Buffer.from(entry.centralName ?? entry.name, "latin1");
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(20, 6);
      header.writeUInt16LE(entry.centralFlags ?? entry.flags ?? 0, 8);
      header.writeUInt16LE(entry.centralMethod ?? entry.method ?? 0, 10);
      header.writeUInt32LE(entry.centralCrc ?? crc32(entry.data), 16);
      header.writeUInt32LE(entry.centralCompressedSize ?? entry.data.length, 20);
      header.writeUInt32LE(entry.centralUncompressedSize ?? entry.data.length, 24);
      header.writeUInt16LE(centralName.length, 28);
      header.writeUInt16LE(entry.centralDisk ?? 0, 34);
      header.writeUInt32LE(entry.centralOffset ?? offset, 42);
      central.push(Buffer.concat([header, centralName]));
    }
    offset += block.length;
  }
  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(options.thisDiskOverride ?? 0, 4);
  eocd.writeUInt16LE(options.directoryDiskOverride ?? 0, 6);
  eocd.writeUInt16LE(options.entriesOnDiskOverride ?? central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

const MEDIA_TYPE = "application/epub+zip";
const mimetype = (over: Partial<Entry> = {}): Entry => ({ name: "mimetype", data: Buffer.from(MEDIA_TYPE, "latin1"), ...over });
/** A real OCF container descriptor: EPUB needs one, and it must name a Package Document that exists. */
const EPUB_CONTAINER_XML = '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
const container = { name: "META-INF/container.xml", data: Buffer.from(EPUB_CONTAINER_XML) };
const content = { name: "OEBPS/content.opf", data: Buffer.from("<package/>") };

/** A conforming EPUB: `mimetype` first, stored, exact payload, and a central directory that says exactly that. */
const epub = () => buildZip([mimetype(), container, content]);

const indexOf = (buffer: Buffer) => readZipCentralDirectory({ buffer }, buffer.length);
const asDocument = (buffer: Buffer, declaredMimeType?: string, originalName?: string) =>
  validateUploadedMedia({ source: { buffer }, allow: ["document"], declaredMimeType, originalName });

/** What the validator decides, end to end, for an archive claiming to be a book in every way a request can. */
async function formatOf(buffer: Buffer): Promise<string> {
  const result = await asDocument(buffer, "application/epub+zip", "novel.epub");
  return result.kind === "accepted" ? result.format : `rejected:${result.reason}`;
}

/* ------------------------------------------------------------------ the finding, fixture by fixture */

test("a first local header the central directory does not list at all is not an EPUB", async () => {
  // OBSERVED ON f3f29e2: classified `epub`. The index names one member, and it is not the mimetype entry.
  const forged = buildZip([mimetype({ omitFromCentral: true }), { name: "evil.txt", data: Buffer.from("payload") }]);
  assert.deepEqual((await indexOf(forged))!.map((entry) => entry.name), ["evil.txt"], "the fixture's index really does omit it");
  assert.equal(looksLikeEpubContainer(forged, await indexOf(forged)), false);
  assert.equal(await formatOf(forged), "zip");
});

test("a first local header the central directory lists under another name is not an EPUB", async () => {
  // OBSERVED ON f3f29e2: classified `epub`. A reader following the index sees a member called something else.
  const forged = buildZip([mimetype({ centralName: "not-a-mimetype" }), { name: "b.txt", data: Buffer.from("x") }]);
  assert.equal(looksLikeEpubContainer(forged, await indexOf(forged)), false);
  assert.equal(await formatOf(forged), "zip");
});

test("a central directory pointing the entry somewhere other than offset 0 is not an EPUB", async () => {
  // OBSERVED ON f3f29e2: classified `epub`. OCF's rule is that `mimetype` is FIRST; an index saying it is not
  // first -- wherever it says it is instead -- contradicts the only thing that makes the entry meaningful.
  for (const [label, offset] of [["past the end of the file", 9999], ["at some later member", 120], ["one byte in", 1]] as const) {
    const forged = buildZip([mimetype({ centralOffset: offset }), { name: "b.txt", data: Buffer.from("x") }]);
    assert.equal(looksLikeEpubContainer(forged, await indexOf(forged)), false, label);
    assert.equal(await formatOf(forged), "zip", label);
  }
});

test("a central directory contradicting the compression method is not an EPUB", async () => {
  // OBSERVED ON f3f29e2: classified `epub`. A reader would inflate what the local header says is stored.
  const forged = buildZip([mimetype({ centralMethod: 8 }), container]);
  assert.equal(looksLikeEpubContainer(forged, await indexOf(forged)), false);
  assert.equal(await formatOf(forged), "zip");
});

test("a central directory contradicting either declared size is not an EPUB", async () => {
  for (const [label, over] of [
    ["compressed size", { centralCompressedSize: 5 }],
    ["uncompressed size", { centralUncompressedSize: 999 }],
    ["both, as reproduced", { centralCompressedSize: 5, centralUncompressedSize: 999 }],
  ] as const) {
    const forged = buildZip([mimetype(over), container]);
    assert.equal(looksLikeEpubContainer(forged, await indexOf(forged)), false, label);
    assert.equal(await formatOf(forged), "zip", label);
  }
});

test("a central directory contradicting the CRC-32 is not an EPUB", async () => {
  // The payload of an OCF `mimetype` entry is fixed by the specification, so its checksum is a constant. An
  // index declaring a different one is describing different bytes than the ones at offset 0.
  const forged = buildZip([mimetype({ centralCrc: 0xdeadbeef }), container]);
  assert.equal(looksLikeEpubContainer(forged, await indexOf(forged)), false);
  assert.equal(await formatOf(forged), "zip");
  // And a local header carrying the wrong CRC is refused on its own, before the index is consulted at all.
  const badLocalCrc = Buffer.from(epub());
  badLocalCrc.writeUInt32LE(0xdeadbeef, 14);
  assert.equal(looksLikeEpubContainer(badLocalCrc, await indexOf(badLocalCrc)), false, "local CRC");
});

test("data-descriptor and encryption flags are refused on either side, and must agree across both", async () => {
  // Bit 3 defers the sizes to a data descriptor, so an entry claiming it is not one whose declared sizes mean
  // anything. Bits 0, 6 and 13 concern encryption. None of them belongs on a stored, plaintext, fixed-length
  // entry -- and a bit set on only one side is the two indexes describing different ways to read one member.
  for (const [label, flags] of [["data descriptor", 0x0008], ["encrypted", 0x0001], ["strong encryption", 0x0040], ["masked local values", 0x2000]] as const) {
    const centralOnly = buildZip([mimetype({ centralFlags: flags }), container]);
    assert.equal(looksLikeEpubContainer(centralOnly, await indexOf(centralOnly)), false, `${label}: central only`);
    assert.equal(await formatOf(centralOnly), "zip", `${label}: central only`);

    const both = buildZip([mimetype({ flags }), container]);
    assert.equal(looksLikeEpubContainer(both, await indexOf(both)), false, `${label}: both`);
    assert.equal(await formatOf(both), "zip", `${label}: both`);
  }
});

test("the UTF-8 name bit is tolerated on both sides, because it says nothing about how bytes are read", async () => {
  // Some writers set bit 11 for every member. `mimetype` is pure ASCII, so it is the same string either way;
  // refusing it would reject conforming books for no security gain. It is the ONLY bit tolerated.
  const utf8 = buildZip([mimetype({ flags: 0x0800 }), container, content]);
  assert.equal(looksLikeEpubContainer(utf8, await indexOf(utf8)), true);
  assert.equal(await formatOf(utf8), "epub");
});

test("an archive with no readable central directory is not an EPUB", async () => {
  // OBSERVED ON f3f29e2: classified `epub`. There is no index, so nothing corroborates the header -- and an
  // uncorroborated header is exactly what the finding is about.
  const whole = epub();
  for (const [label, buffer] of [
    ["truncated right after the first payload", whole.subarray(0, 30 + 8 + MEDIA_TYPE.length)],
    ["no end-of-central-directory record", whole.subarray(0, whole.length - 22)],
    ["central directory cut in half", whole.subarray(0, whole.length - 60)],
  ] as const) {
    assert.equal(await indexOf(buffer), null, `${label}: the fixture really has no readable index`);
    assert.equal(looksLikeEpubContainer(buffer, await indexOf(buffer)), false, label);
    const result = await asDocument(buffer, "application/epub+zip", "novel.epub");
    if (result.kind === "accepted") assert.equal(result.format, "zip", label);
  }
});

test("a genuine Office document with a forged EPUB header on the front stays an Office document", async () => {
  // OBSERVED ON f3f29e2: classified `epub`. This is the sharpest form of the finding -- every real reader opens
  // this by its central directory and sees a Word document; only this validator saw a book.
  const forged = buildZip([
    mimetype({ omitFromCentral: true }),
    { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
    { name: "_rels/.rels", data: Buffer.from("<Relationships/>") },
    { name: "word/document.xml", data: Buffer.from("<document/>") },
  ]);
  assert.equal(looksLikeEpubContainer(forged, await indexOf(forged)), false);
  const result = await asDocument(forged, "application/epub+zip", "novel.epub");
  assert.equal(result.kind, "accepted");
  assert.equal(result.kind === "accepted" && result.format, "docx", "classified as what its index says it is");
  assert.equal(result.kind === "accepted" && result.extension, "docx");
  assert.equal(result.kind === "accepted" && result.contentType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
});

test("two entries claiming offset 0 is a contradiction, not a choice", async () => {
  const ambiguous = buildZip([mimetype(), { name: "shadow.txt", data: Buffer.from("x"), centralOffset: 0 }]);
  assert.equal((await indexOf(ambiguous))!.filter((entry) => entry.localHeaderOffset === 0).length, 2, "the fixture is genuinely ambiguous");
  assert.equal(looksLikeEpubContainer(ambiguous, await indexOf(ambiguous)), false);
  assert.equal(await formatOf(ambiguous), "zip");
});

test("a second member also named mimetype is refused", async () => {
  // Two members of the same name is what lets two readers disagree about which one the book's type came from.
  const doubled = buildZip([mimetype(), { name: "mimetype", data: Buffer.from("application/zip") }, container]);
  assert.equal(looksLikeEpubContainer(doubled, await indexOf(doubled)), false);
  assert.equal(await formatOf(doubled), "zip");
});

test("Zip64 sentinels and multi-disk claims fail closed rather than being guessed at", async () => {
  // A 0xffffffff in a size or offset means the real value lives in a Zip64 extended-information extra field,
  // which this module deliberately does not parse. The entry records that, and the EPUB rule refuses it.
  const sentinel = buildZip([mimetype({ centralCompressedSize: 0xffffffff }), container]);
  assert.equal((await indexOf(sentinel))![0]!.zip64, true, "the sentinel is recorded on the entry");
  assert.equal(looksLikeEpubContainer(sentinel, await indexOf(sentinel)), false);
  assert.equal(await formatOf(sentinel), "zip");

  // A member on another disk is describing bytes that are not in this upload.
  const otherDisk = buildZip([mimetype({ centralDisk: 1 }), container]);
  assert.equal(looksLikeEpubContainer(otherDisk, await indexOf(otherDisk)), false, "entry disk");
  assert.equal(await formatOf(otherDisk), "zip", "entry disk");

  // And at the archive level: a split archive, or an entry count that disagrees with itself, is not indexed.
  for (const [label, options] of [
    ["this disk is not the first", { thisDiskOverride: 1 }],
    ["the directory lives on another disk", { directoryDiskOverride: 2 }],
    ["entries on this disk disagree with the total", { entriesOnDiskOverride: 1 }],
  ] as const) {
    const split = buildZip([mimetype(), container, content], options);
    assert.equal(await indexOf(split), null, label);
    assert.equal(await formatOf(split), "zip", label);
  }
});

/* ------------------------------------------------------------------ real books keep working */

test("a conforming EPUB is still accepted, with its canonical type and extension", async () => {
  const result = await asDocument(epub());
  assert.equal(result.kind, "accepted");
  assert.equal(result.kind === "accepted" && result.format, "epub");
  assert.equal(result.kind === "accepted" && result.extension, "epub");
  assert.equal(result.kind === "accepted" && result.contentType, "application/epub+zip");
  assert.equal(looksLikeEpubContainer(epub(), await indexOf(epub())), true);
});

test("central-directory ORDER is not required, because OCF rules on position in the archive", async () => {
  // A directory is free to list members in any order; what OCF fixes is where `mimetype` SITS. An index that
  // lists it last still points it at offset 0, and that is the fact the rule is about. Refusing this would
  // reject conforming books over a convention rather than a requirement.
  const reordered = buildZip([mimetype(), container, content]);
  const entries = (await indexOf(reordered))!;
  const rotated = [...entries.slice(1), entries[0]!];
  assert.equal(rotated[rotated.length - 1]!.name, "mimetype", "the mimetype entry is now listed last");
  assert.equal(looksLikeEpubContainer(reordered, rotated), true);
});

test("a real book with many members, and a large one before its index, is still an EPUB", async () => {
  // The index is read from the end of the file, so nothing here depends on a member fitting in the bounded head.
  const big = { name: "OEBPS/images/cover.png", data: Buffer.alloc(120 * 1024, 0x42) };
  const book = buildZip([mimetype(), container, big, content, { name: "OEBPS/toc.ncx", data: Buffer.from("<ncx/>") }]);
  assert.equal(book.length > 64 * 1024, true, "the archive is larger than the bounded head");
  assert.equal(await formatOf(book), "epub");
});

test("neither the declared type nor the filename can force or prevent EPUB", async () => {
  // The request is recorded and never believed, in both directions.
  for (const [declared, name] of [["application/zip", "book.zip"], ["text/plain", "book.txt"], [undefined, undefined]] as const) {
    const result = await asDocument(epub(), declared, name);
    assert.equal(result.kind === "accepted" && result.format, "epub", `a real book is a book: ${declared}/${name}`);
  }
  const plain = buildZip([{ name: "notes.txt", data: Buffer.from("hello") }, { name: "data/readme.md", data: Buffer.from("# hi") }]);
  assert.equal(await formatOf(plain), "zip", "and a plain archive stays one however it is labelled");
});

/* ------------------------------------------------------------------ the check stays bounded */

test("the index cross-check reads no more than the bounded directory it already read", async () => {
  // The EPUB rule adds no new read: it compares fields already parsed out of the directory `readZipCentralDirectory`
  // fetched under its existing bounds. Nothing here inflates a member or follows an offset into the file.
  assert.equal(ZIP_MAX_ENTRIES, 2048);
  const entries = Array.from({ length: 64 }, (_, position) => ({ name: `OEBPS/part${position}.xhtml`, data: Buffer.from("<html/>") }));
  const book = buildZip([mimetype(), container, ...entries, content]);
  const before = process.memoryUsage().rss;
  assert.equal(await formatOf(book), "epub");
  assert.equal((process.memoryUsage().rss - before) / 1048576 < 64, true, "classification did not materialise the archive");

  // A `null` index -- whatever produced it -- is not an EPUB and not an Office document either.
  assert.equal(classifyZipPackage(epub(), null), "zip");
  assert.equal(looksLikeEpubContainer(epub(), []), false, "an empty index corroborates nothing");
});
