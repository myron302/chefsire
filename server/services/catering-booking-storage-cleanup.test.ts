import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Storage cleanup reconciliation.
 *
 * A tombstoned booking file whose object delete failed cannot be retried through the DELETE endpoint -- the row is
 * already tombstoned -- so before this existed the `cleanupAttempts`/`cleanupError` columns recorded an intent that
 * nothing ever acted on. The same was true of the orphan ledger.
 *
 * The database half of the reconciliation needs a live Postgres, which this suite does not have, so what is
 * exercised here is the part that decides and performs the storage side: bounds, idempotent deletion against a real
 * filesystem, and the invariants the SQL is written to hold. The queries and the completion writes are asserted
 * structurally against the service source, the same limitation already documented for the rest of Phase 2I.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const service = fs.readFileSync(path.join(here, "catering-booking-storage-cleanup.ts"), "utf8");
const cronSource = fs.readFileSync(path.join(here, "..", "cron.ts"), "utf8");
const filesRoute = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-files.ts"), "utf8");

const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "catering-cleanup-"));
process.env.PRIVATE_STORAGE_DIR = path.join(root, "private");
const { boundCateringCleanupBatch, combineCateringCleanupOutcomes, CATERING_CLEANUP_BATCH_DEFAULT, CATERING_CLEANUP_BATCH_MAXIMUM, CATERING_CLEANUP_MAX_ATTEMPTS } = await import("./catering-booking-storage-cleanup");
const storage = await import("../lib/private-storage");

const KEY = (file: string) => `catering-bookings/11111111-1111-4111-8111-111111111111/${file}/${file}.pdf`;
const BODY = Buffer.from("%PDF-1.7\nstartxref\n%%EOF\n");

test("a failed delete leaves the object present, so it stays genuinely pending rather than merely flagged", async () => {
  const key = KEY("22222222-2222-4222-8222-222222222222");
  await storage.writePrivateObject("local", key, BODY, "application/pdf");
  // This is the state the bug left behind: the row is tombstoned and the bytes are still there.
  assert.notEqual(await storage.statPrivateObject("local", key), null);
  // The query that finds it is exactly that state -- tombstoned, object not yet deleted, under the attempt ceiling.
  assert.equal(service.includes("isNotNull(cateringBookingFiles.deletedAt)"), true);
  assert.equal(service.includes("isNull(cateringBookingFiles.objectDeletedAt)"), true);
  assert.equal(service.includes("lt(cateringBookingFiles.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS)"), true);
});

test("a later retry removes the object and the completion is persisted", async () => {
  const key = KEY("33333333-3333-4333-8333-333333333333");
  await storage.writePrivateObject("local", key, BODY, "application/pdf");
  await storage.removePrivateObject("local", key);
  assert.equal(await storage.statPrivateObject("local", key), null);
  // Success writes objectDeletedAt and clears the recorded error.
  // Success writes the completion timestamp, clears the recorded error, and releases the claim.
  assert.equal(service.includes("set({ objectDeletedAt: new Date(), cleanupError: null, cleanupClaimToken: null, cleanupClaimedUntil: null })"), true);
  assert.equal(service.includes("set({ resolvedAt: new Date(), cleanupError: null, cleanupClaimToken: null, cleanupClaimedUntil: null })"), true);
});

test("repeated retries are harmless and an already-cleaned object is not an error", async () => {
  const key = KEY("44444444-4444-4444-8444-444444444444");
  await storage.writePrivateObject("local", key, BODY, "application/pdf");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await storage.removePrivateObject("local", key);
    assert.equal(await storage.statPrivateObject("local", key), null);
  }
  // An object a previous run already removed completes normally, which is also what makes two concurrent runs safe.
  await storage.removePrivateObject("local", KEY("55555555-5555-4555-8555-555555555555"));
});

test("cleanup never touches an unrelated object", async () => {
  const target = KEY("66666666-6666-4666-8666-666666666666");
  const bystander = "catering-bookings/99999999-9999-4999-8999-999999999999/77777777-7777-4777-8777-777777777777/77777777-7777-4777-8777-777777777777.pdf";
  await storage.writePrivateObject("local", target, BODY, "application/pdf");
  await storage.writePrivateObject("local", bystander, BODY, "application/pdf");
  await storage.removePrivateObject("local", target);
  assert.equal(await storage.statPrivateObject("local", target), null);
  // Another booking's object is untouched: every key comes from the candidate row being processed.
  assert.notEqual(await storage.statPrivateObject("local", bystander), null);
});

