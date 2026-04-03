import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addFormItemToGroceryList, addPantryItem } from "../lib/api";
import type { PantryFormData } from "../lib/types";

export function AddItemForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    quantity: "",
    unit: "",
    location: "",
    expirationDate: "",
    notes: "",
  });
  const [alsoAddToShoppingList, setAlsoAddToShoppingList] = useState(false);

  const { data: userData } = useQuery({
    queryKey: ["/api/user"],
  });
  const isPremium = userData?.nutritionPremium || false;

  const addMutation = useMutation({
    mutationFn: async (data: PantryFormData) => {
      const pantryResponse = await addPantryItem(data);

      if (alsoAddToShoppingList && isPremium) {
        await addFormItemToGroceryList(data);
      }

      return pantryResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/expiring-soon"] });
      if (alsoAddToShoppingList && isPremium) {
        queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
        toast({ title: "Item added to pantry and shopping list!" });
      } else {
        toast({ title: "Item added to pantry!" });
      }
      setFormData({
        name: "",
        category: "",
        quantity: "",
        unit: "",
        location: "",
        expirationDate: "",
        notes: "",
      });
      setAlsoAddToShoppingList(false);
      onSuccess();
    },
    onError: (error: Error) => {
      console.error("Error adding pantry item:", error);
      toast({ title: error.message || "Failed to add item", variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Item name is required", variant: "destructive" });
      return;
    }
    addMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Item Name *</label>
        <Input
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Milk, Eggs, Flour"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Quantity</label>
          <Input
            type="number"
            step="0.01"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            placeholder="2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Unit</label>
          <Input
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            placeholder="cups, lbs, oz"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Category</label>
        <Input
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="Dairy, Produce, Meat, etc."
        />
      </div>

      <div>
        <label className="text-sm font-medium">Location</label>
        <Select value={formData.location} onValueChange={(val) => setFormData({ ...formData, location: val })}>
          <SelectTrigger>
            <SelectValue placeholder="Where is it stored?" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fridge">Fridge</SelectItem>
            <SelectItem value="freezer">Freezer</SelectItem>
            <SelectItem value="pantry">Pantry</SelectItem>
            <SelectItem value="spice-rack">Spice Rack</SelectItem>
            <SelectItem value="counter">Counter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">Expiration Date</label>
        <Input
          type="date"
          value={formData.expirationDate}
          onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Notes</label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Optional notes..."
        />
      </div>

      {isPremium && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <input
            type="checkbox"
            id="alsoAddToShoppingList"
            checked={alsoAddToShoppingList}
            onChange={(e) => setAlsoAddToShoppingList(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="alsoAddToShoppingList" className="text-sm font-medium cursor-pointer">
            ✨ Also add to shopping list (for future purchases)
          </label>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={addMutation.isPending}>
        {addMutation.isPending ? "Adding..." : "Add Item"}
      </Button>
    </form>
  );
}
