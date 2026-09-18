/**
 * Scope and classification for legacy public-R2 objects.
 *
 * Two review findings against head 70a24fd shape this file, and both are asserted against the behaviour that was
 * actually observed there:
 *
 *   SCOPE WAS NOT FAIL-CLOSED. `--prefix=` was passed straight to `ListObjectsV2` and to the scope check, and
 *   `key.startsWith("")` is true of every key -- so the whole bucket came into scope and, with deletion enabled,
 *   unrelated objects could be destroyed. `--prefix=post` matched `postsomething/`.
 *
 *   AN EXTENSION IS NOT EVIDENCE OF CONTENT. The old script would have deleted an object for ending in `.html`.
 *   The original vulnerability took the extension from the uploader's FILENAME, so a real JPEG uploaded as
 *   `photo.html` is sitting at `posts/<uuid>.html` right now. Deleting it destroys a user's photo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_EXTENSION_CONTENT_TYPES } from "@shared/media-types";
import {
  LEGACY_PUBLIC_PREFIXES,
  NEUTRALIZED_CONTENT_DISPOSITION,
  NEUTRALIZED_CONTENT_TYPE,
  REFERENCE_AUDIT,
  decideLegacyRemediation,
  isKeyWithinOwnedScope,
  keyExtension,
  normalizeContentType,
  resolveRequestedPrefixes,
  triageLegacyObject,
} from "./legacy-media-remediation";

/* ------------------------------------------------------------------ FINDING 1: scope is code-owned */

test("the default scope is exactly the three ChefSire public-media prefixes and nothing else", () => {
  assert.deepEqual([...LEGACY_PUBLIC_PREFIXES], ["posts/", "avatars/", "reviews/"]);
  assert.equal(Object.isFrozen(LEGACY_PUBLIC_PREFIXES), true, "the list is code-owned, not assembled at runtime");
  const resolved = resolveRequestedPrefixes([]);
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.ok && [...resolved.prefixes], ["posts/", "avatars/", "reviews/"]);
});

test("an exact allowed prefix selects a subset", () => {
  for (const prefix of ["posts/", "avatars/", "reviews/"]) {
    const resolved = resolveRequestedPrefixes([prefix]);
    assert.equal(resolved.ok, true, prefix);
    assert.deepEqual(resolved.ok && [...resolved.prefixes], [prefix], prefix);
  }
  // Several at once, returned in the code-owned order rather than the order argv happened to use.
  const two = resolveRequestedPrefixes(["reviews/", "posts/"]);
  assert.deepEqual(two.ok && [...two.prefixes], ["posts/", "reviews/"]);
});

test("every widening or malformed prefix is refused, and one bad value fails the whole run", () => {
  // OBSERVED ON 70a24fd: each of these was accepted verbatim as a ListObjectsV2 prefix.
  for (const bad of ["", "post", "posts", "/", "../", "unrelated/", "catering-bookings/", "posts/foo/", "POSTS/", " posts/", "posts/ ", "*"]) {
    const resolved = resolveRequestedPrefixes([bad]);
    assert.equal(resolved.ok, false, JSON.stringify(bad));
    assert.deepEqual(resolved.ok === false && [...resolved.rejected], [bad], JSON.stringify(bad));
  }
  // A good value does not rescue a bad one in the same invocation.
  const mixed = resolveRequestedPrefixes(["posts/", "unrelated/"]);
  assert.equal(mixed.ok, false);
  assert.deepEqual(mixed.ok === false && [...mixed.rejected], ["unrelated/"]);
});

test("the key boundary is re-asserted per key, and partial matches do not count", () => {
  for (const key of ["posts/uuid.jpg", "avatars/avatar-uuid.png", "reviews/review-uuid.webp", "posts/nested/deep.jpg"]) {
    assert.equal(isKeyWithinOwnedScope(key), true, key);
  }
  // OBSERVED ON 70a24fd with --prefix=post: `postsomething/evil.html` classified as a mutation candidate.
  for (const key of [
    "postsomething/evil.html", "posts-backup/x.jpg", "avatarsx/y.png", "unrelated/x.html",
    "catering-bookings/b/f/f.pdf", "x.svg", "", "/posts/x.jpg", "posts/", "posts//x.jpg",
    "posts/../unrelated/x.html", "posts/./x.jpg", "../posts/x.jpg",
  ]) {
    assert.equal(isKeyWithinOwnedScope(key), false, JSON.stringify(key));
  }
  // A narrowed run does not see the other owned prefixes.
  assert.equal(isKeyWithinOwnedScope("avatars/x.png", ["posts/"]), false);
  assert.equal(isKeyWithinOwnedScope("posts/x.png", ["posts/"]), true);
  // And a prefix that is not code-owned can never authorise a key, even if passed in directly.
  assert.equal(isKeyWithinOwnedScope("unrelated/x.html", ["unrelated/"]), false);
  assert.equal(isKeyWithinOwnedScope("postsomething/x.html", ["post"]), false);
});

