/**
 * An object too large to read is not an object too dangerous to act on.
 *
 * THE FINDING. `decideLegacyRemediation` handled `not_inspected / too_large` by returning `report_only`
 * unconditionally -- before it had even asked whether the object presents an active surface. That is the one
 * branch where the tool knows least and the exposure is largest, and the gap is not hypothetical: the pre-repair
 * `/api/upload` accepted files up to 100 MB (`GENERAL_UPLOAD_LIMIT_BYTES` on main at caafde3) while the
 * remediation reads at most `LEGACY_INSPECT_MAX_BYTES` (25 MB), so an HTML payload between those two numbers
 * could already be sitting in R2 under a `.html` key or a `text/html` stored type.
 *
 * WHAT REPRODUCED ON HEAD 00e7dfa. Every one of these decided `report_only / too_large_to_inspect`, so a run
 * with `--apply` logged the object and left the stored-XSS URL executable:
 *
 *   26 MB, stored type text/html, key posts/x.jpg      -> report_only
 *   26 MB, key posts/x.html, stored type image/jpeg    -> report_only
 *   26 MB, key posts/x.svg, stored type image/svg+xml  -> report_only
 *   26 MB, no stored type at all                       -> report_only
 *
 * Nothing reaches that branch by accident. `triageLegacyObject` returns `inspect` only for an active stored
 * type, an active extension, or a missing type -- so every object that gets there already presents an active
 * surface. `report_only` was therefore the answer for all of them, and the right answer for none.
 *
 * THE COST, STATED RATHER THAN HIDDEN. Neutralizing without reading means a large file whose bytes really are
 * media -- a 50 MB MP4 uploaded as `clip.html`, which the original defect made possible -- becomes an inert
 * attachment and stops playing. That is deliberate: it is reversible, the bytes and the key are untouched, and
 * the run counts these under their own reason so an operator can find them and re-upload them through the fixed
 * pipeline. Reading further would not avoid it -- an object this tool cannot fully verify cannot be pinned
 * either, so it would be neutralized on the existing rule with more bytes read and nothing learned.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_INSPECT_MAX_BYTES,
  decideLegacyRemediation,
  emptyLegacySummary,
  planObjectMetadata,
  triageLegacyObject,
  type LegacyObjectMetadata,
} from "./legacy-media-remediation";

const tooLarge = { kind: "not_inspected", why: "too_large" } as const;
const unreadable = { kind: "not_inspected", why: "unreadable" } as const;

/** The decision the runner would reach, going through real triage rather than a hand-written one. */
const decide = (object: LegacyObjectMetadata, validation: typeof tooLarge | typeof unreadable) =>
  decideLegacyRemediation(object, triageLegacyObject(object), validation);

/* ------------------------------------------------------------------ the finding */

test("an oversized object presenting an active surface is neutralized, not merely reported", () => {
  // OBSERVED ON 00e7dfa: every one of these was `report_only / too_large_to_inspect`.
  for (const [label, object] of [
    ["stored type is text/html", { key: "posts/uuid.jpg", contentType: "text/html", size: LEGACY_INSPECT_MAX_BYTES + 1 }],
    ["stored type is image/svg+xml", { key: "posts/uuid.png", contentType: "image/svg+xml", size: 60 * 1024 * 1024 }],
    ["key ends in .html", { key: "posts/uuid.html", contentType: "image/jpeg", size: 26 * 1024 * 1024 }],
    ["key ends in .svg", { key: "avatars/uuid.svg", contentType: "image/jpeg", size: 99 * 1024 * 1024 }],
    ["key ends in .xhtml", { key: "reviews/uuid.xhtml", contentType: "video/mp4", size: 30 * 1024 * 1024 }],
    ["no stored type at all", { key: "posts/uuid.bin", contentType: "", size: 40 * 1024 * 1024 }],
    ["stored type missing entirely", { key: "posts/uuid.dat", size: 40 * 1024 * 1024 }],
  ] as const) {
    assert.deepEqual(decide(object, tooLarge), { action: "neutralize", reason: "too_large_active_surface" }, label);
  }
});

test("the exposure window is real: the old upload limit is four times the read bound", () => {
  // This is why the branch matters at all. If the reader covered everything the uploader accepted, an oversized
  // object could not exist and `report_only` would have been harmless.
  const oldUploadLimit = 100 * 1024 * 1024;
  assert.equal(LEGACY_INSPECT_MAX_BYTES, 25 * 1024 * 1024);
  assert.equal(oldUploadLimit > LEGACY_INSPECT_MAX_BYTES, true);
  // Anything in this range could have been stored before the repair and cannot be read by the remediation.
  for (const size of [LEGACY_INSPECT_MAX_BYTES + 1, 50 * 1024 * 1024, oldUploadLimit]) {
    assert.deepEqual(
      decide({ key: "posts/uuid.html", contentType: "image/jpeg", size }, tooLarge),
      { action: "neutralize", reason: "too_large_active_surface" },
      `${size} bytes`,
    );
  }
});

