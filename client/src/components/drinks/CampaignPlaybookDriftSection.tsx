import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type DriftSeverity = "aligned" | "watch" | "drifted" | "misaligned";
type RealignAction = "realign_campaign" | "update_playbook" | "keep_new_direction";
type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

type DriftItem = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  state: "upcoming" | "active" | "past";
  playbookId: string;
  playbookName: string;
  playbookDescription: string | null;
  playbookAppliedAt: string | null;
  isPlaybookApplied: boolean;
  playbookLineage: {
    parentPlaybook: { id: string; name: string; versionLabel: string | null } | null;
    sourceCampaign: { id: string; name: string; slug: string; route: string } | null;
    derivedFromType: "playbook" | "campaign" | null;
    versionLabel: string | null;
    basedOnLabel: string | null;
  };
  severity: DriftSeverity;
  severityLabel: string;
  severityVariant: BadgeVariant;
  driftScore: number;
  mismatchCount: number;
  alignmentCount: number;
  summary: string;
  mismatches: Array<{ key: string; label: string; detail: string; weight: number }>;
  alignedSignals: string[];
  currentDirection: {
    visibility: "public" | "followers" | "members";
    rolloutMode: "public_first" | "followers_first" | "members_first" | "staged";
    startsWithAudience: "public" | "followers" | "members" | null;
    inferredCtaDirection: "follow" | "rsvp" | "membership" | "purchase" | "drop" | "mixed" | null;
    followerUnlockDelayHours: number | null;
    publicUnlockDelayHours: number | null;
    recentExperimentTypes: string[];
    bestAudienceFit: "public" | "followers" | "members" | null;
    bestAudienceFitConfidence: "high" | "medium" | "low" | "none";
  };
  savedPlaybookDirection: {
    visibilityStrategy: "public" | "followers" | "members" | null;
    rolloutMode: "public_first" | "followers_first" | "members_first" | "staged";
    startsWithAudience: "public" | "followers" | "members" | null;
    preferredCtaDirection: "follow" | "rsvp" | "membership" | "purchase" | "drop" | "mixed" | null;
    recommendedFollowerUnlockDelayHours: number | null;
    recommendedPublicUnlockDelayHours: number | null;
    preferredAudienceFit: "public" | "followers" | "members" | null;
    preferredExperimentTypes: string[];
  };
  realignRecommendation: {
    action: RealignAction;
    actionLabel: string;
    confidence: "high" | "medium" | "low";
    reason: string | null;
  };
  suggestedDecisions: Array<{
    action: RealignAction;
    recommended: boolean;
    title: string;
    note: string;
    targetRoute: string;
  }>;
  outcomeContext: {
    playbookScorecardLabel: "strong" | "promising" | "mixed" | "weak" | null;
    playbookOutcomeLabel: string | null;
    strongestUseCase: string | null;
    confidenceNote: string | null;
    appliedCount: number;
    healthState: "thriving" | "healthy" | "watch" | "at_risk" | "completed" | null;
    healthScore: number | null;
    readinessScore: number | null;
  };
};

type DriftDashboardResponse = {
  ok: boolean;
  count: number;
  items: DriftItem[];
  summary: {
    appliedCampaignCount: number;
    driftedCount: number;
    misalignedCount: number;
    recommendedRealignCount: number;
  };
  attributionNotes: string[];
  generatedAt: string;
};

type DriftDetailResponse = {
  ok: boolean;
  campaignId: string;
  item: DriftItem;
  attributionNotes: string[];
  generatedAt: string;
};

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function audienceLabel(value: string | null | undefined) {
  if (value === "members") return "Members";
  if (value === "followers") return "Followers";
  if (value === "public") return "Public";
  return "—";
}

function rolloutLabel(value: DriftItem["currentDirection"]["rolloutMode"]) {
  switch (value) {
    case "followers_first":
      return "Followers first";
    case "members_first":
      return "Members first";
    case "staged":
      return "Staged";
    default:
      return "Public first";
  }
}

function ctaLabel(value: DriftItem["currentDirection"]["inferredCtaDirection"] | DriftItem["savedPlaybookDirection"]["preferredCtaDirection"]) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function delayLabel(value: number | null) {
  if (value === null) return "—";
  if (value <= 0) return "Same day";
  if (value < 24) return `${value}h`;
  if (value % 24 === 0) return `${value / 24}d`;
  return `${value}h`;
}

