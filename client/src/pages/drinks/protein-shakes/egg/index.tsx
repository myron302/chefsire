import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Target, Heart, Star, Zap, Leaf, Apple, Wine, Sparkles, FlaskConical,
  Dumbbell, Droplets, Search, ArrowLeft, Moon, X, Check, Camera, ArrowRight,
  Share2, Plus, RotateCcw, Clipboard
} from 'lucide-react';

import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';

/* =========================
   Helpers (JS-friendly)
   ========================= */
const m = (amount, unit, item, note = '') => ({ amount, unit, item, note });
const clamp = (n, min = 1, max = 8) => Math.max(min, Math.min(max, n));
const toNiceFraction = (value) => {
  const rounded = Math.round(value * 4) / 4; // quarters
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const map = { 0: '', 1: '1/4', 2: '1/2', 3: '3/4' };
  const fracStr = map[frac];
  if (!whole && fracStr) return fracStr;
  if (whole && fracStr) return `${whole} ${fracStr}`;
  return `${whole}`;
};
const scaleAmount = (baseAmount, servings) => {
  const n = typeof baseAmount === 'number' ? baseAmount : parseFloat(String(baseAmount));
  if (Number.isNaN(n)) return baseAmount;
  return toNiceFraction(n * servings);
};
const getScaledMeasurements = (list, servings) =>
  (list || []).map((ing) => ({ ...ing, amountScaled: scaleAmount(ing.amount, servings) }));

// LocalStorage helpers
const LS_SERVINGS_KEY = 'eggProtein.servingsById';
const LS_NOTES_KEY = 'eggProtein.notesById';
const loadJSON = (key, fallback) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const saveJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

/* =========================
   Navigation data
   ========================= */
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const proteinSubcategories = [
  { id: 'whey', name: 'Whey Protein', icon: Zap, path: '/drinks/protein-shakes/whey', description: 'Fast absorption' },
  { id: 'plant', name: 'Plant-Based', icon: Leaf, path: '/drinks/protein-shakes/plant-based', description: 'Vegan friendly' },
  { id: 'casein', name: 'Casein', icon: Moon, path: '/drinks/protein-shakes/casein', description: 'Slow release' },
  { id: 'collagen', name: 'Collagen', icon: Sparkles, path: '/drinks/protein-shakes/collagen', description: 'Beauty support' },
  { id: 'beef', name: 'Beef Protein', icon: Dumbbell, path: '/drinks/protein-shakes/beef', description: 'Natural creatine' }
];

/* =========================
   Egg Protein Recipes (with measurements)
   ========================= */
