import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import { cateringBookingFiles, cateringBookingStorageOrphans } from "@shared/schema";
import { db } from "../db";
import { removePrivateObject, type PrivateStorageProvider } from "../lib/private-storage";

/**
 * Reconciliation for catering booking objects whose storage deletion did not complete.
 *
 * Two states produce them, and both already persist everything needed to finish the job:
 *
 *  - a tombstoned `catering_booking_files` row whose object delete failed, so `deleted_at` is set but
 *    `object_deleted_at` is not. The file is gone to every actor either way -- this only removes the bytes.
 *  - a `catering_booking_storage_orphans` row: an object that reached storage but whose metadata never persisted,
 *    and whose compensating delete also failed, so no file row owns it.
 *
 * Without this, those columns recorded an intent nothing ever acted on: the file is tombstoned, so the DELETE
 * endpoint cannot be called again for it, and the orphan row referenced bytes with no owner at all.
 *
 * Every key comes from a persisted row. Nothing here accepts a caller-supplied storage key, a provider, or a
 * booking, so this can never be steered into deleting an arbitrary object.
 */

/** Bounded work per run, so a large backlog drains steadily instead of monopolising a process. */
export const CATERING_CLEANUP_BATCH_DEFAULT = 25;
export const CATERING_CLEANUP_BATCH_MAXIMUM = 200;
/**
 * After this many failures a record stops being retried automatically. It is NOT abandoned -- the row keeps its key,
 * its attempt count and its last error -- but an object that has failed this often needs a human to look at it
 * rather than an unbounded retry loop hammering storage forever.
 */
export const CATERING_CLEANUP_MAX_ATTEMPTS = 10;
/**
 * How long a claim stays valid, in seconds.
 *
 * It has to comfortably exceed one cleanup execution -- a single object delete, local or R2, well under a second in
 * the ordinary case and tens of seconds at its worst -- so a working worker is never overtaken mid-delete. And it
 * has to be short relative to the hourly schedule, so a worker that dies mid-delete has its row back in the queue by
 * the next run rather than sitting untouchable. Five minutes sits comfortably between those.
 */
export const CATERING_CLEANUP_LEASE_SECONDS = 300;

export function boundCateringCleanupBatch(requested?: number): number {
  if (!Number.isFinite(requested)) return CATERING_CLEANUP_BATCH_DEFAULT;
  return Math.min(Math.max(Math.trunc(requested as number), 1), CATERING_CLEANUP_BATCH_MAXIMUM);
}

/**
 * `retained` counts objects this pass deliberately did NOT delete because a committed file row owns them. It is
 * reported separately from `removed` and `failed` because it is neither: nothing was deleted and nothing went
 * wrong.
 */
