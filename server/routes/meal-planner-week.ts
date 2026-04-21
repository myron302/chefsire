import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  groceryListItems,
  mealFavorites,
  mealPlanEntries,
  mealPlans,
  mealStreaks,
  recipes,
  users,
} from "../../shared/schema.js";
import { requireAuth } from "../middleware";
import { ensureMealPlannerWeekSchema } from "./meal-planner-week/schema.js";
import {
  addDays,
  assertPremiumNutrition,
  endOfDay,
  fmtISODate,
  mapEntriesToWeeklyMeals,
  pickRecipeFromPool,
  startOfDay,
  startOfWeekMonday,
  toNonNegativeRoundedInt,
  type MealType,
} from "./meal-planner-week/utils.js";

const router = express.Router();
const MEAL_SHARE_VISIBILITY = ["private", "friends", "public"] as const;
const SHARED_WEEK_TOKEN_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;
const PUBLIC_SHARED_WEEKS_LIMIT_DEFAULT = 20;
const PUBLIC_SHARED_WEEKS_LIMIT_MAX = 50;
type PublicSharedReadinessFilter = PublicWeekSummary["readinessStatus"] | "all";
type PublicSharedCoverageFilter = "all" | "low" | "medium" | "high";
type PublicSharedSort = "newest" | "readiness" | "coverage";

function parsePublicSharedReadinessFilter(raw: unknown): PublicSharedReadinessFilter {
  const value = String(raw || "all").trim();
  if (value === "not-started" || value === "in-progress" || value === "week-ready") {
    return value;
  }
  return "all";
}

function parsePublicSharedCoverageFilter(raw: unknown): PublicSharedCoverageFilter {
  const value = String(raw || "all").trim();
  if (value === "low" || value === "medium" || value === "high") return value;
  return "all";
}

function parsePublicSharedSort(raw: unknown): PublicSharedSort {
  const value = String(raw || "newest").trim();
  if (value === "readiness" || value === "coverage") return value;
  return "newest";
}

function isCoverageMatch(coveragePct: number, filter: PublicSharedCoverageFilter): boolean {
  if (filter === "all") return true;
  if (filter === "low") return coveragePct < 40;
  if (filter === "medium") return coveragePct >= 40 && coveragePct < 70;
  return coveragePct >= 70;
}

