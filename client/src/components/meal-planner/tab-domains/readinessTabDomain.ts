import { normalizeMealIngredient, type PlannerGroceryDerivationState, type PlannerGrocerySuggestion } from '@/components/meal-planner/plannerGroceryUtils';
import { buildGroceryReadinessPresentation, normalizeSavingsReportForGrocery, type SavingsReportLike } from '@/components/meal-planner/tab-domains/groceryTabDomain';
import { buildPrepReadinessPresentation, GROCERY_LINKED_PREP_BLOCKER_IDS, type PrepSessionLike } from '@/components/meal-planner/tab-domains/prepTabDomain';


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

export type BlockerItemSuggestionViewModel = {
  id: string;
  name: string;
  category: string;
  reason: string;
  alreadyOnList: boolean;
};

export const buildReadinessTabDomain = ({
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

  const {
    plannerGrocerySuggestions,
    activePlannerGrocerySuggestions,
    pendingPlannerGrocerySuggestions,
    resolvedPlannerGrocerySuggestions,
    groceryPendingCount,
    groceryCompletedCount,
    groceryBuyItemCount,
    groceryListCreated,
  } = buildGroceryReadinessPresentation({ weeklyMeals, groceryList, plannerGroceryState });

  const unplannedMealSlots = Math.max(0, totalSlots - plannedSlots);
  const {
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
  } = buildPrepReadinessPresentation({ weeklyMeals, weekDays, mealTypes, groceryList, prepSession, plannedSlots });

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
  const weekReadyNow = plannedSlots === totalSlots && (groceryBuyItemCount === 0 || groceryPendingCount === 0) && prepReadyForWeek;
  const canResolvePrepGroceryBlockers = prepGroceryBlockersCount > 0 && groceryListCreated && groceryPendingCount === 0;

  const normalizedSavingsReport = normalizeSavingsReportForGrocery(savingsReport);

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
