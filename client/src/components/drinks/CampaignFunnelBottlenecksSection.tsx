import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Gauge, Route, Waves } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type FunnelStepKey = "views" | "clicks" | "follows" | "rsvps" | "purchases" | "memberships";
type FunnelSeverity = "insufficient_signal" | "healthy" | "watch" | "high" | "critical" | "alternate_path";

type FunnelStep = {
  key: FunnelStepKey;
  label: string;
  count: number;
  description: string;
  note: string | null;
};

type FunnelTransition = {
  fromStep: FunnelStepKey;
  toStep: FunnelStepKey;
  fromLabel: string;
  toLabel: string;
  fromCount: number;
  toCount: number;
  retainedCount: number;
  leakedCount: number;
  expansionCount: number;
  retentionRate: number | null;
  leakageRate: number | null;
  severity: FunnelSeverity;
  headline: string;
  reason: string;
  suggestedFocus: string;
};

type FunnelItem = {
  campaignId: string;
  slug: string;
  name: string;
  route: string;
  visibility: "public" | "followers" | "members";
  state: "upcoming" | "active" | "past";
  linkedDropsCount: number;
  linkedCollectionsCount: number;
  memberFocused: boolean;
  steps: FunnelStep[];
  transitions: FunnelTransition[];
  topBottlenecks: FunnelTransition[];
  strongestStep: FunnelStep | null;
  deepestNonZeroStep: FunnelStepKey | null;
  overallConversionRateFromViews: number | null;
  overallLeakageFromViews: number | null;
  notes: string[];
};

type FunnelResponse = {
  ok: boolean;
  userId: string;
  campaignId: string | null;
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    campaignsWithMeaningfulViewSignal: number;
    campaignsWithBottlenecks: number;
    criticalBottlenecks: number;
    highBottlenecks: number;
    watchBottlenecks: number;
    averageViewToClickRate: number | null;
    averageClickToFollowRate: number | null;
    averageFollowToRsvpRate: number | null;
    averageRsvpToPurchaseRate: number | null;
    averagePurchaseToMembershipRate: number | null;
    mostCommonWeakTransition: {
      fromStep: FunnelStepKey;
      toStep: FunnelStepKey;
      label: string;
      affectedCampaigns: number;
    } | null;
  };
  items: FunnelItem[];
  attributionNotes: string[];
  generatedAt: string;
};

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function severityVariant(severity: FunnelSeverity): "default" | "secondary" | "outline" | "destructive" {
  switch (severity) {
    case "critical":
      return "destructive";
    case "high":
      return "default";
    case "watch":
      return "secondary";
    default:
      return "outline";
  }
}

function severityLabel(severity: FunnelSeverity) {
  switch (severity) {
    case "critical":
      return "Critical leak";
    case "high":
      return "High leak";
    case "watch":
      return "Watch";
    case "alternate_path":
      return "Alternate path";
    case "insufficient_signal":
      return "Light signal";
    case "healthy":
    default:
      return "Healthy";
  }
}

function stepBadgeVariant(step: FunnelStepKey): "default" | "secondary" | "outline" {
  switch (step) {
    case "views":
    case "clicks":
      return "outline";
    case "purchases":
    case "memberships":
      return "default";
    default:
      return "secondary";
  }
}

