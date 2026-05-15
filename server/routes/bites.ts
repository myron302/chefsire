// server/routes/bites.ts
import { Router } from "express";
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { storage } from "../storage";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { stories, users, notifications } from "../../shared/schema";

const r = Router();

function normalizeViewerId(rawUserId: string | undefined): string | undefined {
  if (!rawUserId) return undefined;
  const normalized = rawUserId.trim().toLowerCase();
  if (
    !normalized ||
    normalized === "public" ||
    normalized === "anonymous" ||
    normalized === "guest" ||
    normalized === "null" ||
    normalized === "undefined"
  ) {
    return undefined;
  }
  return rawUserId;
}

/**
 * Bites = stories (same data, different name).
 *
 * NOTE: we deliberately do the read query inline here instead of calling
 * storage.getActiveStories(). The storage helper does
 *   .select({ story: stories, user: users })
 * which asks Drizzle to pull EVERY column from the users table. If a column
 * in the Drizzle users schema doesn't exist in the live Neon DB (schema
 * drift), the whole query 500s and the bites row never shows new bites.
 *
 * By selecting only the 3 user fields the client actually needs, we make
 * this route robust to drift in unrelated user columns. We also left-join users:
 * if a bite was created for an auth/session id before the matching users row
 * existed (or the live DB is missing the FK), the story should still appear
 * instead of being silently filtered out of the feed.
 */

type ActiveBitePayload = {
  id: string;
  userId: string;
  imageUrl: string;
  mediaType: "image" | "video";
  caption: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  user: {
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
};

async function fetchActiveBites(): Promise<ActiveBitePayload[]> {
  if (!db) {
    throw Object.assign(
      new Error("Database not configured (set DATABASE_URL)."),
      {
        status: 503,
      },
    );
  }
  const rows = await db
    .select({
      id: stories.id,
      userId: stories.userId,
      imageUrl: stories.imageUrl,
      mediaType: stories.mediaType,
      caption: stories.caption,
      createdAt: stories.createdAt,
      expiresAt: stories.expiresAt,
      username: users.username,
      displayName: users.displayName,
      avatar: users.avatar,
    })
    .from(stories)
    .leftJoin(users, eq(stories.userId, users.id))
    .where(sql`${stories.expiresAt} > NOW()`)
    .orderBy(desc(stories.createdAt));

  return rows.map(
    (row: {
      id: string;
      userId: string;
      imageUrl: string;
      mediaType: "image" | "video";
      caption: string | null;
      createdAt: Date | string | null;
      expiresAt: Date | string | null;
      username: string | null;
      displayName: string | null;
      avatar: string | null;
    }) => ({
      id: row.id,
      userId: row.userId,
      imageUrl: row.imageUrl,
      mediaType: row.mediaType,
      caption: row.caption ?? null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      user: {
        username: row.username ?? "Chef",
        displayName: row.displayName ?? null,
        avatar: row.avatar ?? null,
      },
    }),
  );
}

// List currently-active bites across network (optionally scoped by viewer)
r.get("/active/:userId", async (req, res) => {
  try {
    const viewerId = normalizeViewerId(req.params.userId);
    const items = await fetchActiveBites();
    console.log(
      `[bites] GET /active/${viewerId ?? "(anon)"} -> ${items.length} item(s)`,
    );
    res.json(items);
  } catch (error) {
    console.error("[bites] /active/:userId error", error);
    res.status(500).json({ message: "Failed to fetch active bites" });
  }
});

// List currently-active bites without viewer context
r.get("/active", async (_req, res) => {
  try {
    const items = await fetchActiveBites();
    console.log(`[bites] GET /active -> ${items.length} item(s)`);
    res.json(items);
  } catch (error) {
    console.error("[bites] /active error", error);
    res.status(500).json({ message: "Failed to fetch active bites" });
  }
});

// List a user's bites (all, newest first) — still uses storage helper
// since this one doesn't join users.
r.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const items = await storage.getUserStories(userId);
    res.json({ bites: items, total: items.length });
  } catch (error) {
    console.error("[bites] /user error", error);
    res.status(500).json({ message: "Failed to fetch user bites" });
  }
});

// Create a bite (story)
r.post("/", async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      imageUrl: z.string().min(1),
      mediaType: z.enum(["image", "video"]),
      caption: z.string().max(500).optional(),
      expiresAt: z.string().datetime().optional(),
    });

    const data = schema.parse(req.body);
    const expiresAt = data.expiresAt
      ? new Date(data.expiresAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h default

    const created = await storage.createStory({
      userId: data.userId,
      imageUrl: data.imageUrl,
      mediaType: data.mediaType,
      caption: data.caption ?? null,
      expiresAt,
    } as any);

    console.log(
      `[bites] POST / -> created bite ${created?.id} for user ${data.userId} (expires ${expiresAt.toISOString()})`,
    );
    res.status(201).json({ message: "Bite created", bite: created });
  } catch (e: any) {
    if (e?.issues) {
      console.warn("[bites] POST / validation failed", e.issues);
      return res
        .status(400)
        .json({ message: "Invalid bite", errors: e.issues });
    }
    console.error("[bites] POST / error", e);
    res.status(500).json({ message: "Failed to create bite" });
  }
});

// Like a bite — fires a notification to the owner
r.post("/:id/like", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const likerId = req.user!.id;

    const [bite] = await db
      .select({ userId: stories.userId })
      .from(stories)
      .where(eq(stories.id, id))
      .limit(1);

    if (!bite) return res.status(404).json({ ok: false, error: "Bite not found" });

    if (bite.userId !== likerId) {
      const [liker] = await db
        .select({ displayName: users.displayName, username: users.username })
        .from(users)
        .where(eq(users.id, likerId))
        .limit(1);

      const likerName = liker?.displayName || liker?.username || "Someone";

      await db.insert(notifications).values({
        userId: bite.userId,
        type: "like",
        title: `${likerName} liked your Bite`,
        message: `${likerName} reacted to your Bite`,
        linkUrl: `/feed`,
        priority: "normal",
      });
    }

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[bites] POST /:id/like error", e);
    res.status(500).json({ ok: false, error: "Failed to record like" });
  }
});

export default r;
