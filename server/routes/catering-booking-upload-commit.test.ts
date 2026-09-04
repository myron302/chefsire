import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * An uncertain COMMIT must never cost a committed file its bytes.
 *
 * The object is written before the metadata row exists, so a database failure after a successful write is the one
 * thing that can strand bytes -- and the compensating delete existed for exactly that. But a transaction whose
 * COMMIT succeeded and whose connection then dropped rejects in precisely the same way as one that rolled back.
 * Compensating on that indistinguishable signal deleted the object out from under a committed, ACTIVE file row: the
 * retry then resolved to that row through the accepted-token lookup and every download of it failed forever.
 *
 * There is no database harness in this suite, so the resolution logic is exercised behaviourally against a stubbed
 * lookup that mirrors the route's control flow, and the wiring is asserted structurally, as elsewhere in Phase 2I.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-files.ts"), "utf8");
const migration = fs.readFileSync(path.join(here, "..", "migrations", "20260902_catering_booking_communication_files.sql"), "utf8");

type Row = { id: string; bookingId: string; uploadedBy: string; storageProvider: string; storageKey: string };
type Stored = { provider: string; storageKey: string; bookingId: string; fileId: string; uploadedBy: string; reason: string };
const UPLOAD: Stored = { provider: "local", storageKey: "catering-bookings/b1/f1/f1.pdf", bookingId: "b1", fileId: "f1", uploadedBy: "u1", reason: "orphaned_upload" };

/** The route's exact resolution, against a stubbed committed-row lookup. */
function resolver(lookup: () => Row[] | never) {
  const deleted: string[] = [];
  const ledger: { storageKey: string; fileId: string; reason: string }[] = [];
  const state = (stored: Stored) => {
    try {
      const row = lookup().find((candidate) =>
        candidate.id === stored.fileId && candidate.bookingId === stored.bookingId && candidate.uploadedBy === stored.uploadedBy
        && candidate.storageProvider === stored.provider && candidate.storageKey === stored.storageKey);
      return row ? "committed" : "absent";
    } catch {
      return "unknown";
    }
  };
  return {
    deleted, ledger,
    resolve(stored: Stored) {
      const answer = state(stored);
      if (answer === "committed") return answer;
      if (answer === "absent") { deleted.push(stored.storageKey); return answer; }
      ledger.push({ storageKey: stored.storageKey, fileId: stored.fileId, reason: "uncertain_commit" });
      return answer;
    },
  };
}
const committedRow: Row = { id: "f1", bookingId: "b1", uploadedBy: "u1", storageProvider: "local", storageKey: "catering-bookings/b1/f1/f1.pdf" };

test("1. a transaction that definitely rolled back leaves no row, so the object is compensated", () => {
  const run = resolver(() => []);
  assert.equal(run.resolve(UPLOAD), "absent");
  assert.deepEqual(run.deleted, [UPLOAD.storageKey]);
  assert.deepEqual(run.ledger, [], "a true orphan needs no ledger entry when the delete succeeds");
});

test("2. a COMMIT that succeeded before the driver failed leaves the object completely alone", () => {
  const run = resolver(() => [committedRow]);
  assert.equal(run.resolve(UPLOAD), "committed");
  // The decisive assertion: nothing is deleted, and nothing is recorded -- there is no orphan to reconcile.
  assert.deepEqual(run.deleted, []);
  assert.deepEqual(run.ledger, []);
});

test("3. the retry after that uncertain commit resolves to the original file, whose bytes still exist", () => {
  const run = resolver(() => [committedRow]);
  run.resolve(UPLOAD);
  assert.equal(run.deleted.includes(committedRow.storageKey), false, "the retry must find downloadable bytes");
  // The retry path itself is the early accepted-token lookup, which runs before any new storage write.
  assert.equal(route.includes("const accepted = await duplicateFile(id, userId, fields.clientRequestId);"), true);
  assert.equal(route.indexOf("const accepted = await duplicateFile") < route.indexOf("await writePrivateObject(provider"), true);
  // And it answers with the persisted file rather than performing a second upload.
  assert.equal(route.includes("if (accepted) return respondWithAcceptedUpload(res, booking, userId, accepted);"), true);
});

test("4. a verification that conclusively finds nothing compensates, exactly as before", () => {
  // Rows exist, but none of them is this upload.
  const other: Row = { id: "f9", bookingId: "b9", uploadedBy: "u9", storageProvider: "local", storageKey: "catering-bookings/b9/f9/f9.pdf" };
  const run = resolver(() => [other]);
  assert.equal(run.resolve(UPLOAD), "absent");
  assert.deepEqual(run.deleted, [UPLOAD.storageKey]);
});

test("5. a verification that cannot run destroys nothing and records reconciliation state", () => {
  const run = resolver(() => { throw new Error("ECONNREFUSED: could not connect to database"); });
  assert.equal(run.resolve(UPLOAD), "unknown");
  // Deleting is unrecoverable; leaving bytes is not. So nothing is deleted.
  assert.deepEqual(run.deleted, []);
  // And enough identity is recorded for reconciliation to decide later.
  assert.deepEqual(run.ledger, [{ storageKey: UPLOAD.storageKey, fileId: UPLOAD.fileId, reason: "uncertain_commit" }]);
});

