import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";

type FollowStatusResponse = {
  ok?: boolean;
  isFollowing?: boolean;
  followerCount?: number;
};

export default function CreatorFollowButton({
  creatorId,
  size = "sm",
  className,
}: {
  creatorId: string | null | undefined;
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
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

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const currentlyFollowing = Boolean(statusQuery.data?.isFollowing);
      const method = currentlyFollowing ? "DELETE" : "POST";
      const response = await fetch(`/api/drinks/creators/${encodeURIComponent(creatorId ?? "")}/follow`, {
        method,
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

  return (
    <Button
      type="button"
      variant={statusQuery.data?.isFollowing ? "outline" : "default"}
      size={size}
      className={className}
      onClick={() => toggleMutation.mutate()}
      disabled={statusQuery.isLoading || toggleMutation.isPending}
    >
      {toggleMutation.isPending
        ? "Saving..."
        : statusQuery.data?.isFollowing
          ? "Following"
          : "Follow"}
    </Button>
  );
}
