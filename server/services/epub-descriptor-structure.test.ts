/**
 * Three ways the EPUB container descriptor was read as something it is not.
 *
 * R15 taught the descriptor scanner to tell markup from text. It still decided what an element WAS from its
 * local name alone, wherever in the document that name happened to appear -- so three separate reviewers found
 * three faces of one defect. All three were reproduced on head 91d32bb, each with the named member present in
 * the archive, and each classified `epub` and would have been published as `.epub` with `application/epub+zip`:
 *
 * FINDING 1 -- HIERARCHY WAS NEVER REQUIRED. `rootfiles` was found anywhere and `rootfile` at any depth below:
 *
 *   <something><rootfiles><rootfile .../></rootfiles></something>           rootfiles outside any container
 *   <container><wrapper><rootfiles>...</rootfiles></wrapper></container>    a wrapper in between
 *   <container><rootfiles><wrapper><rootfile .../></wrapper></rootfiles>    a wrapper in between, lower down
 *   <html><body><rootfiles>...</rootfiles></body></html>                    an unrelated document entirely
 *   <root><container/><other><rootfiles>...</rootfiles></other></root>      two trees, one supplying each piece
 *
 * FINDING 2 -- A PREFIX IS NOT A NAMESPACE. Prefixes were stripped and local names compared, so identity came
 * from spelling rather than from what the element is:
 *
 *   <evil:document xmlns:evil="urn:not-ocf"><evil:rootfiles><evil:rootfile .../></...></evil:document>
 *
 * -- a document containing no OCF element at all. Elements in NO namespace, under a wrong default namespace,
 * and on an entirely undeclared prefix were accepted the same way.
 *
 * FINDING 3 -- THE ATTRIBUTE LIST WAS NEVER PARSED. Two attributes were pulled out of the raw tag text with a
 * regular expression and the rest was never looked at:
 *
 *   <rootfile nonsense full-path="..." media-type="..."/>        a bare token, which XML has no such thing as
 *   <rootfile full-path="..." media-type="..." %%$$ />           trailing garbage
 *   <rootfile a:b:c="x" full-path="..." media-type="..."/>       a name that is not a QName
 *   <rootfile full-path="A" full-path="A" media-type="..."/>     a duplicate, never well-formed
 *
 * The duplicates are the sharpest of these. A duplicate whose values DIFFERED appeared to be handled on
 * 91d32bb, but only by accident: the regular expression took the first match, so the document showed one value
 * to this validator and, to any reader that took the last, another. Written with both values the same, the
 * archive classified `epub` -- which is how it was proved that duplicates were never rejected at all.
 *
 * What OCF actually fixes is the structure: `container.xml` "uses the
 * `urn:oasis:names:tc:opendocument:xmlns:container` namespace for all of its elements and attributes",
 * `rootfiles` is the REQUIRED first child of `container`, it contains one or more `rootfile` elements, and an
 * OCF Processor must consider the first of those to be the Default Rendition. So ancestry, namespace URI and a
 * complete attribute list are what is required here -- not the presence of a familiar name somewhere in a file.
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
    // What a real archiver does: set bit 11 exactly when the name is not plain ASCII.
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
/** The one URI OCF fixes for every element of this descriptor, unchanged from OCF 2.0.1 through EPUB 3.3. */
const OCF = "urn:oasis:names:tc:opendocument:xmlns:container";
const NS = `xmlns="${OCF}"`;
const PACKAGE_PATH = "OEBPS/content.opf";
const DECOY_PATH = "OEBPS/fake.opf";
const MEDIA_TYPE = "application/oebps-package+xml";

const rootfile = (path = PACKAGE_PATH) => `<rootfile full-path="${path}" media-type="${MEDIA_TYPE}"/>`;
const container = (xml: string): Entry => ({ name: "META-INF/container.xml", data: Buffer.from(xml, "utf8"), deflate: true });
const packageDocument = (path = PACKAGE_PATH): Entry => ({ name: path, data: Buffer.from("<package/>"), deflate: true });

async function classify(entries: Entry[]): Promise<string> {
  const result = await validateUploadedMedia({
    source: { buffer: buildZip(entries) }, allow: ["document"],
    declaredMimeType: "application/epub+zip", originalName: "novel.epub",
  });
  return result.kind === "accepted" ? result.format : `rejected:${result.reason}`;
}

