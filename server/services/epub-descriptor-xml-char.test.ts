/**
 * XML `Char`, XML `S` and XML `NameChar` are three different sets, and this pins all three apart.
 *
 * FINDING 1 (R21, Codex) -- LITERAL CHARACTERS WERE NEVER CHECKED. Attribute-value decoding returned early
 * when a raw value held neither `<` nor `&`, so nothing ever compared a literal character against production
 * [2]. Reproduced on head d253ea1: a required `rootfile` carrying `note="\f"` classified `epub`, though a form
 * feed is not a `Char` and expat refuses the document. The targeted audit found the same gap in every other
 * place literal characters are consumed -- character data, comments, processing-instruction content and CDATA
 * content -- five contexts x six characters, thirty reproductions, all `epub` here and all refused by expat.
 *
 * `Char` is a property of the DOCUMENT rather than of any one construct, so it is now checked once over the
 * whole decoded descriptor. That is what keeps the five contexts from drifting apart.
 *
 *   [2] Char ::= #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
 *
 * FINDING 2 (R21, Greptile) -- AND R20 WAS WRONG. R20 carved U+FEFF out of the XML Name ranges because expat
 * refuses it in names. Greptile pointed out that production [4] reads `... | [#xFDF0-#xFFFD] | ...` and #xFEFF
 * is inside #xFDF0-#xFFFD, so it IS a NameStartChar. Re-checked directly against the normative grammar: it is,
 * and the grammar governs -- expat is simply stricter than the specification here. The carve-out is reverted.
 * That was my error in R20, not the reviewer's.
 *
 *   [3]  S             ::= (#x20 | #x9 | #xD | #xA)+
 *   [4]  NameStartChar ::= ":" | [A-Z] | "_" | [a-z] | ... | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
 *
 * THE DISTINCTION, HELD IN ONE PLACE. U+FEFF is NOT `S` (R20, which stands); it IS a `Char`; it IS a
 * `NameChar`; and a UTF-8 BOM is consumed only at byte offset zero (R18) rather than being recognised
 * anywhere else. Those are four separate statements and this file asserts each of them.
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
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(/^[\x20-\x7e]*$/.test(entry.name) ? 0 : 0x0800, 6);
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
const rootfile = (extra = "") => `<rootfile ${extra}full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
const body = (extra = "") => `<rootfiles>${rootfile(extra)}</rootfiles>`;

async function withDescriptorBytes(descriptor: Buffer): Promise<string> {
  const result = await validateUploadedMedia({
    source: {
      buffer: buildZip([
        MIMETYPE,
        { name: "META-INF/container.xml", data: descriptor, deflate: true },
        { name: PACKAGE_PATH, data: Buffer.from("<package/>"), deflate: true },
      ]),
    },
    allow: ["document"], declaredMimeType: "application/epub+zip", originalName: "novel.epub",
  });
  return result.kind === "accepted" ? result.format : `rejected:${result.reason}`;
}
const withDescriptor = (xml: string) => withDescriptorBytes(Buffer.from(xml, "utf8"));

/** Characters production [2] excludes. expat refuses every one of these in every context below. */
const NOT_CHAR: [string, string][] = [
  ["FORM FEED U+000C", "\u000c"],
  ["VERTICAL TAB U+000B", "\u000b"],
  ["NUL U+0000", "\u0000"],
  ["U+0001", "\u0001"],
  ["U+001F", "\u001f"],
  ["U+FFFE", "￾"],
  ["U+FFFF", "￿"],
];

/** XML `S`, for the one rule this file has to defer to: outside the document element only `S` is permitted. */
const XML_SPACE_ONLY = new RegExp("^[\\u0020\\u0009\\u000d\\u000a]$");

/** Every context in which the tokenizer consumes literal characters. */
const CONTEXTS: [string, (character: string) => string][] = [
  ["attribute value", (c) => `<container ${NS}>${body(`note="${c}" `)}</container>`],
  ["character data", (c) => `<container ${NS}>${c}${body()}</container>`],
  ["character data outside the root", (c) => `<container ${NS}>${body()}</container>${c}`],
  ["comment", (c) => `<container ${NS}><!-- ${c} -->${body()}</container>`],
  ["processing-instruction content", (c) => `<container ${NS}><?t ${c}?>${body()}</container>`],
  ["CDATA content", (c) => `<container ${NS}><![CDATA[${c}]]>${body()}</container>`],
  ["the prolog, after the declaration", (c) => `<?xml version="1.0" encoding="UTF-8"?>${c}<container ${NS}>${body()}</container>`],
];

/* ------------------------------------------------------------------ finding 1: literal XML Char */

test("the reported attribute value carrying a form feed is refused", async () => {
  // OBSERVED ON d253ea1: `epub`. expat: not well-formed.
  assert.equal(await withDescriptor(`<container ${NS}>${body(`note="\u000c" `)}</container>`), "zip");
});

