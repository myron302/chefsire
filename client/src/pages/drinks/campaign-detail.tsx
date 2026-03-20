import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";

import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import CreatorDropCard, { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import CreatorPostCard, { type CreatorPostItem } from "@/components/drinks/CreatorPostCard";
import CreatorRoadmapCard, { type CreatorRoadmapItem } from "@/components/drinks/CreatorRoadmapCard";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

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
}

function describeState(campaign: CreatorCampaignItem) {
  if (campaign.state === "upcoming") return "This story arc is queued up and will become more relevant as the linked drops and notes roll in.";
  if (campaign.state === "past") return "This arc has moved into recap mode, but the linked drops, posts, and roadmap notes still tell the full launch story.";
  return "This campaign is actively shaping the creator's current release story across drops, promos, posts, and roadmap moments.";
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

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="creator" />

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
            <Link href="/drinks/drops"><Button variant="outline">Drops calendar</Button></Link>
            {query.data?.campaign.creator ? <Link href={query.data.campaign.creator.route}><Button>Creator page</Button></Link> : null}
          </div>
        </div>
      </section>

      {query.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading campaign…</CardContent></Card> : null}
      {query.isError ? <Card><CardContent className="p-6 text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load this campaign right now."}</CardContent></Card> : null}

      {query.data ? (
        <>
          <CreatorCampaignCard campaign={query.data.campaign} />

          <Card>
            <CardHeader>
              <CardTitle>Story arc overview</CardTitle>
              <CardDescription>{describeState(query.data.campaign)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Visibility</p>
                <p className="text-muted-foreground">{query.data.campaign.visibility === "public" ? "Visible to everyone." : query.data.campaign.visibility === "followers" ? "Visible to followed users + creator." : "Visible to active members + creator."}</p>
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
