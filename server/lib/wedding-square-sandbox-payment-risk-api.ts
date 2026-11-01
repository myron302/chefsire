import { z } from "zod";

/**
 * Read-only, sandbox-only risk audit for ONE already owner-bound Square
 * payment. Inspect the original JSON: SDK v43 normalizes some malformed 2xx
 * values (notably errors:null) into absent values.
 *
 * Refund IDs, a nonzero refunded amount, ANY dispute (including WON), an
 * incomplete dispute page walk, or failure to access the Disputes API fails
 * closed. Do not interpret a successful risk check as period coverage.
 */
type Sender = (url: string, init: RequestInit) => Promise<Response>;
const id = z.string().min(1).max(200).refine(v => !/[\s\x00-\x1f\x7f]/.test(v));
const money = z.object({ amount: z.number().int().safe().nonnegative(), currency: z.literal("USD") }).passthrough();
const paymentEnvelope = z.object({
  errors: z.array(z.unknown()).length(0).optional(),
  payment: z.object({
    id, customer_id: id, location_id: id, order_id: id,
    status: z.literal("COMPLETED"),
    amount_money: money, total_money: money,
    refunded_money: money.optional(),
    refund_ids: z.array(id).optional(),
    tip_money: money.optional(),
  }).passthrough(),
}).passthrough();
const disputesEnvelope = z.object({
  errors: z.array(z.unknown()).length(0).optional(),
  disputes: z.array(z.object({
    id, location_id: id,
    disputed_payment: z.object({ payment_id: id }).passthrough(),
  }).passthrough()).max(100).optional(),
  cursor: id.optional(),
}).passthrough();

export class WeddingSquarePaymentRiskUnavailableError extends Error {
  constructor() {
    super("Square payment refund and dispute status could not be verified.");
    this.name = "WeddingSquarePaymentRiskUnavailableError";
  }
}

async function rawGet(sender: Sender, pathname: string, params?: URLSearchParams): Promise<unknown> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
      !id.safeParse(token).success) throw new WeddingSquarePaymentRiskUnavailableError();
  try {
    const endpoint = new URL("https://connect.squareupsandbox.com" + pathname);
    if (params) endpoint.search = params.toString();
    const response = await sender(endpoint.toString(), {
      method: "GET",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        "Square-Version": "2025-10-16",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response || response.status !== 200) throw new WeddingSquarePaymentRiskUnavailableError();
    const length = response.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > 65536))
      throw new WeddingSquarePaymentRiskUnavailableError();
    const body = await response.text();
    if (body.length > 65536) throw new WeddingSquarePaymentRiskUnavailableError();
    return JSON.parse(body) as unknown;
  } catch {
    throw new WeddingSquarePaymentRiskUnavailableError();
  }
}

export function createWeddingSquareSandboxPaymentRiskApi(sender: Sender = fetch) {
  return Object.freeze({
    async inspect(paymentId: string, customerId: string, locationId: string, amountCents: number) {
      if (!id.safeParse(paymentId).success ||
          !id.safeParse(customerId).success ||
          !id.safeParse(locationId).success ||
          locationId !== process.env.SQUARE_LOCATION_ID ||
          !Number.isSafeInteger(amountCents) ||
          (amountCents !== 2499 && amountCents !== 4999)) {
        throw new WeddingSquarePaymentRiskUnavailableError();
      }
      try {
        const parsed = paymentEnvelope.safeParse(
          await rawGet(sender, "/v2/payments/" + encodeURIComponent(paymentId)),
        );
        if (!parsed.success) throw new WeddingSquarePaymentRiskUnavailableError();
        const p = parsed.data.payment;
        if (p.id !== paymentId || p.customer_id !== customerId ||
            p.location_id !== locationId || p.amount_money.amount !== amountCents ||
            p.total_money.amount !== amountCents ||
            (p.refunded_money && p.refunded_money.amount !== 0) ||
            (p.refund_ids && p.refund_ids.length !== 0) ||
            (p.tip_money && p.tip_money.amount !== 0)) {
          throw new WeddingSquarePaymentRiskUnavailableError();
        }

        // Square ListDisputes cannot filter by paymentId. Walk ALL pages for
        // this location without state filtering; a single page proves nothing.
        const cursors = new Set<string>();
        let cursor: string | undefined;
        let completed = false;
        for (let page = 0; page < 50; page++) {
          const params = new URLSearchParams({ location_id: locationId });
          if (cursor) params.set("cursor", cursor);
          const listing = disputesEnvelope.safeParse(await rawGet(sender, "/v2/disputes", params));
          if (!listing.success) throw new WeddingSquarePaymentRiskUnavailableError();
          const disputes = listing.data.disputes ?? [];
          for (const dispute of disputes) {
            if (dispute.location_id !== locationId ||
                dispute.disputed_payment.payment_id === paymentId) {
              throw new WeddingSquarePaymentRiskUnavailableError();
            }
          }
          const next = listing.data.cursor;
          if (!next) { completed = true; break; }
          if (cursors.has(next)) throw new WeddingSquarePaymentRiskUnavailableError();
          cursors.add(next);
          cursor = next;
        }
        if (!completed) throw new WeddingSquarePaymentRiskUnavailableError();
        return Object.freeze({
          paymentId,
          noRefundsOrDisputes: true as const,
          grantsEntitlement: false as const,
          requiresIndependentPeriodVerification: true as const,
        });
      } catch {
        throw new WeddingSquarePaymentRiskUnavailableError();
      }
    },
  });
}
export const weddingSquareSandboxPaymentRiskApi = createWeddingSquareSandboxPaymentRiskApi();
