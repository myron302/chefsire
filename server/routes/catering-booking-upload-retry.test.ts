import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * An accepted upload retry must resolve BEFORE another storage object is written.
 *
 * The situation the idempotency token exists for: the first upload committed its object and its metadata row, the
 * HTTP response was lost, and the client resent the same token. Writing another object first made recovery depend
 * on storage being healthy at exactly the moment it is least likely to be -- a full disk or an unreachable bucket
 * failed the retry even though the file was already safely persisted.
 *
 * There is no database harness in this suite, so the ordering guarantee is asserted structurally against the route,
 * as elsewhere in Phase 2I. What is being pinned is an ORDER: the token lookup must precede every storage call and
 * every side effect, and the in-transaction lookup must survive as the concurrency backstop rather than be replaced.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-files.ts"), "utf8");
const handler = route.slice(route.indexOf("async function handleUpload"), route.indexOf("async function respondWithAcceptedUpload"));
const at = (needle: string) => {
  const index = handler.indexOf(needle);
  assert.notEqual(index, -1, `not found in the upload handler: ${needle}`);
  return index;
};

const EARLY_LOOKUP = "const accepted = await duplicateFile(id, userId, fields.clientRequestId);";
const WRITE = "await writePrivateObject(provider, storageKey, content.body, upload.type.contentType);";

test("1. the accepted-token lookup happens before any storage write", () => {
  assert.equal(handler.includes(EARLY_LOOKUP), true);
  assert.equal(handler.includes("if (accepted) return respondWithAcceptedUpload(res, booking, userId, accepted);"), true);
  // The decisive ordering: resolved, and returned from, before a single byte is written.
  assert.equal(at(EARLY_LOOKUP) < at(WRITE), true, "the retry must be resolved before writePrivateObject");
  // And before the compensation identity is even assigned, so a retry never enters the orphan-tracking path.
  assert.equal(at(EARLY_LOOKUP) < at(`stored = { provider, storageKey, bookingId: id, reason: "orphaned_upload" }`), true);
});

test("2. an accepted retry needs nothing from storage, so it survives storage being unavailable", () => {
  // Everything between the lookup and its return is a database read and a serialization -- no storage call at all.
  const early = handler.slice(at(EARLY_LOOKUP), at(EARLY_LOOKUP) + 200);
  for (const storageCall of ["writePrivateObject", "privateStorageProvider", "removePrivateObject", "readPrivateObject"]) {
    assert.equal(early.includes(storageCall), false, storageCall);
  }
  // The provider is not even resolved until after the retry has had its chance to return.
  assert.equal(at(EARLY_LOOKUP) < at("const provider = privateStorageProvider();"), true);
  // Nor is the file content decoded and re-encoded, which is the other way a recovery retry could be failed.
  assert.equal(at(EARLY_LOOKUP) < at("const content = await validateCateringFileContent"), true);
});

