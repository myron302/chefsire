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

/**
 * GET /api/quests
 * All active quests (public-ish)
 */
router.get("/", async (_req, res) => {
  try {
    const quests = await db
      .select()
      .from(dailyQuests)
      .where(eq(dailyQuests.isActive, true))
      .orderBy(desc(dailyQuests.createdAt));

    return res.json({ quests });
  } catch (error: any) {
    console.error("[quests] GET / error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/quests/daily
 * Today's quests for the authed user
 */
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

    // Assign if none yet
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
    console.error("[quests] GET /daily error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/quests/:questId/progress
 * Increment quest progress for current user
 */
router.post("/:questId/progress", requireAuth, async (req, res) => {
  try {
    const { questId } = req.params;
    const { increment = 1 } = req.body;
    const userId = req.user!.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [progressRow] = await db
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

    if (!progressRow) {
      return res.status(404).json({ error: "Quest progress not found for today" });
    }

    if (progressRow.status === "completed") {
      return res.json({ progress: progressRow, alreadyCompleted: true });
    }

    const newProgress = progressRow.currentProgress + increment;
    const isComplete = newProgress >= progressRow.targetProgress;

    const [updated] = await db
      .update(questProgress)
      .set({
        currentProgress: newProgress,
        status: isComplete ? "completed" : "active",
        completedAt: isComplete ? new Date() : null,
        xpEarned: isComplete ? progressRow.xpEarned : 0,
      })
      .where(eq(questProgress.id, progressRow.id))
      .returning();

    if (isComplete && progressRow.xpEarned > 0) {
      await db
        .update(userDrinkStats)
        .set({
          totalPoints: sql`${userDrinkStats.totalPoints} + ${progressRow.xpEarned}`,
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
        message: `You completed "${quest?.title || "a quest"}" and earned ${progressRow.xpEarned} XP!`,
        linkUrl: "/quests",
        metadata: { questId, xpEarned: progressRow.xpEarned },
        priority: "high",
      });
    }

    return res.json({
      progress: updated,
      quest,
      completed: isComplete,
      xpEarned: isComplete ? progressRow.xpEarned : 0,
    });
  } catch (error: any) {
    console.error("[quests] POST /:questId/progress error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/quests/create
 * Admin create quest
 */
router.post("/create", requireAuth, requireAdmin, async (req, res) => {
  try {
    const questData = req.body;
    const [quest] = await db.insert(dailyQuests).values(questData).returning();
    return res.json({ quest });
  } catch (error: any) {
    console.error("[quests] POST /create error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * ADMIN: GET /api/quests/admin
 * All quests (active + inactive) for the admin UI
 */
router.get("/admin", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const quests = await db
      .select()
      .from(dailyQuests)
      .orderBy(desc(dailyQuests.createdAt));

    return res.json({ quests });
  } catch (error: any) {
    console.error("[quests] GET /admin error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * ADMIN: PATCH /api/quests/admin/:id
 * Update existing quest (difficulty, xpReward, targetValue, isActive, etc.)
 */
router.patch("/admin/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      difficulty,
      xpReward,
      targetValue,
      isActive,
      category,
      recurringPattern,
    } = req.body || {};

    const updates: any = {};

    if (typeof title === "string" && title.trim()) updates.title = title.trim();
    if (typeof description === "string" && description.trim())
      updates.description = description.trim();
    if (typeof difficulty === "string") updates.difficulty = difficulty;
    if (typeof xpReward === "number" && !Number.isNaN(xpReward))
      updates.xpReward = xpReward;
    if (typeof targetValue === "number" && !Number.isNaN(targetValue))
      updates.targetValue = targetValue;
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (typeof category === "string") updates.category = category;
    if (typeof recurringPattern === "string")
      updates.recurringPattern = recurringPattern;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const [updated] = await db
      .update(dailyQuests)
      .set(updates)
      .where(eq(dailyQuests.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Quest not found" });
    }

    return res.json({ quest: updated });
  } catch (error: any) {
    console.error("[quests] PATCH /admin/:id error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/quests/seed
 * One-time default seeding (full array restored)
 */
router.post("/seed", async (_req, res) => {
  try {
    const existing = await db.select().from(dailyQuests).limit(1);
    if (existing.length > 0) {
      return res.json({
        message: "Daily quests already seeded",
        count: existing.length,
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

    const inserted = [];
    for (const quest of questsData) {
      const [newQuest] = await db
        .insert(dailyQuests)
        .values({
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
        })
        .returning();
      inserted.push(newQuest);
    }

    return res.json({
      message: "Successfully seeded daily quests",
      count: inserted.length,
      quests: inserted,
    });
  } catch (error: any) {
    console.error("[quests] POST /seed error:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
