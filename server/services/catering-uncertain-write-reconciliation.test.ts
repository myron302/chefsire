import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_CLEANUP_LEASE_SECONDS, CATERING_CLEANUP_MAX_ATTEMPTS, CATERING_UNCERTAINTY_GRACE_SECONDS, CATERING_UNCERTAIN_COMMIT_REASON, CATERING_UNCERTAIN_WRITE_REASON, cateringCleanupChargesAttempt, cateringOrphanInitialAttempts, cateringReclaimChargesAttempt, cateringReconciliationIsRipe, type CateringCleanupConclusion } from "./catering-booking-storage-cleanup";
import type { PrivateObjectPresence } from "../lib/private-storage";

/**
 * A successful compensating DELETE is not proof that an indeterminate PUT can no longer land.
 *
 * An R2 PUT can time out at the client while the service is still committing the write. The compensating DELETE
 * then runs, reaches R2 BEFORE the delayed PUT becomes visible, and succeeds -- because at that instant the key
 * genuinely is not there. The route treated that success as conclusive, cleared its compensation state and recorded
 * nothing; the delayed PUT completed afterwards, and the bucket was left holding a private object with no file row
 * and no ledger entry. Nothing knew it existed, so nothing would ever collect it.
 *
 * The delete is still attempted immediately -- if the object IS there it goes now -- but the key is recorded either
 * way, and it is the reconciliation pass that retires it: after the uncertainty window, and only once storage
 * itself has answered. A storage question that could not be answered is not a delete attempt, exactly as a database
 * question is not.
 *
 * There is no storage or database harness in this suite, so the queue is simulated over the helpers the service
 * itself calls, and the service and route are asserted structurally to wire them up that way.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const service = fs.readFileSync(path.join(here, "catering-booking-storage-cleanup.ts"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-files.ts"), "utf8");
const storageLib = fs.readFileSync(path.join(here, "..", "lib", "private-storage.ts"), "utf8");
const r2 = fs.readFileSync(path.join(here, "..", "lib", "r2.ts"), "utf8");

const SECOND = 1000;
const GRACE = CATERING_UNCERTAINTY_GRACE_SECONDS * SECOND;

// ---------------------------------------------------------------------------------------------------------------
// The compensation, at the moment the write fails.
// ---------------------------------------------------------------------------------------------------------------

type Compensated = { deleted: boolean; recorded: { reason: string; attempts: number } | null };
/** `compensateUncertainWrite`, transcribed. */
function compensateUncertainWrite(deleteSucceeds: boolean): Compensated {
  if (!deleteSucceeds) return { deleted: false, recorded: { reason: CATERING_UNCERTAIN_WRITE_REASON, attempts: cateringOrphanInitialAttempts("failed_delete") } };
  return { deleted: true, recorded: { reason: CATERING_UNCERTAIN_WRITE_REASON, attempts: cateringOrphanInitialAttempts("uncertain_write") } };
}

test("1. a successful immediate DELETE does not end the tracking", () => {
  const outcome = compensateUncertainWrite(true);
  assert.equal(outcome.deleted, true, "the delete is still attempted: if the object is there it goes now");
  assert.notEqual(outcome.recorded, null, "but the key stays under reconciliation, because a delayed PUT may still land");
  assert.equal(outcome.recorded?.reason, CATERING_UNCERTAIN_WRITE_REASON);
});

test("2. a successful immediate DELETE spends no attempt; a failed one spends exactly one", () => {
  // The module's established rule, unchanged: only a delete that FAILED has ever charged the ceiling.
  assert.equal(cateringOrphanInitialAttempts("uncertain_write"), 0);
  assert.equal(cateringOrphanInitialAttempts("failed_delete"), 1);
  assert.equal(cateringCleanupChargesAttempt("removed"), false, "a delete that succeeded charges nothing anywhere");
  assert.equal(cateringCleanupChargesAttempt("storage_failed"), true);
  assert.equal(compensateUncertainWrite(true).recorded?.attempts, 0);
  assert.equal(compensateUncertainWrite(false).recorded?.attempts, 1);
  assert.equal(compensateUncertainWrite(false).deleted, false);
});

test("3. neither a storage nor a database question charges the ceiling", () => {
  for (const conclusion of ["ownership_failed", "presence_failed", "unfinalized", "unrecorded", "removed"] as CateringCleanupConclusion[]) {
    assert.equal(cateringCleanupChargesAttempt(conclusion), false, conclusion);
  }
  assert.equal(cateringCleanupChargesAttempt("storage_failed"), true);
});

