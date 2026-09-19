/**
 * Two ways the R16 descriptor parser read a document XML itself refuses -- or refused one XML permits.
 *
 * R16 made the parser require the OCF hierarchy, resolve namespaces by URI and validate the whole attribute
 * list. It left two defects, found by Greptile and Codex against head 09facaf and reproduced here before any
 * code changed.
 *
 * FINDING 1 -- THE DOCUMENT LEVEL WAS NEVER CHECKED. The tokenizer returned success whenever the element stack
 * emptied. It never required exactly ONE document element, and character data was skipped without ever asking
 * where it sat. XML is `document ::= prolog element Misc*` with `Misc ::= Comment | PI | S`, so outside the
 * document element the only character data permitted is whitespace, and there is exactly one document element.
 * On 09facaf each of these classified `epub`, with the named member present:
 *
 *   <container ...>...</container><extra/>      a second document element
 *   junk<container ...>...</container>          character data before the document element
 *   <container ...>...</container>junk          character data after it
 *
 * Every XML reader refuses all three; expat calls the second and third "junk after document element".
 *
 * FINDING 2 -- NAMES WERE WALKED BY CODE UNIT. `isXmlName` iterated with `charCodeAt`, which yields UTF-16 code
 * UNITS, so a supplementary character arrived as two surrogate halves and neither half is in any NameChar
 * range -- the `[#x10000-#xEFFFF]` clause could never be reached at all. The attribute-name scanner had the
 * same defect independently, stopping dead at the first half and truncating a legal name. Reproduced on
 * 09facaf: a conforming descriptor whose namespace prefix or attribute name contains U+10400 was refused and
 * the book degraded to a generic `zip`. This one fails CLOSED, so it is a compatibility regression rather than
 * a hole -- but R16 was not supposed to reject conforming books.
 *
 * THE GRAMMAR IS NOT ASSUMED. Every prolog/epilog expectation below was checked against expat, which is
 * conformant, and the results are recorded beside each case. `fast-xml-parser`'s validator disagrees with expat
 * on two of them -- it accepts CDATA outside the root and a second document element -- which is one more
 * reason R16 did not adopt it.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";
import { validateUploadedMedia, isXmlName } from "./media-validation";

/* ------------------------------------------------------------------ the smallest ZIP that can be an EPUB */

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    let byte = (crc ^ buffer[index]!) & 0xff;
    for (let bit = 0; bit < 8; bit++) byte = byte & 1 ? 0xedb88320 ^ (byte >>> 1) : byte >>> 1;
    crc = (crc >>> 8) ^ byte;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type Entry = { name: string; data: Buffer; deflate?: boolean };

function buildZip(entries: Entry[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  const offsets: number[] = [];
  const payloads: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const payload = entry.deflate ? zlib.deflateRawSync(entry.data) : entry.data;
    payloads.push(payload);
    const name = Buffer.from(entry.name, "utf8");
    const flags = /^[\x20-\x7e]*$/.test(entry.name) ? 0 : 0x0800;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(entry.data), 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const block = Buffer.concat([local, name, payload]);
    locals.push(block);
    offsets.push(offset);
    offset += block.length;
  }
  for (const [position, entry] of entries.entries()) {
    const name = Buffer.from(entry.name, "utf8");
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(/^[\x20-\x7e]*$/.test(entry.name) ? 0 : 0x0800, 8);
    header.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    header.writeUInt32LE(crc32(entry.data), 16);
    header.writeUInt32LE(payloads[position]!.length, 20);
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
const OCF = "urn:oasis:names:tc:opendocument:xmlns:container";
const NS = `xmlns="${OCF}"`;
const PACKAGE_PATH = "OEBPS/content.opf";
const MEDIA_TYPE = "application/oebps-package+xml";

const rootfile = (path = PACKAGE_PATH) => `<rootfile full-path="${path}" media-type="${MEDIA_TYPE}"/>`;
const BODY = `<rootfiles>${rootfile()}</rootfiles>`;
const container = (xml: string): Entry => ({ name: "META-INF/container.xml", data: Buffer.from(xml, "utf8"), deflate: true });
const packageDocument = (path = PACKAGE_PATH): Entry => ({ name: path, data: Buffer.from("<package/>"), deflate: true });

/** A book whose descriptor is `xml`. The XML declaration is supplied, as a real descriptor carries one. */
async function withDescriptor(xml: string, extra: Entry[] = []): Promise<string> {
  const result = await validateUploadedMedia({
    source: { buffer: buildZip([MIMETYPE, container(`<?xml version="1.0" encoding="UTF-8"?>${xml}`), packageDocument(), ...extra]) },
    allow: ["document"], declaredMimeType: "application/epub+zip", originalName: "novel.epub",
  });
  return result.kind === "accepted" ? result.format : `rejected:${result.reason}`;
}

/** A supplementary character that XML 1.0 permits as a NameStartChar: DESERET CAPITAL LETTER LONG I. */
const SUPPLEMENTARY = String.fromCodePoint(0x10400);
/** A conforming descriptor whose every element sits on a supplementary-character prefix bound to `uri`. */
const supplementaryPrefixed = (uri: string) =>
  `<p${SUPPLEMENTARY}:container xmlns:p${SUPPLEMENTARY}="${uri}">` +
  `<p${SUPPLEMENTARY}:rootfiles><p${SUPPLEMENTARY}:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></p${SUPPLEMENTARY}:rootfiles>` +
  `</p${SUPPLEMENTARY}:container>`;

/* ------------------------------------------------------------------ finding 1: one document element, and its surroundings */

test("the canonical descriptor is still a book", async () => {
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container>`), "epub");
});

test("whitespace before and after the document element is legal", async () => {
  // expat: VALID. `Misc` includes `S`, so this is a conforming descriptor and must stay one.
  assert.equal(await withDescriptor(`  \n\t<container ${NS}>${BODY}</container>\r\n  `), "epub");
  assert.equal(await withDescriptor(`\n<container ${NS}>${BODY}</container>`), "epub");
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container>\n`), "epub");
});

