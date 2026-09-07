import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_CLEANUP_LEASE_SECONDS, CATERING_CLEANUP_MAX_ATTEMPTS, CATERING_UNCERTAIN_COMMIT_GRACE_SECONDS, CATERING_UNCERTAIN_COMMIT_REASON, cateringCleanupChargesAttempt, cateringCommitIsDecided, cateringOrphanInitialAttempts, cateringReclaimChargesAttempt, cateringUncertainCommitIsRipe, type CateringCleanupConclusion } from "./catering-booking-storage-cleanup";

/**
 * One absent read immediately after an indeterminate COMMIT is not proof of rollback.
 *
 * A transaction can reject to the application because the connection died while PostgreSQL was still processing
 * COMMIT. The server finishes it anyway, and the row becomes visible to a NEW snapshot moments afterwards. The
 * compensation used to read once on a fresh connection, see nothing, and delete the object -- so the delayed COMMIT
 * then surfaced an active file row pointing at bytes that no longer existed, permanently and with no way back.
 *
 * The fix has two halves. The compensation only treats an absent reading as authoritative when the DATABASE ITSELF
 * reported the failure with a SQLSTATE, which means the server processed the statement and aborted the transaction;
 * anything else records an uncertain-commit orphan and deletes nothing. And the cleanup queue leaves such a row
 * alone until its reconciliation window has passed, then asks the ownership question a second time before touching
 * storage. Waiting costs no storage attempt, because an unripe row is never claimed at all.
 *
 * There is no database harness in this suite, so the queue is simulated over the helpers the service itself calls,
 * and the service and route are asserted structurally to wire them up that way.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const service = fs.readFileSync(path.join(here, "catering-booking-storage-cleanup.ts"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-files.ts"), "utf8");

const SECOND = 1000;
const GRACE = CATERING_UNCERTAIN_COMMIT_GRACE_SECONDS * SECOND;

// ---------------------------------------------------------------------------------------------------------------
// The compensation decision, at the moment the upload fails.
// ---------------------------------------------------------------------------------------------------------------

type CommitState = "committed" | "absent" | "unknown";
type Compensation = "left_alone" | "deleted" | "orphaned";
/** `compensateUncertainUpload`, transcribed. */
function compensate(state: CommitState, error: unknown): Compensation {
  if (state === "committed") return "left_alone";
  if (state === "absent" && cateringCommitIsDecided(error)) return "deleted";
  return "orphaned";
}
const dropped = Object.assign(new Error("Connection terminated unexpectedly"), { code: "ECONNRESET" });
const duringCommit = Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" });
const linkFailure = Object.assign(new Error("connection failure"), { code: "08006" });
const rolledBack = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });

test("1. an absent read after an indeterminate failure does not delete the object", () => {
  for (const error of [dropped, duringCommit, linkFailure, new Error("socket hang up"), undefined, { message: "no code at all" }]) {
    assert.equal(compensate("absent", error), "orphaned", String((error as { code?: string })?.code ?? "no code"));
  }
  // The old behaviour, for contrast: any absent reading was taken as proof and the bytes went immediately.
  assert.equal(cateringCommitIsDecided(dropped), false);
});

test("2. a rollback the database itself reported IS decided, so the ordinary compensating delete still happens", () => {
  // A statement the server processed and refused aborts the transaction: no commit can still be in flight.
  for (const code of ["23505", "23514", "23503", "40001", "40P01", "22001", "42703"]) {
    assert.equal(cateringCommitIsDecided(Object.assign(new Error("refused"), { code })), true, code);
    assert.equal(compensate("absent", Object.assign(new Error("refused"), { code })), "deleted", code);
  }
  assert.equal(compensate("absent", rolledBack), "deleted", "an ordinary validation failure must not defer cleanup");
});

test("3. a committed row is left entirely alone, whatever the failure was", () => {
  for (const error of [dropped, rolledBack, duringCommit]) assert.equal(compensate("committed", error), "left_alone");
  // And an unanswerable verification never deletes either, decided failure or not.
  for (const error of [dropped, rolledBack]) assert.equal(compensate("unknown", error), "orphaned");
});

