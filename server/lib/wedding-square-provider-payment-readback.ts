import { z } from "zod";
import { createPlatformSquareClient } from "./square-integration";
import { weddingSquareSandboxSubscriptionReadback } from "./wedding-square-sandbox-subscription-readback";
import { weddingSquareReconciliationReadback } from "./wedding-square-reconciliation-readback";
import { inspectWeddingSquareInvoicePaymentLinkage } from "./wedding-square-invoice-payment-linkage";

/**
 * Server-only read-only sandbox evidence chain:
 * owner-bound Neon attempt -> verified platform merchant/catalog/subscription
 * -> subscription-listed invoice -> invoice order -> order's Square CARD tender
 * -> provider payment. None of these records may come from a browser or webhook.
 *
 * A successful result is still ONLY a reconciliation candidate: tax, amount,
 * paid-through dates, refunds/disputes and renewal lifecycle are not proven.
 */
const canonicalId = z.string().min(1).max(200).refine(
  (value) => !/[\s\x00-\x1f\x7f]/.test(value),
);
const noErrors = z.array(z.unknown()).max(0).optional();
const subscriptionSchema = z.object({
  errors: noErrors,
  subscription: z.object({
    id: canonicalId, customerId: canonicalId, locationId: canonicalId,
    planVariationId: canonicalId,
    // Square lists newest invoice first. Never take a caller-supplied ID.
    invoiceIds: z.array(canonicalId).min(1).max(1000).refine((ids) =>
      new Set(ids).size === ids.length),
  }).passthrough(),
}).passthrough();
const invoiceSchema = z.object({
  errors: noErrors,
  invoice: z.object({
    id: canonicalId, subscriptionId: canonicalId, orderId: canonicalId,
    locationId: canonicalId, status: z.literal("PAID"),
    primaryRecipient: z.object({ customerId: canonicalId }).passthrough(),
  }).passthrough(),
}).passthrough();
const orderSchema = z.object({
  errors: noErrors,
  order: z.object({
    id: canonicalId, locationId: canonicalId,
    // Square Order.customerId is optional on provider invoice orders.
    // When absent, invoice recipient and final Payment.customerId still
    // independently establish the paid customer's identity.
    customerId: canonicalId.nullish(),
    tenders: z.array(z.object({
      type: z.literal("CARD"),
      // Square Tender.id is the canonical associated payment ID. Older
      // tender records often omit the optional paymentId alias.
      id: canonicalId,
      paymentId: canonicalId.optional(),
      // Tender customer/location fields may be omitted by Square; verify
      // exact values when present, and always verify the retrieved Payment.
      customerId: canonicalId.nullish(),
      locationId: canonicalId.nullish(),
    }).passthrough()).length(1),
  }).passthrough(),
}).passthrough();
type SavedReadback = Pick<typeof weddingSquareReconciliationReadback, "inspect">;
type VerifiedSubscription = Pick<typeof weddingSquareSandboxSubscriptionReadback, "inspect">;
type ReadProvider = (id: string) => Promise<unknown>;

export class WeddingSquareProviderPaymentReadbackError extends Error {
  constructor() {
    super("Wedding Square invoice/payment readback requires operator reconciliation.");
    this.name = "WeddingSquareProviderPaymentReadbackError";
  }
}

