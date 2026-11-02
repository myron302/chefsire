import { weddingSquareSandboxCatalogAttestation } from "../lib/wedding-square-sandbox-catalog-attestation";

/**
 * Operator-triggered REAL Square sandbox GET smoke test. It deliberately
 * performs no customer/card creation, subscription POST, payment or DB write.
 * The output never includes provider identifiers, environment secret values,
 * or raw errors from Square.
 */
type Source = Pick<typeof weddingSquareSandboxCatalogAttestation, "inspect">;
type Env = NodeJS.ProcessEnv;
export class WeddingSquareProviderSmokeError extends Error {
  constructor() {
    super("Wedding Square sandbox provider attestation failed. No payment was verified.");
    this.name = "WeddingSquareProviderSmokeError";
  }
}
const safeId = (value: unknown) => typeof value === "string" && value.length > 0 &&
  value.length <= 200 && !/[\s\x00-\x1f\x7f]/.test(value);
export function createWeddingSquareProviderSmoke(source: Source) {
  return {
    async inspect(env: Env = process.env) {
      if (env.SQUARE_ENV !== "sandbox" ||
          env.SQUARE_LIVE_PAYMENTS_ENABLED === "true" ||
          env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !safeId(env.SQUARE_ACCESS_TOKEN) ||
          !safeId(env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID) ||
          !safeId(env.SQUARE_LOCATION_ID)) {
        throw new WeddingSquareProviderSmokeError();
      }
      try {
        const provider = await source.inspect();
        if (provider?.verifiedSandboxCatalogTerms !== true ||
            provider.merchantId !== env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID ||
            provider.locationId !== env.SQUARE_LOCATION_ID ||
            provider.premiumPlanId !== env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID ||
            provider.elitePlanId !== env.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID ||
            provider.premiumPlanVariationId !== env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID ||
            provider.elitePlanVariationId !== env.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID ||
            provider.currency !== "USD" ||
            provider.authorizesSubscriptionCreation !== false ||
            provider.grantsEntitlement !== false ||
            provider.safeToResubmit !== false) {
          throw new WeddingSquareProviderSmokeError();
        }
        return Object.freeze({
          ok: true as const,
          provider: "square-sandbox" as const,
          verifiedMerchantLocationAndCatalog: true as const,
          monthlyPremiumCents: 2499 as const,
          monthlyEliteCents: 4999 as const,
          providerReadsOnly: true as const,
          subscriptionCreated: false as const,
          paymentVerified: false as const,
          liveBillingEnabled: false as const,
          nextAction: "Run separately authorized provider-backed enrollment and charge lifecycle acceptance.",
        });
      } catch {
        throw new WeddingSquareProviderSmokeError();
      }
    },
  };
}
export const weddingSquareProviderSmoke =
  createWeddingSquareProviderSmoke(weddingSquareSandboxCatalogAttestation);

// No automatic provider requests during build/test/server boot.
if (process.argv[1]?.endsWith("wedding-square-sandbox-provider-smoke.ts")) {
  weddingSquareProviderSmoke.inspect().then(result => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }).catch(() => {
    process.stderr.write("Square sandbox provider attestation unavailable; no payment verified.\n");
    process.exitCode = 1;
  });
}
