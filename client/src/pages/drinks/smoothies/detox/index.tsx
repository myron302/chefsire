// client/src/pages/drinks/smoothies/detox/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Apple, Leaf, Heart, Star, Search, Share2, ArrowLeft,
  Camera, Zap, Sparkles, X, Check, Crown, Activity, IceCream,
  Clipboard, RotateCcw, Wine, Flame, Droplets, Coffee} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import RecipeKit from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// scaling helpers
const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));
const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = { 0: '', 1: '¼', 2: '½', 3: '¾' };
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

// metric conversion for smoothies
const toMetric = (unit: string, amount: number) => {
  const mlPerCup = 240, mlPerOz = 30;
  switch (unit) {
    case 'cup': return { amount: Math.round(amount * mlPerCup), unit: 'ml' };
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
    case 'tbsp': return { amount: Math.round(amount * 15), unit: 'ml' };
    case 'tsp': return { amount: Math.round(amount * 5), unit: 'ml' };
    default: return { amount, unit };
  }
};

// Improved ingredient parser that handles fractions and descriptors properly
const parseIngredient = (ingredient: string): Measured => {
  const fractionMap: Record<string, number> = {
    '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅛': 0.125
  };
  
  const parts = ingredient.trim().replace(/\sof\s/i, ' ').split(/\s+/);
  if (parts.length < 2) return m('1', 'item', ingredient);

  let amountStr = parts[0];
  let amount: number | string = fractionMap[amountStr] ?? 
    (isNaN(Number(amountStr)) ? amountStr : Number(amountStr));

  let unit = parts[1];
  let item = parts.slice(2).join(' ');

  // If unit looks like a descriptor (not a real unit), fold it back into the item
  const descriptors = new Set(['low-fat', 'frozen', 'unsweetened', 'natural', 'vanilla', 'plain', 'fresh']);
  if (descriptors.has(unit)) {
    item = [unit, item].filter(Boolean).join(' ').trim();
    unit = 'item'; // generic unit
  }

  // Handle notes like "(optional)"
  if (item.includes('(optional)')) {
    item = item.replace('(optional)', '').trim();
    return m(amount, unit, item, 'optional');
  }
  
  return m(amount, unit, item);
};

