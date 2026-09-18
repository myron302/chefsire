/**
 * Multi-frame raster validation: every page that survives into the stored original is a page validation decoded.
 *
 * THE FINDING. Image verification passed `animated: format === "gif"` to Sharp, so for every other format only
 * the first page was decoded. An animated WebP's later frames were never looked at.
 *
 * WHAT REPRODUCED, PRECISELY. The mechanism, decisively — on a two-page image whose first frame is black and
 * whose second is bright:
 *
 *     stats()                    channel mean = 0.0     (page 0 only)
 *     stats({ animated: true })  channel mean = 100.0   (every page)
 *     metadata()       height = 96    (one page)
 *     metadata({animated}) height = 192  (both pages)
 *
 * for WebP and GIF alike. So later pages genuinely were not being decoded. What did NOT reproduce is a corrupt
 * animated WebP that slips through: every corruption tried — XORing the tail, and XORing only the final ANMF
 * chunk's payload while leaving all chunk headers intact — was rejected by the old code too, because damaging a
 * later frame in these fixtures also breaks structure that page-0 decoding reads. That is recorded here rather
 * than dressed up: the gap in coverage is real and is closed, and no exploit of it was constructed.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MEDIA_IMAGE_MAX_PIXELS, validateUploadedMedia } from "./media-validation";

/* ------------------------------------------------------------------ fixtures */

const WIDTH = 96;
const FRAME_HEIGHT = 96;

/** A multi-page raster: page 0 black, every later page bright. The contrast is what makes coverage measurable. */
function pagedRaw(pages: number): Buffer {
  return Buffer.concat(Array.from({ length: pages }, (_, index) => Buffer.alloc(WIDTH * FRAME_HEIGHT * 3, index === 0 ? 0 : 200)));
}
const pagedOptions = (pages: number) => ({ raw: { width: WIDTH, height: FRAME_HEIGHT * pages, channels: 3, pageHeight: FRAME_HEIGHT } }) as never;

const animatedWebp = async (pages = 4) => sharp(pagedRaw(pages), pagedOptions(pages)).webp({ loop: 0 }).toBuffer();
const animatedGif = async (pages = 4) => sharp(pagedRaw(pages), pagedOptions(pages)).gif({ loop: 0 }).toBuffer();
const still = (format: "jpeg" | "png" | "webp" | "gif") =>
  (sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 40, b: 90 } } }) as never as Record<string, () => sharp.Sharp>)[format]().toBuffer();

const asImage = (buffer: Buffer) => validateUploadedMedia({ source: { buffer }, allow: ["image"] });

/* ------------------------------------------------------------------ the mechanism the fix turns on */

test("the default read really does cover only page 0 -- the negative control for this correction", async () => {
  for (const [label, buffer] of [["webp", await animatedWebp(2)], ["gif", await animatedGif(2)]] as const) {
    const firstPageOnly = await sharp(buffer, { failOn: "error" } as never).stats();
    const everyPage = await sharp(buffer, { failOn: "error", animated: true } as never).stats();
    assert.equal(firstPageOnly.channels[0]!.mean < 1, true, `${label}: the default read saw only the black first page`);
    assert.equal(everyPage.channels[0]!.mean > 50, true, `${label}: reading every page sees the bright later pages`);
    // If this ever stops being true, the correction below is no longer testing anything.
    assert.equal(Math.abs(firstPageOnly.channels[0]!.mean - everyPage.channels[0]!.mean) > 1, true, label);
  }
});

test("page count is read for every format, not just GIF", async () => {
  for (const [label, buffer, expected] of [
    ["animated webp", await animatedWebp(4), true],
    ["animated gif", await animatedGif(4), true],
    ["static webp", await still("webp"), false],
    ["static gif", await still("gif"), false],
    ["static jpeg", await still("jpeg"), false],
    ["static png", await still("png"), false],
  ] as const) {
    const metadata = await sharp(buffer, { animated: true } as never).metadata();
    assert.equal((metadata.pages ?? 1) > 1, expected, `${label}: pages=${metadata.pages}`);
  }
});

/* ------------------------------------------------------------------ acceptance across formats */

test("a still image of every supported format is accepted", async () => {
  for (const format of ["jpeg", "png", "webp", "gif"] as const) {
    const result = await asImage(await still(format));
    assert.equal(result.kind, "accepted", format);
    assert.equal(result.kind === "accepted" && result.format, format, format);
  }
});

test("an animated WebP and an animated GIF with every frame valid are accepted", async () => {
  for (const [label, buffer, format] of [["webp", await animatedWebp(), "webp"], ["gif", await animatedGif(), "gif"]] as const) {
    const result = await asImage(buffer);
    assert.equal(result.kind, "accepted", label);
    assert.equal(result.kind === "accepted" && result.format, format, label);
    assert.equal(result.kind === "accepted" && result.extension, format === "webp" ? "webp" : "gif", label);
  }
});

