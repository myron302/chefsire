import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type ScorecardLabel = "strong" | "promising" | "mixed" | "weak";
type CampaignExample = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  state: "upcoming" | "active" | "past";
  appliedAt: string;
  weightedOutcomeScore: number;
};

type PlaybookOutcomeItem = {
  playbookId: string;
  playbookName: string;
  playbookDescription: string | null;
  appliedCount: number;
  appliedCampaignCount: number;
  activeCampaignCount: number;
  archivedCampaignCount: number;
  averageFollowerOutcome: number | null;
  averageRsvpOutcome: number | null;
  averageClickOutcome: number | null;
  averageApproxPurchaseOutcome: number | null;
  averageApproxMembershipOutcome: number | null;
  averageGoalCompletionRate: number | null;
  averageReadinessScore: number | null;
  averageHealthStateImprovement: number | null;
  averageBottleneckReduction: number | null;
  strongestUseCase: string;
  summary: string;
  confidenceNote: string | null;
  scorecardLabel: ScorecardLabel;
  strongestCampaignExample: CampaignExample | null;
  weakestCampaignExample: CampaignExample | null;
};

type PlaybookOutcomesResponse = {
  ok: boolean;
  count: number;
  strongestPlaybooks: PlaybookOutcomeItem[];
  weakestPlaybooks: PlaybookOutcomeItem[];
  items: PlaybookOutcomeItem[];
  attributionNotes: string[];
  generatedAt: string;
};

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function badgeVariantForScorecard(value: ScorecardLabel): "default" | "secondary" | "outline" {
  switch (value) {
    case "strong":
      return "default";
    case "promising":
      return "secondary";
    default:
      return "outline";
  }
}

function scorecardCopy(value: ScorecardLabel) {
  switch (value) {
    case "strong":
      return "Strong";
    case "promising":
      return "Promising";
    case "weak":
      return "Weak";
    default:
      return "Mixed";
  }
}

function metricCopy(label: string, value: number | null, suffix = "") {
  if (value === null || Number.isNaN(value)) return `${label}: —`;
  return `${label}: ${value > 0 ? "+" : ""}${value}${suffix}`;
}

