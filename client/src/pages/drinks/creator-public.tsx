import * as React from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import CreatorFollowButton from "@/components/drinks/CreatorFollowButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  recentItems: PublicCreatorDrinkItem[];
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

  if (!matched) return null;

  if (query.isLoading) {
    return <div className="container mx-auto p-6">Loading creator profile...</div>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="container mx-auto p-6 space-y-3">
        <h1 className="text-3xl font-bold">Creator Profile</h1>
        <p className="text-destructive">Unable to load this creator right now.</p>
        <Link href="/drinks">
          <Button variant="outline" size="sm">Back to Drinks Hub</Button>
        </Link>
      </div>
    );
  }

  const data = query.data;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="drinks-public-creator-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Creator Profile</h1>
        <Link href="/drinks">
          <Button variant="outline" size="sm">Back to Drinks Hub</Button>
        </Link>
      </div>

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
              </div>
            </div>
            {user?.id !== data.userId ? <CreatorFollowButton creatorId={data.userId} /> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{number(data.totalViews7d)} views (7d)</Badge>
            <Badge variant="secondary">{number(data.totalRemixesReceived)} remixes received</Badge>
            <Badge variant="secondary">{number(data.totalGroceryAdds)} grocery adds</Badge>
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
                      <Badge variant="outline">{number(item.remixesCount)} remixes</Badge>
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
