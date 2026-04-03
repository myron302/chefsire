import { MapPin, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PantryItem } from "../lib/types";

interface ExpiryStatus {
  status: string;
  label: string;
  color: string;
}

interface PantryStatsDialogProps {
  showStatsDialog: "total" | "expiring" | "expired" | "runningLow" | null;
  items: PantryItem[];
  expiringItems: PantryItem[];
  getExpiryStatus: (expirationDate: string | null) => ExpiryStatus;
  addToShoppingListPending: boolean;
  onOpenChange: () => void;
  onAddExpiredItemToList: (item: PantryItem) => void;
}

export function PantryStatsDialog({
  showStatsDialog,
  items,
  expiringItems,
  getExpiryStatus,
  addToShoppingListPending,
  onOpenChange,
  onAddExpiredItemToList,
}: PantryStatsDialogProps) {
  let dialogItems: PantryItem[] = [];

  if (showStatsDialog === "total") {
    dialogItems = items;
  } else if (showStatsDialog === "expiring") {
    dialogItems = expiringItems;
  } else if (showStatsDialog === "expired") {
    dialogItems = items.filter((i) => getExpiryStatus(i.expirationDate).status === "expired");
  } else if (showStatsDialog === "runningLow") {
    dialogItems = items.filter((i) => i.isRunningLow);
  }

  return (
    <Dialog open={showStatsDialog !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {showStatsDialog === "total" && "All Pantry Items"}
            {showStatsDialog === "expiring" && "Expiring Soon"}
            {showStatsDialog === "expired" && "Expired Items"}
            {showStatsDialog === "runningLow" && "Running Low Items"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {dialogItems.length === 0 ? (
            <p className="text-muted-foreground">No items in this category.</p>
          ) : (
            dialogItems.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{item.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {item.category && <Badge variant="outline">{item.category}</Badge>}
                      {item.quantity && item.unit && <Badge variant="secondary">{item.quantity} {item.unit}</Badge>}
                      {item.location && (
                        <Badge variant="outline">
                          <MapPin className="w-3 h-3 mr-1" />
                          {item.location}
                        </Badge>
                      )}
                      {item.expirationDate && (
                        <Badge className={getExpiryStatus(item.expirationDate).color}>
                          {getExpiryStatus(item.expirationDate).label}
                        </Badge>
                      )}
                      {item.isRunningLow && (
                        <Badge className="bg-blue-100 text-blue-800">Running Low</Badge>
                      )}
                    </div>
                    {item.notes && <p className="text-sm text-muted-foreground mt-2">{item.notes}</p>}
                  </div>
                  {showStatsDialog === "expired" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddExpiredItemToList(item)}
                      disabled={addToShoppingListPending}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Add to List
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
