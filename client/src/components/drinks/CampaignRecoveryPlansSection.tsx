import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type CampaignRecoveryActionType =
  | "publish_update"
  | "add_drop"
  | "strengthen_cta"
  | "launch_promo"
  | "push_rsvp"
  | "add_member_only_collection"
  | "promote_membership"
  | "celebrate_milestone"
  | "clone_and_refresh"
  | "close_out_campaign";

type CampaignRecoveryPriority = "urgent" | "high" | "medium" | "low" | "none";

type CampaignRecoveryAction = {
  actionType: CampaignRecoveryActionType;
  label: string;
  description: string;
  suggestedRoute: string | null;
  supportingSignals: string[];
};

type CampaignRecoveryPlan = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  status: "upcoming" | "active" | "past";
  healthState: "thriving" | "healthy" | "watch" | "at_risk" | "completed";
  healthScore: number;
  actionState: "action_needed" | "monitor" | "no_action_needed";
  riskReason: string | null;
  rescuePriority: CampaignRecoveryPriority;
  suggestedActions: CampaignRecoveryAction[];
  confidenceNote: string | null;
  recommendationTitle: string | null;
  generatedFrom: string[];
};

type CampaignRecoveryPlansResponse = {
  ok: boolean;
  userId: string;
  summary: {
    totalCampaigns: number;
    actionNeededCount: number;
    monitorCount: number;
    noActionNeededCount: number;
    atRiskCount: number;
    watchCount: number;
  };
  items: CampaignRecoveryPlan[];
  attributionNotes: string[];
  generatedAt: string;
};

function healthBadgeVariant(state: CampaignRecoveryPlan["healthState"]): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "thriving":
      return "default";
    case "healthy":
      return "secondary";
    case "at_risk":
      return "destructive";
    case "watch":
    case "completed":
    default:
      return "outline";
  }
}

function healthLabel(state: CampaignRecoveryPlan["healthState"]) {
  switch (state) {
    case "at_risk":
      return "At risk";
    case "thriving":
      return "Thriving";
    case "healthy":
      return "Healthy";
    case "watch":
      return "Watch";
    case "completed":
    default:
      return "Completed";
  }
}

function priorityVariant(priority: CampaignRecoveryPriority): "destructive" | "default" | "secondary" | "outline" {
  switch (priority) {
    case "urgent":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "low":
    case "none":
    default:
      return "outline";
  }
}

function priorityLabel(priority: CampaignRecoveryPriority) {
  switch (priority) {
    case "urgent":
      return "Urgent rescue";
    case "high":
      return "High priority";
    case "medium":
      return "Do soon";
    case "low":
      return "Monitor";
    case "none":
    default:
      return "No action needed";
  }
}

function actionLabel(actionType: CampaignRecoveryActionType) {
  return actionType.replaceAll("_", " ");
}

export default function CampaignRecoveryPlansSection() {
  const { user } = useUser();

  const query = useQuery<CampaignRecoveryPlansResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-recovery-plans", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-recovery-plans", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign recovery plans (${response.status})`);
      }
      return payload as CampaignRecoveryPlansResponse;
    },
    enabled: Boolean(user?.id),
  });

  const actionNeeded = (query.data?.items ?? []).filter((item) => item.actionState === "action_needed");
  const monitorItems = (query.data?.items ?? []).filter((item) => item.actionState === "monitor");

  return (
    <Card id="campaign-recovery-plans">
      <CardHeader>
        <CardTitle>Recovery Plans / Rescue Actions</CardTitle>
        <CardDescription>
          Focused rescue paths for campaigns that are slipping. Health still shows current status, recommendations stay broader, and recovery plans only appear when the watch / at-risk signals suggest practical intervention.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading recovery plans…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign recovery plans right now."}</p> : null}

        {query.data ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Need action now</p>
              <p className="text-2xl font-semibold">{query.data.summary.actionNeededCount}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Monitor</p>
              <p className="text-2xl font-semibold">{query.data.summary.monitorCount}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Watch</p>
              <p className="text-2xl font-semibold">{query.data.summary.watchCount}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">At risk</p>
              <p className="text-2xl font-semibold">{query.data.summary.atRiskCount}</p>
            </div>
          </div>
        ) : null}

        {!query.isLoading && query.data && actionNeeded.length === 0 && monitorItems.length === 0 ? (
          <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            No campaigns currently need rescue actions. If something slips into watch or at-risk, this panel will turn the existing health signals into a short ordered recovery path.
          </div>
        ) : null}

        {actionNeeded.length ? (
          <div className="space-y-3 rounded-lg border border-amber-300/60 bg-amber-50/40 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Campaigns needing action</p>
                <p className="text-sm text-muted-foreground">Ordered rescue actions based on the exact health and recommendation signals already detected.</p>
              </div>
              <Badge variant="outline">{actionNeeded.length} active rescue plans</Badge>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {actionNeeded.map((plan) => (
                <div key={plan.campaignId} className="rounded-lg border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold">{plan.campaignName}</p>
                        <Badge variant={healthBadgeVariant(plan.healthState)}>{healthLabel(plan.healthState)}</Badge>
                        <Badge variant={priorityVariant(plan.rescuePriority)}>{priorityLabel(plan.rescuePriority)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Why it is slipping: {plan.riskReason ?? "The health layer flagged this campaign as needing attention."}
                      </p>
                    </div>
                    <Link href={plan.campaignRoute}><Button size="sm" variant="outline">Open campaign</Button></Link>
                  </div>

                  <div className="mt-4 space-y-3">
                    {plan.suggestedActions.map((action, index) => (
                      <div key={`${plan.campaignId}-${action.actionType}`} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <ShieldAlert className="h-4 w-4 text-amber-600" />
                            <span>Step {index + 1}: {action.label}</span>
                          </div>
                          <Badge variant="outline" className="capitalize">{actionLabel(action.actionType)}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{action.description}</p>
                        {action.supportingSignals.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {action.supportingSignals.map((signal) => (
                              <span key={signal} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground">
                                <ArrowRight className="h-3 w-3" />
                                {signal}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {action.suggestedRoute ? (
                          <div className="mt-3">
                            <Link href={action.suggestedRoute}><Button size="sm" variant="ghost">Take action</Button></Link>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {plan.confidenceNote ? (
                    <div className="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">Why this plan</p>
                      <p className="mt-1">{plan.confidenceNote}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {monitorItems.length ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Monitor only</p>
              <p className="text-sm text-muted-foreground">Flagged campaigns without a strong enough signal for a full rescue plan yet.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {monitorItems.map((plan) => (
                <div key={plan.campaignId} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{plan.campaignName}</p>
                      <Badge variant={healthBadgeVariant(plan.healthState)}>{healthLabel(plan.healthState)}</Badge>
                    </div>
                    <Link href={plan.campaignRoute}><Button size="sm" variant="ghost">Open</Button></Link>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.riskReason ?? "This campaign is on watch, but the current signals do not justify a stronger rescue sequence yet."}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground"><Sparkles className="h-4 w-4" />How this stays distinct</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        {query.data?.summary.noActionNeededCount ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {query.data.summary.noActionNeededCount} campaign{query.data.summary.noActionNeededCount === 1 ? " is" : "s are"} currently healthy enough to avoid rescue actions.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
