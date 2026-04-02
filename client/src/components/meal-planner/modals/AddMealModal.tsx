import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

type MealForm = {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  servingSize: string;
  servingQty: number;
};

type BaseNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  servingSize: string;
};

type MealHistoryItem = {
  id: string | number;
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  isFavorite?: boolean;
};

type AddMealModalProps = {
  open: boolean;
  selectedMealSlot: { day: string; type: string } | null;
  mealForm: MealForm;
  baseNutrition: BaseNutrition | null;
  isLookingUpNutrition: boolean;
  showRecentMeals: boolean;
  mealHistory: MealHistoryItem[];
  onClose: () => void;
  onLookupNutrition: () => void;
  onMealFormChange: React.Dispatch<React.SetStateAction<MealForm>>;
  onToggleRecentMeals: () => void;
  onToggleFavorite: (meal: MealHistoryItem) => void;
  onServingQtyChange: (qty: number) => void;
  onAddToPlanner: () => void;
};

const AddMealModal = ({
  open,
  selectedMealSlot,
  mealForm,
  baseNutrition,
  isLookingUpNutrition,
  showRecentMeals,
  mealHistory,
  onClose,
  onLookupNutrition,
  onMealFormChange,
  onToggleRecentMeals,
  onToggleFavorite,
  onServingQtyChange,
  onAddToPlanner,
}: AddMealModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xl font-bold">
            Add Meal {selectedMealSlot && `— ${selectedMealSlot.day} · ${selectedMealSlot.type}`}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <p className="text-xs text-gray-500 mb-5">Type the meal name, then tap <span className="font-semibold text-orange-600">✨ AI Lookup</span> to auto-fill nutrition.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Meal Name *</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border rounded px-3 py-2 text-sm"
                placeholder="e.g., Grilled Chicken Salad"
                value={mealForm.name}
                onChange={e => onMealFormChange(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') onLookupNutrition(); }}
              />
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400"
                onClick={onLookupNutrition}
                disabled={isLookingUpNutrition || !mealForm.name.trim()}
              >
                {isLookingUpNutrition ? (
                  <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 animate-pulse" />Looking up…</span>
                ) : (
                  <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />✨ AI Lookup</span>
                )}
              </Button>
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <button className="text-sm font-medium flex items-center justify-between w-full" onClick={onToggleRecentMeals}>
              <span>Recent & Favorites</span>
              <span>{showRecentMeals ? '−' : '+'}</span>
            </button>
            {showRecentMeals && (
              <div className="mt-3 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {mealHistory.map((meal) => (
                    <div key={meal.id} className="flex items-center gap-1">
                      <button
                        className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-orange-100 text-xs"
                        onClick={() => onMealFormChange((p) => ({ ...p, name: meal.name, calories: String(meal.calories || ''), protein: String(meal.protein || ''), carbs: String(meal.carbs || ''), fat: String(meal.fat || ''), fiber: String(meal.fiber || '') }))}
                      >
                        {meal.isFavorite ? '⭐ ' : ''}{meal.name}
                      </button>
                      <button
                        className="text-yellow-500 text-xs"
                        onClick={() => onToggleFavorite(meal)}
                      >
                        {meal.isFavorite ? '★' : '☆'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">Serving Size</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="e.g., 1 cup, 1 egg"
                value={mealForm.servingSize}
                onChange={e => onMealFormChange(p => ({ ...p, servingSize: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                How many servings?
                {baseNutrition && (
                  <span className="ml-1 font-normal text-orange-600 text-xs">
                    (× {mealForm.servingQty})
                  </span>
                )}
              </label>
              <select
                className="w-full border rounded px-3 py-2 text-sm bg-white"
                value={mealForm.servingQty}
                onChange={e => onServingQtyChange(Number(e.target.value))}
              >
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(q => (
                  <option key={q} value={q}>
                    {q === 0.25 ? '¼ serving' : q === 0.5 ? '½ serving' : q === 0.75 ? '¾ serving' : q === 1 ? '1 serving' : q === 1.25 ? '1¼ servings' : q === 1.5 ? '1½ servings' : `${q} servings`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {baseNutrition && mealForm.servingQty !== 1 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <p className="text-xs font-medium text-orange-700">
                  {mealForm.servingQty} × {mealForm.servingSize || 'serving'} · macros scaled automatically
                </p>
              </div>
              <div className="flex gap-3 text-xs text-orange-600">
                <span>Base: {baseNutrition.calories} cal</span>
                <span>→ Total: <strong>{mealForm.calories} cal</strong></span>
              </div>
            </div>
          )}

          {!baseNutrition && (mealForm.calories || mealForm.protein) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
              <p className="text-xs text-orange-700">Nutrition filled in — change servings above to auto-scale, or edit any field manually.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Calories</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="450" value={mealForm.calories} onChange={e => onMealFormChange(p => ({ ...p, calories: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Protein (g)</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="35" value={mealForm.protein} onChange={e => onMealFormChange(p => ({ ...p, protein: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Carbs (g)</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="45" value={mealForm.carbs} onChange={e => onMealFormChange(p => ({ ...p, carbs: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fat (g)</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="15" value={mealForm.fat} onChange={e => onMealFormChange(p => ({ ...p, fat: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fiber (g) <span className="text-gray-400 font-normal">optional</span></label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="4" value={mealForm.fiber} onChange={e => onMealFormChange(p => ({ ...p, fiber: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={onAddToPlanner}
            >
              Add to Planner
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMealModal;
