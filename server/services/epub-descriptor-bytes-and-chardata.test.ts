/**
 * Two layers that were not being enforced: bytes -> supported encoding, and decoded text -> lexical grammar.
 *
 * FINDING 1 (R22, Codex) -- MALFORMED UTF-8 WAS SILENTLY REPAIRED. Descriptor decoding used
 * `Buffer.toString("utf8")`, which substitutes U+FFFD for a malformed sequence rather than failing. Reproduced
 * on head 4a0ad9c: a `container.xml` carrying a raw 0xFF inside comment content classified `epub`, although
 * those bytes are not UTF-8 and expat refuses the document. The same held for a truncated multibyte sequence,
 * and for malformed bytes in character data and in an attribute value.
 *
 * Decoding is now fatal -- the same decision R15 already made for ZIP member names, for the same reason: a
 * replacement character silently turns distinct byte sequences into one string, and this module matches text
 * for a living.
 *
 * AND THE DECLARATION MUST AGREE WITH THE BYTES. EPUB requires every XML document in the container to be UTF-8
 * or UTF-16, UTF-8 recommended; this validator decodes UTF-8 and is deliberately not a transcoder. So `utf-8`
 * is honoured, `us-ascii` is honoured only while every character really is ASCII, an absent declaration means
 * UTF-8 by XML's own default, and everything else -- `UTF-16` included, which EPUB permits but this cannot
 * read -- fails closed to an inert generic `zip` rather than being read as UTF-8 anyway while the document
 * says otherwise.
 *
 * FINDING 2 (R22, Codex) -- `]]>` WAS ACCEPTED IN ORDINARY CHARACTER DATA. Reproduced on head 4a0ad9c:
 * `bad]]>` inside the document element classified `epub`, and expat refuses it.
 *
 *   CharData ::= [^<&]* - ([^<&]* ']]>' [^<&]*)
 *
 * The SEQUENCE is what is forbidden, and only in character data. `]`, `>` and `]]` stay ordinary characters; a
 * real `<![CDATA[ ... ]]>` is untouched; and in attribute values, comments and processing-instruction content
 * the grammar permits the sequence -- each confirmed against expat before it was written down here.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";
import { validateUploadedMedia } from "./media-validation";

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
const ROOTFILE = `<rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
const BODY = `<rootfiles>${ROOTFILE}</rootfiles>`;
const DOCUMENT = `<container ${NS}>${BODY}</container>`;
/** The three bytes of a UTF-8 byte order mark, written as bytes because that is what they are (R18). */
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** Assemble a descriptor from a mixture of text and raw bytes -- the point of most of these fixtures. */
const bytes = (...parts: (Buffer | string)[]) =>
  Buffer.concat(parts.map((part) => (typeof part === "string" ? Buffer.from(part, "utf8") : part)));

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
const withDescriptor = (xml: string) => withDescriptorBytes(bytes(xml));

/* ------------------------------------------------------------------ finding 1a: the bytes must be UTF-8 */

test("valid UTF-8 is accepted, with and without a byte order mark", async () => {
  assert.equal(await withDescriptorBytes(bytes(DOCUMENT)), "epub", "no BOM");
  assert.equal(await withDescriptorBytes(bytes(BOM, DOCUMENT)), "epub", "with BOM (R18, unchanged)");
  assert.equal(await withDescriptorBytes(bytes(`<container ${NS}><!-- café 书 -->${BODY}</container>`)), "epub", "multibyte");
  assert.equal(await withDescriptorBytes(bytes(BOM, `<?xml version="1.0" encoding="UTF-8"?>${DOCUMENT}`)), "epub", "BOM, declaration, multibyte-free");
});

