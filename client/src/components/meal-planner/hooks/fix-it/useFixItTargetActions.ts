import { useCallback, useMemo } from "react";
import type {
  ActiveFixItTarget,
  FixItIssueType,
} from "@/components/meal-planner/hooks/fix-it/types";

type UseFixItTargetActionsArgs = {
  setActiveFixItTarget: React.Dispatch<
    React.SetStateAction<ActiveFixItTarget | null>
  >;
  weeklyNutritionInsights: any;
  weeklyNutritionData: Array<{ day: string; calories: number }>;
  getDateForWeekday: (weekday: string) => string;
  focusPlannerDay: (day: string) => void;
  handleAddMeal: (day?: string, type?: string) => void;
  handleAIRecipe: () => void;
  setActiveTab: (tab: string) => void;
};

export const useFixItTargetActions = ({
  setActiveFixItTarget,
  weeklyNutritionInsights,
  weeklyNutritionData,
  getDateForWeekday,
  focusPlannerDay,
  handleAddMeal,
  handleAIRecipe,
  setActiveTab,
}: UseFixItTargetActionsArgs) => {
  const createFixItTarget = useCallback(
    (
      issueType: FixItIssueType,
      targetDay: string | null,
      reason: string,
      suggestedNextStep: string,
    ): ActiveFixItTarget => ({
      issueType,
      targetDay,
      targetDate: targetDay ? getDateForWeekday(targetDay) : null,
      reason,
      suggestedNextStep,
    }),
    [getDateForWeekday],
  );

  const handleFixMissingDay = useCallback(() => {
    const targetDay = weeklyNutritionInsights.missingMealDaysList[0]?.day;
    setActiveFixItTarget(
      createFixItTarget(
        "missing-meals",
        targetDay || null,
        targetDay
          ? `${targetDay} has no planned meals yet.`
          : "Your week has at least one day without meals planned.",
        "Add at least one anchor meal, then fill the remaining slots for that day.",
      ),
    );
    if (!targetDay) {
      setActiveTab("planner");
      return;
    }
    focusPlannerDay(targetDay);
    handleAddMeal(targetDay, "Dinner");
  }, [
    createFixItTarget,
    focusPlannerDay,
    handleAddMeal,
    setActiveFixItTarget,
    setActiveTab,
    weeklyNutritionInsights.missingMealDaysList,
  ]);

  const handleFixLowProteinDay = useCallback(() => {
    const targetDay = weeklyNutritionInsights.lowProteinDaysList[0]?.day;
    setActiveFixItTarget(
      createFixItTarget(
        "low-protein",
        targetDay || null,
        targetDay
          ? `${targetDay} is below the 60g protein signal for this week.`
          : "A planned day is currently below the protein target signal.",
        "Add or swap in a higher-protein meal on this day to improve coverage.",
      ),
    );
    if (!targetDay) {
      setActiveTab("planner");
      return;
    }
    focusPlannerDay(targetDay);
  }, [
    createFixItTarget,
    focusPlannerDay,
    setActiveFixItTarget,
    setActiveTab,
    weeklyNutritionInsights.lowProteinDaysList,
  ]);

  const handleFixMealDetails = useCallback(() => {
    const targetDay =
      weeklyNutritionInsights.missingProteinDataDaysList[0]?.day ||
      weeklyNutritionInsights.missingCalorieDataDaysList[0]?.day;
    setActiveFixItTarget(
      createFixItTarget(
        "missing-details",
        targetDay || null,
        targetDay
          ? `${targetDay} has meal entries missing protein or calorie details.`
          : "Some planned meals are missing calorie or protein details.",
        "Update meal nutrition details so weekly coverage and balance insights are more accurate.",
      ),
    );
    if (!targetDay) {
      setActiveTab("planner");
      return;
    }
    focusPlannerDay(targetDay);
  }, [
    createFixItTarget,
    focusPlannerDay,
    setActiveFixItTarget,
    setActiveTab,
    weeklyNutritionInsights.missingCalorieDataDaysList,
    weeklyNutritionInsights.missingProteinDataDaysList,
  ]);

  const handleFixCalorieBalance = useCallback(() => {
    const targetDay =
      weeklyNutritionData.reduce<{ day: string; calories: number } | null>(
        (best, day) => {
          if (day.calories <= 0) return best;
          if (!best || day.calories > best.calories)
            return { day: day.day, calories: day.calories };
          return best;
        },
        null,
      )?.day || null;
    setActiveFixItTarget(
      createFixItTarget(
        "calorie-balance",
        targetDay,
        "Calorie totals are swinging widely across tracked days this week.",
        "Review high and low days in Analytics, then smooth portions or meal choices on outlier days.",
      ),
    );
    setActiveTab("analytics");
  }, [
    createFixItTarget,
    setActiveFixItTarget,
    setActiveTab,
    weeklyNutritionData,
  ]);

  const weeklyNutritionFixActions = useMemo(() => {
    const actions: Array<{ key: string; label: string; onClick: () => void }> =
      [];
    if (weeklyNutritionInsights.missingMealDaysList.length > 0)
      actions.push({
        key: "fill-unplanned-day",
        label: "Fill unplanned day",
        onClick: handleFixMissingDay,
      });
    if (weeklyNutritionInsights.lowProteinDaysList.length > 0)
      actions.push({
        key: "review-low-protein-day",
        label: "Review low-protein day",
        onClick: handleFixLowProteinDay,
      });
    if (
      weeklyNutritionInsights.missingProteinDataDaysList.length > 0 ||
      weeklyNutritionInsights.missingCalorieDataDaysList.length > 0
    )
      actions.push({
        key: "review-meal-details",
        label: "Add meal details",
        onClick: handleFixMealDetails,
      });
    if (
      weeklyNutritionInsights.canCompareCalories &&
      weeklyNutritionInsights.caloriesVaryWidely
    )
      actions.push({
        key: "review-calorie-balance",
        label: "Review calorie balance",
        onClick: handleFixCalorieBalance,
      });
    if (actions.length > 0) {
      actions.push({
        key: "open-ai-suggestions",
        label: "Open AI suggestions",
        onClick: () => {
          setActiveTab("planner");
          handleAIRecipe();
        },
      });
    }
    return actions;
  }, [
    handleAIRecipe,
    handleFixCalorieBalance,
    handleFixLowProteinDay,
    handleFixMealDetails,
    handleFixMissingDay,
    setActiveTab,
    weeklyNutritionInsights,
  ]);

  return {
    createFixItTarget,
    handleFixMissingDay,
    handleFixLowProteinDay,
    handleFixMealDetails,
    handleFixCalorieBalance,
    weeklyNutritionFixActions,
  };
};
