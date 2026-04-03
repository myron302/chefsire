import { AlertCircle, AlertTriangle, Calendar, DollarSign, Edit, MapPin, Package, Plus, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { PantryItem } from "../lib/types";

interface ExpiryStatus {
  status: string;
  label: string;
  color: string;
}

interface PantryInventorySectionProps {
  filteredItems: PantryItem[];
  searchQuery: string;
  filterCategory: string;
  selectedItems: Set<string>;
  getExpiryStatus: (expirationDate: string | null) => ExpiryStatus;
  getItemWarnings: (itemId: string) => any[];
  onToggleItemSelection: (itemId: string) => void;
  onEditItem: (item: PantryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onToggleRunningLow: (item: PantryItem) => void;
  onShowAddDialog: () => void;
}

export function PantryInventorySection({
  filteredItems,
  searchQuery,
  filterCategory,
  selectedItems,
  getExpiryStatus,
  getItemWarnings,
  onToggleItemSelection,
  onEditItem,
  onDeleteItem,
  onToggleRunningLow,
  onShowAddDialog,
}: PantryInventorySectionProps) {
  if (filteredItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold mb-2">
            {searchQuery || filterCategory !== "all" ? "No items found" : "Your pantry is empty"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || filterCategory !== "all"
              ? "Try adjusting your filters"
              : "Start tracking your ingredients to reduce waste and discover recipes"}
          </p>
          {!searchQuery && filterCategory === "all" && (
            <Button onClick={onShowAddDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Item
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredItems.map((item) => {
        const expiryStatus = getExpiryStatus(item.expirationDate);
        const itemWarnings = getItemWarnings(item.id);

        return (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <Checkbox
                  checked={selectedItems.has(item.id)}
                  onCheckedChange={() => onToggleItemSelection(item.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.category && (
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                    )}
                    {itemWarnings.map((warning: any, idx: number) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className={`text-xs ${
                          warning.severity === "life-threatening" || warning.severity === "severe"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : "bg-yellow-100 text-yellow-800 border-yellow-300"
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {warning.allergen} ({warning.memberName})
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => onEditItem(item)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    onClick={() => onDeleteItem(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 text-sm ml-9">
                {item.quantity && item.unit && (
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">{item.quantity} {item.unit}</span>
                  </div>
                )}

                {item.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">{item.location}</span>
                  </div>
                )}

                {item.expirationDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-muted-foreground text-sm">
                        Expires {format(new Date(item.expirationDate), "MMM d, yyyy")}
                      </span>
                      <Badge className={`text-xs ${expiryStatus.color} ml-auto`}>
                        {expiryStatus.label}
                      </Badge>
                    </div>
                  </div>
                )}

                {item.estimatedCost && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">${item.estimatedCost}</span>
                  </div>
                )}

                {item.householdId && (
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <Badge variant="secondary" className="text-xs">
                      Household Item
                    </Badge>
                  </div>
                )}
              </div>

              {item.notes && (
                <p className="mt-3 text-sm text-muted-foreground border-t pt-2 ml-9">
                  {item.notes}
                </p>
              )}

              <div className="mt-3 border-t pt-3 ml-9">
                <Button
                  size="sm"
                  variant={item.isRunningLow ? "default" : "outline"}
                  className="w-full"
                  onClick={() => onToggleRunningLow(item)}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {item.isRunningLow ? "Running Low ✓" : "Mark as Running Low"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