/* ------------------------------------------------------------------ triage, from metadata alone */

test("an object that presents an active surface is inspected rather than judged", () => {
  // Nothing here decides an outcome; it decides only whether to read the bytes.
  assert.deepEqual(triageLegacyObject({ key: "posts/a.svg", contentType: "image/svg+xml" }), { action: "inspect", reason: "active_content_type" });
  assert.deepEqual(triageLegacyObject({ key: "posts/b.html", contentType: "image/jpeg" }), { action: "inspect", reason: "active_extension" });
  assert.deepEqual(triageLegacyObject({ key: "posts/c.jpg", contentType: undefined }), { action: "inspect", reason: "missing_content_type" });
  assert.deepEqual(triageLegacyObject({ key: "posts/d.jpg", contentType: "text/html; charset=utf-8" }), { action: "inspect", reason: "active_content_type" });
});

test("canonical-LOOKING metadata is inspected, because it proves nothing about the bytes", () => {
  // THIS TEST ASSERTED THE DEFECT until R11. It pinned `keep / canonical_media` -- so an object whose extension
  // and stored type agree was never fetched. Both halves came from the same attacker-supplied multipart header
  // in the pre-repair uploader, so agreeing costs an attacker nothing. See
  // `legacy-metadata-is-not-evidence.test.ts` for the reproduction this corrects.
  for (const [extension, contentType] of Object.entries(CANONICAL_EXTENSION_CONTENT_TYPES)) {
    assert.deepEqual(triageLegacyObject({ key: `posts/legit.${extension}`, contentType }), { action: "inspect", reason: "canonical_metadata_unverified" }, extension);
  }
  assert.equal(triageLegacyObject({ key: "posts/uuid_thumb.webp", contentType: "image/webp" }).action, "inspect");
  assert.equal(triageLegacyObject({ key: "avatars/avatar-uuid.jpg", contentType: "image/jpeg" }).action, "inspect");
  // The other two metadata-only keeps went the same way, for the same reason.
  assert.deepEqual(triageLegacyObject({ key: "posts/uuid.jpg", contentType: "image/png" }), { action: "inspect", reason: "type_mismatch_unverified" });
  assert.deepEqual(triageLegacyObject({ key: "posts/uuid.bin", contentType: "application/pdf" }), { action: "inspect", reason: "unrecognized_unverified" });
});

test("an already-neutralized object is skipped, so re-running costs nothing", () => {
  const neutralized = { contentType: NEUTRALIZED_CONTENT_TYPE, contentDisposition: NEUTRALIZED_CONTENT_DISPOSITION };
  assert.deepEqual(triageLegacyObject({ key: "posts/was-dangerous.html", ...neutralized }), { action: "keep", reason: "already_neutralized" });
  assert.equal(triageLegacyObject({ key: "posts/x.html", contentType: NEUTRALIZED_CONTENT_TYPE, contentDisposition: 'attachment; filename="x"' }).reason, "already_neutralized");
  // Half-done is not done.
  assert.equal(triageLegacyObject({ key: "posts/x.html", contentType: NEUTRALIZED_CONTENT_TYPE }).action, "inspect");
});

test("nothing outside the owned prefixes is ever triaged as actionable", () => {
  for (const key of ["catering-bookings/b/f/f.pdf", "some-other-app/x.html", "x.svg", "backups/dump.html", "postsomething/x.html"]) {
    assert.deepEqual(triageLegacyObject({ key, contentType: "text/html" }), { action: "keep", reason: "out_of_scope" }, key);
  }
});

/* ------------------------------------------------------------------ FINDING 2: the bytes decide */

const accepted = (contentType: string, format = "jpeg", extension = "jpg") =>
  ({ kind: "accepted", format, mediaClass: "image", contentType, extension }) as never;
const rejected = { kind: "rejected", reason: "content_mismatch" } as never;

