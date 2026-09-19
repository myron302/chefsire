/**
 * The XML declaration was exempted from validation rather than validated.
 *
 * THE FINDING (R19, Codex and Greptile independently). R18 taught the parser to validate ordinary
 * processing-instruction targets, and carved out `xml` at offset zero because that position is where the XML
 * declaration legitimately lives. It never asked whether what followed was a declaration. Reproduced on head
 * 5c436a3, each classifying `epub` with the named member present:
 *
 *   <?xml?>                  no version at all
 *   <?xml junk?>             not a declaration in any sense
 *   <?XML version="1.0"?>    the reserved target is case-insensitive; only lowercase `xml` is the declaration
 *   <?xml version="2.0"?>    not a VersionNum
 *
 * Verification found twelve more of the same defect -- a missing version, reordered fields, duplicates,
 * unknown fields, unquoted and mismatched quotes, and every malformed value tried.
 *
 *   XMLDecl      ::= '<?xml' VersionInfo EncodingDecl? SDDecl? S? '?>'
 *   VersionInfo  ::= S 'version' Eq ("'" VersionNum "'" | '"' VersionNum '"')
 *   VersionNum   ::= '1.' [0-9]+
 *   EncodingDecl ::= S 'encoding' Eq ('"' EncName '"' | "'" EncName "'")
 *   EncName      ::= [A-Za-z] ([A-Za-z0-9._] | '-')*
 *   SDDecl       ::= S 'standalone' Eq (("'" ('yes'|'no') "'") | ('"' ('yes'|'no') '"'))
 *
 * ONE DELIBERATE DIVERGENCE FROM EXPAT, in favour of the specification, recorded case by case below: expat
 * accepts `version="2.0"`, `""`, `"1."` and `"1.0.0"`, which production [26] admits none of. That is a known
 * leniency rather than a reading of the grammar -- libexpat carries an open change to reject exactly these --
 * and `version="2.0"` was one of the reported reproductions. Every other expectation here matches expat.
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
const PACKAGE_PATH = "OEBPS/content.opf";
const MEDIA_TYPE = "application/oebps-package+xml";
const DOCUMENT =
  `<container xmlns="${OCF}"><rootfiles>` +
  `<rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>` +
  `</rootfiles></container>`;

/** A book whose descriptor is `prologue` followed by an otherwise conforming container document. */
async function withPrologue(prologue: string): Promise<string> {
  const result = await validateUploadedMedia({
    source: {
      buffer: buildZip([
        MIMETYPE,
        { name: "META-INF/container.xml", data: Buffer.from(prologue + DOCUMENT, "utf8"), deflate: true },
        { name: PACKAGE_PATH, data: Buffer.from("<package/>"), deflate: true },
      ]),
    },
    allow: ["document"], declaredMimeType: "application/epub+zip", originalName: "novel.epub",
  });
  return result.kind === "accepted" ? result.format : `rejected:${result.reason}`;
}

/* ------------------------------------------------------------------ the four reported reproductions */

test("the reported malformed declarations are refused", async () => {
  // Every one of these classified `epub` on head 5c436a3.
  assert.equal(await withPrologue(`<?xml?>`), "zip", "no version -- expat: XML declaration not well-formed");
  assert.equal(await withPrologue(`<?xml junk?>`), "zip", "not a declaration -- expat: not well-formed");
  assert.equal(await withPrologue(`<?XML version="1.0"?>`), "zip", "reserved target -- expat: invalid token");
  assert.equal(await withPrologue(`<?xml version="2.0"?>`), "zip", "not a VersionNum: production [26] is `'1.' [0-9]+`");
});

/* ------------------------------------------------------------------ declarations real descriptors carry */

