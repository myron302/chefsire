// pages/drinks/protein-shakes/egg.tsx
import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Target, Heart, Star, Zap, Flame, Leaf, Sparkles, Moon, Wine, Search, ArrowLeft, ArrowRight, Camera, X, Plus, Dumbbell, Check, Clipboard, Share2, RotateCcw, Coffee } from "lucide-react";
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';
import RecipeKit, { Measured } from '@/components/recipes/RecipeKit';
import type { RecipeKitHandle } from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
type Nutrition = { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// Scaling helpers to match Whey page
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

// ---------- Cross-nav ----------
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Leaf, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const proteinSubcategories = [
  { id: 'whey', name: 'Whey Protein', icon: Zap, path: '/drinks/protein-shakes/whey', description: 'Fast absorption' },
  { id: 'plant', name: 'Plant-Based', icon: Leaf, path: '/drinks/protein-shakes/plant-based', description: 'Vegan friendly' },
  { id: 'casein', name: 'Casein', icon: Moon, path: '/drinks/protein-shakes/casein', description: 'Slow release' },
  { id: 'collagen', name: 'Collagen', icon: Sparkles, path: '/drinks/protein-shakes/collagen', description: 'Beauty support' },
  { id: 'beef', name: 'Beef Protein', icon: Flame, path: '/drinks/protein-shakes/beef', description: 'Natural creatine' }
];

// ---------- Data (Egg) - Expanded to 9 recipes ----------
const eggProteinRecipes = [
  {
    id: 'egg-1',
    name: 'Classic Egg White Power',
    flavor: 'Cinnamon Banana',
    protein: 28,
    carbs: 15,
    calories: 210,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 156,
    tags: ['Lactose-Free', 'Post-Workout', 'Muscle Building'],
    benefits: ['Complete amino acids', 'Easy digestion', 'No lactose'],
    ingredients: ['Egg White Protein', 'Banana', 'Oats', 'Cinnamon', 'Almond Milk'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.8g',
    bestTime: 'Post-workout or morning',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg white protein'),
        m(1, 'cup', 'unsweetened almond milk'),
        m(0.5, 'banana', 'ripe, frozen preferred'),
        m(2, 'tbsp', 'rolled oats'),
        m(0.5, 'tsp', 'cinnamon'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'honey', 'optional sweetener'),
        m(1, 'pinch', 'nutmeg', 'optional')
      ],
      directions: [
        'Add milk, then protein and dry ingredients, then fruit.',
        'Blend 40–60 seconds until creamy.'
      ]
    }
  },
  {
    id: 'egg-2',
    name: 'Vanilla Egg Protein Delight',
    flavor: 'Vanilla Cream',
    protein: 30,
    carbs: 20,
    calories: 240,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 203,
    tags: ['High Protein', 'Morning Boost', 'Muscle Recovery'],
    benefits: ['Sustained energy', 'Rich in BCAAs', 'Smooth texture'],
    ingredients: ['Egg Protein', 'Vanilla', 'Greek Yogurt', 'Honey', 'Ice'],
    absorptionTime: '60-90 minutes',
    leucineContent: '3.0g',
    bestTime: 'Morning or post-workout',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.75, 'cup', '2% milk or almond milk'),
        m(0.25, 'cup', 'Greek yogurt'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'honey or stevia to taste'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tbsp', 'chia seeds', 'for fiber'),
        m(0.25, 'tsp', 'cinnamon')
      ],
      directions: [
        'Blend liquids + protein 10 seconds.',
        'Add yogurt and sweetener; blend smooth.'
      ]
    }
  },
  {
    id: 'egg-3',
    name: 'Berry Egg Fusion',
    flavor: 'Mixed Berry',
    protein: 26,
    carbs: 18,
    calories: 220,
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 187,
    tags: ['Antioxidants', 'Recovery', 'Lactose-Free'],
    benefits: ['Antioxidant rich', 'Anti-inflammatory', 'Heart health'],
    ingredients: ['Egg Protein', 'Mixed Berries', 'Spinach', 'Chia', 'Coconut Water'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.6g',
    bestTime: 'Post-workout or snack',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.75, 'cup', 'coconut water'),
        m(0.75, 'cup', 'mixed berries, frozen'),
        m(1, 'handful', 'spinach'),
        m(1, 'tsp', 'chia seeds'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'lemon juice', 'optional'),
        m(1, 'tsp', 'flax seeds', 'optional')
      ],
      directions: [
        'Blend all until smooth; pulse to keep berry texture if preferred.'
      ]
    }
  },
  {
    id: 'egg-4',
    name: 'Chocolate Egg Power',
    flavor: 'Cocoa PB',
    protein: 32,
    carbs: 22,
    calories: 260,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 245,
    tags: ['Indulgent', 'Post-Workout', 'Strength'],
    benefits: ['Muscle growth', 'Energy boost', 'Great taste'],
    ingredients: ['Egg Protein', 'Cocoa', 'Peanut Butter', 'Banana', 'Milk'],
    absorptionTime: '60-90 minutes',
    leucineContent: '3.2g',
    bestTime: 'Post-workout or meal replacement',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'tbsp', 'unsweetened cocoa powder'),
        m(1, 'tbsp', 'peanut butter'),
        m(0.5, 'banana', 'ripe'),
        m(1, 'cup', 'milk or almond milk'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'maple syrup', 'optional'),
        m(1, 'pinch', 'sea salt')
      ],
      directions: [
        'Blend all 45–60 seconds until silky; add milk to thin as needed.'
      ]
    }
  },
  {
    id: 'egg-5',
    name: 'Green Egg Power Smoothie',
    flavor: 'Green Apple',
    protein: 27,
    carbs: 16,
    calories: 205,
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.5,
    reviews: 134,
    tags: ['Detox', 'Nutrient-Dense', 'Alkalizing'],
    benefits: ['Nutrient-dense', 'Digestive health', 'Clean protein'],
    ingredients: ['Egg Protein', 'Kale', 'Avocado', 'Apple', 'Lemon'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.7g',
    bestTime: 'Morning or pre-workout',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'cup', 'water or coconut water'),
        m(1, 'handful', 'kale'),
        m(0.25, 'medium', 'avocado'),
        m(0.5, 'small', 'green apple, cored'),
        m(1, 'tsp', 'fresh lemon juice'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'ginger', 'optional')
      ],
      directions: [
        'Blend until bright and smooth; adjust lemon to taste.'
      ]
    }
  },
  {
    id: 'egg-6',
    name: 'Tropical Egg Protein',
    flavor: 'Mango Pineapple',
    protein: 29,
    carbs: 25,
    calories: 250,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 178,
    tags: ['Tropical', 'Anti-Inflammatory', 'Recovery'],
    benefits: ['Tropical flavor', 'Anti-inflammatory', 'Immune boost'],
    ingredients: ['Egg Protein', 'Mango', 'Pineapple', 'Coconut Milk', 'Turmeric'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.9g',
    bestTime: 'Post-workout or breakfast',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.5, 'cup', 'mango, frozen'),
        m(0.5, 'cup', 'pineapple, frozen'),
        m(0.75, 'cup', 'light coconut milk'),
        m(0.25, 'tsp', 'ground turmeric'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'coconut flakes', 'optional'),
        m(1, 'pinch', 'black pepper', 'for turmeric absorption')
      ],
      directions: [
        'Blend all ingredients until smooth; add milk for thinner texture.'
      ]
    }
  },
  {
    id: 'egg-7',
    name: 'Coffee Egg Energizer',
    flavor: 'Mocha Latte',
    protein: 31,
    carbs: 12,
    calories: 230,
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 198,
    tags: ['Morning Boost', 'Energy', 'Focus'],
    benefits: ['Caffeine boost', 'Mental focus', 'Sustained energy'],
    ingredients: ['Egg Protein', 'Coffee', 'Cocoa', 'Milk', 'Vanilla'],
    absorptionTime: '60-90 minutes',
    leucineContent: '3.1g',
    bestTime: 'Morning or pre-workout',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.5, 'cup', 'cold brew coffee'),
        m(0.5, 'cup', 'milk or almond milk'),
        m(1, 'tbsp', 'cocoa powder'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'maple syrup', 'optional'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'pinch', 'cinnamon')
      ],
      directions: [
        'Blend coffee with protein and cocoa until smooth',
        'Add milk and sweetener; blend until frothy'
      ]
    }
  },
  {
    id: 'egg-8',
    name: 'Pumpkin Spice Egg Protein',
    flavor: 'Pumpkin Spice',
    protein: 28,
    carbs: 19,
    calories: 235,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 167,
    tags: ['Seasonal', 'Comfort', 'Fiber Rich'],
    benefits: ['Seasonal flavor', 'High fiber', 'Vitamin A'],
    ingredients: ['Egg Protein', 'Pumpkin', 'Spices', 'Yogurt', 'Oats'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.8g',
    bestTime: 'Morning or snack',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.25, 'cup', 'pumpkin puree'),
        m(0.5, 'cup', 'Greek yogurt'),
        m(0.5, 'cup', 'milk or almond milk'),
        m(0.5, 'tsp', 'pumpkin pie spice'),
        m(2, 'tbsp', 'rolled oats'),
        m(1, 'tsp', 'honey', 'optional'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Combine all ingredients in blender',
        'Blend until smooth and creamy like pumpkin pie'
      ]
    }
  },
  {
    id: 'egg-9',
    name: 'Matcha Egg Green Tea',
    flavor: 'Matcha Green Tea',
    protein: 27,
    carbs: 14,
    calories: 215,
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.7,
    reviews: 189,
    tags: ['Antioxidants', 'Energy', 'Metabolism'],
    benefits: ['Antioxidant boost', 'Metabolism support', 'Calm energy'],
    ingredients: ['Egg Protein', 'Matcha', 'Spinach', 'Avocado', 'Coconut Water'],
    absorptionTime: '60-90 minutes',
    leucineContent: '2.7g',
    bestTime: 'Morning or afternoon',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'tsp', 'matcha powder'),
        m(1, 'cup', 'coconut water'),
        m(1, 'handful', 'spinach'),
        m(0.25, 'avocado', 'for creaminess'),
        m(1, 'tsp', 'honey', 'optional'),
        m(4, 'ice cubes', 'ice'),
        m(1, 'tsp', 'lemon juice', 'optional')
      ],
      directions: [
        'Blend matcha with liquid first to dissolve',
        'Add remaining ingredients and blend until vibrant green'
      ]
    }
  }
];

