import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringReadMarkerAdvances, cateringUnreadBoundary, isAfterCateringReadBoundary } from "../services/catering-booking-communication-policy";

/**
 * The booking read-state contract.
 *
 * A booking message becomes read for an actor only when it is INCOMING, its boundary has actually been rendered,
 * and the explicit read API advances that actor's forward-only marker on the strength of that evidence. Nothing
 * else may imply read: not fetching a message, not loading the workspace, not sending a reply, not having the
 * component mounted, not a message sitting below the fold, and not a message that is not even loaded.
 *
 * The regression this suite exists for: the send path used to advance the sender's own marker to the message they
 * had just written. A customer with five unread provider messages, sitting at the top of the thread, who typed a
 * reply had all five swept behind the boundary -- reported read, never seen. And it bought nothing, because the
 * unread query already excludes the actor's own messages.
 *
 * There is no database harness in this suite, so the route-level guarantees are asserted structurally against the
 * route source, as elsewhere in Phase 2I; the ordering and monotonicity semantics are exercised behaviourally
 * against the policy functions the SQL mirrors.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-communication.ts"), "utf8");
const sendPath = route.slice(route.indexOf("async function persistBookingMessage"), route.indexOf(`r.post("/bookings/:id/messages"`));
const readRoute = route.slice(route.indexOf(`r.post("/bookings/:id/messages/read"`), route.indexOf("export async function unreadMessageCount"));
const unreadQuery = route.slice(route.indexOf("export async function unreadMessageCount"));

/** The unread query in miniature: later than the boundary AND not sent by the actor. */
function unreadFor(messages: readonly { id: string; senderId: string; createdAt: Date }[], actorId: string, boundary: { createdAt: Date; id: string } | null): string[] {
  return messages
    .filter((message) => message.senderId !== actorId)
    .filter((message) => boundary === null || isAfterCateringReadBoundary(message, boundary))
    .map((message) => message.id);
}
const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
const PROVIDER = "provider-1";
const CUSTOMER = "customer-1";

test("A. sending a message leaves the incoming unread count exactly as it was", () => {
  // Five provider messages the customer has never scrolled to, and no marker at all.
  const incoming = [1, 2, 3, 4, 5].map((n) => ({ id: `m${n}`, senderId: PROVIDER, createdAt: at(n) }));
  assert.deepEqual(unreadFor(incoming, CUSTOMER, null), ["m1", "m2", "m3", "m4", "m5"]);
  // The customer types a reply. Under the old behaviour the marker advanced to m6 and every provider message fell
  // behind it; now the send writes no marker, so the boundary is still null.
  const afterSend = [...incoming, { id: "m6", senderId: CUSTOMER, createdAt: at(6) }];
  assert.deepEqual(unreadFor(afterSend, CUSTOMER, null), ["m1", "m2", "m3", "m4", "m5"], "sending must not clear unseen incoming messages");
  // What the bug did, stated explicitly, so its return would fail here.
  assert.deepEqual(unreadFor(afterSend, CUSTOMER, { id: "m6", createdAt: at(6) }), []);
});

test("A. the send transaction contains no read-marker write of any kind", () => {
  assert.equal(sendPath.includes("advanceReadMarker"), false, "sending must not advance a read marker");
  assert.equal(sendPath.includes("last_read"), false);
  assert.equal(sendPath.includes("lastRead"), false);
  assert.equal(sendPath.includes("dmParticipants"), false, "the send path must not write a participant row at all");
  // It still does everything it did before: the booking lock, the lazy conversation, the message and the ledger.
  for (const kept of ["lockActiveCateringBooking(tx, bookingId)", "ensureBookingConversation(tx, booking)", ".insert(dmMessages)", "cateringBookingMessageRequests"]) {
    assert.equal(sendPath.includes(kept), true, kept);
  }
});

test("B. an actor's own messages never count towards their own unread total", () => {
  const mixed = [
    { id: "m1", senderId: PROVIDER, createdAt: at(1) },
    { id: "m2", senderId: CUSTOMER, createdAt: at(2) },
    { id: "m3", senderId: CUSTOMER, createdAt: at(3) },
    { id: "m4", senderId: PROVIDER, createdAt: at(4) },
    { id: "m5", senderId: CUSTOMER, createdAt: at(5) },
  ];
  // Three outgoing messages in a row change nothing, and the two incoming ones remain unread.
  assert.deepEqual(unreadFor(mixed, CUSTOMER, null), ["m1", "m4"]);
  // The counterpart sees the mirror image, which is what makes the exclusion the sender's own rather than a role's.
  assert.deepEqual(unreadFor(mixed, PROVIDER, null), ["m2", "m3", "m5"]);
  // And the exclusion is in the query itself, not a consequence of the marker.
  assert.equal(unreadQuery.includes("ne(dmMessages.senderId, userId)"), true);
});

test("B. the exclusion is what makes advancing on send pointless as well as wrong", () => {
  // The reason the removal costs nothing: an outgoing message is already invisible to its own sender's count, so
  // the marker was never doing any work for it.
  const outgoing = [{ id: "m1", senderId: CUSTOMER, createdAt: at(1) }];
  assert.deepEqual(unreadFor(outgoing, CUSTOMER, null), []);
  assert.deepEqual(unreadFor(outgoing, CUSTOMER, { id: "m1", createdAt: at(1) }), []);
});