// Enhanced detox smoothies data - ACTUAL SMOOTHIES with creamy bases
const detoxSmoothies = [
  {
    id: 'detox-green-smoothie',
    name: 'Green Detox Smoothie',
    description: 'Creamy green smoothie with avocado and spinach',
    ingredients: [
      '1 cup spinach',
      '1/2 avocado',
      '1 banana',
      '1 cup almond milk',
      '1 tbsp chia seeds',
      '1 cup ice'
    ],
    benefits: ['Liver detox', 'Healthy fats', 'Fiber rich', 'Alkalizing'],
    nutrition: { calories: 280, protein: 6, carbs: 32, fiber: 12, sugar: 14, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 412,
    smoothieType: 'Green Detox',
    featured: true,
    trending: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop',
    estimatedCost: 3.20
  },
  {
    id: 'turmeric-golden-smoothie',
    name: 'Golden Turmeric Smoothie',
    description: 'Creamy turmeric and mango anti-inflammatory blend',
    ingredients: [
      '1 cup mango',
      '1 banana',
      '1 tsp turmeric',
      '1/2 tsp cinnamon',
      '1 cup coconut milk',
      '1 cup ice'
    ],
    benefits: ['Anti-inflammatory', 'Immune boost', 'Antioxidants', 'Digestive aid'],
    nutrition: { calories: 240, protein: 3, carbs: 42, fiber: 6, sugar: 28, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 356,
    smoothieType: 'Spice Detox',
    featured: true,
    bestTime: 'Morning',
    estimatedCost: 3.50
  },
  {
    id: 'berry-cleanse-smoothie',
    name: 'Berry Cleanse Smoothie',
    description: 'Mixed berry smoothie with Greek yogurt',
    ingredients: [
      '1 cup mixed berries',
      '1/2 cup Greek yogurt',
      '1 banana',
      '1 cup almond milk',
      '1 tbsp flax seeds',
      '1 cup ice'
    ],
    benefits: ['Antioxidants', 'Probiotics', 'Fiber rich', 'Gut health'],
    nutrition: { calories: 290, protein: 15, carbs: 48, fiber: 10, sugar: 26, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 298,
    smoothieType: 'Berry Detox',
    trending: true,
    bestTime: 'Morning/Afternoon',
    estimatedCost: 3.80
  },
  {
    id: 'green-tea-detox-smoothie',
    name: 'Green Tea Detox Smoothie',
    description: 'Matcha green tea smoothie with banana and spinach',
    ingredients: [
      '1 tsp matcha powder',
      '1 banana',
      '1 cup spinach',
      '1 cup coconut milk',
      '1 tbsp honey',
      '1 cup ice'
    ],
    benefits: ['Antioxidants', 'Metabolism boost', 'Calm energy', 'Detoxifying'],
    nutrition: { calories: 220, protein: 5, carbs: 38, fiber: 6, sugar: 22, added_sugar: 12 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 423,
    smoothieType: 'Tea Detox',
    bestTime: 'Morning',
    estimatedCost: 3.40
  },
  {
    id: 'pineapple-ginger-smoothie',
    name: 'Pineapple Ginger Smoothie',
    description: 'Tropical pineapple smoothie with fresh ginger',
    ingredients: [
      '1.5 cups pineapple',
      '1 banana',
      '1 inch ginger',
      '1 cup coconut water',
      '1/2 cup Greek yogurt',
      '1 cup ice'
    ],
    benefits: ['Digestive enzymes', 'Anti-inflammatory', 'Immune support', 'Hydrating'],
    nutrition: { calories: 260, protein: 8, carbs: 52, fiber: 5, sugar: 36, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 389,
    smoothieType: 'Tropical Detox',
    trending: true,
    bestTime: 'Morning/Afternoon',
    estimatedCost: 3.60
  },
  {
    id: 'avocado-spinach-smoothie',
    name: 'Avocado Spinach Smoothie',
    description: 'Creamy avocado and spinach detox blend',
    ingredients: [
      '1/2 avocado',
      '2 cups spinach',
      '1 green apple',
      '1 cup almond milk',
      '1 tbsp lemon juice',
      '1 cup ice'
    ],
    benefits: ['Healthy fats', 'Chlorophyll rich', 'Alkalizing', 'Satiety'],
    nutrition: { calories: 320, protein: 6, carbs: 38, fiber: 14, sugar: 20, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 267,
    smoothieType: 'Green Detox',
    bestTime: 'Morning',
    estimatedCost: 3.30
  },
  {
    id: 'blueberry-spinach-smoothie',
    name: 'Blueberry Spinach Smoothie',
    description: 'Antioxidant-rich blueberry and spinach blend',
    ingredients: [
      '1 cup blueberries',
      '2 cups spinach',
      '1 banana',
      '1 cup oat milk',
      '1 tbsp chia seeds',
      '1 cup ice'
    ],
    benefits: ['Antioxidants', 'Brain health', 'Fiber rich', 'Anti-inflammatory'],
    nutrition: { calories: 280, protein: 7, carbs: 52, fiber: 12, sugar: 30, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 445,
    smoothieType: 'Berry Detox',
    featured: true,
    bestTime: 'Morning',
    estimatedCost: 3.40
  },
  {
    id: 'kale-pineapple-smoothie',
    name: 'Kale Pineapple Smoothie',
    description: 'Nutrient-dense kale with sweet pineapple',
    ingredients: [
      '2 cups kale',
      '1 cup pineapple',
      '1 banana',
      '1 cup coconut water',
      '1 tbsp hemp seeds',
      '1 cup ice'
    ],
    benefits: ['Vitamin K', 'Digestive enzymes', 'Mineral rich', 'Hydrating'],
    nutrition: { calories: 240, protein: 8, carbs: 46, fiber: 8, sugar: 28, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 312,
    smoothieType: 'Green Detox',
    bestTime: 'Morning',
    estimatedCost: 3.20
  }
];

const detoxTypes = [
  { id: 'green', name: 'Green Detox', description: 'Spinach, kale, and greens' },
  { id: 'berry', name: 'Berry Detox', description: 'Antioxidant berry blends' },
  { id: 'tropical', name: 'Tropical Detox', description: 'Pineapple and mango' },
  { id: 'spice', name: 'Spice Detox', description: 'Turmeric and ginger' },
  { id: 'tea', name: 'Tea Detox', description: 'Matcha and green tea' }
];

const detoxBenefits = [
  { id: 'liver', name: 'Liver Support', description: 'Detoxify and cleanse liver' },
  { id: 'digestive', name: 'Digestive Health', description: 'Improve gut function' },
  { id: 'antioxidant', name: 'Antioxidant Rich', description: 'Fight free radicals' },
  { id: 'alkaline', name: 'Alkalizing', description: 'Balance body pH' },
  { id: 'immune', name: 'Immune Boost', description: 'Strengthen immunity' },
  { id: 'energy', name: 'Natural Energy', description: 'Clean energy boost' }
];

// ---------- Cross-nav ----------
const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'smoothies', name: 'All Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const allSmoothieSubcategories = [
  { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Zap, description: 'High-protein blends' },
  { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Crown, description: 'Morning fuel' },
  { id: 'workout', name: 'Workout', path: '/drinks/smoothies/workout', icon: Activity, description: 'Pre & post workout' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Superfood greens' },
  { id: 'tropical', name: 'Tropical', path: '/drinks/smoothies/tropical', icon: Droplets, description: 'Exotic fruits' },
  { id: 'berry', name: 'Berry', path: '/drinks/smoothies/berry', icon: Heart, description: 'Antioxidant rich' },
  { id: 'dessert', name: 'Dessert', path: '/drinks/smoothies/dessert', icon: IceCream, description: 'Healthy treats' }
];

export default function DetoxSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetoxType, setSelectedDetoxType] = useState('');
  const [selectedBenefit, setSelectedBenefit] = useState('');
  const [maxCalories, setMaxCalories] = useState<number | 'all'>('all');
  const [onlyNaturalSweetener, setOnlyNaturalSweetener] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'fiber' | 'cost' | 'calories'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'detox-types'|'benefits'|'featured'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert detox smoothies to RecipeKit format with robust parsing
  const smoothieRecipesWithMeasurements = useMemo(() => {
    return detoxSmoothies.map((s) => {
      const rawList = Array.isArray(s.ingredients) ? s.ingredients : [];
      
      // Normalize everything to { amount, unit, item, note }
      const measurements = rawList.map((ing: any) => {
        if (typeof ing === 'string') return parseIngredient(ing);
        // If already measured object, keep as-is
        const { amount = 1, unit = 'item', item = '', note = '' } = ing || {};
        return { amount, unit, item, note };
      });

      return {
        ...s,
        recipe: {
          servings: 1,
          measurements,
          directions: [
            'Add all ingredients to high-speed blender',
            'Blend until completely smooth and creamy',
            'Pour into glass and enjoy immediately',
            'Best consumed fresh for maximum detox benefits'
          ]
        }
      };
    });
  }, []);

  const handleShareSmoothie = async (smoothie: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[smoothie.id] ?? (smoothie.recipe?.servings || 1);
    const preview = smoothie.ingredients.slice(0, 4).join(' • ');
    const text = `${smoothie.name} • ${smoothie.smoothieType} • ${smoothie.bestTime}\n${preview}${smoothie.ingredients.length > 4 ? ` …plus ${smoothie.ingredients.length - 4} more` : ''}`;
    const shareData = { title: smoothie.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${smoothie.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${smoothie.name}\n${text}\n${url}`);
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
        category: 'smoothies' as const,
        description: `${selectedRecipe.smoothieType || ''} • ${selectedRecipe.bestTime || ''}`,
        ingredients: selectedRecipe.ingredients,
        nutrition: selectedRecipe.nutrition,
        difficulty: selectedRecipe.difficulty,
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        bestTime: selectedRecipe.bestTime,
        tags: selectedRecipe.benefits
      };
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(25); // XP for detox smoothies
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredSmoothies = () => {
    let filtered = smoothieRecipesWithMeasurements.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedDetoxType || smoothie.smoothieType === selectedDetoxType;
      const matchesBenefit = !selectedBenefit || smoothie.benefits.some((b: string) => b.toLowerCase().includes(selectedBenefit.toLowerCase()));
      const matchesCalories = maxCalories === 'all' || smoothie.nutrition.calories <= maxCalories;
      const matchesSweetener = !onlyNaturalSweetener || smoothie.nutrition.added_sugar === 0;
      return matchesSearch && matchesType && matchesBenefit && matchesCalories && matchesSweetener;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'fiber': return (b.nutrition.fiber || 0) - (a.nutrition.fiber || 0);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = smoothieRecipesWithMeasurements.filter(s => s.featured);

  // Share page handler
  const handleSharePage = async () => {
    const shareData = {
      title: 'Detox Smoothies',
      text: `Browse ${detoxSmoothies.length} detox smoothies for cleansing and wellness.`,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-stone-50">
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

      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="gray"
          pointsReward={25}
          onComplete={handleCompleteRecipe}
          item={{
            id: selectedRecipe.id,
            name: selectedRecipe.name,
            prepTime: selectedRecipe.prepTime,
            directions: selectedRecipe.recipe?.directions || [],
            measurements: selectedRecipe.recipe?.measurements || [],
            baseNutrition: selectedRecipe.nutrition || {},
            defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1
          }}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/smoothies">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Smoothies
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Apple className="h-6 w-6 text-gray-600" />
                <h1 className="text-2xl font-bold text-gray-900">Detox Smoothies</h1>
                <Badge className="bg-gray-100 text-gray-700 border-gray-300">Cleansing</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowUniversalSearch(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-gray-600 hover:bg-gray-700 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* CROSS-HUB NAVIGATION - Top Level Sites */}
        <Card className="bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-gray-50 hover:border-gray-300">
                      <Icon className="h-4 w-4 mr-2 text-gray-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{hub.name}</div>
                        <div className="text-xs text-gray-500">{hub.description}</div>
                      </div>
                      <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SISTER SUBPAGES NAVIGATION - ALL SMOOTHIE TYPES (No Detox) */}
        <Card className="bg-gradient-to-r from-gray-50 to-stone-50 border-gray-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {allSmoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-gray-50 hover:border-gray-300">
                      <Icon className="h-4 w-4 mr-2 text-gray-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{subcategory.name}</div>
                        <div className="text-xs text-gray-500">{subcategory.description}</div>
                      </div>
                      <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">270</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">8g</div>
              <div className="text-sm text-gray-600">Avg Fiber</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{detoxSmoothies.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'detox-types', label: 'Detox Types', icon: Apple },
            { id: 'benefits', label: 'Benefits', icon: Heart },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map(tab => {
            const Icon = tab.icon as any;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 ${activeTab === tab.id ? 'bg-slate-600 shadow-sm !text-white hover:!text-white hover:bg-slate-700' : ''}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      placeholder="Search detox smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedDetoxType}
                      onChange={(e) => setSelectedDetoxType(e.target.value)}
                    >
                      <option value="">All Detox Types</option>
                      {detoxTypes.map(type => (
                        <option key={type.id} value={type.name}>{type.name}</option>
                      ))}
                    </select>

                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedBenefit}
                      onChange={(e) => setSelectedBenefit(e.target.value)}
                    >
                      <option value="">All Benefits</option>
                      {detoxBenefits.map(benefit => (
                        <option key={benefit.id} value={benefit.name}>{benefit.name}</option>
                      ))}
                    </select>
                    
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={maxCalories}
                      onChange={(e) => {
                        const v = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setMaxCalories(v);
                      }}
                    >
                      <option value="all">All Calories</option>
                      <option value={200}>Under 200 cal</option>
                      <option value={250}>Under 250 cal</option>
                      <option value={300}>Under 300 cal</option>
                      <option value={350}>Under 350 cal</option>
                    </select>
                    
                    <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                      <input
                        type="checkbox"
                        checked={onlyNaturalSweetener}
                        onChange={(e) => setOnlyNaturalSweetener(e.target.checked)}
                      />
                      Natural Sweeteners
                    </label>

                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="fiber">Sort by Fiber</option>
                      <option value="cost">Sort by Cost</option>
                      <option value="calories">Sort by Calories</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Smoothie Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSmoothies.map(smoothie => {
                const useMetric = !!metricFlags[smoothie.id];
                const servings = servingsById[smoothie.id] ?? (smoothie.recipe?.servings || 1);

                return (
                  <Card key={smoothie.id} onClick={(e) => { e.stopPropagation(); openRecipeModal(smoothie); }} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="md:max-w-3xl md:flex-1">
                          <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); addToFavorites({
                            id: smoothie.id,
                            name: smoothie.name,
                            category: 'smoothies',
                            description: smoothie.description,
                            ingredients: smoothie.ingredients,
                            nutrition: smoothie.nutrition,
                            difficulty: smoothie.difficulty,
                            prepTime: smoothie.prepTime,
                            rating: smoothie.rating,
                            smoothieType: smoothie.smoothieType,
                            bestTime: smoothie.bestTime
                          }); }}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className="bg-gray-100 text-gray-700 border-gray-300">{smoothie.smoothieType}</Badge>
                        {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-gray-600">{smoothie.nutrition.calories}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-gray-600">{smoothie.nutrition.fiber}g</div>
                          <div className="text-gray-500">Fiber</div>
                        </div>
                        <div>
                          <div className="font-bold text-gray-600">{smoothie.prepTime}m</div>
                          <div className="text-gray-500">Prep</div>
                        </div>
                      </div>

                      {/* RATING & DIFFICULTY - Immediately above recipe card */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{smoothie.rating}</span>
                          <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {smoothie.difficulty}
                        </Badge>
                      </div>

                      {/* RecipeKit Preview */}
                      {Array.isArray(smoothie.recipe?.measurements) && smoothie.recipe.measurements.length > 0 && (
                        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-900">
                              Recipe (serves {servings})
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [smoothie.id]: clamp((prev[smoothie.id] ?? (smoothie.recipe?.servings || 1)) - 1) }))
                                }
                                aria-label="decrease servings"
                              >
                                -
                              </button>
                              <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [smoothie.id]: clamp((prev[smoothie.id] ?? (smoothie.recipe?.servings || 1)) + 1) }))
                                }
                                aria-label="increase servings"
                              >
                                +
                              </button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setServingsById(prev => {
                                  const next = { ...prev };
                                  next[smoothie.id] = smoothie.recipe?.servings || 1;
                                  return next;
                                }); }}
                                title="Reset servings"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                              </Button>
                            </div>
                          </div>

                          <ul className="text-sm leading-6 text-gray-800 space-y-1">
                            {smoothie.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                              const isNum = typeof ing.amount === 'number';
                              const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                              const show = useMetric && isNum
                                ? toMetric(ing.unit, Number((typeof ing.amount === 'number' ? (ing.amount as number) : parseFloat(String(ing.amount))) * servings))
                                : { amount: scaledDisplay, unit: ing.unit };

                              return (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-gray-600 mt-0.5" />
                                  <span>
                                    <span className="text-gray-700 font-semibold">
                                      {show.amount} {show.unit}
                                    </span>{" "}
                                    {ing.item}
                                    {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                  </span>
                                </li>
                              );
                            })}
                            {smoothie.recipe.measurements.length > 4 && (
                              <li className="text-xs text-gray-600">
                                …plus {smoothie.recipe.measurements.length - 4} more •{" "}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openRecipeModal(smoothie); }}
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
                              onClick={async (e) => { e.stopPropagation();
                                const lines = smoothie.ingredients.map((ing: string) => `- ${ing}`);
                                const txt = `${smoothie.name} (serves ${servings})\n${lines.join('\n')}`;
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
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleShareSmoothie(smoothie, servings); }}>
                              <Share2 className="w-4 h-4 mr-1" /> Share
                            </Button>
                            {/* Metric Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setMetricFlags((prev) => ({ ...prev, [smoothie.id]: !prev[smoothie.id] }))
                              }
                            >
                              {useMetric ? 'US' : 'Metric'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Best Time */}
                      <div className="space-y-2 mb-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Best Time:</span>
                          <span className="font-medium text-gray-600">{smoothie.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {smoothie.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Smoothie Button */}
                      <div className="mt-3">
                        <Button 
                          className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                          onClick={(e) => { e.stopPropagation(); openRecipeModal(smoothie); }}
                        >
                          <Apple className="h-4 w-4 mr-2" />
                          Make Smoothie (+25 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Detox Types Tab */}
        {activeTab === 'detox-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {detoxTypes.map(type => (
              <Card key={type.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Apple className="h-6 w-6 text-gray-600" />
                    </div>
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-gray-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Key Benefit</div>
                    <div className="text-lg font-bold text-gray-600">Cleansing</div>
                  </div>
                  <Button className="w-full bg-gray-600 hover:bg-gray-700 text-white" onClick={() => setActiveTab('browse')}>
                    Explore {type.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Benefits Tab */}
        {activeTab === 'benefits' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {detoxBenefits.map(benefit => (
              <Card key={benefit.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Heart className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{benefit.name}</CardTitle>
                      <p className="text-sm text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-gray-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Focus Area</div>
                    <div className="text-lg font-bold text-gray-600">Wellness</div>
                  </div>
                  <Button className="w-full bg-gray-600 hover:bg-gray-700 text-white" onClick={() => setActiveTab('browse')}>
                    View {benefit.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Featured Tab */}
        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative h-48">
                  {smoothie.image && (
                    <img 
                      src={smoothie.image} 
                      alt={smoothie.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <Badge className="absolute top-4 left-4 bg-gray-600 text-white">Featured</Badge>
                </div>
                
                <CardHeader>
                  <CardTitle>{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                    onClick={(e) => { e.stopPropagation(); openRecipeModal(smoothie); }}
                  >
                    <Apple className="h-4 w-4 mr-2" />
                    Make This Detox Smoothie
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-gray-50 to-stone-50 border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-gray-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-gray-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-gray-600">
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
    </div>
  );
}