function readinessSortScore(status: PublicWeekSummary["readinessStatus"]): number {
  if (status === "week-ready") return 3;
  if (status === "in-progress") return 2;
  return 1;
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

type PublicWeekSummary = {
  weekAnchor: string;
  weekStart: string;
  weekEnd: string;
  plannedSlots: number;
  totalSlots: number;
  plannedCoveragePct: number;
  readinessStatus: "not-started" | "in-progress" | "week-ready";
  groceryTotalItems: number;
  groceryPurchasedItems: number;
  groceryCompletionPct: number;
  plannedMealsCount: number;
  totalCalories: number;
  totalProtein: number;
  avgCaloriesPerPlannedDay: number;
  avgProteinPerPlannedDay: number;
};

async function buildPublicWeekSummary(userId: string, weekAnchorRaw: Date | string): Promise<PublicWeekSummary> {
  const weekStart = startOfWeekMonday(new Date(weekAnchorRaw));
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

  let entries: any[] = [];
  let groceryItems: Array<{ purchased: boolean | null }> = [];

  if (plan) {
    entries = await db
      .select({
        id: mealPlanEntries.id,
        recipeId: mealPlanEntries.recipeId,
        date: mealPlanEntries.date,
        mealType: mealPlanEntries.mealType,
        servings: mealPlanEntries.servings,
        customName: mealPlanEntries.customName,
        customCalories: mealPlanEntries.customCalories,
        customProtein: mealPlanEntries.customProtein,
        customCarbs: mealPlanEntries.customCarbs,
        customFat: mealPlanEntries.customFat,
        source: mealPlanEntries.source,
        recipe: recipes,
      })
      .from(mealPlanEntries)
      .leftJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
      .where(eq(mealPlanEntries.mealPlanId, plan.id))
      .orderBy(mealPlanEntries.date);

    groceryItems = await db
      .select({ purchased: groceryListItems.purchased })
      .from(groceryListItems)
      .where(and(eq(groceryListItems.userId, userId), eq(groceryListItems.mealPlanId, plan.id)));
  }

  const plannedSlots = entries.length;
  const totalSlots = 28; // 7 days x 4 meal types
  const plannedCoveragePct = Math.round((plannedSlots / Math.max(1, totalSlots)) * 100);
  const readinessStatus: PublicWeekSummary["readinessStatus"] =
    plannedSlots > 0 ? (plannedCoveragePct >= 70 ? "week-ready" : "in-progress") : "not-started";

  const groceryTotalItems = groceryItems.length;
  const groceryPurchasedItems = groceryItems.filter((item) => Boolean(item.purchased)).length;
  const groceryCompletionPct = groceryTotalItems > 0
    ? Math.round((groceryPurchasedItems / groceryTotalItems) * 100)
    : 0;

  const totalCalories = entries.reduce(
    (sum, entry) => sum + Number(entry?.recipe?.calories || entry?.customCalories || 0),
    0
  );
  const totalProtein = entries.reduce(
    (sum, entry) => sum + Number(entry?.recipe?.protein || entry?.customProtein || 0),
    0
  );
  const activePlannedDays = new Set(entries.map((entry) => fmtISODate(new Date(entry.date)))).size;

  return {
    weekAnchor: fmtISODate(weekStart),
    weekStart: fmtISODate(weekStart),
    weekEnd: fmtISODate(weekEnd),
    plannedSlots,
    totalSlots,
    plannedCoveragePct,
    readinessStatus,
    groceryTotalItems,
    groceryPurchasedItems,
    groceryCompletionPct,
    plannedMealsCount: plannedSlots,
    totalCalories,
    totalProtein,
    avgCaloriesPerPlannedDay: activePlannedDays > 0 ? Math.round(totalCalories / activePlannedDays) : 0,
    avgProteinPerPlannedDay: activePlannedDays > 0 ? Math.round(totalProtein / activePlannedDays) : 0,
  };
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

router.post("/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const dailyCalorieGoal = Number(req.body?.dailyCalorieGoal || 2000);
    const macroGoals = req.body?.macroGoals || { protein: 150, carbs: 200, fat: 65 };

    const [updated] = await db
      .update(users)
      .set({
        dailyCalorieGoal,
        macroGoals,
      })
      .where(eq(users.id, userId))
      .returning();

    res.json({ settings: { dailyCalorieGoal: updated.dailyCalorieGoal, macroGoals: updated.macroGoals } });
  } catch (error) {
    console.error("Error saving meal planner settings:", error);
    res.status(500).json({ message: "Failed to save settings" });
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
        source: mealPlanEntries.source,
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
// GET /api/meal-planner/week/share-metadata?date=YYYY-MM-DD
// Lightweight persistence layer for weekly sharing foundation.
// ============================================================
router.get("/week/share-metadata", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rawDate = String(req.query.date || "");
    const parsed = rawDate ? new Date(rawDate) : new Date();
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const weekAnchor = fmtISODate(startOfWeekMonday(parsed));
    const result = await db.execute(sql`
      SELECT visibility, summary_fingerprint, public_share_token, updated_at
      FROM meal_plan_week_shares
      WHERE user_id = ${userId} AND week_anchor = ${weekAnchor}::date
      LIMIT 1
    `);
    const row = (result as any).rows?.[0];

    res.json({
      weekAnchor,
      visibility: row?.visibility || "private",
      summaryFingerprint: row?.summary_fingerprint || null,
      publicShareToken: row?.public_share_token || null,
      updatedAt: row?.updated_at || null,
    });
  } catch (error) {
    console.error("Error loading weekly share metadata:", error);
    res.status(500).json({ message: "Failed to load weekly share metadata" });
  }
});

// ============================================================
// POST /api/meal-planner/week/share-metadata
// Persist visibility + summary fingerprint, and generate token for public links.
// ============================================================
router.post("/week/share-metadata", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rawDate = String(req.body?.date || "");
    const parsed = rawDate ? new Date(rawDate) : new Date();
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const visibility = String(req.body?.visibility || "private").toLowerCase();
    if (!MEAL_SHARE_VISIBILITY.includes(visibility as (typeof MEAL_SHARE_VISIBILITY)[number])) {
      return res.status(400).json({ message: "Invalid visibility value" });
    }

    const summaryFingerprintRaw = String(req.body?.summaryFingerprint || "").trim();
    const summaryFingerprint = summaryFingerprintRaw ? summaryFingerprintRaw.slice(0, 200) : null;
    const weekAnchor = fmtISODate(startOfWeekMonday(parsed));

    const existingResult = await db.execute(sql`
      SELECT public_share_token
      FROM meal_plan_week_shares
      WHERE user_id = ${userId} AND week_anchor = ${weekAnchor}::date
      LIMIT 1
    `);
    const existing = (existingResult as any).rows?.[0];
    const token =
      visibility === "public"
        ? existing?.public_share_token || `mws_${randomUUID().replace(/-/g, "").slice(0, 20)}`
        : existing?.public_share_token || null;

    await db.execute(sql`
      INSERT INTO meal_plan_week_shares (
        user_id,
        week_anchor,
        visibility,
        summary_fingerprint,
        public_share_token,
        created_at,
        updated_at
      ) VALUES (
        ${userId},
        ${weekAnchor}::date,
        ${visibility},
        ${summaryFingerprint},
        ${token},
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id, week_anchor)
      DO UPDATE SET
        visibility = EXCLUDED.visibility,
        summary_fingerprint = EXCLUDED.summary_fingerprint,
        public_share_token = EXCLUDED.public_share_token,
        updated_at = NOW()
    `);

    res.json({
      ok: true,
      weekAnchor,
      visibility,
      summaryFingerprint,
      publicShareToken: token,
    });
  } catch (error) {
    console.error("Error saving weekly share metadata:", error);
    res.status(500).json({ message: "Failed to save weekly share metadata" });
  }
});

