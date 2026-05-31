import { useCallback, useMemo } from "react";
import { formatMealTypeLabel } from "@/components/meal-planner/tab-domains/analyticsTabDomain";

export type FixItIssueType =
  | "missing-meals"
  | "low-protein"
  | "missing-details"
  | "calorie-balance";
export type ActiveFixItTarget = {
  issueType: FixItIssueType;
  targetDay: string | null;
  targetDate: string | null;
  reason: string;
  suggestedNextStep: string;
};
export type FixItDetailsQueueSkipReasonId =
  | "protein-unknown"
  | "label-unavailable"
  | "add-later"
  | "not-needed-today";
export type FixItDetailsQueueSnoozeOptionId =
  | "later-today"
  | "tomorrow"
  | "next-week";
export type FixItSlotRecommendation = {
  key: string;
  text: string;
  cta: string;
  onClick: () => void;
};

export const FIX_IT_DETAILS_QUEUE_SKIP_REASONS: Array<{
  id: FixItDetailsQueueSkipReasonId;
  label: string;
}> = [
  { id: "protein-unknown", label: "Don't know protein yet" },
  { id: "label-unavailable", label: "Label unavailable" },
  { id: "add-later", label: "Will add later" },
  { id: "not-needed-today", label: "Not needed today" },
];
export const DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON: FixItDetailsQueueSkipReasonId =
  "add-later";
