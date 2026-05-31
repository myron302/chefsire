import {
  getSlotItems as getMealSlotItems,
  getSlotTotals as getMealSlotTotals,
  calculateTodayNutritionTotals,
} from '@/components/meal-planner/nutritionMealPlannerUtils';

export const buildAnalyticsTabDomain = ({
  weeklyMeals,
  weekDays,
  mealTypes,
  calorieGoal,
  macroGoals,
  hydrationPct,
  bodyMetricSummary,
}: {
  weeklyMeals: any;
  weekDays: string[];
  mealTypes: string[];
  calorieGoal: number;
  macroGoals: { protein: number; carbs: number; fat: number };
  hydrationPct: number;
  bodyMetricSummary: any;
}) => {
  const weeklyNutritionData = weekDays.map((day) => {
    const totals = mealTypes.reduce((acc, type) => {
      const slotTotals = getMealSlotTotals(weeklyMeals, day, type);
      const slotItems = getMealSlotItems(weeklyMeals, day, type);
      return {
        calories: acc.calories + slotTotals.calories,
        protein: acc.protein + slotTotals.protein,
        carbs: acc.carbs + slotTotals.carbs,
        fat: acc.fat + slotTotals.fat,
        mealsLogged: acc.mealsLogged + slotItems.length,
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, mealsLogged: 0 });

    return {
      day,
      shortDay: day.slice(0, 3),
      ...totals,
      calorieGoal,
      proteinGoal: macroGoals.protein,
      hydrationPct,
    };
  });

  const hasWeeklyNutritionData = weeklyNutritionData.some((day) => day.mealsLogged > 0 || day.calories > 0);

  const weeklyNutritionInsights = (() => {
    const missingMealDaysList = weeklyNutritionData.filter((day) => day.mealsLogged === 0);
    const missingMealDays = missingMealDaysList.length;
    const plannedDays = weeklyNutritionData.filter((day) => day.mealsLogged > 0);
    const proteinTrackedDays = plannedDays.filter((day) => day.protein > 0);
    const calorieTrackedDays = plannedDays.filter((day) => day.calories > 0);
    const lowProteinDaysList = proteinTrackedDays.filter((day) => day.protein < 60);
    const lowProteinDays = lowProteinDaysList.length;
    const missingProteinDataDaysList = plannedDays.filter((day) => day.protein <= 0);
    const missingCalorieDataDaysList = plannedDays.filter((day) => day.calories <= 0);

    const caloriesVaryWidely = calorieTrackedDays.length >= 3
      ? (() => {
          const calorieValues = calorieTrackedDays.map((day) => day.calories);
          const minCalories = Math.min(...calorieValues);
          const maxCalories = Math.max(...calorieValues);
          const spread = maxCalories - minCalories;
          const ratio = maxCalories / Math.max(1, minCalories);
          return ratio >= 1.6 || spread >= 800;
        })()
      : false;

    const insights: string[] = [];
    if (missingMealDays > 0) {
      insights.push(`${missingMealDays} day${missingMealDays === 1 ? '' : 's'} have no meals planned.`);
    } else {
      insights.push('Week fully planned.');
    }

    if (proteinTrackedDays.length > 0) {
      if (lowProteinDays > 0) {
        insights.push(`Low protein on ${lowProteinDays} day${lowProteinDays === 1 ? '' : 's'} (<60g).`);
      } else {
        insights.push('Protein coverage looks steady across planned days.');
      }
    } else {
      insights.push('Protein insights unlock as meal protein data is added.');
    }

    if (calorieTrackedDays.length >= 3) {
      if (caloriesVaryWidely) {
        insights.push('Calories vary widely across the week.');
      } else {
        insights.push('Calorie range is fairly consistent this week.');
      }
    } else {
      insights.push('Add calorie details to at least 3 days to compare weekly consistency.');
    }

    const looksBalanced = missingMealDays === 0
      && proteinTrackedDays.length > 0
      && lowProteinDays === 0
      && calorieTrackedDays.length >= 3
      && !caloriesVaryWidely;

    return {
      insights,
      looksBalanced,
      missingMealDaysList,
      lowProteinDaysList,
      missingProteinDataDaysList,
      missingCalorieDataDaysList,
      caloriesVaryWidely,
      canCompareCalories: calorieTrackedDays.length >= 3,
    };
  })();

  const weeklyMacroTotals = weeklyNutritionData.reduce((acc, day) => ({
    protein: acc.protein + day.protein,
    carbs: acc.carbs + day.carbs,
    fat: acc.fat + day.fat,
  }), { protein: 0, carbs: 0, fat: 0 });

  const proteinCals = weeklyMacroTotals.protein * 4;
  const carbCals = weeklyMacroTotals.carbs * 4;
  const fatCals = weeklyMacroTotals.fat * 9;
  const totalMacroCalories = proteinCals + carbCals + fatCals;

  const macroDistributionData = totalMacroCalories > 0 ? [
    { name: 'Protein', grams: weeklyMacroTotals.protein, calories: proteinCals, percent: Math.round((proteinCals / totalMacroCalories) * 100), color: '#3b82f6' },
    { name: 'Carbs', grams: weeklyMacroTotals.carbs, calories: carbCals, percent: Math.round((carbCals / totalMacroCalories) * 100), color: '#22c55e' },
    { name: 'Fat', grams: weeklyMacroTotals.fat, calories: fatCals, percent: Math.round((fatCals / totalMacroCalories) * 100), color: '#f59e0b' },
  ] : [];

  const metricsTrendData = weeklyNutritionData.map((day) => ({
    day: day.shortDay,
    calories: Math.round(day.calories),
    calorieGoal,
    protein: Math.round(day.protein),
    proteinGoal: macroGoals.protein,
  }));

  const weeklyTotals = weeklyNutritionData.reduce((acc, day) => ({
    calories: acc.calories + day.calories,
    protein: acc.protein + day.protein,
    mealsLogged: acc.mealsLogged + day.mealsLogged,
  }), { calories: 0, protein: 0, mealsLogged: 0 });
  const activeDays = weeklyNutritionData.filter((day) => day.mealsLogged > 0).length;
  const avgCalories = activeDays > 0 ? Math.round(weeklyTotals.calories / activeDays) : 0;
  const avgProtein = activeDays > 0 ? Math.round(weeklyTotals.protein / activeDays) : 0;
  const calorieGoalHitDays = weeklyNutritionData.filter((day) => day.calories >= calorieGoal * 0.9 && day.calories <= calorieGoal * 1.1).length;
  const proteinGoalHitDays = weeklyNutritionData.filter((day) => day.protein >= macroGoals.protein).length;
  const weeklyMealsCount = weeklyNutritionData.reduce((sum, day) => sum + day.mealsLogged, 0);
  const { latestBodyMetric, bodyWeightDelta } = bodyMetricSummary;

  return {
    weeklyNutritionData,
    hasWeeklyNutritionData,
    weeklyNutritionInsights,
    weeklyMacroTotals,
    macroDistributionData,
    metricsTrendData,
    weeklyTotals,
    activeDays,
    avgCalories,
    avgProtein,
    calorieGoalHitDays,
    proteinGoalHitDays,
    weeklyMealsCount,
    latestBodyMetric,
    bodyWeightDelta,
    };
};

export type FixItIssueType = 'missing-meals' | 'low-protein' | 'missing-details' | 'calorie-balance';
export type ActiveFixItTargetLike = {
  issueType: FixItIssueType;
  targetDay: string | null;
  targetDate?: string | null;
};
export type FixItSlotSignal = {
  mealType: string;
  mealTypeLabel: string;
  hasMeals: boolean;
  protein: number;
  calories: number;
  missingProtein: boolean;
  missingCalories: boolean;
  missingDetails: boolean;
};

export const formatMealTypeLabel = (mealType: string) => (
  mealType.charAt(0).toUpperCase() + mealType.slice(1)
);

export const buildFixItSlotSignals = ({
  activeFixItTarget,
  mealTypes,
  weeklyMeals,
}: {
  activeFixItTarget: ActiveFixItTargetLike | null;
  mealTypes: string[];
  weeklyMeals: any;
}) => {
  if (!activeFixItTarget?.targetDay) return [];
  return mealTypes.map((mealType) => {
    const items = getMealSlotItems(weeklyMeals, activeFixItTarget.targetDay as string, mealType);
    const totals = getMealSlotTotals(weeklyMeals, activeFixItTarget.targetDay as string, mealType);
    const hasMeals = items.length > 0;
    const missingProtein = hasMeals && totals.protein <= 0;
    const missingCalories = hasMeals && totals.calories <= 0;
    const missingDetails = missingProtein || missingCalories;
    return {
      mealType,
      mealTypeLabel: formatMealTypeLabel(mealType),
      hasMeals,
      protein: totals.protein,
      calories: totals.calories,
      missingProtein,
      missingCalories,
      missingDetails,
    };
  });
};

export const buildFixItDataCompleteness = ({
  activeFixItTarget,
  activeFixItSlotSignals,
  mealTypes,
  weeklyMeals,
}: {
  activeFixItTarget: ActiveFixItTargetLike | null;
  activeFixItSlotSignals: FixItSlotSignal[];
  mealTypes: string[];
  weeklyMeals: any;
}) => {
  if (!activeFixItTarget?.targetDay) return null;

  let plannedMealCount = 0;
  let mealsWithNutritionCount = 0;
  let missingNutritionCount = 0;
  const emptySlotCount = activeFixItSlotSignals.filter((slot) => !slot.hasMeals).length;

  mealTypes.forEach((mealType) => {
    const items = getMealSlotItems(weeklyMeals, activeFixItTarget.targetDay as string, mealType);
    items.forEach((item) => {
      plannedMealCount += 1;
      const hasCalories = Number(item?.calories) > 0;
      const hasProtein = Number(item?.protein) > 0;
      const hasCoreNutrition = hasCalories && hasProtein;
      if (hasCoreNutrition) {
        mealsWithNutritionCount += 1;
        return;
      }
      missingNutritionCount += 1;
    });
  });

  if (plannedMealCount <= 0) {
    return { label: 'Needs more meal details', detail: 'No meals planned yet for this day.', tone: 'neutral' as const };
  }

  if (activeFixItTarget.issueType === 'missing-meals' && emptySlotCount > 0) {
    return {
      label: 'Partial meal coverage',
      detail: `${emptySlotCount} meal slot${emptySlotCount === 1 ? '' : 's'} still empty, so guidance is based on partial day data.`,
      tone: 'neutral' as const,
    };
  }

  if (missingNutritionCount <= 0) {
    return { label: 'Complete data', detail: 'Guidance is based on complete calories and protein data.', tone: 'success' as const };
  }

  if (mealsWithNutritionCount <= 0) {
    return {
      label: 'Needs more meal details',
      detail: `${missingNutritionCount} planned meal${missingNutritionCount === 1 ? '' : 's'} missing calories or protein.`,
      tone: 'warning' as const,
    };
  }

  return {
    label: 'Partial nutrition data',
    detail: `${missingNutritionCount} meal${missingNutritionCount === 1 ? '' : 's'} missing calories or protein, so guidance may be directional.`,
    tone: 'warning' as const,
  };
};

export const buildFixItProgressMiniState = ({ activeFixItTarget, activeFixItSlotSignals, calorieGoal, macroGoals, mealTypes, weeklyMeals }: {
  activeFixItTarget: ActiveFixItTargetLike | null;
  activeFixItSlotSignals: FixItSlotSignal[];
  calorieGoal: number;
  macroGoals: { protein: number };
  mealTypes: string[];
  weeklyMeals: any;
}) => {
  if (!activeFixItTarget?.targetDay) return null;

  let unresolvedCount = 0;
  if (activeFixItTarget.issueType === 'missing-meals') {
    unresolvedCount = activeFixItSlotSignals.filter((slot) => !slot.hasMeals).length;
  } else if (activeFixItTarget.issueType === 'low-protein') {
    const dayProtein = mealTypes.reduce((sum, mealType) => sum + getMealSlotTotals(weeklyMeals, activeFixItTarget.targetDay as string, mealType).protein, 0);
    const proteinGap = Math.max(0, Math.ceil(macroGoals.protein - dayProtein));
    unresolvedCount = proteinGap > 0 ? 1 : 0;
  } else if (activeFixItTarget.issueType === 'missing-details') {
    unresolvedCount = activeFixItSlotSignals.filter((slot) => slot.missingDetails || !slot.hasMeals).length;
  } else if (activeFixItTarget.issueType === 'calorie-balance') {
    const targetDayTotals = calculateTodayNutritionTotals(weeklyMeals, activeFixItTarget.targetDay as string);
    const lowerBound = calorieGoal * 0.9;
    const upperBound = calorieGoal * 1.1;
    unresolvedCount = targetDayTotals.calories < lowerBound || targetDayTotals.calories > upperBound ? 1 : 0;
  }

  if (unresolvedCount <= 0) {
    return { unresolvedCount: 0, message: 'All suggested fixes addressed.', tone: 'success' as const };
  }

  return {
    unresolvedCount,
    message: unresolvedCount === 1 ? '1 slot still needs attention.' : `${unresolvedCount} slots still need attention.`,
    tone: 'warning' as const,
  };
};

export const buildFixItDayCompletion = ({ activeFixItTarget, activeFixItSlotSignals, calorieGoal, macroGoals, mealTypes, weeklyMeals }: {
  activeFixItTarget: ActiveFixItTargetLike | null;
  activeFixItSlotSignals: FixItSlotSignal[];
  calorieGoal: number;
  macroGoals: { protein: number };
  mealTypes: string[];
  weeklyMeals: any;
}) => {
  if (!activeFixItTarget?.targetDay) return null;
  const slotCount = mealTypes.length;
  if (slotCount <= 0) return null;

  const missingMealsRemaining = activeFixItSlotSignals.filter((slot) => !slot.hasMeals).length;
  const missingMealsResolved = Math.max(0, slotCount - missingMealsRemaining);
  const missingDetailsRemaining = activeFixItSlotSignals.filter((slot) => slot.missingDetails || !slot.hasMeals).length;
  const missingDetailsResolved = Math.max(0, slotCount - missingDetailsRemaining);
  const dayProtein = activeFixItSlotSignals.reduce((sum, slot) => sum + slot.protein, 0);
  const proteinGap = Math.max(0, Math.ceil(macroGoals.protein - dayProtein));
  const lowProteinRemaining = proteinGap > 0 ? 1 : 0;
  const lowProteinResolved = lowProteinRemaining === 0 ? 1 : 0;
  const dayTotals = calculateTodayNutritionTotals(weeklyMeals, activeFixItTarget.targetDay);
  const lowerBound = calorieGoal * 0.9;
  const upperBound = calorieGoal * 1.1;
  const calorieBalanceRemaining = calorieGoal > 0 && (dayTotals.calories < lowerBound || dayTotals.calories > upperBound) ? 1 : 0;
  const calorieBalanceResolved = calorieBalanceRemaining === 0 ? 1 : 0;
  const totalIssues = (slotCount * 2) + 2;
  const resolvedIssues = missingMealsResolved + missingDetailsResolved + lowProteinResolved + calorieBalanceResolved;
  const remainingIssues = Math.max(0, totalIssues - resolvedIssues);

  return { totalIssues, resolvedIssues, remainingIssues, allResolved: remainingIssues === 0 };
};