// ---------- Component ----------
export default function EggProteinPage() {
  const {
    userProgress,
    addPoints,
    incrementDrinksMade,
    addToFavorites,
    isFavorite,
    addToRecentlyViewed
  } = useDrinks();

  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [filterTag, setFilterTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'prepTime'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // RecipeKit refs
  const kitRefs = useRef<Record<string, RecipeKitHandle | null>>({});

  const allTags = ['All', ...new Set(eggProteinRecipes.flatMap(r => r.tags))];

  // Filter + sort
  const filteredRecipes = useMemo(() => {
    let filtered = eggProteinRecipes.filter(recipe => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        recipe.name.toLowerCase().includes(q) ||
        recipe.ingredients.some((ing: string) => ing.toLowerCase().includes(q)) ||
        (recipe.flavor || '').toLowerCase().includes(q) ||
        recipe.tags.some(t => t.toLowerCase().includes(q)) ||
        (recipe.benefits || []).some((b: string) => b.toLowerCase().includes(q));
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
  }, [searchQuery, filterTag, sortBy]);

  const handleSharePage = async () => {
    const shareData = {
      title: 'Egg Protein Shakes',
      text: 'Browse egg protein shake recipes and benefits.',
      url: typeof window !== 'undefined' ? window.location.href : ''
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const handleShareShake = async (shake: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[shake.id] ?? (shake.recipe?.servings || 1);
    const preview = (shake?.recipe?.measurements || [])
      .slice(0, 4)
      .map((r: Measured) => {
        const scaled =
          typeof r.amount === 'number'
            ? `${scaleAmount(r.amount, servings)} ${r.unit}`
            : `${r.amount} ${r.unit}`;
        return `${scaled} ${r.item}`;
      })
      .join(' · ');
    const text = `${shake.name} • ${shake.flavor} • Egg Protein\n${preview || (shake.ingredients?.slice(0,4)?.join(', ') ?? '')}`;
    const shareData = { title: shake.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shake.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shake.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const openRecipeModal = (recipe: any) => {
    setSelectedRecipe(recipe);
    setShowKit(true);
  };

  const handleCompleteRecipe = () => {
    if (selectedRecipe) {
      const drinkData = {
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: 'protein-shakes' as const,
        description: `${selectedRecipe.flavor || ''} egg protein shake`,
        ingredients: selectedRecipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || selectedRecipe.ingredients,
        nutrition: { calories: selectedRecipe.calories, protein: selectedRecipe.protein, carbs: selectedRecipe.carbs, fat: 5 },
        difficulty: selectedRecipe.difficulty as 'Easy' | 'Medium' | 'Hard',
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating
      };
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(100);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-100">
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

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                <Target className="h-6 w-6 text-amber-600" />
                <h1 className="text-2xl font-bold text-gray-900">Egg Protein Shakes</h1>
                <Badge className="bg-amber-100 text-amber-800">BV Score: 100</Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setShowUniversalSearch(true)}>
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cross-Hub Navigation */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon as any;
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

        {/* Sister Protein Pages Navigation */}
        <Card className="bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Other Protein Types
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon as any;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-amber-50 hover:border-amber-300">
                      <Icon className="h-4 w-4 mr-2 text-amber-600" />
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

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">29g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">100</div>
              <div className="text-sm text-gray-600">BV Score</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">9</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">4.7</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  placeholder="Search egg protein recipes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                <select
                  className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                >
                  <option value="All">All Tags</option>
                  {allTags.filter(t => t !== 'All').map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
                <select
                  className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
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
          {filteredRecipes.map((recipe) => {
            const useMetric = !!metricFlags[recipe.id];
            const servings = servingsById[recipe.id] ?? (recipe.recipe?.servings || 1);

            return (
              <Card key={recipe.id} onClick={() => openRecipeModal(recipe)} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="md:max-w-3xl md:flex-1">
                      <CardTitle className="text-lg mb-1">{recipe.name}</CardTitle>
                      <p className="text-sm text-gray-600 mb-2">{recipe.flavor}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const drinkData = {
                          id: recipe.id,
                          name: recipe.name,
                          category: 'protein-shakes' as const,
                          description: `${recipe.flavor || ''} egg protein shake`,
                          ingredients: recipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || recipe.ingredients,
                          nutrition: { calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: 5 },
                          difficulty: recipe.difficulty as 'Easy' | 'Medium' | 'Hard',
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

                  {/* Tags at top with different colors */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    <Badge className="bg-amber-100 text-amber-800">Egg Protein</Badge>
                    <Badge variant="outline">{recipe.flavor}</Badge>
                    {recipe.tags.includes('Post-Workout') && <Badge className="bg-red-100 text-red-800">Post-Workout</Badge>}
                    {recipe.tags.includes('Lactose-Free') && <Badge className="bg-blue-100 text-blue-800">Lactose-Free</Badge>}
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Nutrition Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                    <div>
                      <div className="text-xl font-bold text-amber-600">{recipe.protein}g</div>
                      <div className="text-gray-500">Protein</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-600">{recipe.calories}</div>
                      <div className="text-gray-500">Calories</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-green-600">{recipe.prepTime}m</div>
                      <div className="text-gray-500">Prep Time</div>
                    </div>
                  </div>

                  {/* MOVED: Rating and Difficulty just above recipe box */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{recipe.rating}</span>
                      <span className="text-gray-500 text-sm">({recipe.reviews})</span>
                    </div>
                    <Badge variant="outline">{recipe.difficulty}</Badge>
                  </div>

                  {/* Compact measured recipe preview + inline actions (Whey pattern) */}
                  {recipe.recipe?.measurements && (
                    <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-900">
                          Recipe (serves {servings})
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 border rounded text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setServingsById(prev => ({ ...prev, [recipe.id]: clamp((prev[recipe.id] ?? (recipe.recipe?.servings || 1)) - 1) }));
                            }}
                            aria-label="decrease servings"
                          >
                            −
                          </button>
                          <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                          <button
                            className="px-2 py-1 border rounded text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setServingsById(prev => ({ ...prev, [recipe.id]: clamp((prev[recipe.id] ?? (recipe.recipe?.servings || 1)) + 1) }));
                            }}
                            aria-label="increase servings"
                          >
                            +
                          </button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setServingsById(prev => {
                                const next = { ...prev };
                                next[recipe.id] = recipe.recipe?.servings || 1;
                                return next;
                              }); }};
                            }}
                            title="Reset servings"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                          </Button>
                        </div>
                      </div>

                      <ul className="text-sm leading-6 text-gray-800 space-y-1">
                        {recipe.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                          const isNum = typeof ing.amount === 'number';
                          const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                          const show = useMetric && isNum
                            ? { amount: Math.round(Number(ing.amount) * servings), unit: 'g' } // Simplified metric conversion
                            : { amount: scaledDisplay, unit: ing.unit };

                          return (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-amber-600 mt-0.5" />
                              <span>
                                <span className="text-amber-700 font-semibold">
                                  {show.amount} {show.unit}
                                </span>{" "}
                                {ing.item}
                                {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                              </span>
                            </li>
                          );
                        })}
                        {recipe.recipe.measurements.length > 4 && (
                          <li className="text-xs text-gray-600">
                            …plus {recipe.recipe.measurements.length - 4} more •{" "}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRecipeModal(recipe);
                              }}
                              className="underline underline-offset-2"
                            >
                              Show more
                            </button>
                          </li>
                        )}
                      </ul>

                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const lines = (recipe.recipe?.measurements || []).map((ing: Measured) => {
                              if (useMetric && typeof ing.amount === 'number') {
                                return `- ${Math.round(Number(ing.amount) * servings)}g ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                              }
                              const scaled = typeof ing.amount === 'number' ? scaleAmount(ing.amount, servings) : ing.amount;
                              return `- ${scaled} ${ing.unit} ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                            });
                            const txt = `${recipe.name} (serves ${servings})\n${lines.join('\n')}`;
                            try {
                              await navigator.clipboard.writeText(txt);
                              alert('Recipe copied!');
                            } catch {
                              alert('Unable to copy on this device.');
                            }
                          }}
                        >
                          <Clipboard className="w-4 h-4 mr-1" /> Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          handleShareShake(recipe, servings);
                        }}>
                          <Share2 className="w-4 h-4 mr-1" /> Share
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMetricFlags((prev) => ({ ...prev, [recipe.id]: !prev[recipe.id] }));
                          }}
                        >
                          {useMetric ? 'US' : 'Metric'}
                        </Button>
                      </div>

                      {/* ADDED: Absorption content below recipe box */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-gray-700">Absorption:</div>
                            <div className="text-blue-600 font-medium">{recipe.absorptionTime}</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-gray-700">Leucine:</div>
                            <div className="text-green-600 font-medium">{recipe.leucineContent}</div>
                          </div>
                        </div>
                        <div className="text-center mt-2">
                          <div className="font-semibold text-gray-700">Best Time:</div>
                          <div className="text-purple-600 font-medium text-sm">{recipe.bestTime}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Benefits tags with Egg color scheme */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {recipe.benefits.map((benefit: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200">
                        {benefit}
                      </Badge>
                    ))}
                  </div>

                  {/* Full-width CTA — Make Shake with lighter amber */}
                  <Button
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToRecentlyViewed({
                        id: recipe.id,
                        name: recipe.name,
                        category: 'protein-shakes',
                        description: recipe.flavor,
                        ingredients: recipe.recipe?.measurements?.map((x: Measured) => x.item) ?? [],
                        nutrition: { calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: 5 },
                        difficulty: recipe.difficulty,
                        prepTime: recipe.prepTime,
                        rating: recipe.rating,
                        fitnessGoal: 'Muscle Building',
                        bestTime: 'Post-Workout'
                      });
                      incrementDrinksMade();
                      addPoints(100);
                      kitRefs.current[recipe.id]?.open?.();
                    }}
                  >
                    <Dumbbell className="h-4 w-4 mr-1" />
                    Make Shake (+100 XP)
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-purple-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-green-600">
                    {userProgress.totalDrinksMade} Drinks Made
                  </Badge>
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

      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="amber"
          pointsReward={100}
          onComplete={handleCompleteRecipe}
          item={{
            id: selectedRecipe.id,
            name: selectedRecipe.name,
            prepTime: selectedRecipe.prepTime,
            directions: selectedRecipe.recipe?.directions || [],
            measurements: selectedRecipe.recipe?.measurements || [],
            baseNutrition: { calories: selectedRecipe.calories, protein: selectedRecipe.protein, carbs: selectedRecipe.carbs, fat: 5 } || {},
            defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1
          }}
        />
      )}
    </div>
  );
}
