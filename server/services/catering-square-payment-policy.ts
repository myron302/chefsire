import {
  cateringBillingIsActionable,
  cateringInvoiceCounts,
  cateringPayableCents,
  cateringRemainingOnInvoice,
  type CateringBillingFacts,
  type CateringInvoiceFact,
} from "@shared/catering-booking-billing";
import type { CateringBookingStatus } from "@shared/catering-bookings";
import {
  CATERING_SQUARE_CURRENCY,
  type CateringReconciliationReason,
} from "@shared/catering-square-payments";
import type { SquareOrderFacts, SquarePaymentFacts } from "../lib/square-checkout";

/**
 * Catering Phase 2Q policy: every decision the payment flow makes, as pure functions over rows and Square facts.
 *
 * Nothing here reads a request, a clock, the database or Square. The service resolves facts and hands them in, which is what
 * lets each rule -- what may be asked for, what counts as evidence, whether evidence fits the ledger -- be tested exactly as it
 * runs.
 */

/* ------------------------------------------------------------------------------------------------------------- *
 * What may be asked for
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringSquareAmountDecision =
  | { ok: true; amountCents: number; currency: typeof CATERING_SQUARE_CURRENCY }
  | { ok: false; code: "booking_cancelled" | "invoice_missing" | "invoice_not_payable" | "nothing_payable" | "currency_unsupported"; message: string };

/**
 * The amount a customer may be asked to pay on one invoice, DERIVED from the authoritative ledger facts.
 *
 * It is the invoice's current EFFECTIVE PAYABLE (Phase 2P): after adjustments, after payments already credited, after older
 * sibling invoices that own the balance first. Never the invoice's face amount, never a client number. Zero is refused, so a
 * fully paid, withdrawn or fully allocated-elsewhere invoice can never open a new checkout. USD only in V1.
 */
export function deriveCateringSquareAmount(input: { invoice: CateringInvoiceFact | undefined; facts: CateringBillingFacts }): CateringSquareAmountDecision {
  const { invoice, facts } = input;
  if (!cateringBillingIsActionable(facts.bookingStatus as CateringBookingStatus)) {
    return { ok: false, code: "booking_cancelled", message: "This booking was cancelled, so it can no longer be paid." };
  }
  if (!invoice) return { ok: false, code: "invoice_missing", message: "That request for payment is no longer on this booking." };
  if (!cateringInvoiceCounts(invoice)) return { ok: false, code: "invoice_not_payable", message: "This request for payment has not been sent or was withdrawn." };
  if (invoice.currency !== CATERING_SQUARE_CURRENCY || facts.currency !== CATERING_SQUARE_CURRENCY) {
    return { ok: false, code: "currency_unsupported", message: "Online payment is only available in US dollars." };
  }
  const payable = Math.min(cateringPayableCents(invoice, facts), cateringRemainingOnInvoice(invoice, facts.payments));
  if (payable <= 0) return { ok: false, code: "nothing_payable", message: "Nothing is currently payable on this request." };
  return { ok: true, amountCents: payable, currency: CATERING_SQUARE_CURRENCY };
}