const eggProteinRecipes = [
  {
    id: 'egg-1',
    name: 'Classic Egg White Power',
    protein: 28, carbs: 15, calories: 210,
    difficulty: 'Easy', prepTime: 3, rating: 4.7, reviews: 156,
    tags: ['Lactose-Free', 'Post-Workout', 'Muscle Building'],
    benefits: ['Complete amino acids', 'Easy digestion', 'No lactose'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg white protein'),
        m(1, 'cup', 'unsweetened almond milk'),
        m(0.5, 'whole', 'banana', 'frozen for texture'),
        m(0.25, 'cup', 'quick oats'),
        m(0.25, 'tsp', 'cinnamon'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Add milk, protein, oats, banana, cinnamon, then ice.',
        'Blend 40–60 seconds until smooth.'
      ]
    }
  },
  {
    id: 'egg-2',
    name: 'Vanilla Egg Protein Delight',
    protein: 30, carbs: 20, calories: 240,
    difficulty: 'Easy', prepTime: 2, rating: 4.8, reviews: 203,
    tags: ['High Protein', 'Morning Boost', 'Muscle Recovery'],
    benefits: ['Sustained energy', 'Rich in BCAAs', 'Smooth texture'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.75, 'cup', 'low-fat Greek yogurt'),
        m(0.5, 'cup', 'skim milk or almond milk'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'honey or stevia', 'to taste'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend yogurt and milk first for 10–15 seconds.',
        'Add remaining ingredients and blend until silky.'
      ]
    }
  },
  {
    id: 'egg-3',
    name: 'Berry Egg Fusion',
    protein: 26, carbs: 18, calories: 220,
    difficulty: 'Easy', prepTime: 4, rating: 4.6, reviews: 187,
    tags: ['Antioxidants', 'Recovery', 'Lactose-Free'],
    benefits: ['Antioxidant rich', 'Anti-inflammatory', 'Heart health'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.75, 'cup', 'coconut water'),
        m(0.75, 'cup', 'frozen mixed berries'),
        m(1, 'tbsp', 'chia seeds'),
        m(1, 'tsp', 'lemon juice'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend all ingredients until smooth.',
        'Pulse instead of blend fully if you like berry bits.'
      ]
    }
  },
  {
    id: 'egg-4',
    name: 'Chocolate Egg Protein Shake',
    protein: 32, carbs: 22, calories: 260,
    difficulty: 'Easy', prepTime: 3, rating: 4.9, reviews: 245,
    tags: ['Indulgent', 'Post-Workout', 'Strength'],
    benefits: ['Muscle growth', 'Energy boost', 'Great taste'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'tbsp', 'natural peanut butter'),
        m(1, 'tbsp', 'unsweetened cocoa powder'),
        m(0.5, 'whole', 'banana'),
        m(1, 'cup', 'milk of choice'),
        m(5, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend milk + protein first 10 seconds.',
        'Add peanut butter, cocoa, banana, ice and blend thick.'
      ]
    }
  },
  {
    id: 'egg-5',
    name: 'Green Egg Power Smoothie',
    protein: 27, carbs: 16, calories: 205,
    difficulty: 'Medium', prepTime: 5, rating: 4.5, reviews: 134,
    tags: ['Detox', 'Nutrient-Dense', 'Alkalizing'],
    benefits: ['Nutrient-dense', 'Digestive health', 'Clean protein'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'cup', 'water'),
        m(1, 'cup', 'kale, loosely packed'),
        m(0.25, 'whole', 'avocado'),
        m(0.5, 'whole', 'apple', 'cored'),
        m(1, 'tbsp', 'lemon juice'),
        m(5, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend greens and water first.',
        'Add protein, avocado, apple, lemon, ice—blend smooth.'
      ]
    }
  },
  {
    id: 'egg-6',
    name: 'Tropical Egg Protein',
    protein: 29, carbs: 25, calories: 250,
    difficulty: 'Easy', prepTime: 3, rating: 4.7, reviews: 178,
    tags: ['Tropical', 'Anti-Inflammatory', 'Recovery'],
    benefits: ['Tropical flavor', 'Anti-inflammatory', 'Immune boost'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.5, 'cup', 'frozen mango'),
        m(0.5, 'cup', 'frozen pineapple'),
        m(0.75, 'cup', 'light coconut milk'),
        m(0.25, 'tsp', 'ground turmeric'),
        m(1, 'tsp', 'maple syrup', 'optional'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend all until creamy and bright.',
        'Add extra coconut milk to thin if needed.'
      ]
    }
  },
  // Extras
  {
    id: 'egg-7',
    name: 'Espresso Egg Boost',
    protein: 28, carbs: 12, calories: 190,
    difficulty: 'Easy', prepTime: 3, rating: 4.6, reviews: 121,
    tags: ['Morning Boost', 'Focus', 'Low Sugar'],
    benefits: ['Caffeine + protein synergy', 'Smooth energy'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'shot (30–45ml)', 'espresso', 'cooled'),
        m(0.75, 'cup', 'unsweetened almond milk'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'honey or stevia', 'to taste'),
        m(5, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend milk + espresso + protein first.',
        'Add sweetener, vanilla, ice; blend frothy.'
      ]
    }
  },
  {
    id: 'egg-8',
    name: 'Cinnamon Roll Egg Shake',
    protein: 30, carbs: 28, calories: 280,
    difficulty: 'Easy', prepTime: 4, rating: 4.8, reviews: 164,
    tags: ['Comfort', 'Dessert Vibes', 'Post-Workout'],
    benefits: ['Satisfying flavor', 'Recovery friendly'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein (vanilla)'),
        m(1, 'cup', 'oat milk'),
        m(0.25, 'cup', 'rolled oats'),
        m(1, 'tsp', 'cinnamon'),
        m(0.25, 'tsp', 'nutmeg'),
        m(1, 'tsp', 'maple syrup', 'to taste'),
        m(5, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend milk, oats and spices 15 seconds.',
        'Add protein, sweetener, ice; blend thick.'
      ]
    }
  },
  {
    id: 'egg-9',
    name: 'Citrus Greens Egg Refresher',
    protein: 26, carbs: 14, calories: 200,
    difficulty: 'Easy', prepTime: 4, rating: 4.5, reviews: 102,
    tags: ['Refreshing', 'Low Cal', 'Lactose-Free'],
    benefits: ['Hydrating', 'Micronutrient rich'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'cup', 'cold water or coconut water'),
        m(1, 'cup', 'spinach, loosely packed'),
        m(0.5, 'whole', 'orange', 'peeled'),
        m(0.5, 'whole', 'cucumber'),
        m(1, 'tsp', 'lime juice'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend greens + liquid first.',
        'Add protein, citrus, cucumber, ice; blend smooth.'
      ]
    }
  }
];

