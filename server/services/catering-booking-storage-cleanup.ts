import { and, asc, eq, inArray, isNull, isNotNull, lt, sql } from "drizzle-orm";
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
 * Claiming, and why it is a transaction rather than a plain select.
 *
 * The scheduled job runs on every app replica. Two replicas selecting the same pending row both attempted it and
 * both incremented `cleanup_attempts`, so one scheduled opportunity consumed as many attempts as there were
 * replicas -- and a row could exhaust its ceiling of ten without ever having had ten independent chances.
 *
 * A claim fixes that by making the selection exclusive and the attempt accounting part of the same atomic step:
 *
 *  1. inside one short transaction, select the candidates `FOR UPDATE SKIP LOCKED`, so a row another worker is
 *     already claiming is skipped rather than waited for or duplicated;
 *  2. consume the attempt for exactly those rows, in the same transaction;
 *  3. COMMIT -- releasing every lock -- and only then talk to storage.
 *
 * The attempt counter is itself the claim token, which is what makes crash recovery automatic: a worker that dies
 * mid-delete has consumed one attempt and holds no lock, so the row is simply picked up by the next run with one
 * fewer attempt remaining. There is no claim column to go stale and no reaper to write. And because the lock is
 * released before any storage call, a slow R2 delete never holds a row lock -- which is the failure mode option A
 * would have introduced.
 *
 * The consequence is that `cleanup_attempts` now counts attempts MADE rather than attempts that failed. That is the
 * more truthful reading of the column and the one the ceiling was always meant to bound; a successful attempt also
 * sets `object_deleted_at`/`resolved_at`, so the row leaves the queue regardless.
 */
async function claimTombstones(limit: number): Promise<{ id: string; storageProvider: string; storageKey: string }[]> {
  return db.transaction(async (tx: typeof db) => {
    const rows: { id: string; storageProvider: string; storageKey: string }[] = await tx
      .select({ id: cateringBookingFiles.id, storageProvider: cateringBookingFiles.storageProvider, storageKey: cateringBookingFiles.storageKey })
      .from(cateringBookingFiles)
      .where(and(
        isNotNull(cateringBookingFiles.deletedAt),
        isNull(cateringBookingFiles.objectDeletedAt),
        lt(cateringBookingFiles.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS),
      ))
      .orderBy(asc(cateringBookingFiles.deletedAt), asc(cateringBookingFiles.id))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length === 0) return rows;
    // One attempt per claimed row, consumed while the claim is still held, so no other worker can consume it too.
    await tx.update(cateringBookingFiles)
      .set({ cleanupAttempts: sql`${cateringBookingFiles.cleanupAttempts} + 1` })
      .where(inArray(cateringBookingFiles.id, rows.map((row) => row.id)));
    return rows;
  });
}

async function claimOrphans(limit: number): Promise<{ id: string; storageProvider: string; storageKey: string; fileId: string | null }[]> {
  return db.transaction(async (tx: typeof db) => {
    const rows: { id: string; storageProvider: string; storageKey: string; fileId: string | null }[] = await tx
      .select({ id: cateringBookingStorageOrphans.id, storageProvider: cateringBookingStorageOrphans.storageProvider, storageKey: cateringBookingStorageOrphans.storageKey, fileId: cateringBookingStorageOrphans.fileId })
      .from(cateringBookingStorageOrphans)
      .where(and(
        isNull(cateringBookingStorageOrphans.resolvedAt),
        lt(cateringBookingStorageOrphans.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS),
      ))
      .orderBy(asc(cateringBookingStorageOrphans.createdAt), asc(cateringBookingStorageOrphans.id))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length === 0) return rows;
    await tx.update(cateringBookingStorageOrphans)
      .set({ cleanupAttempts: sql`${cateringBookingStorageOrphans.cleanupAttempts} + 1` })
      .where(inArray(cateringBookingStorageOrphans.id, rows.map((row) => row.id)));
    return rows;
  });
}

/**
 * Whether a committed `catering_booking_files` row owns this object.
 *
 * A `uncertain_commit` ledger row exists precisely because it was not known whether the metadata committed, so the
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
 * failure. The completion write is conditional on the row still being an un-cleaned tombstone, so it cannot
 * double-count or resurrect anything, and nothing on this path ever clears `deleted_at`: a file stays deleted to
 * every actor regardless of what storage does.
 */
export async function reconcileCateringFileTombstones(limit = CATERING_CLEANUP_BATCH_DEFAULT): Promise<CateringCleanupOutcome> {
  const candidates = await claimTombstones(boundCateringCleanupBatch(limit));
  let removed = 0; let failed = 0;
  for (const candidate of candidates) {
    try {
      await removePrivateObject(candidate.storageProvider as PrivateStorageProvider, candidate.storageKey);
      await db.update(cateringBookingFiles)
        .set({ objectDeletedAt: new Date(), cleanupError: null })
        .where(and(eq(cateringBookingFiles.id, candidate.id), isNotNull(cateringBookingFiles.deletedAt), isNull(cateringBookingFiles.objectDeletedAt)));
      removed += 1;
    } catch (error) {
      // The attempt was already consumed under the claim, so only the diagnosis is written here.
      await db.update(cateringBookingFiles)
        .set({ cleanupError: errorMessage(error) })
        .where(eq(cateringBookingFiles.id, candidate.id))
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
 * storage. Resolution is recorded; the row itself is never deleted.
 */
export async function reconcileCateringStorageOrphans(limit = CATERING_CLEANUP_BATCH_DEFAULT): Promise<CateringCleanupOutcome> {
  const candidates = await claimOrphans(boundCateringCleanupBatch(limit));
  let removed = 0; let failed = 0; let retained = 0;
  for (const candidate of candidates) {
    try {
      if (await objectHasOwner(candidate)) {
        // A committed file row owns these bytes. Nothing is deleted, and the entry stops being pending.
        await db.update(cateringBookingStorageOrphans)
          .set({ resolvedAt: new Date(), cleanupError: null })
          .where(and(eq(cateringBookingStorageOrphans.id, candidate.id), isNull(cateringBookingStorageOrphans.resolvedAt)));
        retained += 1;
        continue;
      }
      await removePrivateObject(candidate.storageProvider as PrivateStorageProvider, candidate.storageKey);
      await db.update(cateringBookingStorageOrphans)
        .set({ resolvedAt: new Date(), cleanupError: null })
        .where(and(eq(cateringBookingStorageOrphans.id, candidate.id), isNull(cateringBookingStorageOrphans.resolvedAt)));
      removed += 1;
    } catch (error) {
      // Includes a failed ownership lookup: an unanswerable question leaves the object alone and retries later.
      await db.update(cateringBookingStorageOrphans)
        .set({ cleanupError: errorMessage(error) })
        .where(eq(cateringBookingStorageOrphans.id, candidate.id))
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
