import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_CLEANUP_LEASE_SECONDS, CATERING_CLEANUP_MAX_ATTEMPTS, cateringCleanupChargesAttempt, settleCateringFinalization, type CateringCleanupConclusion } from "./catering-booking-storage-cleanup";

/**
 * Deleting a booking file has two halves, and only one of them is the user's operation.
 *
 * The authoritative half is the transaction that tombstones the row: after it commits the file is gone to every
 * actor, and the participant cannot repeat or undo the action. Removing the private object follows, and if THAT
 * fails the bytes are still there and the cleanup queue owes another attempt. Writing down that the object went --
 * `object_deleted_at`, clearing `cleanup_error`, resolving an orphan row -- is bookkeeping about work that has
 * already completed: once the bytes are gone, failing to record it changes nothing in the world.
 *
 * Conflating the last two costs correctness twice over. The retry ceiling exists to stop a broken STORAGE backend
 * from being hammered forever; spending it on database hiccups lets a row whose bytes are already deleted exhaust
 * its attempts and become a cleanup record no pass will ever finish. And a caller told "the delete failed" for a
 * delete that succeeded will retry something that cannot be retried.
 *
 * There is no database harness in this suite, so the row lifecycle is simulated over the very helpers the route and
 * the scheduler call, and both are additionally asserted structurally against their source.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-files.ts"), "utf8");
const service = fs.readFileSync(path.join(here, "catering-booking-storage-cleanup.ts"), "utf8");
const deleteRoute = route.slice(route.indexOf(`r.delete("/bookings/:id/files/:fileId"`));

type FileRow = {
  id: string;
  storageKey: string;
  deletedAt: Date | null;
  deletedBy: string | null;
  objectDeletedAt: Date | null;
  cleanupAttempts: number;
  cleanupError: string | null;
  cleanupClaimToken: string | null;
  cleanupClaimedUntil: number | null;
};
function tombstoned(overrides: Partial<FileRow> = {}): FileRow {
  return { id: "file-1", storageKey: "catering-bookings/b1/file-1", deletedAt: new Date("2026-09-01T10:00:00Z"), deletedBy: "user-1", objectDeletedAt: null, cleanupAttempts: 0, cleanupError: null, cleanupClaimToken: null, cleanupClaimedUntil: null, ...overrides };
}

/** Private storage, with `removePrivateObject`'s own semantics: deleting what is already gone is a success. */
function storageHolding(...keys: string[]) {
  const present = new Set(keys);
  let failWith: string | null = null;
  return {
    holds: (key: string) => present.has(key),
    breakWith(message: string) { failWith = message; },
    repair() { failWith = null; },
    remove(key: string) {
      if (failWith !== null) throw new Error(failWith);
      present.delete(key);
    },
  };
}

/** The one place an attempt may be charged, exactly as both call sites write it. */
function settle(row: FileRow, conclusion: CateringCleanupConclusion, error: unknown, token: string | null = null) {
  if (token !== null && row.cleanupClaimToken !== token) return;
  if (cateringCleanupChargesAttempt(conclusion)) row.cleanupAttempts = Math.min(row.cleanupAttempts + 1, CATERING_CLEANUP_MAX_ATTEMPTS);
  row.cleanupError = error instanceof Error ? error.message : String(error);
  if (token !== null) { row.cleanupClaimToken = null; row.cleanupClaimedUntil = null; }
}

/** The DELETE route from the moment its transaction has committed the tombstone. */
async function finishDelete(row: FileRow, storage: ReturnType<typeof storageHolding>, markerFails = false): Promise<{ status: number }> {
  const stored = await settleCateringFinalization(async () => storage.remove(row.storageKey));
  if (!stored.ok) {
    settle(row, "storage_failed", stored.error);
    return { status: 204 };
  }
  const finalized = await settleCateringFinalization(async () => {
    if (markerFails) throw new Error("database unavailable");
    row.objectDeletedAt = new Date("2026-09-01T10:00:01Z");
    row.cleanupError = null;
  });
  if (!finalized.ok) settle(row, "unfinalized", finalized.error);
  return { status: 204 };
}

/** The tombstone queue's eligibility predicate, transcribed from `claimTombstones`. */
const eligible = (row: FileRow, now: number) =>
  row.deletedAt !== null && row.objectDeletedAt === null && row.cleanupAttempts < CATERING_CLEANUP_MAX_ATTEMPTS && (row.cleanupClaimedUntil === null || row.cleanupClaimedUntil <= now);

