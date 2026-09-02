import { CATERING_COMMUNICATION_READ_ONLY_MESSAGE, CATERING_UNREAD_COUNT_CEILING, mayPostCateringBookingMessage, mayReadCateringBookingMessages } from "@shared/catering-booking-communication";
import { CATERING_WORKSPACE_READ_ONLY_CODE, cateringWorkspaceRole } from "@shared/catering-booking-operations";
import type { CateringBookingStatus } from "@shared/catering-bookings";

export { cateringWorkspaceRole, mayPostCateringBookingMessage, mayReadCateringBookingMessages };

/**
 * A conversation that went cancelled or completed answers with the workspace's own canonical read-only code, so a
 * booking that was already terminal when the request arrived and one that became terminal under the send lock are
 * indistinguishable to the client: both mean the workspace on screen is stale, and both refuse the send.
 */
export const CATERING_COMMUNICATION_READ_ONLY_REFUSAL = { status: 409, message: CATERING_COMMUNICATION_READ_ONLY_MESSAGE, code: CATERING_WORKSPACE_READ_ONLY_CODE } as const;

/**
 * The two participants of a booking conversation, derived from the persisted booking and nothing else. Every caller
 * takes the pair from here rather than from a request body, so a forged providerId or customerId cannot become a
 * thread member and an existing thread's membership can be checked against the truth rather than trusted.
 */
export function cateringConversationParticipants(booking: { providerId: string; customerId: string }): readonly string[] {
  return booking.providerId === booking.customerId ? [booking.providerId] : [booking.providerId, booking.customerId];
}
/** Whether a linked thread's persisted membership still is exactly the booking's participants, and no one else. */
export function conversationMembershipMatchesBooking(memberIds: readonly string[], booking: { providerId: string; customerId: string }): boolean {
  const expected = new Set(cateringConversationParticipants(booking));
  const actual = new Set(memberIds);
  return actual.size === expected.size && Array.from(expected).every((id) => actual.has(id));
}
/** The other booking participant, who a message or shared file notifies. Never read from the request. */
export function cateringCounterpart(booking: { providerId: string; customerId: string }, actorId: string): string | null {
  if (actorId === booking.providerId && booking.customerId !== actorId) return booking.customerId;
  if (actorId === booking.customerId && booking.providerId !== actorId) return booking.providerId;
  return null;
}

/**
 * Resolves a locked send. A booking that went terminal under the lock refuses, and so does a linked thread whose
 * membership no longer matches the persisted booking: rather than delivering a booking message into a thread that
 * gained or lost a member, the send stops. Only "send" writes a message.
 */
export function resolveCateringMessageSend(locked: { active: boolean; memberIds: readonly string[] } | null, booking: { providerId: string; customerId: string }) {
  if (!locked || !locked.active) return { kind: "read_only" } as const;
  if (!conversationMembershipMatchesBooking(locked.memberIds, booking)) return { kind: "membership" } as const;
  return { kind: "send" } as const;
}
export const CATERING_MESSAGE_SEND_REFUSALS = {
  read_only: { message: CATERING_COMMUNICATION_READ_ONLY_MESSAGE, code: CATERING_WORKSPACE_READ_ONLY_CODE },
  membership: { message: "This booking conversation is not in a consistent state and cannot accept messages", code: "catering_conversation_membership" },
} as const;

/**
 * A bounded unread count. The query counts at most one more row than the ceiling, so a very long unread backlog
 * costs the same as a short one, and the workspace renders "99+" rather than claiming a total it never counted.
 */
export function boundedUnreadCount(counted: number): { count: number; capped: boolean } {
  return counted > CATERING_UNREAD_COUNT_CEILING ? { count: CATERING_UNREAD_COUNT_CEILING, capped: true } : { count: counted, capped: false };
}
export function boundedCount(counted: number, ceiling: number): { count: number; capped: boolean } {
  return counted > ceiling ? { count: ceiling, capped: true } : { count: counted, capped: false };
}

/**
 * How a message page is served. The server reads newest-first from the keyset boundary so "load older" is one bounded
 * query, and the page is reversed for display: the client always renders oldest-to-newest. `nextCursor` is the oldest
 * message in the page, and it is only offered when the page was actually full -- a short page has nothing before it.
 */
export function cateringMessagePageFrom<T extends { id: string }>(descendingRows: readonly T[], limit: number): { rows: T[]; nextCursor: string | null } {
  const rows = [...descendingRows].reverse();
  const nextCursor = descendingRows.length === limit && descendingRows.length > 0 ? descendingRows[descendingRows.length - 1].id : null;
  return { rows, nextCursor };
}
/** Files list newest-first, which is how the UI shows them, so only the boundary is derived here. */
export function cateringFilePageFrom<T extends { id: string }>(descendingRows: readonly T[], limit: number): { rows: T[]; nextCursor: string | null } {
  const nextCursor = descendingRows.length === limit && descendingRows.length > 0 ? descendingRows[descendingRows.length - 1].id : null;
  return { rows: [...descendingRows], nextCursor };
}

