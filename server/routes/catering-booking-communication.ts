import { Router } from "express";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { cateringBookingMessageRequests, notifications, users } from "@shared/schema";
import { dmMessages, dmParticipants } from "@shared/schema.dm";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { CATERING_COMMUNICATION_SECTION, CATERING_MESSAGE_NOTIFICATION, CATERING_UNREAD_COUNT_CEILING, cateringBookingMessagePageSchema, cateringBookingMessageReadSchema, cateringBookingMessageSendSchema, cateringBookingSectionPath, mayPostCateringBookingMessage } from "@shared/catering-booking-communication";
import { cateringWorkspaceRole } from "@shared/catering-booking-operations";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { serializeBookingMessage, type SerializableBookingMessage } from "../serializers/catering-booking-message";
import { lockActiveCateringBooking, ownedCateringBooking } from "../services/catering-booking-access";
import { conversationMemberIds, conversationParticipant, ensureBookingConversation, findBookingConversation } from "../services/catering-booking-conversation";
import { CATERING_COMMUNICATION_READ_ONLY_REFUSAL, CATERING_MESSAGE_SEND_REFUSALS, boundedUnreadCount, cateringCounterpart, cateringMessagePageFrom, cateringUnreadBoundary, resolveCateringMessageSend, resolveCateringReadMarker, shouldNotifyBookingMessage } from "../services/catering-booking-communication-policy";

const r = Router();
const NOT_FOUND = { message: "Booking conversation not found" } as const;
type Res = Parameters<Parameters<typeof r.get>[1]>[1];

/**
 * Signals that this send's client request token was already claimed by an accepted send. It is thrown, never
 * returned, so the transaction that had already inserted a message rolls that insert back: a retry must resolve to
 * the message the first attempt persisted, and must not leave a second copy of it behind.
 */
class DuplicateBookingMessage extends Error {}

function invalid(error: unknown, res: Res, next: (error: unknown) => void) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
  next(error);
}

/** Display names for the senders in one page, looked up once rather than per message. */
async function senderNames(ids: readonly string[]): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((row: { id: string; displayName: string | null; username: string | null }) => [row.id, row.displayName || row.username || null] as const));
}

/**
 * The keyset boundary for one page, resolved from the booking's own thread.
 *
 * The cursor is the id of the oldest message the client already holds, and the comparison below reads that row's
 * `(created_at, id)` from the database itself rather than trusting a timestamp the client round-tripped. That is what
 * makes the ordering deterministic even when many messages share a created_at to the microsecond: the pair is
 * compared at full stored precision, so no row is ever skipped or served twice at a page boundary. A cursor naming a
 * message in any other thread resolves to nothing and is refused, so a foreign message id is not a usable boundary.
 */
async function messageInThread(threadId: string, messageId: string): Promise<{ id: string; createdAt: Date } | undefined> {
  const [row] = await db.select({ id: dmMessages.id, createdAt: dmMessages.createdAt }).from(dmMessages).where(and(eq(dmMessages.id, messageId), eq(dmMessages.threadId, threadId))).limit(1);
  return row;
}
async function messageCursorExists(threadId: string, cursor: string): Promise<boolean> {
  return Boolean(await messageInThread(threadId, cursor));
}

