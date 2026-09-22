import type { MarketplacePaidTierId } from "../../shared/subscription-tiers";
import { MARKETPLACE_PAID_TIER_IDS } from "../../shared/subscription-tiers";
import { z } from "zod";

/**
 * Subscription authorization policy.
 *
 * ChefSire does not currently have an end-to-end subscription reconciliation
 * flow: Square can create checkout links, but no verified subscription webhook
 * maps a Square customer, plan and status back to a ChefSire account.  Until
 * that exists, client requests can only remove entitlement.  They can never be
 * evidence for creating or extending paid entitlement.
 */

export const SUBSCRIPTION_BILLING_NOT_CONFIGURED = "SUBSCRIPTION_BILLING_NOT_CONFIGURED";
export const SUBSCRIPTION_BILLING_UNAVAILABLE = "SUBSCRIPTION_BILLING_UNAVAILABLE";
export const SUBSCRIPTION_CANCELLATION_UNAVAILABLE = "SUBSCRIPTION_CANCELLATION_UNAVAILABLE";

export const paidUpgradeUnavailableResponse = {
  ok: false,
  code: SUBSCRIPTION_BILLING_NOT_CONFIGURED,
  error: "Paid subscription changes require verified billing evidence and are not available yet.",
} as const;

export const paidCancellationUnavailableResponse = {
  ok: false,
  code: SUBSCRIPTION_CANCELLATION_UNAVAILABLE,
  error: "This subscription cannot be cancelled until the billing provider can confirm cancellation.",
} as const;

export const subscriptionCheckoutUnavailableResponse = {
  ok: false,
  code: SUBSCRIPTION_BILLING_UNAVAILABLE,
  error: "Subscription checkout is unavailable until paid entitlement can be verified.",
} as const;

export const subscriptionCheckoutRequestSchema = z.object({
  tier: z.enum(MARKETPLACE_PAID_TIER_IDS),
  trial: z.boolean().optional(),
}).strict();

/** Paid authorization is unavailable because the current schema has no proof field. */
export function hasAuthoritativePaidEntitlement(): boolean {
  return false;
}

/**
 * Historical tier/status/end-date columns are preserved as records, but none
 * is authoritative evidence. The model has no verified provider subscription
 * identifier/event or authorized administrative grant to prove paid access.
 */
export function hasCurrentMarketplaceEntitlement(user: {
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  subscriptionEndsAt?: Date | string | null;
}, _now = new Date()): boolean {
  void user;
  return hasAuthoritativePaidEntitlement();
}

export type MarketplacePaidTier = MarketplacePaidTierId;

export function effectiveMarketplaceTier(user: {
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  subscriptionEndsAt?: Date | string | null;
}, now = new Date()): MarketplacePaidTierId | "free" {
  void user;
  void now;
  return "free";
}

export function effectiveSubscriptionPresentation(
  effectiveTier: string,
  recordedStatus: unknown,
  recordedEndsAt: unknown,
): { status: string; endsAt: unknown | null } {
  if (effectiveTier === "free") return { status: "inactive", endsAt: null };
  return {
    status: String(recordedStatus || "active"),
    endsAt: recordedEndsAt ?? null,
  };
}
