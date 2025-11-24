// server/routes/suggestions.ts
import { Router } from "express";
import { and, eq, desc, gte, lte, sql, or } from "drizzle-orm";
import { db } from "../db";
import { aiSuggestions, recipes, customDrinks, userDrinkStats, nutritionLogs, users } from "../../shared/schema";
import { requireAuth } from "../middleware";
import { WeatherService } from "../services/weather.service";

const router = Router();

// Helper to detect missing table errors
const isMissingTable = (e: any) =>
  e && (e.code === "42P01" || /relation .* does not exist/i.test(e?.message || ""));

// GET /api/suggestions/today - Get today's AI suggestions
router.get("/today", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
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
      try {
        const generated = await generateDailySuggestions(userId);
        return res.json({ suggestions: generated });
      } catch (genError: any) {
        // If generation fails (e.g., missing related tables), return empty array
        if (isMissingTable(genError)) {
          return res.json({ suggestions: [] });
        }
        throw genError;
      }
    }

    return res.json({ suggestions });
  } catch (error: any) {
    if (isMissingTable(error)) {
      // Table doesn't exist yet - return empty array instead of error
      return res.json({ suggestions: [] });
    }
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/suggestions/:id/accept - Mark suggestion as accepted (user made the drink)
router.post("/:id/accept", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

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
    if (isMissingTable(error)) {
      return res.status(503).json({ error: "Suggestions feature not initialized yet" });
    }
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/suggestions/:id/dismiss - Dismiss a suggestion
router.post("/:id/dismiss", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

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
    if (isMissingTable(error)) {
      return res.status(503).json({ error: "Suggestions feature not initialized yet" });
    }
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/suggestions/generate - Manually trigger suggestion generation
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const suggestions = await generateDailySuggestions(userId);
    return res.json({ suggestions });
  } catch (error: any) {
    if (isMissingTable(error)) {
      return res.status(503).json({ error: "Suggestions feature not initialized yet" });
    }
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

  // Get weather data (default to NYC if user location not available)
  const weather = await WeatherService.getWeather();
  const weatherRecs = weather ? WeatherService.getDrinkRecommendations(weather) : null;

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

  // 1. Weather-based suggestion (HIGHEST PRIORITY - most engaging!)
  if (weather && weatherRecs) {
    try {
      // Find recipes matching weather conditions
      const weatherRecipes = await db
        .select()
        .from(recipes)
        .where(
          or(
            sql`LOWER(${recipes.category}) = ANY(ARRAY[${weatherRecs.categories.map(c => c.toLowerCase()).join(',')}])`,
            sql`${recipes.tags}::text[] && ARRAY[${weatherRecs.tags.map(t => `'${t}'`).join(',')}]::text[]`
          )
        )
        .limit(10);

      if (weatherRecipes.length > 0) {
        const randomWeatherRecipe = weatherRecipes[Math.floor(Math.random() * weatherRecipes.length)];
        suggestions.push({
          userId,
          date: today,
          suggestionType: "weather_based",
          recipeId: randomWeatherRecipe.id,
          title: `${randomWeatherRecipe.title} - Perfect for Today's Weather!`,
          reason: weatherRecs.description,
          confidence: 0.95,
          metadata: {
            weather: {
              temperature: weather.temperature,
              description: weather.description,
              isRaining: weather.isRaining,
              isCold: weather.isCold,
              isHot: weather.isHot,
            },
          },
        });
      }
    } catch (err) {
      console.error("Error creating weather suggestion:", err);
    }
  }

  // 2. Time-based suggestion with better context
  if (hour >= 6 && hour < 11) {
    // Morning suggestion
    const [morningRecipe] = await db
      .select()
      .from(recipes)
      .where(
        or(
          sql`LOWER(${recipes.category}) IN ('smoothie', 'juice', 'breakfast')`,
          eq(recipes.difficulty, "Easy")
        )
      )
      .limit(1)
      .offset(Math.floor(Math.random() * 10));

    if (morningRecipe) {
      suggestions.push({
        userId,
        date: today,
        suggestionType: "morning_drink",
        recipeId: morningRecipe.id,
        title: `☀️ Good morning! Start with ${morningRecipe.title}`,
        reason: userStats && userStats.currentStreak > 0
          ? `Day ${userStats.currentStreak + 1} of your streak! Perfect morning energy boost`
          : "Perfect morning energy boost to kickstart your day",
        confidence: 0.85,
        metadata: {
          timeOfDay: "morning",
          hasStreak: userStats?.currentStreak > 0,
        },
      });
    }
  } else if (hour >= 14 && hour < 17) {
    // Afternoon pick-me-up
    const [afternoonRecipe] = await db
      .select()
      .from(recipes)
      .where(
        sql`LOWER(${recipes.title}) LIKE '%energy%' OR LOWER(${recipes.title}) LIKE '%boost%' OR LOWER(${recipes.category}) IN ('smoothie', 'protein shake')`
      )
      .limit(1)
      .offset(Math.floor(Math.random() * 5));

    if (afternoonRecipe) {
      suggestions.push({
        userId,
        date: today,
        suggestionType: "mood_based",
        recipeId: afternoonRecipe.id,
        title: `Afternoon energy boost: ${afternoonRecipe.title}`,
        reason: "Beat the afternoon slump with this energizing drink",
        confidence: 0.82,
        metadata: {
          timeOfDay: "afternoon",
          mood: "tired",
        },
      });
    }
  }

  // 3. Enhanced nutrition gap analysis
  if (recentLogs.length > 0) {
    // Calculate average macros
    const avgProtein = recentLogs.reduce((sum, log) => sum + (parseFloat(String(log.protein)) || 0), 0) / recentLogs.length;
    const avgFiber = recentLogs.reduce((sum, log) => sum + (parseFloat(String(log.fiber)) || 0), 0) / recentLogs.length;
    const avgVitaminC = recentLogs.reduce((sum, log) => sum + (parseFloat(String(log.vitaminC)) || 0), 0) / recentLogs.length;

    const targetProtein = (userData?.macroGoals as any)?.protein || 150;
    const targetFiber = (userData?.macroGoals as any)?.fiber || 30;
    const targetVitaminC = (userData?.macroGoals as any)?.vitaminC || 90;

    // Check for protein gap
    if (avgProtein < targetProtein * 0.7) {
      const [proteinRecipe] = await db
        .select()
        .from(recipes)
        .where(
          sql`LOWER(${recipes.title}) LIKE '%protein%' OR LOWER(${recipes.category}) = 'protein shake'`
        )
        .limit(1)
        .offset(Math.floor(Math.random() * 5));

      if (proteinRecipe) {
        suggestions.push({
          userId,
          date: today,
          suggestionType: "nutrition_gap",
          recipeId: proteinRecipe.id,
          title: `💪 Boost your protein with ${proteinRecipe.title}`,
          reason: `You've been averaging ${avgProtein.toFixed(0)}g protein/day. Let's get you closer to your ${targetProtein}g goal!`,
          confidence: 0.92,
          metadata: {
            nutritionGap: {
              nutrient: "protein",
              current: avgProtein,
              target: targetProtein,
              percentOfGoal: (avgProtein / targetProtein * 100).toFixed(0),
            },
          },
        });
      }
    }
    // Check for fiber gap
    else if (avgFiber < targetFiber * 0.6) {
      const [fiberRecipe] = await db
        .select()
        .from(recipes)
        .where(
          sql`LOWER(${recipes.title}) LIKE '%berry%' OR LOWER(${recipes.title}) LIKE '%green%' OR LOWER(${recipes.category}) = 'smoothie'`
        )
        .limit(1)
        .offset(Math.floor(Math.random() * 5));

      if (fiberRecipe) {
        suggestions.push({
          userId,
          date: today,
          suggestionType: "nutrition_gap",
          recipeId: fiberRecipe.id,
          title: `🥬 Increase your fiber with ${fiberRecipe.title}`,
          reason: `You're getting ${avgFiber.toFixed(0)}g fiber/day. Aim for ${targetFiber}g for better digestion!`,
          confidence: 0.88,
          metadata: {
            nutritionGap: {
              nutrient: "fiber",
              current: avgFiber,
              target: targetFiber,
              percentOfGoal: (avgFiber / targetFiber * 100).toFixed(0),
            },
          },
        });
      }
    }
    // Check for vitamin C gap
    else if (avgVitaminC < targetVitaminC * 0.5) {
      const [vitaminRecipe] = await db
        .select()
        .from(recipes)
        .where(
          sql`LOWER(${recipes.title}) LIKE '%orange%' OR LOWER(${recipes.title}) LIKE '%citrus%' OR LOWER(${recipes.title}) LIKE '%berry%'`
        )
        .limit(1)
        .offset(Math.floor(Math.random() * 5));

      if (vitaminRecipe) {
        suggestions.push({
          userId,
          date: today,
          suggestionType: "nutrition_gap",
          recipeId: vitaminRecipe.id,
          title: `🍊 Boost your vitamin C with ${vitaminRecipe.title}`,
          reason: `You're low on vitamin C this week. This will help boost your immune system!`,
          confidence: 0.90,
          metadata: {
            nutritionGap: {
              nutrient: "vitamin C",
              current: avgVitaminC,
              target: targetVitaminC,
              percentOfGoal: (avgVitaminC / targetVitaminC * 100).toFixed(0),
            },
          },
        });
      }
    }
  }

  // 4. Streak motivation with better messaging
  if (userStats && userStats.currentStreak > 2) {
    const [streakRecipe] = await db
      .select()
      .from(recipes)
      .limit(1)
      .offset(Math.floor(Math.random() * 20));

    if (streakRecipe) {
      let streakMessage = "";
      let streakEmoji = "🔥";
      if (userStats.currentStreak >= 30) {
        streakMessage = "You're a legend!";
        streakEmoji = "🏆";
      } else if (userStats.currentStreak >= 14) {
        streakMessage = "Incredible dedication!";
        streakEmoji = "⭐";
      } else if (userStats.currentStreak >= 7) {
        streakMessage = "You're on fire!";
        streakEmoji = "🔥";
      } else {
        streakMessage = "Keep it going!";
        streakEmoji = "💪";
      }

      suggestions.push({
        userId,
        date: today,
        suggestionType: "mood_based",
        recipeId: streakRecipe.id,
        title: `${streakEmoji} ${userStats.currentStreak}-day streak! ${streakMessage}`,
        reason: `Try ${streakRecipe.title} to maintain your momentum`,
        confidence: 0.88,
        metadata: {
          mood: "motivated",
          currentStreak: userStats.currentStreak,
          longestStreak: userStats.longestStreak,
        },
      });
    }
  }

  // Limit to top 3 suggestions (highest confidence)
  const topSuggestions = suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  // Insert all suggestions
  if (topSuggestions.length > 0) {
    const inserted = await db.insert(aiSuggestions).values(topSuggestions).returning();
    return inserted;
  }

  return [];
}

export default router;