test("4. an uncertain-commit orphan starts with no storage attempt spent; a failed compensating delete starts at one", () => {
  assert.equal(cateringOrphanInitialAttempts("uncertain_commit"), 0);
  assert.equal(cateringOrphanInitialAttempts("failed_delete"), 1);
});

// ---------------------------------------------------------------------------------------------------------------
// The deferred reconciliation, in the cleanup queue.
// ---------------------------------------------------------------------------------------------------------------

type OrphanRow = {
  id: string;
  reason: string;
  storageKey: string;
  fileId: string | null;
  createdAt: number;
  resolvedAt: Date | null;
  cleanupAttempts: number;
  cleanupError: string | null;
  cleanupClaimToken: string | null;
  cleanupClaimedUntil: number | null;
  cleanupDeleteAttemptedAt: number | null;
};
function uncertainRow(createdAt: number, overrides: Partial<OrphanRow> = {}): OrphanRow {
  return {
    id: "orphan-1", reason: CATERING_UNCERTAIN_COMMIT_REASON, storageKey: "catering-bookings/b1/file-1", fileId: "file-1",
    createdAt, resolvedAt: null, cleanupAttempts: cateringOrphanInitialAttempts("uncertain_commit"), cleanupError: null,
    cleanupClaimToken: null, cleanupClaimedUntil: null, cleanupDeleteAttemptedAt: null, ...overrides,
  };
}
function storageHolding(...keys: string[]) {
  const present = new Set(keys);
  let failWith: string | null = null;
  let calls = 0;
  return {
    get calls() { return calls; },
    holds: (key: string) => present.has(key),
    breakWith(message: string) { failWith = message; },
    repair() { failWith = null; },
    remove(key: string) { calls += 1; if (failWith !== null) throw new Error(failWith); present.delete(key); },
  };
}
function settle(row: OrphanRow, conclusion: CateringCleanupConclusion, error: unknown, token: string) {
  if (row.cleanupClaimToken !== token) return;
  if (cateringCleanupChargesAttempt(conclusion)) row.cleanupAttempts = Math.min(row.cleanupAttempts + 1, CATERING_CLEANUP_MAX_ATTEMPTS);
  row.cleanupError = error instanceof Error ? error.message : String(error);
  row.cleanupClaimToken = null;
  row.cleanupClaimedUntil = null;
  row.cleanupDeleteAttemptedAt = null;
}
/** The claim predicate, including the grace term the query now carries. */
const claimable = (row: OrphanRow, now: number) =>
  row.resolvedAt === null
  && row.cleanupAttempts < CATERING_CLEANUP_MAX_ATTEMPTS
  && (row.cleanupClaimedUntil === null || row.cleanupClaimedUntil <= now)
  && cateringUncertainCommitIsRipe({ reason: row.reason, createdAt: new Date(row.createdAt) }, new Date(now));

/** Whether a committed file row owns the object; `null` stands for a lookup that failed. */
type Ownership = () => boolean | null;
let tokens = 0;
/** One orphan reconciliation pass: claim under a durable lease, ask ownership, then delete, then finalize. */
function reconcile(rows: OrphanRow[], storage: ReturnType<typeof storageHolding>, now: number, ownership: Ownership) {
  const token = `claim-${(tokens += 1)}`;
  const claimed: OrphanRow[] = [];
  for (const row of rows.filter((candidate) => claimable(candidate, now))) {
    if (cateringReclaimChargesAttempt({ hadToken: row.cleanupClaimToken !== null, deleteAttempted: row.cleanupDeleteAttemptedAt !== null })) {
      row.cleanupAttempts = Math.min(row.cleanupAttempts + 1, CATERING_CLEANUP_MAX_ATTEMPTS);
      if (row.cleanupAttempts >= CATERING_CLEANUP_MAX_ATTEMPTS) { row.cleanupClaimToken = null; row.cleanupClaimedUntil = null; row.cleanupDeleteAttemptedAt = null; continue; }
    }
    row.cleanupClaimToken = token;
    row.cleanupClaimedUntil = now + CATERING_CLEANUP_LEASE_SECONDS * SECOND;
    row.cleanupDeleteAttemptedAt = null;
    claimed.push(row);
  }
  let removed = 0; let failed = 0; let retained = 0;
  for (const row of claimed) {
    const owned = ownership();
    if (owned === null) { settle(row, "ownership_failed", new Error("ownership could not be established"), token); failed += 1; continue; }
    if (!owned) {
      row.cleanupDeleteAttemptedAt = now;
      try { storage.remove(row.storageKey); } catch (error) { settle(row, "storage_failed", error, token); failed += 1; continue; }
    }
    row.resolvedAt = new Date(now);
    row.cleanupError = null;
    row.cleanupClaimToken = null;
    row.cleanupClaimedUntil = null;
    row.cleanupDeleteAttemptedAt = null;
    if (owned) retained += 1; else removed += 1;
  }
  return { scanned: claimed.length, removed, failed, retained };
}
const absent: Ownership = () => false;
const owned: Ownership = () => true;
const unanswerable: Ownership = () => null;

