import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringUnreadBoundary, isAfterCateringReadBoundary } from "../services/catering-booking-communication-policy";

/**
 * The authoritative start of a participant's unread range.
 *
 * `unreadMessageCount` is bounded at a ceiling and reports `capped` beyond it, which makes it a LOWER BOUND rather
 * than a total -- and a client cannot locate the start of a range whose size it does not know. A participant with
 * more than the ceiling's worth of backlog could load every page, read every message, and still never satisfy the
 * traversal requirement, so no read request was ever sent and the workspace stayed at "99+" forever.
 *
 * The list route now answers the question directly. There is no database harness in this suite, so the query's
 * shape is asserted structurally against the route and its ordering semantics behaviourally against the policy
 * functions the SQL mirrors -- as everywhere in Phase 2I.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-communication.ts"), "utf8");
const boundaryFn = route.slice(route.indexOf("async function unreadBoundaryCondition"), route.indexOf("export async function unreadMessageCount"));
const startFn = route.slice(route.indexOf("export async function unreadStartMessageId"), route.indexOf("\n}\n", route.indexOf("export async function unreadStartMessageId")));
const listRoute = route.slice(route.indexOf(`r.get("/bookings/:id/messages"`), route.indexOf("* Advances one participant's read marker"));

test("the count and the start share ONE boundary derivation, so they cannot describe different ranges", () => {
  // Both call the same helper rather than restating the predicate.
  assert.equal(route.includes("const after = await unreadBoundaryCondition(threadId, userId);"), true);
  assert.equal((route.match(/await unreadBoundaryCondition\(threadId, userId\)/g) ?? []).length, 2);
  assert.equal(boundaryFn.includes("cateringUnreadBoundary(participant, markerIsInThread)"), true);
  // And only one place still builds the SQL comparison.
  assert.equal((route.match(/SELECT b\.created_at, b\.id FROM dm_messages b/g) ?? []).length, 1);
});

test("it is scoped to the authenticated actor and this booking's own thread", () => {
  assert.equal(startFn.includes("eq(dmMessages.threadId, threadId)"), true);
  assert.equal(startFn.includes("ne(dmMessages.senderId, userId)"), true);
  // The thread is derived from the booking, never supplied, and the booking from the actor's own ownership.
  assert.equal(listRoute.includes("const booking = await ownedCateringBooking(id, userId);"), true);
  assert.equal(listRoute.includes("const threadId = await findBookingConversation(id);"), true);
  assert.equal(listRoute.includes("const unreadStartId = await unreadStartMessageId(threadId, userId);"), true);
  // `userId` is the authenticated session's, so a caller cannot ask about anyone else.
  assert.equal(listRoute.includes("const userId = (req.user as { id: string }).id;"), true);
});

test("the actor's own messages can never be the boundary", () => {
  // The same exclusion the count uses, so a participant is never asked to 'traverse' something they wrote.
  assert.equal(startFn.includes("ne(dmMessages.senderId, userId)"), true);
  const countFn = route.slice(route.indexOf("export async function unreadMessageCount"), route.indexOf("export async function unreadStartMessageId"));
  assert.equal(countFn.includes("ne(dmMessages.senderId, userId)"), true);
});

test("no other participant's read state is read or returned", () => {
  // The boundary comes from THIS actor's participant row alone; nothing selects a counterpart's marker.
  assert.equal(boundaryFn.includes("conversationParticipant(threadId, userId)"), true);
  assert.equal(startFn.includes("conversationParticipant"), false);
  // The response carries only the id -- no marker, no timestamp, nothing about anyone else.
  assert.equal(listRoute.includes("nextCursor, editable, unreadStartId }"), true);
  assert.equal(listRoute.includes("lastReadMessageId"), false);
  assert.equal(listRoute.includes("lastReadAt"), false);
});

test("it is null when nothing is unread, including for a conversation that does not exist yet", () => {
  assert.equal(startFn.includes("return row?.id ?? null;"), true);
  assert.equal(listRoute.includes("res.json({ messages: [], nextCursor: null, editable, unreadStartId: null });"), true);
});

test("ordering is ascending on the same (created_at, id) pair, so a tie is broken by id", () => {
  assert.equal(startFn.includes("orderBy(asc(dmMessages.createdAt), asc(dmMessages.id))"), true);
  assert.equal(startFn.includes(".limit(1)"), true);
  // The pair semantics the SQL mirrors: equal timestamps are separated by id, in both directions.
  const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
  assert.equal(isAfterCateringReadBoundary({ id: "b", createdAt: at(10) }, { id: "a", createdAt: at(10) }), true);
  assert.equal(isAfterCateringReadBoundary({ id: "a", createdAt: at(10) }, { id: "b", createdAt: at(10) }), false);
  assert.equal(isAfterCateringReadBoundary({ id: "a", createdAt: at(11) }, { id: "z", createdAt: at(10) }), true);
});

test("it is never capped, which is the whole point", () => {
  // The count reads ceiling+1 rows and reports a bound; the start reads exactly one and reports a fact.
  const countFn = route.slice(route.indexOf("export async function unreadMessageCount"), route.indexOf("export async function unreadStartMessageId"));
  assert.equal(countFn.includes("CATERING_UNREAD_COUNT_CEILING + 1"), true);
  assert.equal(startFn.includes("CEILING"), false);
  assert.equal(startFn.includes("boundedUnreadCount"), false);
});

test("it works the same whether the count is capped or not, because it does not consult the count", () => {
  assert.equal(startFn.includes("unreadMessageCount"), false);
  assert.equal(startFn.includes("capped"), false);
  // And the marker fallback for a row carrying a timestamp but no message id is the shared one.
  assert.deepEqual(cateringUnreadBoundary({ lastReadMessageId: null, lastReadAt: null }, false), { kind: "all" });
  assert.deepEqual(cateringUnreadBoundary({ lastReadMessageId: "m1", lastReadAt: null }, true), { kind: "after_message", messageId: "m1" });
  const since = new Date(Date.UTC(2026, 0, 1));
  assert.deepEqual(cateringUnreadBoundary({ lastReadMessageId: "gone", lastReadAt: since }, false), { kind: "after_timestamp", since });
});

test("reading the list still marks nothing read: this is a report, not a mutation", () => {
  assert.equal(listRoute.includes("advanceReadMarker"), false);
  assert.equal(listRoute.includes(".update(dmParticipants)"), false);
  assert.equal(listRoute.includes(".insert("), false);
});
