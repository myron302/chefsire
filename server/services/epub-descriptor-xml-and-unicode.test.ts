/**
 * Two ways the EPUB descriptor path read bytes as something they are not.
 *
 * FINDING 1 -- TEXT IS NOT MARKUP. The descriptor was located with regular expressions over the raw document,
 * so anything SHAPED like markup counted as markup. Reproduced on head 0a96182, with archives conforming in
 * every other respect and the decoy's target present:
 *
 *   <!-- <rootfiles><rootfile full-path="OEBPS/fake.opf" .../></rootfiles> -->    -> epub
 *   <![CDATA[<rootfiles><rootfile full-path="OEBPS/fake.opf" .../></rootfiles>]]> -> epub
 *
 * Both declare no rendition at all -- an XML parser sees one comment and one text node -- yet both were
 * accepted as books. The failure ran the other way too. With a commented decoy placed BEFORE a real
 * `rootfiles` element, the decoy was what got used; removing ONLY the decoy's target turned those archives
 * into generic `zip`, which is how it was proved that the live element had never been consulted at all.
 *
 * FINDING 2 -- NAMES WERE ALWAYS LATIN-1. ZIP general purpose bit 11 says a member's name is encoded as UTF-8,
 * and the decoder ignored it. Reproduced on head 0a96182: a conforming EPUB whose package document is
 * `OEBPS/café.opf`, written by python-`zipfile` (which sets bit 11 on exactly that member and leaves it clear
 * on the ASCII ones), had the name read as `OEBPS/cafÃ©.opf`. That no longer matched the UTF-8 path its own
 * `container.xml` declared, so the lookup failed and a valid book degraded to a generic `zip`. A CJK path did
 * the same.
 *
 * Both fixes are narrow. Only real element markup can establish `rootfiles`/`rootfile`, and a member name is
 * decoded the way its own flags say it is encoded -- strictly, so an invalid sequence fails closed instead of
 * becoming replacement characters that collapse distinct names together.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";
import { validateUploadedMedia } from "./media-validation";

/* ------------------------------------------------------------------ a ZIP writer with real flags and encodings */

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    let byte = (crc ^ buffer[index]!) & 0xff;
    for (let bit = 0; bit < 8; bit++) byte = byte & 1 ? 0xedb88320 ^ (byte >>> 1) : byte >>> 1;
    crc = (crc >>> 8) ^ byte;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const UTF8_FLAG = 0x0800;

type Entry = {
  /** The name as text. Encoded UTF-8 and flagged, unless `nameBytes` or `flags` say otherwise. */
  name: string;
  data: Buffer;
  deflate?: boolean;
  /** Write these exact bytes as the member name, whatever `name` says. For malformed-encoding fixtures. */
  nameBytes?: Buffer;
  /** Force the general purpose bit flag instead of deriving it from whether the name is ASCII. */
  flags?: number;
};

function nameBytesOf(entry: Entry): Buffer {
  return entry.nameBytes ?? Buffer.from(entry.name, "utf8");
}
function flagsOf(entry: Entry): number {
  if (entry.flags !== undefined) return entry.flags;
  // What a real archiver does: set bit 11 exactly when the name is not plain ASCII.
  return /^[\x20-\x7e]*$/.test(entry.name) ? 0 : UTF8_FLAG;
}