test("5. inside the reconciliation window the row is not claimed, so nothing is deleted and nothing is charged", () => {
  const now = 1_000_000_000_000;
  const row = uncertainRow(now);
  const storage = storageHolding(row.storageKey);
  for (const at of [now, now + SECOND, now + GRACE / 2, now + GRACE - SECOND]) {
    const pass = reconcile([row], storage, at, absent);
    assert.equal(pass.scanned, 0, `claimed at +${(at - now) / SECOND}s`);
  }
  assert.equal(storage.calls, 0, "storage must not be asked anything during the window");
  assert.equal(row.cleanupAttempts, 0, "waiting is not a storage attempt");
  assert.equal(row.cleanupClaimToken, null, "and an unripe row never holds a lease to abandon");
  assert.equal(storage.holds(row.storageKey), true);
});

test("6. a delayed COMMIT that becomes visible during the window resolves the orphan and never deletes", () => {
  const now = 1_000_000_000_000;
  const row = uncertainRow(now);
  const storage = storageHolding(row.storageKey);
  // The row committed a second after the failure -- exactly the case the immediate delete destroyed.
  reconcile([row], storage, now + SECOND, owned);
  assert.equal(row.resolvedAt, null, "it was not even claimed yet");
  const pass = reconcile([row], storage, now + GRACE, owned);
  assert.equal(pass.retained, 1);
  assert.equal(pass.removed, 0);
  assert.equal(storage.calls, 0, "an owned object is never handed to storage");
  assert.equal(storage.holds(row.storageKey), true, "the committed file's bytes must still be there");
  assert.notEqual(row.resolvedAt, null, "and the orphan is settled rather than retried forever");
  assert.equal(row.cleanupAttempts, 0);
});

test("7. an ownership lookup that fails deletes nothing and charges nothing, however often it fails", () => {
  const now = 1_000_000_000_000;
  const row = uncertainRow(now);
  const storage = storageHolding(row.storageKey);
  for (let pass = 0; pass < 12; pass += 1) reconcile([row], storage, now + GRACE + pass * CATERING_CLEANUP_LEASE_SECONDS * SECOND * 2, unanswerable);
  assert.equal(storage.calls, 0);
  assert.equal(row.cleanupAttempts, 0, "a database question the pass could not answer is not a storage attempt");
  assert.equal(row.resolvedAt, null);
  assert.equal(storage.holds(row.storageKey), true);
  // And once the database answers, the row is still workable rather than exhausted.
  const settled = reconcile([row], storage, now + GRACE + 40 * CATERING_CLEANUP_LEASE_SECONDS * SECOND, absent);
  assert.equal(settled.removed, 1);
});

test("8. a truly rolled-back upload is deleted once the window has passed", () => {
  const now = 1_000_000_000_000;
  const row = uncertainRow(now);
  const storage = storageHolding(row.storageKey);
  const pass = reconcile([row], storage, now + GRACE, absent);
  assert.equal(pass.removed, 1);
  assert.equal(storage.holds(row.storageKey), false, "an object nothing owns does not survive forever");
  assert.notEqual(row.resolvedAt, null);
  assert.equal(row.cleanupAttempts, 0, "a delete that succeeded charges nothing");
});

