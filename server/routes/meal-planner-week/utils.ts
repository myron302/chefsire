import { hasAuthoritativePaidEntitlement } from "../../lib/subscription-security";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Parses a stored week anchor as a LOCAL calendar date.
 *
 * `new Date("2030-01-14")` is not the date it looks like: a date-only string is parsed as UTC
 * midnight, so on any server west of UTC it lands on the previous evening. The anchor 2030-01-14,
 * a Monday, became Sunday the 13th at 19:00 on a UTC-5 server, and startOfWeekMonday then walked
 * back to Monday the 7th -- so a shared week showed the week BEFORE the one that was shared,
 * normally an empty one. Every share link looked broken, and only on servers west of Greenwich,
 * which is why it survived: it depends on the deployment's timezone, not the code path.
 *
 * A week anchor is a calendar date, not an instant. This builds it in local time so the day of the
 * week it represents is the day of the week it is.
 */
export function parseCalendarDate(value: string | Date | null | undefined): Date {
  if (value instanceof Date) return startOfDay(value);
  const text = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  // Anything else (a full timestamp, say) is already an instant; keep the existing behaviour.
  return startOfDay(new Date(text));
}

/**
 * Week starts on Monday.
 */
export function startOfWeekMonday(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Formats a LOCAL calendar date, the exact inverse of {@link parseCalendarDate}.
 *
 * This used to be `d.toISOString().split("T")[0]`, which is the same calendar-date-as-instant
 * confusion in the other direction: end-of-day values (23:59:59 local) formatted as the NEXT day
 * west of UTC, so a seven-day week reported an eight-day span, and local midnight formatted as the
 * PREVIOUS day east of UTC. Every caller here means a meal-plan day -- a calendar date -- so the
 * local components are what it should read.
 */
export function fmtISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toWeekdayName(d: Date) {
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

export function assertPremiumNutrition(user: any) {
  const hasAccess = Boolean(user?.nutritionPremium) && hasAuthoritativePaidEntitlement();
  if (!hasAccess) return false;

  if (user?.nutritionTrialEndsAt) {
    const trialEnd = new Date(user.nutritionTrialEndsAt);
    if (!isNaN(trialEnd.getTime()) && new Date() > trialEnd) {
      return false;
    }
  }

  return true;
}

export function pickRecipeFromPool(pool: any[]) {
  if (!pool.length) return null;

  // Prefer top-rated but add randomness so it’s not the same week every time
  const top = pool.slice(0, Math.min(25, pool.length));
  const idx = Math.floor(Math.random() * top.length);
  return top[idx];
}

export function mapEntriesToWeeklyMeals(entries: any[]) {
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
          mealItems: Array.isArray(e.mealItems) ? e.mealItems : undefined,
          recipeId: e.recipe.id,
          entryId: e.id,
          source: e.source || null,
          sourceRecipeId: e.sourceRecipeId || e.recipe.id || null,
          sourceRecipeTitle: e.sourceRecipeTitle || e.recipe.title || null,
          sourceRecipeImageUrl: e.sourceRecipeImageUrl || e.recipe.imageUrl || null,
          sourceRecipeServings: e.sourceRecipeServings || e.recipe.servings || null,
          sourceRecipeUrl: e.sourceRecipeUrl || null,
        }
      : {
          name: e.customName || "Meal",
          calories: e.customCalories || 0,
          protein: Number(e.customProtein || 0),
          carbs: Number(e.customCarbs || 0),
          fat: Number(e.customFat || 0),
          mealItems: Array.isArray(e.mealItems) ? e.mealItems : undefined,
          recipeId: null,
          entryId: e.id,
          source: e.source || null,
          sourceRecipeId: e.sourceRecipeId || null,
          sourceRecipeTitle: e.sourceRecipeTitle || null,
          sourceRecipeImageUrl: e.sourceRecipeImageUrl || null,
          sourceRecipeServings: e.sourceRecipeServings || null,
          sourceRecipeUrl: e.sourceRecipeUrl || null,
        };

    const existing = out[dayName][e.mealType];
    const existingItems = Array.isArray(existing) ? existing : existing ? [existing] : [];
    out[dayName][e.mealType] = [...existingItems, mappedMeal];
  }

  return out;
}

export function toNonNegativeRoundedInt(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}
