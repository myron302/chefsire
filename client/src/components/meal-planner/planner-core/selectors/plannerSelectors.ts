import { getAllPlannerMeals } from '@/components/meal-planner/planner-core/traversal/plannerTraversal';

type PlannerMeal = { id?: string };

export const selectPlannerMeals = (
  weeklyMeals: Record<string, any> | PlannerMeal[] | null | undefined,
  weekDays: readonly string[],
  mealTypes: readonly string[],
): PlannerMeal[] => {
  if (Array.isArray(weeklyMeals)) return weeklyMeals;
  if (!weeklyMeals || typeof weeklyMeals !== 'object') return [];
  return getAllPlannerMeals<PlannerMeal>(weeklyMeals, weekDays, mealTypes).map((entry) => entry.meal);
};

export const selectPlannerMealCount = (
  weeklyMeals: Record<string, any> | PlannerMeal[] | null | undefined,
  weekDays: readonly string[],
  mealTypes: readonly string[],
): number => selectPlannerMeals(weeklyMeals, weekDays, mealTypes).length;
