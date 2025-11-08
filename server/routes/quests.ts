// server/routes/quests.ts
import { Router } from "express";
import { and, eq, desc, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { dailyQuests, questProgress, userDrinkStats } from "../../shared/schema";
import { requireAuth } from "../middleware";

const router = Router();

// GET /api/quests - Get all active quests
router.get("/", async (req, res) => {
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

// GET /api/quests/daily - Get today's quests for user
router.get("/daily", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user's quest progress for today
    const userQuests = await db
      .select({
        progress: questProgress,
        quest: dailyQuests,
      })
      .from(questProgress)
      .innerJoin(dailyQuests, eq(questProgress.questId, dailyQuests.id))
      .where(
        and(
          eq(questProgress.userId, userId),
          gte(questProgress.date, today)
        )
      );

    // If no quests for today, assign some
    if (userQuests.length === 0) {
      await assignDailyQuests(userId);
      // Re-fetch after assignment
      const newUserQuests = await db
        .select({
          progress: questProgress,
          quest: dailyQuests,
        })
        .from(questProgress)
        .innerJoin(dailyQuests, eq(questProgress.questId, dailyQuests.id))
        .where(
          and(
            eq(questProgress.userId, userId),
            gte(questProgress.date, today)
          )
        );

      return res.json({ quests: newUserQuests });
    }

    return res.json({ quests: userQuests });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/quests/:questId/progress - Update quest progress
router.post("/:questId/progress", requireAuth, async (req, res) => {
  try {
    const { questId } = req.params;
    const { increment = 1 } = req.body;
    const userId = req.user!.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the user's progress for this quest today
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

    // Check if already completed
    if (progress.status === "completed") {
      return res.json({ progress, alreadyCompleted: true });
    }

    // Update progress
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

    // If completed, award XP
    if (isComplete && progress.xpEarned > 0) {
      await db
        .update(userDrinkStats)
        .set({
          totalPoints: sql`${userDrinkStats.totalPoints} + ${progress.xpEarned}`,
          updatedAt: new Date(),
        })
        .where(eq(userDrinkStats.userId, userId));
    }

    // Get the quest details
    const [quest] = await db
      .select()
      .from(dailyQuests)
      .where(eq(dailyQuests.id, questId))
      .limit(1);

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

// POST /api/quests/create - Create a new quest (admin)
router.post("/create", requireAuth, async (req, res) => {
  try {
    // TODO: Add admin role check here
    const questData = req.body;

    const [quest] = await db
      .insert(dailyQuests)
      .values(questData)
      .returning();

    return res.json({ quest });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Helper function to assign daily quests to a user
async function assignDailyQuests(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get day of week
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Get all active quests that match today's pattern
  const availableQuests = await db
    .select()
    .from(dailyQuests)
    .where(eq(dailyQuests.isActive, true));

  // Filter quests based on recurring pattern
  const todaysQuests = availableQuests.filter(quest => {
    if (!quest.recurringPattern) return true; // Always available
    if (quest.recurringPattern === "daily") return true;
    if (quest.recurringPattern === "weekend_only" && isWeekend) return true;
    if (quest.recurringPattern === "weekday_only" && !isWeekend) return true;
    return false;
  });

  // Assign 3 random quests (or all if less than 3)
  const questsToAssign = todaysQuests
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  // Create progress entries for each quest
  const progressEntries = questsToAssign.map(quest => ({
    userId,
    questId: quest.id,
    date: today,
    currentProgress: 0,
    targetProgress: quest.targetValue || 1,
    status: "active" as const,
    xpEarned: quest.xpReward || 50,
  }));

  if (progressEntries.length > 0) {
    await db.insert(questProgress).values(progressEntries);
  }

  return questsToAssign;
}

export default router;