test("3. concurrent first attempts stay serialized: the locked lookup is untouched", () => {
  // The early lookup cannot see an in-flight uncommitted sibling, so the in-transaction lookup under the collection
  // advisory lock remains exactly as it was, and the unique index remains the backstop behind that.
  assert.equal(handler.includes("await lockFileCollection(tx, id);"), true);
  assert.equal(handler.includes("const alreadyPersisted = fields.clientRequestId ? await duplicateFile(id, userId, fields.clientRequestId, tx) : undefined;"), true);
  assert.equal(handler.includes(".onConflictDoNothing().returning();"), true);
  assert.equal(handler.includes(`if (inserted.length === 0) return { kind: "duplicate", file: undefined } as const;`), true);
  // The locked lookup still precedes the quota count, so a retry is never answered "booking full".
  assert.equal(at("const alreadyPersisted") < at("const slot = resolveCateringFileSlot"), true);
  // Both lookups exist: the early one and the locked one.
  assert.equal((handler.match(/await duplicateFile\(/g) ?? []).length, 3);
});

test("4. a retry cannot resolve another booking's or another actor's token", () => {
  // The lookup is scoped to the canonical upload identity and nothing wider. `id` comes from the validated path and
  // `userId` from the authenticated session; only the token itself is client-supplied.
  assert.equal(handler.includes("duplicateFile(id, userId, fields.clientRequestId)"), true);
  const scope = route.slice(route.indexOf("async function duplicateFile"), route.indexOf("async function compensateStoredObject"));
  assert.equal(scope.includes("eq(cateringBookingFiles.bookingId, bookingId)"), true);
  assert.equal(scope.includes("eq(cateringBookingFiles.uploadedBy, uploadedBy)"), true);
  assert.equal(scope.includes("eq(cateringBookingFiles.clientRequestId, clientRequestId)"), true);
  // No client-supplied file identity is trusted anywhere: the id and storage key are generated server-side.
  assert.equal(handler.includes("const fileId = randomUUID();"), true);
  assert.equal(handler.includes("const storageKey = cateringFileStorageKey(id, fileId, upload.type.extension);"), true);
  // And the booking itself was resolved from the actor's own ownership before any of this.
  assert.equal(at("const booking = await ownedCateringBooking(id, userId);") < at(EARLY_LOOKUP), true);
});

test("5. a deleted original is never returned as an active file", () => {
  const responder = route.slice(route.indexOf("async function respondWithAcceptedUpload"), route.indexOf("/**\n * Reads back the file an already-accepted"));
  assert.equal(responder.includes("if (existing.deletedAt !== null) return res.status(409)"), true);
  assert.equal(responder.includes("that file has since been removed from the booking"), true);
  // The tombstone check precedes the success response, so there is no path that serializes a deleted row as active.
  assert.equal(responder.indexOf("existing.deletedAt !== null") < responder.indexOf("res.status(200)"), true);
  // Both resolution points answer through this one responder, so they cannot disagree about a tombstone.
  assert.equal((route.match(/respondWithAcceptedUpload\(res, booking, userId,/g) ?? []).length, 2);
});

test("6. an accepted retry consumes no quota slot and emits no activity or notification", () => {
  const early = handler.slice(at(EARLY_LOOKUP));
  const returnAt = early.indexOf("if (accepted) return respondWithAcceptedUpload");
  // Everything with a side effect sits after the early return, so a resolved retry reaches none of it.
  for (const effect of [".insert(cateringBookingFiles)", ".insert(cateringBookingActivity)", ".insert(notifications)", "resolveCateringFileSlot"]) {
    assert.equal(early.indexOf(effect) > returnAt, true, effect);
  }
  // And the responder itself writes nothing at all.
  const responder = route.slice(route.indexOf("async function respondWithAcceptedUpload"), route.indexOf("/**\n * Reads back the file an already-accepted"));
  for (const write of [".insert(", ".update(", "writePrivateObject", "transaction("]) {
    assert.equal(responder.includes(write), false, write);
  }
});

test("terminal booking policy still runs before the token is examined", () => {
  // Unchanged and deliberate: a retry arriving after the booking closed is refused, not resolved historically --
  // exactly as booking message idempotency behaves.
  assert.equal(at("if (!mayMutateCateringFiles(booking.status as never))") < at(EARLY_LOOKUP), true);
  assert.equal(handler.includes("code: CATERING_WORKSPACE_READ_ONLY_CODE"), true);
});

test("a genuinely new upload is unaffected: lock, quota and limit enforcement are all intact", () => {
  // No token, or a token naming nothing, falls straight through to the ordinary path.
  assert.equal(handler.includes("if (fields.clientRequestId) {"), true);
  assert.equal(handler.includes("const active = await lockActiveCateringBooking(tx, id);"), true);
  assert.equal(handler.includes("eq(cateringBookingFiles.visibility, fields.visibility)"), true, "the per-bucket quota is unchanged");
  assert.equal(handler.includes(`if (slot.kind !== "accepted") return slot;`), true);
  assert.equal(handler.includes("code: CATERING_FILE_LIMIT_CODE"), true);
});
