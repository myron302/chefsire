import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { subscriptionCheckoutRequestSchema, SUBSCRIPTION_BILLING_UNAVAILABLE } from "../lib/subscription-security";
import { MARKETPLACE_PAID_TIER_IDS } from "../../shared/subscription-tiers";

const square = readFileSync(new URL("./square.ts", import.meta.url), "utf8");

test("every canonical paid marketplace tier reaches billing unavailable", () => {
  assert.deepEqual(MARKETPLACE_PAID_TIER_IDS, ["starter", "professional", "enterprise", "premium_plus"]);
  for (const tier of MARKETPLACE_PAID_TIER_IDS) {
    assert.equal(subscriptionCheckoutRequestSchema.safeParse({ tier, trial: false }).success, true);
  }
  assert.equal(SUBSCRIPTION_BILLING_UNAVAILABLE, "SUBSCRIPTION_BILLING_UNAVAILABLE");
  assert.match(square, /status\(503\)\.json\(subscriptionCheckoutUnavailableResponse\)/);
});

test("unknown tiers, malformed input, and client authority fields are rejected", () => {
  for (const input of [
    { tier: "pro" },
    { tier: "unknown" },
    { tier: "starter", trial: "true" },
    { tier: "starter", userId: "victim" },
    { tier: "professional", email: "attacker@example.com" },
    { tier: "enterprise", subscriptionStatus: "active" },
    { tier: "premium_plus", providerId: "fake" },
    { tier: "starter", role: "admin" },
  ]) {
    assert.equal(subscriptionCheckoutRequestSchema.safeParse(input).success, false);
  }
  assert.match(square, /subscription-link", requireAuth/);
  assert.match(square, /status\(400\).*INVALID_SUBSCRIPTION_CHECKOUT/s);
});

test("configured or unavailable Square credentials cannot create a chargeable checkout", () => {
  for (const forbidden of ["createPaymentLink", "checkoutApi", "SQUARE_ACCESS_TOKEN", "subscriptionPlanId", "idempotencyKey"]) {
    assert.doesNotMatch(square, new RegExp(forbidden));
  }
});

test("disabled checkout writes no entitlement or provider evidence", () => {
  for (const forbidden of ["updateUser", "db.insert", "db.update", "subscriptionTier", "subscriptionStatus", "providerId"]) {
    assert.doesNotMatch(square, new RegExp(forbidden.replace(".", "\\.")));
  }
});
