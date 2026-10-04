import type { Square } from "square";
import { createPlatformSquareClient, type SquareSdkOptions } from "./square-integration";

/**
 * The marketplace's Square client: the PLATFORM account, in the call shape the marketplace capture / refund /
 * reconciliation code was written against.
 *
 * That code (server/routes/payments.ts, server/services/marketplace-checkout-reconciliation.ts) was written for the
 * legacy SDK, whose root export was `Client` with `paymentsApi` / `refundsApi` accessors. The installed `square` v43
 * has no such export, so `new Client(...)` threw a TypeError before any request was made. This adapter keeps the
 * exact call shape those state machines use -- positional `listPayments`, `{ result }` envelopes -- and implements it
 * on the supported `SquareClient` (`payments.create`, `payments.list`, `refunds.refundPayment`, `refunds.get`).
 *
 * Nothing about the marketplace's behavior changes: the same requests are sent under the same idempotency keys, the
 * same evidence comes back, and Square's own errors (`SquareError.errors[]` with `category` / `code`) are what the
 * existing definitive-failure classification already reads.
 *
 * Environment selection and the platform token come from `square-integration.ts`, shared with every Square caller.
 */

/** A reconciliation window holds a handful of payments; this bound only stops a runaway pagination loop. */
const MAX_LISTED_PAYMENTS = 1000;

export function getSquareClient(options: SquareSdkOptions = {}) {
  const client = createPlatformSquareClient(options);
  return {
    paymentsApi: {
      async createPayment(request: Square.CreatePaymentRequest) {
        return { result: await client.payments.create(request) };
      },
      /** Same positional arguments as the legacy `listPayments`; returns the whole window, never a partial page. */
      async listPayments(
        beginTime?: string, endTime?: string, sortOrder?: string, cursor?: string, locationId?: string,
        total?: bigint, last4?: string, cardBrand?: string, limit?: number,
      ) {
        const page = await client.payments.list({ beginTime, endTime, sortOrder, cursor, locationId, total, last4, cardBrand, limit });
        const payments: Square.Payment[] = [];
        for await (const payment of page) {
          if (payments.length >= MAX_LISTED_PAYMENTS) throw new Error("Square payment listing exceeded its bound");
          payments.push(payment);
        }
        return { result: { payments, cursor: undefined as string | undefined } };
      },
    },
    refundsApi: {
      async refundPayment(request: Square.RefundPaymentRequest) {
        return { result: await client.refunds.refundPayment(request) };
      },
      async getPaymentRefund(refundId: string) {
        return { result: await client.refunds.get({ refundId }) };
      },
    },
  };
}

export type SquareClient = ReturnType<typeof getSquareClient>;
