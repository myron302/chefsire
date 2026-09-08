import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_CLEANUP_LEASE_SECONDS, CATERING_CLEANUP_MAX_ATTEMPTS, cateringCleanupChargesAttempt, cateringReclaimChargesAttempt, type CateringCleanupConclusion } from "./catering-booking-storage-cleanup";

/**
 * An expired claim token says an execution did not conclude. It does not say what that execution DID.
 *
 * The attempt counter bounds retries against STORAGE, so it may only count deletes that were begun. Treating the
 * token alone as evidence of one charged the budget for outages: an ownership lookup fails while the database is
 * down, the release that would have recorded "nothing was attempted" fails for the same reason, the lease lapses,
 * and the reclaim charges an attempt for a delete nobody ever called. Ten of those and the object is stranded
 * without storage having been asked once.
 *
 * `cleanup_delete_attempted_at` is the evidence instead: cleared on every fresh claim, stamped durably and under
 * the claim's own token immediately before `removePrivateObject` is entered. The reclaim then knows which side of
 * that boundary the abandoned execution died on. There is no database harness here, so the phase machine is
 * simulated over the exported rules the service itself branches on, and the service is asserted structurally.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const service = fs.readFileSync(path.join(here, "catering-booking-storage-cleanup.ts"), "utf8");
const schema = fs.readFileSync(path.join(here, "..", "..", "shared", "schema", "domains", "social-content.ts"), "utf8");
const migration = fs.readFileSync(path.join(here, "..", "migrations", "20260902_catering_booking_communication_files.sql"), "utf8");

type Row = {
  id: string;
  storageKey: string;
  resolvedAt: Date | null;
  cleanupAttempts: number;
  cleanupError: string | null;
  cleanupClaimToken: string | null;
  cleanupClaimedUntil: number | null;
  cleanupDeleteAttemptedAt: number | null;
};
const row = (overrides: Partial<Row> = {}): Row => ({
  id: "orphan-1", storageKey: "catering-bookings/b1/file-1", resolvedAt: null, cleanupAttempts: 0, cleanupError: null,
  cleanupClaimToken: null, cleanupClaimedUntil: null, cleanupDeleteAttemptedAt: null, ...overrides,
});

/** Private storage, with `removePrivateObject`'s own semantics: deleting what is already gone is a success. */
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

/** Which database writes are currently failing, and where the worker dies. */
type Faults = { ownership?: boolean; mark?: boolean; settle?: boolean; finalize?: boolean; crashAfterMark?: boolean; crashAfterDelete?: boolean; owned?: boolean };

function settle(target: Row, conclusion: CateringCleanupConclusion, token: string, faults: Faults, error = "failed") {
  if (target.cleanupClaimToken !== token) return;      // a stale worker settles nothing
  if (faults.settle) return;                            // the write itself failed: the row keeps its token
  if (cateringCleanupChargesAttempt(conclusion)) target.cleanupAttempts = Math.min(target.cleanupAttempts + 1, CATERING_CLEANUP_MAX_ATTEMPTS);
  target.cleanupError = error;
  target.cleanupClaimToken = null;
  target.cleanupClaimedUntil = null;
  target.cleanupDeleteAttemptedAt = null;
}

const eligible = (target: Row, now: number) =>
  target.resolvedAt === null && target.cleanupAttempts < CATERING_CLEANUP_MAX_ATTEMPTS && (target.cleanupClaimedUntil === null || target.cleanupClaimedUntil <= now);

