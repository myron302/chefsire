import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_CLEANUP_LEASE_SECONDS, CATERING_CLEANUP_MAX_ATTEMPTS, combineCateringCleanupOutcomes } from "./catering-booking-storage-cleanup";

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
/** The end of a top-level function body: a closing brace in the first column. */
const BLOCK_END = "\n}\n";

type Row = { id: string; attempts: number; done: boolean; token: string | null; until: number };
/**
 * An in-memory model of the durable lease, sharing one clock across every worker exactly as the database clock is
 * shared across replicas. What it models is the part that matters: a claim that OUTLIVES the transaction, and
 * finalization that requires the token.
 */
function cluster(rows: Row[]) {
  let now = 0;
  let tokens = 0;
  return {
    rows,
    advance(seconds: number) { now += seconds; },
    row(id: string) { return rows.find((candidate) => candidate.id === id)!; },
    /** The short claim transaction: eligible rows are leased and stamped, and the lease survives the commit. */
    claim(limit = 10): { id: string; token: string }[] {
      const token = `worker-${++tokens}`;
      const taken = rows.filter((row) => !row.done && row.attempts < CATERING_CLEANUP_MAX_ATTEMPTS && (row.token === null || row.until <= now)).slice(0, limit);
      for (const row of taken) {
        // Taking over a row that still holds a token means its previous execution never concluded, so the
        // abandoned attempt is charged here rather than being lost.
        if (row.token !== null) row.attempts += 1;
        row.token = token;
        row.until = now + CATERING_CLEANUP_LEASE_SECONDS;
      }
      return taken.map((row) => ({ id: row.id, token }));
    },
    /** Finalization, conditioned on the token: a stale worker matches nothing and changes nothing. */
    succeed(id: string, token: string): boolean {
      const row = this.row(id);
      if (row.token !== token || row.done) return false;
      row.done = true; row.token = null; row.until = 0;
      return true;
    },
    fail(id: string, token: string): boolean {
      const row = this.row(id);
      if (row.token !== token) return false;
      row.attempts += 1; row.token = null; row.until = 0;
      return true;
    },
  };
}
const pending = (id: string, over: Partial<Row> = {}): Row => ({ id, attempts: 0, done: false, token: null, until: 0, ...over });

test("1-4. a claim survives its transaction, so a second replica cannot take the row while the lease holds", () => {
  const c = cluster([pending("a")]);
  const first = c.claim();
  assert.deepEqual(first.map((row) => row.id), ["a"]);
  // The claim transaction has COMMITTED here -- the row lock is gone -- and worker A has not started deleting yet.
  // Under transaction-local SKIP LOCKED alone this is exactly where B would have claimed it too.
  const second = c.claim();
  assert.deepEqual(second, [], "the durable lease, not the released lock, is what excludes the second worker");
  assert.equal(c.row("a").attempts, 0, "claiming a fresh row charges nothing");
});

test("5. only the holding token can finalize success, and it completes the row once", () => {
  const c = cluster([pending("a")]);
  const [claim] = c.claim();
  assert.equal(c.succeed("a", "not-my-token"), false, "a foreign token must not mark success");
  assert.equal(c.succeed("a", claim.token), true);
  assert.equal(c.row("a").done, true);
  assert.equal(c.row("a").token, null, "the claim is cleared on completion");
  assert.equal(c.row("a").attempts, 0, "a successful execution charges no attempt");
  // Completed rows leave the queue, so nothing marks them a second time.
  assert.equal(c.succeed("a", claim.token), false);
  assert.deepEqual(c.claim(), []);
});

test("6. a failed execution charges exactly one attempt and releases the row for a later retry", () => {
  const c = cluster([pending("a")]);
  const [claim] = c.claim();
  assert.equal(c.fail("a", claim.token), true);
  assert.equal(c.row("a").attempts, 1);
  assert.equal(c.row("a").token, null);
  // Immediately eligible again -- the lease was released, not left to expire.
  assert.deepEqual(c.claim().map((row) => row.id), ["a"]);
});

test("7. a storage outage across many replicas costs one attempt per row per run, not one per replica", () => {
  const c = cluster([pending("a")]);
  for (let run = 0; run < 5; run += 1) {
    const [claim] = c.claim();
    // Four more replicas run the same scheduled job while the lease is held.
    for (let replica = 0; replica < 4; replica += 1) assert.deepEqual(c.claim(), []);
    c.fail(claim.id, claim.token);
  }
  assert.equal(c.row("a").attempts, 5, "five runs, five attempts -- no ceiling stampede");
});

test("8. a worker that crashes after claiming holds the row until the lease expires, then it is reclaimed", () => {
  const c = cluster([pending("a")]);
  const [first] = c.claim();
  // The worker dies here: no success, no failure, nothing finalized.
  c.advance(CATERING_CLEANUP_LEASE_SECONDS - 1);
  assert.deepEqual(c.claim(), [], "the row stays unavailable for the whole lease");
  c.advance(2);
  const [second] = c.claim();
  assert.equal(second.id, "a");
  assert.notEqual(second.token, first.token, "the reclaim issues a NEW token");
  // The abandoned execution is charged on reclaim, so a repeatedly crashing worker cannot retry forever.
  assert.equal(c.row("a").attempts, 1);
});

