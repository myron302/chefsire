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
  if (config.environment !== "sandbox" ||
      config.tier !== consent.tier ||
      !consent.userId.trim() ||
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
  if (consent.trialExpiresAt && !consent.requestedStartDate) {
    throw new WeddingSquareRequestError();
  }
  if (consent.trialExpiresAt && consent.requestedStartDate &&
      Date.parse(consent.requestedStartDate + "T00:00:00.000Z") < Date.parse(consent.trialExpiresAt)) {
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
