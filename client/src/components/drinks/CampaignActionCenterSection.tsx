import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Archive,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Goal,
  Megaphone,
  PlusCircle,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";

export type CampaignActionCenterItem = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  actionKey: string;
  actionType:
    | "add_drop"
    | "publish_update"
    | "strengthen_cta"
    | "launch_promo"
    | "push_rsvp"
    | "add_member_only_collection"
    | "promote_membership"
    | "celebrate_milestone"
    | "clone_campaign"
    | "archive_campaign"
    | "close_with_recap"
    | "refresh_campaign_copy"
    | "review_goal_progress";
  sourceKey: string;
  sourceSignature: string;
  title: string;
  message: string;
  priority: "urgent" | "high" | "medium" | "low";
  sourceType: "recommendation" | "recovery" | "lifecycle" | "goal" | "milestone" | "health";
  sourceTypes: Array<"recommendation" | "recovery" | "lifecycle" | "goal" | "milestone" | "health">;
  targetRoute: string | null;
  targetLabel: string | null;
  supportingSignals: string[];
  sourceContexts: string[];
  state: "open" | "dismissed" | "snoozed" | "completed";
  snoozedUntil: string | null;
};

type CampaignActionCenterResponse = {
  ok: boolean;
  userId: string;
  campaignId: string | null;
  summary: {
    totalActions: number;
    campaignsWithActions: number;
    urgentCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    hiddenCount: number;
    snoozedCount: number;
    dismissedCount: number;
    completedCount: number;
  };
  items: CampaignActionCenterItem[];
  recentlyCompleted: CampaignActionCenterItem[];
  attributionNotes: string[];
  generatedAt: string;
};

type CampaignActionCenterSectionProps = {
  campaignId?: string | null;
  compact?: boolean;
  showShortcuts?: boolean;
  title?: string;
  description?: string;
};

function priorityVariant(priority: CampaignActionCenterItem["priority"]): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case "urgent":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "low":
    default:
      return "outline";
  }
}

function sourceLabel(source: CampaignActionCenterItem["sourceType"]) {
  switch (source) {
    case "recommendation":
      return "Recommendation";
    case "recovery":
      return "Recovery";
    case "lifecycle":
      return "Lifecycle";
    case "goal":
      return "Goal";
    case "milestone":
      return "Milestone";
    case "health":
    default:
      return "Health";
  }
}

function actionIcon(actionType: CampaignActionCenterItem["actionType"]) {
  switch (actionType) {
    case "add_drop":
    case "add_member_only_collection":
      return <PlusCircle className="h-4 w-4" aria-hidden />;
    case "launch_promo":
    case "promote_membership":
    case "publish_update":
      return <Megaphone className="h-4 w-4" aria-hidden />;
    case "push_rsvp":
      return <Rocket className="h-4 w-4" aria-hidden />;
    case "strengthen_cta":
      return <Target className="h-4 w-4" aria-hidden />;
    case "celebrate_milestone":
      return <Trophy className="h-4 w-4" aria-hidden />;
    case "clone_campaign":
    case "refresh_campaign_copy":
      return <Copy className="h-4 w-4" aria-hidden />;
    case "archive_campaign":
    case "close_with_recap":
      return <Archive className="h-4 w-4" aria-hidden />;
    case "review_goal_progress":
    default:
      return <Goal className="h-4 w-4" aria-hidden />;
  }
}

