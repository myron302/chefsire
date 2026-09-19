/**
 * The file-type box is found wherever it sits, not only as the first box.
 *
 * THE FINDING. Detection required `head.subarray(4, 8) === "ftyp"` before it would parse anything -- that is, it
 * assumed `ftyp` is the file's first top-level box. That is the common layout, not a guarantee. A remuxer that
 * rewrites a file in place leaves the space it reclaimed as a leading `free` box; QuickTime writers emit `wide`
 * as a placeholder ahead of `mdat`; `skip` serves the same purpose as `free`.
 *
 * WHAT REPRODUCED ON HEAD f3f29e2, with `detectMediaContainer` on each fixture:
 *
 *   free(16) + ftyp(major isom, compatible [isom, mp42]) + moov + mdat   -> null   (validate: content_mismatch)
 *   skip(8)  + ftyp(major mp42, compatible [isom])       + moov + mdat   -> null
 *   wide(0)  + ftyp(major "qt  ")                        + moov + mdat   -> null
 *   ftyp(major isom, compatible [isom, mp42])            + moov + mdat   -> {video, mp4}   (the control)
 *
 * So three valid files the product accepts by policy were refused at the door, while the identical file with the
 * padding box removed was accepted. That is a correctness defect, and it is the kind that trains people to work
 * around the validator.
 *
 * WHAT THE FIX DOES. `locateFtypBox` walks a bounded number of leading boxes to find `ftyp`, and walks past only
 * `free`, `skip` and `wide` -- the three boxes the ISO and QuickTime specifications define as content-free
 * padding. Every length in the walk comes from the file, so every one of them is checked: the 64-bit extended
 * size, the "to end of file" size, sizes smaller than their own header, offsets that would leave the bounded
 * head, steps that do not move forward, and the number of boxes visited. Once found, the box goes through the
 * SAME `parseFtypBox` and `videoFormatForFtyp` as before, so the compatible-brands rule and the HEIF veto are
 * unchanged -- walking changes where the deciding box is found, never what it decides.
 *
 * CLASSIC QUICKTIME WITHOUT `ftyp` IS DELIBERATELY STILL REFUSED. See the last section.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import {
  MEDIA_HEAD_BYTES,
  detectMediaContainer,
  locateFtypBox,
  parseFtypBox,
  validateUploadedMedia,
} from "./media-validation";

/* ------------------------------------------------------------------ ISO base media fixtures, byte by byte */

/** One top-level box: a 32-bit big-endian size covering the whole box, a four-character type, then the body. */
function box(type: string, body: Buffer = Buffer.alloc(0)): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, body]);
}

/** A box whose declared size is whatever the test says, regardless of how many bytes actually follow. */
function boxWithSize(type: string, declaredSize: number, bodyBytes = 8): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(declaredSize, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, Buffer.alloc(bodyBytes, 0)]);
}

/** A box using the 64-bit extended size form: `size` is 1, and an eight-byte `largesize` follows the type. */
function largeBox(type: string, high: number, low: number, bodyBytes = 0): Buffer {
  const header = Buffer.alloc(16);
  header.writeUInt32BE(1, 0);
  header.write(type, 4, "latin1");
  header.writeUInt32BE(high, 8);
  header.writeUInt32BE(low, 12);
  return Buffer.concat([header, Buffer.alloc(bodyBytes, 0)]);
}

function ftyp(majorBrand: string, compatibleBrands: string[] = [], minorVersion = 0): Buffer {
  const minor = Buffer.alloc(4);
  minor.writeUInt32BE(minorVersion, 0);
  return box("ftyp", Buffer.concat([Buffer.from(majorBrand, "latin1"), minor, ...compatibleBrands.map((brand) => Buffer.from(brand, "latin1"))]));
}

const moov = box("moov", Buffer.alloc(64, 0));
const mdat = box("mdat", Buffer.alloc(512, 0x11));
const trailer = Buffer.concat([moov, mdat]);

const detect = (buffer: Buffer) => detectMediaContainer(buffer, buffer.subarray(Math.max(0, buffer.length - 4096)));
const asVideo = (buffer: Buffer, declaredMimeType?: string, originalName?: string) =>
  validateUploadedMedia({ source: { buffer }, allow: ["video"], declaredMimeType, originalName });

/* ------------------------------------------------------------------ the finding */

