import { calculateWeeklyScores } from './autoPlannerScoring';
import { optimizeWeeklyDistribution, calculateWeeklyOptimizationScore, buildAdaptivePlannerRecommendations } from './autoPlannerOptimizationEngine';
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
  const scoreMeal = (meal: any) => {
    const protein = Number(meal?.protein || 0) * (mode === 'high-protein' ? 2 : priorities.proteinPriority);
    const prepPenalty = Number(meal?.mealItems?.length || 0) * priorities.prepSimplicity;
    const pantryBoost = (meal?.source === 'pantry' || meal?.isPantryItem ? 20 : 0) * priorities.pantryReusePriority;
    return protein + pantryBoost - prepPenalty;
  };

  const selections = optimizeWeeklyDistribution({ weeklyMeals: next, weekDays, mealTypes, pool, mode, priorities, baseScoreMeal: scoreMeal });
  selections.forEach(({ day, mealType, candidate, reason }) => {
    const generatedMeal = { ...candidate, generatedByAutoPlanner: true, autoPlannerMode: mode, optimizationVersion: 2 };
    next[day] = { ...(next[day] || {}), [mealType]: [generatedMeal] };
    changes.push({ id: `${day}-${mealType}`, slot: { day, mealType }, action: 'add', meal: generatedMeal, reason, generatedByAutoPlanner: true, autoPlannerMode: mode, optimizationVersion: 2 });
  });

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
  const beforeOpt = calculateWeeklyOptimizationScore(weeklyMeals, weekDays, mealTypes);
  const afterOpt = calculateWeeklyOptimizationScore(next, weekDays, mealTypes);
  const contextual = buildAdaptivePlannerRecommendations(weeklyMeals, next, weekDays, mealTypes);
  const optTone: 'positive' | 'warning' = afterOpt >= beforeOpt ? 'positive' : 'warning';
  return { mode, changes, beforeScores, afterScores, suggestions: [{ id: 'autofill', tone: 'neutral', message: `Auto-filled ${changes.length} meal slots via contextual weekly optimization.` }, { id: 'opt-score', tone: optTone, message: `Weekly optimization score ${beforeOpt} → ${afterOpt}.` }, ...contextual.map((message, idx) => ({ id: `ctx-${idx}`, tone: 'neutral' as const, message }))] };
};

export const optimizeWeeklyPlan = generateAdaptiveMealPlan;
