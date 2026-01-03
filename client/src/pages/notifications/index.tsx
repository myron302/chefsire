import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  read: boolean;
  readAt?: string | null;
  priority: string;
  createdAt: string;
};

export default function NotificationsPage() {
  const { user, loading } = useUser();
  const queryClient = useQueryClient();

  const enabled = !!user?.id && !loading;

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const clearAll = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/notifications/clear-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  if (loading) return null;

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Please log in to view notifications.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notifications</CardTitle>
            {unreadCount > 0 && <Badge variant="secondary">{unreadCount} unread</Badge>}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => clearAll.mutate()}
            disabled={clearAll.isPending || notifications.length === 0}
          >
            Clear all
          </Button>
        </CardHeader>

        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="text-muted-foreground">No notifications yet.</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                  !n.read ? "bg-blue-50/50 dark:bg-blue-950/30" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm">{n.title}</div>
                    {!n.read && <Badge variant="default">New</Badge>}
                  </div>

                  <div className="text-sm text-muted-foreground mt-1">{n.message}</div>

                  <div className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    {n.linkUrl ? (
                      <>
                        {" • "}
                        <a className="underline" href={n.linkUrl}>
                          Open
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteOne.mutate(n.id)}
                  disabled={deleteOne.isPending}
                  aria-label="Delete notification"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
