import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";

import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import CampaignActionCenterSection from "@/components/drinks/CampaignActionCenterSection";
import CampaignLaunchReadinessSection from "@/components/drinks/CampaignLaunchReadinessSection";
import CampaignRolloutTimelineSection from "@/components/drinks/CampaignRolloutTimelineSection";
import CampaignUnlockReadinessAlertsSection from "@/components/drinks/CampaignUnlockReadinessAlertsSection";
import CampaignPinButton from "@/components/drinks/CampaignPinButton";
import CampaignStageRecapsSection from "@/components/drinks/CampaignStageRecapsSection";
import CampaignUnlockControls from "@/components/drinks/CampaignUnlockControls";
import CampaignFixExperimentsSection from "@/components/drinks/CampaignFixExperimentsSection";
import { CampaignLifecycleSuggestionPanel, type CampaignLifecycleSuggestion } from "@/components/drinks/CampaignLifecycleSuggestionsSection";
import { CampaignWrapUpPanel, type CampaignRetrospectiveItem } from "@/components/drinks/CampaignRetrospectivesSection";
import CampaignFollowButton from "@/components/drinks/CampaignFollowButton";
import CreatorDropCard, { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import CreatorPostCard, { type CreatorPostItem } from "@/components/drinks/CreatorPostCard";
import CreatorRoadmapCard, { type CreatorRoadmapItem } from "@/components/drinks/CreatorRoadmapCard";
import DropRsvpButton from "@/components/drinks/DropRsvpButton";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { normalizeCampaignSurfaceAttributionSurface, readCampaignSurfaceTouch, setCampaignSurfaceTouch, trackCampaignDetailLandingOnce, trackCampaignSurfaceEvent } from "@/lib/drinks/campaignSurfaceAttribution";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/contexts/UserContext";

type CampaignOwnerAnalytics = {
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

type CampaignMilestone = {
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

type CampaignVariantItem = {
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

type CampaignGoalItem = {
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

type CampaignHealthItem = {
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

type CampaignRecoveryPlan = {
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

type CampaignRolloutAnalyticsItem = {
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

interface CampaignDetailResponse {
  ok: boolean;
  campaign: CreatorCampaignItem;
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

function describeState(campaign: CreatorCampaignItem) {
  if (campaign.state === "upcoming") return "This story arc is queued up and will become more relevant as the linked drops and notes roll in.";
  if (campaign.state === "past") return "This arc has moved into recap mode, but the linked drops, posts, and roadmap notes still tell the full launch story.";
  return "This campaign is actively shaping the creator's current release story across drops, promos, posts, and roadmap moments.";
}

function formatMilestoneDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function campaignHealthBadgeVariant(state: CampaignHealthItem["healthState"]): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "thriving":
      return "default";
    case "healthy":
      return "secondary";
    case "at_risk":
      return "destructive";
    case "watch":
    case "completed":
    default:
      return "outline";
  }
}

function campaignHealthLabel(state: CampaignHealthItem["healthState"]) {
  switch (state) {
    case "at_risk":
      return "At risk";
    case "thriving":
      return "Thriving";
    case "healthy":
      return "Healthy";
    case "watch":
      return "Watch";
    case "completed":
    default:
      return "Completed";
  }
}

function formatHealthDateTime(value: string | null) {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function rolloutModeLabel(value: NonNullable<CreatorCampaignItem["rollout"]>["rolloutMode"]) {
  switch (value) {
    case "followers_first":
      return "Followers first";
    case "members_first":
      return "Members first";
    case "staged":
      return "Staged rollout";
    case "public_first":
    default:
      return "Public first";
  }
}

function rolloutStateLabel(value: NonNullable<CreatorCampaignItem["rollout"]>["state"]) {
  switch (value) {
    case "scheduled_for_members":
      return "Scheduled for members";
    case "scheduled_for_followers":
      return "Scheduled for followers";
    case "scheduled_for_public":
      return "Scheduled for public";
    case "live_for_members":
      return "Live for members";
    case "live_for_followers":
      return "Live for followers";
    case "live_for_public":
      return "Live for public";
    case "fully_open":
      return "Fully open";
    case "completed":
    default:
      return "Completed";
  }
}

function rolloutAudienceLabel(value: NonNullable<CreatorCampaignItem["rollout"]>["currentAudience"] | null) {
  if (value === "members") return "Members";
  if (value === "followers") return "Followers";
  if (value === "public") return "Public";
  return "—";
}

function buildVariantDestination(data: CampaignDetailResponse) {
  const variant = data.activeVariant;
  if (!variant) return null;

  switch (variant.ctaTargetType) {
    case "collection":
      return data.linkedContent.collections[0]
        ? { href: data.linkedContent.collections[0].route, label: "collection" }
        : null;
    case "membership":
      return data.campaign.creator
        ? { href: `${data.campaign.creator.route}#membership`, label: "membership" }
        : null;
    case "drop":
      return data.linkedContent.drops[0]
        ? { href: data.linkedContent.drops[0].detailRoute, label: "drop" }
        : null;
    case "challenge":
      return data.linkedContent.challenges[0]
        ? { href: data.linkedContent.challenges[0].route, label: "challenge" }
        : null;
    default:
      return null;
  }
}

function rolloutAdviceTypeLabel(value: NonNullable<CampaignDetailResponse["ownerRolloutAdvice"]>["recommendationType"]) {
  switch (value) {
    case "keep_members_first":
      return "Keep members first";
    case "keep_followers_first":
      return "Keep followers first";
    case "keep_public_first":
      return "Keep public first";
    case "shorten_staged_rollout":
      return "Shorten staged rollout";
    case "extend_member_window":
      return "Extend member window";
    case "extend_follower_window":
      return "Extend follower window";
    case "go_public_earlier":
      return "Go public earlier";
    case "add_member_phase":
      return "Add member phase";
    case "skip_member_phase":
      return "Skip member phase";
    case "skip_follower_phase":
      return "Skip follower phase";
    case "use_staged_rollout_next_time":
    default:
      return "Use staged rollout next time";
  }
}

function timingAdviceTypeLabel(value: NonNullable<CampaignDetailResponse["ownerTimingAdvice"]>["timingRecommendationType"]) {
  switch (value) {
    case "start_earlier":
      return "Start earlier";
    case "start_later":
      return "Start later";
    case "shorten_member_window":
      return "Shorten member window";
    case "extend_member_window":
      return "Extend member window";
    case "shorten_follower_window":
      return "Shorten follower window";
    case "extend_follower_window":
      return "Extend follower window";
    case "accelerate_public_unlock":
      return "Accelerate public unlock";
    case "delay_public_unlock":
      return "Delay public unlock";
    case "use_short_burst_launch":
      return "Use short burst launch";
    case "use_longer_staged_rollout":
      return "Use longer staged rollout";
    case "keep_current_timing":
    default:
      return "Keep current timing";
  }
}

function formatTimingDelay(value: number | null, fallback: string) {
  if (value === null) return fallback;
  if (value <= 0) return "same day";
  if (value === 1) return "1 day";
  return `${value} days`;
}

function campaignGoalLabel(goal: CampaignGoalItem) {
  return goal.label?.trim()
    || ({
      followers: "Campaign followers",
      rsvps: "Linked drop RSVPs",
      clicks: "Linked drop clicks",
      purchases: "Linked collection purchases",
      membership_conversions: "Membership conversions",
      linked_drop_views: "Linked drop views",
    }[goal.goalType] ?? goal.goalType);
}

export default function DrinkCampaignDetailPage() {
  const [matched, params] = useRoute<{ slug: string }>("/drinks/campaigns/:slug");
  const { user } = useUser();
  const slug = matched ? String(params?.slug ?? "") : "";
  const [pinMessage, setPinMessage] = React.useState("");
  const [pinError, setPinError] = React.useState("");
  const [unlockMessage, setUnlockMessage] = React.useState("");
  const [unlockError, setUnlockError] = React.useState("");

  const query = useQuery<CampaignDetailResponse>({
    queryKey: ["/api/drinks/campaigns", slug, user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(slug)}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign (${response.status})`);
      }
      return payload as CampaignDetailResponse;
    },
    enabled: Boolean(slug),
  });

  if (!matched) return null;

  const campaign = query.data?.campaign ?? null;
  const activeVariant = query.data?.activeVariant ?? null;
  const variantDestination = query.data ? buildVariantDestination(query.data) : null;
  const currentSurface = (() => {
    if (typeof window === "undefined" || !query.data?.campaign.id) return "direct_or_unknown" as const;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = normalizeCampaignSurfaceAttributionSurface(params.get("surface"));
    if (fromQuery !== "direct_or_unknown") return fromQuery;
    return readCampaignSurfaceTouch(query.data.campaign.id);
  })();

  React.useEffect(() => {
    if (!query.data?.activeVariant) return;

    void fetch(
      `/api/drinks/campaigns/${encodeURIComponent(query.data.campaign.id)}/variants/${encodeURIComponent(query.data.activeVariant.id)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventType: "view_variant" }),
      },
    );
  }, [query.data]);

  React.useEffect(() => {
    if (!query.data?.campaign.id || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const querySurface = normalizeCampaignSurfaceAttributionSurface(params.get("surface"));
    if (querySurface !== "direct_or_unknown") {
      setCampaignSurfaceTouch(query.data.campaign.id, querySurface);
      return;
    }
    trackCampaignDetailLandingOnce({
      campaignId: query.data.campaign.id,
      surface: "campaign_detail_page",
      referrerRoute: `${window.location.pathname}${window.location.search}`,
    });
    setCampaignSurfaceTouch(query.data.campaign.id, "campaign_detail_page");
  }, [query.data?.campaign.id]);

  const trackVariantClick = React.useCallback(() => {
    if (!query.data?.activeVariant) return;
    void trackCampaignSurfaceEvent({
      campaignId: query.data.campaign.id,
      eventType: "click_campaign",
      surface: currentSurface === "direct_or_unknown" ? "campaign_detail_page" : currentSurface,
      referrerRoute: typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : null,
    });
    void fetch(
      `/api/drinks/campaigns/${encodeURIComponent(query.data.campaign.id)}/variants/${encodeURIComponent(query.data.activeVariant.id)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventType: "click_variant_cta",
          metadata: {
            ctaTargetType: query.data.activeVariant.ctaTargetType,
          },
        }),
      },
    );
  }, [query.data]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="campaigns" />

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Campaign / season</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Lightweight themed arcs for creator launches: a release wave, promo run, member month, or seasonal cocktail series without turning the drinks platform into a giant CMS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/discover"><Button variant="outline">Discover hub</Button></Link>
            <Link href="/drinks/campaigns/following"><Button variant="outline">Followed campaigns</Button></Link>
            <Link href="/drinks/drops"><Button variant="outline">Drops calendar</Button></Link>
            {query.data?.campaign.creator ? <Link href={query.data.campaign.creator.route}><Button>Creator page</Button></Link> : null}
          </div>
        </div>
      </section>

      {query.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading campaign…</CardContent></Card> : null}
      {query.isError ? <Card><CardContent className="p-6 text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load this campaign right now."}</CardContent></Card> : null}

      {query.data ? (
        <>
          <CreatorCampaignCard
            campaign={query.data.campaign}
            actions={(
              <>
                <CampaignFollowButton
                  campaignId={campaign?.id}
                  creatorUserId={campaign?.creatorUserId}
                  variant={campaign?.isFollowing ? "outline" : "default"}
                  followRequestBody={{ surface: currentSurface === "direct_or_unknown" ? "campaign_detail_page" : currentSurface }}
                />
                {user?.id && user.id === query.data.campaign.creatorUserId ? (
                  <CampaignPinButton
                    campaignId={query.data.campaign.id}
                    isPinned={query.data.campaign.isPinned}
                    variant={query.data.campaign.isPinned ? "secondary" : "outline"}
                    onSuccess={(message) => { setPinMessage(message); setPinError(""); }}
                    onError={(message) => { setPinError(message); setPinMessage(""); }}
                  />
                ) : null}
              </>
            )}
          />

          {pinMessage ? <p className="text-sm text-emerald-600">{pinMessage}</p> : null}
          {pinError ? <p className="text-sm text-destructive">{pinError}</p> : null}

          {user?.id && user.id === query.data.campaign.creatorUserId ? (
            <CampaignActionCenterSection
              campaignId={query.data.campaign.id}
              compact
              showShortcuts={false}
              title="Owner-only quick actions"
              description="Private, campaign-scoped next moves consolidated from the action center. This stays focused on practical operations for this campaign only."
            />
          ) : null}

          {user?.id
          && user.id === query.data.campaign.creatorUserId
          && (
            query.data.campaign.state === "upcoming"
            || query.data.ownerRollout?.nextAudience
            || query.data.ownerRollout?.rolloutMode === "staged"
          ) ? (
            <CampaignLaunchReadinessSection
              campaignId={query.data.campaign.id}
              compact
              limit={1}
              title="Owner-only launch readiness / preflight"
              description="Private readiness checks for this campaign only. This stays separate from the timing advisor, rollout advisor, action center, and recovery layers."
            />
          ) : null}

          {user?.id
          && user.id === query.data.campaign.creatorUserId
          && query.data.ownerRollout?.nextAudience
          && query.data.ownerRollout?.nextUnlockAt ? (
            <CampaignUnlockReadinessAlertsSection
              campaignId={query.data.campaign.id}
              compact
              limit={1}
              title="Owner-only upcoming unlock alert"
              description="Private, time-sensitive unlock warnings for this campaign only. This stays separate from overall launch readiness and rollout/timing advice."
            />
          ) : null}

          {user?.id && user.id === query.data.campaign.creatorUserId ? (
            <CampaignFixExperimentsSection
              campaignId={query.data.campaign.id}
              compact
              title="Owner-only fix experiments"
              description="Private experiments for corrective actions on this campaign. Bottlenecks still show where leakage is happening; these cards only track which fix you tried and whether the next before/after window moved."
            />
          ) : null}

          {activeVariant ? (
            <Card>
              <CardHeader>
                <CardTitle>{activeVariant.headline ?? query.data.campaign.name}</CardTitle>
                <CardDescription>
                  {activeVariant.subheadline ?? "A lightweight CTA frame for this campaign. Metrics stay directional, and conversion labels remain honest about what is direct versus approximate."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <Badge variant="outline">Active CTA · {activeVariant.label}</Badge>
                  <p className="text-sm text-muted-foreground">
                    {activeVariant.ctaTargetType === "follow"
                      ? "Follow actions are tracked directly from this campaign CTA."
                      : activeVariant.ctaTargetType === "rsvp"
                        ? "RSVP actions are tracked when this CTA sends someone into the linked drop reminder flow."
                        : "CTA clicks are tracked directly here. Purchases and memberships remain approximate proxy reads after a signed-in CTA click."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeVariant.ctaTargetType === "follow" ? (
                    <CampaignFollowButton
                      campaignId={campaign?.id}
                      creatorUserId={campaign?.creatorUserId}
                      size="default"
                      followRequestBody={{ variantId: activeVariant.id, surface: currentSurface === "direct_or_unknown" ? "campaign_detail_page" : currentSurface }}
                      onBeforeToggle={trackVariantClick}
                      idleLabel={activeVariant.ctaText}
                      activeLabel="Following"
                    />
                  ) : null}
                  {activeVariant.ctaTargetType === "rsvp" && query.data.linkedContent.drops[0] ? (
                    <DropRsvpButton
                      drop={query.data.linkedContent.drops[0]}
                      requestBody={{ campaignId: query.data.campaign.id, variantId: activeVariant.id, surface: currentSurface === "direct_or_unknown" ? "campaign_detail_page" : currentSurface }}
                      onBeforeToggle={trackVariantClick}
                      idleLabel={activeVariant.ctaText}
                      activeLabel="RSVP saved"
                    />
                  ) : null}
                  {variantDestination ? (
                    <Link href={variantDestination.href}>
                      <Button size="default" onClick={trackVariantClick}>{activeVariant.ctaText}</Button>
                    </Link>
                  ) : null}
                  {!variantDestination && activeVariant.ctaTargetType !== "follow" && activeVariant.ctaTargetType !== "rsvp" ? (
                    <Button size="default" variant="outline" disabled>No linked target yet</Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Momentum badges</CardTitle>
              <CardDescription>
                Lightweight social proof for this campaign so followers can quickly see whether the story arc is live, gathering attention, or already converting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {query.data.milestones.public.length ? (
                <div className="flex flex-wrap gap-2">
                  {query.data.milestones.public.map((milestone) => (
                    <Badge key={milestone.type} variant={milestone.type === "campaign_live" ? "default" : "secondary"} className="px-3 py-1">
                      {milestone.shortLabel}
                      {formatMilestoneDate(milestone.achievedAt) ? ` · ${formatMilestoneDate(milestone.achievedAt)}` : ""}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This campaign is still early. As followers, RSVPs, launches, and first conversions arrive, lightweight badges will appear here.
                </p>
              )}

              {query.data.milestones.public.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {query.data.milestones.public.map((milestone) => (
                    <div key={milestone.type} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={milestone.type === "campaign_live" ? "default" : "outline"}>{milestone.shortLabel}</Badge>
                        {formatMilestoneDate(milestone.achievedAt) ? <span className="text-xs text-muted-foreground">{formatMilestoneDate(milestone.achievedAt)}</span> : null}
                      </div>
                      <p className="mt-2 font-medium">{milestone.label}</p>
                      <p className="mt-1 text-muted-foreground">{milestone.description}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Story arc overview</CardTitle>
              <CardDescription>{describeState(query.data.campaign)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Visibility</p>
                <p className="text-muted-foreground">{query.data.campaign.visibility === "public" ? "Visible to everyone." : query.data.campaign.visibility === "followers" ? "Visible to followed users + creator." : "Visible to active members + creator."}</p>
              </div>
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Campaign follow</p>
                <p className="text-muted-foreground">{query.data.campaign.followerCount} people are following this arc for themed updates and launch intent.</p>
              </div>
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Linked surfaces</p>
                <p className="text-muted-foreground">Collections, drops, promos, challenges, creator posts, and roadmap notes appear here when the viewer has access.</p>
              </div>
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Access safety</p>
                <p className="text-muted-foreground">Follower/member-linked content still respects the underlying visibility and collection access rules.</p>
              </div>
            </CardContent>
          </Card>

          {query.data.ownerRollout ? (
            <Card>
              <CardHeader>
                <CardTitle>Owner-only rollout strategy</CardTitle>
                <CardDescription>
                  Private rollout view for how this campaign is sequencing across members, followers, and public audiences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{rolloutModeLabel(query.data.ownerRollout.rolloutMode)}</Badge>
                  <Badge variant="outline">{rolloutStateLabel(query.data.ownerRollout.state)}</Badge>
                  <Badge variant="outline">Current: {rolloutAudienceLabel(query.data.ownerRollout.currentAudience)}</Badge>
                  <Badge variant="outline">Final: {rolloutAudienceLabel(query.data.ownerRollout.finalAudience)}</Badge>
                  {query.data.ownerRollout.isRolloutPaused ? <Badge variant="secondary">Paused</Badge> : null}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Starts with</p>
                    <p className="text-muted-foreground">{rolloutAudienceLabel(query.data.ownerRollout.startsWithAudience)}</p>
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Next unlock</p>
                    <p className="text-muted-foreground">
                      {query.data.ownerRollout.nextAudience
                        ? `${rolloutAudienceLabel(query.data.ownerRollout.nextAudience)}${query.data.ownerRollout.nextUnlockAt ? ` · ${formatHealthDateTime(query.data.ownerRollout.nextUnlockAt)}` : ""}`
                        : "No later unlock scheduled"}
                    </p>
                    {query.data.ownerRollout.isRolloutPaused ? (
                      <p className="mt-2 text-xs text-amber-700">Paused at {formatHealthDateTime(query.data.ownerRollout.pausedAt)}.</p>
                    ) : null}
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Audience-fit hint</p>
                    <p className="text-muted-foreground">
                      {query.data.ownerRolloutSuggestion
                        ? `${rolloutModeLabel(query.data.ownerRolloutSuggestion.suggestedMode)} · ${query.data.ownerRolloutSuggestion.reason ?? "Rules-based suggestion."}`
                        : "No extra suggestion yet."}
                    </p>
                  </div>
                </div>

                {query.data.ownerRolloutAdvice ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">Private rollout advisor</p>
                      <Badge variant="outline">{rolloutAdviceTypeLabel(query.data.ownerRolloutAdvice.recommendationType)}</Badge>
                      <Badge variant="secondary">{query.data.ownerRolloutAdvice.confidence} confidence</Badge>
                    </div>
                    <p className="mt-2 font-medium text-foreground">{query.data.ownerRolloutAdvice.title}</p>
                    <p className="mt-1">{query.data.ownerRolloutAdvice.message}</p>
                    <p className="mt-2 text-xs">{query.data.ownerRolloutAdvice.rationale}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">Now: {rolloutModeLabel(query.data.ownerRolloutAdvice.currentRolloutMode)}</Badge>
                      <Badge variant="secondary">Next: {rolloutModeLabel(query.data.ownerRolloutAdvice.recommendedNextRolloutMode)}</Badge>
                      {query.data.ownerRolloutAdvice.rationaleChips.map((chip) => (
                        <Badge key={chip} variant="outline">{chip}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {query.data.ownerTimingAdvice ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">Owner-only timing hint</p>
                      <Badge variant="outline">{timingAdviceTypeLabel(query.data.ownerTimingAdvice.timingRecommendationType)}</Badge>
                      <Badge variant="secondary">{query.data.ownerTimingAdvice.confidence} confidence</Badge>
                    </div>
                    <p className="mt-2 font-medium text-foreground">{query.data.ownerTimingAdvice.title}</p>
                    <p className="mt-1">{query.data.ownerTimingAdvice.message}</p>
                    <p className="mt-2">{query.data.ownerTimingAdvice.suggestedStartTiming}</p>
                    <p className="mt-2 text-xs">{query.data.ownerTimingAdvice.rationale}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">Follower unlock next: {formatTimingDelay(query.data.ownerTimingAdvice.suggestedFollowerUnlockDelay, "not used")}</Badge>
                      <Badge variant="secondary">Public unlock next: {formatTimingDelay(query.data.ownerTimingAdvice.suggestedPublicUnlockDelay, "same day")}</Badge>
                      <Badge variant="outline">Current follower: {formatTimingDelay(query.data.ownerTimingAdvice.currentFollowerUnlockDelay, "not used")}</Badge>
                      <Badge variant="outline">Current public: {formatTimingDelay(query.data.ownerTimingAdvice.currentPublicUnlockDelay, "same day")}</Badge>
                      {query.data.ownerTimingAdvice.rationaleChips.map((chip) => (
                        <Badge key={chip} variant="outline">{chip}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Audience sequence</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {query.data.ownerRollout.timeline.map((step, index) => (
                      <span key={`${step.audience}-${index}`} className="rounded-full border px-2 py-1">
                        {rolloutAudienceLabel(step.audience)}
                        {step.unlockAt ? ` · ${formatHealthDateTime(step.unlockAt)}` : ""}
                        {step.isCurrent ? " · current" : ""}
                      </span>
                    ))}
                  </div>
                </div>

                <CampaignUnlockControls
                  campaignId={query.data.campaign.id}
                  rollout={query.data.ownerRollout}
                  compact
                  refreshKeys={[
                    ["/api/drinks/campaigns", slug, user?.id ?? "guest"],
                  ]}
                  onSuccess={(message) => {
                    setUnlockMessage(message);
                    setUnlockError("");
                  }}
                  onError={(message) => {
                    setUnlockError(message);
                    if (message) setUnlockMessage("");
                  }}
                />

                {unlockMessage ? <p className="text-sm text-emerald-600">{unlockMessage}</p> : null}
                {unlockError ? <p className="text-sm text-destructive">{unlockError}</p> : null}

                <CampaignRolloutTimelineSection
                  campaignId={query.data.campaign.id}
                  compact
                  limit={10}
                  title="Owner-only rollout history"
                  description="Private timeline of rollout config changes, unlock controls, derived stage transitions, readiness warnings, and major linked drop go-live moments."
                />

                <CampaignStageRecapsSection
                  campaignId={query.data.campaign.id}
                  compact
                  title="Owner-only stage recaps + unlock outcomes"
                  description="Private stage-by-stage reviews of what each unlock window actually accomplished, kept separate from the raw rollout analytics totals and the timeline log."
                />

                {query.data.ownerRollout.rolloutNotes ? (
                  <div className="rounded-md bg-muted/30 p-3 text-sm">
                    <p className="font-medium text-foreground">Rollout notes</p>
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{query.data.ownerRollout.rolloutNotes}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {query.data.ownerRolloutAnalytics ? (
            <Card>
              <CardHeader>
                <CardTitle>Owner-only rollout performance</CardTitle>
                <CardDescription>
                  Private timing-based read on how this campaign performed as access widened. Stage metrics are tied to rollout unlock boundaries, not perfect causal attribution.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{rolloutModeLabel(query.data.ownerRolloutAnalytics.rolloutMode)}</Badge>
                  <Badge variant="outline">{rolloutStateLabel(query.data.ownerRolloutAnalytics.currentRolloutState)}</Badge>
                  <Badge variant="outline">Current: {rolloutAudienceLabel(query.data.ownerRolloutAnalytics.currentAudience)}</Badge>
                  {query.data.ownerRolloutAnalytics.nextAudience ? <Badge variant="outline">Next: {rolloutAudienceLabel(query.data.ownerRolloutAnalytics.nextAudience)}</Badge> : null}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {query.data.ownerRolloutAnalytics.stagePerformance.map((stage) => (
                    <div key={stage.audience} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{stage.label}</p>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <p>{stage.views} views</p>
                        <p>{stage.clicks} clicks</p>
                        <p>{stage.rsvps} RSVPs</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Transition insights</p>
                    {query.data.ownerRolloutAnalytics.insights.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {query.data.ownerRolloutAnalytics.insights.map((insight) => <li key={insight}>{insight}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-2">Not enough stage-specific signal yet to compare this rollout honestly.</p>
                    )}
                  </div>
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Approximate timing signals</p>
                    <div className="mt-2 space-y-1">
                      <p>Follower unlock reached: {query.data.ownerRolloutAnalytics.followersUnlockedAt ? formatHealthDateTime(query.data.ownerRolloutAnalytics.followersUnlockedAt) : "Not yet"}</p>
                      <p>Public unlock reached: {query.data.ownerRolloutAnalytics.publicUnlockedAt ? formatHealthDateTime(query.data.ownerRolloutAnalytics.publicUnlockedAt) : "Not yet"}</p>
                      <p>Purchases after follower unlock: {query.data.ownerRolloutAnalytics.approximatePurchasesAfterFollowerUnlock ?? "—"}</p>
                      <p>Purchases after public unlock: {query.data.ownerRolloutAnalytics.approximatePurchasesAfterPublicUnlock ?? "—"}</p>
                      <p>Memberships after member-first rollout: {query.data.ownerRolloutAnalytics.approximateMembershipsAfterMemberFirstRollout ?? "—"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {query.data.ownerHealth ? (
            <Card>
              <CardHeader>
                <CardTitle>Owner-only campaign health</CardTitle>
                <CardDescription>
                  Private current-status read for this campaign. This stays separate from analytics totals, weekly digest snapshots, benchmarks, and recommendations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={campaignHealthBadgeVariant(query.data.ownerHealth.healthState)}>{campaignHealthLabel(query.data.ownerHealth.healthState)}</Badge>
                  <Badge variant="outline">Health score {query.data.ownerHealth.healthScore}</Badge>
                  <Badge variant="outline">{query.data.ownerHealth.status}</Badge>
                  <span className="text-sm text-muted-foreground">Last activity {formatHealthDateTime(query.data.ownerHealth.recentActivityAt)}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md bg-muted/30 p-3 text-sm">
                    <p className="font-medium text-foreground">Primary strength</p>
                    <p className="mt-1 text-muted-foreground">{query.data.ownerHealth.primaryStrength ?? "No standout strength yet — the campaign is still gathering signal."}</p>
                  </div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm">
                    <p className="font-medium text-foreground">Primary concern</p>
                    <p className="mt-1 text-muted-foreground">{query.data.ownerHealth.primaryConcern ?? "No major warning sign right now."}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border px-2 py-1">Follower momentum: {query.data.ownerHealth.followerMomentum}</span>
                  <span className="rounded-full border px-2 py-1">RSVP momentum: {query.data.ownerHealth.rsvpMomentum}</span>
                  <span className="rounded-full border px-2 py-1">Click momentum: {query.data.ownerHealth.clickMomentum}</span>
                  <span className="rounded-full border px-2 py-1">Goals on track: {query.data.ownerHealth.goalsOnTrack}</span>
                  {query.data.ownerHealth.goalsBehind > 0 ? <span className="rounded-full border px-2 py-1">Goals behind: {query.data.ownerHealth.goalsBehind}</span> : null}
                </div>
                {query.data.ownerHealth.watchReasons.length ? (
                  <div className="space-y-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Watchlist reasons</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {query.data.ownerHealth.watchReasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </div>
                ) : null}
                {query.data.ownerHealth.recommendation ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Linked next-step idea</p>
                    <p className="mt-1">{query.data.ownerHealth.recommendation.title}</p>
                    {query.data.ownerHealth.recommendation.suggestedRoute ? (
                      <div className="mt-2">
                        <Link href={query.data.ownerHealth.recommendation.suggestedRoute}><Button size="sm" variant="outline">{query.data.ownerHealth.recommendation.suggestedAction ?? "Open suggestion"}</Button></Link>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {query.data.ownerLifecycleSuggestion ? (
            <Card>
              <CardHeader>
                <CardTitle>Owner-only lifecycle hint</CardTitle>
                <CardDescription>
                  Private lifecycle guidance for what this campaign likely wants next. This stays distinct from health, recommendations, recovery, and wrap-up analytics.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CampaignLifecycleSuggestionPanel suggestion={query.data.ownerLifecycleSuggestion} compact />
              </CardContent>
            </Card>
          ) : null}

          {query.data.ownerRecoveryPlan && (query.data.ownerRecoveryPlan.healthState === "watch" || query.data.ownerRecoveryPlan.healthState === "at_risk") ? (
            <Card>
              <CardHeader>
                <CardTitle>Owner-only recovery plan</CardTitle>
                <CardDescription>
                  Focused rescue actions for this specific campaign. This stays private to the owner and remains separate from the broader recommendation list.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={campaignHealthBadgeVariant(query.data.ownerRecoveryPlan.healthState)}>{campaignHealthLabel(query.data.ownerRecoveryPlan.healthState)}</Badge>
                  <Badge variant={query.data.ownerRecoveryPlan.rescuePriority === "urgent" ? "destructive" : query.data.ownerRecoveryPlan.rescuePriority === "high" ? "default" : query.data.ownerRecoveryPlan.rescuePriority === "medium" ? "secondary" : "outline"}>
                    {query.data.ownerRecoveryPlan.rescuePriority.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="rounded-md bg-muted/30 p-3 text-sm">
                  <p className="font-medium text-foreground">Why recovery is showing</p>
                  <p className="mt-1 text-muted-foreground">{query.data.ownerRecoveryPlan.riskReason ?? "This campaign has slipped into a watch / at-risk state and needs a tighter rescue sequence."}</p>
                </div>
                <div className="space-y-3">
                  {query.data.ownerRecoveryPlan.suggestedActions.map((action, index) => (
                    <div key={`${action.actionType}-${index}`} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">Step {index + 1}: {action.label}</p>
                        <Badge variant="outline" className="capitalize">{action.actionType.replaceAll("_", " ")}</Badge>
                      </div>
                      <p className="mt-2 text-muted-foreground">{action.description}</p>
                      {action.supportingSignals.length ? (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {action.supportingSignals.map((signal) => <span key={signal} className="rounded-full border px-2 py-1">{signal}</span>)}
                        </div>
                      ) : null}
                      {action.suggestedRoute ? (
                        <div className="mt-3">
                          <Link href={action.suggestedRoute}><Button size="sm" variant="outline">Open action</Button></Link>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {query.data.ownerRecoveryPlan.confidenceNote ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">How this plan was derived</p>
                    <p className="mt-1">{query.data.ownerRecoveryPlan.confidenceNote}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {query.data.ownerRetrospective ? (
            <Card>
              <CardHeader>
                <CardTitle>Owner-only wrap-up</CardTitle>
                <CardDescription>
                  Private retrospective for completed or archived campaigns. This is only shown to the campaign owner and stays distinct from the live analytics and digest views.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CampaignWrapUpPanel item={query.data.ownerRetrospective} compact />
              </CardContent>
            </Card>
          ) : null}

          {query.data.ownerAnalytics ? (
            <Card>
              <CardHeader>
                <CardTitle>Owner-only campaign performance</CardTitle>
                <CardDescription>Visible only to the campaign owner. Purchase and membership conversion counts are clearly marked as approximate proxies.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-md border p-3 text-sm"><p className="font-medium">Campaign followers</p><p className="text-2xl font-semibold">{query.data.ownerAnalytics.followerCount}</p></div>
                  <div className="rounded-md border p-3 text-sm"><p className="font-medium">Linked drops</p><p className="text-2xl font-semibold">{query.data.ownerAnalytics.linkedDropsCount}</p></div>
                  <div className="rounded-md border p-3 text-sm"><p className="font-medium">RSVP interest</p><p className="text-2xl font-semibold">{query.data.ownerAnalytics.totalDropRsvps}</p></div>
                  <div className="rounded-md border p-3 text-sm"><p className="font-medium">Drop click-throughs</p><p className="text-2xl font-semibold">{query.data.ownerAnalytics.totalDropClicks}</p></div>
                  <div className="rounded-md border p-3 text-sm"><p className="font-medium">Purchases from linked collections</p><p className="text-2xl font-semibold">{query.data.ownerAnalytics.purchasesFromLinkedCollections}</p><p className="mt-1 text-xs text-muted-foreground">{query.data.ownerAnalytics.purchasesFromLinkedCollectionsNote ?? "No linked premium purchase proxy in this campaign yet."}</p></div>
                  <div className="rounded-md border p-3 text-sm"><p className="font-medium">Membership conversions</p><p className="text-2xl font-semibold">{query.data.ownerAnalytics.membershipsFromCampaign}</p><p className="mt-1 text-xs text-muted-foreground">{query.data.ownerAnalytics.membershipsFromCampaignNote ?? "Only shown for member-focused campaigns."}</p></div>
                </div>
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Campaign engagement score</p>
                  <p className="mt-1">{query.data.ownerAnalytics.campaignEngagementScore} · {query.data.ownerAnalytics.campaignEngagementScoreNote}</p>
                </div>
                {query.data.ownerGoals.length ? (
                  <div className="space-y-3 rounded-md border border-dashed p-4">
                    <div>
                      <p className="font-medium">Goals / progress</p>
                      <p className="text-sm text-muted-foreground">Creator-set targets stay private to the owner view. They complement milestones instead of replacing them.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {query.data.ownerGoals.map((goal) => (
                        <div key={goal.id} className="rounded-md border p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={goal.isComplete ? "default" : "outline"}>{campaignGoalLabel(goal)}</Badge>
                            {goal.isComplete ? <Badge variant="secondary">Complete</Badge> : null}
                          </div>
                          <p className="mt-2 font-medium">{goal.metricLabel}</p>
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>{goal.currentValue} / {goal.targetValue}</span>
                            <span>{goal.percentComplete}%</span>
                          </div>
                          <Progress value={goal.percentComplete} className="mt-2 h-2" />
                          {goal.metricNote ? <p className="mt-2 text-xs text-muted-foreground">{goal.metricNote}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {query.data.ownerAnalytics.milestones.length ? (
                  <div className="space-y-3 rounded-md border border-dashed p-4">
                    <div>
                      <p className="font-medium">Owner milestone state</p>
                      <p className="text-sm text-muted-foreground">Public badges stay lightweight; this owner view also shows campaign-specific thresholds and conversion milestones still in progress.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {query.data.ownerAnalytics.milestones.map((milestone) => {
                        const progressLabel = milestone.targetValue && milestone.currentValue !== null
                          ? `${milestone.currentValue}/${milestone.targetValue}`
                          : milestone.currentValue !== null
                            ? String(milestone.currentValue)
                            : null;
                        return (
                          <div key={milestone.type} className="rounded-md border p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={milestone.achieved ? "default" : "outline"}>{milestone.shortLabel}</Badge>
                              <Badge variant="outline">{milestone.isPublic ? "Public-safe" : "Owner-only"}</Badge>
                            </div>
                            <p className="mt-2 font-medium">{milestone.label}</p>
                            <p className="mt-1 text-muted-foreground">{milestone.description}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {progressLabel ? <span>Progress {progressLabel}</span> : null}
                              {formatMilestoneDate(milestone.achievedAt) ? <span>Unlocked {formatMilestoneDate(milestone.achievedAt)}</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Recent campaign updates</CardTitle>
              <CardDescription>Clean, lightweight movement across the linked story arc without replacing drops, posts, roadmap, or alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {query.data.recentUpdates.length === 0 ? <p className="text-sm text-muted-foreground">No visible campaign updates yet.</p> : null}
              {query.data.recentUpdates.map((update) => (
                <Link key={update.id} href={update.route}>
                  <div className="rounded-md border p-3 transition-colors hover:border-primary/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{update.label}</Badge>
                      {update.timestamp ? <Badge variant="secondary">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(update.timestamp))}</Badge> : null}
                    </div>
                    <p className="mt-2 font-medium">{update.title}</p>
                    {update.description ? <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{update.description}</p> : null}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Linked collections</CardTitle>
                <CardDescription>Premium or public releases grouped into this arc.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {query.data.linkedContent.collections.length === 0 ? <p className="text-sm text-muted-foreground">No visible collections linked.</p> : null}
                {query.data.linkedContent.collections.map((collection) => (
                  <div key={collection.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{collection.name}</p>
                    {collection.description ? <p className="mt-1 text-muted-foreground">{collection.description}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs text-muted-foreground">Access: {collection.accessType.replaceAll("_", " ")}</span>
                      <Link href={collection.route}><Button size="sm" variant="outline">Open collection</Button></Link>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Promos + challenges</CardTitle>
                <CardDescription>Promotional hooks and participation moments tied to the campaign.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {query.data.linkedContent.promos.map((promo) => (
                  <div key={promo.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Promo code · {promo.code}</p>
                    <p className="text-muted-foreground">Applies to {promo.collectionName}.</p>
                    <Link href={promo.route}><Button size="sm" variant="outline" className="mt-2">Open linked collection</Button></Link>
                  </div>
                ))}
                {query.data.linkedContent.challenges.map((challenge) => (
                  <div key={challenge.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Challenge · {challenge.title}</p>
                    <Link href={challenge.route}><Button size="sm" variant="outline" className="mt-2">Open challenge</Button></Link>
                  </div>
                ))}
                {query.data.linkedContent.promos.length === 0 && query.data.linkedContent.challenges.length === 0 ? <p className="text-sm text-muted-foreground">No visible promos or challenges linked.</p> : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Linked drops</CardTitle>
              <CardDescription>Countdown, go-live, and replay moments grouped into this themed arc.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {query.data.linkedContent.drops.length === 0 ? <p className="text-sm text-muted-foreground">No visible drops linked.</p> : null}
              {query.data.linkedContent.drops.map((drop) => <CreatorDropCard key={drop.id} drop={drop} />)}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Creator posts</CardTitle>
                <CardDescription>Context, recaps, and member/follower updates connected to the campaign.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {query.data.linkedContent.posts.length === 0 ? <p className="text-sm text-muted-foreground">No visible posts linked.</p> : null}
                {query.data.linkedContent.posts.map((post) => <CreatorPostCard key={post.id} post={post} />)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Roadmap + archive notes</CardTitle>
                <CardDescription>Upcoming, live, and archived notes that reinforce the larger story arc.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {query.data.linkedContent.roadmap.length === 0 ? <p className="text-sm text-muted-foreground">No visible roadmap notes linked.</p> : null}
                {query.data.linkedContent.roadmap.map((item) => <CreatorRoadmapCard key={item.id} item={item} />)}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
