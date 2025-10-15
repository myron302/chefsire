// client/src/pages/drinks/smoothies/detox/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Droplets, Leaf, Heart, Star, Search, Share2, ArrowLeft,
  Camera, Zap, Sparkles, X, Check, Apple, Sun, Crown, Activity, Trophy, IceCream,
  Clipboard, RotateCcw
} from 'lucide-react';
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

// Enhanced detox smoothies data with proper measurements
const detoxSmoothies = [
  {
    id: 'detox-1',
    name: 'Green Goddess Cleanse',
    description: 'Ultimate detox with kale, spinach, and cucumber',
    ingredients: [
      '2 cups kale',
      '1 cup spinach',
      '1/2 cucumber',
      '1 green apple',
      '1/2 lemon juice',
      '1 cup coconut water'
    ],
    benefits: ['Liver detox', 'Alkalizing', 'Anti-inflammatory', 'Hydrating'],
    nutrition: { calories: 140, protein: 4, carbs: 28, fiber: 6, sugar: 14, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 412,
    detoxType: 'Green Detox',
    featured: true,
    trending: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop',
    estimatedCost: 2.50
  },
  {
    id: 'detox-2',
    name: 'Ginger Turmeric Reset',
    description: 'Anti-inflammatory powerhouse blend',
    ingredients: [
      '1 inch ginger',
      '1 inch turmeric',
      '1 orange',
      '1/2 pineapple',
      '1/4 tsp black pepper',
      '1 cup coconut water'
    ],
    benefits: ['Anti-inflammatory', 'Immune boost', 'Digestion', 'Pain relief'],
    nutrition: { calories: 180, protein: 3, carbs: 40, fiber: 5, sugar: 28, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.8,
    reviews: 356,
    detoxType: 'Spice Detox',
    featured: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop',
    estimatedCost: 3.00
  },
  {
    id: 'detox-3',
    name: 'Celery Cucumber Refresh',
    description: 'Hydrating and cleansing green juice',
    ingredients: [
      '3 celery stalks',
      '1 cucumber',
      '1/2 lemon',
      '1 green apple',
      'Handful parsley',
      '1 cup water'
    ],
    benefits: ['Hydration', 'Kidney cleanse', 'Digestive health', 'Bloat reducer'],
    nutrition: { calories: 100, protein: 2, carbs: 22, fiber: 5, sugar: 12, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 298,
    detoxType: 'Juice Cleanse',
    trending: true,
    bestTime: 'Morning/Afternoon',
    estimatedCost: 2.00
  },
  {
    id: 'detox-4',
    name: 'Beet Berry Detox',
    description: 'Liver-loving beet and berry blend',
    ingredients: [
      '1 small beet',
      '1 cup mixed berries',
      '1/2 lemon',
      '1 inch ginger',
      '1 cup water'
    ],
    benefits: ['Liver support', 'Blood purifier', 'Antioxidants', 'Nitric oxide boost'],
    nutrition: { calories: 160, protein: 4, carbs: 35, fiber: 8, sugar: 22, added_sugar: 0 },
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.5,
    reviews: 234,
    detoxType: 'Liver Cleanse',
    bestTime: 'Morning',
    estimatedCost: 2.75
  },
  {
    id: 'detox-5',
    name: 'Lemon Ginger Zinger',
    description: 'Classic detox with cayenne kick',
    ingredients: [
      '2 lemons juiced',
      '2 inch ginger',
      '1 tbsp honey',
      'Pinch cayenne',
      '2 cups water'
    ],
    benefits: ['Metabolism boost', 'Immune support', 'Digestive aid', 'Vitamin C'],
    nutrition: { calories: 90, protein: 1, carbs: 24, fiber: 2, sugar: 18, added_sugar: 12 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 567,
    detoxType: 'Citrus Cleanse',
    trending: true,
    bestTime: 'Morning',
    estimatedCost: 1.50
  },
  {
    id: 'detox-6',
    name: 'Activated Charcoal Detox',
    description: 'Deep cleanse with activated charcoal',
    ingredients: [
      '1 tsp activated charcoal',
      '1 banana',
      '1 cup coconut milk',
      '1 tbsp almond butter',
      '1 cup ice'
    ],
    benefits: ['Toxin removal', 'Digestive cleanse', 'Bloat relief', 'Gut health'],
    nutrition: { calories: 280, protein: 6, carbs: 38, fiber: 7, sugar: 18, added_sugar: 0 },
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.4,
    reviews: 189,
    detoxType: 'Deep Cleanse',
    featured: true,
    bestTime: 'Evening',
    estimatedCost: 3.25
  },
  {
    id: 'detox-7',
    name: 'Cilantro Chlorella Cleanse',
    description: 'Heavy metal detox superfood blend',
    ingredients: [
      '1 cup cilantro',
      '1 tsp chlorella',
      '1 green apple',
      '1/2 cucumber',
      '1/2 lime',
      '1 cup coconut water'
    ],
    benefits: ['Heavy metal removal', 'Chlorophyll rich', 'Liver support', 'Alkalizing'],
    nutrition: { calories: 120, protein: 5, carbs: 24, fiber: 6, sugar: 14, added_sugar: 0 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.3,
    reviews: 145,
    detoxType: 'Superfood Detox',
    bestTime: 'Morning',
    estimatedCost: 3.50
  },
  {
    id: 'detox-8',
    name: 'Pineapple Mint Refresh',
    description: 'Digestive enzyme-rich tropical cleanse',
    ingredients: [
      '1.5 cups pineapple',
      'Handful mint',
      '1/2 cucumber',
      '1/2 lime juice',
      '1 cup coconut water'
    ],
    benefits: ['Digestive enzymes', 'Anti-bloating', 'Refreshing', 'Metabolism boost'],
    nutrition: { calories: 150, protein: 2, carbs: 36, fiber: 4, sugar: 26, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 423,
    detoxType: 'Digestive Cleanse',
    bestTime: 'Afternoon',
    estimatedCost: 2.80
  },
  {
    id: 'detox-9',
    name: 'Matcha Green Detox',
    description: 'Antioxidant-rich matcha cleanse',
    ingredients: [
      '1 tsp matcha powder',
      '1 cup spinach',
      '1 banana',
      '1 cup almond milk',
      '1 tsp honey'
    ],
    benefits: ['Antioxidants', 'Gentle caffeine', 'Metabolism', 'Calm energy'],
    nutrition: { calories: 190, protein: 5, carbs: 38, fiber: 6, sugar: 20, added_sugar: 5 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 512,
    detoxType: 'Green Tea Detox',
    featured: true,
    trending: true,
    bestTime: 'Morning',
    estimatedCost: 3.20
  },
  {
    id: 'detox-10',
    name: 'Dandelion Root Cleanse',
    description: 'Liver-supporting dandelion blend',
    ingredients: [
      '1 cup dandelion greens',
      '1/2 grapefruit',
      '1 inch ginger',
      '1 tbsp chia seeds',
      '1 cup coconut water'
    ],
    benefits: ['Liver detox', 'Digestive aid', 'Kidney support', 'Anti-inflammatory'],
    nutrition: { calories: 130, protein: 4, carbs: 26, fiber: 8, sugar: 16, added_sugar: 0 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.4,
    reviews: 178,
    detoxType: 'Liver Cleanse',
    bestTime: 'Morning',
    estimatedCost: 2.90
  },
  {
    id: 'detox-11',
    name: 'Spirulina Super Cleanse',
    description: 'Nutrient-dense spirulina power blend',
    ingredients: [
      '1 tsp spirulina',
      '1 banana',
      '1 cup pineapple',
      '1 cup coconut water',
      '1 tbsp lemon juice'
    ],
    benefits: ['Nutrient boost', 'Alkalizing', 'Energy', 'Immune support'],
    nutrition: { calories: 170, protein: 6, carbs: 38, fiber: 5, sugar: 24, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 267,
    detoxType: 'Superfood Detox',
    trending: true,
    bestTime: 'Morning',
    estimatedCost: 3.10
  },
  {
    id: 'detox-12',
    name: 'Watermelon Hydration Cleanse',
    description: 'Hydrating watermelon electrolyte blend',
    ingredients: [
      '2 cups watermelon',
      '1/2 cucumber',
      '1 lime juice',
      'Handful mint',
      '1 cup coconut water'
    ],
    benefits: ['Hydration', 'Electrolytes', 'Kidney cleanse', 'Refreshing'],
    nutrition: { calories: 110, protein: 3, carbs: 26, fiber: 3, sugar: 20, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 345,
    detoxType: 'Hydration Cleanse',
    bestTime: 'Afternoon',
    estimatedCost: 2.40
  }
];

const detoxTypes = [
  { id: 'green', name: 'Green Detox', description: 'Leafy green based cleanses' },
  { id: 'spice', name: 'Spice Detox', description: 'Ginger, turmeric, and spices' },
  { id: 'liver', name: 'Liver Cleanse', description: 'Liver supporting ingredients' },
  { id: 'citrus', name: 'Citrus Cleanse', description: 'Lemon, lime, and grapefruit' },
  { id: 'superfood', name: 'Superfood Detox', description: 'Spirulina, chlorella, matcha' },
  { id: 'hydration', name: 'Hydration Cleanse', description: 'Water-rich ingredients' },
  { id: 'digestive', name: 'Digestive Cleanse', description: 'Enzyme-rich blends' },
  { id: 'deep', name: 'Deep Cleanse', description: 'Charcoal and intensive detox' }
];

const detoxCategories = [
  { id: 'morning', name: 'Morning Cleanse', description: 'Start your day fresh' },
  { id: 'hydration', name: 'Hydration Boost', description: 'Replenish electrolytes' },
  { id: 'liver', name: 'Liver Support', description: 'Detoxify and cleanse' },
  { id: 'digestive', name: 'Digestive Aid', description: 'Improve gut health' },
  { id: 'alkaline', name: 'Alkalizing', description: 'Balance body pH' },
  { id: 'antioxidant', name: 'Antioxidant Rich', description: 'Fight free radicals' },
  { id: 'immune', name: 'Immune Boost', description: 'Strengthen immunity' },
  { id: 'energy', name: 'Energy Cleanse', description: 'Natural energy boost' }
];

const allSmoothieSubcategories = [
  { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Zap, description: 'High-protein blends' },
  { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Crown, description: 'Morning fuel' },
  { id: 'workout', name: 'Workout', path: '/drinks/smoothies/workout', icon: Activity, description: 'Pre & post workout' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Superfood greens' },
  { id: 'tropical', name: 'Tropical', path: '/drinks/smoothies/tropical', icon: Sun, description: 'Exotic fruits' },
  { id: 'berry', name: 'Berry', path: '/drinks/smoothies/berry', icon: Heart, description: 'Antioxidant rich' },
  { id: 'detox', name: 'Detox', path: '/drinks/smoothies/detox', icon: Trophy, description: 'Cleansing blends' },
  { id: 'dessert', name: 'Dessert', path: '/drinks/smoothies/dessert', icon: IceCream, description: 'Healthy treats' }
];

const otherDrinkHubs = [
  { id: 'juices', name: 'Fresh Juices', route: '/drinks/juices', icon: Droplets, description: 'Cold-pressed nutrition' },
  { id: 'teas', name: 'Specialty Teas', route: '/drinks/teas', icon: Sun, description: 'Hot & iced teas' },
  { id: 'coffee', name: 'Coffee Drinks', route: '/drinks/coffee', icon: Zap, description: 'Artisan coffee' },
  { id: 'protein-shakes', name: 'Protein Shakes', route: '/drinks/protein-shakes', icon: Apple, description: 'Muscle fuel' }
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
  const [selectedCategory, setSelectedCategory] = useState('');
  const [maxCalories, setMaxCalories] = useState<number | 'all'>('all');
  const [onlyNaturalSweetener, setOnlyNaturalSweetener] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'fiber' | 'cost' | 'calories'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'detox-types'|'categories'|'featured'>('browse');
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
            'Blend until completely smooth and well combined',
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
    const text = `${smoothie.name} • ${smoothie.detoxType} • ${smoothie.bestTime}\n${preview}${smoothie.ingredients.length > 4 ? ` …plus ${smoothie.ingredients.length - 4} more` : ''}`;
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
        description: `${selectedRecipe.detoxType || ''} • ${selectedRecipe.bestTime || ''}`,
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
      addPoints(30); // More XP for detox smoothies
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredSmoothies = () => {
    let filtered = smoothieRecipesWithMeasurements.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedDetoxType || smoothie.detoxType === selectedDetoxType;
      const matchesCategory = !selectedCategory || smoothie.detoxType.includes(selectedCategory);
      const matchesCalories = maxCalories === 'all' || smoothie.nutrition.calories <= maxCalories;
      const matchesSweetener = !onlyNaturalSweetener || smoothie.nutrition.added_sugar === 0;
      return matchesSearch && matchesType && matchesCategory && matchesCalories && matchesSweetener;
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
  const trendingSmoothies = smoothieRecipesWithMeasurements.filter(s => s.trending);

  // Share page handler
  const handleSharePage = async () => {
    const shareData = {
      title: 'Detox Smoothies',
      text: `Browse ${detoxSmoothies.length} detox smoothies on ChefSire.`,
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
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
          accent="green"
          pointsReward={30}
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
                <Droplets className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Detox Smoothies</h1>
                <Badge className="bg-green-100 text-green-800">Cleansing</Badge>
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
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                      <Icon className="h-4 w-4 mr-2 text-green-600" />
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

        {/* SISTER SUBPAGES NAVIGATION - ALL 7 SMOOTHIE TYPES */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {allSmoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                      <Icon className="h-4 w-4 mr-2 text-green-600" />
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
              <div className="text-2xl font-bold text-green-600">150</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">5.5g</div>
              <div className="text-sm text-gray-600">Avg Fiber</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-teal-600">4.6★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{detoxSmoothies.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'detox-types', label: 'Detox Types', icon: Leaf },
            { id: 'categories', label: 'Categories', icon: Zap },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map(tab => {
            const Icon = tab.icon as any;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 ${activeTab === tab.id ? 'bg-white shadow-sm' : ''}`}
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search detox smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={selectedDetoxType}
                      onChange={(e) => setSelectedDetoxType(e.target.value)}
                    >
                      <option value="">All Detox Types</option>
                      {detoxTypes.map(type => (
                        <option key={type.id} value={type.name}>{type.name}</option>
                      ))}
                    </select>

                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {detoxCategories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={maxCalories}
                      onChange={(e) => {
                        const v = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setMaxCalories(v);
                      }}
                    >
                      <option value="all">All Calories</option>
                      <option value={100}>Under 100 cal</option>
                      <option value={150}>Under 150 cal</option>
                      <option value={200}>Under 200 cal</option>
                      <option value={250}>Under 250 cal</option>
                      <option value={300}>Under 300 cal</option>
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
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
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
                  <Card key={smoothie.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addToFavorites({
                            id: smoothie.id,
                            name: smoothie.name,
                            category: 'smoothies',
                            description: smoothie.description,
                            ingredients: smoothie.ingredients,
                            nutrition: smoothie.nutrition,
                            difficulty: smoothie.difficulty,
                            prepTime: smoothie.prepTime,
                            rating: smoothie.rating,
                            fitnessGoal: 'Detox & Cleanse',
                            bestTime: smoothie.bestTime
                          })}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-100 text-green-800">{smoothie.detoxType}</Badge>
                        {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-green-600">{smoothie.nutrition.calories}</div>
                          <div className="text-gray-500">Cal</div>
                        </div>
                        <div>
                          <div className="font-bold text-emerald-600">{smoothie.nutrition.fiber}g</div>
                          <div className="text-gray-500">Fiber</div>
                        </div>
                        <div>
                          <div className="font-bold text-teal-600">{smoothie.prepTime}m</div>
                          <div className="text-gray-500">Prep</div>
                        </div>
                      </div>

                      {/* RATING & DIFFICULTY */}
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
                                −
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
                                onClick={() => setServingsById(prev => {
                                  const next = { ...prev };
                                  next[smoothie.id] = smoothie.recipe?.servings || 1;
                                  return next;
                                })}
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
                                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                                  <span>
                                    <span className="text-green-700 font-semibold">
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
                                  onClick={() => openRecipeModal(smoothie)}
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
                              onClick={async () => {
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
                            <Button variant="outline" size="sm" onClick={() => handleShareSmoothie(smoothie, servings)}>
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
                          <span className="font-medium text-green-600">{smoothie.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {smoothie.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-800 hover:bg-green-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Smoothie Button */}
                      <div className="mt-3">
                        <Button 
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => openRecipeModal(smoothie)}
                        >
                          <Leaf className="h-4 w-4 mr-2" />
                          Make Smoothie (+30 XP)
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {detoxTypes.map(type => (
              <Card key={type.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Leaf className="h-6 w-6 text-green-600" />
                    </div>
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-green-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Key Benefit</div>
                    <div className="text-lg font-bold text-green-600">Cleansing</div>
                  </div>
                  <Button className="w-full" onClick={() => setActiveTab('browse')}>
                    Explore {type.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {detoxCategories.map(category => (
              <Card key={category.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Zap className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      <p className="text-sm text-gray-600">{category.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-green-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Focus Area</div>
                    <div className="text-lg font-bold text-green-600">Wellness</div>
                  </div>
                  <Button className="w-full" onClick={() => setActiveTab('browse')}>
                    View {category.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative h-48">
                  <img 
                    src={smoothie.image} 
                    alt={smoothie.name}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-4 left-4 bg-green-500 text-white">Featured</Badge>
                </div>
                
                <CardHeader>
                  <CardTitle>{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => openRecipeModal(smoothie)}
                  >
                    <Leaf className="h-4 w-4 mr-2" />
                    Make This Detox
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-green-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-emerald-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-teal-600">
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