// ============================================================
// GET /api/meal-planner/week/shared
// Public browse surface: recent public shared weeks.
// ============================================================
router.get("/week/shared", async (req: Request, res: Response) => {
  try {
    const parsedLimit = Number(req.query.limit ?? PUBLIC_SHARED_WEEKS_LIMIT_DEFAULT);
    const limit = Math.max(1, Math.min(PUBLIC_SHARED_WEEKS_LIMIT_MAX, Number.isFinite(parsedLimit) ? parsedLimit : PUBLIC_SHARED_WEEKS_LIMIT_DEFAULT));
    const readinessFilter = parsePublicSharedReadinessFilter(req.query.readiness);
    const coverageFilter = parsePublicSharedCoverageFilter(req.query.coverage);
    const sort = parsePublicSharedSort(req.query.sort);

    const shareResult = await db.execute(sql`
      SELECT s.user_id, s.week_anchor, s.public_share_token, s.updated_at, u.display_name, u.username
      FROM meal_plan_week_shares s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.visibility = 'public' AND s.public_share_token IS NOT NULL
      ORDER BY s.updated_at DESC
      LIMIT ${Math.min(PUBLIC_SHARED_WEEKS_LIMIT_MAX, Math.max(limit * 3, limit))}
    `);
    const shareRows = ((shareResult as any).rows || []) as Array<{
      user_id: string;
      week_anchor: Date | string;
      public_share_token: string;
      updated_at: string | null;
      display_name: string | null;
      username: string | null;
    }>;

    let items = await Promise.all(
      shareRows.map(async (row) => {
        const summary = await buildPublicWeekSummary(row.user_id, row.week_anchor);
        return {
          token: row.public_share_token,
          weekAnchor: summary.weekAnchor,
          weekStart: summary.weekStart,
          weekEnd: summary.weekEnd,
          sharedAt: row.updated_at || null,
          sharer: {
            displayName: row.display_name || null,
            username: row.username || null,
          },
          readiness: {
            status: summary.readinessStatus,
            plannedSlots: summary.plannedSlots,
            totalSlots: summary.totalSlots,
            plannedCoveragePct: summary.plannedCoveragePct,
          },
          grocery: {
            totalItems: summary.groceryTotalItems,
            purchasedItems: summary.groceryPurchasedItems,
            completionPct: summary.groceryCompletionPct,
          },
          nutritionHighlights: {
            plannedMealsCount: summary.plannedMealsCount,
            totalCalories: summary.totalCalories,
            totalProtein: summary.totalProtein,
            avgCaloriesPerPlannedDay: summary.avgCaloriesPerPlannedDay,
            avgProteinPerPlannedDay: summary.avgProteinPerPlannedDay,
          },
        };
      })
    );

    items = items.filter((item) => {
      const readinessMatches = readinessFilter === "all" || item.readiness.status === readinessFilter;
      const coverageMatches = isCoverageMatch(item.readiness.plannedCoveragePct, coverageFilter);
      return readinessMatches && coverageMatches;
    });

    if (sort === "coverage") {
      items.sort((a, b) => {
        const coverageDiff = b.readiness.plannedCoveragePct - a.readiness.plannedCoveragePct;
        if (coverageDiff !== 0) return coverageDiff;
        return new Date(b.sharedAt || 0).getTime() - new Date(a.sharedAt || 0).getTime();
      });
    } else if (sort === "readiness") {
      items.sort((a, b) => {
        const readinessDiff = readinessSortScore(b.readiness.status as PublicWeekSummary["readinessStatus"]) - readinessSortScore(a.readiness.status as PublicWeekSummary["readinessStatus"]);
        if (readinessDiff !== 0) return readinessDiff;
        const coverageDiff = b.readiness.plannedCoveragePct - a.readiness.plannedCoveragePct;
        if (coverageDiff !== 0) return coverageDiff;
        return new Date(b.sharedAt || 0).getTime() - new Date(a.sharedAt || 0).getTime();
      });
    }

    items = items.slice(0, limit);

    res.json({
      items,
      filters: {
        readiness: readinessFilter,
        coverage: coverageFilter,
        sort,
      },
    });
  } catch (error) {
    console.error("Error fetching public shared weeks list:", error);
    res.status(500).json({ message: "Failed to load public shared weeks" });
  }
});

