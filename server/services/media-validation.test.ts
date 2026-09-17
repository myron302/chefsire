import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  IMAGE_FORMATS,
  MEDIA_TYPES,
  REJECTED_ACTIVE_EXTENSIONS,
  VIDEO_FORMATS,
  canonicalContentType,
  canonicalExtension,
} from "@shared/media-types";
import {
  declaredExtension,
  detectMediaContainer,
  generatedMediaKey,
  generatedMediaName,
  resolveMediaFormat,
  validateUploadedMedia,
} from "./media-validation";

/**
 * The trusted-media boundary, and the negative control that proves these tests would have caught the defect.
 *
 * The bug this replaces was not subtle: every upload route decided what a file was by reading `file.mimetype` and
 * `path.extname(file.originalname)`, both of which the uploader writes. `legacyDecision` below is that logic,
 * reproduced verbatim from the pre-repair `server/routes/upload.ts`, so each hostile case is asserted twice --
 * accepted and stored under an executable extension by the old rule, refused by the new one. A test that only
 * checked the new rule could pass against an implementation that never had the bug and would tell us nothing.
 */

/* ------------------------------------------------------------------ fixtures */

const image = (format: "jpeg" | "png" | "webp" | "gif") =>
  (sharp({ create: { width: 24, height: 18, channels: 3, background: { r: 10, g: 120, b: 200 } } }) as never as Record<string, () => sharp.Sharp>)[format]().toBuffer();

/** A minimal but real container head for each video format ChefSire accepts. */
const isoBmff = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftyp", "latin1"), Buffer.from(brand, "latin1"), Buffer.alloc(64, 0)]);
const mp4 = () => isoBmff("isom");
const mov = () => isoBmff("qt  ");
const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from([0x01, 0x00, 0x00, 0x00]), Buffer.from("Bwebm", "latin1"), Buffer.alloc(64, 0)]);
const ogg = () => Buffer.concat([Buffer.from("OggS", "latin1"), Buffer.alloc(64, 0)]);
const avi = () => Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.from([0, 0, 1, 0]), Buffer.from("AVI ", "latin1"), Buffer.alloc(64, 0)]);

const pdf = () => Buffer.from("%PDF-1.7\n1 0 obj\n<< >>\nendobj\nstartxref\n0\n%%EOF\n", "latin1");
const zipEntry = (name: string) => Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(22, 0),
  Buffer.from([name.length & 0xff, name.length >> 8, 0, 0]),
  Buffer.from(name, "latin1"), Buffer.alloc(32, 0),
]);
const zip = () => zipEntry("payload.txt");
const ooxml = () => zipEntry("[Content_Types].xml");
const epub = () => Buffer.concat([zipEntry("mimetype").subarray(0, 38), Buffer.from("application/epub+zip", "latin1"), Buffer.alloc(64, 0)]);
const ole = () => Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(64, 0)]);

/** The active content this repair exists to keep out of storage. */
const html = Buffer.from("<!doctype html><html><body><script>alert(document.domain)</script></body></html>");
const svg = Buffer.from(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);
const xml = Buffer.from(`<?xml version="1.0"?><!DOCTYPE t [<!ENTITY x SYSTEM "file:///etc/passwd">]><t>&x;</t>`);
const xhtml = Buffer.from(`<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><script>alert(1)</script></body></html>`);
const javascript = Buffer.from("(function(){ fetch('/api/me').then(r => r.json()); })();\n");
const randomBytes = Buffer.from(Array.from({ length: 512 }, (_, i) => (i * 37 + 11) % 251));

/* ------------------------------------- the pre-repair rule, kept as a negative control */

/** Exactly the allowlist the pre-repair `/api/upload` filtered on: the DECLARED type, and nothing else. */
const LEGACY_ALLOWED_DECLARED_TYPES = [
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/ogg",
  "application/zip", "application/epub+zip", "image/jpeg", "image/png", "image/gif", "image/webp",
];

/** The pre-repair decision, reproduced: accept on the declared MIME, name the object from the declared filename. */
function legacyDecision(declaredMimeType: string, originalName: string): { accepted: boolean; storedExtension: string } {
  return {
    accepted: LEGACY_ALLOWED_DECLARED_TYPES.includes(declaredMimeType),
    storedExtension: path.extname(originalName).toLowerCase().replace(/^\./, ""),
  };
}

/* ------------------------------------------------------------------ detection */

