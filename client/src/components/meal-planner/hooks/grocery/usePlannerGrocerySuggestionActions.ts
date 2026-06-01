import { useCallback } from "react";
import type {
  PlannerGroceryDerivationState,
  PlannerGrocerySuggestion,
} from "@/components/meal-planner/plannerGroceryUtils";
import type {
  AddGroceryListItem,
  ToastFn,
} from "@/components/meal-planner/hooks/grocery/types";

type UsePlannerGrocerySuggestionActionsArgs = {
  setPlannerGroceryState: React.Dispatch<
    React.SetStateAction<PlannerGroceryDerivationState>
  >;
  addGroceryListItem: AddGroceryListItem;
  fetchGroceryList: () => Promise<void>;
  toast: ToastFn;
};

export const usePlannerGrocerySuggestionActions = ({
  setPlannerGroceryState,
  addGroceryListItem,
  fetchGroceryList,
  toast,
}: UsePlannerGrocerySuggestionActionsArgs) => {
  const updatePlannerGroceryState = useCallback(
    (
      updater: (
        prev: PlannerGroceryDerivationState,
      ) => PlannerGroceryDerivationState,
    ) => {
      setPlannerGroceryState((prev) =>
        updater({
          dismissedIds: prev.dismissedIds || [],
          checkedIds: prev.checkedIds || [],
          acceptedIds: prev.acceptedIds || [],
          editedById: prev.editedById || {},
        }),
      );
    },
    [setPlannerGroceryState],
  );

  const acceptPlannerGrocerySuggestion = useCallback(
    async (suggestion: PlannerGrocerySuggestion) => {
      if (suggestion.accepted || suggestion.onManualList) {
        toast({
          description: `“${suggestion.name}” is already represented on your grocery list.`,
        });
        return;
      }
      try {
        const response = await addGroceryListItem({
          ingredientName: suggestion.name,
          quantity: suggestion.quantitySummary || "1",
          unit: "",
          category: suggestion.category || "From Recipe",
          notes: `Generated from planner meals: ${suggestion.linkedMealNames.slice(0, 4).join(", ")}`,
        });
        if (!response.ok)
          throw new Error("Failed to accept planner grocery suggestion");
        updatePlannerGroceryState((prev) => ({
          ...prev,
          acceptedIds: Array.from(
            new Set([...(prev.acceptedIds || []), suggestion.id]),
          ),
          dismissedIds: (prev.dismissedIds || []).filter(
            (id) => id !== suggestion.id,
          ),
        }));
        toast({
          description: `✅ Added “${suggestion.name}” from planner grocery intelligence.`,
        });
        await fetchGroceryList();
      } catch (error) {
        console.error("Error accepting planner grocery suggestion:", error);
        toast({
          variant: "destructive",
          description: "Failed to add generated grocery item",
        });
      }
    },
    [addGroceryListItem, fetchGroceryList, toast, updatePlannerGroceryState],
  );

  const dismissPlannerGrocerySuggestion = useCallback(
    (suggestion: PlannerGrocerySuggestion) => {
      updatePlannerGroceryState((prev) => ({
        ...prev,
        dismissedIds: Array.from(
          new Set([...(prev.dismissedIds || []), suggestion.id]),
        ),
        checkedIds: (prev.checkedIds || []).filter(
          (id) => id !== suggestion.id,
        ),
      }));
    },
    [updatePlannerGroceryState],
  );

  const togglePlannerGrocerySuggestion = useCallback(
    (suggestion: PlannerGrocerySuggestion) => {
      updatePlannerGroceryState((prev) => {
        const checked = new Set(prev.checkedIds || []);
        if (checked.has(suggestion.id)) checked.delete(suggestion.id);
        else checked.add(suggestion.id);
        return { ...prev, checkedIds: Array.from(checked) };
      });
    },
    [updatePlannerGroceryState],
  );

  const editPlannerGrocerySuggestion = useCallback(
    (suggestion: PlannerGrocerySuggestion) => {
      const nextName = window
        .prompt("Grocery item name", suggestion.name)
        ?.trim();
      if (nextName === undefined || !nextName) return;
      const nextQuantity = window
        .prompt("Suggested quantity", suggestion.quantitySummary)
        ?.trim();
      const quantitySummary =
        nextQuantity === undefined ? suggestion.quantitySummary : nextQuantity;
      updatePlannerGroceryState((prev) => ({
        ...prev,
        editedById: {
          ...(prev.editedById || {}),
          [suggestion.id]: {
            ...(prev.editedById || {})[suggestion.id],
            name: nextName,
            quantitySummary,
            category: suggestion.category,
          },
        },
      }));
    },
    [updatePlannerGroceryState],
  );

  return {
    updatePlannerGroceryState,
    acceptPlannerGrocerySuggestion,
    dismissPlannerGrocerySuggestion,
    togglePlannerGrocerySuggestion,
    editPlannerGrocerySuggestion,
  };
};
