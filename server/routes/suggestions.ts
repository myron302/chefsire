// server/routes/suggestions.ts
import { Router } from "express";
import { and, eq, desc, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { aiSuggestions, recipes, customDrinks, userDrinkStats, nutritionLogs, users } from "../../shared/schema";

const router = Router();

// GET /api/suggestions/today/:userId - Get today's AI suggestions
router.get("/today/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const suggestions = await db
      .select()
      .from(aiSuggestions)
      .where(
        and(
          eq(aiSuggestions.userId, userId),
          gte(aiSuggestions.date, today),
          eq(aiSuggestions.dismissed, false)
        )
      )
      .orderBy(desc(aiSuggestions.createdAt));

    // If no suggestions for today, generate some
    if (suggestions.length === 0) {
      const generated = await generateDailySuggestions(userId);
      return res.json({ suggestions: generated });
    }

    return res.json({ suggestions });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/suggestions/:id/accept - Mark suggestion as accepted (user made the drink)
router.post("/:id/accept", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const [updated] = await db
      .update(aiSuggestions)
      .set({
        accepted: true,
        acceptedAt: new Date(),
        viewed: true,
        viewedAt: new Date(),
      })
      .where(and(eq(aiSuggestions.id, id), eq(aiSuggestions.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Suggestion not found" });
    }

    return res.json({ suggestion: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/suggestions/:id/dismiss - Dismiss a suggestion
router.post("/:id/dismiss", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const [updated] = await db
      .update(aiSuggestions)
      .set({
        dismissed: true,
        dismissedAt: new Date(),
        viewed: true,
        viewedAt: new Date(),
      })
      .where(and(eq(aiSuggestions.id, id), eq(aiSuggestions.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Suggestion not found" });
    }

    return res.json({ suggestion: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/suggestions/generate/:userId - Manually trigger suggestion generation
router.post("/generate/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const suggestions = await generateDailySuggestions(userId);
    return res.json({ suggestions });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Helper function to generate AI suggestions
async function generateDailySuggestions(userId: string) {
  const today = new Date();
  const suggestions = [];

  // Get user stats and preferences
  const [userStats] = await db
    .select()
    .from(userDrinkStats)
    .where(eq(userDrinkStats.userId, userId))
    .limit(1);

  const [userData] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Get recent nutrition logs to check for gaps
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentLogs = await db
    .select()
    .from(nutritionLogs)
    .where(
      and(
        eq(nutritionLogs.userId, userId),
        gte(nutritionLogs.date, weekAgo)
      )
    );

  // Calculate hour of day for time-based suggestions
  const hour = today.getHours();

  // 1. Morning drink suggestion (6am - 11am)
  if (hour >= 6 && hour < 11) {
    const [morningRecipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.difficulty, "Easy"))
      .limit(1)
      .offset(Math.floor(Math.random() * 10));

    if (morningRecipe) {
      suggestions.push({
        userId,
        date: today,
        suggestionType: "morning_drink",
        recipeId: morningRecipe.id,
        title: `Start your day with ${morningRecipe.title}`,
        reason: "Perfect morning energy boost to kickstart your day",
        confidence: 0.85,
        metadata: {
          timeOfDay: "morning",
        },
      });
    }
  }

  // 2. Nutrition gap suggestion
  if (recentLogs.length > 0) {
    const avgProtein = recentLogs.reduce((sum, log) => sum + (parseFloat(String(log.protein)) || 0), 0) / recentLogs.length;
    const targetProtein = userData?.macroGoals?.protein || 150;

    if (avgProtein < targetProtein * 0.7) {
      // User is low on protein
      const [proteinRecipe] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.difficulty, "Easy"))
        .limit(1)
        .offset(Math.floor(Math.random() * 5));

      if (proteinRecipe) {
        suggestions.push({
          userId,
          date: today,
          suggestionType: "nutrition_gap",
          recipeId: proteinRecipe.id,
          title: `Boost your protein with ${proteinRecipe.title}`,
          reason: `You've been averaging ${avgProtein.toFixed(0)}g protein/day. Let's get you closer to your ${targetProtein}g goal!`,
          confidence: 0.92,
          metadata: {
            nutritionGap: {
              nutrient: "protein",
              current: avgProtein,
              target: targetProtein,
            },
          },
        });
      }
    }
  }

  // 3. Streak motivation (if they have a streak)
  if (userStats && userStats.currentStreak > 2) {
    const [streakRecipe] = await db
      .select()
      .from(recipes)
      .limit(1)
      .offset(Math.floor(Math.random() * 20));

    if (streakRecipe) {
      suggestions.push({
        userId,
        date: today,
        suggestionType: "mood_based",
        recipeId: streakRecipe.id,
        title: `Keep your ${userStats.currentStreak}-day streak alive!`,
        reason: `You're on fire! Try ${streakRecipe.title} to maintain your momentum`,
        confidence: 0.88,
        metadata: {
          mood: "motivated",
          recentActivity: "streak",
        },
      });
    }
  }

  // Insert all suggestions
  if (suggestions.length > 0) {
    const inserted = await db.insert(aiSuggestions).values(suggestions).returning();
    return inserted;
  }

  return [];
}

export default router;
