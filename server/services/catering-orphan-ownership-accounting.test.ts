import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_CLEANUP_LEASE_SECONDS, CATERING_CLEANUP_MAX_ATTEMPTS, cateringCleanupChargesAttempt, settleCateringFinalization, type CateringCleanupConclusion } from "./catering-booking-storage-cleanup";

/**
 * A database question the cleanup pass could not answer is not a storage attempt.
 *
 * Before the orphan queue may delete anything it has to establish that no committed `catering_booking_files` row
 * owns the object -- that is the whole point of the uncertain-commit ledger, which exists because the metadata's
 * fate was unknown and the bytes must not be deleted until it is settled. That check is a SELECT. When it fails,
 * `removePrivateObject` is never called: nothing was deleted, nothing was even attempted.
 *
 * Grouping that failure with a storage failure meant a briefly unavailable database could charge all ten attempts
 * against a row whose object storage was never asked about. Past the ceiling the row is no longer claimed at all,
 * so the object it names is stranded permanently -- the exact opposite of what the ceiling is for, which is to stop
 * a broken STORAGE backend being hammered forever.
 *
 * There is no database harness in this suite, so the queue is simulated over the helpers the service itself calls,
 * and the service is asserted structurally to run the phases separately.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const service = fs.readFileSync(path.join(here, "catering-booking-storage-cleanup.ts"), "utf8");
const orphans = service.slice(service.indexOf("export async function reconcileCateringStorageOrphans"));

type OrphanRow = {
  id: string;
  storageKey: string;
  fileId: string | null;
  resolvedAt: Date | null;
  cleanupAttempts: number;
  cleanupError: string | null;
  cleanupClaimToken: string | null;
  cleanupClaimedUntil: number | null;
};
function orphanRow(overrides: Partial<OrphanRow> = {}): OrphanRow {
  return { id: "orphan-1", storageKey: "catering-bookings/b1/file-1", fileId: "file-1", resolvedAt: null, cleanupAttempts: 0, cleanupError: null, cleanupClaimToken: null, cleanupClaimedUntil: null, ...overrides };
}

/** Private storage with `removePrivateObject`'s own semantics: deleting what is already gone is a success. */
function storageHolding(...keys: string[]) {
  const present = new Set(keys);
  let failWith: string | null = null;
  let calls = 0;
  return {
    get calls() { return calls; },
    holds: (key: string) => present.has(key),
    breakWith(message: string) { failWith = message; },
    repair() { failWith = null; },
    remove(key: string) {
      calls += 1;
      if (failWith !== null) throw new Error(failWith);
      present.delete(key);
    },
  };
}

/** The one place an attempt may be charged, exactly as the service writes it. */
function settle(row: OrphanRow, conclusion: CateringCleanupConclusion, error: unknown, token: string) {
  if (row.cleanupClaimToken !== token) return;
  if (cateringCleanupChargesAttempt(conclusion)) row.cleanupAttempts = Math.min(row.cleanupAttempts + 1, CATERING_CLEANUP_MAX_ATTEMPTS);
  row.cleanupError = error instanceof Error ? error.message : String(error);
  row.cleanupClaimToken = null;
  row.cleanupClaimedUntil = null;
}

const eligible = (row: OrphanRow, now: number) =>
  row.resolvedAt === null && row.cleanupAttempts < CATERING_CLEANUP_MAX_ATTEMPTS && (row.cleanupClaimedUntil === null || row.cleanupClaimedUntil <= now);

type Ownership = () => boolean;
let tokens = 0;
/** One orphan reconciliation pass: claim under a durable lease, ask ownership, then delete, then finalize. */
async function reconcile(rows: OrphanRow[], storage: ReturnType<typeof storageHolding>, now: number, ownership: Ownership, finalizeFails = false) {
  const token = `claim-${(tokens += 1)}`;
  const claimed: OrphanRow[] = [];
  for (const row of rows.filter((candidate) => eligible(candidate, now))) {
    if (row.cleanupClaimToken !== null) {
      row.cleanupAttempts = Math.min(row.cleanupAttempts + 1, CATERING_CLEANUP_MAX_ATTEMPTS);
      row.cleanupClaimToken = null;
      row.cleanupClaimedUntil = null;
      if (row.cleanupAttempts >= CATERING_CLEANUP_MAX_ATTEMPTS) continue;
    }
    row.cleanupClaimToken = token;
    row.cleanupClaimedUntil = now + CATERING_CLEANUP_LEASE_SECONDS * 1000;
    claimed.push(row);
  }
  let removed = 0; let failed = 0; let retained = 0;
  for (const row of claimed) {
    let owned: boolean;
    try { owned = ownership(); }
    catch (error) { settle(row, "ownership_failed", error, token); failed += 1; continue; }
    if (!owned) {
      try { storage.remove(row.storageKey); }
      catch (error) { settle(row, "storage_failed", error, token); failed += 1; continue; }
    }
    const finalized = await settleCateringFinalization(async () => {
      if (finalizeFails) throw new Error("database unavailable");
      if (row.cleanupClaimToken !== token) return;
      row.resolvedAt = new Date(now);
      row.cleanupError = null;
      row.cleanupClaimToken = null;
      row.cleanupClaimedUntil = null;
    });
    if (finalized.ok) { if (owned) retained += 1; else removed += 1; continue; }
    settle(row, "unfinalized", finalized.error, token);
    failed += 1;
  }
  return { scanned: claimed.length, removed, failed, retained };
}

