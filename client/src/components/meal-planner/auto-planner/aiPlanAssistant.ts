import { getMealsForSlot } from '../planner-graph/plannerGraphUtils';
import { generateAdaptiveMealPlan } from './autoPlannerEngine';
import type { AutoPlannerMode, AutoPlannerPriorities } from './autoPlannerTypes';

export type PlannerAssistantOperation = {
  id: string;
  type: 'add' | 'replace';
  targetDay: string;
  targetMealSlot: string;
  currentMealId?: string;
  proposedMeal: any;
  reason: string;
  scoringFactors: string[];
  expectedNutritionDelta: { calories: number; protein: number };
  expectedPrepDelta: number;
  expectedPantryImpact: string;
  confidence: 'high' | 'medium';
  constraintValidation: { valid: boolean; message: string };
};

export type PlannerCommand = { mode: AutoPlannerMode; fillEmptyOnly: boolean; target?: { day: string; mealType: string }; unsupported?: string };

const dayNames: Record<string, string> = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };

/** Deterministic, intentionally small command grammar. Unknown requests are never treated as successful. */
export function parsePlannerCommand(value: string): PlannerCommand {
  const text = value.trim().toLowerCase();
  if (!text) return { mode: 'balanced', fillEmptyOnly: true, unsupported: 'Enter a planning request.' };
  const day = Object.entries(dayNames).find(([name]) => text.includes(name));
  const mealType = ['breakfast', 'lunch', 'dinner', 'snack'].find((slot) => text.includes(slot));
  const target = day && mealType ? { day: day[1], mealType } : undefined;
  const mode: AutoPlannerMode = text.includes('protein') ? 'high-protein'
    : text.includes('lower carb') || text.includes('low carb') ? 'balanced'
    : text.includes('cost') || text.includes('budget') ? 'budget-friendly'
    : text.includes('faster') || text.includes('prep') || text.includes('30 minute') ? 'minimal-prep'
    : text.includes('pantry') ? 'pantry-reuse'
    : text.includes('variety') || text.includes('chicken') ? 'variety-focused'
    : 'balanced';
  const supported = /build|fill|replace|lower carb|chicken|pantry|cost|variety|prep|protein|vegetarian/.test(text);
  return { mode, fillEmptyOnly: /empty|fill only/.test(text) || !target, target, unsupported: supported ? undefined : 'I can only create a structured plan, fill empty slots, or optimize a specific meal with recipes already in ChefSire.' };
}

export function buildAssistantOperations(input: { weeklyMeals: Record<string, any>; weekDays: readonly string[]; mealTypes: readonly string[]; proteinGoal: number; mode: AutoPlannerMode; priorities: AutoPlannerPriorities; fillEmptyOnly: boolean; target?: { day: string; mealType: string } }): PlannerAssistantOperation[] {
  const result = generateAdaptiveMealPlan(input.weeklyMeals, input.weekDays, input.mealTypes, input.proteinGoal, input.mode, { ...input.priorities, fillEmptyOnly: input.fillEmptyOnly });
  const operations = result.changes.map((change: any, index: number): PlannerAssistantOperation => {
    const current = getMealsForSlot(input.weeklyMeals, change.slot.day, change.slot.mealType)[0];
    return ({
    id: `${change.slot.day}-${change.slot.mealType}-${index}`,
    type: getMealsForSlot(input.weeklyMeals, change.slot.day, change.slot.mealType).length ? 'replace' : 'add',
    targetDay: change.slot.day,
    targetMealSlot: change.slot.mealType,
    currentMealId: current?.entryId,
    proposedMeal: change.meal,
    reason: change.reason,
    scoringFactors: [input.mode, input.priorities.pantryReusePriority > 1 ? 'pantry' : 'nutrition'],
    expectedNutritionDelta: { calories: Number(change.meal?.calories || 0), protein: Number(change.meal?.protein || 0) },
    expectedPrepDelta: Number(change.meal?.mealItems?.length || 0),
    expectedPantryImpact: change.meal?.source === 'pantry' ? 'Uses a pantry-compatible meal.' : 'No verified pantry match is available for this meal.',
    confidence: 'medium',
    constraintValidation: { valid: Boolean(change.meal?.name), message: change.meal?.name ? 'Meal is resolved from the current ChefSire planner data.' : 'No resolvable meal was found.' },
    });
  });
  if (input.target) return operations.filter((operation) => operation.targetDay === input.target!.day && operation.targetMealSlot === input.target!.mealType);
  return operations;
}
