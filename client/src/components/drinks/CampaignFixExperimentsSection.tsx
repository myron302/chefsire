import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, LineChart, PauseCircle, PlayCircle, Sparkles, StopCircle } from "lucide-react";
import { Link } from "wouter";

import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

type ExperimentStatus = "active" | "completed" | "canceled";
type OutcomeDirection = "improved" | "flat" | "declined" | "insufficient_data";

type CampaignSummary = {
  id: string;
  name: string;
  route: string;
  state: "upcoming" | "active" | "past";
};

type ExperimentItem = {
  id: string;
  campaignId: string;
  experimentType: ExperimentType;
  label: string | null;
  hypothesis: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: ExperimentStatus;
  createdAt: string;
  updatedAt: string;
  outcome: {
    comparisonWindowHours: number;
    beforeViews: number;
    afterViews: number;
    beforeClicks: number;
    afterClicks: number;
    beforeFollows: number;
    afterFollows: number;
    beforeRsvps: number;
    afterRsvps: number;
    beforeApproxPurchases: number;
    afterApproxPurchases: number;
    beforeApproxMemberships: number;
    afterApproxMemberships: number;
    outcomeDirection: OutcomeDirection;
    outcomeSummary: string;
    confidenceNote: string;
    afterWindowComplete: boolean;
    afterWindowHoursObserved: number;
  };
};

type ExperimentSuggestion = {
  experimentType: ExperimentType;
  label: string;
  reason: string;
  source: "bottleneck" | "timing_advisor";
};

type ExperimentsResponse = {
  ok: boolean;
  campaignId: string;
  items: ExperimentItem[];
  suggestedExperimentTypes: ExperimentSuggestion[];
  attributionNotes: string[];
  generatedAt: string;
};

type CampaignListResponse = {
  ok: boolean;
  items: CampaignSummary[];
};

const EXPERIMENT_OPTIONS: Array<{ value: ExperimentType; label: string }> = [
  { value: "strengthen_cta", label: "Strengthen CTA" },
  { value: "launch_promo", label: "Launch promo" },
  { value: "add_drop", label: "Add drop" },
  { value: "publish_update", label: "Publish update" },
  { value: "push_rsvp", label: "Push RSVP" },
  { value: "promote_membership", label: "Promote membership" },
  { value: "add_member_only_collection", label: "Add member-only collection" },
  { value: "shorten_unlock_delay", label: "Shorten unlock delay" },
  { value: "accelerate_public_unlock", label: "Accelerate public unlock" },
  { value: "spotlight_campaign", label: "Spotlight campaign" },
];

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function outcomeVariant(direction: OutcomeDirection): "default" | "secondary" | "outline" | "destructive" {
  switch (direction) {
    case "improved":
      return "default";
    case "declined":
      return "destructive";
    case "flat":
      return "secondary";
    default:
      return "outline";
  }
}

function outcomeLabel(direction: OutcomeDirection) {
  switch (direction) {
    case "improved":
      return "Improved";
    case "declined":
      return "Declined";
    case "flat":
      return "Flat";
    default:
      return "Insufficient data";
  }
}

function statusVariant(status: ExperimentStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "completed":
      return "secondary";
    case "canceled":
      return "outline";
    default:
      return "outline";
  }
}

