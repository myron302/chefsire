// server/realtime/notificationSocket.ts
import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../db";
import { notifications, users } from "../../shared/schema";

function userIdFromSocket(socket: any): string | null {
  return (socket.handshake.auth?.userId ||
    socket.handshake.headers["x-user-id"] ||
    null) as string | null;
}

export function attachNotificationRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });

  // Namespace for notifications
  const ns = io.of("/notifications");

  // Simple auth gate
  ns.use((socket, next) => {
    const uid = userIdFromSocket(socket);
    if (!uid) return next(new Error("unauthorized"));
    (socket as any).userId = uid;
    next();
  });

  ns.on("connection", (socket) => {
    const userId: string = (socket as any).userId;

    // Join user's personal notification room
    socket.join(`user-${userId}`);

    console.log(`[Notifications] User ${userId} connected`);

    // Send initial unread count
    socket.on("get_unread_count", async () => {
      try {
        const unreadNotifs = await db
          .select()
          .from(notifications)
          .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

        socket.emit("unread_count", { count: unreadNotifs.length });
      } catch (e: any) {
        socket.emit("error", { error: e?.message || "Failed to get unread count" });
      }
    });

    // Mark notification as read
    socket.on("mark_read", async ({ notificationId }: { notificationId: string }) => {
      try {
        await db
          .update(notifications)
          .set({ read: true, readAt: new Date() })
          .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

        socket.emit("marked_read", { notificationId });

        // Send updated unread count
        const unreadNotifs = await db
          .select()
          .from(notifications)
          .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

        socket.emit("unread_count", { count: unreadNotifs.length });
      } catch (e: any) {
        socket.emit("error", { error: e?.message || "Failed to mark as read" });
      }
    });

    // Mark all as read
    socket.on("mark_all_read", async () => {
      try {
        await db
          .update(notifications)
          .set({ read: true, readAt: new Date() })
          .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

        socket.emit("all_marked_read", {});
        socket.emit("unread_count", { count: 0 });
      } catch (e: any) {
        socket.emit("error", { error: e?.message || "Failed to mark all as read" });
      }
    });

    // Get recent notifications
    socket.on("get_recent", async ({ limit = 20 }: { limit?: number }) => {
      try {
        const recentNotifs = await db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, userId))
          .orderBy(desc(notifications.createdAt))
          .limit(limit);

        socket.emit("recent_notifications", { notifications: recentNotifs });
      } catch (e: any) {
        socket.emit("error", { error: e?.message || "Failed to get recent notifications" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Notifications] User ${userId} disconnected`);
    });
  });

  // Helper function to send notification to user (called from other parts of the app)
  return {
    notifyUser: async (userId: string, notification: {
      type: string;
      title: string;
      message: string;
      imageUrl?: string;
      linkUrl?: string;
      metadata?: Record<string, any>;
      priority?: string;
    }) => {
      try {
        // Save to database
        const [savedNotif] = await db
          .insert(notifications)
          .values({
            userId,
            ...notification,
          })
          .returning();

        // Send real-time notification
        ns.to(`user-${userId}`).emit("new_notification", savedNotif);

        // Update unread count
        const unreadNotifs = await db
          .select()
          .from(notifications)
          .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

        ns.to(`user-${userId}`).emit("unread_count", { count: unreadNotifs.length });

        return savedNotif;
      } catch (e) {
        console.error("[Notifications] Failed to notify user:", e);
        return null;
      }
    },

    notifyMultipleUsers: async (userIds: string[], notification: {
      type: string;
      title: string;
      message: string;
      imageUrl?: string;
      linkUrl?: string;
      metadata?: Record<string, any>;
      priority?: string;
    }) => {
      const results = await Promise.allSettled(
        userIds.map(async (userId) => {
          const [savedNotif] = await db
            .insert(notifications)
            .values({
              userId,
              ...notification,
            })
            .returning();

          ns.to(`user-${userId}`).emit("new_notification", savedNotif);

          const unreadNotifs = await db
            .select()
            .from(notifications)
            .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

          ns.to(`user-${userId}`).emit("unread_count", { count: unreadNotifs.length });

          return savedNotif;
        })
      );

      return results;
    },
  };
}
