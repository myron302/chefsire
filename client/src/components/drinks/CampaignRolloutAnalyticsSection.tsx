import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/contexts/UserContext";

type CampaignRolloutAudience = "public" | "followers" | "members";
type CampaignRolloutMode = "public_first" | "followers_first" | "members_first" | "staged";
type CampaignRolloutState = "scheduled_for_members" | "scheduled_for_followers" | "scheduled_for_public" | "live_for_members" | "live_for_followers" | "live_for_public" | "fully_open" | "completed";

type CampaignRolloutStagePerformance = {
  audience: CampaignRolloutAudience;
  label: string;
  views: number;
  clicks: number;
  rsvps: number;
};

type CampaignRolloutAnalyticsItem = {
  campaignId: string;
  slug: string;
  name: string;
  route: string;
  visibility: CampaignRolloutAudience;
  state: "upcoming" | "active" | "past";
  hasRolloutConfig: boolean;
  hasSequencedRollout: boolean;
  rolloutMode: CampaignRolloutMode;
  currentRolloutState: CampaignRolloutState;
  startsWithAudience: CampaignRolloutAudience;
  unlockFollowersAt: string | null;
  unlockPublicAt: string | null;
  currentAudience: CampaignRolloutAudience;
  nextAudience: CampaignRolloutAudience | null;
  membersStageViews: number;
  followersStageViews: number;
  publicStageViews: number;
  membersStageClicks: number;
  followersStageClicks: number;
  publicStageClicks: number;
  membersStageRsvps: number;
  followersStageRsvps: number;
  publicStageRsvps: number;
  followersUnlockedAt: string | null;
  publicUnlockedAt: string | null;
  approximatePurchasesAfterFollowerUnlock: number | null;
  approximatePurchasesAfterPublicUnlock: number | null;
  approximateMembershipsAfterMemberFirstRollout: number | null;
  stagePerformance: CampaignRolloutStagePerformance[];
  insights: string[];
};