/** A book whose descriptor is `xml`, carrying the real package document and, optionally, a decoy's target. */
const withDescriptor = (xml: string, extra: Entry[] = []) =>
  classify([MIMETYPE, container(`<?xml version="1.0" encoding="UTF-8"?>${xml}`), packageDocument(), ...extra]);

/** Both arms of a decoy fixture: with the decoy's target absent, and with it present. Neither may be `epub`. */
async function neverEpub(xml: string, decoyPath = DECOY_PATH): Promise<void> {
  assert.equal(await withDescriptor(xml), "zip", "with the decoy's target absent");
  assert.equal(await withDescriptor(xml, [packageDocument(decoyPath)]), "zip", "with the decoy's target present");
}

/* ------------------------------------------------------------------ finding 1: the required OCF hierarchy */

test("the canonical container hierarchy is a book", async () => {
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${rootfile()}</rootfiles></container>`), "epub");
});

test("rootfiles outside any container declares nothing", async () => {
  // OBSERVED ON 91d32bb: `epub`. There is no `container` element in this document at all.
  await neverEpub(`<something ${NS}><rootfiles>${rootfile(DECOY_PATH)}</rootfiles></something>`);
});

test("a wrapper between container and rootfiles breaks the required relationship", async () => {
  // OBSERVED ON 91d32bb: `epub`. OCF makes `rootfiles` a CHILD of `container`, not a descendant of it.
  await neverEpub(`<container ${NS}><wrapper><rootfiles>${rootfile(DECOY_PATH)}</rootfiles></wrapper></container>`);
});

test("a wrapper between rootfiles and rootfile breaks the required relationship", async () => {
  // OBSERVED ON 91d32bb: `epub`. A `rootfile` is a child of `rootfiles`, not something nested beneath it.
  await neverEpub(`<container ${NS}><rootfiles><wrapper>${rootfile(DECOY_PATH)}</wrapper></rootfiles></container>`);
});

test("a standalone rootfile with no rootfiles around it declares nothing", async () => {
  await neverEpub(`<container ${NS}>${rootfile(DECOY_PATH)}</container>`);
});

test("an unrelated root element cannot host the hierarchy", async () => {
  // OBSERVED ON 91d32bb: `epub`. The document element must be `container`; this one is an HTML document.
  await neverEpub(`<html ${NS}><body><rootfiles>${rootfile(DECOY_PATH)}</rootfiles></body></html>`);
});

test("two unrelated trees cannot each supply a piece of the hierarchy", async () => {
  // OBSERVED ON 91d32bb: `epub`. One tree held an empty `container`, another held the `rootfiles`. Neither is
  // a declaration; together they were read as one because only names were being looked for.
  await neverEpub(`<root ${NS}><container></container><other><rootfiles>${rootfile(DECOY_PATH)}</rootfiles></other></root>`);
});

test("deep nesting of the right local names is still not the hierarchy", async () => {
  // OBSERVED ON 91d32bb: `epub`.
  await neverEpub(`<container ${NS}><a><b><c><rootfiles><d>${rootfile(DECOY_PATH)}</d></rootfiles></c></b></a></container>`);
});

test("a container whose rootfiles is a sibling rather than a child declares nothing", async () => {
  await neverEpub(`<root ${NS}><container/><rootfiles>${rootfile(DECOY_PATH)}</rootfiles></root>`);
});

test("an empty container and an empty rootfiles both declare nothing", async () => {
  assert.equal(await withDescriptor(`<container ${NS}/>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles/></container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles></rootfiles></container>`), "zip");
});

test("two rootfiles children fail closed rather than one being chosen", async () => {
  // Two of them leave two readers free to pick different renditions, which is the ambiguity this module
  // refuses everywhere else. Note BOTH name the real package document, so this is a rejection, not a miss.
  const xml = `<container ${NS}><rootfiles>${rootfile()}</rootfiles><rootfiles>${rootfile()}</rootfiles></container>`;
  assert.equal(await withDescriptor(xml), "zip");
});

test("the FIRST rootfile is the Default Rendition, and it decides alone", async () => {
  // OCF: an OCF Processor must consider the first `rootfile` within `rootfiles` to be the Default Rendition.
  // So a first entry naming a member that is not here fails closed -- it does not fall through to the second.
  const firstMissing = `<container ${NS}><rootfiles><rootfile full-path="OEBPS/missing.opf" media-type="${MEDIA_TYPE}"/>${rootfile()}</rootfiles></container>`;
  assert.equal(await withDescriptor(firstMissing), "zip");
  // And when the first one is the real one, a second entry changes nothing.
  const firstReal = `<container ${NS}><rootfiles>${rootfile()}<rootfile full-path="OEBPS/missing.opf" media-type="${MEDIA_TYPE}"/></rootfiles></container>`;
  assert.equal(await withDescriptor(firstReal), "epub");
});

test("rootfiles need not be the first child, but must be a child", async () => {
  // OCF names `rootfiles` the required first child. A conforming sibling ahead of it creates no ambiguity, so
  // it degrades nothing to accept that; what is refused is `rootfiles` that is not a child at all.
  assert.equal(await withDescriptor(`<container ${NS}><links/><rootfiles>${rootfile()}</rootfiles></container>`), "epub");
});

/* ------------------------------------------------------------------ finding 2: the OCF namespace decides identity */

test("a prefix bound to a non-OCF namespace is not an OCF element", async () => {
  // OBSERVED ON 91d32bb: `epub`, from a document with no OCF element anywhere in it.
  await neverEpub(
    `<evil:document xmlns:evil="urn:not-ocf"><evil:rootfiles><evil:rootfile full-path="${DECOY_PATH}" media-type="${MEDIA_TYPE}"/></evil:rootfiles></evil:document>`,
  );
});

test("the right local names in no namespace at all are not OCF elements", async () => {
  // OBSERVED ON 91d32bb: `epub`. OCF requires the namespace for all of the descriptor's elements.
  await neverEpub(`<container><rootfiles><rootfile full-path="${DECOY_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`);
});

