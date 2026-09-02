import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_BOOKING_THREAD_CODE } from "@shared/catering-booking-communication";

/**
 * The generic-DM bypass regression suite.
 *
 * A DM thread linked to a catering booking must not be reachable through the ordinary DM API. Those routes
 * authorize on `dm_participants` membership alone: they know nothing about the persisted booking participants and
 * nothing about the booking lifecycle, so reaching a booking thread through one of them would send after
 * cancellation or completion, mutate a booking conversation's read state or membership, and let a client-supplied
 * thread id stand in for booking authority.
 *
 * There is no database harness in this suite, so the guarantee is asserted structurally against the route module
 * itself: every generic handler that addresses a thread by id must consult the booking link, after its own
 * membership check, and the generic 1:1 reuse and thread listing must exclude booking-linked threads. A regression
 * -- a new generic thread route, or a guard removed from an existing one -- fails here rather than shipping.
 */
const dmSource = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "dm.ts"), "utf8");
const GUARD = "refuseBookingLinkedThread(id, res)";

/** Each generic handler that takes a thread id, as `<method> <path>` plus the body of its handler. */
function threadHandlers(): { signature: string; body: string }[] {
  const handlers: { signature: string; body: string }[] = [];
  const pattern = /r\.(get|post|put|patch|delete)\("(\/threads\/:id[^"]*)"[\s\S]*?\n\}\);/g;
  for (const match of dmSource.matchAll(pattern)) handlers.push({ signature: `${match[1].toUpperCase()} ${match[2]}`, body: match[0] });
  return handlers;
}

test("the generic DM module actually exposes thread-scoped routes, so this suite is inspecting something", () => {
  const signatures = threadHandlers().map((handler) => handler.signature);
  assert.equal(signatures.length >= 4, true, `expected several thread routes, found ${signatures.join(", ")}`);
  // The two mutation routes the bypass would have used are present and therefore covered below.
  assert.equal(signatures.includes("POST /threads/:id/messages"), true);
  assert.equal(signatures.includes("POST /threads/:id/read"), true);
});

test("every generic thread route refuses a booking-linked thread", () => {
  for (const handler of threadHandlers()) {
    assert.equal(handler.body.includes(GUARD), true, `${handler.signature} does not consult the booking link`);
  }
});

test("a generic send cannot reach a booking conversation, so it can never send after cancellation or completion", () => {
  const send = threadHandlers().find((handler) => handler.signature === "POST /threads/:id/messages");
  assert.notEqual(send, undefined);
  assert.equal(send!.body.includes(GUARD), true);
  // The refusal happens before anything is written, so no message row can exist by the time it answers.
  assert.equal(send!.body.indexOf(GUARD) < send!.body.indexOf(".insert(dmMessages)"), true);
});

test("a generic read-state write cannot mutate a booking conversation's participant row", () => {
  const read = threadHandlers().find((handler) => handler.signature === "POST /threads/:id/read");
  assert.notEqual(read, undefined);
  assert.equal(read!.body.includes(GUARD), true);
  assert.equal(read!.body.indexOf(GUARD) < read!.body.indexOf(".update(dmParticipants)"), true);
});

test("the guard runs after each route's own membership check, so a stranger learns nothing from the refusal", () => {
  const membership = `if (member.length === 0) return res.status(403).json({ ok: false, error: "forbidden" });`;
  for (const handler of threadHandlers()) {
    const membershipAt = handler.body.indexOf(membership);
    assert.notEqual(membershipAt, -1, `${handler.signature} has no membership check`);
    // A guessed thread id gets the same uniform 403 whether or not it belongs to a booking.
    assert.equal(membershipAt < handler.body.indexOf(GUARD), true, `${handler.signature} refuses before checking membership`);
  }
});

test("generic 1:1 reuse never adopts a booking conversation as the pair's ordinary thread", () => {
  const create = dmSource.slice(dmSource.indexOf(`r.post("/threads"`));
  assert.equal(create.includes("bookingLinkedThreadIds(candidates)"), true);
  // The reused thread is chosen from the candidates that are NOT booking-linked.
  assert.equal(create.includes("candidates.find((id: string) => !linked.has(id))"), true);
});

test("booking conversations never appear in the generic thread listing", () => {
  const listing = dmSource.slice(dmSource.indexOf(`r.get("/threads"`), dmSource.indexOf(`r.get("/threads/:id"`));
  assert.equal(listing.includes("bookingLinkedThreadIds(participantThreadIds)"), true);
  assert.equal(listing.includes("participantThreadIds.filter((id: string) => !linkedIds.has(id))"), true);
});

test("there is no generic route that could add, remove or re-role a booking thread's participants", () => {
  // The generic API writes dm_participants in exactly three places: the participant rows of a thread it is itself
  // creating, and the two read-marker updates, both inside routes the guard above already covers. There is no add,
  // remove or role-change route at all, so a booking conversation's membership cannot be broadened through it.
  const participantWrites = [...dmSource.matchAll(/\.(insert|update|delete)\(dmParticipants\)/g)].map((match) => match[1]);
  assert.deepEqual(participantWrites, ["insert", "update", "update"], "a new generic dm_participants write needs its own booking-link guard and a test here");
  // The only insert belongs to thread creation, which builds a brand-new thread and can never touch a linked one.
  const create = dmSource.slice(dmSource.indexOf(`r.post("/threads"`));
  assert.equal(create.includes(".insert(dmParticipants)"), true);
  // Nothing anywhere updates or deletes an existing thread row, so none can be retitled or converted to a group.
  assert.equal(/\.(update|delete)\(dmThreads\)/.test(dmSource), false, "no generic route may mutate an existing thread");
});

test("the refusal carries the code the client routes into the booking workspace on", () => {
  assert.equal(dmSource.includes("CATERING_BOOKING_THREAD_CODE"), true);
  assert.equal(CATERING_BOOKING_THREAD_CODE, "catering_booking_thread");
});

test("ordinary DMs are untouched: the guard only ever fires for a thread with a booking link", () => {
  const guard = dmSource.slice(dmSource.indexOf("async function refuseBookingLinkedThread"), dmSource.indexOf(`r.get("/threads"`));
  // A thread with no booking link returns false, and the handler carries on into the ordinary generic behaviour.
  assert.equal(guard.includes("if (!linked) return false;"), true);
});
