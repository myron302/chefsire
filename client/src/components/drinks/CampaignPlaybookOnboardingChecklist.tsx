import * as React from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, ClipboardList, Sparkles } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type CampaignPlaybookOnboardingStatus = "todo" | "ready" | "complete" | "warning";

export type CampaignPlaybookOnboardingChecklistItem = {
  key: string;
  label: string;
  status: CampaignPlaybookOnboardingStatus;
  note: string;
  targetRoute: string | null;
};

export type CampaignPlaybookOnboardingItem = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  isPlaybookApplied: boolean;
  appliedPlaybookProfileId: string | null;
  playbookAppliedAt: string | null;
  profile: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  checklist: CampaignPlaybookOnboardingChecklistItem[];
  summary: {
    totalCount: number;
    completeCount: number;
    warningCount: number;
    remainingCount: number;
    completedKeys: string[];
    nextRecommendedKey: string | null;
  };
  readinessState: string | null;
  readinessRoute: string | null;
  attributionNotes: string[];
  generatedAt: string;
};

function statusLabel(status: CampaignPlaybookOnboardingStatus) {
  switch (status) {
    case "warning":
      return "Needs attention";
    case "ready":
      return "Ready next";
    case "complete":
      return "Complete";
    default:
      return "To do";
  }
}

function statusVariant(status: CampaignPlaybookOnboardingStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "warning":
      return "destructive";
    case "ready":
      return "default";
    case "complete":
      return "secondary";
    default:
      return "outline";
  }
}

function StatusIcon({ status }: { status: CampaignPlaybookOnboardingStatus }) {
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (status === "ready") return <Sparkles className="h-4 w-4 text-primary" />;
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
}

export default function CampaignPlaybookOnboardingChecklist({
  items,
  compact = false,
  emptyMessage = "No onboarding steps are needed right now.",
}: {
  items: CampaignPlaybookOnboardingChecklistItem[];
  compact?: boolean;
  emptyMessage?: string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 rounded-full bg-muted/50 p-2">
                <StatusIcon status={item.status} />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.note}</p>
                {item.targetRoute ? (
                  <p className="text-xs text-muted-foreground">
                    Action hint: open the linked setup surface for this step.
                  </p>
                ) : null}
              </div>
            </div>

            {item.targetRoute ? (
              <Link href={item.targetRoute}>
                <Button size="sm" variant={compact ? "ghost" : "outline"} className="gap-1">
                  {compact ? "Open" : "Open setup"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CampaignPlaybookOnboardingSummaryChips({ item }: { item: CampaignPlaybookOnboardingItem }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <span className="rounded-full border px-2 py-1">{item.summary.completeCount}/{item.summary.totalCount} complete</span>
      {item.summary.warningCount > 0 ? <span className="rounded-full border px-2 py-1">{item.summary.warningCount} warning{item.summary.warningCount === 1 ? "" : "s"}</span> : null}
      {item.summary.remainingCount > 0 ? <span className="rounded-full border px-2 py-1">{item.summary.remainingCount} step{item.summary.remainingCount === 1 ? "" : "s"} left</span> : null}
      {item.profile?.name ? <span className="rounded-full border px-2 py-1">Playbook: {item.profile.name}</span> : null}
      {item.readinessState ? <span className="rounded-full border px-2 py-1">Readiness: {item.readinessState.replaceAll("_", " ")}</span> : null}
    </div>
  );
}

export function CampaignPlaybookOnboardingEmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-muted/50 p-2">
          <ClipboardList className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{title}</p>
          <p>{body}</p>
        </div>
      </div>
    </div>
  );
}
