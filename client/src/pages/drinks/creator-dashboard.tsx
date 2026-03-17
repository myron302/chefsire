import * as React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import RemixStreakBadge from "@/components/drinks/RemixStreakBadge";

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

interface CreatorBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  isPublic: boolean;
  isEarned: boolean;
  earnedAt: string | null;
  progress: { current: number; target: number; label: string } | null;
}

interface CreatorBadgesResponse {
  ok: boolean;
  userId: string;
  visibility: "private" | "public";
  badges: CreatorBadge[];
  earnedCount: number;
  totalCount: number;
  nextMilestones: Array<{
    id: string;
    title: string;
    icon: string;
    description: string;
    progress: { current: number; target: number; label: string } | null;
  }>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function metricNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(Number(value ?? 0));
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

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export default function CreatorDashboardPage() {
  const { user, loading: userLoading } = useUser();

  const query = useQuery<CreatorDrinkMetricsResponse>({
    queryKey: ["/api/drinks/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator/${encodeURIComponent(user?.id ?? "")}`, {
        credentials: "include",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load creator dashboard (${response.status})`;
        throw new Error(String(message));
      }

      return payload as CreatorDrinkMetricsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const activityQuery = useQuery<CreatorActivityResponse>({
    queryKey: ["/api/drinks/creator/activity", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator/${encodeURIComponent(user?.id ?? "")}/activity`, {
        credentials: "include",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load creator activity (${response.status})`;
        throw new Error(String(message));
      }

      return payload as CreatorActivityResponse;
    },
    enabled: Boolean(user?.id),
  });

  const badgesQuery = useQuery<CreatorBadgesResponse>({
    queryKey: ["/api/drinks/creator/badges", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator/${encodeURIComponent(user?.id ?? "")}/badges`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load creator badges (${response.status})`;
        throw new Error(String(message));
      }
      return payload as CreatorBadgesResponse;
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

  const queryErrorMessage = query.isError ? readErrorMessage(query.error, "Unknown creator dashboard error") : "";

  if (query.isError || !query.data) {
    return (
      <div className="container mx-auto p-6 space-y-3">
        <h1 className="text-2xl font-bold">Drink Creator Dashboard</h1>
        <p className="text-destructive">Unable to load your dashboard right now.</p>
        {import.meta.env.DEV ? <p className="text-xs text-muted-foreground break-all">{queryErrorMessage}</p> : null}
        <DrinksPlatformNav current="dashboard" />
      </div>
    );
  }

  const { summary, items } = query.data;

  const safeSummary: CreatorDrinkSummary = {
    creatorRank: summary?.creatorRank ?? null,
    creatorScore: Number(summary?.creatorScore ?? 0),
    totalCreated: Number(summary?.totalCreated ?? 0),
    totalRemixesCreated: Number(summary?.totalRemixesCreated ?? 0),
    totalViews7d: Number(summary?.totalViews7d ?? 0),
    totalRemixesReceived: Number(summary?.totalRemixesReceived ?? 0),
    totalGroceryAdds: Number(summary?.totalGroceryAdds ?? 0),
    topPerformingDrink: summary?.topPerformingDrink ?? null,
    mostRemixedDrink: summary?.mostRemixedDrink ?? null,
    followerCount: Number(summary?.followerCount ?? 0),
    isFollowing: Boolean(summary?.isFollowing ?? false),
  };
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="drinks-creator-dashboard">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Drink Creator Dashboard</h1>
        <p className="text-muted-foreground">Track how your submitted drinks and remixes are performing.</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{metricNumber(safeSummary.followerCount ?? 0)} followers</span>
          <Badge variant="secondary">Your creator profile</Badge>
        </div>
        <div className="pt-1">
          <RemixStreakBadge />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/drinks">
            <Button variant="outline" size="sm">Back to Drinks Hub</Button>
          </Link>
          <Link href="/drinks/submit">
            <Button size="sm">Submit a Drink Recipe</Button>
          </Link>
          <Link href="/drinks/notifications">
            <Button variant="outline" size="sm">Notifications Center</Button>
          </Link>
        </div>
      </div>

      <DrinksPlatformNav current="dashboard" />

      <Card>
        <CardHeader>
          <CardTitle>Creator Milestones & Badges</CardTitle>
          <CardDescription>
            {badgesQuery.data
              ? `${metricNumber(badgesQuery.data.earnedCount)} earned badges`
              : "Progress markers for your creator journey."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {badgesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading badges…</p> : null}
          {badgesQuery.isError ? <p className="text-sm text-destructive">Unable to load badges right now.</p> : null}
          {badgesQuery.data ? (
            <>
              {badgesQuery.data.badges.filter((badge) => badge.isEarned).length === 0 ? (
                <p className="text-sm text-muted-foreground">No badges earned yet. Publish and remix drinks to unlock your first milestone.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {badgesQuery.data.badges.filter((badge) => badge.isEarned).map((badge) => (
                    <Badge key={badge.id} variant="secondary" className="py-1">
                      <span className="mr-1" aria-hidden>{badge.icon}</span>{badge.title}
                    </Badge>
                  ))}
                </div>
              )}

              {badgesQuery.data.nextMilestones.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next milestones</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {badgesQuery.data.nextMilestones.map((badge) => (
                      <div key={badge.id} className="rounded-md border p-2 text-sm">
                        <div className="font-medium"><span className="mr-1">{badge.icon}</span>{badge.title}</div>
                        {badge.progress ? <div className="text-xs text-muted-foreground mt-1">{metricNumber(badge.progress.current)} / {metricNumber(badge.progress.target)} {badge.progress.label.toLowerCase()}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creator Momentum</CardTitle>
          <CardDescription>Lightweight reward signals based on views and remixes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(safeSummary.totalRemixesReceived > 0 || safeSummary.totalViews7d >= 100) ? (
            <>
              <p className="text-sm font-medium">🔥 Your drink is gaining traction</p>
              {safeSummary.totalRemixesReceived > 0 ? (
                <p className="text-sm text-muted-foreground">🎉 {metricNumber(safeSummary.totalRemixesReceived)} people remixed your drink</p>
              ) : null}
              {safeSummary.totalViews7d >= 100 ? (
                <p className="text-sm text-muted-foreground">{metricNumber(safeSummary.totalViews7d)} views in the last 7 days</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Publish and share your drinks to unlock traction signals.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Creator Rank</CardDescription>
            <CardTitle>{safeSummary.creatorRank ? `#${metricNumber(safeSummary.creatorRank)}` : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Created</CardDescription>
            <CardTitle>{metricNumber(safeSummary.totalCreated)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remixes Created</CardDescription>
            <CardTitle>{metricNumber(safeSummary.totalRemixesCreated)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Views (7d)</CardDescription>
            <CardTitle>{metricNumber(safeSummary.totalViews7d)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remixes Received</CardDescription>
            <CardTitle>{metricNumber(safeSummary.totalRemixesReceived)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Grocery Adds</CardDescription>
            <CardTitle>{metricNumber(safeSummary.totalGroceryAdds)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Drink</CardTitle>
          <CardDescription>
            {safeSummary.topPerformingDrink
              ? `${safeSummary.topPerformingDrink.name} • Score ${metricNumber(safeSummary.topPerformingDrink.score)} • Creator Score ${metricNumber(Math.round(safeSummary.creatorScore))}`
              : "No drinks with performance data yet."}
          </CardDescription>
        </CardHeader>
        {safeSummary.topPerformingDrink ? (
          <CardContent>
            <Link href={`/drinks/recipe/${encodeURIComponent(safeSummary.topPerformingDrink.slug)}`} className="underline underline-offset-2 text-sm">
              View {safeSummary.topPerformingDrink.name}
            </Link>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Most Remixed Drink</CardTitle>
          <CardDescription>
            {safeSummary.mostRemixedDrink
              ? `${safeSummary.mostRemixedDrink.name} • ${metricNumber(safeSummary.mostRemixedDrink.remixesCount)} remixes received`
              : "No remixes received yet."}
          </CardDescription>
        </CardHeader>
        {safeSummary.mostRemixedDrink ? (
          <CardContent>
            <Link href={`/drinks/recipe/${encodeURIComponent(safeSummary.mostRemixedDrink.slug)}`} className="underline underline-offset-2 text-sm">
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
          {safeItems.length === 0 ? (
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
                {safeItems.map((item) => (
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
            <div className="space-y-1">
              <p className="text-sm text-destructive">Unable to load activity right now.</p>
              {import.meta.env.DEV ? (
                <p className="text-xs text-muted-foreground break-all">{readErrorMessage(activityQuery.error, "Unknown activity error")}</p>
              ) : null}
            </div>
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
