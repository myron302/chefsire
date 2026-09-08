import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, isNotNull, lt, lte, notInArray, or, sql } from "drizzle-orm";
import { cateringBookingFiles, cateringBookingStorageOrphans } from "@shared/schema";
import { db } from "../db";
import { privateObjectPresence, removePrivateObject, type PrivateObjectPresence, type PrivateStorageProvider } from "../lib/private-storage";

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

/**
 * The two halves of one cleanup, and why they are not the same failure.
 *
 * Removing the object is the irreversible half: it either happened or it did not, and if it did not the bytes are
 * still there and another attempt is warranted. Recording that it happened -- `object_deleted_at`, clearing
 * `cleanup_error`, resolving an orphan row -- is bookkeeping ABOUT an operation that has already completed. Once the
 * object is gone, a failure to write that down changes nothing about the world: the bytes do not come back, the
 * file does not become visible again, and no further storage work is needed for this row beyond a delete that will
 * now find nothing.
 *
 * Conflating the two costs real correctness in two places. A caller learns "the delete failed" for a delete that
 * succeeded. And the retry ceiling -- which exists to stop a broken STORAGE backend from being hammered forever --
 * is spent on database failures, so a row whose bytes are already gone can exhaust its attempts and become a
 * permanently stuck cleanup record that no pass will ever finish.
 *
 * The orphan queue adds a third failure that is not a storage attempt either. Before it may delete anything it has
 * to establish that no committed file row owns the object, and that is a database SELECT. When the SELECT fails
 * nothing is deleted -- deliberately, because deleting an object whose ownership is unknown is precisely the bug
 * the uncertain-commit ledger exists to prevent -- so no storage attempt was made and none may be charged. Charging
 * it meant a transiently unavailable database could burn all ten attempts on a row `removePrivateObject` was never
 * called for, stranding the object permanently.
 *
 * A fourth failure is not a storage attempt either: the write that records the delete is ABOUT to be attempted can
 * itself fail. When it does, the delete is not attempted at all -- an unrecorded delete would be indistinguishable
 * from one that never happened, and every later decision about this row would be a guess.
 *
 * A fifth is the storage equivalent of the ownership lookup. An uncertain-WRITE row has to establish whether the
 * object exists at all before it may stop being tracked, and that is a HEAD. A HEAD that fails is storage declining
 * to answer, not `removePrivateObject` failing -- nothing was deleted and nothing was attempted -- so charging it
 * would let an unreachable backend burn all ten attempts on a key it was never asked to delete.
 *
 * So a conclusion is one of these, and only the storage failure charges the ceiling.
 */
export type CateringCleanupConclusion = "removed" | "storage_failed" | "ownership_failed" | "presence_failed" | "unfinalized" | "unrecorded";
export function cateringCleanupChargesAttempt(conclusion: CateringCleanupConclusion): boolean {
  return conclusion === "storage_failed";
}

/**
 * Whether reclaiming a row whose lease lapsed charges the abandoned attempt.
 *
 * An expired token says an execution did not conclude. It does NOT say what that execution did. Treating the token
 * alone as evidence of a storage attempt charged the budget for outages: an ownership lookup fails while the
 * database is down, the release that would have recorded "nothing was attempted" fails for the same reason, the
 * lease lapses, and the reclaim charges an attempt for a delete nobody ever called. Repeat that ten times and the
 * object is stranded without storage having been asked once.
 *
 * `cleanup_delete_attempted_at` is the evidence instead. It is cleared on every fresh claim and stamped, durably
 * and under the claim's own token, immediately before `removePrivateObject` is entered. So the reclaim knows which
 * side of that boundary the abandoned execution died on: before it, nothing was attempted and nothing is charged;
 * at or after it, the delete may well have happened, and charging it once is the conservative reading.
 */
export type CateringReclaimEvidence = { hadToken: boolean; deleteAttempted: boolean };
export function cateringReclaimChargesAttempt(evidence: CateringReclaimEvidence): boolean {
  return evidence.hadToken && evidence.deleteAttempted;
}

/**
 * Records that this claim is entering the storage delete, and answers whether it may.
 *
 * `entered`: the row is still this worker's and the evidence is persisted. `lost`: the claim has been taken over,
 * so this worker deletes nothing -- the newer holder owns the row. `unrecorded`: the write failed, so the attempt
 * cannot be accounted for and is therefore not made; the row is left for a later pass, uncharged.
 */
