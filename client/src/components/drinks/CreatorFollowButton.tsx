import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";

/**
 * The follow relationship has three states, and the button has to show all three. A private creator answers a
 * follow with a pending REQUEST, not a follow: rendering that as plain "Follow" would leave the viewer
 * re-requesting with no way to withdraw. `isRequested` is the server's authoritative pending flag.
 */
type FollowStatusResponse = {
  ok?: boolean;
  isPrivate?: boolean;
  isFollowing?: boolean;
  isRequested?: boolean;
  requestId?: string | null;
  followerCount?: number;
};

export default function CreatorFollowButton({
  creatorId,
  size = "sm",
  className,
  showNudge = false,
}: {
  creatorId: string | null | undefined;
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  showNudge?: boolean;
}) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const canRender = Boolean(user?.id && creatorId && creatorId !== user?.id);

  const statusQuery = useQuery<FollowStatusResponse>({
    queryKey: ["/api/drinks/creators/follow-status", creatorId],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creators/${encodeURIComponent(creatorId ?? "")}/follow-status`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch follow status");
      }

      return response.json();
    },
    enabled: canRender,
  });

  const isFollowing = Boolean(statusQuery.data?.isFollowing);
  const isRequested = Boolean(statusQuery.data?.isRequested);
  // Following and requested both undo through DELETE: it drops the follow or withdraws the request.
  const hasRelationship = isFollowing || isRequested;

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/drinks/creators/${encodeURIComponent(creatorId ?? "")}/follow`, {
        method: hasRelationship ? "DELETE" : "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to update follow state");
      }

      return response.json() as Promise<FollowStatusResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/drinks/creators/follow-status", creatorId], data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/drinks/creators/follow-status", creatorId] });
      void queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/drinks/creators/leaderboard"] });
    },
  });

  if (!canRender) return null;

  const label = isFollowing ? "Following" : isRequested ? "Requested" : "Follow";

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant={hasRelationship ? "outline" : "default"}
        size={size}
        className={className}
        onClick={() => toggleMutation.mutate()}
        disabled={statusQuery.isLoading || toggleMutation.isPending}
        title={isRequested ? "Follow request pending — tap to cancel" : undefined}
        aria-label={isRequested ? "Cancel follow request" : undefined}
      >
        {toggleMutation.isPending ? "Saving..." : label}
      </Button>
      {isRequested ? (
        <p className="text-xs text-muted-foreground">Request pending approval</p>
      ) : showNudge && !statusQuery.isLoading && !isFollowing ? (
        <p className="text-xs text-muted-foreground">Follow to see more from this creator</p>
      ) : null}
    </div>
  );
}
