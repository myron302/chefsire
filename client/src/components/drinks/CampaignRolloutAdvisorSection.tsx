import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type CampaignRolloutMode = "public_first" | "followers_first" | "members_first" | "staged";
type CampaignRolloutAdviceType =
  | "keep_members_first"
  | "keep_followers_first"
  | "keep_public_first"
  | "shorten_staged_rollout"
  | "extend_member_window"
  | "extend_follower_window"
  | "go_public_earlier"
  | "add_member_phase"
  | "skip_member_phase"
  | "skip_follower_phase"
  | "use_staged_rollout_next_time";
type AudienceSegment = "public" | "followers" | "members";
type Confidence = "high" | "medium" | "low" | "none";

type CampaignRolloutAdvisorInsight = {
  key: string;
  title: string;
  message: string;
  confidence: Confidence;
  evidence: string[];
};

type CampaignRolloutAdvisorItem = {
  campaignId: string;
  campaignName: string;
  route: string;
  currentRolloutMode: CampaignRolloutMode;
  recommendedNextRolloutMode: CampaignRolloutMode;
  recommendationType: CampaignRolloutAdviceType;
  title: string;
  message: string;
  rationale: string;
  confidence: Confidence;
  rationaleChips: string[];
  currentAudienceFit: AudienceSegment | null;
  currentAudienceFitConfidence: Confidence;
  healthState: "thriving" | "healthy" | "watch" | "at_risk" | "completed" | null;
  benchmarkLabels: string[];
  memberOnlyCollectionsCount: number;
  goalsOnTrack: number;
  goalsBehind: number;
  strongestStage: AudienceSegment | null;
  totalStageSignal: number;
};

type CampaignRolloutAdvisorResponse = {
  ok: boolean;
  userId: string;
  generatedAt: string;
  summary: {
    totalCampaigns: number;
    campaignsWithRecommendations: number;
    memberFirstRecommendations: number;
    followerFirstRecommendations: number;
    publicFirstRecommendations: number;
    stagedRecommendations: number;
  };
  creatorInsights: CampaignRolloutAdvisorInsight[];
  items: CampaignRolloutAdvisorItem[];
  attributionNotes: string[];
};

function rolloutModeLabel(mode: CampaignRolloutMode) {
  switch (mode) {
    case "members_first":
      return "Members first";
    case "followers_first":
      return "Followers first";
    case "staged":
      return "Staged rollout";
    case "public_first":
    default:
      return "Public first";
  }
}

function recommendationTypeLabel(type: CampaignRolloutAdviceType) {
  switch (type) {
    case "keep_members_first":
      return "Keep members first";
    case "keep_followers_first":
      return "Keep followers first";
    case "keep_public_first":
      return "Keep public first";
    case "shorten_staged_rollout":
      return "Shorten staged rollout";
    case "extend_member_window":
      return "Extend member window";
    case "extend_follower_window":
      return "Extend follower window";
    case "go_public_earlier":
      return "Go public earlier";
    case "add_member_phase":
      return "Add member phase";
    case "skip_member_phase":
      return "Skip member phase";
    case "skip_follower_phase":
      return "Skip follower phase";
    case "use_staged_rollout_next_time":
    default:
      return "Use staged rollout next time";
  }
}

function confidenceVariant(confidence: Confidence) {
  switch (confidence) {
    case "high":
      return "default" as const;
    case "medium":
      return "secondary" as const;
    case "low":
    case "none":
    default:
      return "outline" as const;
  }
}

function audienceLabel(audience: AudienceSegment | null) {
  switch (audience) {
    case "members":
      return "Member fit";
    case "followers":
      return "Follower fit";
    case "public":
      return "Public fit";
    default:
      return "No clear fit";
  }
}

export default function CampaignRolloutAdvisorSection() {
  const { user } = useUser();
  const query = useQuery<CampaignRolloutAdvisorResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-rollout-advisor", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-rollout-advisor", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load rollout advisor (${response.status})`);
      return payload as CampaignRolloutAdvisorResponse;
    },
    enabled: Boolean(user?.id),
  });

  const summary = query.data?.summary;

  return (
    <Card id="campaign-rollout-advisor">
      <CardHeader>
        <CardTitle>Rollout Strategy Advisor</CardTitle>
        <CardDescription>
          Lightweight, creator-private guidance for which audience sequence looks strongest next time using only your current rollout, audience-fit, analytics, health, benchmark, and conversion proxy signals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns reviewed</p>
            <p className="text-xl font-semibold">{summary?.totalCampaigns ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Member-first</p>
            <p className="text-xl font-semibold">{summary?.memberFirstRecommendations ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Follower-first</p>
            <p className="text-xl font-semibold">{summary?.followerFirstRecommendations ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Public-first</p>
            <p className="text-xl font-semibold">{summary?.publicFirstRecommendations ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Staged next</p>
            <p className="text-xl font-semibold">{summary?.stagedRecommendations ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Recommendations</p>
            <p className="text-xl font-semibold">{summary?.campaignsWithRecommendations ?? 0}</p>
          </div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading rollout strategy advisor…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load rollout strategy advisor right now."}</p> : null}

        {query.data?.creatorInsights?.length ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">What tends to work best for you</p>
              <p className="text-sm text-muted-foreground">These notes are grounded in your own campaigns only, not a platform-wide rulebook.</p>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {query.data.creatorInsights.map((insight) => (
                <div key={insight.key} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{insight.title}</p>
                    <Badge variant={confidenceVariant(insight.confidence)}>{insight.confidence} confidence</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{insight.message}</p>
                  {insight.evidence.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {insight.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {query.data?.items?.length ? (
          <div className="space-y-4">
            {query.data.items.map((item) => (
              <div key={item.campaignId} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.campaignName}</p>
                      <Badge variant="outline">{recommendationTypeLabel(item.recommendationType)}</Badge>
                      <Badge variant={confidenceVariant(item.confidence)}>{item.confidence} confidence</Badge>
                    </div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Now: {rolloutModeLabel(item.currentRolloutMode)}</Badge>
                      <Badge variant="secondary">Next: {rolloutModeLabel(item.recommendedNextRolloutMode)}</Badge>
                      <Badge variant="outline">{audienceLabel(item.currentAudienceFit)}</Badge>
                      {item.healthState ? <Badge variant="outline">Health: {item.healthState.replace("_", " ")}</Badge> : null}
                    </div>
                  </div>
                  <Link href={item.route} className="shrink-0">
                    <Button variant="outline" size="sm">Open campaign</Button>
                  </Link>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)]">
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Why this sequence</p>
                    <p className="mt-2">{item.rationale}</p>
                  </div>
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Quick signals</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.rationaleChips.map((chip) => <Badge key={chip} variant="secondary">{chip}</Badge>)}
                      {item.benchmarkLabels.slice(0, 2).map((label) => <Badge key={label} variant="outline">{label}</Badge>)}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded border bg-background p-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Goals on track</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{item.goalsOnTrack}</p>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Goals behind</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{item.goalsBehind}</p>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Stage signal</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{Math.round(item.totalStageSignal)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How to read this</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
