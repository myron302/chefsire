// components/recipes/RecipeKit.tsx
import React, {
  useEffect,
  useMemo,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Button } from "@/components/ui/button";
import { Clipboard, Check, X, Share2, RotateCcw } from 'lucide-react';

// ---------- Public Types ----------
export type Measured = { amount: number | string; unit: string; item: string; note?: string };
export type Nutrition = { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number };

export type RecipeKitHandle = {
  open: () => void;
  close: () => void;
  toggle: () => void;
};

// ---------- Props ----------
type ControlledItem = {
  id: string;
  name: string;
  measurements: Measured[];
  directions?: string[];
  baseNutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number };
  defaultServings?: number;
  prepTime?: number;
};

type AccentColor = 'amber' | 'green' | 'blue' | 'purple' | 'red' | 'pink' | 'cyan';

type RecipeKitProps = {
  // Controlled modal API
  open?: boolean;
  onClose?: () => void;
  item?: ControlledItem;
  pointsReward?: number;
  /** Tailwind color name used in className templates, e.g. `text-${accent}-700` */
  accent?: AccentColor;

  // Inline/ref API
  id?: string;
  name?: string;
  measurements?: Measured[];
  directions?: string[];
  nutrition?: Nutrition;
  prepTime?: number;
  onComplete?: () => void;

  // Shared
  shareText?: string;
  className?: string;
};

// ---------- Helpers ----------
const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));

const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = { 0: '', 1: '1/4', 2: '1/2', 3: '3/4' };
  const fracStr = fracMap[frac];
  if (!whole && fracStr) return fracStr;
  if (whole && fracStr) return `${whole} ${fracStr}`;
  return `${whole}`;
};

const scaleAmount = (baseAmount: number | string, servings: number) => {
  const n = typeof baseAmount === 'number' ? baseAmount : parseFloat(String(baseAmount));
  if (Number.isNaN(n)) return baseAmount;
  return toNiceFraction(n * servings);
};

const getScaledMeasurements = (list: Measured[], servings: number) =>
  list.map((ing) => ({
    ...ing,
    amountScaled: scaleAmount(ing.amount, servings),
    amountScaledNum: typeof ing.amount === 'number' ? (Number(ing.amount) * servings) : undefined,
  }));

const toMetric = (unit: string, amount: number) => {
  const mlPerCup = 240, mlPerTbsp = 15, mlPerTsp = 5;
  const gPerScoop30 = 30;
  switch (unit) {
    case 'cup': return { amount: Math.round(amount * mlPerCup), unit: 'ml' };
    case 'tbsp': return { amount: Math.round(amount * mlPerTbsp), unit: 'ml' };
    case 'tsp': return { amount: Math.round(amount * mlPerTsp), unit: 'ml' };
    case 'scoop (30g)': return { amount: Math.round(amount * gPerScoop30), unit: 'g' };
    case 'scoop (32g)': return { amount: Math.round(amount * 32), unit: 'g' };
    case 'tbsp (~25g)': return { amount: Math.round(amount * 25), unit: 'g' };
    default: return { amount, unit };
  }
};

