import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Archive, Copy, Layers3, Megaphone, Repeat2, Rocket, Sparkles, Users } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type CampaignLifecycleAction =
  | "keep_running"
  | "add_phase_two_drop"
  | "shift_to_membership"
  | "launch_promo_push"
  | "archive_campaign"
  | "clone_for_next_season"
  | "refresh_cta"
  | "convert_to_template"
  | "close_with_recap";

type CampaignLifecyclePhase =
  | "warming_up"
  | "momentum"
  | "conversion_push"
  | "member_arc"
  | "wrap_up"
  | "archived"
  | "evergreen_candidate";

type CampaignLifecycleConfidence = "high" | "medium" | "low";

export type CampaignLifecycleSuggestion = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  currentState: "upcoming" | "active" | "past";
  inferredPhase: CampaignLifecyclePhase;
  suggestedLifecycleAction: CampaignLifecycleAction;
  title: string;
  message: string;
  rationale: string;
  confidence: CampaignLifecycleConfidence;
  supportingSignals: string[];
  suggestedRoute: string | null;
};

type CampaignLifecycleSuggestionsResponse = {
  ok: boolean;
  userId: string;
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    archivedCampaigns: number;
    keepRunningCount: number;
    phaseShiftCount: number;
    archiveCount: number;
    cloneOrTemplateCount: number;
    membershipArcCount: number;
  };
  items: CampaignLifecycleSuggestion[];
  attributionNotes: string[];
  generatedAt: string;
};

function lifecycleActionIcon(action: CampaignLifecycleAction) {
  switch (action) {
    case "add_phase_two_drop":
      return <Rocket className="h-4 w-4" />;
    case "shift_to_membership":
      return <Users className="h-4 w-4" />;
    case "launch_promo_push":
      return <Megaphone className="h-4 w-4" />;
    case "archive_campaign":
      return <Archive className="h-4 w-4" />;
    case "clone_for_next_season":
      return <Repeat2 className="h-4 w-4" />;
    case "convert_to_template":
      return <Copy className="h-4 w-4" />;
    case "refresh_cta":
      return <ArrowRightLeft className="h-4 w-4" />;
    case "close_with_recap":
      return <Layers3 className="h-4 w-4" />;
    case "keep_running":
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function confidenceVariant(confidence: CampaignLifecycleConfidence): "default" | "secondary" | "outline" {
  switch (confidence) {
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "low":
    default:
      return "outline";
  }
}

function confidenceLabel(confidence: CampaignLifecycleConfidence) {
  switch (confidence) {
    case "high":
      return "Higher confidence";
    case "medium":
      return "Directional";
    case "low":
    default:
      return "Light read";
  }
}

function phaseLabel(phase: CampaignLifecyclePhase) {
  switch (phase) {
    case "warming_up":
      return "Warming up";
    case "momentum":
      return "Momentum";
    case "conversion_push":
      return "Conversion push";
    case "member_arc":
      return "Membership arc";
    case "wrap_up":
      return "Wrap-up";
    case "archived":
      return "Archived";
    case "evergreen_candidate":
      return "Evergreen candidate";
    default:
      return phase.replaceAll("_", " ");
  }
}

function actionLabel(action: CampaignLifecycleAction) {
  switch (action) {
    case "keep_running":
      return "Keep running";
    case "add_phase_two_drop":
      return "Add phase-two drop";
    case "shift_to_membership":
      return "Shift to membership";
    case "launch_promo_push":
      return "Launch promo push";
    case "archive_campaign":
      return "Archive campaign";
    case "clone_for_next_season":
      return "Clone for next season";
    case "refresh_cta":
      return "Refresh CTA";
    case "convert_to_template":
      return "Convert to template";
    case "close_with_recap":
      return "Close with recap";
    default:
      return action.replaceAll("_", " ");
  }
}

export function CampaignLifecycleSuggestionPanel({
  suggestion,
  compact = false,
}: {
  suggestion: CampaignLifecycleSuggestion;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-lg border ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              {lifecycleActionIcon(suggestion.suggestedLifecycleAction)}
              {suggestion.title}
            </span>
            <Badge variant="outline">{phaseLabel(suggestion.inferredPhase)}</Badge>
            <Badge variant="outline">{suggestion.currentState}</Badge>
            <Badge variant={confidenceVariant(suggestion.confidence)}>{confidenceLabel(suggestion.confidence)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{suggestion.message}</p>
        </div>
        {!compact ? (
          <Link href={suggestion.campaignRoute}><Button variant="outline" size="sm">Open campaign</Button></Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-md bg-muted/30 p-3 text-sm">
          <p className="font-medium text-foreground">Why this next</p>
          <p className="mt-1 text-muted-foreground">{suggestion.rationale}</p>
        </div>
        <div className="rounded-md bg-muted/30 p-3 text-sm">
          <p className="font-medium text-foreground">Suggested action</p>
          <p className="mt-1 text-muted-foreground">{actionLabel(suggestion.suggestedLifecycleAction)}</p>
        </div>
      </div>

      {suggestion.supportingSignals.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestion.supportingSignals.map((signal) => (
            <span key={signal} className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
              {signal}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={suggestion.campaignRoute}><Button size="sm">View campaign</Button></Link>
        {suggestion.suggestedRoute ? (
          <Link href={suggestion.suggestedRoute}><Button size="sm" variant="outline">Open next move</Button></Link>
        ) : null}
      </div>
    </div>
  );
}

export default function CampaignLifecycleSuggestionsSection() {
  const { user } = useUser();

  const query = useQuery<CampaignLifecycleSuggestionsResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-lifecycle-suggestions", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-lifecycle-suggestions", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign lifecycle suggestions (${response.status})`);
      }
      return payload as CampaignLifecycleSuggestionsResponse;
    },
    enabled: Boolean(user?.id),
  });

  return (
    <Card id="campaign-lifecycle-suggestions">
      <CardHeader>
        <CardTitle>Campaign Lifecycle Suggestions</CardTitle>
        <CardDescription>
          Lightweight lifecycle guidance for what phase a campaign seems to be in next. This stays separate from health, recovery, recommendations, and retrospectives.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading campaign lifecycle suggestions…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign lifecycle suggestions right now."}</p> : null}

        {query.data ? (
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Campaigns reviewed</p>
              <p className="text-2xl font-semibold">{query.data.summary.totalCampaigns}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Keep running</p>
              <p className="text-2xl font-semibold">{query.data.summary.keepRunningCount}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Phase shifts</p>
              <p className="text-2xl font-semibold">{query.data.summary.phaseShiftCount}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Membership arcs</p>
              <p className="text-2xl font-semibold">{query.data.summary.membershipArcCount}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Clone / template</p>
              <p className="text-2xl font-semibold">{query.data.summary.cloneOrTemplateCount}</p>
            </div>
          </div>
        ) : null}

        {!query.isLoading && query.data && query.data.items.length === 0 ? (
          <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            No lifecycle suggestions yet. Once campaigns collect a little state, momentum, or wrap-up signal, this section will start suggesting phase changes.
          </div>
        ) : null}

        <div className="space-y-4">
          {(query.data?.items ?? []).map((suggestion) => (
            <CampaignLifecycleSuggestionPanel key={suggestion.campaignId} suggestion={suggestion} />
          ))}
        </div>

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How this stays lightweight</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
