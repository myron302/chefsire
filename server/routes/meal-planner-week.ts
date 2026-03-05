import express, { type NextFunction, type Request, type Response } from "express";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  groceryListItems,
  mealPlanEntries,
  mealPlans,
  recipes,
  users,
} from "../../shared/schema.js";
import { requireAuth } from "../middleware";

const router = express.Router();

let _mealPlannerWeekSchemaReady: Promise<void> | null = null;

async function ensureMealPlannerWeekSchema() {
  if (_mealPlannerWeekSchemaReady) return _mealPlannerWeekSchemaReady;

  _mealPlannerWeekSchemaReady = (async () => {
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS custom_protein INTEGER;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS custom_carbs INTEGER;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS custom_fat INTEGER;`);
  })();

  return _mealPlannerWeekSchemaReady;
}

router.use(async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureMealPlannerWeekSchema();
    next();
  } catch (error) {
    console.error("Error ensuring meal planner week schema:", error);
    res.status(500).json({ message: "Meal planner schema is not ready" });
  }
});

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Week starts on Monday.
 */
function startOfWeekMonday(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function fmtISODate(d: Date) {
  return d.toISOString().split("T")[0];
}

function toWeekdayName(d: Date) {
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ] as const;
  return names[d.getDay()];
}

function assertPremiumNutrition(user: any) {
  const hasAccess = Boolean(user?.nutritionPremium);
  if (!hasAccess) return false;

  if (user?.nutritionTrialEndsAt) {
    const trialEnd = new Date(user.nutritionTrialEndsAt);
    if (!isNaN(trialEnd.getTime()) && new Date() > trialEnd) {
      return false;
    }
  }

  return true;
}

async function buildRecipePool(args: {
  mealType: MealType;
  maxCookTime?: number | null;
  targetCalories?: number | null;
  excludeRecipeIds: Set<string>;
}) {
  const { mealType, maxCookTime, targetCalories, excludeRecipeIds } = args;

  // Broad query + refine in JS
  const rows = await db
    .select()
    .from(recipes)
    .where(
      and(
        mealType ? eq(recipes.mealType, mealType) : sql`TRUE`,
        maxCookTime ? lte(recipes.cookTime, maxCookTime) : sql`TRUE`,
        targetCalories
          ? and(
              gte(recipes.calories, Math.max(0, targetCalories - 200)),
              lte(recipes.calories, targetCalories + 200)
            )
          : sql`TRUE`
      )
    )
    .orderBy(desc(recipes.averageRating))
    .limit(150);

  return rows.filter((r) => !excludeRecipeIds.has(r.id));
}

function pickRecipeFromPool(pool: any[]) {
  if (!pool.length) return null;

  // Prefer top-rated but add randomness so it’s not the same week every time
  const top = pool.slice(0, Math.min(25, pool.length));
  const idx = Math.floor(Math.random() * top.length);
  return top[idx];
}

function mapEntriesToWeeklyMeals(entries: any[]) {
  // Shape matches NutritionMealPlanner.tsx expectations.
  // { Monday: { breakfast: {name, calories, protein, carbs, fat, recipeId, entryId} } }
  const out: Record<string, Record<string, any>> = {};

  for (const e of entries) {
    const dayName = toWeekdayName(new Date(e.date));
    if (!out[dayName]) out[dayName] = {};

    const mappedMeal = e.recipe
      ? {
          name: e.recipe.title,
          calories: e.recipe.calories || e.customCalories || 0,
          protein: Number(e.recipe.protein || e.customProtein || 0),
          carbs: Number(e.recipe.carbs || e.customCarbs || 0),
          fat: Number(e.recipe.fat || e.customFat || 0),
          recipeId: e.recipe.id,
          entryId: e.id,
        }
      : {
          name: e.customName || "Meal",
          calories: e.customCalories || 0,
          protein: Number(e.customProtein || 0),
          carbs: Number(e.customCarbs || 0),
          fat: Number(e.customFat || 0),
          recipeId: null,
          entryId: e.id,
        };

    const existing = out[dayName][e.mealType];
    const existingItems = Array.isArray(existing) ? existing : existing ? [existing] : [];
    out[dayName][e.mealType] = [...existingItems, mappedMeal];
  }

  return out;
}

// ============================================================
// GET /api/meal-planner/settings
// ============================================================
router.get("/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!u) return res.status(404).json({ message: "User not found" });

    res.json({
      premium: assertPremiumNutrition(u),
      settings: {
        dailyCalorieGoal: u.dailyCalorieGoal || 2000,
        macroGoals: (u.macroGoals as any) || { protein: 150, carbs: 200, fat: 65 },
        dietaryRestrictions: (u.dietaryRestrictions as any) || [],
      },
    });
  } catch (error) {
    console.error("Error fetching meal planner settings:", error);
    res.status(500).json({ message: "Failed to load settings" });
  }
});

// ============================================================
// GET /api/meal-planner/week?date=YYYY-MM-DD
// ============================================================
router.get("/week", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rawDate = String(req.query.date || "");
    const parsed = rawDate ? new Date(rawDate) : new Date();
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const weekStart = startOfWeekMonday(parsed);
    const weekEnd = endOfDay(addDays(weekStart, 6));

    const [plan] = await db
      .select()
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.userId, userId),
          lte(mealPlans.startDate, weekEnd),
          gte(mealPlans.endDate, weekStart),
          eq(mealPlans.isTemplate, false)
        )
      )
      .orderBy(desc(mealPlans.createdAt))
      .limit(1);

    if (!plan) {
      return res.json({
        weekStart: fmtISODate(weekStart),
        weekEnd: fmtISODate(weekEnd),
        plan: null,
        entries: [],
        weeklyMeals: {},
      });
    }

    const entries = await db
      .select({
        id: mealPlanEntries.id,
        mealPlanId: mealPlanEntries.mealPlanId,
        recipeId: mealPlanEntries.recipeId,
        date: mealPlanEntries.date,
        mealType: mealPlanEntries.mealType,
        servings: mealPlanEntries.servings,
        customName: mealPlanEntries.customName,
        customCalories: mealPlanEntries.customCalories,
        customProtein: mealPlanEntries.customProtein,
        customCarbs: mealPlanEntries.customCarbs,
        customFat: mealPlanEntries.customFat,
        recipe: recipes,
      })
      .from(mealPlanEntries)
      .leftJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
      .where(eq(mealPlanEntries.mealPlanId, plan.id))
      .orderBy(mealPlanEntries.date);

    res.json({
      weekStart: fmtISODate(weekStart),
      weekEnd: fmtISODate(weekEnd),
      plan,
      entries,
      weeklyMeals: mapEntriesToWeeklyMeals(entries),
    });
  } catch (error) {
    console.error("Error fetching week plan:", error);
    res.status(500).json({ message: "Failed to load week plan" });
  }
});

// ============================================================
// POST /api/meal-planner/week/generate   (Premium)
// ============================================================
router.post("/week/generate", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      date,
      days,
      mealTypes,
      servings,
      maxCookTime,
      replaceExisting,
      alsoCreateGroceryList,
    } = req.body || {};

    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });

    if (!assertPremiumNutrition(u)) {
      return res.status(403).json({
        message: "Nutrition premium required",
        code: "NUTRITION_PREMIUM_REQUIRED",
      });
    }

    const parsed = date ? new Date(date) : new Date();
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const weekStart = startOfWeekMonday(parsed);
    const numDays = Math.max(1, Math.min(14, Number(days || 7)));
    const weekEnd = endOfDay(addDays(weekStart, numDays - 1));

    const chosenMealTypes: MealType[] =
      Array.isArray(mealTypes) && mealTypes.length ? mealTypes : ["breakfast", "lunch", "dinner"];

    const servingsInt = Math.max(1, Math.min(20, Number(servings || 2)));
    const maxCook = maxCookTime ? Math.max(5, Math.min(360, Number(maxCookTime))) : null;

    // Replace any existing plan overlapping the range.
    if (replaceExisting) {
      const existingPlans = await db
        .select({ id: mealPlans.id })
        .from(mealPlans)
        .where(
          and(
            eq(mealPlans.userId, userId),
            lte(mealPlans.startDate, weekEnd),
            gte(mealPlans.endDate, weekStart),
            eq(mealPlans.isTemplate, false)
          )
        );

      if (existingPlans.length) {
        const ids = existingPlans.map((p) => p.id);
        await db.delete(mealPlanEntries).where(inArray(mealPlanEntries.mealPlanId, ids));
        await db.delete(mealPlans).where(inArray(mealPlans.id, ids));
      }
    }

    const planName = `Week of ${fmtISODate(weekStart)}`;
    const [plan] = await db
      .insert(mealPlans)
      .values({
        userId,
        name: planName,
        startDate: startOfDay(weekStart),
        endDate: endOfDay(weekEnd),
        isTemplate: false,
      })
      .returning();

    const calorieGoal = Number(u.dailyCalorieGoal || 2000);
    const mealsPerDay = chosenMealTypes.length;
    const perMealTarget = mealsPerDay ? Math.round(calorieGoal / mealsPerDay) : null;

    const usedRecipeIds = new Set<string>();
    const entriesToInsert: any[] = [];

    for (let dayOffset = 0; dayOffset < numDays; dayOffset++) {
      const dayDate = startOfDay(addDays(weekStart, dayOffset));

      for (const mt of chosenMealTypes) {
        const pool = await buildRecipePool({
          mealType: mt,
          maxCookTime: maxCook,
          targetCalories: perMealTarget,
          excludeRecipeIds: usedRecipeIds,
        });

        const picked = pickRecipeFromPool(pool);

        if (picked) {
          usedRecipeIds.add(picked.id);
          entriesToInsert.push({
            mealPlanId: plan.id,
            recipeId: picked.id,
            date: dayDate,
            mealType: mt,
            servings: servingsInt,
            customName: null,
            customCalories: null,
            customProtein: null,
            customCarbs: null,
            customFat: null,
          });
        } else {
          entriesToInsert.push({
            mealPlanId: plan.id,
            recipeId: null,
            date: dayDate,
            mealType: mt,
            servings: servingsInt,
            customName: `Meal (${mt})`,
            customCalories: perMealTarget || 0,
            customProtein: null,
            customCarbs: null,
            customFat: null,
          });
        }
      }
    }

    const insertedEntries = await db.insert(mealPlanEntries).values(entriesToInsert).returning();

    // Optionally create grocery list items from recipes.
    let groceryCreated = 0;
    if (alsoCreateGroceryList !== false) {
      const recipeIds = insertedEntries.map((e) => e.recipeId).filter(Boolean) as string[];

      if (recipeIds.length) {
        const recipeRows = await db
          .select({ id: recipes.id, title: recipes.title, ingredients: recipes.ingredients })
          .from(recipes)
          .where(inArray(recipes.id, recipeIds));

        const ingredientSet = new Set<string>();
        const toCreate: any[] = [];

        for (const r of recipeRows) {
          const ingredients = (r.ingredients as any) || [];
          for (const raw of ingredients) {
            const name = String(raw || "").trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (ingredientSet.has(key)) continue;
            ingredientSet.add(key);

            toCreate.push({
              userId,
              mealPlanId: plan.id,
              listName: "My Grocery List",
              ingredientName: name,
              quantity: null,
              unit: null,
              category: "From Plan",
              priority: "normal",
              isPantryItem: false,
              purchased: false,
              notes: `From plan: ${planName}`,
            });

            if (toCreate.length >= 200) break;
          }
          if (toCreate.length >= 200) break;
        }

        if (toCreate.length) {
          await db.insert(groceryListItems).values(toCreate);
          groceryCreated = toCreate.length;
        }
      }
    }

    const fullEntries = await db
      .select({
        id: mealPlanEntries.id,
        mealPlanId: mealPlanEntries.mealPlanId,
        recipeId: mealPlanEntries.recipeId,
        date: mealPlanEntries.date,
        mealType: mealPlanEntries.mealType,
        servings: mealPlanEntries.servings,
        customName: mealPlanEntries.customName,
        customCalories: mealPlanEntries.customCalories,
        customProtein: mealPlanEntries.customProtein,
        customCarbs: mealPlanEntries.customCarbs,
        customFat: mealPlanEntries.customFat,
        recipe: recipes,
      })
      .from(mealPlanEntries)
      .leftJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
      .where(eq(mealPlanEntries.mealPlanId, plan.id))
      .orderBy(mealPlanEntries.date);

    res.json({
      message: "Week plan generated",
      weekStart: fmtISODate(weekStart),
      weekEnd: fmtISODate(weekEnd),
      plan,
      entries: fullEntries,
      weeklyMeals: mapEntriesToWeeklyMeals(fullEntries),
      groceryList: { created: groceryCreated },
    });
  } catch (error) {
    console.error("Error generating week plan:", error);
    res.status(500).json({ message: "Failed to generate week plan" });
  }
});


// ============================================================
// POST /api/meal-planner/week/entry
// Adds a custom meal entry for a specific day/meal type in the active week plan.
// ============================================================
router.post("/week/entry", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { date, mealType, name, calories, protein, carbs, fat } = req.body || {};

    const parsed = date ? new Date(date) : null;
    if (!parsed || isNaN(parsed.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const mealTypeStr = String(mealType || "").toLowerCase();
    if (!["breakfast", "lunch", "dinner", "snack"].includes(mealTypeStr)) {
      return res.status(400).json({ message: "Invalid meal type" });
    }

    const mealName = String(name || "").trim();
    if (!mealName) {
      return res.status(400).json({ message: "Meal name is required" });
    }

    const weekStart = startOfWeekMonday(parsed);
    const weekEnd = endOfDay(addDays(weekStart, 6));

    let [plan] = await db
      .select()
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.userId, userId),
          lte(mealPlans.startDate, weekEnd),
          gte(mealPlans.endDate, weekStart),
          eq(mealPlans.isTemplate, false)
        )
      )
      .orderBy(desc(mealPlans.createdAt))
      .limit(1);

    if (!plan) {
      const [createdPlan] = await db
        .insert(mealPlans)
        .values({
          userId,
          name: `Week of ${fmtISODate(weekStart)}`,
          startDate: startOfDay(weekStart),
          endDate: weekEnd,
          isTemplate: false,
        })
        .returning();
      plan = createdPlan;
    }

    const toInt = (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
    };

    const [entry] = await db
      .insert(mealPlanEntries)
      .values({
        mealPlanId: plan.id,
        recipeId: null,
        date: startOfDay(parsed),
        mealType: mealTypeStr,
        servings: 1,
        customName: mealName,
        customCalories: toInt(calories),
        customProtein: toInt(protein),
        customCarbs: toInt(carbs),
        customFat: toInt(fat),
      })
      .returning();

    res.status(201).json({
      entry: {
        id: entry.id,
        date: entry.date,
        mealType: entry.mealType,
        name: mealName,
        calories: toInt(calories),
        protein: toInt(protein),
        carbs: toInt(carbs),
        fat: toInt(fat),
      },
    });
  } catch (error) {
    console.error("Error saving custom meal entry:", error);
    res.status(500).json({ message: "Failed to save meal entry" });
  }
});

// ============================================================
// DELETE /api/meal-planner/week/entry/:id
// ============================================================
router.delete("/week/entry/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const entryId = String(req.params.id || "");

    const [entry] = await db
      .select({
        id: mealPlanEntries.id,
        mealPlanId: mealPlanEntries.mealPlanId,
      })
      .from(mealPlanEntries)
      .innerJoin(mealPlans, eq(mealPlanEntries.mealPlanId, mealPlans.id))
      .where(and(eq(mealPlanEntries.id, entryId), eq(mealPlans.userId, userId)))
      .limit(1);

    if (!entry) {
      return res.status(404).json({ message: "Meal entry not found" });
    }

    await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, entryId));

    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting custom meal entry:", error);
    res.status(500).json({ message: "Failed to delete meal entry" });
  }
});

export default router;