test("a wrong default namespace is not the OCF namespace", async () => {
  // OBSERVED ON 91d32bb: `epub`.
  await neverEpub(`<container xmlns="urn:not-ocf"><rootfiles><rootfile full-path="${DECOY_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`);
});

test("an undeclared prefix is a namespace error, not a bare name", async () => {
  // OBSERVED ON 91d32bb: `epub`. Nothing binds `zz`, so `zz:rootfile` names no element at all.
  await neverEpub(`<zz:container><zz:rootfiles><zz:rootfile full-path="${DECOY_PATH}" media-type="${MEDIA_TYPE}"/></zz:rootfiles></zz:container>`);
});

test("a nonstandard prefix bound to the OCF namespace IS an OCF element", async () => {
  // The converse of the finding, and the reason identity is the URI rather than the spelling. XML says these
  // two documents are the same document; so does this module.
  assert.equal(
    await withDescriptor(`<q:container xmlns:q="${OCF}"><q:rootfiles><q:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></q:rootfiles></q:container>`),
    "epub",
  );
  // Including a prefix chosen to look hostile. The URI is what it is bound to.
  assert.equal(
    await withDescriptor(`<evil:container xmlns:evil="${OCF}"><evil:rootfiles><evil:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></evil:rootfiles></evil:container>`),
    "epub",
  );
});

test("a namespace declared on an ancestor is inherited", async () => {
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "epub");
  // And a prefix declared on the root reaches a descendant that uses it.
  assert.equal(
    await withDescriptor(`<q:container xmlns:q="${OCF}"><q:rootfiles><q:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></q:rootfiles></q:container>`),
    "epub",
  );
});

test("a default namespace rebound below the root stops being OCF there", async () => {
  // OBSERVED ON 91d32bb: `epub`. The `rootfiles` here is `{urn:not-ocf}rootfiles`, a different element.
  await neverEpub(`<container ${NS}><rootfiles xmlns="urn:not-ocf">${rootfile(DECOY_PATH)}</rootfiles></container>`);
  // The same one level lower.
  await neverEpub(`<container ${NS}><rootfiles><rootfile xmlns="urn:not-ocf" full-path="${DECOY_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`);
});

