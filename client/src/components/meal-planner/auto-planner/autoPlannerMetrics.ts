import { getMealsForSlot } from '../planner-graph/plannerGraphUtils';
import { extractMealIngredients } from '../planner-graph/plannerMealExtraction';
import { calculateMealComplexity } from '../planner-graph/plannerComplexity';

export const detectRepeatedProteins = (meals: any[]) => {
  const map = new Map<string, number>();
  meals.forEach((m) => {
    const key = String(m?.primaryProtein || m?.proteinSource || '').toLowerCase();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()).filter(([, count]) => count >= 3);
};

export const detectIngredientOveruse = (meals: any[]) => {
  const map = new Map<string, number>();
  meals.forEach((meal) => extractMealIngredients(meal).forEach((i: any) => {
    const k = String(i?.name || '').toLowerCase().trim();
    if (!k) return;
    map.set(k, (map.get(k) || 0) + 1);
  }));
  return Array.from(map.entries()).filter(([, count]) => count >= 4);
};

export const calculateMealFatigueScore = (meals: any[]) => {
  const repeatedProteins = detectRepeatedProteins(meals).length;
  const ingredientOveruse = detectIngredientOveruse(meals).length;
  const uniqueNames = new Set(meals.map((m) => String(m?.name || '').toLowerCase()).filter(Boolean)).size;
  const namePenalty = meals.length ? Math.max(0, 100 - Math.round((uniqueNames / meals.length) * 100)) : 0;
  return Math.max(0, Math.min(100, repeatedProteins * 10 + ingredientOveruse * 7 + namePenalty));
};

export const calculateDailyPrepStress = (dayMeals: any[]) =>
  dayMeals.reduce((acc, meal) => acc + Math.max(1, calculateMealComplexity(meal)), 0);

export const calculateIngredientOverlapScore = (meals: any[]) => {
  const counts = new Map<string, number>();
  meals.forEach((m) => extractMealIngredients(m).forEach((i: any) => {
    const k = String(i?.name || '').toLowerCase().trim();
    if (!k) return;
    counts.set(k, (counts.get(k) || 0) + 1);
  }));
  const reused = Array.from(counts.values()).filter((count) => count > 1).length;
  return Math.round((reused / Math.max(1, counts.size)) * 100);
};

export const calculateGroceryFragmentation = (meals: any[]) => {
  const counts = new Map<string, number>();
  meals.forEach((m) => extractMealIngredients(m).forEach((i: any) => {
    const k = String(i?.name || '').toLowerCase().trim();
    if (!k) return;
    counts.set(k, (counts.get(k) || 0) + 1);
  }));
  const oneOff = Array.from(counts.values()).filter((count) => count === 1).length;
  return Math.round((oneOff / Math.max(1, counts.size)) * 100);
};

export const calculatePantryReuseEfficiency = (meals: any[]) => {
  const pantry = meals.filter((m) => m?.source === 'pantry' || m?.isPantryItem).length;
  return Math.round((pantry / Math.max(1, meals.length)) * 100);
};

export const calculateWeeklyPlannerStress = (
  weeklyMeals: Record<string, any>,
  weekDays: readonly string[],
  mealTypes: readonly string[],
) => {
  const dayStress = weekDays.map((day) =>
    calculateDailyPrepStress(mealTypes.flatMap((mealType) => getMealsForSlot(weeklyMeals, day, mealType))),
  );
  const max = Math.max(0, ...dayStress);
  const avg = dayStress.reduce((a, b) => a + b, 0) / Math.max(1, dayStress.length);
  return Math.round(Math.max(0, max - avg));
};
