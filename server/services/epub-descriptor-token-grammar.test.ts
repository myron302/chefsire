/**
 * Four constructs the descriptor parser skipped to their terminator without checking they were well-formed --
 * three reported against head 020455b, one found by auditing for the same class of mistake.
 *
 * FINDING 1 (Greptile) -- A UTF-8 BOM IS NOT CHARACTER DATA. A conforming `container.xml` may begin with one:
 * it is an ENCODING SIGNATURE belonging to the byte layer, not something the grammar ever sees. Node's UTF-8
 * decode keeps it as U+FEFF, so R17's document-level text check met it before the root, found it was not
 * whitespace and refused the document. Reproduced on 020455b: a descriptor identical to an accepted one except
 * for three leading bytes classified `zip`.
 *
 * FINDING 2 (Codex) -- A PROCESSING INSTRUCTION IS NOT AN ARBITRARY RUN OF BYTES. Everything between `<?` and
 * `?>` was skipped without asking whether it was a processing instruction at all, so `<??>` and `<?1bad?>`
 * were silently ignored and the descriptor read as if they had not been there. Both classified `epub`.
 *
 * FINDING 3 (Codex) -- AN EMPTY ELEMENT CLOSES WITH A CONTIGUOUS `/>`. Whitespace was tolerated between the
 * slash and the bracket, so `<rootfile .../ >` was read as an empty element. It classified `epub`.
 *
 * FINDING 4, ADJACENT -- COMMENTS HAVE A GRAMMAR TOO. Found by auditing the neighbouring skip-to-terminator
 * code for the same mistake, not reported by either reviewer. `Comment ::= '<!--' ((Char - '-') | ('-' (Char -
 * '-')))* '-->'`, so `--` may not appear inside a comment and the content may not end with a single `-`.
 * `<!-- a -- b -->` and `<!-- a --->` both classified `epub` on 020455b.
 *
 * EVERY EXPECTATION BELOW WAS CHECKED AGAINST EXPAT FIRST, and its verdict is recorded beside the case. That
 * is how the BOM placement rules and the reserved-`xml`-target rule were settled rather than assumed.
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
/** The three bytes of a UTF-8 byte order mark, written as bytes because that is what they are. */
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const DECLARATION = `<?xml version="1.0" encoding="UTF-8"?>`;

