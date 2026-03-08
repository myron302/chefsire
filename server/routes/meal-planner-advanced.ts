import express, { type Request, type Response, type NextFunction } from "express";
import { db } from "../db/index.js";
import { eq, and, desc, sql, gte, lte, isNull, asc } from "drizzle-orm";
import {
  mealRecommendations,
  mealPrepSchedules,
  leftovers,
  groceryListItems,
  userMealPlanProgress,
  mealPlanAchievements,
  userMealPlanAchievements,
  familyMealProfiles,
  recipes,
  mealPlanBlueprints,
  users,
  nutritionLogs,
  mealPlans,
  pantryItems,
  familyMembers,
  mealStreaks,
  bodyMetrics,
  mealFavorites,
  waterLogs,
  mealPlanEntries,
  mealPlans,
} from "../../shared/schema.js";
import { requireAuth } from "../middleware";

const router = express.Router();

// ============================================================
// Schema safety: ensure advanced meal planning tables/columns exist
// This keeps production DBs compatible even if a migration was missed.
// ============================================================

let _advancedMealPlanningSchemaReady: Promise<void> | null = null;

async function ensureAdvancedMealPlanningSchema() {
  if (_advancedMealPlanningSchemaReady) return _advancedMealPlanningSchemaReady;

  _advancedMealPlanningSchemaReady = (async () => {
    if (!db) {
      throw new Error("Database is not configured (missing DATABASE_URL).");
    }

    // gen_random_uuid() is provided by pgcrypto
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // ---- Create tables if missing (id defaults match shared/schema) ----
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_recommendations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipe_id VARCHAR REFERENCES recipes(id),
        blueprint_id VARCHAR REFERENCES meal_plan_blueprints(id),
        recommendation_type TEXT NOT NULL,
        target_date TIMESTAMP,
        meal_type TEXT,
        score DECIMAL(3, 2) NOT NULL,
        reason TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        accepted BOOLEAN DEFAULT false,
        dismissed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_recommendations_user_idx ON meal_recommendations(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_recommendations_date_idx ON meal_recommendations(target_date);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_recommendations_score_idx ON meal_recommendations(score);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_prep_schedules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_plan_id VARCHAR REFERENCES meal_plans(id),
        prep_day TEXT NOT NULL,
        prep_time TEXT,
        batch_recipes JSONB DEFAULT '[]'::jsonb,
        shopping_day TEXT,
        notes TEXT,
        is_running_low BOOLEAN DEFAULT false,
        reminder_enabled BOOLEAN DEFAULT true,
        reminder_time TEXT,
        completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_prep_schedules_user_idx ON meal_prep_schedules(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_prep_schedules_prep_day_idx ON meal_prep_schedules(prep_day);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS leftovers (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipe_id VARCHAR REFERENCES recipes(id),
        recipe_name TEXT NOT NULL,
        quantity TEXT,
        stored_date TIMESTAMP NOT NULL,
        expiry_date TIMESTAMP,
        storage_location TEXT,
        notes TEXT,
        is_running_low BOOLEAN DEFAULT false,
        consumed BOOLEAN DEFAULT false,
        consumed_at TIMESTAMP,
        wasted BOOLEAN DEFAULT false,
        repurposed_into VARCHAR REFERENCES recipes(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS leftovers_user_idx ON leftovers(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS leftovers_expiry_idx ON leftovers(expiry_date);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS leftovers_consumed_idx ON leftovers(consumed);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grocery_list_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_plan_id VARCHAR REFERENCES meal_plans(id),
        list_name TEXT DEFAULT 'My Grocery List',
        ingredient_name TEXT NOT NULL,
        quantity TEXT,
        unit TEXT,
        category TEXT,
        location TEXT,
        estimated_price DECIMAL(8, 2),
        actual_price DECIMAL(8, 2),
        store TEXT,
        aisle TEXT,
        priority TEXT DEFAULT 'normal',
        is_pantry_item BOOLEAN DEFAULT false,
        is_running_low BOOLEAN DEFAULT false,
        purchased BOOLEAN DEFAULT false,
        purchased_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS grocery_list_items_user_idx ON grocery_list_items(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS grocery_list_items_category_idx ON grocery_list_items(category);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS grocery_list_items_purchased_idx ON grocery_list_items(purchased);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_streaks (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_logged_date DATE,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS body_metrics (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        weight_lbs DECIMAL(8, 2) NOT NULL,
        body_fat_pct DECIMAL(5, 2),
        waist_in DECIMAL(6, 2),
        hip_in DECIMAL(6, 2),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_favorites (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_name TEXT NOT NULL,
        calories INTEGER,
        protein INTEGER,
        carbs INTEGER,
        fat INTEGER,
        fiber INTEGER,
        is_favorite BOOLEAN DEFAULT false,
        times_logged INTEGER DEFAULT 0,
        last_used TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS water_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        glasses_logged INTEGER NOT NULL DEFAULT 0,
        daily_target INTEGER NOT NULL DEFAULT 8,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS water_logs_user_date_uidx ON water_logs(user_id, date);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS meal_streaks_user_uidx ON meal_streaks(user_id);`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS source VARCHAR(50);`);

    // ---- Patch older deployments that created these tables without newer columns ----
    await db.execute(sql`ALTER TABLE meal_prep_schedules ADD COLUMN IF NOT EXISTS is_running_low BOOLEAN DEFAULT false;`);
    await db.execute(sql`ALTER TABLE leftovers ADD COLUMN IF NOT EXISTS is_running_low BOOLEAN DEFAULT false;`);
    await db.execute(sql`ALTER TABLE grocery_list_items ADD COLUMN IF NOT EXISTS location TEXT;`);
    await db.execute(sql`ALTER TABLE grocery_list_items ADD COLUMN IF NOT EXISTS is_running_low BOOLEAN DEFAULT false;`);

    // Backfill nulls for safety (older rows)
    await db.execute(sql`UPDATE meal_prep_schedules SET is_running_low = false WHERE is_running_low IS NULL;`);
    await db.execute(sql`UPDATE leftovers SET is_running_low = false WHERE is_running_low IS NULL;`);
    await db.execute(sql`UPDATE grocery_list_items SET is_running_low = false WHERE is_running_low IS NULL;`);
  })();

  return _advancedMealPlanningSchemaReady;
}

router.use(async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureAdvancedMealPlanningSchema();
    next();
  } catch (e: any) {
    console.error("[meal-planner-advanced] Schema ensure failed:", e);
    res.status(500).json({
      message: "Meal planner database schema is not ready",
      details: String(e?.message || e),
    });
  }
});

// ============================================================
// AI-POWERED MEAL RECOMMENDATIONS
// ============================================================

// Generate AI meal recommendations for user
router.post("/meal-recommendations/generate", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetDate, mealType } = req.body;

    // Fetch user's nutrition goals and preferences
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get recent nutrition logs to identify gaps
    const recentLogs = await db
      .select()
      .from(nutritionLogs)
      .where(
        and(
          eq(nutritionLogs.userId, userId),
          gte(nutritionLogs.date, sql`NOW() - INTERVAL '7 days'`)
        )
      )
      .orderBy(desc(nutritionLogs.date));

    // Calculate nutritional gaps
    const totalCalories = recentLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
    const avgDailyCalories = totalCalories / 7;
    const calorieGoal = user.dailyCalorieGoal || 2000;
    const calorieDifference = calorieGoal - avgDailyCalories;

    // Get recipes that match user's dietary restrictions
    const dietaryRestrictions = (user.dietaryRestrictions as string[]) || [];

    // Simple recommendation logic - in production, this would use ML
    const recommendedRecipes = await db
      .select()
      .from(recipes)
      .where(
        sql`
          ${recipes.calories} BETWEEN ${Math.max(0, calorieGoal / 4 - 200)}
          AND ${calorieGoal / 4 + 200}
        `
      )
      .limit(10);

    // Create recommendations
    const recommendations = [];
    for (const recipe of recommendedRecipes) {
      const score = Math.random() * 0.3 + 0.7; // 0.7-1.0
      const reason = calorieDifference > 0
        ? `This meal helps you meet your ${calorieGoal} calorie goal`
        : "This meal provides balanced nutrition";

      const [recommendation] = await db
        .insert(mealRecommendations)
        .values({
          userId,
          recipeId: recipe.id,
          recommendationType: "nutritional_balance",
          targetDate: targetDate ? new Date(targetDate) : null,
          mealType,
          score: score.toFixed(2),
          reason,
          metadata: {
            calorieDifference,
            dietaryRestrictions,
          },
        })
        .returning();

      recommendations.push({
        ...recommendation,
        recipe,
      });
    }

    res.json({ recommendations });
  } catch (error) {
    console.error("Error generating meal recommendations:", error);
    res.status(500).json({ message: "Failed to generate recommendations" });
  }
});

// Get user's meal recommendations
router.get("/meal-recommendations", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { date, mealType, accepted, dismissed } = req.query;

    const whereConditions = [eq(mealRecommendations.userId, userId)];

    if (date) {
      whereConditions.push(eq(mealRecommendations.targetDate, new Date(date as string)));
    }
    if (mealType) {
      whereConditions.push(eq(mealRecommendations.mealType, mealType as string));
    }
    if (accepted !== undefined) {
      whereConditions.push(eq(mealRecommendations.accepted, accepted === "true"));
    }
    if (dismissed !== undefined) {
      whereConditions.push(eq(mealRecommendations.dismissed, dismissed === "true"));
    }

    const recommendations = await db
      .select({
        recommendation: mealRecommendations,
        recipe: recipes,
      })
      .from(mealRecommendations)
      .leftJoin(recipes, eq(mealRecommendations.recipeId, recipes.id))
      .where(and(...whereConditions))
      .orderBy(desc(mealRecommendations.createdAt))
      .limit(50);

    res.json({ recommendations });
  } catch (error) {
    console.error("Error fetching meal recommendations:", error);
    res.status(500).json({ message: "Failed to fetch recommendations" });
  }
});

// Accept meal recommendation
router.patch("/meal-recommendations/:id/accept", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const [updated] = await db
      .update(mealRecommendations)
      .set({ accepted: true })
      .where(and(eq(mealRecommendations.id, id), eq(mealRecommendations.userId, userId)))
      .returning();

    res.json({ recommendation: updated });
  } catch (error) {
    console.error("Error accepting recommendation:", error);
    res.status(500).json({ message: "Failed to accept recommendation" });
  }
});

