/**
 * A legacy object's extension and stored content type are claims, not evidence.
 *
 * THE FINDING. `triageLegacyObject` answered `keep / canonical_media` whenever the key's extension and the
 * stored content type agreed with the canonical table -- and a `keep` means the runner never fetches the object,
 * so the bytes are never looked at. That reads like proof and is not. The pre-repair uploader took the extension
 * from `file.originalname` and the stored type from `file.mimetype`, which are two halves of the SAME
 * attacker-supplied multipart header, so making them agree costs an attacker nothing at all.
 *
 * WHAT REPRODUCED ON HEAD 97b93e7, through the real runner with `--apply`:
 *
 *   posts/attack.jpg   image/jpeg        HTML bytes   -> keep/canonical_media          bytes never read
 *   posts/attack.png   image/png         HTML bytes   -> keep/canonical_media          bytes never read
 *   posts/photo.jpg    image/jpeg        PNG bytes    -> keep/canonical_media          bytes never read
 *   posts/mismatch.jpg image/png         HTML bytes   -> keep/type_mismatch_left_alone bytes never read
 *   posts/odd.bin      application/pdf   HTML bytes   -> keep/unrecognized_left_alone  bytes never read
 *
 * None of them appeared in the run log at all. The objects this tool exists to find were precisely the ones it
 * skipped -- and `attack.jpg` is the shape the original vulnerability produced most easily.
 *
 * THE TRUST BOUNDARY, STATED. There is no server-controlled proof that any object in the public media bucket was
 * ever byte-validated: `uploadToR2` sends `Bucket`, `Key`, `Body` and `ContentType` and no `Metadata` at all, so
 * nothing distinguishes an object written after the hardening from one written before it. Timestamps, keys,
 * extensions, stored types and uploader metadata are all either attacker-influenced or not a provenance claim.
 * So every in-scope object is treated as unverified and its bytes are read.
 *
 * Exactly two metadata-only keeps survive, and neither is a claim about bytes:
 *
 *   out_of_scope         -- not ChefSire's object to touch, decided by a frozen code-owned prefix list.
 *   already_neutralized  -- octet-stream AND an attachment disposition, the signature THIS tool writes. It is
 *                           not proof the bytes are safe; it is proof the object cannot execute whatever they
 *                           are, which is why re-running is a cheap no-op.
 *
 * AND ONE LEVEL DOWN. `decideLegacyRemediation` used to require `presentsActiveSurface` -- a metadata test --
 * before neutralizing bytes the validator had already refused. Refused bytes are now neutralized whatever the
 * metadata claims: when the bytes were read, the bytes decide alone.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  LEGACY_INSPECT_MAX_BYTES,
  triageLegacyObject,
  type LegacyObjectMetadata,
} from "./legacy-media-remediation";
import { runLegacyRemediation, type LegacyObjectStore } from "./legacy-media-remediation-run";

/* ------------------------------------------------------------------ fixtures */

const jpeg = await sharp({ create: { width: 48, height: 32, channels: 3, background: { r: 200, g: 40, b: 90 } } }).jpeg().toBuffer();
const png = await sharp({ create: { width: 48, height: 32, channels: 3, background: { r: 10, g: 90, b: 200 } } }).png().toBuffer();
const html = Buffer.from("<!doctype html><html><body><script>alert(document.domain)</script></body></html>");
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    let byte = (crc ^ buffer[index]!) & 0xff;
    for (let bit = 0; bit < 8; bit++) byte = byte & 1 ? 0xedb88320 ^ (byte >>> 1) : byte >>> 1;
    crc = (crc >>> 8) ^ byte;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A real ZIP, so the DOCX cases go through the same hardened package parser new uploads use. */
