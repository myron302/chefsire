import express, { type Request, type Response } from "express";
import { db } from "../db/index.js";
import { eq, and, desc, sql, gte, lte, isNull } from "drizzle-orm";
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
} from "../../shared/schema.js";
import { requireAuth } from "../middleware";

const router = express.Router();

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
        : `Balanced nutrition for your goals`;

      const [rec] = await db
        .insert(mealRecommendations)
        .values({
          userId,
          recipeId: recipe.id,
          recommendationType: "goal_based",
          targetDate: targetDate ? new Date(targetDate) : new Date(),
          mealType: mealType || "lunch",
          score: score.toFixed(2),
          reason,
          metadata: {
            nutritionGaps: calorieDifference > 100 ? ["calories"] : [],
            goalAlignment: "calorie_target",
          },
        })
        .returning();

      recommendations.push({ ...rec, recipe });
    }

    res.json({ recommendations, user: { calorieGoal, avgDailyCalories } });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    res.status(500).json({ message: "Failed to generate recommendations" });
  }
});

// Get meal recommendations for user
router.get("/meal-recommendations", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetDate, mealType } = req.query;

    let query = db
      .select({
        recommendation: mealRecommendations,
        recipe: recipes,
      })
      .from(mealRecommendations)
      .leftJoin(recipes, eq(mealRecommendations.recipeId, recipes.id))
      .where(eq(mealRecommendations.userId, userId))
      .orderBy(desc(mealRecommendations.score));

    const recommendations = await query;

    res.json({ recommendations });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ message: "Failed to fetch recommendations" });
  }
});

// Accept/dismiss recommendation
router.patch("/meal-recommendations/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { accepted, dismissed } = req.body;

    const [updated] = await db
      .update(mealRecommendations)
      .set({ accepted, dismissed })
      .where(
        and(
          eq(mealRecommendations.id, id),
          eq(mealRecommendations.userId, userId)
        )
      )
      .returning();

    res.json({ recommendation: updated });
  } catch (error) {
    console.error("Error updating recommendation:", error);
    res.status(500).json({ message: "Failed to update recommendation" });
  }
});

// ============================================================
// MEAL PREP SCHEDULING
// ============================================================

// Create meal prep schedule
router.post("/meal-prep-schedules", requireAuth, async (req: Request, res: Response) => {
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
        reminderEnabled: reminderEnabled ?? true,
        reminderTime,
      })
      .returning();

    res.json({ schedule });
  } catch (error) {
    console.error("Error creating meal prep schedule:", error);
    res.status(500).json({ message: "Failed to create meal prep schedule" });
  }
});

// Get meal prep schedules
router.get("/meal-prep-schedules", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const schedules = await db
      .select()
      .from(mealPrepSchedules)
      .where(eq(mealPrepSchedules.userId, userId))
      .orderBy(mealPrepSchedules.prepDay);

    res.json({ schedules });
  } catch (error) {
    console.error("Error fetching meal prep schedules:", error);
    res.status(500).json({ message: "Failed to fetch meal prep schedules" });
  }
});

// Mark prep schedule as completed
router.patch("/meal-prep-schedules/:id/complete", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const [updated] = await db
      .update(mealPrepSchedules)
      .set({ completed: true, completedAt: new Date() })
      .where(
        and(
          eq(mealPrepSchedules.id, id),
          eq(mealPrepSchedules.userId, userId)
        )
      )
      .returning();

    res.json({ schedule: updated });
  } catch (error) {
    console.error("Error completing meal prep schedule:", error);
    res.status(500).json({ message: "Failed to complete meal prep schedule" });
  }
});

// ============================================================
// LEFTOVER TRACKING
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
        storageLocation: storageLocation || "fridge",
        notes,
      })
      .returning();

    res.json({ leftover });
  } catch (error) {
    console.error("Error adding leftover:", error);
    res.status(500).json({ message: "Failed to add leftover" });
  }
});

// Get leftovers (with filtering for expiring soon)
router.get("/leftovers", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { expiringSoon, consumed } = req.query;

    let query = db
      .select()
      .from(leftovers)
      .where(eq(leftovers.userId, userId));

    if (consumed === "false") {
      query = query.where(eq(leftovers.consumed, false));
    }

    const allLeftovers = await query.orderBy(leftovers.expiryDate);

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

    let query = db
      .select()
      .from(groceryListItems)
      .where(eq(groceryListItems.userId, userId));

    if (purchased === "false") {
      query = query.where(eq(groceryListItems.purchased, false));
    }

    if (mealPlanId) {
      query = query.where(eq(groceryListItems.mealPlanId, mealPlanId as string));
    }

    const items = await query.orderBy(groceryListItems.category, groceryListItems.aisle);

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
      "beverages",
      "snacks",
      "condiments",
      "other",
    ];

    const optimized = storeLayoutOrder
      .map(category => ({
        category,
        items: grouped[category] || [],
      }))
      .filter(g => g.items.length > 0);

    res.json({ optimized, totalItems: items.length });
  } catch (error) {
    console.error("Error optimizing grocery list:", error);
    res.status(500).json({ message: "Failed to optimize grocery list" });
  }
});