let tokens = 0;
/** One reconciliation pass over the orphan queue, with the phase machine the service implements. */
function pass(rows: Row[], storage: ReturnType<typeof storageHolding>, now: number, faults: Faults = {}) {
  const token = `claim-${(tokens += 1)}`;
  const claimed: Row[] = [];
  for (const target of rows.filter((candidate) => eligible(candidate, now))) {
    if (cateringReclaimChargesAttempt({ hadToken: target.cleanupClaimToken !== null, deleteAttempted: target.cleanupDeleteAttemptedAt !== null })) {
      target.cleanupAttempts = Math.min(target.cleanupAttempts + 1, CATERING_CLEANUP_MAX_ATTEMPTS);
      target.cleanupClaimToken = null;
      target.cleanupClaimedUntil = null;
      target.cleanupDeleteAttemptedAt = null;
      if (target.cleanupAttempts >= CATERING_CLEANUP_MAX_ATTEMPTS) continue;
    }
    target.cleanupClaimToken = token;
    target.cleanupClaimedUntil = now + CATERING_CLEANUP_LEASE_SECONDS * 1000;
    target.cleanupDeleteAttemptedAt = null;
    claimed.push(target);
  }
  let removed = 0; let failed = 0; let retained = 0;
  for (const target of claimed) {
    // Phase 1: ownership. A database question, never a storage attempt.
    if (faults.ownership) { settle(target, "ownership_failed", token, faults); failed += 1; continue; }
    if (faults.owned) {
      if (faults.finalize) { settle(target, "unfinalized", token, faults); failed += 1; continue; }
      target.resolvedAt = new Date(now); target.cleanupClaimToken = null; target.cleanupClaimedUntil = null; target.cleanupDeleteAttemptedAt = null;
      retained += 1; continue;
    }
    // Phase 2: the boundary. Durable, token-conditioned evidence that this claim is entering the delete.
    if (faults.mark) { settle(target, "unrecorded", token, faults); failed += 1; continue; }
    if (target.cleanupClaimToken !== token) { failed += 1; continue; }  // lease taken over: this worker deletes nothing
    target.cleanupDeleteAttemptedAt = now;
    if (faults.crashAfterMark) { failed += 1; continue; }               // the worker dies holding the evidence
    // Phase 3: the delete itself.
    try { storage.remove(target.storageKey); }
    catch (error) { settle(target, "storage_failed", token, faults, String(error)); failed += 1; continue; }
    if (faults.crashAfterDelete) { failed += 1; continue; }
    // Phase 4: finalization. Bookkeeping about work already done, so never a storage attempt.
    if (faults.finalize) { settle(target, "unfinalized", token, faults); failed += 1; continue; }
    target.resolvedAt = new Date(now); target.cleanupError = null; target.cleanupClaimToken = null; target.cleanupClaimedUntil = null; target.cleanupDeleteAttemptedAt = null;
    removed += 1;
  }
  return { scanned: claimed.length, removed, failed, retained };
}

const T0 = Date.parse("2026-09-01T12:00:00Z");
const LATER = (seconds: number) => T0 + seconds * 1000;
/** Long enough that the previous claim's lease has lapsed. */
const NEXT_PASS = (round: number) => LATER(CATERING_CLEANUP_LEASE_SECONDS * 2 * (round + 1));

test("1. an ownership failure whose release also fails charges nothing when the lease is reclaimed", () => {
  const target = row();
  const storage = storageHolding(target.storageKey);
  // The database is down: the lookup fails, and so does the write that would record "nothing was attempted".
  pass([target], storage, T0, { ownership: true, settle: true });
  assert.equal(target.cleanupClaimToken, "claim-" + tokens, "the row keeps its token, because the release failed");
  assert.equal(target.cleanupDeleteAttemptedAt, null, "and carries no evidence of a storage attempt");
  assert.equal(storage.calls, 0);
  // The lease lapses and another pass reclaims it.
  pass([target], storage, NEXT_PASS(0), { ownership: true, settle: true });
  assert.equal(target.cleanupAttempts, 0, "an expired token is not evidence that anything was deleted");
  assert.equal(storage.calls, 0);
});