export type CateringDeleteEntry = "entered" | "lost" | "unrecorded";
async function enterDeleteAttempt(mark: () => Promise<{ id: string }[]>): Promise<CateringDeleteEntry> {
  try {
    const marked = await mark();
    return marked.length > 0 ? "entered" : "lost";
  } catch {
    return "unrecorded";
  }
}

/**
 * The storage delete attempts already spent when an orphan is first recorded.
 *
 * The counter exists to bound how often a broken storage backend is retried, so it has to count actual deletes.
 * The two ways an orphan comes into existence have spent different numbers of them:
 *
 *  - `failed_delete`: the compensating delete was attempted and it failed. That is one real attempt, and recording
 *    it as one is what stops a permanently failing object from being retried an eleventh time.
 *  - `uncertain_commit`: the upload's transaction rejected and its commit state could not be verified, so nothing
 *    was deleted at all -- deliberately, because the bytes may belong to a row that committed after all. Letting
 *    the column default apply here charged an attempt for a database question, spending one of the ten before
 *    storage had ever been asked anything.
 *  - `uncertain_write`: the storage PUT's outcome was indeterminate and the compensating delete SUCCEEDED. A
 *    delete that succeeded has never charged an attempt anywhere in this module -- only a failed one does -- so
 *    this starts at zero too. The record exists not because that delete failed but because it may have run before
 *    the write it was compensating for. A compensating delete that FAILED is `failed_delete` as it always was.
 */
export type CateringOrphanOrigin = "uncertain_commit" | "uncertain_write" | "failed_delete";
export function cateringOrphanInitialAttempts(origin: CateringOrphanOrigin): number {
  return origin === "failed_delete" ? 1 : 0;
}

/**
 * The two `reason` values that mark a row as deferred. Written by the upload compensation and read by the claim
 * below, from these constants, so the two halves cannot drift into disagreeing about which rows wait.
 *
 * They are the same shape of problem at the two ends of an upload. `uncertain_commit`: the metadata transaction
 * rejected and may yet become visible. `uncertain_write`: the storage PUT rejected and the object may yet
 * materialize. In both, something that is not there NOW may be there shortly, and acting on the immediate reading
 * is what loses data -- a live file whose bytes were deleted, or bytes nothing tracks any more.
 */
export const CATERING_UNCERTAIN_COMMIT_REASON = "uncertain_commit";
export const CATERING_UNCERTAIN_WRITE_REASON = "uncertain_write";
const CATERING_DEFERRED_REASONS = [CATERING_UNCERTAIN_COMMIT_REASON, CATERING_UNCERTAIN_WRITE_REASON];
/**
 * How long a deferred object is left alone before reconciliation may retire it, in seconds.
 *
 * A transaction can reject to the application because the connection dropped while PostgreSQL was still processing
 * COMMIT; the server finishes that COMMIT regardless and the row becomes visible to a NEW snapshot moments later.
 * An R2 PUT can time out at the client while the service is still committing the write; the object then appears
 * afterwards, and a compensating DELETE issued in between succeeds precisely because the key is not there yet.
 * Neither immediate reading is proof of anything, and acting on one is unrecoverable in both directions: a live
 * file whose bytes were destroyed, or an untracked private object nothing will ever collect.
 *
 * Retaining an object that turns out to be unowned is recoverable, which is why the window is generous rather than
 * tight. It is measured from the row's own `created_at` against the DATABASE clock, so it survives a worker
 * restart, is shared by every replica, and needs no process-local state.
 */
export const CATERING_UNCERTAINTY_GRACE_SECONDS = 900;

/**
 * Whether the error that aborted an upload's transaction proves the commit did not happen.
 *
 * PostgreSQL answers a statement it processed with a SQLSTATE. If the server reported a unique violation, a check
 * violation, a serialization failure or a deadlock, it processed that statement and aborted the transaction: the
 * outcome is DECIDED, no commit is in flight, and a fresh read that finds no row is authoritative.
 *
 * A failure with no SQLSTATE is a different animal entirely -- a socket reset, a timeout, a driver-level fault --
 * and it says nothing about what the server did with the transaction. Neither does a connection exception (class
 * 08) or an operator intervention (57P01-57P03), which are precisely the codes raised when the link dies around a
 * COMMIT. Those are INDETERMINATE, and an object whose commit is indeterminate is never deleted on one reading.
 *
 * The default is indeterminate: an unrecognised failure is treated as the dangerous case, not the convenient one.
 */
