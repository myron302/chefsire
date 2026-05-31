import {
  getSlotItems as getMealSlotItems,
  getSlotTotals as getMealSlotTotals,
} from '@/components/meal-planner/nutritionMealPlannerUtils';

export const buildPlannerAnalyticsViewModel = ({
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
