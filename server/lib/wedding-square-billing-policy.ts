/**
 * Wedding recurring-billing quote policy. This module NEVER creates charges,
 * stores cards, activates entitlements, or changes the 336-hour introductory trial.
 * Square CreateSubscription accepts a calendar date, not a timestamp.
 */
export type WeddingPaidTier = "premium" | "elite";
export const WEDDING_MONTHLY_CENTS: Readonly<Record<WeddingPaidTier, number>> = Object.freeze({
  premium: 2499,
  elite: 4999,
});
export const WEDDING_CONSENT_VERSION = "wedding-monthly-autorenew-v1";

export function isWeddingPaidTier(value: unknown): value is WeddingPaidTier {
  return value === "premium" || value === "elite";
}

/**
 * Choose the earliest UTC date whose midnight is AT OR AFTER expiry.
 * Square's subscription timezone MUST explicitly be UTC for this date
 * to have the same meaning. Never use a location timezone implicitly.
 */
export function squareStartDateNotBefore(expiry: Date): string {
  if (!(expiry instanceof Date) || !Number.isFinite(expiry.getTime())) {
    throw new TypeError("A valid trial expiry is required");
  }
  const date = expiry.toISOString().slice(0, 10);
  return expiry.toISOString().endsWith("T00:00:00.000Z")
    ? date
    : new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate() + 1))
        .toISOString().slice(0, 10);
}

export function quoteWeddingMonthlyBilling(input: {
  tier: WeddingPaidTier;
  now: Date;
  trialExpiresAt: Date | null;
}) {
  if (!isWeddingPaidTier(input.tier)) throw new TypeError("Invalid Wedding tier");
  if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) throw new TypeError("Invalid clock");
  const futureTrialExpiry = input.trialExpiresAt && input.trialExpiresAt.getTime() > input.now.getTime()
    ? input.trialExpiresAt : null;
  if (input.trialExpiresAt && !Number.isFinite(input.trialExpiresAt.getTime())) throw new TypeError("Invalid trial expiry");
  const startDate = futureTrialExpiry ? squareStartDateNotBefore(futureTrialExpiry) : null;
  return {
    tier: input.tier,
    amountCents: WEDDING_MONTHLY_CENTS[input.tier],
    currency: "USD" as const,
    cadence: "MONTHLY" as const,
    consentVersion: WEDDING_CONSENT_VERSION,
    trialExpiresAt: futureTrialExpiry?.toISOString() ?? null,
    firstChargeStartDate: startDate,
    subscriptionTimezone: "UTC" as const,
    firstChargePolicy: startDate ? "not_before_trial_expiry" as const : "after_explicit_authorization" as const,
    automaticRenewal: true as const,
    requiresExplicitConsent: true as const,
  };
}
