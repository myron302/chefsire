import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type CampaignHealthState = "thriving" | "healthy" | "watch" | "at_risk" | "completed";
type CampaignHealthMomentum = "surging" | "up" | "flat" | "down" | "quiet";

type CampaignHealthRecommendationLink = {
  recommendationType: string;
  priority: "high" | "medium" | "low";
  title: string;
  suggestedAction: string | null;
  suggestedRoute: string | null;
};

type CampaignHealthItem = {
  campaignId: string;
  slug: string;
  name: string;
  route: string;
  visibility: "public" | "followers" | "members";
  status: "upcoming" | "active" | "past";
  healthState: CampaignHealthState;
  healthScore: number;
  followerMomentum: CampaignHealthMomentum;
  rsvpMomentum: CampaignHealthMomentum;
  clickMomentum: CampaignHealthMomentum;
  purchaseMomentum: CampaignHealthMomentum;
  membershipMomentum: CampaignHealthMomentum;
  goalsOnTrack: number;
  goalsBehind: number;
  recentActivityAt: string | null;
  primaryConcern: string | null;
  primaryStrength: string | null;
  watchReasons: string[];
  strengthReasons: string[];
  linkedDropsCount: number;
  linkedPostsCount: number;
  linkedCollectionsCount: number;
  linkedPromosCount: number;
  linkedRoadmapCount: number;
  milestoneCount: number;
  completedGoalCount: number;
  recentFollowers: number;
  recentRsvps: number;
  recentClicks: number;
  recentPurchases: number;
  recentMemberships: number;
  recommendation: CampaignHealthRecommendationLink | null;
  isOnWatchlist: boolean;
};

type CampaignHealthResponse = {
  ok: boolean;
  userId: string;
  summary: {
    totalCampaigns: number;
    activeOrUpcomingCampaigns: number;
    watchlistCount: number;
    thrivingCount: number;
    healthyCount: number;
    watchCount: number;
    atRiskCount: number;
    completedCount: number;
  };
  items: CampaignHealthItem[];
  watchlist: CampaignHealthItem[];
  attributionNotes: string[];
  generatedAt: string;
};

function stateBadgeVariant(state: CampaignHealthState): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "thriving":
      return "default";
    case "healthy":
      return "secondary";
    case "watch":
      return "outline";
    case "at_risk":
      return "destructive";
    case "completed":
    default:
      return "outline";
  }
}

function stateLabel(state: CampaignHealthState) {
  switch (state) {
    case "at_risk":
      return "At risk";
    case "thriving":
      return "Thriving";
    case "healthy":
      return "Healthy";
    case "watch":
      return "Watch";
    case "completed":
    default:
      return "Completed";
  }
}

function momentumIcon(momentum: CampaignHealthMomentum) {
  switch (momentum) {
    case "surging":
    case "up":
      return <ArrowUpRight className="h-3.5 w-3.5" />;
    case "down":
      return <ArrowDownRight className="h-3.5 w-3.5" />;
    case "flat":
      return <ArrowRight className="h-3.5 w-3.5" />;
    case "quiet":
    default:
      return <Activity className="h-3.5 w-3.5" />;
  }
}