test("the declarations real EPUB descriptors carry are accepted", async () => {
  // expat: VALID, every one.
  assert.equal(await withPrologue(`<?xml version="1.0"?>`), "epub");
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="UTF-8"?>`), "epub", "the usual one");
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="utf-8"?>`), "epub", "encoding names are free-form here");
  assert.equal(await withPrologue(`<?xml version='1.0' encoding='utf-8'?>`), "epub", "single quotes");
  assert.equal(await withPrologue(`<?xml version="1.0" encoding='UTF-8'?>`), "epub", "mixed quoting between fields");
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`), "epub");
  assert.equal(await withPrologue(`<?xml version="1.0" standalone="no"?>`), "epub", "standalone without encoding");
  assert.equal(await withPrologue(`<?xml version="1.1"?>`), "epub", "`1.` followed by any digits is a VersionNum");
  assert.equal(await withPrologue(`<?xml version="1.10"?>`), "epub");
  assert.equal(await withPrologue(``), "epub", "a declaration is optional");
});

test("the whitespace the grammar permits inside a declaration keeps working", async () => {
  // `Eq ::= S? '=' S?`, and `XMLDecl` ends `S? '?>'`. expat: VALID, every one.
  assert.equal(await withPrologue(`<?xml version = "1.0"?>`), "epub", "space around Eq");
  assert.equal(await withPrologue(`<?xml version\t=\t"1.0"?>`), "epub", "tabs around Eq");
  assert.equal(await withPrologue(`<?xml version="1.0"   ?>`), "epub", "trailing S before `?>`");
  assert.equal(await withPrologue(`<?xml\nversion="1.0"\nencoding="UTF-8"\n?>`), "epub", "newlines throughout");
  assert.equal(await withPrologue(`<?xml  version="1.0"  encoding="UTF-8"  standalone="yes"  ?>`), "epub");
});

/* ------------------------------------------------------------------ malformed boundaries */

test("a declaration missing its required version is refused", async () => {
  assert.equal(await withPrologue(`<?xml encoding="UTF-8"?>`), "zip", "encoding only");
  assert.equal(await withPrologue(`<?xml standalone="yes"?>`), "zip", "standalone only");
  assert.equal(await withPrologue(`<?xml ?>`), "zip", "whitespace only");
  assert.equal(await withPrologue(`<?xmlversion="1.0"?>`), "zip", "no S, so the target is not `xml` either");
});

test("declaration fields must appear in the order the grammar fixes", async () => {
  assert.equal(await withPrologue(`<?xml encoding="UTF-8" version="1.0"?>`), "zip", "encoding before version");
  assert.equal(await withPrologue(`<?xml version="1.0" standalone="yes" encoding="UTF-8"?>`), "zip", "standalone before encoding");
});

test("duplicate and unknown declaration fields are refused", async () => {
  assert.equal(await withPrologue(`<?xml version="1.0" version="1.0"?>`), "zip", "duplicate version");
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="UTF-8" encoding="UTF-8"?>`), "zip", "duplicate encoding");
  assert.equal(await withPrologue(`<?xml version="1.0" standalone="yes" standalone="yes"?>`), "zip", "duplicate standalone");
  assert.equal(await withPrologue(`<?xml version="1.0" bogus="x"?>`), "zip", "unknown field");
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="UTF-8" bogus="x"?>`), "zip", "unknown field after encoding");
});

test("declaration values must match their productions", async () => {
  // VersionNum. The four expat is lenient about are marked; the specification admits none of them.
  assert.equal(await withPrologue(`<?xml version=""?>`), "zip", "empty (expat accepts; production [26] does not)");
  assert.equal(await withPrologue(`<?xml version="1."?>`), "zip", "no digits (expat accepts; production [26] does not)");
  assert.equal(await withPrologue(`<?xml version="1.0.0"?>`), "zip", "extra part (expat accepts; production [26] does not)");
  assert.equal(await withPrologue(`<?xml version="1,0"?>`), "zip", "comma");
  assert.equal(await withPrologue(`<?xml version=" 1.0"?>`), "zip", "leading space inside the value");
  // EncName ::= [A-Za-z] ([A-Za-z0-9._] | '-')*. expat agrees on all of these.
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="1bad"?>`), "zip", "must begin with a letter");
  assert.equal(await withPrologue(`<?xml version="1.0" encoding=""?>`), "zip", "empty");
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="UTF 8"?>`), "zip", "space is not an EncName char");
  // UPDATED IN R22, and this pair now says something sharper than it did. EncName SYNTAX still admits hyphens,
  // digits, `.` and `_` -- that is what these two names exercise -- but R22 added a second, separate question:
  // whether the declared encoding describes the bytes this validator actually decoded. Both of these names are
  // syntactically fine and neither is an encoding it can read, so both now fail closed. The syntax rule is
  // still pinned, by the cases above and by `utf-8`/`us-ascii` passing elsewhere in this file.
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="ISO-8859-1"?>`), "zip", "valid EncName, unsupported encoding");
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="x.y_z-1"?>`), "zip", "valid EncName, unsupported encoding");
  // SDDecl takes exactly `yes` or `no`.
  assert.equal(await withPrologue(`<?xml version="1.0" standalone="maybe"?>`), "zip");
  assert.equal(await withPrologue(`<?xml version="1.0" standalone="YES"?>`), "zip", "and is case-sensitive");
  assert.equal(await withPrologue(`<?xml version="1.0" standalone=""?>`), "zip");
});

test("declaration values must be quoted, in matching quotes", async () => {
  assert.equal(await withPrologue(`<?xml version=1.0?>`), "zip", "unquoted");
  assert.equal(await withPrologue(`<?xml version="1.0'?>`), "zip", "mismatched quotes");
  assert.equal(await withPrologue(`<?xml version'1.0'?>`), "zip", "no Eq");
  assert.equal(await withPrologue(`<?xml version "1.0"?>`), "zip", "no `=`");
});

