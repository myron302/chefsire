import { deriveSlotContext } from './autoPlannerContextAnalysis';
import { calculateMealSlotCompatibility, rankMealForSpecificSlot } from './autoPlannerMealCompatibility';
import type { AutoPlannerMode } from './autoPlannerTypes';
import { generateRelationshipDrivenCandidates } from '../meal-relationships/relationshipDrivenPlanning';

export type PlannerState = Record<string, any>;
export type PlannerSlot = { day: string; mealType: string };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const getSlotMeals = (weeklyMeals: PlannerState, day: string, mealType: string): any[] => {
  const value = weeklyMeals?.[day]?.[mealType];
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
};

const setSlotMeal = (weeklyMeals: PlannerState, slot: PlannerSlot, meal: any) => {
  const next = clone(weeklyMeals);
  next[slot.day] = { ...(next[slot.day] || {}), [slot.mealType]: [meal] };
  return next;
};

const getOpenSlots = (weeklyMeals: PlannerState, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const slots: PlannerSlot[] = [];
  weekDays.forEach((day) => mealTypes.forEach((mealType) => {
    if (getSlotMeals(weeklyMeals, day, mealType).length === 0) slots.push({ day, mealType });
  }));
  return slots;
};

export const generateMealSwapCandidates = (weeklyMeals: PlannerState, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const candidates: Array<{ a: PlannerSlot; b: PlannerSlot; type: 'swap' }> = [];
  weekDays.forEach((day) => mealTypes.forEach((mealType, idx) => {
    const from = { day, mealType };
    const fromMeals = getSlotMeals(weeklyMeals, from.day, from.mealType);
    if (!fromMeals.length) return;
    mealTypes.slice(idx + 1).forEach((otherType) => {
      const to = { day, mealType: otherType };
      const toMeals = getSlotMeals(weeklyMeals, to.day, to.mealType);
      if (!toMeals.length) return;
      candidates.push({ a: from, b: to, type: 'swap' });
    });
  }));
  return candidates;
};

export const evaluateMealRotation = (weeklyMeals: PlannerState, slots: PlannerSlot[]) => {
  if (slots.length < 2) return weeklyMeals;
  const next = clone(weeklyMeals);
  const meals = slots.map((slot) => getSlotMeals(next, slot.day, slot.mealType)[0]).filter(Boolean);
  if (meals.length !== slots.length) return weeklyMeals;
  slots.forEach((slot, index) => {
    next[slot.day] = { ...(next[slot.day] || {}), [slot.mealType]: [meals[(index + 1) % meals.length]] };
  });
  return next;
};

export const optimizeMealPlacement = (weeklyMeals: PlannerState, pool: any[], weekDays: readonly string[], mealTypes: readonly string[], mode: AutoPlannerMode, baseScoreMeal: (meal: any) => number) => {
  let next = clone(weeklyMeals);
  const placementNotes: string[] = [];
  const openSlots = getOpenSlots(next, weekDays, mealTypes);

  openSlots.forEach((slot) => {
    const dayIndex = Math.max(0, weekDays.indexOf(slot.day));
    const context = deriveSlotContext(slot.day, slot.mealType, dayIndex, weekDays.length, mode);
    const relationshipCandidates = generateRelationshipDrivenCandidates(pool, next);
    const ranked = rankMealForSpecificSlot(relationshipCandidates, context, baseScoreMeal).slice(0, 3);
    if (!ranked.length) return;
    const best = ranked.sort((a, b) => calculateMealSlotCompatibility(b, context) - calculateMealSlotCompatibility(a, context))[0];
    next = setSlotMeal(next, slot, best);
    const compatibility = calculateMealSlotCompatibility(best, context);
    placementNotes.push(`Placed ${best?.name || slot.mealType} on ${slot.day} ${slot.mealType} (compatibility ${compatibility}).`);
  });

  return { next, placementNotes };
};

export const generateCandidateWeeks = (weeklyMeals: PlannerState, pool: any[], weekDays: readonly string[], mealTypes: readonly string[], mode: AutoPlannerMode, baseScoreMeal: (meal: any) => number) => {
  const initial = optimizeMealPlacement(weeklyMeals, pool, weekDays, mealTypes, mode, baseScoreMeal).next;
  const candidates: PlannerState[] = [initial];

  const swaps = generateMealSwapCandidates(initial, weekDays, mealTypes).slice(0, 6);
  swaps.forEach((swap) => {
    const aMeal = getSlotMeals(initial, swap.a.day, swap.a.mealType)[0];
    const bMeal = getSlotMeals(initial, swap.b.day, swap.b.mealType)[0];
    if (!aMeal || !bMeal) return;
    let next = setSlotMeal(initial, swap.a, bMeal);
    next = setSlotMeal(next, swap.b, aMeal);
    candidates.push(next);
  });

  const dinnerRotationSlots = weekDays.slice(0, 3).map((day) => ({ day, mealType: 'dinner' }));
  candidates.push(evaluateMealRotation(initial, dinnerRotationSlots));

  return candidates;
};

export const simulateWeeklyArrangement = (weeklyMeals: PlannerState, pool: any[], weekDays: readonly string[], mealTypes: readonly string[], mode: AutoPlannerMode, baseScoreMeal: (meal: any) => number) => {
  return generateCandidateWeeks(weeklyMeals, pool, weekDays, mealTypes, mode, baseScoreMeal);
};
