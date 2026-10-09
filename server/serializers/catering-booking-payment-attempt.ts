import type { CateringAttemptSquarePayment, CateringBookingPaymentAttempt } from "@shared/schema";
import { cateringCheckoutPastExpiry, type CateringPaymentAttemptState, type CateringPaymentAttemptView, type CateringReconciliationReason } from "@shared/catering-square-payments";

/**
 * EXPLICIT PROJECTION of a payment attempt. Not one spread of a row: the row carries the idempotency key, the Square order and
 * payment-link ids, merchant and location ids, and failure internals, and none of those is a thing either actor needs.
 *
 *  - CUSTOMER: their own attempt, the amount, the state, and the checkout URL only while it is pending (it is the one thing the
 *    screen needs to send them to Square). No Square identifier.
 *  - PROVIDER: the same, never the checkout URL (a provider is not the payer), and -- only once Square confirmed money moved --
 *    the Square payment reference, so they can find it in their own Square dashboard and remediate a reconciliation.
 */
export function serializeCateringPaymentAttempt(row: CateringBookingPaymentAttempt & { processorPayments?: readonly CateringAttemptSquarePayment[]; creditedSquarePaymentId?: string | null }, role: "provider" | "customer", at: Date = new Date()): CateringPaymentAttemptView {
  const state = row.state as CateringPaymentAttemptState;
  const view: CateringPaymentAttemptView = {
    id: row.id,
    invoiceId: row.invoiceId,
    state,
    amountCents: row.amountCents,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
  if (row.processorAmountCents !== null && row.processorAmountCents !== undefined) {
    view.processorAmountCents = row.processorAmountCents;
    // The currency Square reported for that amount (null when the payments disagree): the amount is never to be read in the invoice's currency.
    if (row.processorCurrency) view.processorCurrency = row.processorCurrency;
  }
  const ledgerCredited = Boolean(row.paymentId) && (state === "completed" || state === "reconciliation_required");
  if (role === "provider" && ledgerCredited) view.ledgerCredited = true;
  // Both actors are told a refund discrepancy is unresolved (no Square id, no amounts beyond what they already see).
  if (cateringAttemptNeedsReturnReview(row)) view.refundReview = true;
  // The ledger payment, when one was credited -- including the one credited before a LATER extra Square payment turned it into a reconciliation.
  if (row.paymentId) view.paymentId = row.paymentId;
  if (row.processorPaymentCount > 0) view.processorPaymentCount = row.processorPaymentCount;
  // EVERY completed Square payment, each with its own amount, currency and Square time. A customer is never given the Square ids.
  if ((state === "completed" || state === "reconciliation_required") && row.processorPayments && row.processorPayments.length > 0) {
    view.processorPayments = row.processorPayments.map((payment) => ({
      amountCents: payment.amountCents, tipCents: payment.tipCents, currency: payment.currency, completedAt: payment.completedAt?.toISOString() ?? null,
      // The ledger-backed payment is identified by the Square id STORED on the ledger payment, never by comparing amounts.
      ...(role === "provider" ? { squarePaymentId: payment.squarePaymentId, ...(payment.hasRefunds ? { refunded: true } : {}), ...(row.creditedSquarePaymentId && payment.squarePaymentId === row.creditedSquarePaymentId ? { creditedToLedger: true } : {}) } : {}),
    }));
  }
  if (state === "reconciliation_required" && row.reconciliationReason) view.reconciliationReason = row.reconciliationReason as CateringReconciliationReason;
  // A link past its lifetime is never handed out; the attempt stays visible (it may still hold an unverified payment) until it is retired after verification.
  const linkExpired = cateringCheckoutPastExpiry(row, at);
  if (linkExpired) view.linkExpired = true;
  if (role === "customer" && state === "pending" && row.checkoutUrl && !linkExpired) view.checkoutUrl = row.checkoutUrl;
  if (role === "provider" && (state === "completed" || state === "reconciliation_required") && row.squarePaymentId) view.squarePaymentId = row.squarePaymentId;
  return view;
}

/** The attempts a participant may see in the billing view: the provider sees every attempt, a customer only their own. */
export function visibleCateringPaymentAttempts<T extends CateringBookingPaymentAttempt>(rows: readonly T[], role: "provider" | "customer", viewerId: string): T[] {
  return role === "provider" ? [...rows] : rows.filter((row) => row.customerId === viewerId);
}

/** Whether Square showed returned-money activity on an attempt's payment AFTER it was recorded, and that review is unresolved. The attempt's state and ledger payment are unchanged. */
export function cateringAttemptNeedsReturnReview(row: { refundReviewAt: Date | null; state: string }): boolean {
  return Boolean(row.refundReviewAt) && (row.state === "completed" || row.state === "reconciliation_required");
}
