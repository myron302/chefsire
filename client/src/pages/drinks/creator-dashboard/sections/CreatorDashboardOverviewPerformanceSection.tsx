import { type UseQueryResult } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  type CreatorActivityResponse,
  type CreatorDrinkMetricsItem,
  type CreatorDrinkSummary,
} from "@/pages/drinks/creator-dashboard/types";
import { activityBadgeLabel, formatDate, formatDateTime, metricNumber, readErrorMessage } from "@/pages/drinks/creator-dashboard/utils";

interface CreatorDashboardOverviewPerformanceSectionProps {
  safeSummary: CreatorDrinkSummary;
  safeItems: CreatorDrinkMetricsItem[];
  activityQuery: UseQueryResult<CreatorActivityResponse, Error>;
}

export default function CreatorDashboardOverviewPerformanceSection({
  safeSummary,
  safeItems,
  activityQuery,
}: CreatorDashboardOverviewPerformanceSectionProps) {
  return (
    <>
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
            <Link href={`/drinks/recipe/${encodeURIComponent(safeSummary.topPerformingDrink.slug)}`} className="text-sm underline underline-offset-2">
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
            <Link href={`/drinks/recipe/${encodeURIComponent(safeSummary.mostRemixedDrink.slug)}`} className="text-sm underline underline-offset-2">
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
                <p className="break-all text-xs text-muted-foreground">{readErrorMessage(activityQuery.error, "Unknown activity error")}</p>
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
                      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
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
                          <Link href={item.route} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
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
    </>
  );
}