const T0 = Date.parse("2026-09-01T12:00:00Z");
const LATER = (seconds: number) => T0 + seconds * 1000;
const OWNED: Ownership = () => true;
const UNOWNED: Ownership = () => false;
const UNANSWERABLE: Ownership = () => { throw new Error("connection terminated"); };

test("13. an owned object is retained, deleted by nothing, and charges no attempt", async () => {
  const row = orphanRow();
  const storage = storageHolding(row.storageKey);
  const outcome = await reconcile([row], storage, T0, OWNED);
  assert.deepEqual(outcome, { scanned: 1, removed: 0, failed: 0, retained: 1 });
  assert.equal(storage.calls, 0, "an owned object is never handed to storage");
  assert.equal(storage.holds(row.storageKey), true);
  assert.notEqual(row.resolvedAt, null, "the ledger entry stops being pending");
  assert.equal(row.cleanupAttempts, 0);
});

test("14. an unowned object is deleted and its entry resolved, charging nothing", async () => {
  const row = orphanRow({ fileId: null });
  const storage = storageHolding(row.storageKey);
  const outcome = await reconcile([row], storage, T0, UNOWNED);
  assert.deepEqual(outcome, { scanned: 1, removed: 1, failed: 0, retained: 0 });
  assert.equal(storage.holds(row.storageKey), false);
  assert.notEqual(row.resolvedAt, null);
  assert.equal(row.cleanupAttempts, 0);
  assert.equal(row.cleanupError, null);
});

test("15. a failed delete of an unowned object charges exactly one storage attempt", async () => {
  const row = orphanRow({ fileId: null });
  const storage = storageHolding(row.storageKey);
  storage.breakWith("R2 unavailable");
  const outcome = await reconcile([row], storage, T0, UNOWNED);
  assert.equal(outcome.failed, 1);
  assert.equal(row.cleanupAttempts, 1);
  assert.equal(row.cleanupError, "R2 unavailable");
  assert.equal(storage.holds(row.storageKey), true);
  assert.equal(row.resolvedAt, null);
  assert.equal(eligible(row, LATER(1)), true, "the lease is released, so a later run retries");
});

test("16. an ownership lookup that fails deletes nothing and charges nothing", async () => {
  const row = orphanRow();
  const storage = storageHolding(row.storageKey);
  const outcome = await reconcile([row], storage, T0, UNANSWERABLE);
  assert.equal(outcome.failed, 1);
  assert.equal(storage.calls, 0, "removePrivateObject must never be called while ownership is unknown");
  assert.equal(storage.holds(row.storageKey), true);
  assert.equal(row.cleanupAttempts, 0, "an unasked storage question is not a failed storage attempt");
  assert.equal(row.cleanupError, "connection terminated");
  assert.equal(row.resolvedAt, null, "an unanswerable question resolves nothing");
  assert.equal(eligible(row, LATER(1)), true);
});

test("17. fifteen consecutive ownership failures leave the row untouched and eligible", async () => {
  const row = orphanRow();
  const storage = storageHolding(row.storageKey);
  for (let pass = 0; pass < 15; pass += 1) {
    const outcome = await reconcile([row], storage, LATER(3600 * (pass + 1)), UNANSWERABLE);
    assert.equal(outcome.scanned, 1, `pass ${pass} must still claim the row`);
  }
  assert.equal(row.cleanupAttempts, 0);
  assert.equal(row.cleanupAttempts < CATERING_CLEANUP_MAX_ATTEMPTS, true, "the storage ceiling must not be reachable this way");
  assert.equal(storage.calls, 0);
  assert.equal(eligible(row, LATER(3600 * 16)), true, "the object must never be stranded");
});

test("18. the pass after the database recovers finishes the object normally", async () => {
  const row = orphanRow({ fileId: null });
  const storage = storageHolding(row.storageKey);
  for (let pass = 0; pass < 15; pass += 1) await reconcile([row], storage, LATER(3600 * (pass + 1)), UNANSWERABLE);
  const outcome = await reconcile([row], storage, LATER(3600 * 16), UNOWNED);
  assert.deepEqual(outcome, { scanned: 1, removed: 1, failed: 0, retained: 0 });
  assert.equal(storage.holds(row.storageKey), false);
  assert.notEqual(row.resolvedAt, null);
  assert.equal(row.cleanupAttempts, 0);
});

