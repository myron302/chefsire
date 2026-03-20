import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";

type CampaignFollowStatusResponse = {
  ok?: boolean;
  campaignId?: string;
  isFollowing?: boolean;
  followerCount?: number;
  canFollow?: boolean;
};

export default function CampaignFollowButton({
  campaignId,
  creatorUserId,
  size = "sm",
  variant,
  className,
  followRequestBody,
  onBeforeToggle,
  onFollowed,
  idleLabel,
  activeLabel,
}: {
  campaignId: string | null | undefined;
  creatorUserId?: string | null;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  followRequestBody?: Record<string, unknown> | null;
  onBeforeToggle?: (() => void) | null;
  onFollowed?: (() => void) | null;
  idleLabel?: string;
  activeLabel?: string;
}) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const canRender = Boolean(campaignId);
  const canFollow = Boolean(user?.id && creatorUserId && user.id !== creatorUserId);

  const statusQuery = useQuery<CampaignFollowStatusResponse>({
    queryKey: ["/api/drinks/campaigns/follow-status", campaignId, user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaignId ?? "")}/follow-status`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to load campaign follow status (${response.status})`);
      }

      return payload as CampaignFollowStatusResponse;
    },
    enabled: canRender,
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const method = statusQuery.data?.isFollowing ? "DELETE" : "POST";
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaignId ?? "")}/follow`, {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        body: method === "POST" && followRequestBody ? JSON.stringify(followRequestBody) : undefined,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to update campaign follow state (${response.status})`);
      }

      return payload as CampaignFollowStatusResponse;
    },
    onSuccess: async (data) => {
      if (data.isFollowing) onFollowed?.();
      queryClient.setQueryData(["/api/drinks/campaigns/follow-status", campaignId, user?.id ?? "guest"], data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/following"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/following-feed"] }),
      ]);
    },
  });

  if (!canRender) return null;

  if (!user) {
    return (
      <Link href="/auth/login">
        <Button type="button" size={size} variant={variant ?? "default"} className={className}>
          Sign in to follow
        </Button>
      </Link>
    );
  }

  if (!canFollow) return null;

  const isFollowing = Boolean(statusQuery.data?.isFollowing);

  return (
    <Button
      type="button"
      size={size}
      variant={variant ?? (isFollowing ? "outline" : "default")}
      className={className}
      onClick={() => {
        onBeforeToggle?.();
        toggleMutation.mutate();
      }}
      disabled={statusQuery.isLoading || toggleMutation.isPending}
    >
      {toggleMutation.isPending ? "Saving…" : isFollowing ? (activeLabel ?? "Following") : (idleLabel ?? "Follow campaign")}
    </Button>
  );
}
