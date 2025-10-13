// components/recipes/RecipeKit.tsx
import React, { useEffect, useMemo, useState, useImperativeHandle } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Clipboard, Check, X, Share2, BookMarked } from 'lucide-react';

// ---------- Types ----------
export type Measured = { amount: number | string; unit: string; item: string; note?: string };
export type Nutrition = { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number };

type RecipeKitProps = {
  /** stable unique id per recipe (used for localStorage) */
  id: string;
  /** display title for the recipe */
  name: string;
  /** ingredient measurements (base amounts for 1 serving) */
  measurements: Measured[];
  /** optional directions list */
  directions?: string[];
  /** base macros for 1 serving */
  nutrition?: Nutrition;
  /** minutes */
  prepTime?: number;
  /** called when user taps "Complete" in modal */
  onComplete?: () => void;
  /** optional share text (fallbacks to a distilled default) */
  shareText?: string;
  /** optional className to wrap the preview */
  className?: string;

  /**
   * Optional cookbook integration (future-proof).
   * If provided, an "Add to Cookbook" button appears in the modal footer.
   */
  onSaveToCookbook?: (item: any) => void;
  /** The normalized item to save (only used if onSaveToCookbook is provided) */
  normalizedItem?: any;
  /** Optional label override for cookbook button */
  saveLabel?: string;
};

export type RecipeKitHandle = {
  open: () => void;
  close: () => void;
  toggle: () => void;
};

// ---------- Helpers ----------
const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));

// convert decimals to neat quarters (1/4, 1/2, 3/4)
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
  if (Number.isNaN(n)) return baseAmount; // strings like "1 pinch" remain as-is
  return toNiceFraction(n * servings);
};

const getScaledMeasurements = (list: Measured[], servings: number) =>
  list.map((ing) => ({
    ...ing,
    amountScaled: scaleAmount(ing.amount, servings),
    amountScaledNum: typeof ing.amount === 'number' ? (Number(ing.amount) * servings) : undefined,
  }));

// basic US -> metric conversion (extend as desired)
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

// localStorage helpers
const loadJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const saveJSON = (key: string, value: any) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