export type CateringCleanupOutcome = { scanned: number; removed: number; failed: number; retained: number };
const EMPTY_OUTCOME: CateringCleanupOutcome = { scanned: 0, removed: 0, failed: 0, retained: 0 };
export function combineCateringCleanupOutcomes(...outcomes: CateringCleanupOutcome[]): CateringCleanupOutcome {
  return outcomes.reduce((total, outcome) => ({
    scanned: total.scanned + outcome.scanned,
    removed: total.removed + outcome.removed,
    failed: total.failed + outcome.failed,
    retained: total.retained + outcome.retained,
  }), EMPTY_OUTCOME);
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

/**
 * Claiming, and why a transaction-local row lock is not enough.
 *
 * The scheduled job runs on every app replica. `FOR UPDATE SKIP LOCKED` makes the SELECT exclusive, but only for as
 * long as the transaction is open -- and that transaction has to COMMIT before storage I/O starts, because holding a
 * database transaction open across a slow R2 delete is its own production problem. The instant it commits the row
 * again satisfies the pending predicate, so a second replica claims it while the first is still deleting: both do
 * the work, both consume a retry, and during an outage a handful of replicas can burn the whole ceiling in one
 * scheduled run. The lock disappears exactly when it is needed most.
 *
 * So the authority after commit is a DURABLE lease rather than the lock:
 *
 *  1. inside one short transaction, select rows that are pending, under the attempt ceiling, and NOT currently
 *     leased, `FOR UPDATE SKIP LOCKED` so two workers racing the claim itself cannot pick the same row;
 *  2. stamp them with this worker's unpredictable claim token and an expiry `CATERING_CLEANUP_LEASE_SECONDS` ahead,
 *     using the DATABASE clock so every replica agrees on what "expired" means;
 *  3. COMMIT, releasing every lock, and only then talk to storage.
 *
 * The lease outlives the transaction, so a concurrent replica sees the row as claimed and skips it. Finalization is
 * conditioned on the token, so only the worker that holds the row can complete or fail it.
 *
 * ATTEMPT ACCOUNTING. An attempt is one claimed execution that actually reached a conclusion, so it is charged at
 * FINALIZATION, on the failure path, under a matching token -- exactly once per claim, and never by a replica that
 * did no work. An execution that never concludes is charged too, but later and by whoever picks the row up: taking
 * over a row whose lease EXPIRED while still holding a token means the previous execution was abandoned, so that
 * reclaim charges the abandoned attempt as it re-leases. A fresh, never-claimed row is charged nothing at claim
 * time. The result is that a crashing worker cannot retry forever and a healthy worker is never double-charged.
 *
 * THE CEILING IS EXACT. `cleanup_attempts <= CATERING_CLEANUP_MAX_ATTEMPTS` holds on every path. The eligibility
 * predicate admits only rows below the ceiling, but charging an abandoned execution can itself reach it -- a row at
 * 9 whose lease lapsed becomes 10 as it is reclaimed. Handing that row to a worker anyway would spend an eleventh
 * attempt on a storage delete the ceiling was meant to stop, so a reclaim that exhausts a row charges the abandoned
 * attempt, releases the stale lease and does NOT return it: the row stays pending-but-exhausted, visible to an
 * operator, with no further delete attempted. Every increment is additionally written as `LEAST(attempts + 1, max)`,
 * so the invariant holds even if some future path forgets it.
 */

/** A row that is unclaimed, or whose lease has lapsed. The comparison uses the database clock, never the app's. */
const leaseIsAvailable = (until: typeof cateringBookingFiles.cleanupClaimedUntil | typeof cateringBookingStorageOrphans.cleanupClaimedUntil) =>
  or(isNull(until), lte(until, sql`now()`));
/**
 * One attempt, charged in SQL and clamped at the ceiling. Every increment goes through this, so
 * `cleanup_attempts <= CATERING_CLEANUP_MAX_ATTEMPTS` is guaranteed by the write itself rather than by every caller
 * remembering to check -- and a row already at the ceiling still records its error instead of having the whole
 * write refused.
 */
const chargeAttempt = (column: typeof cateringBookingFiles.cleanupAttempts | typeof cateringBookingStorageOrphans.cleanupAttempts) =>
  sql`LEAST(${column} + 1, ${CATERING_CLEANUP_MAX_ATTEMPTS})`;

/** The expiry stamped on a fresh claim, likewise from the database clock. */
const leaseExpiry = sql`now() + (${CATERING_CLEANUP_LEASE_SECONDS} * interval '1 second')`;

export type CateringCleanupClaim = { id: string; storageProvider: string; storageKey: string; claimToken: string };
export type CateringOrphanClaim = CateringCleanupClaim & { fileId: string | null };

async function claimTombstones(limit: number): Promise<CateringCleanupClaim[]> {
  const claimToken = randomUUID();
  return db.transaction(async (tx: typeof db) => {
    const rows: { id: string; storageProvider: string; storageKey: string; previousToken: string | null; cleanupAttempts: number }[] = await tx
      .select({ id: cateringBookingFiles.id, storageProvider: cateringBookingFiles.storageProvider, storageKey: cateringBookingFiles.storageKey, previousToken: cateringBookingFiles.cleanupClaimToken, cleanupAttempts: cateringBookingFiles.cleanupAttempts })
      .from(cateringBookingFiles)
      .where(and(
        isNotNull(cateringBookingFiles.deletedAt),
        isNull(cateringBookingFiles.objectDeletedAt),
        lt(cateringBookingFiles.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS),
        leaseIsAvailable(cateringBookingFiles.cleanupClaimedUntil),
      ))
      .orderBy(asc(cateringBookingFiles.deletedAt), asc(cateringBookingFiles.id))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length === 0) return [];
    // A row still carrying a token whose lease lapsed is one whose previous execution never concluded, so that
    // abandoned attempt is charged now. If charging it reaches the ceiling the row is finished: the stale lease is
    // released and it is NOT handed to a worker, because attempting another delete would spend an attempt beyond
    // the maximum. It stays pending-but-exhausted for an operator to look at.
    const abandoned = rows.filter((row) => row.previousToken !== null);
    const exhausted = abandoned.filter((row) => row.cleanupAttempts + 1 >= CATERING_CLEANUP_MAX_ATTEMPTS).map((row) => row.id);
    if (exhausted.length > 0) {
      await tx.update(cateringBookingFiles)
        .set({ cleanupAttempts: chargeAttempt(cateringBookingFiles.cleanupAttempts), cleanupClaimToken: null, cleanupClaimedUntil: null })
        .where(inArray(cateringBookingFiles.id, exhausted));
    }
    const claimable = rows.filter((row) => !exhausted.includes(row.id));
    if (claimable.length === 0) return [];
    await tx.update(cateringBookingFiles)
      .set({ cleanupClaimToken: claimToken, cleanupClaimedUntil: leaseExpiry })
      .where(inArray(cateringBookingFiles.id, claimable.map((row) => row.id)));
    const charged = claimable.filter((row) => row.previousToken !== null).map((row) => row.id);
    if (charged.length > 0) {
      await tx.update(cateringBookingFiles)
        .set({ cleanupAttempts: chargeAttempt(cateringBookingFiles.cleanupAttempts) })
        .where(inArray(cateringBookingFiles.id, charged));
    }
    return claimable.map((row) => ({ id: row.id, storageProvider: row.storageProvider, storageKey: row.storageKey, claimToken }));
  });
}

