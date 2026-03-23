import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import CampaignUnlockControls from "@/components/drinks/CampaignUnlockControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

import { readErrorMessage, rolloutAudienceLabel, rolloutModeLabel, rolloutStateLabel, toLocalInput } from "./utils";
import { type CampaignRolloutAudience, type CampaignRolloutMode, type CampaignRolloutResponse } from "./types";

export default function CampaignRolloutManager({
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
    rolloutMode: "public_first" as CampaignRolloutMode,
    startsWithAudience: "members" as CampaignRolloutAudience,
    unlockFollowersAt: "",
    unlockPublicAt: "",
    rolloutNotes: "",
    isRolloutActive: false,
  });

  React.useEffect(() => {
    setMessage("");
    setError("");
  }, [campaign?.id]);

  const rolloutQuery = useQuery<CampaignRolloutResponse>({
    queryKey: ["/api/drinks/campaigns/rollout", campaign?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/rollout`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load rollout (${response.status})`);
      return payload as CampaignRolloutResponse;
    },
    enabled: Boolean(campaign?.id),
  });

  React.useEffect(() => {
    if (!rolloutQuery.data) return;
    setForm({
      rolloutMode: rolloutQuery.data.rollout.rolloutMode,
      startsWithAudience: rolloutQuery.data.rollout.startsWithAudience,
      unlockFollowersAt: toLocalInput(rolloutQuery.data.rollout.unlockFollowersAt),
      unlockPublicAt: toLocalInput(rolloutQuery.data.rollout.unlockPublicAt),
      rolloutNotes: rolloutQuery.data.rollout.rolloutNotes ?? "",
      isRolloutActive: rolloutQuery.data.rollout.isRolloutActive,
    });
  }, [rolloutQuery.data]);

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/rollout", campaign?.id ?? ""] }),
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/rollout-timeline", campaign?.id ?? ""] }),
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-rollout-timeline"] }),
      onChanged(),
    ]);
  }, [campaign?.id, onChanged, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const endpoint = `/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/rollout`;
      const method = rolloutQuery.data ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rolloutMode: form.rolloutMode,
          startsWithAudience: form.rolloutMode === "staged" ? form.startsWithAudience : null,
          unlockFollowersAt: form.unlockFollowersAt ? new Date(form.unlockFollowersAt).toISOString() : null,
          unlockPublicAt: form.unlockPublicAt ? new Date(form.unlockPublicAt).toISOString() : null,
          rolloutNotes: form.rolloutNotes.trim() || null,
          isRolloutActive: form.isRolloutActive,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to save rollout (${response.status})`);
      return payload as CampaignRolloutResponse;
    },
    onSuccess: async (payload) => {
      setMessage(`Rollout saved: ${rolloutStateLabel(payload.derivedState.state)}.`);
      setError("");
      await refresh();
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to save rollout right now."));
      setMessage("");
    },
  });

  const visibilityNotice = campaign?.visibility === "members"
    ? "This campaign can only ever open to active members, so follower/public unlocks are ignored."
    : campaign?.visibility === "followers"
      ? "This campaign can widen from members to followers, but it cannot open publicly while visibility stays follower-only."
      : "Public visibility allows all four rollout modes, including staged widening from members to followers to public.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rollout Strategy</CardTitle>
        <CardDescription>
          Choose how this campaign widens across public, follower, and member audiences without turning campaign management into a marketing automation system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!campaign ? <p className="text-sm text-muted-foreground">Pick a campaign to manage rollout strategy.</p> : null}
        {rolloutQuery.isLoading && campaign ? <p className="text-sm text-muted-foreground">Loading rollout strategy…</p> : null}
        {rolloutQuery.isError && campaign ? <p className="text-sm text-destructive">{readErrorMessage(rolloutQuery.error, "Unable to load rollout strategy right now.")}</p> : null}

        {campaign && rolloutQuery.data ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Current state</p>
                <p className="mt-1 text-sm font-medium">{rolloutStateLabel(rolloutQuery.data.derivedState.state)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Current audience</p>
                <p className="mt-1 text-sm font-medium">{rolloutAudienceLabel(rolloutQuery.data.derivedState.currentAudience)}</p>
                {rolloutQuery.data.derivedState.isRolloutPaused ? <p className="mt-1 text-xs text-amber-700">Paused since {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(rolloutQuery.data.derivedState.pausedAt ?? ""))}</p> : null}
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Suggested mode</p>
                <p className="mt-1 text-sm font-medium">{rolloutModeLabel(rolloutQuery.data.audienceFitSuggestion.suggestedMode)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{rolloutQuery.data.audienceFitSuggestion.reason ?? "No extra audience-fit suggestion yet."}</p>
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
              {visibilityNotice}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaign-rollout-mode">Mode</Label>
                <select
                  id="campaign-rollout-mode"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.rolloutMode}
                  onChange={(event) => setForm((current) => ({ ...current, rolloutMode: event.target.value as CampaignRolloutMode }))}
                >
                  <option value="public_first">Public first</option>
                  <option value="followers_first">Followers first</option>
                  <option value="members_first">Members first</option>
                  <option value="staged">Staged rollout</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-rollout-active">Rollout status</Label>
                <select
                  id="campaign-rollout-active"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.isRolloutActive ? "active" : "off"}
                  onChange={(event) => setForm((current) => ({ ...current, isRolloutActive: event.target.value === "active" }))}
                >
                  <option value="active">Use rollout sequencing</option>
                  <option value="off">Open immediately to the campaign visibility audience</option>
                </select>
              </div>
            </div>

            {form.rolloutMode === "staged" ? (
              <div className="space-y-2">
                <Label htmlFor="campaign-rollout-starts-with">Starts with audience</Label>
                <select
                  id="campaign-rollout-starts-with"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.startsWithAudience}
                  onChange={(event) => setForm((current) => ({ ...current, startsWithAudience: event.target.value as CampaignRolloutAudience }))}
                >
                  <option value="members">Members</option>
                  <option value="followers">Followers</option>
                  <option value="public">Public</option>
                </select>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaign-unlock-followers">Unlock followers at</Label>
                <Input
                  id="campaign-unlock-followers"
                  type="datetime-local"
                  value={form.unlockFollowersAt}
                  onChange={(event) => setForm((current) => ({ ...current, unlockFollowersAt: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Use this when a member-first or staged rollout should widen to followers later.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-unlock-public">Unlock public at</Label>
                <Input
                  id="campaign-unlock-public"
                  type="datetime-local"
                  value={form.unlockPublicAt}
                  onChange={(event) => setForm((current) => ({ ...current, unlockPublicAt: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Only applies when campaign visibility still allows public access.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-rollout-notes">Notes</Label>
              <Textarea
                id="campaign-rollout-notes"
                value={form.rolloutNotes}
                onChange={(event) => setForm((current) => ({ ...current, rolloutNotes: event.target.value }))}
                placeholder="Optional notes for why this arc opens with members, followers, or public."
              />
            </div>

            <div className="space-y-2 rounded-md border border-dashed p-3">
              <p className="font-medium">Audience sequence</p>
              <div className="flex flex-wrap gap-2 text-sm">
                {rolloutQuery.data.derivedState.timeline.map((step, index) => (
                  <div key={`${step.audience}-${index}`} className="rounded-full border px-3 py-1">
                    {rolloutAudienceLabel(step.audience)}
                    {step.unlockAt ? ` · ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(step.unlockAt))}` : ""}
                    {step.isCurrent ? " · current" : ""}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Next unlock: {rolloutQuery.data.derivedState.nextAudience ? `${rolloutAudienceLabel(rolloutQuery.data.derivedState.nextAudience)}${rolloutQuery.data.derivedState.nextUnlockAt ? ` at ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(rolloutQuery.data.derivedState.nextUnlockAt))}` : ""}` : "none scheduled"}.
              </p>
            </div>

            <CampaignUnlockControls
              campaignId={campaign.id}
              rollout={rolloutQuery.data.derivedState}
              onSuccess={(nextMessage) => {
                setMessage(nextMessage);
                setError("");
              }}
              onError={(nextError) => {
                setError(nextError);
                if (nextError) setMessage("");
              }}
              refreshKeys={[
                ["/api/drinks/campaigns/creator", campaign.creatorUserId],
              ]}
            />

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save rollout"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setForm({
                  rolloutMode: rolloutQuery.data.rollout.rolloutMode,
                  startsWithAudience: rolloutQuery.data.rollout.startsWithAudience,
                  unlockFollowersAt: toLocalInput(rolloutQuery.data.rollout.unlockFollowersAt),
                  unlockPublicAt: toLocalInput(rolloutQuery.data.rollout.unlockPublicAt),
                  rolloutNotes: rolloutQuery.data.rollout.rolloutNotes ?? "",
                  isRolloutActive: rolloutQuery.data.rollout.isRolloutActive,
                })}
              >
                Reset to saved
              </Button>
            </div>
          </>
        ) : null}

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