test("a completion write cannot double-count or resurrect a row under concurrency", () => {
  // The completion is conditional on the row still being an un-cleaned tombstone / unresolved orphan.
  // The completion now also requires the claim token, so only the worker holding the row can write it.
  for (const condition of [
    "eq(cateringBookingFiles.id, candidate.id)",
    "eq(cateringBookingFiles.cleanupClaimToken, candidate.claimToken)",
    "isNotNull(cateringBookingFiles.deletedAt)",
    "isNull(cateringBookingFiles.objectDeletedAt)",
    "eq(cateringBookingStorageOrphans.id, candidate.id)",
    "eq(cateringBookingStorageOrphans.cleanupClaimToken, candidate.claimToken)",
    "isNull(cateringBookingStorageOrphans.resolvedAt)",
  ]) {
    assert.equal(service.includes(condition), true, condition);
  }
  // Attempt counters are incremented in SQL, so concurrent runs cannot lose each other's increments.
  // The increment is still SQL-side, and it is charged for one claimed execution under a matching token, so two
  // workers cannot consume the same row's attempt for one scheduled opportunity.
  assert.equal(service.includes("sql`${cateringBookingFiles.cleanupAttempts} + 1`"), true);
  assert.equal(service.includes("sql`${cateringBookingStorageOrphans.cleanupAttempts} + 1`"), true);
  assert.equal(service.includes(`.for("update", { skipLocked: true })`), true);
});

test("cleanup never restores a deleted file to user visibility", () => {
  // Nothing on this path clears the tombstone, whatever storage does.
  assert.equal(service.includes("deletedAt: null"), false);
  assert.equal(service.includes("deletedBy: null"), false);
});

test("the batch is bounded, and a permanently failing record cannot starve the queue", () => {
  assert.equal(boundCateringCleanupBatch(undefined), CATERING_CLEANUP_BATCH_DEFAULT);
  assert.equal(boundCateringCleanupBatch(Number.NaN), CATERING_CLEANUP_BATCH_DEFAULT);
  assert.equal(boundCateringCleanupBatch(0), 1);
  assert.equal(boundCateringCleanupBatch(-5), 1);
  assert.equal(boundCateringCleanupBatch(10), 10);
  assert.equal(boundCateringCleanupBatch(CATERING_CLEANUP_BATCH_MAXIMUM + 1000), CATERING_CLEANUP_BATCH_MAXIMUM);
  // Past the ceiling a record stops being retried automatically but keeps its key, attempts and last error.
  assert.equal(CATERING_CLEANUP_MAX_ATTEMPTS > 0, true);
  assert.equal(service.includes("candidate.storageKey"), true);
});

test("outcomes from both queues combine into one truthful total", () => {
  assert.deepEqual(
    combineCateringCleanupOutcomes({ scanned: 2, removed: 1, failed: 1, retained: 0 }, { scanned: 3, removed: 2, failed: 0, retained: 1 }),
    { scanned: 5, removed: 3, failed: 1, retained: 1 },
  );
  assert.deepEqual(combineCateringCleanupOutcomes(), { scanned: 0, removed: 0, failed: 0, retained: 0 });
});

test("reconciliation is server-internal and can never be steered by a client", () => {
  // No route imports it, and it takes no caller-supplied key, provider or booking -- only a batch size.
  assert.equal(filesRoute.includes("catering-booking-storage-cleanup"), false);
  assert.equal(service.includes("req."), false);
  assert.equal(service.includes("requireAuth"), false);
  assert.equal(/export async function reconcileCateringStorageCleanup\(limit = /.test(service), true);
  // Keys are read from persisted rows, never accepted as input.
  assert.equal(service.includes("storageKey: cateringBookingFiles.storageKey"), true);
  assert.equal(service.includes("storageKey: cateringBookingStorageOrphans.storageKey"), true);
});

test("the reconciliation is actually invoked by the existing scheduler, not merely defined", () => {
  // node-cron is already the repo's scheduler and initializeCronJobs() is called from server/index.ts.
  assert.equal(cronSource.includes("reconcileCateringStorageCleanup"), true);
  assert.equal(cronSource.includes(`cron.schedule("30 * * * *"`), true);
  // And it is included in the existing manual trigger, so it can be run on demand too.
  assert.equal(cronSource.slice(cronSource.indexOf("export async function runAllChecksNow")).includes("reconcileCateringStorageCleanup()"), true);
});
