import React from 'react';
import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type PantryMeal = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type PantryModalProps = {
  open: boolean;
  onClose: () => void;
  onAddMeal: (meal: PantryMeal) => void;
};

const pantryItems = ['Chicken Breast', 'Rice', 'Eggs', 'Pasta', 'Tomatoes', 'Spinach', 'Cheese', 'Beans', 'Potatoes'];

const suggestedMeals: PantryMeal[] = [
  { name: 'Chicken Fried Rice', calories: 420, protein: 32, carbs: 48, fat: 14 },
  { name: 'Pasta Primavera', calories: 380, protein: 18, carbs: 52, fat: 12 },
];

const PantryModal = ({ open, onClose, onAddMeal }: PantryModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-green-500" />
            Use Pantry Items
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>

        <p className="text-gray-600 mb-6">Select ingredients from your pantry to generate meal suggestions:</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {pantryItems.map((item) => (
            <label key={item} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" className="w-4 h-4" />
              <span className="text-sm">{item}</span>
            </label>
          ))}
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">Suggested Meals:</h4>
          {suggestedMeals.map((meal, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
              <div>
                <h5 className="font-medium">{meal.name}</h5>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{meal.calories} cal</Badge>
                  <Badge variant="secondary" className="text-xs">P: {meal.protein}g</Badge>
                </div>
              </div>
              <Button size="sm" onClick={() => onAddMeal(meal)}>
                Add
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full mt-6" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default PantryModal;
