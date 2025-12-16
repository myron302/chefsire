// client/src/pages/drinks/smoothies/berry/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Heart, Star, Search, Share2, ArrowLeft,
  Camera, Zap, Sparkles, X, Check, Crown, Activity, Droplets, Leaf,
  Clipboard, RotateCcw, Wine, Flame, Apple, Sun, Coffee
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

// Enhanced berry smoothies data with ALL recipes from both pages
const berrySmoothies = [
  {
    id: 'berry-1',
    name: 'Triple Berry Blast',
    description: 'Strawberry, blueberry, and raspberry power',
    ingredients: [
      '1 cup strawberries',
      '1/2 cup blueberries', 
      '1/2 cup raspberries',
      '1/2 banana',
      '1 cup almond milk',
      '1 cup ice'
    ],
    benefits: ['Antioxidant powerhouse', 'Heart health', 'Brain boost', 'Anti-inflammatory'],
    nutrition: { calories: 220, protein: 5, carbs: 45, fiber: 10, sugar: 28, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 523,
    berryType: 'Mixed Berries',
    featured: true,
    trending: true,
    bestTime: 'Morning/Afternoon',
    image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop',
    estimatedCost: 3.20
  },
  {
    id: 'berry-2',
    name: 'Strawberry Fields',
    description: 'Classic strawberry smoothie perfection',
    ingredients: [
      '2 cups strawberries',
      '1/2 cup Greek yogurt',
      '1/4 cup oats',
      '1 tbsp honey',
      '1 cup ice'
    ],
    benefits: ['Vitamin C boost', 'Protein rich', 'Sustained energy', 'Heart healthy'],
    nutrition: { calories: 280, protein: 12, carbs: 48, fiber: 8, sugar: 30, added_sugar: 12 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 412,
    berryType: 'Strawberry',
    featured: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
    estimatedCost: 2.90
  },
  {
    id: 'berry-3',
    name: 'Blueberry Bliss',
    description: 'Brain-boosting blueberry blend',
    ingredients: [
      '1.5 cups blueberries',
      '1/2 cup coconut milk',
      '1/4 cup cashews',
      '1 tbsp chia seeds',
      '1 cup ice'
    ],
    benefits: ['Brain health', 'Memory boost', 'Antioxidants', 'Omega-3s'],
    nutrition: { calories: 310, protein: 8, carbs: 42, fiber: 11, sugar: 25, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 367,
    berryType: 'Blueberry',
    trending: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&h=300&fit=crop',
    estimatedCost: 3.50
  },
  {
    id: 'berry-4',
    name: 'Raspberry Revival',
    description: 'Tart raspberry refreshment',
    ingredients: [
      '1.5 cups raspberries',
      '1/2 cup Greek yogurt',
      '1/4 cup spinach',
      '1 tbsp maple syrup',
      '1 cup ice'
    ],
    benefits: ['Digestive health', 'Fiber rich', 'Weight management', 'Vitamin C'],
    nutrition: { calories: 200, protein: 10, carbs: 35, fiber: 12, sugar: 18, added_sugar: 8 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 289,
    berryType: 'Raspberry',
    bestTime: 'Afternoon',
    estimatedCost: 3.10
  },
  {
    id: 'berry-5',
    name: 'Blackberry Boost',
    description: 'Rich blackberry nutrition bomb',
    ingredients: [
      '1.5 cups blackberries',
      '1/2 banana',
      '1/2 cup oat milk',
      '1 tbsp almond butter',
      '1 cup ice'
    ],
    benefits: ['Vitamin K', 'Bone health', 'Antioxidants', 'Healthy fats'],
    nutrition: { calories: 260, protein: 7, carbs: 44, fiber: 13, sugar: 22, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 198,
    berryType: 'Blackberry',
    bestTime: 'Morning',
    estimatedCost: 3.30
  },
  {
    id: 'berry-6',
    name: 'Açaí Power Bowl',
    description: 'Superfood açaí smoothie bowl',
    ingredients: [
      '2 açaí packets',
      '1/2 cup blueberries',
      '1/2 banana',
      '1/4 cup granola topping',
      '1/2 cup apple juice'
    ],
    benefits: ['Superfood power', 'Energy boost', 'Antioxidants', 'Instagram-worthy'],
    nutrition: { calories: 350, protein: 6, carbs: 62, fiber: 9, sugar: 35, added_sugar: 15 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.9,
    reviews: 645,
    berryType: 'Açaí',
    featured: true,
    trending: true,
    bestTime: 'Morning',
    estimatedCost: 4.50
  },
  {
    id: 'berry-7',
    name: 'Berry Green Fusion',
    description: 'Berries meet green nutrition',
    ingredients: [
      '1 cup mixed berries',
      '1 cup spinach',
      '1/2 avocado',
      '1 cup coconut water',
      '1 cup ice'
    ],
    benefits: ['Hidden greens', 'Complete nutrition', 'Healthy fats', 'Detoxifying'],
    nutrition: { calories: 240, protein: 5, carbs: 38, fiber: 11, sugar: 20, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 234,
    berryType: 'Mixed Berries',
    bestTime: 'Morning',
    estimatedCost: 3.80
  },
  {
    id: 'berry-8',
    name: 'Strawberry Banana Classic',
    description: 'The timeless favorite combination',
    ingredients: [
      '1.5 cups strawberries',
      '1 banana',
      '1 cup milk',
      '1/2 cup vanilla yogurt',
      '1 cup ice'
    ],
    benefits: ['Classic taste', 'Kid-friendly', 'Potassium', 'Calcium'],
    nutrition: { calories: 290, protein: 11, carbs: 52, fiber: 7, sugar: 38, added_sugar: 10 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 756,
    berryType: 'Strawberry',
    bestTime: 'Anytime',
    estimatedCost: 2.70
  },
  {
    id: 'berry-9',
    name: 'Cranberry Citrus Zing',
    description: 'Tart cranberries with orange kick',
    ingredients: [
      '1 cup cranberries',
      '1 orange',
      '1/2 cup Greek yogurt',
      '1 tbsp honey',
      '1 cup ice'
    ],
    benefits: ['UTI prevention', 'Immune boost', 'Vitamin C', 'Refreshing'],
    nutrition: { calories: 210, protein: 9, carbs: 40, fiber: 6, sugar: 28, added_sugar: 12 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.4,
    reviews: 145,
    berryType: 'Cranberry',
    bestTime: 'Morning',
    estimatedCost: 3.20
  }
];

const berryTypes = [
  { id: 'mixed', name: 'Mixed Berries', description: 'Combination of different berries' },
  { id: 'strawberry', name: 'Strawberry', description: 'Sweet and vitamin C rich' },
  { id: 'blueberry', name: 'Blueberry', description: 'Brain-boosting antioxidants' },
  { id: 'raspberry', name: 'Raspberry', description: 'Tart and fiber-rich' },
  { id: 'blackberry', name: 'Blackberry', description: 'Dark and nutrient-dense' },
  { id: 'acai', name: 'Açaí', description: 'Superfood berry power' },
  { id: 'cranberry', name: 'Cranberry', description: 'Tart and immune-boosting' }
];

const berryBenefitsList = [
  { id: 'antioxidants', name: 'Antioxidants', description: 'Fight free radicals' },
  { id: 'heart', name: 'Heart Health', description: 'Support cardiovascular function' },
  { id: 'brain', name: 'Brain Boost', description: 'Improve cognitive function' },
  { id: 'immune', name: 'Immune Support', description: 'Strengthen immunity' },
  { id: 'skin', name: 'Skin Health', description: 'Glowing complexion' },
  { id: 'digestive', name: 'Digestive Health', description: 'Improve gut function' }
];

// ---------- Cross-nav - Top Level Drink Categories ----------
const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'smoothies', name: 'All Smoothies', icon: Sparkles, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Flame, route: '/drinks', description: 'Browse everything' }
];

// Sister smoothie subcategories (excluding berry since we're on berry page)
const allSmoothieSubcategories = [
  { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Zap, description: 'High-protein blends' },
  { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Crown, description: 'Morning fuel' },
  { id: 'workout', name: 'Workout', path: '/drinks/smoothies/workout', icon: Activity, description: 'Pre & post workout' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Superfood greens' },
  { id: 'tropical', name: 'Tropical', path: '/drinks/smoothies/tropical', icon: Droplets, description: 'Exotic fruits' },
  { id: 'detox', name: 'Detox', path: '/drinks/smoothies/detox', icon: Sparkles, description: 'Cleansing blends' },
  { id: 'dessert', name: 'Dessert', path: '/drinks/smoothies/dessert', icon: Heart, description: 'Healthy treats' }
];

const berryAdvantages = [
  { icon: Heart, title: 'Antioxidant Power', description: 'Rich in disease-fighting compounds', color: 'text-red-400' },
  { icon: Star, title: 'Vitamin C Boost', description: 'Supports immune system and skin', color: 'text-red-400' },
  { icon: Zap, title: 'Brain Health', description: 'Improves memory and cognitive function', color: 'text-red-400' },
  { icon: Crown, title: 'Heart Protection', description: 'Supports cardiovascular health', color: 'text-red-400' },
  { icon: Sparkles, title: 'Anti-Inflammatory', description: 'Reduces inflammation in body', color: 'text-red-400' },
  { icon: Flame, title: 'Low Calorie', description: 'Nutrient-dense without excess calories', color: 'text-red-400' }
];

export default function BerrySmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBerryType, setSelectedBerryType] = useState('');
  const [selectedBenefit, setSelectedBenefit] = useState('');
  const [maxCalories, setMaxCalories] = useState<number | 'all'>('all');
  const [onlyNaturalSweetener, setOnlyNaturalSweetener] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'fiber' | 'cost' | 'calories'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'berry-types'|'benefits'|'featured'|'trending'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert berry smoothies to RecipeKit format with robust parsing
  const smoothieRecipesWithMeasurements = useMemo(() => {
    return berrySmoothies.map((s) => {
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
            'Add berries and liquid to blender first',
            'Blend until berries are completely broken down',
            'Add remaining ingredients and blend until smooth',
            'Pour into glass and enjoy immediately for maximum flavor'
          ]
        }
      };
    });
  }, []);

  const handleShareSmoothie = async (smoothie: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[smoothie.id] ?? (smoothie.recipe?.servings || 1);
    const preview = smoothie.ingredients.slice(0, 4).join(' • ');
    const text = `${smoothie.name} • ${smoothie.berryType} • ${smoothie.bestTime}\n${preview}${smoothie.ingredients.length > 4 ? ` …plus ${smoothie.ingredients.length - 4} more` : ''}`;
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
        description: `${selectedRecipe.berryType || ''} • ${selectedRecipe.bestTime || ''}`,
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
      addPoints(25); // XP for berry smoothies
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredSmoothies = () => {
    let filtered = smoothieRecipesWithMeasurements.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedBerryType || smoothie.berryType === selectedBerryType;
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
  const trendingSmoothies = smoothieRecipesWithMeasurements.filter(s => s.trending);

  // Share page handler
  const handleSharePage = async () => {
    const shareData = {
      title: 'Berry Smoothies',
      text: `Browse ${berrySmoothies.length} berry smoothies for antioxidant power and delicious flavor.`,
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-rose-50 to-pink-50">
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
          accent="red"
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
                <Heart className="h-6 w-6 text-red-500" />
                <h1 className="text-2xl font-bold text-gray-900">Berry Smoothies</h1>
                <Badge className="bg-red-100 text-red-700 border-red-200">Antioxidant Rich</Badge>
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
              <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* CROSS-HUB NAVIGATION - Top Level Drink Categories */}
        <Card className="bg-gradient-to-r from-red-50 to-rose-50 border-red-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-red-50 hover:border-red-300">
                      <Icon className="h-4 w-4 mr-2 text-red-500" />
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

        {/* SISTER SUBPAGES NAVIGATION - ALL SMOOTHIE TYPES (No Berry) */}
        <Card className="bg-gradient-to-r from-red-50 to-pink-50 border-red-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {allSmoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-red-50 hover:border-red-300">
                      <Icon className="h-4 w-4 mr-2 text-red-500" />
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

        {/* Berry Advantages */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Star className="h-6 w-6 text-red-500" />
              Why Berry Smoothies?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {berryAdvantages.map((advantage, index) => {
                const Icon = advantage.icon as any;
                return (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow">
                    <Icon className={`h-6 w-6 ${advantage.color} flex-shrink-0`} />
                    <div>
                      <h3 className="font-semibold mb-1">{advantage.title}</h3>
                      <p className="text-sm text-muted-foreground">{advantage.description}</p>
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
              <div className="text-2xl font-bold text-red-500">260</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-500">9g</div>
              <div className="text-sm text-gray-600">Avg Fiber</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-500">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{berrySmoothies.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'berry-types', label: 'Berry Types', icon: Heart },
            { id: 'benefits', label: 'Health Benefits', icon: Star },
            { id: 'featured', label: 'Featured', icon: Zap },
            { id: 'trending', label: 'Trending', icon: Flame }
          ].map(tab => {
            const Icon = tab.icon as any;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 ${activeTab === tab.id ? 'bg-red-500 shadow-sm !text-white hover:!text-white hover:bg-red-600' : ''}`}
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
                      placeholder="Search berry smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedBerryType}
                      onChange={(e) => setSelectedBerryType(e.target.value)}
                    >
                      <option value="">All Berry Types</option>
                      {berryTypes.map(type => (
                        <option key={type.id} value={type.name}>{type.name}</option>
                      ))}
                    </select>

                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedBenefit}
                      onChange={(e) => setSelectedBenefit(e.target.value)}
                    >
                      <option value="">All Benefits</option>
                      {berryBenefitsList.map(benefit => (
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
                  <Card key={smoothie.id} onClick={() => openRecipeModal(smoothie)} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="md:max-w-3xl md:flex-1">
                          <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToFavorites({
                              id: smoothie.id,
                              name: smoothie.name,
                              category: 'smoothies',
                              description: smoothie.description,
                              ingredients: smoothie.ingredients,
                              nutrition: smoothie.nutrition,
                              difficulty: smoothie.difficulty,
                              prepTime: smoothie.prepTime,
                              rating: smoothie.rating,
                              fitnessGoal: 'Berry Nutrition',
                              bestTime: smoothie.bestTime
                            });
                          }}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-100 text-red-700 border-red-200">{smoothie.berryType}</Badge>
                        {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-red-500">{smoothie.nutrition.calories}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-red-500">{smoothie.nutrition.fiber}g</div>
                          <div className="text-gray-500">Fiber</div>
                        </div>
                        <div>
                          <div className="font-bold text-red-500">{smoothie.prepTime}m</div>
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setServingsById(prev => ({ ...prev, [smoothie.id]: clamp((prev[smoothie.id] ?? (smoothie.recipe?.servings || 1)) - 1) }));
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
                                  setServingsById(prev => ({ ...prev, [smoothie.id]: clamp((prev[smoothie.id] ?? (smoothie.recipe?.servings || 1)) + 1) }));
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
                                    next[smoothie.id] = smoothie.recipe?.servings || 1;
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
                            {smoothie.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                              const isNum = typeof ing.amount === 'number';
                              const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                              const show = useMetric && isNum
                                ? toMetric(ing.unit, Number((typeof ing.amount === 'number' ? (ing.amount as number) : parseFloat(String(ing.amount))) * servings))
                                : { amount: scaledDisplay, unit: ing.unit };

                              return (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-red-500 mt-0.5" />
                                  <span>
                                    <span className="text-red-600 font-semibold">
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRecipeModal(smoothie);
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
                            <Button variant="outline" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              handleShareSmoothie(smoothie, servings);
                            }}>
                              <Share2 className="w-4 h-4 mr-1" /> Share
                            </Button>
                            {/* Metric Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMetricFlags((prev) => ({ ...prev, [smoothie.id]: !prev[smoothie.id] }));
                              }}
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
                          <span className="font-medium text-red-500">{smoothie.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {smoothie.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-red-100 text-red-700 hover:bg-red-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Smoothie Button */}
                      <div className="mt-3">
                        <Button
                          className="w-full bg-red-500 hover:bg-red-600 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRecipeModal(smoothie);
                          }}
                        >
                          <Heart className="h-4 w-4 mr-2" />
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

        {/* Berry Types Tab */}
        {activeTab === 'berry-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {berryTypes.map(type => (
              <Card key={type.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Heart className="h-6 w-6 text-red-500" />
                    </div>
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-red-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Key Benefit</div>
                    <div className="text-lg font-bold text-red-500">Antioxidants</div>
                  </div>
                  <Button className="w-full bg-red-500 hover:bg-red-600 text-white" onClick={() => setActiveTab('browse')}>
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
            {berryBenefitsList.map(benefit => (
              <Card key={benefit.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Star className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{benefit.name}</CardTitle>
                      <p className="text-sm text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-red-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Health Focus</div>
                    <div className="text-lg font-bold text-red-500">Wellness</div>
                  </div>
                  <Button className="w-full bg-red-500 hover:bg-red-600 text-white" onClick={() => setActiveTab('browse')}>
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
                  <img 
                    src={smoothie.image} 
                    alt={smoothie.name}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-4 left-4 bg-red-500 text-white">Featured</Badge>
                </div>
                
                <CardHeader>
                  <CardTitle>{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-red-500 hover:bg-red-600 text-white"
                    onClick={() => openRecipeModal(smoothie)}
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Make This Berry Smoothie
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Trending Tab */}
        {activeTab === 'trending' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="hover:shadow-lg transition-shadow border-2 border-red-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="md:max-w-3xl md:flex-1">
                      <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                      <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                    </div>
                    <Badge className="bg-red-500 text-white">🔥 Trending</Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-red-500 hover:bg-red-600 text-white"
                    onClick={() => openRecipeModal(smoothie)}
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Try This Trend
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-red-50 to-pink-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-red-500">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-red-500">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-red-500">
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