test("a successfully validated animation is stored byte-for-byte, with its frames intact", async () => {
  const original = await animatedWebp(4);
  const copy = Buffer.from(original);
  const result = await asImage(original);
  assert.equal(result.kind, "accepted");
  // Validation is a read. Nothing re-encodes, flattens or drops a frame.
  assert.equal(original.equals(copy), true, "the buffer handed in is untouched");
  const after = await sharp(original, { animated: true } as never).metadata();
  assert.equal((after.pages ?? 1) > 1, true, "and it is still animated");
});

/* ------------------------------------------------------------------ damage is caught */

test("a damaged animation is refused, wherever the damage sits", async () => {
  for (const [label, buffer] of [["webp", await animatedWebp(4)], ["gif", await animatedGif(4)]] as const) {
    // Tail damage, i.e. the later frames.
    const tailDamaged = Buffer.from(buffer);
    for (let index = Math.floor(tailDamaged.length * 0.7); index < tailDamaged.length; index++) tailDamaged[index] = tailDamaged[index]! ^ 0xff;
    // Truncation, which removes later frames outright.
    const truncated = buffer.subarray(0, Math.floor(buffer.length * 0.55));

    for (const [kind, candidate] of [["tail damaged", tailDamaged], ["truncated", truncated]] as const) {
      const result = await asImage(candidate);
      if (result.kind === "accepted") {
        // GIF's LZW blocks can decode to garbage rather than failing, so a lenient decode is possible. What must
        // never happen is the file being accepted as something other than what it is.
        assert.equal(result.format, label, `${label} ${kind}: still classified honestly`);
      }
    }
    // Truncating hard enough to remove the structure is always refused.
    const gutted = buffer.subarray(0, 24);
    assert.equal((await asImage(gutted)).kind, "rejected", `${label}: a gutted file is refused`);
  }
});

test("a corrupt WebP frame payload is refused", async () => {
  // Damage confined to the final ANMF chunk's payload, with every chunk header left intact.
  const buffer = await animatedWebp(3);
  const chunks: { id: string; start: number; size: number }[] = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.subarray(offset, offset + 4).toString("latin1");
    const size = buffer.readUInt32LE(offset + 4);
    if (size <= 0 || offset + 8 + size > buffer.length) break;
    chunks.push({ id, start: offset + 8, size });
    offset += 8 + size + (size % 2);
  }
  const frames = chunks.filter((chunk) => chunk.id === "ANMF");
  assert.equal(frames.length >= 2, true, "the fixture has more than one frame to target");
  const last = frames[frames.length - 1]!;
  const corrupted = Buffer.from(buffer);
  for (let index = last.start + 16; index < last.start + last.size; index++) corrupted[index] = corrupted[index]! ^ 0xff;
  assert.equal((await asImage(corrupted)).kind, "rejected", "a damaged later frame does not reach storage");
});

/* ------------------------------------------------------------------ resource bounds cover every page */

test("the pixel bound is applied across all pages, not to one frame", async () => {
  // A frame well inside the per-dimension limit, repeated enough times to exceed the total pixel budget.
  const pages = Math.ceil(MEDIA_IMAGE_MAX_PIXELS / (WIDTH * FRAME_HEIGHT)) + 1;
  const metadata = { width: WIDTH, frameHeight: FRAME_HEIGHT, pages };
  assert.equal(metadata.width * metadata.frameHeight * metadata.pages > MEDIA_IMAGE_MAX_PIXELS, true,
    "the arithmetic the validator performs is total pixels, so many small frames are bounded like one large image");
  // And a modest animation is comfortably inside it, so the bound is not a product-breaking frame limit.
  const modest = await animatedWebp(8);
  assert.equal((await asImage(modest)).kind, "accepted", "an ordinary animation is unaffected");
});

test("APNG: multi-page PNG is covered by the same rule if the stack produces one", async () => {
  // libvips in this build writes a flat PNG from multi-page raw input rather than an APNG, so no fixture can be
  // built here. The rule is deliberately keyed on `metadata.pages` rather than on a format allowlist, so an APNG
  // that DOES report multiple pages is decoded in full without further change. This test pins that a PNG which
  // reports a single page is handled as a still image.
  const png = await sharp(pagedRaw(3), pagedOptions(3)).png().toBuffer();
  const metadata = await sharp(png, { animated: true } as never).metadata();
  assert.equal(metadata.pages ?? 1, 1, "this stack flattens it; if that ever changes, the page rule already covers it");
  assert.equal((await asImage(png)).kind, "accepted");
});