const rootfile = `<rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
const BODY = `<rootfiles>${rootfile}</rootfiles>`;
const DOCUMENT = `<container ${NS}>${BODY}</container>`;

/** A book whose `META-INF/container.xml` is exactly these bytes -- no declaration is added. */
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

/* ------------------------------------------------------------------ finding 1: the byte order mark */

test("a descriptor beginning with a UTF-8 BOM is a book", async () => {
  // OBSERVED ON 020455b: `zip`, for both. expat accepts both when parsing the bytes.
  assert.equal(await withDescriptorBytes(Buffer.concat([BOM, Buffer.from(DECLARATION + DOCUMENT, "utf8")])), "epub");
  assert.equal(await withDescriptorBytes(Buffer.concat([BOM, Buffer.from(DOCUMENT, "utf8")])), "epub", "with no declaration");
  // The control: the identical descriptor without the three bytes, which was already accepted.
  assert.equal(await withDescriptor(DECLARATION + DOCUMENT), "epub");
});

test("U+FEFF is consumed only as a mark, and never as whitespace", async () => {
  // expat refuses every one of these. Exactly one mark, at offset zero, is an encoding signature; a second
  // one, or one anywhere else outside the root, is character data where the grammar permits none.
  assert.equal(await withDescriptorBytes(Buffer.concat([BOM, BOM, Buffer.from(DOCUMENT, "utf8")])), "zip", "two marks");
  assert.equal(
    await withDescriptorBytes(Buffer.concat([Buffer.from(DECLARATION, "utf8"), BOM, Buffer.from(DOCUMENT, "utf8")])),
    "zip", "after the declaration",
  );
  assert.equal(await withDescriptorBytes(Buffer.concat([Buffer.from(DOCUMENT, "utf8"), BOM])), "zip", "after the root");
  // Written as a character rather than as a mark, it is still not whitespace.
  assert.equal(await withDescriptor(`﻿﻿${DOCUMENT}`), "zip");
});

test("U+FEFF inside the document element is an ordinary character", async () => {
  // expat: VALID. Inside the root this is content, and content is not the parser's business here.
  assert.equal(await withDescriptor(`<container ${NS}>﻿${BODY}</container>`), "epub");
});

/* ------------------------------------------------------------------ finding 2: processing instructions */

test("a processing instruction with a valid target is skipped, and stays inert", async () => {
  // expat: VALID, all three. The contents are never interpreted -- only recognised and stepped over.
  assert.equal(await withDescriptor(`<?target data?>${DOCUMENT}`), "epub");
  assert.equal(await withDescriptor(`<?a?>${DOCUMENT}`), "epub", "a target with no data");
  assert.equal(await withDescriptor(`${DOCUMENT}<?target data?>`), "epub", "in the epilog");
  // A decoy inside a processing instruction is still text, as it was in R15.
  assert.equal(await withDescriptor(`<?decoy <rootfiles><rootfile full-path="OEBPS/fake.opf"/></rootfiles> ?><container ${NS}></container>`), "zip");
});

test("a processing instruction with no target or a non-Name target is malformed", async () => {
  // OBSERVED ON 020455b: `epub`, for the first two. expat refuses each at the target.
  assert.equal(await withDescriptor(`<??>${DOCUMENT}`), "zip", "no target");
  assert.equal(await withDescriptor(`<?1bad?>${DOCUMENT}`), "zip", "a target that is not a Name");
  assert.equal(await withDescriptor(`<?a/b?>${DOCUMENT}`), "zip", "a target with a slash in it");
  assert.equal(await withDescriptor(`<? a?>${DOCUMENT}`), "zip", "whitespace where the target belongs");
  // And inside the document element, where the same rule applies.
  assert.equal(await withDescriptor(`<container ${NS}><??>${BODY}</container>`), "zip");
});

test("the `xml` target is reserved everywhere except the declaration's own position", async () => {
  // `<?xml ...?>` at offset zero IS the XML declaration and every real descriptor carries one.
  assert.equal(await withDescriptor(DECLARATION + DOCUMENT), "epub");
  // Anywhere else the target is reserved, in any case. expat refuses all of these.
  assert.equal(await withDescriptor(`${DOCUMENT}<?xml junk?>`), "zip", "in the epilog");
  assert.equal(await withDescriptor(`${DOCUMENT}<?XML junk?>`), "zip", "upper case");
  assert.equal(await withDescriptor(`${DOCUMENT}<?xMl junk?>`), "zip", "mixed case");
  assert.equal(await withDescriptor(`<!-- c -->${DECLARATION}${DOCUMENT}`), "zip", "no longer at offset zero");
  assert.equal(await withDescriptor(` ${DECLARATION}${DOCUMENT}`), "zip", "preceded even by whitespace");
  // Only the exact name is reserved, so a target that merely starts with those letters is legal.
  assert.equal(await withDescriptor(`<?xml-stylesheet href="a"?>${DOCUMENT}`), "epub");
  assert.equal(await withDescriptor(`<?xmlns junk?>${DOCUMENT}`), "epub");
});

test("an unterminated processing instruction is still malformed", async () => {
  assert.equal(await withDescriptor(`<?target data${DOCUMENT}`), "zip");
});

/* ------------------------------------------------------------------ finding 3: the empty-element close */

test("an empty element closes with a contiguous `/>`", async () => {
  assert.equal(await withDescriptor(DOCUMENT), "epub");
  // Whitespace BEFORE the slash is legal -- `EmptyElemTag ::= '<' Name (S Attribute)* S? '/>'` -- and expat
  // accepts it, so it must keep working.
  const spaced = `<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}" /></rootfiles></container>`;
  assert.equal(await withDescriptor(spaced), "epub", "a space before the slash");
  const newline = `<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"\n  /></rootfiles></container>`;
  assert.equal(await withDescriptor(newline), "epub", "a newline before the slash");
});

test("whitespace between the slash and the bracket is malformed", async () => {
  // OBSERVED ON 020455b: `epub`. expat: "not well-formed (invalid token)".
  const split = `<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/ ></rootfiles></container>`;
  assert.equal(await withDescriptor(split), "zip");
  // On an ancestor too: the whole document is malformed, not just the tag that was being read.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles/ >${rootfile}</container>`), "zip");
});

test("other malformed slash placements fail closed", async () => {
  const bad: [string, string][] = [
    ["a doubled slash", `<rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"//>`],
    ["a leading slash", `<rootfile / full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`],
    ["a slash between attributes", `<rootfile full-path="${PACKAGE_PATH}" / media-type="${MEDIA_TYPE}"/>`],
  ];
  for (const [label, tag] of bad) {
    assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${tag}</rootfiles></container>`), "zip", label);
  }
  // An end tag may not carry one either.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${rootfile}</rootfiles/></container>`), "zip");
});

/* ------------------------------------------------------------------ finding 4, adjacent: comments */

test("a comment may not contain `--`, and may not end with `-`", async () => {
  // OBSERVED ON 020455b: `epub`, for both. expat refuses both. Found by auditing the neighbouring
  // skip-to-terminator code for the same mistake as the two findings above, not reported by a reviewer.
  assert.equal(await withDescriptor(`<!-- a -- b -->${DOCUMENT}`), "zip", "`--` inside");
  assert.equal(await withDescriptor(`<!-- a --->${DOCUMENT}`), "zip", "content ending in `-`");
  // Inside the document element, where the same rule applies.
  assert.equal(await withDescriptor(`<container ${NS}><!-- a -- b -->${BODY}</container>`), "zip");
});

