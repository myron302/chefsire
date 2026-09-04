import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_CLEANUP_MAX_ATTEMPTS, combineCateringCleanupOutcomes } from "./catering-booking-storage-cleanup";

/**
 * Cleanup work must be claimed before an attempt is spent.
 *
 * The scheduled job runs on every app replica. Two replicas selecting the same pending row both attempted it and
 * both incremented `cleanup_attempts`, so ONE scheduled opportunity consumed as many attempts as there were
 * replicas -- a row could exhaust its ceiling of ten without ever having had ten independent chances.
 *
 * The claim is a short transaction: select `FOR UPDATE SKIP LOCKED`, consume the attempt for exactly those rows,
 * commit, and only then talk to storage. There is no database harness here, so the claim SEMANTICS are exercised
 * against a small in-memory model of SKIP LOCKED and the production wiring is asserted structurally.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const service = fs.readFileSync(path.join(here, "catering-booking-storage-cleanup.ts"), "utf8");

type Row = { id: string; attempts: number; done: boolean };
/** Rows plus the locks a committed claim releases -- the part SKIP LOCKED actually decides. */
function queue(rows: Row[]) {
  const locked = new Set<string>();
  return {
    rows,
    /** One worker's claim: takes the unlocked, unfinished, under-ceiling rows and spends one attempt on each. */
    claim(limit = 10): Row[] {
      const taken = rows.filter((row) => !locked.has(row.id) && !row.done && row.attempts < CATERING_CLEANUP_MAX_ATTEMPTS).slice(0, limit);
      for (const row of taken) { locked.add(row.id); row.attempts += 1; }
      return taken;
    },
    /** The COMMIT that ends the claim transaction, before any storage call. */
    release(taken: Row[]) { for (const row of taken) locked.delete(row.id); },
  };
}

test("1. two runners cannot claim the same row concurrently", () => {
  const q = queue([{ id: "a", attempts: 0, done: false }]);
  const first = q.claim();
  // Replica B runs while A still holds its claim: the row is skipped, not waited for and not duplicated.
  const second = q.claim();
  assert.deepEqual(first.map((row) => row.id), ["a"]);
  assert.deepEqual(second, []);
});

test("2 & 3. one scheduled opportunity spends exactly one attempt, however many replicas run", () => {
  const q = queue([{ id: "a", attempts: 0, done: false }]);
  const claimed = q.claim();
  for (let replica = 0; replica < 4; replica += 1) assert.deepEqual(q.claim(), [], "a claimed row must be skipped");
  // The storage delete then fails. The attempt was already spent under the claim, so failure adds nothing further.
  q.release(claimed);
  assert.equal(q.rows[0].attempts, 1, "one opportunity, one attempt, regardless of replica count");
});

test("4. different rows are processed concurrently: SKIP LOCKED skips only what is claimed", () => {
  const q = queue([{ id: "a", attempts: 0, done: false }, { id: "b", attempts: 0, done: false }]);
  const first = q.claim(1);
  const second = q.claim(1);
  assert.deepEqual(first.map((row) => row.id), ["a"]);
  assert.deepEqual(second.map((row) => row.id), ["b"], "an unclaimed row must still be available to another worker");
  assert.deepEqual(q.rows.map((row) => row.attempts), [1, 1]);
});

test("5. a successful deletion completes the row exactly once", () => {
  const q = queue([{ id: "a", attempts: 0, done: false }]);
  const claimed = q.claim();
  claimed[0].done = true;
  q.release(claimed);
  // Completed rows leave the queue, so a later run cannot mark them again.
  assert.deepEqual(q.claim(), []);
  assert.equal(q.rows[0].attempts, 1);
  // And the production completion write is conditional on the row still being pending.
  assert.equal(service.includes("isNotNull(cateringBookingFiles.deletedAt), isNull(cateringBookingFiles.objectDeletedAt))"), true);
  assert.equal(service.includes("isNull(cateringBookingStorageOrphans.resolvedAt))"), true);
});

test("6. a worker that crashes mid-delete recovers on the next run, with no stale claim to reap", () => {
  const q = queue([{ id: "a", attempts: 0, done: false }]);
  const claimed = q.claim();
  // The claim transaction has already committed, so a crash here releases the lock with the process.
  q.release(claimed);
  const retry = q.claim();
  assert.deepEqual(retry.map((row) => row.id), ["a"], "the row must be picked up again");
  assert.equal(q.rows[0].attempts, 2, "the crashed attempt counted, so retries stay bounded");
  // The attempt counter IS the claim token, so there is no claim column to go stale and no reaper to write.
  assert.equal(/claimed_at|claim_token|claimedBy/.test(service), false);
});

