// server/routes/dm.ts
import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware";
import {
  dmThreads,
  dmParticipants,
  dmMessages,
} from "../../shared/schema.dm.ts";

const r = Router();

/**
 * GET /api/dm/threads
 * List the current user's DM threads with lastMessage + unread count.
 */
r.get("/threads", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  // All participant rows for this user
  const parts = await db
    .select()
    .from(dmParticipants)
    .where(eq(dmParticipants.userId, userId));

  const threadIds = parts.map((p) => p.threadId);
  if (threadIds.length === 0) return res.json({ ok: true, threads: [] });

  const threads = await db
    .select()
    .from(dmThreads)
    .where(inArray(dmThreads.id, threadIds));

  // Load all participants for these threads
  const allParticipants = await db
    .select()
    .from(dmParticipants)
    .where(inArray(dmParticipants.threadId, threadIds));

  // Get unique user IDs from participants
  const participantUserIds = Array.from(new Set(allParticipants.map(p => p.userId)));

  // Import users table to get user details
  const { users } = await import("../../shared/schema");

  // Load user details for all participants (only if we have any)
  const participantUsers = participantUserIds.length > 0
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

  // Create a map of thread ID to participants with user details
  const participantsByThread = new Map<string, typeof participantUsers>();
  for (const thread of threads) {
    const threadParticipantIds = allParticipants
      .filter(p => p.threadId === thread.id)
      .map(p => p.userId);
    participantsByThread.set(
      thread.id,
      participantUsers.filter(u => threadParticipantIds.includes(u.id))
    );
  }

  // Pull recent messages across all my threads once (avoid N+1)
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

  // Compute an approximate unread count by comparing to lastReadAt
  const unreadByThread: Record<string, number> = {};
  for (const th of threads) {
    const me = parts.find((p) => p.threadId === th.id);
    const base = recentMessages.filter(
      (m) => m.threadId === th.id && m.senderId !== userId
    );
    if (!me?.lastReadAt) {
      unreadByThread[th.id] = base.length;
    } else {
      const t0 = new Date(me.lastReadAt).getTime();
      unreadByThread[th.id] = base.filter(
        (m) => new Date(m.createdAt).getTime() > t0
      ).length;
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
 * GET /api/dm/threads/:id/messages?take=30&before=ISO_DATE
 * Paged messages (newest→oldest on wire; we reverse for display).
 */
r.get("/threads/:id/messages", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const { id } = req.params;
  const take = Math.min(Number(req.query.take) || 30, 100);
  const before = req.query.before ? new Date(String(req.query.before)) : undefined;

  // Membership check
  const member = await db
    .select()
    .from(dmParticipants)
    .where(and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)))
    .limit(1);
  if (member.length === 0) return res.status(403).json({ ok: false, error: "forbidden" });

  const whereExpr = before
    ? and(eq(dmMessages.threadId, id), lt(dmMessages.createdAt, before))
    : eq(dmMessages.threadId, id);

  const rows = await db
    .select()
    .from(dmMessages)
    .where(whereExpr)
    .orderBy(desc(dmMessages.createdAt))
    .limit(take);

  res.json({ ok: true, messages: rows.reverse() });
});

/**
 * POST /api/dm/threads
 * Create a thread (reuses 1:1 when possible).
 * body: { participantIds: string[], title?: string, isGroup?: boolean }
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

  // Reuse 1:1 threads
  if (!body.isGroup && body.participantIds.length === 1) {
    const other = body.participantIds[0];

    const mine = await db
      .select()
      .from(dmParticipants)
      .where(eq(dmParticipants.userId, userId));
    const theirs = await db
      .select()
      .from(dmParticipants)
      .where(eq(dmParticipants.userId, other));

    const mySet = new Set(mine.map((p) => p.threadId));
    const shared = theirs.map((p) => p.threadId).find((id) => mySet.has(id));
    if (shared) return res.json({ ok: true, threadId: shared, reused: true });
  }

  // Create new thread + participants
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
 * Send a message in a thread (must be a member).
 * body: { text: string, attachments?: {name,url,type?}[] }
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

  // Mark my read
  await db
    .update(dmParticipants)
    .set({ lastReadMessageId: msg.id, lastReadAt: new Date() })
    .where(and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)));

  res.json({ ok: true, message: msg });
});

/**
 * POST /api/dm/threads/:id/read
 * body: { lastReadMessageId?: string }
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
