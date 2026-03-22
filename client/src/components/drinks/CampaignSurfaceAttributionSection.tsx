import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Compass, ExternalLink, MousePointerClick, Route, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/contexts/UserContext";

type CampaignSurfaceKey = "creator_public_page" | "discover_pinned_campaigns" | "following_feed" | "alerts" | "campaign_detail_page" | "direct_or_unknown";

type CampaignSurfaceMetrics = {
  surface: CampaignSurfaceKey;
  views: number;
  clicks: number;
  clickThroughRate: number | null;
  clickThroughRateLabel: string;
  directFollows: number;
  directRsvps: number;
  metricLabels: {
    views: "direct";
    clicks: "direct";
    follows: "direct";
    rsvps: "direct";
  };
};

type CampaignSurfaceAttributionResponse = {
  ok: boolean;
  userId: string;
  generatedAt: string;
  summary: {
    totalCampaigns: number;
    trackedCampaigns: number;
    totalViews: number;
    totalClicks: number;
    totalDirectFollows: number;
    totalDirectRsvps: number;
  };
  supportedSurfaces: Array<{
    key: CampaignSurfaceKey;
    observationType: string;
  }>;
  overallSurfaces: Array<CampaignSurfaceMetrics & {
    followRateLabel: string;
    rsvpRateLabel: string;
  }>;
  topSurfaceInsights: Array<{
    campaignId: string | null;
    campaignName: string | null;
    surface: CampaignSurfaceKey;
    headline: string;
    detail: string;
    metric: "views" | "clicks" | "follows" | "rsvps";
    value: number;
  }>;
  items: Array<{
    campaignId: string;
    campaignName: string;
    slug: string;
    route: string;
    visibility: "public" | "followers" | "members";
    state: "upcoming" | "active" | "past";
    totals: {
      views: number;
      clicks: number;
      directFollows: number;
      directRsvps: number;
    };
    topSurface: {
      surface: CampaignSurfaceKey;
      headline: string;
    } | null;
    surfaces: CampaignSurfaceMetrics[];
  }>;
  attributionNotes: string[];
};

function surfaceLabel(surface: CampaignSurfaceKey) {
  switch (surface) {
    case "creator_public_page":
      return "Creator public page";
    case "discover_pinned_campaigns":
      return "Discover pinned campaigns";
    case "following_feed":
      return "Following feed";
    case "alerts":
      return "Alerts";
    case "campaign_detail_page":
      return "Campaign detail page";
    case "direct_or_unknown":
    default:
      return "Direct / unknown";
  }
}

