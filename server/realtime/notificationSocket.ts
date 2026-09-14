// server/realtime/notificationSocket.ts
import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../db";
import { notifications, users } from "../../shared/schema";
import { authenticateSocket, socketUserId } from "./socket-auth";

type SocketNotificationInput = Pick<
  typeof notifications.$inferInsert,
  "type" | "title" | "message" | "imageUrl" | "linkUrl" | "metadata" | "priority"
>;

export function attachNotificationRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });

  // Namespace for notifications
  const ns = io.of("/notifications");

  // Identity comes from a verified token, never from anything the client asserts about itself.
  // A connection that fails this never reaches `connection`, so it never joins a room and never
  // receives an event.
  ns.use(authenticateSocket);

  ns.on("connection", (socket) => {
    const userId = socketUserId(socket);

    // Join the authenticated user's OWN notification room, and only that one. There is no event
    // for choosing a room: the room is a function of who you proved you are. A handshake carrying
    // someone else's id changes nothing, because no handler reads one.
    socket.join(`user-${userId}`);


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
    });
  });

  // Helper function to send notification to user (called from other parts of the app)
  return {
    // Exposed so the security tests can observe live room membership -- the only trustworthy view
    // of which user's stream a connection actually reached.
    namespace: ns,

    notifyUser: async (userId: string, notification: SocketNotificationInput) => {
      try {
        // Save to database
        const [savedNotif] = await db
          .insert(notifications)
          .values({
            userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            imageUrl: notification.imageUrl,
            linkUrl: notification.linkUrl,
            metadata: notification.metadata,
            priority: notification.priority,
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

    notifyMultipleUsers: async (userIds: string[], notification: SocketNotificationInput) => {
      const results = await Promise.allSettled(
        userIds.map(async (userId) => {
          const [savedNotif] = await db
            .insert(notifications)
            .values({
              userId,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              imageUrl: notification.imageUrl,
              linkUrl: notification.linkUrl,
              metadata: notification.metadata,
              priority: notification.priority,
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
