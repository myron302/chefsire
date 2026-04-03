import { and } from "drizzle-orm";

export const leftoverSuggestions = [
  { idea: "Add to a stir-fry", difficulty: "easy" },
  { idea: "Make a soup or stew", difficulty: "easy" },
  { idea: "Create a casserole", difficulty: "medium" },
  { idea: "Use in a wrap or sandwich", difficulty: "easy" },
  { idea: "Top a salad", difficulty: "easy" },
] as const;

export const storeLayoutOrder = [
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
  "other",
] as const;

export function toSingleOrAnd(conditions: any[]) {
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

export function calculateBudgetSummary(items: Array<{ estimatedPrice: unknown; actualPrice: unknown }>) {
  const totalEstimated = items.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0);
  const totalActual = items.reduce((sum, item) => sum + Number(item.actualPrice || 0), 0);

  return {
    estimated: totalEstimated,
    actual: totalActual,
    difference: totalActual - totalEstimated,
  };
}

export function groupItemsByCategoryAndSort<T extends { category: string | null }>(items: T[]) {
  const grouped = items.reduce((acc, item) => {
    const key = item.category || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);

  return Object.entries(grouped).sort(([a], [b]) => {
    const aIndex = storeLayoutOrder.indexOf(a.toLowerCase() as (typeof storeLayoutOrder)[number]);
    const bIndex = storeLayoutOrder.indexOf(b.toLowerCase() as (typeof storeLayoutOrder)[number]);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
}

export function calculateSavingsReport(items: Array<{ estimatedPrice: unknown; actualPrice: unknown; isPantryItem: unknown; category: string | null }>) {
  const totalEstimated = items.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0);
  const totalActual = items.reduce((sum, item) => sum + Number(item.actualPrice || 0), 0);
  const totalSaved = totalEstimated - totalActual;
  const savingsRate = totalEstimated > 0 ? ((totalSaved / totalEstimated) * 100).toFixed(1) : "0.0";

  const pantryItems = items.filter((item) => item.isPantryItem);
  const pantrySavings = pantryItems.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0);

  const categoryStats = items.reduce((acc, item) => {
    const category = item.category || "Other";
    if (!acc[category]) {
      acc[category] = { estimated: 0, actual: 0, saved: 0, count: 0 };
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

  return {
    summary: {
      totalEstimated,
      totalActual,
      totalSaved,
      savingsRate: Number(savingsRate),
      pantrySavings,
      itemsCount: items.length,
    },
    topSavingCategories,
  };
}

export function toIsoDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

export function mapMealHistory(meals: Array<{ id: string; mealName: string; calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null; isFavorite: boolean | null; timesLogged: number | null; lastUsed: Date | null }>) {
  return meals.map((m) => ({
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
  }));
}
