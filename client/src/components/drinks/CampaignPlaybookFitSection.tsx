import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type FitLabel = "strong_match" | "partial_match" | "weak_match";
type FitRecommendation = "apply_as_is" | "apply_with_adjustments" | "loose_inspiration";

type PlaybookMatch = {
  playbookId: string;
  playbookName: string;
  playbookDescription: string | null;
  fitScore: number;
  fitLabel: FitLabel;
  recommendation: FitRecommendation;
  whyItFits: string[];
  mismatches: string[];
  suggestedAdjustments: string[];
  historicalOutcomeLabel?: string | null;
  historicalOutcomeConfidenceNote?: string | null;
  historicalOutcomeAppliedCount?: number;
};

type CampaignPlaybookFitItem = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  visibility: "public" | "followers" | "members";
  state: "upcoming" | "active" | "past";
  bestMatch: PlaybookMatch | null;
  runnerUp: PlaybookMatch | null;
  matches: PlaybookMatch[];
  audienceFit: {
    bestAudienceFit: "public" | "followers" | "members" | null;
    bestAudienceFitConfidence: "high" | "medium" | "low" | "none";
    bestAudienceFitReason: string | null;
  } | null;
};

type DashboardResponse = {
  ok: boolean;
  count: number;
  profilesCount: number;
  items: CampaignPlaybookFitItem[];
  attributionNotes: string[];
  generatedAt: string;
};

type DetailResponse = CampaignPlaybookFitItem & {
  ok: boolean;
  attributionNotes: string[];
  generatedAt: string;
};

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function fitLabelCopy(value: FitLabel) {
  switch (value) {
    case "strong_match":
      return "Strong match";
    case "partial_match":
      return "Partial match";
    default:
      return "Weak match";
  }
}

function fitLabelVariant(value: FitLabel): "default" | "secondary" | "outline" {
  switch (value) {
    case "strong_match":
      return "default";
    case "partial_match":
      return "secondary";
    default:
      return "outline";
  }
}

function recommendationCopy(value: FitRecommendation) {
  switch (value) {
    case "apply_as_is":
      return "Apply as-is";
    case "apply_with_adjustments":
      return "Apply with adjustments";
    default:
      return "Loose inspiration";
  }
}