export default function CampaignSurfaceAttributionSection() {
  const { user } = useUser();
  const query = useQuery<CampaignSurfaceAttributionResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-surface-attribution", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-surface-attribution", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign surface attribution (${response.status})`);
      return payload as CampaignSurfaceAttributionResponse;
    },
    enabled: Boolean(user?.id),
  });

  const summary = query.data?.summary;
  const overallSurfaces = query.data?.overallSurfaces ?? [];
  const items = query.data?.items ?? [];
  const topInsights = query.data?.topSurfaceInsights ?? [];

  return (
    <Card id="campaign-surface-attribution">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-blue-600" />
          Campaign Surface Attribution / Top Entry Points
        </CardTitle>
        <CardDescription>
          Creator-private entry-point attribution only: which real drinks-platform surfaces are actually opening campaigns, then leading to direct follows or RSVPs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns</p><p className="text-xl font-semibold">{summary?.totalCampaigns ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Tracked</p><p className="text-xl font-semibold">{summary?.trackedCampaigns ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Direct views</p><p className="text-xl font-semibold">{summary?.totalViews ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Direct clicks</p><p className="text-xl font-semibold">{summary?.totalClicks ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Direct follows</p><p className="text-xl font-semibold">{summary?.totalDirectFollows ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Direct RSVPs</p><p className="text-xl font-semibold">{summary?.totalDirectRsvps ?? 0}</p></div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading campaign surface attribution…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign surface attribution right now."}</p> : null}

        {topInsights.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {topInsights.slice(0, 3).map((insight) => (
              <div key={`${insight.campaignId ?? "all"}:${insight.surface}:${insight.metric}`} className="rounded-md border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{surfaceLabel(insight.surface)}</Badge>
                  <Badge variant="outline">{insight.metric}</Badge>
                </div>
                <p className="mt-3 font-medium">{insight.headline}</p>
                <p className="mt-1 text-sm text-muted-foreground">{insight.detail}</p>
                {insight.campaignName ? <p className="mt-3 text-xs text-muted-foreground">Campaign: {insight.campaignName}</p> : null}
              </div>
            ))}
          </div>
        ) : null}

        {overallSurfaces.length ? (
          <div className="rounded-md border">
            <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Top observed surfaces overall
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {overallSurfaces.slice(0, 6).map((surface) => (
                <div key={surface.surface} className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{surfaceLabel(surface.surface)}</p>
                    <Badge variant="outline">direct</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">Views</p><p className="font-semibold">{surface.views}</p></div>
                    <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">Clicks</p><p className="font-semibold">{surface.clicks}</p></div>
                    <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">CTR</p><p className="font-semibold">{surface.clickThroughRateLabel}</p></div>
                    <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">Follows</p><p className="font-semibold">{surface.directFollows}</p></div>
                    <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">RSVPs</p><p className="font-semibold">{surface.directRsvps}</p></div>
                    <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">Follow / RSVP rate</p><p className="font-semibold">{surface.followRateLabel} / {surface.rsvpRateLabel}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {items.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Top entry point</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Direct follows</TableHead>
                  <TableHead>Direct RSVPs</TableHead>
                  <TableHead>Surface mix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.campaignId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{item.campaignName}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{item.state}</span>
                          <span>{item.visibility}</span>
                        </div>
                        <Link href={item.route} className="inline-flex items-center gap-1 text-xs underline underline-offset-2">
                          Open campaign <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.topSurface ? (
                        <div className="space-y-1 text-sm">
                          <Badge variant="secondary">{surfaceLabel(item.topSurface.surface)}</Badge>
                          <p className="text-muted-foreground">{item.topSurface.headline}</p>
                        </div>
                      ) : <span className="text-sm text-muted-foreground">No surface signal yet</span>}
                    </TableCell>
                    <TableCell>{item.totals.views}</TableCell>
                    <TableCell>{item.totals.clicks}</TableCell>
                    <TableCell>{item.totals.directFollows}</TableCell>
                    <TableCell>{item.totals.directRsvps}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {item.surfaces.slice(0, 3).map((surface) => (
                          <Badge key={`${item.campaignId}:${surface.surface}`} variant="outline" className="gap-1">
                            <Route className="h-3 w-3" />
                            {surfaceLabel(surface.surface)} · {surface.clicks} clicks / {surface.directFollows + surface.directRsvps} conv.
                          </Badge>
                        ))}
                        {item.surfaces.length === 0 ? <span className="text-xs text-muted-foreground">No recorded surfaces yet</span> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {query.data?.supportedSurfaces?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <MousePointerClick className="h-4 w-4" />
              Supported surfaces observed honestly in v1
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {query.data.supportedSurfaces.map((surface) => (
                <div key={surface.key} className="rounded-md border bg-background p-3">
                  <p className="font-medium">{surfaceLabel(surface.key)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{surface.observationType}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Attribution notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        {!query.isLoading && !query.isError && !items.length ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No campaign surface attribution yet. Once campaign cards, alerts, or direct campaign landings are observed, this section will show the top entry points.
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href="/drinks/creator-dashboard#campaigns"><Button variant="outline">Manage campaigns</Button></Link>
          <Link href="/drinks/discover"><Button variant="ghost">Open discover</Button></Link>
        </div>
      </CardContent>
    </Card>
  );
}
