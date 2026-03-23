import { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";

export type CampaignTargetType = "collection" | "drop" | "promo" | "challenge" | "post" | "roadmap";

export type CampaignLinkForm = {
  targetType: CampaignTargetType;
  targetId: string;
};

export type CampaignsResponse = {
  ok: boolean;
  creatorUserId: string;
  count: number;
  pinnedCampaign: CreatorCampaignItem | null;
  items: CreatorCampaignItem[];
};

export type CampaignVariantTargetType = "follow" | "rsvp" | "collection" | "membership" | "drop" | "challenge";
export type CampaignGoalType = "followers" | "rsvps" | "clicks" | "purchases" | "membership_conversions" | "linked_drop_views";

export type CampaignVariantItem = {
  id: string;
  campaignId: string;
  label: string;
  headline: string | null;
  subheadline: string | null;
  ctaText: string;
  ctaTargetType: CampaignVariantTargetType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  metrics: {
    views: number;
    clicks: number;
    follows: number;
    rsvps: number;
    approximatePurchases: number;
    approximateMemberships: number;
  };
};

export type CampaignVariantsResponse = {
  ok: boolean;
  campaignId: string;
  count: number;
  items: CampaignVariantItem[];
  attributionNotes: string[];
};

export type CampaignTemplateItem = {
  id: string;
  creatorUserId: string;
  sourceCampaignId: string | null;
  name: string;
  description: string | null;
  campaignName: string;
  campaignDescription: string | null;
  visibility: CreatorCampaignItem["visibility"];
  defaults: {
    resetDates: boolean;
    copyLinkedDrafts: boolean;
    copyCtaVariants: boolean;
  };
  counts: {
    linkedItems: number;
    drops: number;
    posts: number;
    roadmap: number;
    variants: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type CampaignTemplatesResponse = {
  ok: boolean;
  count: number;
  items: CampaignTemplateItem[];
  basedOnPastCampaigns: Array<{ id: string; name: string; slug: string; route: string }>;
};

export type CampaignGoalItem = {
  id: string;
  campaignId: string;
  goalType: CampaignGoalType;
  targetValue: number;
  label: string | null;
  createdAt: string;
  updatedAt: string;
  currentValue: number;
  percentComplete: number;
  isComplete: boolean;
  metricLabel: string;
  metricNote: string | null;
};

export type CampaignGoalsResponse = {
  ok: boolean;
  campaignId: string;
  count: number;
  items: CampaignGoalItem[];
  attributionNotes: string[];
};

export type CampaignRolloutAudience = "public" | "followers" | "members";
export type CampaignRolloutMode = "public_first" | "followers_first" | "members_first" | "staged";
export type CampaignRolloutState =
  | "scheduled_for_members"
  | "scheduled_for_followers"
  | "scheduled_for_public"
  | "live_for_members"
  | "live_for_followers"
  | "live_for_public"
  | "fully_open"
  | "completed";

export type CampaignRolloutResponse = {
  ok: boolean;
  campaignId: string;
  rollout: {
    rolloutMode: CampaignRolloutMode;
    startsWithAudience: CampaignRolloutAudience;
    unlockFollowersAt: string | null;
    unlockPublicAt: string | null;
    rolloutNotes: string | null;
    isRolloutActive: boolean;
    isRolloutPaused: boolean;
    pausedAt: string | null;
  };
  derivedState: {
    rolloutMode: CampaignRolloutMode;
    startsWithAudience: CampaignRolloutAudience;
    finalAudience: CampaignRolloutAudience;
    currentAudience: CampaignRolloutAudience;
    nextAudience: CampaignRolloutAudience | null;
    nextUnlockAt: string | null;
    unlockFollowersAt: string | null;
    unlockPublicAt: string | null;
    rolloutNotes: string | null;
    isRolloutActive: boolean;
    isRolloutPaused: boolean;
    pausedAt: string | null;
    state: CampaignRolloutState;
    timeline: Array<{
      audience: CampaignRolloutAudience;
      unlockAt: string | null;
      isCurrent: boolean;
    }>;
  };
  audienceFitSuggestion: {
    suggestedMode: CampaignRolloutMode;
    reason: string | null;
    confidence: "high" | "medium" | "low" | "none";
  };
};

const campaignGoalTypeOptions: Array<{ value: CampaignGoalType; label: string }> = [
  { value: "followers", label: "Campaign followers" },
  { value: "rsvps", label: "Linked drop RSVPs" },
  { value: "clicks", label: "Linked drop clicks" },
  { value: "linked_drop_views", label: "Linked drop views" },
  { value: "purchases", label: "Linked collection purchases" },
  { value: "membership_conversions", label: "Membership conversions" },
];
