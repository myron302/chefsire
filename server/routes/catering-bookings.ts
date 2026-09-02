import { Router } from "express";
import { and, count, desc, eq, gte, lte, or } from "drizzle-orm";
import { z } from "zod";
import { cateringAvailabilityExceptions, cateringAvailabilitySettings, cateringBookingActivity, cateringBookings, cateringInquiries, cateringPackages, cateringReviews, notifications } from "@shared/schema";
import { cateringBookingCancelSchema, cateringBookingIdSchema, cateringBookingOfferSchema, cateringBookingPageSchema } from "@shared/catering-bookings";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { calendarDateInTimezone } from "../services/catering-availability";
import { evaluateBookingDateForConfirmation, evaluateBookingDateForOffer } from "../services/catering-booking-availability";
import { bookingActor, mayCancel, mayComplete, mayConfirm, mayInquiryProduceBooking, nextConfirmationStatus } from "../services/catering-booking-policy";
import { serializeCateringBooking } from "../serializers/catering-booking";
import { CATERING_CUSTOMER_BOOKINGS_URL, CATERING_PROVIDER_BOOKINGS_URL } from "../services/catering-booking-links";
import { lockCateringReviewRelationship } from "../services/catering-review-relationship-lock";

const r = Router();
async function bookingDateExceptions(executor: typeof db, providerId: string, targetDate: string) {
  const exceptions = await executor.select().from(cateringAvailabilityExceptions).where(and(eq(cateringAvailabilityExceptions.providerId, providerId), lte(cateringAvailabilityExceptions.startDate, targetDate), gte(cateringAvailabilityExceptions.endDate, targetDate)));
  return exceptions;
}
async function providerCalendarDate(executor: typeof db, providerId: string, now: Date) {
  const [settings] = await executor.select({ timezone: cateringAvailabilitySettings.timezone }).from(cateringAvailabilitySettings).where(eq(cateringAvailabilitySettings.providerId, providerId)).limit(1);
  return calendarDateInTimezone(now, settings?.timezone ?? "UTC");
}