test("a prefix shadowed to a wrong URI stops being OCF where it is shadowed", async () => {
  // OBSERVED ON 91d32bb: `epub`. `q` is rebound on `rootfiles`, so `q:rootfile` beneath it is not OCF.
  await neverEpub(
    `<q:container xmlns:q="${OCF}"><q:rootfiles xmlns:q="urn:not-ocf"><q:rootfile full-path="${DECOY_PATH}" media-type="${MEDIA_TYPE}"/></q:rootfiles></q:container>`,
  );
});

test("a namespace declaration written inside a comment or CDATA is not a declaration", async () => {
  // OBSERVED ON 91d32bb: `epub` -- though only because namespaces were not read at all. It must stay `zip`
  // for the R16 reason too: a comment declares nothing, so these elements are in no namespace.
  await neverEpub(`<container><!-- ${NS} --><rootfiles>${rootfile(DECOY_PATH)}</rootfiles></container>`);
  await neverEpub(`<container><![CDATA[ ${NS} ]]><rootfiles>${rootfile(DECOY_PATH)}</rootfiles></container>`);
});

test("reserved namespace declarations are refused", async () => {
  const body = `<rootfiles>${rootfile()}</rootfiles>`;
  // The `xmlns` namespace may never be bound, by either form.
  assert.equal(await withDescriptor(`<container ${NS} xmlns:bad="http://www.w3.org/2000/xmlns/">${body}</container>`), "zip");
  // The `xmlns` prefix may not be declared at all.
  assert.equal(await withDescriptor(`<container ${NS} xmlns:xmlns="urn:x">${body}</container>`), "zip");
  // `xml` is bound by definition and may not be rebound to anything else.
  assert.equal(await withDescriptor(`<container ${NS} xmlns:xml="urn:x">${body}</container>`), "zip");
  // Rebinding it to its own URI is legal and changes nothing.
  assert.equal(await withDescriptor(`<container ${NS} xmlns:xml="http://www.w3.org/XML/1998/namespace">${body}</container>`), "epub");
  // XML 1.0 has no prefix undeclaration.
  assert.equal(await withDescriptor(`<q:container xmlns:q="${OCF}"><q:rootfiles xmlns:q=""><q:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></q:rootfiles></q:container>`), "zip");
});

test("the xml prefix and xml:lang are tolerated on a conforming descriptor", async () => {
  assert.equal(await withDescriptor(`<container ${NS} xml:lang="en"><rootfiles>${rootfile()}</rootfiles></container>`), "epub");
});

/* ------------------------------------------------------------------ finding 3: the whole attribute list is parsed */

test("a bare token in the attribute list makes the descriptor malformed", async () => {
  // OBSERVED ON 91d32bb: `epub`. XML has no boolean attributes; `nonsense` is not valid syntax anywhere.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile nonsense full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
  // And on the ancestors too -- the whole document is malformed, not just the tag that was being read.
  assert.equal(await withDescriptor(`<container ${NS} nonsense><rootfiles>${rootfile()}</rootfiles></container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles nonsense>${rootfile()}</rootfiles></container>`), "zip");
});

test("trailing garbage before the tag closes makes the descriptor malformed", async () => {
  // OBSERVED ON 91d32bb: `epub`. The old reader stopped looking once it had the two attributes it wanted.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}" %%$$ /></rootfiles></container>`), "zip");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}" ="x"/></rootfiles></container>`), "zip");
});

test("an attribute name that is not a QName makes the descriptor malformed", async () => {
  // OBSERVED ON 91d32bb: `epub`. `a:b:c` is an XML Name but not a QName, so it names no attribute.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile a:b:c="x" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
  // A name starting with a digit is not a Name at all.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile 1bad="x" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
  // An element name that is not a QName is refused the same way.
  assert.equal(await withDescriptor(`<a:b:c ${NS}><rootfiles>${rootfile()}</rootfiles></a:b:c>`), "zip");
});