// Dismiss meal recommendation
router.patch("/meal-recommendations/:id/dismiss", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const [updated] = await db
      .update(mealRecommendations)
      .set({ dismissed: true })
      .where(and(eq(mealRecommendations.id, id), eq(mealRecommendations.userId, userId)))
      .returning();

    res.json({ recommendation: updated });
  } catch (error) {
    console.error("Error dismissing recommendation:", error);
    res.status(500).json({ message: "Failed to dismiss recommendation" });
  }
});

// ============================================================
// MEAL PREP SCHEDULING
// ============================================================

// Create meal prep schedule
router.post("/prep-schedules", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      mealPlanId,
      prepDay,
      prepTime,
      batchRecipes,
      shoppingDay,
      notes,
      reminderEnabled,
      reminderTime,
    } = req.body;

    if (!prepDay) {
      return res.status(400).json({ message: "Prep day is required" });
    }

    const [schedule] = await db
      .insert(mealPrepSchedules)
      .values({
        userId,
        mealPlanId,
        prepDay,
        prepTime,
        batchRecipes: batchRecipes || [],
        shoppingDay,
        notes,
        reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : true,
        reminderTime,
      })
      .returning();

    res.json({ schedule });
  } catch (error) {
    console.error("Error creating prep schedule:", error);
    res.status(500).json({ message: "Failed to create schedule" });
  }
});

