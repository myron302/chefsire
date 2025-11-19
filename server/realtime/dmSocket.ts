// server/realtime/dmSocket.ts
import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import {
  dmParticipants,
  dmMessages,
} from "../../shared/schema.dm.ts";
import { users, notifications } from "../../shared/schema";

function userIdFromSocket(socket: any): string | null {
  return (socket.handshake.auth?.userId ||
    socket.handshake.headers["x-user-id"] ||
    null) as string | null;
}

export function attachDmRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });

  // Namespace for DMs
  const ns = io.of("/dm");

  // Simple auth gate
  ns.use((socket, next) => {
    const uid = userIdFromSocket(socket);
    if (!uid) return next(new Error("unauthorized"));
    (socket as any).userId = uid;
    next();
  });

  ns.on("connection", (socket) => {
    const userId: string = (socket as any).userId;

    // Join a thread room (only if member)
    socket.on("join", async ({ threadId }: { threadId: string }) => {
      try {
        const member = await db
          .select()
          .from(dmParticipants)
          .where(and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)))
          .limit(1);

        if (member.length === 0) {
          socket.emit("error", { error: "forbidden" });
          return;
        }

        socket.join(threadId);
        socket.emit("joined", { threadId });
      } catch (e: any) {
        socket.emit("error", { error: e?.message || "join failed" });
      }
    });

    // Leave a thread room
    socket.on("leave", ({ threadId }: { threadId: string }) => {
      socket.leave(threadId);
    });

    // Typing indicator
    socket.on("typing", ({ threadId, typing }: { threadId: string; typing: boolean }) => {
      socket.to(threadId).emit("typing", { threadId, userId, typing });
    });

    // Send message over socket (persists + broadcasts)
    socket.on(
      "send",
      async ({
        threadId,
        text,
        attachments,
      }: {
        threadId: string;
        text: string;
        attachments?: Array<{ name: string; url: string; type?: string }>;
      }) => {
        try {
          // Auth: must be participant
          const member = await db
            .select()
            .from(dmParticipants)
            .where(and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)))
            .limit(1);

          if (member.length === 0) {
            socket.emit("error", { error: "forbidden" });
            return;
          }

          // Persist message
          const [msg] = await db
            .insert(dmMessages)
            .values({
              threadId,
              senderId: userId,
              body: String(text || ""),
              attachments: attachments ?? [],
            })
            .returning();

          // Mark my read position
          await db
            .update(dmParticipants)
            .set({ lastReadMessageId: msg.id, lastReadAt: new Date() })
            .where(and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)));

          // Get sender info
          const [sender] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

          // Create notifications for other participants
          const otherParticipants = await db
            .select()
            .from(dmParticipants)
            .where(and(eq(dmParticipants.threadId, threadId), ne(dmParticipants.userId, userId)));

          for (const participant of otherParticipants) {
            await db.insert(notifications).values({
              userId: participant.userId,
              type: "dm",
              title: `New message from ${sender?.displayName || sender?.username || "Someone"}`,
              message: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
              linkUrl: `/dm/${threadId}`,
              metadata: {
                threadId,
                senderId: userId,
                messageId: msg.id,
              },
            });
          }

          // Broadcast to everyone in the room (including sender for confirm)
          ns.to(threadId).emit("message", { threadId, message: msg });
        } catch (e: any) {
          socket.emit("error", { error: e?.message || "send failed" });
        }
      }
    );

    // Mark read via socket
    socket.on(
      "read",
      async ({ threadId, lastReadMessageId }: { threadId: string; lastReadMessageId?: string }) => {
        try {
          const member = await db
            .select()
            .from(dmParticipants)
            .where(and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)))
            .limit(1);

          if (member.length === 0) {
            socket.emit("error", { error: "forbidden" });
            return;
          }

          await db
            .update(dmParticipants)
            .set({ lastReadMessageId: lastReadMessageId ?? null, lastReadAt: new Date() })
            .where(and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)));

          // Notify others of read receipt
          socket.to(threadId).emit("read", { threadId, userId, lastReadMessageId: lastReadMessageId ?? null });
        } catch (e: any) {
          socket.emit("error", { error: e?.message || "read failed" });
        }
      }
    );

    socket.on("disconnect", () => {
      // no-op; hook available for presence if you add it later
    });
  });
}
