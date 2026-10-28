import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyWeddingEnrollmentConsent, WeddingConsentMismatchError } from "./wedding-square-enrollment-consent";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";

const now = new Date("2026-10-28T12:00:00.000Z");
const expires = new Date("2026-11-10T14:00:00.000Z");
const approved = {
  tier: "elite",
  consentVersion: WEDDING_CONSENT_VERSION,
  acceptedAutomaticMonthlyRenewal: true,
  acceptedAmountCents: 4999,
  acceptedCurrency: "USD",
  acknowledgedFirstChargeStartDate: "2026-11-11",
};

test("captures server-authoritative terms for a consenting trial customer", () => {
  const receipt = verifyWeddingEnrollmentConsent({ userId: "user-123", now, trialExpiresAt: expires, request: approved });
  assert.equal(receipt.userId, "user-123");
  assert.equal(receipt.agreedMonthlyAmountCents, 4999);
  assert.equal(receipt.requestedStartDate, "2026-11-11");
  assert.equal(receipt.subscriptionTimezone, "UTC");
  assert.equal(receipt.automaticRenewal, true);
  assert.equal(receipt.billingConsentAt, now.toISOString());
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal("squareSubscriptionId" in receipt, false);
});

test("rejects consent without explicit renewal acceptance", () => {
  assert.throws(() => verifyWeddingEnrollmentConsent({
    userId: "user-123", now, trialExpiresAt: expires,
    request: { ...approved, acceptedAutomaticMonthlyRenewal: false },
  }));
});

test("rejects stale price or changed date, never silently consenting to new terms", () => {
  for (const request of [
    { ...approved, acceptedAmountCents: 2499 },
    { ...approved, acknowledgedFirstChargeStartDate: "2026-11-10" },
    { ...approved, acknowledgedFirstChargeStartDate: null },
  ]) {
    assert.throws(() => verifyWeddingEnrollmentConsent({ userId: "user-123", now, trialExpiresAt: expires, request }), WeddingConsentMismatchError);
  }
});

test("rejects unexpected client card, user ID, or Square billing fields", () => {
  for (const extra of [{ userId: "attacker" }, { cardToken: "nonce" }, { squareSubscriptionId: "fake" }]) {
    assert.throws(() => verifyWeddingEnrollmentConsent({
      userId: "user-123", now, trialExpiresAt: expires, request: { ...approved, ...extra },
    }));
  }
});

test("rejects nonauthenticated requests and outdated disclosure versions", () => {
  assert.throws(() => verifyWeddingEnrollmentConsent({ userId: "", now, trialExpiresAt: expires, request: approved }));
  assert.throws(() => verifyWeddingEnrollmentConsent({
    userId: "user-123", now, trialExpiresAt: expires,
    request: { ...approved, consentVersion: "old" },
  }));
});

test("expired trial requires acknowledgment of immediate eligible start, not stale date", () => {
  const expired = new Date("2026-10-27T12:00:00Z");
  assert.throws(() => verifyWeddingEnrollmentConsent({
    userId: "user-123", now, trialExpiresAt: expired, request: approved,
  }), WeddingConsentMismatchError);
  const receipt = verifyWeddingEnrollmentConsent({
    userId: "user-123", now, trialExpiresAt: expired,
    request: { ...approved, acknowledgedFirstChargeStartDate: null },
  });
  assert.equal(receipt.requestedStartDate, null);
});
