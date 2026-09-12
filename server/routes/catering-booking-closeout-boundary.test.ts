import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_CLOSEOUT_CLOSED_REFUSAL,
  CATERING_CLOSEOUT_CONFLICT_REFUSAL,
  cateringCloseoutFacts,
  cateringCloseoutIsClosed,
  resolveCateringCloseoutItemSave,
} from "../services/catering-booking-closeout-policy";
import { deriveCateringCloseoutState } from "@shared/catering-booking-closeout";

/**
 * P1 -- the closed-out mutation boundary, and P2 -- the response snapshot taken under the lock.
 *
 * BOUNDARY. Closing out asserts the operational work is finished. Letting a required item slide back to `pending`
 * afterwards produced a record that contradicted itself: `closed_out` dominates the derived state, so both
 * participants kept seeing a finished wrap-up while required work was outstanding, a repeated completion answered
 * `already_closed`, and no reopen was ever recorded -- no count, no instant, no actor, no activity. The explicit
 * reopen action is the only way back, because it is the deliberate, audited, customer-visible boundary that a
 * silent side-effect reopen would have thrown away.
 *
 * SNAPSHOT. The checklist returned by a save is what the client adopts versions from, so it has to be the state
 * this request produced under its own lock -- not a later one another tab wrote after the commit.
 *
 * There is no database harness in this suite, as in every other catering phase, so the route's ORDERING and its
 * snapshot boundary are asserted structurally against the route source, and the decisions they feed are exercised
 * against the policy functions.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-closeout.ts"), "utf8");
const handler = route.slice(
  route.indexOf('r.put("/bookings/:id/closeout/items/:itemKey"'),
  route.indexOf('r.put("/bookings/:id/closeout/notes"'),
);

const NOW = new Date("2026-09-05T10:00:00.000Z");
const LATER = new Date("2026-09-05T11:00:00.000Z");
const open = { closedOutAt: null };
const closed = { closedOutAt: NOW };
const item = (patch: Partial<{ state: string; providerNote: string | null; resolvedAt: Date | null; updatedAt: Date }> = {}) => ({
  state: "completed", providerNote: null, resolvedAt: NOW, updatedAt: NOW, ...patch,
});

/* ----------------------------------------------------------------------------------------------------------- *
 * P1: the boundary itself
 * ----------------------------------------------------------------------------------------------------------- */

test("the boundary reads the authoritative record, and an absent record is not closed", () => {
  assert.equal(cateringCloseoutIsClosed(closed), true);
  assert.equal(cateringCloseoutIsClosed(open), false);
  assert.equal(cateringCloseoutIsClosed(undefined), false, "a booking with no closeout record yet is open");
});

test("an OPEN closeout accepts a checklist change (1)", () => {
  const outcome = resolveCateringCloseoutItemSave(item(), { state: "pending", expectedUpdatedAt: NOW.toISOString() }, LATER);
  assert.equal(outcome.kind, "save");
  assert.equal(cateringCloseoutIsClosed(open), false, "and the boundary does not stand in its way");
});

test("regressing a required item while CLOSED is refused, and the refusal names the remedy (2-5)", () => {
  // The resolver would otherwise write, which is exactly what the boundary exists to stop.
  const outcome = resolveCateringCloseoutItemSave(item(), { state: "pending", expectedUpdatedAt: NOW.toISOString() }, LATER);
  assert.equal(outcome.kind, "save", "this request WOULD change stored state");
  assert.equal(cateringCloseoutIsClosed(closed), true, "so the boundary refuses it");
  assert.equal(CATERING_CLOSEOUT_CLOSED_REFUSAL.status, 409);
  assert.ok(CATERING_CLOSEOUT_CLOSED_REFUSAL.message.includes("Reopen closeout"));
  assert.notEqual(CATERING_CLOSEOUT_CLOSED_REFUSAL.code, CATERING_CLOSEOUT_CONFLICT_REFUSAL.code, "a stable code of its own");
});

test("the refusal returns before any write, so the item and the closeout are both untouched (4-6)", () => {
  // Structural, because "nothing was written" is a property of the route's ordering: the boundary returns a bare
  // refusal, and every statement that persists anything sits after it.
  const boundaryAt = handler.indexOf("if (cateringCloseoutIsClosed(await closeoutRecord(tx, id))) return { kind: \"closed\" } as const;");
  assert.notEqual(boundaryAt, -1, "the boundary exists");
  for (const write of ["tx.update(cateringBookingCloseoutItems)", "tx.insert(cateringBookingCloseoutItems)"]) {
    assert.ok(handler.indexOf(write) > boundaryAt, `${write} is behind the boundary`);
  }
  // And it fabricates no reopen: nothing on this route touches the closeout record at all.
  assert.equal(handler.includes("tx.update(cateringBookingCloseout)"), false);
  assert.equal(handler.includes("tx.insert(cateringBookingCloseout)"), false);
  assert.equal(handler.includes("reopenCount"), false);
  assert.equal(handler.includes("lastReopenedAt"), false);
});

