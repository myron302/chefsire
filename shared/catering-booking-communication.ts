import { z } from "zod";
import type { CateringBookingStatus } from "./catering-bookings";
import { mayEditCateringWorkspace, cateringBookingWorkspacePath } from "./catering-booking-operations";

/**
 * Booking-scoped participant communication. Every contract here is deliberately narrow: the server derives the
 * sender, the thread and the participants from the persisted booking, so nothing in a request body may name an
 * actor, a thread, or a participant. Phase 2I messages are immutable -- there is no edit and no delete.
 */
export const CATERING_MESSAGE_MAX_LENGTH = 8000;
export const CATERING_MESSAGE_PAGE_DEFAULT = 30;
export const CATERING_MESSAGE_PAGE_MAXIMUM = 50;
/** An unread badge never runs an unbounded count: past this many the workspace reports "99+" instead of a total. */
export const CATERING_UNREAD_COUNT_CEILING = 99;

/**
 * A message body is trimmed and must survive the trim. `.strict()` is what rejects a forged senderId, threadId,
 * bookingId or participantId: the only fields a send may carry are its text and an optional retry token.
 */
export const cateringBookingMessageSendSchema = z.object({
  text: z.string().trim().min(1, "A message cannot be empty").max(CATERING_MESSAGE_MAX_LENGTH),
  clientRequestId: z.string().uuid().optional(),
}).strict();

/**
 * Keyset pagination boundary. The cursor is the id of the last message the client already holds, and the server
 * resolves its authoritative `(created_at, id)` from the booking's own thread: a message id from any other thread
 * never becomes a valid boundary, and the stored timestamp is compared at full precision rather than a
 * client-supplied one that a millisecond round-trip could truncate.
 */
export const cateringBookingMessagePageSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(CATERING_MESSAGE_PAGE_MAXIMUM).default(CATERING_MESSAGE_PAGE_DEFAULT),
}).strict();

/**
 * Marking the conversation read names at most a message, never a thread or a participant. The server resolves the
 * thread from the booking and refuses any message that does not belong to that booking conversation, so a message id
 * borrowed from another thread can never become this booking's read marker.
 */
export const cateringBookingMessageReadSchema = z.object({ lastReadMessageId: z.string().uuid().optional() }).strict();

/** A booking conversation refuses new messages exactly when the Phase 2H workspace is read-only. */
export function mayPostCateringBookingMessage(status: CateringBookingStatus): boolean { return mayEditCateringWorkspace(status); }
/** Cancelled and completed conversations stay readable forever; only sending closes. */
export function mayReadCateringBookingMessages(): boolean { return true; }

/** A booking conversation that went terminal mid-flight answers with the workspace's own canonical read-only code. */
export const CATERING_COMMUNICATION_READ_ONLY_MESSAGE = "Cancelled and completed booking conversations are read-only";
/**
 * A generic DM route was pointed at a thread that belongs to a catering booking. It carries its own code so the
 * client can route the user into the booking workspace rather than retrying the generic endpoint.
 */
export const CATERING_BOOKING_THREAD_CODE = "catering_booking_thread";
export const CATERING_BOOKING_THREAD_MESSAGE = "This conversation belongs to a catering booking. Open the booking workspace to read or send messages.";

export const CATERING_COMMUNICATION_SECTION = "communication";
export const CATERING_FILES_SECTION = "files";
/** A booking notification deep-links into the workspace section it is about, never a generic inbox. */
export function cateringBookingSectionPath(role: "provider" | "customer", bookingId: string, section: string): string {
  return `${cateringBookingWorkspacePath(role, bookingId)}#${section}`;
}

/** Neutral notification copy. A booking message body never travels in a notification, for either participant. */
export const CATERING_MESSAGE_NOTIFICATION = { type: "catering_booking_message", title: "New catering booking message", message: "A booking participant sent you a message." } as const;

export type CateringBookingMessageView = {
  id: string; senderId: string; senderRole: "provider" | "customer"; senderName: string | null;
  text: string; createdAt: string; mine: boolean;
};
/** Oldest-first for display, plus the boundary that loads the page before it. `nextCursor` is null at the beginning. */
/**
 * `unreadStartId` is the earliest unread INCOMING message for the authenticated actor, or null when nothing is
 * unread. It exists because `unreadMessageCount` is bounded at a ceiling and reports `capped` beyond it -- a lower
 * bound, not a total -- and a client cannot locate the start of a range whose size it does not know. Derived
 * server-side from that actor's own persisted read marker, in the same `(created_at, id)` ordering, and never
 * capped.
 */
export type CateringBookingMessagePageView = { messages: CateringBookingMessageView[]; nextCursor: string | null; editable: boolean; unreadStartId?: string | null };
export type CateringBookingReadStateView = { lastReadMessageId: string | null; lastReadAt: string | null; unreadCount: number };

export const cateringBookingMessagesKey = (userId: string, bookingId: string) => ["catering", "booking-messages", userId, bookingId] as const;