export const FIX_IT_DETAILS_QUEUE_SNOOZE_OPTIONS: Array<{
  id: FixItDetailsQueueSnoozeOptionId;
  label: string;
}> = [
  { id: "later-today", label: "Later today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "next-week", label: "Next week" },
];

type UsePlannerFixItActionsArgs = {
  activeFixItTarget: ActiveFixItTarget | null;
  setActiveFixItTarget: React.Dispatch<
    React.SetStateAction<ActiveFixItTarget | null>
  >;
  weeklyNutritionInsights: any;
  weeklyNutritionData: Array<{ day: string; calories: number }>;
  activeFixItSlotSignals: any[];
  calorieGoal: number;
  fixItDetailsQueueSkippedKeys: string[];
  fixItDetailsQueueSkipReasonByKey: Record<
    string,
    FixItDetailsQueueSkipReasonId
  >;
  setFixItDetailsQueueSkippedKeys: React.Dispatch<
    React.SetStateAction<string[]>
  >;
  setFixItDetailsQueueSkipReasonByKey: React.Dispatch<
    React.SetStateAction<Record<string, FixItDetailsQueueSkipReasonId>>
  >;
  setFixItDetailsQueuePendingSkipReason: React.Dispatch<
    React.SetStateAction<FixItDetailsQueueSkipReasonId>
  >;
  setFixItDetailsQueueDone: React.Dispatch<React.SetStateAction<boolean>>;
  setFixItDetailsQueueSnoozedByKey: React.Dispatch<
    React.SetStateAction<Record<string, FixItDetailsQueueSnoozeOptionId>>
  >;
  getDateForWeekday: (weekday: string) => string;
  focusPlannerDay: (day: string) => void;
  handleAddMeal: (day?: string, type?: string) => void;
  handleAIRecipe: () => void;
  setActiveTab: (tab: string) => void;
};

export const usePlannerFixItActions = ({
  activeFixItTarget,
  setActiveFixItTarget,
  weeklyNutritionInsights,
  weeklyNutritionData,
  activeFixItSlotSignals,
  calorieGoal,
  fixItDetailsQueueSkippedKeys,
  fixItDetailsQueueSkipReasonByKey,
  setFixItDetailsQueueSkippedKeys,
  setFixItDetailsQueueSkipReasonByKey,
  setFixItDetailsQueuePendingSkipReason,
  setFixItDetailsQueueDone,
  setFixItDetailsQueueSnoozedByKey,
  getDateForWeekday,
  focusPlannerDay,
  handleAddMeal,
  handleAIRecipe,
  setActiveTab,
}: UsePlannerFixItActionsArgs) => {
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

  const handleQueueCompleteDetails = useCallback(
    (mealType: string) => {
      if (!activeFixItTarget?.targetDay) return;
      focusPlannerDay(activeFixItTarget.targetDay);
      handleAddMeal(activeFixItTarget.targetDay, formatMealTypeLabel(mealType));
    },
    [activeFixItTarget?.targetDay, focusPlannerDay, handleAddMeal],
  );

  const handleQueueSkipCurrent = useCallback(
    (
      slotKey: string,
      reasonId: FixItDetailsQueueSkipReasonId = DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON,
    ) => {
      setFixItDetailsQueueSkippedKeys((prev) =>
        prev.includes(slotKey) ? prev : [...prev, slotKey],
      );
      setFixItDetailsQueueSkipReasonByKey((prev) => ({
        ...prev,
        [slotKey]: reasonId,
      }));
      setFixItDetailsQueueSnoozedByKey((prev) => {
        if (!prev[slotKey]) return prev;
        const next = { ...prev };
        delete next[slotKey];
        return next;
      });
      setFixItDetailsQueuePendingSkipReason(
        DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON,
      );
    },
    [
      setFixItDetailsQueuePendingSkipReason,
      setFixItDetailsQueueSkipReasonByKey,
      setFixItDetailsQueueSkippedKeys,
      setFixItDetailsQueueSnoozedByKey,
    ],
  );

  const handleQueueSnoozeCurrent = useCallback(
    (slotKey: string, snoozeId: FixItDetailsQueueSnoozeOptionId) => {
      setFixItDetailsQueueSnoozedByKey((prev) => ({
        ...prev,
        [slotKey]: snoozeId,
      }));
      setFixItDetailsQueueSkippedKeys((prev) =>
        prev.filter((key) => key !== slotKey),
      );
      setFixItDetailsQueueSkipReasonByKey((prev) => {
        if (!prev[slotKey]) return prev;
        const next = { ...prev };
        delete next[slotKey];
        return next;
      });
    },
    [
      setFixItDetailsQueueSkipReasonByKey,
      setFixItDetailsQueueSkippedKeys,
      setFixItDetailsQueueSnoozedByKey,
    ],
  );

  const handleQueueRevisitSnoozed = useCallback(() => {
    setFixItDetailsQueueSnoozedByKey({});
  }, [setFixItDetailsQueueSnoozedByKey]);

  const handleQueueRevisitSkipped = useCallback(() => {
    setFixItDetailsQueueSkippedKeys([]);
    setFixItDetailsQueueSkipReasonByKey({});
    setFixItDetailsQueuePendingSkipReason(
      DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON,
    );
    setFixItDetailsQueueDone(false);
  }, [
    setFixItDetailsQueueDone,
    setFixItDetailsQueuePendingSkipReason,
    setFixItDetailsQueueSkipReasonByKey,
    setFixItDetailsQueueSkippedKeys,
  ]);

  const activeFixItSkippedReasonSummary = useMemo(() => {
    if (fixItDetailsQueueSkippedKeys.length <= 0) return "";
    const counts = fixItDetailsQueueSkippedKeys.reduce(
      (acc, slotKey) => {
        const reasonId =
          fixItDetailsQueueSkipReasonByKey[slotKey] ??
          DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON;
        acc[reasonId] = (acc[reasonId] ?? 0) + 1;
        return acc;
      },
      {} as Record<FixItDetailsQueueSkipReasonId, number>,
    );
    return FIX_IT_DETAILS_QUEUE_SKIP_REASONS.filter(
      (reason) => counts[reason.id],
    )
      .map((reason) => `${reason.label} (${counts[reason.id]})`)
      .join(" • ");
  }, [fixItDetailsQueueSkipReasonByKey, fixItDetailsQueueSkippedKeys]);

  const activeFixItSlotRecommendations = useMemo<
    FixItSlotRecommendation[]
  >(() => {
    if (!activeFixItTarget?.targetDay) return [];
    const targetDay = activeFixItTarget.targetDay;
    const slotSignals = activeFixItSlotSignals;
    const addMealForSlot = (mealType: string) => {
      focusPlannerDay(targetDay);
      handleAddMeal(targetDay, formatMealTypeLabel(mealType));
    };
    const openTargetedAI = () => {
      focusPlannerDay(targetDay);
      handleAIRecipe();
    };
    const openAnalytics = () => setActiveTab("analytics");
    const recommendations: FixItSlotRecommendation[] = [];
    const pushRecommendation = (recommendation: FixItSlotRecommendation) => {
      if (
        recommendations.some((existing) => existing.key === recommendation.key)
      )
        return;
      if (recommendations.length >= 3) return;
      recommendations.push(recommendation);
    };

    if (activeFixItTarget.issueType === "missing-meals") {
      const emptySlots = slotSignals.filter((slot) => !slot.hasMeals);
      const preferredOrder = ["dinner", "lunch", "breakfast", "snack"];
      emptySlots
        .sort(
          (a, b) =>
            preferredOrder.indexOf(a.mealType) -
            preferredOrder.indexOf(b.mealType),
        )
        .slice(0, 2)
        .forEach((slot) => {
          pushRecommendation({
            key: `fill-${slot.mealType}`,
            text: `Fill ${slot.mealTypeLabel}`,
            cta: "Add Meal",
            onClick: () => addMealForSlot(slot.mealType),
          });
        });
      pushRecommendation({
        key: "missing-meals-ai",
        text: "Need quick ideas for open slots?",
        cta: "Open AI Suggestions",
        onClick: openTargetedAI,
      });
    }

    if (activeFixItTarget.issueType === "low-protein") {
      const lowestProteinSlot = slotSignals
        .filter((slot) => slot.hasMeals)
        .sort((a, b) => a.protein - b.protein)[0];
      const emptySlot = slotSignals.find((slot) => !slot.hasMeals);
      if (lowestProteinSlot)
        pushRecommendation({
          key: `protein-${lowestProteinSlot.mealType}`,
          text: `Add protein to ${lowestProteinSlot.mealTypeLabel}`,
          cta: "Add Meal",
          onClick: () => addMealForSlot(lowestProteinSlot.mealType),
        });
      if (emptySlot)
        pushRecommendation({
          key: `protein-fill-${emptySlot.mealType}`,
          text: `Fill ${emptySlot.mealTypeLabel} with a protein-forward meal`,
          cta: "Add Meal",
          onClick: () => addMealForSlot(emptySlot.mealType),
        });
      pushRecommendation({
        key: "low-protein-ai",
        text: "Get protein-forward meal ideas for this day",
        cta: "Open AI Suggestions",
        onClick: openTargetedAI,
      });
    }

    if (activeFixItTarget.issueType === "missing-details") {
      const missingDetailSlots = slotSignals.filter(
        (slot) => slot.missingDetails,
      );
      if (missingDetailSlots.length > 0)
        missingDetailSlots.slice(0, 2).forEach((slot) => {
          pushRecommendation({
            key: `details-${slot.mealType}`,
            text: `Complete calories/protein for ${slot.mealTypeLabel}`,
            cta: "Add Meal",
            onClick: () => addMealForSlot(slot.mealType),
          });
        });
      const emptySlots = slotSignals.filter((slot) => !slot.hasMeals);
      if (emptySlots.length > 0)
        emptySlots.slice(0, 1).forEach((slot) => {
          pushRecommendation({
            key: `details-fill-${slot.mealType}`,
            text: `Fill ${slot.mealTypeLabel} so nutrition details can be tracked`,
            cta: "Add Meal",
            onClick: () => addMealForSlot(slot.mealType),
          });
        });
      pushRecommendation({
        key: "details-ai",
        text: "Use AI suggestions to replace meals with complete nutrition data",
        cta: "Open AI Suggestions",
        onClick: openTargetedAI,
      });
    }

    if (activeFixItTarget.issueType === "calorie-balance") {
      const highestCalorieSlot = slotSignals
        .filter((slot) => slot.calories > 0)
        .sort((a, b) => b.calories - a.calories)[0];
      const lowestCalorieSlot = slotSignals
        .filter((slot) => slot.hasMeals)
        .sort((a, b) => a.calories - b.calories)[0];
      if (highestCalorieSlot)
        pushRecommendation({
          key: `calorie-heavy-${highestCalorieSlot.mealType}`,
          text: `Review calorie-heavy ${highestCalorieSlot.mealTypeLabel}`,
          cta: "Review Analytics",
          onClick: openAnalytics,
        });
      if (lowestCalorieSlot && lowestCalorieSlot.calories < calorieGoal * 0.2)
        pushRecommendation({
          key: `calorie-complete-${lowestCalorieSlot.mealType}`,
          text: `Complete calories for ${lowestCalorieSlot.mealTypeLabel}`,
          cta: "Add Meal",
          onClick: () => addMealForSlot(lowestCalorieSlot.mealType),
        });
      pushRecommendation({
        key: "calorie-balance-analytics",
        text: "Compare high and low days before adjusting portions",
        cta: "Review Analytics",
        onClick: openAnalytics,
      });
    }

    return recommendations.slice(0, 3);
  }, [
    activeFixItSlotSignals,
    activeFixItTarget,
    calorieGoal,
    focusPlannerDay,
    handleAIRecipe,
    handleAddMeal,
    setActiveTab,
  ]);

  return {
    createFixItTarget,
    handleFixMissingDay,
    handleFixLowProteinDay,
    handleFixMealDetails,
    handleFixCalorieBalance,
    weeklyNutritionFixActions,
    handleQueueCompleteDetails,
    handleQueueSkipCurrent,
    handleQueueSnoozeCurrent,
    handleQueueRevisitSnoozed,
    handleQueueRevisitSkipped,
    activeFixItSkippedReasonSummary,
    activeFixItSlotRecommendations,
  };
};