// ============================================================
// GET /api/meal-planner/week/shared/:token
// Public, read-only weekly summary for token-based sharing.
// ============================================================
router.get("/week/shared/:token", async (req: Request, res: Response) => {
  try {
    const token = String(req.params?.token || "").trim();
    if (!SHARED_WEEK_TOKEN_PATTERN.test(token)) {
      return res.status(400).json({ message: "Invalid share token" });
    }

    const shareResult = await db.execute(sql`
      SELECT user_id, week_anchor, visibility, updated_at
      FROM meal_plan_week_shares
      WHERE public_share_token = ${token}
      LIMIT 1
    `);
    const shareRow = (shareResult as any).rows?.[0];

    if (!shareRow || shareRow.visibility !== "public") {
      return res.status(404).json({ message: "Shared week not found" });
    }

    const summary = await buildPublicWeekSummary(shareRow.user_id, shareRow.week_anchor);

    const weekStart = startOfWeekMonday(new Date(shareRow.week_anchor));
    const weekEnd = endOfDay(addDays(weekStart, 6));
    const weekAnchor = summary.weekAnchor;
    const [plan] = await db
      .select()
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.userId, shareRow.user_id),
          lte(mealPlans.startDate, weekEnd),
          gte(mealPlans.endDate, weekStart),
          eq(mealPlans.isTemplate, false)
        )
      )
      .orderBy(desc(mealPlans.createdAt))
      .limit(1);
    const entries = plan
      ? await db
          .select({
            id: mealPlanEntries.id,
            recipeId: mealPlanEntries.recipeId,
            date: mealPlanEntries.date,
            mealType: mealPlanEntries.mealType,
            servings: mealPlanEntries.servings,
            customName: mealPlanEntries.customName,
            customCalories: mealPlanEntries.customCalories,
            customProtein: mealPlanEntries.customProtein,
            customCarbs: mealPlanEntries.customCarbs,
            customFat: mealPlanEntries.customFat,
            source: mealPlanEntries.source,
            recipe: recipes,
          })
          .from(mealPlanEntries)
          .leftJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
          .where(eq(mealPlanEntries.mealPlanId, plan.id))
          .orderBy(mealPlanEntries.date)
      : [];

    const weeklyMeals = mapEntriesToWeeklyMeals(entries);

    const publicWeeklyMeals = Object.fromEntries(
      Object.entries(weeklyMeals).map(([day, mealsByType]) => [
        day,
        Object.fromEntries(
          Object.entries(mealsByType as Record<string, any>).map(([mealType, meals]) => [
            mealType,
            (Array.isArray(meals) ? meals : [meals]).map((meal) => ({
              name: meal.name,
              calories: Number(meal.calories || 0),
              protein: Number(meal.protein || 0),
              carbs: Number(meal.carbs || 0),
              fat: Number(meal.fat || 0),
              servings: 1,
            })),
          ])
        ),
      ])
    );

    res.json({
      token,
      weekAnchor,
      weekStart: fmtISODate(weekStart),
      weekEnd: fmtISODate(weekEnd),
      sharedAt: shareRow.updated_at || null,
      visibility: "public",
      plannedMeals: publicWeeklyMeals,
      readiness: {
        status: summary.readinessStatus,
        plannedSlots: summary.plannedSlots,
        totalSlots: summary.totalSlots,
        plannedCoveragePct: summary.plannedCoveragePct,
      },
      grocery: {
        totalItems: summary.groceryTotalItems,
        purchasedItems: summary.groceryPurchasedItems,
        completionPct: summary.groceryCompletionPct,
      },
      prep: {
        status: "not-shared",
        note: "Prep details are not included in public shares yet.",
      },
      nutritionHighlights: {
        plannedMealsCount: summary.plannedMealsCount,
        totalCalories: summary.totalCalories,
        totalProtein: summary.totalProtein,
        avgCaloriesPerPlannedDay: summary.avgCaloriesPerPlannedDay,
        avgProteinPerPlannedDay: summary.avgProteinPerPlannedDay,
      },
    });
  } catch (error) {
    console.error("Error fetching public shared week:", error);
    res.status(500).json({ message: "Failed to load shared week" });
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
        source: mealPlanEntries.source,
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
    const { date, mealType, name, calories, protein, carbs, fat, fiber, source, recipeId } = req.body || {};

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

    const loggedDate = startOfDay(parsed);

    const [entry] = await db
      .insert(mealPlanEntries)
      .values({
        mealPlanId: plan.id,
        recipeId: recipeId || null,
        date: loggedDate,
        mealType: mealTypeStr,
        servings: 1,
        customName: mealName,
        customCalories: toNonNegativeRoundedInt(calories),
        customProtein: toNonNegativeRoundedInt(protein),
        customCarbs: toNonNegativeRoundedInt(carbs),
        customFat: toNonNegativeRoundedInt(fat),
        source: source || null,
      })
      .returning();

    const [existingFavorite] = await db
      .select()
      .from(mealFavorites)
      .where(and(eq(mealFavorites.userId, userId), eq(mealFavorites.mealName, mealName)))
      .limit(1);

    if (existingFavorite) {
      await db
        .update(mealFavorites)
        .set({
          calories: toNonNegativeRoundedInt(calories),
          protein: toNonNegativeRoundedInt(protein),
          carbs: toNonNegativeRoundedInt(carbs),
          fat: toNonNegativeRoundedInt(fat),
          fiber: toNonNegativeRoundedInt(fiber),
          timesLogged: (existingFavorite.timesLogged || 0) + 1,
          lastUsed: new Date(),
        })
        .where(eq(mealFavorites.id, existingFavorite.id));
    } else {
      await db.insert(mealFavorites).values({
        userId,
        mealName,
        calories: toNonNegativeRoundedInt(calories),
        protein: toNonNegativeRoundedInt(protein),
        carbs: toNonNegativeRoundedInt(carbs),
        fat: toNonNegativeRoundedInt(fat),
        fiber: toNonNegativeRoundedInt(fiber),
        isFavorite: false,
        timesLogged: 1,
        lastUsed: new Date(),
      });
    }

    const [streak] = await db
      .select()
      .from(mealStreaks)
      .where(eq(mealStreaks.userId, userId))
      .limit(1);

    const today = new Date(loggedDate);
    today.setHours(0, 0, 0, 0);
    let currentStreak = 1;
    let longestStreak = 1;

    if (streak) {
      const last = streak.lastLoggedDate ? new Date(streak.lastLoggedDate) : null;
      if (last) {
        last.setHours(0, 0, 0, 0);
        const dayDiff = Math.round((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

        if (dayDiff === 0) {
          currentStreak = streak.currentStreak || 0;
        } else if (dayDiff === 1) {
          currentStreak = (streak.currentStreak || 0) + 1;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }

      longestStreak = Math.max(streak.longestStreak || 0, currentStreak);

      await db
        .update(mealStreaks)
        .set({
          currentStreak,
          longestStreak,
          lastLoggedDate: today.toISOString().split("T")[0],
          updatedAt: new Date(),
        })
        .where(eq(mealStreaks.id, streak.id));
    } else {
      await db.insert(mealStreaks).values({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastLoggedDate: today.toISOString().split("T")[0],
        updatedAt: new Date(),
      });
    }

    res.status(201).json({
      entry: {
        id: entry.id,
        date: entry.date,
        mealType: entry.mealType,
        name: mealName,
        calories: toNonNegativeRoundedInt(calories),
        protein: toNonNegativeRoundedInt(protein),
        carbs: toNonNegativeRoundedInt(carbs),
        fat: toNonNegativeRoundedInt(fat),
        fiber: toNonNegativeRoundedInt(fiber),
        source: source || null,
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