let tokens = 0;
/** One reconciliation pass: claim under a durable lease, delete, then finalize. */
async function reconcile(rows: FileRow[], storage: ReturnType<typeof storageHolding>, now: number, markerFails = false) {
  const token = `claim-${(tokens += 1)}`;
  const claimed: FileRow[] = [];
  for (const row of rows.filter((candidate) => eligible(candidate, now))) {
    if (row.cleanupClaimToken !== null) {
      // A lease that lapsed while a token was still held is an execution that never concluded: charge it now, and
      // if that reaches the ceiling do not hand the row out again.
      row.cleanupAttempts = Math.min(row.cleanupAttempts + 1, CATERING_CLEANUP_MAX_ATTEMPTS);
      row.cleanupClaimToken = null;
      row.cleanupClaimedUntil = null;
      if (row.cleanupAttempts >= CATERING_CLEANUP_MAX_ATTEMPTS) continue;
    }
    row.cleanupClaimToken = token;
    row.cleanupClaimedUntil = now + CATERING_CLEANUP_LEASE_SECONDS * 1000;
    claimed.push(row);
  }
  let removed = 0; let failed = 0;
  for (const row of claimed) {
    const stored = await settleCateringFinalization(async () => storage.remove(row.storageKey));
    if (!stored.ok) { settle(row, "storage_failed", stored.error, token); failed += 1; continue; }
    const finalized = await settleCateringFinalization(async () => {
      if (markerFails) throw new Error("database unavailable");
      if (row.cleanupClaimToken !== token) return;
      row.objectDeletedAt = new Date(now);
      row.cleanupError = null;
      row.cleanupClaimToken = null;
      row.cleanupClaimedUntil = null;
    });
    if (finalized.ok) { removed += 1; continue; }
    settle(row, "unfinalized", finalized.error, token);
    failed += 1;
  }
  return { scanned: claimed.length, removed, failed };
}

const T0 = Date.parse("2026-09-01T12:00:00Z");
const LATER = (seconds: number) => T0 + seconds * 1000;

test("1. the ordinary delete: tombstone, then the object, then the marker", async () => {
  const row = tombstoned();
  const storage = storageHolding(row.storageKey);
  const response = await finishDelete(row, storage);
  assert.equal(response.status, 204);
  assert.equal(storage.holds(row.storageKey), false);
  assert.notEqual(row.objectDeletedAt, null);
  assert.equal(row.cleanupError, null);
  assert.equal(row.cleanupAttempts, 0);
  // Finished: the queue's predicate no longer selects it.
  assert.equal(eligible(row, T0), false);
});

test("2. a failed authoritative delete never reaches storage, and never looks like a completed removal", () => {
  // The transaction owns the tombstone. Every early return and the storage call itself sit AFTER it, so a
  // transaction that rejects leaves the outer catch to answer and no object is touched.
  const transactionEnds = deleteRoute.indexOf(`if (result.kind === "not_found")`);
  assert.equal(deleteRoute.indexOf("removePrivateObject(") > transactionEnds, true, "no object may be deleted before the tombstone commits");
  assert.equal(deleteRoute.indexOf("objectDeletedAt: new Date()") > transactionEnds, true);
  assert.equal(deleteRoute.slice(0, transactionEnds).includes("removePrivateObject"), false);
  // A rejected transaction is reported, not swallowed: the delete genuinely did not happen.
  assert.equal(deleteRoute.includes("} catch (error) { invalid(error, res, next); } });"), true);
  // And nothing outside the transaction can write the marker without the object delete having returned first.
  const afterStorage = deleteRoute.slice(deleteRoute.indexOf("const storage = await settleCateringFinalization("));
  assert.equal(afterStorage.indexOf("objectDeletedAt: new Date()") > afterStorage.indexOf(`recordCleanup("storage_failed"`), true);
});

test("3. a failed object delete keeps the tombstone, charges the storage attempt, and stays queued", async () => {
  const row = tombstoned();
  const storage = storageHolding(row.storageKey);
  storage.breakWith("R2 unavailable");
  const response = await finishDelete(row, storage);
  // The participant's delete still committed, so the established contract is unchanged: no error is invented here.
  assert.equal(response.status, 204);
  // Nothing is fabricated: the bytes are still there and the marker is still unset.
  assert.equal(storage.holds(row.storageKey), true);
  assert.equal(row.objectDeletedAt, null);
  // Visibility is never restored.
  assert.notEqual(row.deletedAt, null);
  assert.equal(row.deletedBy, "user-1");
  // This IS a storage attempt, so it is charged, and the row is queued for the scheduler.
  assert.equal(row.cleanupAttempts, 1);
  assert.equal(row.cleanupError, "R2 unavailable");
  assert.equal(eligible(row, T0), true);
});

