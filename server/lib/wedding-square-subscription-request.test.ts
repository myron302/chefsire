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
  SQUARE_CURRENCY: "USD",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "merchant-sandbox",
  SQUARE_LOCATION_ID: "loc-sandbox",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "var-premium",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "var-elite",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID: "parent-premium",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID: "parent-elite",
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

test("rejects impossible, malformed or non-UTC start dates even on mutated consent receipts", () => {
  for (const requestedStartDate of [
    "", "not-a-date", "2026-02-30", "2026-13-01", "2026-11-1",
    "2026-11-11T00:00:00Z", "2026-11-10",
  ]) {
    assert.throws(() => prepareWeddingSquareSubscriptionRequest({
      ...base, consent: { ...consent, requestedStartDate },
    }), WeddingSquareRequestError);
  }
  for (const trialExpiresAt of ["invalid", "2026-11-10T14:00:00Z", "2026-02-30T14:00:00.000Z"]) {
    assert.throws(() => prepareWeddingSquareSubscriptionRequest({
      ...base, consent: { ...consent, trialExpiresAt },
    }), WeddingSquareRequestError);
  }
});

test("no-trial consent permits immediate authorization but rejects fabricated delayed starts", () => {
  const immediate = verifyWeddingEnrollmentConsent({
    userId: "wedding-user", now, trialExpiresAt: null,
    request: {
      tier: "premium", consentVersion: WEDDING_CONSENT_VERSION,
      acceptedAutomaticMonthlyRenewal: true,
      acceptedAmountCents: 2499, acceptedCurrency: "USD",
      acknowledgedFirstChargeStartDate: null,
    },
  });
  assert.equal("startDate" in prepareWeddingSquareSubscriptionRequest({ ...base, consent: immediate }), false);
  assert.throws(() => prepareWeddingSquareSubscriptionRequest({
    ...base, consent: { ...immediate, requestedStartDate: "2026-11-11" },
  }), WeddingSquareRequestError);
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

test("rejects missing or padded merchant identity in prepared requests", () => {
  for (const merchantId of ["", " merchant-sandbox "]) {
    assert.throws(() => prepareWeddingSquareSubscriptionRequest({
      ...base, config: { ...config, merchantId },
    }), WeddingSquareRequestError);
  }
});

test("rejects tampered parent plan identity in prepared requests", () => {
  for (const planId of ["", " parent-premium "]) {
    assert.throws(() => prepareWeddingSquareSubscriptionRequest({
      ...base, config: { ...config, planId },
    }), WeddingSquareRequestError);
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

test("rejects independently valid consent and preflight results for different tiers", () => {
  const eliteConfig = weddingSquareSandboxPreflight({
    SQUARE_ENV: "sandbox",
    SQUARE_ACCESS_TOKEN: "private-token",
  SQUARE_CURRENCY: "USD",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "merchant-sandbox",
    SQUARE_LOCATION_ID: "loc-sandbox",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "var-premium",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "var-elite",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID: "parent-premium",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID: "parent-elite",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
  }, "elite");

  assert.equal(eliteConfig.tier, "elite");
  assert.equal(eliteConfig.planVariationId, "var-elite");
  assert.throws(() => prepareWeddingSquareSubscriptionRequest({
    ...base,
    config: eliteConfig,
  }), WeddingSquareRequestError);
});

test("matching elite consent and elite preflight can prepare the elite request", () => {
  const eliteConsent = verifyWeddingEnrollmentConsent({
    userId: "wedding-user", now, trialExpiresAt,
    request: {
      tier: "elite", consentVersion: WEDDING_CONSENT_VERSION,
      acceptedAutomaticMonthlyRenewal: true,
      acceptedAmountCents: 4999, acceptedCurrency: "USD",
      acknowledgedFirstChargeStartDate: "2026-11-11",
    },
  });
  const eliteConfig = weddingSquareSandboxPreflight({
    SQUARE_ENV: "sandbox",
    SQUARE_ACCESS_TOKEN: "private-token",
  SQUARE_CURRENCY: "USD",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "merchant-sandbox",
    SQUARE_LOCATION_ID: "loc-sandbox",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "var-premium",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "var-elite",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID: "parent-premium",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID: "parent-elite",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
  }, "elite");
  assert.equal(prepareWeddingSquareSubscriptionRequest({
    ...base, consent: eliteConsent, config: eliteConfig,
  }).planVariationId, "var-elite");
});