// Get meal prep schedules
router.get("/prep-schedules", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { mealPlanId, completed } = req.query;

    const whereConditions = [eq(mealPrepSchedules.userId, userId)];

    if (mealPlanId) {
      whereConditions.push(eq(mealPrepSchedules.mealPlanId, mealPlanId as string));
    }
    if (completed !== undefined) {
      whereConditions.push(eq(mealPrepSchedules.completed, completed === "true"));
    }

    const schedules = await db
      .select()
      .from(mealPrepSchedules)
      .where(and(...whereConditions))
      .orderBy(mealPrepSchedules.prepDay);

    res.json({ schedules });
  } catch (error) {
    console.error("Error fetching prep schedules:", error);
    res.status(500).json({ message: "Failed to fetch schedules" });
  }
});

// Mark prep schedule as completed
router.patch("/prep-schedules/:id/complete", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const [updated] = await db
      .update(mealPrepSchedules)
      .set({
        completed: true,
        completedAt: new Date(),
      })
      .where(and(eq(mealPrepSchedules.id, id), eq(mealPrepSchedules.userId, userId)))
      .returning();

    res.json({ schedule: updated });
  } catch (error) {
    console.error("Error completing schedule:", error);
    res.status(500).json({ message: "Failed to complete schedule" });
  }
});

// ============================================================
// LEFTOVERS TRACKING
// ============================================================

// Add leftover
router.post("/leftovers", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      recipeId,
      recipeName,
      quantity,
      storedDate,
      expiryDate,
      storageLocation,
      notes,
    } = req.body;

    if (!recipeName || !storedDate) {
      return res.status(400).json({ message: "Recipe name and stored date are required" });
    }

    const [leftover] = await db
      .insert(leftovers)
      .values({
        userId,
        recipeId,
        recipeName,
        quantity,
        storedDate: new Date(storedDate),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        storageLocation,
        notes,
      })
      .returning();

    res.json({ leftover });
  } catch (error) {
    console.error("Error adding leftover:", error);
    res.status(500).json({ message: "Failed to add leftover" });
  }
});

