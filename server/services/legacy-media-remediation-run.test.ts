/**
 * The remediation run, end to end, against a stubbed object store.
 *
 * Every assertion here is about what the run DOES to storage, not about what it decides in the abstract. The
 * store records every call, so "no Put/Copy/Delete occurred" is a fact the tests can check rather than a claim.
 *
 * The two review findings against head 70a24fd are the spine of this file:
 *   - an invalid `--prefix` must stop the run before a single listing, let alone a mutation;
 *   - a real JPEG sitting under a `.html` key must survive, because the original vulnerability put it there.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { NEUTRALIZED_CONTENT_TYPE } from "./legacy-media-remediation";
import { runLegacyRemediation, type LegacyObjectStore } from "./legacy-media-remediation-run";

/* ------------------------------------------------------------------ a recording stub */

type StoredObject = {
  body: Buffer;
  contentType?: string; contentDisposition?: string; cacheControl?: string;
  contentEncoding?: string; contentLanguage?: string; expires?: string;
  metadata?: Record<string, string>; websiteRedirectLocation?: string;
};

type Recorder = {
  store: LegacyObjectStore;
  objects: Map<string, StoredObject>;
  calls: { op: string; key: string }[];
  failOn?: { op: "head" | "get" | "setMetadata"; key: string };
};

function recordingStore(initial: Record<string, StoredObject>, failOn?: Recorder["failOn"]): Recorder {
  const objects = new Map(Object.entries(initial));
  const calls: { op: string; key: string }[] = [];
  const store: LegacyObjectStore = {
    async list(prefix) {
      calls.push({ op: "list", key: prefix });
      return { keys: [...objects.keys()].filter((key) => key.startsWith(prefix)) };
    },
    async head(key) {
      calls.push({ op: "head", key });
      if (failOn?.op === "head" && failOn.key === key) throw new Error("head failed");
      const object = objects.get(key);
      if (!object) throw new Error("no such key");
      const { body, ...metadata } = object;
      return { ...metadata, size: body.length };
    },
    async get(key, maxBytes) {
      calls.push({ op: "get", key });
      if (failOn?.op === "get" && failOn.key === key) throw new Error("get failed");
      const object = objects.get(key);
      if (!object) return null;
      return object.body.length > maxBytes ? null : object.body;
    },
    async setMetadata(key, plan) {
      calls.push({ op: "setMetadata", key });
      if (failOn?.op === "setMetadata" && failOn.key === key) throw new Error("copy failed");
      const object = objects.get(key)!;
      // Real CopyObject + MetadataDirective REPLACE keeps the bytes and the key and writes EXACTLY the supplied
      // metadata, dropping anything absent. The stub mirrors that, so a plan that forgets a field shows up here.
      objects.set(key, {
        body: object.body,
        contentType: plan.contentType,
        contentDisposition: plan.contentDisposition,
        cacheControl: plan.cacheControl,
        contentEncoding: plan.contentEncoding,
        contentLanguage: plan.contentLanguage,
        expires: plan.expires,
        metadata: plan.metadata,
        websiteRedirectLocation: plan.websiteRedirectLocation,
      });
    },
  };
  return { store, objects, calls, failOn };
}

const mutations = (recorder: Recorder) => recorder.calls.filter((call) => call.op === "setMetadata");

/* ------------------------------------------------------------------ fixtures */

const jpeg = await sharp({ create: { width: 32, height: 24, channels: 3, background: { r: 200, g: 40, b: 90 } } }).jpeg().toBuffer();
const png = await sharp({ create: { width: 32, height: 24, channels: 3, background: { r: 10, g: 90, b: 200 } } }).png().toBuffer();
const htmlBytes = Buffer.from("<!doctype html><script>alert(document.domain)</script>");
const svgBytes = Buffer.from(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);

/* ------------------------------------------------------------------ FINDING 1: scope */

