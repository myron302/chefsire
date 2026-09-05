import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";
import { CATERING_UNREAD_COUNT_CEILING } from "@shared/catering-booking-communication";
import { CATERING_COMMUNICATION_READ_ONLY_REFUSAL, CATERING_MESSAGE_SEND_REFUSALS, CATERING_NOTIFICATION_FAILURE_ROLLS_BACK_SEND, boundedCount, boundedUnreadCount, cateringCommunicationGuard, cateringConversationParticipants, cateringCounterpart, cateringFilePageFrom, cateringMessagePageFrom, cateringReadMarkerAdvances, cateringUnreadBoundary, conversationMembershipMatchesBooking, isAfterCateringReadBoundary, resolveCateringMessageSend, resolveCateringReadMarker, shouldNotifyBookingMessage } from "./catering-booking-communication-policy";

const BOOKING = { providerId: "provider", customerId: "customer" };

test("conversation participants derive from the persisted booking only", () => {
  assert.deepEqual([...cateringConversationParticipants(BOOKING)], ["provider", "customer"]);
  // A booking whose two roles are the same account gets one participant row, never a duplicate.
  assert.deepEqual([...cateringConversationParticipants({ providerId: "same", customerId: "same" })], ["same"]);
});
test("a linked thread's membership is compared against booking truth, not trusted", () => {
  assert.equal(conversationMembershipMatchesBooking(["provider", "customer"], BOOKING), true);
  assert.equal(conversationMembershipMatchesBooking(["customer", "provider"], BOOKING), true);
  // A thread that gained a third member, lost one, or swapped one is no longer this booking's conversation.
  assert.equal(conversationMembershipMatchesBooking(["provider", "customer", "stranger"], BOOKING), false);
  assert.equal(conversationMembershipMatchesBooking(["provider"], BOOKING), false);
  assert.equal(conversationMembershipMatchesBooking(["provider", "stranger"], BOOKING), false);
  assert.equal(conversationMembershipMatchesBooking([], BOOKING), false);
});
test("the counterpart is derived from the booking and is never the actor", () => {
  assert.equal(cateringCounterpart(BOOKING, "provider"), "customer");
  assert.equal(cateringCounterpart(BOOKING, "customer"), "provider");
  assert.equal(cateringCounterpart(BOOKING, "stranger"), null);
  assert.equal(cateringCounterpart({ providerId: "same", customerId: "same" }, "same"), null);
});
test("a booking that goes terminal under the send lock refuses with the canonical read-only code", () => {
  assert.equal(resolveCateringMessageSend({ active: true, memberIds: ["provider", "customer"] }, BOOKING).kind, "send");
  assert.equal(resolveCateringMessageSend({ active: false, memberIds: ["provider", "customer"] }, BOOKING).kind, "read_only");
  assert.equal(resolveCateringMessageSend(null, BOOKING).kind, "read_only");
  assert.equal(CATERING_MESSAGE_SEND_REFUSALS.read_only.code, CATERING_WORKSPACE_READ_ONLY_CODE);
  assert.equal(CATERING_COMMUNICATION_READ_ONLY_REFUSAL.code, CATERING_WORKSPACE_READ_ONLY_CODE);
  assert.equal(CATERING_COMMUNICATION_READ_ONLY_REFUSAL.status, 409);
});
test("a thread whose membership drifted from the booking refuses the send, distinctly from a closed booking", () => {
  assert.equal(resolveCateringMessageSend({ active: true, memberIds: ["provider", "customer", "stranger"] }, BOOKING).kind, "membership");
  assert.notEqual(CATERING_MESSAGE_SEND_REFUSALS.membership.code, CATERING_MESSAGE_SEND_REFUSALS.read_only.code);
});
test("the early communication guard tells a closed booking from a wrong actor", () => {
  assert.equal(cateringCommunicationGuard("confirmed", "provider"), "allowed");
  assert.equal(cateringCommunicationGuard("pending_confirmation", "customer"), "allowed");
  assert.equal(cateringCommunicationGuard("cancelled", "provider"), "read_only");
  assert.equal(cateringCommunicationGuard("completed", "customer"), "read_only");
  assert.equal(cateringCommunicationGuard("confirmed", null), "forbidden");
  assert.equal(cateringCommunicationGuard("cancelled", null), "forbidden");
});
test("message pages are served newest-first and rendered oldest-first, with a boundary only when a row proves one", () => {
  // The route reads `limit + 1` rows. Here three rows come back for a two-message page, so the third is the
  // lookahead: it is the evidence an older message exists, and it is not part of the page.
  const read = [{ id: "c" }, { id: "b" }, { id: "a" }];
  const full = cateringMessagePageFrom(read, 2);
  assert.deepEqual(full.rows.map((row) => row.id), ["b", "c"]);
  // The boundary is the oldest message ACTUALLY RETURNED, so "load older" resumes strictly before it and the
  // lookahead row becomes the first row of the next page rather than one that is skipped or served twice.
  assert.equal(full.nextCursor, "b");
  // An exactly-full page with no lookahead behind it is the end of the conversation: no boundary is offered, so
  // the client stops instead of fetching a page that would come back empty.
  const exact = cateringMessagePageFrom(read, 3);
  assert.deepEqual(exact.rows.map((row) => row.id), ["a", "b", "c"]);
  assert.equal(exact.nextCursor, null);
  // A short page has nothing before it either.
  const short = cateringMessagePageFrom(read, 30);
  assert.deepEqual(short.rows.map((row) => row.id), ["a", "b", "c"]);
  assert.equal(short.nextCursor, null);
  assert.deepEqual(cateringMessagePageFrom([], 30), { rows: [], nextCursor: null });
  assert.deepEqual(cateringMessagePageFrom([], 0), { rows: [], nextCursor: null });
});
test("file pages keep newest-first order and derive the same style of boundary", () => {
  const read = [{ id: "c" }, { id: "b" }, { id: "a" }];
  assert.deepEqual(cateringFilePageFrom(read, 2), { rows: [{ id: "c" }, { id: "b" }], nextCursor: "b" });
  assert.deepEqual(cateringFilePageFrom(read, 3), { rows: read, nextCursor: null });
  assert.deepEqual(cateringFilePageFrom(read, 20).nextCursor, null);
});
test("a read marker is accepted only when the message belongs to this booking conversation", () => {
  assert.deepEqual(resolveCateringReadMarker("m1", { id: "m9" }, true), { kind: "mark", messageId: "m1" });
  // A message id from another thread is refused rather than silently becoming this booking's marker.
  assert.deepEqual(resolveCateringReadMarker("foreign", { id: "m9" }, false), { kind: "foreign_message" });
  // With no id, the marker is the conversation's own latest message.
  assert.deepEqual(resolveCateringReadMarker(undefined, { id: "m9" }, false), { kind: "mark", messageId: "m9" });
  assert.deepEqual(resolveCateringReadMarker(undefined, undefined, false), { kind: "empty" });
});
test("unread and file counts are bounded and report their ceiling truthfully", () => {
  assert.deepEqual(boundedUnreadCount(3), { count: 3, capped: false });
  assert.deepEqual(boundedUnreadCount(CATERING_UNREAD_COUNT_CEILING), { count: CATERING_UNREAD_COUNT_CEILING, capped: false });
  assert.deepEqual(boundedUnreadCount(CATERING_UNREAD_COUNT_CEILING + 1), { count: CATERING_UNREAD_COUNT_CEILING, capped: true });
  assert.deepEqual(boundedCount(1000, 999), { count: 999, capped: true });
  assert.deepEqual(boundedCount(0, 999), { count: 0, capped: false });
});
test("an existing DM mute is honoured for booking messages, and a missing counterpart notifies nobody", () => {
  assert.equal(shouldNotifyBookingMessage("customer", false), true);
  assert.equal(shouldNotifyBookingMessage("customer", true), false);
  assert.equal(shouldNotifyBookingMessage(null, false), false);
});
test("a notification that fails never rolls back a message that already persisted", () => {
  assert.equal(CATERING_NOTIFICATION_FAILURE_ROLLS_BACK_SEND, false);
});