interface CampaignRolloutAnalyticsResponse {
  ok: boolean;
  userId: string;
  generatedAt: string;
  summary: {
    totalCampaigns: number;
    campaignsWithRolloutConfig: number;
    campaignsWithSequencedRollout: number;
    activeSequencedRollouts: number;
    totalStageViews: number;
    totalStageClicks: number;
    totalStageRsvps: number;
  };
  attributionNotes: string[];
  items: CampaignRolloutAnalyticsItem[];
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function rolloutModeLabel(value: CampaignRolloutMode) {
  switch (value) {
    case "followers_first":
      return "Followers first";
    case "members_first":
      return "Members first";
    case "staged":
      return "Staged rollout";
    case "public_first":
    default:
      return "Public first";
  }
}

function rolloutStateLabel(value: CampaignRolloutState) {
  switch (value) {
    case "scheduled_for_members":
      return "Scheduled for members";
    case "scheduled_for_followers":
      return "Scheduled for followers";
    case "scheduled_for_public":
      return "Scheduled for public";
    case "live_for_members":
      return "Live for members";
    case "live_for_followers":
      return "Live for followers";
    case "live_for_public":
      return "Live for public";
    case "fully_open":
      return "Fully open";
    case "completed":
    default:
      return "Completed";
  }
}

function audienceLabel(value: CampaignRolloutAudience | null) {
  switch (value) {
    case "members":
      return "Members";
    case "followers":
      return "Followers";
    case "public":
      return "Public";
    default:
      return "—";
  }
}

function stageMetricSummary(stage: CampaignRolloutStagePerformance) {
  return `${stage.views} views · ${stage.clicks} clicks · ${stage.rsvps} RSVPs`;
}

export default function CampaignRolloutAnalyticsSection() {
  const { user } = useUser();
  const query = useQuery<CampaignRolloutAnalyticsResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-rollout-analytics", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-rollout-analytics", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load rollout analytics (${response.status})`);
      return payload as CampaignRolloutAnalyticsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const summary = query.data?.summary;
  const rolloutItems = (query.data?.items ?? []).filter((item) => item.hasSequencedRollout || item.hasRolloutConfig);

  return (
    <Card id="campaign-rollout-analytics">
      <CardHeader>
        <CardTitle>Rollout Performance</CardTitle>
        <CardDescription>
          See how campaign engagement changed as access widened from members to followers to public. This is timing-based rollout analytics, not a heavyweight attribution warehouse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns</p><p className="text-xl font-semibold">{summary?.totalCampaigns ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">With rollout config</p><p className="text-xl font-semibold">{summary?.campaignsWithRolloutConfig ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Sequenced</p><p className="text-xl font-semibold">{summary?.campaignsWithSequencedRollout ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Live sequences</p><p className="text-xl font-semibold">{summary?.activeSequencedRollouts ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Stage clicks</p><p className="text-xl font-semibold">{summary?.totalStageClicks ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Stage RSVPs</p><p className="text-xl font-semibold">{summary?.totalStageRsvps ?? 0}</p></div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading rollout analytics…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load rollout analytics right now."}</p> : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How stage attribution works</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        {rolloutItems.length ? (
          <div className="space-y-4">
            {rolloutItems.map((item) => (
              <div key={item.campaignId} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.name}</p>
                      <Badge variant="secondary">{rolloutModeLabel(item.rolloutMode)}</Badge>
                      <Badge variant="outline">{rolloutStateLabel(item.currentRolloutState)}</Badge>
                      <Badge variant="outline">Current: {audienceLabel(item.currentAudience)}</Badge>
                      {item.nextAudience ? <Badge variant="outline">Next: {audienceLabel(item.nextAudience)}</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Starts with {audienceLabel(item.startsWithAudience)}. Follower unlock {formatDateTime(item.unlockFollowersAt)}. Public unlock {formatDateTime(item.unlockPublicAt)}.
                    </p>
                  </div>
                  <Link href={item.route} className="shrink-0">
                    <Button variant="outline" size="sm">Open campaign</Button>
                  </Link>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {item.stagePerformance.map((stage) => (
                    <div key={stage.audience} className="rounded-md bg-muted/20 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{stage.label}</p>
                        <Badge variant="outline">{stageMetricSummary(stage)}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div className="rounded border bg-background p-2"><p>Views</p><p className="mt-1 text-sm font-medium text-foreground">{stage.views}</p></div>
                        <div className="rounded border bg-background p-2"><p>Clicks</p><p className="mt-1 text-sm font-medium text-foreground">{stage.clicks}</p></div>
                        <div className="rounded border bg-background p-2"><p>RSVPs</p><p className="mt-1 text-sm font-medium text-foreground">{stage.rsvps}</p></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)]">
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Transition insights</p>
                    {item.insights.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {item.insights.map((insight) => <li key={insight}>{insight}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-2">Not enough stage-specific signal yet to call this rollout honestly.</p>
                    )}
                  </div>

                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Approximate transition metrics</p>
                    <div className="mt-2 space-y-2">
                      <p>Purchases after follower unlock: <span className="font-medium text-foreground">{item.approximatePurchasesAfterFollowerUnlock ?? "—"}</span></p>
                      <p>Purchases after public unlock: <span className="font-medium text-foreground">{item.approximatePurchasesAfterPublicUnlock ?? "—"}</span></p>
                      <p>Memberships after member-first rollout: <span className="font-medium text-foreground">{item.approximateMembershipsAfterMemberFirstRollout ?? "—"}</span></p>
                      <p className="text-xs">These are timing-based proxies using existing purchase and membership records, not exact causal attribution.</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {query.data?.items?.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Current stage</TableHead>
                  <TableHead>Member stage</TableHead>
                  <TableHead>Follower stage</TableHead>
                  <TableHead>Public stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((item) => (
                  <TableRow key={item.campaignId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{item.name}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{rolloutModeLabel(item.rolloutMode)}</span>
                          <span>{item.state}</span>
                          {!item.hasSequencedRollout ? <span>single-stage/default</span> : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        <p>{rolloutStateLabel(item.currentRolloutState)}</p>
                        <p>Current audience: {audienceLabel(item.currentAudience)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{item.membersStageViews} / {item.membersStageClicks} / {item.membersStageRsvps}</TableCell>
                    <TableCell>{item.followersStageViews} / {item.followersStageClicks} / {item.followersStageRsvps}</TableCell>
                    <TableCell>{item.publicStageViews} / {item.publicStageClicks} / {item.publicStageRsvps}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {!query.isLoading && !query.isError && !rolloutItems.length ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No sequenced rollout activity yet. Campaigns will start appearing here once a campaign uses member/follower/public rollout timing.
            </CardContent>
          </Card>
        ) : null}
      </CardContent>
    </Card>
  );
}
