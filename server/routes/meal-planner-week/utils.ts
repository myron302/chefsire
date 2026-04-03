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

export function fmtISODate(d: Date) {
  return d.toISOString().split("T")[0];
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
          recipeId: e.recipe.id,
          entryId: e.id,
          source: e.source || null,
        }
      : {
          name: e.customName || "Meal",
          calories: e.customCalories || 0,
          protein: Number(e.customProtein || 0),
          carbs: Number(e.customCarbs || 0),
          fat: Number(e.customFat || 0),
          recipeId: null,
          entryId: e.id,
          source: e.source || null,
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