test("malformed UTF-8 fails closed instead of being repaired", async () => {
  const malformed: [string, Buffer][] = [
    ["a lone 0xFF", Buffer.from([0xff])],
    ["a lone 0xFE", Buffer.from([0xfe])],
    ["a truncated two-byte sequence", Buffer.from([0xc3])],
    ["a truncated three-byte sequence", Buffer.from([0xe2, 0x82])],
    ["a truncated four-byte sequence", Buffer.from([0xf0, 0x9f])],
    ["a continuation byte with no lead", Buffer.from([0x80])],
    ["an overlong encoding of '/'", Buffer.from([0xc0, 0xaf])],
    ["a surrogate encoded as UTF-8", Buffer.from([0xed, 0xa0, 0x80])],
    ["a code point past U+10FFFF", Buffer.from([0xf5, 0x80, 0x80, 0x80])],
  ];
  // THE REPORTED CASE FIRST: inside comment content, which the parser otherwise steps over. It classified
  // `epub` on head 4a0ad9c precisely because the bytes were repaired before anything looked at them.
  for (const [label, bad] of malformed) {
    assert.equal(await withDescriptorBytes(bytes(`<container ${NS}><!-- `, bad, ` -->${BODY}</container>`)), "zip", `comment :: ${label}`);
  }
  // And everywhere else malformed bytes can sit.
  const first = malformed[0]![1];
  assert.equal(await withDescriptorBytes(bytes(`<container ${NS}>`, first, `${BODY}</container>`)), "zip", "character data");
  assert.equal(
    await withDescriptorBytes(bytes(`<container ${NS}><rootfiles><rootfile note="`, first, `" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`)),
    "zip", "attribute value",
  );
  assert.equal(await withDescriptorBytes(bytes(`<container ${NS}><![CDATA[`, first, `]]>${BODY}</container>`)), "zip", "CDATA content");
  assert.equal(await withDescriptorBytes(bytes(`<container ${NS}><?t `, first, `?>${BODY}</container>`)), "zip", "PI content");
  assert.equal(await withDescriptorBytes(bytes(BOM, `<container ${NS}><!-- `, first, ` -->${BODY}</container>`)), "zip", "behind a BOM");
});

/* ------------------------------------------------------------------ finding 1b: the declaration must agree */

test("an encoding declaration this validator can honour is accepted", async () => {
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="UTF-8"?>${DOCUMENT}`), "epub");
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="utf-8"?>${DOCUMENT}`), "epub", "case-insensitive");
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="UtF-8"?>${DOCUMENT}`), "epub", "mixed case");
  assert.equal(await withDescriptor(`<?xml version="1.0"?>${DOCUMENT}`), "epub", "absent: UTF-8 by XML's default");
  assert.equal(await withDescriptor(DOCUMENT), "epub", "no declaration at all");
  assert.equal(await withDescriptorBytes(bytes(BOM, `<?xml version="1.0" encoding="UTF-8"?>${DOCUMENT}`)), "epub", "with a BOM in front");
});

test("US-ASCII is honoured only while the document really is ASCII", async () => {
  // A strict subset of UTF-8, so the declaration agrees with the bytes -- as long as it is true.
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="US-ASCII"?>${DOCUMENT}`), "epub", "and it is");
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="us-ascii"?>${DOCUMENT}`), "epub", "case-insensitive");
  // A non-ASCII character under that declaration is a contradiction, wherever it sits.
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="US-ASCII"?><container ${NS}><!-- café -->${BODY}</container>`), "zip", "in a comment");
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="US-ASCII"?><container ${NS}>é${BODY}</container>`), "zip", "in character data");
  assert.equal(
    await withDescriptor(`<?xml version="1.0" encoding="US-ASCII"?><container ${NS}><rootfiles><rootfile note="café" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`),
    "zip", "in an attribute value",
  );
});

test("an encoding this validator cannot read fails closed", async () => {
  // Not a transcoder, and deliberately so. Each of these degrades to an inert generic `zip` rather than being
  // read as UTF-8 while the document says it is something else.
  for (const encoding of ["ISO-8859-1", "iso-8859-1", "windows-1252", "EBCDIC-CP-US", "Shift_JIS", "UTF-32"]) {
    assert.equal(await withDescriptor(`<?xml version="1.0" encoding="${encoding}"?>${DOCUMENT}`), "zip", encoding);
  }
  // UTF-16 is permitted by EPUB but is not something this validator decodes, so it fails closed too. That is
  // a stated limitation rather than a claim that the document is malformed.
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="UTF-16"?>${DOCUMENT}`), "zip", "UTF-16");
  assert.equal(await withDescriptor(`<?xml version="1.0" encoding="utf-16le"?>${DOCUMENT}`), "zip", "UTF-16LE");
});

/* ------------------------------------------------------------------ finding 2: `]]>` in character data */

