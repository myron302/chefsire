import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";

type UnlockControlsProps = {
  campaignId: string;
  rollout: NonNullable<CreatorCampaignItem["rollout"]>;
  compact?: boolean;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  refreshKeys?: Array<readonly unknown[]>;
};

type ControlMutationInput =
  | { endpoint: "delay"; body: { hours: 24 | 48 }; successMessage: string }
  | { endpoint: "release-now"; body?: undefined; successMessage: string }
  | { endpoint: "pause"; body?: undefined; successMessage: string }
  | { endpoint: "resume"; body?: undefined; successMessage: string };

function rolloutAudienceLabel(value: NonNullable<CreatorCampaignItem["rollout"]>["currentAudience"] | NonNullable<CreatorCampaignItem["rollout"]>["nextAudience"]) {
  if (value === "members") return "members";
  if (value === "followers") return "followers";
  if (value === "public") return "public";
  return "—";
}

function formatDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function CampaignUnlockControls({
  campaignId,
  rollout,
  compact = false,
  onSuccess,
  onError,
  refreshKeys = [],
}: UnlockControlsProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: ControlMutationInput) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaignId)}/unlock-controls/${input.endpoint}`, {
        method: "POST",
        headers: input.body ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        body: input.body ? JSON.stringify(input.body) : undefined,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to update unlock controls (${response.status})`);
      }
      return input.successMessage;
    },
    onSuccess: async (message) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/rollout", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-launch-readiness"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-unlock-alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-action-center"] }),
        ...refreshKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ]);
      onSuccess?.(message);
      onError?.("");
    },
    onError: (error) => {
      onError?.(error instanceof Error ? error.message : "Unable to update unlock controls right now.");
      onSuccess?.("");
    },
  });

  const nextAudience = rollout.nextAudience;
  const canControlNextUnlock = Boolean(
    rollout.isRolloutActive
    && nextAudience
    && nextAudience !== "members"
    && !rollout.isRolloutPaused,
  );
  const canPause = Boolean(rollout.isRolloutActive && rollout.nextAudience && !rollout.isRolloutPaused);
  const canResume = Boolean(rollout.isRolloutActive && rollout.isRolloutPaused);
  const buttonSize = compact ? "sm" : "default";

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Unlock controls</p>
        <Badge variant="outline">Current: {rolloutAudienceLabel(rollout.currentAudience)}</Badge>
        {nextAudience ? <Badge variant="outline">Next: {rolloutAudienceLabel(nextAudience)}</Badge> : null}
        {rollout.isRolloutPaused ? <Badge variant="secondary">Paused</Badge> : null}
      </div>

      <p className="text-sm text-muted-foreground">
        {rollout.isRolloutPaused
          ? `Rollout paused at ${formatDateTime(rollout.pausedAt)}. Resume keeps the next unlock safe instead of letting the timeline jump forward.`
          : nextAudience
            ? `Next unlock: ${rolloutAudienceLabel(nextAudience)}${rollout.nextUnlockAt ? ` at ${formatDateTime(rollout.nextUnlockAt)}` : ""}.`
            : "No follower/public unlock is waiting for manual control right now."}
      </p>

      <div className="flex flex-wrap gap-2">
        {canControlNextUnlock ? (
          <>
            <Button
              size={buttonSize}
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ endpoint: "delay", body: { hours: 24 }, successMessage: `Delayed ${rolloutAudienceLabel(nextAudience)} unlock by 24 hours.` })}
            >
              Delay 24h
            </Button>
            <Button
              size={buttonSize}
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ endpoint: "delay", body: { hours: 48 }, successMessage: `Delayed ${rolloutAudienceLabel(nextAudience)} unlock by 48 hours.` })}
            >
              Delay 48h
            </Button>
            <Button
              size={buttonSize}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ endpoint: "release-now", successMessage: `Released ${rolloutAudienceLabel(nextAudience)} unlock now.` })}
            >
              Release now
            </Button>
          </>
        ) : null}

        {canPause ? (
          <Button
            size={buttonSize}
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ endpoint: "pause", successMessage: "Rollout paused." })}
          >
            Pause rollout
          </Button>
        ) : null}

        {canResume ? (
          <Button
            size={buttonSize}
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ endpoint: "resume", successMessage: "Rollout resumed." })}
          >
            Resume rollout
          </Button>
        ) : null}
      </div>
    </div>
  );
}