const safeLoadJSON = <T,>(key: string, fallback: T): T => {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const safeSaveJSON = (key: string, value: any) => {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

// Build dynamic Tailwind classes from accent
const buildAccent = (accent: AccentColor) => {
  const a = accent || 'green';
  return {
    text700: `text-${a}-700`,
    text600: `text-${a}-600`,
    text800: `text-${a}-800`,
    bg50: `bg-${a}-50`,
    bg100: `bg-${a}-100`,
    border200: `border-${a}-200`,
    button: `bg-${a}-600 hover:bg-${a}-700`,
    check: `text-${a}-600`,
  };
};

// ---------- Component ----------
const RecipeKit = forwardRef<RecipeKitHandle, RecipeKitProps>(function RecipeKit(props, ref) {
  const {
    open: controlledOpen,
    onClose,
    item,
    pointsReward,
    accent = 'green',
    id,
    name,
    measurements,
    directions,
    nutrition,
    prepTime,
    onComplete,
    shareText,
    className,
  } = props;

  const recipeId = item?.id ?? id ?? 'rk-unknown';
  const recipeName = item?.name ?? name ?? 'Recipe';
  const recipeMeasurements = (item?.measurements ?? measurements ?? []) as Measured[];
  const recipeDirections = item?.directions ?? directions ?? [];
  const baseNutrition = item?.baseNutrition ?? nutrition ?? {};
  const basePrepTime = item?.prepTime ?? prepTime ?? 0;
  const defaultServings = item?.defaultServings ?? 1;

  const LS_SERV = `rk.servings.${recipeId}`;
  const LS_NOTES = `rk.notes.${recipeId}`;
  const LS_METRIC = `rk.metric.${recipeId}`;

  const [servings, setServings] = useState<number>(defaultServings || 1);
  const [notes, setNotes] = useState<string>('');
  const [useMetric, setUseMetric] = useState<boolean>(false);
  const [showAllIngredients, setShowAllIngredients] = useState<boolean>(false);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<number>>(new Set());

  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen! : internalOpen;

  useImperativeHandle(ref, () => ({
    open: () => (isControlled ? console.warn('RecipeKit: open() called in controlled mode; use the parent state.') : setInternalOpen(true)),
    close: () => (isControlled ? onClose?.() : setInternalOpen(false)),
    toggle: () => {
      if (isControlled) {
        if (open) onClose?.(); else console.warn('RecipeKit: toggle() in controlled mode — set open in parent.');
      } else {
        setInternalOpen(v => !v);
      }
    },
  }), [isControlled, open, onClose]);

  useEffect(() => {
    setServings(clamp(safeLoadJSON<number>(LS_SERV, defaultServings || 1)));
    setNotes(safeLoadJSON<string>(LS_NOTES, ''));
    setUseMetric(safeLoadJSON<boolean>(LS_METRIC, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  useEffect(() => { safeSaveJSON(LS_SERV, servings); }, [LS_SERV, servings]);
  useEffect(() => { safeSaveJSON(LS_NOTES, notes); }, [LS_NOTES, notes]);
  useEffect(() => { safeSaveJSON(LS_METRIC, useMetric); }, [LS_METRIC, useMetric]);

  const bumpServings = (delta: number) => setServings((s) => clamp(s + delta));
  const resetServings = () => setServings(defaultServings || 1);

  const scaled = useMemo(() => getScaledMeasurements(recipeMeasurements, servings), [recipeMeasurements, servings]);

  const scaledMacros = useMemo(() => {
    const n = baseNutrition || {};
    const s = servings || 1;
    return {
      calories: n.calories ? Math.round(n.calories * s) : undefined,
      protein: n.protein ? Math.round(n.protein * s) : undefined,
      carbs: n.carbs ? Math.round(n.carbs * s) : undefined,
      fat: n.fat ? Math.round(n.fat * s) : undefined,
      fiber: n.fiber ? Math.round(n.fiber * s) : undefined,
    };
  }, [baseNutrition, servings]);

  // Dynamic classes
  const C = useMemo(() => buildAccent(accent), [accent]);

  const copyScaledRecipe = async () => {
    const lines = scaled.map((ing) => {
      if (useMetric && typeof ing.amountScaledNum === 'number') {
        const m = toMetric(ing.unit, ing.amountScaledNum);
        return `- ${m.amount} ${m.unit} ${ing.item}${ing.note ? ` — ${ing.note}` : ''}`;
      }
      return `- ${ing.amountScaled} ${ing.unit} ${ing.item}${ing.note ? ` — ${ing.note}` : ''}`;
    });
    const txt = `${recipeName} (serves ${servings})\n${lines.join('\n')}\n\nNotes: ${notes || '-'}`;
    try {
      await navigator.clipboard.writeText(txt);
      alert('Recipe copied!');
    } catch {
      alert('Unable to copy on this device.');
    }
  };

  const doShare = async () => {
    const preview = scaled.slice(0, 4).map((r) =>
      `${typeof r.amountScaledNum === 'number' && useMetric
        ? `${toMetric(r.unit, r.amountScaledNum).amount} ${toMetric(r.unit, r.amountScaledNum).unit}`
        : `${r.amountScaled} ${r.unit}`
      } ${r.item}`).join(' · ');
    const text = shareText || `${recipeName} — serves ${servings}\n${preview}${scaled.length > 4 ? ` …plus ${scaled.length - 4} more` : ''}`;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const data = { title: recipeName, text, url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(`${recipeName}\n${text}\n${url}`);
        alert('Recipe link copied!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${recipeName}\n${text}\n${url}`);
        alert('Recipe link copied!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const toggleIngredient = (index: number) => {
    setSelectedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const addSelectedToShoppingList = () => {
    const selected = scaled.filter((_, idx) => selectedIngredients.has(idx));
    if (selected.length === 0) {
      alert('Please select at least one ingredient to add to your shopping list.');
      return;
    }

    // Format ingredients for shopping list
    const shoppingItems = selected.map((ing) => {
      const amount = useMetric && typeof ing.amountScaledNum === 'number'
        ? toMetric(ing.unit, ing.amountScaledNum).amount
        : ing.amountScaled;
      const unit = useMetric && typeof ing.amountScaledNum === 'number'
        ? toMetric(ing.unit, ing.amountScaledNum).unit
        : ing.unit;

      return {
        name: ing.item,
        quantity: typeof amount === 'number' ? amount : parseFloat(String(amount)) || 1,
        unit: unit,
        note: ing.note
      };
    });

    // Store in localStorage for the Pantry to pick up
    try {
      const existing = JSON.parse(localStorage.getItem('pendingShoppingListItems') || '[]');
      localStorage.setItem('pendingShoppingListItems', JSON.stringify([...existing, ...shoppingItems]));
      alert(`Added ${shoppingItems.length} ingredient${shoppingItems.length > 1 ? 's' : ''} to shopping list! Go to Pantry page → Shopping List tab to view.`);
      setSelectedIngredients(new Set()); // Clear selections
    } catch (err) {
      console.error('Error adding to shopping list:', err);
      alert('Unable to add to shopping list.');
    }
  };

  const shouldRenderPreview = !isControlled && recipeMeasurements.length > 0;
  const hasMoreThan5Ingredients = recipeMeasurements.length > 5;
  const displayIngredients = showAllIngredients ? scaled : scaled.slice(0, 5);

  return (
    <div className={className}>
      {/* --------- PREVIEW --------- */}
      {shouldRenderPreview && (
        <div className="mb-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-900">
              Recipe (serves {servings})
            </div>
            <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
              <button
                aria-label="decrease servings"
                onClick={() => bumpServings(-1)}
                className="px-2 py-1 text-sm hover:bg-gray-100"
              >−</button>
              <div className="px-3 py-1 text-sm border-l border-r border-gray-300">{servings}</div>
              <button
                aria-label="increase servings"
                onClick={() => bumpServings(+1)}
                className="px-2 py-1 text-sm hover:bg-gray-100"
              >+</button>
            </div>
          </div>

          <ul className="text-sm leading-6 text-gray-800 space-y-1">
            {displayIngredients.map((ing, i) => (
              <li key={i} className="flex gap-2">
                <span className={`${C.text600} font-medium min-w-[90px]`}>
                  {typeof ing.amountScaledNum === 'number' && useMetric
                    ? `${toMetric(ing.unit, ing.amountScaledNum).amount} ${toMetric(ing.unit, ing.amountScaledNum).unit}`
                    : `${ing.amountScaled} ${ing.unit}`
                  }
                </span>
                <span className="flex-1">
                  {ing.item}{ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                </span>
              </li>
            ))}
            {hasMoreThan5Ingredients && !showAllIngredients && (
              <div className="text-xs text-gray-600 mt-1">
                <button
                  type="button"
                  onClick={() => setShowAllIngredients(true)}
                  className="underline underline-offset-2 hover:text-gray-800"
                >
                  Show more ({scaled.length - 5} more ingredients)
                </button>
              </div>
            )}
            {hasMoreThan5Ingredients && showAllIngredients && (
              <div className="text-xs text-gray-600 mt-1">
                <button
                  type="button"
                  onClick={() => setShowAllIngredients(false)}
                  className="underline underline-offset-2 hover:text-gray-800"
                >
                  Show less
                </button>
              </div>
            )}
          </ul>

          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={copyScaledRecipe}><Clipboard className="w-4 h-4 mr-1" /> Copy</Button>
            <Button variant="outline" size="sm" onClick={doShare}><Share2 className="w-4 h-4 mr-1" /> Share</Button>
            <Button variant="outline" size="sm" onClick={() => setUseMetric(v => !v)}>
              {useMetric ? 'US' : 'Metric'}
            </Button>
          </div>
        </div>
      )}

      {/* --------- MODAL --------- */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => (isControlled ? onClose?.() : setInternalOpen(false))}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{recipeName}</h2>
              <button
                onClick={() => (isControlled ? onClose?.() : setInternalOpen(false))}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Nutrition Grid - ALL COLORS NOW USE ACCENT VIA TEMPLATE CLASSES */}
            <div className={`grid grid-cols-3 gap-2 p-3 ${C.bg50} rounded-lg mb-4`}>
              <div className="text-center">
                <div className={`font-bold ${C.text600}`}>
                  {scaledMacros.protein ?? '—'}{scaledMacros.protein ? 'g' : ''}
                </div>
                <div className="text-xs">Protein</div>
              </div>
              <div className="text-center">
                <div className={`font-bold ${C.text600}`}>{scaledMacros.calories ?? '—'}</div>
                <div className="text-xs">Calories</div>
              </div>
              <div className="text-center">
                <div className={`font-bold ${C.text600}`}>{(basePrepTime ?? 0)}min</div>
                <div className="text-xs">Prep</div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Recipe • {servings} {servings === 1 ? 'serving' : 'servings'}</h3>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 border rounded text-sm" onClick={() => bumpServings(-1)}>−</button>
                <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                <button className="px-2 py-1 border rounded text-sm" onClick={() => bumpServings(+1)}>+</button>
                <Button variant="outline" size="sm" onClick={resetServings}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset</Button>
                <Button variant="outline" size="sm" onClick={() => setUseMetric(v => !v)}>{useMetric ? 'US' : 'Metric'}</Button>
              </div>
            </div>

            <ul className="space-y-2 text-base leading-6 text-gray-800 font-sans tracking-normal">
              {scaled.map((ing, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIngredients.has(idx)}
                    onChange={() => toggleIngredient(idx)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex-1">
                    <span className={`${C.text600} font-semibold`}>
                      {typeof ing.amountScaledNum === 'number' && useMetric
                        ? `${toMetric(ing.unit, ing.amountScaledNum).amount} ${toMetric(ing.unit, ing.amountScaledNum).unit}`
                        : `${ing.amountScaled} ${ing.unit}`
                      }
                    </span>{" "}
                    {ing.item}{ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                  </span>
                </li>
              ))}
            </ul>

            {selectedIngredients.size > 0 && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                  onClick={addSelectedToShoppingList}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Add {selectedIngredients.size} Selected to Shopping List
                </Button>
              </div>
            )}

            {recipeDirections.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2 text-gray-900">Directions</h3>
                <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
                  {recipeDirections.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </div>
            )}

            <div className="mt-4">
              <h3 className="font-semibold mb-2 text-gray-900">Your Notes</h3>
              <textarea
                className="w-full border rounded-md p-2 text-sm text-gray-800"
                rows={3}
                placeholder="Add tweaks, swaps, or how it turned out…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                className={`${C.button} flex-1 text-white`}
                onClick={() => {
                  onComplete?.();
                  if (isControlled) onClose?.();
                  else setInternalOpen(false);
                }}
              >
                Complete{pointsReward ? ` (+${pointsReward} XP)` : ''}
              </Button>
              <Button variant="outline" onClick={copyScaledRecipe}><Clipboard className="w-4 h-4 mr-1" /> Copy</Button>
              <Button variant="outline" onClick={doShare}><Share2 className="w-4 h-4 mr-1" /> Share</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default RecipeKit;
