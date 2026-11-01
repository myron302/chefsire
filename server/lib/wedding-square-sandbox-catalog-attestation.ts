import { z } from "zod";
import { createPlatformSquareClient } from "./square-integration";
import { weddingSquareSandboxMerchantAttestation } from "./wedding-square-sandbox-merchant-attestation";
import { WEDDING_MONTHLY_CENTS } from "./wedding-square-billing-policy";

/**
 * Internal-only, sandbox-only read-only catalog verification for the configured
 * Wedding subscription plan variations. This checks current provider catalog
 * terms; it is NOT a customer consent, enrollment, charge or entitlement gate.
 * The two catalog IDs come only from server operator configuration.
 */
type ReadCatalogObject = (objectId: string) => Promise<unknown>;
type MerchantAttestation = Pick<typeof weddingSquareSandboxMerchantAttestation, "inspect">;

const exactId = z.string().min(1).refine((value) => value === value.trim());
const money = z.object({
  amount: z.union([z.bigint(), z.number().int().safe()]),
  currency: z.literal("USD"),
}).passthrough();
const envelope = z.object({
  errors: z.array(z.unknown()).max(0).optional(),
  object: z.object({
    id: exactId,
    type: z.literal("SUBSCRIPTION_PLAN_VARIATION"),
    isDeleted: z.boolean().optional(),
    presentAtAllLocations: z.boolean().optional(),
    presentAtLocationIds: z.array(exactId).optional(),
    absentAtLocationIds: z.array(exactId).optional(),
    subscriptionPlanVariationData: z.object({
      subscriptionPlanId: exactId,
      successorPlanVariationId: exactId.optional(),
      canProrate: z.boolean().optional(),
      monthlyBillingAnchorDate: z.number().int().optional(),
      phases: z.array(z.object({
        cadence: z.literal("MONTHLY"),
        ordinal: z.number().int(),
        periods: z.number().int().optional(),
        pricing: z.object({
          type: z.literal("STATIC"),
          priceMoney: money,
          price: money.optional(),
        }).passthrough(),
        recurringPriceMoney: money.optional(),
      }).passthrough()).length(1),
    }).passthrough(),
  }).passthrough(),
}).passthrough();

function configuredId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

export class WeddingSquareSandboxCatalogAttestationError extends Error {
  constructor() {
    super("Wedding Square sandbox catalog plan terms could not be verified.");
    this.name = "WeddingSquareSandboxCatalogAttestationError";
  }
}

function verifyVariation(response: unknown, id: string, locationId: string, cents: number) {
  const parsed = envelope.safeParse(response);
  if (!parsed.success) throw new WeddingSquareSandboxCatalogAttestationError();
  const object = parsed.data.object;
  const data = object.subscriptionPlanVariationData;
  const phase = data.phases[0];
  const price = phase.pricing.priceMoney;
  // Exactly one indefinite monthly STATIC USD phase, no trial, discount,
  // proration or alternate anchor date that could contradict consent.
  if (object.id !== id || object.isDeleted === true ||
      object.absentAtLocationIds?.includes(locationId) ||
      !(object.presentAtAllLocations === true ||
        object.presentAtLocationIds?.includes(locationId)) ||
      data.successorPlanVariationId !== undefined ||
      data.canProrate === true || data.monthlyBillingAnchorDate !== undefined ||
      phase.ordinal !== 0 || phase.periods !== undefined ||
      BigInt(price.amount) !== BigInt(cents) ||
      (phase.pricing.price &&
       BigInt(phase.pricing.price.amount) !== BigInt(cents)) ||
      (phase.recurringPriceMoney &&
       BigInt(phase.recurringPriceMoney.amount) !== BigInt(cents))) {
    throw new WeddingSquareSandboxCatalogAttestationError();
  }
}


export function createWeddingSquareSandboxCatalogAttestation(
  merchantAttestation: MerchantAttestation,
  readCatalogObject: ReadCatalogObject,
) {
  return {
    async inspect() {
      const merchantId = process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      const locationId = process.env.SQUARE_LOCATION_ID;
      const premiumId = process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID;
      const eliteId = process.env.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID;
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          (process.env.SQUARE_CURRENCY !== undefined && process.env.SQUARE_CURRENCY !== "USD") ||
          !configuredId(merchantId) || !configuredId(locationId) ||
          !configuredId(premiumId) || !configuredId(eliteId) ||
          premiumId === eliteId) {
        throw new WeddingSquareSandboxCatalogAttestationError();
      }

      try {
        // Token-owned merchant and location verification must precede catalog GETs.
        const attested = await merchantAttestation.inspect();
        if (!attested || attested.verifiedSandboxMerchantContext !== true ||
            attested.merchantId !== merchantId || attested.locationId !== locationId ||
            attested.currency !== "USD" ||
            attested.authorizesSubscriptionCreation !== false ||
            attested.grantsEntitlement !== false ||
            attested.safeToResubmit !== false) {
          throw new WeddingSquareSandboxCatalogAttestationError();
        }
        verifyVariation(
          await readCatalogObject(premiumId), premiumId, locationId, WEDDING_MONTHLY_CENTS.premium,
        );
        verifyVariation(
          await readCatalogObject(eliteId), eliteId, locationId, WEDDING_MONTHLY_CENTS.elite,
        );
        return Object.freeze({
          merchantId, locationId, currency: "USD" as const,
          premiumPlanVariationId: premiumId, elitePlanVariationId: eliteId,
          verifiedSandboxCatalogTerms: true as const,
          authorizesSubscriptionCreation: false as const,
          grantsEntitlement: false as const,
          safeToResubmit: false as const,
        });
      } catch {
        throw new WeddingSquareSandboxCatalogAttestationError();
      }
    },
  };
}

/** No public route or billing workflow calls this service. */
export const weddingSquareSandboxCatalogAttestation =
  createWeddingSquareSandboxCatalogAttestation(
    weddingSquareSandboxMerchantAttestation,
    async (objectId) => {
      const client = createPlatformSquareClient();
      return client.catalog.object.get({ objectId }, { maxRetries: 0 });
    },
  );