// Check items against pantry
router.post("/grocery-list/check-pantry", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get unpurchased grocery items
    const groceryItems = await db
      .select()
      .from(groceryListItems)
      .where(
        and(
          eq(groceryListItems.userId, userId),
          eq(groceryListItems.purchased, false)
        )
      );

    // Get pantry items
    const pantryIngredients = await db
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, userId));

    // Mark items as pantry items if they exist
    const updates = [];
    for (const grocery of groceryItems) {
      const inPantry = pantryIngredients.some(p =>
        p.name.toLowerCase().includes(grocery.ingredientName.toLowerCase()) ||
        grocery.ingredientName.toLowerCase().includes(p.name.toLowerCase())
      );

      if (inPantry && !grocery.isPantryItem) {
        updates.push(
          db.update(groceryListItems)
            .set({ isPantryItem: true })
            .where(eq(groceryListItems.id, grocery.id))
        );
      }
    }

    await Promise.all(updates);

    res.json({ message: "Pantry check complete", matched: updates.length });
  } catch (error) {
    console.error("Error checking pantry:", error);
    res.status(500).json({ message: "Failed to check pantry" });
  }
});

// Mark item as purchased (or toggle)
router.patch("/grocery-list/:id/purchase", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { actualPrice, toggle } = req.body;

    // If toggle is true, first fetch the current state
    let purchased = true;
    if (toggle) {
      const [currentItem] = await db
        .select()
        .from(groceryListItems)
        .where(
          and(
            eq(groceryListItems.id, id),
            eq(groceryListItems.userId, userId)
          )
        );

      if (currentItem) {
        purchased = !currentItem.purchased;
      }
    }

    const [updated] = await db
      .update(groceryListItems)
      .set({
        purchased,
        purchasedAt: purchased ? new Date() : null,
        actualPrice: actualPrice || null,
      })
      .where(
        and(
          eq(groceryListItems.id, id),
          eq(groceryListItems.userId, userId)
        )
      )
      .returning();

    res.json({ item: updated });
  } catch (error) {
    console.error("Error purchasing item:", error);
    res.status(500).json({ message: "Failed to purchase item" });
  }
});

// Delete grocery list item
router.delete("/grocery-list/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const [deleted] = await db
      .delete(groceryListItems)
      .where(
        and(
          eq(groceryListItems.id, id),
          eq(groceryListItems.userId, userId)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Grocery item not found" });
    }

    res.json({ success: true, id });
  } catch (error) {
    console.error("Error deleting grocery item:", error);
    res.status(500).json({ message: "Failed to delete grocery item" });
  }
});

// ============================================================
// PROGRESS TRACKING & ACHIEVEMENTS
// ============================================================

// Get user progress for a meal plan
router.get("/progress/:mealPlanId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { mealPlanId } = req.params;

    const [progress] = await db
      .select()
      .from(userMealPlanProgress)
      .where(
        and(
          eq(userMealPlanProgress.userId, userId),
          eq(userMealPlanProgress.mealPlanId, mealPlanId)
        )
      );

    if (!progress) {
      return res.status(404).json({ message: "Progress not found" });
    }

    res.json({ progress });
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({ message: "Failed to fetch progress" });
  }
});

// Update meal plan progress
router.patch("/progress/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { currentDay, mealsCompleted, goalsMet, averageRating } = req.body;

    const [existing] = await db
      .select()
      .from(userMealPlanProgress)
      .where(eq(userMealPlanProgress.id, id));

    if (!existing) {
      return res.status(404).json({ message: "Progress not found" });
    }

    const adherenceRate = ((mealsCompleted || existing.mealsCompleted) / existing.mealsTotal * 100).toFixed(2);

    const [updated] = await db
      .update(userMealPlanProgress)
      .set({
        currentDay: currentDay || existing.currentDay,
        mealsCompleted: mealsCompleted || existing.mealsCompleted,
        adherenceRate,
        averageRating: averageRating || existing.averageRating,
        goalsMet: goalsMet || existing.goalsMet,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userMealPlanProgress.id, id),
          eq(userMealPlanProgress.userId, userId)
        )
      )
      .returning();

    // Check for achievement unlocks
    await checkAchievements(userId);

    res.json({ progress: updated });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ message: "Failed to update progress" });
  }
});