test("an invalid prefix stops the run before a single storage call", async () => {
  for (const bad of ["", "post", "posts", "/", "../", "unrelated/", "catering-bookings/"]) {
    const recorder = recordingStore({ "posts/a.html": { body: htmlBytes, contentType: "image/jpeg" } });
    const outcome = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [bad], max: Infinity });
    assert.equal(outcome.ok, false, JSON.stringify(bad));
    assert.deepEqual(outcome.rejectedPrefixes && [...outcome.rejectedPrefixes], [bad], JSON.stringify(bad));
    // The decisive assertion: not one call was made, so nothing could have been listed, read or written.
    assert.deepEqual(recorder.calls, [], `${JSON.stringify(bad)} must not reach the store`);
  }
});

test("a valid prefix narrows the run to exactly that prefix", async () => {
  const recorder = recordingStore({
    "posts/a.html": { body: jpeg, contentType: "image/jpeg" },
    "avatars/b.html": { body: jpeg, contentType: "image/jpeg" },
  });
  const outcome = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: ["posts/"], max: Infinity });
  assert.equal(outcome.ok, true);
  assert.deepEqual(recorder.calls.filter((c) => c.op === "list").map((c) => c.key), ["posts/"]);
  assert.deepEqual(mutations(recorder).map((c) => c.key), ["posts/a.html"], "the avatar was never touched");
});

test("a key outside the owned boundary is never read or written, even if a listing returns it", async () => {
  // A listing that yields keys outside what was asked for -- a proxy, a stub, a future refactor. The boundary is
  // re-checked per key precisely so this cannot become a mutation.
  const recorder = recordingStore({
    "posts/good.html": { body: jpeg, contentType: "image/jpeg" },
    "postsomething/evil.html": { body: htmlBytes, contentType: "text/html" },
    "unrelated/tenant-b.html": { body: htmlBytes, contentType: "text/html" },
    "catering-bookings/b/f/f.pdf": { body: Buffer.from("%PDF-1.7\nstartxref\n0\n%%EOF\n"), contentType: "application/pdf" },
  });
  recorder.store.list = async (prefix) => {
    recorder.calls.push({ op: "list", key: prefix });
    return { keys: [...recorder.objects.keys()] }; // deliberately ignores the prefix
  };
  const outcome = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.equal(outcome.ok, true);
  for (const foreign of ["postsomething/evil.html", "unrelated/tenant-b.html", "catering-bookings/b/f/f.pdf"]) {
    assert.equal(recorder.calls.some((call) => call.key === foreign && call.op !== "list"), false, foreign);
    assert.equal(recorder.objects.get(foreign)!.contentType, foreign.endsWith(".pdf") ? "application/pdf" : "text/html", `${foreign} unchanged`);
  }
});

/* ------------------------------------------------------------------ FINDING 2: the bytes decide */

test("a real JPEG under a .html key is PRESERVED with its verified type pinned", async () => {
  // OBSERVED ON 70a24fd: `--delete-illegitimate` would have deleted this. It is a user's photo, uploaded as
  // `photo.html` through the original vulnerability.
  const recorder = recordingStore({ "posts/uuid.html": { body: jpeg, contentType: "image/jpeg" } });
  const outcome = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  const object = recorder.objects.get("posts/uuid.html")!;
  assert.equal(object.body.equals(jpeg), true, "the bytes are untouched");
  assert.equal(recorder.objects.has("posts/uuid.html"), true, "the key is untouched, so every DB reference still resolves");
  assert.equal(object.contentType, "image/jpeg", "the verified type is pinned");
  assert.notEqual(object.contentType, NEUTRALIZED_CONTENT_TYPE, "it is not neutralized: it is real media");
  assert.equal(outcome.unsafeKeysRetained, 1, "and the unsafe key is reported rather than silently accepted");
});

test("bytes that really are HTML or SVG are neutralized in place", async () => {
  const recorder = recordingStore({
    "posts/attack.html": { body: htmlBytes, contentType: "image/jpeg" },
    "posts/attack.svg": { body: svgBytes, contentType: "image/svg+xml" },
  });
  await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  for (const key of ["posts/attack.html", "posts/attack.svg"]) {
    const object = recorder.objects.get(key)!;
    assert.equal(object.contentType, NEUTRALIZED_CONTENT_TYPE, key);
    assert.equal(object.contentDisposition, "attachment", key);
    assert.equal(object.body.length > 0, true, `${key}: the bytes are preserved, not destroyed`);
    assert.equal(recorder.objects.has(key), true, `${key}: the key still exists, so references still resolve`);
  }
});

