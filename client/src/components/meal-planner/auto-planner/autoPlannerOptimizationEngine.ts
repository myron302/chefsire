import { deriveSlotContext, analyzeProteinDistribution, analyzeCalorieDistribution, calculateMacroBalanceScore } from './autoPlannerContextAnalysis';
import { calculateMealSlotCompatibility, rankMealForSpecificSlot } from './autoPlannerMealCompatibility';
import { type AutoPlannerMode, type AutoPlannerPriorities } from './autoPlannerTypes';
import { calculateRelationshipEfficiencyScore } from '../meal-relationships/relationshipGraph';
import { scoreRelationshipDrivenWeek, deriveRelationshipDrivenRecommendations } from '../meal-relationships/relationshipDrivenPlanning';
import { getMealsForSlot } from '../planner-graph/plannerGraphUtils';
import { evaluatePlannerObjectives } from '../planner-objectives/plannerObjectiveEngine';
import {
  detectRepeatedProteins,
  detectIngredientOveruse,
  calculateMealFatigueScore,
  calculateDailyPrepStress,
  calculateIngredientOverlapScore,
  calculateGroceryFragmentation,
  calculatePantryReuseEfficiency,
  calculateWeeklyPlannerStress,
} from './autoPlannerMetrics';

export {
  detectRepeatedProteins,
  detectIngredientOveruse,
  calculateMealFatigueScore,
  calculateDailyPrepStress,
  calculateIngredientOverlapScore,
  calculateGroceryFragmentation,
  calculatePantryReuseEfficiency,
  calculateWeeklyPlannerStress,
};

const gatherMeals = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => (
  weekDays.flatMap((day) => mealTypes.flatMap((mealType) => getMealsForSlot(weeklyMeals, day, mealType))).filter(Boolean)
);

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
