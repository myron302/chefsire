import { useAddGroceryItemAction } from "@/components/meal-planner/hooks/grocery/useAddGroceryItemAction";
import { useGroceryExportActions } from "@/components/meal-planner/hooks/grocery/useGroceryExportActions";
import { useGroceryListActions } from "@/components/meal-planner/hooks/grocery/useGroceryListActions";
import { usePlannerGrocerySuggestionActions } from "@/components/meal-planner/hooks/grocery/usePlannerGrocerySuggestionActions";
import type { PlannerGroceryDerivationState } from "@/components/meal-planner/plannerGroceryUtils";
import type { PrepSessionState } from "@/components/meal-planner/sections/PrepTabSection";
import type { ToastFn } from "@/components/meal-planner/hooks/grocery/types";
export type { BlockerItemSuggestion } from "@/components/meal-planner/hooks/grocery/types";

type UsePlannerGroceryActionsArgs = {
  groceryList: any[];
  setGroceryList: React.Dispatch<React.SetStateAction<any[]>>;
  setPlannerGroceryState: React.Dispatch<
    React.SetStateAction<PlannerGroceryDerivationState>
  >;
  setPrepSession: React.Dispatch<React.SetStateAction<PrepSessionState>>;
  setShowAddGroceryModal: (open: boolean) => void;
  setShowShareFamilyModal: (open: boolean) => void;
  fetchGroceryList: () => Promise<void>;
  fetchFamilyMembers: () => Promise<any[]>;
  toast: ToastFn;
};

export const usePlannerGroceryActions = ({
  groceryList,
  setGroceryList,
  setPlannerGroceryState,
  setPrepSession,
  setShowAddGroceryModal,
  setShowShareFamilyModal,
  fetchGroceryList,
  fetchFamilyMembers,
  toast,
}: UsePlannerGroceryActionsArgs) => {
  const listActions = useGroceryListActions({
    groceryList,
    setGroceryList,
    setPrepSession,
    fetchGroceryList,
    toast,
  });

  const suggestionActions = usePlannerGrocerySuggestionActions({
    setPlannerGroceryState,
    addGroceryListItem: listActions.addGroceryListItem,
    fetchGroceryList,
    toast,
  });

  const exportActions = useGroceryExportActions({
    groceryList,
    setShowShareFamilyModal,
    fetchFamilyMembers,
    toast,
  });

  const addItemAction = useAddGroceryItemAction({
    addGroceryListItem: listActions.addGroceryListItem,
    fetchGroceryList,
    setShowAddGroceryModal,
    toast,
  });

  return {
    ...listActions,
    ...suggestionActions,
    ...exportActions,
    ...addItemAction,
  };
};