async function claimOrphans(limit: number): Promise<CateringOrphanClaim[]> {
  const claimToken = randomUUID();
  return db.transaction(async (tx: typeof db) => {
    const rows: { id: string; storageProvider: string; storageKey: string; fileId: string | null; previousToken: string | null; cleanupAttempts: number }[] = await tx
      .select({ id: cateringBookingStorageOrphans.id, storageProvider: cateringBookingStorageOrphans.storageProvider, storageKey: cateringBookingStorageOrphans.storageKey, fileId: cateringBookingStorageOrphans.fileId, previousToken: cateringBookingStorageOrphans.cleanupClaimToken, cleanupAttempts: cateringBookingStorageOrphans.cleanupAttempts })
      .from(cateringBookingStorageOrphans)
      .where(and(
        isNull(cateringBookingStorageOrphans.resolvedAt),
        lt(cateringBookingStorageOrphans.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS),
        leaseIsAvailable(cateringBookingStorageOrphans.cleanupClaimedUntil),
      ))
      .orderBy(asc(cateringBookingStorageOrphans.createdAt), asc(cateringBookingStorageOrphans.id))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length === 0) return [];
    // A row still carrying a token whose lease lapsed is one whose previous execution never concluded, so that
    // abandoned attempt is charged now. If charging it reaches the ceiling the row is finished: the stale lease is
    // released and it is NOT handed to a worker, because attempting another delete would spend an attempt beyond
    // the maximum. It stays pending-but-exhausted for an operator to look at.
    const abandoned = rows.filter((row) => row.previousToken !== null);
    const exhausted = abandoned.filter((row) => row.cleanupAttempts + 1 >= CATERING_CLEANUP_MAX_ATTEMPTS).map((row) => row.id);
    if (exhausted.length > 0) {
      await tx.update(cateringBookingStorageOrphans)
        .set({ cleanupAttempts: chargeAttempt(cateringBookingStorageOrphans.cleanupAttempts), cleanupClaimToken: null, cleanupClaimedUntil: null })
        .where(inArray(cateringBookingStorageOrphans.id, exhausted));
    }
    const claimable = rows.filter((row) => !exhausted.includes(row.id));
    if (claimable.length === 0) return [];
    await tx.update(cateringBookingStorageOrphans)
      .set({ cleanupClaimToken: claimToken, cleanupClaimedUntil: leaseExpiry })
      .where(inArray(cateringBookingStorageOrphans.id, claimable.map((row) => row.id)));
    const charged = claimable.filter((row) => row.previousToken !== null).map((row) => row.id);
    if (charged.length > 0) {
      await tx.update(cateringBookingStorageOrphans)
        .set({ cleanupAttempts: chargeAttempt(cateringBookingStorageOrphans.cleanupAttempts) })
        .where(inArray(cateringBookingStorageOrphans.id, charged));
    }
    return claimable.map((row) => ({ id: row.id, storageProvider: row.storageProvider, storageKey: row.storageKey, fileId: row.fileId, claimToken }));
  });
}

/**
 * Whether a committed `catering_booking_files` row owns this object.
 *
 * An `uncertain_commit` ledger row exists precisely because it was not known whether the metadata committed, so the
 * bytes must not be deleted until that is settled. `storage_key` is UNIQUE on the files table, so it identifies at
 * most one row exactly; the file id is checked too when the ledger carries one. An owned object is left entirely
 * alone here -- if that file is later deleted it becomes a tombstone and the tombstone queue removes the bytes then.
 */
async function objectHasOwner(candidate: { storageProvider: string; storageKey: string; fileId: string | null }): Promise<boolean> {
  const [row] = await db.select({ id: cateringBookingFiles.id }).from(cateringBookingFiles)
    .where(and(
      eq(cateringBookingFiles.storageProvider, candidate.storageProvider),
      eq(cateringBookingFiles.storageKey, candidate.storageKey),
    ))
    .limit(1);
  if (!row) return false;
  return candidate.fileId === null || row.id === candidate.fileId;
}