// ---------------------------------------------------------------------------------------------------------------
// The reconciliation pass.
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
function writeRow(createdAt: number, overrides: Partial<OrphanRow> = {}): OrphanRow {
  return {
    id: "orphan-1", reason: CATERING_UNCERTAIN_WRITE_REASON, storageKey: "catering-bookings/b1/file-1", fileId: "file-1",
    createdAt, resolvedAt: null, cleanupAttempts: cateringOrphanInitialAttempts("uncertain_write"), cleanupError: null,
    cleanupClaimToken: null, cleanupClaimedUntil: null, cleanupDeleteAttemptedAt: null, ...overrides,
  };
}
/** Storage whose key may APPEAR later, and whose HEAD may refuse to answer. */
function bucket() {
  const present = new Set<string>();
  let headFails = false;
  let deleteFails: string | null = null;
  let deletes = 0;
  let heads = 0;
  return {
    get deletes() { return deletes; },
    get heads() { return heads; },
    holds: (key: string) => present.has(key),
    /** The delayed PUT finally lands. */
    materialize(key: string) { present.add(key); },
    breakHead() { headFails = true; },
    repairHead() { headFails = false; },
    breakDelete(message: string) { deleteFails = message; },
    repairDelete() { deleteFails = null; },
    presence(key: string): PrivateObjectPresence {
      heads += 1;
      if (headFails) return "unknown";
      return present.has(key) ? "present" : "absent";
    },
    remove(key: string) {
      deletes += 1;
      if (deleteFails !== null) throw new Error(deleteFails);
      present.delete(key);
    },
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
const claimable = (row: OrphanRow, now: number) =>
  row.resolvedAt === null
  && row.cleanupAttempts < CATERING_CLEANUP_MAX_ATTEMPTS
  && (row.cleanupClaimedUntil === null || row.cleanupClaimedUntil <= now)
  && cateringReconciliationIsRipe({ reason: row.reason, createdAt: new Date(row.createdAt) }, new Date(now));

let tokens = 0;
/** One orphan reconciliation pass: claim, ownership, storage presence for an uncertain write, delete, finalize. */
function reconcile(rows: OrphanRow[], storage: ReturnType<typeof bucket>, now: number, owned = false) {
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
    if (owned) { row.resolvedAt = new Date(now); row.cleanupClaimToken = null; retained += 1; continue; }
    if (row.reason === CATERING_UNCERTAIN_WRITE_REASON) {
      const presence = storage.presence(row.storageKey);
      if (presence === "unknown") { settle(row, "presence_failed", new Error("storage presence could not be established"), token); failed += 1; continue; }
    }
    row.cleanupDeleteAttemptedAt = now;
    try { storage.remove(row.storageKey); } catch (error) { settle(row, "storage_failed", error, token); failed += 1; continue; }
    row.resolvedAt = new Date(now);
    row.cleanupError = null;
    row.cleanupClaimToken = null;
    row.cleanupClaimedUntil = null;
    row.cleanupDeleteAttemptedAt = null;
    removed += 1;
  }
  return { scanned: claimed.length, removed, failed, retained };
}

test("4. the delayed object that appears after the successful DELETE is found and removed", () => {
  const now = 1_000_000_000_000;
  const row = writeRow(now);
  const storage = bucket();
  // The compensating delete already ran and succeeded; a second later the PUT finally lands.
  storage.materialize(row.storageKey);
  // Nothing happens during the window -- the row is not even claimed.
  assert.equal(reconcile([row], storage, now + SECOND, storage.holds(row.storageKey) && false).scanned, 0);
  assert.equal(storage.heads, 0);
  const pass = reconcile([row], storage, now + GRACE);
  assert.equal(pass.removed, 1);
  assert.equal(storage.holds(row.storageKey), false, "the stray object is collected rather than leaked forever");
  assert.notEqual(row.resolvedAt, null);
});

test("5. an object that never appears retires only after the window, and not before", () => {
  const now = 1_000_000_000_000;
  const row = writeRow(now);
  const storage = bucket();
  for (const at of [now, now + SECOND, now + GRACE / 2, now + GRACE - SECOND]) {
    assert.equal(reconcile([row], storage, at).scanned, 0, `claimed at +${(at - now) / SECOND}s`);
  }
  assert.equal(row.resolvedAt, null, "absent inside the window settles nothing");
  assert.equal(row.cleanupAttempts, 0, "and waiting is not a storage attempt");
  const pass = reconcile([row], storage, now + GRACE);
  assert.equal(pass.removed, 1);
  assert.notEqual(row.resolvedAt, null);
});

test("6 & 7. a storage presence check that fails keeps the row pending and charges nothing", () => {
  const now = 1_000_000_000_000;
  const row = writeRow(now);
  const storage = bucket();
  storage.breakHead();
  let at = now + GRACE;
  for (let pass = 0; pass < 12; pass += 1) { reconcile([row], storage, at); at += CATERING_CLEANUP_LEASE_SECONDS * SECOND * 2; }
  assert.equal(storage.deletes, 0, "nothing may be deleted while storage will not say whether it is there");
  assert.equal(row.cleanupAttempts, 0, "a storage question the pass could not answer is not a delete attempt");
  assert.equal(row.resolvedAt, null);
  // And once storage answers again the row is still fully workable rather than exhausted.
  storage.repairHead();
  storage.materialize(row.storageKey);
  assert.equal(reconcile([row], storage, at).removed, 1);
  assert.equal(storage.holds(row.storageKey), false);
});

test("8. an object that appears after several absent checks is still cleaned", () => {
  const now = 1_000_000_000_000;
  const row = writeRow(now);
  const storage = bucket();
  // Absent, absent... but nothing resolves it while the window still runs.
  reconcile([row], storage, now + GRACE / 3);
  reconcile([row], storage, now + GRACE / 2);
  assert.equal(row.resolvedAt, null);
  storage.materialize(row.storageKey);
  assert.equal(reconcile([row], storage, now + GRACE).removed, 1);
  assert.equal(storage.holds(row.storageKey), false);
});

test("9. repeated delete failures on an object that did appear keep the exact ceiling", () => {
  const now = 1_000_000_000_000;
  const row = writeRow(now);
  const storage = bucket();
  storage.materialize(row.storageKey);
  storage.breakDelete("R2 unavailable");
  let at = now + GRACE;
  for (let pass = 0; pass < 20; pass += 1) { reconcile([row], storage, at); at += CATERING_CLEANUP_LEASE_SECONDS * SECOND * 2; }
  assert.equal(row.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS);
  assert.equal(storage.deletes, CATERING_CLEANUP_MAX_ATTEMPTS, "exactly ten real delete calls, never eleven");
  // Exhausted stays exhausted: it is not claimed again even once storage recovers.
  storage.repairDelete();
  assert.equal(reconcile([row], storage, at).scanned, 0);
});

test("10. a row whose compensating delete failed starts at one and still waits out the window", () => {
  const now = 1_000_000_000_000;
  const row = writeRow(now, { cleanupAttempts: cateringOrphanInitialAttempts("failed_delete") });
  const storage = bucket();
  storage.materialize(row.storageKey);
  assert.equal(row.cleanupAttempts, 1, "one real delete was attempted and it failed");
  assert.equal(reconcile([row], storage, now + SECOND).scanned, 0, "it is still an uncertain write, so it still waits");
  assert.equal(reconcile([row], storage, now + GRACE).removed, 1);
  assert.equal(row.cleanupAttempts, 1, "the successful delete charged nothing more");
});

test("11. a committed file row still owns its bytes and this path never touches them", () => {
  const now = 1_000_000_000_000;
  const row = writeRow(now);
  const storage = bucket();
  storage.materialize(row.storageKey);
  const pass = reconcile([row], storage, now + GRACE, true);
  assert.equal(pass.retained, 1);
  assert.equal(storage.deletes, 0);
  assert.equal(storage.heads, 0, "ownership is asked first, and an owned object is not even probed");
  assert.equal(storage.holds(row.storageKey), true);
});

test("12. two records for the same upload keep their own budgets and their own windows", () => {
  const now = 1_000_000_000_000;
  const first = writeRow(now, { id: "first" });
  const second = writeRow(now + GRACE, { id: "second", cleanupAttempts: cateringOrphanInitialAttempts("failed_delete") });
  const storage = bucket();
  storage.materialize(first.storageKey);
  storage.breakDelete("R2 unavailable");
  reconcile([first, second], storage, now + GRACE);
  assert.equal(first.cleanupAttempts, 1, "the older row is ripe and spends its own attempt");
  assert.equal(second.cleanupAttempts, 1, "a second record neither inherits nor resets the other's budget");
  assert.equal(claimable(second, now + GRACE), false, "and it waits out its OWN age");
  assert.equal(claimable(second, now + GRACE + GRACE), true);
});

test("13. the window and the ledger are persisted, so a restart resumes exactly where it was", () => {
  const now = new Date(1_700_000_000_000);
  const row = { reason: CATERING_UNCERTAIN_WRITE_REASON, createdAt: new Date(now.getTime() - GRACE) };
  assert.equal(cateringReconciliationIsRipe(row, now), true);
  assert.equal(cateringReconciliationIsRipe({ ...row, createdAt: new Date(now.getTime() - GRACE + 1) }, now), false);
  // Both deferred reasons wait; nothing else does.
  assert.equal(cateringReconciliationIsRipe({ reason: CATERING_UNCERTAIN_COMMIT_REASON, createdAt: now }, now), false);
  assert.equal(cateringReconciliationIsRipe({ reason: "orphaned_upload", createdAt: now }, now), true);
  // The rule is SQL against the database clock and the row's own persisted `created_at`: no process state at all.
  const claim = service.slice(service.indexOf("async function claimOrphans"), service.indexOf("async function objectHasOwner"));
  assert.equal(claim.includes("reconciliationIsRipe()"), true);
  assert.equal(service.includes("notInArray(cateringBookingStorageOrphans.reason, CATERING_DEFERRED_REASONS)"), true);
  assert.equal(service.includes("lte(cateringBookingStorageOrphans.createdAt, sql`now() - (${CATERING_UNCERTAINTY_GRACE_SECONDS} * interval '1 second')`)"), true);
});

test("14. the route records the key on both compensation outcomes, and never deletes conclusively", () => {
  const compensation = route.slice(route.indexOf("async function compensateUncertainWrite"), route.indexOf("async function compensateStoredObject"));
  assert.equal(compensation.includes("await removePrivateObject(stored.provider, stored.storageKey);"), true, "the delete is still attempted immediately");
  assert.equal(compensation.includes(`return recordStorageOrphan(stored, deleteError instanceof Error ? deleteError.message : String(deleteError), "failed_delete");`), true);
  assert.equal(compensation.includes(`await recordStorageOrphan(stored, "storage write outcome indeterminate: a delayed object may still appear", "uncertain_write");`), true);
  // There is no path out of it that records nothing.
  assert.equal((compensation.match(/recordStorageOrphan\(/g) ?? []).length, 2);
  // And the write-failure branch routes here rather than to the conclusive compensation.
  const writeCatch = route.slice(route.indexOf("} catch (writeError) {"), route.indexOf("const result = await db.transaction"));
  assert.equal(writeCatch.includes("stored.reason = CATERING_UNCERTAIN_WRITE_REASON;"), true);
  assert.equal(writeCatch.includes("await compensateUncertainWrite(stored);"), true);
  assert.equal(writeCatch.includes("await compensateStoredObject(stored);"), false);
  assert.equal(writeCatch.includes("throw writeError;"), true);
});

test("15. the presence phase is a separate uncharged phase, before the delete boundary", () => {
  const orphans = service.slice(service.indexOf("export async function reconcileCateringStorageOrphans"));
  assert.equal(orphans.includes("if (candidate.reason === CATERING_UNCERTAIN_WRITE_REASON) {"), true);
  assert.equal(orphans.includes("privateObjectPresence(candidate.storageProvider as PrivateStorageProvider, candidate.storageKey)"), true);
  assert.equal(orphans.includes(`await settle(candidate, "presence_failed", new Error("storage presence could not be established"));`), true);
  // It sits after ownership and before the delete-attempt marker, so an unanswered probe charges nothing.
  assert.equal(orphans.indexOf("objectHasOwner(candidate)") < orphans.indexOf("privateObjectPresence("), true);
  assert.equal(orphans.indexOf("privateObjectPresence(") < orphans.indexOf("enterDeleteAttempt("), true);
  assert.equal(cateringCleanupChargesAttempt("presence_failed"), false);
  // The claim carries the reason, so the phase can tell which rows need it.
  assert.equal(service.includes("reason: string }"), true);
  assert.equal(service.includes("reason: cateringBookingStorageOrphans.reason"), true);
});

test("16. the presence reading is three-state and discloses nothing about the key", () => {
  // `statPrivateObject` collapses every failure into null, which is right for a size and wrong for this decision.
  assert.equal(storageLib.includes("export async function privateObjectPresence(provider: PrivateStorageProvider, storageKey: string): Promise<PrivateObjectPresence>"), true);
  assert.equal(storageLib.includes(`return (error as NodeJS.ErrnoException).code === "ENOENT" ? "absent" : "unknown";`), true);
  assert.equal(storageLib.includes("const target = resolvePrivatePath(storageKey);"), true, "an unsafe key is refused, not reported absent");
  // R2 tells a genuine not-found from a service that would not answer.
  assert.equal(r2.includes("export async function probePrivateObject(key: string): Promise<PrivateObjectPresence>"), true);
  assert.equal(r2.includes(`return objectIsMissing(error) ? "absent" : "unknown";`), true);
  assert.equal(r2.includes(`shaped.$metadata?.httpStatusCode === 404`), true);
  // Nothing here builds a URL or logs a key: the probe answers a state and nothing else.
  const probe = r2.slice(r2.indexOf("export async function probePrivateObject"), r2.indexOf("export async function deletePrivateObject"));
  assert.equal(probe.includes("publicUrl"), false);
  assert.equal(probe.includes("console."), false);
});
