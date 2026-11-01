import { z } from "zod";

/**
 * Strict, read-only Square sandbox customer/card retrieval for Wedding.
 * Square SDK v43 can normalize 'errors: null' in a 200 response to
 * 'errors: undefined'; these identity reads must validate ORIGINAL JSON.
 * The merchant and IDs are supplied only by server-owned Neon/attestation.
 * No card number, tokenization, payments, DB write, retry or public route.
 */
type Sender = (url: string, init: RequestInit) => Promise<Response>;
const canonicalId = z.string().min(1).max(200).refine((id) =>
  !/[\s\x00-\x1f\x7f]/.test(id),
);
const noErrors = z.array(z.unknown()).length(0).optional();
const customerSchema = z.object({
  errors: noErrors,
  customer: z.object({
    id: canonicalId,
    reference_id: canonicalId.nullish(),
  }).passthrough(),
}).passthrough();
const cardSchema = z.object({
  errors: noErrors,
  card: z.object({
    id: canonicalId,
    customer_id: canonicalId,
    merchant_id: canonicalId,
    enabled: z.literal(true),
  }).passthrough(),
}).passthrough();

export class WeddingSquareCustomerCardApiError extends Error {
  constructor() {
    super("Wedding Square sandbox customer and card identity are unavailable.");
    this.name = "WeddingSquareCustomerCardApiError";
  }
}

function config() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
      !canonicalId.safeParse(token).success) {
    throw new WeddingSquareCustomerCardApiError();
  }
  return token as string;
}

async function getRaw(
  sender: Sender, path: "customers" | "cards", id: string,
) {
  const token = config();
  if (!canonicalId.safeParse(id).success) throw new WeddingSquareCustomerCardApiError();

  try {
    const response = await sender(
      `https://connect.squareupsandbox.com/v2/${path}/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Square-Version": "2025-10-16",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response || response.status !== 200) throw new WeddingSquareCustomerCardApiError();
    const headerLength = response.headers.get("content-length");
    if (headerLength !== null && (!/^\d+$/.test(headerLength) || Number(headerLength) > 65536)) {
      throw new WeddingSquareCustomerCardApiError();
    }
    // Limit the parsed payload size, even if the server omitted Content-Length.
    const text = await response.text();
    if (text.length > 65536) throw new WeddingSquareCustomerCardApiError();
    return JSON.parse(text) as unknown;
  } catch {
    throw new WeddingSquareCustomerCardApiError();
  }
}

export function createWeddingSquareSandboxCustomerCardApi(sender: Sender = fetch) {
  return {
    async getCustomer(id: string) {
      const parsed = customerSchema.safeParse(await getRaw(sender, "customers", id));
      if (!parsed.success || parsed.data.errors?.length) throw new WeddingSquareCustomerCardApiError();
      const { customer } = parsed.data;
      // Customer has NO Square merchantId field. Merchant binding is proven
      // by a token-owned 'me' attestation plus this GET with the SAME token.
      return Object.freeze({
        id: customer.id,
        referenceId: customer.reference_id ?? null,
      });
    },
    async getCard(id: string) {
      const parsed = cardSchema.safeParse(await getRaw(sender, "cards", id));
      if (!parsed.success || parsed.data.errors?.length) throw new WeddingSquareCustomerCardApiError();
      const { card } = parsed.data;
      return Object.freeze({
        id: card.id,
        customerId: card.customer_id,
        merchantId: card.merchant_id,
        enabled: true as const,
      });
    },
  };
}

export const weddingSquareSandboxCustomerCardApi =
  createWeddingSquareSandboxCustomerCardApi();