// Get user achievements
router.get("/achievements", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const userAchievements = await db
      .select({
        userAchievement: userMealPlanAchievements,
        achievement: mealPlanAchievements,
      })
      .from(userMealPlanAchievements)
      .innerJoin(
        mealPlanAchievements,
        eq(userMealPlanAchievements.achievementId, mealPlanAchievements.id)
      )
      .where(eq(userMealPlanAchievements.userId, userId))
      .orderBy(desc(userMealPlanAchievements.completedAt));

    const totalPoints = userAchievements
      .filter(ua => ua.userAchievement.completed)
      .reduce((sum, ua) => sum + (ua.achievement.points || 0), 0);

    res.json({ achievements: userAchievements, totalPoints });
  } catch (error) {
    console.error("Error fetching achievements:", error);
    res.status(500).json({ message: "Failed to fetch achievements" });
  }
});

// Initialize default achievements (run once)
router.post("/achievements/initialize", requireAuth, async (req: Request, res: Response) => {
  try {
    const defaultAchievements = [
      {
        name: "First Steps",
        description: "Complete your first meal plan",
        icon: "🎯",
        category: "consistency",
        requirement: { type: "plans_completed", threshold: 1 },
        points: 10,
        tier: "bronze",
      },
      {
        name: "Week Warrior",
        description: "Complete 7 days in a row",
        icon: "🔥",
        category: "consistency",
        requirement: { type: "days_streak", threshold: 7 },
        points: 25,
        tier: "silver",
      },
      {
        name: "Meal Prep Master",
        description: "Complete 10 meal prep sessions",
        icon: "👨‍🍳",
        category: "consistency",
        requirement: { type: "meal_preps", threshold: 10 },
        points: 50,
        tier: "gold",
      },
      {
        name: "Nutrition Tracker",
        description: "Log nutrition for 30 days",
        icon: "📊",
        category: "nutrition",
        requirement: { type: "calories_tracked", threshold: 30 },
        points: 40,
        tier: "gold",
      },
      {
        name: "Recipe Explorer",
        description: "Try 25 different recipes",
        icon: "🌟",
        category: "variety",
        requirement: { type: "recipes_tried", threshold: 25 },
        points: 35,
        tier: "silver",
      },
    ];

    const inserted = [];
    for (const ach of defaultAchievements) {
      try {
        const [achievement] = await db
          .insert(mealPlanAchievements)
          .values(ach)
          .onConflictDoNothing()
          .returning();
        if (achievement) inserted.push(achievement);
      } catch (e) {
        // Skip if already exists
      }
    }

    res.json({ message: "Achievements initialized", count: inserted.length });
  } catch (error) {
    console.error("Error initializing achievements:", error);
    res.status(500).json({ message: "Failed to initialize achievements" });
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
      name,
      calorieTarget,
      macroGoals,
      preferences,
      dislikes,
      portionMultiplier,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const [profile] = await db
      .insert(familyMealProfiles)
      .values({
        userId,
        familyMemberId,
        name,
        calorieTarget,
        macroGoals,
        preferences: preferences || [],
        dislikes: dislikes || [],
        portionMultiplier: portionMultiplier || "1.00",
      })
      .returning();

    res.json({ profile });
  } catch (error) {
    console.error("Error creating family profile:", error);
    res.status(500).json({ message: "Failed to create family profile" });
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
    let query = db
      .select()
      .from(groceryListItems)
      .where(eq(groceryListItems.userId, userId));

    if (startDate) {
      query = query.where(gte(groceryListItems.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      query = query.where(lte(groceryListItems.createdAt, new Date(endDate as string)));
    }

    const items = await query;

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
        totalEstimated: totalEstimated.toFixed(2),
        totalActual: totalActual.toFixed(2),
        totalSaved: totalSaved.toFixed(2),
        savingsRate: `${savingsRate}%`,
        itemCount: items.length,
        purchasedCount: items.filter(i => i.purchased).length,
      },
      pantry: {
        itemCount: pantryItems.length,
        savings: pantrySavings.toFixed(2),
      },
      topSavingCategories,
      periodStart: startDate || items[0]?.createdAt || new Date(),
      periodEnd: endDate || new Date(),
    });
  } catch (error) {
    console.error("Error generating savings report:", error);
    res.status(500).json({ message: "Failed to generate savings report" });
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function checkAchievements(userId: string) {
  try {
    // Get user's completed meal plans
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

export default router;
