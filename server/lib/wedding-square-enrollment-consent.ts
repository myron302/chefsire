import { z } from "zod";
import {
  quoteWeddingMonthlyBilling,
  WEDDING_CONSENT_VERSION,
  type WeddingPaidTier,
} from "./wedding-square-billing-policy";

/**
 * Server-only, side-effect-free guard for a future Square enrollment endpoint.
 * Do not mistake this receipt for a payment, subscription, or entitlement.
 * A future endpoint must persist it atomically with a durable enrollment attempt
 * and independently verify the provider response before granting access.
 */
const consentRequestSchema = z.object({
  tier: z.enum(["premium", "elite"]),
  consentVersion: z.literal(WEDDING_CONSENT_VERSION),
  acceptedAutomaticMonthlyRenewal: z.literal(true),
  acceptedAmountCents: z.number().int().positive(),
  acceptedCurrency: z.literal("USD"),
  acknowledgedFirstChargeStartDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullable(),
}).strict();

export type WeddingEnrollmentConsentInput = z.input<typeof consentRequestSchema>;

export class WeddingConsentMismatchError extends Error {
  constructor() {
    super("Billing terms have changed. Review the current quote and consent again.");
    this.name = "WeddingConsentMismatchError";
  }
}

export function verifyWeddingEnrollmentConsent(params: {
  userId: string;
  request: unknown;
  now: Date;
  trialExpiresAt: Date | null;
}) {
  if (!params.userId || !params.userId.trim()) throw new TypeError("Authenticated user required");
  const request = consentRequestSchema.parse(params.request);
  const quote = quoteWeddingMonthlyBilling({
    tier: request.tier as WeddingPaidTier,
    now: params.now,
    trialExpiresAt: params.trialExpiresAt,
  });

  // Never accept amounts, start dates or renewal terms from client as authority.
  // Match the acknowledgment against the freshly computed server quote.
  if (
    request.acceptedAmountCents !== quote.amountCents ||
    request.acceptedCurrency !== quote.currency ||
    request.acknowledgedFirstChargeStartDate !== quote.firstChargeStartDate
  ) {
    throw new WeddingConsentMismatchError();
  }

  return Object.freeze({
    userId: params.userId,
    tier: quote.tier,
    agreedMonthlyAmountCents: quote.amountCents,
    agreedCurrency: quote.currency,
    consentTermsVersion: quote.consentVersion,
    billingConsentAt: params.now.toISOString(),
    requestedStartDate: quote.firstChargeStartDate,
    trialExpiresAt: quote.trialExpiresAt,
    subscriptionTimezone: quote.subscriptionTimezone,
    automaticRenewal: quote.automaticRenewal,
    // NO card token, payment method, or subscription identifier is accepted.
  });
}