test("`]]>` in ordinary character data is refused", async () => {
  // OBSERVED ON 4a0ad9c: `epub`. expat: not well-formed.
  assert.equal(await withDescriptor(`<container ${NS}>bad]]>${BODY}</container>`), "zip", "the reported case");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>bad]]>${ROOTFILE}</rootfiles></container>`), "zip", "nested");
  assert.equal(await withDescriptor(`<container ${NS}>${BODY}]]></container>`), "zip", "after the child");
  assert.equal(await withDescriptor(`<container ${NS}>]]>${BODY}</container>`), "zip", "alone");
});

test("`]`, `>` and `]]` are ordinary characters and stay legal", async () => {
  // The SEQUENCE is forbidden, not the characters. expat accepts every one of these.
  assert.equal(await withDescriptor(`<container ${NS}>a]]b${BODY}</container>`), "epub", "`]]` not followed by `>`");
  assert.equal(await withDescriptor(`<container ${NS}>a]b>c${BODY}</container>`), "epub", "`]` and `>` apart");
  assert.equal(await withDescriptor(`<container ${NS}>a]]${BODY}</container>`), "epub", "`]]` before a tag");
  assert.equal(await withDescriptor(`<container ${NS}>]${BODY}]${BODY.slice(0, 0)}</container>`), "epub", "bare brackets");
  assert.equal(await withDescriptor(`<container ${NS}>a>b${BODY}</container>`), "epub", "a bare `>`");
});

test("a real CDATA section still ends with `]]>`, and is untouched", async () => {
  assert.equal(await withDescriptor(`<container ${NS}><![CDATA[anything at all]]>${BODY}</container>`), "epub");
  // The canonical way to write a literal `]]>` inside CDATA: split it across two sections.
  assert.equal(await withDescriptor(`<container ${NS}><![CDATA[a]]]]><![CDATA[>b]]>${BODY}</container>`), "epub");
  // A decoy inside CDATA is still text, as it was in R15.
  assert.equal(await withDescriptor(`<container ${NS}><![CDATA[${BODY}]]></container>`), "zip");
  // CDATA outside the document element is still refused, as it was in R18.
  assert.equal(await withDescriptor(`<![CDATA[x]]>${DOCUMENT}`), "zip");
});

test("the sequence stays legal where the grammar permits it", async () => {
  // Checked against expat first: `CharData` is the only production that excludes it.
  assert.equal(
    await withDescriptor(`<container ${NS}><rootfiles><rootfile note="a]]>b" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`),
    "epub", "attribute value",
  );
  assert.equal(await withDescriptor(`<container ${NS}><!-- a]]>b -->${BODY}</container>`), "epub", "comment");
  assert.equal(await withDescriptor(`<container ${NS}><?t a]]>b?>${BODY}</container>`), "epub", "processing-instruction content");
});

/* ------------------------------------------------------------------ the two layers, and what they must not break */

test("the byte layer and the grammar layer stay separate", async () => {
  // Bytes that are not UTF-8 never reach the grammar at all...
  assert.equal(await withDescriptorBytes(bytes(`<container ${NS}>bad]]>`, Buffer.from([0xff]), `${BODY}</container>`)), "zip");
  // ...and a document that decodes cleanly can still be refused by the grammar.
  assert.equal(await withDescriptor(`<container ${NS}>bad]]>${BODY}</container>`), "zip");
  // A declaration cannot talk the byte layer into a different reading.
  assert.equal(await withDescriptorBytes(bytes(`<?xml version="1.0" encoding="ISO-8859-1"?>`, Buffer.from([0xff]), DOCUMENT)), "zip");
});

test("every earlier protection still holds", async () => {
  const declaration = `<?xml version="1.0" encoding="UTF-8"?>`;
  assert.equal(await withDescriptor(`${declaration}${DOCUMENT}`), "epub", "the control");
  // R21
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile note="\u000c" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip", "literal non-Char");
  assert.equal(
    await withDescriptor(`<p﻿:container xmlns:p﻿="${OCF}"><p﻿:rootfiles><p﻿:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></p﻿:rootfiles></p﻿:container>`),
    "epub", "U+FEFF is a NameChar",
  );
  // R20
  assert.equal(await withDescriptor(`<?xml version="1.0"?>${DOCUMENT}`), "zip", "NBSP is not `S`");
  // R19
  assert.equal(await withDescriptor(`<?xml version="2.0"?>${DOCUMENT}`), "zip");
  // R18
  assert.equal(await withDescriptor(`<!-- a -- b -->${DOCUMENT}`), "zip");
  assert.equal(await withDescriptor(`<??>${DOCUMENT}`), "zip");
  // R17
  assert.equal(await withDescriptor(`${DOCUMENT}<extra/>`), "zip");
  // R16
  assert.equal(await withDescriptor(`<container xmlns="urn:not-ocf">${BODY}</container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile nonsense full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
  assert.equal(await withDescriptor(`<!DOCTYPE container>${DOCUMENT}`), "zip");
});

test("both new checks stay bounded and cost no memory", async () => {
  const padding = `<!--${" ".repeat(8 * 1024 * 1024)}-->`;
  const before = process.memoryUsage().rss;
  assert.equal(await withDescriptor(`${padding}${DOCUMENT}`), "zip");
  const growth = (process.memoryUsage().rss - before) / (1024 * 1024);
  assert.ok(growth < 64, `classification allocated ${growth.toFixed(1)}MB`);
});
