import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";

import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import CampaignFollowButton from "@/components/drinks/CampaignFollowButton";
import CreatorDropCard, { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import CreatorPostCard, { type CreatorPostItem } from "@/components/drinks/CreatorPostCard";
import CreatorRoadmapCard, { type CreatorRoadmapItem } from "@/components/drinks/CreatorRoadmapCard";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  milestones: {
    public: CampaignMilestone[];
    owner: CampaignMilestone[];
  };
  ownerAnalytics?: CampaignOwnerAnalytics | null;
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
