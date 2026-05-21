import type { PlannerMeal, PlannerSlotValue, WeeklyMeals } from './plannerTypes';

export const normalizePlannerMeal = <T extends PlannerMeal>(meal: T | null | undefined): T | null => (meal ? meal : null);

export const normalizePlannerSlot = <T = PlannerMeal>(slot: PlannerSlotValue): T[] => {
  if (!slot) return [];
  const items = Array.isArray(slot) ? slot : [slot];
  return items.filter(Boolean) as T[];
};

export const normalizeWeeklyMeals = (weeklyMeals: WeeklyMeals | null | undefined): WeeklyMeals => (
  weeklyMeals && typeof weeklyMeals === 'object' ? weeklyMeals : {}
);
