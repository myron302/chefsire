import { z } from "zod";
import type { prepareWeddingSquareSubscriptionRequest } from "./wedding-square-subscription-request";

/**
 * The Square SDK v43 normalizes malformed 2xx 'errors: null' into undefined,
 * erasing evidence that the provider response was invalid. On this financial
 * WRITE endpoint only, use Square's documented sandbox REST API directly so
 * the original JSON is checked BEFORE any SDK/deserialization normalization.
 *
 * The payload matches SDK v43 CreateSubscriptionRequest; there are NO retries,
 * no production host, no browser-callable interface and no sensitive logs.
 * All provider errors are ambiguous: the caller's previously CLAIMED attempt
 * must be blocked for readback instead of resubmitted.
 */
type Request = ReturnType<typeof prepareWeddingSquareSubscriptionRequest>;
type Sender = (url: string, init: RequestInit) => Promise<Response>;
const HOST = "https://connect.squareupsandbox.com/v2/subscriptions";
const exact = z.string().min(1).max(200).refine((v) =>
  !/[\s\x00-\x1f\x7f]/.test(v),
);
const rawResponse = z.object({
  // Explicit errors:null / bad type MUST NOT be erased as though absent.
  errors: z.array(z.unknown()).length(0).optional(),
  subscription: z.object({
    id: exact, location_id: exact, plan_variation_id: exact,
    customer_id: exact, card_id: exact, timezone: z.literal("UTC"),
    start_date: z.string(), status: z.enum(["PENDING", "ACTIVE"]),
  }).passthrough(),
}).passthrough();
export class WeddingSquareRawCreateError extends Error {
  constructor() {
    super("Square sandbox subscription response requires reconciliation.");
    this.name = "WeddingSquareRawCreateError";
  }
}

export function createWeddingSquareRawSubscriptionApi(sender: Sender = fetch) {
  return {
    async create(request: Request) {
      const token = process.env.SQUARE_ACCESS_TOKEN;
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !exact.safeParse(token).success ||
          !exact.safeParse(request?.idempotencyKey).success ||
          request.idempotencyKey.length > 45 ||
          !exact.safeParse(request?.locationId).success ||
          !exact.safeParse(request?.planVariationId).success ||
          !exact.safeParse(request?.customerId).success ||
          !exact.safeParse(request?.cardId).success ||
          request.timezone !== "UTC" ||
          request.locationId !== process.env.SQUARE_LOCATION_ID ||
          (request.startDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(request.startDate))) {
        throw new WeddingSquareRawCreateError();
      }
      const payload = {
        idempotency_key: request.idempotencyKey,
        location_id: request.locationId,
        plan_variation_id: request.planVariationId,
        customer_id: request.customerId,
        card_id: request.cardId,
        timezone: "UTC",
        ...(request.startDate ? { start_date: request.startDate } : {}),
      };
      try {
        // Request uses only Square's HTTPS sandbox origin and a single POST.
        // A failed/timeout response may still have created a subscription.
        const response = await sender(HOST, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Square-Version": "2025-10-16", // exact version used by SDK 43.2.0
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
        if (!response || response.status < 200 || response.status >= 300) {
          throw new WeddingSquareRawCreateError();
        }
        // Reject oversized or malformed provider data without recording it.
        const length = response.headers.get("content-length");
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > 65536)) {
          throw new WeddingSquareRawCreateError();
        }
        const body = await response.text();
        if (body.length > 65536) throw new WeddingSquareRawCreateError();
        const parsed = rawResponse.safeParse(JSON.parse(body));
        if (!parsed.success) throw new WeddingSquareRawCreateError();
        const sub = parsed.data.subscription;
        return Object.freeze({
          // Explicitly map the verified RAW snake_case provider envelope to
          // the fields expected by our existing confirmation coordinator.
          subscription: Object.freeze({
            id: sub.id, locationId: sub.location_id,
            planVariationId: sub.plan_variation_id, customerId: sub.customer_id,
            cardId: sub.card_id, timezone: sub.timezone,
            startDate: sub.start_date, status: sub.status,
          }),
        });
      } catch {
        // Never reveal Square response bodies, provider/customer/card IDs,
        // access tokens or network error details in an application exception.
        throw new WeddingSquareRawCreateError();
      }
    },
  };
}

export const weddingSquareRawSubscriptionApi = createWeddingSquareRawSubscriptionApi();
