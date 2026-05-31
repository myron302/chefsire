import { useMemo } from 'react';
import { buildPlannerReadinessViewModel } from '@/components/meal-planner/view-models';

type UsePlannerReadinessInput = Omit<
  Parameters<typeof buildPlannerReadinessViewModel>[0],
  'weekDays' | 'mealTypes'
> & {
  weekDays: readonly string[];
  mealTypes: readonly string[];
};

export const usePlannerReadiness = ({
  weeklyMeals,
  weekDays,
  mealTypes,
  groceryList,
  plannerGroceryState,
  prepSession,
  savingsReport,
}: UsePlannerReadinessInput) =>
  useMemo(
    () =>
      buildPlannerReadinessViewModel({
        weeklyMeals,
        weekDays: weekDays as string[],
        mealTypes: mealTypes as string[],
        groceryList,
        plannerGroceryState,
        prepSession,
        savingsReport,
      }),
    [
      groceryList,
      mealTypes,
      plannerGroceryState,
      prepSession,
      savingsReport,
      weekDays,
      weeklyMeals,
    ],
  );