test("every accepted format is detected from its own bytes", async () => {
  for (const format of ["jpeg", "png", "webp", "gif"] as const) {
    assert.deepEqual(detectMediaContainer(await image(format)), { container: "image", format }, format);
  }
  assert.deepEqual(detectMediaContainer(mp4()), { container: "video", format: "mp4" });
  assert.deepEqual(detectMediaContainer(mov()), { container: "video", format: "quicktime" });
  assert.deepEqual(detectMediaContainer(webm()), { container: "video", format: "webm" });
  assert.deepEqual(detectMediaContainer(ogg()), { container: "video", format: "ogg" });
  assert.deepEqual(detectMediaContainer(avi()), { container: "video", format: "avi" });
  assert.deepEqual(detectMediaContainer(pdf(), pdf()), { container: "pdf" });
  assert.deepEqual(detectMediaContainer(zip()), { container: "zip" });
  assert.deepEqual(detectMediaContainer(ole()), { container: "ole" });
});

test("nothing that can execute in a browser is ever detected as an accepted format", () => {
  for (const [label, buffer] of [["html", html], ["svg", svg], ["xml", xml], ["xhtml", xhtml], ["javascript", javascript], ["random", randomBytes], ["empty", Buffer.alloc(0)]] as const) {
    assert.equal(detectMediaContainer(buffer, buffer), null, label);
  }
});

test("a PDF must carry a cross-reference pointer, not merely borrow the signature", () => {
  const borrowed = Buffer.concat([Buffer.from("%PDF-1.7\n", "latin1"), Buffer.alloc(8192, 0x41)]);
  assert.equal(detectMediaContainer(borrowed, borrowed.subarray(borrowed.length - 4096)), null);
  assert.deepEqual(detectMediaContainer(pdf(), pdf()), { container: "pdf" });
});

test("an ISO-BMFF file with a brand ChefSire does not support is refused rather than guessed at", () => {
  assert.equal(detectMediaContainer(isoBmff("heic")), null);
  assert.equal(detectMediaContainer(isoBmff("crx ")), null);
});

test("Matroska that is not WebM is refused, because only WebM has a content type here", () => {
  const mkv = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from("Bmatroska", "latin1"), Buffer.alloc(64, 0)]);
  assert.equal(detectMediaContainer(mkv), null);
});

/* ------------------------------------------------------------------ canonical mapping */

test("the canonical extension and content type come from the detected format, never from the request", async () => {
  const jpeg = await image("jpeg");
  const result = await validateUploadedMedia({
    source: { buffer: jpeg },
    allow: ["image"],
    // Both of these are hostile, and both are ignored.
    declaredMimeType: "text/html",
    originalName: "../../../../etc/cron.d/attack.html",
  });
  assert.equal(result.kind, "accepted");
  assert.equal(result.kind === "accepted" && result.format, "jpeg");
  assert.equal(result.kind === "accepted" && result.extension, "jpg");
  assert.equal(result.kind === "accepted" && result.contentType, "image/jpeg");
});

test("no accepted format maps to an extension a browser executes", () => {
  const active = new Set<string>(REJECTED_ACTIVE_EXTENSIONS);
  for (const format of Object.keys(MEDIA_TYPES) as (keyof typeof MEDIA_TYPES)[]) {
    assert.equal(active.has(canonicalExtension(format)), false, format);
    assert.equal(canonicalContentType(format).startsWith("text/"), false, format);
  }
});

