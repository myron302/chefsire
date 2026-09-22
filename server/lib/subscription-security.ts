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

/**
 * Resolve an existing marketplace entitlement without manufacturing evidence.
 * Records with no end date are retained as legacy/grandfathered subscriptions;
 * new HTTP mutation paths cannot create such records after P1-02.
 */
export function hasCurrentMarketplaceEntitlement(user: {
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  subscriptionEndsAt?: Date | string | null;
}, now = new Date()): boolean {
  const tier = String(user.subscriptionTier || "free").toLowerCase();
  if (tier === "free") return false;

  const status = String(user.subscriptionStatus || "active").toLowerCase();
  if (status !== "active" && status !== "cancelled") return false;

  if (!user.subscriptionEndsAt) return status === "active"; // conservative legacy compatibility
  const endsAt = new Date(user.subscriptionEndsAt);
  if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= now.getTime()) return false;
  return status === "active" || status === "cancelled";
}

export type MarketplacePaidTier = "starter" | "professional" | "enterprise" | "premium_plus";

export function effectiveMarketplaceTier(user: {
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  subscriptionEndsAt?: Date | string | null;
}, now = new Date()): MarketplacePaidTier | "free" {
  if (!hasCurrentMarketplaceEntitlement(user, now)) return "free";
  const tier = String(user.subscriptionTier || "free").toLowerCase();
  return (["starter", "professional", "enterprise", "premium_plus"] as string[]).includes(tier)
    ? tier as MarketplacePaidTier
    : "free";
}
