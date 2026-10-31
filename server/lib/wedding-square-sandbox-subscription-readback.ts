import { z } from "zod";
import { createPlatformSquareClient } from "./square-integration";
import { weddingSquareReconciliationReadback } from "./wedding-square-reconciliation-readback";
import { weddingSquareSandboxMerchantAttestation } from "./wedding-square-sandbox-merchant-attestation";
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
type MerchantAttestation = Pick<typeof weddingSquareSandboxMerchantAttestation, "inspect">;

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
  merchantAttestation: MerchantAttestation,
) {
  return {
    async inspect(attemptId: string, authenticatedUserId: string) {
      // Gate BEFORE any DB or provider calls. No production fallback.
      const expectedMerchantId = process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !expectedMerchantId || expectedMerchantId !== expectedMerchantId.trim() ||
          !attemptId?.trim() || !authenticatedUserId?.trim()) {
        throw new WeddingSquareSandboxReadbackUnavailableError();
      }

      try {
        const saved = await savedReadback.inspect(attemptId, authenticatedUserId);
        const location = process.env.SQUARE_LOCATION_ID?.trim();
        const premiumPlan = process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID?.trim();
        const elitePlan = process.env.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID?.trim();

        // Enforce the same platform location and Wedding-only plan mapping as
        // enrollment preflight. Unknown or unlinked subscriptions remain blocked.
        if (!saved || saved.attemptId !== attemptId ||
            !saved.providerSubscriptionId?.trim() ||
            !location || !premiumPlan || !elitePlan || premiumPlan === elitePlan ||
            saved.locationId !== location ||
            (saved.planVariationId !== premiumPlan && saved.planVariationId !== elitePlan)) {
          throw new WeddingSquareSandboxReadbackUnavailableError();
        }

        // Require token-bound platform merchant and location evidence BEFORE the
        // subscription GET. An unknown merchant, wrong location, or ambiguous
        // attestation cannot become verified operator reconciliation evidence.
        const attested = await merchantAttestation.inspect();
        if (attested.verifiedSandboxMerchantContext !== true ||
            attested.merchantId !== expectedMerchantId ||
            attested.locationId !== saved.locationId ||
            attested.currency !== "USD" ||
            attested.authorizesSubscriptionCreation !== false ||
            attested.grantsEntitlement !== false ||
            attested.safeToResubmit !== false) {
          throw new WeddingSquareSandboxReadbackUnavailableError();
        }

        // SDK v43: subscriptions.get({ subscriptionId }) returns { subscription }.
        // This is the only Square request this service can make: a GET by the
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
    weddingSquareSandboxMerchantAttestation,
  );
