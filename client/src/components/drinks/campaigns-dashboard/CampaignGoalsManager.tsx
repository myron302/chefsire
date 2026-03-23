import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { campaignGoalTypeLabel, readErrorMessage } from "./utils";
import { type CampaignGoalItem, type CampaignGoalType, type CampaignGoalsResponse } from "./types";

export default function CampaignGoalsManager({
  campaign,
  onChanged,
}: {
  campaign: CreatorCampaignItem | null;
  onChanged: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({
    id: "",
    goalType: "followers" as CampaignGoalType,
    targetValue: "100",
    label: "",
  });

  React.useEffect(() => {
    setMessage("");
    setError("");
    setForm({ id: "", goalType: "followers", targetValue: "100", label: "" });
  }, [campaign?.id]);

  const goalsQuery = useQuery<CampaignGoalsResponse>({
    queryKey: ["/api/drinks/campaigns/goals", campaign?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/goals`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign goals (${response.status})`);
      return payload as CampaignGoalsResponse;
    },
    enabled: Boolean(campaign?.id),
  });

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/goals", campaign?.id ?? ""] }),
      onChanged(),
    ]);
  }, [campaign?.id, onChanged, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        form.id
          ? `/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/goals/${encodeURIComponent(form.id)}`
          : `/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/goals`,
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            goalType: form.goalType,
            targetValue: Number(form.targetValue),
            label: form.label.trim() || null,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to save campaign goal (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage(form.id ? "Goal updated." : "Goal created.");
      setError("");
      setForm({ id: "", goalType: "followers", targetValue: "100", label: "" });
      await refresh();
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to save campaign goal right now."));
      setMessage("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/goals/${encodeURIComponent(goalId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to delete campaign goal (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage("Goal deleted.");
      setError("");
      setForm({ id: "", goalType: "followers", targetValue: "100", label: "" });
      await refresh();
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to delete campaign goal right now."));
      setMessage("");
    },
  });

  if (!campaign) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Goals / progress</CardTitle>
          <CardDescription>Select a campaign first, then set one or two concrete targets to keep the story arc accountable without turning it into an OKR suite.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const goals = goalsQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals / progress · {campaign.name}</CardTitle>
        <CardDescription>
          Creator-set targets stay separate from system milestones. Progress is computed from existing campaign analytics, not manually entered.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),160px,160px]">
          <div className="space-y-2">
            <Label htmlFor="goal-label">Label</Label>
            <Input id="goal-label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Summer push follower target" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-type">Goal type</Label>
            <select id="goal-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.goalType} onChange={(event) => setForm((current) => ({ ...current, goalType: event.target.value as CampaignGoalType }))}>
              {campaignGoalTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-target">Target</Label>
            <Input id="goal-target" type="number" min={1} step={1} value={form.targetValue} onChange={(event) => setForm((current) => ({ ...current, targetValue: event.target.value }))} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setMessage(""); setError(""); saveMutation.mutate(); }} disabled={saveMutation.isPending || Number(form.targetValue) <= 0}>
            {saveMutation.isPending ? "Saving…" : form.id ? "Update goal" : "Add goal"}
          </Button>
          <Button variant="outline" onClick={() => setForm({ id: "", goalType: "followers", targetValue: "100", label: "" })}>Reset</Button>
        </div>

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {goalsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading goals…</p> : null}
        {goalsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(goalsQuery.error, "Unable to load campaign goals right now.")}</p> : null}

        <div className="grid gap-3 xl:grid-cols-2">
          {goals.map((goal) => (
            <div key={goal.id} className="rounded-md border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{campaignGoalTypeLabel(goal.goalType)}</span>
                    {goal.isComplete ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Complete</span> : null}
                  </div>
                  <p className="font-medium">{goal.label?.trim() || campaignGoalTypeLabel(goal.goalType)}</p>
                  <p className="text-sm text-muted-foreground">{goal.metricLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setForm({
                    id: goal.id,
                    goalType: goal.goalType,
                    targetValue: String(goal.targetValue),
                    label: goal.label ?? "",
                  })}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(goal.id)} disabled={deleteMutation.isPending}>
                    {deleteMutation.isPending ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{goal.currentValue} / {goal.targetValue}</span>
                  <span className="text-muted-foreground">{goal.percentComplete}%</span>
                </div>
                <Progress value={goal.percentComplete} className="h-2" />
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Updated from campaign analytics</span>
                  {goal.metricNote ? <span>{goal.metricNote}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!goalsQuery.isLoading && !goals.length ? (
          <p className="text-sm text-muted-foreground">No goals yet. Start with a follower, RSVP, click, or conversion target that matches how this campaign is supposed to win.</p>
        ) : null}

        {goalsQuery.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Progress notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {goalsQuery.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