// Get leftovers
router.get("/leftovers", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { expiringSoon, consumed } = req.query;

    const conditions = [eq(leftovers.userId, userId)];
    if (consumed === "false") conditions.push(eq(leftovers.consumed, false));

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const allLeftovers = await db
      .select()
      .from(leftovers)
      .where(whereClause)
      .orderBy(leftovers.expiryDate);

    // Filter for expiring soon (within 2 days)
    let result = allLeftovers;
    if (expiringSoon === "true") {
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

      result = allLeftovers.filter(l =>
        l.expiryDate && new Date(l.expiryDate) <= twoDaysFromNow && !l.consumed
      );
    }

    res.json({ leftovers: result });
  } catch (error) {
    console.error("Error fetching leftovers:", error);
    res.status(500).json({ message: "Failed to fetch leftovers" });
  }
});

// Get leftover repurposing suggestions
router.get("/leftovers/:id/suggestions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const [leftover] = await db
      .select()
      .from(leftovers)
      .where(
        and(
          eq(leftovers.id, id),
          eq(leftovers.userId, userId)
        )
      );

    if (!leftover) {
      return res.status(404).json({ message: "Leftover not found" });
    }

    // Simple suggestion logic - in production, use AI
    const suggestions = [
      { idea: "Add to a stir-fry", difficulty: "easy" },
      { idea: "Make a soup or stew", difficulty: "easy" },
      { idea: "Create a casserole", difficulty: "medium" },
      { idea: "Use in a wrap or sandwich", difficulty: "easy" },
      { idea: "Top a salad", difficulty: "easy" },
    ];

    res.json({ leftover, suggestions });
  } catch (error) {
    console.error("Error getting leftover suggestions:", error);
    res.status(500).json({ message: "Failed to get suggestions" });
  }
});

// Mark leftover as consumed
router.patch("/leftovers/:id/consume", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { wasted, repurposedInto } = req.body;

    const [updated] = await db
      .update(leftovers)
      .set({
        consumed: true,
        consumedAt: new Date(),
        wasted: wasted || false,
        repurposedInto,
      })
      .where(
        and(
          eq(leftovers.id, id),
          eq(leftovers.userId, userId)
        )
      )
      .returning();

    res.json({ leftover: updated });
  } catch (error) {
    console.error("Error consuming leftover:", error);
    res.status(500).json({ message: "Failed to consume leftover" });
  }
});

// ============================================================
// ENHANCED GROCERY LIST
// ============================================================

// Add grocery list item
router.post("/grocery-list", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      mealPlanId,
      listName,
      ingredientName,
      quantity,
      unit,
      category,
      estimatedPrice,
      store,
      aisle,
      priority,
      isPantryItem,
      notes,
    } = req.body;

    if (!ingredientName) {
      return res.status(400).json({ message: "Ingredient name is required" });
    }

    const [item] = await db
      .insert(groceryListItems)
      .values({
        userId,
        mealPlanId,
        listName: listName || "My Grocery List",
        ingredientName,
        quantity,
        unit,
        category,
        estimatedPrice,
        store,
        aisle,
        priority: priority || "normal",
        isPantryItem: isPantryItem || false,
        notes,
      })
      .returning();

    res.json({ item });
  } catch (error) {
    console.error("Error adding grocery item:", error);
    res.status(500).json({ message: "Failed to add grocery item" });
  }
});

// Get grocery list
router.get("/grocery-list", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { mealPlanId, purchased } = req.query;

    const conditions = [eq(groceryListItems.userId, userId)];
    if (purchased === "false") conditions.push(eq(groceryListItems.purchased, false));
    if (mealPlanId) conditions.push(eq(groceryListItems.mealPlanId, mealPlanId as string));

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const items = await db
      .select()
      .from(groceryListItems)
      .where(whereClause)
      .orderBy(groceryListItems.category, groceryListItems.aisle);

    // Calculate budget summary
    const totalEstimated = items.reduce((sum, item) =>
      sum + Number(item.estimatedPrice || 0), 0
    );
    const totalActual = items.reduce((sum, item) =>
      sum + Number(item.actualPrice || 0), 0
    );

    res.json({
      items,
      budget: {
        estimated: totalEstimated,
        actual: totalActual,
        difference: totalActual - totalEstimated,
      }
    });
  } catch (error) {
    console.error("Error fetching grocery list:", error);
    res.status(500).json({ message: "Failed to fetch grocery list" });
  }
});

// Get optimized grocery list (by store layout)
router.get("/grocery-list/optimized", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { store } = req.query;

    const items = await db
      .select()
      .from(groceryListItems)
      .where(
        and(
          eq(groceryListItems.userId, userId),
          eq(groceryListItems.purchased, false)
        )
      )
      .orderBy(groceryListItems.aisle, groceryListItems.category);

    // Group by category and aisle
    const grouped = items.reduce((acc, item) => {
      const key = item.category || "Other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    // Standard store layout order
    const storeLayoutOrder = [
      "produce",
      "bakery",
      "meat",
      "seafood",
      "dairy",
      "frozen",
      "pantry",
      "snacks",
      "beverages",
      "household",
      "other"
    ];

    // Sort groups by store layout order
    const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
      const aIndex = storeLayoutOrder.indexOf(a.toLowerCase());
      const bIndex = storeLayoutOrder.indexOf(b.toLowerCase());
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    res.json({ grouped: sortedGroups });
  } catch (error) {
    console.error("Error optimizing grocery list:", error);
    res.status(500).json({ message: "Failed to optimize grocery list" });
  }
});

