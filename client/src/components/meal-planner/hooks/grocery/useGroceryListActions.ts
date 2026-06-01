import { useCallback } from "react";
import { formatLocalDate } from "@/components/meal-planner/nutritionMealPlannerUtils";
import { normalizeMealIngredient } from "@/components/meal-planner/plannerGroceryUtils";
import type { PrepSessionState } from "@/components/meal-planner/sections/PrepTabSection";
import type {
  AddGroceryListItemPayload,
  BlockerItemSuggestion,
  ToastFn,
} from "@/components/meal-planner/hooks/grocery/types";

type UseGroceryListActionsArgs = {
  groceryList: any[];
  setGroceryList: React.Dispatch<React.SetStateAction<any[]>>;
  setPrepSession: React.Dispatch<React.SetStateAction<PrepSessionState>>;
  fetchGroceryList: () => Promise<void>;
  toast: ToastFn;
};

export const useGroceryListActions = ({
  groceryList,
  setGroceryList,
  setPrepSession,
  fetchGroceryList,
  toast,
}: UseGroceryListActionsArgs) => {
  const addGroceryListItem = useCallback(
    async (payload: AddGroceryListItemPayload) =>
      fetch("/api/meal-planner/grocery-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }),
    [],
  );

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

  return {
    addGroceryListItem,
    addBlockerSuggestionToGrocery,
    toggleGroceryItem,
    optimizeShoppingList,
  };
};