const AT = (iso: string) => new Date(iso);
const T = "2026-09-01T12:00:00.000Z";

test("the unread boundary is the marker message, not a wall-clock timestamp", () => {
  assert.deepEqual(cateringUnreadBoundary({ lastReadMessageId: "m10", lastReadAt: AT(T) }, true), { kind: "after_message", messageId: "m10" });
  // A participant who has never read anything counts every message from the other side.
  assert.deepEqual(cateringUnreadBoundary({ lastReadMessageId: null, lastReadAt: null }, false), { kind: "all" });
  assert.deepEqual(cateringUnreadBoundary(undefined, false), { kind: "all" });
});
test("a marker that is not a message of this thread falls back rather than silently counting nothing", () => {
  // The generic DM read route can leave a lastReadAt with no usable marker; such a row still counts sensibly.
  assert.deepEqual(cateringUnreadBoundary({ lastReadMessageId: "from-another-thread", lastReadAt: AT(T) }, false), { kind: "after_timestamp", since: AT(T) });
  assert.deepEqual(cateringUnreadBoundary({ lastReadMessageId: null, lastReadAt: AT(T) }, false), { kind: "after_timestamp", since: AT(T) });
});
test("a message sent after the marker stays unread, including one that arrives during the marking", () => {
  const boundary = { createdAt: AT(T), id: "m10" };
  // M11 exists, or lands, after M10; marking M10 read must leave it unread.
  assert.equal(isAfterCateringReadBoundary({ createdAt: AT("2026-09-01T12:00:01.000Z"), id: "m11" }, boundary), true);
  // The marker message itself is read, and anything before it stays read.
  assert.equal(isAfterCateringReadBoundary({ createdAt: AT(T), id: "m10" }, boundary), false);
  assert.equal(isAfterCateringReadBoundary({ createdAt: AT("2026-09-01T11:59:59.000Z"), id: "m09" }, boundary), false);
});
test("marking an older message deliberately leaves every newer message unread", () => {
  // The caller marked M09; M10 and M11 are both still unread, which a wall-clock boundary would have hidden.
  const older = { createdAt: AT("2026-09-01T11:00:00.000Z"), id: "m09" };
  assert.equal(isAfterCateringReadBoundary({ createdAt: AT(T), id: "m10" }, older), true);
  assert.equal(isAfterCateringReadBoundary({ createdAt: AT("2026-09-01T13:00:00.000Z"), id: "m11" }, older), true);
});
test("two messages sharing a created_at are separated by id, exactly as pagination orders them", () => {
  const boundary = { createdAt: AT(T), id: "id-a" };
  // M11 shares M10's timestamp to the millisecond but sorts after it; marking M10 read must not mark M11.
  assert.equal(isAfterCateringReadBoundary({ createdAt: AT(T), id: "id-b" }, boundary), true);
  // And the one that sorts before it stays read, so the pair is a total order rather than a tie.
  assert.equal(isAfterCateringReadBoundary({ createdAt: AT(T), id: "id-A" }, boundary), false);
  assert.equal(isAfterCateringReadBoundary({ createdAt: AT(T), id: "id-a" }, boundary), false);
});

