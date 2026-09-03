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
import { CATERING_BOOKING_THREAD_CODE, CATERING_BOOKING_THREAD_MESSAGE } from "../../shared/catering-booking-communication";
import { bookingLinkedThread } from "../services/catering-booking-conversation";

/**
 * A DM thread that belongs to a catering booking is owned by the Phase 2I booking API and is closed to the generic
 * DM socket transport, exactly as it is closed to the generic DM HTTP routes.
 *
 * This transport is otherwise a complete bypass of every booking rule. It authorizes on `dm_participants`
 * membership alone, so through it a booking conversation could be sent to after cancellation or completion, have its
 * read marker set to an arbitrary client-supplied id (non-monotonic, and not even required to be a message of the
 * thread), receive arbitrary attachment URLs the booking file contract forbids, skip the message idempotency ledger
 * entirely, and emit notifications carrying message body text that booking notifications deliberately never include.
 *
 * The booking-link determination is the SAME canonical `bookingLinkedThread` the HTTP guard uses, and the refusal
 * carries the same shared code and message, so the two transports cannot drift into different answers.
 */
async function refuseBookingLinkedThread(socket: any, threadId: string): Promise<boolean> {
  let linked: { bookingId: string } | null;
  try {
    linked = await bookingLinkedThread(threadId);
  } catch {
    // The lookup itself failed -- a transient database outage, say. We cannot tell whether this thread belongs to a
    // booking, so the operation is REFUSED rather than allowed to fall through into generic DM behaviour: proceeding
    // on an unknown answer is exactly how a booking conversation would be reached during an outage. The rejection is
    // consumed here, so it can never escape a listener and reach the process-level `unhandledRejection` handler,
    // which exits the process. The client is told only that the check was unavailable -- no query, driver detail or
    // stack trace is disclosed.
    socket.emit("error", { error: "thread_check_unavailable", code: "thread_check_unavailable", message: "This conversation could not be verified right now. Please try again." });
    return true;
  }
  if (!linked) return false;
  socket.emit("error", { error: CATERING_BOOKING_THREAD_CODE, code: CATERING_BOOKING_THREAD_CODE, message: CATERING_BOOKING_THREAD_MESSAGE });
  return true;
}

/**
 * Registers an async socket listener behind an error boundary.
 *
 * Socket.IO does not consume the promise an async listener returns, so a rejection inside one becomes an unhandled
 * rejection -- and this process exits on those. A typing indicator must never be able to restart ChefSire. The
 * boundary answers with the same bounded `error` event shape the other handlers use and never forwards the
 * underlying message, so a database failure cannot become a disclosure either.
 */
function onAsyncSocketEvent<T>(socket: any, event: string, failure: string, handler: (payload: T) => Promise<void>): void {
  socket.on(event, (payload: T) => {
    void Promise.resolve()
      .then(() => handler(payload))
      .catch(() => { socket.emit("error", { error: failure }); });
  });
}

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

        // After the membership check, so a stranger guessing thread ids gets the same uniform "forbidden" for a
        // booking thread as for any other thread they are not in, and learns nothing from the refusal.
        if (await refuseBookingLinkedThread(socket, threadId)) return;

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
    // Not a mutation, but it emits into a thread room without requiring membership, so it is refused too: the rule
    // is simply that a booking-linked thread is not usable through this transport at all. Registered through the
    // async error boundary because this listener has no try/catch of its own, and an unhandled rejection here would
    // exit the process.
    onAsyncSocketEvent<{ threadId: string; typing: boolean }>(socket, "typing", "typing failed", async ({ threadId, typing }) => {
      if (await refuseBookingLinkedThread(socket, threadId)) return;
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

          // Refused before anything is written, so no message row can exist by the time it answers.
          if (await refuseBookingLinkedThread(socket, threadId)) return;

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

          // Refused before the participant row is touched: this handler would otherwise write an arbitrary
          // client-supplied marker with a wall-clock timestamp, defeating the monotonic booking read semantics.
          if (await refuseBookingLinkedThread(socket, threadId)) return;

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