const CATERING_INDETERMINATE_COMMIT_CODES = ["57P01", "57P02", "57P03"];
const CATERING_INDETERMINATE_COMMIT_CLASSES = ["08"];
export function cateringCommitIsDecided(error: unknown): boolean {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  if (typeof code !== "string" || !/^[0-9A-Z]{5}$/.test(code)) return false;
  if (CATERING_INDETERMINATE_COMMIT_CODES.includes(code)) return false;
  return !CATERING_INDETERMINATE_COMMIT_CLASSES.includes(code.slice(0, 2));
}

/**
 * Whether an orphan row has waited out its reconciliation window and may be handed to a worker.
 *
 * Only the two deferred reasons wait: every other orphan was recorded after both outcomes were already known, so
 * there is nothing left to become visible. Waiting costs no storage attempt at all -- an unripe row is simply not
 * claimed -- which is what keeps the ten from being spent on the passage of time.
 *
 * This is the rule the claim query enforces in SQL against the database clock; it is stated here too so it can be
 * reasoned about and tested directly.
 */
export function cateringReconciliationIsRipe(row: { reason: string; createdAt: Date }, now: Date): boolean {
  if (!CATERING_DEFERRED_REASONS.includes(row.reason)) return true;
  return now.getTime() - row.createdAt.getTime() >= CATERING_UNCERTAINTY_GRACE_SECONDS * 1000;
}
/**
 * The same rule as a claim predicate, read from the database clock so it is independent of any process, of any
 * worker's uptime, and of clock skew between them.
 */
const reconciliationIsRipe = () => or(
  notInArray(cateringBookingStorageOrphans.reason, CATERING_DEFERRED_REASONS),
  lte(cateringBookingStorageOrphans.createdAt, sql`now() - (${CATERING_UNCERTAINTY_GRACE_SECONDS} * interval '1 second')`),
);

/**
 * Runs the bookkeeping half and reports rather than throws.
 *
 * The caller has, by construction, already completed the irreversible half when this is reached, so there is
 * nothing left for an exception to abort: the only decision remaining is how to record the outcome. Returning the
 * error instead of propagating it is what keeps a finalization failure from being mistaken for a storage one by
 * some enclosing `catch` that cannot tell them apart.
 */