r.get("/bookings/:id/messages", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id);
  const userId = (req.user as { id: string }).id;
  const page = cateringBookingMessagePageSchema.parse(req.query);
  const booking = await ownedCateringBooking(id, userId);
  if (!booking) return res.status(404).json(NOT_FOUND);
  const editable = mayPostCateringBookingMessage(booking.status as never);
  // Reading never creates the conversation: a booking nobody has messaged on yet is an empty conversation, not a
  // reason to write a thread and two participant rows into the database.
  const threadId = await findBookingConversation(id);
  if (!threadId) return res.json({ messages: [], nextCursor: null, editable });
  if (page.cursor && !await messageCursorExists(threadId, page.cursor)) return res.status(400).json({ message: "Unknown message cursor" });
  const boundary = page.cursor
    ? sql`(${dmMessages.createdAt}, ${dmMessages.id}) < (SELECT m.created_at, m.id FROM dm_messages m WHERE m.id = ${page.cursor})`
    : undefined;
  // `db` is untyped at this repo's boundary, so the row shape is stated here rather than inferred as `any`.
  const rows: SerializableBookingMessage[] = await db.select({ id: dmMessages.id, senderId: dmMessages.senderId, body: dmMessages.body, createdAt: dmMessages.createdAt })
    .from(dmMessages)
    .where(and(eq(dmMessages.threadId, threadId), boundary))
    .orderBy(desc(dmMessages.createdAt), desc(dmMessages.id))
    .limit(page.limit);
  const { rows: ordered, nextCursor } = cateringMessagePageFrom(rows, page.limit);
  const names = await senderNames(ordered.map((row) => row.senderId));
  res.json({ messages: ordered.map((row) => serializeBookingMessage(row, { providerId: booking.providerId, customerId: booking.customerId, actorId: userId, names })), nextCursor, editable });
} catch (error) { invalid(error, res, next); } });

type BookingMessageSendResult =
  | { kind: "read_only" } | { kind: "membership" } | { kind: "duplicate" }
  | { kind: "sent"; threadId: string; message: SerializableBookingMessage };

/**
 * Persists one booking message, or resolves why it could not be.
 *
 * Everything authoritative happens inside one transaction: the booking row lock decides terminal state, the
 * conversation is created lazily and idempotently under its own lock, and the linked thread's membership is
 * compared against the persisted booking before a word is written. The sender is the authenticated actor; no
 * senderId, threadId or participantId is ever read from the request.
 */
async function persistBookingMessage(bookingId: string, booking: { id: string; providerId: string; customerId: string }, userId: string, input: { text: string; clientRequestId?: string }): Promise<BookingMessageSendResult> {
  try {
    return await db.transaction(async (tx: typeof db) => {
      // Terminal state is decided here, under the booking row lock, so a booking that goes cancelled or completed
      // mid-flight refuses rather than persisting a message into a historical conversation.
      const active = await lockActiveCateringBooking(tx, bookingId);
      if (!active) return { kind: "read_only" } as const;
      const threadId = await ensureBookingConversation(tx, booking);
      const outcome = resolveCateringMessageSend({ active, memberIds: await conversationMemberIds(tx, threadId) }, booking);
      if (outcome.kind !== "send") return outcome;
      // The id is generated here so the idempotency ledger can point at the message from the same transaction.
      const messageId = randomUUID();
      const [message] = await tx.insert(dmMessages).values({ id: messageId, threadId, senderId: userId, body: input.text, attachments: [] }).returning();
      if (input.clientRequestId) {
        // Uniqueness is (booking, sender, clientRequestId), so a retry of an already-accepted send claims nothing.
        const claimed = await tx.insert(cateringBookingMessageRequests)
          .values({ bookingId, senderId: userId, clientRequestId: input.clientRequestId, messageId })
          .onConflictDoNothing()
          .returning({ messageId: cateringBookingMessageRequests.messageId });
        if (claimed.length === 0) throw new DuplicateBookingMessage();
      }
      // The sender's own read marker is the message they just sent, written from its stored `created_at` for the
      // same reason the read route does: the pair, not a wall clock, is what unread is measured against.
      await tx.update(dmParticipants)
        .set({ lastReadMessageId: messageId, lastReadAt: sql`(SELECT m.created_at FROM dm_messages m WHERE m.id = ${messageId})` })
        .where(and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)));
      return { kind: "sent", threadId, message } as const;
    });
  } catch (error) {
    // The duplicate is thrown rather than returned on purpose: returning would COMMIT the message this transaction
    // already inserted, and the retry would leave a second copy of a message that was already accepted.
    if (error instanceof DuplicateBookingMessage) return { kind: "duplicate" };
    throw error;
  }
}

