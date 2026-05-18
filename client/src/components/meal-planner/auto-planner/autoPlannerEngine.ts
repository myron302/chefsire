import { calculateWeeklyScores } from './autoPlannerScoring';
import { type AutoPlannerMode, type AutoPlannerPriorities, type AutoPlannerResult } from './autoPlannerTypes';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const rankRecipesForPlannerSlot = (pool: any[], mode: AutoPlannerMode, priorities: AutoPlannerPriorities) => {
  return [...pool].sort((a, b) => {
    const score = (meal: any) => {
      const protein = Number(meal?.protein || 0) * (mode === 'high-protein' ? 2 : priorities.proteinPriority);
      const prepPenalty = Number(meal?.mealItems?.length || 0) * priorities.prepSimplicity;
      const pantryBoost = (meal?.source === 'pantry' || meal?.isPantryItem ? 20 : 0) * priorities.pantryReusePriority;
      return protein + pantryBoost - prepPenalty;
    };
    return score(b) - score(a);
  });
};

export const fillPlannerGaps = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[], pool: any[], mode: AutoPlannerMode, priorities: AutoPlannerPriorities) => {
  const next = clone(weeklyMeals || {});
  const changes: any[] = [];
  weekDays.forEach((day) => mealTypes.forEach((mealType) => {
    const existing = Array.isArray(next?.[day]?.[mealType]) ? next[day][mealType] : next?.[day]?.[mealType] ? [next[day][mealType]] : [];
    if (existing.length > 0) return;
    const candidate = rankRecipesForPlannerSlot(pool, mode, priorities)[0];
    if (!candidate) return;
    const generatedMeal = { ...candidate, generatedByAutoPlanner: true, autoPlannerMode: mode, optimizationVersion: 1 };
    next[day] = { ...(next[day] || {}), [mealType]: [generatedMeal] };
    changes.push({ id: `${day}-${mealType}`, slot: { day, mealType }, action: 'add', meal: generatedMeal, reason: 'Filled empty slot from adaptive ranking', generatedByAutoPlanner: true, autoPlannerMode: mode, optimizationVersion: 1 });
  }));
  return { next, changes };
};

export const generateAdaptiveMealPlan = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[], proteinGoal: number, mode: AutoPlannerMode, priorities: AutoPlannerPriorities): AutoPlannerResult => {
  const pool = weekDays.flatMap((d) => mealTypes.flatMap((m) => {
    const arr = Array.isArray(weeklyMeals?.[d]?.[m]) ? weeklyMeals[d][m] : weeklyMeals?.[d]?.[m] ? [weeklyMeals[d][m]] : [];
    return arr;
  })).filter(Boolean);
  const beforeScores = calculateWeeklyScores(weeklyMeals, weekDays, mealTypes, proteinGoal);
  const { next, changes } = fillPlannerGaps(weeklyMeals, weekDays, mealTypes, pool, mode, priorities);
  const afterScores = calculateWeeklyScores(next, weekDays, mealTypes, proteinGoal);
  return { mode, changes, beforeScores, afterScores, suggestions: [{ id: 'autofill', tone: 'neutral', message: `Auto-filled ${changes.length} meal slots using current week meals, pantry bias, and mode priorities.` }] };
};

export const optimizeWeeklyPlan = generateAdaptiveMealPlan;
