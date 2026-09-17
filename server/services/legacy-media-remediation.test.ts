/**
 * Classification of legacy public-R2 objects, which is the part of the R2 remediation that can be tested without
 * a bucket. Codex and Greptile both found that the `/uploads` hardening does nothing for objects clients fetch
 * directly from `R2_PUBLIC_BASE_URL`, and this is what decides which of those objects are dangerous.
 *
 * The fixtures are not invented. Each one is a key/type pair the pre-repair code at caafde3 could actually have
 * written, and the comment on each says which path wrote it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_EXTENSION_CONTENT_TYPES } from "@shared/media-types";
import {
  LEGACY_PUBLIC_PREFIXES,
  NEUTRALIZED_CONTENT_DISPOSITION,
  NEUTRALIZED_CONTENT_TYPE,
  classifyLegacyObject,
  isIllegitimateUnderCurrentPolicy,
  keyExtension,
  normalizeContentType,
} from "./legacy-media-remediation";

/* ------------------------------------------------------------------ the dangerous legacy objects */

test("an SVG stored as image/svg+xml is a candidate: the severe case, written by persistDataUri", () => {
  // persistDataUri mapped the declared `data:` media type straight through, so this object is a script-capable
  // document that R2 serves inline today.
  const disposition = classifyLegacyObject({ key: "posts/3f2b-uuid.svg", contentType: "image/svg+xml" });
  assert.deepEqual(disposition, { action: "neutralize", reason: "active_content_type" });
  assert.equal(isIllegitimateUnderCurrentPolicy(disposition.reason), true);
});

test("an executable key with an inert stored type is still a candidate", () => {
  // The three multipart paths took the extension from the uploader's filename while the ContentType came from a
  // declared-MIME allowlist. R2 serves the stored type, so this is not live today -- but the key is executable
  // and any serving change that derives a type from it makes it live.
  for (const [key, contentType] of [
    ["posts/aaaa.html", "image/jpeg"],
    ["avatars/avatar-bbbb.html", "image/png"],
    ["posts/cccc.js", "image/gif"],
    ["reviews/review-dddd.xhtml", "image/webp"],
    ["posts/eeee.svg", "image/jpeg"],
    ["posts/ffff.xml", "application/pdf"],
  ] as const) {
    const disposition = classifyLegacyObject({ key, contentType });
    assert.deepEqual(disposition, { action: "neutralize", reason: "active_extension" }, key);
  }
});

test("an active stored type is caught whatever the key looks like, and charset parameters do not hide it", () => {
  assert.equal(classifyLegacyObject({ key: "posts/looks-fine.jpg", contentType: "text/html" }).action, "neutralize");
  assert.equal(classifyLegacyObject({ key: "posts/looks-fine.png", contentType: "text/html; charset=utf-8" }).reason, "active_content_type");
  assert.equal(classifyLegacyObject({ key: "posts/x.webp", contentType: "IMAGE/SVG+XML" }).reason, "active_content_type");
  assert.equal(classifyLegacyObject({ key: "posts/x.gif", contentType: "application/xhtml+xml" }).reason, "active_content_type");
});

test("an object with no stored type at all is a candidate, because the client would sniff it", () => {
  assert.deepEqual(classifyLegacyObject({ key: "posts/gggg.jpg", contentType: undefined }), { action: "neutralize", reason: "missing_content_type" });
  assert.deepEqual(classifyLegacyObject({ key: "posts/hhhh.jpg", contentType: "  " }), { action: "neutralize", reason: "missing_content_type" });
});

/* ------------------------------------------------------------------ what must NOT be swept up */

test("canonical media is never touched", () => {
  // Every format the current validator can produce, stored as the type its extension says it is.
  for (const [extension, contentType] of Object.entries(CANONICAL_EXTENSION_CONTENT_TYPES)) {
    const disposition = classifyLegacyObject({ key: `posts/legit-object.${extension}`, contentType });
    assert.deepEqual(disposition, { action: "keep", reason: "canonical_media" }, extension);
  }
  // Including the ones the old pipeline wrote in bulk.
  assert.equal(classifyLegacyObject({ key: "posts/uuid_thumb.webp", contentType: "image/webp" }).action, "keep");
  assert.equal(classifyLegacyObject({ key: "avatars/avatar-uuid.jpg", contentType: "image/jpeg" }).action, "keep");
  assert.equal(classifyLegacyObject({ key: "reviews/review-uuid.png", contentType: "image/png" }).action, "keep");
  assert.equal(classifyLegacyObject({ key: "posts/clip.mp4", contentType: "video/mp4" }).action, "keep");
});