test("2. repeated outages never exhaust the budget, and storage still gets all ten attempts", () => {
  const target = row();
  const storage = storageHolding(target.storageKey);
  for (let round = 0; round < CATERING_CLEANUP_MAX_ATTEMPTS + 5; round += 1) {
    pass([target], storage, NEXT_PASS(round), { ownership: true, settle: true });
  }
  assert.equal(target.cleanupAttempts, 0, "fifteen outages, no attempts consumed");
  assert.equal(storage.calls, 0);
  assert.equal(eligible(target, NEXT_PASS(20)), true, "the row is never stranded");
  // The database recovers but storage is broken: the ceiling now applies to genuine attempts, all ten of them.
  storage.breakWith("R2 unavailable");
  for (let round = 20; round < 20 + CATERING_CLEANUP_MAX_ATTEMPTS + 3; round += 1) {
    pass([target], storage, NEXT_PASS(round), {});
  }
  assert.equal(target.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS);
  assert.equal(storage.calls, CATERING_CLEANUP_MAX_ATTEMPTS, "ten real deletes, no more and no fewer");
  assert.equal(eligible(target, NEXT_PASS(60)), false);
});

test("3. a worker that dies after recording the attempt is charged for it exactly once", () => {
  const target = row();
  const storage = storageHolding(target.storageKey);
  pass([target], storage, T0, { crashAfterMark: true });
  assert.notEqual(target.cleanupDeleteAttemptedAt, null, "the evidence is durable and survives the worker");
  assert.equal(target.cleanupAttempts, 0, "not charged yet: nothing has concluded");
  // The reclaim charges it, because the delete may well have happened.
  pass([target], storage, NEXT_PASS(0), { crashAfterMark: true });
  assert.equal(target.cleanupAttempts, 1);
  // And charged once per abandoned execution, not once per pass.
  pass([target], storage, NEXT_PASS(1), { ownership: true, settle: true });
  assert.equal(target.cleanupAttempts, 2, "the second crash is its own attempt");
  pass([target], storage, NEXT_PASS(2), { ownership: true, settle: true });
  assert.equal(target.cleanupAttempts, 2, "an ownership outage adds nothing on top of it");
});

test("3b. a crash after the delete is likewise charged once, conservatively", () => {
  const target = row();
  const storage = storageHolding(target.storageKey);
  pass([target], storage, T0, { crashAfterDelete: true });
  assert.equal(storage.holds(target.storageKey), false, "the bytes did go");
  assert.notEqual(target.cleanupDeleteAttemptedAt, null);
  pass([target], storage, NEXT_PASS(0), {});
  // The reclaim charges the abandoned attempt, then this pass deletes an already-absent object and finishes.
  assert.equal(target.cleanupAttempts, 1);
  assert.notEqual(target.resolvedAt, null);
});

test("4. an actual delete failure consumes exactly one attempt", () => {
  const target = row();
  const storage = storageHolding(target.storageKey);
  storage.breakWith("R2 unavailable");
  pass([target], storage, T0, {});
  assert.equal(target.cleanupAttempts, 1);
  assert.equal(storage.calls, 1);
  assert.equal(target.cleanupClaimToken, null, "and the lease is released for the next pass");
  assert.equal(target.cleanupDeleteAttemptedAt, null, "with the evidence cleared alongside it");
});

test("5. a delete that succeeds and a settlement that fails stays safe and bounded", () => {
  const target = row();
  const storage = storageHolding(target.storageKey);
  pass([target], storage, T0, { finalize: true, settle: true });
  assert.equal(storage.holds(target.storageKey), false);
  assert.equal(target.resolvedAt, null, "unfinished, so the queue keeps it");
  assert.notEqual(target.cleanupDeleteAttemptedAt, null);
  // The reclaim charges that one genuine attempt, and the next pass finishes the row against an absent object.
  pass([target], storage, NEXT_PASS(0), {});
  assert.equal(target.cleanupAttempts, 1);
  assert.notEqual(target.resolvedAt, null);
  // A settlement that fails after a delete does NOT create unlimited retries: each round costs one real attempt.
  const looping = row({ id: "orphan-loop", storageKey: "catering-bookings/b1/loop" });
  const other = storageHolding(looping.storageKey);
  for (let round = 0; round < CATERING_CLEANUP_MAX_ATTEMPTS + 4; round += 1) {
    pass([looping], other, NEXT_PASS(round), { finalize: true, settle: true });
  }
  assert.equal(looping.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS);
  assert.equal(eligible(looping, NEXT_PASS(40)), false, "it stops rather than retrying forever");
});

