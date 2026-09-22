import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveMarketplaceTier,
  hasCurrentMarketplaceEntitlement,
  SUBSCRIPTION_BILLING_NOT_CONFIGURED,
  paidUpgradeUnavailableResponse,
} from "./subscription-security";

test("paid upgrades fail with an explicit closed billing response", () => {
  assert.equal(SUBSCRIPTION_BILLING_NOT_CONFIGURED, "SUBSCRIPTION_BILLING_NOT_CONFIGURED");
  assert.equal(paidUpgradeUnavailableResponse.ok, false);
});

test("free, expired, malformed and inactive records receive no marketplace entitlement", () => {
  const now = new Date("2026-09-22T00:00:00Z");
  for (const user of [
    { subscriptionTier: "free", subscriptionStatus: "active" },
    { subscriptionTier: "enterprise", subscriptionStatus: "inactive" },
    { subscriptionTier: "professional", subscriptionStatus: "active", subscriptionEndsAt: "bad" },
    { subscriptionTier: "starter", subscriptionStatus: "active", subscriptionEndsAt: "2026-09-21T23:59:59Z" },
  ]) {
    assert.equal(hasCurrentMarketplaceEntitlement(user, now), false);
    assert.equal(effectiveMarketplaceTier(user, now), "free");
  }
});

test("authoritative persisted current and paid-through cancelled records retain access", () => {
  const now = new Date("2026-09-22T00:00:00Z");
  assert.equal(effectiveMarketplaceTier({
    subscriptionTier: "professional",
    subscriptionStatus: "active",
    subscriptionEndsAt: "2026-10-01T00:00:00Z",
  }, now), "professional");
  assert.equal(effectiveMarketplaceTier({
    subscriptionTier: "enterprise",
    subscriptionStatus: "cancelled",
    subscriptionEndsAt: "2026-10-01T00:00:00Z",
  }, now), "enterprise");
});

test("legacy active paid records without an end date remain conservatively grandfathered", () => {
  assert.equal(effectiveMarketplaceTier({
    subscriptionTier: "starter",
    subscriptionStatus: "active",
    subscriptionEndsAt: null,
  }), "starter");
});
