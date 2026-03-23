import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pin, PinOff } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";

type CampaignPinButtonProps = {
  campaignId?: string | null;
  isPinned?: boolean;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

const CAMPAIGN_QUERY_KEYS = [
  "/api/drinks/campaigns",
  "/api/drinks/campaigns/featured",
  "/api/drinks/campaigns/creator",
  "/api/drinks/creator-dashboard/pinned-campaign",
  "/api/drinks/creator-dashboard/pinned-campaign-analytics",
] as const;

export default function CampaignPinButton({
  campaignId,
  isPinned = false,
  size = "sm",
  variant,
  onSuccess,
  onError,
}: CampaignPinButtonProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaignId ?? "")}/${isPinned ? "unpin" : "pin"}`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to ${isPinned ? "unpin" : "pin"} campaign (${response.status})`);
      }
      return payload;
    },
    onSuccess: async () => {
      await Promise.all([
        ...CAMPAIGN_QUERY_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns", campaignId ?? "", user?.id ?? "guest"] }),
      ]);
      onSuccess?.(isPinned ? "Campaign unpinned." : "Campaign pinned as your spotlight.");
    },
    onError: (error) => {
      onError?.(error instanceof Error ? error.message : `Unable to ${isPinned ? "unpin" : "pin"} campaign right now.`);
    },
  });

  return (
    <Button
      size={size}
      variant={variant ?? (isPinned ? "secondary" : "outline")}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending || !campaignId}
    >
      {isPinned ? <PinOff className="mr-1.5 h-4 w-4" /> : <Pin className="mr-1.5 h-4 w-4" />}
      {mutation.isPending ? (isPinned ? "Unpinning…" : "Pinning…") : (isPinned ? "Unpin" : "Pin campaign")}
    </Button>
  );
}