test("C. the explicit read route is the only path that advances the marker", () => {
  assert.equal((route.match(/await advanceReadMarker\(/g) ?? []).length, 1);
  assert.equal(readRoute.includes("await advanceReadMarker(db, threadId, userId, marker.messageId)"), true);
  // It advances to the SELECTED message, re-validated as a message of this booking's own conversation.
  assert.equal(readRoute.includes("messageInThread(threadId, input.lastReadMessageId)"), true);
  assert.equal(readRoute.includes(`marker.kind === "foreign_message"`), true);
  // And it reports the authoritative marker back rather than the one it was asked for.
  assert.equal(readRoute.includes("lastReadMessageId: current?.lastReadMessageId ?? null"), true);
});

test("C. no other route or helper writes booking read state implicitly", () => {
  // The whole module: no unconditional participant write, and no wall-clock inferred read anywhere.
  assert.equal(route.includes(".update(dmParticipants)"), false);
  assert.equal(route.includes("lastReadAt: new Date()"), false);
  assert.equal(route.includes("last_read_at = now()"), false);
  assert.equal(route.includes("last_read_at = NOW()"), false);
  // The marker is only ever copied from the boundary message's own stored created_at.
  assert.equal(route.includes("SET last_read_message_id = m.id, last_read_at = m.created_at"), true);
  // Reading a page and listing messages take no write path at all.
  // Sliced to the handler alone: `advanceReadMarker` is DEFINED between the two routes, so ending this slice at the
  // next `r.post` would sweep the definition in and assert nothing.
  const listRoute = route.slice(route.indexOf(`r.get("/bookings/:id/messages"`), route.indexOf("* Advances one participant's read marker"));
  assert.equal(listRoute.includes("advanceReadMarker"), false, "fetching messages must not imply reading them");
  assert.equal(listRoute.includes("lastRead"), false);
});

test("D. the marker remains forward-only, and an equal timestamp is decided by id", () => {
  const current = { id: "m10", createdAt: at(10) };
  // Later advances; earlier and identical do not.
  assert.equal(cateringReadMarkerAdvances({ id: "m11", createdAt: at(11) }, current), true);
  assert.equal(cateringReadMarkerAdvances({ id: "m9", createdAt: at(9) }, current), false);
  assert.equal(cateringReadMarkerAdvances(current, current), false, "marking the same message twice is a no-op");
  // A second tab with a stale view cannot regress the row and resurrect m11-m20 as unread.
  assert.equal(cateringReadMarkerAdvances({ id: "m5", createdAt: at(5) }, { id: "m20", createdAt: at(20) }), false);
  // Same microsecond: the id breaks the tie in both directions.
  assert.equal(cateringReadMarkerAdvances({ id: "b", createdAt: at(10) }, { id: "a", createdAt: at(10) }), true);
  assert.equal(cateringReadMarkerAdvances({ id: "a", createdAt: at(10) }, { id: "b", createdAt: at(10) }), false);
  // With no marker yet, any valid message of the conversation establishes one.
  assert.equal(cateringReadMarkerAdvances({ id: "m1", createdAt: at(1) }, null), true);
});

test("D. monotonicity is enforced by the statement's own WHERE clause, not by a read-then-write", () => {
  const advance = route.slice(route.indexOf("* Advances one participant's read marker"), route.indexOf("type BookingMessageSendResult"));
  assert.equal(advance.includes("(m.created_at, m.id) > (SELECT b.created_at, b.id FROM dm_messages AS b WHERE b.id = p.last_read_message_id)"), true);
  // The docstring names the single caller, so re-adding an implicit one is a visible contradiction.
  assert.equal(advance.includes("ONLY thing that advances a booking read marker"), true);
});

test("a participant row is created carrying no read state, so joining implies nothing", () => {
  const conversation = fs.readFileSync(path.join(here, "..", "services", "catering-booking-conversation.ts"), "utf8");
  const insert = conversation.slice(conversation.indexOf(".insert(dmParticipants)"), conversation.indexOf(".insert(dmParticipants)") + 200);
  assert.equal(insert.includes("lastRead"), false, "a new participant must start with no marker at all");
  // With no marker the boundary is "all", and the sender exclusion is what keeps an outgoing message uncounted.
  assert.deepEqual(cateringUnreadBoundary(undefined, false), { kind: "all" });
  assert.deepEqual(cateringUnreadBoundary({ lastReadMessageId: null, lastReadAt: null }, false), { kind: "all" });
});

test("terminal, idempotency and authorization behaviour on the send path is untouched", () => {
  // Removing the marker write must not have disturbed anything else the transaction decides.
  assert.equal(sendPath.includes(`if (!active) return { kind: "read_only" } as const;`), true);
  assert.equal(sendPath.includes("resolveCateringMessageSend({ active, memberIds: await conversationMemberIds(tx, threadId) }, booking)"), true);
  assert.equal(sendPath.includes("throw new DuplicateBookingMessage()"), true);
  assert.equal(sendPath.includes("if (error instanceof DuplicateBookingMessage) return { kind: \"duplicate\" };"), true);
  // The sender is still the authenticated actor and never anything from the request body.
  assert.equal(sendPath.includes("senderId: userId"), true);
  // Reading stays permitted on a historical conversation; only sending closes.
  assert.equal(readRoute.includes("Marking a historical conversation read is allowed"), true);
});
