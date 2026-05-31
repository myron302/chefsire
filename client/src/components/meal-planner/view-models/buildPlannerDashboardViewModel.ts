export const buildPlannerDashboardViewModel = ({
  caloriesCurrent,
  proteinCurrent,
  carbsCurrent,
  fatCurrent,
  calorieGoal,
  macroGoals,
  shareVisibility,
  weekRange,
  weekAnchor,
  sharePublicToken,
  origin,
  plannedSlots,
  totalSlots,
  weeklyMealsCount,
  weekReadyNow,
  groceryCompletedCount,
  groceryBuyItemCount,
  prepProgress,
  prepTasksCompletedCount,
  prepTasksCount,
  prepActiveBlockersCount,
  avgCalories,
  avgProtein,
  proteinGoalHitDays,
  calorieGoalHitDays,
  water,
  hydrationPct,
  latestBodyMetric,
  bodyWeightDelta,
}: {
  caloriesCurrent: number;
  proteinCurrent: number;
  carbsCurrent: number;
  fatCurrent: number;
  calorieGoal: number;
  macroGoals: { protein: number; carbs: number; fat: number };
  shareVisibility: 'private' | 'friends' | 'public';
  weekRange?: { weekStart?: string; weekEnd?: string } | null;
  weekAnchor: string;
  sharePublicToken?: string;
  origin: string;
  plannedSlots: number;
  totalSlots: number;
  weeklyMealsCount: number;
  weekReadyNow: boolean;
  groceryCompletedCount: number;
  groceryBuyItemCount: number;
  prepProgress: number;
  prepTasksCompletedCount: number;
  prepTasksCount: number;
  prepActiveBlockersCount: number;
  avgCalories: number;
  avgProtein: number;
  proteinGoalHitDays: number;
  calorieGoalHitDays: number;
  water: { glassesLogged: number; dailyTarget: number };
  hydrationPct: number;
  latestBodyMetric: unknown;
  bodyWeightDelta: number;
}) => {
  const calorieProgress = Math.min(100, Math.round((caloriesCurrent / calorieGoal) * 100));
  const remainingCalories = Math.max(0, calorieGoal - caloriesCurrent);
  const visibilitySummaryLabel = shareVisibility === 'private'
    ? 'Private (only you)'
    : shareVisibility === 'friends'
      ? 'Friends'
      : 'Public';
  const weekLabel = weekRange?.weekStart && weekRange?.weekEnd
    ? `${weekRange.weekStart} to ${weekRange.weekEnd}`
    : `${weekAnchor} week`;
  const publicShareUrl = sharePublicToken ? `${origin}/meal-planner/shared/${sharePublicToken}` : '';

  const weeklyShareSummaryText = [
    `Chefsire Meal Plan • Week of ${weekLabel}`,
    `Visibility: ${visibilitySummaryLabel}`,
    '',
    `Planning coverage: ${plannedSlots}/${totalSlots} meal slots planned (${Math.round((plannedSlots / Math.max(1, totalSlots)) * 100)}%)`,
    `Meals planned: ${weeklyMealsCount}`,
    `Readiness: ${weekReadyNow ? 'Week ready ✅' : 'In progress'}`,
    `Grocery progress: ${groceryCompletedCount}/${Math.max(1, groceryBuyItemCount)} purchased`,
    `Prep progress: ${prepProgress}% (${prepTasksCompletedCount}/${prepTasksCount} tasks complete)`,
    `Prep blockers: ${prepActiveBlockersCount}`,
    '',
    'Nutrition highlights:',
    `• Avg calories/day: ${avgCalories} (goal: ${calorieGoal})`,
    `• Avg protein/day: ${avgProtein}g (goal: ${macroGoals.protein || 150}g)`,
    `• Protein goal hit days: ${proteinGoalHitDays}/7`,
    `• Hydration today: ${water.glassesLogged}/${water.dailyTarget} glasses (${hydrationPct}%)`,
  ].join('\n');

  const computedInsightSummaries = [
    {
      kind: 'calories',
      title: calorieGoalHitDays > 0 ? `${calorieGoalHitDays} balanced day${calorieGoalHitDays === 1 ? '' : 's'}` : 'Calorie pacing in progress',
      description: calorieGoalHitDays > 0
        ? `You stayed within ±10% of your ${calorieGoal} kcal target on ${calorieGoalHitDays}/7 days.`
        : `Average intake is ${avgCalories || 0} kcal. Keep logging meals to dial in your weekly target.`,
      trend: calorieGoalHitDays >= 4 ? 'positive' : 'neutral',
    },
    {
      kind: 'protein',
      title: proteinGoalHitDays > 0 ? `Protein target hit ${proteinGoalHitDays}/7 days` : 'Protein target opportunity',
      description: proteinGoalHitDays > 0
        ? `You're averaging ${avgProtein}g protein/day against a ${macroGoals.protein}g goal.`
        : `Average protein is ${avgProtein}g/day. Add lean protein to breakfast or snacks for an easier boost.`,
      trend: proteinGoalHitDays >= 4 ? 'positive' : 'neutral',
    },
    {
      kind: 'hydration',
      title: hydrationPct >= 100 ? 'Hydration goal complete' : `${water.glassesLogged}/${water.dailyTarget} glasses today`,
      description: latestBodyMetric
        ? `Hydration is ${hydrationPct}% of target. Body weight trend: ${bodyWeightDelta > 0 ? '+' : ''}${bodyWeightDelta.toFixed(1)} lbs across your log history.`
        : `Hydration is ${hydrationPct}% of target. Add body metrics entries to unlock trend correlations.`,
      trend: hydrationPct >= 80 ? 'positive' : 'neutral',
    },
  ];

  return {
    caloriesCurrent,
    proteinCurrent,
    carbsCurrent,
    fatCurrent,
    calorieProgress,
    remainingCalories,
    visibilitySummaryLabel,
    weekLabel,
    publicShareUrl,
    weeklyShareSummaryText,
    computedInsightSummaries,
  };
};