test("19. an ownership failure releases the lease rather than making the row wait it out", async () => {
  const row = orphanRow();
  const storage = storageHolding(row.storageKey);
  await reconcile([row], storage, T0, UNANSWERABLE);
  assert.equal(row.cleanupClaimToken, null);
  assert.equal(row.cleanupClaimedUntil, null);
  // Immediately eligible again -- well inside the lease it would otherwise have held.
  assert.equal(eligible(row, T0 + 1), true);
  assert.equal(CATERING_CLEANUP_LEASE_SECONDS, 300);
});

test("20. a stale token settles nothing, on any conclusion", () => {
  const row = orphanRow({ cleanupClaimToken: "someone-else", cleanupClaimedUntil: LATER(120), cleanupAttempts: 3 });
  for (const conclusion of ["storage_failed", "ownership_failed", "unfinalized"] as const) {
    settle(row, conclusion, new Error("late"), "a-stale-token");
  }
  assert.equal(row.cleanupAttempts, 3);
  assert.equal(row.cleanupError, null);
  assert.equal(row.cleanupClaimToken, "someone-else");
  assert.equal(eligible(row, LATER(60)), false, "another worker's live lease still excludes the row");
  // Both queues still condition every finalization on the token.
  assert.equal(service.includes("eq(cateringBookingStorageOrphans.cleanupClaimToken, candidate.claimToken)"), true);
  assert.equal(service.includes("eq(cateringBookingFiles.cleanupClaimToken, candidate.claimToken)"), true);
});

test("21. genuine repeated storage failures still reach the ceiling and stop", async () => {
  const row = orphanRow({ fileId: null });
  const storage = storageHolding(row.storageKey);
  storage.breakWith("R2 unavailable");
  for (let pass = 0; pass < CATERING_CLEANUP_MAX_ATTEMPTS + 3; pass += 1) {
    await reconcile([row], storage, LATER(3600 * (pass + 1)), UNOWNED);
  }
  assert.equal(row.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS);
  assert.equal(eligible(row, LATER(3600 * 100)), false, "an exhausted row stops being claimed");
  assert.equal(storage.calls, CATERING_CLEANUP_MAX_ATTEMPTS, "and no delete is attempted past the ceiling");
});

test("22. a finalization failure after a real delete is still non-chargeable", async () => {
  const row = orphanRow({ fileId: null });
  const storage = storageHolding(row.storageKey);
  const outcome = await reconcile([row], storage, T0, UNOWNED, true);
  assert.equal(outcome.failed, 1);
  assert.equal(storage.holds(row.storageKey), false, "the bytes did go");
  assert.equal(row.resolvedAt, null);
  assert.equal(row.cleanupAttempts, 0);
  assert.equal(eligible(row, LATER(1)), true);
  assert.equal(cateringCleanupChargesAttempt("unfinalized"), false);
});

test("23. the retry of an already-absent object is idempotent and finishes the entry", async () => {
  const row = orphanRow({ fileId: null });
  const storage = storageHolding(row.storageKey);
  await reconcile([row], storage, T0, UNOWNED, true);
  assert.equal(storage.holds(row.storageKey), false);
  const outcome = await reconcile([row], storage, LATER(3600), UNOWNED);
  assert.deepEqual(outcome, { scanned: 1, removed: 1, failed: 0, retained: 0 });
  assert.notEqual(row.resolvedAt, null);
  assert.equal(row.cleanupAttempts, 0);
});

test("24. uncertain-commit protection and the charge rule are exactly where they should be", () => {
  // Only a storage failure charges. Ownership and bookkeeping failures never did any storage work.
  assert.equal(cateringCleanupChargesAttempt("storage_failed"), true);
  assert.equal(cateringCleanupChargesAttempt("ownership_failed"), false);
  assert.equal(cateringCleanupChargesAttempt("unfinalized"), false);
  assert.equal(cateringCleanupChargesAttempt("removed"), false);
  // The service asks ownership in its own phase, and nothing in that phase touches storage.
  const lookup = orphans.slice(orphans.indexOf("let owned: boolean;"), orphans.indexOf("if (!owned) {"));
  assert.equal(lookup.includes("removePrivateObject"), false);
  assert.equal(lookup.includes(`settle(candidate, "ownership_failed", error);`), true);
  // The delete is guarded on a definite answer of "no owner", and only its own failure is a storage failure.
  const deletion = orphans.slice(orphans.indexOf("if (!owned) {"), orphans.indexOf("const finalized = await settleCateringFinalization"));
  assert.equal(deletion.includes("await removePrivateObject("), true);
  assert.equal(deletion.includes(`settle(candidate, "storage_failed", error);`), true);
  assert.equal(deletion.includes("objectHasOwner"), false);
  // And the ownership question itself is still the identity that names the bytes, plus the file id when present.
  assert.equal(service.includes("eq(cateringBookingFiles.storageKey, candidate.storageKey)"), true);
  assert.equal(service.includes("return candidate.fileId === null || row.id === candidate.fileId;"), true);
});
