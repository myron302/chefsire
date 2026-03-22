import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type CampaignRolloutMode = "public_first" | "followers_first" | "members_first" | "staged";
type CampaignTimingRecommendationType =
  | "start_earlier"
  | "start_later"
  | "shorten_member_window"
  | "extend_member_window"
  | "shorten_follower_window"
  | "extend_follower_window"
  | "accelerate_public_unlock"
  | "delay_public_unlock"
  | "use_short_burst_launch"
  | "use_longer_staged_rollout"
  | "keep_current_timing";
type Confidence = "high" | "medium" | "low" | "none";
type AudienceSegment = "public" | "followers" | "members";

type CampaignTimingAdvisorInsight = {
  key: string;
  title: string;
  message: string;
  confidence: Confidence;
  evidence: string[];
};

type CampaignTimingAdvisorItem = {
  campaignId: string;
  campaignName: string;
  route: string;
  currentRolloutMode: CampaignRolloutMode;
  suggestedStartTiming: string;
  suggestedFollowerUnlockDelay: number | null;
  suggestedPublicUnlockDelay: number | null;
  timingRecommendationType: CampaignTimingRecommendationType;
  title: string;
  message: string;
  rationale: string;
  confidence: Confidence;
  rationaleChips: string[];
  strongestStage: AudienceSegment | null;
  currentFollowerUnlockDelay: number | null;
  currentPublicUnlockDelay: number | null;
  totalTimingSignal: number;
  approximatePurchaseSignal: number;
  approximateMembershipSignal: number;
};

type CampaignTimingAdvisorResponse = {
  ok: boolean;
  userId: string;
  campaignId: string | null;
  generatedAt: string;
  summary: {
    totalCampaigns: number;
    campaignsWithRecommendations: number;
    shorterWindowRecommendations: number;
    longerWindowRecommendations: number;
    earlierPublicUnlockRecommendations: number;
    shortBurstRecommendations: number;
    keepCurrentTimingCount: number;
  };
  creatorInsights: CampaignTimingAdvisorInsight[];
  items: CampaignTimingAdvisorItem[];
  attributionNotes: string[];
};

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

function recommendationLabel(value: CampaignTimingRecommendationType) {
  switch (value) {
    case "start_earlier":
      return "Start earlier";
    case "start_later":
      return "Start later";
    case "shorten_member_window":
      return "Shorten member window";
    case "extend_member_window":
      return "Extend member window";
    case "shorten_follower_window":
      return "Shorten follower window";
    case "extend_follower_window":
      return "Extend follower window";
    case "accelerate_public_unlock":
      return "Accelerate public unlock";
    case "delay_public_unlock":
      return "Delay public unlock";
    case "use_short_burst_launch":
      return "Use short burst launch";
    case "use_longer_staged_rollout":
      return "Use longer staged rollout";
    case "keep_current_timing":
    default:
      return "Keep current timing";
  }
}

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

function audienceLabel(audience: AudienceSegment | null) {
  switch (audience) {
    case "members":
      return "Member stage led";
    case "followers":
      return "Follower stage led";
    case "public":
      return "Public stage led";
    default:
      return "No clear stage lead";
  }
}

function formatDelay(value: number | null, fallback: string) {
  if (value === null) return fallback;
  if (value <= 0) return "same day";
  if (value === 1) return "1 day";
  return `${value} days`;
}

export default function CampaignTimingAdvisorSection() {
  const { user } = useUser();
  const query = useQuery<CampaignTimingAdvisorResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-timing-advisor", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-timing-advisor", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load timing advisor (${response.status})`);
      return payload as CampaignTimingAdvisorResponse;
    },
    enabled: Boolean(user?.id),
  });

  const summary = query.data?.summary;

  return (
    <Card id="campaign-timing-advisor">
      <CardHeader>
        <CardTitle>Timing Advisor + Best Launch Windows</CardTitle>
        <CardDescription>
          Creator-private, rules-based timing guidance for when to start the campaign push and when follower/public unlocks should happen next time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns reviewed</p>
            <p className="text-xl font-semibold">{summary?.totalCampaigns ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Shorter windows</p>
            <p className="text-xl font-semibold">{summary?.shorterWindowRecommendations ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Longer runway</p>
            <p className="text-xl font-semibold">{summary?.longerWindowRecommendations ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Earlier public</p>
            <p className="text-xl font-semibold">{summary?.earlierPublicUnlockRecommendations ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Short burst</p>
            <p className="text-xl font-semibold">{summary?.shortBurstRecommendations ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Keep current</p>
            <p className="text-xl font-semibold">{summary?.keepCurrentTimingCount ?? 0}</p>
          </div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading timing advisor…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign timing advisor right now."}</p> : null}

        {query.data?.creatorInsights?.length ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">What timing tends to work best for you</p>
              <p className="text-sm text-muted-foreground">These notes are based on your own launch history only and stay intentionally honest about approximation.</p>
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
                      <Badge variant="outline">{recommendationLabel(item.timingRecommendationType)}</Badge>
                      <Badge variant={confidenceVariant(item.confidence)}>{item.confidence} confidence</Badge>
                    </div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Now: {rolloutModeLabel(item.currentRolloutMode)}</Badge>
                      <Badge variant="outline">{audienceLabel(item.strongestStage)}</Badge>
                      <Badge variant="outline">Follower unlock: {formatDelay(item.suggestedFollowerUnlockDelay, "not used")}</Badge>
                      <Badge variant="outline">Public unlock: {formatDelay(item.suggestedPublicUnlockDelay, "same day")}</Badge>
                    </div>
                  </div>
                  <Link href={item.route} className="shrink-0">
                    <Button variant="outline" size="sm">Open campaign</Button>
                  </Link>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)]">
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Suggested start timing</p>
                    <p className="mt-2">{item.suggestedStartTiming}</p>
                    <p className="mt-3 text-xs">{item.rationale}</p>
                  </div>
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Quick signals</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.rationaleChips.map((chip) => <Badge key={chip} variant="secondary">{chip}</Badge>)}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded border bg-background p-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Timing signal</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{Math.round(item.totalTimingSignal)}</p>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Approx. conversions</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{item.approximatePurchaseSignal + item.approximateMembershipSignal}</p>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Current follower unlock</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{formatDelay(item.currentFollowerUnlockDelay, "not used")}</p>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Current public unlock</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{formatDelay(item.currentPublicUnlockDelay, "same day")}</p>
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
