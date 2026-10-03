import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, count, desc, eq, gte, lte, or } from "drizzle-orm";
import { z } from "zod";
import { cateringAvailabilityExceptions, cateringAvailabilitySettings, cateringBookingActivity, cateringBookings, cateringPackages, cateringReviews, notifications } from "@shared/schema";
import { cateringBookingCancelSchema, cateringBookingIdSchema, cateringBookingPageSchema } from "@shared/catering-bookings";
import { cateringFirstOfferSchema, cateringOfferAcceptSchema } from "@shared/catering-offers";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { calendarDateInTimezone } from "../services/catering-availability";
import { providerCalendarDate } from "../services/catering-provider-calendar";
import { evaluateBookingDateForConfirmation, evaluateBookingDateForOffer } from "../services/catering-booking-availability";
import { bookingActor, mayCancel, mayComplete, mayConfirm, mayInquiryProduceBooking, nextConfirmationStatus } from "../services/catering-booking-policy";
import { serializeCateringBooking } from "../serializers/catering-booking";
import { CATERING_CUSTOMER_BOOKINGS_URL, CATERING_PROVIDER_BOOKINGS_URL } from "../services/catering-booking-links";
import { lockCateringInquiry } from "../services/catering-inquiry-withdrawal";
import { lockCateringReviewRelationship } from "../services/catering-review-relationship-lock";
import { acceptanceRetryContradictsAccepted, bookingTermsFromRevision, createProviderOfferRevision, listCateringOfferRevisions, resolveCateringOfferAcceptance, stampCateringOfferAccepted } from "../services/catering-offer-negotiation";

