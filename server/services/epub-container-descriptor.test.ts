/**
 * A `mimetype` entry says what an archive claims to be. The container descriptor is what makes it one.
 *
 * THE FINDING. `looksLikeEpubContainer` proved the OCF `mimetype` member -- first, stored, exactly
 * `application/epub+zip`, corroborated by the index and its own local header -- and then stopped. Nothing
 * required the rest of the minimum structure, so an ordinary ZIP holding `mimetype` plus `readme.txt` was
 * classified `epub` and published as `.epub` with `application/epub+zip`: a file no reader can open.
 *
 * REPRODUCED ON HEAD 1a73a6f, with real python-`zipfile` archives (deflated members, stored `mimetype`):
 *
 *   mimetype + readme.txt                                    -> epub   (Codex's exact case)
 *   mimetype + OEBPS/content.opf, no container at all        -> epub
 *   mimetype + container naming OEBPS/content.opf, absent    -> epub
 *   a conforming book                                        -> epub   (the control)
 *
 * WHAT OCF REQUIRES. `META-INF/container.xml` is REQUIRED, and each `rootfile` element within `rootfiles` must
 * identify the location of a Package Document -- given by `full-path`, relative to the root directory of the
 * container and not to META-INF, with media type `application/oebps-package+xml`. Where there are several, an
 * OCF Processor must consider the FIRST `rootfile` element to represent the Default Rendition, so the choice of
 * which one to honour is the specification's rather than an uploader's.
 *
 * SO THE MINIMUM EVIDENCE IS: the descriptor exists and can be read, it names a Package Document, and that
 * member is really in this archive, named unambiguously, agreeing with its own local header.
 *
 * DELIBERATELY NOT AN EPUB READER. The package document's contents are never parsed -- no manifest, no spine,
 * no XHTML, no stylesheet, no images. The question is only whether the archive is structurally the thing it
 * says it is before ChefSire advertises it as one. Everything else fails closed to an inert generic `zip`.
 *
 * Every fixture is a real ZIP written byte by byte, with a correct CRC-32 per member.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";
import { validateUploadedMedia } from "./media-validation";

/* ------------------------------------------------------------------ a ZIP writer that can deflate a member */

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    let byte = (crc ^ buffer[index]!) & 0xff;
    for (let bit = 0; bit < 8; bit++) byte = byte & 1 ? 0xedb88320 ^ (byte >>> 1) : byte >>> 1;
    crc = (crc >>> 8) ^ byte;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type Entry = {
  name: string;
  data: Buffer;
  /** Deflate this member, the way a real archiver stores everything but `mimetype`. */
  deflate?: boolean;
  /** A different name in the local header, to exercise the shared consistency rule. */
  localName?: string;
};

