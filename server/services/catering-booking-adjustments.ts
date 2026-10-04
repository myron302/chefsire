import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  cateringBookingAdjustments, cateringBookingAmendments, cateringBookingInvoices, cateringBookingPayments, cateringBookings,
  type CateringBooking, type CateringBookingAdjustment, type CateringBookingAmendment, type CateringBookingInvoice, type CateringBookingPayment,
} from "@shared/schema";
import { cateringMoneyToCents } from "@shared/catering-booking-billing";
import {
  CATERING_ADJUSTMENT_REPLAY_CONFLICT_MESSAGE, CATERING_ADJUSTMENT_REFUSAL_COPY, cateringAdjustmentCounts, cateringAdjustmentKindsRecordable, cateringAdjustmentKindsReversible,
  cateringAdjustmentReplayMatches, cateringAmendedPriceKeepsLedgerCoherent, cateringAmendmentLedgerEffect, cateringCreditCeilingCents, cateringRefundCeilingCents,
  deriveCateringLedgerPosition, resolveCateringAdjustment, resolveCateringAdjustmentReversal,
  type CateringAdjustmentActions, type CateringAdjustmentCreateInput, type CateringAdjustmentFacts,
} from "@shared/catering-billing-adjustments";
import { cateringAdjustmentFactOf } from "./catering-booking-billing-policy";
import type { db } from "../db";

type Executor = typeof db;

/**
 * Phase 2P adjustment writes, one booking at a time.
 *
 * LOCK ORDER, identical to Phase 2L billing: the booking's advisory billing lock first, then its row lock. That order is
 * what keeps a charge, a credit, a refund, an invoice, a payment, a void and a reversal all serialized on one booking
 * without a deadlock between them. Phase 2O amendment acceptance takes the ROW lock only and never the advisory one, so
 * it can wait on a billing write but never hold something a billing write is waiting for.
 *
 * Every ceiling is asserted here, in the transaction that inserts the row, against the rows read UNDER those locks. The
 * rules themselves are pure functions in `shared/catering-billing-adjustments.ts`.
 */