test("a document's label is chosen only among inert members of the container its bytes established", () => {
  // A ZIP that declares itself a DOCX and carries the OOXML marker is labelled DOCX.
  assert.equal(resolveMediaFormat({ container: "zip" }, ooxml(), "report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "docx");
  // The same declaration over an archive WITHOUT the marker falls back to the honest answer.
  assert.equal(resolveMediaFormat({ container: "zip" }, zip(), "report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "zip");
  assert.equal(resolveMediaFormat({ container: "zip" }, epub(), "book.epub", "application/epub+zip"), "epub");
  // A declaration from outside the family cannot pull the label out of it.
  for (const claimed of ["payload.html", "payload.svg", "payload.js", "payload.mp4"]) {
    const format = resolveMediaFormat({ container: "zip" }, zip(), claimed, "text/html");
    assert.equal(format, "zip", claimed);
  }
  // An OLE compound file that names neither member is refused rather than labelled as a guess.
  assert.equal(resolveMediaFormat({ container: "ole" }, ole(), "payload.html", "text/html"), null);
  assert.equal(resolveMediaFormat({ container: "ole" }, ole(), "notes.doc", "application/msword"), "doc");
});

/* ------------------------------------------------------------------ the required matrix */

test("legitimate JPEG, PNG, WebP and GIF are accepted", async () => {
  for (const format of ["jpeg", "png", "webp", "gif"] as const) {
    const result = await validateUploadedMedia({ source: { buffer: await image(format) }, allow: ["image"] });
    assert.equal(result.kind, "accepted", format);
    assert.equal(result.kind === "accepted" && result.format, format);
    assert.equal(result.kind === "accepted" && result.mediaClass, "image");
  }
});

test("legitimate video containers are accepted for the routes that take video", async () => {
  for (const [format, buffer] of [["mp4", mp4()], ["quicktime", mov()], ["webm", webm()], ["ogg", ogg()], ["avi", avi()]] as const) {
    const result = await validateUploadedMedia({ source: { buffer }, allow: ["image", "video"] });
    assert.equal(result.kind, "accepted", format);
    assert.equal(result.kind === "accepted" && result.format, format);
  }
});

test("HTML declared image/jpeg is rejected -- and was accepted, as a .html, by the rule this replaces", async () => {
  const legacy = legacyDecision("image/jpeg", "attack.html");
  assert.equal(legacy.accepted, true, "negative control: the old rule accepted this");
  assert.equal(legacy.storedExtension, "html", "negative control: and stored it as active content");

  const result = await validateUploadedMedia({ source: { buffer: html }, allow: ["image", "video", "document"], declaredMimeType: "image/jpeg", originalName: "attack.html" });
  assert.equal(result.kind, "rejected");
  assert.equal(result.kind === "rejected" && result.reason, "content_mismatch");
});

test("JavaScript, XML, XHTML and random bytes declared as images are all rejected", async () => {
  for (const [label, buffer] of [["javascript", javascript], ["xml", xml], ["xhtml", xhtml], ["random", randomBytes]] as const) {
    assert.equal(legacyDecision("image/png", `payload.${label}`).accepted, true, `negative control: ${label}`);
    const result = await validateUploadedMedia({ source: { buffer }, allow: ["image", "video", "document"], declaredMimeType: "image/png", originalName: `payload.${label}` });
    assert.equal(result.kind, "rejected", label);
  }
});

test("SVG is rejected however it is declared: it is a scriptable document, not a raster image", async () => {
  for (const declared of ["image/svg+xml", "image/png", "image/jpeg", "text/plain"]) {
    const result = await validateUploadedMedia({ source: { buffer: svg }, allow: ["image", "video", "document"], declaredMimeType: declared, originalName: "logo.svg" });
    assert.equal(result.kind, "rejected", declared);
  }
  // And it is not reachable by claiming a name that ends in something allowed either.
  const disguised = await validateUploadedMedia({ source: { buffer: svg }, allow: ["image"], declaredMimeType: "image/png", originalName: "logo.png" });
  assert.equal(disguised.kind, "rejected");
});

test("a mismatched extension cannot control the stored extension", async () => {
  // Case 13: a real JPEG named `.html` is stored as an image, under the canonical image extension.
  const result = await validateUploadedMedia({ source: { buffer: await image("jpeg") }, allow: ["image"], declaredMimeType: "image/jpeg", originalName: "photo.html" });
  assert.equal(result.kind === "accepted" && result.extension, "jpg");
  // Case 14: active bytes named `.jpg` are refused, whatever the name promises.
  const active = await validateUploadedMedia({ source: { buffer: html }, allow: ["image"], declaredMimeType: "image/jpeg", originalName: "photo.jpg" });
  assert.equal(active.kind, "rejected");
});

test("a mismatched declared MIME cannot control the stored content type", async () => {
  const png = await image("png");
  for (const declared of ["image/jpeg", "text/html", "application/pdf", "video/mp4", ""]) {
    const result = await validateUploadedMedia({ source: { buffer: png }, allow: ["image"], declaredMimeType: declared, originalName: "x.bin" });
    assert.equal(result.kind === "accepted" && result.contentType, "image/png", declared);
  }
});

test("uppercase and double extensions cannot bypass validation", async () => {
  for (const name of ["attack.JPG", "attack.jpg.HTML", "attack.PNG.svg", "attack.html.jpeg", "attack.jpg."]) {
    const result = await validateUploadedMedia({ source: { buffer: html }, allow: ["image", "video", "document"], declaredMimeType: "image/jpeg", originalName: name });
    assert.equal(result.kind, "rejected", name);
  }
  // A real image is still accepted under a shouty name, and still stored under the canonical lower-case extension.
  const ok = await validateUploadedMedia({ source: { buffer: await image("png") }, allow: ["image"], originalName: "PHOTO.PNG", declaredMimeType: "IMAGE/PNG" });
  assert.equal(ok.kind === "accepted" && ok.extension, "png");
});

test("an empty file is rejected, and is reported as empty rather than as a type problem", async () => {
  const result = await validateUploadedMedia({ source: { buffer: Buffer.alloc(0) }, allow: ["image", "video", "document"], declaredMimeType: "image/png", originalName: "empty.png" });
  assert.equal(result.kind === "rejected" && result.reason, "empty");
});

test("a truncated image is rejected even though its signature is genuine", async () => {
  const png = await image("png");
  // The real PNG signature, then nothing that decodes.
  const truncated = png.subarray(0, 40);
  assert.deepEqual(detectMediaContainer(truncated), { container: "image", format: "png" }, "the signature alone still reads as PNG");
  const result = await validateUploadedMedia({ source: { buffer: truncated }, allow: ["image"], declaredMimeType: "image/png", originalName: "half.png" });
  assert.equal(result.kind, "rejected");
  assert.equal(result.kind === "rejected" && result.reason, "unreadable_image");
});

test("a route that renders media inline never accepts a document", async () => {
  const result = await validateUploadedMedia({ source: { buffer: pdf() }, allow: ["image", "video"], declaredMimeType: "application/pdf", originalName: "menu.pdf" });
  assert.equal(result.kind === "rejected" && result.reason, "unsupported_media_type");
  // The same bytes on the route that does take documents are fine.
  const general = await validateUploadedMedia({ source: { buffer: pdf() }, allow: ["image", "video", "document"], declaredMimeType: "application/pdf", originalName: "menu.pdf" });
  assert.equal(general.kind === "accepted" && general.format, "pdf");
});

test("the size bound is enforced on the bytes, not on anything the request claimed", async () => {
  const png = await image("png");
  const result = await validateUploadedMedia({ source: { buffer: png }, allow: ["image"], maxBytes: 10 });
  assert.equal(result.kind === "rejected" && result.reason, "too_large");
});

/* ------------------------------------------------------------------ streaming source */

test("a staged file is classified by reading its ends, not by buffering it", async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "media-validation-"));
  try {
    // A real PDF with a megabyte of filler between the header and the trailer: the trailer is only found by
    // reading the tail, which is the case a head-only reader would get wrong.
    const staged = path.join(directory, "staged-no-extension");
    await fs.promises.writeFile(staged, Buffer.concat([Buffer.from("%PDF-1.7\n", "latin1"), Buffer.alloc(1_000_000, 0x20), Buffer.from("\nstartxref\n0\n%%EOF\n", "latin1")]));
    const result = await validateUploadedMedia({ source: { path: staged, byteSize: (await fs.promises.stat(staged)).size }, allow: ["document"], declaredMimeType: "application/pdf", originalName: "big.pdf" });
    assert.equal(result.kind === "accepted" && result.format, "pdf");

    const hostile = path.join(directory, "hostile-no-extension");
    await fs.promises.writeFile(hostile, html);
    const rejected = await validateUploadedMedia({ source: { path: hostile, byteSize: html.length }, allow: ["image", "video", "document"], declaredMimeType: "image/jpeg", originalName: "attack.html" });
    assert.equal(rejected.kind, "rejected");
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ generated names */

test("a storage name is generated in full and cannot be steered by a caller", () => {
  const name = generatedMediaName("jpg");
  assert.match(name, /^[0-9a-f-]{36}\.jpg$/);
  assert.notEqual(generatedMediaName("jpg"), name, "two uploads never collide");
  assert.match(generatedMediaKey("avatars", "png", "avatar-"), /^avatars\/avatar-[0-9a-f-]{36}\.png$/);
});

test("the name generator refuses anything validation did not produce", () => {
  // This is the assertion that keeps a future caller from reintroducing `path.extname(file.originalname)`.
  for (const extension of [...REJECTED_ACTIVE_EXTENSIONS, "", "jpg.html", "../jpg", "j/pg", "verylongext"]) {
    assert.throws(() => generatedMediaName(extension), /media validation/, extension);
  }
  for (const prefix of ["../", "a/b", "avatar/../", "AVATAR", "a.b"]) {
    assert.throws(() => generatedMediaName("jpg", prefix), /server-chosen label/, prefix);
  }
  for (const folder of ["../posts", "posts/..", "", "Posts", "posts/nested"]) {
    assert.throws(() => generatedMediaKey(folder, "jpg"), /server-chosen label/, folder);
  }
});

test("a traversal filename contributes nothing to a generated name", () => {
  // The declared extension is read for one purpose only -- labelling inert document members -- and it is taken
  // from the last path segment, so a traversal sequence is not even a candidate.
  assert.equal(declaredExtension("../../../../etc/cron.d/pwn.html"), "html");
  assert.equal(declaredExtension("..\\..\\windows\\system32\\evil.docx"), "docx");
  assert.equal(declaredExtension("/absolute/path/file.pdf"), "pdf");
  assert.equal(declaredExtension("noextension"), "");
  assert.equal(declaredExtension(".hidden"), "");
  // And none of it reaches a path: the generated name is a UUID plus a canonical extension, full stop.
  assert.match(generatedMediaName("pdf"), /^[0-9a-f-]{36}\.pdf$/);
});

test("the shared format tables and the detector agree on what is accepted", () => {
  assert.deepEqual([...IMAGE_FORMATS], ["jpeg", "png", "webp", "gif"]);
  assert.deepEqual([...VIDEO_FORMATS], ["mp4", "quicktime", "webm", "ogg", "avi"]);
});
