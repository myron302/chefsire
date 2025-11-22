// server/routes/quests.ts
import { Router } from "express";
import { and, eq, desc, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { dailyQuests, questProgress, userDrinkStats, notifications } from "../../shared/schema";
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

// GET /api/quests/all - Get all quests (admin)
router.get("/all", async (req, res) => {
  try {
    // TODO: Add admin role check here
    const quests = await db
      .select()
      .from(dailyQuests)
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

    // Create notification for quest completion
    if (isComplete) {
      await db.insert(notifications).values({
        userId,
        type: "quest_complete",
        title: "Quest Completed! 🎉",
        message: `You completed "${quest?.title || "a quest"}" and earned ${progress.xpEarned} XP!`,
        linkUrl: "/quests",
        metadata: {
          questId,
          xpEarned: progress.xpEarned,
        },
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

    // Create notification for daily quests
    await db.insert(notifications).values({
      userId,
      type: "daily_quests",
      title: "New Daily Quests Available! 🎯",
      message: `${questsToAssign.length} new quest${questsToAssign.length > 1 ? 's are' : ' is'} waiting for you!`,
      linkUrl: "/quests",
      metadata: {
        questCount: questsToAssign.length,
        questIds: questsToAssign.map(q => q.id),
      },
    });
  }

  return questsToAssign;
}

// POST /api/quests/seed - Seed initial quests (admin/setup only)
router.post("/seed", async (req, res) => {
  try {
    // Check if quests already exist
    const existingQuests = await db.select().from(dailyQuests).limit(1);

    if (existingQuests.length > 0) {
      return res.json({
        message: "Daily quests already seeded",
        count: existingQuests.length
      });
    }

    const questsData = [
      // MAKE DRINK QUESTS
      {
        slug: "morning-boost",
        title: "Morning Energy Boost",
        description: "Make a caffeinated drink to start your day right",
        questType: "make_drink",
        category: "caffeinated",
        targetValue: 1,
        xpReward: 50,
        difficulty: "easy",
        recurringPattern: "weekday_only",
        metadata: { drinkCategory: "caffeinated", timeOfDay: "morning" },
      },
      {
        slug: "weekend-smoothie",
        title: "Weekend Smoothie Vibes",
        description: "Blend up a delicious smoothie this weekend",
        questType: "make_drink",
        category: "smoothies",
        targetValue: 1,
        xpReward: 50,
        difficulty: "easy",
        recurringPattern: "weekend_only",
        metadata: { drinkCategory: "smoothies" },
      },
      {
        slug: "protein-power",
        title: "Protein Power-Up",
        description: "Create a protein shake for your workout recovery",
        questType: "make_drink",
        category: "protein-shakes",
        targetValue: 1,
        xpReward: 75,
        difficulty: "medium",
        recurringPattern: "daily",
        metadata: { drinkCategory: "protein-shakes" },
      },
      {
        slug: "detox-delight",
        title: "Detox & Refresh",
        description: "Make a detox drink to cleanse and rejuvenate",
        questType: "make_drink",
        category: "detoxes",
        targetValue: 1,
        xpReward: 60,
        difficulty: "easy",
        recurringPattern: "daily",
        metadata: { drinkCategory: "detoxes" },
      },
      {
        slug: "evening-tea",
        title: "Evening Tea Time",
        description: "Brew a relaxing tea to wind down your day",
        questType: "make_drink",
        category: "caffeinated",
        targetValue: 1,
        xpReward: 50,
        difficulty: "easy",
        recurringPattern: "daily",
        metadata: { drinkCategory: "caffeinated", timeOfDay: "evening" },
      },
      // TRY CATEGORY QUESTS
      {
        slug: "try-green-smoothie",
        title: "Go Green!",
        description: "Try a green smoothie packed with nutrients",
        questType: "try_category",
        category: "smoothies",
        targetValue: 1,
        xpReward: 75,
        difficulty: "medium",
        recurringPattern: "weekly",
        metadata: { drinkCategory: "smoothies/green" },
      },
      {
        slug: "explore-matcha",
        title: "Matcha Magic",
        description: "Explore the world of matcha drinks",
        questType: "try_category",
        category: "caffeinated",
        targetValue: 1,
        xpReward: 80,
        difficulty: "medium",
        recurringPattern: "weekly",
        metadata: { drinkCategory: "caffeinated/matcha" },
      },
      // USE INGREDIENT QUESTS
      {
        slug: "banana-bonanza",
        title: "Banana Bonanza",
        description: "Create a drink using bananas",
        questType: "use_ingredient",
        targetValue: 1,
        xpReward: 60,
        difficulty: "easy",
        recurringPattern: "daily",
        metadata: { ingredient: "banana" },
      },
      {
        slug: "spinach-power",
        title: "Spinach Power",
        description: "Make a drink with spinach for iron and vitamins",
        questType: "use_ingredient",
        targetValue: 1,
        xpReward: 70,
        difficulty: "medium",
        recurringPattern: "daily",
        metadata: { ingredient: "spinach" },
      },
      {
        slug: "berry-blast",
        title: "Berry Blast",
        description: "Use berries in your drink for antioxidants",
        questType: "use_ingredient",
        targetValue: 1,
        xpReward: 65,
        difficulty: "easy",
        recurringPattern: "daily",
        metadata: { ingredient: "berries" },
      },
      // SOCIAL ACTION QUESTS
      {
        slug: "share-creation",
        title: "Share Your Creation",
        description: "Post a photo of your drink to inspire others",
        questType: "social_action",
        targetValue: 1,
        xpReward: 100,
        difficulty: "medium",
        recurringPattern: "daily",
        metadata: { requiredAction: "create_post" },
      },
      {
        slug: "like-and-engage",
        title: "Spread the Love",
        description: "Like 5 other chefs' creations",
        questType: "social_action",
        targetValue: 5,
        xpReward: 75,
        difficulty: "easy",
        recurringPattern: "daily",
        metadata: { requiredAction: "like_posts" },
      },
      {
        slug: "comment-kindness",
        title: "Leave Some Feedback",
        description: "Comment on 3 recipes or posts",
        questType: "social_action",
        targetValue: 3,
        xpReward: 90,
        difficulty: "medium",
        recurringPattern: "daily",
        metadata: { requiredAction: "comment" },
      },
      // STREAK MILESTONE QUESTS
      {
        slug: "three-day-streak",
        title: "3-Day Streak!",
        description: "Log in for 3 consecutive days",
        questType: "streak_milestone",
        targetValue: 3,
        xpReward: 150,
        difficulty: "medium",
        recurringPattern: "weekly",
        metadata: {},
      },
      {
        slug: "week-warrior",
        title: "Week Warrior",
        description: "Maintain a 7-day login streak",
        questType: "streak_milestone",
        targetValue: 7,
        xpReward: 300,
        difficulty: "hard",
        recurringPattern: "weekly",
        metadata: {},
      },
      // SPECIAL/SEASONAL QUESTS
      {
        slug: "hydration-hero",
        title: "Hydration Hero",
        description: "Create 3 different drinks in one day",
        questType: "make_drink",
        targetValue: 3,
        xpReward: 200,
        difficulty: "hard",
        recurringPattern: "daily",
        metadata: {},
      },
      {
        slug: "recipe-explorer",
        title: "Recipe Explorer",
        description: "Try a recipe you've never made before",
        questType: "try_category",
        targetValue: 1,
        xpReward: 100,
        difficulty: "medium",
        recurringPattern: "daily",
        metadata: {},
      },
    ];

    // Insert all quests
    const inserted = [];
    for (const quest of questsData) {
      const [newQuest] = await db.insert(dailyQuests).values({
        slug: quest.slug,
        title: quest.title,
        description: quest.description,
        questType: quest.questType,
        category: quest.category || null,
        targetValue: quest.targetValue,
        xpReward: quest.xpReward,
        difficulty: quest.difficulty,
        isActive: true,
        recurringPattern: quest.recurringPattern || null,
        metadata: quest.metadata,
      }).returning();
      inserted.push(newQuest);
    }

    return res.json({
      message: "Successfully seeded daily quests",
      count: inserted.length,
      quests: inserted
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/quests/:id - Delete a quest (admin)
router.delete("/:id", async (req, res) => {
  try {
    // TODO: Add admin role check here
    const { id } = req.params;

    // Delete the quest
    await db.delete(dailyQuests).where(eq(dailyQuests.id, id));

    // Also delete any associated quest progress
    await db.delete(questProgress).where(eq(questProgress.questId, id));

    return res.json({ message: "Quest deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
