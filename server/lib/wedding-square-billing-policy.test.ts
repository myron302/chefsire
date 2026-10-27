import assert from "node:assert/strict";
import { test } from "node:test";
import { quoteWeddingMonthlyBilling, squareStartDateNotBefore, isWeddingPaidTier } from "./wedding-square-billing-policy";

test("server quotes canonical Wedding prices, not client amounts", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");
  const premium = quoteWeddingMonthlyBilling({ tier: "premium", now, trialExpiresAt: null });
  const elite = quoteWeddingMonthlyBilling({ tier: "elite", now, trialExpiresAt: null });
  assert.equal(premium.amountCents, 2499);
  assert.equal(elite.amountCents, 4999);
  assert.equal(premium.firstChargeStartDate, null);
  assert.equal(elite.automaticRenewal, true);
  assert.equal(elite.requiresExplicitConsent, true);
  assert.equal(isWeddingPaidTier("free"), false);
});

test("start_date must never precede the exact 336-hour trial end", () => {
  for (const stamp of [
    "2026-11-10T13:59:00.000Z",
    "2026-03-08T07:00:00.000Z",
    "2026-11-01T05:30:00.000Z",
    "2026-12-31T23:59:59.999Z",
    "2028-02-29T23:59:59.999Z",
  ]) {
    const expires = new Date(stamp);
    const start = squareStartDateNotBefore(expires);
    assert.ok(new Date(start + "T00:00:00.000Z").getTime() >= expires.getTime());
  }
  assert.equal(squareStartDateNotBefore(new Date("2026-11-10T00:00:00.000Z")), "2026-11-10");
  assert.equal(squareStartDateNotBefore(new Date("2026-11-10T13:59:00.000Z")), "2026-11-11");
});

test("future-trial quote is explicit about the delayed first charge", () => {
  const quote = quoteWeddingMonthlyBilling({
    tier: "elite",
    now: new Date("2026-10-27T10:00:00Z"),
    trialExpiresAt: new Date("2026-11-10T14:00:00Z"),
  });
  assert.equal(quote.firstChargeStartDate, "2026-11-11");
  assert.equal(quote.subscriptionTimezone, "UTC");
  assert.equal(quote.firstChargePolicy, "not_before_trial_expiry");
  assert.equal(quote.trialExpiresAt, "2026-11-10T14:00:00.000Z");
});

test("expired trial cannot be presented as a future no-charge period", () => {
  const quote = quoteWeddingMonthlyBilling({
    tier: "premium",
    now: new Date("2026-11-11T00:00:00Z"),
    trialExpiresAt: new Date("2026-11-10T14:00:00Z"),
  });
  assert.equal(quote.firstChargeStartDate, null);
  assert.equal(quote.firstChargePolicy, "after_explicit_authorization");
});

test("invalid dates and tiers fail closed", () => {
  assert.throws(() => squareStartDateNotBefore(new Date("invalid")), TypeError);
  assert.throws(() => quoteWeddingMonthlyBilling({
    tier: "free" as any, now: new Date(), trialExpiresAt: null,
  }), TypeError);
});
