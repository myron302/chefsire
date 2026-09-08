import { and, eq, or, sql } from "drizzle-orm";
import { cateringBookings } from "@shared/schema";
import { db } from "../db";

type Tx = typeof db;

/**
 * The one way every catering booking workspace request resolves a booking: by id, restricted to the persisted
 * provider or customer of that booking. A request body never contributes a participant, so a forged providerId,
 * customerId, ownerId or actorId cannot widen this, and an authenticated stranger simply gets no row -- which the
 * callers answer as a not-found, so a guessed booking id reveals nothing about whether the booking exists.
 */
export async function ownedCateringBooking(bookingId: string, userId: string) {
  const [booking] = await db.select().from(cateringBookings)
    .where(and(eq(cateringBookings.id, bookingId), or(eq(cateringBookings.providerId, userId), eq(cateringBookings.customerId, userId))))
    .limit(1);
  return booking;
}

/**
 * Takes the row lock on the booking inside a mutation transaction and reports whether it is still writable.
 *
 * This is the authoritative terminal-state check, not the early guard. A booking that is cancelled or completed
 * between the request's first read and this lock answers false here, so an in-flight send, upload or delete refuses
 * with the canonical read-only behaviour instead of pretending it succeeded against a historical booking.
 */
export async function lockActiveCateringBooking(tx: Tx, bookingId: string): Promise<boolean> {
  await tx.execute(sql`SELECT id FROM catering_bookings WHERE id = ${bookingId} FOR UPDATE`);
  const [booking] = await tx.select({ status: cateringBookings.status }).from(cateringBookings).where(eq(cateringBookings.id, bookingId)).limit(1);
  return booking?.status === "pending_confirmation" || booking?.status === "confirmed";
}