test("a comment before or after the document element is legal", async () => {
  // expat: VALID, both. `Misc` includes `Comment`.
  assert.equal(await withDescriptor(`<!-- a note --><container ${NS}>${BODY}</container>`), "epub");
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container><!-- a note -->`), "epub");
  assert.equal(await withDescriptor(`<!--before--> <container ${NS}>${BODY}</container> <!--after-->`), "epub");
});

test("a processing instruction before or after the document element is legal", async () => {
  // expat: VALID, both. `Misc` includes `PI`.
  assert.equal(await withDescriptor(`<?target data?><container ${NS}>${BODY}</container>`), "epub");
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container><?target data?>`), "epub");
});

test("a CDATA section outside the document element is NOT legal", async () => {
  // NOT ASSUMED. `CDSect` belongs to `content`, not to `Misc`, so it may appear only inside an element.
  // expat refuses both: "syntax error" before the root, "junk after document element" after it. (Note that
  // `fast-xml-parser`'s validator accepts both, which is why the grammar was taken from expat and the spec.)
  assert.equal(await withDescriptor(`<![CDATA[x]]><container ${NS}>${BODY}</container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container><![CDATA[x]]>`), "zip");
  // Inside the document element it stays legal, and stays inert -- the R15 protection, unchanged.
  assert.equal(await withDescriptor(`<container ${NS}><![CDATA[<rootfiles/>]]>${BODY}</container>`), "epub");
});

test("a second document element after the first is refused", async () => {
  // OBSERVED ON 09facaf: `epub`. expat: "junk after document element".
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container><extra/>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container><extra></extra>`), "zip");
});

test("an element before the document element is refused", async () => {
  assert.equal(await withDescriptor(`<extra/><container ${NS}>${BODY}</container>`), "zip");
});

test("a second `container` element is refused", async () => {
  // Both are conforming on their own, which is the point: the document may carry only one of them.
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container><container ${NS}>${BODY}</container>`), "zip");
});

test("several top-level elements are refused", async () => {
  assert.equal(await withDescriptor(`<a/><container ${NS}>${BODY}</container><b/>`), "zip");
  assert.equal(await withDescriptor(`<a/><b/>`), "zip");
});

test("character data before the document element is refused", async () => {
  // OBSERVED ON 09facaf: `epub`. expat: "not well-formed (invalid token)".
  assert.equal(await withDescriptor(`junk<container ${NS}>${BODY}</container>`), "zip");
});

test("character data after the document element is refused", async () => {
  // OBSERVED ON 09facaf: `epub`. expat: "junk after document element".
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container>junk`), "zip");
  // Including when it is the very last thing in the file, with no `<` after it to end the scan.
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container>   trailing`), "zip");
});

test("character data on both sides of the document element is refused", async () => {
  // OBSERVED ON 09facaf: `epub`.
  assert.equal(await withDescriptor(`before<container ${NS}>${BODY}</container>after`), "zip");
});

test("character data between top-level constructs is refused", async () => {
  assert.equal(await withDescriptor(`<!--a-->junk<container ${NS}>${BODY}</container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container><!--a-->junk`), "zip");
  assert.equal(await withDescriptor(`<?t d?>junk<container ${NS}>${BODY}</container>`), "zip");
});

