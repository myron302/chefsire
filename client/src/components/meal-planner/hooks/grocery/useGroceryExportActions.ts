import { useCallback } from "react";
import { exportCSV, exportText } from "@/lib/shoppingExport";
import { toGroceryExportItems } from "@/components/meal-planner/nutritionMealPlannerUtils";
import type { ToastFn } from "@/components/meal-planner/hooks/grocery/types";

type UseGroceryExportActionsArgs = {
  groceryList: any[];
  setShowShareFamilyModal: (open: boolean) => void;
  fetchFamilyMembers: () => Promise<any[]>;
  toast: ToastFn;
};

export const useGroceryExportActions = ({
  groceryList,
  setShowShareFamilyModal,
  fetchFamilyMembers,
  toast,
}: UseGroceryExportActionsArgs) => {
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

  return {
    exportGroceryList,
    shareWithFamily,
    copyGroceryListToClipboard,
  };
};
