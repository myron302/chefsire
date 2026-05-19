import { type PlannerSlotContext } from './autoPlannerContextAnalysis';

const mealComplexity = (meal: any) => Number(meal?.mealItems?.length || meal?.ingredients?.length || 0);
const mealProtein = (meal: any) => Number(meal?.protein || 0);
const mealCalories = (meal: any) => Number(meal?.calories || meal?.kcal || 0);

export const calculateMealSlotCompatibility = (meal: any, context: PlannerSlotContext) => {
  const type = context.mealType;
  const complexity = mealComplexity(meal);
  const protein = mealProtein(meal);
  const calories = mealCalories(meal);
  const mealName = String(meal?.name || '').toLowerCase();

  let score = 50;
  if (type.includes('breakfast')) {
    if (complexity <= 5) score += 14;
    if (protein >= 15) score += 10;
    if (calories > 0 && calories < 700) score += 6;
    if (mealName.includes('stew') || mealName.includes('roast')) score -= 12;
  }
  if (type.includes('lunch')) {
    if (complexity <= 7) score += 8;
    if (context.isLateWeek && (meal?.batchFriendly || meal?.isLeftoverFriendly)) score += 10;
  }
  if (type.includes('dinner')) {
    if (complexity >= 4) score += 8;
    if (meal?.batchFriendly || meal?.isRecoveryFriendly) score += 10;
  }
  if (type.includes('snack')) {
    if (calories > 0 && calories < 400) score += 12;
    if (complexity <= 3) score += 8;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const rankMealForSpecificSlot = (pool: any[], context: PlannerSlotContext, scoreMeal: (meal: any) => number) => {
  return [...pool].sort((a, b) => (scoreMeal(b) + calculateMealSlotCompatibility(b, context)) - (scoreMeal(a) + calculateMealSlotCompatibility(a, context)));
};