test("a file whose ftyp sits behind a leading free, skip or wide box is detected", async () => {
  // OBSERVED ON f3f29e2: every one of these was `null`, and the upload was refused as `content_mismatch`.
  for (const [label, leading, brands, expected] of [
    ["free before ftyp", box("free", Buffer.alloc(16, 0)), ["isom", ["isom", "mp42"]], "mp4"],
    ["skip before ftyp", box("skip", Buffer.alloc(8, 0)), ["mp42", ["isom"]], "mp4"],
    ["wide before ftyp", box("wide"), ["qt  ", ["qt  "]], "quicktime"],
  ] as const) {
    const [major, compatible] = brands as [string, string[]];
    const file = Buffer.concat([leading, ftyp(major, compatible), trailer]);
    assert.deepEqual(detect(file), { container: "video", format: expected }, label);
    const result = await asVideo(file);
    assert.equal(result.kind, "accepted", label);
    assert.equal(result.kind === "accepted" && result.format, expected, label);
  }
});

test("the control: the same file with the padding box removed was always accepted", () => {
  // If this ever fails, the fixtures above are not isolating the leading box and the test above proves nothing.
  assert.deepEqual(detect(Buffer.concat([ftyp("isom", ["isom", "mp42"]), trailer])), { container: "video", format: "mp4" });
  assert.deepEqual(detect(Buffer.concat([ftyp("qt  "), trailer])), { container: "video", format: "quicktime" });
});

test("several leading no-op boxes in a row are walked, up to the bound", () => {
  const padding = [box("free", Buffer.alloc(4, 0)), box("wide"), box("skip", Buffer.alloc(12, 0))];
  assert.deepEqual(detect(Buffer.concat([...padding, ftyp("isom", ["mp42"]), trailer])), { container: "video", format: "mp4" });

  // Eight boxes are visited. The eighth visit is the one that can still find `ftyp`, so seven pads work and
  // eight do not -- a chain of tiny boxes cannot be used to make this walk run for long.
  const pad = (count: number) => Array.from({ length: count }, () => box("free"));
  assert.notEqual(locateFtypBox(Buffer.concat([...pad(7), ftyp("isom", ["mp42"]), trailer])), null, "seven pads: found");
  assert.equal(locateFtypBox(Buffer.concat([...pad(8), ftyp("isom", ["mp42"]), trailer])), null, "eight pads: given up on");
  assert.equal(detect(Buffer.concat([...pad(64), ftyp("isom", ["mp42"]), trailer])), null, "sixty-four pads: refused, not walked");
});

/* ------------------------------------------------------------------ every length in the walk is hostile input */

test("a declared size smaller than the box header it sits in is malformed, not a short box", () => {
  for (const declaredSize of [2, 3, 4, 5, 6, 7]) {
    const file = Buffer.concat([boxWithSize("free", declaredSize), ftyp("isom", ["mp42"]), trailer]);
    assert.equal(locateFtypBox(file), null, `declared size ${declaredSize}`);
  }
  // Eight is the header exactly: an empty box, which is legal and is stepped over.
  assert.notEqual(locateFtypBox(Buffer.concat([boxWithSize("free", 8, 0), ftyp("isom", ["mp42"]), trailer])), null, "size 8 is an empty box");
});

test("a size of zero means to end of file, so nothing can follow it", () => {
  // `size === 0` says this box runs to EOF. Anything after it is inside that box, not a sibling -- so an `ftyp`
  // sitting there is not a top-level `ftyp` and is not treated as one.
  const file = Buffer.concat([boxWithSize("free", 0), ftyp("isom", ["mp42"]), trailer]);
  assert.equal(locateFtypBox(file), null);
  assert.equal(detect(file), null);
});

test("the 64-bit extended size form is read as two halves, and every unusable value is refused", () => {
  const tail = Buffer.concat([ftyp("isom", ["mp42"]), trailer]);
  // A usable extended size: high word zero, low word the real box length. 16 is the header alone.
  assert.notEqual(locateFtypBox(Buffer.concat([largeBox("free", 0, 24, 8), tail])), null, "a real extended-size box is stepped over");
  assert.notEqual(locateFtypBox(Buffer.concat([largeBox("free", 0, 16, 0), tail])), null, "an empty extended-size box");

  for (const [label, buffer] of [
    // A non-zero high word means at least 4 GiB, which is far past anything this reads. Refused without
    // arithmetic, so no value ever passes through a conversion that could lose precision.
    ["high word set to one", Buffer.concat([largeBox("free", 1, 0, 8), tail])],
    ["high word at its maximum", Buffer.concat([largeBox("free", 0xffffffff, 0xffffffff, 8), tail])],
    // Smaller than the 16-byte header the extended form itself occupies.
    ["largesize of zero", Buffer.concat([largeBox("free", 0, 0, 8), tail])],
    ["largesize of fifteen", Buffer.concat([largeBox("free", 0, 15, 8), tail])],
    // The eight bytes of largesize are not present at all.
    ["truncated before the largesize", Buffer.from(largeBox("free", 0, 24, 8)).subarray(0, 12)],
  ] as const) {
    assert.equal(locateFtypBox(buffer), null, label);
  }
});