// Update grocery item (mark purchased, update price, etc)
router.patch("/grocery-list/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;

    // If marking as purchased, set purchasedAt
    if (updates.purchased === true) {
      updates.purchasedAt = new Date();
    }

    const [updated] = await db
      .update(groceryListItems)
      .set(updates)
      .where(
        and(
          eq(groceryListItems.id, id),
          eq(groceryListItems.userId, userId)
        )
      )
      .returning();

    res.json({ item: updated });
  } catch (error) {
    console.error("Error updating grocery item:", error);
    res.status(500).json({ message: "Failed to update item" });
  }
});

// Delete grocery item
router.delete("/grocery-list/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await db
      .delete(groceryListItems)
      .where(
        and(
          eq(groceryListItems.id, id),
          eq(groceryListItems.userId, userId)
        )
      );

    res.json({ message: "Item deleted" });
  } catch (error) {
    console.error("Error deleting grocery item:", error);
    res.status(500).json({ message: "Failed to delete item" });
  }
});

// ============================================================
// PANTRY INTEGRATION
// ============================================================

// Add pantry items to grocery list (items running low)
router.post("/grocery-list/from-pantry", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { threshold = 1 } = req.body;

    // Get pantry items that are running low or below threshold
    const lowPantryItems = await db
      .select()
      .from(pantryItems)
      .where(
        and(
          eq(pantryItems.userId, userId),
          sql`${pantryItems.quantity} <= ${threshold} OR ${pantryItems.isRunningLow} = true`
        )
      );

    const addedItems = [];

    for (const pantryItem of lowPantryItems) {
      // Check if already in grocery list and not purchased
      const [existing] = await db
        .select()
        .from(groceryListItems)
        .where(
          and(
            eq(groceryListItems.userId, userId),
            eq(groceryListItems.ingredientName, pantryItem.name),
            eq(groceryListItems.purchased, false)
          )
        );

      if (!existing) {
        const [newItem] = await db
          .insert(groceryListItems)
          .values({
            userId,
            ingredientName: pantryItem.name,
            quantity: String(Math.max(1, (pantryItem.quantity || 0) * 2)),
            unit: pantryItem.unit,
            category: pantryItem.category,
            isPantryItem: true,
            notes: "Auto-added from pantry (running low)",
          })
          .returning();

        addedItems.push(newItem);
      }
    }

    res.json({ added: addedItems, count: addedItems.length });
  } catch (error) {
    console.error("Error adding pantry items to grocery list:", error);
    res.status(500).json({ message: "Failed to add pantry items" });
  }
});

// ============================================================
// FAMILY MEAL PROFILES
// ============================================================

// Create family meal profile
router.post("/family-profiles", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      familyMemberId,
      dietaryRestrictions,
      allergies,
      preferences,
      dislikedFoods,
      goals,
    } = req.body;

    if (!familyMemberId) {
      return res.status(400).json({ message: "Family member ID is required" });
    }

    const [profile] = await db
      .insert(familyMealProfiles)
      .values({
        userId,
        familyMemberId,
        dietaryRestrictions: dietaryRestrictions || [],
        allergies: allergies || [],
        preferences: preferences || [],
        dislikedFoods: dislikedFoods || [],
        goals: goals || {},
        isActive: true,
      })
      .returning();

    res.json({ profile });
  } catch (error) {
    console.error("Error creating family profile:", error);
    res.status(500).json({ message: "Failed to create profile" });
  }
});

// Get family meal profiles
router.get("/family-profiles", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const profiles = await db
      .select({
        profile: familyMealProfiles,
        familyMember: familyMembers,
      })
      .from(familyMealProfiles)
      .leftJoin(
        familyMembers,
        eq(familyMealProfiles.familyMemberId, familyMembers.id)
      )
      .where(
        and(
          eq(familyMealProfiles.userId, userId),
          eq(familyMealProfiles.isActive, true)
        )
      );

    res.json({ profiles });
  } catch (error) {
    console.error("Error fetching family profiles:", error);
    res.status(500).json({ message: "Failed to fetch family profiles" });
  }
});