r.post("/bookings/:id/messages", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id);
  const userId = (req.user as { id: string }).id;
  const input = cateringBookingMessageSendSchema.parse(req.body ?? {});
  const booking = await ownedCateringBooking(id, userId);
  if (!booking) return res.status(404).json(NOT_FOUND);
  const role = cateringWorkspaceRole(booking, userId)!;
  // Early refusal for a booking that is already terminal. The authoritative check still happens under the lock below.
  if (!mayPostCateringBookingMessage(booking.status as never)) return res.status(CATERING_COMMUNICATION_READ_ONLY_REFUSAL.status).json({ message: CATERING_COMMUNICATION_READ_ONLY_REFUSAL.message, code: CATERING_COMMUNICATION_READ_ONLY_REFUSAL.code });

  const result = await persistBookingMessage(id, booking, userId, input);

  if (result.kind === "read_only") { const refusal = CATERING_MESSAGE_SEND_REFUSALS.read_only; return res.status(409).json({ message: refusal.message, code: refusal.code }); }
  if (result.kind === "membership") { const refusal = CATERING_MESSAGE_SEND_REFUSALS.membership; return res.status(409).json({ message: refusal.message, code: refusal.code }); }
  if (result.kind === "duplicate") {
    // The retry is answered with the message the first attempt already persisted, so a double tap or a client
    // timeout after a successful insert never produces a second message and never fabricates a new one either. A
    // token that names no accepted send is refused rather than answered with an invented success.
    const existing = await duplicateMessage(id, userId, input.clientRequestId!);
    if (!existing) return res.status(409).json({ message: "This message could not be resolved. Reload the conversation." });
    const duplicateNames = await senderNames([existing.senderId]);
    return res.status(200).json({ message: serializeBookingMessage(existing, { providerId: booking.providerId, customerId: booking.customerId, actorId: userId, names: duplicateNames }), duplicate: true });
  }

  // Notification is best-effort and deliberately outside the transaction: a notification that fails to persist never
  // rolls back a message that already did, which is how ChefSire's existing message and task notifications behave.
  // The body never travels -- the copy is neutral for both participants -- and the link goes to this booking's own
  // workspace Communication section rather than the generic inbox.
  const counterpartId = cateringCounterpart(booking, userId);
  if (counterpartId) {
    const counterpart = await conversationParticipant(result.threadId, counterpartId).catch(() => undefined);
    if (shouldNotifyBookingMessage(counterpartId, counterpart?.notificationsMuted ?? false)) {
      await db.insert(notifications).values({
        userId: counterpartId, type: CATERING_MESSAGE_NOTIFICATION.type, title: CATERING_MESSAGE_NOTIFICATION.title, message: CATERING_MESSAGE_NOTIFICATION.message,
        linkUrl: cateringBookingSectionPath(role === "provider" ? "customer" : "provider", id, CATERING_COMMUNICATION_SECTION),
      }).catch(() => undefined);
    }
  }
  const names = await senderNames([result.message.senderId]);
  res.status(201).json({ message: serializeBookingMessage(result.message, { providerId: booking.providerId, customerId: booking.customerId, actorId: userId, names }) });
} catch (error) { invalid(error, res, next); } });

/** Reads back the message an already-accepted client request produced, scoped to this booking and this sender. */
async function duplicateMessage(bookingId: string, senderId: string, clientRequestId: string) {
  const [row] = await db.select({ id: dmMessages.id, senderId: dmMessages.senderId, body: dmMessages.body, createdAt: dmMessages.createdAt })
    .from(cateringBookingMessageRequests)
    .innerJoin(dmMessages, eq(dmMessages.id, cateringBookingMessageRequests.messageId))
    .where(and(eq(cateringBookingMessageRequests.bookingId, bookingId), eq(cateringBookingMessageRequests.senderId, senderId), eq(cateringBookingMessageRequests.clientRequestId, clientRequestId)))
    .limit(1);
  return row;
}