test("A. real media under an unsafe key is PRESERVED, and its verified type is pinned", () => {
  // OBSERVED ON 70a24fd: `--delete-illegitimate` would have DELETED this object because the key ends in `.html`.
  // It is a user's JPEG, uploaded as `photo.html` through the original vulnerability.
  const object = { key: "posts/uuid.html", contentType: "image/jpeg" };
  const decision = decideLegacyRemediation(object, { action: "inspect", reason: "active_extension" }, accepted("image/jpeg"));
  assert.equal(decision.action, "pin_content_type");
  assert.equal(decision.action === "pin_content_type" && decision.contentType, "image/jpeg");
  assert.equal(decision.reason, "valid_media_unsafe_key");
  assert.equal(decision.action === "pin_content_type" && decision.unsafeKeyRetained, true, "reported, not silently accepted");
  // Emphatically not destroyed, and not renamed.
  assert.notEqual(decision.action, "neutralize");
});

test("A. real media whose stored type is simply wrong has the true type pinned", () => {
  const object = { key: "posts/uuid.jpg", contentType: undefined };
  const decision = decideLegacyRemediation(object, { action: "inspect", reason: "missing_content_type" }, accepted("image/jpeg"));
  assert.deepEqual(
    { action: decision.action, reason: decision.reason, unsafe: decision.action === "pin_content_type" && decision.unsafeKeyRetained },
    { action: "pin_content_type", reason: "valid_media_wrong_type", unsafe: false },
  );
});

test("B. bytes that really are active content are neutralized in place, never deleted", () => {
  for (const [key, contentType, reason] of [
    ["posts/uuid.svg", "image/svg+xml", "active_content_type"],
    ["posts/uuid.html", "image/jpeg", "active_extension"],
  ] as const) {
    const decision = decideLegacyRemediation({ key, contentType }, { action: "inspect", reason }, rejected);
    assert.deepEqual(decision, { action: "neutralize", reason: "active_content" }, key);
  }
});

test("C. unverifiable content fails closed without ever being destroyed", () => {
  // Unreadable AND presenting an active surface: neutralized, which is reversible and preserves the bytes.
  const active = decideLegacyRemediation(
    { key: "posts/uuid.svg", contentType: "image/svg+xml" },
    { action: "inspect", reason: "active_content_type" },
    { kind: "not_inspected", why: "unreadable" },
  );
  assert.deepEqual(active, { action: "neutralize", reason: "unverifiable_active_surface" });

  // Too large to read AND an active surface: neutralized without reading.
  //
  // THIS TEST ASSERTED THE DEFECT until R8. It pinned `report_only` for an object under a `.html` key that the
  // tool could not read -- so `--apply` logged the stored-XSS URL and left it executable. The pre-repair
  // `/api/upload` accepted up to 100 MB while this reads at most 25 MB, so that gap is a real place for a
  // payload to sit. Not having looked is not a reason to leave an active surface alone.
  const large = decideLegacyRemediation(
    { key: "posts/uuid.html", contentType: "video/mp4" },
    { action: "inspect", reason: "active_extension" },
    { kind: "not_inspected", why: "too_large" },
  );
  assert.deepEqual(large, { action: "neutralize", reason: "too_large_active_surface" });

  // The same, for every other shape of active surface an oversized object can present.
  for (const [label, object] of [
    ["active stored type", { key: "posts/uuid.jpg", contentType: "text/html" }],
    ["svg key", { key: "posts/uuid.svg", contentType: "image/svg+xml" }],
    ["no stored type at all", { key: "posts/uuid.bin", contentType: "" }],
  ] as const) {
    const decision = decideLegacyRemediation(object, { action: "inspect", reason: "active_extension" }, { kind: "not_inspected", why: "too_large" });
    assert.deepEqual(decision, { action: "neutralize", reason: "too_large_active_surface" }, label);
  }

  // Oversized but inert: still reported and still untouched, so the bound has not become a blanket rewrite.
  // Real triage never routes an inert object here, so this arm is reached only by a direct caller -- which is
  // exactly why it is asserted rather than assumed.
  const largeInert = decideLegacyRemediation(
    { key: "posts/uuid.bin", contentType: "application/pdf" },
    { action: "inspect", reason: "missing_content_type" },
    { kind: "not_inspected", why: "too_large" },
  );
  assert.deepEqual(largeInert, { action: "report_only", reason: "too_large_to_inspect" });

  // Bytes READ and REFUSED: neutralized, whatever the metadata says.
  //
  // THIS ASSERTED THE DEFECT until R11, one level below the triage one. It pinned `report_only` for bytes the
  // hardened validator had already refused, purely because the key and stored type looked harmless. Metadata
  // cannot make refused bytes safe, and it is the bytes this module exists to believe.
  const refused = decideLegacyRemediation(
    { key: "posts/uuid.bin", contentType: "application/pdf" },
    { action: "inspect", reason: "missing_content_type" },
    rejected,
  );
  assert.deepEqual(refused, { action: "neutralize", reason: "active_content" });

  // `unverifiable_inert` still exists for the case it was always meant for: bytes that could not be read at all
  // on an object whose metadata presents nothing active.
  const unread = decideLegacyRemediation(
    { key: "posts/uuid.bin", contentType: "application/pdf" },
    { action: "inspect", reason: "missing_content_type" },
    { kind: "not_inspected", why: "unreadable" },
  );
  assert.deepEqual(unread, { action: "report_only", reason: "unverifiable_inert" });
});