test("6. verification cannot resolve another booking's or another actor's row", () => {
  const wrongBooking: Row = { ...committedRow, bookingId: "b2" };
  const wrongActor: Row = { ...committedRow, uploadedBy: "u2" };
  for (const row of [wrongBooking, wrongActor]) {
    const run = resolver(() => [row]);
    assert.equal(run.resolve(UPLOAD), "absent", "a foreign row must never count as this upload's commit");
    assert.deepEqual(run.deleted, [UPLOAD.storageKey]);
  }
});

test("7. a mismatched file id or storage key is not this object's owner however similar it looks", () => {
  const wrongId: Row = { ...committedRow, id: "f2" };
  const wrongKey: Row = { ...committedRow, storageKey: "catering-bookings/b1/f1/other.pdf" };
  const wrongProvider: Row = { ...committedRow, storageProvider: "r2" };
  for (const row of [wrongId, wrongKey, wrongProvider]) {
    assert.equal(resolver(() => [row]).resolve(UPLOAD), "absent");
  }
  // Identity is the server-generated set, never a filename.
  const verify = route.slice(route.indexOf("async function uploadCommitState"), route.indexOf("async function compensateUncertainUpload"));
  for (const field of ["cateringBookingFiles.id, stored.fileId", "cateringBookingFiles.bookingId, stored.bookingId", "cateringBookingFiles.uploadedBy, stored.uploadedBy", "cateringBookingFiles.storageProvider, stored.provider", "cateringBookingFiles.storageKey, stored.storageKey"]) {
    assert.equal(verify.includes(`eq(${field})`), true, field);
  }
  assert.equal(verify.includes("originalFilename"), false, "a filename must never identify a committed upload");
});

test("8. resolving uncertainty creates no second file, activity, notification or quota usage", () => {
  const resolve = route.slice(route.indexOf("async function compensateUncertainUpload"), route.indexOf("/**\n * Answers a retry with the file"));
  for (const forbidden of [".insert(cateringBookingFiles)", ".insert(cateringBookingActivity)", ".insert(notifications)", "resolveCateringFileSlot", "transaction("]) {
    assert.equal(resolve.includes(forbidden), false, forbidden);
  }
  // It only reads, and then either deletes the object or records the ledger row.
  assert.equal(resolve.includes("uploadCommitState(stored)"), true);
  assert.equal(resolve.includes(`if (state === "committed") return;`), true);
  assert.equal(resolve.includes(`if (state === "absent") return compensateStoredObject(stored);`), true);
  assert.equal(resolve.includes(`recordStorageOrphan({ ...stored, reason: "uncertain_commit" }`), true);
});

test("only the uncertain path verifies: a resolved transaction still compensates directly", () => {
  // The transaction RETURNING a non-stored outcome is deterministic -- it committed without our row -- so it needs
  // no verification and keeps the direct compensation it always had.
  const handler = route.slice(route.indexOf("async function handleUpload"), route.indexOf("/** Whether the metadata for one upload"));
  assert.equal(handler.includes(`if (result.kind !== "stored") {`), true);
  // Bounded at the outer catch: sliced to the end of the handler it would swallow that catch, and assert nothing.
  const resolved = handler.slice(handler.indexOf(`if (result.kind !== "stored") {`), handler.indexOf("} catch (error) {"));
  assert.equal(resolved.length > 0, true);
  assert.equal(resolved.includes("await compensateStoredObject(stored);"), true);
  assert.equal(resolved.includes("compensateUncertainUpload"), false);
  // The outer catch -- the only place an uncertain commit can surface -- is the one that verifies.
  assert.equal(handler.includes("if (stored) await compensateUncertainUpload(stored);"), true);
  // A storage write that itself threw never ran a transaction, so it compensates directly too.
  const writeFailure = handler.slice(handler.indexOf("} catch (writeError) {"), handler.indexOf("const result = await db.transaction"));
  assert.equal(writeFailure.includes("await compensateStoredObject(stored)"), true);
  assert.equal(writeFailure.includes("compensateUncertainUpload"), false);
});

test("the ledger carries the file id, and the column exists additively", () => {
  assert.equal(route.includes("fileId: stored.fileId"), true);
  assert.equal(migration.includes("ALTER TABLE catering_booking_storage_orphans ADD COLUMN IF NOT EXISTS file_id varchar;"), true);
  // Deliberately not a foreign key: an orphan is an object whose metadata row may not exist.
  assert.equal(migration.includes("file_id varchar REFERENCES"), false);
  // catering_booking_files is never REDEFINED. It does gain the additive cleanup-lease columns, but every change to
  // it is an idempotent ADD COLUMN -- nothing is dropped, retyped or re-created.
  for (const change of migration.split("\n").filter((line) => line.startsWith("ALTER TABLE catering_booking_files"))) {
    assert.equal(change.includes("ADD COLUMN IF NOT EXISTS"), true, change);
  }
  assert.equal(/ALTER TABLE catering_booking_files[^\n]*(DROP|ALTER COLUMN|RENAME)/.test(migration), false);
});