export type CateringFinalization = { ok: true } | { ok: false; error: unknown };
export async function settleCateringFinalization(finalize: () => Promise<unknown>): Promise<CateringFinalization> {
  try {
    await finalize();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/** The expiry stamped on a fresh claim, likewise from the database clock. */
const leaseExpiry = sql`now() + (${CATERING_CLEANUP_LEASE_SECONDS} * interval '1 second')`;

export type CateringCleanupClaim = { id: string; storageProvider: string; storageKey: string; claimToken: string };
export type CateringOrphanClaim = CateringCleanupClaim & { fileId: string | null; reason: string };

async function claimTombstones(limit: number): Promise<CateringCleanupClaim[]> {
  const claimToken = randomUUID();
  return db.transaction(async (tx: typeof db) => {
    const rows: { id: string; storageProvider: string; storageKey: string; previousToken: string | null; deleteAttemptedAt: Date | null; cleanupAttempts: number }[] = await tx
      .select({ id: cateringBookingFiles.id, storageProvider: cateringBookingFiles.storageProvider, storageKey: cateringBookingFiles.storageKey, previousToken: cateringBookingFiles.cleanupClaimToken, deleteAttemptedAt: cateringBookingFiles.cleanupDeleteAttemptedAt, cleanupAttempts: cateringBookingFiles.cleanupAttempts })
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
    // Only an execution that reached the storage delete is charged for having abandoned one. A lease that lapsed
    // before that boundary did no storage work, so it is released and re-handed out uncharged.
    const abandoned = rows.filter((row) => cateringReclaimChargesAttempt({ hadToken: row.previousToken !== null, deleteAttempted: row.deleteAttemptedAt !== null }));
    const exhausted = abandoned.filter((row) => row.cleanupAttempts + 1 >= CATERING_CLEANUP_MAX_ATTEMPTS).map((row) => row.id);
    if (exhausted.length > 0) {
      await tx.update(cateringBookingFiles)
        .set({ cleanupAttempts: chargeAttempt(cateringBookingFiles.cleanupAttempts), cleanupClaimToken: null, cleanupClaimedUntil: null, cleanupDeleteAttemptedAt: null })
        .where(inArray(cateringBookingFiles.id, exhausted));
    }
    const claimable = rows.filter((row) => !exhausted.includes(row.id));
    if (claimable.length === 0) return [];
    // Every fresh claim starts with no delete attempted, so the marker always describes THIS claim and never a
    // previous one.
    await tx.update(cateringBookingFiles)
      .set({ cleanupClaimToken: claimToken, cleanupClaimedUntil: leaseExpiry, cleanupDeleteAttemptedAt: null })
      .where(inArray(cateringBookingFiles.id, claimable.map((row) => row.id)));
    const charged = claimable.filter((row) => abandoned.some((item) => item.id === row.id)).map((row) => row.id);
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
    const rows: { id: string; storageProvider: string; storageKey: string; fileId: string | null; reason: string; previousToken: string | null; deleteAttemptedAt: Date | null; cleanupAttempts: number }[] = await tx
      .select({ id: cateringBookingStorageOrphans.id, storageProvider: cateringBookingStorageOrphans.storageProvider, storageKey: cateringBookingStorageOrphans.storageKey, fileId: cateringBookingStorageOrphans.fileId, reason: cateringBookingStorageOrphans.reason, previousToken: cateringBookingStorageOrphans.cleanupClaimToken, deleteAttemptedAt: cateringBookingStorageOrphans.cleanupDeleteAttemptedAt, cleanupAttempts: cateringBookingStorageOrphans.cleanupAttempts })
      .from(cateringBookingStorageOrphans)
      .where(and(
        isNull(cateringBookingStorageOrphans.resolvedAt),
        lt(cateringBookingStorageOrphans.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS),
        leaseIsAvailable(cateringBookingStorageOrphans.cleanupClaimedUntil),
        // An uncertain-commit row is not even LOOKED at until its reconciliation window has passed. Filtering here
        // rather than after the claim is what makes waiting free: an unripe row is never claimed, so it cannot be
        // charged an attempt, cannot have a lease to abandon, and cannot reach the storage delete at all. When
        // it finally is claimed, the checks below are a second authoritative reading of the same question the
        // compensation asked at the moment of failure -- and by then any commit or any write that was in flight
        // has long since become visible.
        reconciliationIsRipe(),
      ))
      .orderBy(asc(cateringBookingStorageOrphans.createdAt), asc(cateringBookingStorageOrphans.id))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length === 0) return [];
    // A row still carrying a token whose lease lapsed is one whose previous execution never concluded, so that
    // abandoned attempt is charged now. If charging it reaches the ceiling the row is finished: the stale lease is
    // released and it is NOT handed to a worker, because attempting another delete would spend an attempt beyond
    // the maximum. It stays pending-but-exhausted for an operator to look at.
    // Only an execution that reached the storage delete is charged for having abandoned one. A lease that lapsed
    // before that boundary did no storage work, so it is released and re-handed out uncharged.
    const abandoned = rows.filter((row) => cateringReclaimChargesAttempt({ hadToken: row.previousToken !== null, deleteAttempted: row.deleteAttemptedAt !== null }));
    const exhausted = abandoned.filter((row) => row.cleanupAttempts + 1 >= CATERING_CLEANUP_MAX_ATTEMPTS).map((row) => row.id);
    if (exhausted.length > 0) {
      await tx.update(cateringBookingStorageOrphans)
        .set({ cleanupAttempts: chargeAttempt(cateringBookingStorageOrphans.cleanupAttempts), cleanupClaimToken: null, cleanupClaimedUntil: null, cleanupDeleteAttemptedAt: null })
        .where(inArray(cateringBookingStorageOrphans.id, exhausted));
    }
    const claimable = rows.filter((row) => !exhausted.includes(row.id));
    if (claimable.length === 0) return [];
    // Every fresh claim starts with no delete attempted, so the marker always describes THIS claim and never a
    // previous one.
    await tx.update(cateringBookingStorageOrphans)
      .set({ cleanupClaimToken: claimToken, cleanupClaimedUntil: leaseExpiry, cleanupDeleteAttemptedAt: null })
      .where(inArray(cateringBookingStorageOrphans.id, claimable.map((row) => row.id)));
    const charged = claimable.filter((row) => abandoned.some((item) => item.id === row.id)).map((row) => row.id);
    if (charged.length > 0) {
      await tx.update(cateringBookingStorageOrphans)
        .set({ cleanupAttempts: chargeAttempt(cateringBookingStorageOrphans.cleanupAttempts) })
        .where(inArray(cateringBookingStorageOrphans.id, charged));
    }
    return claimable.map((row) => ({ id: row.id, storageProvider: row.storageProvider, storageKey: row.storageKey, fileId: row.fileId, reason: row.reason, claimToken }));
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
  const settle = (candidate: CateringCleanupClaim, conclusion: CateringCleanupConclusion, error: unknown) => db.update(cateringBookingFiles)
    // Only a storage failure charges the ceiling. A finalization failure releases the lease and records why, so the
    // next pass re-claims the row cleanly -- it is not an abandoned execution and must not be charged as one. The
    // marker is cleared with the lease, so a released row carries no evidence of an attempt it did not make.
    .set({
      ...(cateringCleanupChargesAttempt(conclusion) ? { cleanupAttempts: chargeAttempt(cateringBookingFiles.cleanupAttempts) } : {}),
      cleanupError: errorMessage(error),
      cleanupClaimToken: null,
      cleanupClaimedUntil: null,
      cleanupDeleteAttemptedAt: null,
    })
    .where(and(eq(cateringBookingFiles.id, candidate.id), eq(cateringBookingFiles.cleanupClaimToken, candidate.claimToken)))
    .catch(() => undefined);
  for (const candidate of candidates) {
    // The boundary. Nothing below may be reached without durable, token-conditioned evidence that this claim is
    // entering the delete -- which is also what stops a worker whose lease was taken over from deleting anything.
    const entry = await enterDeleteAttempt(() => db.update(cateringBookingFiles)
      .set({ cleanupDeleteAttemptedAt: sql`now()` })
      .where(and(eq(cateringBookingFiles.id, candidate.id), eq(cateringBookingFiles.cleanupClaimToken, candidate.claimToken)))
      .returning({ id: cateringBookingFiles.id }));
    if (entry !== "entered") {
      // `lost`: a newer holder owns this row and will do the work. `unrecorded`: the evidence could not be written,
      // so the delete is not attempted at all rather than made unaccountable. Neither is a storage attempt.
      if (entry === "unrecorded") await settle(candidate, "unrecorded", new Error("cleanup attempt could not be recorded"));
      failed += 1;
      continue;
    }
    try {
      await removePrivateObject(candidate.storageProvider as PrivateStorageProvider, candidate.storageKey);
    } catch (error) {
      // The bytes are still there. One attempt for this claimed execution, charged once, and the lease released so
      // a later run can retry.
      await settle(candidate, "storage_failed", error);
      failed += 1;
      continue;
    }
    // The object is gone from here on, so nothing below may charge a storage attempt for failing to say so.
    const finalized = await settleCateringFinalization(() => db.update(cateringBookingFiles)
      .set({ objectDeletedAt: new Date(), cleanupError: null, cleanupClaimToken: null, cleanupClaimedUntil: null, cleanupDeleteAttemptedAt: null })
      .where(and(
        eq(cateringBookingFiles.id, candidate.id),
        eq(cateringBookingFiles.cleanupClaimToken, candidate.claimToken),
        isNotNull(cateringBookingFiles.deletedAt),
        isNull(cateringBookingFiles.objectDeletedAt),
      )));
    if (finalized.ok) { removed += 1; continue; }
    // `object_deleted_at` is still null, so the row stays in the queue and the next pass finds it naturally. The
    // delete it retries finds nothing and succeeds, which is what makes this safe to repeat.
    await settle(candidate, "unfinalized", finalized.error);
    failed += 1;
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
    .set({ resolvedAt: new Date(), cleanupError: null, cleanupClaimToken: null, cleanupClaimedUntil: null, cleanupDeleteAttemptedAt: null })
    .where(and(
      eq(cateringBookingStorageOrphans.id, candidate.id),
      eq(cateringBookingStorageOrphans.cleanupClaimToken, candidate.claimToken),
      isNull(cateringBookingStorageOrphans.resolvedAt),
    ));
  const settle = (candidate: CateringOrphanClaim, conclusion: CateringCleanupConclusion, error: unknown) => db.update(cateringBookingStorageOrphans)
    .set({
      ...(cateringCleanupChargesAttempt(conclusion) ? { cleanupAttempts: chargeAttempt(cateringBookingStorageOrphans.cleanupAttempts) } : {}),
      cleanupError: errorMessage(error),
      cleanupClaimToken: null,
      cleanupClaimedUntil: null,
      cleanupDeleteAttemptedAt: null,
    })
    .where(and(eq(cateringBookingStorageOrphans.id, candidate.id), eq(cateringBookingStorageOrphans.cleanupClaimToken, candidate.claimToken)))
    .catch(() => undefined);
  for (const candidate of candidates) {
    // Ownership first, in its own phase. An unanswerable question leaves the object exactly where it is: deleting
    // bytes whose owner is unknown is the bug this ledger exists to prevent. Nothing was deleted and nothing was
    // attempted, so nothing is charged -- otherwise a database that is briefly unavailable could exhaust the
    // ceiling on a row storage was never asked about, stranding the object for good.
    let owned: boolean;
    try {
      owned = await objectHasOwner(candidate);
    } catch (error) {
      await settle(candidate, "ownership_failed", error);
      failed += 1;
      continue;
    }
    // A committed file row owns these bytes, so nothing is deleted; otherwise the object goes now, and only THAT
    // failing is a storage attempt.
    if (!owned) {
      // Second phase, for an uncertain WRITE only: ask STORAGE whether the object is there. This row exists because
      // a PUT's outcome was unknown and the compensating delete may have run before the write landed, so the one
      // thing that can retire it is storage itself answering. A HEAD that fails is storage declining to answer --
      // nothing was deleted, nothing was attempted -- so the row stays pending and no attempt is charged, exactly
      // as an unanswerable ownership lookup does. `present` and `absent` both go on to the delete below, which is
      // idempotent: it removes a delayed object that did materialize, and completes harmlessly for one that never
      // did, which is what finally lets the record resolve.
      if (candidate.reason === CATERING_UNCERTAIN_WRITE_REASON) {
        let presence: PrivateObjectPresence;
        try {
          presence = await privateObjectPresence(candidate.storageProvider as PrivateStorageProvider, candidate.storageKey);
        } catch (error) {
          await settle(candidate, "presence_failed", error);
          failed += 1;
          continue;
        }
        if (presence === "unknown") {
          await settle(candidate, "presence_failed", new Error("storage presence could not be established"));
          failed += 1;
          continue;
        }
      }
      // The boundary. The questions above are lookups and are never charged, so the evidence that this claim
      // reached the delete is written here -- durably, and under this claim's own token, which also stops a worker
      // whose lease was taken over from deleting anything.
      const entry = await enterDeleteAttempt(() => db.update(cateringBookingStorageOrphans)
        .set({ cleanupDeleteAttemptedAt: sql`now()` })
        .where(and(eq(cateringBookingStorageOrphans.id, candidate.id), eq(cateringBookingStorageOrphans.cleanupClaimToken, candidate.claimToken)))
        .returning({ id: cateringBookingStorageOrphans.id }));
      if (entry !== "entered") {
        if (entry === "unrecorded") await settle(candidate, "unrecorded", new Error("cleanup attempt could not be recorded"));
        failed += 1;
        continue;
      }
      try {
        await removePrivateObject(candidate.storageProvider as PrivateStorageProvider, candidate.storageKey);
      } catch (error) {
        await settle(candidate, "storage_failed", error);
        failed += 1;
        continue;
      }
    }
    // Storage is settled either way from here -- deleted, or deliberately left with its owner -- so failing to
    // record that is bookkeeping and must not spend a storage attempt.
    const finalized = await settleCateringFinalization(() => resolve(candidate));
    if (finalized.ok) { if (owned) retained += 1; else removed += 1; continue; }
    // `resolved_at` is still null, so the entry stays pending and the next pass repeats a delete that now finds
    // nothing, or an ownership check that answers the same way.
    await settle(candidate, "unfinalized", finalized.error);
    failed += 1;
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