function metricDelta(after: number, before: number) {
  const delta = after - before;
  if (delta === 0) return "No change";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

export default function CampaignFixExperimentsSection({
  campaignId,
  compact = false,
  title = "Campaign Fix Experiments",
  description = "Start a lightweight corrective action, then compare the 72-hour before/after window using existing campaign signals only.",
}: {
  campaignId?: string;
  compact?: boolean;
  title?: string;
  description?: string;
}) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [selectedCampaignId, setSelectedCampaignId] = React.useState(campaignId ?? "");
  const [form, setForm] = React.useState<{ experimentType: ExperimentType; label: string; hypothesis: string }>({
    experimentType: "strengthen_cta",
    label: "",
    hypothesis: "",
  });
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const campaignsQuery = useQuery<CampaignListResponse>({
    queryKey: ["/api/drinks/campaigns/creator", user?.id ?? "", "experiments"],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/creator/${encodeURIComponent(user?.id ?? "")}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaigns (${response.status})`);
      return {
        ok: true,
        items: Array.isArray(payload?.items)
          ? payload.items.map((item: any) => ({ id: String(item.id), name: String(item.name), route: String(item.route), state: item.state as CampaignSummary["state"] }))
          : [],
      };
    },
    enabled: Boolean(user?.id) && !campaignId,
  });

  const campaigns = campaignsQuery.data?.items ?? [];
  const activeCampaignId = campaignId ?? selectedCampaignId;
  const activeCampaign = campaigns.find((item) => item.id === activeCampaignId) ?? null;

  React.useEffect(() => {
    if (campaignId) {
      setSelectedCampaignId(campaignId);
      return;
    }
    if (!campaigns.length) {
      setSelectedCampaignId("");
      return;
    }
    if (!selectedCampaignId || !campaigns.some((item) => item.id === selectedCampaignId)) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaignId, campaigns, selectedCampaignId]);

  const experimentsQuery = useQuery<ExperimentsResponse>({
    queryKey: ["/api/drinks/campaigns/:id/experiments", activeCampaignId ?? "", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(activeCampaignId)}/experiments`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load experiments (${response.status})`);
      return payload as ExperimentsResponse;
    },
    enabled: Boolean(user?.id) && Boolean(activeCampaignId),
  });

  const invalidateExperiments = React.useCallback(async () => {
    if (!activeCampaignId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/:id/experiments", activeCampaignId, user?.id ?? ""] }),
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-funnel-bottlenecks", user?.id ?? ""] }),
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/creator", user?.id ?? ""] }),
    ]);
  }, [activeCampaignId, queryClient, user?.id]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!activeCampaignId) throw new Error("Select a campaign first.");
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(activeCampaignId)}/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          experimentType: form.experimentType,
          label: form.label.trim() || null,
          hypothesis: form.hypothesis.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to create experiment (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage("Experiment started.");
      setError("");
      setForm({ experimentType: form.experimentType, label: "", hypothesis: "" });
      await invalidateExperiments();
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to start experiment right now."));
      setMessage("");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ experimentId, action }: { experimentId: string; action: "complete" | "cancel" }) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(activeCampaignId ?? "")}/experiments/${encodeURIComponent(experimentId)}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to ${action} experiment (${response.status})`);
      return payload;
    },
    onSuccess: async (_payload, variables) => {
      setMessage(variables.action === "complete" ? "Experiment completed." : "Experiment canceled.");
      setError("");
      await invalidateExperiments();
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to update experiment right now."));
      setMessage("");
    },
  });

  const experiments = experimentsQuery.data?.items ?? [];

  return (
    <Card id={campaignId ? undefined : "campaign-fix-experiments"}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,220px),minmax(0,1fr)]">
          {!campaignId ? (
            <div className="space-y-2">
              <Label htmlFor="experiment-campaign">Campaign</Label>
              <select
                id="experiment-campaign"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedCampaignId}
                onChange={(event) => setSelectedCampaignId(event.target.value)}
              >
                <option value="">Select campaign</option>
                {campaigns.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              {activeCampaign ? <p className="text-xs text-muted-foreground">State: {activeCampaign.state}</p> : null}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              Start a small corrective action for this campaign only. Outcomes stay private to the owner and remain directional, not causal proof.
            </div>
          )}

          <div className="grid gap-3 rounded-lg border border-dashed p-4 md:grid-cols-[minmax(0,220px),minmax(0,1fr),auto]">
            <div className="space-y-2">
              <Label htmlFor="experiment-type">Experiment type</Label>
              <select
                id="experiment-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.experimentType}
                onChange={(event) => setForm((current) => ({ ...current, experimentType: event.target.value as ExperimentType }))}
              >
                {EXPERIMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="experiment-label">Label / hypothesis</Label>
              <Input id="experiment-label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="CTA copy refresh for launch week" />
            </div>
            <div className="flex items-end">
              <Button onClick={() => { setMessage(""); setError(""); createMutation.mutate(); }} disabled={createMutation.isPending || !activeCampaignId}>
                <PlayCircle className="mr-2 h-4 w-4" />
                {createMutation.isPending ? "Starting…" : "Start experiment"}
              </Button>
            </div>
            <div className="md:col-span-3 space-y-2">
              <Textarea value={form.hypothesis} onChange={(event) => setForm((current) => ({ ...current, hypothesis: event.target.value }))} placeholder="Optional: If we tighten the CTA or change the rollout timing, weak stages should improve in the next few days." className="min-h-[90px]" />
            </div>
          </div>
        </div>

        {experimentsQuery.data?.suggestedExperimentTypes?.length ? (
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Light recommendations aligned with existing bottlenecks / timing advice</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {experimentsQuery.data.suggestedExperimentTypes.map((item) => (
                <button
                  key={`${item.source}-${item.experimentType}`}
                  type="button"
                  className="rounded-full border px-3 py-1 text-left text-xs hover:bg-muted"
                  onClick={() => setForm((current) => ({ ...current, experimentType: item.experimentType, label: current.label || item.label }))}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground"> · {item.reason}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {campaignsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading campaigns…</p> : null}
        {campaignsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(campaignsQuery.error, "Unable to load campaigns right now.")}</p> : null}
        {experimentsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading experiment outcomes…</p> : null}
        {experimentsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(experimentsQuery.error, "Unable to load experiment outcomes right now.")}</p> : null}

        {!experimentsQuery.isLoading && activeCampaignId && experiments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            No experiments yet for this campaign. Start one small fix, then use the before/after cards here to check whether the weak stage or rollout signal actually moved.
          </div>
        ) : null}

        <div className="space-y-4">
          {experiments.map((experiment) => (
            <div key={experiment.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{experiment.label || EXPERIMENT_OPTIONS.find((option) => option.value === experiment.experimentType)?.label || experiment.experimentType}</h3>
                    <Badge variant={statusVariant(experiment.status)}>{experiment.status}</Badge>
                    <Badge variant={outcomeVariant(experiment.outcome.outcomeDirection)}>{outcomeLabel(experiment.outcome.outcomeDirection)}</Badge>
                    {!campaignId && activeCampaign ? <Badge variant="outline">{activeCampaign.name}</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Started {formatDateTime(experiment.startedAt)}</span>
                    <span>Ended {formatDateTime(experiment.endedAt)}</span>
                    <span>{experiment.outcome.afterWindowHoursObserved}/{experiment.outcome.comparisonWindowHours} after-hours observed</span>
                  </div>
                  {experiment.hypothesis ? <p className="text-sm text-muted-foreground">Hypothesis: {experiment.hypothesis}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!campaignId && activeCampaign ? <Link href={activeCampaign.route}><Button variant="outline" size="sm">Open campaign</Button></Link> : null}
                  {experiment.status === "active" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => statusMutation.mutate({ experimentId: experiment.id, action: "complete" })}
                        disabled={statusMutation.isPending}
                      >
                        <StopCircle className="mr-2 h-4 w-4" />
                        Mark completed
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => statusMutation.mutate({ experimentId: experiment.id, action: "cancel" })}
                        disabled={statusMutation.isPending}
                      >
                        <PauseCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className={`mt-4 grid gap-3 ${compact ? "md:grid-cols-3" : "md:grid-cols-6"}`}>
                {[
                  ["Views", experiment.outcome.beforeViews, experiment.outcome.afterViews],
                  ["Clicks", experiment.outcome.beforeClicks, experiment.outcome.afterClicks],
                  ["Follows", experiment.outcome.beforeFollows, experiment.outcome.afterFollows],
                  ["RSVPs", experiment.outcome.beforeRsvps, experiment.outcome.afterRsvps],
                  ["Approx. purchases", experiment.outcome.beforeApproxPurchases, experiment.outcome.afterApproxPurchases],
                  ["Approx. memberships", experiment.outcome.beforeApproxMemberships, experiment.outcome.afterApproxMemberships],
                ].map(([label, before, after]) => (
                  <div key={String(label)} className="rounded-md border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-medium">Before {before}</p>
                    <p className="text-sm font-medium">After {after}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Δ {metricDelta(Number(after), Number(before))}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)]">
                <div className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <LineChart className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">Before / after outcome</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{experiment.outcome.outcomeSummary}</p>
                </div>
                <div className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">Confidence note</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{experiment.outcome.confidenceNote}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {experimentsQuery.data?.attributionNotes?.length ? (
          <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              {experimentsQuery.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
