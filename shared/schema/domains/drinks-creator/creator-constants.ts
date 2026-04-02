export const DRINK_COLLECTION_ACCESS_TYPE_VALUES = ["public", "premium_purchase", "membership_only"] as const;
export type DrinkCollectionAccessType = (typeof DRINK_COLLECTION_ACCESS_TYPE_VALUES)[number];

export const DRINK_COLLECTION_PURCHASE_STATUS_VALUES = ["completed", "refunded_pending", "refunded", "revoked"] as const;
export type DrinkCollectionPurchaseStatus = (typeof DRINK_COLLECTION_PURCHASE_STATUS_VALUES)[number];

export const DRINK_COLLECTION_CHECKOUT_STATUS_VALUES = [
  "pending",
  "completed",
  "failed",
  "canceled",
  "refunded_pending",
  "refunded",
  "revoked",
] as const;
export type DrinkCollectionCheckoutStatus = (typeof DRINK_COLLECTION_CHECKOUT_STATUS_VALUES)[number];

export const DRINK_COLLECTION_SALES_LEDGER_STATUS_VALUES = ["completed", "refunded_pending", "refunded", "revoked"] as const;
export type DrinkCollectionSalesLedgerStatus = (typeof DRINK_COLLECTION_SALES_LEDGER_STATUS_VALUES)[number];

export const DRINK_PURCHASE_TYPE_VALUES = ["self", "gift"] as const;
export type DrinkPurchaseType = (typeof DRINK_PURCHASE_TYPE_VALUES)[number];

export const DRINK_COLLECTION_PROMOTION_DISCOUNT_TYPE_VALUES = ["percent", "fixed"] as const;
export type DrinkCollectionPromotionDiscountType = (typeof DRINK_COLLECTION_PROMOTION_DISCOUNT_TYPE_VALUES)[number];

export const CREATOR_POST_VISIBILITY_VALUES = ["public", "followers", "members"] as const;
export type CreatorPostVisibility = (typeof CREATOR_POST_VISIBILITY_VALUES)[number];

export const CREATOR_DROP_VISIBILITY_VALUES = CREATOR_POST_VISIBILITY_VALUES;
export type CreatorDropVisibility = (typeof CREATOR_DROP_VISIBILITY_VALUES)[number];

export const CREATOR_ROADMAP_VISIBILITY_VALUES = CREATOR_POST_VISIBILITY_VALUES;
export type CreatorRoadmapVisibility = (typeof CREATOR_ROADMAP_VISIBILITY_VALUES)[number];

export const CREATOR_CAMPAIGN_ROLLOUT_TIMELINE_AUDIENCE_VALUES = ["members", "followers", "public"] as const;
export type CreatorCampaignRolloutTimelineAudience = (typeof CREATOR_CAMPAIGN_ROLLOUT_TIMELINE_AUDIENCE_VALUES)[number];

export const CREATOR_CAMPAIGN_STARTS_WITH_AUDIENCE_VALUES = ["members", "followers", "public"] as const;
export type CreatorCampaignStartsWithAudience = (typeof CREATOR_CAMPAIGN_STARTS_WITH_AUDIENCE_VALUES)[number];

export const CREATOR_CAMPAIGN_PLAYBOOK_PROFILE_STARTS_WITH_AUDIENCE_VALUES = ["members", "followers", "public"] as const;
export type CreatorCampaignPlaybookProfileStartsWithAudience = (typeof CREATOR_CAMPAIGN_PLAYBOOK_PROFILE_STARTS_WITH_AUDIENCE_VALUES)[number];

export const CREATOR_CAMPAIGN_PLAYBOOK_PREFERRED_AUDIENCE_FIT_VALUES = ["members", "followers", "public"] as const;
export type CreatorCampaignPlaybookPreferredAudienceFit = (typeof CREATOR_CAMPAIGN_PLAYBOOK_PREFERRED_AUDIENCE_FIT_VALUES)[number];

type CreatorCampaignRolloutTimelineChange<T> = {
  from: T;
  to: T;
};

export type CreatorCampaignRolloutTimelineMetadata = {
  rolloutMode?: string | CreatorCampaignRolloutTimelineChange<string>;
  startsWithAudience?: CreatorCampaignRolloutTimelineChange<string | null>;
  unlockFollowersAt?: string | null | CreatorCampaignRolloutTimelineChange<string | null>;
  unlockPublicAt?: string | null | CreatorCampaignRolloutTimelineChange<string | null>;
  rolloutNotesChanged?: boolean;
  isRolloutActive?: boolean | CreatorCampaignRolloutTimelineChange<boolean>;
  currentAudience?: string;
  finalAudience?: string;
  readinessState?: "blocked" | "almost_ready" | "missing_key_items";
  preflightKind?: string;
  targetAt?: string | null;
  dropId?: string;
  dropType?: string;
  route?: string;
  delayedByHours?: number;
  nextUnlockAt?: string | null;
  field?: "unlockFollowersAt" | "unlockPublicAt";
  releasedAt?: string;
  nextAudience?: CreatorCampaignRolloutTimelineAudience;
  previousPausedAt?: string | null;
};

export type CreatorCampaignEventMetadata = {
  dropId?: string;
  source?: "campaign_variant" | "campaign_surface";
  referrerRoute?: string;
};
