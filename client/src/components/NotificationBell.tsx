import { useEffect, useState, useCallback } from "react";
import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/contexts/UserContext";
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
  priority?: string;
  createdAt: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...(init || {}),
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    // Don’t crash UI; just throw for caller to ignore
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export default function NotificationBell() {
  const { user, loading } = useUser();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await fetchJson<{ count: number }>("/api/notifications/unread-count");
      setUnreadCount(typeof data?.count === "number" ? data.count : 0);
    } catch {
      // ignore
    }
  }, [user?.id]);

  const loadRecent = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await fetchJson<{
        notifications: Notification[];
        count: number;
        limit: number;
        offset: number;
      }>("/api/notifications?limit=20&offset=0");

      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch {
      // ignore
    }
  }, [user?.id]);

  useEffect(() => {
    if (loading || !user?.id) return;

    // Initial load
    loadUnreadCount();
    loadRecent();

    // Poll so the badge updates without websockets
    const badgeTimer = window.setInterval(loadUnreadCount, 15000); // 15s
    const listTimer = window.setInterval(loadRecent, 30000); // 30s

    return () => {
      window.clearInterval(badgeTimer);
      window.clearInterval(listTimer);
    };
  }, [loading, user?.id, loadUnreadCount, loadRecent]);

  // When opening the dropdown, refresh immediately
  useEffect(() => {
    if (!user?.id) return;
    if (isOpen) {
      loadUnreadCount();
      loadRecent();
    }
  }, [isOpen, user?.id, loadUnreadCount, loadRecent]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user?.id) return;

      try {
        await fetchJson(`/api/notifications/${notificationId}/read`, { method: "PUT" });

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, read: true, readAt: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    },
    [user?.id]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      await fetchJson("/api/notifications/mark-all-read", { method: "PUT" });
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: true,
          readAt: n.readAt ?? new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, [user?.id]);

  const deleteOne = useCallback(
    async (notificationId: string) => {
      if (!user?.id) return;

      try {
        await fetchJson(`/api/notifications/${notificationId}`, { method: "DELETE" });
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        // Recompute unread count safely
        setUnreadCount((prev) => {
          const removed = notifications.find((n) => n.id === notificationId);
          if (removed && !removed.read) return Math.max(0, prev - 1);
          return prev;
        });
      } catch {
        // ignore
      }
    },
    [user?.id, notifications]
  );

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.linkUrl) {
      window.location.href = notification.linkUrl;
    }
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      follow: "👥",
      like: "❤️",
      comment: "💬",
      badge_earned: "🏆",
      quest_completed: "⭐",
      friend_activity: "🎉",
      suggestion: "💡",
    };
    return icons[type] || "🔔";
  };

  if (loading) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="p-2 hover:bg-muted rounded-full"
        aria-label="Notifications"
        disabled
      >
        <Bell className="h-5 w-5 text-muted-foreground opacity-50" />
      </Button>
    );
  }

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 hover:bg-muted rounded-full"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 max-h-[500px] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="font-semibold text-lg">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="py-2">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`px-4 py-3 cursor-pointer ${
                  !n.read ? "bg-blue-50 dark:bg-blue-950" : ""
                }`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="flex-shrink-0 text-2xl">
                    {n.imageUrl ? (
                      <img
                        src={n.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {getNotificationIcon(n.type)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteOne(n.id);
                      }}
                      aria-label="Delete notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-4 py-2 text-center">
              <Button variant="ghost" size="sm" className="text-sm w-full" asChild>
                <a href="/notifications">View all notifications</a>
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