test("a safe extension with a different safe type is reported, not modified", () => {
  // Both inert. There is no proof anything is wrong, and it may be serving users correctly, so it is left alone.
  const disposition = classifyLegacyObject({ key: "posts/iiii.jpg", contentType: "image/png" });
  assert.deepEqual(disposition, { action: "keep", reason: "type_mismatch_left_alone" });
  assert.equal(isIllegitimateUnderCurrentPolicy(disposition.reason), false);
});

test("something this repository never wrote is reported and left alone", () => {
  assert.deepEqual(classifyLegacyObject({ key: "posts/jjjj.heic", contentType: "image/heic" }), { action: "keep", reason: "unrecognized_left_alone" });
  assert.deepEqual(classifyLegacyObject({ key: "posts/kkkk", contentType: "application/octet-stream" }), { action: "keep", reason: "unrecognized_left_alone" });
});

test("nothing outside ChefSire's own prefixes is ever a candidate", () => {
  // Including the private catering documents, which live in a different bucket and must never be reached at all.
  for (const key of ["catering-bookings/booking/file/file.pdf", "some-other-app/x.html", "x.svg", "backups/dump.html"]) {
    assert.deepEqual(classifyLegacyObject({ key, contentType: "text/html" }), { action: "keep", reason: "out_of_scope" }, key);
  }
  // And a narrowed run only sees what it was pointed at.
  assert.equal(classifyLegacyObject({ key: "avatars/x.html", contentType: "image/png" }, ["posts/"]).reason, "out_of_scope");
  assert.equal(classifyLegacyObject({ key: "posts/x.html", contentType: "image/png" }, ["posts/"]).action, "neutralize");
});

/* ------------------------------------------------------------------ idempotence */

test("an already-neutralized object is recognised and skipped, so re-running costs nothing", () => {
  const neutralized = { contentType: NEUTRALIZED_CONTENT_TYPE, contentDisposition: NEUTRALIZED_CONTENT_DISPOSITION };
  assert.deepEqual(classifyLegacyObject({ key: "posts/was-dangerous.html", ...neutralized }), { action: "keep", reason: "already_neutralized" });
  assert.deepEqual(classifyLegacyObject({ key: "posts/was-dangerous.svg", ...neutralized }), { action: "keep", reason: "already_neutralized" });
  // A disposition carrying a filename parameter still counts as neutralized.
  assert.equal(classifyLegacyObject({ key: "posts/x.html", contentType: NEUTRALIZED_CONTENT_TYPE, contentDisposition: 'attachment; filename="x"' }).reason, "already_neutralized");
  // Half-done is not done: octet-stream without the disposition is still a candidate.
  assert.equal(classifyLegacyObject({ key: "posts/x.html", contentType: NEUTRALIZED_CONTENT_TYPE }).action, "neutralize");
});

/* ------------------------------------------------------------------ helpers */

test("key and content-type parsing handle the shapes real keys take", () => {
  assert.equal(keyExtension("posts/uuid.JPG"), "jpg");
  assert.equal(keyExtension("posts/uuid.tar.gz"), "gz");
  assert.equal(keyExtension("posts/no-extension"), "");
  assert.equal(keyExtension("posts/.hidden"), "");
  assert.equal(keyExtension("posts/nested/deep/file.svg"), "svg");
  assert.equal(normalizeContentType("Text/HTML; charset=UTF-8"), "text/html");
  assert.equal(normalizeContentType(undefined), "");
});

test("the scoped prefixes are exactly the three the vulnerable paths wrote", () => {
  assert.deepEqual([...LEGACY_PUBLIC_PREFIXES], ["posts/", "avatars/", "reviews/"]);
});

test("an R2-served object is addressed off ChefSire's origin, which is why the static hardening cannot reach it", async () => {
  // This is the architectural fact the whole finding rests on, pinned so the claim cannot quietly become false
  // in either direction. `publicUrl` hands the client an absolute `R2_PUBLIC_BASE_URL` address; a request to it
  // never enters Express, so `uploadsStaticHandler` -- and every header it sets -- is simply not on the path.
  const saved = { ...process.env };
  Object.assign(process.env, {
    R2_ENDPOINT: "https://example.invalid", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s",
    R2_BUCKET: "chefsire-public", R2_PUBLIC_BASE_URL: "https://media.example.invalid",
  });
  try {
    const { publicUrl } = await import("../lib/r2");
    const url = publicUrl("posts/legacy-uuid.svg");
    assert.equal(url, "https://media.example.invalid/posts/legacy-uuid.svg");
    assert.equal(url.startsWith("/uploads/"), false, "it is not a ChefSire path");
    assert.equal(new URL(url).origin, "https://media.example.invalid", "and not ChefSire's origin");
  } finally {
    for (const name of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]) {
      if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name];
    }
  }
});
