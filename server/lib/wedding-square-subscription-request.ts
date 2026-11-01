import { squareStartDateNotBefore, WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
import type { verifyWeddingEnrollmentConsent } from "./wedding-square-enrollment-consent";
import type { weddingSquareSandboxPreflight } from "./wedding-square-enrollment-preflight";

/**
 * Side-effect-free Square subscription request builder.
 *
 * The caller MUST first durably reserve a unique enrollment attempt and save
 * its generated idempotency key, authoritative consent, authenticated owner,
 * verified Square customer/card and plan mapping. Never generate a fresh key
 * on retry. This file does not make network calls or grant entitlements.
 */
type ConsentReceipt = ReturnType<typeof verifyWeddingEnrollmentConsent>;
type SandboxPreflight = ReturnType<typeof weddingSquareSandboxPreflight>;

export class WeddingSquareRequestError extends Error {
  constructor() {
    super("Cannot safely prepare Wedding Square subscription enrollment.");
    this.name = "WeddingSquareRequestError";
  }
}

// Reject calendar overflow (e.g. February 30), malformed and non-UTC dates.
// Date.parse alone normalizes some impossible calendar dates instead of failing.
function canonicalUtcDateMs(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp;
}

export function prepareWeddingSquareSubscriptionRequest(input: {
  consent: ConsentReceipt;
  config: SandboxPreflight;
  // These IDs must be resolved and owned server-side, NOT copied from a browser.
  providerCustomerId: string;
  providerCardId: string;
  // Stable, database-persisted idempotency key for one enrollment attempt.
  persistedIdempotencyKey: string;
}) {
  const { consent, config } = input;
  // Revalidate receipt metadata at the final pure request boundary. A typed
  // server-side consent receipt is not sufficient if it was reconstructed or
  // mutated between verification and durable enrollment preparation.
  const consentTime = typeof consent.billingConsentAt === "string"
    ? Date.parse(consent.billingConsentAt) : NaN;
  if (config.environment !== "sandbox" ||
      config.tier !== consent.tier ||
      typeof consent.userId !== "string" || !consent.userId.trim() ||
      consent.userId !== consent.userId.trim() ||
      consent.consentTermsVersion !== WEDDING_CONSENT_VERSION ||
      typeof consent.billingConsentAt !== "string" ||
      !Number.isFinite(consentTime) ||
      new Date(consentTime).toISOString() !== consent.billingConsentAt ||
      !consent.automaticRenewal ||
      consent.agreedCurrency !== "USD" ||
      consent.subscriptionTimezone !== "UTC") {
    throw new WeddingSquareRequestError();
  }
  const strings = [
    config.merchantId, config.locationId, config.planId, config.planVariationId,
    input.providerCustomerId, input.providerCardId, input.persistedIdempotencyKey,
  ];
  if (strings.some(s => typeof s !== "string" || !s.trim() || s.trim() !== s)) {
    throw new WeddingSquareRequestError();
  }
  if (input.persistedIdempotencyKey.length > 45) throw new WeddingSquareRequestError();
  if ((consent.tier === "premium" && consent.agreedMonthlyAmountCents !== 2499) ||
      (consent.tier === "elite" && consent.agreedMonthlyAmountCents !== 4999)) {
    throw new WeddingSquareRequestError();
  }
  // A verified future trial requires a canonical UTC start on/after its exact
  // expiry. An expired/no-trial enrollment must not silently acquire a delayed
  // charge date. Reject mutated receipts even though the consent guard freezes
  // its own output; do not allow NaN comparisons to bypass the safety check.
  const start = consent.requestedStartDate === null ? null : canonicalUtcDateMs(consent.requestedStartDate);
  if (consent.requestedStartDate !== null && start === null) throw new WeddingSquareRequestError();
  if (consent.trialExpiresAt !== null) {
    const expiry = Date.parse(consent.trialExpiresAt);
    if (typeof consent.trialExpiresAt !== "string" ||
        !Number.isFinite(expiry) ||
        new Date(expiry).toISOString() !== consent.trialExpiresAt ||
        // A verified future trial cannot have already expired at consent.
        expiry <= consentTime ||
        start === null || start < expiry ||
        // The consent receipt acknowledged the earliest non-early UTC date.
        // A later date is also a changed billing term, not a safe fallback.
        consent.requestedStartDate !== squareStartDateNotBefore(new Date(expiry))) {
      throw new WeddingSquareRequestError();
    }
  } else if (consent.requestedStartDate !== null) {
    throw new WeddingSquareRequestError();
  }

  const request = {
    idempotencyKey: input.persistedIdempotencyKey,
    locationId: config.locationId,
    planVariationId: config.planVariationId,
    customerId: input.providerCustomerId,
    cardId: input.providerCardId,
    timezone: "UTC" as const,
    ...(consent.requestedStartDate ? { startDate: consent.requestedStartDate } : {}),
  };
  return Object.freeze(request);
}