export default function CampaignPlaybookFitSection(props: {
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

  const query = useQuery<DashboardResponse | DetailResponse>({
    queryKey: [campaignId ? `/api/drinks/campaigns/${campaignId}/playbook-fit` : "/api/drinks/creator-dashboard/campaign-playbook-fit", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(
        campaignId
          ? `/api/drinks/campaigns/${encodeURIComponent(campaignId)}/playbook-fit`
          : "/api/drinks/creator-dashboard/campaign-playbook-fit",
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign playbook fit (${response.status})`);
      return payload as DashboardResponse | DetailResponse;
    },
    enabled: Boolean(user?.id),
  });

  const applyMutation = useMutation({
    mutationFn: async ({ profileId, targetCampaignId }: { profileId: string; targetCampaignId: string }) => {
      const response = await fetch(`/api/drinks/creator-dashboard/campaign-playbook-profiles/${encodeURIComponent(profileId)}/apply-to-campaign/${encodeURIComponent(targetCampaignId)}`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to apply playbook (${response.status})`);
      return payload;
    },
    onSuccess: async (payload) => {
      setMessage(payload?.message || "Campaign playbook profile applied.");
      setError("");
      const appliedCampaignId = String(payload?.appliedToCampaignId ?? campaignId ?? "").trim();
      if (appliedCampaignId && payload?.playbookOnboarding) {
        queryClient.setQueryData([`/api/drinks/campaigns/${appliedCampaignId}/playbook-onboarding`, user?.id ?? ""], {
          ok: true,
          campaignId: appliedCampaignId,
          item: payload.playbookOnboarding,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-fit"] }),
        campaignId ? queryClient.invalidateQueries({ queryKey: [`/api/drinks/campaigns/${campaignId}/playbook-fit`] }) : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-onboarding"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-drift"] }),
        appliedCampaignId ? queryClient.invalidateQueries({ queryKey: [`/api/drinks/campaigns/${appliedCampaignId}/playbook-onboarding`] }) : Promise.resolve(),
        appliedCampaignId ? queryClient.invalidateQueries({ queryKey: [`/api/drinks/campaigns/${appliedCampaignId}/playbook-drift`] }) : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns"] }),
      ]);
    },
    onError: (mutationError) => {
      setMessage("");
      setError(readErrorMessage(mutationError, "Unable to apply this playbook right now."));
    },
  });

  const items = React.useMemo(() => {
    if (!query.data) return [];
    return campaignId ? [query.data as DetailResponse] : (query.data as DashboardResponse).items;
  }, [campaignId, query.data]);

  return (
    <Card id={campaignId ? undefined : "campaign-playbook-fit"}>
      <CardHeader>
        <CardTitle>{props.title ?? (compact ? "Owner-only suggested playbook" : "Suggested Playbook / Playbook Fit")}</CardTitle>
        <CardDescription>
          {props.description ?? (compact
            ? "Private playbook-match hint for this campaign only. This stays separate from playbook profiles, templates, rollout advisor, and timing advisor."
            : "Rules-based matching between each campaign and your own saved playbook profiles. This is strategy fit, not a giant recommendation engine.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading playbook fit…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{readErrorMessage(query.error, "Unable to load playbook fit right now.")}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!query.isLoading && !query.isError && items.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            No playbook fit suggestions yet. Save at least one campaign playbook profile first, then ChefSire can compare your saved strategy presets against your live campaigns.
          </div>
        ) : null}

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.campaignId} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  {!compact ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={item.campaignRoute} className="font-medium underline underline-offset-2">
                        {item.campaignName}
                      </Link>
                      <Badge variant="outline" className="capitalize">{item.state}</Badge>
                      <Badge variant="outline" className="capitalize">{item.visibility}</Badge>
                    </div>
                  ) : (
                    <p className="font-medium">{item.bestMatch?.playbookName ?? "No strong playbook suggestion yet"}</p>
                  )}
                  {item.bestMatch ? (
                    <p className="text-sm text-muted-foreground">
                      Best fit: <span className="font-medium text-foreground">{item.bestMatch.playbookName}</span>
                      {" · "}
                      {item.bestMatch.fitScore}/100
                      {" · "}
                      {recommendationCopy(item.bestMatch.recommendation)}
                      {item.bestMatch.historicalOutcomeLabel ? (
                        <>
                          {" · "}
                          <span className="text-foreground">{item.bestMatch.historicalOutcomeLabel}</span>
                        </>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No saved playbook profile has enough signal to suggest yet.</p>
                  )}
                </div>
                {item.bestMatch ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={fitLabelVariant(item.bestMatch.fitLabel)}>{fitLabelCopy(item.bestMatch.fitLabel)}</Badge>
                    {!compact ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMessage("");
                          setError("");
                          applyMutation.mutate({ profileId: item.bestMatch!.playbookId, targetCampaignId: item.campaignId });
                        }}
                        disabled={applyMutation.isPending}
                      >
                        {applyMutation.isPending ? "Applying…" : "Apply playbook"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {item.bestMatch ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
                  <div className="space-y-3">
                    {item.bestMatch.whyItFits.length > 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Why it fits</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {item.bestMatch.whyItFits.map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                      </div>
                    ) : null}

                    {item.bestMatch.mismatches.length > 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Mismatches to keep honest</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {item.bestMatch.mismatches.map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-md bg-muted/30 p-3 text-sm">
                      <p className="font-medium text-foreground">Suggested use</p>
                      <p className="mt-1 text-muted-foreground">{recommendationCopy(item.bestMatch.recommendation)}</p>
                      {item.bestMatch.historicalOutcomeLabel ? (
                        <p className="mt-2 text-muted-foreground">
                          Historical outcome context: {item.bestMatch.historicalOutcomeLabel}
                          {typeof item.bestMatch.historicalOutcomeAppliedCount === "number"
                            ? ` across ${item.bestMatch.historicalOutcomeAppliedCount} applied campaign${item.bestMatch.historicalOutcomeAppliedCount === 1 ? "" : "s"}`
                            : ""}
                          .
                        </p>
                      ) : null}
                      {item.bestMatch.historicalOutcomeConfidenceNote ? (
                        <p className="mt-2 text-xs text-muted-foreground">{item.bestMatch.historicalOutcomeConfidenceNote}</p>
                      ) : null}
                      {item.bestMatch.suggestedAdjustments.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                          {item.bestMatch.suggestedAdjustments.map((adjustment) => <li key={adjustment}>{adjustment}</li>)}
                        </ul>
                      ) : null}
                    </div>

                    {item.runnerUp ? (
                      <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">Runner-up</p>
                        <p className="mt-1">{item.runnerUp.playbookName} · {item.runnerUp.fitScore}/100 · {fitLabelCopy(item.runnerUp.fitLabel)}</p>
                      </div>
                    ) : null}

                    {item.audienceFit?.bestAudienceFitReason ? (
                      <div className="rounded-md border p-3 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Audience-fit context</p>
                        <p className="mt-1">{item.audienceFit.bestAudienceFitReason}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              {query.data.attributionNotes.slice(0, compact ? 2 : 4).map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
