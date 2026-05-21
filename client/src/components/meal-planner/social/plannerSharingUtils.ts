import { WEEK_DAYS, MEAL_TYPES, getMealNutritionTotals } from '@/components/meal-planner/nutritionMealPlannerUtils';
import { iterateWeeklyMeals } from '@/components/meal-planner/planner-graph/plannerIteration';

export type PlannerShareMetadata = {
  visibility: 'private' | 'friends' | 'public';
  sharedBy: string;
  shareDescription: string;
  tags: string[];
  nutritionFocus: string;
  prepStyle: string;
  generatedByAIPlanner: boolean;
};

export const createShareablePlanSnapshot = (weeklyMeals: Record<string, any>, metadata: PlannerShareMetadata) => {
  let meals = 0;
  let calories = 0;
  let protein = 0;
  iterateWeeklyMeals(weeklyMeals, WEEK_DAYS, MEAL_TYPES, ({ meal }) => {
    meals += 1;
    const totals = getMealNutritionTotals(meal);
    calories += totals.calories;
    protein += totals.protein;
  });

  return {
    id: `planner-share-${Date.now()}`,
    createdAt: new Date().toISOString(),
    metadata,
    totals: { meals, calories: Math.round(calories), protein: Math.round(protein) },
    weeklyMeals,
  };
};

export const generatePlannerShareSummary = (snapshot: ReturnType<typeof createShareablePlanSnapshot>) => (
  `${snapshot.metadata.sharedBy} shared a ${snapshot.metadata.visibility} nutrition week\n` +
  `${snapshot.totals.meals} planned meals • ${snapshot.totals.calories} kcal • ${snapshot.totals.protein}g protein\n` +
  `Focus: ${snapshot.metadata.nutritionFocus} | Prep: ${snapshot.metadata.prepStyle}\n` +
  `Tags: ${snapshot.metadata.tags.join(', ') || 'No tags yet'}\n` +
  `${snapshot.metadata.shareDescription}`
);
