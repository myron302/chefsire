import * as React from "react";
import { Link, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import CreatorDropCard, { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import CreatorPostCard, { type CreatorPostItem } from "@/components/drinks/CreatorPostCard";
import CreatorRoadmapCard, { type CreatorRoadmapItem } from "@/components/drinks/CreatorRoadmapCard";
import CreatorFollowButton from "@/components/drinks/CreatorFollowButton";
import CreatorCollaborationAttribution, { type AcceptedCreatorCollaboration } from "@/components/drinks/CreatorCollaborationAttribution";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import CollectionRatingSummary from "@/components/drinks/CollectionRatingSummary";
import { buildCampaignRouteWithSurface, trackCampaignSurfaceEvent, trackCampaignSurfaceViewOnce } from "@/lib/drinks/campaignSurfaceAttribution";
import { trackPinnedCampaignSpotlightEvent, trackPinnedCampaignSpotlightViewOnce } from "@/lib/drinks/pinnedCampaignSpotlight";

interface PublicCreatorDrinkItem {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  createdAt: string;
  remixedFromSlug: string | null;
  route: string;
  views7d: number;
  remixesCount: number;
}

interface PublicCreatorRemixActivityItem {
  type: "received_remix" | "creator_published_remix";
  slug: string;
  name: string;
  createdAt: string;
  route: string;
  remixedFromSlug: string | null;
  creatorUsername: string | null;
}

interface PublicCreatorMostRemixedDrinkItem {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  remixesCount: number;
  views7d?: number;
}

interface PromoPricing {
  promotionId: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  originalAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
  currencyCode: string;
}

interface PublicCollection {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  accessType: "public" | "premium_purchase" | "membership_only";
  isPremium: boolean;
  priceCents: number;
  itemsCount: number;
  ownedByViewer?: boolean;
  viewerAccessGrants?: Array<"creator" | "direct_purchase" | "bundle" | "membership">;
  viewerPrimaryAccessGrant?: "creator" | "direct_purchase" | "bundle" | "membership" | null;
  isWishlisted?: boolean;
  wishlistCount?: number;
  averageRating?: number;
  reviewCount?: number;
  activePromoPricing?: PromoPricing | null;
  acceptedCollaboration?: AcceptedCreatorCollaboration | null;
}

interface PublicBundle {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
  itemsCount: number;
  route: string;
  ownedByViewer?: boolean;
}

interface CreatorMembershipPlan {
  id: string;
  creatorUserId: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingInterval: "monthly" | "yearly";
  isActive: boolean;
  benefits: string[];
}

interface CreatorMembershipRecord {
  id: string;
  status: "active" | "canceled" | "expired" | "past_due";
  endsAt: string | null;
  accessActive: boolean;
}

interface CreatorMembershipStatusResponse {
  ok: boolean;
  creatorUserId: string;
  plan: CreatorMembershipPlan | null;
  membership: CreatorMembershipRecord | null;
  checkout: {
    id: string;
    status: "pending" | "completed" | "failed" | "canceled";
    failureReason: string | null;
    checkoutUrl: string | null;
    updatedAt: string;
  } | null;
}

interface PublicCreatorResponse {
  ok: boolean;
  userId: string;
  username: string | null;
  avatar: string | null;
  followerCount: number;
  totalCreated: number;
  totalViews7d: number;
  totalRemixesReceived: number;
  totalGroceryAdds: number;
  topDrink: {
    slug: string;
    name: string;
    image: string | null;
    route: string;
    score: number;
  } | null;
  mostRemixedDrinks: PublicCreatorMostRemixedDrinkItem[];
  recentRemixActivity: PublicCreatorRemixActivityItem[];
  recentItems: PublicCreatorDrinkItem[];
}

interface PublicCreatorBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  isEarned: boolean;
}

interface PublicCreatorBadgesResponse {
  ok: boolean;
  userId: string;
  badges: PublicCreatorBadge[];
  earnedCount: number;
}

interface CreatorPostsResponse {
  ok: boolean;
  creatorUserId: string;
  count: number;
  items: CreatorPostItem[];
}

interface CreatorDropsResponse {
  ok: boolean;
  creatorUserId: string;
  count: number;
  items: CreatorDropItem[];
}

interface CreatorRoadmapResponse {
  ok: boolean;
  creatorUserId: string;
  count: number;
  counts: {
    upcoming: number;
    live: number;
    archived: number;
  };
  items: CreatorRoadmapItem[];
}

interface CreatorCampaignsResponse {
  ok: boolean;
  creatorUserId: string;
  count: number;
  pinnedCampaign: CreatorCampaignItem | null;
  items: CreatorCampaignItem[];
}

function number(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function initials(username: string | null): string {
  if (!username) return "CR";
  return username.trim().slice(0, 2).toUpperCase();
}

function formatCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function accessGrantLabel(grant?: PublicCollection["viewerPrimaryAccessGrant"]) {
  if (grant === "creator") return "Your collection";
  if (grant === "membership") return "Included with membership";
  if (grant === "bundle") return "Unlocked via bundle";
  if (grant === "direct_purchase") return "Owned via purchase";
  return "Owned";
}

function creatorMixHeadline(data: PublicCreatorResponse): string {
  if (data.totalCreated === 0) return "New creator";

  const remixCreatedCount = data.recentItems.filter((item) => Boolean(item.remixedFromSlug)).length;
  const remixCreatedRatio = remixCreatedCount / Math.max(data.recentItems.length, 1);

  if (data.totalRemixesReceived >= Math.max(8, data.totalCreated * 1.5)) {
    return "Popular through remixes received";
  }

  if (remixCreatedRatio >= 0.6) {
    return "Remix-heavy creator";
  }

  return "Original-creator leaning";
}

function remixActivityLabel(item: PublicCreatorRemixActivityItem): string {
  if (item.type === "received_remix") {
    return item.creatorUsername
      ? `@${item.creatorUsername} remixed this creator's drink`
      : "Someone remixed this creator's drink";
  }

  return "Creator published a remix";
}

export default function PublicDrinkCreatorPage() {
  const [matched, params] = useRoute<{ userId: string }>("/drinks/creator/:userId");
  const creatorId = matched ? String(params.userId ?? "") : "";
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [membershipMessage, setMembershipMessage] = React.useState("");
  const [membershipError, setMembershipError] = React.useState("");

  const query = useQuery<PublicCreatorResponse>({
    queryKey: ["/api/drinks/creators", creatorId],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creators/${encodeURIComponent(creatorId)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to load creator profile");
      }
      return response.json();
    },
    enabled: Boolean(creatorId),
  });

  const publicCollectionsQuery = useQuery<{ ok: boolean; collections: PublicCollection[] }>({
    queryKey: ["/api/drinks/collections/public", creatorId],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/collections/public/${encodeURIComponent(creatorId)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load public collections");
      }
      return response.json();
    },
    enabled: Boolean(creatorId),
  });

  const publicBadgesQuery = useQuery<PublicCreatorBadgesResponse>({
    queryKey: ["/api/drinks/creator/public-badges", creatorId],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator/${encodeURIComponent(creatorId)}/badges`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load creator badges");
      }
      return response.json();
    },
    enabled: Boolean(creatorId),
  });

  const creatorPostsQuery = useQuery<CreatorPostsResponse>({
    queryKey: ["/api/drinks/creator-posts/creator", creatorId, user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator-posts/creator/${encodeURIComponent(creatorId)}`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load creator posts");
      }
      return payload as CreatorPostsResponse;
    },
    enabled: Boolean(creatorId),
  });

  const creatorDropsQuery = useQuery<CreatorDropsResponse>({
    queryKey: ["/api/drinks/drops/creator", creatorId, user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/drops/creator/${encodeURIComponent(creatorId)}`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load creator drops");
      }
      return payload as CreatorDropsResponse;
    },
    enabled: Boolean(creatorId),
  });

  const creatorRoadmapQuery = useQuery<CreatorRoadmapResponse>({
    queryKey: ["/api/drinks/roadmap/creator", creatorId, user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/roadmap/creator/${encodeURIComponent(creatorId)}`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load creator roadmap");
      }
      return payload as CreatorRoadmapResponse;
    },
    enabled: Boolean(creatorId),
  });

  const creatorCampaignsQuery = useQuery<CreatorCampaignsResponse>({
    queryKey: ["/api/drinks/campaigns/creator", creatorId, user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/creator/${encodeURIComponent(creatorId)}`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load creator campaigns");
      }
      return payload as CreatorCampaignsResponse;
    },
    enabled: Boolean(creatorId),
  });

  const publicBundlesQuery = useQuery<{ ok: boolean; bundles: PublicBundle[] }>({
    queryKey: ["/api/drinks/bundles/public", creatorId],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/bundles/public/${encodeURIComponent(creatorId)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load public bundles");
      }
      return response.json();
    },
    enabled: Boolean(creatorId),
  });

  const membershipStatusQuery = useQuery<CreatorMembershipStatusResponse>({
    queryKey: ["/api/drinks/creators/membership/status", creatorId, user?.id ?? "", window.location.search],
    queryFn: async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("membershipCheckoutSessionId")?.trim();
      const suffix = sessionId ? `?checkoutSessionId=${encodeURIComponent(sessionId)}` : "";
      const response = await fetch(`/api/drinks/creators/${encodeURIComponent(creatorId)}/membership/status${suffix}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load creator membership status");
      return response.json();
    },
    enabled: Boolean(creatorId),
  });

  const joinMembershipMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/drinks/creators/${encodeURIComponent(creatorId)}/membership/create-checkout`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to start membership checkout (${response.status})`);
      return payload;
    },
    onSuccess: async (payload) => {
      if (payload?.alreadyActive) {
        setMembershipMessage("You already have active membership access for this creator.");
        await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creators/membership/status", creatorId] });
        return;
      }
      if (payload?.checkoutUrl) {
        setMembershipMessage("Square membership checkout opened in a new tab. Complete payment there and this creator page will refresh your access.");
        window.open(String(payload.checkoutUrl), "chefsire-square-membership-checkout", "popup,width=520,height=760");
      }
    },
    onError: (error) => {
      setMembershipError(error instanceof Error ? error.message : "Failed to start membership checkout");
    },
  });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("membershipSquareCheckout");
    if (!flag) return;
    const status = membershipStatusQuery.data?.checkout?.status;
    if (status === "completed") {
      setMembershipMessage("Membership payment verified. Member-only collections from this creator are now unlocked for your active term.");
    } else if (status === "failed" || status === "canceled") {
      setMembershipError(membershipStatusQuery.data?.checkout?.failureReason || "Square membership checkout did not complete.");
    } else {
      setMembershipMessage("Finishing your Square membership checkout…");
    }
  }, [membershipStatusQuery.data]);

  const creatorCollections = publicCollectionsQuery.data?.collections ?? [];
  const creatorBundles = publicBundlesQuery.data?.bundles ?? [];
  const creatorPosts = creatorPostsQuery.data?.items ?? [];
  const creatorDrops = creatorDropsQuery.data?.items ?? [];
  const liveCreatorDrops = creatorDrops.filter((drop) => drop.status === "live");
  const upcomingCreatorDrops = creatorDrops.filter((drop) => drop.status === "upcoming");
  const archivedCreatorDrops = creatorDrops.filter((drop) => drop.status === "archived");
  const creatorCampaigns = creatorCampaignsQuery.data?.items ?? [];
  const pinnedCampaign = creatorCampaignsQuery.data?.pinnedCampaign ?? creatorCampaigns.find((campaign) => campaign.isPinned) ?? null;
  const otherCreatorCampaigns = pinnedCampaign
    ? creatorCampaigns.filter((campaign) => campaign.id !== pinnedCampaign.id)
    : creatorCampaigns;
  const creatorRoadmap = creatorRoadmapQuery.data?.items ?? [];

  React.useEffect(() => {
    if (!pinnedCampaign) return;
    trackPinnedCampaignSpotlightViewOnce({
      campaignId: pinnedCampaign.id,
      surface: "creator_public_page",
      referrerRoute: typeof window !== "undefined" ? window.location.pathname : null,
    });
    trackCampaignSurfaceViewOnce({
      campaignId: pinnedCampaign.id,
      surface: "creator_public_page",
      referrerRoute: typeof window !== "undefined" ? window.location.pathname : null,
      scope: "creator-pinned",
    });
  }, [pinnedCampaign]);

  React.useEffect(() => {
    for (const campaign of creatorCampaigns) {
      trackCampaignSurfaceViewOnce({
        campaignId: campaign.id,
        surface: "creator_public_page",
        referrerRoute: typeof window !== "undefined" ? window.location.pathname : null,
        scope: "creator-campaign-list",
      });
    }
  }, [creatorCampaigns]);

  if (!matched) return null;

  if (query.isLoading) {
    return <div className="container mx-auto p-6">Loading creator profile...</div>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="container mx-auto p-6 space-y-3">
        <h1 className="text-3xl font-bold">Creator Profile</h1>
        <p className="text-destructive">Unable to load this creator right now.</p>
        <DrinksPlatformNav current="creator" />
        <Link href="/drinks">
          <Button variant="outline" size="sm">Back to Drinks Hub</Button>
        </Link>
      </div>
    );
  }

  const data = query.data;
  const collaborationHighlightsCount = [
    ...creatorCollections.filter((collection) => Boolean(collection.acceptedCollaboration)),
    ...creatorPosts.filter((post) => Boolean(post.acceptedCollaboration)),
    ...creatorDrops.filter((drop) => Boolean(drop.acceptedCollaboration)),
    ...creatorRoadmap.filter((item) => Boolean(item.acceptedCollaboration)),
  ].length;
  const roadmapUpcoming = creatorRoadmap.filter((item) => item.status === "upcoming");
  const roadmapLive = creatorRoadmap.filter((item) => item.status === "live");
  const roadmapArchived = creatorRoadmap.filter((item) => item.status === "archived");
  const premiumCollections = creatorCollections.filter((collection) => collection.accessType === "premium_purchase");
  const memberOnlyCollections = creatorCollections.filter((collection) => collection.accessType === "membership_only");
  const freeCollections = creatorCollections.filter((collection) => collection.accessType === "public");
  const membershipPlan = membershipStatusQuery.data?.plan ?? null;
  const viewerMembership = membershipStatusQuery.data?.membership ?? null;
  const membershipActive = Boolean(viewerMembership?.accessActive);

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="drinks-public-creator-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Creator Profile</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/drinks/drops">
            <Button variant="outline" size="sm">Drops Calendar</Button>
          </Link>
          <Link href="/drinks/roadmap">
            <Button variant="outline" size="sm">Roadmap + Archive</Button>
          </Link>
          <Link href="/drinks/feed">
            <Button variant="outline" size="sm">Creator Feed</Button>
          </Link>
          <Link href="/drinks">
            <Button variant="outline" size="sm">Back to Drinks Hub</Button>
          </Link>
        </div>
      </div>

      <DrinksPlatformNav current="creator" />

      {collaborationHighlightsCount > 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-medium">Collaboration highlights</p>
              <p className="text-muted-foreground">
                This creator currently has {collaborationHighlightsCount} accepted collab surface{collaborationHighlightsCount === 1 ? "" : "s"} showing attribution across drops, posts, roadmap items, or collections.
              </p>
            </div>
            <Link href="#creator-collections" className="underline underline-offset-2">Jump to collections + collabs</Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={data.avatar ?? undefined} alt={data.username ?? "Creator"} />
                <AvatarFallback>{initials(data.username)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle>@{data.username ?? "unknown"}</CardTitle>
                <CardDescription>
                  {number(data.followerCount)} followers • {number(data.totalCreated)} published drinks/remixes
                </CardDescription>
                <Badge variant="outline" className="w-fit">{creatorMixHeadline(data)}</Badge>
              </div>
            </div>
            {user?.id !== data.userId ? <CreatorFollowButton creatorId={data.userId} showNudge /> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{number(data.totalViews7d)} views (7d)</Badge>
            <Badge variant="secondary">{number(data.totalRemixesReceived)} remixes received</Badge>
            <Badge variant="secondary">{number(data.totalGroceryAdds)} grocery adds</Badge>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Milestones & badges</p>
            {publicBadgesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading badges…</p> : null}
            {!publicBadgesQuery.isLoading && (publicBadgesQuery.data?.badges?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No public badges earned yet.</p>
            ) : null}
            {(publicBadgesQuery.data?.badges?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {publicBadgesQuery.data?.badges?.map((badge) => (
                  <Badge key={badge.id} variant="outline"><span className="mr-1">{badge.icon}</span>{badge.title}</Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
            <p className="font-medium">Creator storefront · {creatorCollections.length} public collections</p>
            {memberOnlyCollections.length > 0 ? (
              <p className="text-muted-foreground">{memberOnlyCollections.length} member-only collections make this membership tangible, alongside {premiumCollections.length} premium purchase collections.</p>
            ) : premiumCollections.length > 0 ? (
              <p className="text-muted-foreground">Premium collections available · browse and support this creator.</p>
            ) : (
              <p className="text-muted-foreground">Support this creator by following and exploring their collections.</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="#creator-collections">
                <Button size="sm" variant="outline">View creator collections</Button>
              </Link>
              <Link href="#creator-posts">
                <Button size="sm" variant="outline">View creator posts</Button>
              </Link>
              <Link href="#creator-drops">
                <Button size="sm" variant="outline">Upcoming drops</Button>
              </Link>
              <Link href="#creator-roadmap">
                <Button size="sm" variant="outline">Roadmap + archive</Button>
              </Link>
              <Link href="#creator-campaigns">
                <Button size="sm" variant="outline">Campaigns</Button>
              </Link>
              {memberOnlyCollections.length > 0 || premiumCollections.length > 0 ? (
                <Link href="/drinks/collections/explore">
                  <Button size="sm">Browse collection storefront</Button>
                </Link>
              ) : null}
              {user?.id !== data.userId ? <CreatorFollowButton creatorId={data.userId} /> : null}
            </div>
          </div>

          {data.topDrink ? (
            <p className="text-sm text-muted-foreground">
              Top drink: <Link href={data.topDrink.route} className="underline underline-offset-2">{data.topDrink.name}</Link>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No top drink data available yet.</p>
          )}
        </CardContent>
      </Card>

      {membershipPlan?.isActive ? (
        <Card>
          <CardHeader>
            <CardTitle>{membershipPlan.name}</CardTitle>
            <CardDescription>
              Join this creator to unlock member-only collections and support them beyond one-off premium purchases.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{formatCurrency(membershipPlan.priceCents)}/{membershipPlan.billingInterval === "yearly" ? "year" : "month"}</Badge>
              <Badge variant={membershipActive ? "secondary" : "outline"}>{membershipActive ? "Member access active" : "Membership available"}</Badge>
              <Badge variant="secondary">{memberOnlyCollections.length} member-only collections</Badge>
              {viewerMembership?.endsAt ? <Badge variant="outline">Current term ends {formatDate(viewerMembership.endsAt)}</Badge> : null}
            </div>
            {membershipPlan.description ? <p className="text-sm text-muted-foreground">{membershipPlan.description}</p> : null}
            <p className="text-sm text-muted-foreground">
              {memberOnlyCollections.length > 0
                ? `Membership currently includes ${memberOnlyCollections.length} public-facing member-only collection${memberOnlyCollections.length === 1 ? "" : "s"}.`
                : "No member-only collections are published yet, but this membership is ready for creator perks."}
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {membershipPlan.benefits.map((benefit) => (
                <div key={benefit} className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  {benefit}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {user?.id === data.userId ? (
                <Link href="/drinks/creator-dashboard">
                  <Button variant="outline">Manage membership plan</Button>
                </Link>
              ) : membershipActive ? (
                <Link href="/drinks/memberships">
                  <Button>Open my memberships</Button>
                </Link>
              ) : !user ? (
                <Link href="/auth/login">
                  <Button>Sign in to subscribe</Button>
                </Link>
              ) : (
                <Button onClick={() => { setMembershipError(""); setMembershipMessage(""); joinMembershipMutation.mutate(); }} disabled={joinMembershipMutation.isPending}>
                  {joinMembershipMutation.isPending ? "Opening Square…" : "Join Membership"}
                </Button>
              )}
              <Link href="#creator-collections">
                <Button variant="ghost">See member perks</Button>
              </Link>
            </div>
            {membershipMessage ? <p className="text-sm text-emerald-600">{membershipMessage}</p> : null}
            {membershipError ? <p className="text-sm text-destructive">{membershipError}</p> : null}
            <p className="text-xs text-muted-foreground">
              Version one memberships unlock this creator&apos;s Members Only collections for the paid term. Renewals stay manual for now so finance reporting stays honest.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {pinnedCampaign ? (
        <Card className="border-primary/30 bg-gradient-to-r from-white via-blue-50/60 to-white">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Creator spotlight</CardTitle>
                <CardDescription>
                  The creator pinned this campaign as the best current place to start their drinks story. Access rules still apply, so this only appears when you are allowed to see it.
                </CardDescription>
              </div>
              <Badge variant="secondary">Pinned campaign</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold">{pinnedCampaign.name}</h3>
              {pinnedCampaign.description ? <p className="max-w-3xl text-sm text-muted-foreground">{pinnedCampaign.description}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{pinnedCampaign.audienceLabel}</Badge>
                <Badge variant="outline">{pinnedCampaign.counts.total} linked item{pinnedCampaign.counts.total === 1 ? "" : "s"}</Badge>
                <Badge variant="outline">{pinnedCampaign.followerCount} following</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={buildCampaignRouteWithSurface(pinnedCampaign.route, "creator_public_page")}>
                <Button
                  onClick={() => {
                    void trackPinnedCampaignSpotlightEvent({
                      campaignId: pinnedCampaign.id,
                      eventType: "click_pinned_campaign",
                      surface: "creator_public_page",
                      referrerRoute: typeof window !== "undefined" ? window.location.pathname : "/drinks/creator",
                    });
                    void trackCampaignSurfaceEvent({
                      campaignId: pinnedCampaign.id,
                      eventType: "click_campaign",
                      surface: "creator_public_page",
                      referrerRoute: typeof window !== "undefined" ? window.location.pathname : "/drinks/creator",
                    });
                  }}
                >
                  Explore campaign
                </Button>
              </Link>
              {user?.id && user.id !== data.userId ? (
                <CreatorFollowButton creatorId={data.userId} showNudge />
              ) : null}
              {membershipPlan?.isActive && !membershipActive && pinnedCampaign.visibility === "members" ? (
                <Button
                  variant="outline"
                  onClick={() => { setMembershipError(""); setMembershipMessage(""); joinMembershipMutation.mutate(); }}
                  disabled={joinMembershipMutation.isPending}
                >
                  {joinMembershipMutation.isPending ? "Opening Square…" : "Join to unlock"}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section id="creator-campaigns" className="space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Campaigns / Seasons</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{creatorCampaigns.length} visible campaigns</span>
            <Link href="/drinks/discover" className="underline underline-offset-2">Open discover hub</Link>
          </div>
        </div>

        {creatorCampaignsQuery.isLoading ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">Loading campaigns…</CardContent>
          </Card>
        ) : null}

        {creatorCampaignsQuery.isError ? (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">
              {creatorCampaignsQuery.error instanceof Error ? creatorCampaignsQuery.error.message : "Unable to load creator campaigns right now."}
            </CardContent>
          </Card>
        ) : null}

        {!creatorCampaignsQuery.isLoading && !creatorCampaignsQuery.isError && creatorCampaigns.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No visible campaigns yet. Public visitors only see public arcs; follower and member campaigns show up here only when your access allows it.
            </CardContent>
          </Card>
        ) : null}

        {!creatorCampaignsQuery.isLoading && !creatorCampaignsQuery.isError && creatorCampaigns.length > 0 && otherCreatorCampaigns.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No additional visible campaigns right now beyond the creator&apos;s pinned spotlight.
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-3">
          {otherCreatorCampaigns.map((campaign) => (
            <CreatorCampaignCard
              key={campaign.id}
              campaign={campaign}
              showCreator={false}
              openHref={buildCampaignRouteWithSurface(campaign.route, "creator_public_page")}
              onOpenCampaign={() => {
                void trackCampaignSurfaceEvent({
                  campaignId: campaign.id,
                  eventType: "click_campaign",
                  surface: "creator_public_page",
                  referrerRoute: typeof window !== "undefined" ? window.location.pathname : "/drinks/creator",
                });
              }}
            />
          ))}
        </div>
      </section>

      <section id="creator-roadmap" className="space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Roadmap + Archive</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{creatorRoadmap.length} visible items</span>
            <Link href="/drinks/roadmap" className="underline underline-offset-2">Open global roadmap</Link>
          </div>
        </div>

        {creatorRoadmapQuery.isLoading ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">Loading roadmap + archive…</CardContent>
          </Card>
        ) : null}

        {creatorRoadmapQuery.isError ? (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">
              {creatorRoadmapQuery.error instanceof Error ? creatorRoadmapQuery.error.message : "Unable to load creator roadmap right now."}
            </CardContent>
          </Card>
        ) : null}

        {!creatorRoadmapQuery.isLoading && !creatorRoadmapQuery.isError && creatorRoadmap.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No visible roadmap items yet. Public visitors only see public roadmap items; follower and member notes appear here only when your access allows it.
            </CardContent>
          </Card>
        ) : null}

        {[
          ["Upcoming", roadmapUpcoming, "What this creator is teasing next."],
          ["Live Now", roadmapLive, "What just launched or is actively being highlighted."],
          ["Archive / Past Releases", roadmapArchived, "Past promos, launches, challenge moments, and member drops."],
        ].map(([title, group, description]) => (
          <div key={title as string} className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <span className="text-sm text-muted-foreground">{(group as CreatorRoadmapItem[]).length} item{(group as CreatorRoadmapItem[]).length === 1 ? "" : "s"}</span>
            </div>
            {(group as CreatorRoadmapItem[]).length > 0 ? (
              <div className="space-y-3">
                {(group as CreatorRoadmapItem[]).map((item) => (
                  <CreatorRoadmapCard key={item.id} item={item} showCreator={false} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">Nothing visible in this section right now.</CardContent>
              </Card>
            )}
          </div>
        ))}
      </section>

      <section id="creator-drops" className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Drop pages + replays</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{creatorDrops.length} visible drop pages</span>
            <Link href="/drinks/drops" className="underline underline-offset-2">Open drops calendar</Link>
          </div>
        </div>

        {creatorDropsQuery.isLoading ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">Loading scheduled drops…</CardContent>
          </Card>
        ) : null}

        {creatorDropsQuery.isError ? (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">
              {creatorDropsQuery.error instanceof Error ? creatorDropsQuery.error.message : "Unable to load creator drops right now."}
            </CardContent>
          </Card>
        ) : null}

        {!creatorDropsQuery.isLoading && !creatorDropsQuery.isError && creatorDrops.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No visible drop pages yet. Public visitors only see public drops; follower and member drop pages appear here only when your access allows it.
            </CardContent>
          </Card>
        ) : null}

        {[
          ["Live now", liveCreatorDrops, "Launch surfaces that should send people directly into the released content."],
          ["Upcoming", upcomingCreatorDrops, "Dedicated landing pages before launch with countdown and Notify-Me support."],
          ["Recent replays", archivedCreatorDrops, "Past drop pages with recap notes and release links still intact."],
        ].map(([title, group, description]) => (
          <div key={title as string} className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <span className="text-sm text-muted-foreground">{(group as CreatorDropItem[]).length} drop{(group as CreatorDropItem[]).length === 1 ? "" : "s"}</span>
            </div>
            {(group as CreatorDropItem[]).length > 0 ? (
              <div className="space-y-3">
                {(group as CreatorDropItem[]).map((drop) => (
                  <CreatorDropCard key={drop.id} drop={drop} showCreator={false} />
                ))}
              </div>
            ) : creatorDrops.length > 0 ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">Nothing visible in this section right now.</CardContent>
              </Card>
            ) : null}
          </div>
        ))}
      </section>

      <section id="creator-posts" className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Creator posts</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{creatorPosts.length} visible posts</span>
            <Link href="/drinks/feed" className="underline underline-offset-2">Open full creator feed</Link>
          </div>
        </div>

        {creatorPostsQuery.isLoading ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">Loading creator posts…</CardContent>
          </Card>
        ) : null}

        {creatorPostsQuery.isError ? (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">
              {creatorPostsQuery.error instanceof Error ? creatorPostsQuery.error.message : "Unable to load creator posts right now."}
            </CardContent>
          </Card>
        ) : null}

        {!creatorPostsQuery.isLoading && !creatorPostsQuery.isError && creatorPosts.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No visible creator posts yet. Public visitors only see public posts; follower and member updates appear here only when your access allows it.
            </CardContent>
          </Card>
        ) : null}

        {creatorPosts.length > 0 ? (
          <div className="space-y-3">
            {creatorPosts.map((post) => (
              <CreatorPostCard key={post.id} post={post} showCreator={false} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Bundle offers</h2>
          <span className="text-sm text-muted-foreground">{creatorBundles.length} public bundles</span>
        </div>

        {publicBundlesQuery.isLoading ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">Loading creator bundle offers…</CardContent>
          </Card>
        ) : null}

        {!publicBundlesQuery.isLoading && creatorBundles.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">No public bundle offers featured yet.</CardContent>
          </Card>
        ) : null}

        {creatorBundles.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {creatorBundles.map((bundle) => (
              <Card key={bundle.id}>
                <CardContent className="p-4 space-y-2">
                  <Link href={bundle.route} className="font-medium underline underline-offset-2">
                    {bundle.name}
                  </Link>
                  {bundle.description ? <p className="text-sm text-muted-foreground">{bundle.description}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Badge>Premium Bundle · {formatCurrency(bundle.priceCents)}</Badge>
                    <Badge variant="secondary">{number(bundle.itemsCount)} collections</Badge>
                    {bundle.ownedByViewer ? <Badge variant="secondary">Owned</Badge> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Most Remixed Drinks</h2>
          <span className="text-sm text-muted-foreground">{data.mostRemixedDrinks.length} items</span>
        </div>

        {data.mostRemixedDrinks.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No remix performance data available yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.mostRemixedDrinks.map((item) => (
              <Card key={item.slug}>
                <CardContent className="p-4 space-y-3">
                  <Link href={item.route} className="block">
                    <img
                      src={item.image ?? "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=640&h=360&fit=crop"}
                      alt={item.name}
                      className="h-36 w-full rounded-md object-cover"
                    />
                  </Link>
                  <div className="space-y-2">
                    <Link href={item.route} className="block font-medium underline-offset-2 hover:underline">
                      {item.name}
                    </Link>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">🔥 {number(item.remixesCount)} remixes</Badge>
                      {typeof item.views7d === "number" ? <Badge variant="outline">{number(item.views7d)} views (7d)</Badge> : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Recent Remix Activity</h2>
          <span className="text-sm text-muted-foreground">{data.recentRemixActivity.length} items</span>
        </div>

        {data.recentRemixActivity.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Remix activity will appear here when this creator participates in or receives remixes.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.recentRemixActivity.map((item) => (
              <Card key={`${item.type}-${item.slug}-${item.createdAt}`}>
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">{remixActivityLabel(item)}</p>
                  <p>
                    <Link href={item.route} className="font-medium underline underline-offset-2">{item.name}</Link>
                  </p>
                  {item.remixedFromSlug ? (
                    <p className="text-xs text-muted-foreground">
                      From lineage: <Link href={`/drinks/recipe/${encodeURIComponent(item.remixedFromSlug)}`} className="underline underline-offset-2">{item.remixedFromSlug}</Link>
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="creator-collections" className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Collections + collabs</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{creatorCollections.length} items</span>
            {memberOnlyCollections.length > 0 ? <span>{memberOnlyCollections.length} members only</span> : null}
            {premiumCollections.length > 0 ? <span>{premiumCollections.length} premium purchase</span>  : null}
            <Link href="/drinks/collections/explore" className="underline underline-offset-2">Explore all</Link>
          </div>
        </div>

        {publicCollectionsQuery.isLoading ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">Loading public collections...</CardContent>
          </Card>
        ) : null}

        {!publicCollectionsQuery.isLoading && (publicCollectionsQuery.data?.collections?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">No public collections featured yet.</CardContent>
          </Card>
        ) : null}

        {!publicCollectionsQuery.isLoading && (publicCollectionsQuery.data?.collections?.length ?? 0) > 0 ? (
          <div className="space-y-5">
            {memberOnlyCollections.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Member-only collections</h3>
                  <span className="text-xs text-muted-foreground">Concrete membership value</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {memberOnlyCollections.map((collection) => (
                    <Card key={collection.id}>
                      <CardContent className="space-y-2 p-4">
                        <Link href={`/drinks/collections/${encodeURIComponent(collection.id)}`} className="font-medium underline underline-offset-2">
                          {collection.name}
                        </Link>
                        {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
                        <CreatorCollaborationAttribution collaboration={collection.acceptedCollaboration ?? null} primaryCreatorUserId={creatorId} />
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{number(collection.itemsCount)} drinks</Badge>
                          <Badge variant="secondary">Members Only</Badge>
                          {collection.ownedByViewer ? <Badge variant="secondary">{accessGrantLabel(collection.viewerPrimaryAccessGrant)}</Badge> : null}
                          {membershipActive ? <Badge variant="secondary">Member access active</Badge> : null}
                        </div>
                        <CollectionRatingSummary averageRating={collection.averageRating} reviewCount={collection.reviewCount} />
                        <div className="flex flex-wrap gap-2">
                          {membershipActive ? (
                            <Link href={`/drinks/collections/${encodeURIComponent(collection.id)}`} className="text-xs underline underline-offset-2">Open member collection</Link>
                          ) : !user ? (
                            <Link href="/auth/login"><Button size="sm">Sign in to join</Button></Link>
                          ) : (
                            <Button size="sm" onClick={() => { setMembershipError(""); setMembershipMessage(""); joinMembershipMutation.mutate(); }} disabled={joinMembershipMutation.isPending}>
                              {joinMembershipMutation.isPending ? "Opening Square…" : "Join Membership"}
                            </Button>
                          )}
                          <Link href="/drinks/memberships" className="text-xs underline underline-offset-2">Open memberships</Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}

            {premiumCollections.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Premium purchase collections</h3>
                  <span className="text-xs text-muted-foreground">One-off checkout still available</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {premiumCollections.map((collection) => (
                    <Card key={collection.id}>
                      <CardContent className="p-4 space-y-2">
                        <Link href={`/drinks/collections/${encodeURIComponent(collection.id)}`} className="font-medium underline underline-offset-2">
                          {collection.name}
                        </Link>
                        {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
                        <CreatorCollaborationAttribution collaboration={collection.acceptedCollaboration ?? null} primaryCreatorUserId={creatorId} />
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{number(collection.itemsCount)} drinks</Badge>
                          <Badge>Premium · {formatCurrency(collection.priceCents)}</Badge>
                          {collection.ownedByViewer ? <Badge variant="secondary">{accessGrantLabel(collection.viewerPrimaryAccessGrant)}</Badge> : null}
                          {user && collection.isWishlisted ? <Badge variant="outline">Wishlisted</Badge> : null}
                          {collection.activePromoPricing ? <Badge variant="secondary">Promo {collection.activePromoPricing.code}</Badge> : null}
                        </div>
                        {collection.activePromoPricing ? (
                          <p className="text-xs text-emerald-700">
                            Active promo checkout price: {formatCurrency(collection.activePromoPricing.finalAmountCents, collection.activePromoPricing.currencyCode)}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">Wishlist interest: {number(collection.wishlistCount ?? 0)}</p>
                        <CollectionRatingSummary averageRating={collection.averageRating} reviewCount={collection.reviewCount} />
                        <div className="flex flex-wrap gap-2">
                          <Link href="/drinks/collections/explore" className="text-xs underline underline-offset-2">Browse premium collections</Link>
                          <Link href="/drinks/collections/wishlist" className="text-xs underline underline-offset-2">Open wishlist</Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Free / public collections</h3>
                <span className="text-xs text-muted-foreground">Browse without paywalls</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {freeCollections.map((collection) => (
                  <Card key={collection.id}>
                    <CardContent className="p-4 space-y-2">
                      <Link href={`/drinks/collections/${encodeURIComponent(collection.id)}`} className="font-medium underline underline-offset-2">
                        {collection.name}
                      </Link>
                      {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
                      <CreatorCollaborationAttribution collaboration={collection.acceptedCollaboration ?? null} primaryCreatorUserId={creatorId} />
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{number(collection.itemsCount)} drinks</Badge>
                        <Badge variant="outline">Public</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Recent drinks & remixes</h2>
          <span className="text-sm text-muted-foreground">{data.recentItems.length} items</span>
        </div>

        {data.recentItems.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              This creator has not published drink recipes yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.recentItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 space-y-3">
                  <Link href={item.route} className="block">
                    <img
                      src={item.image ?? "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=640&h=360&fit=crop"}
                      alt={item.name}
                      className="h-36 w-full rounded-md object-cover"
                    />
                  </Link>

                  <div className="space-y-2">
                    <Link href={item.route} className="block font-medium underline-offset-2 hover:underline">
                      {item.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      <span>{formatDate(item.createdAt)}</span>
                    </div>

                    {item.remixedFromSlug ? (
                      <p className="text-xs text-muted-foreground">
                        Remix of{" "}
                        <Link
                          href={`/drinks/recipe/${encodeURIComponent(item.remixedFromSlug)}`}
                          className="underline underline-offset-2"
                        >
                          {item.remixedFromSlug}
                        </Link>
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{number(item.views7d)} views (7d)</Badge>
                      <Badge variant="secondary">🔥 {number(item.remixesCount)} remixes</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
