import assert from "node:assert/strict";
import { test } from "node:test";
import { weddingSquareSandboxPreflight, WeddingSquareSandboxUnavailableError } from "./wedding-square-enrollment-preflight";

const sandbox = {
  SQUARE_ENV: "sandbox",
  SQUARE_ACCESS_TOKEN: "sandbox-secret",
  SQUARE_CURRENCY: "USD",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "sandbox-merchant",
  SQUARE_LOCATION_ID: "sandbox-location",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "premium-plan",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "elite-plan",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID: "premium-parent-plan",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID: "elite-parent-plan",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
};

test("sandbox preflight selects a distinct server-configured variation for each tier", () => {
  const premium = weddingSquareSandboxPreflight(sandbox, "premium");
  const elite = weddingSquareSandboxPreflight(sandbox, "elite");
  assert.equal(premium.planVariationId, "premium-plan");
  assert.equal(elite.planVariationId, "elite-plan");
  assert.equal(premium.planId, "premium-parent-plan");
  assert.equal(elite.planId, "elite-parent-plan");
  assert.equal(premium.environment, "sandbox");
  assert.equal(premium.merchantId, "sandbox-merchant");
  assert.equal(Object.isFrozen(premium), true);
  assert.equal("accessToken" in premium, false);
  assert.equal(JSON.stringify(premium).includes("sandbox-secret"), false);
});

test("sandbox enrollment is off by default", () => {
  assert.throws(() => weddingSquareSandboxPreflight({ ...sandbox, WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: undefined }, "elite"), WeddingSquareSandboxUnavailableError);
});

test("fails closed against production or missing environment", () => {
  for (const env of ["production", "live", "", undefined]) {
    assert.throws(() => weddingSquareSandboxPreflight({ ...sandbox, SQUARE_ENV: env }, "elite"), WeddingSquareSandboxUnavailableError);
  }
});

test("rejects unconfigured locations, tokens and plan variations", () => {
  for (const field of ["SQUARE_ACCESS_TOKEN", "WEDDING_SQUARE_SANDBOX_MERCHANT_ID", "SQUARE_LOCATION_ID", "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID", "WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID", "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID", "WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID"] as const) {
    assert.throws(() => weddingSquareSandboxPreflight({ ...sandbox, [field]: "" }, "premium"), WeddingSquareSandboxUnavailableError);
  }
});

test("rejects padded or missing provider identities instead of trimming them", () => {
  for (const field of [
    "WEDDING_SQUARE_SANDBOX_MERCHANT_ID", "SQUARE_LOCATION_ID", "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID",
    "WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID", "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID",
    "WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID",
  ] as const) {
    assert.throws(() => weddingSquareSandboxPreflight({ ...sandbox, [field]: ` ${sandbox[field]} ` }, "premium"), WeddingSquareSandboxUnavailableError);
    assert.throws(() => weddingSquareSandboxPreflight({ ...sandbox, [field]: undefined }, "premium"), WeddingSquareSandboxUnavailableError);
  }
});

test("rejects identical plan mappings and invalid tiers", () => {
  assert.throws(() => weddingSquareSandboxPreflight({
    ...sandbox,
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "same",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "same",
  }, "elite"), WeddingSquareSandboxUnavailableError);
  assert.throws(() => weddingSquareSandboxPreflight({
    ...sandbox,
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID: "same-parent",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID: "same-parent",
  }, "elite"), WeddingSquareSandboxUnavailableError);
  assert.throws(() => weddingSquareSandboxPreflight(sandbox, "free" as any), WeddingSquareSandboxUnavailableError);
});

test("rejects non-USD configured currency and padded credentials before request construction", () => {
  for (const currency of ["CAD", "usd", "", " USD "]) {
    assert.throws(() => weddingSquareSandboxPreflight({ ...sandbox, SQUARE_CURRENCY: currency }, "premium"), WeddingSquareSandboxUnavailableError);
  }
  assert.throws(() => weddingSquareSandboxPreflight({ ...sandbox, SQUARE_ACCESS_TOKEN: " sandbox-secret " }, "premium"), WeddingSquareSandboxUnavailableError);
  // Older installations without SQUARE_CURRENCY retain the sandbox-only USD default.
  assert.equal(weddingSquareSandboxPreflight({ ...sandbox, SQUARE_CURRENCY: undefined }, "premium").merchantId, "sandbox-merchant");
});
