import { useCallback } from "react";
import { exportCSV, exportText } from "@/lib/shoppingExport";
import {
  toGroceryExportItems,
  formatLocalDate,
} from "@/components/meal-planner/nutritionMealPlannerUtils";
import {
  normalizeMealIngredient,
  type PlannerGroceryDerivationState,
  type PlannerGrocerySuggestion,
} from "@/components/meal-planner/plannerGroceryUtils";
import type { PrepSessionState } from "@/components/meal-planner/sections/PrepTabSection";

export type BlockerItemSuggestion = {
  id: string;
  name: string;
  category: string;
  reason: string;
  alreadyOnList: boolean;
};

type ToastFn = (options: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

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
  const addGroceryListItem = useCallback(
    async (payload: {
      ingredientName: string;
      quantity: string;
      unit: string;
      category: string;
      notes?: string;
    }) =>
      fetch("/api/meal-planner/grocery-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }),
    [],
  );

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

  const exportGroceryList = useCallback(async () => {
    if (groceryList.length === 0) {
      toast({ variant: "destructive", description: "No items to export" });
      return;
    }

    try {
      const itemsToExport = toGroceryExportItems(groceryList);
      await exportCSV(
        itemsToExport,
        `shopping-list-${new Date().toISOString().split("T")[0]}.csv`,
      );
      toast({ description: "✅ Shopping list exported successfully!" });
    } catch (error) {
      console.error("Error exporting list:", error);
      toast({
        variant: "destructive",
        description: "Failed to export shopping list",
      });
    }
  }, [groceryList, toast]);

  const optimizeShoppingList = useCallback(async () => {
    try {
      const response = await fetch("/api/meal-planner/grocery-list/optimized", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to optimize list");
      const data = await response.json();
      const optimizedItems = data.optimized.flatMap((group: any) =>
        group.items.map((item: any) => ({
          id: item.id,
          item: item.ingredientName,
          name: item.ingredientName,
          amount:
            item.quantity && item.unit
              ? `${item.quantity} ${item.unit}`
              : item.quantity || "",
          category: item.category || "Other",
          checked: item.purchased || false,
          notes: item.notes,
        })),
      );
      setGroceryList(optimizedItems);
      toast({ description: "🛒 Shopping list optimized by store layout!" });
    } catch (error) {
      console.error("Error optimizing list:", error);
      toast({
        variant: "destructive",
        description: "Failed to optimize shopping list",
      });
    }
  }, [setGroceryList, toast]);

  const addBlockerSuggestionToGrocery = useCallback(
    async (suggestion: BlockerItemSuggestion) => {
      if (suggestion.alreadyOnList) {
        toast({
          description: `“${suggestion.name}” is already on your grocery list.`,
        });
        return;
      }

      try {
        const response = await addGroceryListItem({
          ingredientName: suggestion.name,
          quantity: "1",
          unit: "",
          category: suggestion.category,
          notes: `Prep blocker suggestion: ${suggestion.reason}`,
        });
        if (!response.ok)
          throw new Error("Failed to add blocker suggestion item");

        toast({
          description: `✅ Added "${suggestion.name}" from prep blocker suggestions.`,
        });
        setPrepSession((prev) => {
          const normalizedName = normalizeMealIngredient(suggestion.name);
          const alreadyTracked = prev.blockerSuggestionLinks.some(
            (link) =>
              link.suggestionId === suggestion.id ||
              normalizeMealIngredient(link.name) === normalizedName,
          );
          if (alreadyTracked) return prev;
          return {
            ...prev,
            blockerSuggestionLinks: [
              ...prev.blockerSuggestionLinks,
              {
                suggestionId: suggestion.id,
                name: suggestion.name,
                category: suggestion.category,
                reason: suggestion.reason,
                addedAt: formatLocalDate(new Date()),
              },
            ],
          };
        });
        await fetchGroceryList();
      } catch (error) {
        console.error("Error adding blocker suggestion:", error);
        toast({
          variant: "destructive",
          description: "Failed to add suggested blocker item",
        });
      }
    },
    [addGroceryListItem, fetchGroceryList, setPrepSession, toast],
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

  const toggleGroceryItem = useCallback(
    async (index: number) => {
      const item = groceryList[index];
      if (!item) return;
      try {
        const response = await fetch(
          `/api/meal-planner/grocery-list/${item.id}/purchase`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ toggle: true }),
          },
        );
        if (response.ok) {
          const result = await response.json();
          setGroceryList((prev: any) =>
            prev.map((item: any, i: number) =>
              i === index ? { ...item, checked: result.item.purchased } : item,
            ),
          );
        } else {
          throw new Error("Failed to toggle item");
        }
      } catch (error) {
        console.error("Error toggling grocery item:", error);
        toast({
          variant: "destructive",
          description: "Failed to update item status",
        });
      }
    },
    [groceryList, setGroceryList, toast],
  );

  const shareWithFamily = useCallback(async () => {
    try {
      if (groceryList.length === 0) {
        toast({
          variant: "destructive",
          description: "No items in grocery list to share",
        });
        return;
      }
      const members = await fetchFamilyMembers();
      if (members.length === 0) {
        toast({
          title: "No family members found",
          description:
            "Add family members in the Allergies section first to share your grocery list.",
        });
        return;
      }
      setShowShareFamilyModal(true);
    } catch (error) {
      console.error("Error in shareWithFamily:", error);
      toast({
        variant: "destructive",
        description: "Failed to open share dialog",
      });
    }
  }, [fetchFamilyMembers, groceryList.length, setShowShareFamilyModal, toast]);

  const copyGroceryListToClipboard = useCallback(async () => {
    try {
      const itemsToExport = toGroceryExportItems(groceryList);
      const textContent = await exportText(itemsToExport);
      await navigator.clipboard.writeText(textContent);
      toast({ description: "✅ Grocery list copied to clipboard!" });
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast({
        variant: "destructive",
        description: "Failed to copy to clipboard",
      });
    }
  }, [groceryList, toast]);

  const handleAddGroceryItem = useCallback(async () => {
    const itemName = (
      document.getElementById("groceryItemName") as HTMLInputElement
    )?.value;
    const itemAmount = (
      document.getElementById("groceryItemAmount") as HTMLInputElement
    )?.value;
    const itemCategory = (
      document.getElementById("groceryItemCategory") as HTMLSelectElement
    )?.value;

    if (!itemName) {
      toast({
        variant: "destructive",
        description: "Please enter an item name",
      });
      return;
    }

    try {
      let quantity = itemAmount || "1";
      let unit = "";
      const match = itemAmount?.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
      if (match) {
        quantity = match[1];
        unit = match[2];
      }
      const payload = {
        ingredientName: itemName,
        quantity,
        unit,
        category: itemCategory || "Other",
      };
      console.log("Adding grocery item:", payload);
      const response = await addGroceryListItem(payload);
      if (response.ok) {
        const result = await response.json();
        console.log("Item added successfully:", result);
        toast({ description: `✅ ${itemName} added to grocery list!` });
        setShowAddGroceryModal(false);
        await fetchGroceryList();
      } else {
        const errorText = await response.text();
        console.error("Failed to add item:", response.status, errorText);
        throw new Error("Failed to add item");
      }
    } catch (error) {
      console.error("Error adding grocery item:", error);
      toast({
        variant: "destructive",
        description: "Failed to add item to grocery list",
      });
    }
  }, [addGroceryListItem, fetchGroceryList, setShowAddGroceryModal, toast]);

  return {
    addGroceryListItem,
    addBlockerSuggestionToGrocery,
    updatePlannerGroceryState,
    acceptPlannerGrocerySuggestion,
    dismissPlannerGrocerySuggestion,
    togglePlannerGrocerySuggestion,
    editPlannerGrocerySuggestion,
    toggleGroceryItem,
    shareWithFamily,
    copyGroceryListToClipboard,
    handleAddGroceryItem,
    exportGroceryList,
    optimizeShoppingList,
  };
};