function healthLabel(value: DriftItem["outcomeContext"]["healthState"]) {
  if (!value) return "No health signal yet";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CampaignPlaybookDriftSection(props: {
  campaignId?: string;
  compact?: boolean;
  title?: string;
  description?: string;
}) {
  const { campaignId, compact = false } = props;
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const query = useQuery<DriftDashboardResponse | DriftDetailResponse>({
    queryKey: [campaignId ? `/api/drinks/campaigns/${campaignId}/playbook-drift` : "/api/drinks/creator-dashboard/campaign-playbook-drift", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(
        campaignId
          ? `/api/drinks/campaigns/${encodeURIComponent(campaignId)}/playbook-drift`
          : "/api/drinks/creator-dashboard/campaign-playbook-drift",
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign playbook drift (${response.status})`);
      return payload as DriftDashboardResponse | DriftDetailResponse;
    },
    enabled: Boolean(user?.id) && (!campaignId || campaignId.length > 0),
  });

  const items = React.useMemo(() => {
    if (!query.data) return [] as DriftItem[];
    return campaignId ? [(query.data as DriftDetailResponse).item] : (query.data as DriftDashboardResponse).items;
  }, [campaignId, query.data]);

  const summary = !campaignId ? (query.data as DriftDashboardResponse | undefined)?.summary : null;

  const realignMutation = useMutation({
    mutationFn: async ({ profileId, targetCampaignId }: { profileId: string; targetCampaignId: string }) => {
      const response = await fetch(`/api/drinks/creator-dashboard/campaign-playbook-profiles/${encodeURIComponent(profileId)}/apply-to-campaign/${encodeURIComponent(targetCampaignId)}`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to realign campaign (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage("Campaign realigned to the saved playbook.");
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-drift"] }),
        campaignId ? queryClient.invalidateQueries({ queryKey: [`/api/drinks/campaigns/${campaignId}/playbook-drift`] }) : Promise.resolve(),
        campaignId ? queryClient.invalidateQueries({ queryKey: [`/api/drinks/campaigns/${campaignId}/playbook-onboarding`] }) : Promise.resolve(),
      ]);
    },
    onError: (mutationError) => {
      setMessage("");
      setError(readErrorMessage(mutationError, "Unable to realign this campaign right now."));
    },
  });

  const updatePlaybookMutation = useMutation({
    mutationFn: async (targetCampaignId: string) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(targetCampaignId)}/update-playbook-from-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to update playbook from campaign (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage("Saved current campaign strategy back into the existing playbook.");
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-lineage"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-drift"] }),
        campaignId ? queryClient.invalidateQueries({ queryKey: [`/api/drinks/campaigns/${campaignId}/playbook-drift`] }) : Promise.resolve(),
      ]);
    },
    onError: (mutationError) => {
      setMessage("");
      setError(readErrorMessage(mutationError, "Unable to update the playbook from this campaign right now."));
    },
  });

  const createForkMutation = useMutation({
    mutationFn: async (targetCampaignId: string) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(targetCampaignId)}/create-playbook-fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to save playbook fork (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage("Created a new playbook fork from the current campaign.");
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-lineage"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-drift"] }),
      ]);
    },
    onError: (mutationError) => {
      setMessage("");
      setError(readErrorMessage(mutationError, "Unable to save a new playbook from this campaign right now."));
    },
  });

  return (
    <Card id={campaignId ? undefined : "campaign-playbook-drift"}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{props.title ?? (compact ? "Owner-only playbook drift" : "Playbook Drift / Realign Suggestions")}</CardTitle>
            <CardDescription>
              {props.description ?? (compact
                ? "Private strategy-alignment read for this campaign only. This stays separate from playbook fit, onboarding, and the broader action center."
                : "Owner-only checks for where applied playbooks have drifted from the campaign's current strategy, plus lightweight guidance on whether to realign, update the playbook, or keep the newer direction.")}
            </CardDescription>
          </div>
          {!compact ? (
            <Link href="/drinks/creator-dashboard#campaign-playbook-profiles">
              <Button variant="outline" size="sm">Manage playbooks</Button>
            </Link>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!campaignId && summary ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Applied campaigns</p>
              <p className="mt-1 text-2xl font-semibold">{summary.appliedCampaignCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Drifted</p>
              <p className="mt-1 text-2xl font-semibold">{summary.driftedCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Misaligned</p>
              <p className="mt-1 text-2xl font-semibold">{summary.misalignedCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Suggested realigns</p>
              <p className="mt-1 text-2xl font-semibold">{summary.recommendedRealignCount}</p>
            </div>
          </div>
        ) : null}

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading playbook drift…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{readErrorMessage(query.error, "Unable to load playbook drift right now.")}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!query.isLoading && !query.isError && items.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            No applied playbook drift to review right now. Once a creator-owned campaign has a saved playbook applied, ChefSire will compare its current strategy against that saved direction here.
          </div>
        ) : null}

        <div className="space-y-4">
          {items.map((item) => {
            const recommendedDecision = item.suggestedDecisions.find((decision) => decision.recommended) ?? item.suggestedDecisions[0] ?? null;
            const topMismatches = compact ? item.mismatches.slice(0, 3) : item.mismatches;
            const topSignals = compact ? item.alignedSignals.slice(0, 2) : item.alignedSignals.slice(0, 4);

            return (
              <div key={item.campaignId} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {!compact ? (
                        <Link href={item.campaignRoute} className="font-semibold underline underline-offset-2">{item.campaignName}</Link>
                      ) : (
                        <p className="font-semibold">{item.campaignName}</p>
                      )}
                      <Badge variant={item.severityVariant}>{item.severityLabel}</Badge>
                      <Badge variant="outline">Drift score {item.driftScore}</Badge>
                      <Badge variant="outline">{item.mismatchCount} mismatch{item.mismatchCount === 1 ? "" : "es"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {!compact ? (
                        <>
                          Applied playbook: <span className="font-medium text-foreground">{item.playbookName}</span>
                          {" · "}
                          {item.realignRecommendation.actionLabel}
                          {" · "}
                          {item.realignRecommendation.confidence} confidence
                        </>
                      ) : item.summary}
                    </p>
                    {item.playbookLineage.basedOnLabel ? (
                      <p className="text-xs text-muted-foreground">
                        {item.playbookLineage.basedOnLabel}
                        {item.playbookLineage.versionLabel ? ` · ${item.playbookLineage.versionLabel}` : ""}
                      </p>
                    ) : null}
                  </div>

                  {recommendedDecision ? (
                    <div className="min-w-[220px] rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Recommended next move</p>
                      <p className="mt-1 font-medium">{recommendedDecision.title}</p>
                      <p className="mt-1">{recommendedDecision.note}</p>
                      <div className="mt-3">
                        <Link href={recommendedDecision.targetRoute}>
                          <Button size="sm" variant="outline">Open suggested surface</Button>
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>

                {compact ? (
                  <div className="mt-4 rounded-md border border-dashed p-3 text-sm">
                    <p className="font-medium text-foreground">Playbook evolution actions</p>
                    <p className="mt-1 text-muted-foreground">
                      Realign reapplies the saved playbook. Update overwrites only strategic playbook fields. Save as new creates a new forked variant from this campaign.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => realignMutation.mutate({ profileId: item.playbookId, targetCampaignId: item.campaignId })} disabled={realignMutation.isPending}>
                        {realignMutation.isPending ? "Realigning…" : "Realign to playbook"}
                      </Button>
                      <Button size="sm" onClick={() => updatePlaybookMutation.mutate(item.campaignId)} disabled={updatePlaybookMutation.isPending}>
                        {updatePlaybookMutation.isPending ? "Updating…" : "Update playbook from current campaign"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => createForkMutation.mutate(item.campaignId)} disabled={createForkMutation.isPending}>
                        {createForkMutation.isPending ? "Saving…" : "Save as new playbook"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!compact ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border p-3 text-sm">
                      <p className="font-medium">Current direction</p>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <p>Visibility: {audienceLabel(item.currentDirection.visibility)}</p>
                        <p>Rollout: {rolloutLabel(item.currentDirection.rolloutMode)}</p>
                        <p>Starts with: {audienceLabel(item.currentDirection.startsWithAudience)}</p>
                        <p>CTA: {ctaLabel(item.currentDirection.inferredCtaDirection)}</p>
                      </div>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="font-medium">Saved playbook</p>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <p>Visibility: {audienceLabel(item.savedPlaybookDirection.visibilityStrategy)}</p>
                        <p>Rollout: {rolloutLabel(item.savedPlaybookDirection.rolloutMode)}</p>
                        <p>Starts with: {audienceLabel(item.savedPlaybookDirection.startsWithAudience)}</p>
                        <p>CTA: {ctaLabel(item.savedPlaybookDirection.preferredCtaDirection)}</p>
                      </div>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="font-medium">Current signal</p>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <p>Health: {healthLabel(item.outcomeContext.healthState)}</p>
                        <p>Readiness: {item.outcomeContext.readinessScore ?? "—"}</p>
                        <p>Follower unlock: {delayLabel(item.currentDirection.followerUnlockDelayHours)}</p>
                        <p>Public unlock: {delayLabel(item.currentDirection.publicUnlockDelayHours)}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {topMismatches.length > 0 ? (
                  <div className="mt-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Where drift is showing</p>
                    <ul className="mt-2 space-y-2">
                      {topMismatches.map((mismatch) => (
                        <li key={mismatch.key}>
                          <span className="font-medium text-foreground">{mismatch.label}.</span> {mismatch.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {topSignals.length > 0 ? (
                  <div className="mt-4 rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Still aligned</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {topSignals.map((signal) => <li key={signal}>{signal}</li>)}
                    </ul>
                  </div>
                ) : null}

                {!compact ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Decision paths</p>
                      <div className="mt-3 space-y-3">
                        {item.suggestedDecisions.map((decision) => (
                          <div key={decision.action} className="rounded-md border p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{decision.title}</p>
                              {decision.recommended ? <Badge variant="default">Recommended</Badge> : null}
                            </div>
                            <p className="mt-1">{decision.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Playbook context</p>
                      <div className="mt-2 space-y-2">
                        <p>{item.summary}</p>
                        {item.outcomeContext.playbookOutcomeLabel ? <p>Past outcome signal: {item.outcomeContext.playbookOutcomeLabel}.</p> : null}
                        {item.outcomeContext.strongestUseCase ? <p>{item.outcomeContext.strongestUseCase}</p> : null}
                        {item.outcomeContext.confidenceNote ? <p className="text-xs">{item.outcomeContext.confidenceNote}</p> : null}
                        {item.currentDirection.recentExperimentTypes.length ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {item.currentDirection.recentExperimentTypes.map((experiment) => (
                              <Badge key={experiment} variant="outline">{experiment.replaceAll("_", " ")}</Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