test("9. the first real delete failure charges exactly one attempt", () => {
  const now = 1_000_000_000_000;
  const row = uncertainRow(now);
  const storage = storageHolding(row.storageKey);
  storage.breakWith("R2 unavailable");
  reconcile([row], storage, now + GRACE, absent);
  assert.equal(storage.calls, 1);
  assert.equal(row.cleanupAttempts, 1, "0 -> 1 on the first real delete");
  assert.notEqual(row.cleanupError, null);
});

test("10. ten real delete failures remain the exact ceiling, and the window did not consume any of them", () => {
  const now = 1_000_000_000_000;
  const row = uncertainRow(now);
  const storage = storageHolding(row.storageKey);
  storage.breakWith("R2 unavailable");
  let at = now + GRACE;
  // Passes during the window first: they must leave the budget untouched.
  for (let pass = 0; pass < 5; pass += 1) reconcile([row], storage, now + pass * SECOND, absent);
  assert.equal(row.cleanupAttempts, 0);
  for (let pass = 0; pass < 20; pass += 1) { reconcile([row], storage, at, absent); at += CATERING_CLEANUP_LEASE_SECONDS * SECOND * 2; }
  assert.equal(row.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS);
  assert.equal(storage.calls, CATERING_CLEANUP_MAX_ATTEMPTS, "exactly ten real delete attempts, never eleven");
});

test("11. a failed-delete orphan waits for nothing: it was recorded after the outcome was already known", () => {
  const now = 1_000_000_000_000;
  const row = uncertainRow(now, { reason: "orphaned_upload", cleanupAttempts: cateringOrphanInitialAttempts("failed_delete") });
  assert.equal(row.cleanupAttempts, 1, "its compensating delete really was attempted and really did fail");
  const storage = storageHolding(row.storageKey);
  const pass = reconcile([row], storage, now, absent);
  assert.equal(pass.removed, 1, "no grace applies to a row whose commit outcome was never in doubt");
  assert.equal(cateringUncertainCommitIsRipe({ reason: "orphaned_upload", createdAt: new Date(now) }, new Date(now)), true);
  assert.equal(cateringUncertainCommitIsRipe({ reason: "uncertain_upload", createdAt: new Date(now) }, new Date(now)), true);
});

test("12. an object whose row committed never reaches storage, over any number of passes", () => {
  const now = 1_000_000_000_000;
  const row = uncertainRow(now);
  const storage = storageHolding(row.storageKey);
  let at = now;
  for (let pass = 0; pass < 30; pass += 1) { reconcile([row], storage, at, owned); at += CATERING_CLEANUP_LEASE_SECONDS * SECOND * 2; }
  assert.equal(storage.calls, 0);
  assert.equal(storage.holds(row.storageKey), true);
  assert.equal(row.cleanupAttempts, 0);
});

test("13. a live lease still excludes a second worker, and only lapses on the database clock", () => {
  const now = 1_000_000_000_000;
  const at = now + GRACE;
  const row = uncertainRow(now, { cleanupClaimToken: "held", cleanupClaimedUntil: at + CATERING_CLEANUP_LEASE_SECONDS * SECOND });
  const storage = storageHolding(row.storageKey);
  assert.equal(reconcile([row], storage, at, absent).scanned, 0, "a ripe row that is leased is still somebody else's");
  assert.equal(storage.calls, 0);
  assert.equal(row.cleanupAttempts, 0);
  // Once the lease lapses it is re-handed out -- ripeness and leasing are independent gates, both required.
  assert.equal(reconcile([row], storage, at + CATERING_CLEANUP_LEASE_SECONDS * SECOND, absent).scanned, 1);
});

test("13b. a lease that lapsed before the delete boundary is re-handed out uncharged; one that reached it is charged once", () => {
  const now = 1_000_000_000_000;
  const before = uncertainRow(now, { id: "before", cleanupClaimToken: "gone", cleanupClaimedUntil: now + GRACE - SECOND, cleanupDeleteAttemptedAt: null });
  const after = uncertainRow(now, { id: "after", cleanupClaimToken: "gone", cleanupClaimedUntil: now + GRACE - SECOND, cleanupDeleteAttemptedAt: now + GRACE - 2 * SECOND });
  const storage = storageHolding(before.storageKey, after.storageKey);
  reconcile([before, after], storage, now + GRACE, absent);
  assert.equal(before.cleanupAttempts, 0, "no storage work was begun, so nothing may be charged for abandoning it");
  assert.equal(after.cleanupAttempts, 1, "the delete may well have happened, so charging once is the conservative reading");
  // A finalization written under a stale token changes nothing.
  const stale = uncertainRow(now, { cleanupClaimToken: "current" });
  settle(stale, "storage_failed", new Error("late"), "someone-elses");
  assert.equal(stale.cleanupAttempts, 0);
  assert.equal(stale.cleanupClaimToken, "current");
});