function buildZip(entries: Entry[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  const offsets: number[] = [];
  const stored: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const payload = entry.deflate ? zlib.deflateRawSync(entry.data) : entry.data;
    stored.push(payload);
    const localName = Buffer.from(entry.localName ?? entry.name, "latin1");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(entry.data), 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(localName.length, 26);
    const block = Buffer.concat([local, localName, payload]);
    locals.push(block);
    offsets.push(offset);
    offset += block.length;
  }
  for (const [position, entry] of entries.entries()) {
    const name = Buffer.from(entry.name, "latin1");
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    header.writeUInt32LE(crc32(entry.data), 16);
    header.writeUInt32LE(stored[position]!.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offsets[position]!, 42);
    central.push(Buffer.concat([header, name]));
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

const MIMETYPE: Entry = { name: "mimetype", data: Buffer.from("application/epub+zip", "latin1") };
const CONTAINER_PATH = "META-INF/container.xml";
const PACKAGE_PATH = "OEBPS/content.opf";

/** A conforming OCF descriptor naming `full-path`. */
const descriptorFor = (fullPath: string, mediaType = "application/oebps-package+xml") =>
  `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">`
  + `<rootfiles><rootfile full-path="${fullPath}" media-type="${mediaType}"/></rootfiles></container>`;

const container = (xml: string, over: Partial<Entry> = {}): Entry => ({ name: CONTAINER_PATH, data: Buffer.from(xml), deflate: true, ...over });
const packageDocument = (path = PACKAGE_PATH): Entry => ({ name: path, data: Buffer.from("<package/>"), deflate: true });

/** A conforming book: the mimetype entry, a real descriptor, and the package document it names. */
const book = (extra: Entry[] = []) => buildZip([MIMETYPE, container(descriptorFor(PACKAGE_PATH)), packageDocument(), ...extra]);

const asDocument = (buffer: Buffer, declaredMimeType = "application/epub+zip", originalName = "novel.epub") =>
  validateUploadedMedia({ source: { buffer }, allow: ["document"], declaredMimeType, originalName });

async function classify(entries: Entry[]) {
  const result = await asDocument(buildZip(entries));
  return result.kind === "accepted" ? { format: result.format, extension: result.extension, contentType: result.contentType } : { format: `rejected:${result.reason}`, extension: "", contentType: "" };
}

/* ------------------------------------------------------------------ the finding, exactly as reported */

test("a mimetype entry plus something unrelated is not an EPUB", async () => {
  // OBSERVED ON 1a73a6f: `epub`, published as .epub with application/epub+zip.
  const result = await classify([MIMETYPE, { name: "readme.txt", data: Buffer.from("just a readme"), deflate: true }]);
  assert.equal(result.format, "zip");
  assert.equal(result.extension, "zip");
  assert.equal(result.contentType, "application/zip");
});

test("no container descriptor at all is not an EPUB, however much else is present", async () => {
  // OBSERVED ON 1a73a6f: `epub`. A package document without the descriptor that points at it is not enough.
  assert.equal((await classify([MIMETYPE, packageDocument()])).format, "zip");
  assert.equal((await classify([MIMETYPE, packageDocument(), { name: "OEBPS/toc.ncx", data: Buffer.from("<ncx/>"), deflate: true }])).format, "zip");
  // Nor is a descriptor in the wrong place.
  assert.equal((await classify([MIMETYPE, container(descriptorFor(PACKAGE_PATH), { name: "container.xml" }), packageDocument()])).format, "zip");
  assert.equal((await classify([MIMETYPE, container(descriptorFor(PACKAGE_PATH), { name: "META-INF/CONTAINER.XML" }), packageDocument()])).format, "zip");
});

test("a container naming a package document that is not here is not an EPUB", async () => {
  // OBSERVED ON 1a73a6f: `epub`. The descriptor pointed at OEBPS/content.opf and no such member existed.
  assert.equal((await classify([MIMETYPE, container(descriptorFor(PACKAGE_PATH))])).format, "zip");
  assert.equal((await classify([MIMETYPE, container(descriptorFor("EPUB/package.opf")), packageDocument()])).format, "zip", "names one, carries another");
  // Case is not a match either: the member is named exactly or it is not the member.
  assert.equal((await classify([MIMETYPE, container(descriptorFor("oebps/content.opf")), packageDocument()])).format, "zip");
});

/* ------------------------------------------------------------------ a conforming book still works */

test("a conforming EPUB still classifies, with its canonical type and extension", async () => {
  assert.deepEqual(await classify([MIMETYPE, container(descriptorFor(PACKAGE_PATH)), packageDocument()]), {
    format: "epub", extension: "epub", contentType: "application/epub+zip",
  });
  // With the other members a real book carries.
  const full = await classify([
    MIMETYPE,
    container(descriptorFor(PACKAGE_PATH)),
    packageDocument(),
    { name: "OEBPS/toc.ncx", data: Buffer.from("<ncx/>"), deflate: true },
    { name: "OEBPS/Text/chapter1.xhtml", data: Buffer.from("<html/>"), deflate: true },
    { name: "OEBPS/images/cover.png", data: Buffer.alloc(2048, 0x42), deflate: true },
  ]);
  assert.equal(full.format, "epub");
});

test("the package document may sit anywhere the descriptor says, not just OEBPS", async () => {
  // The path comes from the descriptor. Nothing is hardcoded to `OEBPS/content.opf`.
  for (const path of ["EPUB/package.opf", "content.opf", "a/b/c/deep.opf", "OPS/book.opf"]) {
    const result = await classify([MIMETYPE, container(descriptorFor(path)), packageDocument(path)]);
    assert.equal(result.format, "epub", path);
  }
});

test("a stored descriptor works as well as a deflated one", async () => {
  // Real archivers deflate it; nothing requires that, so both paths are exercised.
  assert.equal((await classify([MIMETYPE, container(descriptorFor(PACKAGE_PATH), { deflate: false }), packageDocument()])).format, "epub");
  assert.equal((await classify([MIMETYPE, container(descriptorFor(PACKAGE_PATH), { deflate: true }), packageDocument()])).format, "epub");
});

test("namespace prefixes and ordinary formatting do not defeat the descriptor", async () => {
  const prefixed = `<?xml version="1.0"?>\n<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">\n  <ocf:rootfiles>\n    <ocf:rootfile full-path="${PACKAGE_PATH}" media-type="application/oebps-package+xml"/>\n  </ocf:rootfiles>\n</ocf:container>`;
  assert.equal((await classify([MIMETYPE, container(prefixed), packageDocument()])).format, "epub");

  const singleQuoted = `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile media-type='application/oebps-package+xml' full-path='${PACKAGE_PATH}'/></rootfiles></container>`;
  assert.equal((await classify([MIMETYPE, container(singleQuoted), packageDocument()])).format, "epub", "attribute order and quoting");
});

/* ------------------------------------------------------------------ malformed descriptors fail closed */

test("a descriptor that cannot be read unambiguously is not evidence of anything", async () => {
  for (const [label, xml] of [
    ["not XML at all", "just some bytes"],
    ["truncated mid-element", '<container><rootfiles><rootfile full-path="OEBPS/content.opf"'],
    ["no rootfiles element", '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"></container>'],
    ["rootfiles present but empty", "<container><rootfiles></rootfiles></container>"],
    ["rootfiles never closed", '<container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'],
    ["no full-path attribute", '<container><rootfiles><rootfile media-type="application/oebps-package+xml"/></rootfiles></container>'],
    ["empty full-path", '<container><rootfiles><rootfile full-path="" media-type="application/oebps-package+xml"/></rootfiles></container>'],
    ["whitespace full-path", '<container><rootfiles><rootfile full-path="   " media-type="application/oebps-package+xml"/></rootfiles></container>'],
    ["no media-type", `<container><rootfiles><rootfile full-path="${PACKAGE_PATH}"/></rootfiles></container>`],
    ["the wrong media-type", descriptorFor(PACKAGE_PATH, "application/xhtml+xml")],
    ["a media-type that merely contains the right one", descriptorFor(PACKAGE_PATH, "x-application/oebps-package+xmlish")],
    ["an empty document", ""],
  ] as const) {
    const entries = xml === "" ? [MIMETYPE, packageDocument()] : [MIMETYPE, container(xml), packageDocument()];
    assert.equal((await classify(entries)).format, "zip", label);
  }
});

test("a descriptor declaring a doctype or an entity is refused outright", async () => {
  // Nothing is ever resolved -- no entity expansion, no DTD fetch, no network. Refusing the declaration
  // outright is simpler than reasoning about what a resolver might have done with it.
  for (const [label, xml] of [
    ["a doctype", `<!DOCTYPE container><container><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="application/oebps-package+xml"/></rootfiles></container>`],
    ["an external entity declaration", `<!DOCTYPE container [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><container><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="application/oebps-package+xml"/></rootfiles></container>`],
    ["an internal entity declaration", `<!DOCTYPE c [<!ENTITY p "OEBPS/content.opf">]><container><rootfiles><rootfile full-path="&p;" media-type="application/oebps-package+xml"/></rootfiles></container>`],
  ] as const) {
    assert.equal((await classify([MIMETYPE, container(xml), packageDocument()])).format, "zip", label);
  }
  // And an attribute carrying a character reference is refused rather than decoded and guessed at.
  assert.equal((await classify([MIMETYPE, container(descriptorFor("OEBPS&#47;content.opf")), packageDocument()])).format, "zip");
});

test("an unsafe rootfile path is never looked up", async () => {
  for (const [label, path] of [
    ["parent traversal", "../outside.opf"],
    ["traversal in the middle", "OEBPS/../../outside.opf"],
    ["absolute", "/etc/passwd"],
    ["a drive letter", "C:/windows/system.opf"],
    ["a backslash", "OEBPS\\\\content.opf"],
    ["an empty segment", "OEBPS//content.opf"],
    ["a single dot segment", "OEBPS/./content.opf"],
    ["a trailing slash", "OEBPS/"],
    ["a bare dot", "."],
    ["a bare parent", ".."],
  ] as const) {
    const entries = [MIMETYPE, container(descriptorFor(path)), packageDocument(), { name: "outside.opf", data: Buffer.from("<package/>"), deflate: true }];
    assert.equal((await classify(entries)).format, "zip", label);
  }
});

test("a rootfile the archive names twice is ambiguous, not usable", async () => {
  // Two members resolving to one declared path is the same ambiguity this module refuses everywhere else.
  assert.equal((await classify([MIMETYPE, container(descriptorFor(PACKAGE_PATH)), packageDocument(), packageDocument()])).format, "zip", "named twice exactly");
  assert.equal((await classify([MIMETYPE, container(descriptorFor(PACKAGE_PATH)), packageDocument(), packageDocument("OEBPS/CONTENT.OPF")])).format, "zip", "differing only in case");
  // And two container descriptors are refused for the same reason.
  assert.equal((await classify([MIMETYPE, container(descriptorFor(PACKAGE_PATH)), container(descriptorFor(PACKAGE_PATH)), packageDocument()])).format, "zip");
});

test("the first rootfile decides, as OCF requires, so a later one cannot smuggle a target past it", async () => {
  // "An OCF Processor MUST consider the first rootfile element within the rootfiles element to represent the
  // Default Rendition." The first is honoured whether that helps an archive or not.
  const two = (first: string, second: string) =>
    `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>`
    + `<rootfile full-path="${first}" media-type="application/oebps-package+xml"/>`
    + `<rootfile full-path="${second}" media-type="application/oebps-package+xml"/>`
    + `</rootfiles></container>`;

  // The first names a member that is here: an EPUB, and the second is irrelevant.
  assert.equal((await classify([MIMETYPE, container(two(PACKAGE_PATH, "missing.opf")), packageDocument()])).format, "epub");
  // The first names a member that is NOT here: not an EPUB, even though the second one would have been fine.
  assert.equal((await classify([MIMETYPE, container(two("missing.opf", PACKAGE_PATH)), packageDocument()])).format, "zip");
  // The first is unsafe: refused, rather than falling through to a safe-looking second.
  assert.equal((await classify([MIMETYPE, container(two("../escape.opf", PACKAGE_PATH)), packageDocument()])).format, "zip");
});

/* ------------------------------------------------------------------ the earlier EPUB rules are untouched */

test("every previous mimetype rule still holds, now alongside a real descriptor", async () => {
  const withDescriptor = (mimetype: Entry, extra: Entry[] = []) =>
    classify([mimetype, container(descriptorFor(PACKAGE_PATH)), packageDocument(), ...extra]);

  assert.equal((await withDescriptor(MIMETYPE)).format, "epub", "the control");
  for (const [label, mimetype, extra] of [
    ["mimetype deflated", { ...MIMETYPE, deflate: true }, []],
    ["mimetype payload has trailing bytes", { name: "mimetype", data: Buffer.from("application/epub+zip and more") }, []],
    ["mimetype payload is something else", { name: "mimetype", data: Buffer.from("application/zip") }, []],
    ["named MIMETYPE", { name: "MIMETYPE", data: Buffer.from("application/epub+zip") }, []],
    ["local header names something else", { ...MIMETYPE, localName: "MISMATCH" }, []],
    ["a second mimetype differing only in case", MIMETYPE, [{ name: "MIMETYPE", data: Buffer.from("application/epub+zip"), deflate: true }]],
  ] as const) {
    assert.equal((await withDescriptor(mimetype as Entry, [...extra] as Entry[])).format, "zip", label);
  }

  // And mimetype must still be FIRST: a descriptor does not buy its way past the OCF placement rule.
  assert.equal((await classify([container(descriptorFor(PACKAGE_PATH)), MIMETYPE, packageDocument()])).format, "zip", "mimetype not first");
});

test("an ordinary archive that merely mentions the media type is still an ordinary archive", async () => {
  assert.equal((await classify([{ name: "notes.txt", data: Buffer.from("application/epub+zip"), deflate: true }])).format, "zip");
  assert.equal((await classify([{ name: "application/epub+zip", data: Buffer.from("x"), deflate: true }, { name: "readme.txt", data: Buffer.from("y") }])).format, "zip");
  // Even one carrying a perfectly good container descriptor, but no mimetype entry to go with it.
  assert.equal((await classify([container(descriptorFor(PACKAGE_PATH)), packageDocument()])).format, "zip");
});

/* ------------------------------------------------------------------ the read stays bounded */

test("the descriptor read is bounded, and a bomb does not get inflated", async () => {
  // The one member this module ever decompresses is bounded on the way in and on the way out, and the CRC is
  // checked afterwards, so what came out is provably what the directory described.
  const huge = Buffer.alloc(8 * 1024 * 1024, 0x20);
  const before = process.memoryUsage().rss;
  assert.equal((await classify([MIMETYPE, container(huge.toString("latin1")), packageDocument()])).format, "zip", "an oversized descriptor is refused");
  assert.equal((process.memoryUsage().rss - before) / 1048576 < 128, true, "without materialising it repeatedly");

  // A descriptor whose bytes no longer match the CRC the directory records is refused rather than trusted.
  // Stored, so the text is findable: flipping a byte inside it leaves every length intact and only the
  // checksum disagreeing, which is precisely the thing the CRC check is there to catch.
  const archive = buildZip([MIMETYPE, container(descriptorFor(PACKAGE_PATH), { deflate: false }), packageDocument()]);
  assert.equal((await asDocument(archive)).kind === "accepted" && ((await asDocument(archive)) as { format: string }).format, "epub", "the control reads");

  const corrupted = Buffer.from(archive);
  const marker = corrupted.indexOf("rootfile");
  assert.equal(marker > 0, true, "the stored descriptor really is findable");
  corrupted[marker] = corrupted[marker]! ^ 0xff;
  assert.equal(corrupted.length, archive.length, "and only one byte changed");
  const result = await asDocument(corrupted);
  assert.equal(result.kind === "accepted" && result.format, "zip", "a descriptor whose bytes changed under its CRC");
});
