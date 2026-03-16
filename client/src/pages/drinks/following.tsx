import * as React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";

interface FollowingFeedItem {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  createdAt: string;
  userId: string;
  creatorUsername: string;
  creatorAvatar: string | null;
  remixedFromSlug: string | null;
  views7d: number;
  remixesCount: number;
  route: string;
}

interface FollowingFeedResponse {
  ok: boolean;
  followingCount: number;
  items: FollowingFeedItem[];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function avatarFallback(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "U";
}

export default function FollowingDrinksFeedPage() {
  const { user, loading: userLoading } = useUser();

  const query = useQuery<FollowingFeedResponse>({
    queryKey: ["/api/drinks/following-feed"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/following-feed", { credentials: "include" });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to fetch following drinks");
      }
      return response.json();
    },
    enabled: Boolean(user?.id),
  });

  if (userLoading) {
    return <div className="container mx-auto p-6">Loading feed...</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6 space-y-3">
        <h1 className="text-3xl font-bold">Following Feed</h1>
        <p className="text-muted-foreground">Sign in to see drinks from creators you follow.</p>
        <DrinksPlatformNav current="following" />
        <Link href="/drinks">
          <Button variant="outline" size="sm">Back to Drinks Hub</Button>
        </Link>
      </div>
    );
  }

  if (query.isLoading) {
    return <div className="container mx-auto p-6">Loading drinks from followed creators...</div>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="container mx-auto p-6 space-y-3">
        <h1 className="text-3xl font-bold">Following Feed</h1>
        <p className="text-destructive">Unable to load your following feed right now.</p>
        <DrinksPlatformNav current="following" />
      </div>
    );
  }

  const { followingCount, items } = query.data;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="drinks-following-feed">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Following Feed</h1>
        <p className="text-muted-foreground">Latest drinks and remixes from creators you follow.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/drinks">
            <Button variant="outline" size="sm">Back to Drinks Hub</Button>
          </Link>
          <Link href="/drinks/submit">
            <Button size="sm">Submit a Drink Recipe</Button>
          </Link>
        </div>
      </div>

      <DrinksPlatformNav current="following" />

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No drinks in your Following feed yet</CardTitle>
            <CardDescription>
              {followingCount === 0
                ? "You are not following any creators yet, so there are no updates to show."
                : "You are following creators, but none of them have posted drinks yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {followingCount === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Discover creators from the Drinks Hub leaderboard, then follow them to populate this feed.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/drinks">
                    <Button size="sm">Find Top Creators on Drinks Hub</Button>
                  </Link>
                  <Link href="/drinks/submit">
                    <Button variant="outline" size="sm">Submit a Drink Recipe</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Check back soon for new uploads, or head back to the Drinks Hub to discover more active creators.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/drinks">
                    <Button size="sm">Back to Drinks Hub</Button>
                  </Link>
                  <Link href="/drinks/creator-dashboard">
                    <Button variant="outline" size="sm">Open Creator Dashboard</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <Link href={item.route}>
                    <img
                      src={item.image ?? "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=320&h=220&fit=crop"}
                      alt={item.name}
                      className="h-28 w-full rounded-md object-cover sm:w-44"
                    />
                  </Link>

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={item.creatorAvatar ?? undefined} alt={item.creatorUsername} />
                        <AvatarFallback>{avatarFallback(item.creatorUsername)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">
                        By <Link href={`/drinks/creator/${encodeURIComponent(item.userId)}`} className="font-medium text-foreground underline underline-offset-2 hover:text-primary">@{item.creatorUsername}</Link>
                      </span>
                      <Badge variant="outline">{formatDate(item.createdAt)}</Badge>
                    </div>

                    <Link href={item.route} className="block text-lg font-semibold underline-offset-4 hover:underline">
                      {item.name}
                    </Link>

                    {item.remixedFromSlug ? (
                      <p className="text-sm text-muted-foreground">
                        Remix of{" "}
                        <Link
                          href={`/drinks/recipe/${encodeURIComponent(item.remixedFromSlug)}`}
                          className="underline underline-offset-2"
                        >
                          {item.remixedFromSlug}
                        </Link>
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">{item.views7d} views (7d)</Badge>
                      <Badge variant="secondary">🔥 {item.remixesCount} remixes</Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link href={item.route}>
                        <Button size="sm">Open canonical drink page</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