export function createWeddingSquareProviderPaymentReadback(
  verifiedSubscription: VerifiedSubscription,
  savedReadback: SavedReadback,
  readSubscription: ReadProvider,
  readInvoice: ReadProvider,
  readOrder: ReadProvider,
  readPayment: ReadProvider,
) {
  return {
    async inspect(attemptId: string, authenticatedUserId: string) {
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !canonicalId.safeParse(attemptId).success ||
          !canonicalId.safeParse(authenticatedUserId).success) {
        throw new WeddingSquareProviderPaymentReadbackError();
      }

      try {
        // The prior Phase 19+ readback verifies owner-bound reservation,
        // fingerprint, token-owned merchant, configured Wedding catalog plans,
        // and the known Square subscription BEFORE exposing its ID.
        const verified = await verifiedSubscription.inspect(attemptId, authenticatedUserId);
        if (!verified || verified.attemptId !== attemptId ||
            !canonicalId.safeParse(verified.providerSubscriptionId).success ||
            verified.existingIdMatches !== true ||
            verified.requiresOperatorReconciliation !== true ||
            verified.grantsEntitlement !== false ||
            verified.safeToResubmit !== false) {
          throw new WeddingSquareProviderPaymentReadbackError();
        }

        // Recheck read-only, owner-scoped evidence for the exact expected
        // customer/location/plan; never trust request-body equivalents.
        const saved = await savedReadback.inspect(attemptId, authenticatedUserId);
        if (!saved || saved.attemptId !== attemptId ||
            saved.providerSubscriptionId !== verified.providerSubscriptionId ||
            !canonicalId.safeParse(saved.customerId).success ||
            !canonicalId.safeParse(saved.locationId).success ||
            !canonicalId.safeParse(saved.planVariationId).success) {
          throw new WeddingSquareProviderPaymentReadbackError();
        }

        const sub = subscriptionSchema.safeParse(
          await readSubscription(verified.providerSubscriptionId),
        );
        if (!sub.success || sub.data.subscription.id !== saved.providerSubscriptionId ||
            sub.data.subscription.customerId !== saved.customerId ||
            sub.data.subscription.locationId !== saved.locationId ||
            sub.data.subscription.planVariationId !== saved.planVariationId) {
          throw new WeddingSquareProviderPaymentReadbackError();
        }

        // Square's documented invoiceIds order is newest first. Only the
        // first Square-issued invoice is read. Do not search other subscriptions.
        const invoiceId = sub.data.subscription.invoiceIds[0];
        const inv = invoiceSchema.safeParse(await readInvoice(invoiceId));
        if (!inv.success ||
            inv.data.invoice.id !== invoiceId ||
            inv.data.invoice.subscriptionId !== saved.providerSubscriptionId ||
            inv.data.invoice.locationId !== saved.locationId ||
            inv.data.invoice.primaryRecipient.customerId !== saved.customerId) {
          throw new WeddingSquareProviderPaymentReadbackError();
        }

        const order = orderSchema.safeParse(await readOrder(inv.data.invoice.orderId));
        if (!order.success ||
            order.data.order.id !== inv.data.invoice.orderId ||
            order.data.order.locationId !== saved.locationId ||
            (order.data.order.customerId != null &&
             order.data.order.customerId !== saved.customerId)) {
          throw new WeddingSquareProviderPaymentReadbackError();
        }
        // Reject split, offline, cash, missing or ambiguous tenders.
        const tender = order.data.order.tenders[0];
        if ((tender.customerId != null && tender.customerId !== saved.customerId) ||
            (tender.locationId != null && tender.locationId !== saved.locationId) ||
            (tender.paymentId !== undefined && tender.paymentId !== tender.id)) {
          throw new WeddingSquareProviderPaymentReadbackError();
        }

        const payment = await readPayment(tender.id);
        const candidate = inspectWeddingSquareInvoicePaymentLinkage(
          {
            subscriptionId: saved.providerSubscriptionId,
            customerId: saved.customerId,
            locationId: saved.locationId,
            planVariationId: saved.planVariationId,
          },
          sub.data, inv.data, payment,
        );
        if (candidate.invoiceId !== invoiceId ||
            candidate.paymentId !== tender.id ||
            candidate.requiresOperatorReconciliation !== true ||
            candidate.requiresAmountAndCoverageVerification !== true ||
            candidate.grantsEntitlement !== false ||
            candidate.safeToResubmit !== false) {
          throw new WeddingSquareProviderPaymentReadbackError();
        }
        return candidate;
      } catch {
        // Never leak Square response, card/customer IDs, SQL errors or tokens.
        // No retries, no entitlement, no DB mutation and no automatic charges.
        throw new WeddingSquareProviderPaymentReadbackError();
      }
    },
  };
}

/** These are SDK v43 authenticated GETs. There is no public HTTP route. */
export const weddingSquareProviderPaymentReadback =
  createWeddingSquareProviderPaymentReadback(
    weddingSquareSandboxSubscriptionReadback,
    weddingSquareReconciliationReadback,
    (subscriptionId) => createPlatformSquareClient().subscriptions.get(
      { subscriptionId }, { maxRetries: 0 }),
    (invoiceId) => createPlatformSquareClient().invoices.get(
      { invoiceId }, { maxRetries: 0 }),
    (orderId) => createPlatformSquareClient().orders.get(
      { orderId }, { maxRetries: 0 }),
    (paymentId) => createPlatformSquareClient().payments.get(
      { paymentId }, { maxRetries: 0 }),
  );
