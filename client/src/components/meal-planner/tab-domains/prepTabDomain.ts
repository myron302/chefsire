import { derivePrepSessions } from '@/components/meal-planner/prepOrchestrationUtils';
import { getSlotItems as getMealSlotItems } from '@/components/meal-planner/nutritionMealPlannerUtils';

export const GROCERY_LINKED_PREP_BLOCKER_IDS = ['missing-ingredient', 'waiting-on-grocery'];

export type PrepSessionLike = {
  scheduledAt?: string | null;
  completedAt?: string | null;
  tasks: Array<{ id: string; done: boolean }>;
  blockers: Array<{ id: string; label: string; active: boolean }>;
  blockerNote: string;
  blockerSuggestionLinks: Array<{ suggestionId: string; name: string; category: string; reason: string; addedAt: string }>;
  carryoverTaskIds: string[];
  generatedPrepTaskCompletions?: Record<string, boolean>;
};

export const buildPrepReadinessPresentation = ({
  weeklyMeals,
  weekDays,
  mealTypes,
  groceryList,
  prepSession,
  plannedSlots,
}: {
  weeklyMeals: any;
  weekDays: string[];
  mealTypes: string[];
  groceryList: any[];
  prepSession: PrepSessionLike;
  plannedSlots: number;
}) => {
  const prepSessionPlanned = Boolean(prepSession.scheduledAt);
  const prepSessionCompleted = Boolean(prepSession.completedAt);
  const prepProgress = Math.round((prepSession.tasks.filter((task) => task.done).length / Math.max(1, prepSession.tasks.length)) * 100);
  const prepOrchestration = derivePrepSessions(weeklyMeals, prepSession.generatedPrepTaskCompletions || {});
  const generatedPrepProgress = prepOrchestration.summary.completionPercent;
  const plannedBreakfasts = weekDays.reduce((sum, day) => sum + getMealSlotItems(weeklyMeals, day, 'breakfast').length, 0);
  const prepTasksCompleted = prepSession.tasks.filter((task) => task.done).length + Object.values(prepSession.generatedPrepTaskCompletions || {}).filter(Boolean).length;
  const pantryIngredientsUsed = Math.min(10, groceryList.filter((item: any) => item?.isPantryItem && item?.completed).length);
  const leftoverFriendlyMeals = weekDays.reduce((count, day) => {
    const matches = ['leftover', 'batch', 'reuse', 'repurpose'];
    return count + mealTypes.reduce((dayCount, type) => {
      const items = getMealSlotItems(weeklyMeals, day, type);
      return dayCount + items.filter((item: any) => matches.some((token) => String(item?.name || '').toLowerCase().includes(token))).length;
    }, 0);
  }, 0);
  const prepActiveBlockersCount = prepSession.blockers.filter((blocker) => blocker.active).length;
  const prepOverloadReduction = Math.max(0, Math.round((prepOrchestration.summary.readinessScore || 0) - (prepActiveBlockersCount * 10)));
  const blendedPrepProgress = Math.max(prepProgress, generatedPrepProgress);
  const prepRecommendationsAvailable = plannedSlots > 0;
  const prepPlanMissing = plannedSlots > 0 && !prepSessionPlanned && !prepSessionCompleted;
  const prepGroceryBlockersCount = prepSession.blockers.filter(
    (blocker) => blocker.active && GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id),
  ).length;
  const prepCarryoverCount = prepSession.carryoverTaskIds.filter((taskId) => prepSession.tasks.some((task) => task.id === taskId && !task.done)).length;
  const prepExecutionState = !prepSessionPlanned
    ? 'not_planned'
    : prepSessionCompleted
      ? 'complete'
      : prepActiveBlockersCount > 0
        ? 'blocked'
        : 'in_progress';
  const prepReadyForWeek = prepSessionCompleted
    || (prepSessionPlanned
      && prepActiveBlockersCount === 0
      && (prepOrchestration.summary.totalGeneratedTasks === 0 || prepOrchestration.summary.readinessScore >= 70));

  return {
    prepSessionPlanned,
    prepSessionCompleted,
    prepProgress,
    prepOrchestration,
    generatedPrepProgress,
    plannedBreakfasts,
    prepTasksCompleted,
    pantryIngredientsUsed,
    leftoverFriendlyMeals,
    prepActiveBlockersCount,
    prepOverloadReduction,
    blendedPrepProgress,
    prepRecommendationsAvailable,
    prepPlanMissing,
    prepGroceryBlockersCount,
    prepCarryoverCount,
    prepExecutionState,
    prepReadyForWeek,
  };
};
