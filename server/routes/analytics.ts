// server/routes/analytics.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middleware";

const router = Router();

// ============================================================================
// ANALYTICS: Advanced user statistics and insights
// ============================================================================

/**
 * GET /api/analytics/dashboard
 * Get comprehensive dashboard stats for logged-in user
 */
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    // Get today's stats
    const today = await db.execute(sql`
      SELECT * FROM user_analytics
      WHERE user_id = ${userId}
        AND date = CURRENT_DATE
    `);

    // Get this week's aggregated stats
    const weekStats = await db.execute(sql`
      SELECT
        SUM(total_recipes_made) as recipes_this_week,
        SUM(total_calories) as calories_this_week,
        SUM(total_protein) as protein_this_week,
        SUM(total_cost) as cost_this_week,
        AVG(current_streak) as avg_streak
      FROM user_analytics
      WHERE user_id = ${userId}
        AND date >= CURRENT_DATE - INTERVAL '7 days'
    `);

    // Get this month's aggregated stats
    const monthStats = await db.execute(sql`
      SELECT
        SUM(total_recipes_made) as recipes_this_month,
        SUM(total_calories) as calories_this_month,
        SUM(total_cost) as cost_this_month,
        COUNT(DISTINCT date) as active_days
      FROM user_analytics
      WHERE user_id = ${userId}
        AND date >= DATE_TRUNC('month', CURRENT_DATE)
    `);

    // Get all-time stats
    const allTimeStats = await db.execute(sql`
      SELECT
        COUNT(DISTINCT r.id) as total_unique_recipes,
        COUNT(*) as total_recipe_makes,
        MAX(ua.longest_streak) as longest_streak
      FROM user_analytics ua
      LEFT JOIN recipes r ON true  -- Placeholder for recipe tracking
      WHERE ua.user_id = ${userId}
    `);

    // Get taste profile
    const tasteProfile = await db.execute(sql`
      SELECT * FROM taste_profiles WHERE user_id = ${userId}
    `);

    // Get recent activity
    const recentActivity = await db.execute(sql`
      SELECT * FROM user_analytics
      WHERE user_id = ${userId}
        AND total_recipes_made > 0
      ORDER BY date DESC
      LIMIT 30
    `);

    res.json({
      today: today.rows[0] || null,
      week: weekStats.rows[0],
      month: monthStats.rows[0],
      allTime: allTimeStats.rows[0],
      tasteProfile: tasteProfile.rows[0] || null,
      recentActivity: recentActivity.rows,
    });
  } catch (error: any) {
    console.error("Error fetching dashboard analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

/**
 * GET /api/analytics/nutrition-trends
 * Get nutrition trends over time
 */
router.get("/nutrition-trends", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const days = parseInt(req.query.days as string) || 30;

    const trends = await db.execute(sql`
      SELECT
        date,
        total_calories,
        total_protein,
        total_carbs,
        total_fat,
        total_sugar,
        total_fiber
      FROM user_analytics
      WHERE user_id = ${userId}
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date ASC
    `);

    res.json({ trends: trends.rows });
  } catch (error: any) {
    console.error("Error fetching nutrition trends:", error);
    res.status(500).json({ error: "Failed to fetch nutrition trends" });
  }
});

/**
 * GET /api/analytics/ingredient-usage
 * Get ingredient usage statistics
 */
router.get("/ingredient-usage", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 20;

    // Get most recent ingredient usage data
    const latestAnalytics = await db.execute(sql`
      SELECT ingredient_usage, most_used_ingredient, total_unique_ingredients
      FROM user_analytics
      WHERE user_id = ${userId}
        AND ingredient_usage IS NOT NULL
      ORDER BY date DESC
      LIMIT 1
    `);

    if (latestAnalytics.rows.length === 0) {
      return res.json({ ingredientUsage: {}, topIngredients: [], totalUnique: 0 });
    }

    const data = latestAnalytics.rows[0];
    const ingredientUsage = data.ingredient_usage || {};

    // Convert to sorted array
    const topIngredients = Object.entries(ingredientUsage)
      .map(([name, count]) => ({ name, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, limit);

    res.json({
      ingredientUsage,
      topIngredients,
      mostUsed: data.most_used_ingredient,
      totalUnique: data.total_unique_ingredients,
    });
  } catch (error: any) {
    console.error("Error fetching ingredient usage:", error);
    res.status(500).json({ error: "Failed to fetch ingredient usage" });
  }
});

/**
 * GET /api/analytics/category-breakdown
 * Get recipe category usage breakdown
 */