test("14. two ledger rows for the same upload keep their own budgets and their own windows", () => {
  const now = 1_000_000_000_000;
  const first = uncertainRow(now, { id: "first" });
  const second = uncertainRow(now + GRACE, { id: "second" });
  const storage = storageHolding(first.storageKey);
  storage.breakWith("R2 unavailable");
  reconcile([first, second], storage, now + GRACE, absent);
  assert.equal(first.cleanupAttempts, 1, "the older row is ripe and spends its own attempt");
  assert.equal(second.cleanupAttempts, 0, "a duplicate record does not inherit or reset the other's budget");
  // The second becomes eligible on its OWN created_at, so a re-record cannot shorten or extend anybody's window.
  assert.equal(claimable(second, now + GRACE), false);
  assert.equal(claimable(second, now + GRACE + GRACE), true);
});

test("15. ripeness is derived from the row and the clock alone, so it survives a worker restart", () => {
  const now = new Date(1_700_000_000_000);
  const row = { reason: CATERING_UNCERTAIN_COMMIT_REASON, createdAt: new Date(now.getTime() - GRACE) };
  assert.equal(cateringUncertainCommitIsRipe(row, now), true);
  assert.equal(cateringUncertainCommitIsRipe({ ...row, createdAt: new Date(now.getTime() - GRACE + 1) }, now), false);
  // Nothing process-local is involved: the same row and the same instant answer the same way in any order.
  assert.equal(cateringUncertainCommitIsRipe(row, now), true);
  // The query enforces it against the DATABASE clock and the row's persisted `created_at`, never an app timestamp.
  const claim = service.slice(service.indexOf("async function claimOrphans"), service.indexOf("async function objectHasOwner"));
  assert.equal(claim.includes("uncertainCommitIsRipe()"), true);
  assert.equal(service.includes("lte(cateringBookingStorageOrphans.createdAt, sql`now() - (${CATERING_UNCERTAIN_COMMIT_GRACE_SECONDS} * interval '1 second')`)"), true);
  assert.equal(service.includes("ne(cateringBookingStorageOrphans.reason, CATERING_UNCERTAIN_COMMIT_REASON)"), true);
  assert.equal(/const uncertainCommitIsRipe[\s\S]{0,400}Date\.now\(\)/.test(service), false, "the app clock must not decide this");
});

test("16. the route defers instead of deleting, and both ends name the same reason", () => {
  const compensation = route.slice(route.indexOf("async function compensateUncertainUpload"), route.indexOf("async function respondWithAcceptedUpload"));
  // The single immediate delete is now conditioned on the failure being a decided one.
  assert.equal(compensation.includes(`if (state === "absent" && cateringCommitIsDecided(error)) return compensateStoredObject(stored);`), true);
  assert.equal(compensation.includes(`if (state === "absent") return compensateStoredObject(stored);`), false, "an absent read alone must never delete again");
  assert.equal(compensation.includes(`if (state === "committed") return;`), true);
  // Everything else records the ledger row, from the shared constant, with no storage attempt spent.
  assert.equal(compensation.includes(`recordStorageOrphan({ ...stored, reason: CATERING_UNCERTAIN_COMMIT_REASON }, detail, "uncertain_commit")`), true);
  assert.equal(/compensateUncertainUpload[\s\S]*removePrivateObject/.test(compensation), false, "nothing on this path deletes directly");
  // The error that aborted the transaction is what the decision reads, so it has to reach the compensation.
  assert.equal(route.includes("if (stored) await compensateUncertainUpload(stored, error);"), true);
  assert.equal(service.includes(`export const CATERING_UNCERTAIN_COMMIT_REASON = "uncertain_commit";`), true);
});