test("canonical-looking media IS read, and real media survives the reading", async () => {
  // THIS TEST ASSERTED THE DEFECT until R11: it pinned that an object whose extension and stored type agree is
  // "not even fetched". That is exactly how `posts/attack.jpg` stored as `image/jpeg` with an HTML body escaped
  // the tool entirely. Every in-scope object is now fetched under the existing bounded read.
  const recorder = recordingStore({
    "posts/fine.jpg": { body: jpeg, contentType: "image/jpeg" },
    "avatars/fine.png": { body: png, contentType: "image/png" },
  });
  const outcome = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.equal(recorder.calls.filter((call) => call.op === "get").length, 2, "both are fetched now");
  assert.equal(outcome.inspected, 2);
  // And having been read, genuine media is left exactly alone -- no rewrite, no neutralization.
  assert.deepEqual(mutations(recorder), [], "nothing legitimate is touched");
  // A keep is counted, not logged -- so assert the count, not an empty log, which would pass vacuously.
  assert.equal(outcome.summary.already_correct, 2, "both were kept on the evidence of their bytes");
  assert.deepEqual(outcome.log, [], "and a kept object adds no line to the report");
});

test("an object too large to read is neutralized when it presents an active surface", async () => {
  // THIS TEST ASSERTED THE DEFECT until R8: it pinned "reported, never modified" for a 26 MB object under a
  // `.html` key, so `--apply` left an executable stored-XSS URL in place. Everything that reaches inspection
  // presents an active surface -- triage only returns `inspect` for an active type, an active extension or a
  // missing type -- so an oversized one is neutralized without being read.
  const recorder = recordingStore({ "posts/huge.html": { body: Buffer.alloc(26 * 1024 * 1024, 0x41), contentType: "video/mp4" } });
  const outcome = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });

  const changes = mutations(recorder);
  assert.equal(changes.length, 1, "exactly one object rewritten");
  assert.equal(changes[0]!.key, "posts/huge.html", "and it is the one under the active key");
  assert.equal(outcome.summary.too_large_active_surface, 1);
  assert.equal(outcome.log.some((line) => line.action === "neutralize" && line.reason === "too_large_active_surface"), true);

  // Metadata only. The bytes and the key are untouched, so the change is reversible and every reference to it
  // keeps resolving -- the same guarantee every other remediation path gives.
  const after = recorder.objects.get("posts/huge.html")!;
  assert.equal(after.contentType, "application/octet-stream");
  assert.equal(after.contentDisposition, "attachment");
  assert.equal(after.cacheControl, "no-store");
  assert.equal(after.body.length, 26 * 1024 * 1024, "the bytes are untouched");
  assert.equal(recorder.objects.has("posts/huge.html"), true, "and the key is untouched");

  // And it was neutralized WITHOUT the oversized body ever being materialised: the bounded read refused it.
  assert.equal(outcome.inspected, 0, "nothing was successfully read");
});

/* ------------------------------------------------------------------ dry run and idempotence */

