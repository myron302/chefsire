import { z } from "zod";

type Sender = (url: string, init: RequestInit) => Promise<Response>;
const id = z.string().min(1).max(200).refine(v => !/[\s\x00-\x1f\x7f]/.test(v));
const errors = z.array(z.unknown()).length(0).optional();
const paymentSchema = z.object({ id, customer_id: id.optional(), location_id: id, order_id: id.optional() });
const invoiceSchema = z.object({
  id, location_id: id, order_id: id, subscription_id: id,
  primary_recipient: z.object({ customer_id: id }),
});
const listingSchema = z.object({ errors, invoices: z.array(z.object({ id, order_id: id })).max(100).default([]), cursor: id.optional() });
const invoiceEnvelope = z.object({ errors, invoice: invoiceSchema });
const orderEnvelope = z.object({ errors, order: z.object({
  id, location_id: id, state: z.literal("COMPLETED"), customer_id: id.optional(),
  tenders: z.array(z.object({ id, type: z.literal("CARD"), location_id: id.optional(), customer_id: id.optional(), payment_id: id.optional() })).length(1),
}) });
const subscriptionEnvelope = z.object({ errors, subscription: z.object({
  id, location_id: id, customer_id: id, invoice_ids: z.array(id).min(1).max(1000),
}) });

/** Ownership only, never payment settlement, period coverage or entitlement.
 * Square hosted invoices can omit Payment.customer_id. In that case require
 * a unique provider invoice and fresh subscription -> invoice -> canonical
 * single CARD tender chain. Never derive ownership from event/browser hints.
 * At most six GETs, five seconds each; an incomplete listing fails closed.
 */
export async function readWeddingSquareInvoicePaymentCustomer(input: unknown, sender: Sender = fetch): Promise<string> {
  const fail = () => new Error("Square invoice payment ownership requires reconciliation.");
  try {
    const p = paymentSchema.parse(input);
    if (process.env.SQUARE_ENV !== "sandbox" || process.env.SQUARE_LIVE_PAYMENTS_ENABLED === "true" ||
        process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
        p.location_id !== process.env.SQUARE_LOCATION_ID || !id.safeParse(process.env.SQUARE_ACCESS_TOKEN).success) throw fail();
    // Existing independently read customer bindings remain strict at callers.
    if (p.customer_id !== undefined) return p.customer_id;
    if (!p.order_id) throw fail();
    async function get(path: string) {
      const response = await sender("https://connect.squareupsandbox.com/v2/" + path, {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(5000),
        headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, "Square-Version": "2025-10-16", Accept: "application/json" },
      });
      if (response.status !== 200) throw fail();
      const length = response.headers.get("content-length");
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > 262144)) throw fail();
      const body = await response.text();
      if (body.length > 262144) throw fail();
      return JSON.parse(body);
    }
    const matches: string[] = [];
    const seenInvoices = new Set<string>(), cursors = new Set<string>();
    let cursor: string | undefined, complete = false;
    for (let page = 0; page < 3; page++) {
      const params = new URLSearchParams({ location_id: p.location_id, limit: "100" });
      if (cursor) params.set("cursor", cursor);
      const listing = listingSchema.parse(await get("invoices?" + params));
      for (const invoice of listing.invoices) {
        if (seenInvoices.has(invoice.id)) throw fail();
        seenInvoices.add(invoice.id);
        if (invoice.order_id === p.order_id) matches.push(invoice.id);
      }
      if (!listing.cursor) { complete = true; break; }
      if (cursors.has(listing.cursor)) throw fail();
      cursors.add(listing.cursor); cursor = listing.cursor;
    }
    if (!complete || matches.length !== 1) throw fail();
    const invoice = invoiceEnvelope.parse(await get("invoices/" + encodeURIComponent(matches[0]))).invoice;
    if (invoice.id !== matches[0] || invoice.order_id !== p.order_id || invoice.location_id !== p.location_id) throw fail();
    const owner = invoice.primary_recipient.customer_id;
    const order = orderEnvelope.parse(await get("orders/" + encodeURIComponent(p.order_id))).order;
    const tender = order.tenders[0];
    if (order.id !== p.order_id || order.location_id !== p.location_id || tender.id !== p.id ||
        (order.customer_id !== undefined && order.customer_id !== owner) ||
        (tender.customer_id !== undefined && tender.customer_id !== owner) ||
        (tender.location_id !== undefined && tender.location_id !== p.location_id) ||
        (tender.payment_id !== undefined && tender.payment_id !== p.id)) throw fail();
    const sub = subscriptionEnvelope.parse(await get("subscriptions/" + encodeURIComponent(invoice.subscription_id))).subscription;
    if (sub.id !== invoice.subscription_id || sub.location_id !== p.location_id || sub.customer_id !== owner ||
        !sub.invoice_ids.includes(invoice.id) || new Set(sub.invoice_ids).size !== sub.invoice_ids.length) throw fail();
    return owner;
  } catch { throw fail(); }
}