r.get("/bookings", requireAuth, async (req, res, next) => { try {
  const userId = (req.user as { id: string }).id; const query = cateringBookingPageSchema.parse(req.query);
  const ownership = query.role === "provider" ? eq(cateringBookings.providerId, userId) : query.role === "customer" ? eq(cateringBookings.customerId, userId) : or(eq(cateringBookings.providerId, userId), eq(cateringBookings.customerId, userId));
  const where = query.status ? and(ownership, eq(cateringBookings.status, query.status)) : ownership;
  const [{ value }] = await db.select({ value: count() }).from(cateringBookings).where(where);
  const rows = await db.select().from(cateringBookings).where(where).orderBy(desc(cateringBookings.eventDate), desc(cateringBookings.createdAt), desc(cateringBookings.id)).limit(query.limit).offset((query.page - 1) * query.limit);
  res.json({ bookings: rows.map(serializeCateringBooking), pagination: { ...query, total: Number(value), totalPages: Math.ceil(Number(value) / query.limit) } });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

r.get("/bookings/:id", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const userId = (req.user as { id: string }).id;
  const [row] = await db.select().from(cateringBookings).where(and(eq(cateringBookings.id, id), or(eq(cateringBookings.providerId, userId), eq(cateringBookings.customerId, userId)))).limit(1);
  if (!row) return res.status(404).json({ message: "Booking not found" }); res.json({ booking: serializeCateringBooking(row) });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid booking ID" }); next(error); } });

// Provider acceptance remains an inquiry fact. This separate intent creates/offers the agreement.
r.post("/inquiries/:inquiryId/provider-confirm", requireAuth, async (req, res, next) => { try {
  const inquiryId = cateringBookingIdSchema.parse(req.params.inquiryId); const providerId = (req.user as { id: string }).id; const offer = cateringBookingOfferSchema.parse(req.body ?? {}); const now = new Date();
  const result = await db.transaction(async (tx: typeof db) => {
    const [inquiry] = await tx.select().from(cateringInquiries).where(and(eq(cateringInquiries.id, inquiryId), eq(cateringInquiries.chefId, providerId))).limit(1);
    if (!inquiry) return { error: 404, message: "Accepted inquiry not found" } as const;
    if (!mayInquiryProduceBooking(inquiry)) return { error: 409, message: "Only an accepted inquiry can be offered for booking" } as const;
    const [pkg] = inquiry.packageId ? await tx.select().from(cateringPackages).where(and(eq(cateringPackages.id, inquiry.packageId), eq(cateringPackages.providerId, providerId))).limit(1) : [];
    const eventDate = calendarDateInTimezone(inquiry.eventDate, "UTC");
    const offerDate = evaluateBookingDateForOffer({ targetDate: eventDate, currentDate: await providerCalendarDate(tx, providerId, now), exceptions: await bookingDateExceptions(tx, providerId, eventDate) });
    if (!offerDate.available) return { error: 409, message: offerDate.reason === "past_event" ? "Booking terms cannot be offered after the event date." : "This event date is explicitly blocked. Remove the date block before offering booking terms." } as const;
    const [created] = await tx.insert(cateringBookings).values({ inquiryId, providerId, customerId: inquiry.customerId, packageId: pkg?.id ?? null, eventDate, eventType: inquiry.eventType, guestCount: inquiry.guestCount, agreedPrice: offer.agreedPrice?.toFixed(2), currency: offer.currency, packageTitleSnapshot: pkg?.title ?? null, packagePricingModelSnapshot: pkg?.pricingModel ?? null, packageStartingPriceSnapshot: pkg?.startingPrice ?? null, providerConfirmedAt: now }).onConflictDoNothing({ target: cateringBookings.inquiryId }).returning({ id: cateringBookings.id });
    const [booking] = await tx.select().from(cateringBookings).where(eq(cateringBookings.inquiryId, inquiryId)).limit(1);
    if (!booking || booking.providerId !== providerId) return { error: 409, message: "Booking could not be created" } as const;
    if (booking.status === "pending_confirmation" && !booking.providerConfirmedAt) await tx.update(cateringBookings).set({ providerConfirmedAt: now, updatedAt: now }).where(and(eq(cateringBookings.id, booking.id), eq(cateringBookings.status, "pending_confirmation")));
    const newlyConfirmed = !booking.providerConfirmedAt;
    if (created) await tx.insert(cateringBookingActivity).values({ bookingId: booking.id, actorUserId: providerId, eventType: "booking_offered", visibility: "shared", metadata: {} });
    const [fresh] = await tx.select().from(cateringBookings).where(eq(cateringBookings.id, booking.id)).limit(1); return { booking: fresh, notify: Boolean(created || newlyConfirmed) } as const;
  });
  if ("error" in result) return res.status(result.error).json({ message: result.message });
  if (result.notify) await db.insert(notifications).values({ userId: result.booking.customerId, type: "catering_booking_confirmation", title: "Catering booking ready to confirm", message: "Your provider has offered booking terms for your explicit confirmation.", linkUrl: CATERING_CUSTOMER_BOOKINGS_URL }).catch(() => undefined);
  res.status(result.notify ? 201 : 200).json({ booking: serializeCateringBooking(result.booking) });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

r.post("/bookings/:id/customer-confirm", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const customerId = (req.user as { id: string }).id; const now = new Date();
  const result = await db.transaction(async (tx: typeof db) => {
    const [current] = await tx.select().from(cateringBookings).where(and(eq(cateringBookings.id, id), eq(cateringBookings.customerId, customerId))).limit(1);
    if (!current) return { error: 404, message: "Booking not found" } as const;
    if (current.customerConfirmedAt) return { booking: current, notify: false } as const;
    if (!mayConfirm(current, "customer")) return { error: 409, message: "Booking can no longer be confirmed" } as const;
    const nextStatus = nextConfirmationStatus(current, "customer");
    const confirmationDate = evaluateBookingDateForConfirmation({ targetDate: current.eventDate, currentDate: await providerCalendarDate(tx, current.providerId, now), exceptions: await bookingDateExceptions(tx, current.providerId, current.eventDate) });
    if (nextStatus === "confirmed" && !confirmationDate.available) return { error: 409, message: confirmationDate.reason === "past_event" ? "This booking can no longer be confirmed because its event date has passed." : "The provider explicitly blocked this event date after offering the booking. Contact the provider to resolve it." } as const;
    const [updated] = await tx.update(cateringBookings).set({ customerConfirmedAt: now, status: nextStatus, confirmedAt: nextStatus === "confirmed" ? now : null, updatedAt: now }).where(and(eq(cateringBookings.id, id), eq(cateringBookings.customerId, customerId), eq(cateringBookings.status, "pending_confirmation"))).returning();
    if (updated) await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: customerId, eventType: "customer_confirmed", visibility: "shared", metadata: {} });
    return updated ? { booking: updated, notify: true } as const : { error: 409, message: "Booking changed before confirmation completed" } as const;
  });
  if ("error" in result) return res.status(result.error).json({ message: result.message });
  const updated = result.booking;
  if (!result.notify) return res.json({ booking: serializeCateringBooking(updated) });
  await db.insert(notifications).values({ userId: updated.providerId, type: "catering_booking_confirmed", title: "Catering booking confirmed", message: "The customer explicitly accepted the booking terms.", linkUrl: CATERING_PROVIDER_BOOKINGS_URL }).catch(() => undefined);
  res.json({ booking: serializeCateringBooking(updated) });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

r.post("/bookings/:id/cancel", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const userId = (req.user as { id: string }).id; const input = cateringBookingCancelSchema.parse(req.body ?? {}); const now = new Date();
  const [current] = await db.select().from(cateringBookings).where(and(eq(cateringBookings.id, id), or(eq(cateringBookings.providerId, userId), eq(cateringBookings.customerId, userId)))).limit(1);
  if (!current) return res.status(404).json({ message: "Booking not found" }); const actor = bookingActor(current, userId)!;
  if (!mayCancel(current.status)) return res.status(409).json({ message: "Completed or cancelled bookings cannot be cancelled" });
  const updated = await db.transaction(async (tx: typeof db) => { const [row] = await tx.update(cateringBookings).set({ status: "cancelled", cancelledAt: now, cancelledBy: actor, cancellationReason: input.reason ?? null, updatedAt: now }).where(and(eq(cateringBookings.id, id), or(eq(cateringBookings.status, "pending_confirmation"), eq(cateringBookings.status, "confirmed")))).returning(); if (row) await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: userId, eventType: "booking_cancelled", visibility: "shared", metadata: {} }); return row; });
  if (!updated) return res.status(409).json({ message: "Booking changed before cancellation completed" });
  const recipient = actor === "provider" ? updated.customerId : updated.providerId; await db.insert(notifications).values({ userId: recipient, type: "catering_booking_cancelled", title: "Catering booking cancelled", message: "The catering booking was cancelled. Open it for current status.", linkUrl: actor === "provider" ? CATERING_CUSTOMER_BOOKINGS_URL : CATERING_PROVIDER_BOOKINGS_URL }).catch(() => undefined);
  res.json({ booking: serializeCateringBooking(updated) });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

r.post("/bookings/:id/complete", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const providerId = (req.user as { id: string }).id; const now = new Date();
  const [current] = await db.select().from(cateringBookings).where(and(eq(cateringBookings.id, id), eq(cateringBookings.providerId, providerId))).limit(1);
  if (!current) return res.status(404).json({ message: "Booking not found" });
  const timezone = (await db.select({ timezone: cateringAvailabilitySettings.timezone }).from(cateringAvailabilitySettings).where(eq(cateringAvailabilitySettings.providerId, providerId)).limit(1))[0]?.timezone ?? "UTC";
  if (!mayComplete(current, "provider", calendarDateInTimezone(now, timezone))) return res.status(409).json({ message: "Only a confirmed event on or after its event date can be marked complete" });
  const updated = await db.transaction(async (tx: typeof db) => { await lockCateringReviewRelationship(tx, current.customerId, current.providerId); const [row] = await tx.update(cateringBookings).set({ status: "completed", completedAt: now, updatedAt: now }).where(and(eq(cateringBookings.id, id), eq(cateringBookings.providerId, providerId), eq(cateringBookings.status, "confirmed"))).returning(); if (!row) return null; await tx.update(cateringReviews).set({ verifiedEvent: true, updatedAt: now }).where(and(eq(cateringReviews.providerId, row.providerId), eq(cateringReviews.reviewerId, row.customerId), eq(cateringReviews.verifiedEvent, false))); await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: providerId, eventType: "booking_completed", visibility: "shared", metadata: {} }); return row; });
  if (!updated) return res.status(409).json({ message: "Booking changed before completion finished" });
  await db.insert(notifications).values({ userId: updated.customerId, type: "catering_booking_completed", title: "Catering event marked complete", message: "Your provider recorded the event as complete. A linked review can now be verified.", linkUrl: CATERING_CUSTOMER_BOOKINGS_URL }).catch(() => undefined);
  res.json({ booking: serializeCateringBooking(updated) });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

export default r;
