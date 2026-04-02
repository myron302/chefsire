import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AddGroceryItemModalProps = {
  open: boolean;
  onClose: () => void;
  onAddItem: () => void;
};

const AddGroceryItemModal = ({ open, onClose, onAddItem }: AddGroceryItemModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-green-500" />
            Add Grocery Item
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Item Name *</label>
            <input
              id="groceryItemName"
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., Chicken Breast"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <input
              id="groceryItemAmount"
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., 2 lbs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              id="groceryItemCategory"
              className="w-full border rounded px-3 py-2"
            >
              <option value="Protein">Protein</option>
              <option value="Produce">Produce</option>
              <option value="Grains">Grains</option>
              <option value="Dairy">Dairy</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button className="flex-1" onClick={onAddItem}>
              Add Item
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddGroceryItemModal;
