// server/routes/notifications.ts
import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../db";
import { notifications } from "../../shared/schema";
import { requireAuth } from "../middleware";

const router = Router();

// GET /api/notifications - Get user's notifications
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === "true";

    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    if (unreadOnly) {
      query = db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset) as any;
    }

    const results = await query;

    return res.json({
      notifications: results,
      count: results.length,
      limit,
      offset,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const unreadNotifs = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

    return res.json({ count: unreadNotifs.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [updated] = await db
      .update(notifications)
      .set({ read: true, readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/notifications/mark-all-read - Mark all as read
router.put("/mark-all-read", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    await db
      .update(notifications)
      .set({ read: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notifications/:id - Delete notification
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [deleted] = await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notifications/clear-all - Clear all notifications
router.delete("/clear-all", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    await db
      .delete(notifications)
      .where(eq(notifications.userId, userId));

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