r.post("/bookings/:id/messages/read", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id);
  const userId = (req.user as { id: string }).id;
  const input = cateringBookingMessageReadSchema.parse(req.body ?? {});
  const booking = await ownedCateringBooking(id, userId);
  if (!booking) return res.status(404).json(NOT_FOUND);
  // Marking a historical conversation read is allowed: reading never closes, only sending does.
  const threadId = await findBookingConversation(id);
  if (!threadId) return res.json({ lastReadMessageId: null, lastReadAt: null, unreadCount: 0 });
  // The thread is derived from the booking, never supplied. A message id is accepted only if it belongs to THIS
  // booking's conversation, so a message borrowed from another thread can never become this booking's read marker.
  const requested = input.lastReadMessageId ? await messageInThread(threadId, input.lastReadMessageId) : undefined;
  // `db` is untyped at this repo's boundary, so the row shape is stated rather than inferred as `any`.
  const latestRows: { id: string; createdAt: Date }[] = await db.select({ id: dmMessages.id, createdAt: dmMessages.createdAt }).from(dmMessages).where(eq(dmMessages.threadId, threadId)).orderBy(desc(dmMessages.createdAt), desc(dmMessages.id)).limit(1);
  const marker = resolveCateringReadMarker(input.lastReadMessageId, latestRows[0], Boolean(requested));
  if (marker.kind === "foreign_message") return res.status(400).json({ message: "That message does not belong to this booking conversation" });
  // An empty conversation has no message to be the boundary, and none is fabricated.
  if (marker.kind === "empty") return res.json({ lastReadMessageId: null, lastReadAt: null, unreadCount: 0 });
  // A "mark" always names a message that was just read back from this thread, so this cannot be missing; it is
  // resolved explicitly rather than asserted, so a future change to the policy cannot silently produce a marker
  // with no stored row behind it.
  const selected = requested ?? latestRows[0];
  if (!selected) return res.json({ lastReadMessageId: null, lastReadAt: null, unreadCount: 0 });
  // The boundary is the SELECTED MESSAGE, never the wall clock. Writing `now` would mark as read every message that
  // happens to predate this request -- including one the other participant sent while this request was in flight,
  // and any message the caller has not seen when they deliberately marked an older one. `lastReadAt` is therefore
  // copied from the message's own stored `created_at` in SQL, so it keeps the full precision a JS Date round-trip
  // would truncate, and `lastReadMessageId` carries the tiebreak that a timestamp alone cannot express.
  await db.update(dmParticipants)
    .set({ lastReadMessageId: marker.messageId, lastReadAt: sql`(SELECT m.created_at FROM dm_messages m WHERE m.id = ${marker.messageId})` })
    .where(and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)));
  const unread = await unreadMessageCount(threadId, userId);
  res.json({ lastReadMessageId: marker.messageId, lastReadAt: selected.createdAt.toISOString(), unreadCount: unread.count });
} catch (error) { invalid(error, res, next); } });

/**
 * A bounded unread count for one participant. It reads at most ceiling+1 rows, so a conversation with thousands of
 * unread messages costs the same as one with three and the workspace renders "99+" rather than an unbounded total.
 */
export async function unreadMessageCount(threadId: string, userId: string): Promise<{ count: number; capped: boolean }> {
  const participant = await conversationParticipant(threadId, userId);
  // The marker must still be a message of THIS thread; otherwise the timestamp fallback applies rather than a
  // comparison against a row that is not there, which would silently count nothing.
  const markerIsInThread = participant?.lastReadMessageId ? Boolean(await messageInThread(threadId, participant.lastReadMessageId)) : false;
  const boundary = cateringUnreadBoundary(participant, markerIsInThread);
  // `(created_at, id) > (marker's stored created_at, id)` -- the same pair, read back at full stored precision, that
  // message pagination orders by. Two messages sharing a `created_at` are separated by their ids, so marking the
  // earlier one read leaves the later one unread; a plain `created_at >` comparison would mark both.
  const after = boundary.kind === "after_message"
    ? sql`(${dmMessages.createdAt}, ${dmMessages.id}) > (SELECT b.created_at, b.id FROM dm_messages b WHERE b.id = ${boundary.messageId})`
    : boundary.kind === "after_timestamp" ? sql`${dmMessages.createdAt} > ${boundary.since}` : undefined;
  const rows = await db.select({ id: dmMessages.id }).from(dmMessages)
    .where(and(eq(dmMessages.threadId, threadId), ne(dmMessages.senderId, userId), after))
    .limit(CATERING_UNREAD_COUNT_CEILING + 1);
  return boundedUnreadCount(rows.length);
}

export default r;
