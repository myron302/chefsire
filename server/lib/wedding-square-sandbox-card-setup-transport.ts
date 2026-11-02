import { z } from "zod";

/**
 * Internal sandbox-only Square customer/card writer. Never mount this as an
 * HTTP route or call without a durable, owner-bound one-shot intent committed
 * to Neon BEFORE the first provider POST.
 *
 * Square Web Payments SDK supplies a one-time source token, never raw PAN/CVV.
 * This transport does not log tokens, store card details, retry ambiguous POSTs,
 * create subscriptions, or authorize paid Wedding access.
 */
type Sender = (url: string, init: RequestInit) => Promise<Response>;
const id = z.string().min(1).max(200).refine(value =>
  value === value.trim() && !/[\s\x00-\x1f\x7f]/.test(value));
const key = z.string().min(1).max(45).regex(/^[A-Za-z0-9_-]+$/);
const reference = z.string().min(1).max(100).refine(value =>
  value === value.trim() && !/[\s\x00-\x1f\x7f]/.test(value));
const source = z.string().min(6).max(16384).startsWith("cnon:");
const verification = z.string().min(1).max(16384);
const email = z.string().email().max(254);
const emptyErrors = z.array(z.unknown()).length(0).optional();
const customerEnvelope = z.object({
  errors: emptyErrors,
  customer: z.object({ id, reference_id: reference }).passthrough(),
}).passthrough();
const cardEnvelope = z.object({
  errors: emptyErrors,
  card: z.object({
    id, customer_id: id, merchant_id: id,
    enabled: z.literal(true),
    reference_id: reference.optional().nullable(),
  }).passthrough(),
}).passthrough();
export class WeddingSquareCardSetupTransportError extends Error {
  constructor() {
    super("Square sandbox card setup requires manual reconciliation.");
    this.name = "WeddingSquareCardSetupTransportError";
  }
}
function token() {
  const v = process.env.SQUARE_ACCESS_TOKEN;
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
      process.env.WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED !== "true" ||
      !id.safeParse(v).success) throw new WeddingSquareCardSetupTransportError();
  return v!;
}
async function post(sender: Sender, endpoint: "customers"|"cards", body: object) {
  const access = token();
  try {
    const response = await sender("https://connect.squareupsandbox.com/v2/" + endpoint, {
      method: "POST", headers: {
        Authorization: "Bearer " + access,
        "Square-Version": "2025-10-16",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response || ![200, 201].includes(response.status)) throw new WeddingSquareCardSetupTransportError();
    const size = response.headers.get("content-length");
    if (size !== null && (!/^\d+$/.test(size) || Number(size) > 65536)) {
      throw new WeddingSquareCardSetupTransportError();
    }
    const text = await response.text();
    if (text.length > 65536) throw new WeddingSquareCardSetupTransportError();
    return JSON.parse(text) as unknown;
  } catch {
    // Even a timeout may have committed the provider operation. NO retry.
    throw new WeddingSquareCardSetupTransportError();
  }
}
export function createWeddingSquareSandboxCardSetupTransport(sender: Sender = fetch) {
  return {
    async createCustomer(input: {
      idempotencyKey: string;
      referenceId: string;
      verifiedEmailAddress: string;
    }) {
      if (!key.safeParse(input.idempotencyKey).success ||
          !reference.safeParse(input.referenceId).success ||
          !email.safeParse(input.verifiedEmailAddress).success) {
        throw new WeddingSquareCardSetupTransportError();
      }
      const parsed = customerEnvelope.safeParse(await post(sender, "customers", {
        idempotency_key: input.idempotencyKey,
        reference_id: input.referenceId,
        email_address: input.verifiedEmailAddress,
      }));
      if (!parsed.success || parsed.data.customer.reference_id !== input.referenceId) {
        throw new WeddingSquareCardSetupTransportError();
      }
      return Object.freeze({ id: parsed.data.customer.id, referenceId: input.referenceId });
    },
    async createCard(input: {
      idempotencyKey: string;
      sourceId: string;
      verificationToken?: string;
      customerId: string;
      referenceId: string;
      expectedMerchantId: string;
    }) {
      if (!key.safeParse(input.idempotencyKey).success ||
          !source.safeParse(input.sourceId).success ||
          (input.verificationToken !== undefined && !verification.safeParse(input.verificationToken).success) ||
          !id.safeParse(input.customerId).success ||
          !reference.safeParse(input.referenceId).success ||
          !id.safeParse(input.expectedMerchantId).success) {
        throw new WeddingSquareCardSetupTransportError();
      }
      const parsed = cardEnvelope.safeParse(await post(sender, "cards", {
        idempotency_key: input.idempotencyKey,
        source_id: input.sourceId,
        ...(input.verificationToken ? { verification_token: input.verificationToken } : {}),
        card: { customer_id: input.customerId, reference_id: input.referenceId },
      }));
      if (!parsed.success ||
          parsed.data.card.customer_id !== input.customerId ||
          parsed.data.card.merchant_id !== input.expectedMerchantId ||
          (parsed.data.card.reference_id != null &&
            parsed.data.card.reference_id !== input.referenceId)) {
        throw new WeddingSquareCardSetupTransportError();
      }
      return Object.freeze({
        id: parsed.data.card.id,
        customerId: input.customerId,
        merchantId: input.expectedMerchantId,
        enabled: true as const,
      });
    },
  };
}
export const weddingSquareSandboxCardSetupTransport =
  createWeddingSquareSandboxCardSetupTransport();
