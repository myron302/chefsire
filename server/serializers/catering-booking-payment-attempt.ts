import type { CateringAttemptSquarePayment, CateringBookingPaymentAttempt } from "@shared/schema";
import type { CateringPaymentAttemptState, CateringPaymentAttemptView, CateringReconciliationReason } from "@shared/catering-square-payments";

/**
 * EXPLICIT PROJECTION of a payment attempt. Not one spread of a row: the row carries the idempotency key, the Square order and
 * payment-link ids, merchant and location ids, and failure internals, and none of those is a thing either actor needs.
 *
 *  - CUSTOMER: their own attempt, the amount, the state, and the checkout URL only while it is pending (it is the one thing the
 *    screen needs to send them to Square). No Square identifier.
 *  - PROVIDER: the same, never the checkout URL (a provider is not the payer), and -- only once Square confirmed money moved --
 *    the Square payment reference, so they can find it in their own Square dashboard and remediate a reconciliation.
 */
export function serializeCateringPaymentAttempt(row: CateringBookingPaymentAttempt & { processorPayments?: readonly CateringAttemptSquarePayment[] }, role: "provider" | "customer"): CateringPaymentAttemptView {
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
  if (row.processorAmountCents !== null && row.processorAmountCents !== undefined) view.processorAmountCents = row.processorAmountCents;
  // The ledger payment, when one was credited -- including the one credited before a LATER extra Square payment turned it into a reconciliation.
  if (row.paymentId) view.paymentId = row.paymentId;
  if (row.processorPaymentCount > 0) view.processorPaymentCount = row.processorPaymentCount;
  // EVERY completed Square payment, each with its own amount, currency and Square time. A customer is never given the Square ids.
  if ((state === "completed" || state === "reconciliation_required") && row.processorPayments && row.processorPayments.length > 0) {
    view.processorPayments = row.processorPayments.map((payment) => ({
      amountCents: payment.amountCents, tipCents: payment.tipCents, currency: payment.currency, completedAt: payment.completedAt?.toISOString() ?? null,
      ...(role === "provider" ? { squarePaymentId: payment.squarePaymentId } : {}),
    }));
  }
  if (state === "reconciliation_required" && row.reconciliationReason) view.reconciliationReason = row.reconciliationReason as CateringReconciliationReason;
  if (role === "customer" && state === "pending" && row.checkoutUrl) view.checkoutUrl = row.checkoutUrl;
  if (role === "provider" && (state === "completed" || state === "reconciliation_required") && row.squarePaymentId) view.squarePaymentId = row.squarePaymentId;
  return view;
}

/** The attempts a participant may see in the billing view: the provider sees every attempt, a customer only their own. */
export function visibleCateringPaymentAttempts<T extends CateringBookingPaymentAttempt>(rows: readonly T[], role: "provider" | "customer", viewerId: string): T[] {
  return role === "provider" ? [...rows] : rows.filter((row) => row.customerId === viewerId);
}
