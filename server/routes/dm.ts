// server/routes/dm.ts
import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, inArray, lt, ne } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { dmThreads, dmParticipants, dmMessages } from "../../shared/schema.dm.ts";
import { users, notifications } from "../../shared/schema";

const r = Router();

/**
 * GET /api/dm/threads
 */
r.get("/threads", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const parts = await db
    .select()
    .from(dmParticipants)
    .where(eq(dmParticipants.userId, userId));

  const threadIds = parts.map((p) => p.threadId);
  if (threadIds.length === 0) return res.json({ ok: true, threads: [] });

  const threads = await db.select().from(dmThreads).where(inArray(dmThreads.id, threadIds));

  const allParticipants = await db
    .select()
    .from(dmParticipants)
    .where(inArray(dmParticipants.threadId, threadIds));

  const participantUserIds = Array.from(new Set(allParticipants.map((p) => p.userId)));

  const { users } = await import("../../shared/schema");

  const participantUsers =
    participantUserIds.length > 0
      ? await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatar: users.avatar,
          })
          .from(users)
          .where(inArray(users.id, participantUserIds))
      : [];

  const participantsByThread = new Map<string, typeof participantUsers>();
  for (const thread of threads) {
    const threadParticipantIds = allParticipants
      .filter((p) => p.threadId === thread.id)
      .map((p) => p.userId);
    participantsByThread.set(
      thread.id,
      participantUsers.filter((u) => threadParticipantIds.includes(u.id))
    );
  }

  const recentMessages = await db
    .select()
    .from(dmMessages)
    .where(inArray(dmMessages.threadId, threadIds))
    .orderBy(desc(dmMessages.createdAt))
    .limit(500);

  const lastByThread = new Map<string, (typeof recentMessages)[number]>();
  for (const m of recentMessages) {
    if (!lastByThread.has(m.threadId)) lastByThread.set(m.threadId, m);
  }

  const unreadByThread: Record<string, number> = {};
  for (const th of threads) {
    const me = parts.find((p) => p.threadId === th.id);
    const base = recentMessages.filter((m) => m.threadId === th.id && m.senderId !== userId);
    if (!me?.lastReadAt) {
      unreadByThread[th.id] = base.length;
    } else {
      const t0 = new Date(me.lastReadAt).getTime();
      unreadByThread[th.id] = base.filter((m) => new Date(m.createdAt).getTime() > t0).length;
    }
  }

  res.json({
    ok: true,
    threads: threads.map((t) => ({
      ...t,
      lastMessage: lastByThread.get(t.id) || null,
      unread: unreadByThread[t.id] || 0,
      participants: participantsByThread.get(t.id) || [],
    })),
  });
});

/**
 * GET /api/dm/threads/:id
 */
r.get("/threads/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const member = await db
    .select()
    .from(dmParticipants)
    .where(and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)))
    .limit(1);

  if (member.length === 0) return res.status(403).json({ ok: false, error: "forbidden" });

  const [thread] = await db.select().from(dmThreads).where(eq(dmThreads.id, id)).limit(1);
  if (!thread) return res.status(404).json({ ok: false, error: "not found" });

  const participants = await db.select().from(dmParticipants).where(eq(dmParticipants.threadId, id));
  const participantUserIds = participants.map((p) => p.userId);

  const { users } = await import("../../shared/schema");

  const participantUsers =
    participantUserIds.length > 0
      ? await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatar: users.avatar,
          })
          .from(users)
          .where(inArray(users.id, participantUserIds))
      : [];

  res.json({
    ok: true,
    ...thread,
    participants: participantUsers,
  });
});

/**
 * GET /api/dm/threads/:id/messages
 */
