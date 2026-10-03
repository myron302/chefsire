import { Router } from "express";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { cateringBookings, notifications } from "@shared/schema";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { cateringOfferChangeRequestSchema, cateringOfferRevisionRequestSchema } from "@shared/catering-offers";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { bookingActor } from "../services/catering-booking-policy";
import { CATERING_CUSTOMER_BOOKINGS_URL, CATERING_PROVIDER_BOOKINGS_URL } from "../services/catering-booking-links";
import { buildCateringOfferNegotiationView, createCustomerChangeRequest, createProviderOfferRevision, listCateringOfferRevisions } from "../services/catering-offer-negotiation";

/**
 * Phase 2N negotiation endpoints. Identity is the session user and nothing else: no id in a body, query or path names an
 * actor. A booking the caller is not a party to, and one that does not exist, answer the same 404. The acceptance of an
 * offer is the existing `customer-confirm`, made revision-aware in catering-bookings.ts; declining is the existing cancel.
 */
const r = Router();
const NOT_FOUND = { message: "Booking not found" };

/** Whichever end of this booking the session user is, resolved from the persisted booking and never from the request. */
async function participantBooking(executor: typeof db, rawId: string, userId: string) {
  const id = cateringBookingIdSchema.safeParse(rawId);
  if (!id.success) return null;
  const [booking] = await executor.select().from(cateringBookings).where(and(eq(cateringBookings.id, id.data), or(eq(cateringBookings.providerId, userId), eq(cateringBookings.customerId, userId)))).limit(1);
  const role = booking ? bookingActor(booking, userId) : null;
  return booking && role ? { booking, role } : null;
}

r.get("/bookings/:id/offer", requireAuth, async (req, res, next) => { try {
  const userId = (req.user as { id: string }).id;
  const found = await participantBooking(db, req.params.id, userId);
  if (!found) return res.status(404).json(NOT_FOUND);
  const revisions = await listCateringOfferRevisions(db, found.booking.id);
  res.json({ negotiation: buildCateringOfferNegotiationView(found.booking, found.role, revisions) });
} catch (error) { next(error); } });

r.post("/bookings/:id/offer/revisions", requireAuth, async (req, res, next) => { try {
  const providerId = (req.user as { id: string }).id;
  const bookingId = cateringBookingIdSchema.safeParse(req.params.id);
  if (!bookingId.success) return res.status(404).json(NOT_FOUND);
  const input = cateringOfferRevisionRequestSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    const outcome = await createProviderOfferRevision(tx, { bookingId: bookingId.data, providerId, terms: { priceCents: input.priceCents, guestCount: input.guestCount, note: input.note, currency: input.currency }, expectedRevisionId: input.expectedRevisionId, clientRequestId: input.clientRequestId, now: new Date() });
    if (outcome.kind === "refused") return outcome;
    return { ...outcome, negotiation: buildCateringOfferNegotiationView(outcome.booking, "provider", await listCateringOfferRevisions(tx, outcome.booking.id)) };
  });
  if (result.kind === "refused") return res.status(result.status).json({ message: result.message, ...(result.code ? { code: result.code } : {}) });
  // Told only about a revision that now exists, and only the first time it is sent: a retry of the same submission is not news.
  if (result.kind === "created") {
    await db.insert(notifications).values({ userId: result.booking.customerId, type: "catering_offer_revised", title: "Catering offer updated", message: "Your caterer revised their offer. Review the latest terms before you respond.", linkUrl: CATERING_CUSTOMER_BOOKINGS_URL }).catch(() => undefined);
  }
  res.status(result.kind === "created" ? 201 : 200).json({ negotiation: result.negotiation });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || "Invalid offer" }); next(error); } });

r.post("/bookings/:id/offer/change-requests", requireAuth, async (req, res, next) => { try {
  const customerId = (req.user as { id: string }).id;
  const bookingId = cateringBookingIdSchema.safeParse(req.params.id);
  if (!bookingId.success) return res.status(404).json(NOT_FOUND);
  const input = cateringOfferChangeRequestSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    const outcome = await createCustomerChangeRequest(tx, { bookingId: bookingId.data, customerId, revisionId: input.revisionId, message: input.message, clientRequestId: input.clientRequestId });
    if (outcome.kind === "refused") return outcome;
    return { ...outcome, negotiation: buildCateringOfferNegotiationView(outcome.booking, "customer", await listCateringOfferRevisions(tx, outcome.booking.id)) };
  });
  if (result.kind === "refused") return res.status(result.status).json({ message: result.message, ...(result.code ? { code: result.code } : {}) });
  // The message itself stays in the negotiation; the notification carries no customer text or contact detail.
  if (result.kind === "created") {
    await db.insert(notifications).values({ userId: result.booking.providerId, type: "catering_offer_change_requested", title: "Customer asked for offer changes", message: "A customer asked for changes to your offer. Open the booking to review and respond.", linkUrl: CATERING_PROVIDER_BOOKINGS_URL }).catch(() => undefined);
  }
  res.status(result.kind === "created" ? 201 : 200).json({ negotiation: result.negotiation });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || "Invalid change request" }); next(error); } });

export default r;
