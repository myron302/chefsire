export const MARKETPLACE_PAID_TIER_IDS = [
  "starter",
  "professional",
  "enterprise",
  "premium_plus",
] as const;

export type MarketplacePaidTierId = (typeof MARKETPLACE_PAID_TIER_IDS)[number];
