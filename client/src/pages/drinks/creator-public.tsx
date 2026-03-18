import * as React from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import CreatorFollowButton from "@/components/drinks/CreatorFollowButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";

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

interface PublicCollection {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
  itemsCount: number;
  ownedByViewer?: boolean;
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
  const creatorCollections = publicCollectionsQuery.data?.collections ?? [];
  const premiumCollections = creatorCollections.filter((collection) => collection.isPremium);
  const freeCollections = creatorCollections.filter((collection) => !collection.isPremium);

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="drinks-public-creator-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Creator Profile</h1>
        <Link href="/drinks">
          <Button variant="outline" size="sm">Back to Drinks Hub</Button>
        </Link>
      </div>

      <DrinksPlatformNav current="creator" />

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
            {premiumCollections.length > 0 ? (
              <p className="text-muted-foreground">Premium collections available · browse and support this creator.</p>
            ) : (
              <p className="text-muted-foreground">Support this creator by following and exploring their collections.</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="#creator-collections">
                <Button size="sm" variant="outline">View creator collections</Button>
              </Link>
              {premiumCollections.length > 0 ? (
                <Link href="/drinks/collections/explore">
                  <Button size="sm">Browse premium collections</Button>
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
          <h2 className="text-xl font-semibold">Collections by this creator</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{creatorCollections.length} items</span>
            {premiumCollections.length > 0 ? <span>{premiumCollections.length} premium</span>  : null}
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
            {premiumCollections.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Premium collections</h3>
                  <span className="text-xs text-muted-foreground">Support this creator</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {premiumCollections.map((collection) => (
                    <Card key={collection.id}>
                      <CardContent className="p-4 space-y-2">
                        <Link href={`/drinks/collections/${encodeURIComponent(collection.id)}`} className="font-medium underline underline-offset-2">
                          {collection.name}
                        </Link>
                        {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{number(collection.itemsCount)} drinks</Badge>
                          <Badge>Premium · ${(collection.priceCents / 100).toFixed(2)}</Badge>
                          {collection.ownedByViewer ? <Badge variant="secondary">Owned</Badge> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link href="/drinks/collections/explore" className="text-xs underline underline-offset-2">Browse premium collections</Link>
                          <Link href={`/drinks/creator/${encodeURIComponent(data.userId)}`} className="text-xs underline underline-offset-2">Support this creator</Link>
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
