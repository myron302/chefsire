type PlannerMeal = { id?: string };

export const selectPlannerMeals = (weeklyMeals: PlannerMeal[] | null | undefined): PlannerMeal[] =>
  Array.isArray(weeklyMeals) ? weeklyMeals : [];

export const selectPlannerMealCount = (weeklyMeals: PlannerMeal[] | null | undefined): number =>
  selectPlannerMeals(weeklyMeals).length;