test("4. a marker write that fails after a successful object delete is still a successful delete", async () => {
  const row = tombstoned();
  const storage = storageHolding(row.storageKey);
  const response = await finishDelete(row, storage, true);
  // The user's operation completed: the file is gone and its bytes are gone.
  assert.equal(response.status, 204);
  assert.equal(storage.holds(row.storageKey), false);
  assert.notEqual(row.deletedAt, null);
  // Only the bookkeeping is unfinished, and it is left in exactly the state the queue selects on.
  assert.equal(row.objectDeletedAt, null);
  assert.equal(row.cleanupError, "database unavailable");
  assert.equal(eligible(row, T0), true, "the row must remain scheduler-eligible");
  // A bookkeeping failure is not a storage attempt and must not spend one.
  assert.equal(row.cleanupAttempts, 0);
});

test("5. that case needs no retry from the participant, and a retry could not help", async () => {
  const row = tombstoned();
  const storage = storageHolding(row.storageKey);
  await finishDelete(row, storage, true);
  // A second DELETE finds the row already tombstoned. The route's transaction only tombstones rows where
  // `deleted_at IS NULL`, so the retry deletes nothing and answers 404 -- which is why reporting a failure for the
  // first call would have been misleading rather than merely noisy.
  assert.equal(deleteRoute.includes("isNull(cateringBookingFiles.deletedAt))).returning();"), true);
  assert.equal(deleteRoute.includes(`if (!tombstoned) return { kind: "not_found" } as const;`), true);
  // Nothing about correctness depends on that retry: the scheduler finishes the row on its own.
  const outcome = await reconcile([row], storage, LATER(3600));
  assert.deepEqual(outcome, { scanned: 1, removed: 1, failed: 0 });
  assert.notEqual(row.objectDeletedAt, null);
});

test("6. the scheduler finishes the unfinalized row even though its object is already gone", async () => {
  const row = tombstoned();
  const storage = storageHolding(row.storageKey);
  await finishDelete(row, storage, true);
  assert.equal(storage.holds(row.storageKey), false, "the bytes went with the original delete");
  // Deleting what is already absent is a success, so the pass concludes normally rather than failing forever.
  const outcome = await reconcile([row], storage, LATER(3600));
  assert.equal(outcome.removed, 1);
  assert.notEqual(row.objectDeletedAt, null);
  assert.equal(row.cleanupError, null);
  assert.equal(row.cleanupClaimToken, null);
  assert.equal(eligible(row, LATER(7200)), false, "a finished row leaves the queue");
});

test("7. finishing an already-absent object consumes no attempt", async () => {
  const row = tombstoned();
  const storage = storageHolding(row.storageKey);
  await finishDelete(row, storage, true);
  assert.equal(row.cleanupAttempts, 0);
  await reconcile([row], storage, LATER(3600));
  assert.equal(row.cleanupAttempts, 0, "an idempotent success is not a failed attempt");
  // The idempotency this rests on is the storage layer's own, in both providers.
  const storageSource = fs.readFileSync(path.join(here, "..", "lib", "private-storage.ts"), "utf8");
  assert.equal(storageSource.includes(`if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;`), true);
  assert.equal(service.includes("`removePrivateObject` is idempotent"), true);
});

test("8. a marker that never writes cannot exhaust the ceiling or strand the row", async () => {
  const row = tombstoned();
  const storage = storageHolding(row.storageKey);
  await finishDelete(row, storage, true);
  // Fifteen passes with the bookkeeping write failing every time: still queued, still uncharged, never stuck.
  for (let pass = 0; pass < 15; pass += 1) {
    const outcome = await reconcile([row], storage, LATER(3600 * (pass + 1)), true);
    assert.equal(outcome.scanned, 1, `pass ${pass} must still claim the row`);
    assert.equal(outcome.failed, 1);
  }
  assert.equal(row.cleanupAttempts, 0);
  assert.equal(row.cleanupAttempts <= CATERING_CLEANUP_MAX_ATTEMPTS, true);
  assert.equal(eligible(row, LATER(3600 * 16)), true, "the row must never become permanently stuck");
  // And the moment the database recovers, the very next pass finishes it.
  const finished = await reconcile([row], storage, LATER(3600 * 17), false);
  assert.equal(finished.removed, 1);
  assert.notEqual(row.objectDeletedAt, null);
});

