/**
 * XML's `S` is four characters. JavaScript's `\s` is far more, and the tokenizer had been using it.
 *
 * THE FINDING (R20, Codex and Greptile independently). The R19 declaration parser spelled XML's `S` production
 * as a JavaScript `\s`, which also matches NBSP, form feed, vertical tab, U+2028/U+2029, the Unicode space
 * separators and -- least comfortably, given R18 -- U+FEFF. Reproduced on head 84bdb54:
 *
 *   <?xml version="1.0"?>   -> epub
 *   <?xml\fversion="1.0"?>       -> epub
 *
 * Auditing the rest of the tokenizer for the same mistake found it in every other place the grammar requires
 * `S`, not only the declaration: the attribute-list separator and leading whitespace, the element-name
 * terminator, and the processing-instruction target scan. Six sites, six non-XML characters each, all `epub`
 * on 84bdb54 -- forty-two reproductions, and expat refuses every one of them in every position.
 *
 * `S ::= (#x20 | #x9 | #xD | #xA)+`, and that predicate now lives in one place that every site asks.
 *
 * ONE ADJACENT CONSEQUENCE, recorded honestly. Taking U+FEFF out of the whitespace set left it to be read as
 * something else, and by the letter of production [4] it IS a name character: `[#xFDF0-#xFFFD]` contains it.
 * expat disagrees -- it refuses U+FEFF in element names, attribute names and PI targets alike, while accepting
 * it as text and inside attribute values -- and this module follows expat: a zero-width character inside a name
 * is the render-one-way/compare-another ambiguity refused everywhere else here, and R18 established U+FEFF as
 * an encoding signature rather than content. No real descriptor is affected; it never matches an OCF name
 * either way, so the carve-out only decides whether such a document is malformed or merely not a container.
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
const PACKAGE_PATH = "OEBPS/content.opf";
const MEDIA_TYPE = "application/oebps-package+xml";
const ROOTFILE = `<rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
const BODY = `<rootfiles>${ROOTFILE}</rootfiles>`;

async function withDescriptor(xml: string): Promise<string> {
  const result = await validateUploadedMedia({
    source: {
      buffer: buildZip([
        MIMETYPE,
        { name: "META-INF/container.xml", data: Buffer.from(xml, "utf8"), deflate: true },
        { name: PACKAGE_PATH, data: Buffer.from("<package/>"), deflate: true },
      ]),
    },
    allow: ["document"], declaredMimeType: "application/epub+zip", originalName: "novel.epub",
  });
  return result.kind === "accepted" ? result.format : `rejected:${result.reason}`;
}

/** XML `S`, exactly: `S ::= (#x20 | #x9 | #xD | #xA)+`. expat accepts each of these in every position below. */
const XML_SPACE: [string, string][] = [["SPACE", " "], ["TAB", "\u0009"], ["CR", "\u000d"], ["LF", "\u000a"]];
/** Matched by JavaScript's `\s` and by nothing in XML. expat refuses each in every position below. */
const NOT_XML_SPACE: [string, string][] = [
  ["NBSP U+00A0", " "],
  ["FORM FEED U+000C", "\u000c"],
  ["VERTICAL TAB U+000B", "\u000b"],
  ["LINE SEPARATOR U+2028", " "],
  ["PARAGRAPH SEPARATOR U+2029", " "],
  ["EN QUAD U+2000", " "],
  ["NARROW NBSP U+202F", " "],
  ["IDEOGRAPHIC SPACE U+3000", "　"],
  ["U+FEFF", "﻿"],
];

/**
 * Every place the grammar requires `S`. Each builds an otherwise conforming descriptor with `space` standing
 * in for the whitespace at that position, so the only variable is the character itself.
 */
