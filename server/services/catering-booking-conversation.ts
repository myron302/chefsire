import { and, eq, inArray, sql } from "drizzle-orm";
import { cateringBookingConversations } from "@shared/schema";
import { dmParticipants, dmThreads } from "@shared/schema.dm";
import { db } from "../db";
import { cateringConversationParticipants } from "./catering-booking-communication-policy";

type Tx = typeof db;

/**
 * The advisory lock a booking conversation is created under. It is keyed by the booking, so two simultaneous first
 * requests on the same booking serialize while two different bookings never contend.
 */
export async function lockBookingConversation(tx: Tx, bookingId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`catering-conversation:${bookingId}`}))`);
}

/**
 * The dedicated conversation for one booking, created lazily and exactly once.
 *
 * Creation is atomic and idempotent in two independent ways. The advisory lock serializes concurrent first requests
 * on the same booking, so the second one observes the first one's committed link instead of building a second
 * thread; and `catering_booking_conversations.booking_id` is a primary key, so even if a lock were somehow bypassed
 * the database still refuses the duplicate. The participants are read from the persisted booking -- never from the
 * request -- and an existing generic 1:1 DM between the same two people is deliberately never adopted: a booking
 * conversation is a distinct history, and two bookings between the same pair get two distinct conversations.
 */
export async function ensureBookingConversation(tx: Tx, booking: { id: string; providerId: string; customerId: string }): Promise<string> {
  await lockBookingConversation(tx, booking.id);
  const [existing] = await tx.select({ threadId: cateringBookingConversations.threadId }).from(cateringBookingConversations).where(eq(cateringBookingConversations.bookingId, booking.id)).limit(1);
  if (existing) return existing.threadId;
  const [thread] = await tx.insert(dmThreads).values({ isGroup: false, title: null }).returning({ id: dmThreads.id });
  const participants = cateringConversationParticipants(booking);
  await tx.insert(dmParticipants).values(participants.map((userId) => ({ threadId: thread.id, userId, role: "member" })));
  await tx.insert(cateringBookingConversations).values({ bookingId: booking.id, threadId: thread.id });
  return thread.id;
}

/** The existing conversation thread for a booking, or null. Never creates one, so a plain read stays a read. */
export async function findBookingConversation(bookingId: string): Promise<string | null> {
  const [row] = await db.select({ threadId: cateringBookingConversations.threadId }).from(cateringBookingConversations).where(eq(cateringBookingConversations.bookingId, bookingId)).limit(1);
  return row?.threadId ?? null;
}

/**
 * Whether one thread belongs to a catering booking. This is what closes the generic-DM bypass: a thread that answers
 * true here is owned by the booking API and every generic DM route refuses it, so a client cannot reach a booking
 * conversation through an endpoint that knows nothing about booking participants or booking lifecycle.
 */
export async function bookingLinkedThread(threadId: string): Promise<{ bookingId: string } | null> {
  const [row] = await db.select({ bookingId: cateringBookingConversations.bookingId }).from(cateringBookingConversations).where(eq(cateringBookingConversations.threadId, threadId)).limit(1);
  return row ?? null;
}

/** The subset of the given threads that belong to catering bookings, so a generic listing can exclude them in one query. */
export async function bookingLinkedThreadIds(threadIds: readonly string[]): Promise<Set<string>> {
  if (threadIds.length === 0) return new Set();
  const rows = await db.select({ threadId: cateringBookingConversations.threadId }).from(cateringBookingConversations).where(inArray(cateringBookingConversations.threadId, [...threadIds]));
  return new Set(rows.map((row: { threadId: string }) => row.threadId));
}

/** The persisted membership of a linked thread, read inside the send lock so it is compared against booking truth. */
export async function conversationMemberIds(tx: Tx, threadId: string): Promise<string[]> {
  const rows = await tx.select({ userId: dmParticipants.userId }).from(dmParticipants).where(eq(dmParticipants.threadId, threadId));
  return rows.map((row: { userId: string }) => row.userId);
}

/** One participant row of a booking conversation, used for read state and for the counterpart's mute setting. */
export async function conversationParticipant(threadId: string, userId: string) {
  const [row] = await db.select().from(dmParticipants).where(and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId))).limit(1);
  return row;
}