test("character data inside the document element is still ordinary content", async () => {
  // It is not markup and never was; it simply is not the parser's business where XML allows it.
  assert.equal(await withDescriptor(`<container ${NS}>text ${BODY} more text</container>`), "epub");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>text ${rootfile()}</rootfiles></container>`), "epub");
});

test("a malformed or truncated root is refused", async () => {
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}`), "zip", "never closed");
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container`), "zip", "truncated end tag");
  assert.equal(await withDescriptor(`</container>`), "zip", "an end tag with nothing open");
  assert.equal(await withDescriptor(``), "zip", "no document element at all");
  assert.equal(await withDescriptor(`   `), "zip", "whitespace is not a document element");
  assert.equal(await withDescriptor(`<!-- only a comment -->`), "zip", "nor is a comment");
});

/* ------------------------------------------------------------------ finding 2: names are code points */

test("a supplementary code point in a namespace prefix is accepted when correctly bound", async () => {
  // OBSERVED ON 09facaf: `zip`. XML 1.0 permits [#x10000-#xEFFFF] in a Name; the walk could not reach it.
  assert.equal(await withDescriptor(supplementaryPrefixed(OCF)), "epub");
});

test("a supplementary code point in an ordinary attribute name is accepted", async () => {
  // OBSERVED ON 09facaf: `zip`. The attribute-name SCANNER had the same code-unit defect independently of
  // `isXmlName`, so fixing only the predicate would have left this case broken.
  const tag = `<rootfile a${SUPPLEMENTARY}="x" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${tag}</rootfiles></container>`), "epub");
});

test("a supplementary code point in an element's local name is parsed, and is simply not the OCF name", async () => {
  // Parsed correctly rather than refused -- and `rootfiles\u{10400}` is a different local name, so it declares
  // nothing. The document is well-formed; it is just not a container descriptor.
  const xml = `<container ${NS}><rootfiles${SUPPLEMENTARY}>${rootfile()}</rootfiles${SUPPLEMENTARY}></container>`;
  assert.equal(await withDescriptor(xml), "zip");
});

test("XML Name validation walks code points, at every boundary that matters", async () => {
  // The predicate is exported for this: the end-to-end path cannot deliver a lone surrogate, because the
  // descriptor is decoded from UTF-8 first and Node replaces an unpaired surrogate with U+FFFD. The guard is
  // defence in depth, and this is where it can actually be pinned.
  for (const name of ["abc", "a-b.c", "_x", ":x", "café", "á"]) {
    assert.equal(isXmlName(name), true, name);
  }
  // Supplementary code points: the range XML permits is [#x10000-#xEFFFF], at both ends.
  assert.equal(isXmlName(String.fromCodePoint(0x10400)), true, "U+10400 alone");
  assert.equal(isXmlName("a" + String.fromCodePoint(0x10400)), true, "U+10400 as a NameChar");
  assert.equal(isXmlName(String.fromCodePoint(0x10000) + "x"), true, "U+10000, the low end");
  assert.equal(isXmlName(String.fromCodePoint(0xeffff)), true, "U+EFFFF, the high end");
  // Outside that range. R17 tightened this to the specification rather than loosening it to pass: the table
  // had said `>= 0x10000`, which accepts planes XML excludes.
  assert.equal(isXmlName(String.fromCodePoint(0xf0000)), false, "U+F0000 is past the range");
  assert.equal(isXmlName(String.fromCodePoint(0x10ffff)), false, "U+10FFFF is past the range");
  // Lone surrogates are not characters, so they are not name characters.
  assert.equal(isXmlName("\ud800"), false, "isolated high surrogate");
  assert.equal(isXmlName("\udc00"), false, "isolated low surrogate");
  assert.equal(isXmlName("a\ud800"), false, "trailing isolated high surrogate");
  assert.equal(isXmlName("a\udc00"), false, "trailing isolated low surrogate");
  assert.equal(isXmlName("\ud800a"), false, "leading isolated high surrogate");
  // Ordinary rejections, unchanged.
  for (const name of ["", "1bad", "-bad", ".bad", "a b", "a<b", "a\"b", "́a"]) {
    assert.equal(isXmlName(name), false, JSON.stringify(name));
  }
});

test("ASCII namespace behaviour is unchanged", async () => {
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container>`), "epub", "default namespace");
  const prefixed = `<q:container xmlns:q="${OCF}"><q:rootfiles><q:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></q:rootfiles></q:container>`;
  assert.equal(await withDescriptor(prefixed), "epub", "ASCII prefix bound to the OCF URI");
  assert.equal(await withDescriptor(`<container xmlns="urn:not-ocf">${BODY}</container>`), "zip", "wrong default namespace");
  assert.equal(await withDescriptor(`<zz:container><zz:rootfiles>${rootfile()}</zz:rootfiles></zz:container>`), "zip", "undeclared prefix");
});

