import { getMealsForSlot } from './plannerGraphUtils';
import { normalizeWeeklyMeals } from './plannerNormalization';
import type { PlannerMeal, PlannerMealRef, WeeklyMeals } from './plannerTypes';

export const iteratePlannerDays = (weeklyMeals: WeeklyMeals | null | undefined, cb: (day: string, dayMeals: Record<string, any>) => void) => {
  const normalized = normalizeWeeklyMeals(weeklyMeals);
  Object.entries(normalized).forEach(([day, dayMeals]) => cb(day, dayMeals || {}));
};

export const iteratePlannerSlots = (weeklyMeals: WeeklyMeals | null | undefined, cb: (day: string, mealType: string, meals: PlannerMeal[]) => void) => {
  iteratePlannerDays(weeklyMeals, (day, dayMeals) => {
    Object.keys(dayMeals || {}).forEach((mealType) => cb(day, mealType, getMealsForSlot(weeklyMeals, day, mealType)));
  });
};

export const iterateWeeklyMeals = <T extends PlannerMeal>(weeklyMeals: WeeklyMeals | null | undefined, weekDays: readonly string[], mealTypes: readonly string[], cb: (ref: PlannerMealRef) => void) => {
  weekDays.forEach((day) => mealTypes.forEach((mealType) => getMealsForSlot<T>(weeklyMeals, day, mealType).forEach((meal, index) => cb({ day, mealType, meal, index }))));
};

export const mapWeeklyMeals = <T extends PlannerMeal, R>(weeklyMeals: WeeklyMeals | null | undefined, weekDays: readonly string[], mealTypes: readonly string[], mapper: (ref: PlannerMealRef) => R): R[] => {
  const out: R[] = [];
  iterateWeeklyMeals<T>(weeklyMeals, weekDays, mealTypes, (ref) => out.push(mapper(ref)));
  return out;
};

export const filterWeeklyMeals = <T extends PlannerMeal>(weeklyMeals: WeeklyMeals | null | undefined, weekDays: readonly string[], mealTypes: readonly string[], predicate: (ref: PlannerMealRef) => boolean): PlannerMealRef[] => {
  const out: PlannerMealRef[] = [];
  iterateWeeklyMeals<T>(weeklyMeals, weekDays, mealTypes, (ref) => { if (predicate(ref)) out.push(ref); });
  return out;
};

export const flattenPlannerMeals = <T extends PlannerMeal>(weeklyMeals: WeeklyMeals | null | undefined, weekDays: readonly string[], mealTypes: readonly string[]): PlannerMealRef[] => mapWeeklyMeals<T, PlannerMealRef>(weeklyMeals, weekDays, mealTypes, (ref) => ref);