test("the reason is distinct from an unreadable one, so a run can tell them apart", () => {
  // Both neutralize. They are counted separately because they mean different things to an operator: one says
  // "the bytes are not media", the other says "we never looked".
  const object = { key: "posts/uuid.html", contentType: "image/jpeg", size: 26 * 1024 * 1024 };
  assert.deepEqual(decide(object, tooLarge), { action: "neutralize", reason: "too_large_active_surface" });
  assert.deepEqual(decide(object, unreadable), { action: "neutralize", reason: "unverifiable_active_surface" });
  assert.equal(Object.hasOwn(emptyLegacySummary(), "too_large_active_surface"), true, "and the summary counts it");
  assert.equal(emptyLegacySummary().too_large_active_surface, 0);
});

/* ------------------------------------------------------------------ the bound has not become a blanket rewrite */

test("an oversized but genuinely inert object is still reported and still untouched", () => {
  // Real triage never routes an inert object into inspection, so this arm is reached only by a direct caller --
  // which is exactly why it is asserted rather than assumed. If a future triage widens what it inspects, this
  // is the test that stops the widening from turning into a blanket rewrite.
  const inert = decideLegacyRemediation(
    { key: "posts/uuid.bin", contentType: "application/pdf", size: 40 * 1024 * 1024 },
    { action: "inspect", reason: "missing_content_type" },
    tooLarge,
  );
  assert.deepEqual(inert, { action: "report_only", reason: "too_large_to_inspect" });
});

test("objects triage keeps are still never reached, whatever their size", () => {
  for (const [label, object] of [
    ["canonical media", { key: "posts/uuid.jpg", contentType: "image/jpeg", size: 90 * 1024 * 1024 }],
    ["already neutralized", { key: "posts/uuid.html", contentType: "application/octet-stream", contentDisposition: "attachment", size: 90 * 1024 * 1024 }],
    ["out of scope", { key: "unrelated/uuid.html", contentType: "text/html", size: 90 * 1024 * 1024 }],
  ] as const) {
    assert.equal(triageLegacyObject(object).action, "keep", label);
    assert.deepEqual(decide(object, tooLarge), { action: "keep", reason: "already_correct" }, label);
  }
});

/* ------------------------------------------------------------------ what neutralizing an unread object writes */

test("neutralizing without reading writes the same metadata as neutralizing after reading", () => {
  // The object was never opened, so nothing about the plan may depend on its bytes. It is the same inert
  // download every other neutralization produces, and it preserves the same unrelated fields.
  const object: LegacyObjectMetadata = {
    key: "posts/uuid.html",
    contentType: "image/jpeg",
    contentDisposition: "inline",
    cacheControl: "public, max-age=31536000, immutable",
    contentEncoding: "gzip",
    contentLanguage: "en-GB",
    expires: "Wed, 21 Oct 2026 07:28:00 GMT",
    metadata: { "uploaded-by": "someone" },
    websiteRedirectLocation: "/elsewhere",
    size: 40 * 1024 * 1024,
  };
  const plan = planObjectMetadata(object, decide(object, tooLarge))!;
  assert.equal(plan.contentType, "application/octet-stream");
  assert.equal(plan.contentDisposition, "attachment");
  assert.equal(plan.cacheControl, "no-store");
  // Removed, because a neutralized object serves its literal bytes and nothing else.
  assert.equal(plan.contentEncoding, undefined);
  assert.equal(plan.websiteRedirectLocation, undefined);
  // Preserved, because none of it affects how the bytes are interpreted and none of it is ours to discard.
  assert.equal(plan.contentLanguage, "en-GB");
  assert.equal(plan.expires, "Wed, 21 Oct 2026 07:28:00 GMT");
  assert.deepEqual(plan.metadata, { "uploaded-by": "someone" });
});

test("it is reversible and idempotent: bytes and key are never part of the plan", () => {
  const object = { key: "posts/uuid.html", contentType: "text/html", size: 40 * 1024 * 1024 };
  const plan = planObjectMetadata(object, decide(object, tooLarge))!;
  assert.equal(Object.hasOwn(plan, "key"), false, "the key is not something a plan changes");
  assert.equal(Object.hasOwn(plan, "body"), false, "and neither are the bytes");

  // Running again over the result is a no-op: triage recognises its own signature and keeps it.
  const after = { key: object.key, contentType: plan.contentType, contentDisposition: plan.contentDisposition, size: object.size };
  assert.deepEqual(triageLegacyObject(after), { action: "keep", reason: "already_neutralized" });
});