/* =========================
   Benefits list
   ========================= */
const eggProteinBenefits = [
  { icon: Target, title: 'Complete Protein', description: 'All 9 essential amino acids in optimal ratios', color: 'text-yellow-500' },
  { icon: Droplets, title: 'Lactose-Free', description: 'Great if dairy causes bloating', color: 'text-yellow-500' },
  { icon: Zap, title: 'Medium Absorption', description: 'Steady release for recovery', color: 'text-yellow-500' },
  { icon: Heart, title: 'Heart Friendly', description: 'Naturally low in saturated fat', color: 'text-yellow-500' },
  { icon: Dumbbell, title: 'Muscle Building', description: 'High biological value (BV ≈ 100)', color: 'text-yellow-500' },
];

/* =========================
   Component
   ========================= */
export default function EggProteinPage() {
  const {
    userProgress, addPoints, incrementDrinksMade,
    addToFavorites, isFavorite, addToRecentlyViewed
  } = useDrinks();

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [filterTag, setFilterTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Persisted servings + notes per recipe
  const [servingsById, setServingsById] = useState({});
  const [notesById, setNotesById] = useState({});

  useEffect(() => {
    setServingsById(loadJSON(LS_SERVINGS_KEY, {}));
    setNotesById(loadJSON(LS_NOTES_KEY, {}));
  }, []);
  useEffect(() => { saveJSON(LS_SERVINGS_KEY, servingsById); }, [servingsById]);
  useEffect(() => { saveJSON(LS_NOTES_KEY, notesById); }, [notesById]);

  const getServings = (id) => clamp(servingsById[id] ?? 1);
  const setServings = (id, n) => setServingsById((prev) => ({ ...prev, [id]: clamp(n) }));
  const bumpServings = (id, delta) => setServings(id, getServings(id) + delta);
  const resetServings = (id) => setServings(id, 1);

  // All tags list
  const allTags = ['All', ...new Set(eggProteinRecipes.flatMap(r => r.tags))];

  // Filtering & sorting
  const getFilteredRecipes = () => {
    let filtered = eggProteinRecipes.filter(recipe => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        recipe.name.toLowerCase().includes(q) ||
        (recipe.recipe?.measurements || []).some(ing => `${ing.item} ${ing.unit}`.toLowerCase().includes(q));
      const matchesTag = filterTag === 'All' || recipe.tags.includes(filterTag);
      return matchesSearch && matchesTag;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.protein || 0) - (a.protein || 0);
        case 'calories': return (a.calories || 0) - (b.calories || 0);
        case 'prepTime': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredRecipes = getFilteredRecipes();

  const makeRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setShowModal(true);
  };

  const handleCompleteRecipe = () => {
    if (selectedRecipe) {
      const drinkData = {
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: 'protein-shakes',
        description: `${selectedRecipe.name} (egg protein)`,
        ingredients: (selectedRecipe.recipe?.measurements || []).map((r) => `${r.amount} ${r.unit} ${r.item}`),
        nutrition: {
          calories: selectedRecipe.calories,
          protein: selectedRecipe.protein,
          carbs: selectedRecipe.carbs || 0,
          fat: 5
        },
        difficulty: selectedRecipe.difficulty,
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        tags: selectedRecipe.tags
      };
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(100);
    }
    setShowModal(false);
    setSelectedRecipe(null);
  };

  // Sharing
  const handleSharePage = async () => {
    const shareData = {
      title: 'Egg Protein Shakes',
      text: 'Browse egg protein shake recipes and benefits.',
      url: typeof window !== 'undefined' ? window.location.href : ''
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`); alert('Link copied to clipboard!'); }
    } catch {
      try { await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`); alert('Link copied to clipboard!'); }
      catch { alert('Unable to share on this device.'); }
    }
  };

  const handleShareRecipe = async (recipe) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const firstFour = (recipe.recipe?.measurements || []).slice(0,4).map(r => `${r.amount} ${r.unit} ${r.item}`).join(' · ');
    const text = `${recipe.name} • ${recipe.protein}g protein • ${recipe.calories} cal\n${firstFour || 'See full recipe on page'}`;
    const shareData = { title: recipe.name, text, url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(`${recipe.name}\n${text}\n${url}`); alert('Recipe copied to clipboard!'); }
    } catch {
      try { await navigator.clipboard.writeText(`${recipe.name}\n${text}\n${url}`); alert('Recipe copied to clipboard!'); }
      catch { alert('Unable to share on this device.'); }
    }
  };

  // Modal scaled macros
  const scaledMacros = useMemo(() => {
    if (!selectedRecipe) return null;
    const s = getServings(selectedRecipe.id);
    return {
      calories: Math.round((selectedRecipe.calories || 0) * s),
      protein: Math.round((selectedRecipe.protein || 0) * s),
    };
  }, [selectedRecipe, servingsById]);

  const copyScaledRecipe = async (id, name, list) => {
    const s = getServings(id);
    const scaled = getScaledMeasurements(list, s);
    const lines = scaled.map((ing) => `- ${ing.amountScaled} ${ing.unit} ${ing.item}${ing.note ? ` — ${ing.note}` : ''}`).join('\n');
    const text = `${name} (serves ${s})\n${lines}`;
    try { await navigator.clipboard.writeText(text); alert('Recipe copied!'); }
    catch { alert('Unable to copy on this device.'); }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setShowUniversalSearch(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">Search All Drinks</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowUniversalSearch(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Make Recipe Modal (brighter yellow accents) */}
      {showModal && selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedRecipe.name}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-yellow-50 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-yellow-500">{scaledMacros?.protein ?? selectedRecipe.protein}g</div>
                  <div className="text-xs text-gray-600">Protein</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{scaledMacros?.calories ?? selectedRecipe.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-yellow-600">{selectedRecipe.prepTime}min</div>
                  <div className="text-xs text-gray-600">Prep</div>
                </div>
              </div>

              {/* Servings + Copy */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Recipe • {getServings(selectedRecipe.id)} {getServings(selectedRecipe.id) === 1 ? 'serving' : 'servings'}
                </h3>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 border rounded text-sm" onClick={() => bumpServings(selectedRecipe.id, -1)} aria-label="decrease servings">−</button>
                  <div className="min-w-[2ch] text-center text-sm">{getServings(selectedRecipe.id)}</div>
                  <button className="px-2 py-1 border rounded text-sm" onClick={() => bumpServings(selectedRecipe.id, +1)} aria-label="increase servings">+</button>
                  <button className="px-2 py-1 border rounded text-sm flex items-center gap-1" onClick={() => resetServings(selectedRecipe.id)} title="Reset to 1">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                  <button
                    className="px-2 py-1 border rounded text-sm flex items-center gap-1"
                    onClick={() => copyScaledRecipe(selectedRecipe.id, selectedRecipe.name, selectedRecipe.recipe?.measurements || [])}
                    title="Copy scaled recipe"
                  >
                    <Clipboard className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
              </div>

              {/* Ingredients list (bigger, brighter yellow accents) */}
              <ul className="space-y-2 text-base leading-6 text-gray-800 font-sans tracking-normal">
                {getScaledMeasurements(selectedRecipe.recipe?.measurements || [], getServings(selectedRecipe.id))
                  .map((ing, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <span>
                      <span className="text-yellow-600 font-semibold">
                        {ing.amountScaled} {ing.unit}
                      </span>{" "}
                      {ing.item}
                      {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Directions */}
              {Array.isArray(selectedRecipe.recipe?.directions) && (
                <div>
                  <h3 className="font-semibold mb-2 text-gray-900">Directions</h3>
                  <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
                    {selectedRecipe.recipe.directions.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
              )}

              {/* Notes */}
              <div>
                <h3 className="font-semibold mb-2 text-gray-900">Your Notes</h3>
                <textarea
                  className="w-full border rounded-md p-2 text-sm text-gray-800"
                  rows={3}
                  placeholder="Add tweaks, swaps, or how it turned out…"
                  value={notesById[selectedRecipe.id] ?? ''}
                  onChange={(e) => setNotesById((prev) => ({ ...prev, [selectedRecipe.id]: e.target.value }))}
                />
              </div>

              <div className="flex gap-4 pt-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-yellow-200 to-yellow-300 hover:from-yellow-300 hover:to-yellow-400"
                  onClick={handleCompleteRecipe}
                >
                  Complete Recipe (+100 XP)
                </Button>
                <Button variant="outline" onClick={() => handleShareRecipe(selectedRecipe)}>
                  <Share2 className="h-4 w-4 mr-2" /> Share
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 -mx-4 -mt-6 px-4 md:-mx-6 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/protein-shakes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Protein Shakes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Target className="h-6 w-6 text-yellow-500" />
                <h1 className="text-2xl font-bold text-gray-900">Egg Protein Shakes</h1>
                <Badge className="bg-yellow-100 text-yellow-800">BV Score: 100</Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setShowUniversalSearch(true)}>
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-400" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-yellow-300 hover:bg-yellow-400" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Recipes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Hub Navigation */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {otherDrinkHubs.map((hub) => {
              const Icon = hub.icon;
              return (
                <Link key={hub.id} href={hub.route}>
                  <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                    <Icon className="h-4 w-4 mr-2 text-blue-600" />
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{hub.name}</div>
                      <div className="text-xs text-gray-500">{hub.description}</div>
                    </div>
                    <ArrowRight className="h-3 w-3 ml-auto" />
                  </Button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sister Protein Pages */}
      <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            Other Protein Types
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {proteinSubcategories.map((subcategory) => {
              const Icon = subcategory.icon;
              return (
                <Link key={subcategory.id} href={subcategory.path}>
                  <Button variant="outline" className="w-full justify-start hover:bg-yellow-50 hover:border-yellow-300">
                    <Icon className="h-4 w-4 mr-2 text-yellow-500" />
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{subcategory.name}</div>
                      <div className="text-xs text-gray-500">{subcategory.description}</div>
                    </div>
                    <ArrowRight className="h-3 w-3 ml-auto" />
                  </Button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Why Egg Protein */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-400" />
            Why Egg Protein?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eggProteinBenefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow">
                <benefit.icon className={`h-6 w-6 ${benefit.color} flex-shrink-0`} />
                <div>
                  <h3 className="font-semibold mb-1">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search egg protein recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <select
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              >
                <option value="All">All Tags</option>
                {allTags.filter(tag => tag !== 'All').map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>

              <select
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="rating">Sort by Rating</option>
                <option value="protein">Sort by Protein</option>
                <option value="calories">Sort by Calories</option>
                <option value="prepTime">Sort by Prep Time</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map((recipe) => (
          <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-lg">{recipe.name}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const drinkData = {
                      id: recipe.id,
                      name: recipe.name,
                      category: 'protein-shakes',
                      description: `Egg protein shake`,
                      ingredients: (recipe.recipe?.measurements || []).map((r) => `${r.amount} ${r.unit} ${r.item}`),
                      nutrition: { calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs || 0, fat: 5 },
                      difficulty: recipe.difficulty,
                      prepTime: recipe.prepTime,
                      rating: recipe.rating
                    };
                    addToFavorites(drinkData);
                  }}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Heart className={`h-5 w-5 ${isFavorite(recipe.id) ? 'fill-red-500 text-red-500' : ''}`} />
                </Button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{recipe.rating}</span>
                </div>
                <span className="text-sm text-muted-foreground">({recipe.reviews} reviews)</span>
                <Badge variant="outline" className="ml-auto">{recipe.difficulty}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div>
                  <div className="font-bold text-blue-600">{recipe.protein}g</div>
                  <div className="text-xs text-muted-foreground">Protein</div>
                </div>
                <div>
                  <div className="font-bold text-green-600">{recipe.carbs || 0}g</div>
                  <div className="text-xs text-muted-foreground">Carbs</div>
                </div>
                <div>
                  <div className="font-bold text-yellow-600">{recipe.calories}</div>
                  <div className="text-xs text-muted-foreground">Calories</div>
                </div>
              </div>

              {/* Compact measured preview + servings controls */}
              {recipe.recipe?.measurements && (
                <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-900">
                      Recipe (serves {getServings(recipe.id)})
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 border rounded text-sm" onClick={() => bumpServings(recipe.id, -1)} aria-label="decrease servings">−</button>
                      <div className="min-w-[2ch] text-center text-sm">{getServings(recipe.id)}</div>
                      <button className="px-2 py-1 border rounded text-sm" onClick={() => bumpServings(recipe.id, +1)} aria-label="increase servings">+</button>
                      <button className="px-2 py-1 border rounded text-sm flex items-center gap-1" onClick={() => resetServings(recipe.id)} title="Reset to 1">
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const scaled = getScaledMeasurements(recipe.recipe.measurements, getServings(recipe.id));
                    return (
                      <ul className="text-base leading-6 text-gray-800 space-y-1 font-sans tracking-normal">
                        {scaled.slice(0,4).map((ing, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-yellow-500 mt-0.5" />
                            <span>
                              <span className="text-yellow-600 font-semibold">
                                {ing.amountScaled} {ing.unit}
                              </span>{" "}
                              {ing.item}
                              {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                            </span>
                          </li>
                        ))}
                        {scaled.length > 4 && (
                          <li className="text-sm text-gray-600">…plus {scaled.length - 4} more</li>
                        )}
                      </ul>
                    );
                  })()}
                </div>
              )}

              <div className="flex flex-wrap gap-1 mb-4">
                {recipe.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-yellow-200 to-yellow-300 hover:from-yellow-300 hover:to-yellow-400"
                  onClick={() => makeRecipe(recipe)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Make (+100 XP)
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleShareRecipe(recipe)}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold mb-2">Your Progress</h3>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-purple-600">Level {userProgress.level}</Badge>
                <Badge variant="outline" className="text-blue-600">{userProgress.totalPoints} XP</Badge>
                <Badge variant="outline" className="text-green-600">{userProgress.totalDrinksMade} Drinks Made</Badge>
              </div>
            </div>
            <div className="text-center">
              <Progress value={userProgress.dailyGoalProgress} className="w-32 mb-2" />
              <div className="text-xs text-gray-500">Daily Goal Progress</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
