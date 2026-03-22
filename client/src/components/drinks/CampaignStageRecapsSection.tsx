import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type CampaignRolloutAudience = "public" | "followers" | "members";
type CampaignRolloutMode = "public_first" | "followers_first" | "members_first" | "staged";
type CampaignRolloutState = "scheduled_for_members" | "scheduled_for_followers" | "scheduled_for_public" | "live_for_members" | "live_for_followers" | "live_for_public" | "fully_open" | "completed";

type CampaignStageRecap = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  stageName: CampaignRolloutAudience;
  stageLabel: string;
  stageStartedAt: string | null;
  stageEndedAt: string | null;
  stageDurationHours: number | null;
  views: number;
  clicks: number;
  rsvps: number;
  approximatePurchases: number | null;
  approximateMemberships: number | null;
  primaryOutcome: string;
  stageSummary: string;
  stageScore: number | null;
  nextStepHint: string | null;
  isCurrentStage: boolean;
  hasEnded: boolean;
};

type CampaignStageRecapCampaignItem = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  rolloutMode: CampaignRolloutMode;
  currentRolloutState: CampaignRolloutState;
  hasSequencedRollout: boolean;
  recaps: CampaignStageRecap[];
};

type CampaignStageRecapsResponse = {
  ok: boolean;
  userId: string;
  summary: {
    totalCampaigns: number;
    campaignsWithRecaps: number;
    totalStageRecaps: number;
    completedStageRecaps: number;
  };
  items: CampaignStageRecapCampaignItem[];
  attributionNotes: string[];
  generatedAt: string;
};

type CampaignStageRecapDetailResponse = {
  ok: boolean;
  userId: string;
  campaignId: string;
  summary: CampaignStageRecapsResponse["summary"];
  item: CampaignStageRecapCampaignItem | null;
  attributionNotes: string[];
  generatedAt: string;
};

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

function audienceBadgeLabel(value: CampaignRolloutAudience) {
  switch (value) {
    case "members":
      return "Members";
    case "followers":
      return "Followers";
    case "public":
    default:
      return "Public";
  }
}

function metricLine(recap: CampaignStageRecap) {
  return `${recap.views} views · ${recap.clicks} clicks · ${recap.rsvps} RSVPs`;
}

export default function CampaignStageRecapsSection({
  campaignId,
  title,
  description,
  compact = false,
}: {
  campaignId?: string | null;
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  const { user } = useUser();
  const query = useQuery<CampaignStageRecapsResponse | CampaignStageRecapDetailResponse>({
    queryKey: [campaignId ? "/api/drinks/campaigns/:id/stage-recaps" : "/api/drinks/creator-dashboard/campaign-stage-recaps", campaignId ?? "all", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(
        campaignId
          ? `/api/drinks/campaigns/${encodeURIComponent(campaignId)}/stage-recaps`
          : "/api/drinks/creator-dashboard/campaign-stage-recaps",
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign stage recaps (${response.status})`);
      }
      return payload as CampaignStageRecapsResponse | CampaignStageRecapDetailResponse;
    },
    enabled: Boolean(user?.id),
  });

  const items = "items" in (query.data ?? {}) ? (query.data?.items ?? []) : (query.data?.item ? [query.data.item] : []);
  const summary = query.data?.summary;

  return (
    <Card id={campaignId ? undefined : "campaign-stage-recaps"}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title ?? (campaignId ? "Owner-only stage recap panel" : "Stage Recaps + Unlock Outcomes")}</CardTitle>
            <CardDescription>
              {description ?? (campaignId
                ? "Private stage-by-stage outcome reviews for this campaign. This stays separate from rollout analytics totals, timeline history, and advisor recommendations."
                : "Scannable stage-by-stage unlock reviews for sequenced campaigns. This is a lightweight learning layer built on timing windows and existing rollout metrics.")}
            </CardDescription>
          </div>
          {!compact ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{summary?.campaignsWithRecaps ?? 0} campaigns</Badge>
              <Badge variant="outline">{summary?.totalStageRecaps ?? 0} stage reviews</Badge>
              <Badge variant="outline">{summary?.completedStageRecaps ?? 0} completed</Badge>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading stage recaps…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load stage recaps right now."}</p> : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How unlock outcome reviews work</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        {!query.isLoading && !query.isError && items.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            No sequenced campaign stages have unlocked enough signal yet to show a recap here.
          </div>
        ) : null}

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.campaignId} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.campaignName}</p>
                    <Badge variant="secondary">{rolloutModeLabel(item.rolloutMode)}</Badge>
                    <Badge variant="outline">{rolloutStateLabel(item.currentRolloutState)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Compare each unlocked stage without blending it into the raw rollout analytics table or rollout timeline log.
                  </p>
                </div>
                {!campaignId ? (
                  <Link href={item.campaignRoute}>
                    <Button variant="outline" size="sm">Open campaign</Button>
                  </Link>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                {item.recaps.map((recap) => (
                  <div key={`${item.campaignId}-${recap.stageName}`} className="rounded-md bg-muted/20 p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{audienceBadgeLabel(recap.stageName)}</Badge>
                      {recap.stageScore !== null ? <Badge variant="secondary">Score {recap.stageScore}</Badge> : null}
                      {recap.isCurrentStage ? <Badge variant="outline">Current</Badge> : null}
                      {!recap.hasEnded && !recap.isCurrentStage ? <Badge variant="outline">Unlocked</Badge> : null}
                    </div>

                    <div className="mt-3 space-y-1">
                      <p className="font-medium">{recap.stageLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(recap.stageStartedAt)} → {formatDateTime(recap.stageEndedAt)}
                        {recap.stageDurationHours !== null ? ` · ${recap.stageDurationHours}h` : ""}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div className="rounded border bg-background p-2"><p>Views</p><p className="mt-1 text-sm font-medium text-foreground">{recap.views}</p></div>
                      <div className="rounded border bg-background p-2"><p>Clicks</p><p className="mt-1 text-sm font-medium text-foreground">{recap.clicks}</p></div>
                      <div className="rounded border bg-background p-2"><p>RSVPs</p><p className="mt-1 text-sm font-medium text-foreground">{recap.rsvps}</p></div>
                    </div>

                    <div className="mt-3 space-y-2 rounded-md border border-dashed bg-background p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Primary outcome</p>
                      <p className="font-medium text-foreground">{recap.primaryOutcome}</p>
                      <p className="text-muted-foreground">{recap.stageSummary}</p>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <p>{metricLine(recap)}</p>
                      <p>Approx purchases: <span className="font-medium text-foreground">{recap.approximatePurchases ?? "—"}</span></p>
                      <p>Approx memberships: <span className="font-medium text-foreground">{recap.approximateMemberships ?? "—"}</span></p>
                      {recap.nextStepHint ? <p className="rounded-md bg-background p-2">{recap.nextStepHint}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {query.data?.generatedAt ? (
          <p className="text-xs text-muted-foreground">Generated {formatDateTime(query.data.generatedAt)}.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