test("no activity and no notification are written by a refused -- or any -- checklist save (7-8)", () => {
  assert.equal(handler.includes("cateringBookingActivity"), false);
  assert.equal(handler.includes("notifications"), false);
  assert.equal(handler.includes("notifyCloseout"), false);
});

test("explicit reopen remains the only way back, and it is untouched (9)", () => {
  // The reopen route is the single mechanism; the checklist route neither performs nor duplicates it.
  const reopen = route.slice(route.indexOf('r.post("/bookings/:id/closeout/reopen"'));
  assert.ok(reopen.includes("resolveCateringCloseoutReopen"));
  assert.ok(reopen.includes("reopenCount: outcome.reopenCount"));
  assert.ok(reopen.includes('eventType: "booking_closeout_reopened"'));
  assert.equal((route.match(/reopenCount: outcome\.reopenCount/g) ?? []).length, 1, "exactly one reopening mechanism");
});

test("after a reopen the same checklist change succeeds again (10)", () => {
  // Reopening clears `closed_out_at`, so the boundary no longer stands and the resolver writes as normal.
  const reopened = { closedOutAt: null };
  assert.equal(cateringCloseoutIsClosed(reopened), false);
  assert.equal(resolveCateringCloseoutItemSave(item(), { state: "pending", expectedUpdatedAt: NOW.toISOString() }, LATER).kind, "save");
});