export default function CampaignPlaybookOutcomesSection() {
  const { user } = useUser();
  const query = useQuery<PlaybookOutcomesResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-outcomes", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-playbook-outcomes", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load playbook outcomes (${response.status})`);
      return payload as PlaybookOutcomesResponse;
    },
    enabled: Boolean(user?.id),
  });

  const strongest = query.data?.strongestPlaybooks ?? [];
  const weakest = query.data?.weakestPlaybooks ?? [];

  return (
    <Card id="campaign-playbook-outcomes">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Playbook Outcomes / Strategy Scorecards</CardTitle>
            <CardDescription>
              Private, lightweight scorecards for saved playbook profiles. This is playbook effectiveness — how applied strategy presets have performed over time — not playbook fit, templates, or experiment results.
            </CardDescription>
          </div>
          <Link href="/drinks/creator-dashboard#campaign-playbook-profiles">
            <Button size="sm" variant="outline">Open playbooks</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading playbook scorecards…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{readErrorMessage(query.error, "Unable to load playbook outcomes right now.")}</p> : null}

        {!query.isLoading && !query.isError ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Saved playbooks</p>
              <p className="mt-1 text-2xl font-semibold">{query.data?.count ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Strongest right now</p>
              <p className="mt-1 text-sm font-medium">{strongest[0]?.playbookName ?? "None yet"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Needs attention</p>
              <p className="mt-1 text-sm font-medium">{weakest[0]?.playbookName ?? "No weak outlier yet"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">How to read it</p>
              <p className="mt-1 text-sm font-medium">Directional outcomes, not strict causality</p>
            </div>
          </div>
        ) : null}

        {!query.isLoading && !query.isError && (query.data?.items.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            No saved playbooks yet. Save a playbook profile, apply it to a campaign, and ChefSire will start building a lightweight scorecard from your own campaign history.
          </div>
        ) : null}

        {strongest.length || weakest.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="font-medium">Strongest playbooks</p>
              <div className="mt-3 space-y-3">
                {strongest.map((item) => (
                  <div key={`strong-${item.playbookId}`} className="rounded-md border border-dashed p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.playbookName}</p>
                      <Badge variant={badgeVariantForScorecard(item.scorecardLabel)}>{scorecardCopy(item.scorecardLabel)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.strongestUseCase}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-medium">Weakest / mixed playbooks</p>
              <div className="mt-3 space-y-3">
                {weakest.map((item) => (
                  <div key={`weak-${item.playbookId}`} className="rounded-md border border-dashed p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.playbookName}</p>
                      <Badge variant={badgeVariantForScorecard(item.scorecardLabel)}>{scorecardCopy(item.scorecardLabel)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.summary || item.confidenceNote || "Mixed playbook history so far."}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {(query.data?.items ?? []).map((item) => (
            <div key={item.playbookId} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.playbookName}</p>
                    <Badge variant={badgeVariantForScorecard(item.scorecardLabel)}>{scorecardCopy(item.scorecardLabel)}</Badge>
                    <Badge variant="outline">Applied {item.appliedCampaignCount}</Badge>
                    <Badge variant="outline">Active {item.activeCampaignCount}</Badge>
                    {item.archivedCampaignCount > 0 ? <Badge variant="outline">Archived {item.archivedCampaignCount}</Badge> : null}
                  </div>
                  {item.playbookDescription ? <p className="text-sm text-muted-foreground">{item.playbookDescription}</p> : null}
                  <p className="text-sm text-muted-foreground">{item.summary || item.strongestUseCase}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.35fr),minmax(0,1fr)]">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">{metricCopy("Followers", item.averageFollowerOutcome)}</div>
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">{metricCopy("RSVPs", item.averageRsvpOutcome)}</div>
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">{metricCopy("Clicks", item.averageClickOutcome)}</div>
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">{metricCopy("Approx. purchases", item.averageApproxPurchaseOutcome)}</div>
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">{metricCopy("Approx. memberships", item.averageApproxMembershipOutcome)}</div>
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">{metricCopy("Goal completion", item.averageGoalCompletionRate, "%")}</div>
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">{metricCopy("Readiness", item.averageReadinessScore)}</div>
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">{metricCopy("Health shift", item.averageHealthStateImprovement)}</div>
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">{metricCopy("Bottleneck reduction", item.averageBottleneckReduction, " pts")}</div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-md bg-muted/30 p-3 text-sm">
                    <p className="font-medium text-foreground">Best use case</p>
                    <p className="mt-1 text-muted-foreground">{item.strongestUseCase}</p>
                  </div>

                  {item.strongestCampaignExample ? (
                    <div className="rounded-md border p-3 text-sm">
                      <p className="font-medium">Best campaign example</p>
                      <Link href={item.strongestCampaignExample.campaignRoute} className="mt-1 block underline underline-offset-2">
                        {item.strongestCampaignExample.campaignName}
                      </Link>
                      <p className="mt-1 text-muted-foreground">Weighted directional outcome score: {item.strongestCampaignExample.weightedOutcomeScore}</p>
                    </div>
                  ) : null}

                  {item.weakestCampaignExample ? (
                    <div className="rounded-md border p-3 text-sm">
                      <p className="font-medium">Weakest campaign example</p>
                      <Link href={item.weakestCampaignExample.campaignRoute} className="mt-1 block underline underline-offset-2">
                        {item.weakestCampaignExample.campaignName}
                      </Link>
                      <p className="mt-1 text-muted-foreground">Weighted directional outcome score: {item.weakestCampaignExample.weightedOutcomeScore}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {item.confidenceNote ? <p className="mt-3 text-xs text-muted-foreground">{item.confidenceNote}</p> : null}
            </div>
          ))}
        </div>

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Attribution guardrails</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
