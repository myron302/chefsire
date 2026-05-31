import { derivePlannerGrocerySuggestions, type PlannerGroceryDerivationState } from '@/components/meal-planner/plannerGroceryUtils';

export type SavingsReportLike = {
  summary?: { totalSaved?: number | string; savingsRate?: string };
  pantry?: { savings?: number | string; itemCount?: number | string };
  topSavingCategories?: unknown[];
} | null | undefined;

export const buildGroceryReadinessPresentation = ({
  weeklyMeals,
  groceryList,
  plannerGroceryState,
}: {
  weeklyMeals: any;
  groceryList: any[];
  plannerGroceryState: PlannerGroceryDerivationState;
}) => {
  const plannerGrocerySuggestions = derivePlannerGrocerySuggestions(weeklyMeals, groceryList, plannerGroceryState);
  const activePlannerGrocerySuggestions = plannerGrocerySuggestions.filter((suggestion) => !suggestion.dismissed);
  const pendingPlannerGrocerySuggestions = activePlannerGrocerySuggestions.filter((suggestion) => !suggestion.checked && !suggestion.accepted);
  const resolvedPlannerGrocerySuggestions = activePlannerGrocerySuggestions.filter((suggestion) => suggestion.checked || suggestion.accepted);
  const groceryPendingCount = groceryList.filter((item: any) => !item.checked && !item.isPantryItem).length + pendingPlannerGrocerySuggestions.length;
  const groceryCompletedCount = groceryList.filter((item: any) => item.checked && !item.isPantryItem).length + resolvedPlannerGrocerySuggestions.length;
  const groceryBuyItemCount = groceryList.filter((item: any) => !item.isPantryItem).length + activePlannerGrocerySuggestions.length;
  const groceryListCreated = groceryList.length > 0 || activePlannerGrocerySuggestions.length > 0;

  return {
    plannerGrocerySuggestions,
    activePlannerGrocerySuggestions,
    pendingPlannerGrocerySuggestions,
    resolvedPlannerGrocerySuggestions,
    groceryPendingCount,
    groceryCompletedCount,
    groceryBuyItemCount,
    groceryListCreated,
  };
};

export const normalizeSavingsReportForGrocery = (savingsReport?: SavingsReportLike) => {
  const rawSavingsSummary = savingsReport?.summary || {};
  const rawSavingsPantry = savingsReport?.pantry || {};
  const safeTopSavingCategories = Array.isArray(savingsReport?.topSavingCategories) ? savingsReport.topSavingCategories : [];

  return savingsReport
    ? {
        totalSaved: Number(rawSavingsSummary.totalSaved || 0),
        savingsRate: rawSavingsSummary.savingsRate || '0%',
        pantrySavings: Number(rawSavingsPantry.savings || 0),
        pantryItemCount: Number(rawSavingsPantry.itemCount || 0),
        topSavingCategories: safeTopSavingCategories,
      }
    : null;
};
