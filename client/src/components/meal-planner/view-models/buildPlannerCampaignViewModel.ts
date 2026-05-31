import { deriveNutritionCoachInsights } from '@/components/meal-planner/nutritionCoachUtils';
import { evaluateCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignEngine';
import {
  selectCadenceConsistency,
  selectContinuityAnchors,
  selectContinuitySummary,
  selectMomentumProtection,
  selectPlannerMealCount,
  selectPlannerMeals,
  selectPrepReadinessSummary,
  selectRecoveryStability,
  selectStabilizationReadiness,
} from '@/components/meal-planner/planner-core/selectors';
import { DEFAULT_NUTRITION_GOALS } from '@/components/meal-planner/nutritionMealPlannerUtils';

export const buildPlannerCampaignViewModel = ({
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
  activeCampaignId,
  activeCampaignStartedAt,
  userId,
}: {
  weeklyMeals: any;
  mealTypes: string[];
  weekDays: string[];
  calorieGoal: number;
  macroGoals: { protein: number; carbs: number; fat: number };
  water: any;
  groceryPendingCount: number;
  groceryCompletedCount: number;
  groceryBuyItemCount: number;
  activePlannerGrocerySuggestions: any[];
  normalizedSavingsReport: any;
  groceryList: any[];
  prepSessionPlanned: boolean;
  prepSessionCompleted: boolean;
  blendedPrepProgress: number;
  prepActiveBlockersCount: number;
  prepCarryoverCount: number;
  prepOrchestration: any;
  weekReadyNow: boolean;
  prepReadyForWeek: boolean;
  streak: { currentStreak: number };
  plannedBreakfasts: number;
  prepTasksCompleted: number;
  prepOverloadReduction: number;
  leftoverFriendlyMeals: number;
  proteinGoalHitDays: number;
  pantryIngredientsUsed: number;
  activeCampaignId?: string | null;
  activeCampaignStartedAt?: string | null;
  userId?: string | number | null;
}) => {
  const nutritionCoachAnalysis = deriveNutritionCoachInsights({
    weeklyMeals,
    mealTypes,
    weekDays,
    calorieGoal,
    proteinGoal: macroGoals.protein || DEFAULT_NUTRITION_GOALS.macroGoals.protein,
    water,
    grocery: {
      pendingCount: groceryPendingCount,
      completedCount: groceryCompletedCount,
      totalBuyCount: groceryBuyItemCount,
      suggestions: activePlannerGrocerySuggestions,
      pantryItemCount: normalizedSavingsReport?.pantryItemCount || groceryList.filter((item: any) => item?.isPantryItem).length,
      pantrySavings: normalizedSavingsReport?.pantrySavings || 0,
    },
    prep: {
      planned: prepSessionPlanned,
      completed: prepSessionCompleted,
      progress: blendedPrepProgress,
      activeBlockersCount: prepActiveBlockersCount,
      carryoverCount: prepCarryoverCount,
      orchestration: prepOrchestration,
    },
    readiness: {
      weekReadyNow,
      prepReadyForWeek,
    },
    adherence: {
      currentStreak: streak.currentStreak,
    },
  });
  const semanticVarietyScore = Math.round((nutritionCoachAnalysis?.scoreBreakdown?.variety ?? 70) as number);
  const plannerMeals = selectPlannerMeals(weeklyMeals);
  const plannerMealCount = selectPlannerMealCount(plannerMeals);
  const continuityAnchors = selectContinuityAnchors(plannedBreakfasts, prepTasksCompleted);
  const recoveryStability = selectRecoveryStability(prepOverloadReduction, leftoverFriendlyMeals);
  const momentumProtection = selectMomentumProtection(proteinGoalHitDays, semanticVarietyScore);
  const cadenceConsistency = selectCadenceConsistency(plannedBreakfasts, groceryCompletedCount);
  const stabilizationReadiness = selectStabilizationReadiness(prepTasksCompleted, prepOverloadReduction, groceryCompletedCount);
  const prepReadinessSummary = selectPrepReadinessSummary(prepTasksCompleted, groceryCompletedCount);
  const continuitySummary = selectContinuitySummary(continuityAnchors, recoveryStability, momentumProtection);

  const activeCampaignProgress = activeCampaignId && activeCampaignStartedAt
    ? evaluateCampaignProgress(activeCampaignId, {
        plannedBreakfasts: continuitySummary.continuityAnchors.plannedBreakfasts,
        prepTasksCompleted: prepReadinessSummary.prepTasksCompleted,
        groceryItemsResolved: prepReadinessSummary.groceryCompletedCount,
        pantryIngredientsUsed,
        leftoverFriendlyMeals: continuitySummary.recoveryStability.leftoverFriendlyMeals,
        proteinGoalDays: continuitySummary.momentumProtection.proteinGoalHitDays,
        semanticVarietyScore: continuitySummary.momentumProtection.semanticVarietyScore,
        prepOverloadReduction: continuitySummary.recoveryStability.prepOverloadReduction,
      }, activeCampaignStartedAt, undefined, userId)
    : null;

  return {
    nutritionCoachAnalysis,
    semanticVarietyScore,
    plannerMeals,
    plannerMealCount,
    continuityAnchors,
    recoveryStability,
    momentumProtection,
    cadenceConsistency,
    stabilizationReadiness,
    prepReadinessSummary,
    continuitySummary,
    activeCampaignProgress,
  };
};