test("duplicate attributes are REJECTED, not resolved to the first one", async () => {
  // THE DISCRIMINATING CASE. On 91d32bb a duplicate whose values DIFFERED appeared to be handled, but only
  // because the regular expression took the first match -- the document showed one value here and another to
  // any reader taking the last. Written with both values IDENTICAL, 91d32bb classified this `epub`, which is
  // how it was proved duplicates were never rejected. Both spellings must now fail closed.
  const dupSame = `<rootfile full-path="${PACKAGE_PATH}" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${dupSame}</rootfiles></container>`), "zip", "identical duplicate");
  const dupDiffer = `<rootfile full-path="OEBPS/other.opf" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${dupDiffer}</rootfiles></container>`), "zip", "differing duplicate");
  // A duplicate media-type, both the valid value. Also `epub` on 91d32bb.
  const dupType = `<rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}" media-type="${MEDIA_TYPE}"/>`;
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${dupType}</rootfiles></container>`), "zip", "duplicate media-type");
  // A duplicate ORDINARY attribute is equally malformed, even though nothing reads it. Also `epub` on 91d32bb.
  const dupOther = `<rootfile id="a" id="b" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${dupOther}</rootfiles></container>`), "zip", "duplicate ordinary attribute");
});

test("a duplicate namespace declaration is refused", async () => {
  // OBSERVED ON 91d32bb: `epub`.
  assert.equal(await withDescriptor(`<container ${NS} ${NS}><rootfiles>${rootfile()}</rootfiles></container>`), "zip");
  assert.equal(await withDescriptor(`<q:container xmlns:q="${OCF}" xmlns:q="${OCF}"><q:rootfiles><q:rootfile full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></q:rootfiles></q:container>`), "zip");
});

test("two attributes that expand to one name are refused", async () => {
  // Different spellings, one expanded name -- which XML Namespaces forbids just as it forbids one spelling
  // written twice. Both prefixes are bound to the same URI here.
  const tag = `<rootfile xmlns:a="urn:x" xmlns:b="urn:x" a:k="1" b:k="2" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`;
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${tag}</rootfiles></container>`), "zip");
});

test("an attribute on an undeclared prefix is refused", async () => {
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile zz:k="1" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
});

test("malformed attribute syntax of every shape is refused", async () => {
  const bad: [string, string][] = [
    ["missing =", `<rootfile full-path "${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`],
    ["unquoted value", `<rootfile full-path=${PACKAGE_PATH} media-type="${MEDIA_TYPE}"/>`],
    ["unterminated quote", `<rootfile full-path="${PACKAGE_PATH} media-type="${MEDIA_TYPE}"/>`],
    ["mismatched quotes", `<rootfile full-path="${PACKAGE_PATH}' media-type="${MEDIA_TYPE}"/>`],
    ["no whitespace between attributes", `<rootfile full-path="${PACKAGE_PATH}"media-type="${MEDIA_TYPE}"/>`],
    ["a raw < inside a value", `<rootfile note="<x>" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`],
    ["a value with no name", `<rootfile "${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/>`],
  ];
  for (const [label, tag] of bad) {
    assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${tag}</rootfiles></container>`), "zip", label);
  }
});

test("an end tag may not carry attributes", async () => {
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles>${rootfile()}</rootfiles x="1"></container>`), "zip");
});

test("the whitespace XML permits around attributes keeps working", async () => {
  const xml = `<container\n  ${NS}\n  version = "1.0"\n>\n  <rootfiles>\n    <rootfile\n      full-path = "${PACKAGE_PATH}"\n      media-type = "${MEDIA_TYPE}"\n    />\n  </rootfiles>\n</container>`;
  assert.equal(await withDescriptor(xml), "epub");
});

test("single-quoted and mixed-quote attribute values keep working", async () => {
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile media-type='${MEDIA_TYPE}' full-path='${PACKAGE_PATH}'/></rootfiles></container>`), "epub");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile media-type="${MEDIA_TYPE}" full-path='${PACKAGE_PATH}'/></rootfiles></container>`), "epub");
  // A quote of the other kind inside a value is ordinary text, not a terminator.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile note="it's here" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "epub");
});

/* ------------------------------------------------------------------ references: what XML itself defines, and nothing else */