export default function CampaignFunnelBottlenecksSection() {
  const { user } = useUser();

  const query = useQuery<FunnelResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-funnel-bottlenecks", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-funnel-bottlenecks", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign funnel bottlenecks (${response.status})`);
      }
      return payload as FunnelResponse;
    },
    enabled: Boolean(user?.id),
  });

  const campaigns = React.useMemo(
    () => [...(query.data?.items ?? [])].sort((a, b) => {
      const aSeverity = a.topBottlenecks[0]?.severity ?? "healthy";
      const bSeverity = b.topBottlenecks[0]?.severity ?? "healthy";
      const rank = (value: FunnelSeverity) => {
        switch (value) {
          case "critical":
            return 5;
          case "high":
            return 4;
          case "watch":
            return 3;
          case "healthy":
            return 2;
          default:
            return 1;
        }
      };
      return rank(bSeverity) - rank(aSeverity)
        || (b.topBottlenecks[0]?.leakedCount ?? 0) - (a.topBottlenecks[0]?.leakedCount ?? 0)
        || a.name.localeCompare(b.name);
    }),
    [query.data?.items],
  );

  return (
    <Card id="campaign-funnel-bottlenecks">
      <CardHeader>
        <CardTitle>Campaign Funnel Bottlenecks / Leakage Detection</CardTitle>
        <CardDescription>
          Creator-private funnel diagnostics across views, clicks, follows, RSVPs, purchases, and memberships. This stays lightweight and uses existing drinks-platform signals only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading funnel bottlenecks…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign funnel bottlenecks right now."}</p> : null}

        {query.data ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Campaigns reviewed</p>
              <p className="text-2xl font-semibold">{query.data.summary.totalCampaigns}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Campaigns with bottlenecks</p>
              <p className="text-2xl font-semibold">{query.data.summary.campaignsWithBottlenecks}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Critical / high leaks</p>
              <p className="text-2xl font-semibold">{query.data.summary.criticalBottlenecks + query.data.summary.highBottlenecks}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Most common weak handoff</p>
              <p className="text-sm font-semibold">{query.data.summary.mostCommonWeakTransition?.label ?? "No repeated leak yet"}</p>
              <p className="text-xs text-muted-foreground">
                {query.data.summary.mostCommonWeakTransition
                  ? `${query.data.summary.mostCommonWeakTransition.affectedCampaigns} campaign${query.data.summary.mostCommonWeakTransition.affectedCampaigns === 1 ? "" : "s"}`
                  : "Needs more signal"}
              </p>
            </div>
          </div>
        ) : null}

        {query.data ? (
          <div className="grid gap-3 md:grid-cols-5">
            {[
              ["Views → clicks", query.data.summary.averageViewToClickRate],
              ["Clicks → follows", query.data.summary.averageClickToFollowRate],
              ["Follows → RSVPs", query.data.summary.averageFollowToRsvpRate],
              ["RSVPs → purchases", query.data.summary.averageRsvpToPurchaseRate],
              ["Purchases → memberships", query.data.summary.averagePurchaseToMembershipRate],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold">{formatPercent(value as number | null)}</p>
              </div>
            ))}
          </div>
        ) : null}

        {!query.isLoading && query.data && campaigns.length === 0 ? (
          <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            No campaign funnel diagnostics yet. Once campaigns start collecting linked drop views, clicks, follows, RSVPs, purchases, or memberships, leakage detection will show up here.
          </div>
        ) : null}

        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.campaignId} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{campaign.name}</h3>
                    <Badge variant="outline">{campaign.state}</Badge>
                    <Badge variant="secondary">{campaign.visibility}</Badge>
                    {campaign.memberFocused ? <Badge variant="default">Member-focused</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{campaign.linkedDropsCount} linked drop{campaign.linkedDropsCount === 1 ? "" : "s"}</span>
                    <span>{campaign.linkedCollectionsCount} linked collection{campaign.linkedCollectionsCount === 1 ? "" : "s"}</span>
                    <span>View-to-conversion: {formatPercent(campaign.overallConversionRateFromViews)}</span>
                    <span>Leakage from views: {formatPercent(campaign.overallLeakageFromViews)}</span>
                  </div>
                </div>
                <Link href={campaign.route}><Button variant="outline" size="sm">Open campaign</Button></Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {campaign.steps.map((step) => (
                  <div key={step.key} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs">
                    <Badge variant={stepBadgeVariant(step.key)}>{step.label}</Badge>
                    <span className="font-medium">{step.count}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <p className="text-sm font-medium">Top bottlenecks</p>
                  </div>

                  {campaign.topBottlenecks.length ? campaign.topBottlenecks.map((transition) => (
                    <div key={`${campaign.campaignId}-${transition.fromStep}-${transition.toStep}`} className="rounded-md bg-background p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={severityVariant(transition.severity)}>{severityLabel(transition.severity)}</Badge>
                        <span className="text-sm font-medium">{transition.fromLabel} <ArrowRight className="mx-1 inline h-3.5 w-3.5" /> {transition.toLabel}</span>
                      </div>
                      <p className="mt-2 text-sm">{transition.headline}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{transition.reason}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1"><Gauge className="h-3 w-3" /> Retention {formatPercent(transition.retentionRate)}</span>
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1"><Waves className="h-3 w-3" /> Leakage {formatPercent(transition.leakageRate)}</span>
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1"><Route className="h-3 w-3" /> Lost {transition.leakedCount}</span>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">Suggested focus: {transition.suggestedFocus}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">
                      No meaningful leakage is standing out yet. This campaign either looks healthy, too early, or is entering through multiple native paths.
                    </p>
                  )}
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <p className="text-sm font-medium">Why this campaign reads this way</p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Strongest current step: <span className="font-medium text-foreground">{campaign.strongestStep?.label ?? "No signal yet"}</span>
                      {campaign.strongestStep ? ` (${campaign.strongestStep.count})` : ""}
                    </p>
                    <p>
                      Deepest non-zero step: <span className="font-medium text-foreground">{campaign.deepestNonZeroStep ? campaign.deepestNonZeroStep.replace(/^./, (value) => value.toUpperCase()) : "None yet"}</span>
                    </p>
                  </div>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    {campaign.notes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How this stays lightweight</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