// ---------- Component ----------
const RecipeKit = React.forwardRef<RecipeKitHandle, RecipeKitProps>(function RecipeKit(props, ref) {
  const {
    id, name, measurements, directions = [], nutrition = {}, prepTime = 0, onComplete,
    shareText, className,
    onSaveToCookbook, normalizedItem, saveLabel = 'Add to Cookbook'
  } = props;

  // per-recipe persisted state
  const LS_SERV = `rk.servings.${id}`;
  const LS_NOTES = `rk.notes.${id}`;
  const LS_METRIC = `rk.metric.${id}`;

  const [servings, setServings] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [useMetric, setUseMetric] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  // expose imperative API (non-breaking)
  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(v => !v),
  }), []);

  useEffect(() => {
    setServings(clamp(loadJSON<number>(LS_SERV, 1)));
    setNotes(loadJSON<string>(LS_NOTES, ''));
    setUseMetric(loadJSON<boolean>(LS_METRIC, false));
  }, []);
  useEffect(() => { saveJSON(LS_SERV, servings); }, [servings]);
  useEffect(() => { saveJSON(LS_NOTES, notes); }, [notes]);
  useEffect(() => { saveJSON(LS_METRIC, useMetric); }, [useMetric]);

  const bumpServings = (delta: number) => setServings((s) => clamp(s + delta));
  const resetServings = () => setServings(1);

  const scaled = useMemo(() => getScaledMeasurements(measurements, servings), [measurements, servings]);

  const scaledMacros = useMemo(() => {
    const n = nutrition || {};
    const s = servings || 1;
    return {
      calories: n.calories ? Math.round(n.calories * s) : undefined,
      protein: n.protein ? Math.round(n.protein * s) : undefined,
      carbs: n.carbs ? Math.round(n.carbs * s) : undefined,
      fat: n.fat ? Math.round(n.fat * s) : undefined,
      fiber: n.fiber ? Math.round(n.fiber * s) : undefined,
    };
  }, [nutrition, servings]);

  const copyScaledRecipe = async () => {
    const lines = scaled.map((ing) => {
      // prefer metric if possible and we have numeric base
      if (useMetric && typeof ing.amountScaledNum === 'number') {
        const m = toMetric(ing.unit, ing.amountScaledNum);
        return `- ${m.amount} ${m.unit} ${ing.item}${(ing as any).note ? ` — ${(ing as any).note}` : ''}`;
      }
      // fallback to US scaled fraction
      return `- ${ing.amountScaled} ${ing.unit} ${ing.item}${(ing as any).note ? ` — ${(ing as any).note}` : ''}`;
    });
    const txt = `${name} (serves ${servings})\n${lines.join('\n')}\n\nNotes: ${notes || '-'}`;
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
    const text = shareText || `${name} — serves ${servings}\n${preview}${scaled.length > 4 ? ` …plus ${scaled.length - 4} more` : ''}`;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const data = { title: name, text, url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(`${name}\n${text}\n${url}`);
        alert('Recipe link copied!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${name}\n${text}\n${url}`);
        alert('Recipe link copied!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const handleSaveToCookbook = () => {
    if (onSaveToCookbook && normalizedItem) {
      try {
        onSaveToCookbook(normalizedItem);
        alert('Saved to Cookbook!');
      } catch {
        alert('Unable to save to Cookbook.');
      }
    }
  };

  return (
    <div className={className}>
      {/* PREVIEW (card inline) */}
      <div className="mb-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-900">
            Recipe (serves {servings})
          </div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 border rounded text-sm" onClick={() => bumpServings(-1)} aria-label="decrease servings">−</button>
            <div className="min-w-[2ch] text-center text-sm">{servings}</div>
            <button className="px-2 py-1 border rounded text-sm" onClick={() => bumpServings(+1)} aria-label="increase servings">+</button>
            <button className="px-2 py-1 border rounded text-sm flex items-center gap-1" onClick={resetServings} title="Reset to 1">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>

        <ul className="text-base leading-6 text-gray-800 space-y-1 font-sans tracking-normal">
          {scaled.slice(0, 4).map((ing, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 mt-0.5" />
              <span>
                <span className="text-green-700 font-semibold">
                  {typeof ing.amountScaledNum === 'number' && useMetric
                    ? `${toMetric(ing.unit, ing.amountScaledNum).amount} ${toMetric(ing.unit, ing.amountScaledNum).unit}`
                    : `${ing.amountScaled} ${ing.unit}`
                  }
                </span>{" "}
                {ing.item}{(ing as any).note ? <span className="text-gray-600 italic"> — {(ing as any).note}</span> : null}
              </span>
            </li>
          ))}
          {scaled.length > 4 && (
            <li className="text-sm text-gray-600">
              …plus {scaled.length - 4} more{" "}
              <button
                className="underline underline-offset-2 hover:no-underline"
                onClick={() => setOpen(true)}
                aria-label="Show more ingredients"
              >
                Show more
              </button>
            </li>
          )}
        </ul>

        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Open Recipe</Button>
          <Button variant="outline" size="sm" onClick={copyScaledRecipe}><Clipboard className="w-4 h-4 mr-1" /> Copy</Button>
          <Button variant="outline" size="sm" onClick={doShare}><Share2 className="w-4 h-4 mr-1" /> Share</Button>
          <Button variant="outline" size="sm" onClick={() => setUseMetric(v => !v)}>
            {useMetric ? 'US' : 'Metric'}
          </Button>
        </div>
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{name}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700" aria-label="Close">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* stats strip */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-green-50 rounded-lg mb-4">
              <div className="text-center">
                <div className="font-bold text-green-600">
                  {scaledMacros.protein ?? '—'}{scaledMacros.protein ? 'g' : ''}
                </div>
                <div className="text-xs text-gray-600">Protein</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-blue-600">{scaledMacros.calories ?? '—'}</div>
                <div className="text-xs text-gray-600">Calories</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-purple-600">{prepTime ?? 0}min</div>
                <div className="text-xs text-gray-600">Prep</div>
              </div>
            </div>

            {/* servings + toggles */}
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

            {/* full list */}
            <ul className="space-y-2 text-base leading-6 text-gray-800 font-sans tracking-normal">
              {scaled.map((ing, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>
                    <span className="text-green-700 font-semibold">
                      {typeof ing.amountScaledNum === 'number' && useMetric
                        ? `${toMetric(ing.unit, ing.amountScaledNum).amount} ${toMetric(ing.unit, ing.amountScaledNum).unit}`
                        : `${ing.amountScaled} ${ing.unit}`
                      }
                    </span>{" "}
                    {ing.item}{(ing as any).note ? <span className="text-gray-600 italic"> — {(ing as any).note}</span> : null}
                  </span>
                </li>
              ))}
            </ul>

            {directions.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2 text-gray-900">Directions</h3>
                <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
                  {directions.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </div>
            )}

            {/* notes */}
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

            <div className="flex flex-wrap gap-2 mt-4">
              <Button className="flex-1" onClick={() => { onComplete?.(); setOpen(false); }}>
                Complete
              </Button>
              <Button variant="outline" onClick={copyScaledRecipe}><Clipboard className="w-4 h-4 mr-1" /> Copy</Button>
              <Button variant="outline" onClick={doShare}><Share2 className="w-4 h-4 mr-1" /> Share</Button>
              {onSaveToCookbook && normalizedItem && (
                <Button variant="outline" onClick={handleSaveToCookbook}>
                  <BookMarked className="w-4 h-4 mr-1" />
                  {saveLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default RecipeKit;