// Update family meal profile
router.patch("/family-profiles/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;

    const [updated] = await db
      .update(familyMealProfiles)
      .set(updates)
      .where(
        and(
          eq(familyMealProfiles.id, id),
          eq(familyMealProfiles.userId, userId)
        )
      )
      .returning();

    res.json({ profile: updated });
  } catch (error) {
    console.error("Error updating family profile:", error);
    res.status(500).json({ message: "Failed to update family profile" });
  }
});

// ============================================================
// GROCERY LIST SAVINGS REPORT
// ============================================================

// Get grocery list savings report
router.get("/grocery-list/savings-report", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;

    // Get all grocery list items within date range
    const conditions = [eq(groceryListItems.userId, userId)];
    if (startDate) conditions.push(gte(groceryListItems.createdAt, new Date(startDate as string)));
    if (endDate) conditions.push(lte(groceryListItems.createdAt, new Date(endDate as string)));

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const items = await db
      .select()
      .from(groceryListItems)
      .where(whereClause);

    // Calculate savings metrics
    const totalEstimated = items.reduce((sum, item) =>
      sum + Number(item.estimatedPrice || 0), 0
    );
    const totalActual = items.reduce((sum, item) =>
      sum + Number(item.actualPrice || 0), 0
    );
    const totalSaved = totalEstimated - totalActual;
    const savingsRate = totalEstimated > 0
      ? ((totalSaved / totalEstimated) * 100).toFixed(1)
      : "0.0";

    // Calculate pantry item savings (items already owned)
    const pantryItems = items.filter(item => item.isPantryItem);
    const pantrySavings = pantryItems.reduce((sum, item) =>
      sum + Number(item.estimatedPrice || 0), 0
    );

    // Get most saved categories
    const categoryStats = items.reduce((acc, item) => {
      const category = item.category || "Other";
      if (!acc[category]) {
        acc[category] = {
          estimated: 0,
          actual: 0,
          saved: 0,
          count: 0
        };
      }
      acc[category].estimated += Number(item.estimatedPrice || 0);
      acc[category].actual += Number(item.actualPrice || 0);
      acc[category].saved += Number(item.estimatedPrice || 0) - Number(item.actualPrice || 0);
      acc[category].count++;
      return acc;
    }, {} as Record<string, { estimated: number; actual: number; saved: number; count: number }>);

    const topSavingCategories = Object.entries(categoryStats)
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.saved - a.saved)
      .slice(0, 5);

    res.json({
      summary: {
        totalEstimated,
        totalActual,
        totalSaved,
        savingsRate: Number(savingsRate),
        pantrySavings,
        itemsCount: items.length,
      },
      topSavingCategories,
    });
  } catch (error) {
    console.error("Error generating savings report:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// ============================================================
// ACHIEVEMENTS SYSTEM
// ============================================================

// Check and award meal planning achievements (called periodically or on actions)
async function checkAchievements(userId: string) {
  try {
    // Get user progress
    const completedPlans = await db
      .select()
      .from(userMealPlanProgress)
      .where(
        and(
          eq(userMealPlanProgress.userId, userId),
          eq(userMealPlanProgress.completed, true)
        )
      );

    // Get all achievements
    const allAchievements = await db.select().from(mealPlanAchievements);

    // Check each achievement
    for (const achievement of allAchievements) {
      const req = achievement.requirement as { type: string; threshold: number };

      let progress = 0;
      if (req.type === "plans_completed") {
        progress = completedPlans.length;
      }

      // Check if user already has this achievement
      const [existing] = await db
        .select()
        .from(userMealPlanAchievements)
        .where(
          and(
            eq(userMealPlanAchievements.userId, userId),
            eq(userMealPlanAchievements.achievementId, achievement.id)
          )
        );

      if (!existing) {
        // Create new achievement tracking
        await db.insert(userMealPlanAchievements).values({
          userId,
          achievementId: achievement.id,
          progress,
          completed: progress >= req.threshold,
          completedAt: progress >= req.threshold ? new Date() : null,
        });
      } else if (!existing.completed && progress >= req.threshold) {
        // Update to completed
        await db
          .update(userMealPlanAchievements)
          .set({
            progress,
            completed: true,
            completedAt: new Date(),
          })
          .where(eq(userMealPlanAchievements.id, existing.id));
      }
    }
  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}

// ============================================================
// MISSING GROCERY LIST ROUTES (needed by NutritionMealPlanner)
// ============================================================

// Toggle purchased status on a grocery item
// PATCH /api/meal-planner/grocery-list/:id/purchase
// Body: { toggle?: boolean, actualPrice?: number }
router.patch("/grocery-list/:id/purchase", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureAdvancedMealPlanningSchema();

    const userId = req.user!.id;
    const { id } = req.params;
    const { actualPrice, toggle } = req.body;

    // Fetch current state so we can toggle
    let purchased = true;
    if (toggle) {
      const [current] = await db
        .select()
        .from(groceryListItems)
        .where(and(eq(groceryListItems.id, id), eq(groceryListItems.userId, userId)))
        .limit(1);

      if (!current) {
        return res.status(404).json({ message: "Grocery item not found" });
      }
      purchased = !current.purchased;
    }

    const [updated] = await db
      .update(groceryListItems)
      .set({
        purchased,
        purchasedAt: purchased ? new Date() : null,
        ...(actualPrice != null ? { actualPrice } : {}),
      })
      .where(and(eq(groceryListItems.id, id), eq(groceryListItems.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Grocery item not found" });
    }

    res.json({ item: updated });
  } catch (error) {
    console.error("Error toggling grocery item purchase:", error);
    res.status(500).json({ message: "Failed to update item" });
  }
});

// Cross-check grocery list against pantry and mark items already owned
// POST /api/meal-planner/grocery-list/check-pantry
router.post("/grocery-list/check-pantry", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureAdvancedMealPlanningSchema();

    const userId = req.user!.id;

    const groceryItems = await db
      .select()
      .from(groceryListItems)
      .where(and(eq(groceryListItems.userId, userId), eq(groceryListItems.purchased, false)));

    const pantry = await db
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, userId));

    let matched = 0;

    for (const grocery of groceryItems) {
      const gName = (grocery.ingredientName || "").toLowerCase().trim();
      if (!gName) continue;

      const inPantry = pantry.some((p) => {
        const pName = (p.name || "").toLowerCase().trim();
        return pName && (pName.includes(gName) || gName.includes(pName));
      });

      if (inPantry && !grocery.isPantryItem) {
        await db
          .update(groceryListItems)
          .set({ isPantryItem: true })
          .where(and(eq(groceryListItems.id, grocery.id), eq(groceryListItems.userId, userId)));
        matched++;
      }
    }

    res.json({ message: "Pantry check complete", matched });
  } catch (error) {
    console.error("Error checking pantry against grocery list:", error);
    res.status(500).json({ message: "Failed to check pantry" });
  }
});

