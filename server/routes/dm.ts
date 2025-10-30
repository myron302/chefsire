import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, inArray, lt, ne } from "drizzle-orm";
import { db } from "../db"; // your existing Drizzle instance
import { dmThreads, dmParticipants, dmMessages } from "../../shared/schema.dm";

// --- Replace this with your actual auth/user extraction ---
function getUserId(req: any): string {
  // Prefer your real auth (req.user.id, session, JWT, etc.)
  return (req.user?.id || req.headers["x-user-id"]) as string;
}

const r = Router();

// List threads for current user (with last message + unread count)
r.get("/threads", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  // Threads where user participates
  const parts = await db.select().from(dmParticipants).where(eq(dmParticipants.userId, userId));
  const threadIds = parts.map(p => p.threadId);
  if (threadIds.length === 0) return res.json({ ok: true, threads: [] });

  // Last messages per thread
  const lastMessages = await db.query.dmMessages.findMany({
    where: inArray(dmMessages.threadId, threadIds),
    orderBy: desc(dmMessages.createdAt),
    limit: 500, // coarse cap
  });

  // Group by thread
  const lastByThread = new Map<string, any>();
  for (const m of lastMessages) {
    if (!lastByThread.has(m.threadId)) lastByThread.set(m.threadId, m);
  }

  // Basic thread info
  const threads = await db.select().from(dmThreads).where(inArray(dmThreads.id, threadIds));

  // Unread counts (approx: messages after lastReadAt)
  const unreadCounts: Record<string, number> = {};
  for (const th of threads) {
    const me = parts.find(p => p.threadId === th.id);
    if (!me?.lastReadAt) {
      unreadCounts[th.id] = lastMessages.filter(m => m.threadId === th.id && m.senderId !== userId).length;
    } else {
      unreadCounts[th.id] = lastMessages.filter(m =>
        m.threadId === th.id &&
        m.senderId !== userId &&
        new Date(m.createdAt).getTime() > new Date(me.lastReadAt).getTime()
      ).length;
    }
  }

  const out = threads.map(t => ({
    ...t,
    lastMessage: lastByThread.get(t.id) || null,
    unread: unreadCounts[t.id] || 0,
  }));

  res.json({ ok: true, threads: out });
});

// Get messages in a thread (paged)
r.get("/threads/:id/messages", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { id } = req.params;
  const take = Math.min(Number(req.query.take) || 30, 100);
  const before = req.query.before ? new Date(String(req.query.before)) : undefined;

  // Verify membership
  const member = await db.query.dmParticipants.findFirst({
    where: and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)),
  });
  if (!member) return res.status(403).json({ ok: false, error: "forbidden" });

  const where = before
    ? and(eq(dmMessages.threadId, id), lt(dmMessages.createdAt, before))
    : eq(dmMessages.threadId, id);

  const messages = await db.query.dmMessages.findMany({
    where, orderBy: desc(dmMessages.createdAt), limit: take,
  });

  res.json({ ok: true, messages: messages.reverse() });
});

// Create (or get) a 1:1 thread with another user
r.post("/threads", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const body = z.object({
    participantIds: z.array(z.string().uuid()).min(1), // for 1:1 pass [otherUserId]
    title: z.string().max(120).optional(),
    isGroup: z.boolean().optional().default(false),
  }).parse(req.body);

  // 1:1 optimization: if exactly two users and not group, reuse existing thread
  if (!body.isGroup && body.participantIds.length === 1) {
    const otherId = body.participantIds[0];
    // find any thread with exactly those two
    const myParts = await db.select().from(dmParticipants).where(eq(dmParticipants.userId, userId));
    const otherParts = await db.select().from(dmParticipants).where(eq(dmParticipants.userId, otherId));
    const common = new Set(myParts.map(p => p.threadId));
    const shared = otherParts.map(p => p.threadId).find(tid => common.has(tid));
    if (shared) {
      return res.json({ ok: true, threadId: shared, reused: true });
    }
  }

  const [thread] = await db.insert(dmThreads).values({
    isGroup: body.isGroup,
    title: body.title,
  }).returning();

  const participants = Array.from(new Set([userId, ...body.participantIds])).map((uid, i) => ({
    threadId: thread.id,
    userId: uid,
    role: i === 0 ? "owner" : "member",
  }));
  await db.insert(dmParticipants).values(participants);

  res.json({ ok: true, threadId: thread.id, reused: false });
});

// Send a message
r.post("/threads/:id/messages", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { id } = req.params;
  const body = z.object({
    text: z.string().min(1).max(8000),
    attachments: z.array(z.object({
      name: z.string(),
      url: z.string().url(),
      type: z.string().optional(),
    })).optional(),
  }).parse(req.body);

  // Check membership
  const member = await db.query.dmParticipants.findFirst({
    where: and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)),
  });
  if (!member) return res.status(403).json({ ok: false, error: "forbidden" });

  const [msg] = await db.insert(dmMessages).values({
    threadId: id,
    senderId: userId,
    body: body.text,
    attachments: body.attachments ?? [],
  }).returning();

  // bump sender read
  await db.update(dmParticipants)
    .set({ lastReadMessageId: msg.id, lastReadAt: new Date() })
    .where(and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)));

  // Let realtime layer fan out (it will also emit). If you don't wire sockets yet, this still works.
  res.json({ ok: true, message: msg });
});

// Mark read (up to a specific message or "now")
r.post("/threads/:id/read", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { id } = req.params;
  const body = z.object({ lastReadMessageId: z.string().uuid().optional() }).parse(req.body);

  // Verify membership
  const member = await db.query.dmParticipants.findFirst({
    where: and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)),
  });
  if (!member) return res.status(403).json({ ok: false, error: "forbidden" });

  await db.update(dmParticipants)
    .set({ lastReadMessageId: body.lastReadMessageId ?? null, lastReadAt: new Date() })
    .where(and(eq(dmParticipants.threadId, id), eq(dmParticipants.userId, userId)));

  res.json({ ok: true });
});

export default r;
