import React from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type MealItemFormRow = {
  id: string;
  name: string;
  quantity: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  notes: string;
};

type MealForm = {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  servingSize: string;
  servingQty: number;
  mealItems: MealItemFormRow[];
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
  onSelectedMealTypeChange?: (mealType: string) => void;
  onToggleRecentMeals: () => void;
  onToggleFavorite: (meal: MealHistoryItem) => void;
  onServingQtyChange: (qty: number) => void;
  onAddToPlanner: () => void;
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const createMealItemRow = (overrides: Partial<MealItemFormRow> = {}): MealItemFormRow => ({
  id: `meal-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  quantity: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  notes: '',
  ...overrides,
});

const toNumber = (value: string | number | undefined) => Number(value) || 0;

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
  onSelectedMealTypeChange,
  onToggleRecentMeals,
  onToggleFavorite,
  onServingQtyChange,
  onAddToPlanner,
}: AddMealModalProps) => {
  const itemRows = mealForm.mealItems?.length ? mealForm.mealItems : [createMealItemRow()];
  const totals = itemRows.reduce((acc, item) => ({
    calories: acc.calories + toNumber(item.calories),
    protein: acc.protein + toNumber(item.protein),
    carbs: acc.carbs + toNumber(item.carbs),
    fat: acc.fat + toNumber(item.fat),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const updateMealItem = (id: string, updates: Partial<MealItemFormRow>) => {
    onMealFormChange((prev) => ({
      ...prev,
      mealItems: (prev.mealItems?.length ? prev.mealItems : itemRows).map((item) => (
        item.id === id ? { ...item, ...updates } : item
      )),
    }));
  };

  const addMealItem = () => {
    onMealFormChange((prev) => ({
      ...prev,
      mealItems: [...(prev.mealItems?.length ? prev.mealItems : itemRows), createMealItemRow()],
    }));
  };

  const removeMealItem = (id: string) => {
    onMealFormChange((prev) => {
      const currentItems = prev.mealItems?.length ? prev.mealItems : itemRows;
      if (currentItems.length <= 1) return prev;
      return { ...prev, mealItems: currentItems.filter((item) => item.id !== id) };
    });
  };

  const fillFromHistory = (meal: MealHistoryItem) => {
    onMealFormChange((prev) => ({
      ...prev,
      name: meal.name,
      calories: String(meal.calories || ''),
      protein: String(meal.protein || ''),
      carbs: String(meal.carbs || ''),
      fat: String(meal.fat || ''),
      fiber: String(meal.fiber || ''),
      mealItems: [createMealItemRow({
        name: meal.name,
        quantity: prev.servingSize || '1 serving',
        calories: String(meal.calories || ''),
        protein: String(meal.protein || ''),
        carbs: String(meal.carbs || ''),
        fat: String(meal.fat || ''),
      })],
    }));
  };

  React.useEffect(() => {
    if (!open) return;
    if (!mealForm.mealItems?.length) {
      onMealFormChange((prev) => ({ ...prev, mealItems: [createMealItemRow()] }));
    }
  }, [open, mealForm.mealItems?.length, onMealFormChange]);

  React.useEffect(() => {
    const firstItem = itemRows[0];
    if (!firstItem) return;

    const firstItemIsEmpty = !firstItem.name && !firstItem.calories && !firstItem.protein && !firstItem.carbs && !firstItem.fat;
    if (firstItemIsEmpty && (mealForm.calories || mealForm.protein || mealForm.carbs || mealForm.fat)) {
      updateMealItem(firstItem.id, {
        name: mealForm.name,
        quantity: mealForm.servingSize || '1 serving',
        calories: mealForm.calories,
        protein: mealForm.protein,
        carbs: mealForm.carbs,
        fat: mealForm.fat,
      });
    }
  }, [mealForm.calories, mealForm.protein, mealForm.carbs, mealForm.fat]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xl font-bold">
            Add Meal {selectedMealSlot && `— ${selectedMealSlot.day} · ${selectedMealSlot.type}`}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          Save one calendar meal with multiple foods/components. Totals update live from the item rows below.
        </p>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Meal Title *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 border rounded px-3 py-2 text-sm"
                  placeholder="e.g., Chicken Rice Bowl"
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
            <div>
              <label className="block text-sm font-medium mb-2">Meal Type / Time</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm bg-white capitalize"
                value={selectedMealSlot?.type || 'breakfast'}
                onChange={(e) => onSelectedMealTypeChange?.(e.target.value)}
                disabled={!selectedMealSlot || !onSelectedMealTypeChange}
              >
                {MEAL_TYPES.map((mealType) => (
                  <option key={mealType} value={mealType}>{mealType}</option>
                ))}
              </select>
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
                        onClick={() => fillFromHistory(meal)}
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
              <label className="block text-sm font-medium mb-2">Default Serving Size</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="e.g., 1 bowl, 1 plate"
                value={mealForm.servingSize}
                onChange={e => onMealFormChange(p => ({ ...p, servingSize: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Serving multiplier
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

          {(baseNutrition || mealForm.calories || mealForm.protein) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
              <p className="text-xs text-orange-700">
                Nutrition lookup fills the first item row for backwards-compatible single-item meals. Add more rows for sides, sauces, drinks, and snacks.
              </p>
            </div>
          )}

          <div className="border rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Meal Items / Components</h4>
                <p className="text-xs text-gray-500">Add each food, serving quantity, nutrition, and optional notes.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addMealItem}>
                <Plus className="w-4 h-4 mr-1" /> Add item
              </Button>
            </div>
            <div className="divide-y">
              {itemRows.map((item, index) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">Item {index + 1}</Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => removeMealItem(item.id)}
                      disabled={itemRows.length <= 1}
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Item name *</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Chicken breast" value={item.name || ''} onChange={e => updateMealItem(item.id, { name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="4 oz" value={item.quantity || ''} onChange={e => updateMealItem(item.id, { quantity: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Calories</label>
                      <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="180" value={item.calories || ''} onChange={e => updateMealItem(item.id, { calories: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Protein (g)</label>
                      <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="30" value={item.protein || ''} onChange={e => updateMealItem(item.id, { protein: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Carbs (g)</label>
                      <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="0" value={item.carbs || ''} onChange={e => updateMealItem(item.id, { carbs: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fat (g)</label>
                      <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="4" value={item.fat || ''} onChange={e => updateMealItem(item.id, { fat: e.target.value })} />
                    </div>
                    <div className="md:col-span-5">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400 font-normal">optional</span></label>
                      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g., grilled, no oil, sauce on side" value={item.notes || ''} onChange={e => updateMealItem(item.id, { notes: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-orange-900">Meal Total</h4>
              <span className="text-xs text-orange-700">{itemRows.length} item{itemRows.length === 1 ? '' : 's'}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="bg-white rounded-lg p-3 border"><div className="text-lg font-bold text-gray-900">{totals.calories}</div><div className="text-xs text-gray-500">Calories</div></div>
              <div className="bg-white rounded-lg p-3 border"><div className="text-lg font-bold text-blue-600">{totals.protein}g</div><div className="text-xs text-gray-500">Protein</div></div>
              <div className="bg-white rounded-lg p-3 border"><div className="text-lg font-bold text-orange-600">{totals.carbs}g</div><div className="text-xs text-gray-500">Carbs</div></div>
              <div className="bg-white rounded-lg p-3 border"><div className="text-lg font-bold text-purple-600">{totals.fat}g</div><div className="text-xs text-gray-500">Fat</div></div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={onAddToPlanner}
            >
              Add Meal to Planner
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
