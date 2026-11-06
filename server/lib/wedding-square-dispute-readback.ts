import { z } from "zod";
import { readWeddingSquareInvoicePaymentCustomer } from "./wedding-square-invoice-payment-customer";

type Sender = (url: string, init: RequestInit) => Promise<Response>;
const id = z.string().min(1).max(200).refine(v => !/[\s\x00-\x1f\x7f]/.test(v));
const money = z.object({ amount: z.number().int().safe().positive(), currency: z.literal("USD") });
const disputeEnvelope = z.object({
  errors: z.array(z.unknown()).length(0).optional(),
  dispute: z.object({ id, location_id: id, amount_money: money,
    disputed_payment: z.object({ payment_id: id }) }),
});
const paymentEnvelope = z.object({
  errors: z.array(z.unknown()).length(0).optional(),
  payment: z.object({ id, customer_id: id.optional(), order_id: id.optional(), location_id: id, amount_money: money }),
});
export class WeddingSquareDisputeReadbackError extends Error {
  constructor() { super("Wedding Square dispute requires operator reconciliation."); }
}

/** Independently resolve an untrusted dispute ID to its payment and customer.
 * Any dispute, including WON, can invalidate freshness; never restores access.
 * No provider writes, entitlement grants or webhook-body payment hints.
 */
export function createWeddingSquareDisputeReadback(sender: Sender = fetch) {
  return { async inspect(disputeId: string) {
    const token = process.env.SQUARE_ACCESS_TOKEN;
    const location = process.env.SQUARE_LOCATION_ID;
    if (process.env.SQUARE_ENV !== "sandbox" ||
        process.env.SQUARE_LIVE_PAYMENTS_ENABLED === "true" ||
        process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
        process.env.WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED !== "true" ||
        process.env.WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED !== "true" ||
        !id.safeParse(token).success || !id.safeParse(location).success ||
        !id.safeParse(disputeId).success) throw new WeddingSquareDisputeReadbackError();
    async function get(path: string) {
      const response = await sender("https://connect.squareupsandbox.com/v2/" + path, {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token}`, "Square-Version": "2025-10-16", Accept: "application/json" },
      });
      if (response.status !== 200) throw new WeddingSquareDisputeReadbackError();
      const length = response.headers.get("content-length");
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > 65536)) throw new WeddingSquareDisputeReadbackError();
      const body = await response.text();
      if (body.length > 65536) throw new WeddingSquareDisputeReadbackError();
      return JSON.parse(body);
    }
    try {
      const d = disputeEnvelope.parse(await get("disputes/" + encodeURIComponent(disputeId))).dispute;
      if (d.id !== disputeId || d.location_id !== location) throw new WeddingSquareDisputeReadbackError();
      const p = paymentEnvelope.parse(await get("payments/" + encodeURIComponent(d.disputed_payment.payment_id))).payment;
      if (p.id !== d.disputed_payment.payment_id || p.location_id !== location ||
          ![2499, 4999].includes(p.amount_money.amount) || d.amount_money.amount > p.amount_money.amount)
        throw new WeddingSquareDisputeReadbackError();
      return Object.freeze({ disputeId: d.id, paymentId: p.id, customerId: await readWeddingSquareInvoicePaymentCustomer(p,sender),
        locationId: p.location_id, amountCents: p.amount_money.amount,
        grantsEntitlement: false as const });
    } catch { throw new WeddingSquareDisputeReadbackError(); }
  } };
}
export const weddingSquareDisputeReadback = createWeddingSquareDisputeReadback();