test("9. a slow worker returning after its lease was reclaimed finalizes nothing", () => {
  const c = cluster([pending("a")]);
  const [stale] = c.claim();
  c.advance(CATERING_CLEANUP_LEASE_SECONDS + 1);
  const [fresh] = c.claim();
  const attemptsAfterReclaim = c.row("a").attempts;
  // The old worker finally returns, with a token that is no longer the row's.
  assert.equal(c.succeed("a", stale.token), false, "a stale token must not mark success");
  assert.equal(c.fail("a", stale.token), false, "a stale token must not charge an attempt");
  assert.equal(c.row("a").attempts, attemptsAfterReclaim);
  assert.equal(c.row("a").done, false);
  assert.equal(c.row("a").token, fresh.token, "the newer claim survives the stale worker's return");
  // And the current holder can still finalize normally.
  assert.equal(c.succeed("a", fresh.token), true);
});

test("10. different rows are claimed concurrently: a lease excludes only its own row", () => {
  const c = cluster([pending("a"), pending("b")]);
  const first = c.claim(1);
  const second = c.claim(1);
  assert.deepEqual(first.map((row) => row.id), ["a"]);
  assert.deepEqual(second.map((row) => row.id), ["b"]);
  assert.notEqual(first[0].token, second[0].token);
});

test("11 & 12. rows at the attempt ceiling, and completed rows, are never claimed", () => {
  const c = cluster([
    pending("exhausted", { attempts: CATERING_CLEANUP_MAX_ATTEMPTS }),
    pending("done", { done: true, attempts: 3 }),
    pending("ready"),
  ]);
  assert.deepEqual(c.claim().map((row) => row.id), ["ready"]);
  assert.equal(c.row("exhausted").attempts, CATERING_CLEANUP_MAX_ATTEMPTS, "an exhausted row spends nothing further");
  assert.equal(c.row("done").attempts, 3);
});

test("13-15. the orphan queue behaves identically, because it is the same lease", () => {
  // Modelled with the same cluster: the orphan queue's claim, token-conditioned finalization and attempt
  // accounting are the same design, which is the point -- neither queue is left on transaction-local locking.
  const c = cluster([pending("orphan-1"), pending("orphan-2")]);
  const [first] = c.claim(1);
  // A second worker takes the OTHER orphan: only the leased one is excluded, and it gets its own token.
  const [second] = c.claim(1);
  assert.equal(second.id, "orphan-2");
  assert.notEqual(second.token, first.token);
  // 14: success finalizes only with the matching token.
  assert.equal(c.succeed("orphan-1", "someone-else"), false);
  assert.equal(c.succeed("orphan-1", first.token), true);
  // 15: a failed orphan cleanup consumes exactly one attempt for that claim.
  c.fail("orphan-2", second.token);
  assert.equal(c.row("orphan-2").attempts, 1);
  assert.equal(c.fail("orphan-2", second.token), false, "the released token cannot charge a second attempt");
  assert.equal(c.row("orphan-2").attempts, 1);
});

test("BOTH queues claim with a durable lease, not a transaction-local lock alone", () => {
  for (const claim of ["claimTombstones", "claimOrphans"]) {
    const at = service.indexOf(`async function ${claim}`);
    const body = service.slice(at, service.indexOf(BLOCK_END, at));
    assert.equal(body.includes("db.transaction("), true, claim);
    // The lock still guards the claim itself against a racing claimer...
    assert.equal(body.includes(`.for("update", { skipLocked: true })`), true, claim);
    // ...but the lease is what survives the commit, and it excludes rows already held.
    assert.equal(body.includes("leaseIsAvailable("), true, claim);
    assert.equal(body.includes("cleanupClaimToken: claimToken, cleanupClaimedUntil: leaseExpiry"), true, claim);
    assert.equal(body.includes("const claimToken = randomUUID();") || service.slice(at - 120, at).includes("randomUUID"), true, claim);
    // An abandoned execution is charged on reclaim, and a fresh row is charged nothing.
    assert.equal(body.includes("rows.filter((row) => row.previousToken !== null)"), true, claim);
    // No storage call happens inside the claim transaction.
    assert.equal(body.includes("removePrivateObject"), false, claim);
  }
  // The token is unpredictable and the clock is the database's, so replicas agree on what "expired" means.
  assert.equal(service.includes("const claimToken = randomUUID();"), true);
  assert.equal(service.includes("lte(until, sql`now()`)"), true);
  assert.equal(service.includes("sql`now() + (${CATERING_CLEANUP_LEASE_SECONDS} * interval '1 second')`"), true);
  // A lease long enough for one delete, short enough to recover within the hourly schedule.
  assert.equal(CATERING_CLEANUP_LEASE_SECONDS, 300);
});

test("every finalization is conditioned on the claim token, in BOTH queues", () => {
  for (const [queue, table] of [["reconcileCateringFileTombstones", "cateringBookingFiles"], ["reconcileCateringStorageOrphans", "cateringBookingStorageOrphans"]] as const) {
    const at = service.indexOf(`export async function ${queue}`);
    const body = service.slice(at, service.indexOf(BLOCK_END, at));
    const conditions = (body.match(new RegExp(`eq\\(${table}\\.cleanupClaimToken, candidate\\.claimToken\\)`, "g")) ?? []).length;
    assert.equal(conditions >= 2, true, `${queue} must token-condition both success and failure`);
    // Finalization releases the lease either way, so a later run can retry rather than waiting it out.
    assert.equal(body.includes("cleanupClaimToken: null, cleanupClaimedUntil: null"), true, queue);
    // The attempt is charged on the failure path only.
    const failure = body.slice(body.indexOf("} catch (error) {"));
    assert.equal(failure.includes("cleanupAttempts"), true, queue);
    const success = body.slice(0, body.indexOf("} catch (error) {"));
    assert.equal(success.includes("cleanupAttempts"), false, `${queue} must not charge an attempt for a success`);
  }
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
