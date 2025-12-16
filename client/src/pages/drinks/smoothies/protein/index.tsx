// client/src/pages/drinks/smoothies/protein/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Droplets, Leaf, Heart, Star, Search, Share2, ArrowLeft, Camera, Zap, Sparkles, X, Check, Apple, Sun, Crown, Activity, Trophy, IceCream, Clipboard, RotateCcw, Wine, Flame, Dumbbell, Coffee } from "lucide-react";
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

// Enhanced protein smoothies data with proper measurements
const proteinSmoothies = [
  {
    id: 'protein-1',
    name: 'Muscle Builder Max',
    description: 'High-protein blend for muscle growth and recovery',
    ingredients: [
      '2 scoops vanilla protein powder',
      '1 cup Greek yogurt',
      '1 banana',
      '2 tbsp almond butter',
      '1 cup almond milk',
      '1 tbsp chia seeds'
    ],
    benefits: ['Muscle Growth', 'Recovery', 'Sustained Energy', 'Strength'],
    nutrition: { calories: 420, protein: 38, carbs: 32, fiber: 8, sugar: 18, added_sugar: 2 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 567,
    proteinType: 'Whey Protein',
    featured: true,
    trending: true,
    bestTime: 'Post-Workout',
    image: 'https://images.unsplash.com/photo-1579684947554-1e6aea584f44?w=400&h=300&fit=crop',
    estimatedCost: 3.50
  },
  {
    id: 'protein-2',
    name: 'Chocolate Peanut Power',
    description: 'Rich chocolate and peanut butter protein delight',
    ingredients: [
      '2 scoops chocolate protein powder',
      '2 tbsp peanut butter',
      '1 cup milk',
      '1/2 banana',
      '1 tbsp cocoa powder',
      '1 cup ice'
    ],
    benefits: ['Strength', 'Energy Boost', 'Muscle Repair', 'Satiety'],
    nutrition: { calories: 380, protein: 35, carbs: 24, fiber: 5, sugar: 14, added_sugar: 3 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 623,
    proteinType: 'Casein Protein',
    featured: true,
    bestTime: 'Post-Workout',
    image: 'https://images.unsplash.com/photo-1570978561297-5b17d1a39976?w=400&h=300&fit=crop',
    estimatedCost: 3.20
  },
  {
    id: 'protein-3',
    name: 'Berry Protein Blast',
    description: 'Antioxidant-rich berries with clean protein',
    ingredients: [
      '1.5 scoops vanilla protein',
      '1 cup mixed berries',
      '1/2 cup Greek yogurt',
      '1 cup coconut water',
      '1 tbsp honey',
      '1 cup spinach'
    ],
    benefits: ['Antioxidants', 'Recovery', 'Immune Support', 'Lean Muscle'],
    nutrition: { calories: 320, protein: 28, carbs: 36, fiber: 7, sugar: 22, added_sugar: 8 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 445,
    proteinType: 'Plant Protein',
    trending: true,
    bestTime: 'Breakfast',
    estimatedCost: 3.80
  },
  {
    id: 'protein-4',
    name: 'Green Protein Machine',
    description: 'Superfood greens meet muscle-building protein',
    ingredients: [
      '1 scoop vanilla protein',
      '2 cups spinach',
      '1/2 avocado',
      '1 cup almond milk',
      '1 tbsp hemp seeds',
      '1/2 green apple'
    ],
    benefits: ['Muscle Recovery', 'Healthy Fats', 'Fiber Rich', 'Alkalizing'],
    nutrition: { calories: 280, protein: 25, carbs: 18, fiber: 9, sugar: 12, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.6,
    reviews: 389,
    proteinType: 'Plant Protein',
    bestTime: 'Morning',
    estimatedCost: 3.40
  },
  {
    id: 'protein-5',
    name: 'Tropical Gains',
    description: 'Island flavors with serious protein power',
    ingredients: [
      '2 scoops vanilla protein',
      '1 cup pineapple',
      '1/2 cup mango',
      '1 cup coconut milk',
      '1 tbsp coconut flakes',
      '1 cup ice'
    ],
    benefits: ['Muscle Growth', 'Electrolytes', 'Digestive Health', 'Energy'],
    nutrition: { calories: 350, protein: 30, carbs: 38, fiber: 4, sugar: 28, added_sugar: 2 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 312,
    proteinType: 'Whey Protein',
    trending: true,
    bestTime: 'Pre-Workout',
    estimatedCost: 3.60
  },
  {
    id: 'protein-6',
    name: 'Coffee Protein Energizer',
    description: 'Morning coffee meets muscle fuel',
    ingredients: [
      '1.5 scoops mocha protein',
      '1 cup cold brew coffee',
      '1/2 banana',
      '1/4 cup oats',
      '1 cup almond milk',
      '1 tsp cinnamon'
    ],
    benefits: ['Energy Boost', 'Mental Focus', 'Muscle Fuel', 'Metabolism'],
    nutrition: { calories: 290, protein: 26, carbs: 32, fiber: 6, sugar: 14, added_sugar: 1 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 498,
    proteinType: 'Whey Protein',
    featured: true,
    bestTime: 'Morning',
    estimatedCost: 2.90
  },
  {
    id: 'protein-7',
    name: 'Overnight Oats Protein',
    description: 'Creamy overnight oats protein shake',
    ingredients: [
      '1 scoop vanilla protein',
      '1/2 cup oats',
      '1 cup milk',
      '1 tbsp chia seeds',
      '1/2 cup berries',
      '1 tsp maple syrup'
    ],
    benefits: ['Sustained Energy', 'Muscle Repair', 'Fiber Rich', 'Gut Health'],
    nutrition: { calories: 410, protein: 32, carbs: 48, fiber: 10, sugar: 18, added_sugar: 6 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 423,
    proteinType: 'Casein Protein',
    bestTime: 'Breakfast',
    estimatedCost: 2.80
  },
  {
    id: 'protein-8',
    name: 'Pumpkin Spice Protein',
    description: 'Seasonal favorite with muscle-building benefits',
    ingredients: [
      '1.5 scoops vanilla protein',
      '1/2 cup pumpkin puree',
      '1 cup almond milk',
      '1 tsp pumpkin spice',
      '1 tbsp maple syrup',
      '1/4 tsp vanilla extract'
    ],
    benefits: ['Muscle Recovery', 'Antioxidants', 'Vitamin A', 'Seasonal'],
    nutrition: { calories: 270, protein: 24, carbs: 28, fiber: 5, sugar: 16, added_sugar: 8 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 367,
    proteinType: 'Plant Protein',
    trending: true,
    bestTime: 'Any Time',
    estimatedCost: 3.10
  }
];

const proteinTypes = [
  { id: 'whey', name: 'Whey Protein', description: 'Fast-absorbing dairy protein' },
  { id: 'casein', name: 'Casein Protein', description: 'Slow-digesting milk protein' },
  { id: 'plant', name: 'Plant Protein', description: 'Vegan protein sources' },
  { id: 'egg', name: 'Egg White Protein', description: 'Clean egg-based protein' },
  { id: 'beef', name: 'Beef Protein', description: 'Dairy-free alternative' },
  { id: 'collagen', name: 'Collagen Protein', description: 'Beauty and joint support' }
];

const proteinGoals = [
  { id: 'muscle', name: 'Muscle Building', description: 'Maximize muscle growth' },
  { id: 'recovery', name: 'Recovery', description: 'Post-workout repair' },
  { id: 'weight', name: 'Weight Management', description: 'Lean muscle maintenance' },
  { id: 'strength', name: 'Strength', description: 'Power and performance' },
  { id: 'endurance', name: 'Endurance', description: 'Sustained energy' },
  { id: 'toning', name: 'Toning', description: 'Lean definition' }
];

// ---------- Cross-nav ----------
const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const allSmoothieSubcategories = [
  { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Crown, description: 'Morning fuel' },
  { id: 'workout', name: 'Workout', path: '/drinks/smoothies/workout', icon: Activity, description: 'Pre & post workout' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Superfood greens' },
  { id: 'tropical', name: 'Tropical', path: '/drinks/smoothies/tropical', icon: Sun, description: 'Exotic fruits' },
  { id: 'berry', name: 'Berry', path: '/drinks/smoothies/berry', icon: Heart, description: 'Antioxidant rich' },
  { id: 'detox', name: 'Detox', path: '/drinks/smoothies/detox', icon: Trophy, description: 'Cleansing blends' },
  { id: 'dessert', name: 'Dessert', path: '/drinks/smoothies/dessert', icon: IceCream, description: 'Healthy treats' }
];

const proteinBenefits = [
  { icon: Dumbbell, title: 'Muscle Growth', description: '25-38g protein per serving for gains', color: 'text-blue-600' },
  { icon: Activity, title: 'Fast Recovery', description: 'Accelerates muscle repair post-workout', color: 'text-green-600' },
  { icon: Flame, title: 'Metabolism Boost', description: 'Increases calorie burn and energy', color: 'text-orange-600' },
  { icon: Heart, title: 'Satiety & Control', description: 'Keeps you full and reduces cravings', color: 'text-pink-600' },
  { icon: Zap, title: 'Sustained Energy', description: 'Prevents energy crashes', color: 'text-yellow-600' },
  { icon: Crown, title: 'Performance', description: 'Enhances workout intensity and duration', color: 'text-purple-600' }
];

export default function ProteinSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProteinType, setSelectedProteinType] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [minProtein, setMinProtein] = useState<number | 'all'>('all');
  const [maxCalories, setMaxCalories] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'fiber'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'protein-types'|'goals'|'featured'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert protein smoothies to RecipeKit format with robust parsing
  const smoothieRecipesWithMeasurements = useMemo(() => {
    return proteinSmoothies.map((s) => {
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
            'Add liquid ingredients to blender first',
            'Add protein powder and other dry ingredients',
            'Blend on high until smooth and creamy',
            'Add ice last for desired thickness',
            'Enjoy within 2 hours for best results'
          ]
        }
      };
    });
  }, []);

  const handleShareSmoothie = async (smoothie: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[smoothie.id] ?? (smoothie.recipe?.servings || 1);
    const preview = smoothie.ingredients.slice(0, 4).join(' • ');
    const text = `${smoothie.name} • ${smoothie.proteinType} • ${smoothie.bestTime}\n${preview}${smoothie.ingredients.length > 4 ? ` …plus ${smoothie.ingredients.length - 4} more` : ''}`;
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
        description: `${selectedRecipe.proteinType || ''} • ${selectedRecipe.bestTime || ''}`,
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
      addPoints(35); // XP for protein smoothies
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredSmoothies = () => {
    let filtered = smoothieRecipesWithMeasurements.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedProteinType || smoothie.proteinType === selectedProteinType;
      const matchesGoal = !selectedGoal || smoothie.benefits.some((b: string) => b.toLowerCase().includes(selectedGoal.toLowerCase()));
      const matchesProtein = minProtein === 'all' || smoothie.nutrition.protein >= minProtein;
      const matchesCalories = maxCalories === 'all' || smoothie.nutrition.calories <= maxCalories;
      return matchesSearch && matchesType && matchesGoal && matchesProtein && matchesCalories;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        case 'fiber': return (b.nutrition.fiber || 0) - (a.nutrition.fiber || 0);
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
      title: 'Protein Smoothies',
      text: `Browse ${proteinSmoothies.length} protein smoothies for muscle growth and recovery.`,
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
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
          accent="blue"
          pointsReward={35}
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
                <Zap className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Protein Smoothies</h1>
                <Badge className="bg-blue-100 text-blue-800">Muscle Fuel</Badge>
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
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* CROSS-HUB NAVIGATION - Top Level Sites */}
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
                      <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SISTER SUBPAGES NAVIGATION - ALL 7 SMOOTHIE TYPES */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {allSmoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
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

        {/* Protein Benefits */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Star className="h-6 w-6 text-blue-500" />
              Why Protein Smoothies?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {proteinBenefits.map((benefit, index) => {
                const Icon = benefit.icon as any;
                return (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow">
                    <Icon className={`h-6 w-6 ${benefit.color} flex-shrink-0`} />
                    <div>
                      <h3 className="font-semibold mb-1">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">30g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">340</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-600">{proteinSmoothies.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'protein-types', label: 'Protein Types', icon: Zap },
            { id: 'goals', label: 'Fitness Goals', icon: Dumbbell },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map(tab => {
            const Icon = tab.icon as any;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 ${activeTab === tab.id ? 'bg-blue-500 shadow-sm !text-white hover:!text-white hover:bg-blue-600' : ''}`}
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
                      placeholder="Search protein smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedProteinType}
                      onChange={(e) => setSelectedProteinType(e.target.value)}
                    >
                      <option value="">All Protein Types</option>
                      {proteinTypes.map(type => (
                        <option key={type.id} value={type.name}>{type.name}</option>
                      ))}
                    </select>

                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedGoal}
                      onChange={(e) => setSelectedGoal(e.target.value)}
                    >
                      <option value="">All Goals</option>
                      {proteinGoals.map(goal => (
                        <option key={goal.id} value={goal.name}>{goal.name}</option>
                      ))}
                    </select>
                    
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={minProtein}
                      onChange={(e) => {
                        const v = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setMinProtein(v);
                      }}
                    >
                      <option value="all">Any Protein</option>
                      <option value={20}>20g+ Protein</option>
                      <option value={25}>25g+ Protein</option>
                      <option value={30}>30g+ Protein</option>
                      <option value={35}>35g+ Protein</option>
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
                      <option value={300}>Under 300 cal</option>
                      <option value={350}>Under 350 cal</option>
                      <option value={400}>Under 400 cal</option>
                      <option value={450}>Under 450 cal</option>
                    </select>

                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="protein">Sort by Protein</option>
                      <option value="calories">Sort by Calories</option>
                      <option value="fiber">Sort by Fiber</option>
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
                            fitnessGoal: 'Muscle Building',
                            bestTime: smoothie.bestTime
                          })}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800">{smoothie.proteinType}</Badge>
                        {smoothie.trending && <Badge className="bg-orange-100 text-orange-800">Trending</Badge>}
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-blue-600">{smoothie.nutrition.protein}g</div>
                          <div className="text-gray-500">Protein</div>
                        </div>
                        <div>
                          <div className="font-bold text-indigo-600">{smoothie.nutrition.calories}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-purple-600">{smoothie.prepTime}m</div>
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
                                  <Check className="h-4 w-4 text-blue-600 mt-0.5" />
                                  <span>
                                    <span className="text-blue-700 font-semibold">
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
                          <span className="font-medium text-blue-600">{smoothie.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {smoothie.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Smoothie Button */}
                      <div className="mt-3">
                        <Button 
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          onClick={(e) => { e.stopPropagation(); openRecipeModal(smoothie); }}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Make Smoothie (+35 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Protein Types Tab */}
        {activeTab === 'protein-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {proteinTypes.map(type => (
              <Card key={type.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Zap className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-blue-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Best For</div>
                    <div className="text-lg font-bold text-blue-600">Muscle Growth</div>
                  </div>
                  <Button className="w-full" onClick={() => setActiveTab('browse')}>
                    Explore {type.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {proteinGoals.map(goal => (
              <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Dumbbell className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{goal.name}</CardTitle>
                      <p className="text-sm text-gray-600">{goal.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-blue-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Focus Area</div>
                    <div className="text-lg font-bold text-blue-600">Fitness</div>
                  </div>
                  <Button className="w-full" onClick={() => setActiveTab('browse')}>
                    View {goal.name}
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
                  <Badge className="absolute top-4 left-4 bg-blue-500 text-white">Featured</Badge>
                </div>
                
                <CardHeader>
                  <CardTitle>{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={(e) => { e.stopPropagation(); openRecipeModal(smoothie); }}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Make This Protein Shake
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-blue-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-indigo-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-purple-600">
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