test("7. attempts never exceed the ceiling, however the workers interleave", () => {
  const q = queue([{ id: "a", attempts: 0, done: false }]);
  for (let run = 0; run < 40; run += 1) {
    const claimed = q.claim();
    for (let replica = 0; replica < 3; replica += 1) q.claim();
    q.release(claimed);
  }
  assert.equal(q.rows[0].attempts, CATERING_CLEANUP_MAX_ATTEMPTS);
  // And once exhausted the row stops being selected at all rather than being retried forever.
  assert.deepEqual(q.claim(), []);
});

test("8. already completed rows are never reclaimed", () => {
  const q = queue([{ id: "a", attempts: 3, done: true }, { id: "b", attempts: 0, done: false }]);
  assert.deepEqual(q.claim().map((row) => row.id), ["b"]);
  assert.equal(q.rows[0].attempts, 3, "a finished row must not spend another attempt");
});

test("the production claim is one transaction: lock, spend, commit -- then storage", () => {
  for (const claim of ["claimTombstones", "claimOrphans"]) {
    const body = service.slice(service.indexOf(`async function ${claim}`), service.indexOf("}\n", service.indexOf(`async function ${claim}`) + 400));
    assert.equal(body.includes("db.transaction("), true, claim);
    assert.equal(body.includes(`.for("update", { skipLocked: true })`), true, claim);
    // The attempt is spent inside the same transaction as the lock.
    assert.equal(body.includes("cleanupAttempts: sql`"), true, claim);
    assert.equal(body.indexOf(`.for("update"`) < body.indexOf("cleanupAttempts: sql`"), true, claim);
    // No storage call happens while the lock is held.
    assert.equal(body.includes("removePrivateObject"), false, claim);
  }
  // And the failure paths no longer increment, because the claim already did.
  const tombstones = service.slice(service.indexOf("export async function reconcileCateringFileTombstones"), service.indexOf("export async function reconcileCateringStorageOrphans"));
  assert.equal(tombstones.includes("cleanupAttempts"), false, "an attempt must be spent once, under the claim");
});

test("an object a committed file row owns is retained rather than deleted", () => {
  // The uncertain-commit ledger entry exists because ownership was unknown. Deleting its object unconditionally
  // would reintroduce exactly the bug the ledger exists to avoid.
  const orphans = service.slice(service.indexOf("export async function reconcileCateringStorageOrphans"));
  assert.equal(orphans.includes("if (await objectHasOwner(candidate)) {"), true);
  assert.equal(orphans.indexOf("objectHasOwner(candidate)") < orphans.indexOf("removePrivateObject"), true, "ownership must be settled before deleting");
  assert.equal(orphans.includes("retained += 1;"), true);
  // The owner lookup is on the identity that names the bytes, plus the file id when the ledger carries one.
  const owner = service.slice(service.indexOf("async function objectHasOwner"), service.indexOf("/**\n * Retries the object deletion"));
  assert.equal(owner.includes("eq(cateringBookingFiles.storageKey, candidate.storageKey)"), true);
  assert.equal(owner.includes("eq(cateringBookingFiles.storageProvider, candidate.storageProvider)"), true);
  assert.equal(owner.includes("candidate.fileId === null || row.id === candidate.fileId"), true);
  // Retained objects are reported truthfully rather than counted as removals.
  assert.deepEqual(combineCateringCleanupOutcomes({ scanned: 1, removed: 0, failed: 0, retained: 1 }), { scanned: 1, removed: 0, failed: 0, retained: 1 });
});

test("tombstoned files stay invisible whatever cleanup does", () => {
  // Nothing on any cleanup path clears deleted_at, so a file stays deleted to every actor regardless of storage.
  assert.equal(/deletedAt:\s*null/.test(service), false);
  assert.equal(service.includes("objectDeletedAt: new Date()"), true);
  // Cleanup takes no caller-supplied key, provider or booking, so it cannot be steered at an arbitrary object.
  // (`req` alone would match `requested`, the batch-size argument, so the HTTP surface is what is checked.)
  for (const surface of ["req.", "res.", "express", "Request", "requireAuth"]) {
    assert.equal(service.includes(surface), false, surface);
  }
  // Every key it acts on is read from a persisted row inside this module.
  assert.equal(service.includes("candidate.storageKey"), true);
});