function buildZip(entries: Entry[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  const offsets: number[] = [];
  const payloads: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const payload = entry.deflate ? zlib.deflateRawSync(entry.data) : entry.data;
    payloads.push(payload);
    const name = nameBytesOf(entry);
    const flags = flagsOf(entry);
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
    const name = nameBytesOf(entry);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(flagsOf(entry), 8);
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
const NS = 'xmlns="urn:oasis:names:tc:opendocument:xmlns:container"';
const PACKAGE_PATH = "OEBPS/content.opf";
const DECOY_PATH = "OEBPS/fake.opf";

const rootfile = (path: string) => `<rootfile full-path="${path}" media-type="application/oebps-package+xml"/>`;
const descriptorFor = (path: string) => `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" ${NS}><rootfiles>${rootfile(path)}</rootfiles></container>`;

const container = (xml: string): Entry => ({ name: "META-INF/container.xml", data: Buffer.from(xml, "utf8"), deflate: true });
const packageDocument = (path = PACKAGE_PATH): Entry => ({ name: path, data: Buffer.from("<package/>"), deflate: true });

async function classify(entries: Entry[]) {
  const result = await validateUploadedMedia({
    source: { buffer: buildZip(entries) }, allow: ["document"],
    declaredMimeType: "application/epub+zip", originalName: "novel.epub",
  });
  return result.kind === "accepted" ? { format: result.format, extension: result.extension, contentType: result.contentType } : { format: `rejected:${result.reason}`, extension: "", contentType: "" };
}

/** A book whose descriptor is `xml`, carrying the real package document and, optionally, the decoy's target. */
const withDescriptor = (xml: string, extra: Entry[] = []) => classify([MIMETYPE, container(xml), packageDocument(), ...extra]);

/* ------------------------------------------------------------------ finding 1: only elements are elements */

test("an ordinary valid descriptor is still accepted", async () => {
  assert.deepEqual(await withDescriptor(descriptorFor(PACKAGE_PATH)), {
    format: "epub", extension: "epub", contentType: "application/epub+zip",
  });
});

test("namespace-prefixed elements are still accepted", async () => {
  const prefixed = `<?xml version="1.0"?><ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><ocf:rootfiles><ocf:rootfile full-path="${PACKAGE_PATH}" media-type="application/oebps-package+xml"/></ocf:rootfiles></ocf:container>`;
  assert.equal((await withDescriptor(prefixed)).format, "epub");
});

test("a rootfile that exists only inside an XML comment is not a rendition", async () => {
  // OBSERVED ON 0a96182: `epub`. The document declares nothing; a parser sees one comment.
  const xml = `<?xml version="1.0"?><container ${NS}><!-- <rootfiles>${rootfile(DECOY_PATH)}</rootfiles> --></container>`;
  assert.equal((await withDescriptor(xml, [packageDocument(DECOY_PATH)])).format, "zip");
  // Including when the comment names the REAL package document, which is present.
  const self = `<?xml version="1.0"?><container ${NS}><!-- <rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles> --></container>`;
  assert.equal((await withDescriptor(self)).format, "zip");
});

test("a rootfile that exists only inside CDATA is not a rendition", async () => {
  // OBSERVED ON 0a96182: `epub`. A parser sees one text node.
  const xml = `<?xml version="1.0"?><container ${NS}><![CDATA[<rootfiles>${rootfile(DECOY_PATH)}</rootfiles>]]></container>`;
  assert.equal((await withDescriptor(xml, [packageDocument(DECOY_PATH)])).format, "zip");
  const self = `<?xml version="1.0"?><container ${NS}><![CDATA[<rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles>]]></container>`;
  assert.equal((await withDescriptor(self)).format, "zip");
});

test("a commented decoy before a real element does not displace the real element", async () => {
  // OBSERVED ON 0a96182: the DECOY was used. Proved by removing only its target, which turned the archive into
  // a generic `zip` -- so the live element had never been consulted. Both directions are pinned here.
  const xml = `<?xml version="1.0"?><container ${NS}><!-- <rootfiles>${rootfile(DECOY_PATH)}</rootfiles> --><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`;
  assert.equal((await withDescriptor(xml)).format, "epub", "the live element decides, with the decoy's target absent");
  assert.equal((await withDescriptor(xml, [packageDocument(DECOY_PATH)])).format, "epub", "and with it present");
});

test("a CDATA decoy before a real element does not displace the real element", async () => {
  const xml = `<?xml version="1.0"?><container ${NS}><![CDATA[<rootfiles>${rootfile(DECOY_PATH)}</rootfiles>]]><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`;
  assert.equal((await withDescriptor(xml)).format, "epub");
  assert.equal((await withDescriptor(xml, [packageDocument(DECOY_PATH)])).format, "epub");
});

test("markup written inside an attribute value is text, not markup", async () => {
  // FIXTURE CORRECTED IN R16, assertions unchanged. These originally wrote a RAW `<` inside the value, which
  // XML forbids outright, so R16's complete attribute grammar now refuses the whole descriptor -- a different
  // (and correct) reason for `zip` than the one this test exists to pin. Spelled legally with `&lt;`, the value
  // is exactly the same text and the point still stands: it is a value, and a value is never markup.
  const decoy = `&lt;rootfiles&gt;${rootfile(DECOY_PATH).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}&lt;/rootfiles&gt;`;
  const xml = `<?xml version="1.0"?><container ${NS} note="${decoy}"><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`;
  assert.equal((await withDescriptor(xml, [packageDocument(DECOY_PATH)])).format, "epub", "the live element decides");

  // And an attribute that is the ONLY place a rootfile appears declares nothing.
  const only = `<?xml version="1.0"?><container ${NS} note="${decoy}"></container>`;
  assert.equal((await withDescriptor(only, [packageDocument(DECOY_PATH)])).format, "zip");

  // A raw `<` in a value is not legal XML at all, so such a descriptor is malformed and fails closed.
  const raw = `<?xml version="1.0"?><container ${NS} note="<rootfiles/>"><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`;
  assert.equal((await withDescriptor(raw)).format, "zip", "a raw `<` in an attribute value is malformed XML");
});

test("a processing instruction is skipped as a unit, not read as markup", async () => {
  const xml = `<?xml version="1.0"?><?decoy <rootfiles>${rootfile(DECOY_PATH)}</rootfiles> ?><container ${NS}><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`;
  assert.equal((await withDescriptor(xml, [packageDocument(DECOY_PATH)])).format, "epub");

  const only = `<?xml version="1.0"?><?decoy <rootfiles>${rootfile(DECOY_PATH)}</rootfiles> ?><container ${NS}></container>`;
  assert.equal((await withDescriptor(only, [packageDocument(DECOY_PATH)])).format, "zip");
});

test("malformed XML is not read at all", async () => {
  for (const [label, xml] of [
    ["unterminated comment", `<container ${NS}><!-- <rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles>`],
    ["unterminated CDATA", `<container ${NS}><![CDATA[<rootfiles>${rootfile(PACKAGE_PATH)}`],
    ["unterminated processing instruction", `<?decoy <container ${NS}><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`],
    ["unterminated tag", `<container ${NS}><rootfiles><rootfile full-path="${PACKAGE_PATH}"`],
    ["elements never closed", `<container ${NS}><rootfiles>${rootfile(PACKAGE_PATH)}`],
    ["mismatched end tag", `<container ${NS}><rootfiles>${rootfile(PACKAGE_PATH)}</rootfile></container>`],
    ["end tag with nothing open", `</rootfiles><container ${NS}><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`],
    ["a bare < with no name", `<container ${NS}>< <rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`],
    ["not XML at all", "just some bytes"],
  ] as const) {
    assert.equal((await withDescriptor(xml)).format, "zip", label);
  }
});

test("a DOCTYPE or an ENTITY declaration is still refused, and nothing is ever resolved", async () => {
  for (const [label, xml] of [
    ["a doctype", `<!DOCTYPE container><container ${NS}><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`],
    ["an external entity", `<!DOCTYPE container [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><container ${NS}><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`],
    ["an external entity over http", `<!DOCTYPE container [<!ENTITY xxe SYSTEM "http://example.invalid/x">]><container ${NS}><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`],
    ["a parameter entity", `<!DOCTYPE container [<!ENTITY % p SYSTEM "file:///etc/passwd">%p;]><container ${NS}><rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`],
    ["an internal entity used as the path", `<!DOCTYPE c [<!ENTITY p "${PACKAGE_PATH}">]><container ${NS}><rootfiles><rootfile full-path="&p;" media-type="application/oebps-package+xml"/></rootfiles></container>`],
  ] as const) {
    assert.equal((await withDescriptor(xml)).format, "zip", label);
  }
  // UPDATED IN R16. A NUMERIC CHARACTER REFERENCE is part of XML itself, not an entity: `&#47;` is one `/`,
  // it needs no DTD, it cannot recurse and it cannot grow, so R16 decodes it -- comparing the raw text would
  // have been the incorrect reading. Every assertion above is unchanged: there is still no DOCTYPE, no entity
  // declaration and nothing resolved.
  assert.equal((await withDescriptor(descriptorFor("OEBPS&#47;content.opf"))).format, "epub");
  // A GENERAL entity reference is still refused, because no DTD can have declared one.
  assert.equal((await withDescriptor(descriptorFor("&undeclared;"))).format, "zip");
});

test("an oversized descriptor is still bounded and refused", async () => {
  const padding = `<!--${" ".repeat(8 * 1024 * 1024)}-->`;
  const before = process.memoryUsage().rss;
  assert.equal((await withDescriptor(`<container ${NS}>${padding}<rootfiles>${rootfile(PACKAGE_PATH)}</rootfiles></container>`)).format, "zip");
  assert.equal((process.memoryUsage().rss - before) / 1048576 < 128, true, "without materialising it repeatedly");
});

/* ------------------------------------------------------------------ finding 2: names carry their encoding */

test("a package document with an ASCII name is unaffected", async () => {
  assert.equal((await withDescriptor(descriptorFor(PACKAGE_PATH))).format, "epub");
});

test("a package document named in UTF-8 with bit 11 set is found", async () => {
  // OBSERVED ON 0a96182: `zip`. The name decoded as `OEBPS/cafÃ©.opf` and matched nothing.
  for (const path of ["OEBPS/café.opf", "OEBPS/書籍.opf", "OEBPS/Ω/κεφάλαιο.opf", "OEBPS/emoji-📚.opf"]) {
    const result = await classify([MIMETYPE, container(descriptorFor(path)), packageDocument(path)]);
    assert.equal(result.format, "epub", path);
    assert.equal(result.extension, "epub", path);
  }
});

test("the same UTF-8 bytes without bit 11 are not silently treated as flagged UTF-8", async () => {
  // A documented limitation, pinned rather than papered over: without the flag the bytes are read as latin1,
  // so the name does not match the UTF-8 path the descriptor declares and the archive stays a generic `zip`.
  // Guessing the encoding would be worse than declining to.
  const path = "OEBPS/café.opf";
  const unflagged: Entry = { name: path, data: Buffer.from("<package/>"), deflate: true, flags: 0 };
  assert.equal((await classify([MIMETYPE, container(descriptorFor(path)), unflagged])).format, "zip");
  // With the flag, the identical bytes are found.
  assert.equal((await classify([MIMETYPE, container(descriptorFor(path)), packageDocument(path)])).format, "epub");
});

test("invalid UTF-8 with bit 11 set fails closed rather than becoming replacement characters", async () => {
  // `toString("utf8")` would substitute U+FFFD, which collapses distinct byte sequences into one string -- and
  // this module matches names for a living. Strict decoding refuses instead.
  for (const [label, bytes] of [
    ["a lone continuation byte", Buffer.from([0x4f, 0x2f, 0x80, 0x2e, 0x6f, 0x70, 0x66])],
    ["a truncated sequence", Buffer.from([0x4f, 0x2f, 0xc3, 0x2e, 0x6f, 0x70, 0x66])],
    ["an overlong encoding", Buffer.from([0x4f, 0x2f, 0xc0, 0xaf, 0x2e, 0x6f, 0x70, 0x66])],
    ["a surrogate half", Buffer.from([0x4f, 0x2f, 0xed, 0xa0, 0x80, 0x2e, 0x6f, 0x70, 0x66])],
  ] as const) {
    const broken: Entry = { name: "ignored", nameBytes: bytes, flags: 0x0800, data: Buffer.from("<package/>"), deflate: true };
    const result = await classify([MIMETYPE, container(descriptorFor("O/�.opf")), broken]);
    assert.equal(result.format, "zip", label);
  }
});

test("two byte-distinct names never collapse into one", async () => {
  // No Unicode normalization is applied, so a precomposed name and a decomposed one stay two different members
  // and neither can stand in for the other. Nothing here requires that they be treated as equal.
  const precomposed = "OEBPS/café.opf";   // é as one code point
  const decomposed = "OEBPS/café.opf";   // e + combining acute
  assert.notEqual(precomposed, decomposed);

  assert.equal((await classify([MIMETYPE, container(descriptorFor(precomposed)), packageDocument(precomposed)])).format, "epub");
  assert.equal((await classify([MIMETYPE, container(descriptorFor(precomposed)), packageDocument(decomposed)])).format, "zip", "the other spelling is a different member");
  // Both present: still unambiguous, because they are genuinely two members with two names.
  assert.equal((await classify([MIMETYPE, container(descriptorFor(precomposed)), packageDocument(precomposed), packageDocument(decomposed)])).format, "epub");
});

test("a duplicated Unicode name is still ambiguous and still refused", async () => {
  const path = "OEBPS/café.opf";
  assert.equal((await classify([MIMETYPE, container(descriptorFor(path)), packageDocument(path), packageDocument(path)])).format, "zip", "named twice");
  assert.equal((await classify([MIMETYPE, container(descriptorFor(path)), packageDocument(path), packageDocument("OEBPS/CAFÉ.opf")])).format, "epub", "a different member, not a collision");
});

test("central and local headers are read with the same rule, never one as latin1 and the other as UTF-8", async () => {
  // Both sides are decoded by their OWN flags, so a member flagged consistently matches itself. A member whose
  // local header names something else still fails, which is the R13 rule and is unaffected by encoding.
  const path = "OEBPS/café.opf";
  assert.equal((await classify([MIMETYPE, container(descriptorFor(path)), packageDocument(path)])).format, "epub");

  const mismatched: Entry = { name: path, data: Buffer.from("<package/>"), deflate: true };
  const archive = buildZip([MIMETYPE, container(descriptorFor(path)), mismatched]);
  // Rewrite the local header's name bytes in place, same length, so only the name disagrees.
  const original = Buffer.from(path, "utf8");
  const replacement = Buffer.from("OEBPS/xxxé.opf", "utf8");
  assert.equal(original.length, replacement.length, "the fixture keeps every offset valid");
  const forged = Buffer.from(archive);
  replacement.copy(forged, forged.indexOf(original));
  const result = await validateUploadedMedia({ source: { buffer: forged }, allow: ["document"], declaredMimeType: "application/epub+zip", originalName: "novel.epub" });
  assert.equal(result.kind === "accepted" && result.format, "zip", "a disagreeing local header still fails closed");
});

test("Office packages with ASCII parts are unaffected by the decoding change", async () => {
  const part = (name: string): Entry => ({ name, data: Buffer.from("<x/>"), deflate: true });
  const docx = await classify([part("[Content_Types].xml"), part("_rels/.rels"), part("word/document.xml")]);
  assert.equal(docx.format, "docx");
  assert.equal(docx.extension, "docx");
  const xlsx = await classify([part("[Content_Types].xml"), part("xl/workbook.xml")]);
  assert.equal(xlsx.format, "xlsx");
  // And a Unicode member alongside them changes nothing about the package's identity.
  assert.equal((await classify([part("[Content_Types].xml"), part("word/document.xml"), part("word/media/café.png")])).format, "docx");
});

/* ------------------------------------------------------------------ the two fixes together */

test("a Unicode package path referenced only from a comment is not a rendition", async () => {
  const path = "OEBPS/café.opf";
  const xml = `<?xml version="1.0" encoding="UTF-8"?><container ${NS}><!-- <rootfiles>${rootfile(path)}</rootfiles> --></container>`;
  assert.equal((await classify([MIMETYPE, container(xml), packageDocument(path)])).format, "zip");
});

test("a Unicode package path referenced only from CDATA is not a rendition", async () => {
  const path = "OEBPS/書籍.opf";
  const xml = `<?xml version="1.0" encoding="UTF-8"?><container ${NS}><![CDATA[<rootfiles>${rootfile(path)}</rootfiles>]]></container>`;
  assert.equal((await classify([MIMETYPE, container(xml), packageDocument(path)])).format, "zip");
});

test("a live Unicode rootfile with a correctly flagged member is an EPUB", async () => {
  const path = "OEBPS/café.opf";
  const xml = `<?xml version="1.0" encoding="UTF-8"?><container ${NS}><rootfiles>${rootfile(path)}</rootfiles></container>`;
  assert.equal((await classify([MIMETYPE, container(xml), packageDocument(path)])).format, "epub");
});

test("a commented Unicode decoy cannot displace a different live Unicode element", async () => {
  const decoy = "OEBPS/fake-café.opf";
  const real = "OEBPS/書籍.opf";
  const xml = `<?xml version="1.0" encoding="UTF-8"?><container ${NS}><!-- <rootfiles>${rootfile(decoy)}</rootfiles> --><rootfiles>${rootfile(real)}</rootfiles></container>`;
  // Only the real target is present: if the decoy were used this would be `zip`.
  assert.equal((await classify([MIMETYPE, container(xml), packageDocument(real)])).format, "epub");
  // Both present: still the live element that decides, so the decoy's presence changes nothing.
  assert.equal((await classify([MIMETYPE, container(xml), packageDocument(real), packageDocument(decoy)])).format, "epub");
  // And with only the DECOY's target present, the live element names something absent, so it is not a book.
  assert.equal((await classify([MIMETYPE, container(xml), packageDocument(decoy)])).format, "zip");
});
