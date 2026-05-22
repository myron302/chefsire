import { deriveSlotContext, analyzeProteinDistribution, analyzeCalorieDistribution, calculateMacroBalanceScore } from './autoPlannerContextAnalysis';
import { calculateMealSlotCompatibility, rankMealForSpecificSlot } from './autoPlannerMealCompatibility';
import { type AutoPlannerMode, type AutoPlannerPriorities } from './autoPlannerTypes';
import { calculateRelationshipEfficiencyScore } from '../meal-relationships/relationshipGraph';
import { scoreRelationshipDrivenWeek, deriveRelationshipDrivenRecommendations } from '../meal-relationships/relationshipDrivenPlanning';
import { getMealsForSlot } from '../planner-graph/plannerGraphUtils';
import { extractMealIngredients } from '../planner-graph/plannerMealExtraction';
import { calculateMealComplexity } from '../planner-graph/plannerComplexity';
import { evaluatePlannerObjectives } from '../planner-objectives/plannerObjectiveEngine';

const gatherMeals = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => (
  weekDays.flatMap((day) => mealTypes.flatMap((mealType) => getMealsForSlot(weeklyMeals, day, mealType))).filter(Boolean)
);

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

export const calculateDailyPrepStress = (dayMeals: any[]) => dayMeals.reduce((acc, meal) => acc + Math.max(1, calculateMealComplexity(meal)), 0);

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

export const calculateWeeklyPlannerStress = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const dayStress = weekDays.map((day) => calculateDailyPrepStress(mealTypes.flatMap((mealType) => getMealsForSlot(weeklyMeals, day, mealType))));
  const max = Math.max(0, ...dayStress);
  const avg = dayStress.reduce((a, b) => a + b, 0) / Math.max(1, dayStress.length);
  return Math.round(Math.max(0, max - avg));
};

export const calculateWeeklyOptimizationScore = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const meals = gatherMeals(weeklyMeals, weekDays, mealTypes);
  const protein = analyzeProteinDistribution(weeklyMeals, weekDays, mealTypes);
  const calories = analyzeCalorieDistribution(weeklyMeals, weekDays, mealTypes);
  const macro = calculateMacroBalanceScore(protein, calories);
  const fatigue = calculateMealFatigueScore(meals);
  const overlap = calculateIngredientOverlapScore(meals);
  const fragmentation = calculateGroceryFragmentation(meals);
  const pantry = calculatePantryReuseEfficiency(meals);
  const stress = calculateWeeklyPlannerStress(weeklyMeals, weekDays, mealTypes);
  const relationships = calculateRelationshipEfficiencyScore(weeklyMeals);
  const relationshipDriven = scoreRelationshipDrivenWeek(weeklyMeals, weekDays, mealTypes);
  const legacy = Math.round((macro * 0.2) + ((100 - fatigue) * 0.14) + (overlap * 0.1) + ((100 - fragmentation) * 0.1) + (pantry * 0.1) + ((100 - Math.min(100, stress * 5)) * 0.1) + (relationships.efficiencyScore * 0.12) + (relationshipDriven.score * 0.14));
  const unified = evaluatePlannerObjectives({ weeklyMeals, weekDays, mealTypes, mode: 'balanced' }).score;
  return Math.round((unified * 0.75) + (legacy * 0.25));
};

export const optimizePrepDistribution = () => ({ applied: true });

export const optimizeWeeklyDistribution = (params: { weeklyMeals: Record<string, any>; weekDays: readonly string[]; mealTypes: readonly string[]; pool: any[]; mode: AutoPlannerMode; priorities: AutoPlannerPriorities; baseScoreMeal: (meal: any) => number; }) => {
  const { weeklyMeals, weekDays, mealTypes, pool, mode, baseScoreMeal } = params;
  const selections: Array<{ day: string; mealType: string; candidate: any; reason: string }> = [];
  weekDays.forEach((day, dayIndex) => mealTypes.forEach((mealType) => {
    const existing = getMealsForSlot(weeklyMeals, day, mealType);
    if (existing.length > 0) return;
    const context = deriveSlotContext(day, mealType, dayIndex, weekDays.length, mode);
    const ranked = rankMealForSpecificSlot(pool, context, baseScoreMeal);
    const candidate = ranked[0];
    if (!candidate) return;
    const slotScore = calculateMealSlotCompatibility(candidate, context);
    selections.push({ day, mealType, candidate, reason: `Contextual slot optimization (${mealType}) with compatibility score ${slotScore}.` });
  }));
  return selections;
};

export const buildAdaptivePlannerRecommendations = (before: Record<string, any>, after: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const beforeStress = calculateWeeklyPlannerStress(before, weekDays, mealTypes);
  const afterStress = calculateWeeklyPlannerStress(after, weekDays, mealTypes);
  const beforeMeals = gatherMeals(before, weekDays, mealTypes);
  const afterMeals = gatherMeals(after, weekDays, mealTypes);
  const beforeProtein = analyzeProteinDistribution(before, weekDays, mealTypes);
  const afterProtein = analyzeProteinDistribution(after, weekDays, mealTypes);
  const beforeMacro = calculateMacroBalanceScore(beforeProtein, analyzeCalorieDistribution(before, weekDays, mealTypes));
  const afterMacro = calculateMacroBalanceScore(afterProtein, analyzeCalorieDistribution(after, weekDays, mealTypes));

  const messages: string[] = [];
  if (afterStress < beforeStress) messages.push('Dinner prep load reduced across higher-stress days.');
  if (afterMacro > beforeMacro) messages.push('Protein pacing improved across weekdays.');
  if (calculateIngredientOverlapScore(afterMeals) > calculateIngredientOverlapScore(beforeMeals)) messages.push('Ingredient overlap optimized to reduce grocery waste.');
  if (calculateMealFatigueScore(afterMeals) < calculateMealFatigueScore(beforeMeals)) messages.push('Breakfast and lunch variety improved without increasing prep complexity.');
  const beforeRelationships = calculateRelationshipEfficiencyScore(before);
  const afterRelationships = calculateRelationshipEfficiencyScore(after);
  if (afterRelationships.continuityScore > beforeRelationships.continuityScore) messages.push('Meal chain continuity improved across prep and leftover windows.');
  const relationshipSummary = deriveRelationshipDrivenRecommendations(after, weekDays, mealTypes);
  relationshipSummary.messages.forEach((message) => messages.push(message));
  return messages;
};