router.get("/category-breakdown", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const days = parseInt(req.query.days as string) || 30;

    const categoryData = await db.execute(sql`
      SELECT
        date,
        recipes_by_category,
        favorite_category
      FROM user_analytics
      WHERE user_id = ${userId}
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
        AND recipes_by_category IS NOT NULL
      ORDER BY date DESC
      LIMIT 1
    `);

    if (categoryData.rows.length === 0) {
      return res.json({ categories: {}, favoriteCategory: null });
    }

    const data = categoryData.rows[0];
    const categories = data.recipes_by_category || {};

    res.json({
      categories,
      favoriteCategory: data.favorite_category,
    });
  } catch (error: any) {
    console.error("Error fetching category breakdown:", error);
    res.status(500).json({ error: "Failed to fetch category breakdown" });
  }
});

/**
 * GET /api/analytics/cost-analysis
 * Get cost analysis and spending trends
 */
router.get("/cost-analysis", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const days = parseInt(req.query.days as string) || 30;

    const costData = await db.execute(sql`
      SELECT
        date,
        total_cost,
        avg_cost_per_recipe,
        total_recipes_made
      FROM user_analytics
      WHERE user_id = ${userId}
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date ASC
    `);

    // Calculate totals
    const totalSpent = costData.rows.reduce((sum, row) => sum + parseFloat(row.total_cost || 0), 0);
    const totalRecipes = costData.rows.reduce((sum, row) => sum + (row.total_recipes_made || 0), 0);
    const avgCostPerRecipe = totalRecipes > 0 ? totalSpent / totalRecipes : 0;

    res.json({
      dailyCosts: costData.rows,
      totalSpent,
      avgCostPerRecipe,
      totalRecipes,
    });
  } catch (error: any) {
    console.error("Error fetching cost analysis:", error);
    res.status(500).json({ error: "Failed to fetch cost analysis" });
  }
});

/**
 * GET /api/analytics/time-insights
 * Get time-based insights (prep time, cooking patterns)
 */
router.get("/time-insights", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const days = parseInt(req.query.days as string) || 30;

    const timeData = await db.execute(sql`
      SELECT
        date,
        avg_prep_time,
        total_prep_time,
        total_recipes_made
      FROM user_analytics
      WHERE user_id = ${userId}
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date ASC
    `);

    // Get timing patterns from recipe timing log
    const timingPatterns = await db.execute(sql`
      SELECT
        time_of_day,
        day_of_week,
        COUNT(*) as frequency
      FROM recipe_timing_log
      WHERE user_id = ${userId}
        AND made_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY time_of_day, day_of_week
      ORDER BY frequency DESC
    `);

    const totalTime = timeData.rows.reduce((sum, row) => sum + (row.total_prep_time || 0), 0);
    const avgPrepTime = timeData.rows.reduce((sum, row) => sum + (row.avg_prep_time || 0), 0) / Math.max(timeData.rows.length, 1);

    res.json({
      dailyTime: timeData.rows,
      totalTimeSpent: totalTime,
      avgPrepTime,
      timingPatterns: timingPatterns.rows,
    });
  } catch (error: any) {
    console.error("Error fetching time insights:", error);
    res.status(500).json({ error: "Failed to fetch time insights" });
  }
});

/**
 * GET /api/analytics/taste-profile
 * Get detailed taste profile
 */
router.get("/taste-profile", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    const profile = await db.execute(sql`
      SELECT * FROM taste_profiles WHERE user_id = ${userId}
    `);

    if (profile.rows.length === 0) {
      // Return default profile
      return res.json({
        tasteProfile: {
          sweet: 50,
          salty: 50,
          sour: 50,
          bitter: 50,
          umami: 50,
          spicy: 50,
        },
        preferences: {
          categories: [],
          ingredients: [],
          dietaryRestrictions: [],
        },
        confidence: 0,
      });
    }

    const data = profile.rows[0];

    res.json({
      tasteProfile: {
        sweet: data.sweet_score,
        salty: data.salty_score,
        sour: data.sour_score,
        bitter: data.bitter_score,
        umami: data.umami_score,
        spicy: data.spicy_score,
      },
      preferences: {
        categories: data.preferred_categories || [],
        avoidedCategories: data.avoided_categories || [],
        ingredients: data.favorite_ingredients || [],
        avoidedIngredients: data.avoided_ingredients || [],
        dietaryRestrictions: data.dietary_restrictions || [],
        healthGoals: data.health_goals || [],
      },
      confidence: parseFloat(data.profile_confidence || 0),
      lastAnalyzed: data.last_analyzed,
    });
  } catch (error: any) {
    console.error("Error fetching taste profile:", error);
    res.status(500).json({ error: "Failed to fetch taste profile" });
  }
});

