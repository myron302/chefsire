import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareProviderSmoke, WeddingSquareProviderSmokeError } from "./wedding-square-sandbox-provider-smoke";

const env = {
  SQUARE_ENV: "sandbox",
  SQUARE_ACCESS_TOKEN: "sandbox-opaque",
  SQUARE_LIVE_PAYMENTS_ENABLED: "false",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "merchant",
  SQUARE_LOCATION_ID: "location",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID: "premium",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID: "elite",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "pv",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "ev",
};
const provider = {
  verifiedSandboxCatalogTerms: true,
  merchantId: "merchant", locationId: "location",
  premiumPlanId: "premium", elitePlanId: "elite",
  premiumPlanVariationId: "pv", elitePlanVariationId: "ev",
  currency: "USD", authorizesSubscriptionCreation: false,
  grantsEntitlement: false, safeToResubmit: false,
};
test("sandbox operator smoke returns only non-secret read-only attestation", async () => {
  let calls = 0;
  const audit = createWeddingSquareProviderSmoke({ inspect: async () => { calls++; return provider; } } as any);
  const result = await audit.inspect(env);
  assert.equal(calls, 1);
  assert.equal(result.verifiedMerchantLocationAndCatalog, true);
  assert.equal(result.paymentVerified, false);
  assert.equal(result.subscriptionCreated, false);
  assert.doesNotMatch(JSON.stringify(result), /sandbox-opaque|"merchant"|"location"|premiumPlanId/);
});
test("production and live-enabled environments never touch Square", async () => {
  let calls = 0;
  const audit = createWeddingSquareProviderSmoke({ inspect: async () => { calls++; return provider; } } as any);
  await assert.rejects(audit.inspect({ ...env, SQUARE_ENV: "production" }), WeddingSquareProviderSmokeError);
  await assert.rejects(audit.inspect({ ...env, SQUARE_LIVE_PAYMENTS_ENABLED: "true" }), WeddingSquareProviderSmokeError);
  assert.equal(calls, 0);
});
test("mismatched merchant or ambiguous provider evidence fails without secret leakage", async () => {
  const audit = createWeddingSquareProviderSmoke({ inspect: async () => ({ ...provider, merchantId: "other" }) } as any);
  await assert.rejects(audit.inspect(env), err =>
    err instanceof WeddingSquareProviderSmokeError && !/merchant|sandbox-opaque/i.test(err.message));
});
test("network failures are sanitized and never count as a verified payment", async () => {
  const audit = createWeddingSquareProviderSmoke({ inspect: async () => { throw Error("secret-token"); } } as any);
  await assert.rejects(audit.inspect(env), err =>
    err instanceof WeddingSquareProviderSmokeError && !/secret-token/i.test(err.message));
});
