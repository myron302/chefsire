import { derivePlannerGrocerySuggestions, normalizeMealIngredient, type PlannerGroceryDerivationState, type PlannerGrocerySuggestion } from '@/components/meal-planner/plannerGroceryUtils';
import { derivePrepSessions } from '@/components/meal-planner/prepOrchestrationUtils';
import { getSlotItems as getMealSlotItems } from '@/components/meal-planner/nutritionMealPlannerUtils';

const GROCERY_LINKED_PREP_BLOCKER_IDS = ['missing-ingredient', 'waiting-on-grocery'];
const BLOCKER_SUGGESTION_CATEGORY_BY_ID: Record<string, string> = {
  'missing-ingredient': 'From Recipe',
  'waiting-on-grocery': 'Other',
};
const BLOCKER_SUGGESTION_SEEDS_BY_ID: Record<string, string[]> = {
  'missing-ingredient': ['Meal prep protein', 'Fresh vegetables', 'Breakfast staples'],
  'waiting-on-grocery': ['Weekly produce refill', 'Protein restock', 'Quick snack options'],
};
const BLOCKER_NOTE_STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'need', 'needs', 'needed', 'still', 'more', 'from', 'into', 'this', 'that',
  'prep', 'meal', 'meals', 'week', 'grocery', 'shopping', 'store', 'list', 'item', 'items', 'to', 'a', 'an',
]);

type PrepSessionLike = {
  scheduledAt?: string | null;
  completedAt?: string | null;
  tasks: Array<{ id: string; done: boolean }>;
  blockers: Array<{ id: string; label: string; active: boolean }>;
  blockerNote: string;
  blockerSuggestionLinks: Array<{ suggestionId: string; name: string; category: string; reason: string; addedAt: string }>;
  carryoverTaskIds: string[];
  generatedPrepTaskCompletions?: Record<string, boolean>;
};

type SavingsReportLike = {
  summary?: { totalSaved?: number | string; savingsRate?: string };
  pantry?: { savings?: number | string; itemCount?: number | string };
  topSavingCategories?: unknown[];
} | null | undefined;

export type BlockerItemSuggestionViewModel = {
  id: string;
  name: string;
  category: string;
  reason: string;
  alreadyOnList: boolean;
};

