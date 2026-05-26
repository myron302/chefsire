import { getAllPlannerMeals } from '../traversal/plannerTraversal';
import type { PlannerMealRef, WeeklyMeals } from '../traversal/plannerTraversal';

const isPlannerMealRefArray = (value: unknown): value is PlannerMealRef[] => (
  Array.isArray(value) && value.every((entry) => !!entry && typeof entry === 'object' && 'meal' in entry && 'day' in entry && 'mealType' in entry)
);

const deriveTraversalAxes = (weeklyMeals: WeeklyMeals | null | undefined): { weekDays: string[]; mealTypes: string[] } => {
  if (!weeklyMeals || typeof weeklyMeals !== 'object' || Array.isArray(weeklyMeals)) {
    return { weekDays: [], mealTypes: [] };
  }

  const weekDays = Object.keys(weeklyMeals).sort();
  const mealTypeSet = new Set<string>();

  weekDays.forEach((day) => {
    const daySlots = weeklyMeals?.[day];
    if (!daySlots || typeof daySlots !== 'object' || Array.isArray(daySlots)) return;
    Object.keys(daySlots).forEach((mealType) => mealTypeSet.add(mealType));
  });

  return { weekDays, mealTypes: [...mealTypeSet].sort() };
};

export const selectPlannerMeals = (weeklyMeals: WeeklyMeals | PlannerMealRef[] | null | undefined): PlannerMealRef[] => {
  if (isPlannerMealRefArray(weeklyMeals)) return weeklyMeals;
  const { weekDays, mealTypes } = deriveTraversalAxes(weeklyMeals as WeeklyMeals | null | undefined);
  return getAllPlannerMeals(weeklyMeals as WeeklyMeals | null | undefined, weekDays, mealTypes);
};

export const selectPlannerMealCount = (weeklyMeals: WeeklyMeals | PlannerMealRef[] | null | undefined): number => (
  selectPlannerMeals(weeklyMeals).length
);