test("only lowercase `xml` at offset zero is a declaration; the target stays reserved otherwise", async () => {
  // Case variants are never the declaration, and are reserved as PI targets wherever they appear.
  for (const spelling of ["XML", "Xml", "xMl", "xmL"]) {
    assert.equal(await withPrologue(`<?${spelling} version="1.0"?>`), "zip", spelling);
  }
  // A well-formed declaration anywhere other than offset zero is still a reserved target (R18, re-pinned).
  assert.equal(await withPrologue(`<!-- a --><?xml version="1.0"?>`), "zip", "after a comment");
  assert.equal(await withPrologue(` <?xml version="1.0"?>`), "zip", "after whitespace");
  assert.equal(await withPrologue(`<?xml version="1.0"?><?xml version="1.0"?>`), "zip", "a second one");
});

test("a malformed declaration is not re-read as an ordinary processing instruction", async () => {
  // It fails the document closed. It does not fall back to "some PI whose target happens to be `xml`", which
  // would itself be reserved, nor is it skipped as though it were not there.
  assert.equal(await withPrologue(`<?xml version="9.9"?>`), "zip");
  assert.equal(await withPrologue(`<?xml nonsense="x"?>`), "zip");
});

test("ordinary processing instructions are untouched by any of this", async () => {
  // Only the exact name `xml` is reserved, so these remain legal targets (R18, re-pinned).
  assert.equal(await withPrologue(`<?xml version="1.0"?><?xml-stylesheet href="a.css" type="text/css"?>`), "epub");
  assert.equal(await withPrologue(`<?xml-stylesheet href="a.css"?>`), "epub", "without a declaration");
  assert.equal(await withPrologue(`<?xmlns junk?>`), "epub");
  assert.equal(await withPrologue(`<?target data?>`), "epub");
  // And a malformed PI target is still malformed (R18, re-pinned).
  assert.equal(await withPrologue(`<?xml version="1.0"?><??>`), "zip");
  assert.equal(await withPrologue(`<?xml version="1.0"?><?1bad?>`), "zip");
});

test("the declaration is still inert, and nothing in it is resolved", async () => {
  // Nothing in the declaration is fetched, expanded or interpreted, and a DOCTYPE is still refused outright.
  // UPDATED IN R22: an `encoding` naming something exotic used to change no behaviour at all, which was the
  // defect -- the declaration was read and then ignored. It is still never ACTED on (no transcoder is invoked,
  // nothing is fetched), but it is now CHECKED: a declaration this validator cannot honour fails the document
  // closed rather than being read as UTF-8 while the document says otherwise.
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="EBCDIC-CP-US"?>`), "zip", "checked, not acted on");
  assert.equal(await withPrologue(`<?xml version="1.0" encoding="UTF-8"?>`), "epub", "the one it can honour");
  assert.equal(await withPrologue(`<?xml version="1.0"?><!DOCTYPE container>`), "zip", "DOCTYPE still refused");
});

test("R16, R17 and R18 protections all still hold", async () => {
  const declaration = `<?xml version="1.0" encoding="UTF-8"?>`;
  const NS = `xmlns="${OCF}"`;
  const body = `<rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles>`;
  const full = async (xml: string) => {
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
  };
  assert.equal(await full(`${declaration}<container ${NS}>${body}</container>`), "epub", "the control");
  assert.equal(await full(`${declaration}<container xmlns="urn:not-ocf">${body}</container>`), "zip", "R16 namespace");
  assert.equal(await full(`${declaration}<container ${NS}><wrapper>${body}</wrapper></container>`), "zip", "R16 hierarchy");
  assert.equal(await full(`${declaration}<container ${NS}><rootfiles><rootfile nonsense full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip", "R16 attributes");
  assert.equal(await full(`${declaration}<container ${NS}>${body}</container><extra/>`), "zip", "R17 one document element");
  assert.equal(await full(`${declaration}<container ${NS}>${body}</container>junk`), "zip", "R17 text outside the root");
  assert.equal(await full(`${declaration}<!-- a -- b --><container ${NS}>${body}</container>`), "zip", "R18 comment grammar");
  assert.equal(await full(`${declaration}<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/ ></rootfiles></container>`), "zip", "R18 empty-element close");
  // R18's BOM handling, with a conforming declaration behind it.
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const bytes = Buffer.concat([bom, Buffer.from(`${declaration}<container ${NS}>${body}</container>`, "utf8")]);
  const withBom = await validateUploadedMedia({
    source: {
      buffer: buildZip([
        MIMETYPE,
        { name: "META-INF/container.xml", data: bytes, deflate: true },
        { name: PACKAGE_PATH, data: Buffer.from("<package/>"), deflate: true },
      ]),
    },
    allow: ["document"], declaredMimeType: "application/epub+zip", originalName: "novel.epub",
  });
  assert.equal(withBom.kind === "accepted" ? withBom.format : "rejected", "epub", "R18 BOM, declaration still at offset zero after it");
});