test("9. the durable lease and its token are unchanged by any of this", async () => {
  const row = tombstoned();
  const storage = storageHolding(row.storageKey);
  await finishDelete(row, storage, true);
  // A claimed row is invisible to a concurrent worker until its lease lapses.
  await reconcile([row], storage, T0, true);
  assert.equal(row.cleanupClaimToken, null, "a concluded execution releases its lease");
  row.cleanupClaimToken = "someone-else";
  row.cleanupClaimedUntil = LATER(120);
  assert.equal(eligible(row, LATER(60)), false, "a live lease excludes the row");
  assert.equal(eligible(row, LATER(300)), true, "an expired lease returns it");
  // A settle carrying a stale token finalizes nothing at all.
  const before = { ...row };
  settle(row, "storage_failed", new Error("late"), "a-stale-token");
  assert.equal(row.cleanupAttempts, before.cleanupAttempts);
  assert.equal(row.cleanupClaimToken, "someone-else");
  // An execution abandoned mid-flight is charged by whoever reclaims it, exactly once.
  await reconcile([row], storage, LATER(300), true);
  assert.equal(row.cleanupAttempts, 1, "the abandoned execution is charged on reclaim");
  // Both queues still condition every finalization on the token.
  for (const table of ["cateringBookingFiles", "cateringBookingStorageOrphans"]) {
    assert.equal(service.includes(`eq(${table}.cleanupClaimToken, candidate.claimToken)`), true, table);
  }
  assert.equal(service.includes("cleanupClaimedUntil: leaseExpiry"), true);
});

test("10-12. nothing about privacy, ownership or terminal bookings moved", () => {
  // Visibility is decided before anything else, so a customer probing a provider-private id gets the same 404 a
  // missing file gets.
  const visibilityAt = deleteRoute.indexOf("if (!cateringFileVisibleTo(row, role))");
  const ownershipAt = deleteRoute.indexOf("if (row.uploadedBy !== userId)");
  assert.equal(visibilityAt > 0 && ownershipAt > visibilityAt, true, "visibility must be settled before ownership");
  assert.equal(deleteRoute.includes(`return { kind: "not_found" } as const;`), true);
  assert.equal(deleteRoute.includes(`return { kind: "forbidden" } as const;`), true);
  assert.equal(deleteRoute.includes(`res.status(403).json({ message: "Only the participant who uploaded a file may remove it" })`), true);
  // A cancelled or completed booking refuses the mutation before the transaction opens.
  const readOnlyAt = deleteRoute.indexOf("if (!mayMutateCateringFiles(booking.status as never))");
  assert.equal(readOnlyAt > 0 && readOnlyAt < deleteRoute.indexOf("await db.transaction("), true);
  assert.equal(deleteRoute.includes("res.status(409).json({ message: CATERING_FILE_READ_ONLY_MESSAGE, code: CATERING_WORKSPACE_READ_ONLY_CODE })"), true);
  // And the cleanup paths never touch any of it.
  const cleanup = deleteRoute.slice(deleteRoute.indexOf("const recordCleanup = ("), deleteRoute.indexOf("/**\n * The bounded active file count"));
  for (const forbidden of ["deletedAt: null", "deletedBy: null", "visibility", "uploadedBy"]) {
    assert.equal(cleanup.includes(forbidden), false, forbidden);
  }
});

test("13. the charge rule is stated once and both call sites ask it", () => {
  assert.equal(cateringCleanupChargesAttempt("storage_failed"), true);
  assert.equal(cateringCleanupChargesAttempt("unfinalized"), false);
  assert.equal(cateringCleanupChargesAttempt("removed"), false);
  // The route and both queues branch on it rather than each deciding for themselves.
  assert.equal((route.match(/cateringCleanupChargesAttempt\(conclusion\)/g) ?? []).length, 1);
  assert.equal((service.match(/cateringCleanupChargesAttempt\(conclusion\)/g) ?? []).length, 2);
  // `settleCateringFinalization` reports rather than throws, which is what keeps an enclosing catch from mistaking
  // a bookkeeping failure for a storage one.
  const thrown = new Error("nope");
  return Promise.all([
    settleCateringFinalization(async () => undefined).then((result) => assert.deepEqual(result, { ok: true })),
    settleCateringFinalization(async () => { throw thrown; }).then((result) => assert.deepEqual(result, { ok: false, error: thrown })),
  ]);
});