test("the five predefined entities and numeric character references are decoded", async () => {
  // These are part of XML, need no DTD, and each produces exactly one character -- no recursion, no growth.
  // `&#47;` and `&#x2F;` are both `/`, so both of these name the real package document.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="OEBPS&#47;content.opf" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "epub");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="OEBPS&#x2F;content.opf" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "epub");
  // Decoded, not merely tolerated: a reference that spells a DIFFERENT path must not match this member.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="OEBPS&#47;other.opf" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
  // A predefined entity inside an ordinary value is decoded and changes nothing structural.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile note="a &amp; b &lt; c" full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "epub");
});

test("markup spelled with predefined entities stays a value and never becomes markup", async () => {
  // The R15 protection, now written the way XML actually spells it. The value decodes to the TEXT
  // `<rootfiles><rootfile full-path="OEBPS/fake.opf" .../></rootfiles>` and declares nothing.
  const decoy = `&lt;rootfiles&gt;&lt;rootfile full-path=&quot;${DECOY_PATH}&quot; media-type=&quot;${MEDIA_TYPE}&quot;/&gt;&lt;/rootfiles&gt;`;
  await neverEpub(`<container ${NS} note="${decoy}"></container>`);
  // And it cannot displace a real element sitting beside it.
  assert.equal(await withDescriptor(`<container ${NS} note="${decoy}"><rootfiles>${rootfile()}</rootfiles></container>`, [packageDocument(DECOY_PATH)]), "epub");
});

test("a general entity reference is refused, because no DTD can have declared one", async () => {
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="&undeclared;" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
  // A bare ampersand is not a reference and is refused too.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="a & b" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
  // An unterminated reference likewise.
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="&amp" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
});

test("a character reference to something XML forbids is refused", async () => {
  for (const reference of ["&#0;", "&#xD800;", "&#x110000;", "&#x;", "&#;", "&#999999999999;"]) {
    assert.equal(
      await withDescriptor(`<container ${NS}><rootfiles><rootfile full-path="OEBPS${reference}x.opf" media-type="${MEDIA_TYPE}"/></rootfiles></container>`),
      "zip",
      reference,
    );
  }
});

test("a DOCTYPE or an ENTITY declaration is still refused outright", async () => {
  // R15's protection, unchanged. Nothing is expanded, no DTD is fetched, nothing is resolved over a network.
  for (const prologue of [
    `<!DOCTYPE container>`,
    `<!DOCTYPE container [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>`,
    `<!DOCTYPE container [<!ENTITY xxe SYSTEM "http://example.invalid/x">]>`,
    `<!DOCTYPE c [<!ENTITY p "${PACKAGE_PATH}">]>`,
  ]) {
    assert.equal(await withDescriptor(`${prologue}<container ${NS}><rootfiles>${rootfile()}</rootfiles></container>`), "zip", prologue);
  }
});

/* ------------------------------------------------------------------ the three together, adversarially */

test("correct hierarchy with the wrong namespace is not a book", async () => {
  await neverEpub(`<container xmlns="urn:not-ocf"><rootfiles><rootfile full-path="${DECOY_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`);
});

test("the right namespace in the wrong hierarchy is not a book", async () => {
  await neverEpub(`<container ${NS}><wrapper><rootfiles>${rootfile(DECOY_PATH)}</rootfiles></wrapper></container>`);
  await neverEpub(`<notcontainer ${NS}><rootfiles>${rootfile(DECOY_PATH)}</rootfiles></notcontainer>`);
});

test("correct hierarchy and namespace with a malformed rootfile is not a book", async () => {
  await neverEpub(`<container ${NS}><rootfiles><rootfile nonsense full-path="${DECOY_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`);
});

test("a commented correct structure cannot rescue a live wrong-namespace one", async () => {
  const xml = `<container xmlns="urn:not-ocf"><!-- <rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles> --><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`;
  assert.equal(await withDescriptor(xml), "zip");
});

test("a fake wrong-namespace tree before the real one does not displace it", async () => {
  // The live, correctly namespaced hierarchy controls -- and it is inside the document element, where it has
  // to be. The decoy tree is a sibling of `rootfiles`, in a namespace that is not OCF.
  const xml =
    `<container ${NS}><decoy xmlns="urn:not-ocf"><rootfiles><rootfile full-path="${DECOY_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></decoy>` +
    `<rootfiles>${rootfile()}</rootfiles></container>`;
  assert.equal(await withDescriptor(xml, [packageDocument(DECOY_PATH)]), "epub", "with the decoy's target present");
  assert.equal(await withDescriptor(xml), "epub", "and with it absent, proving the live element decided");
});

