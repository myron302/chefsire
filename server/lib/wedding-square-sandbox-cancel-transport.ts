import { z } from "zod";

/**
 * Raw sandbox-only Square subscription cancellation transport.
 * No production URL, retries, browser token, or user-supplied subscription ID.
 * Financial responses must be parsed before SDK normalization erases malformed
 * 'errors: null'. An uncertain POST never authorizes a second POST.
 */
type Sender = (url: string, init: RequestInit) => Promise<Response>;
const exact = z.string().min(1).max(200).refine(v => !/[\s\x00-\x1f\x7f]/.test(v));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v =>
  Number.isFinite(Date.parse(v + "T00:00:00Z")) &&
  new Date(v + "T00:00:00Z").toISOString().slice(0,10) === v);
const subscription = z.object({
  id: exact, customer_id: exact, location_id: exact, plan_variation_id: exact,
  card_id: exact.nullish(),
  status: z.enum(["PENDING", "ACTIVE", "PAUSED", "CANCELED"]),
  canceled_date: date.nullish(),
}).passthrough();
const responseSchema = z.object({
  errors: z.array(z.unknown()).length(0).optional(),
  subscription,
}).passthrough();

export class WeddingSquareCancelTransportError extends Error {
  constructor() {
    super("Square cancellation response needs operator reconciliation.");
    this.name = "WeddingSquareCancelTransportError";
  }
}

async function read(sender: Sender, id: string, method: "GET"|"POST") {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
      process.env.WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED !== "true" ||
      !exact.safeParse(token).success || !exact.safeParse(id).success) {
    throw new WeddingSquareCancelTransportError();
  }
  try {
    const url = `https://connect.squareupsandbox.com/v2/subscriptions/${encodeURIComponent(id)}` +
      (method === "POST" ? "/cancel" : "");
    const res = await sender(url, {
      method,
      // A 307/308 redirect must never replay a cancellation POST.
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        "Square-Version": "2025-10-16",
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res || res.status !== 200) throw new WeddingSquareCancelTransportError();
    const length = res.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > 65536))
      throw new WeddingSquareCancelTransportError();
    const text = await res.text();
    if (text.length > 65536) throw new WeddingSquareCancelTransportError();
    const parsed = responseSchema.safeParse(JSON.parse(text));
    if (!parsed.success || parsed.data.subscription.id !== id)
      throw new WeddingSquareCancelTransportError();
    const sub = parsed.data.subscription;
    return Object.freeze({
      id: sub.id, customerId: sub.customer_id, locationId: sub.location_id,
      planVariationId: sub.plan_variation_id, cardId: sub.card_id ?? null,
      providerStatus: sub.status, canceledDate: sub.canceled_date ?? null,
    });
  } catch {
    throw new WeddingSquareCancelTransportError();
  }
}

export function createWeddingSquareCancelTransport(sender: Sender = fetch) {
  return Object.freeze({
    get: (id: string) => read(sender, id, "GET"),
    cancel: (id: string) => read(sender, id, "POST"),
  });
}
export const weddingSquareCancelTransport = createWeddingSquareCancelTransport();