/**
 * Retries the object deletion for tombstoned booking files.
 *
 * `removePrivateObject` is idempotent -- a local unlink treats ENOENT as success and an R2 delete of a missing key
 * succeeds -- so an object a previous run already removed completes normally rather than being reported as a
 * failure. Every write below is conditioned on the claim token as well as the row id, so a worker whose lease has
 * since been taken over by another finalizes nothing: it cannot mark success, cannot charge an attempt, and cannot
 * clear the newer claim. Nothing on this path ever clears `deleted_at`: a file stays deleted to every actor
 * regardless of what storage does.
 */
export async function reconcileCateringFileTombstones(limit = CATERING_CLEANUP_BATCH_DEFAULT): Promise<CateringCleanupOutcome> {
  const candidates = await claimTombstones(boundCateringCleanupBatch(limit));
  let removed = 0; let failed = 0;
  for (const candidate of candidates) {
    try {
      await removePrivateObject(candidate.storageProvider as PrivateStorageProvider, candidate.storageKey);
      await db.update(cateringBookingFiles)
        .set({ objectDeletedAt: new Date(), cleanupError: null, cleanupClaimToken: null, cleanupClaimedUntil: null })
        .where(and(
          eq(cateringBookingFiles.id, candidate.id),
          eq(cateringBookingFiles.cleanupClaimToken, candidate.claimToken),
          isNotNull(cateringBookingFiles.deletedAt),
          isNull(cateringBookingFiles.objectDeletedAt),
        ));
      removed += 1;
    } catch (error) {
      // One attempt for this claimed execution, charged once, and the lease released so a later run can retry.
      await db.update(cateringBookingFiles)
        .set({ cleanupAttempts: chargeAttempt(cateringBookingFiles.cleanupAttempts), cleanupError: errorMessage(error), cleanupClaimToken: null, cleanupClaimedUntil: null })
        .where(and(eq(cateringBookingFiles.id, candidate.id), eq(cateringBookingFiles.cleanupClaimToken, candidate.claimToken)))
        .catch(() => undefined);
      failed += 1;
    }
  }
  return { scanned: candidates.length, removed, failed, retained: 0 };
}

/**
 * The same retry for objects that have no metadata row -- or that may turn out to have one after all.
 *
 * An `uncertain_commit` entry is recorded when an upload's transaction rejected and the commit state could not be
 * verified. Deleting its object unconditionally here would reintroduce exactly the bug the ledger exists to avoid,
 * so ownership is checked first and an owned object is retained, its ledger entry resolved without touching
 * storage. Resolution is recorded; the row itself is never deleted. Every write is token-conditioned, exactly as
 * the tombstone queue's are.
 */
export async function reconcileCateringStorageOrphans(limit = CATERING_CLEANUP_BATCH_DEFAULT): Promise<CateringCleanupOutcome> {
  const candidates = await claimOrphans(boundCateringCleanupBatch(limit));
  let removed = 0; let failed = 0; let retained = 0;
  const resolve = (candidate: CateringOrphanClaim) => db.update(cateringBookingStorageOrphans)
    .set({ resolvedAt: new Date(), cleanupError: null, cleanupClaimToken: null, cleanupClaimedUntil: null })
    .where(and(
      eq(cateringBookingStorageOrphans.id, candidate.id),
      eq(cateringBookingStorageOrphans.cleanupClaimToken, candidate.claimToken),
      isNull(cateringBookingStorageOrphans.resolvedAt),
    ));
  for (const candidate of candidates) {
    try {
      if (await objectHasOwner(candidate)) {
        // A committed file row owns these bytes. Nothing is deleted, and the entry stops being pending.
        await resolve(candidate);
        retained += 1;
        continue;
      }
      await removePrivateObject(candidate.storageProvider as PrivateStorageProvider, candidate.storageKey);
      await resolve(candidate);
      removed += 1;
    } catch (error) {
      // Includes a failed ownership lookup: an unanswerable question leaves the object alone and retries later.
      await db.update(cateringBookingStorageOrphans)
        .set({ cleanupAttempts: chargeAttempt(cateringBookingStorageOrphans.cleanupAttempts), cleanupError: errorMessage(error), cleanupClaimToken: null, cleanupClaimedUntil: null })
        .where(and(eq(cateringBookingStorageOrphans.id, candidate.id), eq(cateringBookingStorageOrphans.cleanupClaimToken, candidate.claimToken)))
        .catch(() => undefined);
      failed += 1;
    }
  }
  return { scanned: candidates.length, removed, failed, retained };
}

/**
 * One reconciliation pass over both queues. Server-internal only: it is invoked by the scheduled job registered in
 * `server/cron.ts`, never by a route, and it takes no caller-supplied identity of any kind.
 */
export async function reconcileCateringStorageCleanup(limit = CATERING_CLEANUP_BATCH_DEFAULT): Promise<CateringCleanupOutcome> {
  const bounded = boundCateringCleanupBatch(limit);
  return combineCateringCleanupOutcomes(
    await reconcileCateringFileTombstones(bounded),
    await reconcileCateringStorageOrphans(bounded),
  );
}