test("a valid Unicode full-path in a proper OCF structure is still a book", async () => {
  // R15's UTF-8 member-name handling, crossed with R16's structure rules. Bit 11 is set on this member.
  const path = "OEBPS/café.opf";
  const xml = `<container ${NS}><rootfiles><rootfile full-path="${path}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`;
  assert.equal(
    await classify([MIMETYPE, container(`<?xml version="1.0" encoding="UTF-8"?>${xml}`), packageDocument(path)]),
    "epub",
  );
  // And the same path written with a numeric character reference for the accented letter.
  const referenced = `<container ${NS}><rootfiles><rootfile full-path="OEBPS/caf&#xE9;.opf" media-type="${MEDIA_TYPE}"/></rootfiles></container>`;
  assert.equal(
    await classify([MIMETYPE, container(`<?xml version="1.0" encoding="UTF-8"?>${referenced}`), packageDocument(path)]),
    "epub",
  );
});

test("a malformed UTF-8 member name still fails closed whatever the descriptor says", async () => {
  // R15's strict decoding, unchanged by R16: the archive is not indexed at all, so structure never matters.
  const path = "OEBPS/café.opf";
  const xml = `<container ${NS}><rootfiles><rootfile full-path="${path}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`;
  const broken: Entry = { name: path, data: Buffer.from("<package/>"), deflate: true };
  const zipBytes = buildZip([MIMETYPE, container(`<?xml version="1.0" encoding="UTF-8"?>${xml}`), broken]);
  // Corrupt the UTF-8 sequence of the name in place, in both headers, leaving bit 11 set.
  const valid = Buffer.from(path, "utf8");
  const invalid = Buffer.from(valid);
  invalid[valid.indexOf(0xc3)] = 0xff; // a byte that can begin no UTF-8 sequence
  let index = zipBytes.indexOf(valid);
  let replacements = 0;
  while (index >= 0) {
    invalid.copy(zipBytes, index);
    replacements++;
    index = zipBytes.indexOf(valid, index + 1);
  }
  assert.equal(replacements, 2, "both the local header and the central directory carry the name");
  const result = await validateUploadedMedia({
    source: { buffer: zipBytes }, allow: ["document"],
    declaredMimeType: "application/epub+zip", originalName: "novel.epub",
  });
  assert.equal(result.kind === "accepted" ? result.format : "rejected", "zip");
});

test("the token, depth and attribute bounds still hold", async () => {
  // Depth: more nesting than the bound allows is refused rather than walked.
  const deep = "<a>".repeat(400) + `<rootfiles>${rootfile()}</rootfiles>` + "</a>".repeat(400);
  assert.equal(await withDescriptor(`<container ${NS}>${deep}</container>`), "zip");
  // Tokens: more tags than the bound allows, likewise.
  const many = "<a/>".repeat(5000);
  assert.equal(await withDescriptor(`<container ${NS}>${many}<rootfiles>${rootfile()}</rootfiles></container>`), "zip");
  // Attributes: more on one tag than the bound allows.
  const attributes = Array.from({ length: 100 }, (_, index) => `a${index}="1"`).join(" ");
  assert.equal(await withDescriptor(`<container ${NS}><rootfiles><rootfile ${attributes} full-path="${PACKAGE_PATH}" media-type="${MEDIA_TYPE}"/></rootfiles></container>`), "zip");
});

test("the descriptor byte bound still holds and costs no memory", async () => {
  // R15's bound, re-pinned because R16 does more work per tag. The padding inflates past the 64 KiB cap.
  const padding = `<!--${" ".repeat(8 * 1024 * 1024)}-->`;
  const before = process.memoryUsage().rss;
  assert.equal(await withDescriptor(`<container ${NS}>${padding}<rootfiles>${rootfile()}</rootfiles></container>`), "zip");
  const growth = (process.memoryUsage().rss - before) / (1024 * 1024);
  assert.ok(growth < 64, `classification allocated ${growth.toFixed(1)}MB`);
});