test("D. an object already correct is left entirely alone", () => {
  const decision = decideLegacyRemediation(
    { key: "posts/uuid.jpg", contentType: "image/jpeg" },
    { action: "inspect", reason: "missing_content_type" },
    accepted("image/jpeg"),
  );
  assert.deepEqual(decision, { action: "keep", reason: "already_correct" });
  // And anything triaged as keep never reaches a decision at all.
  assert.equal(decideLegacyRemediation({ key: "posts/x.jpg" }, { action: "keep", reason: "canonical_media" }, rejected).action, "keep");
});

test("no decision this module can return renames or deletes anything", () => {
  // Swept across every combination the runner can reach. The property asserted is an ABSENCE: no input produces
  // a destructive or key-changing action, so `--delete-illegitimate` cannot be reintroduced by accident.
  const actions = new Set<string>();
  const validations = [accepted("image/jpeg"), rejected, { kind: "not_inspected", why: "unreadable" } as const, { kind: "not_inspected", why: "too_large" } as const];
  for (const validation of validations) {
    for (const reason of ["active_content_type", "active_extension", "missing_content_type"] as const) {
      for (const key of ["posts/x.html", "posts/x.jpg", "avatars/x.svg", "reviews/x.bin"]) {
        for (const contentType of ["image/svg+xml", "image/jpeg", "text/html", undefined]) {
          actions.add(decideLegacyRemediation({ key, contentType }, { action: "inspect", reason }, validation).action);
        }
      }
    }
  }
  for (const destructive of ["delete", "rename", "copy_to_new_key", "move"]) {
    assert.equal(actions.has(destructive), false, destructive);
  }
  assert.deepEqual([...actions].sort(), ["keep", "neutralize", "pin_content_type", "report_only"]);
});

/* ------------------------------------------------------------------ the audit that shapes the design */

test("the reference audit records why keys are never rewritten", () => {
  assert.equal(REFERENCE_AUDIT.centralMediaTable, false);
  // Three JSONB arrays, and columns spread across social, commerce, drinks, clubs, catering and users.
  assert.equal(REFERENCE_AUDIT.columns.filter((column) => column.includes("jsonb")).length, 3);
  assert.equal(REFERENCE_AUDIT.columns.length >= 16, true);
  for (const expected of ["posts.image_url", "users.avatar", "recipe_review_photos.photo_url", "products.images (jsonb array)"]) {
    assert.equal(REFERENCE_AUDIT.columns.includes(expected), true, expected);
  }
  assert.deepEqual([...REFERENCE_AUDIT.storedShapes], ["absolute R2_PUBLIC_BASE_URL url", "/uploads/<name> path"]);
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

test("an R2-served object is addressed off ChefSire's origin, which is why the static hardening cannot reach it", async () => {
  const saved = { ...process.env };
  Object.assign(process.env, {
    R2_ENDPOINT: "https://example.invalid", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s",
    R2_BUCKET: "chefsire-public", R2_PUBLIC_BASE_URL: "https://media.example.invalid",
  });
  try {
    const { publicUrl } = await import("../lib/r2");
    const url = publicUrl("posts/legacy-uuid.svg");
    assert.equal(url, "https://media.example.invalid/posts/legacy-uuid.svg");
    assert.equal(new URL(url).origin, "https://media.example.invalid", "not ChefSire's origin");
  } finally {
    for (const name of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]) {
      if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name];
    }
  }
});
