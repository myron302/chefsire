import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const square = readFileSync(new URL("./square.ts", import.meta.url), "utf8");
const security = readFileSync(new URL("../lib/subscription-security.ts", import.meta.url), "utf8");

test("subscription checkout authenticates, validates strictly, then fails unavailable", () => {
  assert.match(square, /subscription-link", requireAuth/);
  assert.match(square, /\.strict\(\)\.safeParse\(req\.body\)/);
  assert.match(square, /status\(400\).*INVALID_SUBSCRIPTION_CHECKOUT/s);
  assert.match(square, /status\(503\)\.json\(subscriptionCheckoutUnavailableResponse\)/);
  assert.match(security, /SUBSCRIPTION_BILLING_UNAVAILABLE/);
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