const M = (id: string, iso = T) => ({ id, createdAt: AT(iso) });

test("a participant with no marker yet is established by any valid message of the conversation", () => {
  assert.equal(cateringReadMarkerAdvances(M("m10"), null), true);
});
test("a read marker advances forward and refuses to move backward", () => {
  const older = M("m10", "2026-09-01T11:00:00.000Z");
  const newer = M("m20", "2026-09-01T12:00:00.000Z");
  assert.equal(cateringReadMarkerAdvances(newer, older), true);
  // The stale second tab: it marked an older message, and the row must stay where it is.
  assert.equal(cateringReadMarkerAdvances(older, newer), false);
});
test("marking the same message again is a no-op rather than a write", () => {
  assert.equal(cateringReadMarkerAdvances(M("m10"), M("m10")), false);
});
test("equal timestamps advance or hold by id, matching pagination and unread ordering", () => {
  // M11 shares M10's instant but sorts after it, so it advances; the reverse request does not regress.
  assert.equal(cateringReadMarkerAdvances(M("id-b"), M("id-a")), true);
  assert.equal(cateringReadMarkerAdvances(M("id-a"), M("id-b")), false);
});
test("two tabs marking out of order leave the marker at the newest message", () => {
  const marks = [M("m20", "2026-09-01T12:00:00.000Z"), M("m15", "2026-09-01T11:30:00.000Z"), M("m18", "2026-09-01T11:45:00.000Z")];
  // Applied in the order the tabs happen to arrive, the marker only ever ends up at the furthest one.
  let current: { createdAt: Date; id: string } | null = null;
  for (const mark of marks) if (cateringReadMarkerAdvances(mark, current)) current = mark;
  assert.equal(current?.id, "m20");
});
test("a concurrent interleaving of marks is monotonic whatever order they land in", () => {
  const marks = [M("m12", "2026-09-01T11:10:00.000Z"), M("m20", "2026-09-01T12:00:00.000Z"), M("m15", "2026-09-01T11:30:00.000Z"), M("m20", "2026-09-01T12:00:00.000Z")];
  for (const permutation of [marks, [...marks].reverse(), [marks[2], marks[0], marks[1], marks[3]]]) {
    let current: { createdAt: Date; id: string } | null = null;
    for (const mark of permutation) if (cateringReadMarkerAdvances(mark, current)) current = mark;
    assert.equal(current?.id, "m20");
  }
});
test("a stale mark cannot make an already-read message unread again", () => {
  const newer = M("m20", "2026-09-01T12:00:00.000Z");
  const stale = M("m15", "2026-09-01T11:30:00.000Z");
  // The marker holds at m20, so m16-m20 stay read: unread cannot grow because of a stale request.
  assert.equal(cateringReadMarkerAdvances(stale, newer), false);
  assert.equal(isAfterCateringReadBoundary(M("m18", "2026-09-01T11:45:00.000Z"), newer), false);
});
test("an explicit old marker still leaves newer unseen messages unread when it is the only marker", () => {
  // Monotonicity does not undo the earlier fix: establishing an older boundary from nothing keeps newer unread.
  const older = M("m09", "2026-09-01T11:00:00.000Z");
  assert.equal(cateringReadMarkerAdvances(older, null), true);
  assert.equal(isAfterCateringReadBoundary(M("m10"), older), true);
});
