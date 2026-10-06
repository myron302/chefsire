import "./load-env";

import { SquareProviderResponseError, createConnectedSquareClient, squareEnvironmentName, type SquareSdkOptions } from "./square-integration";

/**
 * Catering Phase 2Q: Square hosted checkout under the PROVIDER's own connected account (SANDBOX ONLY).
 *
 * A separate module from the Gate 0 connection code on purpose: Gate 0 creates no payment, checkout or order, and that stays true of
 * its files. Every call here is made as the PROVIDER, with the OAuth access token the Gate 0 service hands to server-side payment
 * code, and every call is behind the sandbox gate.
 */

/** A Catering Square payment operation was attempted while Square is not configured for its sandbox. Carries no secret. */
export class SquareSandboxOnlyError extends Error {
  constructor() {
    super("Catering Square payments run against the Square sandbox only; production Square is not enabled.");
    this.name = "SquareSandboxOnlyError";
  }
}

/**
 * The Phase 2Q boundary: throws unless Square is configured for the SANDBOX. Called before every Catering checkout, order and
 * payment call, so a misconfigured environment can never send a Catering payment request to production Square. An invalid
 * `SQUARE_ENV` throws its own configuration error, which is also a refusal.
 */
export function assertSquareSandboxOnly(): void {
  if (squareEnvironmentName() !== "sandbox") throw new SquareSandboxOnlyError();
}

/** Whether Catering Square payments may run in this process at all. Never throws. */
export function cateringSquarePaymentsEnabled(): boolean {
  try {
    assertSquareSandboxOnly();
    return true;
  } catch {
    return false;
  }
}

export type SquareCheckoutLink = { paymentLinkId: string; orderId: string; url: string };

export type SquareOrderFacts = {
  id: string;
  locationId: string | null;
  referenceId: string | null;
  /** OPEN, COMPLETED, CANCELED or DRAFT, as Square reports it. */
  state: string | null;
  totalCents: number | null;
  currency: string | null;
  /** The Square payment ids of every tender on the order. */
  paymentIds: string[];
};

export type SquarePaymentFacts = {
  id: string;
  orderId: string | null;
  locationId: string | null;
  /** APPROVED, PENDING, COMPLETED, CANCELED or FAILED, as Square reports it. */
  status: string | null;
  /** What the buyer was actually charged: amount plus any tip. */
  totalCents: number | null;
  tipCents: number;
  currency: string | null;
  /** Square's own `created_at` / `updated_at` for the payment, as ISO strings (null when absent). */
  createdAt: string | null;
  updatedAt: string | null;
  /** Whether Square shows any refund against it (a refund moves `updated_at`, so it is no longer the completion time). */
  hasRefunds: boolean;
};

export interface SquareCheckoutApi {
  createPaymentLink(accessToken: string, input: {
    idempotencyKey: string; locationId: string; referenceId: string; itemName: string; amountCents: number; currency: string; redirectUrl?: string | null;
  }): Promise<SquareCheckoutLink>;
  deletePaymentLink(accessToken: string, paymentLinkId: string): Promise<void>;
  retrieveOrder(accessToken: string, orderId: string): Promise<SquareOrderFacts>;
  retrievePayment(accessToken: string, paymentId: string): Promise<SquarePaymentFacts>;
}

/** Square money is a bigint; anything that is not a safe integer is reported as null rather than rounded or coerced. */
function cents(value: bigint | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const asNumber = typeof value === "bigint" ? Number(value) : value;
  return Number.isSafeInteger(asNumber) ? asNumber : null;
}

export function createSquareCheckoutApi(options: SquareSdkOptions = {}): SquareCheckoutApi {
  return {
    async createPaymentLink(accessToken, input) {
      assertSquareSandboxOnly();
      const response = await createConnectedSquareClient(accessToken, options).checkout.paymentLinks.create({
        idempotencyKey: input.idempotencyKey,
        order: {
          locationId: input.locationId,
          // ChefSire's own durable reference: the payment attempt id. Reconciliation reads it back from the order.
          referenceId: input.referenceId,
          lineItems: [{ name: input.itemName, quantity: "1", basePriceMoney: { amount: BigInt(input.amountCents), currency: input.currency as "USD" } }],
        },
        checkoutOptions: {
          // No tipping, shipping address or coupon: the order total is the invoice's payable amount and nothing else.
          allowTipping: false,
          askForShippingAddress: false,
          enableCoupon: false,
          enableLoyalty: false,
          ...(input.redirectUrl ? { redirectUrl: input.redirectUrl } : {}),
        },
      }, { maxRetries: 0 });
      const link = response.paymentLink;
      const url = link?.url ?? link?.longUrl;
      if (!link?.id || !link.orderId || !url) throw new SquareProviderResponseError("Square returned an incomplete payment link.");
      return { paymentLinkId: link.id, orderId: link.orderId, url };
    },
    async deletePaymentLink(accessToken, paymentLinkId) {
      assertSquareSandboxOnly();
      await createConnectedSquareClient(accessToken, options).checkout.paymentLinks.delete({ id: paymentLinkId }, { maxRetries: 0 });
    },
    async retrieveOrder(accessToken, orderId) {
      assertSquareSandboxOnly();
      const response = await createConnectedSquareClient(accessToken, options).orders.get({ orderId }, { maxRetries: 0 });
      const order = response.order;
      if (!order?.id) throw new SquareProviderResponseError("Square returned no order.");
      return {
        id: order.id,
        locationId: order.locationId ?? null,
        referenceId: order.referenceId ?? null,
        state: order.state ?? null,
        totalCents: cents(order.totalMoney?.amount),
        currency: order.totalMoney?.currency ?? null,
        paymentIds: (order.tenders ?? []).map((tender) => tender.paymentId).filter((id): id is string => Boolean(id)),
      };
    },
    async retrievePayment(accessToken, paymentId) {
      assertSquareSandboxOnly();
      const response = await createConnectedSquareClient(accessToken, options).payments.get({ paymentId }, { maxRetries: 0 });
      const payment = response.payment;
      if (!payment?.id) throw new SquareProviderResponseError("Square returned no payment.");
      const total = payment.totalMoney ?? payment.amountMoney;
      return {
        id: payment.id,
        orderId: payment.orderId ?? null,
        locationId: payment.locationId ?? null,
        status: payment.status ?? null,
        totalCents: cents(total?.amount),
        tipCents: cents(payment.tipMoney?.amount) ?? 0,
        currency: total?.currency ?? null,
        createdAt: payment.createdAt ?? null,
        updatedAt: payment.updatedAt ?? null,
        hasRefunds: (payment.refundIds?.length ?? 0) > 0 || (cents(payment.refundedMoney?.amount) ?? 0) > 0,
      };
    },
  };
}

export const squareCheckoutApi: SquareCheckoutApi = createSquareCheckoutApi();
