import * as React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";

interface CreatorDrinkMetricsItem {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  createdAt: string;
  remixedFromSlug: string | null;
  views7d: number;
  views24h: number;
  remixesCount: number;
  groceryAdds: number;
  score: number;
}

interface CreatorDrinkSummary {
  creatorRank: number | null;
  creatorScore: number;
  totalCreated: number;
  totalRemixesCreated: number;
  totalViews7d: number;
  totalRemixesReceived: number;
  totalGroceryAdds: number;
  topPerformingDrink: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    score: number;
  } | null;
  mostRemixedDrink: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    remixesCount: number;
  } | null;
  followerCount?: number;
  isFollowing?: boolean;
}

interface CreatorDrinkMetricsResponse {
  ok: boolean;
  userId: string;
  summary: CreatorDrinkSummary;
  items: CreatorDrinkMetricsItem[];
}

type CreatorActivityType = "view" | "remix" | "grocery_add" | "follow";

interface CreatorActivityItem {
  type: CreatorActivityType;
  createdAt: string;
  actorUserId: string | null;
  actorUsername: string | null;
  targetDrinkSlug: string | null;
  targetDrinkName: string | null;
  route: string | null;
  message: string;
  count?: number;
  uniqueActors?: number;
}

interface CreatorActivityResponse {
  ok: boolean;
  userId: string;
  generatedAt: string;
  items: CreatorActivityItem[];
  summary: {
    totalItems: number;
    typeCounts: Record<CreatorActivityType, number>;
    windowDays: number;
    summarized: string[];
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function metricNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function activityBadgeLabel(type: CreatorActivityType): string {
  switch (type) {
    case "remix":
      return "Remix";
    case "follow":
      return "Follower";
    case "grocery_add":
      return "Grocery Add";
    case "view":
    default:
      return "View";
  }
}

export default function CreatorDashboardPage() {
  const { user, loading: userLoading } = useUser();

  const query = useQuery<CreatorDrinkMetricsResponse>({
    queryKey: ["/api/drinks/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator/${encodeURIComponent(user?.id ?? "")}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to load creator dashboard");
      }

      return response.json();
    },
    enabled: Boolean(user?.id),
  });

