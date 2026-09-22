import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveMarketplaceTier,
  hasAuthoritativePaidEntitlement,
  hasCurrentMarketplaceEntitlement,
  SUBSCRIPTION_BILLING_NOT_CONFIGURED,
  SUBSCRIPTION_BILLING_UNAVAILABLE,
  paidUpgradeUnavailableResponse,
  subscriptionCheckoutUnavailableResponse,
} from "./subscription-security";

test("paid upgrades and checkout expose stable fail-closed responses", () => {
  assert.equal(SUBSCRIPTION_BILLING_NOT_CONFIGURED, "SUBSCRIPTION_BILLING_NOT_CONFIGURED");
  assert.equal(SUBSCRIPTION_BILLING_UNAVAILABLE, "SUBSCRIPTION_BILLING_UNAVAILABLE");
  assert.equal(paidUpgradeUnavailableResponse.ok, false);
  assert.equal(subscriptionCheckoutUnavailableResponse.ok, false);
});

test("historical paid columns never establish authoritative entitlement", () => {
  const now = new Date("2026-09-22T00:00:00Z");
  for (const user of [
    { subscriptionTier: "starter", subscriptionStatus: "active", subscriptionEndsAt: null },
    { subscriptionTier: "professional", subscriptionStatus: "active", subscriptionEndsAt: "2026-10-01T00:00:00Z" },
    { subscriptionTier: "enterprise", subscriptionStatus: "cancelled", subscriptionEndsAt: "2026-10-01T00:00:00Z" },
    { subscriptionTier: "premium_plus", subscriptionStatus: "active", subscriptionEndsAt: "bad" },
    { subscriptionTier: "unknown", subscriptionStatus: "active", subscriptionEndsAt: "2099-01-01T00:00:00Z" },
  ]) {
    assert.equal(hasCurrentMarketplaceEntitlement(user, now), false);
    assert.equal(effectiveMarketplaceTier(user, now), "free");
  }
});

test("free users remain free and historical record preservation grants nothing", () => {
  assert.equal(effectiveMarketplaceTier({ subscriptionTier: "free", subscriptionStatus: "active" }), "free");
  assert.equal(hasAuthoritativePaidEntitlement(), false);
});

test("no supported authoritative evidence form exists yet", () => {
  // Adding provider/admin evidence must be an explicit future model + reconciliation change.
  assert.equal(hasAuthoritativePaidEntitlement(), false);
});