test("a dry run makes no mutation at all but reports the same candidates", async () => {
  const objects = {
    "posts/attack.html": { body: htmlBytes, contentType: "image/jpeg" },
    "posts/photo.html": { body: jpeg, contentType: "image/jpeg" },
  };
  const dry = recordingStore({ ...objects });
  const dryOutcome = await runLegacyRemediation(dry.store, { apply: false, requestedPrefixes: [], max: Infinity });
  assert.deepEqual(mutations(dry), [], "dry run is the default posture and writes nothing");
  assert.equal(dryOutcome.mutated, 0);
  assert.equal(dryOutcome.candidates, 2);
  assert.equal(dry.objects.get("posts/attack.html")!.contentType, "image/jpeg", "unchanged");

  const wet = recordingStore({ ...objects });
  const wetOutcome = await runLegacyRemediation(wet.store, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.equal(wetOutcome.candidates, dryOutcome.candidates, "apply acts on exactly what the dry run listed");
  assert.equal(wetOutcome.mutated, 2);
});

test("apply is safely rerunnable and does not rewrite an object twice", async () => {
  const recorder = recordingStore({
    "posts/attack.html": { body: htmlBytes, contentType: "image/jpeg" },
    "posts/photo.html": { body: jpeg, contentType: "image/jpeg" },
    "posts/fine.jpg": { body: jpeg, contentType: "image/jpeg" },
  });
  const first = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.equal(first.mutated, 2);

  const before = new Map([...recorder.objects].map(([key, object]) => [key, { ...object }]));
  recorder.calls.length = 0;
  const second = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });

  // The neutralized object carries its own "already done" signature and is skipped entirely.
  assert.equal(second.summary.already_neutralized, 1);
  assert.equal(mutations(recorder).some((call) => call.key === "posts/attack.html"), false, "not rewritten again");
  for (const [key, object] of before) {
    assert.deepEqual({ ...recorder.objects.get(key)! }, object, `${key} is byte- and metadata-identical after a second run`);
  }
  const third = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.equal(third.ok, true);
});

/* ------------------------------------------------------------------ failure behaviour */

test("a failure part-way through is reported and never counted as success", async () => {
  const recorder = recordingStore(
    {
      "posts/a.html": { body: htmlBytes, contentType: "image/jpeg" },
      "posts/b.html": { body: htmlBytes, contentType: "image/jpeg" },
      "posts/c.html": { body: htmlBytes, contentType: "image/jpeg" },
    },
    { op: "setMetadata", key: "posts/b.html" },
  );
  const outcome = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  assert.equal(outcome.ok, false, "a failed object means the run did not succeed");
  assert.equal(outcome.failures.length, 1);
  assert.equal(outcome.failures[0]!.key, "posts/b.html");
  // One failure does not abort the rest.
  assert.equal(outcome.mutated, 2);
  assert.equal(recorder.objects.get("posts/a.html")!.contentType, NEUTRALIZED_CONTENT_TYPE);
  assert.equal(recorder.objects.get("posts/c.html")!.contentType, NEUTRALIZED_CONTENT_TYPE);
  // The one that failed is left exactly as it was, not half-written.
  assert.equal(recorder.objects.get("posts/b.html")!.contentType, "image/jpeg");
});

test("an object whose metadata or bytes cannot be read is reported, not guessed at", async () => {
  for (const op of ["head", "get"] as const) {
    const recorder = recordingStore({ "posts/a.html": { body: htmlBytes, contentType: "image/jpeg" } }, { op, key: "posts/a.html" });
    const outcome = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
    assert.equal(outcome.ok, false, op);
    assert.equal(outcome.failures.length, 1, op);
    assert.deepEqual(mutations(recorder), [], `${op}: nothing was written on the strength of a failed read`);
  }
});

test("the run bound stops after the requested number of candidates", async () => {
  const recorder = recordingStore({
    "posts/a.html": { body: htmlBytes, contentType: "image/jpeg" },
    "posts/b.html": { body: htmlBytes, contentType: "image/jpeg" },
    "posts/c.html": { body: htmlBytes, contentType: "image/jpeg" },
  });
  const outcome = await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: 2 });
  assert.equal(outcome.mutated, 2);
  assert.equal(mutations(recorder).length, 2);
});


/* ------------------------------------------------------------------ metadata survives a real run */

