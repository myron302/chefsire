import { and, asc, eq, isNull, isNotNull, lt, sql } from "drizzle-orm";
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

export function boundCateringCleanupBatch(requested?: number): number {
  if (!Number.isFinite(requested)) return CATERING_CLEANUP_BATCH_DEFAULT;
  return Math.min(Math.max(Math.trunc(requested as number), 1), CATERING_CLEANUP_BATCH_MAXIMUM);
}

export type CateringCleanupOutcome = { scanned: number; removed: number; failed: number };
const EMPTY_OUTCOME: CateringCleanupOutcome = { scanned: 0, removed: 0, failed: 0 };
export function combineCateringCleanupOutcomes(...outcomes: CateringCleanupOutcome[]): CateringCleanupOutcome {
  return outcomes.reduce((total, outcome) => ({
    scanned: total.scanned + outcome.scanned,
    removed: total.removed + outcome.removed,
    failed: total.failed + outcome.failed,
  }), EMPTY_OUTCOME);
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

/**
 * Tombstoned files whose object is still present. Ordered oldest-first so a backlog drains in the order it formed,
 * and bounded by the attempt ceiling so a permanently failing key cannot starve the rest of the queue.
 */
async function pendingTombstones(limit: number) {
  return db.select({ id: cateringBookingFiles.id, storageProvider: cateringBookingFiles.storageProvider, storageKey: cateringBookingFiles.storageKey })
    .from(cateringBookingFiles)
    .where(and(
      isNotNull(cateringBookingFiles.deletedAt),
      isNull(cateringBookingFiles.objectDeletedAt),
      lt(cateringBookingFiles.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS),
    ))
    .orderBy(asc(cateringBookingFiles.deletedAt), asc(cateringBookingFiles.id))
    .limit(limit) as Promise<{ id: string; storageProvider: string; storageKey: string }[]>;
}

async function pendingOrphans(limit: number) {
  return db.select({ id: cateringBookingStorageOrphans.id, storageProvider: cateringBookingStorageOrphans.storageProvider, storageKey: cateringBookingStorageOrphans.storageKey })
    .from(cateringBookingStorageOrphans)
    .where(and(
      isNull(cateringBookingStorageOrphans.resolvedAt),
      lt(cateringBookingStorageOrphans.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS),
    ))
    .orderBy(asc(cateringBookingStorageOrphans.createdAt), asc(cateringBookingStorageOrphans.id))
    .limit(limit) as Promise<{ id: string; storageProvider: string; storageKey: string }[]>;
}

/**
 * Retries the object deletion for tombstoned booking files.
 *
 * `removePrivateObject` is idempotent -- a local unlink treats ENOENT as success and an R2 delete of a missing key
 * succeeds -- so an object a previous run already removed completes normally rather than being reported as a
 * failure, and two runs processing the same row concurrently simply both succeed. The completion write is
 * conditional on the row still being an un-cleaned tombstone, so a concurrent run cannot double-count or resurrect
 * anything, and nothing on this path ever clears `deleted_at`: a file stays deleted to every actor regardless of
 * what storage does.
 */
export async function reconcileCateringFileTombstones(limit = CATERING_CLEANUP_BATCH_DEFAULT): Promise<CateringCleanupOutcome> {
  const candidates = await pendingTombstones(boundCateringCleanupBatch(limit));
  let removed = 0; let failed = 0;
  for (const candidate of candidates) {
    try {
      await removePrivateObject(candidate.storageProvider as PrivateStorageProvider, candidate.storageKey);
      await db.update(cateringBookingFiles)
        .set({ objectDeletedAt: new Date(), cleanupError: null })
        .where(and(eq(cateringBookingFiles.id, candidate.id), isNotNull(cateringBookingFiles.deletedAt), isNull(cateringBookingFiles.objectDeletedAt)));
      removed += 1;
    } catch (error) {
      // The attempt counter is incremented in SQL so concurrent runs cannot lose each other's increments.
      await db.update(cateringBookingFiles)
        .set({ cleanupAttempts: sql`${cateringBookingFiles.cleanupAttempts} + 1`, cleanupError: errorMessage(error) })
        .where(eq(cateringBookingFiles.id, candidate.id))
        .catch(() => undefined);
      failed += 1;
    }
  }
  return { scanned: candidates.length, removed, failed };
}

/** The same retry for objects that never got a metadata row at all. Resolution is recorded, never deletion of the row. */
export async function reconcileCateringStorageOrphans(limit = CATERING_CLEANUP_BATCH_DEFAULT): Promise<CateringCleanupOutcome> {
  const candidates = await pendingOrphans(boundCateringCleanupBatch(limit));
  let removed = 0; let failed = 0;
  for (const candidate of candidates) {
    try {
      await removePrivateObject(candidate.storageProvider as PrivateStorageProvider, candidate.storageKey);
      await db.update(cateringBookingStorageOrphans)
        .set({ resolvedAt: new Date(), cleanupError: null })
        .where(and(eq(cateringBookingStorageOrphans.id, candidate.id), isNull(cateringBookingStorageOrphans.resolvedAt)));
      removed += 1;
    } catch (error) {
      await db.update(cateringBookingStorageOrphans)
        .set({ cleanupAttempts: sql`${cateringBookingStorageOrphans.cleanupAttempts} + 1`, cleanupError: errorMessage(error) })
        .where(eq(cateringBookingStorageOrphans.id, candidate.id))
        .catch(() => undefined);
      failed += 1;
    }
  }
  return { scanned: candidates.length, removed, failed };
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
