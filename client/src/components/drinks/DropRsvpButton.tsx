import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { Link } from "wouter";

import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import type { CreatorDropItem } from "@/components/drinks/CreatorDropCard";

type DropRsvpResponse = {
  ok: boolean;
  dropId: string;
  isRsvped: boolean;
  rsvpCount: number;
};

export default function DropRsvpButton({ drop }: { drop: CreatorDropItem }) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isOwnDrop = user?.id === drop.creatorUserId;
  const isUpcoming = drop.status === "upcoming";
  const canToggle = Boolean(user?.id && !isOwnDrop && drop.isPublished && isUpcoming);

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/drinks/drops/${encodeURIComponent(drop.id)}/rsvp`, {
        method: drop.isRsvped ? "DELETE" : "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to update drop notification (${response.status})`);
      }
      return payload as DropRsvpResponse;
    },
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = Array.isArray(query.queryKey) ? String(query.queryKey[0] ?? "") : "";
          return key.startsWith("/api/drinks/drops/") || key === "/api/drinks/drops/feed";
        },
      });
      toast({
        title: payload.isRsvped ? "Drop saved" : "Drop notification removed",
        description: payload.isRsvped
          ? "You’ll get an in-app alert when this drop goes live."
          : "You won’t get drop alerts for this launch anymore.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to update notification",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isOwnDrop) {
    return <Button type="button" size="sm" variant="outline" disabled>{drop.rsvpCount} interested</Button>;
  }

  if (!isUpcoming) {
    return <Button type="button" size="sm" variant="outline" disabled>{drop.status === "live" ? "Live now" : "Drop ended"}</Button>;
  }

  if (!user) {
    return (
      <Link href="/auth/login">
        <Button type="button" size="sm">
          <Bell className="mr-2 h-4 w-4" />
          Notify me
        </Button>
      </Link>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={drop.isRsvped ? "outline" : "default"}
      onClick={() => toggleMutation.mutate()}
      disabled={!canToggle || toggleMutation.isPending}
    >
      {toggleMutation.isPending ? null : drop.isRsvped ? <BellOff className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
      {toggleMutation.isPending
        ? "Saving…"
        : drop.isRsvped
          ? "Notified"
          : "Notify me"}
    </Button>
  );
}
