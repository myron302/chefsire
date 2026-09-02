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
