import { Router } from "express";
import { z } from "zod";
import { notifications } from "@shared/schema";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { cateringAmendmentIdSchema, cateringAmendmentProposalSchema, cateringAmendmentResponseSchema } from "@shared/catering-amendments";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { ownedCateringBooking } from "../services/catering-booking-access";
import { bookingActor } from "../services/catering-booking-policy";
import { CATERING_CUSTOMER_BOOKINGS_URL, CATERING_PROVIDER_BOOKINGS_URL } from "../services/catering-booking-links";
import { buildCateringAmendmentsView, proposeCateringAmendment, respondToCateringAmendment, type AmendmentAction } from "../services/catering-booking-amendments";

/**
 * Phase 2O amendment endpoints. Identity is the session user and nothing else: no id in a body, query or path names an
 * actor, and no body key names a booking column. A booking the caller is not a party to, and one that does not exist,
 * answer the same 404. Notifications say that something happened, never what: no price, date or note is in one.
 */
const r = Router();
const NOT_FOUND = { message: "Booking not found" };

r.get("/bookings/:id/amendments", requireAuth, async (req, res, next) => { try {
  const userId = (req.user as { id: string }).id;
  const id = cateringBookingIdSchema.safeParse(req.params.id);
  const booking = id.success ? await ownedCateringBooking(id.data, userId) : undefined;
  const role = booking ? bookingActor(booking, userId) : null;
  if (!booking || !role) return res.status(404).json(NOT_FOUND);
  res.json({ amendments: await buildCateringAmendmentsView(db, booking, role) });
} catch (error) { next(error); } });

r.post("/bookings/:id/amendments", requireAuth, async (req, res, next) => { try {
  const userId = (req.user as { id: string }).id;
  const bookingId = cateringBookingIdSchema.safeParse(req.params.id);
  if (!bookingId.success) return res.status(404).json(NOT_FOUND);
  const proposal = cateringAmendmentProposalSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => {
    const outcome = await proposeCateringAmendment(tx, { bookingId: bookingId.data, userId, proposal, now: new Date() });
    if (outcome.kind === "refused") return outcome;
    return { ...outcome, view: await buildCateringAmendmentsView(tx, outcome.booking, outcome.role) };
  });
  if (result.kind === "refused") return res.status(result.status).json({ message: result.message, ...(result.code ? { code: result.code } : {}) });
  // Told only about an amendment that now exists, and only the first time it is sent: a retry is not news.
  if (result.kind === "created") await notifyCounterparty(result.booking, result.role, "catering_amendment_proposed", "Catering booking change proposed", "A change to your catering booking was proposed. Open the booking to review it; nothing changes until you respond.");
  res.status(result.kind === "created" ? 201 : 200).json({ amendments: result.view });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || "Invalid amendment" }); next(error); } });

const RESPONSES: Record<AmendmentAction, { type: string; title: string; message: string }> = {
  accept: { type: "catering_amendment_accepted", title: "Catering booking change accepted", message: "Your proposed change to the catering booking was accepted. The booking now carries the new terms." },
  decline: { type: "catering_amendment_declined", title: "Catering booking change declined", message: "Your proposed change to the catering booking was declined. The booking's terms are unchanged." },
  withdraw: { type: "catering_amendment_withdrawn", title: "Catering booking change withdrawn", message: "A proposed change to your catering booking was withdrawn. The booking's terms are unchanged." },
};

for (const action of ["accept", "decline", "withdraw"] as const) {
  r.post(`/bookings/:id/amendments/:amendmentId/${action}`, requireAuth, async (req, res, next) => { try {
    const userId = (req.user as { id: string }).id;
    const bookingId = cateringBookingIdSchema.safeParse(req.params.id);
    const amendmentId = cateringAmendmentIdSchema.safeParse(req.params.amendmentId);
    if (!bookingId.success || !amendmentId.success) return res.status(404).json(NOT_FOUND);
    cateringAmendmentResponseSchema.parse(req.body ?? {});
    const result = await db.transaction(async (tx: typeof db) => {
      const outcome = await respondToCateringAmendment(tx, { bookingId: bookingId.data, amendmentId: amendmentId.data, userId, action, now: new Date() });
      if (outcome.kind === "refused") return outcome;
      return { ...outcome, view: await buildCateringAmendmentsView(tx, outcome.booking, outcome.role) };
    });
    if (result.kind === "refused") return res.status(result.status).json({ message: result.message, ...(result.code ? { code: result.code } : {}) });
    if (result.kind === "done") {
      const note = RESPONSES[action];
      // The recipient is always the party who did not act: the proposer for accept / decline, the other party for a withdrawal.
      await notifyCounterparty(result.booking, result.role, note.type, note.title, note.message);
    }
    res.json({ amendments: result.view });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || "Invalid request" }); next(error); } });
}

async function notifyCounterparty(booking: { providerId: string; customerId: string }, actor: "provider" | "customer", type: string, title: string, message: string) {
  const toProvider = actor === "customer";
  await db.insert(notifications).values({ userId: toProvider ? booking.providerId : booking.customerId, type, title, message, linkUrl: toProvider ? CATERING_PROVIDER_BOOKINGS_URL : CATERING_CUSTOMER_BOOKINGS_URL }).catch(() => undefined);
}

export default r;
