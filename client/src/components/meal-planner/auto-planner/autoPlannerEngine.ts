import { getMealsForSlot } from '../planner-graph/plannerGraphUtils';
import { calculateWeeklyScores } from './autoPlannerScoring';
import { calculateWeeklyOptimizationScore, buildAdaptivePlannerRecommendations } from './autoPlannerOptimizationEngine';
import { optimizeMealPlacement } from './autoPlannerSimulationEngine';
import { evolveWeeklyPlan, summarizeOptimizationDeltas } from './autoPlannerWeekOptimizer';
import { type AutoPlannerMode, type AutoPlannerPriorities, type AutoPlannerResult } from './autoPlannerTypes';
import { optimizeWeeklyLifeRhythm } from './autoPlannerRhythmEngine';

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
  let next = clone(weeklyMeals || {});
  const changes: any[] = [];
  const scoreMeal = (meal: any) => {
    const protein = Number(meal?.protein || 0) * (mode === 'high-protein' ? 2 : priorities.proteinPriority);
    const prepPenalty = Number(meal?.mealItems?.length || 0) * priorities.prepSimplicity;
    const pantryBoost = (meal?.source === 'pantry' || meal?.isPantryItem ? 20 : 0) * priorities.pantryReusePriority;
    return protein + pantryBoost - prepPenalty;
  };

  const placement = optimizeMealPlacement(next, pool, weekDays, mealTypes, mode, scoreMeal);
  next = placement.next;
  weekDays.forEach((day) => mealTypes.forEach((mealType) => {
    const slotMeals = getMealsForSlot(next, day, mealType);
    const prevMeals = getMealsForSlot(weeklyMeals, day, mealType);
    if (!slotMeals.length || prevMeals.length) return;
    const generatedMeal = { ...slotMeals[0], generatedByAutoPlanner: true, autoPlannerMode: mode, optimizationVersion: 3 };
    next[day] = { ...(next[day] || {}), [mealType]: [generatedMeal] };
    changes.push({ id: `${day}-${mealType}`, slot: { day, mealType }, action: 'add', meal: generatedMeal, reason: `Iterative placement optimization for ${mealType} on ${day}.`, generatedByAutoPlanner: true, autoPlannerMode: mode, optimizationVersion: 3 });
  }));

  return { next, changes };
};

export const generateAdaptiveMealPlan = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[], proteinGoal: number, mode: AutoPlannerMode, priorities: AutoPlannerPriorities): AutoPlannerResult => {
  const pool = weekDays.flatMap((d) => mealTypes.flatMap((m) => {
    const arr = getMealsForSlot(weeklyMeals, d, m);
    return arr;
  })).filter(Boolean);
  const beforeScores = calculateWeeklyScores(weeklyMeals, weekDays, mealTypes, proteinGoal);
  const { next: seededPlan, changes } = fillPlannerGaps(weeklyMeals, weekDays, mealTypes, pool, mode, priorities);
  const { next, evaluatedWeeks } = evolveWeeklyPlan(seededPlan, pool, weekDays, mealTypes, mode, (meal: any) => {
    const protein = Number(meal?.protein || 0) * (mode === 'high-protein' ? 2 : priorities.proteinPriority);
    const prepPenalty = Number(meal?.mealItems?.length || 0) * priorities.prepSimplicity;
    const pantryBoost = (meal?.source === 'pantry' || meal?.isPantryItem ? 20 : 0) * priorities.pantryReusePriority;
    return protein + pantryBoost - prepPenalty;
  });
  const afterScores = calculateWeeklyScores(next, weekDays, mealTypes, proteinGoal);
  const beforeOpt = calculateWeeklyOptimizationScore(weeklyMeals, weekDays, mealTypes);
  const afterOpt = calculateWeeklyOptimizationScore(next, weekDays, mealTypes);
  const contextual = buildAdaptivePlannerRecommendations(weeklyMeals, next, weekDays, mealTypes);
  const tradeoffNotes = summarizeOptimizationDeltas(weeklyMeals, next, weekDays, mealTypes);
  const lifeRhythmBefore = optimizeWeeklyLifeRhythm(weeklyMeals, weekDays, mealTypes);
  const lifeRhythmAfter = optimizeWeeklyLifeRhythm(next, weekDays, mealTypes);
  const optTone: 'positive' | 'warning' = afterOpt >= beforeOpt ? 'positive' : 'warning';
  const rhythmMessages: string[] = [];
  if (lifeRhythmAfter.freshnessFlow.fragileLateWeek < lifeRhythmBefore.freshnessFlow.fragileLateWeek) rhythmMessages.push('Fragile produce usage shifted earlier to reduce waste.');
  if (lifeRhythmAfter.prepTiming.quickDays >= lifeRhythmBefore.prepTiming.quickDays) rhythmMessages.push('Prep-heavy dinners redistributed away from busy evenings.');
  if (lifeRhythmAfter.signals.energyFlow.prepHeavyDinners <= lifeRhythmBefore.signals.energyFlow.prepHeavyDinners) rhythmMessages.push('Recovery-friendly spacing improved after higher-complexity days.');

  return {
    mode,
    changes,
    beforeScores,
    afterScores,
    suggestions: [
      { id: 'autofill', tone: 'neutral', category: 'core', message: `Auto-filled ${changes.length} meal slots via contextual weekly optimization.` },
      { id: 'opt-score', tone: optTone, category: 'core', message: `Weekly optimization score ${beforeOpt} → ${afterOpt} after evaluating ${evaluatedWeeks} candidate week arrangements.` },
      ...contextual.map((message, idx) => ({ id: `ctx-${idx}`, tone: 'neutral' as const, category: 'core' as const, message })),
      ...tradeoffNotes.map((message, idx) => ({ id: `tradeoff-${idx}`, tone: 'neutral' as const, category: 'core' as const, message })),
      ...rhythmMessages.map((message, idx) => ({ id: `rhythm-${idx}`, tone: 'neutral' as const, category: 'lifestyle' as const, message })),
    ],
    lifestyleContext: {
      dayRhythm: lifeRhythmAfter.signals.energyFlow.daily.map((entry) => ({
        day: entry.day,
        energyLoad: entry.load.lifestyleLoad,
        energyLevel: entry.energyLevel,
        prepWindowType: lifeRhythmAfter.signals.prepWindows.find((window) => window.day === entry.day)?.prepWindowType || 'standard',
      })),
      freshnessPriority: {
        fragileEarlyWeek: lifeRhythmAfter.freshnessFlow.fragileEarlyWeek,
        fragileLateWeek: lifeRhythmAfter.freshnessFlow.fragileLateWeek,
      },
      prepWindowType: lifeRhythmAfter.prepTiming.recommended,
      energyLoad: Math.round(lifeRhythmAfter.signals.energyFlow.daily.reduce((sum, day) => sum + day.load.lifestyleLoad, 0) / Math.max(1, lifeRhythmAfter.signals.energyFlow.daily.length)),
    },
  };
};

export const optimizeWeeklyPlan = generateAdaptiveMealPlan;