/** Whether an existing open attempt is the same checkout the server would create now, so it is returned instead of a duplicate. */
export function cateringAttemptMatches(
  attempt: { amountCents: number; currency: string; merchantId: string; locationId: string },
  wanted: { amountCents: number; currency: string; merchantId: string; locationId: string },
): boolean {
  return attempt.amountCents === wanted.amountCents && attempt.currency === wanted.currency
    && attempt.merchantId === wanted.merchantId && attempt.locationId === wanted.locationId;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * What counts as evidence
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringAttemptTarget = {
  attemptId: string;
  squareOrderId: string;
  locationId: string;
  amountCents: number;
  currency: string;
};

export type CateringEvidenceVerdict =
  /** Nothing has been paid, the checkout is still open. */
  | { kind: "awaiting" }
  /** A payment exists but Square has not completed it (approved/pending). Not money in hand; not credited. */
  | { kind: "processing" }
  /** Square says the order was cancelled and nothing was paid. The checkout is closed. */
  | { kind: "cancelled" }
  /** The facts do not belong to this attempt (wrong order, location, reference, payment link). Never credited, never trusted. */
  | { kind: "rejected"; code: "order_mismatch" | "location_mismatch" | "reference_mismatch" | "payment_order_mismatch" | "payment_location_mismatch" | "order_total_mismatch" }
  /** A COMPLETED Square payment for exactly this attempt's order. `mismatch` is set when it is not exactly what was asked for. */
  | { kind: "confirmed"; paymentId: string; amountCents: number; currency: string; mismatch: CateringReconciliationReason | null };

/**
 * Judges FRESH Square facts against what the attempt was created for. Every identifier is compared, not assumed:
 *
 *  - the order is the attempt's order, at the attempt's location, carrying ChefSire's own reference (the attempt id);
 *  - each payment belongs to that order and that location;
 *  - only a COMPLETED payment is money in hand (APPROVED/PENDING are `processing`; FAILED/CANCELED are ignored);
 *  - the amount that moved is the amount asked for, in the currency asked for, with no tip.
 *
 * Wrong merchant is judged by the caller, which only ever reads Square with the credential of the merchant the attempt was
 * created for. A completed payment whose amount or currency differs is still CONFIRMED -- money moved -- but flagged, so it is
 * kept as reconciliation evidence rather than being dropped or credited.
 */
export function evaluateSquareEvidence(target: CateringAttemptTarget, order: SquareOrderFacts, payments: readonly SquarePaymentFacts[]): CateringEvidenceVerdict {
  if (order.id !== target.squareOrderId) return { kind: "rejected", code: "order_mismatch" };
  if (order.locationId !== target.locationId) return { kind: "rejected", code: "location_mismatch" };
  if (order.referenceId !== target.attemptId) return { kind: "rejected", code: "reference_mismatch" };
  for (const payment of payments) {
    if (payment.orderId !== order.id) return { kind: "rejected", code: "payment_order_mismatch" };
    if (payment.locationId !== target.locationId) return { kind: "rejected", code: "payment_location_mismatch" };
  }
  const completed = payments.filter((payment) => payment.status === "COMPLETED");
  if (completed.length === 0) {
    if (payments.some((payment) => payment.status === "APPROVED" || payment.status === "PENDING")) return { kind: "processing" };
    if (order.state === "CANCELED") return { kind: "cancelled" };
    return { kind: "awaiting" };
  }
  // The order total was not what ChefSire asked for. With no money moved it is simply not ours to trust.
  const first = completed[0];
  if (first.totalCents === null || first.currency === null) return { kind: "rejected", code: "order_total_mismatch" };
  let mismatch: CateringReconciliationReason | null = null;
  if (completed.length > 1) mismatch = "multiple_payments";
  else if (first.currency !== target.currency) mismatch = "currency_mismatch";
  else if (first.totalCents !== target.amountCents || first.tipCents !== 0) mismatch = "amount_mismatch";
  return { kind: "confirmed", paymentId: first.id, amountCents: first.totalCents, currency: first.currency, mismatch };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Whether confirmed money fits the ledger NOW
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringSettlementDecision =
  | { kind: "credit"; amountCents: number }
  | { kind: "reconcile"; reason: CateringReconciliationReason };

/**
 * The decision made INSIDE the settlement transaction, against the ledger as it stands under the booking's lock.
 *
 * Money that moved is never clamped to a smaller figure and never silently credited when the ledger would not allow it. It
 * either fits -- amount equal to what was asked for, and within the invoice's CURRENT effective payable -- and is credited in
 * full, or it is kept as reconciliation evidence with the reason it could not be.
 */
export function decideCateringSettlement(input: {
  confirmed: { amountCents: number; currency: string; mismatch: CateringReconciliationReason | null };
  invoice: CateringInvoiceFact | undefined;
  facts: CateringBillingFacts;
}): CateringSettlementDecision {
  const { confirmed, invoice, facts } = input;
  if (confirmed.mismatch) return { kind: "reconcile", reason: confirmed.mismatch };
  if (facts.bookingStatus === "cancelled") return { kind: "reconcile", reason: "booking_cancelled" };
  if (!invoice || !cateringInvoiceCounts(invoice)) return { kind: "reconcile", reason: "invoice_not_payable" };
  if (confirmed.currency !== invoice.currency || confirmed.currency !== facts.currency) return { kind: "reconcile", reason: "currency_mismatch" };
  const payable = Math.min(cateringPayableCents(invoice, facts), cateringRemainingOnInvoice(invoice, facts.payments));
  if (confirmed.amountCents > payable) return { kind: "reconcile", reason: "payable_changed" };
  return { kind: "credit", amountCents: confirmed.amountCents };
}