  const activityQuery = useQuery<CreatorActivityResponse>({
    queryKey: ["/api/drinks/creator/activity", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator/${encodeURIComponent(user?.id ?? "")}/activity`, {
        credentials: "include",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to load creator activity");
      }

      return response.json();
    },
    enabled: Boolean(user?.id),
  });

  if (userLoading) {
    return <div className="container mx-auto p-6">Loading dashboard...</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6 space-y-3">
        <h1 className="text-2xl font-bold">Drink Creator Dashboard</h1>
        <p className="text-muted-foreground">Please sign in to view your creator metrics.</p>
        <DrinksPlatformNav current="dashboard" />
      </div>
    );
  }

  if (query.isLoading) {
    return <div className="container mx-auto p-6">Loading creator metrics...</div>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="container mx-auto p-6 space-y-3">
        <h1 className="text-2xl font-bold">Drink Creator Dashboard</h1>
        <p className="text-destructive">Unable to load your dashboard right now.</p>
        <DrinksPlatformNav current="dashboard" />
      </div>
    );
  }

  const { summary, items } = query.data;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="drinks-creator-dashboard">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Drink Creator Dashboard</h1>
        <p className="text-muted-foreground">Track how your submitted drinks and remixes are performing.</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{metricNumber(summary.followerCount ?? 0)} followers</span>
          <Badge variant="secondary">Your creator profile</Badge>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/drinks">
            <Button variant="outline" size="sm">Back to Drinks Hub</Button>
          </Link>
          <Link href="/drinks/submit">
            <Button size="sm">Submit a Drink Recipe</Button>
          </Link>
        </div>
      </div>

      <DrinksPlatformNav current="dashboard" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Creator Rank</CardDescription>
            <CardTitle>{summary.creatorRank ? `#${metricNumber(summary.creatorRank)}` : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Created</CardDescription>
            <CardTitle>{metricNumber(summary.totalCreated)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remixes Created</CardDescription>
            <CardTitle>{metricNumber(summary.totalRemixesCreated)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Views (7d)</CardDescription>
            <CardTitle>{metricNumber(summary.totalViews7d)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remixes Received</CardDescription>
            <CardTitle>{metricNumber(summary.totalRemixesReceived)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Grocery Adds</CardDescription>
            <CardTitle>{metricNumber(summary.totalGroceryAdds)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Drink</CardTitle>
          <CardDescription>
            {summary.topPerformingDrink
              ? `${summary.topPerformingDrink.name} • Score ${metricNumber(summary.topPerformingDrink.score)} • Creator Score ${metricNumber(Math.round(summary.creatorScore))}`
              : "No drinks with performance data yet."}
          </CardDescription>
        </CardHeader>
        {summary.topPerformingDrink ? (
          <CardContent>
            <Link href={`/drinks/recipe/${encodeURIComponent(summary.topPerformingDrink.slug)}`} className="underline underline-offset-2 text-sm">
              View {summary.topPerformingDrink.name}
            </Link>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Most Remixed Drink</CardTitle>
          <CardDescription>
            {summary.mostRemixedDrink
              ? `${summary.mostRemixedDrink.name} • ${metricNumber(summary.mostRemixedDrink.remixesCount)} remixes received`
              : "No remixes received yet."}
          </CardDescription>
        </CardHeader>
        {summary.mostRemixedDrink ? (
          <CardContent>
            <Link href={`/drinks/recipe/${encodeURIComponent(summary.mostRemixedDrink.slug)}`} className="underline underline-offset-2 text-sm">
              Open remix leader
            </Link>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Drinks</CardTitle>
          <CardDescription>
            Each row shows performance over the last 7 days, plus remix lineage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              You have not submitted any drinks yet. <Link href="/drinks/submit" className="underline">Submit your first drink</Link>.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drink</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Views 24h</TableHead>
                  <TableHead className="text-right">Views 7d</TableHead>
                  <TableHead className="text-right">Remixes</TableHead>
                  <TableHead className="text-right">Grocery Adds</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link href={`/drinks/recipe/${encodeURIComponent(item.slug)}`} className="font-medium underline underline-offset-2">
                          {item.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{item.slug}</Badge>
                          {item.remixedFromSlug ? (
                            <Badge variant="outline">
                              Remix of {" "}
                              <Link
                                href={`/drinks/recipe/${encodeURIComponent(item.remixedFromSlug)}`}
                                className="underline underline-offset-2"
                              >
                                {item.remixedFromSlug}
                              </Link>
                            </Badge>
                          ) : null}
                          {item.remixesCount > 0 ? (
                            <Badge variant="outline">{metricNumber(item.remixesCount)} remixes received</Badge>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                    <TableCell className="text-right">{metricNumber(item.views24h)}</TableCell>
                    <TableCell className="text-right">{metricNumber(item.views7d)}</TableCell>
                    <TableCell className="text-right">{metricNumber(item.remixesCount)}</TableCell>
                    <TableCell className="text-right">{metricNumber(item.groceryAdds)}</TableCell>
                    <TableCell className="text-right font-medium">{metricNumber(item.score)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Notifications from the last {metricNumber(activityQuery.data?.summary.windowDays ?? 30)} days across views, remixes, grocery adds, and follows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading activity…</p>
          ) : null}

          {activityQuery.isError ? (
            <p className="text-sm text-destructive">Unable to load activity right now.</p>
          ) : null}

          {activityQuery.data ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Remixes {metricNumber(activityQuery.data.summary.typeCounts.remix ?? 0)}</Badge>
                <Badge variant="outline">Follows {metricNumber(activityQuery.data.summary.typeCounts.follow ?? 0)}</Badge>
                <Badge variant="outline">Views {metricNumber(activityQuery.data.summary.typeCounts.view ?? 0)}</Badge>
                <Badge variant="outline">Grocery Adds {metricNumber(activityQuery.data.summary.typeCounts.grocery_add ?? 0)}</Badge>
              </div>

              {activityQuery.data.items.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No activity yet. Share your drink pages and publish remixes to start receiving notifications.
                </div>
              ) : (
                <div className="space-y-3">
                  {activityQuery.data.items.map((item, index) => (
                    <div
                      key={`${item.type}-${item.createdAt}-${index}`}
                      className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={item.type === "remix" || item.type === "follow" ? "default" : "secondary"}>
                            {activityBadgeLabel(item.type)}
                          </Badge>
                          {item.count && item.count > 1 ? (
                            <span className="text-xs text-muted-foreground">{metricNumber(item.count)} events</span>
                          ) : null}
                        </div>
                        <p className="text-sm">{item.message}</p>
                        {item.route ? (
                          <Link href={item.route} className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground">
                            Open related page
                          </Link>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