test("a literal non-Char is refused in every context that consumes one", async () => {
  // THE REPRODUCTION MATRIX. Six of these characters x five of these contexts classified `epub` on d253ea1.
  for (const [context, build] of CONTEXTS) {
    for (const [name, character] of NOT_CHAR) {
      assert.equal(await withDescriptor(build(character)), "zip", `${context} :: ${name}`);
    }
  }
});

test("the characters production [2] does permit keep working in every context", async () => {
  // `Char` includes tab, LF and CR, and everything from #x20 up apart from the excluded ranges.
  for (const [context, build] of CONTEXTS) {
    for (const [name, character] of [["TAB", "\u0009"], ["LF", "\u000a"], ["CR", "\u000d"], ["'x'", "x"], ["U+00E9", "é"], ["U+FFFD", "�"]] as [string, string][]) {
      // Character data outside the root may only be `S`, so a non-whitespace Char is refused there for a
      // different and already-pinned reason (R17). Every other context takes any Char.
      // OUTSIDE the document element -- in the prolog or the epilog -- only `S` is permitted, so a
      // non-whitespace Char is refused there for a different and already-pinned reason (R17). Every
      // other context takes any Char. Both rules are real; this test is about `Char`, so it defers.
      const outsideRoot = context === "character data outside the root" || context === "the prolog, after the declaration";
      const expected = outsideRoot && !XML_SPACE_ONLY.test(character) ? "zip" : "epub";
      assert.equal(await withDescriptor(build(character)), expected, `${context} :: ${name}`);
    }
  }
});

test("a supplementary Char is one character, not two halves", async () => {
  const deseret = String.fromCodePoint(0x10400);
  assert.equal(await withDescriptor(`<container ${NS}>${body(`note="${deseret}" `)}</container>`), "epub", "in a value");
  assert.equal(await withDescriptor(`<container ${NS}>${deseret}${body()}</container>`), "epub", "as content");
  // #x10FFFF is the top of the range and is a Char; anything beyond it cannot be encoded at all.
  assert.equal(await withDescriptor(`<container ${NS}>${body(`note="${String.fromCodePoint(0x10ffff)}" `)}</container>`), "epub");
});

test("a numeric character reference to a non-Char is still refused, as it already was", async () => {
  // R16's rule, unchanged -- the literal check does not replace it, and both now agree.
  for (const reference of ["&#xC;", "&#0;", "&#xFFFE;", "&#xD800;"]) {
    assert.equal(await withDescriptor(`<container ${NS}>${body(`note="${reference}" `)}</container>`), "zip", reference);
  }
});

/* ------------------------------------------------------------------ finding 2: U+FEFF, and the three sets */

test("U+FEFF is a NameChar, because the normative production says so", async () => {
  // R20 excluded it on expat's behaviour. Production [4] includes [#xFDF0-#xFFFD], which contains #xFEFF,
  // and the grammar governs. This reverts that exclusion.
  assert.equal(isXmlName("﻿"), true, "alone");
  assert.equal(isXmlName("a﻿b"), true, "inside");
  assert.equal(isXmlName("a﻿"), true, "trailing");
  // Used as a namespace prefix and as an attribute name, end to end.
  const prefixed =
    `<p﻿:container xmlns:p﻿="${OCF}"><p﻿:rootfiles>` +
    `<p﻿:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></p﻿:rootfiles></p﻿:container>`;
  assert.equal(await withDescriptor(prefixed), "epub", "namespace prefix");
  assert.equal(await withDescriptor(`<container ${NS}>${body(`a﻿b="x" `)}</container>`), "epub", "attribute name");
});

test("the neighbouring Name ranges are unchanged by the revert", async () => {
  assert.equal(isXmlName(String.fromCodePoint(0xfdf0)), true, "U+FDF0, the low end");
  assert.equal(isXmlName(String.fromCodePoint(0xfefe)), true, "U+FEFE, just below");
  assert.equal(isXmlName(String.fromCodePoint(0xff00)), true, "U+FF00, just above");
  assert.equal(isXmlName(String.fromCodePoint(0xfffd)), true, "U+FFFD, the high end");
  assert.equal(isXmlName(String.fromCodePoint(0xfdcf)), true, "U+FDCF, from the range below");
  // Outside the Name ranges, unchanged. U+FFFE is not a Name character and is not a Char either.
  assert.equal(isXmlName(String.fromCodePoint(0xfffe)), false, "U+FFFE");
  assert.equal(isXmlName(String.fromCodePoint(0x10400)), true, "R17 supplementary, low");
  assert.equal(isXmlName(String.fromCodePoint(0xeffff)), true, "R17 supplementary, high end");
  assert.equal(isXmlName(String.fromCodePoint(0xf0000)), false, "R17, past the range");
  assert.equal(isXmlName("\ud800"), false, "R17 lone surrogate");
});