// ============================================================
// PREMIUM TRACKING ROUTES
// ============================================================

router.get("/streak", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const [streak] = await db.select().from(mealStreaks).where(eq(mealStreaks.userId, userId)).limit(1);

    res.json({
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      lastLoggedDate: streak?.lastLoggedDate || null,
    });
  } catch (error) {
    console.error("Error fetching streak:", error);
    res.status(500).json({ message: "Failed to fetch streak" });
  }
});

router.post("/streak/log", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const dateRaw = String(req.body?.date || "");
    const date = new Date(dateRaw);
    if (!dateRaw || Number.isNaN(date.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }
    date.setHours(0,0,0,0);

    const [existing] = await db.select().from(mealStreaks).where(eq(mealStreaks.userId, userId)).limit(1);

    let currentStreak = 1;
    let longestStreak = 1;

    if (existing) {
      const last = existing.lastLoggedDate ? new Date(existing.lastLoggedDate) : null;
      if (last) {
        last.setHours(0,0,0,0);
        const diff = Math.round((date.getTime() - last.getTime()) / (1000*60*60*24));
        if (diff === 0) currentStreak = existing.currentStreak || 0;
        else if (diff === 1) currentStreak = (existing.currentStreak || 0) + 1;
        else currentStreak = 1;
      }
      longestStreak = Math.max(existing.longestStreak || 0, currentStreak);

      await db.update(mealStreaks).set({
        currentStreak,
        longestStreak,
        lastLoggedDate: date.toISOString().split("T")[0],
        updatedAt: new Date(),
      }).where(eq(mealStreaks.id, existing.id));
    } else {
      await db.insert(mealStreaks).values({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastLoggedDate: date.toISOString().split("T")[0],
        updatedAt: new Date(),
      });
    }

    res.json({ currentStreak, longestStreak });
  } catch (error) {
    console.error("Error logging streak:", error);
    res.status(500).json({ message: "Failed to log streak" });
  }
});

router.get("/body-metrics", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    const metrics = await db
      .select()
      .from(bodyMetrics)
      .where(eq(bodyMetrics.userId, userId))
      .orderBy(desc(bodyMetrics.date))
      .limit(limit);

    res.json({ metrics });
  } catch (error) {
    console.error("Error fetching body metrics:", error);
    res.status(500).json({ message: "Failed to fetch body metrics" });
  }
});