test("a step must move forward and land inside the bytes actually held", () => {
  const tail = Buffer.concat([ftyp("isom", ["mp42"]), trailer]);
  for (const [label, declaredSize] of [
    ["one byte past the buffer", 0x7fffffff],
    ["the full 32-bit maximum", 0xffffffff],
    ["exactly the buffer length, leaving no room for a header", 8 + 8 + tail.length],
  ] as const) {
    assert.equal(locateFtypBox(Buffer.concat([boxWithSize("free", declaredSize), tail])), null, label);
  }
  // And a header that is itself cut short is not read past.
  assert.equal(locateFtypBox(Buffer.from([0, 0, 0, 16, 0x66, 0x72, 0x65])), null, "seven bytes: not even a header");
});

test("only free, skip and wide are walked past -- real structure stops the walk", () => {
  // Walking past a box that carries meaning would mean ignoring evidence about what the file is. `mdat` is
  // attacker-controlled payload of attacker-declared length; `moov`, `pnot` and `PICT` are real structure.
  for (const type of ["mdat", "moov", "pnot", "PICT", "uuid", "meta", "styp", "sidx", "junk"]) {
    const file = Buffer.concat([box(type, Buffer.alloc(16, 0)), ftyp("isom", ["mp42"]), trailer]);
    assert.equal(locateFtypBox(file), null, type);
  }
});

test("a leading free box large enough to push ftyp past the bounded head is refused, not chased", async () => {
  // The head is capped, so a box declaring a size beyond it simply means `ftyp` is not visible. That is the
  // bound working: nothing reads further into the file to go and look.
  const filler = Buffer.alloc(MEDIA_HEAD_BYTES + 4096, 0);
  const file = Buffer.concat([box("free", filler), ftyp("isom", ["mp42"]), trailer]);
  assert.equal(file.length > MEDIA_HEAD_BYTES, true, "the fixture really does exceed the head");
  const result = await asVideo(file, "video/mp4", "clip.mp4");
  assert.equal(result.kind, "rejected");
  assert.equal(result.kind === "rejected" && result.reason, "content_mismatch");
});

/* ------------------------------------------------------------------ what the box decides is unchanged */

test("the HEIF veto still applies to an ftyp found behind a leading box", () => {
  // ChefSire stores no HEIF format, and a HEIF claim anywhere in the brand list disqualifies the file. Moving
  // the box behind a `free` must not move it out from under that rule.
  for (const brands of [["heic", []], ["mif1", ["mp42"]], ["isom", ["avif"]], ["mp42", ["isom", "heic"]]] as const) {
    const [major, compatible] = brands as [string, string[]];
    const file = Buffer.concat([box("free", Buffer.alloc(8, 0)), ftyp(major, compatible), trailer]);
    assert.notEqual(locateFtypBox(file), null, `${major}: the box is still found`);
    assert.equal(detect(file), null, `${major}: and still refused`);
  }
});

test("the compatible-brands rule still applies to an ftyp found behind a leading box", () => {
  const behind = (major: string, compatible: string[]) => detect(Buffer.concat([box("free", Buffer.alloc(8, 0)), ftyp(major, compatible), trailer]));
  // An unrecognised major brand that advertises a known one in its compatible list is honoured.
  assert.deepEqual(behind("iso8", ["iso8", "isom", "mp41"]), { container: "video", format: "mp4" });
  assert.deepEqual(behind("XAVC", ["mp42"]), { container: "video", format: "mp4" });
  assert.deepEqual(behind("XAVC", ["qt  "]), { container: "video", format: "quicktime" });
  // And one that advertises nothing recognisable is still refused, wherever it sits.
  assert.equal(behind("XAVC", []), null);
  assert.equal(behind("XAVC", ["ABCD"]), null);
});

test("a malformed ftyp found behind a leading box is refused by the same parser as before", () => {
  const malformed: [string, Buffer][] = [
    ["size disagrees with the body", boxWithSize("ftyp", 64, 8)],
    ["body is not a whole number of brands", Buffer.concat([(() => { const h = Buffer.alloc(8); h.writeUInt32BE(18, 0); h.write("ftyp", 4, "latin1"); return h; })(), Buffer.alloc(10, 0x61)])],
    ["a brand with unprintable bytes", ftyp("is m", ["mp42"])],
  ];
  for (const [label, bad] of malformed) {
    assert.equal(parseFtypBox(bad), null, `${label}: rejected on its own`);
    assert.equal(locateFtypBox(Buffer.concat([box("free", Buffer.alloc(8, 0)), bad, trailer])), null, `${label}: rejected behind a free box`);
  }
});