test("U+FEFF is still not XML `S`", async () => {
  // R20's finding, which stands: it is a name character, not whitespace. Where the grammar requires `S`,
  // U+FEFF is not it -- and since it IS a NameChar, it is simply absorbed into the adjacent name instead,
  // which then fails to be the name the grammar wanted.
  assert.equal(await withDescriptor(`<?xml﻿version="1.0"?><container ${NS}>${body()}</container>`), "zip", "declaration");
  assert.equal(await withDescriptor(`<container ${NS}>${body(`note="x"﻿id="y" `)}</container>`), "zip", "between attributes");
  assert.equal(await withDescriptor(`<container﻿${NS}>${body()}</container>`), "zip", "after an element name");
  // And as character data outside the root, where only `S` is permitted.
  assert.equal(await withDescriptor(`<container ${NS}>${body()}</container>﻿`), "zip", "after the root");
});

test("U+FEFF is a Char wherever XML asks only for one", async () => {
  assert.equal(await withDescriptor(`<container ${NS}>﻿${body()}</container>`), "epub", "as content");
  assert.equal(await withDescriptor(`<container ${NS}>${body(`note="a﻿b" `)}</container>`), "epub", "in an attribute value");
  assert.equal(await withDescriptor(`<container ${NS}><!-- a﻿b -->${body()}</container>`), "epub", "in a comment");
  assert.equal(await withDescriptor(`<container ${NS}><![CDATA[a﻿b]]>${body()}</container>`), "epub", "in CDATA");
});

test("the leading byte order mark is still consumed at offset zero, and only there", async () => {
  // R18, unchanged by any of this. The BOM is a byte-level encoding signature, not a character the grammar
  // sees -- which is a different statement from U+FEFF being a Char and a NameChar, and all three hold.
  const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
  const document = `<container ${NS}>${body()}</container>`;
  assert.equal(await withDescriptorBytes(Buffer.concat([BOM, Buffer.from(document, "utf8")])), "epub", "one mark, at offset zero");
  assert.equal(await withDescriptorBytes(Buffer.concat([BOM, BOM, Buffer.from(document, "utf8")])), "zip", "a second is not `S`");
  assert.equal(
    await withDescriptorBytes(Buffer.concat([Buffer.from(`<?xml version="1.0"?>`, "utf8"), BOM, Buffer.from(document, "utf8")])),
    "zip", "one after the declaration is not `S` either",
  );
  assert.equal(await withDescriptorBytes(Buffer.concat([BOM, Buffer.from(`<?xml version="1.0"?>${document}`, "utf8")])), "epub", "the declaration is still at offset zero behind it");
});

/* ------------------------------------------------------------------ nothing earlier is disturbed */

test("every earlier protection still holds", async () => {
  const declaration = `<?xml version="1.0" encoding="UTF-8"?>`;
  assert.equal(await withDescriptor(`${declaration}<container ${NS}>${body()}</container>`), "epub", "the control");
  // R20: XML `S` is four characters.
  assert.equal(await withDescriptor(`<?xml version="1.0"?><container ${NS}>${body()}</container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}"　">${body()}</container>`), "zip");
  // R19
  assert.equal(await withDescriptor(`<?xml version="2.0"?><container ${NS}>${body()}</container>`), "zip");
  assert.equal(await withDescriptor(`<?XML version="1.0"?><container ${NS}>${body()}</container>`), "zip");
  // R18
  assert.equal(await withDescriptor(`<!-- a -- b --><container ${NS}>${body()}</container>`), "zip");
  assert.equal(await withDescriptor(`<??><container ${NS}>${body()}</container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/ ></rootfiles></container>`), "zip");
  // R17
  assert.equal(await withDescriptor(`<container ${NS}>${body()}</container><extra/>`), "zip");
  assert.equal(await withDescriptor(`junk<container ${NS}>${body()}</container>`), "zip");
  // R16
  assert.equal(await withDescriptor(`<container xmlns="urn:not-ocf">${body()}</container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><wrapper>${body()}</wrapper></container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile nonsense full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}>${body()}${body()}</container>`), "zip");
  assert.equal(await withDescriptor(`<!DOCTYPE container><container ${NS}>${body()}</container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="&undeclared;" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
});

test("the Char scan is bounded and costs no memory", async () => {
  const padding = `<!--${" ".repeat(8 * 1024 * 1024)}-->`;
  const before = process.memoryUsage().rss;
  assert.equal(await withDescriptor(`${padding}<container ${NS}>${body()}</container>`), "zip");
  const growth = (process.memoryUsage().rss - before) / (1024 * 1024);
  assert.ok(growth < 64, `classification allocated ${growth.toFixed(1)}MB`);
});