router.post("/body-metrics", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { date, weightLbs, bodyFatPct, waistIn, hipIn } = req.body || {};

    if (!date || Number.isNaN(new Date(date).getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }
    const weight = Number(weightLbs);
    if (!Number.isFinite(weight) || weight <= 0) {
      return res.status(400).json({ message: "weightLbs is required" });
    }

    const [metric] = await db.insert(bodyMetrics).values({
      userId,
      date: String(date),
      weightLbs: String(weight),
      bodyFatPct: bodyFatPct != null ? String(Number(bodyFatPct)) : null,
      waistIn: waistIn != null ? String(Number(waistIn)) : null,
      hipIn: hipIn != null ? String(Number(hipIn)) : null,
      createdAt: new Date(),
    }).returning();

    res.status(201).json({ metric });
  } catch (error) {
    console.error("Error creating body metric:", error);
    res.status(500).json({ message: "Failed to create body metric" });
  }
});

router.get("/history", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const meals = await db
      .select()
      .from(mealFavorites)
      .where(eq(mealFavorites.userId, userId))
      .orderBy(desc(mealFavorites.isFavorite), desc(mealFavorites.lastUsed))
      .limit(20);

    res.json({
      meals: meals.map((m) => ({
        id: m.id,
        name: m.mealName,
        calories: m.calories || 0,
        protein: m.protein || 0,
        carbs: m.carbs || 0,
        fat: m.fat || 0,
        fiber: m.fiber || 0,
        isFavorite: Boolean(m.isFavorite),
        timesLogged: m.timesLogged || 0,
        lastUsed: m.lastUsed,
      })),
    });
  } catch (error) {
    console.error("Error fetching meal history:", error);
    res.status(500).json({ message: "Failed to fetch meal history" });
  }
});

router.post("/history/favorite", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const mealName = String(req.body?.mealName || "").trim();
    const isFavorite = Boolean(req.body?.isFavorite);
    if (!mealName) return res.status(400).json({ message: "mealName is required" });

    const [existing] = await db.select().from(mealFavorites).where(and(eq(mealFavorites.userId, userId), eq(mealFavorites.mealName, mealName))).limit(1);

    if (existing) {
      await db.update(mealFavorites).set({ isFavorite }).where(eq(mealFavorites.id, existing.id));
    } else {
      await db.insert(mealFavorites).values({ userId, mealName, isFavorite, timesLogged: 0, lastUsed: new Date() });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating favorite status:", error);
    res.status(500).json({ message: "Failed to update favorite status" });
  }
});

router.get("/water", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const date = String(req.query.date || new Date().toISOString().split("T")[0]);

    let [log] = await db.select().from(waterLogs).where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date))).limit(1);

    if (!log) {
      const latest = await db.select().from(waterLogs).where(eq(waterLogs.userId, userId)).orderBy(desc(waterLogs.updatedAt)).limit(1);
      const target = latest[0]?.dailyTarget || 8;
      [log] = await db.insert(waterLogs).values({ userId, date, glassesLogged: 0, dailyTarget: target, updatedAt: new Date() }).returning();
    }

    res.json({ date: log.date, glassesLogged: log.glassesLogged, dailyTarget: log.dailyTarget });
  } catch (error) {
    console.error("Error fetching water log:", error);
    res.status(500).json({ message: "Failed to fetch water log" });
  }
});

router.post("/water", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const date = String(req.body?.date || "");
    const glassesLogged = Number(req.body?.glassesLogged || 0);
    if (!date) return res.status(400).json({ message: "date is required" });

    const [existing] = await db.select().from(waterLogs).where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date))).limit(1);

    let log;
    if (existing) {
      [log] = await db.update(waterLogs).set({ glassesLogged, updatedAt: new Date() }).where(eq(waterLogs.id, existing.id)).returning();
    } else {
      const latest = await db.select().from(waterLogs).where(eq(waterLogs.userId, userId)).orderBy(desc(waterLogs.updatedAt)).limit(1);
      [log] = await db.insert(waterLogs).values({ userId, date, glassesLogged, dailyTarget: latest[0]?.dailyTarget || 8, updatedAt: new Date() }).returning();
    }

    res.json({ date: log.date, glassesLogged: log.glassesLogged, dailyTarget: log.dailyTarget });
  } catch (error) {
    console.error("Error saving water log:", error);
    res.status(500).json({ message: "Failed to save water log" });
  }
});

router.patch("/water/target", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const dailyTarget = Math.max(1, Number(req.body?.dailyTarget || 8));

    await db.update(waterLogs).set({ dailyTarget, updatedAt: new Date() }).where(eq(waterLogs.userId, userId));

    const today = new Date().toISOString().split("T")[0];
    const [existingToday] = await db.select().from(waterLogs).where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, today))).limit(1);
    if (!existingToday) {
      await db.insert(waterLogs).values({ userId, date: today, glassesLogged: 0, dailyTarget, updatedAt: new Date() });
    }

    res.json({ dailyTarget });
  } catch (error) {
    console.error("Error updating water target:", error);
    res.status(500).json({ message: "Failed to update water target" });
  }
});

export default router;
