import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Lightbulb, Sparkles, Target } from "lucide-react";
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

type FixMatchingItem = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  campaignStatus: "upcoming" | "active" | "past";
  healthState: "thriving" | "healthy" | "watch" | "at_risk" | "completed";
  primaryProblem: string;
  recommendedExperimentType: ExperimentType;
  recommendationTitle: string;
  recommendationMessage: string;
  matchReason: string;
  confidence: "low" | "medium" | "high";
  basedOnHistory: string | null;
  supportingSignals: string[];
  alternativeFixes: Array<{
    experimentType: ExperimentType;
    label: string;
    reason: string;
    confidence: "low" | "medium" | "high";
  }>;
};

type FixMatchingResponse = {
  ok: boolean;
  userId: string;
  campaignId: string | null;
  summary: {
    campaignsConsidered: number;
    matchedCampaigns: number;
    highConfidenceCount: number;
    historyBackedCount: number;
    watchOrAtRiskCount: number;
  };
  items: FixMatchingItem[];
  attributionNotes: string[];
  generatedAt: string;
};

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function badgeVariant(value: FixMatchingItem["confidence"]): "default" | "secondary" | "outline" {
  switch (value) {
    case "high":
      return "default";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

function healthBadgeVariant(value: FixMatchingItem["healthState"]): "default" | "secondary" | "outline" | "destructive" {
  switch (value) {
    case "at_risk":
      return "destructive";
    case "watch":
      return "secondary";
    case "healthy":
    case "thriving":
      return "default";
    default:
      return "outline";
  }
}

export default function CampaignFixMatchingSection() {
  const { user } = useUser();

  const query = useQuery<FixMatchingResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-fix-matching", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-fix-matching", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign fix matching (${response.status})`);
      return payload as FixMatchingResponse;
    },
    enabled: Boolean(user?.id),
  });

  return (
    <Card id="campaign-fix-matching">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Campaign Fix Matching / Best Next Fix</CardTitle>
            <CardDescription>
              Personalized, creator-private fix matching for campaigns that look stuck, risky, or bottlenecked. This stays rules-based and only reuses the drinks platform signals you already track.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/creator-dashboard#campaign-fix-experiments">
              <Button variant="outline" size="sm">Run a fix</Button>
            </Link>
            <Link href="/drinks/creator-dashboard#campaign-experiment-library">
              <Button variant="ghost" size="sm">Review history</Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Matching best next fixes…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{readErrorMessage(query.error, "Unable to load campaign fix matching right now.")}</p> : null}

        {query.data ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns considered</p>
                <p className="mt-1 text-2xl font-semibold">{query.data.summary.campaignsConsidered}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Matches returned</p>
                <p className="mt-1 text-2xl font-semibold">{query.data.summary.matchedCampaigns}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">High confidence</p>
                <p className="mt-1 text-2xl font-semibold">{query.data.summary.highConfidenceCount}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">History-backed</p>
                <p className="mt-1 text-2xl font-semibold">{query.data.summary.historyBackedCount}</p>
              </div>
            </div>

            {query.data.items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                No current campaigns need a fix match right now. Once a campaign starts slipping, showing bottlenecks, or falling behind on goals, this section will surface the lightest next experiment to try.
              </div>
            ) : (
              <div className="space-y-4">
                {query.data.items.map((item) => (
                  <div key={item.campaignId} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={item.campaignRoute} className="font-semibold underline-offset-2 hover:underline">
                            {item.campaignName}
                          </Link>
                          <Badge variant={healthBadgeVariant(item.healthState)}>{item.healthState.replaceAll("_", " ")}</Badge>
                          <Badge variant={badgeVariant(item.confidence)}>{item.confidence} confidence</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.primaryProblem}</p>
                      </div>
                      <Badge variant="outline">{item.campaignStatus}</Badge>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr),minmax(280px,1fr)]">
                      <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                        <div className="flex items-start gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                          <div className="space-y-1">
                            <p className="font-medium">{item.recommendationTitle}</p>
                            <p className="text-sm text-muted-foreground">{item.recommendationMessage}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Target className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                          <p className="text-sm">{item.matchReason}</p>
                        </div>
                        {item.basedOnHistory ? (
                          <div className="flex items-start gap-2 rounded-md border bg-background p-3">
                            <Lightbulb className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                            <div className="space-y-1">
                              <p className="text-sm font-medium">Based on your own history</p>
                              <p className="text-sm text-muted-foreground">{item.basedOnHistory}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-lg border p-4">
                          <p className="text-sm font-medium">Supporting signals</p>
                          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {item.supportingSignals.map((signal) => (
                              <li key={signal} className="flex items-start gap-2">
                                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                                <span>{signal}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {item.alternativeFixes.length ? (
                          <div className="rounded-lg border p-4">
                            <p className="text-sm font-medium">Alternative fixes</p>
                            <div className="mt-3 space-y-3">
                              {item.alternativeFixes.map((alternative) => (
                                <div key={`${item.campaignId}-${alternative.experimentType}`} className="rounded-md border bg-muted/20 p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{alternative.label}</p>
                                    <Badge variant={badgeVariant(alternative.confidence)}>{alternative.confidence}</Badge>
                                  </div>
                                  <p className="mt-2 text-sm text-muted-foreground">{alternative.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {query.data.attributionNotes.length ? (
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-medium">How matching works</p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {query.data.attributionNotes.map((note) => (
                    <li key={note}>• {note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