test("the contradictory state is now unreachable: closed_out can no longer hide regressed required work (11)", () => {
  // The derivation is unchanged and still lets `closedOut` dominate -- which is correct, and is precisely why the
  // route must not allow the combination to arise in the first place.
  const contradictory = cateringCloseoutFacts({
    booking: { status: "completed", completedAt: NOW },
    record: { closedOutAt: NOW, providerNotes: null },
    equipment: [], items: [{ itemKey: "equipment_return_confirmed", state: "pending" }],
    outstandingSharedRequirementCount: 0, sharedDocumentCount: 0, customerReviewExists: false,
  }, "provider");
  assert.ok(contradictory.unresolvedRequiredItemCount > 0);
  assert.equal(deriveCateringCloseoutState(contradictory, "provider"), "closed_out", "closed still dominates");
  // So the only defence is the write boundary, and it is the one the route now enforces.
  assert.equal(cateringCloseoutIsClosed({ closedOutAt: NOW }), true);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * P1: what the boundary deliberately does NOT block
 * ----------------------------------------------------------------------------------------------------------- */

test("an identical retry is answered before the boundary, so a lost response stays idempotent", () => {
  // Save committed, response lost, provider then closed out, original request retries. It asks for the state the
  // server already holds, so it writes nothing -- refusing it would turn a request that already succeeded into an
  // error the client would surface.
  const retry = resolveCateringCloseoutItemSave(item(), { state: "completed", expectedUpdatedAt: NOW.toISOString() }, LATER);
  assert.equal(retry.kind, "unchanged");
  const unchangedAt = handler.indexOf('if (outcome.kind === "unchanged")');
  const boundaryAt = handler.indexOf("if (cateringCloseoutIsClosed(");
  assert.ok(unchangedAt !== -1 && unchangedAt < boundaryAt, "the write-nothing answer comes first");
});

test("a would-write request that is ALSO stale is refused as closed, not as a conflict", () => {
  // Both refusals are true, and the closed one names the action that has to happen either way.
  const stale = resolveCateringCloseoutItemSave(item({ updatedAt: LATER }), { state: "pending", expectedUpdatedAt: NOW.toISOString() }, LATER);
  assert.equal(stale.kind, "conflict");
  const boundaryAt = handler.indexOf("if (cateringCloseoutIsClosed(");
  const conflictAt = handler.indexOf('if (outcome.kind === "conflict")');
  assert.ok(boundaryAt < conflictAt, "the structural gate is reported before the precondition");
});

test("a genuinely stale change on an OPEN closeout still conflicts", () => {
  assert.equal(resolveCateringCloseoutItemSave(item({ updatedAt: LATER }), { state: "pending", expectedUpdatedAt: NOW.toISOString() }, LATER).kind, "conflict");
  assert.equal(cateringCloseoutIsClosed(open), false);
});

test("provider-private notes stay editable after closeout, and provably cannot affect operational truth", () => {
  // The notes route carries no boundary, by design...
  const notes = route.slice(route.indexOf('r.put("/bookings/:id/closeout/notes"'), route.indexOf("async function notifyCloseout"));
  assert.equal(notes.includes("cateringCloseoutIsClosed"), false);
  // ...because `hasProviderNotes` is read only on a branch `closedOut` returns before.
  const withNotes = cateringCloseoutFacts({
    booking: { status: "completed", completedAt: NOW }, record: { closedOutAt: NOW, providerNotes: "written after closing" },
    equipment: [], items: [], outstandingSharedRequirementCount: 0, sharedDocumentCount: 0, customerReviewExists: false,
  }, "provider");
  const withoutNotes = { ...withNotes, hasProviderNotes: false };
  assert.equal(withNotes.hasProviderNotes, true);
  assert.equal(deriveCateringCloseoutState(withNotes, "provider"), deriveCateringCloseoutState(withoutNotes, "provider"));
  assert.equal(deriveCateringCloseoutState(withNotes, "provider"), "closed_out");
  // And a customer receives neither the text nor this record's version, so nothing they can observe moves either.
  assert.equal(deriveCateringCloseoutState({ ...withNotes, hasProviderNotes: false }, "customer"), deriveCateringCloseoutState(withNotes, "customer"));
});

/* ----------------------------------------------------------------------------------------------------------- *
 * P2: the response snapshot
 * ----------------------------------------------------------------------------------------------------------- */

test("the checklist returned by a save is captured INSIDE the transaction, under the lock", () => {
  // Both outcomes that answer with a checklist capture it with `tx`, before commit releases the advisory lock.
  assert.equal((handler.match(/checklist: await closeoutItems\(tx, id\)/g) ?? []).length, 2, "the saved and unchanged paths both capture under the lock");
  assert.ok(handler.includes("res.json({ checklist: serializeCloseoutChecklist(result.checklist) })"));
});

test("no authoritative response read happens after the lock is released", () => {
  // The post-commit re-read is gone: nothing after the transaction queries the checklist again.
  assert.equal(handler.includes("closeoutItems(db, id)"), false);
  const afterTransaction = handler.slice(handler.indexOf('if (result.kind === "not_available")'));
  assert.equal(/await\s+\w+\(db,/.test(afterTransaction), false, "nothing is re-read from the pool for the response");
});

test("the capture happens after the write it describes, so it reflects this request", () => {
  const savedBranch = handler.slice(handler.indexOf("const [saved] = row"));
  const captureAt = savedBranch.indexOf("checklist: await closeoutItems(tx, id)");
  assert.notEqual(captureAt, -1);
  assert.ok(savedBranch.indexOf("tx.insert(cateringBookingCloseoutItems)") < captureAt, "the write precedes the snapshot");
});

test("another tab cannot inject its later version into this response", () => {
  // The lock is taken before anything is read and held until commit, so no other closeout write for this booking
  // can interleave between this request's write and its snapshot.
  const lockAt = handler.indexOf("await lockCloseout(tx, id);");
  const captureAt = handler.lastIndexOf("checklist: await closeoutItems(tx, id)");
  assert.notEqual(lockAt, -1);
  assert.ok(lockAt < captureAt, "the snapshot is taken while the lock is held");
  // And the lock is per booking, so it serializes exactly the writers that could interfere.
  assert.ok(route.includes("pg_advisory_xact_lock(hashtext(${`catering-closeout:${bookingId}`}))"));
});

test("the client contract is unchanged: the response is still a full checklist", () => {
  // The smallest change that fixes the race -- the shape the client reconciles from is identical.
  assert.ok(handler.includes("res.json({ checklist: serializeCloseoutChecklist("));
  assert.equal(handler.includes("res.json({ item:"), false, "no narrowed row-only contract was introduced");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * P2: the same-class audit
 * ----------------------------------------------------------------------------------------------------------- */

test("notes, complete and reopen already answer from a row captured inside their transaction", () => {
  for (const marker of ['r.put("/bookings/:id/closeout/notes"', 'r.post("/bookings/:id/closeout/complete"', 'r.post("/bookings/:id/closeout/reopen"']) {
    const start = route.indexOf(marker);
    assert.notEqual(start, -1, marker);
    const body = route.slice(start, route.indexOf("} catch (error) { invalid(error, res, next); } });", start));
    // Each serializes `result.record`, which is what `.returning()` produced under the lock -- or, on the settled
    // branches, the row read under it. None re-reads after the commit, so none needed changing.
    assert.ok(body.includes("serializeCloseoutRecord(result.record"), marker);
    assert.equal(body.includes("closeoutRecord(db, id)"), false, `${marker} must not re-read after commit`);
    assert.equal(body.includes("closeoutItems(db, id)"), false, marker);
  }
});

test("the cohesive read is unaffected: it is a read, not a mutation response", () => {
  const read = route.slice(route.indexOf('r.get("/bookings/:id/closeout"'), route.indexOf('r.put("/bookings/:id/closeout/items/:itemKey"'));
  assert.ok(read.includes("closeoutRecord(db, id)"), "it legitimately reads from the pool");
  for (const write of [".insert(", ".update(", ".delete("]) assert.equal(read.includes(write), false, read.slice(0, 0) + write);
});
