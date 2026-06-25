import { useMemo } from 'react';
import { buildPlannerCampaignViewModel } from '@/components/meal-planner/view-models';
import { usePlannerCampaignState } from '@/components/meal-planner/hooks/usePlannerCampaignState';

type PlannerCampaignViewModelInput = Parameters<
  typeof buildPlannerCampaignViewModel
>[0];
type UsePlannerCampaignsInput = Omit<
  PlannerCampaignViewModelInput,
  'activeCampaignId' | 'activeCampaignStartedAt' | 'weekDays' | 'mealTypes'
> & {
  weekDays: readonly string[];
  mealTypes: readonly string[];
  userId?: string | null;
  dismissedCoachInsightIds: string[];
};

export const usePlannerCampaigns = ({
  weeklyMeals,
  mealTypes,
  weekDays,
  calorieGoal,
  macroGoals,
  water,
  groceryPendingCount,
  groceryCompletedCount,
  groceryBuyItemCount,
  activePlannerGrocerySuggestions,
  normalizedSavingsReport,
  groceryList,
  prepSessionPlanned,
  prepSessionCompleted,
  blendedPrepProgress,
  prepActiveBlockersCount,
  prepCarryoverCount,
  prepOrchestration,
  weekReadyNow,
  prepReadyForWeek,
  streak,
  plannedBreakfasts,
  prepTasksCompleted,
  prepOverloadReduction,
  leftoverFriendlyMeals,
  proteinGoalHitDays,
  pantryIngredientsUsed,
  userId,
  dismissedCoachInsightIds,
}: UsePlannerCampaignsInput) => {
  const {
    activeCampaignId,
    activeCampaignStartedAt,
    activateCampaign,
    clearCampaign,
    campaignActionPending,
    campaignActionError,
  } = usePlannerCampaignState(userId);

  const campaignViewModel = useMemo(
    () =>
      buildPlannerCampaignViewModel({
        weeklyMeals,
        mealTypes: mealTypes as string[],
        weekDays: weekDays as string[],
        calorieGoal,
        macroGoals,
        water,
        groceryPendingCount,
        groceryCompletedCount,
        groceryBuyItemCount,
        activePlannerGrocerySuggestions,
        normalizedSavingsReport,
        groceryList,
        prepSessionPlanned,
        prepSessionCompleted,
        blendedPrepProgress,
        prepActiveBlockersCount,
        prepCarryoverCount,
        prepOrchestration,
        weekReadyNow,
        prepReadyForWeek,
        streak,
        plannedBreakfasts,
        prepTasksCompleted,
        prepOverloadReduction,
        leftoverFriendlyMeals,
        proteinGoalHitDays,
        pantryIngredientsUsed,
        activeCampaignId,
        activeCampaignStartedAt,
        userId,
      }),
    [
      activeCampaignId,
      activeCampaignStartedAt,
      activePlannerGrocerySuggestions,
      blendedPrepProgress,
      calorieGoal,
      groceryBuyItemCount,
      groceryCompletedCount,
      groceryList,
      groceryPendingCount,
      leftoverFriendlyMeals,
      macroGoals,
      mealTypes,
      normalizedSavingsReport,
      pantryIngredientsUsed,
      plannedBreakfasts,
      prepActiveBlockersCount,
      prepCarryoverCount,
      prepOrchestration,
      prepOverloadReduction,
      prepReadyForWeek,
      prepSessionCompleted,
      prepSessionPlanned,
      prepTasksCompleted,
      proteinGoalHitDays,
      streak,
      userId,
      water,
      weekDays,
      weekReadyNow,
      weeklyMeals,
    ],
  );

  const visibleCoachInsights = useMemo(
    () =>
      campaignViewModel.nutritionCoachAnalysis.insights.filter(
        (insight) => !dismissedCoachInsightIds.includes(insight.id),
      ),
    [
      campaignViewModel.nutritionCoachAnalysis.insights,
      dismissedCoachInsightIds,
    ],
  );

  return {
    ...campaignViewModel,
    visibleCoachInsights,
    activeCampaignId,
    activeCampaignStartedAt,
    activateCampaign,
    clearCampaign,
    campaignActionPending,
    campaignActionError,
  };
};