test("well-formed comments keep working", async () => {
  // expat: VALID, all of these.
  assert.equal(await withDescriptor(`<!-- fine -->${DOCUMENT}`), "epub");
  assert.equal(await withDescriptor(`<!---->${DOCUMENT}`), "epub", "the empty comment");
  assert.equal(await withDescriptor(`<!-- a - b -->${DOCUMENT}`), "epub", "a single hyphen is fine");
  assert.equal(await withDescriptor(`${DOCUMENT}<!-- after -->`), "epub", "in the epilog");
  assert.equal(await withDescriptor(`<container ${NS}><!-- inside -->${BODY}</container>`), "epub");
  // And a commented decoy is still text, as it was in R15.
  assert.equal(await withDescriptor(`<container ${NS}><!-- ${BODY} --></container>`), "zip");
  // An unterminated comment is still malformed.
  assert.equal(await withDescriptor(`<!-- never closed ${DOCUMENT}`), "zip");
  assert.equal(await withDescriptor(`<!-->${DOCUMENT}`), "zip", "too short to be a comment");
});

/* ------------------------------------------------------------------ the four together, and what they must not break */

test("a BOM, a declaration, comments and processing instructions all at once", async () => {
  const descriptor = Buffer.concat([
    BOM,
    Buffer.from(`${DECLARATION}<!-- a note --><?target data?>${DOCUMENT}<?after it?><!-- and after -->`, "utf8"),
  ]);
  assert.equal(await withDescriptorBytes(descriptor), "epub");
});

test("one malformed construct spoils an otherwise conforming descriptor", async () => {
  const prefix = Buffer.concat([BOM, Buffer.from(DECLARATION, "utf8")]);
  assert.equal(await withDescriptorBytes(Buffer.concat([prefix, Buffer.from(`<??>${DOCUMENT}`, "utf8")])), "zip");
  assert.equal(await withDescriptorBytes(Buffer.concat([prefix, Buffer.from(`<!-- a -- b -->${DOCUMENT}`, "utf8")])), "zip");
  const split = `<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/ ></rootfiles></container>`;
  assert.equal(await withDescriptorBytes(Buffer.concat([prefix, Buffer.from(split, "utf8")])), "zip");
});

test("R16 and R17 rules all still hold", async () => {
  // Hierarchy, namespace, attributes (R16).
  assert.equal(await withDescriptor(`<something ${NS}>${BODY}</something>`), "zip", "wrong root");
  assert.equal(await withDescriptor(`<container ${NS}><wrapper>${BODY}</wrapper></container>`), "zip", "wrapper");
  assert.equal(await withDescriptor(`<container xmlns="urn:not-ocf">${BODY}</container>`), "zip", "wrong namespace");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile nonsense full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip", "bare token");
  assert.equal(await withDescriptor(`<container ${NS} ${NS}>${BODY}</container>`), "zip", "duplicate xmlns");
  assert.equal(await withDescriptor(`<!DOCTYPE container>${DOCUMENT}`), "zip", "DOCTYPE still refused");
  // One document element, and what may surround it (R17).
  assert.equal(await withDescriptor(`${DOCUMENT}<extra/>`), "zip", "second document element");
  assert.equal(await withDescriptor(`junk${DOCUMENT}`), "zip", "text before the root");
  assert.equal(await withDescriptor(`${DOCUMENT}junk`), "zip", "text after the root");
  assert.equal(await withDescriptor(`  ${DOCUMENT}  `), "epub", "whitespace around the root");
  // Supplementary Unicode names (R17).
  const supplementary = String.fromCodePoint(0x10400);
  const prefixed = `<p${supplementary}:container xmlns:p${supplementary}="${OCF}"><p${supplementary}:rootfiles>` +
    `<p${supplementary}:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></p${supplementary}:rootfiles></p${supplementary}:container>`;
  assert.equal(await withDescriptor(prefixed), "epub", "supplementary namespace prefix");
  // References (R16).
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="OEBPS&#47;content.opf" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "epub");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="&undeclared;" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
});

test("the bounds still hold, and a BOM does not cost anything", async () => {
  const padding = `<!--${" ".repeat(8 * 1024 * 1024)}-->`;
  const before = process.memoryUsage().rss;
  assert.equal(await withDescriptorBytes(Buffer.concat([BOM, Buffer.from(`${padding}${DOCUMENT}`, "utf8")])), "zip");
  const growth = (process.memoryUsage().rss - before) / (1024 * 1024);
  assert.ok(growth < 64, `classification allocated ${growth.toFixed(1)}MB`);
  assert.equal(await withDescriptor(`<container ${NS}>${"<a/>".repeat(5000)}${BODY}</container>`), "zip", "tokens");
});
