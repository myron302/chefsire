import * as React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
}

interface CreatorDrinkMetricsResponse {
  ok: boolean;
  userId: string;
  summary: CreatorDrinkSummary;
  items: CreatorDrinkMetricsItem[];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function metricNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
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

  if (userLoading) {
    return <div className="container mx-auto p-6">Loading dashboard...</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6 space-y-3">
        <h1 className="text-2xl font-bold">Drink Creator Dashboard</h1>
        <p className="text-muted-foreground">Please sign in to view your creator metrics.</p>
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
      </div>
    );
  }

  const { summary, items } = query.data;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="drinks-creator-dashboard">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Drink Creator Dashboard</h1>
        <p className="text-muted-foreground">Track how your submitted drinks and remixes are performing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              ? `${summary.topPerformingDrink.name} • Score ${metricNumber(summary.topPerformingDrink.score)}`
              : "No drinks with performance data yet."}
          </CardDescription>
        </CardHeader>
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
    </div>
  );
}