function momentumLabel(label: string, momentum: CampaignHealthMomentum) {
  const text = momentum === "surging"
    ? "surging"
    : momentum === "up"
      ? "up"
      : momentum === "down"
        ? "slowing"
        : momentum === "flat"
          ? "steady"
          : "quiet";
  return `${label} ${text}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function reasonRow(reason: string, positive = false) {
  return (
    <div key={reason} className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      {positive ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />}
      <span>{reason}</span>
    </div>
  );
}

export default function CampaignHealthSection() {
  const { user } = useUser();

  const query = useQuery<CampaignHealthResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-health", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-health", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign health (${response.status})`);
      }
      return payload as CampaignHealthResponse;
    },
    enabled: Boolean(user?.id),
  });

  const featured = (query.data?.items?.filter((item) => item.status !== "past") ?? query.data?.items ?? []).slice(0, 4);

  return (
    <Card id="campaign-health">
      <CardHeader>
        <CardTitle>Campaign Health / Watchlist</CardTitle>
        <CardDescription>
          Current-status reads for active and upcoming campaigns using the signals already tracked across follows, RSVP interest, linked traffic, approximate conversions, goals, and recent campaign activity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Active / upcoming</p>
            <p className="text-2xl font-semibold">{query.data?.summary.activeOrUpcomingCampaigns ?? 0}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Thriving</p>
            <p className="text-2xl font-semibold">{query.data?.summary.thrivingCount ?? 0}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Healthy</p>
            <p className="text-2xl font-semibold">{query.data?.summary.healthyCount ?? 0}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Watch</p>
            <p className="text-2xl font-semibold">{query.data?.summary.watchCount ?? 0}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">At risk</p>
            <p className="text-2xl font-semibold">{query.data?.summary.atRiskCount ?? 0}</p>
          </div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading campaign health…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign health right now."}</p> : null}

        {query.data?.watchlist?.length ? (
          <div className="space-y-3 rounded-lg border border-amber-300/60 bg-amber-50/40 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Campaign watchlist</p>
                <p className="text-sm text-muted-foreground">Scannable campaigns that may need attention now. Health stays separate from the recommendation module below.</p>
              </div>
              <Badge variant="outline">{query.data.watchlist.length} flagged</Badge>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {query.data.watchlist.map((item) => (
                <div key={item.campaignId} className="rounded-md border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.name}</p>
                        <Badge variant={stateBadgeVariant(item.healthState)}>{stateLabel(item.healthState)}</Badge>
                        <Badge variant="outline">{item.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">Health score {item.healthScore} · Last activity {formatDateTime(item.recentActivityAt)}</p>
                    </div>
                    <Link href={item.route}><Button size="sm" variant="outline">Open campaign</Button></Link>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(item.watchReasons.length ? item.watchReasons : item.primaryConcern ? [item.primaryConcern] : []).slice(0, 2).map((reason) => reasonRow(reason))}
                  </div>
                  {item.recommendation ? (
                    <div className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Next-step idea</p>
                      <p className="mt-1">{item.recommendation.title}</p>
                      {item.recommendation.suggestedRoute ? (
                        <div className="mt-2">
                          <Link href={item.recommendation.suggestedRoute}><Button size="sm" variant="ghost">{item.recommendation.suggestedAction ?? "Open suggestion"}</Button></Link>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {query.data?.items?.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {featured.map((item) => (
              <div key={item.campaignId} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{item.name}</h3>
                      <Badge variant={stateBadgeVariant(item.healthState)}>{stateLabel(item.healthState)}</Badge>
                      <Badge variant="outline">{item.status}</Badge>
                      <Badge variant="outline">{item.visibility}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Score {item.healthScore} · {item.linkedDropsCount} drops · {item.linkedPostsCount} posts · {item.linkedCollectionsCount} collections
                    </p>
                  </div>
                  <Link href={item.route}><Button size="sm" variant="outline">Open campaign</Button></Link>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{momentumIcon(item.followerMomentum)} {momentumLabel("Followers", item.followerMomentum)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{momentumIcon(item.rsvpMomentum)} {momentumLabel("RSVPs", item.rsvpMomentum)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{momentumIcon(item.clickMomentum)} {momentumLabel("Clicks", item.clickMomentum)}</span>
                  {(item.recentPurchases > 0 || item.recentMemberships > 0) ? (
                    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                      {item.recentPurchases} purchases · {item.recentMemberships} memberships
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md bg-muted/30 p-3 text-sm">
                    <p className="font-medium text-foreground">Strength</p>
                    <p className="mt-1 text-muted-foreground">{item.primaryStrength ?? "No standout strength yet — this campaign is still gathering signal."}</p>
                  </div>
                  <div className="rounded-md bg-muted/30 p-3 text-sm">
                    <p className="font-medium text-foreground">Concern</p>
                    <p className="mt-1 text-muted-foreground">{item.primaryConcern ?? "No major warning sign right now."}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    {(item.strengthReasons.length ? item.strengthReasons : item.primaryStrength ? [item.primaryStrength] : []).slice(0, 2).map((reason) => reasonRow(reason, true))}
                  </div>
                  <div className="space-y-2">
                    {(item.watchReasons.length ? item.watchReasons : item.primaryConcern ? [item.primaryConcern] : []).slice(0, 2).map((reason) => reasonRow(reason))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{item.recentFollowers} followers this week</span>
                  <span>·</span>
                  <span>{item.recentRsvps} RSVPs</span>
                  <span>·</span>
                  <span>{item.recentClicks} clicks</span>
                  <span>·</span>
                  <span>{item.goalsOnTrack} goals on track</span>
                  {item.goalsBehind > 0 ? (
                    <>
                      <span>·</span>
                      <span>{item.goalsBehind} behind pace</span>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!query.isLoading && !query.isError && !(query.data?.items?.length) ? (
          <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            No campaign health data yet. Once campaigns start collecting follows, linked drop activity, goals, or milestones, this health layer will appear automatically.
          </div>
        ) : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How this stays distinct</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href="/drinks/creator-dashboard#campaigns"><Button variant="outline">Manage campaigns</Button></Link>
          <Link href="/drinks/creator-dashboard#campaign-health"><Button variant="ghost">Refresh health view</Button></Link>
        </div>
      </CardContent>
    </Card>
  );
}
