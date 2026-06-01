import { useMemo } from "react";
import { buildFixItSlotRecommendations } from "@/components/meal-planner/hooks/fix-it/buildFixItSlotRecommendations";
import { useFixItQueueActions } from "@/components/meal-planner/hooks/fix-it/useFixItQueueActions";
import { useFixItTargetActions } from "@/components/meal-planner/hooks/fix-it/useFixItTargetActions";
export {
  DEFAULT_FIX_IT_DETAILS_QUEUE_SKIP_REASON,
  FIX_IT_DETAILS_QUEUE_SKIP_REASONS,
  FIX_IT_DETAILS_QUEUE_SNOOZE_OPTIONS,
} from "@/components/meal-planner/hooks/fix-it/types";
export type {
  ActiveFixItTarget,
  FixItDetailsQueueSkipReasonId,
  FixItDetailsQueueSnoozeOptionId,
  FixItIssueType,
  FixItSlotRecommendation,
} from "@/components/meal-planner/hooks/fix-it/types";
import type {
  ActiveFixItTarget,
  FixItDetailsQueueSkipReasonId,
  FixItDetailsQueueSnoozeOptionId,
} from "@/components/meal-planner/hooks/fix-it/types";

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
  const targetActions = useFixItTargetActions({
    setActiveFixItTarget,
    weeklyNutritionInsights,
    weeklyNutritionData,
    getDateForWeekday,
    focusPlannerDay,
    handleAddMeal,
    handleAIRecipe,
    setActiveTab,
  });

  const queueActions = useFixItQueueActions({
    activeFixItTarget,
    fixItDetailsQueueSkippedKeys,
    fixItDetailsQueueSkipReasonByKey,
    setFixItDetailsQueueSkippedKeys,
    setFixItDetailsQueueSkipReasonByKey,
    setFixItDetailsQueuePendingSkipReason,
    setFixItDetailsQueueDone,
    setFixItDetailsQueueSnoozedByKey,
    focusPlannerDay,
    handleAddMeal,
  });

  const activeFixItSlotRecommendations = useMemo(
    () =>
      buildFixItSlotRecommendations({
        activeFixItTarget,
        activeFixItSlotSignals,
        calorieGoal,
        focusPlannerDay,
        handleAddMeal,
        handleAIRecipe,
        setActiveTab,
      }),
    [
      activeFixItSlotSignals,
      activeFixItTarget,
      calorieGoal,
      focusPlannerDay,
      handleAIRecipe,
      handleAddMeal,
      setActiveTab,
    ],
  );

  return {
    ...targetActions,
    ...queueActions,
    activeFixItSlotRecommendations,
  };
};
