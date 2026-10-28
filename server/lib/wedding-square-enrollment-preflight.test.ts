import assert from "node:assert/strict";
import { test } from "node:test";
import { weddingSquareSandboxPreflight, WeddingSquareSandboxUnavailableError } from "./wedding-square-enrollment-preflight";

const sandbox = {
  SQUARE_ENV: "sandbox",
  SQUARE_ACCESS_TOKEN: "sandbox-secret",
  SQUARE_LOCATION_ID: "sandbox-location",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "premium-plan",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "elite-plan",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
};

test("sandbox preflight selects a distinct server-configured variation for each tier", () => {
  const premium = weddingSquareSandboxPreflight(sandbox, "premium");
  const elite = weddingSquareSandboxPreflight(sandbox, "elite");
  assert.equal(premium.planVariationId, "premium-plan");
  assert.equal(elite.planVariationId, "elite-plan");
  assert.equal(premium.environment, "sandbox");
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
  for (const field of ["SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID", "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID", "WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID"] as const) {
    assert.throws(() => weddingSquareSandboxPreflight({ ...sandbox, [field]: "" }, "premium"), WeddingSquareSandboxUnavailableError);
  }
});

test("rejects identical plan mappings and invalid tiers", () => {
  assert.throws(() => weddingSquareSandboxPreflight({
    ...sandbox,
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "same",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "same",
  }, "elite"), WeddingSquareSandboxUnavailableError);
  assert.throws(() => weddingSquareSandboxPreflight(sandbox, "free" as any), WeddingSquareSandboxUnavailableError);
});
