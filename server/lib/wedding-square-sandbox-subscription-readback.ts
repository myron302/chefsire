import { z } from "zod";
import { createPlatformSquareClient } from "./square-integration";
import { weddingSquareReconciliationReadback } from "./wedding-square-reconciliation-readback";
import { weddingSquareSandboxCatalogAttestation } from "./wedding-square-sandbox-catalog-attestation";
import { verifyWeddingSquareProviderReconciliation } from "./wedding-square-provider-reconciliation";

/**
 * Internal-only, read-only Square sandbox retrieval of a known subscription ID.
 * The only accepted identifier comes from an authenticated owner's persisted
 * Neon enrollment attempt. Missing IDs never trigger an exploratory search.
 *
 * The platform Square client reads the server's sandbox credential; no token,
 * provider response or identifier can be supplied by a browser.
 * This does not establish payment evidence or grant entitlements.
 */
type SavedReadback = Pick<typeof weddingSquareReconciliationReadback, "inspect">;
type ProviderReadback = (subscriptionId: string) => Promise<unknown>;
type CatalogAttestation = Pick<typeof weddingSquareSandboxCatalogAttestation, "inspect">;

// Check that provider fields are nonblank, but NEVER normalize them. The
// Phase 18 validator must compare the exact bytes Square returned with Neon.
const providerFieldSchema = z.string().min(1).refine((value) => value.trim().length > 0);

const providerEnvelopeSchema = z.object({
  subscription: z.object({
    id: providerFieldSchema,
    customerId: providerFieldSchema,
    cardId: providerFieldSchema,
    locationId: providerFieldSchema,
    planVariationId: providerFieldSchema,
    status: providerFieldSchema,
  }).passthrough(),
  // A 2xx Square response can contain both a subscription and API errors.
  // Treat nonempty (or malformed) errors as ambiguous, never as verified data.
  errors: z.array(z.unknown()).max(0).optional(),
}).passthrough();

// Never normalize operator or persisted provider identifiers. A padded or
// malformed ID is not the identity that was configured or saved.
function exactId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

export class WeddingSquareSandboxReadbackUnavailableError extends Error {
  constructor() {
    super("Wedding Square sandbox subscription readback is unavailable; operator reconciliation required.");
    this.name = "WeddingSquareSandboxReadbackUnavailableError";
  }
}

/** Injectable dependencies keep tests offline and do not expand the public API. */
export function createWeddingSquareSandboxSubscriptionReadback(
  savedReadback: SavedReadback,
  readProviderSubscription: ProviderReadback,
  catalogAttestation: CatalogAttestation,
) {
  return {
    async inspect(attemptId: string, authenticatedUserId: string) {
      // Validate the complete sandbox configuration BEFORE reading Neon.
      // An invalid location/plan mapping must not be silently trimmed into a
      // different identity or cause unnecessary database/provider traffic.
      const expectedMerchantId = process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      const location = process.env.SQUARE_LOCATION_ID;
      const premiumPlan = process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID;
      const elitePlan = process.env.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID;
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          (process.env.SQUARE_CURRENCY !== undefined && process.env.SQUARE_CURRENCY !== "USD") ||
          !exactId(expectedMerchantId) || !exactId(location) ||
          !exactId(premiumPlan) || !exactId(elitePlan) ||
          premiumPlan === elitePlan ||
          !exactId(attemptId) || !exactId(authenticatedUserId)) {
        throw new WeddingSquareSandboxReadbackUnavailableError();
      }

      try {
        const saved = await savedReadback.inspect(attemptId, authenticatedUserId);

        // Reject malformed persisted identity/evidence BEFORE making any
        // merchant or subscription GET. Provider reconciliation also validates
        // these fields, but waiting until after a GET is unnecessary exposure.
        if (!saved || saved.attemptId !== attemptId ||
            !["submitting", "needs_reconciliation", "confirmed"].includes(saved.status) ||
            !exactId(saved.providerSubscriptionId) ||
            !exactId(saved.persistedIdempotencyKey) ||
            !/^[a-f0-9]{64}$/.test(saved.persistedRequestFingerprint ?? "") ||
            !exactId(saved.customerId) || !exactId(saved.cardId) ||
            saved.locationId !== location ||
            (saved.planVariationId !== premiumPlan && saved.planVariationId !== elitePlan)) {
          throw new WeddingSquareSandboxReadbackUnavailableError();
        }

        // Catalog attestation itself verifies the token-owned platform merchant
        // and location, then independently reads BOTH configured Wedding plans.
        // Do not retrieve a saved subscription until current sandbox catalog
        // terms match canonical Premium/Elite monthly prices and cadence.
        const attested = await catalogAttestation.inspect();
        if (!attested || attested.verifiedSandboxCatalogTerms !== true ||
            attested.merchantId !== expectedMerchantId ||
            attested.locationId !== saved.locationId ||
            attested.currency !== "USD" ||
            attested.premiumPlanVariationId !== premiumPlan ||
            attested.elitePlanVariationId !== elitePlan ||
            attested.authorizesSubscriptionCreation !== false ||
            attested.grantsEntitlement !== false ||
            attested.safeToResubmit !== false) {
          throw new WeddingSquareSandboxReadbackUnavailableError();
        }

        // SDK v43: subscriptions.get({ subscriptionId }) returns { subscription }.
        // The only subscription request is a GET by the
        // already-saved ID, never a search, create, update or resubmission.
        const response = await readProviderSubscription(saved.providerSubscriptionId);
        const provider = providerEnvelopeSchema.safeParse(response);
        if (!provider.success) throw new WeddingSquareSandboxReadbackUnavailableError();

        const verified = verifyWeddingSquareProviderReconciliation(saved, provider.data.subscription);
        if (!verified.existingIdMatches ||
            verified.grantsEntitlement !== false ||
            verified.safeToResubmit !== false ||
            verified.requiresOperatorReconciliation !== true) {
          throw new WeddingSquareSandboxReadbackUnavailableError();
        }
        return verified;
      } catch {
        // No identifiers, Square error text, credentials, or DB evidence in errors.
        // A failed readback never authorizes an automatic subscription retry.
        throw new WeddingSquareSandboxReadbackUnavailableError();
      }
    },
  };
}

export const weddingSquareSandboxSubscriptionReadback =
  createWeddingSquareSandboxSubscriptionReadback(
    weddingSquareReconciliationReadback,
    async (subscriptionId) => {
      // The platform account, not a connected Catering vendor or browser token.
      const client = createPlatformSquareClient();
      return client.subscriptions.get({ subscriptionId }, { maxRetries: 0 });
    },
    weddingSquareSandboxCatalogAttestation,
  );