const POSITIONS: [string, (space: string) => string][] = [
  ["declaration: required S before `version`", (s) => `<?xml${s}version="1.0"?><container xmlns="${OCF}">${BODY}</container>`],
  ["declaration: S before `?>`", (s) => `<?xml version="1.0"${s}?><container xmlns="${OCF}">${BODY}</container>`],
  ["declaration: S on Eq's left", (s) => `<?xml version${s}="1.0"?><container xmlns="${OCF}">${BODY}</container>`],
  ["declaration: S on Eq's right", (s) => `<?xml version=${s}"1.0"?><container xmlns="${OCF}">${BODY}</container>`],
  ["declaration: S before `encoding`", (s) => `<?xml version="1.0"${s}encoding="UTF-8"?><container xmlns="${OCF}">${BODY}</container>`],
  ["declaration: S before `standalone`", (s) => `<?xml version="1.0"${s}standalone="yes"?><container xmlns="${OCF}">${BODY}</container>`],
  ["attribute list: S after the element name", (s) => `<container${s}xmlns="${OCF}">${BODY}</container>`],
  ["attribute list: S between attributes", (s) => `<container xmlns="${OCF}"${s}id="x">${BODY}</container>`],
  ["attribute list: S around an attribute's Eq", (s) => `<container xmlns${s}=${s}"${OCF}">${BODY}</container>`],
  ["empty element: S before `/>`", (s) => `<container xmlns="${OCF}"><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"${s}/></rootfiles></container>`],
  ["end tag: S before `>`", (s) => `<container xmlns="${OCF}">${BODY}</container${s}>`],
  ["processing instruction: S after the target", (s) => `<?target${s}data?><container xmlns="${OCF}">${BODY}</container>`],
];

/* ------------------------------------------------------------------ the two reported reproductions */

test("the reported declarations are refused", async () => {
  // Both classified `epub` on head 84bdb54.
  assert.equal(await withDescriptor(`<?xml version="1.0"?><container xmlns="${OCF}">${BODY}</container>`), "zip", "NBSP");
  assert.equal(await withDescriptor(`<?xml\u000cversion="1.0"?><container xmlns="${OCF}">${BODY}</container>`), "zip", "form feed");
});

/* ------------------------------------------------------------------ every S position, every character */

test("XML `S` is accepted wherever the grammar requires whitespace", async () => {
  for (const [label, build] of POSITIONS) {
    for (const [name, space] of XML_SPACE) {
      assert.equal(await withDescriptor(build(space)), "epub", `${label} :: ${name}`);
    }
  }
});

test("characters that are JavaScript whitespace but not XML `S` are refused everywhere", async () => {
  // THE REPRODUCTION MATRIX. Every cell here classified `epub` on head 84bdb54 for the six characters that
  // were reproduced then; the rest are the same defect and are pinned alongside them.
  for (const [label, build] of POSITIONS) {
    for (const [name, space] of NOT_XML_SPACE) {
      assert.equal(await withDescriptor(build(space)), "zip", `${label} :: ${name}`);
    }
  }
});

test("runs of XML `S` are still whitespace, and mixed runs are still a run", async () => {
  const mixed = " \u0009\u000d\u000a ";
  assert.equal(await withDescriptor(`<?xml${mixed}version="1.0"${mixed}encoding="UTF-8"${mixed}?><container xmlns="${OCF}">${BODY}</container>`), "epub");
  // But one bad character anywhere in the run spoils it.
  assert.equal(await withDescriptor(`<?xml   version="1.0"?><container xmlns="${OCF}">${BODY}</container>`), "zip");
  assert.equal(await withDescriptor(`<container xmlns="${OCF}" \u000b id="x">${BODY}</container>`), "zip");
});

test("whitespace outside the document element is still XML `S` only", async () => {
  // R17's rule, which already used the right definition -- re-pinned here so all the sites agree.
  const document = `<container xmlns="${OCF}">${BODY}</container>`;
  for (const [name, space] of XML_SPACE) {
    assert.equal(await withDescriptor(`${space}${document}${space}`), "epub", name);
  }
  for (const [name, space] of NOT_XML_SPACE) {
    // U+FEFF is skipped here on purpose: written at the very start it encodes to EF BB BF, which IS the byte
    // order mark R18 consumes, so it is not character data at that one position. It is pinned just below.
    if (space !== "\ufeff") {
      assert.equal(await withDescriptor(`${space}${document}`), "zip", `before the root :: ${name}`);
    }
    assert.equal(await withDescriptor(`${document}${space}`), "zip", `after the root :: ${name}`);
  }
  // The BOM interaction, stated rather than stepped around: one leading mark is an encoding signature and is
  // consumed (R18); a second is character data where the grammar permits only `S`, and U+FEFF is not `S`.
  assert.equal(await withDescriptor(`\ufeff${document}`), "epub", "a leading mark is the BOM, not whitespace");
  assert.equal(await withDescriptor(`\ufeff\ufeff${document}`), "zip", "a second one is neither");
});

