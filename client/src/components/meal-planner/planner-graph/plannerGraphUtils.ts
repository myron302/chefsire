import { normalizePlannerSlot, normalizeWeeklyMeals } from './plannerNormalization';
import type { PlannerMeal, PlannerMealRef, PlannerSlotRef, WeeklyMeals } from './plannerTypes';

export const getMealsForDay = <T extends PlannerMeal>(weeklyMeals: WeeklyMeals | null | undefined, day: string): PlannerSlotRef[] => {
  const normalized = normalizeWeeklyMeals(weeklyMeals);
  const dayMeals = normalized?.[day] || {};
  return Object.entries(dayMeals).map(([mealType, slotValue]) => ({
    day,
    mealType,
    meals: normalizePlannerSlot<T>(slotValue),
  }));
};

export const getMealsForSlot = <T extends PlannerMeal>(weeklyMeals: WeeklyMeals | null | undefined, day: string, mealType: string): T[] => (
  normalizePlannerSlot<T>(normalizeWeeklyMeals(weeklyMeals)?.[day]?.[mealType])
);

export const getAllPlannerMeals = <T extends PlannerMeal>(
  weeklyMeals: WeeklyMeals | null | undefined,
  weekDays: readonly string[],
  mealTypes: readonly string[],
): PlannerMealRef[] => {
  const normalized = normalizeWeeklyMeals(weeklyMeals);
  const refs: PlannerMealRef[] = [];
  weekDays.forEach((day) => {
    mealTypes.forEach((mealType) => {
      getMealsForSlot<T>(normalized, day, mealType).forEach((meal, index) => {
        refs.push({ day, mealType, index, meal });
      });
    });
  });
  return refs;
};
