import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { dmParticipants, dmMessages } from "../../shared/schema.dm";

// Extract userId from auth (customize to your auth)
function userIdFromSocket(socket: any): string | null {
  // Options: cookie/session, JWT, or query header during connect
  return (socket.handshake.auth?.userId || socket.handshake.headers["x-user-id"]) as string || null;
}

export function attachDmRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });

  const ns = io.of("/dm"); // namespaced to avoid conflicts

  ns.use((socket, next) => {
    const uid = userIdFromSocket(socket);
    if (!uid) return next(new Error("unauthorized"));
    (socket as any).userId = uid;
    next();
  });

  ns.on("connection", (socket) => {
    const userId: string = (socket as any).userId;

    // Join a thread room after verifying membership
    socket.on("join", async ({ threadId }: { threadId: string }) => {
      const member = await db.query.dmParticipants.findFirst({
        where: and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)),
      });
      if (!member) return;
      socket.join(threadId);
      ns.to(socket.id).emit("joined", { threadId });
    });

    socket.on("leave", ({ threadId }: { threadId: string }) => {
      socket.leave(threadId);
    });

    // Typing indicator
    socket.on("typing", ({ threadId, typing }: { threadId: string; typing: boolean }) => {
      socket.to(threadId).emit("typing", { threadId, userId, typing });
    });

    // Send message (server persists + emits)
    socket.on("send", async ({ threadId, text, attachments }: { threadId: string; text: string; attachments?: any[] }) => {
      if (!text || !threadId) return;
      const member = await db.query.dmParticipants.findFirst({
        where: and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)),
      });
      if (!member) return;

      const [msg] = await db.insert(dmMessages).values({
        threadId, senderId: userId, body: text, attachments: attachments ?? [],
      }).returning();

      // Mark sender read
      await db.update(dmParticipants)
        .set({ lastReadMessageId: msg.id, lastReadAt: new Date() })
        .where(and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)));

      ns.to(threadId).emit("message", { message: msg });
    });

    // Read receipts
    socket.on("read", async ({ threadId, lastReadMessageId }: { threadId: string; lastReadMessageId?: string }) => {
      await db.update(dmParticipants)
        .set({ lastReadMessageId: lastReadMessageId ?? null, lastReadAt: new Date() })
        .where(and(eq(dmParticipants.threadId, threadId), eq(dmParticipants.userId, userId)));
      socket.to(threadId).emit("read", { threadId, userId, lastReadMessageId: lastReadMessageId ?? null });
    });
  });

  return ns;
}
