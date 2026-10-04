import { Router } from "express";
import { z } from "zod";
import { notifications } from "@shared/schema";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import { cateringWorkspaceRole } from "@shared/catering-booking-operations";
import { cateringBillingSectionPath } from "@shared/catering-booking-billing";
import {
  CATERING_ADJUSTMENT_NOTIFICATIONS,
  cateringAdjustmentCreateSchema,
  cateringAdjustmentIdSchema,
  cateringAdjustmentReverseSchema,
} from "@shared/catering-billing-adjustments";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { ownedCateringBooking } from "../services/catering-booking-access";
import { cateringCounterpart } from "../services/catering-booking-communication-policy";
import { CATERING_BILLING_FORBIDDEN_MESSAGE, cateringBillingDay } from "../services/catering-booking-billing-policy";
import { CATERING_ADJUSTMENT_NOT_FOUND_MESSAGE, postCateringAdjustment, reverseCateringAdjustment } from "../services/catering-booking-adjustments";
import { freshView } from "./catering-booking-billing";

/**
 * Phase 2P adjustment endpoints, inside the existing catering booking billing namespace.
 *
 * Two provider-only writes. Nothing here charges a card, calls a payment processor or sends money, and no transaction
 * identifier is ever invented: a refund row is the provider's RECORD that money was returned outside ChefSire.
 *
 * AUTHORIZATION, as in every other catering route:
 *  1. the actor is `req.user.id` and nothing else; no body key names a user, provider, role or booking column;
 *  2. the booking is resolved by `ownedCateringBooking`, restricted to its persisted provider or customer, so a guessed
 *     booking id, another provider's booking and another customer's booking are one indistinguishable 404;
 *  3. the role is derived from the resolved booking; a customer is read-only here (403) and cannot credit themselves,
 *     record a refund or change an amount, currency or kind;
 *  4. the service re-checks the provider against the LOCKED booking inside the transaction.
 *
 * Unlike Phase 2L's mutations these are NOT closed by cancellation, because refunds are what a cancellation is followed
 * by; which kinds each booking status permits is `cateringAdjustmentKindsRecordable`, judged under the booking's lock.
 */
const r = Router();
type Res = Parameters<Parameters<typeof r.get>[1]>[1];

const NOT_FOUND = { message: CATERING_ADJUSTMENT_NOT_FOUND_MESSAGE };

function invalid(error: unknown, res: Res, next: (error: unknown) => void) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
  next(error);
}

async function resolveProvider(req: { params: { id: string }; user?: { id: string } }, res: Res) {
  const id = cateringBookingIdSchema.safeParse(req.params.id);
  if (!id.success) { res.status(404).json(NOT_FOUND); return null; }
  const userId = req.user!.id;
  const booking = await ownedCateringBooking(id.data, userId);
  if (!booking) { res.status(404).json(NOT_FOUND); return null; }
  const role = cateringWorkspaceRole(booking, userId) as "provider" | "customer";
  if (role !== "provider") { res.status(403).json({ message: CATERING_BILLING_FORBIDDEN_MESSAGE }); return null; }
  // One billing day per request, the provider's own calendar day, exactly as Phase 2L resolves it.
  const asOfDate = await cateringBillingDay(db, booking.providerId);
  return { id: id.data, userId, booking, role, asOfDate };
}

/** Best effort, after commit: a notification that cannot be delivered never un-posts what the ledger already holds. */
async function notifyCustomer(booking: { providerId: string; customerId: string }, actorId: string, bookingId: string, notification: { type: string; title: string; message: string }) {
  const customerId = cateringCounterpart(booking, actorId);
  if (!customerId) return;
  await db.insert(notifications).values({
    userId: customerId, type: notification.type, title: notification.title, message: notification.message,
    linkUrl: cateringBillingSectionPath("customer", bookingId),
  }).catch(() => undefined);
}

function refuse(res: Res, refusal: { status: number; message: string; code?: string }) {
  return res.status(refusal.status).json(refusal.code ? { message: refusal.message, code: refusal.code } : { message: refusal.message });
}

/**
 * Record an additional charge, a credit, or a refund the provider has ALREADY returned outside ChefSire.
 *
 * Idempotent on the client's key: an exact replay returns the entry the first attempt created and writes no second row and
 * sends no second notification; the same key with a different kind, amount, currency, reason or payment is a 409.
 */
r.post("/bookings/:id/billing/adjustments", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveProvider(req as never, res);
  if (!resolved) return;
  const entry = cateringAdjustmentCreateSchema.parse(req.body ?? {});
  const result = await db.transaction(async (tx: typeof db) => postCateringAdjustment(tx, { bookingId: resolved.id, userId: resolved.userId, entry }));
  if (result.kind === "refused") return refuse(res, result);
  // Told only about an entry that now exists, and only the first time. The text names no amount and no payment detail.
  if (result.kind === "created") await notifyCustomer(resolved.booking, resolved.userId, resolved.id, CATERING_ADJUSTMENT_NOTIFICATIONS.posted);
  res.status(result.kind === "created" ? 201 : 200).json({ ...(await freshView(resolved)), duplicate: result.kind === "duplicate" });
} catch (error) { invalid(error, res, next); } });

/**
 * Reverse a provider-recorded entry that was entered in error. The row is kept, with the reason the customer will read,
 * and stops counting; nothing is deleted. An entry that came from an accepted amendment cannot be reversed here.
 */
r.post("/bookings/:id/billing/adjustments/:entryId/reverse", requireAuth, async (req, res, next) => { try {
  const resolved = await resolveProvider(req as never, res);
  if (!resolved) return;
  const entryId = cateringAdjustmentIdSchema.safeParse(req.params.entryId);
  if (!entryId.success) return res.status(404).json(NOT_FOUND);
  const body = cateringAdjustmentReverseSchema.parse(req.body ?? {});
  const now = new Date();
  const result = await db.transaction(async (tx: typeof db) => reverseCateringAdjustment(tx, { bookingId: resolved.id, entryId: entryId.data, userId: resolved.userId, reason: body.reason, now }));
  if (result.kind === "refused") return refuse(res, result);
  if (result.kind === "reversed") await notifyCustomer(resolved.booking, resolved.userId, resolved.id, CATERING_ADJUSTMENT_NOTIFICATIONS.reversed);
  res.json({ ...(await freshView(resolved)), duplicate: result.kind === "already" });
} catch (error) { invalid(error, res, next); } });

export default r;
