import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, Lightbulb, Repeat2, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type ExperimentType =
  | "strengthen_cta"
  | "launch_promo"
  | "add_drop"
  | "publish_update"
  | "push_rsvp"
  | "promote_membership"
  | "add_member_only_collection"
  | "shorten_unlock_delay"
  | "accelerate_public_unlock"
  | "spotlight_campaign";

type ExperimentLibraryExample = {
  campaignId: string;
  campaignName: string;
  campaignRoute: string;
  experimentId: string;
  experimentLabel: string;
  outcomeSummary: string;
};

type ExperimentLibrarySummaryItem = {
  experimentType: ExperimentType;
  label: string;
  runsCount: number;
  readableRunsCount: number;
  improvedCount: number;
  flatCount: number;
  declinedCount: number;
  insufficientDataCount: number;
  averageViewLift: number | null;
  averageClickLift: number | null;
  averageFollowLift: number | null;
  averageRsvpLift: number | null;
  averageApproxPurchaseLift: number | null;
  averageApproxMembershipLift: number | null;
  bestCampaignExample: ExperimentLibraryExample | null;
  reuseSuggestion: string | null;
  confidenceNote: string;
};

type ExperimentLibraryPattern = {
  key: string;
  title: string;
  summary: string;
  reuseSuggestion: string;
  supportingExperimentTypes: ExperimentType[];
  supportCount: number;
  confidence: "low" | "medium" | "high";
  confidenceNote: string;
  exampleCampaign: ExperimentLibraryExample | null;
};

type ExperimentLibraryResponse = {
  ok: boolean;
  userId: string;
  summary: {
    totalHistoricalExperiments: number;
    readableExperiments: number;
    improvedExperiments: number;
    declinedExperiments: number;
    trackedFixTypes: number;
  };
  items: ExperimentLibrarySummaryItem[];
  bestFixTypes: ExperimentLibrarySummaryItem[];
  weakestFixTypes: ExperimentLibrarySummaryItem[];
  fixPatterns: ExperimentLibraryPattern[];
  attributionNotes: string[];
  generatedAt: string;
};

function formatLift(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function confidenceVariant(confidence: ExperimentLibraryPattern["confidence"]): "default" | "secondary" | "outline" {
  switch (confidence) {
    case "high":
      return "default";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

export default function CampaignExperimentLibrarySection() {
  const { user } = useUser();

  const query = useQuery<ExperimentLibraryResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-experiment-library", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-experiment-library", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load experiment library (${response.status})`);
      return payload as ExperimentLibraryResponse;
    },
    enabled: Boolean(user?.id),
  });

  return (
    <Card id="campaign-experiment-library">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Experiment Library / What Works</CardTitle>
            <CardDescription>
              A lightweight reuse layer over your own past campaign experiments. It summarizes directional before/after outcomes only — not platform-wide truth and not strict causal proof.
            </CardDescription>
          </div>
          <Link href="/drinks/creator-dashboard#campaign-fix-experiments">
            <Button variant="outline" size="sm">Run another fix</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading experiment library…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{readErrorMessage(query.error, "Unable to load the experiment library right now.")}</p> : null}

        {query.data ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Historical runs</p>
                <p className="mt-1 text-2xl font-semibold">{query.data.summary.totalHistoricalExperiments}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Readable outcomes</p>
                <p className="mt-1 text-2xl font-semibold">{query.data.summary.readableExperiments}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Improved reads</p>
                <p className="mt-1 text-2xl font-semibold">{query.data.summary.improvedExperiments}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Fix types tracked</p>
                <p className="mt-1 text-2xl font-semibold">{query.data.summary.trackedFixTypes}</p>
              </div>
            </div>

            {query.data.summary.totalHistoricalExperiments === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                No historical campaign experiments yet. Once you complete a few fixes, this library will roll up what tends to move for you across campaigns without creating a giant analytics warehouse.
              </div>
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">Best-performing fix types</h3>
                    </div>
                    {query.data.bestFixTypes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Not enough readable history yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {query.data.bestFixTypes.map((item) => (
                          <div key={`best-${item.experimentType}`} className="rounded-md border bg-muted/20 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{item.label}</p>
                              <Badge variant="secondary">Improved {item.improvedCount}</Badge>
                              <Badge variant="outline">Declined {item.declinedCount}</Badge>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Avg clicks {formatLift(item.averageClickLift)} · Avg RSVPs {formatLift(item.averageRsvpLift)} · Avg approx. purchases {formatLift(item.averageApproxPurchaseLift)}
                            </p>
                            {item.reuseSuggestion ? <p className="mt-2 text-sm">{item.reuseSuggestion}</p> : null}
                            {item.bestCampaignExample ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Example: <Link href={item.bestCampaignExample.campaignRoute} className="underline underline-offset-2">{item.bestCampaignExample.campaignName}</Link> — {item.bestCampaignExample.outcomeSummary}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">Weakest fix types</h3>
                    </div>
                    {query.data.weakestFixTypes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No weak patterns stand out yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {query.data.weakestFixTypes.map((item) => (
                          <div key={`weak-${item.experimentType}`} className="rounded-md border bg-muted/20 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{item.label}</p>
                              <Badge variant="outline">Readable runs {item.readableRunsCount}</Badge>
                              <Badge variant="outline">Declined {item.declinedCount}</Badge>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{item.confidenceNote}</p>
                            {item.reuseSuggestion ? <p className="mt-2 text-sm">{item.reuseSuggestion}</p> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Reusable fix patterns</h3>
                  </div>
                  {query.data.fixPatterns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Patterns will appear here once your own experiment history is strong enough to support a reusable read.</p>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {query.data.fixPatterns.map((pattern) => (
                        <div key={pattern.key} className="rounded-md border bg-muted/20 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Repeat2 className="h-4 w-4 text-muted-foreground" />
                            <p className="font-medium">{pattern.title}</p>
                            <Badge variant={confidenceVariant(pattern.confidence)}>{pattern.confidence} confidence</Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{pattern.summary}</p>
                          <p className="mt-2 text-sm">{pattern.reuseSuggestion}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{pattern.confidenceNote}</p>
                          {pattern.exampleCampaign ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Example: <Link href={pattern.exampleCampaign.campaignRoute} className="underline underline-offset-2">{pattern.exampleCampaign.campaignName}</Link>
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <BookOpenText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Fix type library</h3>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {query.data.items.map((item) => (
                      <div key={item.experimentType} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.label}</p>
                          <Badge variant="secondary">Runs {item.runsCount}</Badge>
                          <Badge variant="outline">Readable {item.readableRunsCount}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>Views {formatLift(item.averageViewLift)}</span>
                          <span>Clicks {formatLift(item.averageClickLift)}</span>
                          <span>Follows {formatLift(item.averageFollowLift)}</span>
                          <span>RSVPs {formatLift(item.averageRsvpLift)}</span>
                          <span>Approx. purchases {formatLift(item.averageApproxPurchaseLift)}</span>
                          <span>Approx. memberships {formatLift(item.averageApproxMembershipLift)}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Improved {item.improvedCount} · Flat {item.flatCount} · Declined {item.declinedCount} · Insufficient {item.insufficientDataCount}
                        </p>
                        {item.reuseSuggestion ? <p className="mt-2 text-sm">{item.reuseSuggestion}</p> : null}
                        <p className="mt-2 text-xs text-muted-foreground">{item.confidenceNote}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {query.data.attributionNotes.length ? (
              <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                <ul className="list-disc space-y-1 pl-5">
                  {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
