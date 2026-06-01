import { useCallback } from "react";
import type {
  AddGroceryListItem,
  ToastFn,
} from "@/components/meal-planner/hooks/grocery/types";

type GroceryItemFormValues = {
  itemName: string | undefined;
  itemAmount: string | undefined;
  itemCategory: string | undefined;
};

type UseAddGroceryItemActionArgs = {
  addGroceryListItem: AddGroceryListItem;
  fetchGroceryList: () => Promise<void>;
  setShowAddGroceryModal: (open: boolean) => void;
  toast: ToastFn;
};

const getAddGroceryItemFormValues = (): GroceryItemFormValues => ({
  itemName: (document.getElementById("groceryItemName") as HTMLInputElement)
    ?.value,
  itemAmount: (
    document.getElementById("groceryItemAmount") as HTMLInputElement
  )?.value,
  itemCategory: (
    document.getElementById("groceryItemCategory") as HTMLSelectElement
  )?.value,
});

export const useAddGroceryItemAction = ({
  addGroceryListItem,
  fetchGroceryList,
  setShowAddGroceryModal,
  toast,
}: UseAddGroceryItemActionArgs) => {
  const handleAddGroceryItem = useCallback(async () => {
    const { itemName, itemAmount, itemCategory } = getAddGroceryItemFormValues();

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

  return { handleAddGroceryItem };
};