test("namespace shadowing and rebinding are unchanged", async () => {
  const shadowed = `<q:container xmlns:q="${OCF}"><q:rootfiles xmlns:q="urn:not-ocf"><q:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></q:rootfiles></q:container>`;
  assert.equal(await withDescriptor(shadowed), "zip", "prefix rebound below the root");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles xmlns="urn:not-ocf">${rootfile()}</rootfiles></container>`), "zip", "default rebound");
});

/* ------------------------------------------------------------------ the two together, adversarially */

test("a supplementary-prefixed document with a legal epilog comment is a book", async () => {
  assert.equal(await withDescriptor(`${supplementaryPrefixed(OCF)}<!-- done -->`), "epub");
  assert.equal(await withDescriptor(`<!-- start -->${supplementaryPrefixed(OCF)}`), "epub");
  assert.equal(await withDescriptor(`  ${supplementaryPrefixed(OCF)}  `), "epub");
});

test("a supplementary-prefixed document with trailing junk is not", async () => {
  assert.equal(await withDescriptor(`${supplementaryPrefixed(OCF)}junk`), "zip");
  assert.equal(await withDescriptor(`${supplementaryPrefixed(OCF)}<extra/>`), "zip");
});

test("a supplementary prefix bound to a non-OCF namespace is not a book", async () => {
  // The prefix now parses, which is exactly why the namespace check has to carry the weight.
  assert.equal(await withDescriptor(supplementaryPrefixed("urn:not-ocf")), "zip");
});

test("a second document element named with a supplementary code point is refused", async () => {
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container><e${SUPPLEMENTARY}/>`), "zip");
});

test("a supplementary attribute name does not disturb full-path or media-type", async () => {
  const tag = `<rootfile z${SUPPLEMENTARY}="q" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${tag}</rootfiles></container>`), "epub");
  // And the R16 attribute rules still apply to it: a duplicate is still a duplicate.
  const duplicate = `<rootfile a${SUPPLEMENTARY}="1" a${SUPPLEMENTARY}="2" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${duplicate}</rootfiles></container>`), "zip");
  // A bare token beside a supplementary name is still malformed.
  const bare = `<rootfile a${SUPPLEMENTARY} full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${bare}</rootfiles></container>`), "zip");
});

test("R16's hierarchy, namespace and attribute rules all still hold under the new document-level check", async () => {
  assert.equal(await withDescriptor(`<something ${NS}><rootfiles>${rootfile()}</rootfiles></something>`), "zip", "wrong root");
  assert.equal(await withDescriptor(`<container ${NS}><wrapper><rootfiles>${rootfile()}</rootfiles></wrapper></container>`), "zip", "wrapper");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><wrapper>${rootfile()}</wrapper></rootfiles></container>`), "zip", "wrapper below");
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}${BODY}</container>`), "zip", "two rootfiles children");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile nonsense full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip", "bare token");
  assert.equal(await withDescriptor(`<container ${NS} ${NS}>${BODY}</container>`), "zip", "duplicate xmlns");
  assert.equal(await withDescriptor(`<!DOCTYPE container><container ${NS}>${BODY}</container>`), "zip", "DOCTYPE still refused");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="&undeclared;" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip", "general entity");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="OEBPS&#47;content.opf" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "epub", "character reference");
});

test("the bounds still hold under the new checks", async () => {
  const deep = "<a>".repeat(400) + BODY + "</a>".repeat(400);
  assert.equal(await withDescriptor(`<container ${NS}>${deep}</container>`), "zip", "depth");
  assert.equal(await withDescriptor(`<container ${NS}>${"<a/>".repeat(5000)}${BODY}</container>`), "zip", "tokens");
  // A prolog stuffed with comments is bounded by the descriptor's byte cap, and costs no memory.
  const padding = `<!--${" ".repeat(8 * 1024 * 1024)}-->`;
  const before = process.memoryUsage().rss;
  assert.equal(await withDescriptor(`${padding}<container ${NS}>${BODY}</container>`), "zip");
  const growth = (process.memoryUsage().rss - before) / (1024 * 1024);
  assert.ok(growth < 64, `classification allocated ${growth.toFixed(1)}MB`);
});