function formatSnoozeLabel(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `Snoozed until ${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

const QUICK_SHORTCUTS = [
  { href: "/drinks/creator-dashboard#campaigns", label: "Campaigns", description: "Edit arcs, links, and clone-ready campaigns.", icon: <Sparkles className="h-4 w-4" aria-hidden /> },
  { href: "/drinks/creator-dashboard#drops", label: "Drops", description: "Add a launch beat or RSVP destination.", icon: <Rocket className="h-4 w-4" aria-hidden /> },
  { href: "/drinks/creator-dashboard#posts", label: "Posts", description: "Publish updates, milestone notes, or recaps.", icon: <Megaphone className="h-4 w-4" aria-hidden /> },
  { href: "/drinks/creator-dashboard#promotions", label: "Promos", description: "Launch or refresh a lightweight offer.", icon: <Zap className="h-4 w-4" aria-hidden /> },
  { href: "/drinks/creator-dashboard#membership", label: "Membership", description: "Promote member value or shift an arc.", icon: <Target className="h-4 w-4" aria-hidden /> },
  { href: "/drinks/collections", label: "Collections", description: "Link premium or member-only destinations.", icon: <PlusCircle className="h-4 w-4" aria-hidden /> },
] as const;

export default function CampaignActionCenterSection({
  campaignId,
  compact = false,
  showShortcuts = true,
  title = "Campaign Action Center",
  description = "Prioritized next moves for your campaigns. This is the action layer only — health, recommendations, recovery, and lifecycle guidance still stay in their own sections.",
}: CampaignActionCenterSectionProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingActionKey, setPendingActionKey] = React.useState<string | null>(null);

  const query = useQuery<CampaignActionCenterResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-action-center", campaignId ?? "all", user?.id ?? ""],
    queryFn: async () => {
      const search = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
      const response = await fetch(`/api/drinks/creator-dashboard/campaign-action-center${search}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign action center (${response.status})`);
      }
      return payload as CampaignActionCenterResponse;
    },
    enabled: Boolean(user?.id),
  });

  const actionStateMutation = useMutation({
    mutationFn: async ({
      actionKey,
      verb,
      body,
    }: {
      actionKey: string;
      verb: "dismiss" | "snooze" | "complete" | "reopen";
      body?: Record<string, unknown>;
    }) => {
      const response = await fetch(`/api/drinks/creator-dashboard/campaign-actions/${encodeURIComponent(actionKey)}/${verb}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body ?? {}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to ${verb} action`);
      }
      return payload as { ok: boolean; state: string; snoozedUntil?: string };
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-action-center"] });
      setPendingActionKey(null);
      const label = variables.verb === "dismiss"
        ? "Action dismissed"
        : variables.verb === "snooze"
          ? "Action snoozed for 7 days"
          : variables.verb === "complete"
            ? "Action marked done"
            : "Action reopened";
      toast({ title: label });
    },
    onError: (error) => {
      setPendingActionKey(null);
      toast({
        title: "Could not update action",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateActionState = React.useCallback((item: CampaignActionCenterItem, verb: "dismiss" | "snooze" | "complete" | "reopen") => {
    setPendingActionKey(item.actionKey);
    actionStateMutation.mutate({
      actionKey: item.actionKey,
      verb,
      body: verb === "snooze"
        ? { campaignId: item.campaignId, durationDays: 7 }
        : { campaignId: item.campaignId },
    });
  }, [actionStateMutation]);

  const items = React.useMemo(() => (compact ? (query.data?.items ?? []).slice(0, 4) : (query.data?.items ?? []).slice(0, 8)), [compact, query.data?.items]);
  const recentlyCompleted = React.useMemo(
    () => (compact ? (query.data?.recentlyCompleted ?? []).slice(0, 2) : (query.data?.recentlyCompleted ?? []).slice(0, 4)),
    [compact, query.data?.recentlyCompleted],
  );

  return (
    <Card id={campaignId ? undefined : "campaign-action-center"}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {query.data ? (
            <div className="flex flex-wrap gap-2">
              {query.data.summary.urgentCount > 0 ? <Badge variant="destructive">{query.data.summary.urgentCount} urgent</Badge> : null}
              {query.data.summary.highCount > 0 ? <Badge variant="default">{query.data.summary.highCount} high</Badge> : null}
              {query.data.summary.hiddenCount > 0 ? <Badge variant="secondary">{query.data.summary.hiddenCount} hidden</Badge> : null}
              <Badge variant="outline">{query.data.summary.campaignsWithActions} campaigns</Badge>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showShortcuts && !compact ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {QUICK_SHORTCUTS.map((shortcut) => (
              <Link key={shortcut.href} href={shortcut.href} className="rounded-lg border bg-muted/20 p-3 text-sm transition-colors hover:bg-muted/40">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 rounded-full border p-1 text-muted-foreground">{shortcut.icon}</span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 font-medium text-foreground">
                      <span>{shortcut.label}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </div>
                    <p className="text-muted-foreground">{shortcut.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading prioritized campaign actions…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign actions right now."}</p> : null}

        {query.data && items.length === 0 && recentlyCompleted.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No action cards are queued right now. That means the recommendation, recovery, lifecycle, goal, and milestone layers are not currently converging on a concrete next move.
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className={compact ? "space-y-3" : "grid gap-3 xl:grid-cols-2"}>
            {items.map((item) => (
              <div key={item.actionKey} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {actionIcon(item.actionType)}
                        {item.campaignName}
                      </span>
                      <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                      <Badge variant="outline">{sourceLabel(item.sourceType)}</Badge>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={item.campaignRoute}>
                      <Button size="sm" variant="ghost">Campaign</Button>
                    </Link>
                    {item.targetRoute ? (
                      <Link href={item.targetRoute}>
                        <Button size="sm">{item.targetLabel ?? "Open action"}</Button>
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {item.sourceTypes.map((source) => (
                    <span key={source} className="rounded-full border px-2 py-1">
                      {sourceLabel(source)}
                    </span>
                  ))}
                </div>

                {item.supportingSignals.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {item.supportingSignals.map((signal) => (
                      <span key={signal} className="rounded-full border border-dashed px-2 py-1">{signal}</span>
                    ))}
                  </div>
                ) : null}

                {item.sourceContexts.length > 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Consolidated from {item.sourceContexts.join(" · ")}.
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {formatSnoozeLabel(item.snoozedUntil) ? (
                      <span className="rounded-full border px-2 py-1">{formatSnoozeLabel(item.snoozedUntil)}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateActionState(item, "dismiss")}
                      disabled={actionStateMutation.isPending && pendingActionKey === item.actionKey}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateActionState(item, "snooze")}
                      disabled={actionStateMutation.isPending && pendingActionKey === item.actionKey}
                    >
                      Snooze 7d
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateActionState(item, "complete")}
                      disabled={actionStateMutation.isPending && pendingActionKey === item.actionKey}
                    >
                      Mark done
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {recentlyCompleted.length > 0 ? (
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">Recently completed</p>
                <p className="text-xs text-muted-foreground">
                  Completed actions stay out of the main queue until the underlying signal changes.
                </p>
              </div>
              {query.data?.summary.completedCount ? <Badge variant="outline">{query.data.summary.completedCount} completed</Badge> : null}
            </div>
            <div className="mt-3 space-y-2">
              {recentlyCompleted.map((item) => (
                <div key={`${item.actionKey}:completed`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3 text-sm">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                      <span className="font-medium">{item.title}</span>
                      <Badge variant="outline">{item.campaignName}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.message}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={item.targetRoute ?? item.campaignRoute}>
                      <Button size="sm" variant="ghost">Open</Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateActionState(item, "reopen")}
                      disabled={actionStateMutation.isPending && pendingActionKey === item.actionKey}
                    >
                      Reopen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Why this stays lightweight</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.slice(0, 3).map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