/**
 * The read marker a request resolves to. A message id is accepted only when it belongs to this booking's own
 * conversation, so a message borrowed from another thread is refused rather than silently becoming the marker, and
 * an omitted id means "everything currently in this conversation".
 */
export function resolveCateringReadMarker(requested: string | undefined, latest: { id: string } | undefined, belongsToConversation: boolean) {
  if (requested !== undefined) return belongsToConversation ? { kind: "mark", messageId: requested } as const : { kind: "foreign_message" } as const;
  return latest ? { kind: "mark", messageId: latest.id } as const : { kind: "empty" } as const;
}

/**
 * The authoritative unread boundary for one participant, in the same `(created_at, id)` ordering Phase 2I message
 * pagination uses.
 *
 * A wall-clock timestamp is never the boundary. Marking message M10 read must not mark an M11 that already exists,
 * or one that arrives during the marking, merely because "now" is later than its `created_at` -- and when two
 * messages share a `created_at` to the microsecond, the timestamp alone cannot separate them at all. So the marker
 * message itself is the boundary, and its stored `(created_at, id)` pair is what later messages are compared
 * against.
 *
 * `after_timestamp` remains only as a fallback for a participant row that carries a `lastReadAt` but no
 * `lastReadMessageId` -- the shape the generic DM read route can leave behind -- so such a row still counts
 * sensibly instead of reporting everything unread.
 */
export type CateringUnreadBoundary =
  | { kind: "after_message"; messageId: string }
  | { kind: "after_timestamp"; since: Date }
  | { kind: "all" };
export function cateringUnreadBoundary(participant: { lastReadMessageId: string | null; lastReadAt: Date | null } | undefined, markerIsInThread: boolean): CateringUnreadBoundary {
  if (participant?.lastReadMessageId && markerIsInThread) return { kind: "after_message", messageId: participant.lastReadMessageId };
  if (participant?.lastReadAt) return { kind: "after_timestamp", since: participant.lastReadAt };
  return { kind: "all" };
}

/**
 * Whether one message sorts strictly after a read boundary, comparing `(created_at, id)` as a pair. This is the
 * ordering the unread query performs in SQL against the stored rows; it is stated here so the semantics -- above all
 * the equal-timestamp case, where the id alone decides -- are pinned by a test rather than only by a query.
 */
export function isAfterCateringReadBoundary(message: { createdAt: Date; id: string }, boundary: { createdAt: Date; id: string }): boolean {
  const messageAt = message.createdAt.getTime();
  const boundaryAt = boundary.createdAt.getTime();
  if (messageAt !== boundaryAt) return messageAt > boundaryAt;
  return message.id > boundary.id;
}

/**
 * Whether a selected message may become the participant's new read marker.
 *
 * Read progress is monotonic: a marker advances or stays put, never moves backward. Two tabs are enough to need
 * this -- one marks M20 read, then a second tab with a stale view marks M15, and without a guard the row regresses
 * and M16-M20 reappear as unread. A row with no marker yet is established by any valid message of the conversation.
 *
 * The ordering is `(created_at, id)`, identical to message pagination and to unread counting, so an equal timestamp
 * is decided by id rather than treated as a tie. Marking the same message twice is a no-op, which is what makes the
 * endpoint safely idempotent across tabs and devices.
 *
 * This is the decision the SQL performs; it is stated here so the semantics are pinned by a test as well as by a
 * query. The route does NOT read-then-write against it -- that would race -- it issues one conditional UPDATE whose
 * WHERE clause carries this same comparison, so the database is what enforces monotonicity.
 */
export function cateringReadMarkerAdvances(selected: { createdAt: Date; id: string }, current: { createdAt: Date; id: string } | null): boolean {
  if (!current) return true;
  return isAfterCateringReadBoundary(selected, current);
}

/**
 * Notification delivery for a booking message, decided from persisted state only. A muted counterpart participant
 * row is honoured -- that is the existing DM mute semantic, and a booking conversation is a DM thread -- and a
 * booking whose two roles are the same account notifies nobody.
 *
 * Known limitation, deliberately not papered over: booking FILE notifications have no equivalent persisted mute
 * setting anywhere in ChefSire today, so they are always delivered. Reusing the DM participant mute for them would
 * silently redefine what that switch means, and Phase 2I does not invent a new notification settings surface.
 */
export function shouldNotifyBookingMessage(counterpartId: string | null, counterpartMuted: boolean): boolean {
  return counterpartId !== null && !counterpartMuted;
}
/**
 * A notification that fails to persist does not undo a message that already did. The message is the durable record
 * the participant can still read in the workspace, and ChefSire's existing message and task notifications already
 * behave this way, so the send answers success and the notification is best-effort.
 */
export const CATERING_NOTIFICATION_FAILURE_ROLLS_BACK_SEND = false;

/** Whether a booking status still permits a send, expressed as the guard the routes call before opening a lock. */
export function cateringCommunicationGuard(status: CateringBookingStatus, role: "provider" | "customer" | null): "allowed" | "read_only" | "forbidden" {
  if (role === null) return "forbidden";
  if (!mayPostCateringBookingMessage(status)) return "read_only";
  return "allowed";
}
