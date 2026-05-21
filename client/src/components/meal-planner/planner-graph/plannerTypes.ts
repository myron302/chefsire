export type PlannerMeal = Record<string, any>;
export type PlannerSlotValue = PlannerMeal | PlannerMeal[] | null | undefined;
export type PlannerDayMeals = Record<string, PlannerSlotValue>;
export type WeeklyMeals = Record<string, PlannerDayMeals | undefined>;

export type PlannerMealRef = {
  day: string;
  mealType: string;
  index: number;
  meal: PlannerMeal;
};

export type PlannerSlotRef = {
  day: string;
  mealType: string;
  meals: PlannerMeal[];
};