/**
 * POST /api/analytics/update-taste-profile
 * Update user's taste profile preferences
 */
router.post("/update-taste-profile", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    const schema = z.object({
      tasteScores: z.object({
        sweet: z.number().int().min(0).max(100).optional(),
        salty: z.number().int().min(0).max(100).optional(),
        sour: z.number().int().min(0).max(100).optional(),
        bitter: z.number().int().min(0).max(100).optional(),
        umami: z.number().int().min(0).max(100).optional(),
        spicy: z.number().int().min(0).max(100).optional(),
      }).optional(),
      preferences: z.object({
        preferredCategories: z.array(z.string()).optional(),
        avoidedCategories: z.array(z.string()).optional(),
        favoriteIngredients: z.array(z.string()).optional(),
        avoidedIngredients: z.array(z.string()).optional(),
        dietaryRestrictions: z.array(z.string()).optional(),
        healthGoals: z.array(z.string()).optional(),
      }).optional(),
    });

    const data = schema.parse(req.body);

    // Upsert taste profile
    const updateFields: string[] = [];
    const values: any[] = [];

    if (data.tasteScores) {
      if (data.tasteScores.sweet !== undefined) {
        updateFields.push(`sweet_score = ${data.tasteScores.sweet}`);
      }
      if (data.tasteScores.salty !== undefined) {
        updateFields.push(`salty_score = ${data.tasteScores.salty}`);
      }
      if (data.tasteScores.sour !== undefined) {
        updateFields.push(`sour_score = ${data.tasteScores.sour}`);
      }
      if (data.tasteScores.bitter !== undefined) {
        updateFields.push(`bitter_score = ${data.tasteScores.bitter}`);
      }
      if (data.tasteScores.umami !== undefined) {
        updateFields.push(`umami_score = ${data.tasteScores.umami}`);
      }
      if (data.tasteScores.spicy !== undefined) {
        updateFields.push(`spicy_score = ${data.tasteScores.spicy}`);
      }
    }

    if (data.preferences) {
      if (data.preferences.preferredCategories) {
        updateFields.push(`preferred_categories = '${JSON.stringify(data.preferences.preferredCategories)}'::jsonb`);
      }
      if (data.preferences.avoidedCategories) {
        updateFields.push(`avoided_categories = '${JSON.stringify(data.preferences.avoidedCategories)}'::jsonb`);
      }
      if (data.preferences.favoriteIngredients) {
        updateFields.push(`favorite_ingredients = '${JSON.stringify(data.preferences.favoriteIngredients)}'::jsonb`);
      }
      if (data.preferences.avoidedIngredients) {
        updateFields.push(`avoided_ingredients = '${JSON.stringify(data.preferences.avoidedIngredients)}'::jsonb`);
      }
      if (data.preferences.dietaryRestrictions) {
        updateFields.push(`dietary_restrictions = '${JSON.stringify(data.preferences.dietaryRestrictions)}'::jsonb`);
      }
      if (data.preferences.healthGoals) {
        updateFields.push(`health_goals = '${JSON.stringify(data.preferences.healthGoals)}'::jsonb`);
      }
    }

    if (updateFields.length > 0) {
      await db.execute(sql`
        INSERT INTO taste_profiles (user_id, ${sql.raw(updateFields.join(', '))}, updated_at)
        VALUES (${userId}, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET ${sql.raw(updateFields.join(', '))}, updated_at = NOW()
      `);
    }

    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error updating taste profile:", error);
    res.status(500).json({ error: "Failed to update taste profile" });
  }
});

/**
 * POST /api/analytics/log-recipe-timing
 * Log when a recipe was made (for timing analysis)
 */
router.post("/log-recipe-timing", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    const schema = z.object({
      recipeId: z.string(),
      context: z.record(z.any()).optional(),
    });

    const data = schema.parse(req.body);

    const now = new Date();
    const hour = now.getHours();
    let timeOfDay = 'night';
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';

    await db.execute(sql`
      INSERT INTO recipe_timing_log (
        user_id,
        recipe_id,
        time_of_day,
        day_of_week,
        context
      ) VALUES (
        ${userId},
        ${data.recipeId},
        ${timeOfDay},
        ${now.getDay()},
        ${JSON.stringify(data.context || {})}::jsonb
      )
    `);

    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error logging recipe timing:", error);
    res.status(500).json({ error: "Failed to log recipe timing" });
  }
});

export default router;