/* ------------------------------------------------------------------ the adjacent consequence: U+FEFF in names */

test("U+FEFF is not a name character, though the literal range contains it", async () => {
  // Excluded to match expat, which refuses it in all three name positions while accepting it as text.
  assert.equal(isXmlName("﻿"), false, "alone");
  assert.equal(isXmlName("a﻿b"), false, "inside");
  assert.equal(isXmlName("a﻿"), false, "trailing");
  // Its neighbours in [#xFDF0-#xFFFD] are unaffected -- the carve-out is exactly one code point.
  assert.equal(isXmlName(String.fromCodePoint(0xfdf0)), true, "U+FDF0, the low end");
  assert.equal(isXmlName(String.fromCodePoint(0xfefe)), true, "U+FEFE, just below");
  assert.equal(isXmlName(String.fromCodePoint(0xff00)), true, "U+FF00, just above");
  assert.equal(isXmlName(String.fromCodePoint(0xfffd)), true, "U+FFFD, the high end");
  // And the R17 supplementary boundaries still hold.
  assert.equal(isXmlName(String.fromCodePoint(0x10400)), true);
  assert.equal(isXmlName(String.fromCodePoint(0xeffff)), true);
  assert.equal(isXmlName(String.fromCodePoint(0xf0000)), false);
});

test("U+FEFF is still an ordinary character where XML allows one", async () => {
  // expat accepts both of these. Inside content and inside an attribute value it is not a name and not
  // whitespace -- it is just a character, and nothing here changes that.
  assert.equal(await withDescriptor(`<container xmlns="${OCF}">﻿${BODY}</container>`), "epub", "as content");
  const valued = `<container xmlns="${OCF}"><rootfiles><rootfile note="a﻿b" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`;
  assert.equal(await withDescriptor(valued), "epub", "inside an attribute value");
  // And R18's BOM handling is untouched: one mark at offset zero is still an encoding signature.
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`<container xmlns="${OCF}">${BODY}</container>`, "utf8")]);
  const result = await validateUploadedMedia({
    source: {
      buffer: buildZip([
        MIMETYPE,
        { name: "META-INF/container.xml", data: bytes, deflate: true },
        { name: PACKAGE_PATH, data: Buffer.from("<package/>"), deflate: true },
      ]),
    },
    allow: ["document"], declaredMimeType: "application/epub+zip", originalName: "novel.epub",
  });
  assert.equal(result.kind === "accepted" ? result.format : "rejected", "epub", "R18 BOM still consumed");
});

/* ------------------------------------------------------------------ nothing earlier is disturbed */

test("real descriptors, and every earlier protection, are unchanged", async () => {
  const NS = `xmlns="${OCF}"`;
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="UTF-8"?><container ${NS}>${BODY}</container>`), "epub");
  assert.equal(await withDescriptor(`<?xml version="1.0"?>\n<container ${NS}>\n  ${BODY}\n</container>\n`), "epub", "formatted across lines");
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="UTF-8" standalone="no"?><container ${NS}>${BODY}</container>`), "epub");
  // R19
  assert.equal(await withDescriptor(`<?xml version="2.0"?><container ${NS}>${BODY}</container>`), "zip");
  assert.equal(await withDescriptor(`<?XML version="1.0"?><container ${NS}>${BODY}</container>`), "zip");
  // R18
  assert.equal(await withDescriptor(`<!-- a -- b --><container ${NS}>${BODY}</container>`), "zip");
  assert.equal(await withDescriptor(`<??><container ${NS}>${BODY}</container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/ ></rootfiles></container>`), "zip");
  // R17
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}</container><extra/>`), "zip");
  const supplementary = String.fromCodePoint(0x10400);
  assert.equal(
    await withDescriptor(`<p${supplementary}:container xmlns:p${supplementary}="${OCF}"><p${supplementary}:rootfiles>` +
      `<p${supplementary}:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></p${supplementary}:rootfiles></p${supplementary}:container>`),
    "epub", "R17 supplementary prefix",
  );
  // R16
  assert.equal(await withDescriptor(`<container xmlns="urn:not-ocf">${BODY}</container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><wrapper>${BODY}</wrapper></container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile nonsense full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
  assert.equal(await withDescriptor(`<!DOCTYPE container><container ${NS}>${BODY}</container>`), "zip");
});