const r = Router();
async function bookingDateExceptions(executor: typeof db, providerId: string, targetDate: string) {
  const exceptions = await executor.select().from(cateringAvailabilityExceptions).where(and(eq(cateringAvailabilityExceptions.providerId, providerId), lte(cateringAvailabilityExceptions.startDate, targetDate), gte(cateringAvailabilityExceptions.endDate, targetDate)));
  return exceptions;
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
  const inquiryId = cateringBookingIdSchema.parse(req.params.inquiryId); const providerId = (req.user as { id: string }).id; const offer = cateringFirstOfferSchema.parse(req.body ?? {}); const now = new Date();
  const result = await db.transaction(async (tx: typeof db) => {
    // The inquiry row is locked before its status is judged, and a customer's withdrawal locks the same row before it looks
    // for a booking, so an inquiry can end up withdrawn or booked but never both.
    const locked = await lockCateringInquiry(tx, inquiryId);
    const inquiry = locked && locked.chefId === providerId ? locked : undefined;
    if (!inquiry) return { error: 404, message: "Accepted inquiry not found" } as const;
    if (!mayInquiryProduceBooking(inquiry)) return { error: 409, message: "Only an accepted inquiry can be offered for booking" } as const;
    const [pkg] = inquiry.packageId ? await tx.select().from(cateringPackages).where(and(eq(cateringPackages.id, inquiry.packageId), eq(cateringPackages.providerId, providerId))).limit(1) : [];
    const eventDate = calendarDateInTimezone(inquiry.eventDate, "UTC");
    const offerDate = evaluateBookingDateForOffer({ targetDate: eventDate, currentDate: await providerCalendarDate(tx, providerId, now), exceptions: await bookingDateExceptions(tx, providerId, eventDate) });
    if (!offerDate.available) return { error: 409, message: offerDate.reason === "past_event" ? "Booking terms cannot be offered after the event date." : "This event date is explicitly blocked. Remove the date block before offering booking terms." } as const;
    // Omitted means "the request's own guest count"; an explicit null is the provider clearing it, and stays cleared in the booking and in revision 1 alike.
    const initialGuestCount = offer.guestCount === undefined ? inquiry.guestCount : offer.guestCount;
    const [created] = await tx.insert(cateringBookings).values({ inquiryId, providerId, customerId: inquiry.customerId, packageId: pkg?.id ?? null, eventDate, eventType: inquiry.eventType, guestCount: initialGuestCount, agreedPrice: offer.priceCents === null ? undefined : bookingTermsFromRevision({ priceCents: offer.priceCents, guestCount: null, currency: offer.currency }).agreedPrice, currency: offer.currency, packageTitleSnapshot: pkg?.title ?? null, packagePricingModelSnapshot: pkg?.pricingModel ?? null, packageStartingPriceSnapshot: pkg?.startingPrice ?? null, providerConfirmedAt: now }).onConflictDoNothing({ target: cateringBookings.inquiryId }).returning({ id: cateringBookings.id });
    const [booking] = await tx.select().from(cateringBookings).where(eq(cateringBookings.inquiryId, inquiryId)).limit(1);
    if (!booking || booking.providerId !== providerId) return { error: 409, message: "Booking could not be created" } as const;
    if (booking.status === "pending_confirmation" && !booking.providerConfirmedAt) await tx.update(cateringBookings).set({ providerConfirmedAt: now, updatedAt: now }).where(and(eq(cateringBookings.id, booking.id), eq(cateringBookings.status, "pending_confirmation")));
    const newlyConfirmed = !booking.providerConfirmedAt;
    if (created) await tx.insert(cateringBookingActivity).values({ bookingId: booking.id, actorUserId: providerId, eventType: "booking_offered", visibility: "shared", metadata: {} });
    if (created) {
      // A brand-new offer is revision 1 of its own negotiation, written in the transaction that creates the booking. A retry finds the booking and writes nothing.
      const first = await createProviderOfferRevision(tx, { bookingId: created.id, providerId, terms: { priceCents: offer.priceCents, guestCount: initialGuestCount, note: offer.note, currency: offer.currency }, expectedRevisionId: null, clientRequestId: randomUUID(), now });
      if (first.kind === "refused") throw new Error("first offer revision was refused");
    }
    const [fresh] = await tx.select().from(cateringBookings).where(eq(cateringBookings.id, booking.id)).limit(1); return { booking: fresh, notify: Boolean(created || newlyConfirmed) } as const;
  });
  if ("error" in result) return res.status(result.error).json({ message: result.message });
  if (result.notify) await db.insert(notifications).values({ userId: result.booking.customerId, type: "catering_booking_confirmation", title: "Catering booking ready to confirm", message: "Your provider has offered booking terms for your explicit confirmation.", linkUrl: CATERING_CUSTOMER_BOOKINGS_URL }).catch(() => undefined);
  res.status(result.notify ? 201 : 200).json({ booking: serializeCateringBooking(result.booking) });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

r.post("/bookings/:id/customer-confirm", requireAuth, async (req, res, next) => { try {
  const id = cateringBookingIdSchema.parse(req.params.id); const customerId = (req.user as { id: string }).id; const now = new Date();
  // The terms being accepted are named by the client and judged by the server: a body naming no revision means "the legacy offer".
  const accepting = cateringOfferAcceptSchema.parse(req.body ?? {});
  type Refusal = { error: 404 | 409; message: string; code?: string };
  const result = await db.transaction(async (tx: typeof db): Promise<Refusal | { booking: typeof cateringBookings.$inferSelect; notify: boolean }> => {
    // The booking row is locked before anything is judged, so a provider revising and a customer accepting are serialized on it.
    const [current] = await tx.select().from(cateringBookings).where(and(eq(cateringBookings.id, id), eq(cateringBookings.customerId, customerId))).limit(1).for("update");
    if (!current) return { error: 404, message: "Booking not found" };
    const revisions = await listCateringOfferRevisions(tx, id);
    if (current.customerConfirmedAt) {
      if (acceptanceRetryContradictsAccepted(revisions, accepting.revisionId)) return { error: 409, code: "stale_revision", message: "A different version of this offer was already accepted. Review the booking for its current terms." };
      return { booking: current, notify: false };
    }
    if (!mayConfirm(current, "customer")) return { error: 409, code: "negotiation_closed", message: "Booking can no longer be confirmed" };
    const acceptance = resolveCateringOfferAcceptance(revisions, accepting.revisionId ?? null);
    if (acceptance.kind === "refused") return { error: 409, code: acceptance.code, message: acceptance.message };
    const nextStatus = nextConfirmationStatus(current, "customer");
    const confirmationDate = evaluateBookingDateForConfirmation({ targetDate: current.eventDate, currentDate: await providerCalendarDate(tx, current.providerId, now), exceptions: await bookingDateExceptions(tx, current.providerId, current.eventDate) });
    if (nextStatus === "confirmed" && !confirmationDate.available) return { error: 409, message: confirmationDate.reason === "past_event" ? "This booking can no longer be confirmed because its event date has passed." : "The provider explicitly blocked this event date after offering the booking. Contact the provider to resolve it." };
    // The accepted revision's terms are written onto the booking in the same statement that confirms it, so the booking can never
    // confirm with terms other than the revision that was accepted. A legacy offer has no revision and keeps its own stored terms.
    const terms = acceptance.revision ? bookingTermsFromRevision(acceptance.revision) : {};
    const [updated] = await tx.update(cateringBookings).set({ ...terms, customerConfirmedAt: now, status: nextStatus, confirmedAt: nextStatus === "confirmed" ? now : null, updatedAt: now }).where(and(eq(cateringBookings.id, id), eq(cateringBookings.customerId, customerId), eq(cateringBookings.status, "pending_confirmation"))).returning();
    if (!updated) return { error: 409, message: "Booking changed before confirmation completed" };
    if (acceptance.revision) await stampCateringOfferAccepted(tx, acceptance.revision, now);
    await tx.insert(cateringBookingActivity).values({ bookingId: id, actorUserId: customerId, eventType: "customer_confirmed", visibility: "shared", metadata: {} });
    return { booking: updated, notify: true };
  });
  if ("error" in result) return res.status(result.error).json({ message: result.message, ...(result.code ? { code: result.code } : {}) });
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
