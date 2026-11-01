import { z } from "zod";
import { createPlatformSquareClient } from "./square-integration";

/**
 * Internal-only read-only attestation of ChefSire's PLATFORM Square sandbox
 * merchant and location. This is not an enrollment authorization, ownership
 * proof for a customer/card, payment confirmation, or subscription readback.
 *
 * The expected merchant ID must be separately configured by the operator.
 * No API routes or end-user inputs may supply provider identifiers.
 */
type MerchantReadback = (merchantId: string) => Promise<unknown>;
type LocationReadback = (locationId: string) => Promise<unknown>;

const noErrors = z.array(z.unknown()).max(0).optional();
const exactId = z.string().min(1).refine(
  (id) => id === id.trim() && !/[\s\x00-\x1f\x7f]/.test(id),
);

const merchantEnvelopeSchema = z.object({
  errors: noErrors,
  merchant: z.object({
    id: exactId,
    status: z.literal("ACTIVE"),
    currency: z.literal("USD"),
    country: z.literal("US"),
  }).passthrough(),
}).passthrough();

const locationEnvelopeSchema = z.object({
  errors: noErrors,
  location: z.object({
    id: exactId,
    merchantId: exactId,
    status: z.literal("ACTIVE"),
    currency: z.literal("USD"),
    country: z.literal("US"),
    // An ACTIVE location without card processing cannot support Wedding billing.
    // Require the exact Square capability; do not infer it from merchant status.
    capabilities: z.array(z.string()).refine((values) => values.includes("CREDIT_CARD_PROCESSING")),
  }).passthrough(),
}).passthrough();

export class WeddingSquareSandboxMerchantAttestationError extends Error {
  constructor() {
    super("Wedding Square sandbox merchant and location identity could not be verified.");
    this.name = "WeddingSquareSandboxMerchantAttestationError";
  }
}

function configuredId(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 &&
    value === value.trim() && !/[\s\x00-\x1f\x7f]/.test(value);
}

export function createWeddingSquareSandboxMerchantAttestation(
  readMerchant: MerchantReadback,
  readLocation: LocationReadback,
) {
  return {
    async inspect() {
      // Gate before instantiating a client or making ANY provider request.
      // Never fall back from sandbox to live Square environments.
      const merchantId = process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      const locationId = process.env.SQUARE_LOCATION_ID;
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !configuredId(merchantId) || !configuredId(locationId) ||
          (process.env.SQUARE_CURRENCY !== undefined &&
           process.env.SQUARE_CURRENCY !== "USD")) {
        throw new WeddingSquareSandboxMerchantAttestationError();
      }

      try {
        // Square SDK v43: both endpoints are GET and return object envelopes.
        // The merchant endpoint resolves "me" using the platform bearer token.
        // "me" binds the bearer credential to its own merchant rather than
        // merely retrieving a caller-configured merchant ID.
        const merchant = merchantEnvelopeSchema.safeParse(await readMerchant("me"));
        if (!merchant.success || merchant.data.merchant.id !== merchantId) {
          throw new WeddingSquareSandboxMerchantAttestationError();
        }

        const location = locationEnvelopeSchema.safeParse(await readLocation(locationId));
        if (!location.success ||
            location.data.location.id !== locationId ||
            location.data.location.merchantId !== merchantId) {
          throw new WeddingSquareSandboxMerchantAttestationError();
        }

        // Evidence only: no database write, payment, entitlement, or subscription
        // creation; the saved enrollment/customer/card is NOT verified here.
        return Object.freeze({
          merchantId,
          locationId,
          currency: "USD" as const,
          verifiedSandboxMerchantContext: true as const,
          authorizesSubscriptionCreation: false as const,
          grantsEntitlement: false as const,
          safeToResubmit: false as const,
        });
      } catch {
        // Sanitize all provider/credential failures, including 2xx envelopes
        // carrying errors. Never report a provider ID or token in an error.
        throw new WeddingSquareSandboxMerchantAttestationError();
      }
    },
  };
}

/** Production wiring is intentionally not called by any public route. */
export const weddingSquareSandboxMerchantAttestation =
  createWeddingSquareSandboxMerchantAttestation(
    async (merchantId) => {
      const client = createPlatformSquareClient();
      return client.merchants.get({ merchantId }, { maxRetries: 0 });
    },
    async (locationId) => {
      const client = createPlatformSquareClient();
      return client.locations.get({ locationId }, { maxRetries: 0 });
    },
  );