test("a file whose FIRST box claims to be ftyp and is not one is still refused outright", () => {
  // Preserved behaviour: such a file is not quietly reconsidered as some other format. Only the weaker claim --
  // a leading `free`/`skip`/`wide` -- falls through to the other detectors.
  const file = Buffer.concat([boxWithSize("ftyp", 64, 8), trailer]);
  assert.equal(detect(file), null);
});

test("four bytes that happen to spell free do not veto the other detectors", () => {
  // A Matroska header whose bytes 4..8 read `free` must still be detected as WebM. The walk starts, gets a
  // nonsense size from the EBML signature, gives up, and the EBML branch below decides -- as it always did.
  const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from("free", "latin1"), Buffer.alloc(16, 0), Buffer.from("webm", "latin1"), Buffer.alloc(256, 0)]);
  assert.equal(webm.subarray(4, 8).toString("latin1"), "free", "the fixture really does look like a leading free box");
  assert.deepEqual(detect(webm), { container: "video", format: "webm" });
});

/* ------------------------------------------------------------------ end to end, and the request is still ignored */

test("a leading-free MP4 is stored under the canonical type and extension, whatever the request claimed", async () => {
  const file = Buffer.concat([box("free", Buffer.alloc(16, 0)), ftyp("isom", ["isom", "mp42"]), trailer]);
  for (const [declared, name] of [["video/mp4", "clip.mp4"], ["text/html", "clip.html"], ["application/octet-stream", "clip.exe"], [undefined, undefined]] as const) {
    const result = await asVideo(file, declared, name);
    assert.equal(result.kind, "accepted", `${declared}/${name}`);
    assert.equal(result.kind === "accepted" && result.format, "mp4", `${declared}/${name}`);
    assert.equal(result.kind === "accepted" && result.extension, "mp4", `${declared}/${name}`);
    assert.equal(result.kind === "accepted" && result.contentType, "video/mp4", `${declared}/${name}`);
  }
  // And a route that does not accept video still refuses it, because finding the box decides the format only.
  const asImage = await validateUploadedMedia({ source: { buffer: file }, allow: ["image"] });
  assert.equal(asImage.kind, "rejected");
  assert.equal(asImage.kind === "rejected" && asImage.reason, "unsupported_media_type");
});

/* ------------------------------------------------------------------ the limitation, stated rather than papered over */

test("classic QuickTime with no ftyp at all is refused, and that is a stated limitation", () => {
  // A `.mov` written before `ftyp` was required identifies itself only by its top-level atom sequence, typically
  // `wide`, `mdat`, `moov`. There is no safe evidence to act on:
  //
  //   - `mdat` is raw payload whose declared length routinely runs to megabytes, so `moov` is usually not even
  //     reachable inside the bounded head -- a rule that depends on reaching it would work on small files and
  //     silently stop working on real ones;
  //   - and accepting `wide` + `mdat` on its own would classify an arbitrary binary as a video because it
  //     carries a familiar four-character name, which is the exact type confusion this module exists to prevent.
  //
  // So it stays refused. This is not a regression: main and every earlier head of this branch refused it too.
  const classic = Buffer.concat([box("wide"), mdat, moov]);
  assert.equal(detect(classic), null, "no ftyp, no classification");

  // The forgery the alternative would have allowed: a `wide` and an `mdat` full of markup.
  const forged = Buffer.concat([box("wide"), box("mdat", Buffer.from("<script>alert(1)</script>".repeat(32)))]);
  assert.equal(detect(forged), null, "and an arbitrary binary wearing two atom names is not a video");

  // What every current writer -- iOS, macOS, ffmpeg, Premiere -- actually emits IS detected, with or without
  // the padding box in front of it.
  assert.deepEqual(detect(Buffer.concat([ftyp("qt  ", ["qt  "]), trailer])), { container: "video", format: "quicktime" });
  assert.deepEqual(detect(Buffer.concat([box("wide"), ftyp("qt  ", ["qt  "]), trailer])), { container: "video", format: "quicktime" });
  assert.deepEqual(detect(Buffer.concat([box("free", Buffer.alloc(8, 0)), ftyp("qt  "), trailer])), { container: "video", format: "quicktime" });
});
