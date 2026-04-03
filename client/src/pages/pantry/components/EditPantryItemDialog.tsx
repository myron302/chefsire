import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PantryItem } from "../lib/types";

interface EditPantryItemDialogProps {
  open: boolean;
  itemToEdit: PantryItem | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onItemChange: (item: PantryItem | null) => void;
  onSubmit: () => void;
}

export function EditPantryItemDialog({
  open,
  itemToEdit,
  isPending,
  onOpenChange,
  onItemChange,
  onSubmit,
}: EditPantryItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Pantry Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-sm font-medium">Item Name *</label>
            <Input
              value={itemToEdit?.name || ""}
              onChange={(e) => onItemChange(itemToEdit ? { ...itemToEdit, name: e.target.value } : null)}
              placeholder="e.g., Milk, Eggs"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select
              value={itemToEdit?.category || ""}
              onValueChange={(value) => onItemChange(itemToEdit ? { ...itemToEdit, category: value } : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Produce">Produce</SelectItem>
                <SelectItem value="Dairy">Dairy</SelectItem>
                <SelectItem value="Meat">Meat</SelectItem>
                <SelectItem value="Bakery">Bakery</SelectItem>
                <SelectItem value="Pantry">Pantry</SelectItem>
                <SelectItem value="Frozen">Frozen</SelectItem>
                <SelectItem value="Beverages">Beverages</SelectItem>
                <SelectItem value="Snacks">Snacks</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input
                value={itemToEdit?.quantity || ""}
                onChange={(e) => onItemChange(itemToEdit ? { ...itemToEdit, quantity: e.target.value } : null)}
                placeholder="e.g., 2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Unit</label>
              <Input
                value={itemToEdit?.unit || ""}
                onChange={(e) => onItemChange(itemToEdit ? { ...itemToEdit, unit: e.target.value } : null)}
                placeholder="e.g., lbs, pieces"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Location</label>
            <Input
              value={itemToEdit?.location || ""}
              onChange={(e) => onItemChange(itemToEdit ? { ...itemToEdit, location: e.target.value } : null)}
              placeholder="e.g., Fridge, Pantry"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Expiration Date</label>
            <Input
              type="date"
              value={itemToEdit?.expirationDate ? new Date(itemToEdit.expirationDate).toISOString().split("T")[0] : ""}
              onChange={(e) => onItemChange(itemToEdit
                ? { ...itemToEdit, expirationDate: e.target.value ? new Date(e.target.value).toISOString() : null }
                : null)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Input
              value={itemToEdit?.notes || ""}
              onChange={(e) => onItemChange(itemToEdit ? { ...itemToEdit, notes: e.target.value } : null)}
              placeholder="Optional notes"
            />
          </div>
          <Button onClick={onSubmit} className="w-full" disabled={isPending}>
            {isPending ? "Updating..." : "Update Item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
