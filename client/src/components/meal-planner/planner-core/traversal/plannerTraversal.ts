import { calculateMealComplexity as baseCalculateMealComplexity } from '../../planner-graph/plannerComplexity';
import { getAllPlannerMeals, getMealsForDay, getMealsForSlot } from '../../planner-graph/plannerGraphUtils';
import { iteratePlannerSlots, iterateWeeklyMeals } from '../../planner-graph/plannerIteration';
import { extractMealIngredients, extractMealProteins } from '../../planner-graph/plannerMealExtraction';
import { normalizePlannerMeal } from '../../planner-graph/plannerNormalization';
import type { PlannerMeal, PlannerMealRef, PlannerSlotRef, WeeklyMeals } from '../../planner-graph/plannerTypes';

export {
  getMealsForDay,
  getMealsForSlot,
  getAllPlannerMeals,
  iterateWeeklyMeals,
  iteratePlannerSlots,
  extractMealIngredients,
  extractMealProteins,
  normalizePlannerMeal,
};

export const calculateMealComplexity = (meal: any): number => baseCalculateMealComplexity(meal);

export const getUniqueMeals = <T extends PlannerMeal>(
  weeklyMeals: WeeklyMeals | null | undefined,
  weekDays: readonly string[],
  mealTypes: readonly string[],
): T[] => {
  const seen = new Set<string>();
  const unique: T[] = [];

  getAllPlannerMeals<T>(weeklyMeals, weekDays, mealTypes).forEach(({ meal, day, mealType, index }) => {
    const key = String(
      meal?.entryId
      || meal?.plannerGeneratedId
      || meal?.id
      || meal?.name
      || meal?.title
      || `${day}-${mealType}-${index}`,
    ).trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(meal as T);
  });

  return unique;
};

export const getPlannerMealIds = (
  weeklyMeals: WeeklyMeals | null | undefined,
  weekDays: readonly string[],
  mealTypes: readonly string[],
): string[] => {
  const ids = new Set<string>();

  getAllPlannerMeals(weeklyMeals, weekDays, mealTypes).forEach(({ meal, day, mealType, index }: PlannerMealRef) => {
    const id = String(
      meal?.entryId
      || meal?.plannerGeneratedId
      || meal?.id
      || `${day}-${mealType}-${index}`,
    ).trim();
    if (id) ids.add(id);
  });

  return [...ids];
};

export type { PlannerMeal, PlannerMealRef, PlannerSlotRef, WeeklyMeals };
