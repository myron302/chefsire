// server/routes/quests.ts
import { Router } from "express";
import { and, eq, desc, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  dailyQuests,
  questProgress,
  userDrinkStats,
  notifications,
} from "../../shared/schema";
import { requireAuth } from "../middleware";
import { requireAdmin } from "../middleware/require-admin";
import { assignDailyQuestsToUser } from "../services/quests.service";

const router = Router();

// GET /api/quests - All active quests
router.get("/", async (_req, res) => {
  try {
    const quests = await db
      .select()
      .from(dailyQuests)
      .where(eq(dailyQuests.isActive, true))
      .orderBy(desc(dailyQuests.createdAt));

    return res.json({ quests });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/quests/daily - Today's quests for the authed user
router.get("/daily", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's assignments
    let userQuests = await db
      .select({ progress: questProgress, quest: dailyQuests })
      .from(questProgress)
      .innerJoin(dailyQuests, eq(questProgress.questId, dailyQuests.id))
      .where(and(eq(questProgress.userId, userId), gte(questProgress.date, today)));

    // Assign if none
    if (userQuests.length === 0) {
      await assignDailyQuestsToUser(userId);
      userQuests = await db
        .select({ progress: questProgress, quest: dailyQuests })
        .from(questProgress)
        .innerJoin(dailyQuests, eq(questProgress.questId, dailyQuests.id))
        .where(and(eq(questProgress.userId, userId), gte(questProgress.date, today)));
    }

    return res.json({ quests: userQuests });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/quests/:questId/progress - Increment quest progress
router.post("/:questId/progress", requireAuth, async (req, res) => {
  try {
    const { questId } = req.params;
    const { increment = 1 } = req.body;
    const userId = req.user!.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [progress] = await db
      .select()
      .from(questProgress)
      .where(
        and(
          eq(questProgress.userId, userId),
          eq(questProgress.questId, questId),
          gte(questProgress.date, today)
        )
      )
      .limit(1);

    if (!progress) {
      return res.status(404).json({ error: "Quest progress not found for today" });
    }

    if (progress.status === "completed") {
      return res.json({ progress, alreadyCompleted: true });
    }

    const newProgress = progress.currentProgress + increment;
    const isComplete = newProgress >= progress.targetProgress;

    const [updated] = await db
      .update(questProgress)
      .set({
        currentProgress: newProgress,
        status: isComplete ? "completed" : "active",
        completedAt: isComplete ? new Date() : null,
        xpEarned: isComplete ? progress.xpEarned : 0,
      })
      .where(eq(questProgress.id, progress.id))
      .returning();

    if (isComplete && progress.xpEarned > 0) {
      await db
        .update(userDrinkStats)
        .set({
          totalPoints: sql`${userDrinkStats.totalPoints} + ${progress.xpEarned}`,
          updatedAt: new Date(),
        })
        .where(eq(userDrinkStats.userId, userId));
    }

    const [quest] = await db
      .select()
      .from(dailyQuests)
      .where(eq(dailyQuests.id, questId))
      .limit(1);

    if (isComplete) {
      await db.insert(notifications).values({
        userId,
        type: "quest_complete",
        title: "Quest Completed! 🎉",
        message: `You completed "${quest?.title || "a quest"}" and earned ${
          progress.xpEarned
        } XP!`,
        linkUrl: "/quests",
        metadata: { questId, xpEarned: progress.xpEarned },
        priority: "high",
      });
    }

    return res.json({
      progress: updated,
      quest,
      completed: isComplete,
      xpEarned: isComplete ? progress.xpEarned : 0,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/quests/create - Admin create quest
router.post("/create", requireAuth, requireAdmin, async (req, res) => {
  try {
    const questData = req.body;

    const [quest] = await db
      .insert(dailyQuests)
      .values({
        ...questData,
        category: questData.category || null,
        recurringPattern: questData.recurringPattern || null,
      })
      .returning();

    return res.json({ quest });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// OPTIONAL: Admin update quest (toggle isActive, tweak XP, etc.)
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const [updated] = await db
      .update(dailyQuests)
      .set({
        ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description }
          : {}),
        ...(payload.questType !== undefined ? { questType: payload.questType } : {}),
        ...(payload.category !== undefined ? { category: payload.category || null } : {}),
        ...(payload.targetValue !== undefined
          ? { targetValue: payload.targetValue }
          : {}),
        ...(payload.xpReward !== undefined ? { xpReward: payload.xpReward } : {}),
        ...(payload.difficulty !== undefined ? { difficulty: payload.difficulty } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(payload.recurringPattern !== undefined
          ? { recurringPattern: payload.recurringPattern || null }
          : {}),
      })
      .where(eq(dailyQuests.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Quest not found" });
    }

    return res.json({ quest: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/quests/seed - One-time default seeding
router.post("/seed", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const existingQuests = await db.select().from(dailyQuests).limit(1);

    if (existingQuests.length > 0) {
      return res.json({
        message: "Daily quests already seeded",
        count: existingQuests.length,
      });
    }

    // Keep your original full questsData array here if you still want this
    // endpoint available for re-seeding. Since you've already run it and your
    // DB is populated, this is mostly a safety/backup.

    return res.json({
      message:
        "Seed endpoint protected. Quests table is empty but no inline seed array in this build.",
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