export async function lockCateringBilling(tx: Executor, bookingId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`catering-billing:${bookingId}`}))`);
}

export type LedgerRows = { adjustments: CateringBookingAdjustment[]; payments: CateringBookingPayment[]; invoices: CateringBookingInvoice[] };

export async function loadLedgerRows(tx: Executor, bookingId: string): Promise<LedgerRows> {
  const adjustments = await tx.select().from(cateringBookingAdjustments).where(eq(cateringBookingAdjustments.bookingId, bookingId))
    .orderBy(asc(cateringBookingAdjustments.createdAt), asc(cateringBookingAdjustments.id)) as CateringBookingAdjustment[];
  const payments = await tx.select().from(cateringBookingPayments).where(eq(cateringBookingPayments.bookingId, bookingId)) as CateringBookingPayment[];
  const invoices = await tx.select().from(cateringBookingInvoices).where(eq(cateringBookingInvoices.bookingId, bookingId)) as CateringBookingInvoice[];
  return { adjustments, payments, invoices };
}

export function adjustmentFactsOf(booking: Pick<CateringBooking, "status" | "agreedPrice" | "currency">, rows: LedgerRows): CateringAdjustmentFacts {
  return {
    bookingStatus: booking.status,
    currency: booking.currency,
    agreedTotalCents: booking.agreedPrice === null ? null : cateringMoneyToCents(booking.agreedPrice),
    liveInvoicedCents: rows.invoices.reduce((total, invoice) => (invoice.status === "issued" ? total + invoice.amountCents : total), 0),
    paidTotalCents: rows.payments.reduce((total, payment) => (payment.status === "recorded" ? total + payment.amountCents : total), 0),
    payments: rows.payments.map((payment) => ({ id: payment.id, amountCents: payment.amountCents, currency: payment.currency, status: payment.status as "recorded" | "voided" })),
    adjustments: rows.adjustments.map(cateringAdjustmentFactOf),
  };
}

/** What the provider may do right now and the limits their forms state, derived from the same facts the writes are judged on. */
export function adjustmentActionsFor(facts: CateringAdjustmentFacts): CateringAdjustmentActions {
  const position = deriveCateringLedgerPosition({ agreedTotalCents: facts.agreedTotalCents, paidTotalCents: facts.paidTotalCents, adjustments: facts.adjustments });
  const hasPrice = position.obligationCents !== null;
  return {
    kinds: cateringAdjustmentKindsRecordable(facts.bookingStatus).filter((kind) => kind === "refund" || hasPrice) as CateringAdjustmentActions["kinds"],
    reversibleKinds: [...cateringAdjustmentKindsReversible(facts.bookingStatus)],
    maxCreditCents: cateringCreditCeilingCents(position),
    maxRefundCents: cateringRefundCeilingCents({ paidTotalCents: facts.paidTotalCents, adjustments: facts.adjustments }),
  };
}

/** The amendment numbers entries refer to, so the history can say "from amendment 2" without exposing amendment internals. */
export async function amendmentNumbersFor(tx: Executor, adjustments: readonly CateringBookingAdjustment[]): Promise<Map<string, number>> {
  const ids = adjustments.map((row) => row.amendmentId).filter((id): id is string => id !== null);
  if (ids.length === 0) return new Map();
  const rows = await tx.select({ id: cateringBookingAmendments.id, number: cateringBookingAmendments.amendmentNumber }).from(cateringBookingAmendments).where(inArray(cateringBookingAmendments.id, ids));
  return new Map(rows.map((row: { id: string; number: number }) => [row.id, row.number]));
}

async function lockedBooking(tx: Executor, bookingId: string): Promise<CateringBooking | undefined> {
  const [row] = await tx.select().from(cateringBookings).where(eq(cateringBookings.id, bookingId)).limit(1).for("update");
  return row;
}

export type AdjustmentRefusal = { kind: "refused"; status: 403 | 404 | 409; message: string; code?: string };
const refused = (status: 403 | 404 | 409, message: string, code?: string): AdjustmentRefusal => ({ kind: "refused", status, message, ...(code ? { code } : {}) });
export const CATERING_ADJUSTMENT_FORBIDDEN_MESSAGE = "Only the caterer on this booking can change its billing.";
export const CATERING_ADJUSTMENT_NOT_FOUND_MESSAGE = "Booking billing not found";

/** The provider of the LOCKED booking, or the refusal that role earns. A customer is a participant (403), a stranger is nobody (404). */
function providerOnly(booking: CateringBooking | undefined, userId: string): AdjustmentRefusal | null {
  if (!booking) return refused(404, CATERING_ADJUSTMENT_NOT_FOUND_MESSAGE);
  if (booking.providerId === userId) return null;
  return booking.customerId === userId ? refused(403, CATERING_ADJUSTMENT_FORBIDDEN_MESSAGE) : refused(404, CATERING_ADJUSTMENT_NOT_FOUND_MESSAGE);
}

export type PostAdjustmentResult = AdjustmentRefusal | { kind: "created" | "duplicate"; entry: CateringBookingAdjustment; booking: CateringBooking };

export async function postCateringAdjustment(tx: Executor, input: { bookingId: string; userId: string; entry: CateringAdjustmentCreateInput }): Promise<PostAdjustmentResult> {
  await lockCateringBilling(tx, input.bookingId);
  const booking = await lockedBooking(tx, input.bookingId);
  const denied = providerOnly(booking, input.userId);
  if (denied) return denied;
  const rows = await loadLedgerRows(tx, input.bookingId);
  // A retry of an attempt that already landed resolves to THAT entry, before any rule that could refuse it afresh. But it
  // must be the same entry: a changed amount, reason, kind or payment under the same key is a conflict, never "already done".
  const existing = rows.adjustments.find((row) => row.idempotencyKey === input.entry.idempotencyKey);
  if (existing) {
    const same = cateringAdjustmentReplayMatches(
      { kind: existing.entryKind, amountCents: existing.amountCents, currency: existing.currency, reason: existing.reason, paymentId: existing.paymentId ?? null, reference: existing.reference ?? null },
      { kind: input.entry.kind, amountCents: input.entry.amountCents, currency: input.entry.currency, reason: input.entry.reason, paymentId: input.entry.paymentId ?? null, reference: input.entry.reference ?? null },
    );
    return same ? { kind: "duplicate", entry: existing, booking: booking! } : refused(409, CATERING_ADJUSTMENT_REPLAY_CONFLICT_MESSAGE, "catering_billing_state");
  }
  const decision = resolveCateringAdjustment(
    { kind: input.entry.kind, amountCents: input.entry.amountCents, currency: input.entry.currency, paymentId: input.entry.paymentId ?? null },
    adjustmentFactsOf(booking!, rows),
  );
  if (!decision.ok) return refused(409, decision.message, "catering_billing_state");
  const [created] = await tx.insert(cateringBookingAdjustments).values({
    bookingId: input.bookingId, entryKind: input.entry.kind, source: "provider_recorded", status: "posted",
    amountCents: input.entry.amountCents, currency: booking!.currency, reason: input.entry.reason,
    reference: input.entry.kind === "refund" ? input.entry.reference ?? null : null,
    paymentId: input.entry.kind === "refund" ? input.entry.paymentId ?? null : null,
    idempotencyKey: input.entry.idempotencyKey, recordedBy: input.userId,
  }).returning();
  return { kind: "created", entry: created as CateringBookingAdjustment, booking: booking! };
}

export type ReverseAdjustmentResult = AdjustmentRefusal | { kind: "reversed" | "already"; entry: CateringBookingAdjustment; booking: CateringBooking };

export async function reverseCateringAdjustment(tx: Executor, input: { bookingId: string; entryId: string; userId: string; reason: string; now: Date }): Promise<ReverseAdjustmentResult> {
  await lockCateringBilling(tx, input.bookingId);
  const booking = await lockedBooking(tx, input.bookingId);
  const denied = providerOnly(booking, input.userId);
  if (denied) return denied;
  const rows = await loadLedgerRows(tx, input.bookingId);
  const row = rows.adjustments.find((entry) => entry.id === input.entryId);
  if (!row) return refused(404, CATERING_ADJUSTMENT_NOT_FOUND_MESSAGE);
  // Idempotent by STATE, judged first: a retry after a lost response finds the entry already reversed and says so.
  if (row.status === "reversed") return { kind: "already", entry: row, booking: booking! };
  const facts = adjustmentFactsOf(booking!, rows);
  const decision = resolveCateringAdjustmentReversal(facts.adjustments.find((entry) => entry.id === row.id), facts);
  if (!decision.ok) return refused(409, decision.message, "catering_billing_state");
  const [updated] = await tx.update(cateringBookingAdjustments)
    .set({ status: "reversed", reversedAt: input.now, reversedBy: input.userId, reversalReason: input.reason })
    .where(and(eq(cateringBookingAdjustments.id, row.id), eq(cateringBookingAdjustments.status, "posted"))).returning();
  if (!updated) throw new Error("adjustment was not posted after its lock");
  return { kind: "reversed", entry: updated as CateringBookingAdjustment, booking: booking! };
}

/**
 * Phase 2O integration: what accepting a PRICE amendment does to the ledger when billing already exists.
 *
 * Called by amendment acceptance INSIDE its transaction and under the booking's ROW lock, so the ledger entry and the
 * booking's new price commit together or not at all. It judges the move against the rows as they are now, refuses
 * (leaving the amendment pending and the booking untouched) if the ledger could not stay coherent, and otherwise inserts
 * the single entry that explains the difference. The unique amendment index is the backstop against a second one.
 *
 * Returns null when nothing needs recording (no price change), a refusal message when it cannot proceed, or `ok`.
 */
export async function reconcileAmendedPrice(tx: Executor, input: {
  booking: Pick<CateringBooking, "id" | "status" | "agreedPrice" | "currency">;
  amendment: Pick<CateringBookingAmendment, "id" | "amendmentNumber" | "basePriceCents" | "priceCents">;
  userId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const effect = cateringAmendmentLedgerEffect(input.amendment.basePriceCents, input.amendment.priceCents);
  if (effect === null) return { ok: true };
  if (effect === "unreconcilable") return { ok: false, message: CATERING_ADJUSTMENT_REFUSAL_COPY.noAgreedPrice };
  const rows = await loadLedgerRows(tx, input.booking.id);
  const facts = adjustmentFactsOf(input.booking, rows);
  if (!cateringAmendedPriceKeepsLedgerCoherent(input.amendment.priceCents!, facts)) {
    return { ok: false, message: "Accepting this price would leave the billing history inconsistent: it would ask for more than is owed or take the amount owed below zero. Withdraw any unpaid request for payment and propose the change again." };
  }
  await tx.insert(cateringBookingAdjustments).values({
    bookingId: input.booking.id, entryKind: effect.kind, source: "amendment", status: "posted",
    amountCents: effect.amountCents, currency: input.booking.currency,
    reason: `Agreed price changed by accepted amendment ${input.amendment.amendmentNumber}.`,
    amendmentId: input.amendment.id, recordedBy: input.userId,
  });
  return { ok: true };
}

/** Whether any posted-or-reversed ledger entry exists. Counts toward "billing has started", so currency stays fail-closed. */
export async function cateringAdjustmentLedgerActive(executor: Executor, bookingId: string): Promise<boolean> {
  const [row] = await executor.select({ id: cateringBookingAdjustments.id }).from(cateringBookingAdjustments).where(eq(cateringBookingAdjustments.bookingId, bookingId)).limit(1);
  return Boolean(row);
}

/** Kept here so the payment void route and this module share one definition of "money this refund relies on". */
export function cateringPaymentMayBeVoided(input: { payment: Pick<CateringBookingPayment, "id" | "amountCents">; rows: LedgerRows }): { ok: true } | { ok: false; message: string } {
  const referenced = input.rows.adjustments.some((entry) => entry.paymentId === input.payment.id && cateringAdjustmentCounts(cateringAdjustmentFactOf(entry)));
  if (referenced) return { ok: false, message: "A refund has been recorded against this payment. Reverse that refund record first." };
  const paid = input.rows.payments.reduce((total, payment) => (payment.status === "recorded" && payment.id !== input.payment.id ? total + payment.amountCents : total), 0);
  const refunded = input.rows.adjustments.reduce((total, entry) => (entry.entryKind === "refund" && entry.status === "posted" ? total + entry.amountCents : total), 0);
  if (paid < refunded) return { ok: false, message: "Refunds are recorded against money received on this booking. Reverse the refund record first, then take this payment back." };
  return { ok: true };
}

