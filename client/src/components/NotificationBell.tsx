import { useEffect, useState, useCallback } from "react";
import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/contexts/UserContext";
import { getNotificationSocket } from "@/lib/socket";
import { formatDistanceToNow } from "date-fns";
import type { Socket } from "socket.io-client";

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

export default function NotificationBell() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Connect to notification socket when user is available
  useEffect(() => {
    if (!user?.id) return;

    try {
      const notifSocket = getNotificationSocket(user.id);
      setSocket(notifSocket);

      // Listen for new notifications
      notifSocket.on("notification", (notification: Notification) => {
        setNotifications((prev) => [notification, ...prev]);
        if (!notification.read) {
          setUnreadCount((prev) => prev + 1);
        }
      });

      // Listen for unread count updates
      notifSocket.on("unread_count", ({ count }: { count: number }) => {
        setUnreadCount(count);
      });

      // Handle errors
      notifSocket.on("connect_error", (error: any) => {
        console.warn("Notification socket connection error:", error);
      });

      // Request initial data
      notifSocket.emit("get_recent", { limit: 20 });
      notifSocket.emit("get_unread_count");

      // Handle recent notifications response
      notifSocket.on("recent_notifications", (data: Notification[]) => {
        setNotifications(data);
      });

      return () => {
        notifSocket.off("notification");
        notifSocket.off("unread_count");
        notifSocket.off("recent_notifications");
        notifSocket.off("connect_error");
      };
    } catch (error) {
      console.warn("Failed to initialize notification socket:", error);
    }
  }, [user?.id]);

  const markAsRead = useCallback(
    (notificationId: string) => {
      if (!socket) return;

      socket.emit("mark_read", { notificationId }, (response: any) => {
        if (response.ok) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      });
    },
    [socket]
  );

  const markAllAsRead = useCallback(() => {
    if (!socket) return;

    socket.emit("mark_all_read", {}, (response: any) => {
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    });
  }, [socket]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.linkUrl) {
      window.location.href = notification.linkUrl;
    }
  };

  const getNotificationIcon = (type: string) => {
    // Return appropriate emoji based on notification type
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
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`px-4 py-3 cursor-pointer ${
                  !notification.read ? "bg-blue-50 dark:bg-blue-950" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="flex-shrink-0 text-2xl">
                    {notification.imageUrl ? (
                      <img
                        src={notification.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{notification.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    </div>
                  )}
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