function buildZip(entries: readonly { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "latin1");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(entry.data), 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const block = Buffer.concat([local, name, entry.data]);
    locals.push(block);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt32LE(crc32(entry.data), 16);
    header.writeUInt32LE(entry.data.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([header, name]));
    offset += block.length;
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

const part = (name: string) => ({ name, data: Buffer.from("<x/>") });
const realDocx = buildZip([part("[Content_Types].xml"), part("_rels/.rels"), part("word/document.xml")]);
const plainZip = buildZip([part("notes.txt"), part("data/readme.md")]);
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/* ------------------------------------------------------------------ a recording store */

type Stored = { body: Buffer; contentType: string; contentDisposition?: string; cacheControl?: string };
type Call = { op: "list" | "head" | "get" | "setMetadata"; key: string };

function recordingStore(objects: Record<string, Stored>) {
  const calls: Call[] = [];
  const state = new Map(Object.entries(objects));
  const store: LegacyObjectStore = {
    async list(prefix) {
      calls.push({ op: "list", key: prefix });
      return { keys: [...state.keys()].filter((key) => key.startsWith(prefix)) };
    },
    async head(key) {
      calls.push({ op: "head", key });
      const object = state.get(key)!;
      return { contentType: object.contentType, contentDisposition: object.contentDisposition, cacheControl: object.cacheControl, size: object.body.length };
    },
    async get(key, maxBytes) {
      calls.push({ op: "get", key });
      const object = state.get(key)!;
      // The real adapter refuses at the read rather than after it; the stub mirrors that bound.
      return object.body.length > maxBytes ? null : object.body;
    },
    async setMetadata(key, plan) {
      calls.push({ op: "setMetadata", key });
      const object = state.get(key)!;
      state.set(key, { body: object.body, contentType: plan.contentType!, contentDisposition: plan.contentDisposition, cacheControl: plan.cacheControl });
    },
  };
  return { store, calls, state };
}

/** One object through the real runner, applying. */
async function remediate(key: string, stored: Stored, options: { apply?: boolean } = {}) {
  const recorder = recordingStore({ [key]: stored });
  const outcome = await runLegacyRemediation(recorder.store, { apply: options.apply ?? true, requestedPrefixes: [], max: Infinity });
  const line = outcome.log.find((entry) => entry.key === key);
  return {
    triage: triageLegacyObject({ key, contentType: stored.contentType, contentDisposition: stored.contentDisposition }),
    read: recorder.calls.some((call) => call.op === "get" && call.key === key),
    wrote: recorder.calls.some((call) => call.op === "setMetadata" && call.key === key),
    // A `keep` is counted in the summary and deliberately not logged -- a line per untouched object would bury
    // the run report on a large bucket -- so a kept object is asserted through the summary instead.
    action: line?.action ?? (outcome.summary.already_correct > 0 ? "keep" : "(absent from the log)"),
    reason: line?.reason ?? (outcome.summary.already_correct > 0 ? "already_correct" : "(absent from the log)"),
    after: recorder.state.get(key)!,
    outcome,
  };
}

/* ------------------------------------------------------------------ the P1, exactly as reported */

test("attack.jpg stored as image/jpeg with HTML bytes cannot be final-kept", async () => {
  // OBSERVED ON 97b93e7: triage `keep / canonical_media`, bytes never read, absent from the run log entirely.
  const result = await remediate("posts/attack.jpg", { body: html, contentType: "image/jpeg" });

  assert.equal(result.triage.action, "inspect", "metadata no longer ends the matter");
  assert.equal(result.triage.reason, "canonical_metadata_unverified");
  assert.equal(result.read, true, "the bytes are actually fetched");
  assert.equal(result.action, "neutralize", `got ${result.action}/${result.reason}`);
  assert.equal(result.reason, "active_content");
  assert.equal(result.wrote, true);

  // Neutralized in place: inert type, forced download, uncacheable -- bytes and key untouched.
  assert.equal(result.after.contentType, "application/octet-stream");
  assert.equal(result.after.contentDisposition, "attachment");
  assert.equal(result.after.cacheControl, "no-store");
  assert.equal(result.after.body.equals(html), true, "the bytes are preserved, never destroyed");
});

test("the same spoof in every shape the old uploader could produce", async () => {
  for (const [label, key, contentType, body] of [
    ["png key and png type, HTML bytes", "posts/attack.png", "image/png", html],
    ["webp key and webp type, HTML bytes", "posts/attack.webp", "image/webp", html],
    ["gif key and gif type, HTML bytes", "posts/attack.gif", "image/gif", html],
    ["mp4 key and mp4 type, HTML bytes", "posts/attack.mp4", "video/mp4", html],
    ["jpg key and jpeg type, SVG bytes", "posts/attack.jpg", "image/jpeg", svg],
    ["avatar under a canonical name", "avatars/avatar-uuid.png", "image/png", html],
    ["review photo under a canonical name", "reviews/review-1-2.jpg", "image/jpeg", html],
    ["type mismatch, HTML bytes", "posts/mismatch.jpg", "image/png", html],
    ["unrecognised extension, HTML bytes", "posts/odd.bin", "application/pdf", html],
    ["no extension at all, HTML bytes", "posts/plain", "image/jpeg", html],
  ] as const) {
    const result = await remediate(key, { body, contentType });
    assert.equal(result.read, true, `${label}: read`);
    assert.equal(result.action, "neutralize", `${label}: ${result.action}/${result.reason}`);
    assert.equal(result.after.contentType, "application/octet-stream", label);
    assert.equal(result.after.contentDisposition, "attachment", label);
    assert.equal(result.after.body.length, body.length, `${label}: bytes preserved`);
  }
});

/* ------------------------------------------------------------------ legitimate media survives the reading */

test("a genuine JPEG under a canonical key and type is read and then left completely alone", async () => {
  const result = await remediate("posts/real.jpg", { body: jpeg, contentType: "image/jpeg" });
  assert.equal(result.read, true, "it is inspected");
  assert.equal(result.action, "keep");
  assert.equal(result.reason, "already_correct");
  assert.equal(result.wrote, false, "and nothing is rewritten");
  assert.equal(result.after.contentType, "image/jpeg", "its served type is untouched");
  assert.equal(result.after.contentDisposition, undefined, "it still renders inline");
});

test("real media whose stored type disagrees is corrected, not quarantined", async () => {
  // A `.jpg` key and an `image/jpeg` type over bytes that are really a PNG. The bytes are legitimate media, so
  // the honest action is to pin the type they actually are -- never to neutralize, and never to rename.
  const result = await remediate("posts/photo.jpg", { body: png, contentType: "image/jpeg" });
  assert.equal(result.read, true);
  assert.equal(result.action, "pin_content_type");
  assert.equal(result.reason, "valid_media_wrong_type");
  assert.equal(result.after.contentType, "image/png", "pinned to what the bytes are");
  assert.equal(result.after.contentDisposition, undefined, "still renders inline");
  assert.equal(result.after.body.equals(png), true);
});

test("every canonical format is inspected and then kept when its bytes really match", async () => {
  for (const [label, key, contentType, body] of [
    ["jpeg", "posts/a.jpg", "image/jpeg", jpeg],
    ["png", "posts/b.png", "image/png", png],
    ["docx", "posts/c.docx", DOCX_TYPE, realDocx],
  ] as const) {
    const result = await remediate(key, { body, contentType });
    assert.equal(result.read, true, `${label}: inspected`);
    assert.equal(result.action, "keep", `${label}: ${result.action}/${result.reason}`);
    assert.equal(result.reason, "already_correct", label);
    assert.equal(result.wrote, false, label);
  }
});

test("a .docx key with the Word type over a plain archive is not left claiming to be a document", async () => {
  // The bytes are a valid ZIP but not an OOXML package, so the stored Word type is a false claim. It is real
  // media of a different kind, so it is pinned to what it is rather than neutralized.
  const result = await remediate("posts/fake.docx", { body: plainZip, contentType: DOCX_TYPE });
  assert.equal(result.read, true);
  assert.equal(result.action, "pin_content_type");
  assert.equal(result.after.contentType, "application/zip", "pinned to what the archive actually is");
  assert.equal(result.after.body.equals(plainZip), true);
});

/* ------------------------------------------------------------------ the two keeps that survive, and why */

test("only two metadata-only keeps remain, and neither is a claim about bytes", () => {
  // Out of scope: not ChefSire's object, decided by a frozen code-owned prefix list.
  for (const key of ["catering-bookings/b/f/f.pdf", "some-other-app/x.jpg", "backups/dump.jpg", "postsomething/x.jpg"]) {
    assert.deepEqual(triageLegacyObject({ key, contentType: "image/jpeg" }), { action: "keep", reason: "out_of_scope" }, key);
  }
  // Already neutralized: not proof the bytes are safe -- proof the object cannot execute whatever they are.
  assert.deepEqual(
    triageLegacyObject({ key: "posts/was-dangerous.html", contentType: "application/octet-stream", contentDisposition: "attachment" }),
    { action: "keep", reason: "already_neutralized" },
  );
  // Everything else, without exception, is inspected.
  for (const [key, contentType] of [
    ["posts/a.jpg", "image/jpeg"], ["posts/b.png", "image/png"], ["posts/c.webp", "image/webp"],
    ["posts/d.mp4", "video/mp4"], ["posts/e.jpg", "image/png"], ["posts/f.bin", "application/pdf"],
    ["posts/g", ""], ["posts/h.html", "text/html"], ["posts/i.svg", "image/svg+xml"],
  ] as const) {
    assert.equal(triageLegacyObject({ key, contentType }).action, "inspect", `${key} / ${contentType}`);
  }
});

test("re-running is still a cheap no-op over objects this tool already neutralized", async () => {
  const recorder = recordingStore({
    "posts/done.html": { body: html, contentType: "application/octet-stream", contentDisposition: "attachment" },
  });
  const outcome = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.equal(recorder.calls.some((call) => call.op === "get"), false, "not fetched again");
  assert.equal(recorder.calls.some((call) => call.op === "setMetadata"), false, "not rewritten again");
  assert.equal(outcome.summary.already_neutralized, 1);
});

test("remediating twice reaches the same state and stops", async () => {
  const recorder = recordingStore({ "posts/attack.jpg": { body: html, contentType: "image/jpeg" } });
  await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  const writesAfterFirst = recorder.calls.filter((call) => call.op === "setMetadata").length;
  assert.equal(writesAfterFirst, 1);

  await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.equal(recorder.calls.filter((call) => call.op === "setMetadata").length, 1, "the second run writes nothing");
  assert.equal(recorder.state.get("posts/attack.jpg")!.body.equals(html), true, "and the bytes are still there");
});

/* ------------------------------------------------------------------ failure, bounds and dry run */

test("a dry run inspects enough to report accurately, and mutates nothing", async () => {
  const recorder = recordingStore({
    "posts/attack.jpg": { body: html, contentType: "image/jpeg" },
    "posts/real.jpg": { body: jpeg, contentType: "image/jpeg" },
  });
  const outcome = await runLegacyRemediation(recorder.store, { apply: false, requestedPrefixes: [], max: Infinity });

  assert.equal(recorder.calls.filter((call) => call.op === "get").length, 2, "a dry run still reads the bytes");
  assert.equal(recorder.calls.some((call) => call.op === "setMetadata"), false, "and writes nothing at all");
  assert.equal(recorder.state.get("posts/attack.jpg")!.contentType, "image/jpeg", "the object is untouched");

  const spoof = outcome.log.find((line) => line.key === "posts/attack.jpg")!;
  assert.equal(spoof.action, "would neutralize", "but it reports exactly what applying would do");
  assert.equal(spoof.reason, "active_content");
  // The legitimate one is counted as kept rather than logged, and it was still read to establish that.
  assert.equal(outcome.summary.already_correct, 1);
  assert.equal(outcome.log.some((line) => line.key === "posts/real.jpg"), false, "a kept object adds no noise");
});

test("an object too large to read falls back to the metadata rule rather than guessing", async () => {
  // Beyond the bound the tool has no bytes, so the R8 rule applies: an active surface is neutralized unread, and
  // an inert one is reported. A big legitimate video under a canonical key is NOT swept up by this correction.
  const oversized = Buffer.alloc(LEGACY_INSPECT_MAX_BYTES + 1, 0x41);
  const video = await remediate("posts/big.mp4", { body: oversized, contentType: "video/mp4" });
  assert.equal(video.action, "report", `got ${video.action}/${video.reason}`);
  assert.equal(video.reason, "too_large_to_inspect");
  assert.equal(video.wrote, false, "a large legitimate-looking video is not quarantined");

  const active = await remediate("posts/big.html", { body: oversized, contentType: "image/jpeg" });
  assert.equal(active.action, "neutralize");
  assert.equal(active.reason, "too_large_active_surface");
});

test("a read failure is recorded as a failure, never silently turned into a keep", async () => {
  const recorder = recordingStore({ "posts/broken.jpg": { body: jpeg, contentType: "image/jpeg" } });
  const failing: LegacyObjectStore = { ...recorder.store, async get() { throw new Error("network reset"); } };
  const outcome = await runLegacyRemediation(failing, { apply: true, requestedPrefixes: [], max: Infinity });

  assert.equal(outcome.failures.length, 1);
  assert.equal(outcome.failures[0]!.key, "posts/broken.jpg");
  assert.equal(outcome.ok, false, "the run did not succeed");
  assert.equal(outcome.log.some((line) => line.key === "posts/broken.jpg" && line.action.includes("keep")), false, "and it was never kept");
});

test("the bytes are read under the existing bounded read, not a new one", async () => {
  // The runner asks the store for at most LEGACY_INSPECT_MAX_BYTES, which the real adapter enforces with a
  // ranged request and an incremental stream. Inspecting more objects must not mean reading them differently.
  const seen: number[] = [];
  const recorder = recordingStore({ "posts/a.jpg": { body: jpeg, contentType: "image/jpeg" } });
  const watched: LegacyObjectStore = {
    ...recorder.store,
    async get(key, maxBytes) { seen.push(maxBytes); return recorder.store.get(key, maxBytes); },
  };
  await runLegacyRemediation(watched, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.deepEqual(seen, [LEGACY_INSPECT_MAX_BYTES]);
  assert.equal(LEGACY_INSPECT_MAX_BYTES, 25 * 1024 * 1024);
});

test("the scope boundary still holds: nothing outside the owned prefixes is fetched", async () => {
  const recorder = recordingStore({
    "posts/in.jpg": { body: html, contentType: "image/jpeg" },
    "some-other-app/out.jpg": { body: html, contentType: "image/jpeg" },
  });
  await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.equal(recorder.calls.some((call) => call.key === "some-other-app/out.jpg"), false, "never even headed");
  assert.equal(recorder.state.get("some-other-app/out.jpg")!.contentType, "image/jpeg", "and untouched");
  assert.equal(recorder.state.get("posts/in.jpg")!.contentType, "application/octet-stream", "while the in-scope spoof is remediated");
});

test("nothing is ever deleted or renamed, on any path this correction touches", async () => {
  const recorder = recordingStore({ "posts/attack.jpg": { body: html, contentType: "image/jpeg" } });
  assert.equal("delete" in recorder.store, false, "the storage port exposes no delete at all");
  await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.deepEqual([...recorder.state.keys()], ["posts/attack.jpg"], "the key is unchanged");
  assert.equal(recorder.state.get("posts/attack.jpg")!.body.equals(html), true, "the bytes are unchanged");
});

test("metadata a legitimate object carries is still preserved through a pin", async () => {
  // Requirement of the R4 correction, re-asserted here because this round sends far more objects down the path.
  const recorder = recordingStore({
    "posts/photo.jpg": { body: png, contentType: "image/jpeg", cacheControl: "public, max-age=3600" },
  });
  await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  const after = recorder.state.get("posts/photo.jpg")!;
  assert.equal(after.contentType, "image/png", "the type is pinned to the bytes");
  assert.equal(after.cacheControl, "public, max-age=3600", "and unrelated metadata survives");
});

test("an object metadata cannot even be read for is a failure, not a keep", async () => {
  const recorder = recordingStore({ "posts/a.jpg": { body: jpeg, contentType: "image/jpeg" } });
  const failing: LegacyObjectStore = { ...recorder.store, async head() { throw new Error("403"); } };
  const outcome = await runLegacyRemediation(failing, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.equal(outcome.failures.length, 1);
  assert.equal(outcome.ok, false);
});

/* ------------------------------------------------------------------ the validator doing the deciding */

test("inspection uses the same hardened validator new uploads use, not a second weaker one", async () => {
  // Everything the upload boundary refuses, the remediation refuses too -- including the package rules this PR
  // corrected in earlier rounds, so a legacy object cannot slip through on a defect already fixed upstream.
  const zipWithEpubText = buildZip([{ name: "a.txt", data: Buffer.from("application/epub+zip") }]);
  const caseMutatedDocx = buildZip([part("[content_types].xml"), part("WORD/document.xml")]);

  for (const [label, key, contentType, body, expectedType] of [
    ["HTML", "posts/a.jpg", "image/jpeg", html, "application/octet-stream"],
    ["SVG", "posts/b.png", "image/png", svg, "application/octet-stream"],
    ["truncated JPEG", "posts/c.jpg", "image/jpeg", jpeg.subarray(0, Math.floor(jpeg.length * 0.5)), "application/octet-stream"],
    ["a ZIP merely containing the EPUB media type", "posts/d.epub", "application/epub+zip", zipWithEpubText, "application/zip"],
    ["a case-mutated OOXML lookalike", "posts/e.docx", DOCX_TYPE, caseMutatedDocx, "application/zip"],
  ] as const) {
    const result = await remediate(key, { body, contentType });
    assert.equal(result.read, true, label);
    assert.equal(result.after.contentType, expectedType, `${label}: ${result.action}/${result.reason}`);
    assert.equal(result.after.body.length, body.length, `${label}: bytes preserved`);
  }
});
