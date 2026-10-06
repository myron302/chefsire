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

export function getSquareClient(options: SquareSdkOptions = {}) {
  const client = createPlatformSquareClient(options);
  return {
    paymentsApi: {
      async createPayment(request: Square.CreatePaymentRequest) {
        return { result: await client.payments.create(request) };
      },
      /**
       * Same positional arguments as the legacy `listPayments`, and the same contract: ONE page per call, with the `cursor` for the next.
       * Nothing is materialized across pages here. The reconciliation search (`findSquarePaymentByReference`) walks the pages lazily,
       * matches the exact reference on each, and stops at the first match, so a known target is never discarded because unrelated
       * payments follow it, and memory stays bounded by one page.
       */
      async listPayments(
        beginTime?: string, endTime?: string, sortOrder?: string, cursor?: string, locationId?: string,
        total?: bigint, last4?: string, cardBrand?: string, limit?: number,
      ) {
        const page = await client.payments.list({ beginTime, endTime, sortOrder, cursor, locationId, total, last4, cardBrand, limit });
        // `Pageable` keeps the raw list response it was built from; its `cursor` names the next page (absent/empty on the last).
        const response = (page as unknown as { response?: { cursor?: string | null } }).response;
        const next = response?.cursor || undefined;
        return { result: { payments: page.data as Square.Payment[], cursor: next as string | undefined } };
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
