import { useMemo } from 'react';
import { buildPlannerAnalyticsViewModel } from '@/components/meal-planner/view-models';

type UsePlannerAnalyticsInput = Omit<
  Parameters<typeof buildPlannerAnalyticsViewModel>[0],
  'weekDays' | 'mealTypes'
> & {
  weekDays: readonly string[];
  mealTypes: readonly string[];
};

export const usePlannerAnalytics = ({
  weeklyMeals,
  weekDays,
  mealTypes,
  calorieGoal,
  macroGoals,
  hydrationPct,
  bodyMetricSummary,
}: UsePlannerAnalyticsInput) =>
  useMemo(
    () =>
      buildPlannerAnalyticsViewModel({
        weeklyMeals,
        weekDays: weekDays as string[],
        mealTypes: mealTypes as string[],
        calorieGoal,
        macroGoals,
        hydrationPct,
        bodyMetricSummary,
      }),
    [
      bodyMetricSummary,
      calorieGoal,
      hydrationPct,
      macroGoals,
      mealTypes,
      weekDays,
      weeklyMeals,
    ],
  );
