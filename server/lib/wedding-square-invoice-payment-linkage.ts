import { z } from "zod";

/**
 * Offline-only, side-effect-free shape and identity guard for a FUTURE
 * authenticated Square sandbox invoice/payment readback.
 *
 * Inputs must eventually come from separate platform-account Square GETs,
 * including a fresh subscription with its invoiceIds membership,
 * never a browser, webhook payload or a connected Catering seller.
 * This does not establish a paid period, authorize a charge, grant access,
 * verify the expected amount/tax, or persist any provider record.
 */
const canonicalId = z.string().min(1).refine(
  (id) => !/[\s\x00-\x1f\x7f]/.test(id),
);
const usdMoney = z.object({
  amount: z.bigint().nonnegative(),
  currency: z.literal("USD"),
}).passthrough();
const subscriptionEnvelope = z.object({
  subscription: z.object({
    id: canonicalId,
    customerId: canonicalId,
    locationId: canonicalId,
    planVariationId: canonicalId,
    invoiceIds: z.array(canonicalId).min(1).refine(
      (ids) => new Set(ids).size === ids.length,
    ),
  }).passthrough(),
  errors: z.array(z.unknown()).max(0).optional(),
}).passthrough();
const invoiceEnvelope = z.object({
  invoice: z.object({
    id: canonicalId,
    subscriptionId: canonicalId,
    orderId: canonicalId,
    locationId: canonicalId,
    primaryRecipient: z.object({ customerId: canonicalId }).passthrough(),
    status: z.literal("PAID"),
  }).passthrough(),
  errors: z.array(z.unknown()).max(0).optional(),
}).passthrough();
const paymentEnvelope = z.object({
  payment: z.object({
    id: canonicalId,
    orderId: canonicalId,
    locationId: canonicalId,
    customerId: canonicalId,
    status: z.literal("COMPLETED"),
    amountMoney: usdMoney.refine((money) => money.amount > 0n),
    totalMoney: usdMoney,
    refundedMoney: usdMoney.optional(),
    refundIds: z.array(canonicalId).max(0).optional(),
    tipMoney: usdMoney.optional(),
  }).passthrough(),
  errors: z.array(z.unknown()).max(0).optional(),
}).passthrough();

const expectedSchema = z.object({
  subscriptionId: canonicalId,
  customerId: canonicalId,
  locationId: canonicalId,
  planVariationId: canonicalId,
});

export class WeddingSquareInvoicePaymentLinkageError extends Error {
  constructor() {
    super("Square invoice/payment linkage requires operator reconciliation.");
    this.name = "WeddingSquareInvoicePaymentLinkageError";
  }
}

/**
 * Returns ONLY a candidate for further independent reconciliation.
 * Invoice PAID + Payment COMPLETED are not proof of paid-through coverage:
 * the future flow must verify amount/tax, invoice period, refunds/disputes,
 * merchant provenance and immutable ownership before any entitlement.
 */
export function inspectWeddingSquareInvoicePaymentLinkage(
  expected: unknown,
  subscriptionResponse: unknown,
  invoiceResponse: unknown,
  paymentResponse: unknown,
) {
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
      (process.env.SQUARE_CURRENCY !== undefined && process.env.SQUARE_CURRENCY !== "USD")) {
    throw new WeddingSquareInvoicePaymentLinkageError();
  }
  const saved = expectedSchema.safeParse(expected);
  const subscription = subscriptionEnvelope.safeParse(subscriptionResponse);
  const invoice = invoiceEnvelope.safeParse(invoiceResponse);
  const payment = paymentEnvelope.safeParse(paymentResponse);
  if (!saved.success || !subscription.success || !invoice.success || !payment.success) {
    throw new WeddingSquareInvoicePaymentLinkageError();
  }
  const s = subscription.data.subscription;
  const i = invoice.data.invoice;
  const p = payment.data.payment;
  if (s.id !== saved.data.subscriptionId ||
      s.customerId !== saved.data.customerId ||
      s.locationId !== saved.data.locationId ||
      s.planVariationId !== saved.data.planVariationId ||
      !s.invoiceIds.includes(i.id) ||
      i.subscriptionId !== saved.data.subscriptionId ||
      i.primaryRecipient.customerId !== saved.data.customerId ||
      p.customerId !== saved.data.customerId ||
      i.locationId !== saved.data.locationId ||
      p.locationId !== saved.data.locationId ||
      i.orderId !== p.orderId ||
      p.totalMoney.amount !== p.amountMoney.amount ||
      (p.refundedMoney !== undefined && p.refundedMoney.amount !== 0n) ||
      (p.tipMoney !== undefined && p.tipMoney.amount !== 0n)) {
    throw new WeddingSquareInvoicePaymentLinkageError();
  }

  return Object.freeze({
    invoiceId: i.id,
    paymentId: p.id,
    subscriptionId: saved.data.subscriptionId,
    requiresOperatorReconciliation: true as const,
    requiresAmountAndCoverageVerification: true as const,
    grantsEntitlement: false as const,
    safeToResubmit: false as const,
  });
}
