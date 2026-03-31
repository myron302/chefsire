import { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import { type CampaignLifecycleSuggestion } from "@/components/drinks/CampaignLifecycleSuggestionsSection";
import { type CampaignPlaybookOnboardingItem } from "@/components/drinks/CampaignPlaybookOnboardingChecklist";
import { type CampaignRetrospectiveItem } from "@/components/drinks/CampaignRetrospectivesSection";
import { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import { type CreatorPostItem } from "@/components/drinks/CreatorPostCard";
import { type CreatorRoadmapItem } from "@/components/drinks/CreatorRoadmapCard";

export type CampaignOwnerAnalytics = {
  campaignId: string;
  slug: string;
  name: string;
  visibility: "public" | "followers" | "members";
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  followerCount: number;
  linkedDropsCount: number;
  linkedPostsCount: number;
  linkedCollectionsCount: number;
  linkedChallengesCount: number;
  totalDropRsvps: number;
  totalDropViews: number;
  totalDropClicks: number;
  purchasesFromLinkedCollections: number;
  purchasesFromLinkedCollectionsNote: string | null;
  membershipsFromCampaign: number;
  membershipsFromCampaignNote: string | null;
  campaignEngagementScore: number;
  campaignEngagementScoreNote: string;
  milestones: CampaignMilestone[];
};

export type CampaignMilestone = {
  type: string;
  label: string;
  shortLabel: string;
  description: string;
  achieved: boolean;
  achievedAt: string | null;
  isPublic: boolean;
  currentValue: number | null;
  targetValue: number | null;
};

export type CampaignVariantItem = {
  id: string;
  campaignId: string;
  label: string;
  headline: string | null;
  subheadline: string | null;
  ctaText: string;
  ctaTargetType: "follow" | "rsvp" | "collection" | "membership" | "drop" | "challenge";
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

export type CampaignGoalItem = {
  id: string;
  campaignId: string;
  goalType: "followers" | "rsvps" | "clicks" | "purchases" | "membership_conversions" | "linked_drop_views";
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

export type CampaignHealthItem = {
  campaignId: string;
  healthState: "thriving" | "healthy" | "watch" | "at_risk" | "completed";
  healthScore: number;
  status: "upcoming" | "active" | "past";
  primaryConcern: string | null;
  primaryStrength: string | null;
  watchReasons: string[];
  strengthReasons: string[];
  recentActivityAt: string | null;
  followerMomentum: "surging" | "up" | "flat" | "down" | "quiet";
  rsvpMomentum: "surging" | "up" | "flat" | "down" | "quiet";
  clickMomentum: "surging" | "up" | "flat" | "down" | "quiet";
  goalsOnTrack: number;
  goalsBehind: number;
  recommendation: {
    title: string;
    suggestedAction: string | null;
    suggestedRoute: string | null;
  } | null;
};

export type CampaignRecoveryPlan = {
  campaignId: string;
  campaignName: string;
  campaignRoute: string;
  healthState: "thriving" | "healthy" | "watch" | "at_risk" | "completed";
  actionState: "action_needed" | "monitor" | "no_action_needed";
  rescuePriority: "urgent" | "high" | "medium" | "low" | "none";
  riskReason: string | null;
  confidenceNote: string | null;
  suggestedActions: Array<{
    actionType: string;
    label: string;
    description: string;
    suggestedRoute: string | null;
    supportingSignals: string[];
  }>;
};

export type CampaignRolloutAnalyticsItem = {
  campaignId: string;
  slug: string;
  name: string;
  route: string;
  visibility: "public" | "followers" | "members";
  state: "upcoming" | "active" | "past";
  hasRolloutConfig: boolean;
  hasSequencedRollout: boolean;
  rolloutMode: "public_first" | "followers_first" | "members_first" | "staged";
  currentRolloutState: "scheduled_for_members" | "scheduled_for_followers" | "scheduled_for_public" | "live_for_members" | "live_for_followers" | "live_for_public" | "fully_open" | "completed";
  startsWithAudience: "public" | "followers" | "members";
  unlockFollowersAt: string | null;
  unlockPublicAt: string | null;
  currentAudience: "public" | "followers" | "members";
  nextAudience: "public" | "followers" | "members" | null;
  membersStageViews: number;
  followersStageViews: number;
  publicStageViews: number;
  membersStageClicks: number;
  followersStageClicks: number;
  publicStageClicks: number;
  membersStageRsvps: number;
  followersStageRsvps: number;
  publicStageRsvps: number;
  followersUnlockedAt: string | null;
  publicUnlockedAt: string | null;
  approximatePurchasesAfterFollowerUnlock: number | null;
  approximatePurchasesAfterPublicUnlock: number | null;
  approximateMembershipsAfterMemberFirstRollout: number | null;
  stagePerformance: Array<{
    audience: "public" | "followers" | "members";
    label: string;
    views: number;
    clicks: number;
    rsvps: number;
  }>;
  insights: string[];
};

export interface CampaignDetailResponse {
  ok: boolean;
  campaign: CreatorCampaignItem;
  primaryOffer: {
    type: "collection_checkout";
    ctaLabel: string;
    helperText: string;
    collectionId: string;
    collectionRoute: string;
    promoCode: string | null;
  } | {
    type: "membership_checkout";
    ctaLabel: string;
    helperText: string;
    creatorUserId: string;
    creatorRoute: string;
  } | null;
  linkedContent: {
    collections: Array<{ id: string; name: string; description: string | null; accessType: string; isPublic: boolean; route: string }>;
    drops: CreatorDropItem[];
    promos: Array<{ id: string; code: string; collectionId: string; collectionName: string; startsAt: string | null; endsAt: string | null; isActive: boolean; route: string }>;
    challenges: Array<{ id: string; slug: string; title: string; route: string }>;
    posts: CreatorPostItem[];
    roadmap: CreatorRoadmapItem[];
  };
  activeVariant: CampaignVariantItem | null;
  variants: CampaignVariantItem[];
  variantAttributionNotes: string[];
  milestones: {
    public: CampaignMilestone[];
    owner: CampaignMilestone[];
  };
  ownerAnalytics?: CampaignOwnerAnalytics | null;
  ownerRollout?: CreatorCampaignItem["rollout"] | null;
  ownerRolloutAnalytics?: CampaignRolloutAnalyticsItem | null;
  ownerRolloutAdvice?: {
    campaignId: string;
    campaignName: string;
    route: string;
    currentRolloutMode: "public_first" | "followers_first" | "members_first" | "staged";
    recommendedNextRolloutMode: "public_first" | "followers_first" | "members_first" | "staged";
    recommendationType: "keep_members_first" | "keep_followers_first" | "keep_public_first" | "shorten_staged_rollout" | "extend_member_window" | "extend_follower_window" | "go_public_earlier" | "add_member_phase" | "skip_member_phase" | "skip_follower_phase" | "use_staged_rollout_next_time";
    title: string;
    message: string;
    rationale: string;
    confidence: "high" | "medium" | "low" | "none";
    rationaleChips: string[];
  } | null;
  ownerTimingAdvice?: {
    campaignId: string;
    campaignName: string;
    route: string;
    currentRolloutMode: "public_first" | "followers_first" | "members_first" | "staged";
    suggestedStartTiming: string;
    suggestedFollowerUnlockDelay: number | null;
    suggestedPublicUnlockDelay: number | null;
    timingRecommendationType: "start_earlier" | "start_later" | "shorten_member_window" | "extend_member_window" | "shorten_follower_window" | "extend_follower_window" | "accelerate_public_unlock" | "delay_public_unlock" | "use_short_burst_launch" | "use_longer_staged_rollout" | "keep_current_timing";
    title: string;
    message: string;
    rationale: string;
    confidence: "high" | "medium" | "low" | "none";
    rationaleChips: string[];
    strongestStage: "public" | "followers" | "members" | null;
    currentFollowerUnlockDelay: number | null;
    currentPublicUnlockDelay: number | null;
    totalTimingSignal: number;
    approximatePurchaseSignal: number;
    approximateMembershipSignal: number;
  } | null;
  ownerRolloutSuggestion?: {
    suggestedMode: "public_first" | "followers_first" | "members_first" | "staged";
    reason: string | null;
    confidence: "high" | "medium" | "low" | "none";
  } | null;
  ownerPlaybookFit?: {
    campaignId: string;
    campaignName: string;
    campaignSlug: string;
    campaignRoute: string;
    visibility: "public" | "followers" | "members";
    state: "upcoming" | "active" | "past";
    bestMatch: {
      playbookId: string;
      playbookName: string;
      playbookDescription: string | null;
      fitScore: number;
      fitLabel: "strong_match" | "partial_match" | "weak_match";
      recommendation: "apply_as_is" | "apply_with_adjustments" | "loose_inspiration";
      whyItFits: string[];
      mismatches: string[];
      suggestedAdjustments: string[];
    } | null;
    runnerUp: {
      playbookId: string;
      playbookName: string;
      fitScore: number;
      fitLabel: "strong_match" | "partial_match" | "weak_match";
    } | null;
  } | null;
  ownerRetrospective?: CampaignRetrospectiveItem | null;
  ownerHealth?: CampaignHealthItem | null;
  ownerLifecycleSuggestion?: CampaignLifecycleSuggestion | null;
  ownerRecoveryPlan?: CampaignRecoveryPlan | null;
  ownerGoals: CampaignGoalItem[];
  recentUpdates: Array<{
    id: string;
    targetType: "drop" | "post" | "roadmap" | "promo";
    label: string;
    title: string;
    description: string | null;
    timestamp: string | null;
    route: string;
  }>;
}

export type CampaignPlaybookOnboardingResponse = {
  ok: boolean;
  campaignId: string;
  item: CampaignPlaybookOnboardingItem;
};
