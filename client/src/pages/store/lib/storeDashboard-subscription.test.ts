import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSubscriptionCheckoutPayload, isSubscriptionBillingUnavailable, SUBSCRIPTION_PLANS } from "./storeDashboard";

test("checkout payload contains only non-authoritative plan selection", () => {
  assert.deepEqual(SUBSCRIPTION_PLANS.map((plan) => plan.id), ["starter", "professional", "enterprise"]);
  for (const plan of SUBSCRIPTION_PLANS) {
    assert.deepEqual(buildSubscriptionCheckoutPayload(plan.id, true), { tier: plan.id, trial: true });
  }
  const serialized = JSON.stringify(buildSubscriptionCheckoutPayload("enterprise", false));
  for (const forbidden of ["userId", "email", "subscriptionStatus", "providerId", "role", "admin"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("dashboard recognizes billing unavailable without treating it as success", () => {
  assert.equal(isSubscriptionBillingUnavailable("SUBSCRIPTION_BILLING_UNAVAILABLE"), true);
  const dashboard = readFileSync(new URL("../StoreDashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /isSubscriptionBillingUnavailable\(data\?\.code\)/);
  assert.match(dashboard, /if \(!resp\.ok \|\| !data\?\.url\)/);
  assert.doesNotMatch(dashboard, /buildSubscriptionCheckoutPayload\([^)]*user/);
  assert.match(dashboard, /const currentTier = tier\?\.currentTier \|\| "free"/);
  assert.match(dashboard, /currentTier === "free" \? 0 : calculateTrialDaysLeft/);
});
