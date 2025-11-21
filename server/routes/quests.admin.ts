// server/routes/quests.admin.ts
import { Router } from "express";
import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "../db";
import { dailyQuests } from "../../shared/schema";
import { requireAuth } from "../middleware";
import { requireAdmin } from "../middleware/require-admin";

const router = Router();

/**
 * GET /api/quests/admin/list
 * Query params:
 *  - q: search (title/description/slug)
 *  - type: exact quest_type
 *  - active: "true" | "false"
 */
router.get("/admin/list", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { q, type, active } = req.query as { q?: string; type?: string; active?: string };
    let where: any = undefined;

    if (q) {
      // Search title, description, or slug
      where = ilike(dailyQuests.title, `%${q}%`);
    }
    if (type) {
      where = where ? and(where, eq(dailyQuests.questType, type)) : eq(dailyQuests.questType, type);
    }
    if (active === "true" || active === "false") {
      const flag = active === "true";
      where = where ? and(where, eq(dailyQuests.isActive, flag)) : eq(dailyQuests.isActive, flag);
    }

    const quests = await db
      .select()
      .from(dailyQuests)
      .where(where ?? undefined)
      .orderBy(desc(dailyQuests.createdAt));

    return res.json({ quests });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/quests/admin/create
 * Body: { slug, title, description, questType, category?, targetValue?, xpReward?, difficulty?, isActive?, recurringPattern?, metadata? }
 */
router.post("/admin/create", requireAuth, requireAdmin, async (req, res) => {
  try {
    const p = req.body ?? {};
    const [created] = await db.insert(dailyQuests).values({
      slug: p.slug,
      title: p.title,
      description: p.description,
      questType: p.questType,
      category: p.category ?? null,
      targetValue: p.targetValue ?? 1,
      xpReward: p.xpReward ?? 50,
      difficulty: p.difficulty ?? "easy",
      isActive: p.isActive ?? true,
      recurringPattern: p.recurringPattern ?? null,
      metadata: p.metadata ?? {},
    }).returning();

    return res.json({ quest: created });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/quests/admin/update/:id
 */
router.patch("/admin/update/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const p = req.body ?? {};

    const [updated] = await db.update(dailyQuests)
      .set({
        slug: p.slug,
        title: p.title,
        description: p.description,
        questType: p.questType,
        category: p.category,
        targetValue: p.targetValue,
        xpReward: p.xpReward,
        difficulty: p.difficulty,
        isActive: p.isActive,
        recurringPattern: p.recurringPattern,
        metadata: p.metadata,
      })
      .where(eq(dailyQuests.id, id))
      .returning();

    return res.json({ quest: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/quests/admin/toggle/:id
 * Body: { isActive: boolean }
 */
router.post("/admin/toggle/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body as { isActive: boolean };

    const [updated] = await db.update(dailyQuests)
      .set({ isActive: !!isActive })
      .where(eq(dailyQuests.id, id))
      .returning();

    return res.json({ quest: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/quests/admin/delete/:id
 */
router.delete("/admin/delete/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(dailyQuests).where(eq(dailyQuests.id, id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
