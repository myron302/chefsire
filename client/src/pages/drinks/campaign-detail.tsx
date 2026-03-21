import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";

import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import { CampaignWrapUpPanel, type CampaignRetrospectiveItem } from "@/components/drinks/CampaignRetrospectivesSection";
import CampaignFollowButton from "@/components/drinks/CampaignFollowButton";
import CreatorDropCard, { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import CreatorPostCard, { type CreatorPostItem } from "@/components/drinks/CreatorPostCard";
import CreatorRoadmapCard, { type CreatorRoadmapItem } from "@/components/drinks/CreatorRoadmapCard";
import DropRsvpButton from "@/components/drinks/DropRsvpButton";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
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
  ownerRetrospective?: CampaignRetrospectiveItem | null;
  ownerHealth?: CampaignHealthItem | null;
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

  const trackVariantClick = React.useCallback(() => {
    if (!query.data?.activeVariant) return;
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
              <CampaignFollowButton
                campaignId={campaign?.id}
                creatorUserId={campaign?.creatorUserId}
                variant={campaign?.isFollowing ? "outline" : "default"}
              />
            )}
          />

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
                      followRequestBody={{ variantId: activeVariant.id }}
                      onBeforeToggle={trackVariantClick}
                      idleLabel={activeVariant.ctaText}
                      activeLabel="Following"
                    />
                  ) : null}
                  {activeVariant.ctaTargetType === "rsvp" && query.data.linkedContent.drops[0] ? (
                    <DropRsvpButton
                      drop={query.data.linkedContent.drops[0]}
                      requestBody={{ campaignId: query.data.campaign.id, variantId: activeVariant.id }}
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