r.get("/threads/:id/messages", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const { id } = req.params;
  const take = Math.min(Number(req.query.take) || 30, 100);
  const before = req.query.before ? new Date(String(req.query.before)) : undefined;

  const member = await db
    .select()
    .from(dmParticipants)
    .where(and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)))
    .limit(1);

  if (member.length === 0) return res.status(403).json({ ok: false, error: "forbidden" });

  const whereExpr = before
    ? and(eq(dmMessages.threadId, id), lt(dmMessages.createdAt, before))
    : eq(dmMessages.threadId, id);

  const rows = await db.select().from(dmMessages).where(whereExpr).orderBy(desc(dmMessages.createdAt)).limit(take);

  const senderIds = Array.from(new Set(rows.map((m) => m.senderId)));

  const { users } = await import("../../shared/schema");

  const senders =
    senderIds.length > 0
      ? await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatar: users.avatar,
          })
          .from(users)
          .where(inArray(users.id, senderIds))
      : [];

  const senderMap = new Map(senders.map((s) => [s.id, s]));

  const messagesWithSenders = rows.map((m) => ({
    ...m,
    sender: senderMap.get(m.senderId) || null,
  }));

  res.json({ ok: true, messages: messagesWithSenders.reverse() });
});

/**
 * POST /api/dm/threads
 */
r.post("/threads", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const body = z
    .object({
      participantIds: z.array(z.string()).min(1),
      title: z.string().max(120).optional(),
      isGroup: z.boolean().optional().default(false),
    })
    .parse(req.body);

  if (!body.isGroup && body.participantIds.length === 1) {
    const other = body.participantIds[0];

    const mine = await db.select().from(dmParticipants).where(eq(dmParticipants.userId, userId));
    const theirs = await db.select().from(dmParticipants).where(eq(dmParticipants.userId, other));

    const mySet = new Set(mine.map((p) => p.threadId));
    const shared = theirs.map((p) => p.threadId).find((id) => mySet.has(id));
    if (shared) return res.json({ ok: true, threadId: shared, reused: true });
  }

  const [thread] = await db
    .insert(dmThreads)
    .values({ isGroup: body.isGroup, title: body.title })
    .returning();

  const uniqueIds = Array.from(new Set([userId, ...body.participantIds]));
  await db.insert(dmParticipants).values(
    uniqueIds.map((uid, i) => ({
      threadId: thread.id,
      userId: uid,
      role: i === 0 ? "owner" : "member",
    }))
  );

  res.json({ ok: true, threadId: thread.id, reused: false });
});

/**
 * POST /api/dm/threads/:id/messages
 */
r.post("/threads/:id/messages", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const { id } = req.params;
  const body = z
    .object({
      text: z.string().min(1).max(8000),
      attachments: z
        .array(z.object({ name: z.string(), url: z.string().url(), type: z.string().optional() }))
        .optional(),
    })
    .parse(req.body);

  const member = await db
    .select()
    .from(dmParticipants)
    .where(and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)))
    .limit(1);

  if (member.length === 0) return res.status(403).json({ ok: false, error: "forbidden" });

  const [msg] = await db
    .insert(dmMessages)
    .values({
      threadId: id,
      senderId: userId,
      body: body.text,
      attachments: body.attachments ?? [],
    })
    .returning();

  await db
    .update(dmParticipants)
    .set({ lastReadMessageId: msg.id, lastReadAt: new Date() })
    .where(and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)));

  // ✅ Create notifications for other participants
  try {
    const [sender] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    const otherParticipants = await db
      .select()
      .from(dmParticipants)
      .where(and(eq(dmParticipants.threadId, id), ne(dmParticipants.userId, userId)));

    for (const participant of otherParticipants) {
      await db.insert(notifications).values({
        userId: participant.userId,
        type: "dm",
        title: `New message from ${sender?.displayName || sender?.username || "Someone"}`,
        message: body.text.substring(0, 100) + (body.text.length > 100 ? "..." : ""),
        linkUrl: `/messages/${id}`,
        metadata: { threadId: id, senderId: userId },
        priority: "normal",
      });
    }
  } catch (e) {
    console.error("DM notification error:", e);
  }

  res.json({ ok: true, message: msg });
});

/**
 * POST /api/dm/threads/:id/read
 */
r.post("/threads/:id/read", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const { id } = req.params;
  const body = z.object({ lastReadMessageId: z.string().optional() }).parse(req.body);

  const member = await db
    .select()
    .from(dmParticipants)
    .where(and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)))
    .limit(1);

  if (member.length === 0) return res.status(403).json({ ok: false, error: "forbidden" });

  await db
    .update(dmParticipants)
    .set({ lastReadMessageId: body.lastReadMessageId ?? null, lastReadAt: new Date() })
    .where(and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)));

  res.json({ ok: true });
});

export default r;