test("a run preserves the metadata it is not changing, end to end", async () => {
  // OBSERVED ON e46e167: the same run left `{ContentType}` on the pinned object and erased everything else.
  const unrelated = {
    cacheControl: "public, max-age=31536000, immutable",
    contentLanguage: "en-GB",
    expires: "Wed, 21 Oct 2026 07:28:00 GMT",
    metadata: { "uploaded-by": "user-123", "original-name": "holiday.jpg" },
  };
  const recorder = recordingStore({
    "posts/photo.html": { body: jpeg, contentType: "image/jpeg", contentDisposition: "inline", ...unrelated },
    "posts/attack.html": { body: htmlBytes, contentType: "image/jpeg", ...unrelated },
  });
  await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });

  const pinned = recorder.objects.get("posts/photo.html")!;
  assert.equal(pinned.contentType, "image/jpeg");
  assert.equal(pinned.contentDisposition, "inline", "a pin leaves valid media serving as it did");
  assert.equal(pinned.cacheControl, unrelated.cacheControl);
  assert.equal(pinned.contentLanguage, "en-GB");
  assert.equal(pinned.expires, unrelated.expires);
  assert.deepEqual(pinned.metadata, unrelated.metadata);
  assert.equal(pinned.body.equals(jpeg), true);

  const neutralized = recorder.objects.get("posts/attack.html")!;
  assert.equal(neutralized.contentType, NEUTRALIZED_CONTENT_TYPE);
  assert.equal(neutralized.contentDisposition, "attachment");
  assert.equal(neutralized.cacheControl, "no-store");
  assert.equal(neutralized.contentLanguage, "en-GB", "unrelated metadata survives neutralization too");
  assert.deepEqual(neutralized.metadata, unrelated.metadata);
});

test("an object carrying a content coding is never pinned, because we cannot say what a client would see", async () => {
  // A GET returns the STORED bytes; a coding tells the client to transform them first. So what we validated and
  // what a browser interprets are only the same thing when there is no coding in play. Fail closed.
  const recorder = recordingStore({
    "posts/coded.html": { body: jpeg, contentType: "image/jpeg", contentEncoding: "gzip" },
    "posts/coded.jpg": { body: jpeg, contentType: undefined, contentEncoding: "br" },
  });
  await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });

  // Active surface (a `.html` key): neutralized, and the coding is dropped so it serves its literal bytes.
  const active = recorder.objects.get("posts/coded.html")!;
  assert.equal(active.contentType, NEUTRALIZED_CONTENT_TYPE);
  assert.equal(active.contentEncoding, undefined, "the coding is removed deliberately");
  assert.equal(active.body.equals(jpeg), true, "and the bytes are still preserved");

  // A missing Content-Type is itself an active surface -- the client sniffs -- so this is neutralized too
  // rather than merely reported. Every route into the decision layer implies an active surface (an active
  // stored type, an active key extension, or no stored type at all), so through the runner an unverifiable
  // candidate is always neutralized; `report_only` for an inert one is reachable only by a direct caller and is
  // asserted there, in legacy-media-remediation.test.ts.
  const sniffable = recorder.objects.get("posts/coded.jpg")!;
  assert.equal(sniffable.contentType, NEUTRALIZED_CONTENT_TYPE);
  assert.equal(sniffable.contentEncoding, undefined, "the coding is removed here too");
  assert.equal(sniffable.body.equals(jpeg), true, "and the bytes are preserved");
});

test("an identity coding does not block a pin", async () => {
  const recorder = recordingStore({ "posts/photo.html": { body: jpeg, contentType: "image/jpeg", contentEncoding: "identity" } });
  await runLegacyRemediation(recorder.store, { apply: true, requestedPrefixes: [], max: Infinity });
  const pinned = recorder.objects.get("posts/photo.html")!;
  assert.equal(pinned.contentType, "image/jpeg");
  assert.equal(pinned.contentEncoding, "identity");
});

test("the storage port has no delete operation to call", () => {
  // The structural half of the correction: `--delete-illegitimate` is gone, and nothing downstream could honour
  // it. If someone adds a delete to this port, this test is where they have to justify it.
  const recorder = recordingStore({});
  assert.deepEqual(Object.keys(recorder.store).sort(), ["get", "head", "list", "setMetadata"]);
  for (const forbidden of ["delete", "remove", "rename", "move", "copyTo"]) {
    assert.equal(forbidden in recorder.store, false, forbidden);
  }
});
