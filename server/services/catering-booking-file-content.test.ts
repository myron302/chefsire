import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { CATERING_IMAGE_MAX_DIMENSION, CATERING_IMAGE_MAX_PIXELS, detectCateringFileFormat, looksLikePdf, validateCateringFileContent } from "./catering-booking-file-content";

const pdf = (body = "1 0 obj\n<< >>\nendobj\n") => Buffer.from(`%PDF-1.7\n${body}startxref\n0\n%%EOF\n`, "latin1");
const image = (format: "jpeg" | "png" | "webp") => sharp({ create: { width: 24, height: 18, channels: 3, background: { r: 10, g: 120, b: 200 } } })[format]().toBuffer();
// A 64-bit ELF header, the shape of a Linux executable, so a renamed binary is tested against the real signature.
const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]), Buffer.alloc(64, 0x90)]);
const svg = Buffer.from(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);
const html = Buffer.from("<!doctype html><html><body><script>alert(1)</script></body></html>");
// A minimal ZIP local file header, which is also what DOCX/XLSX/PPTX/EPUB actually are.
const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0)]);

test("format detection reads the bytes themselves and nothing the request claimed", async () => {
  assert.equal(detectCateringFileFormat(pdf()), "pdf");
  assert.equal(detectCateringFileFormat(await image("jpeg")), "jpeg");
  assert.equal(detectCateringFileFormat(await image("png")), "png");
  assert.equal(detectCateringFileFormat(await image("webp")), "webp");
});
test("nothing outside the launch allowlist is ever detected as an allowed format", () => {
  for (const [label, buffer] of [["elf", elf], ["svg", svg], ["html", html], ["zip", zip], ["empty", Buffer.alloc(0)], ["short", Buffer.from("%PDF")]] as const) {
    assert.equal(detectCateringFileFormat(buffer), null, label);
  }
});
test("a PDF must look like a real document, not merely borrow the signature", () => {
  assert.equal(looksLikePdf(pdf()), true);
  // The header alone, with no cross-reference pointer or trailer anywhere, is refused.
  assert.equal(looksLikePdf(Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(8192, 0x41)])), false);
  assert.equal(looksLikePdf(elf), false);
});
test("an executable renamed .pdf is rejected on its content", async () => {
  const renamed = await validateCateringFileContent(elf, "pdf", "pdf");
  assert.equal(renamed.kind, "rejected");
  assert.equal(renamed.kind === "rejected" && renamed.reason, "content_mismatch");
});
test("SVG, HTML and ZIP content is rejected even when a request claims an allowed type", async () => {
  for (const [label, buffer] of [["svg", svg], ["html", html], ["zip", zip]] as const) {
    for (const expected of ["pdf", "png", "jpeg", "webp"] as const) {
      const result = await validateCateringFileContent(buffer, expected === "pdf" ? "pdf" : "image", expected);
      assert.equal(result.kind, "rejected", `${label}/${expected}`);
    }
  }
});
test("content that disagrees with the declared allowed type is rejected in every direction", async () => {
  const png = await image("png");
  // A real PNG declared as a PDF, and a real PDF declared as a PNG, are both mismatches.
  assert.equal((await validateCateringFileContent(png, "pdf", "pdf")).kind, "rejected");
  assert.equal((await validateCateringFileContent(pdf(), "image", "png")).kind, "rejected");
  // A real PNG declared as JPEG is a mismatch too, so an image cannot be relabelled into another allowed type.
  assert.equal((await validateCateringFileContent(png, "image", "jpeg")).kind, "rejected");
});
test("a valid PDF is stored byte-for-byte", async () => {
  const source = pdf();
  const result = await validateCateringFileContent(source, "pdf", "pdf");
  assert.equal(result.kind, "accepted");
  assert.equal(result.kind === "accepted" && result.body.equals(source), true);
  assert.equal(result.kind === "accepted" && result.byteSize, source.length);
});
test("a valid raster image is re-encoded, so the stored object is Sharp's own output", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const source = await image(format);
    const result = await validateCateringFileContent(source, "image", format);
    assert.equal(result.kind, "accepted", format);
    if (result.kind !== "accepted") continue;
    // The stored bytes are still the same format, and the recorded size is the stored size, not the uploaded one.
    assert.equal(detectCateringFileFormat(result.body), format);
    assert.equal(result.byteSize, result.body.length);
  }
});
test("appended payload bytes do not survive the image re-encode", async () => {
  const source = Buffer.concat([await image("png"), zip]);
  const result = await validateCateringFileContent(source, "image", "png");
  assert.equal(result.kind, "accepted");
  if (result.kind !== "accepted") return;
  // The trailing ZIP header the client attached is simply not in what Sharp produced.
  assert.equal(result.body.includes(Buffer.from([0x50, 0x4b, 0x03, 0x04])), false);
  assert.equal(result.body.length < source.length, true);
});
test("an image with a valid signature but unreadable data is rejected rather than stored", async () => {
  const broken = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(256, 0x00)]);
  const result = await validateCateringFileContent(broken, "image", "png");
  assert.equal(result.kind, "rejected");
  assert.equal(result.kind === "rejected" && result.reason, "unreadable_image");
});
test("decompression bounds are explicit, so an image bomb cannot be decoded", () => {
  assert.equal(CATERING_IMAGE_MAX_DIMENSION, 12_000);
  assert.equal(CATERING_IMAGE_MAX_PIXELS, 40_000_000);
});
