import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
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
  priority?: string | null;
  createdAt: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...(init || {}) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export default function NotificationBell() {
  const { user, loading } = useUser();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const canUse = useMemo(() => !loading && !!user?.id, [loading, user?.id]);

  // Prevent overlapping requests (reduces chance of flaky “incomplete response” pages)
  const inflightRef = useRef<{ unread?: boolean; list?: boolean }>({});

  const loadUnreadCount = useCallback(async () => {
    if (!canUse || inflightRef.current.unread) return;
    inflightRef.current.unread = true;
    try {
      const data = await fetchJson<{ count: number }>("/api/notifications/unread-count");
      setUnreadCount(typeof data?.count === "number" ? data.count : 0);
    } catch {
      // ignore
    } finally {
      inflightRef.current.unread = false;
    }
  }, [canUse]);

  const loadRecent = useCallback(async () => {
    if (!canUse || inflightRef.current.list) return;
    inflightRef.current.list = true;
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
    } finally {
      inflightRef.current.list = false;
    }
  }, [canUse]);

  // Light polling (no websockets)
  useEffect(() => {
    if (!canUse) return;

    loadUnreadCount();
    loadRecent();

    const unreadTimer = window.setInterval(loadUnreadCount, 30000); // 30s
    const listTimer = window.setInterval(loadRecent, 60000); // 60s

    return () => {
      window.clearInterval(unreadTimer);
      window.clearInterval(listTimer);
    };
  }, [canUse, loadUnreadCount, loadRecent]);

  // When dropdown opens, refresh immediately
  useEffect(() => {
    if (!canUse) return;
    if (isOpen) {
      loadUnreadCount();
      loadRecent();
    }
  }, [isOpen, canUse, loadUnreadCount, loadRecent]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!canUse) return;
      try {
        await fetchJson(`/api/notifications/${notificationId}/read`, { method: "PUT" });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    },
    [canUse]
  );

  const markAllAsRead = useCallback(async () => {
    if (!canUse) return;
    try {
      await fetchJson("/api/notifications/mark-all-read", { method: "PUT" });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: n.readAt ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, [canUse]);

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.linkUrl) window.location.href = n.linkUrl;
  };

  const iconFor = (type: string) => {
    const icons: Record<string, string> = {
      follow: "👥",
      like: "❤️",
      comment: "💬",
      badge_earned: "🏆",
      quest_completed: "⭐",
      friend_activity: "🎉",
      suggestion: "💡",
      dm: "✉️",
    };
    return icons[type] || "🔔";
  };

  if (loading) {
    return (
      <Button variant="ghost" size="sm" className="p-2 rounded-full" disabled aria-label="Notifications">
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
                className={`px-4 py-3 cursor-pointer ${!n.read ? "bg-blue-50 dark:bg-blue-950" : ""}`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="flex-shrink-0 text-2xl">
                    {n.imageUrl ? (
                      <img src={n.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {iconFor(n.type)}
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

                  {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
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
