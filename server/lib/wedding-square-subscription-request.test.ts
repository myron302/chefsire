import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyWeddingEnrollmentConsent } from "./wedding-square-enrollment-consent";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
import { weddingSquareSandboxPreflight } from "./wedding-square-enrollment-preflight";
import { prepareWeddingSquareSubscriptionRequest, WeddingSquareRequestError } from "./wedding-square-subscription-request";

const now = new Date("2026-10-28T12:00:00Z");
const trialExpiresAt = new Date("2026-11-10T14:00:00Z");
const consent = verifyWeddingEnrollmentConsent({
  userId: "wedding-user", now, trialExpiresAt,
  request: {
    tier: "premium", consentVersion: WEDDING_CONSENT_VERSION,
    acceptedAutomaticMonthlyRenewal: true,
    acceptedAmountCents: 2499, acceptedCurrency: "USD",
    acknowledgedFirstChargeStartDate: "2026-11-11",
  },
});
const config = weddingSquareSandboxPreflight({
  SQUARE_ENV: "sandbox",
  SQUARE_ACCESS_TOKEN: "private-token",
  SQUARE_LOCATION_ID: "loc-sandbox",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "var-premium",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "var-elite",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
}, "premium");
const base = {
  consent, config,
  providerCustomerId: "cust-verified",
  providerCardId: "card-verified",
  persistedIdempotencyKey: "enrollment-attempt-000001",
};

test("prepares sandbox request with stable idempotency and UTC trial-safe start", () => {
  const r = prepareWeddingSquareSubscriptionRequest(base);
  assert.deepEqual(r, {
    idempotencyKey: "enrollment-attempt-000001",
    locationId: "loc-sandbox",
    planVariationId: "var-premium",
    customerId: "cust-verified",
    cardId: "card-verified",
    timezone: "UTC",
    startDate: "2026-11-11",
  });
  assert.equal("token" in r, false);
  assert.deepEqual(prepareWeddingSquareSubscriptionRequest(base), r);
});

test("fails closed if trial-safe start date is absent or earlier than expiry", () => {
  for (const requestedStartDate of [null, "2026-11-10"]) {
    assert.throws(() => prepareWeddingSquareSubscriptionRequest({
      ...base, consent: { ...consent, requestedStartDate },
    }), WeddingSquareRequestError);
  }
});

test("rejects missing saved enrollment key and provider identifiers", () => {
  for (const patch of [
    { persistedIdempotencyKey: "" }, { persistedIdempotencyKey: " ".repeat(3) },
    { providerCardId: "" }, { providerCustomerId: "" },
    { persistedIdempotencyKey: "x".repeat(46) },
  ]) {
    assert.throws(() => prepareWeddingSquareSubscriptionRequest({ ...base, ...patch }), WeddingSquareRequestError);
  }
});

test("cannot create production or non-UTC requests", () => {
  assert.throws(() => prepareWeddingSquareSubscriptionRequest({
    ...base, config: { ...config, environment: "production" } as any,
  }), WeddingSquareRequestError);
  assert.throws(() => prepareWeddingSquareSubscriptionRequest({
    ...base, consent: { ...consent, subscriptionTimezone: "America/New_York" } as any,
  }), WeddingSquareRequestError);
});

test("rejects tampered prices before Square invocation", () => {
  assert.throws(() => prepareWeddingSquareSubscriptionRequest({
    ...base, consent: { ...consent, agreedMonthlyAmountCents: 1 },
  }), WeddingSquareRequestError);
});
