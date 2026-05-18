import { type AutoPlannerScores } from './autoPlannerTypes';

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export const calculateMealVarietyScore = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const names = new Set<string>();
  let total = 0;
  weekDays.forEach((d) => mealTypes.forEach((m) => {
    const items = weeklyMeals?.[d]?.[m];
    const arr = Array.isArray(items) ? items : items ? [items] : [];
    arr.forEach((it: any) => { total += 1; if (it?.name) names.add(String(it.name).toLowerCase()); });
  }));
  if (!total) return 0;
  return clamp((names.size / total) * 100);
};

export const calculatePrepLoadScore = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const perDay = weekDays.map((d) => mealTypes.reduce((n, m) => n + (Array.isArray(weeklyMeals?.[d]?.[m]) ? weeklyMeals[d][m].length : weeklyMeals?.[d]?.[m] ? 1 : 0), 0));
  const max = Math.max(0, ...perDay);
  const avg = perDay.reduce((a, b) => a + b, 0) / Math.max(1, perDay.length);
  return clamp(100 - Math.max(0, (max - avg) * 18));
};

export const calculatePantryReuseScore = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  let meals = 0;
  let pantryLinked = 0;
  weekDays.forEach((d) => mealTypes.forEach((m) => {
    const arr = Array.isArray(weeklyMeals?.[d]?.[m]) ? weeklyMeals[d][m] : weeklyMeals?.[d]?.[m] ? [weeklyMeals[d][m]] : [];
    arr.forEach((it: any) => { meals += 1; if (it?.source === 'pantry' || it?.isPantryItem) pantryLinked += 1; });
  }));
  return clamp(meals ? (pantryLinked / meals) * 100 : 0);
};

export const calculateWeeklyScores = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[], proteinGoal: number): AutoPlannerScores => {
  const variety = calculateMealVarietyScore(weeklyMeals, weekDays, mealTypes);
  const prep = calculatePrepLoadScore(weeklyMeals, weekDays, mealTypes);
  const pantry = calculatePantryReuseScore(weeklyMeals, weekDays, mealTypes);
  const proteinTotal = weekDays.reduce((acc, d) => acc + mealTypes.reduce((mAcc, m) => {
    const arr = Array.isArray(weeklyMeals?.[d]?.[m]) ? weeklyMeals[d][m] : weeklyMeals?.[d]?.[m] ? [weeklyMeals[d][m]] : [];
    return mAcc + arr.reduce((s: number, it: any) => s + Number(it?.protein || 0), 0);
  }, 0), 0);
  const proteinCoverage = clamp(((proteinTotal / Math.max(1, proteinGoal * weekDays.length)) * 100));
  const groceryEfficiency = clamp((variety * 0.4) + (prep * 0.3) + (pantry * 0.3));
  const readiness = clamp((proteinCoverage * 0.35) + (prep * 0.25) + (groceryEfficiency * 0.2) + (pantry * 0.2));
  return { varietyScore: variety, prepLoadScore: prep, pantryReuseScore: pantry, proteinCoverageScore: proteinCoverage, groceryEfficiencyScore: groceryEfficiency, readinessScore: readiness };
};