test("6. a stale token cannot mark, delete or settle a row another worker now holds", () => {
  const target = row({ cleanupClaimToken: "newer-worker", cleanupClaimedUntil: LATER(600), cleanupAttempts: 3 });
  const storage = storageHolding(target.storageKey);
  // Settlement is refused outright.
  for (const conclusion of ["storage_failed", "ownership_failed", "unfinalized", "unrecorded"] as const) {
    settle(target, conclusion, "a-stale-token", {});
  }
  assert.equal(target.cleanupAttempts, 3);
  assert.equal(target.cleanupClaimToken, "newer-worker");
  assert.equal(target.cleanupDeleteAttemptedAt, null);
  // And the live lease keeps the row out of another pass entirely, so nothing is deleted twice.
  const outcome = pass([target], storage, LATER(60), {});
  assert.deepEqual(outcome, { scanned: 0, removed: 0, failed: 0, retained: 0 });
  assert.equal(storage.calls, 0);
  // The service conditions the marking write on the claim's own token, exactly as it conditions settlement.
  assert.equal((service.match(/cleanupDeleteAttemptedAt: sql`now\(\)`/g) ?? []).length, 2, "both queues");
  assert.equal(service.includes("eq(cateringBookingFiles.cleanupClaimToken, candidate.claimToken)))\n      .returning({ id: cateringBookingFiles.id }));"), true);
  assert.equal(service.includes("eq(cateringBookingStorageOrphans.cleanupClaimToken, candidate.claimToken)))\n        .returning({ id: cateringBookingStorageOrphans.id }));"), true);
});

test("7. genuine storage failures still reach the ceiling, from a clean row", () => {
  const target = row();
  const storage = storageHolding(target.storageKey);
  storage.breakWith("R2 unavailable");
  for (let round = 0; round < CATERING_CLEANUP_MAX_ATTEMPTS + 4; round += 1) pass([target], storage, NEXT_PASS(round), {});
  assert.equal(target.cleanupAttempts, CATERING_CLEANUP_MAX_ATTEMPTS);
  assert.equal(storage.calls, CATERING_CLEANUP_MAX_ATTEMPTS);
  assert.equal(eligible(target, NEXT_PASS(40)), false);
  assert.equal(target.resolvedAt, null, "exhausted is not resolved: it stays visible to an operator");
});

test("8. no combination of non-storage failures reaches the ceiling by itself", () => {
  for (const faults of [{ ownership: true, settle: true }, { ownership: true }, { mark: true, settle: true }, { mark: true }, { owned: true, finalize: true, settle: true }] as const) {
    const target = row({ id: `orphan-${JSON.stringify(faults)}` });
    const storage = storageHolding(target.storageKey);
    for (let round = 0; round < CATERING_CLEANUP_MAX_ATTEMPTS + 5; round += 1) pass([target], storage, NEXT_PASS(round), faults);
    assert.equal(target.cleanupAttempts, 0, JSON.stringify(faults));
    assert.equal(storage.calls, 0, `${JSON.stringify(faults)}: storage must never be entered`);
    assert.equal(eligible(target, NEXT_PASS(40)), true, JSON.stringify(faults));
  }
  // The rule itself, stated once: only a storage failure charges, and only a delete that was begun is abandoned.
  assert.equal(cateringCleanupChargesAttempt("storage_failed"), true);
  for (const conclusion of ["removed", "ownership_failed", "unfinalized", "unrecorded"] as const) {
    assert.equal(cateringCleanupChargesAttempt(conclusion), false, conclusion);
  }
  assert.equal(cateringReclaimChargesAttempt({ hadToken: true, deleteAttempted: true }), true);
  assert.equal(cateringReclaimChargesAttempt({ hadToken: true, deleteAttempted: false }), false);
  assert.equal(cateringReclaimChargesAttempt({ hadToken: false, deleteAttempted: true }), false);
  assert.equal(cateringReclaimChargesAttempt({ hadToken: false, deleteAttempted: false }), false);
});