export const buildPlannerReadinessViewModel = ({
  weeklyMeals,
  weekDays,
  mealTypes,
  groceryList,
  plannerGroceryState,
  prepSession,
  savingsReport,
}: {
  weeklyMeals: any;
  weekDays: string[];
  mealTypes: string[];
  groceryList: any[];
  plannerGroceryState: PlannerGroceryDerivationState;
  prepSession: PrepSessionLike;
  savingsReport?: SavingsReportLike;
}) => {
  const plannedSlots = weekDays.reduce((sum, day) => sum + mealTypes.filter((type) => {
    const val = weeklyMeals?.[day]?.[type];
    return Array.isArray(val) ? val.length > 0 : Boolean(val);
  }).length, 0);
  const totalSlots = weekDays.length * mealTypes.length;
  const unplannedDays = weekDays.filter((day) => !mealTypes.some((type) => {
    const val = weeklyMeals?.[day]?.[type];
    return Array.isArray(val) ? val.length > 0 : Boolean(val);
  }));

  const plannerGrocerySuggestions = derivePlannerGrocerySuggestions(weeklyMeals, groceryList, plannerGroceryState);
  const activePlannerGrocerySuggestions = plannerGrocerySuggestions.filter((suggestion) => !suggestion.dismissed);
  const pendingPlannerGrocerySuggestions = activePlannerGrocerySuggestions.filter((suggestion) => !suggestion.checked && !suggestion.accepted);
  const resolvedPlannerGrocerySuggestions = activePlannerGrocerySuggestions.filter((suggestion) => suggestion.checked || suggestion.accepted);
  const groceryPendingCount = groceryList.filter((item: any) => !item.checked && !item.isPantryItem).length + pendingPlannerGrocerySuggestions.length;
  const groceryCompletedCount = groceryList.filter((item: any) => item.checked && !item.isPantryItem).length + resolvedPlannerGrocerySuggestions.length;
  const groceryBuyItemCount = groceryList.filter((item: any) => !item.isPantryItem).length + activePlannerGrocerySuggestions.length;
  const groceryListCreated = groceryList.length > 0 || activePlannerGrocerySuggestions.length > 0;

  const unplannedMealSlots = Math.max(0, totalSlots - plannedSlots);
  const prepSessionPlanned = Boolean(prepSession.scheduledAt);
  const prepSessionCompleted = Boolean(prepSession.completedAt);
  const prepProgress = Math.round((prepSession.tasks.filter((task) => task.done).length / Math.max(1, prepSession.tasks.length)) * 100);
  const prepOrchestration = derivePrepSessions(weeklyMeals, prepSession.generatedPrepTaskCompletions || {});
  const generatedPrepProgress = prepOrchestration.summary.completionPercent;
  const plannedBreakfasts = weekDays.reduce((sum, day) => sum + getMealSlotItems(weeklyMeals, day, 'breakfast').length, 0);
  const prepTasksCompleted = prepSession.tasks.filter((task) => task.done).length + Object.values(prepSession.generatedPrepTaskCompletions || {}).filter(Boolean).length;
  const pantryIngredientsUsed = Math.min(10, groceryList.filter((item: any) => item?.isPantryItem && item?.completed).length);
  const leftoverFriendlyMeals = (() => {
    const matches = ['leftover', 'batch', 'reuse', 'repurpose'];
    let count = 0;
    weekDays.forEach((day) => {
      mealTypes.forEach((type) => {
        const items = getMealSlotItems(weeklyMeals, day, type);
        count += items.filter((item: any) => matches.some((token) => String(item?.name || '').toLowerCase().includes(token))).length;
      });
    });
    return count;
  })();

  const prepActiveBlockersCount = prepSession.blockers.filter((blocker) => blocker.active).length;
  const prepOverloadReduction = Math.max(0, Math.round((prepOrchestration.summary.readinessScore || 0) - (prepActiveBlockersCount * 10)));
  const blendedPrepProgress = Math.max(prepProgress, generatedPrepProgress);
  const prepRecommendationsAvailable = plannedSlots > 0;
  const prepPlanMissing = plannedSlots > 0 && !prepSessionPlanned && !prepSessionCompleted;
  const prepGroceryBlockersCount = prepSession.blockers.filter(
    (blocker) => blocker.active && GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id),
  ).length;

  const blockerItemSuggestions: BlockerItemSuggestionViewModel[] = (() => {
    if (prepGroceryBlockersCount === 0) return [];

    const activeGroceryBlockers = prepSession.blockers.filter(
      (blocker) => blocker.active && GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id),
    );
    const existingItemNames = new Set(
      [
        ...groceryList.map((item: any) => normalizeMealIngredient(item?.name || item?.item)),
        ...activePlannerGrocerySuggestions.map((suggestion: PlannerGrocerySuggestion) => normalizeMealIngredient(suggestion.name)),
      ].filter(Boolean),
    );
    const noteCandidates = prepSession.blockerNote
      .split(/[\n,;|]/)
      .flatMap((part) => part.split(/\band\b/i))
      .map((part) => part.trim())
      .filter((part) => part.length > 1)
      .map((part) => part.replace(/^[\-\d.)\s]+/, '').replace(/\s{2,}/g, ' '))
      .filter((part) => {
        const normalized = part.toLowerCase();
        return normalized.length > 2 && !BLOCKER_NOTE_STOP_WORDS.has(normalized);
      });
    const suggestionRows: Array<{ name: string; category: string; reason: string }> = [];
    noteCandidates.forEach((candidate) => suggestionRows.push({ name: candidate, category: 'From Recipe', reason: 'from prep blocker note' }));
    activeGroceryBlockers.forEach((blocker) => {
      const seedItems = BLOCKER_SUGGESTION_SEEDS_BY_ID[blocker.id] || [];
      seedItems.forEach((seed) => suggestionRows.push({
        name: seed,
        category: BLOCKER_SUGGESTION_CATEGORY_BY_ID[blocker.id] || 'Other',
        reason: blocker.label.toLowerCase(),
      }));
    });
    const uniqueByName = new Map<string, { name: string; category: string; reason: string }>();
    suggestionRows.forEach((row) => {
      const normalized = normalizeMealIngredient(row.name);
      if (!normalized) return;
      if (!uniqueByName.has(normalized)) uniqueByName.set(normalized, row);
    });
    return Array.from(uniqueByName.values()).slice(0, 6).map((row) => {
      const normalizedName = normalizeMealIngredient(row.name);
      return {
        id: normalizedName.replace(/[^a-z0-9]+/g, '-'),
        name: row.name,
        category: row.category,
        reason: row.reason,
        alreadyOnList: existingItemNames.has(normalizedName),
      };
    });
  })();

  const blockerSuggestionResolution = (() => {
    const trackedByName = new Map<string, PrepSessionLike['blockerSuggestionLinks'][number]>();
    prepSession.blockerSuggestionLinks.forEach((link) => {
      const normalized = normalizeMealIngredient(link.name);
      if (!normalized || trackedByName.has(normalized)) return;
      trackedByName.set(normalized, link);
    });
    if (trackedByName.size === 0) {
      return { tracked: [], trackedCount: 0, resolvedCount: 0, unresolvedNames: [] as string[] };
    }
    const groceryNameStatus = new Map<string, boolean>();
    groceryList.forEach((item: any) => {
      if (item?.isPantryItem) return;
      const normalized = normalizeMealIngredient(item?.name || item?.item);
      if (!normalized) return;
      const existing = groceryNameStatus.get(normalized) || false;
      groceryNameStatus.set(normalized, existing || Boolean(item?.checked));
    });
    activePlannerGrocerySuggestions.forEach((suggestion) => {
      const normalized = normalizeMealIngredient(suggestion.name);
      if (!normalized) return;
      const existing = groceryNameStatus.get(normalized) || false;
      groceryNameStatus.set(normalized, existing || Boolean(suggestion.checked || suggestion.accepted));
    });
    const tracked = Array.from(trackedByName.entries()).map(([normalizedName, link]) => ({
      ...link,
      resolved: Boolean(groceryNameStatus.get(normalizedName)),
    }));
    const resolvedCount = tracked.filter((link) => link.resolved).length;
    const unresolvedNames = tracked.filter((link) => !link.resolved).map((link) => link.name);
    return { tracked, trackedCount: tracked.length, resolvedCount, unresolvedNames };
  })();

  const blockerSuggestionConfidenceLabel = blockerSuggestionResolution.trackedCount === 0
    ? 'Not started'
    : blockerSuggestionResolution.resolvedCount === blockerSuggestionResolution.trackedCount
      ? 'High'
      : blockerSuggestionResolution.resolvedCount > 0
        ? 'Medium'
        : 'Low';
  const resolvedTrackedSuggestionNames = blockerSuggestionResolution.tracked.filter((link) => link.resolved).map((link) => link.name);
  const canResolvePrepGroceryBlockersFromSuggestions = prepGroceryBlockersCount > 0
    && blockerSuggestionResolution.trackedCount > 0
    && blockerSuggestionResolution.resolvedCount === blockerSuggestionResolution.trackedCount;
  const prepResolvedViaTrackedSuggestions = prepGroceryBlockersCount === 0
    && blockerSuggestionResolution.trackedCount > 0
    && blockerSuggestionResolution.resolvedCount === blockerSuggestionResolution.trackedCount;
  const prepCarryoverCount = prepSession.carryoverTaskIds.filter((taskId) => prepSession.tasks.some((task) => task.id === taskId && !task.done)).length;
  const prepExecutionState = !prepSessionPlanned
    ? 'not_planned'
    : prepSessionCompleted
      ? 'complete'
      : prepActiveBlockersCount > 0
        ? 'blocked'
        : blendedPrepProgress > 0
          ? 'in_progress'
          : 'in_progress';
  const prepReadyForWeek = prepSessionCompleted
    || (prepSessionPlanned
      && prepActiveBlockersCount === 0
      && (prepOrchestration.summary.totalGeneratedTasks === 0 || prepOrchestration.summary.readinessScore >= 70));
  const weekReadyNow = plannedSlots === totalSlots && (groceryBuyItemCount === 0 || groceryPendingCount === 0) && prepReadyForWeek;
  const canResolvePrepGroceryBlockers = prepGroceryBlockersCount > 0 && groceryListCreated && groceryPendingCount === 0;

  const rawSavingsSummary = savingsReport?.summary || {};
  const rawSavingsPantry = savingsReport?.pantry || {};
  const safeTopSavingCategories = Array.isArray(savingsReport?.topSavingCategories) ? savingsReport.topSavingCategories : [];
  const normalizedSavingsReport = savingsReport
    ? {
        totalSaved: Number(rawSavingsSummary.totalSaved || 0),
        savingsRate: rawSavingsSummary.savingsRate || '0%',
        pantrySavings: Number(rawSavingsPantry.savings || 0),
        pantryItemCount: Number(rawSavingsPantry.itemCount || 0),
        topSavingCategories: safeTopSavingCategories,
      }
    : null;

  return {
    plannedSlots,
    totalSlots,
    unplannedDays,
    plannerGrocerySuggestions,
    activePlannerGrocerySuggestions,
    pendingPlannerGrocerySuggestions,
    resolvedPlannerGrocerySuggestions,
    groceryPendingCount,
    groceryCompletedCount,
    groceryBuyItemCount,
    groceryListCreated,
    unplannedMealSlots,
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
    blockerItemSuggestions,
    blockerSuggestionResolution,
    blockerSuggestionConfidenceLabel,
    resolvedTrackedSuggestionNames,
    canResolvePrepGroceryBlockersFromSuggestions,
    prepResolvedViaTrackedSuggestions,
    prepCarryoverCount,
    prepExecutionState,
    prepReadyForWeek,
    weekReadyNow,
    canResolvePrepGroceryBlockers,
    normalizedSavingsReport,
  };
};