test("9. an unrecordable attempt is not attempted, and a successful pass is unchanged", () => {
  // The evidence write failing means the delete cannot be accounted for, so it is not made: an unrecorded delete
  // would be indistinguishable from none, and every later decision about the row would be a guess.
  const unrecordable = row();
  const storage = storageHolding(unrecordable.storageKey);
  pass([unrecordable], storage, T0, { mark: true });
  assert.equal(storage.calls, 0, "fail closed: no delete without durable evidence of it");
  assert.equal(unrecordable.cleanupAttempts, 0);
  assert.equal(unrecordable.holds === undefined, true);
  assert.equal(storage.holds(unrecordable.storageKey), true, "and the object is left exactly where it was");
  // The ordinary success path still finishes the row and leaves nothing behind.
  const healthy = row({ id: "orphan-ok", storageKey: "catering-bookings/b1/ok" });
  const good = storageHolding(healthy.storageKey);
  const outcome = pass([healthy], good, T0, {});
  assert.deepEqual(outcome, { scanned: 1, removed: 1, failed: 0, retained: 0 });
  assert.equal(good.holds(healthy.storageKey), false);
  assert.notEqual(healthy.resolvedAt, null);
  assert.equal(healthy.cleanupAttempts, 0);
  assert.equal(healthy.cleanupClaimToken, null);
  assert.equal(healthy.cleanupDeleteAttemptedAt, null);
  // An already-absent object is still an idempotent success.
  const absent = row({ id: "orphan-absent", storageKey: "catering-bookings/b1/gone" });
  const empty = storageHolding();
  assert.deepEqual(pass([absent], empty, T0, {}), { scanned: 1, removed: 1, failed: 0, retained: 0 });
  assert.equal(absent.cleanupAttempts, 0);
});

test("10. the marker is a durable column, cleared on every claim and on every release", () => {
  // Durable across crashes, outages, lease expiry, restarts and takeovers because it is a persisted column, not
  // worker memory.
  assert.equal(schema.includes(`cleanupDeleteAttemptedAt: timestamp("cleanup_delete_attempted_at", { withTimezone: true })`), true);
  assert.equal((schema.match(/cleanup_delete_attempted_at/g) ?? []).length, 2, "both cleanup tables");
  assert.equal(migration.includes("ALTER TABLE catering_booking_files ADD COLUMN IF NOT EXISTS cleanup_delete_attempted_at timestamptz;"), true);
  assert.equal(migration.includes("ALTER TABLE catering_booking_storage_orphans ADD COLUMN IF NOT EXISTS cleanup_delete_attempted_at timestamptz;"), true);
  // Cleared by every claim and by every release, so it never describes a previous execution.
  assert.equal((service.match(/cleanupClaimToken: claimToken, cleanupClaimedUntil: leaseExpiry, cleanupDeleteAttemptedAt: null/g) ?? []).length, 2, "one fresh-claim reset per queue");
  // Eight clears in all: two fresh claims, two exhausted-reclaim releases, two settlements and two finalizations.
  assert.equal((service.match(/cleanupDeleteAttemptedAt: null/g) ?? []).length, 8);
  for (const release of ["cleanupClaimToken: null, cleanupClaimedUntil: null, cleanupDeleteAttemptedAt: null", "cleanupClaimedUntil: null,\n      cleanupDeleteAttemptedAt: null,"]) {
    assert.equal(service.includes(release), true, release.slice(0, 40));
  }
  // And the delete is the boundary: nothing calls removePrivateObject without entering it first.
  for (const queue of ["reconcileCateringFileTombstones", "reconcileCateringStorageOrphans"]) {
    const at = service.indexOf(`export async function ${queue}`);
    const body = service.slice(at, service.indexOf("\n}\n", at));
    assert.equal(body.indexOf("enterDeleteAttempt(") < body.indexOf("removePrivateObject("), true, queue);
    assert.equal(body.includes(`if (entry !== "entered")`), true, queue);
  }
});
