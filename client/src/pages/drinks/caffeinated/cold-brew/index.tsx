// client/src/pages/drinks/caffeinated/cold-brew/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Coffee, Clock, Heart, Star, Crown, Search,
  Share2, ArrowLeft, Camera, Zap, X, Check,
  Clipboard, RotateCcw, Sparkles, Wine, Flame,
  Sun, Leaf, Droplets, Target, Apple
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

// metric conversion
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

// Ingredient parser
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

  const descriptors = new Set(['cold', 'fresh', 'brewed', 'chilled', 'ice-cold']);
  if (descriptors.has(unit)) {
    item = [unit, item].filter(Boolean).join(' ').trim();
    unit = 'item';
  }

  if (item.includes('(optional)')) {
    item = item.replace('(optional)', '').trim();
    return m(amount, unit, item, 'optional');
  }

  return m(amount, unit, item);
};

// Enhanced cold brew drinks data
const coldBrewDrinks = [
  {
    id: 'classic-cold-brew',
    name: 'Classic Cold Brew',
    description: 'Smooth, low-acid coffee steeped for 12-24 hours',
    ingredients: [
      '8 oz cold brew concentrate',
      '8 oz filtered water',
      '1 cup ice'
    ],
    benefits: ['Smooth flavor', 'Low acidity', 'High caffeine', 'Less bitter'],
    nutrition: { calories: 5, caffeine: 200, carbs: 0, sugar: 0, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.9,
    reviews: 1234,
    drinkType: 'Pure Cold Brew',
    energyLevel: 'High',
    featured: true,
    trending: false,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=300&fit=crop',
    estimatedCost: 2.50
  },
  {
    id: 'vanilla-cold-brew',
    name: 'Vanilla Sweet Cream Cold Brew',
    description: 'Cold brew with house-made vanilla sweet cream',
    ingredients: [
      '8 oz cold brew concentrate',
      '4 oz filtered water',
      '2 oz vanilla sweet cream',
      '1 cup ice'
    ],
    benefits: ['Creamy', 'Sweet', 'Energizing', 'Indulgent'],
    nutrition: { calories: 110, caffeine: 200, carbs: 12, sugar: 11, added_sugar: 10 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 892,
    drinkType: 'Flavored',
    energyLevel: 'High',
    featured: true,
    trending: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop',
    estimatedCost: 3.50
  },
  {
    id: 'nitro-cold-brew',
    name: 'Nitro Cold Brew',
    description: 'Cold brew infused with nitrogen for a creamy texture',
    ingredients: [
      '12 oz nitro cold brew',
      'Nitrogen infusion'
    ],
    benefits: ['Creamy texture', 'Smooth', 'No sugar needed', 'Rich'],
    nutrition: { calories: 5, caffeine: 280, carbs: 0, sugar: 0, added_sugar: 0 },
    difficulty: 'Medium',
    prepTime: 2,
    rating: 4.9,
    reviews: 678,
    drinkType: 'Specialty',
    energyLevel: 'Very High',
    featured: true,
    trending: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=300&fit=crop',
    estimatedCost: 4.50
  },
  {
    id: 'caramel-cold-brew',
    name: 'Salted Caramel Cold Brew',
    description: 'Cold brew with salted caramel and cream',
    ingredients: [
      '8 oz cold brew concentrate',
      '4 oz milk',
      '2 tbsp caramel syrup',
      '1 pinch sea salt',
      '1 cup ice'
    ],
    benefits: ['Sweet & salty', 'Energizing', 'Indulgent', 'Balanced'],
    nutrition: { calories: 150, caffeine: 200, carbs: 20, sugar: 18, added_sugar: 16 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 567,
    drinkType: 'Flavored',
    energyLevel: 'High',
    featured: false,
    trending: false,
    bestTime: 'Afternoon',
    image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=300&fit=crop',
    estimatedCost: 3.75
  },
  {
    id: 'mocha-cold-brew',
    name: 'Mocha Cold Brew',
    description: 'Cold brew with chocolate and milk',
    ingredients: [
      '8 oz cold brew concentrate',
      '4 oz milk',
      '2 tbsp chocolate syrup',
      '1 cup ice'
    ],
    benefits: ['Chocolatey', 'Sweet', 'Energizing', 'Indulgent'],
    nutrition: { calories: 140, caffeine: 200, carbs: 22, sugar: 20, added_sugar: 18 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 723,
    drinkType: 'Flavored',
    energyLevel: 'High',
    featured: false,
    trending: true,
    bestTime: 'Afternoon',
    image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=300&fit=crop',
    estimatedCost: 3.50
  },
  {
    id: 'protein-cold-brew',
    name: 'Protein Cold Brew',
    description: 'Cold brew with protein powder for post-workout',
    ingredients: [
      '8 oz cold brew concentrate',
      '4 oz almond milk',
      '1 scoop vanilla protein powder',
      '1 cup ice'
    ],
    benefits: ['High protein', 'Energizing', 'Muscle recovery', 'Filling'],
    nutrition: { calories: 180, caffeine: 200, carbs: 8, sugar: 3, added_sugar: 2 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 445,
    drinkType: 'Functional',
    energyLevel: 'High',
    featured: false,
    trending: false,
    bestTime: 'Post-Workout',
    image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=300&fit=crop',
    estimatedCost: 4.00
  },
  {
    id: 'oat-milk-cold-brew',
    name: 'Oat Milk Cold Brew',
    description: 'Cold brew with creamy oat milk',
    ingredients: [
      '8 oz cold brew concentrate',
      '6 oz oat milk',
      '1 cup ice'
    ],
    benefits: ['Creamy', 'Plant-based', 'Smooth', 'Energizing'],
    nutrition: { calories: 90, caffeine: 200, carbs: 14, sugar: 4, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 556,
    drinkType: 'Plant-Based',
    energyLevel: 'High',
    featured: false,
    trending: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=300&fit=crop',
    estimatedCost: 3.25
  },
  {
    id: 'coconut-cold-brew',
    name: 'Coconut Cream Cold Brew',
    description: 'Cold brew with coconut cream topping',
    ingredients: [
      '8 oz cold brew concentrate',
      '4 oz filtered water',
      '2 oz coconut cream',
      '1 cup ice'
    ],
    benefits: ['Tropical', 'Creamy', 'Energizing', 'Rich'],
    nutrition: { calories: 120, caffeine: 200, carbs: 8, sugar: 6, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 389,
    drinkType: 'Plant-Based',
    energyLevel: 'High',
    featured: false,
    trending: false,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=300&fit=crop',
    estimatedCost: 3.75
  }
];

const drinkTypes = [
  {
    id: 'pure',
    name: 'Pure Cold Brew',
    icon: Droplets,
    description: 'Classic cold-steeped coffee',
    color: 'text-rose-400',
    timing: 'Smooth',
    focus: 'Low Acidity'
  },
  {
    id: 'flavored',
    name: 'Flavored',
    icon: Sparkles,
    description: 'Cold brew with syrups and flavors',
    color: 'text-rose-400',
    timing: 'Sweet',
    focus: 'Indulgent'
  },
  {
    id: 'specialty',
    name: 'Specialty',
    icon: Crown,
    description: 'Unique cold brew preparations',
    color: 'text-rose-400',
    timing: 'Premium',
    focus: 'Elevated'
  }
];

const benefitsList = [
  { id: 'smooth', name: 'Smooth Flavor', description: 'Less acidic than hot coffee' },
  { id: 'energy', name: 'High Caffeine', description: 'More caffeine per serving' },
  { id: 'refreshing', name: 'Refreshing', description: 'Perfect for hot days' },
  { id: 'versatile', name: 'Versatile', description: 'Endless customization options' }
];

// Cross-nav
const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'caffeinated', name: 'All Caffeinated', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Flame, route: '/drinks', description: 'Browse everything' }
];

// Sister caffeinated subcategories
const allCaffeinatedSubcategories = [
  { id: 'espresso', name: 'Espresso', path: '/drinks/caffeinated/espresso', icon: Coffee, description: 'Classic espresso drinks' },
  { id: 'iced', name: 'Iced Coffee', path: '/drinks/caffeinated/iced', icon: Sun, description: 'Refreshing iced drinks' },
  { id: 'tea', name: 'Tea', path: '/drinks/caffeinated/tea', icon: Leaf, description: 'Hot & iced tea' },
  { id: 'matcha', name: 'Matcha', path: '/drinks/caffeinated/matcha', icon: Sparkles, description: 'Japanese green tea' },
  { id: 'lattes', name: 'Lattes', path: '/drinks/caffeinated/lattes', icon: Heart, description: 'Milk-based coffee' },
  { id: 'specialty', name: 'Specialty', path: '/drinks/caffeinated/specialty', icon: Crown, description: 'Unique creations' },
  { id: 'energy', name: 'Energy Drinks', path: '/drinks/caffeinated/energy', icon: Zap, description: 'Natural energy' }
];

const coldBrewAdvantages = [
  { icon: Droplets, title: 'Smooth & Low-Acid', description: 'Less acidic than hot-brewed coffee', color: 'text-rose-400' },
  { icon: Zap, title: 'High Caffeine', description: 'More caffeine per ounce', color: 'text-rose-400' },
  { icon: Clock, title: 'Long Shelf Life', description: 'Stays fresh for up to 2 weeks', color: 'text-rose-400' },
  { icon: Sun, title: 'Perfect Iced', description: 'Never watered down by ice', color: 'text-rose-400' },
  { icon: Heart, title: 'Versatile Base', description: 'Endless flavor combinations', color: 'text-rose-400' },
  { icon: Target, title: 'Consistent', description: 'Same great taste every time', color: 'text-rose-400' }
];

export default function ColdBrewDrinksPage() {
  const {
    addToFavorites,
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrinkType, setSelectedDrinkType] = useState('');
  const [selectedBenefit, setSelectedBenefit] = useState('');
  const [maxCalories, setMaxCalories] = useState<number | 'all'>('all');
  const [onlyZeroSugar, setOnlyZeroSugar] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'caffeine' | 'cost' | 'calories'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'drink-types'|'benefits'|'featured'|'trending'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert cold brew drinks to RecipeKit format
  const drinkRecipesWithMeasurements = useMemo(() => {
    return coldBrewDrinks.map((d) => {
      const rawList = Array.isArray(d.ingredients) ? d.ingredients : [];

      const measurements = rawList.map((ing: any) => {
        if (typeof ing === 'string') return parseIngredient(ing);
        const { amount = 1, unit = 'item', item = '', note = '' } = ing || {};
        return { amount, unit, item, note };
      });

      return {
        ...d,
        recipe: {
          servings: 1,
          measurements,
          directions: [
            'Fill glass with ice',
            'Pour cold brew concentrate',
            'Add milk or water as needed',
            'Stir gently and enjoy'
          ]
        }
      };
    });
  }, []);

  const handleShareDrink = async (drink: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[drink.id] ?? (drink.recipe?.servings || 1);
    const preview = drink.ingredients.slice(0, 2).join(' • ');
    const text = `${drink.name} • ${drink.drinkType} • ${drink.bestTime}\n${preview}`;
    const shareData = { title: drink.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${drink.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${drink.name}\n${text}\n${url}`);
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
        category: 'caffeinated' as const,
        description: `${selectedRecipe.drinkType || ''} • ${selectedRecipe.bestTime || ''}`,
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
      addPoints(25);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredDrinks = () => {
    let filtered = drinkRecipesWithMeasurements.filter(drink => {
      const matchesSearch = drink.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           drink.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedDrinkType || drink.drinkType === selectedDrinkType;
      const matchesBenefit = !selectedBenefit || drink.benefits.some((b: string) => b.toLowerCase().includes(selectedBenefit.toLowerCase()));
      const matchesCalories = maxCalories === 'all' || drink.nutrition.calories <= maxCalories;
      const matchesSugar = !onlyZeroSugar || drink.nutrition.added_sugar === 0;
      return matchesSearch && matchesType && matchesBenefit && matchesCalories && matchesSugar;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'caffeine': return (b.nutrition.caffeine || 0) - (a.nutrition.caffeine || 0);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredDrinks = getFilteredDrinks();
  const featuredDrinks = drinkRecipesWithMeasurements.filter(d => d.featured);
  const trendingDrinks = drinkRecipesWithMeasurements.filter(d => d.trending);

  const handleSharePage = async () => {
    const shareData = {
      title: 'Cold Brew Drinks',
      text: `Browse ${coldBrewDrinks.length} cold brew drinks for smooth, high-caffeine refreshment.`,
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
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-red-50 to-pink-50">
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
          accent="rose"
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
              <Link href="/drinks/caffeinated">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Caffeinated
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Droplets className="h-6 w-6 text-rose-400" />
                <h1 className="text-2xl font-bold text-gray-900">Cold Brew Drinks</h1>
                <Badge className="bg-rose-100 text-rose-600 border-rose-200">Smooth & Refreshing</Badge>
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
              <Button size="sm" className="bg-rose-400 hover:bg-rose-500 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-rose-50 to-red-50 border-rose-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-rose-50 hover:border-rose-300">
                      <Icon className="h-4 w-4 mr-2 text-rose-400" />
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

        {/* SISTER SUBPAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-rose-50 to-pink-50 border-rose-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Caffeinated Drink Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {allCaffeinatedSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-rose-50 hover:border-rose-300">
                      <Icon className="h-4 w-4 mr-2 text-rose-400" />
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

        {/* Cold Brew Advantages */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Droplets className="h-6 w-6 text-rose-400" />
              Why Cold Brew?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coldBrewAdvantages.map((advantage, index) => {
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
              <div className="text-2xl font-bold text-rose-400">95</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-rose-400">200mg</div>
              <div className="text-sm text-gray-600">Avg Caffeine</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-rose-400">4.8★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-rose-400">{coldBrewDrinks.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'drink-types', label: 'Drink Types', icon: Droplets },
            { id: 'benefits', label: 'Benefits', icon: Heart },
            { id: 'featured', label: 'Featured', icon: Star },
            { id: 'trending', label: 'Trending', icon: Zap }
          ].map(tab => {
            const Icon = tab.icon as any;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 ${activeTab === tab.id ? 'bg-rose-500 shadow-sm !text-white hover:!text-white hover:bg-rose-600' : ''}`}
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
                      placeholder="Search cold brew drinks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedDrinkType}
                      onChange={(e) => setSelectedDrinkType(e.target.value)}
                    >
                      <option value="">All Types</option>
                      {drinkTypes.map(type => (
                        <option key={type.id} value={type.name}>{type.name}</option>
                      ))}
                    </select>

                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedBenefit}
                      onChange={(e) => setSelectedBenefit(e.target.value)}
                    >
                      <option value="">All Benefits</option>
                      {benefitsList.map(benefit => (
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
                      <option value={50}>Under 50 cal</option>
                      <option value={100}>Under 100 cal</option>
                      <option value={150}>Under 150 cal</option>
                      <option value={200}>Under 200 cal</option>
                    </select>

                    <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                      <input
                        type="checkbox"
                        checked={onlyZeroSugar}
                        onChange={(e) => setOnlyZeroSugar(e.target.checked)}
                      />
                      Zero Added Sugar
                    </label>

                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="caffeine">Sort by Caffeine</option>
                      <option value="cost">Sort by Cost</option>
                      <option value="calories">Sort by Calories</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Drink Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDrinks.map(drink => {
                const useMetric = !!metricFlags[drink.id];
                const servings = servingsById[drink.id] ?? (drink.recipe?.servings || 1);

                return (
                  <Card key={drink.id} onClick={(e) => { e.stopPropagation(); openRecipeModal(drink); }} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="md:max-w-3xl md:flex-1">
                          <CardTitle className="text-lg mb-1">{drink.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{drink.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); addToFavorites({
                            id: drink.id,
                            name: drink.name,
                            category: 'caffeinated',
                            description: drink.description,
                            ingredients: drink.ingredients,
                            nutrition: drink.nutrition,
                            difficulty: drink.difficulty,
                            prepTime: drink.prepTime,
                            rating: drink.rating,
                            drinkType: drink.drinkType,
                            bestTime: drink.bestTime
                          }); }}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(drink.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className="bg-rose-100 text-rose-600 border-rose-200">{drink.drinkType}</Badge>
                        <Badge variant="outline">{drink.energyLevel}</Badge>
                        {drink.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-rose-400">{drink.nutrition.calories}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-rose-400">{drink.nutrition.caffeine}mg</div>
                          <div className="text-gray-500">Caffeine</div>
                        </div>
                        <div>
                          <div className="font-bold text-rose-400">{drink.prepTime}m</div>
                          <div className="text-gray-500">Prep</div>
                        </div>
                      </div>

                      {/* RATING & DIFFICULTY - Immediately above recipe card */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{drink.rating}</span>
                          <span className="text-gray-500 text-sm">({drink.reviews})</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {drink.difficulty}
                        </Badge>
                      </div>

                      {/* RecipeKit Preview */}
                      {Array.isArray(drink.recipe?.measurements) && drink.recipe.measurements.length > 0 && (
                        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-900">
                              Recipe (serves {servings})
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [drink.id]: clamp((prev[drink.id] ?? (drink.recipe?.servings || 1)) - 1) }))
                                }
                                aria-label="decrease servings"
                              >
                                −
                              </button>
                              <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [drink.id]: clamp((prev[drink.id] ?? (drink.recipe?.servings || 1)) + 1) }))
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
                                  next[drink.id] = drink.recipe?.servings || 1;
                                  return next;
                                })}
                                title="Reset servings"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                              </Button>
                            </div>
                          </div>

                          <ul className="text-sm leading-6 text-gray-800 space-y-1">
                            {drink.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                              const isNum = typeof ing.amount === 'number';
                              const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                              const show = useMetric && isNum
                                ? toMetric(ing.unit, Number((typeof ing.amount === 'number' ? (ing.amount as number) : parseFloat(String(ing.amount))) * servings))
                                : { amount: scaledDisplay, unit: ing.unit };

                              return (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-rose-400 mt-0.5" />
                                  <span>
                                    <span className="text-amber-500 font-semibold">
                                      {show.amount} {show.unit}
                                    </span>{" "}
                                    {ing.item}
                                    {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                  </span>
                                </li>
                              );
                            })}
                            {drink.recipe.measurements.length > 4 && (
                              <li className="text-xs text-gray-600">
                                …plus {drink.recipe.measurements.length - 4} more •{" "}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openRecipeModal(drink); }}
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
                                const lines = drink.ingredients.map((ing: string) => `- ${ing}`);
                                const txt = `${drink.name} (serves ${servings})\n${lines.join('\n')}`;
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
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleShareDrink(drink, servings)}>
                              <Share2 className="w-4 h-4 mr-1" /> Share
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setMetricFlags((prev) => ({ ...prev, [drink.id]: !prev[drink.id] }))
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
                          <span className="font-medium text-rose-400">{drink.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags - BELOW DESCRIPTION */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {drink.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-rose-100 text-rose-600 hover:bg-amber-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Drink Button */}
                      <div className="mt-3">
                        <Button
                          className="w-full bg-rose-400 hover:bg-rose-500 text-white"
                          onClick={(e) => { e.stopPropagation(); openRecipeModal(drink); }}
                        >
                          <Droplets className="h-4 w-4 mr-2" />
                          Make Drink (+25 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Drink Types Tab */}
        {activeTab === 'drink-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drinkTypes.map(type => {
              const Icon = type.icon;
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Icon className="h-6 w-6 text-rose-400" />
                      </div>
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center bg-rose-50 p-3 rounded-lg mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-1">Focus</div>
                      <div className="text-lg font-bold text-rose-400">{type.focus}</div>
                    </div>
                    <Button className="w-full bg-rose-400 hover:bg-rose-500 text-white" onClick={() => setActiveTab('browse')}>
                      Explore {type.name}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Benefits Tab */}
        {activeTab === 'benefits' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefitsList.map(benefit => (
              <Card key={benefit.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 rounded-lg">
                      <Heart className="h-6 w-6 text-rose-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{benefit.name}</CardTitle>
                      <p className="text-sm text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-rose-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Perfect For</div>
                    <div className="text-lg font-bold text-rose-400">Cold Brew Lovers</div>
                  </div>
                  <Button className="w-full bg-rose-400 hover:bg-rose-500 text-white" onClick={() => setActiveTab('browse')}>
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
            {featuredDrinks.map(drink => (
              <Card key={drink.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative h-48">
                  {drink.image && (
                    <img
                      src={drink.image}
                      alt={drink.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <Badge className="absolute top-4 left-4 bg-rose-400 text-white">Featured</Badge>
                </div>

                <CardHeader>
                  <CardTitle>{drink.name}</CardTitle>
                  <p className="text-gray-600">{drink.description}</p>
                </CardHeader>

                <CardContent>
                  <Button
                    className="w-full bg-rose-400 hover:bg-rose-500 text-white"
                    onClick={(e) => { e.stopPropagation(); openRecipeModal(drink); }}
                  >
                    <Droplets className="h-4 w-4 mr-2" />
                    Make This Drink
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Trending Tab */}
        {activeTab === 'trending' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingDrinks.map(drink => (
              <Card key={drink.id} className="hover:shadow-lg transition-shadow border-2 border-rose-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="md:max-w-3xl md:flex-1">
                      <CardTitle className="text-lg mb-1">{drink.name}</CardTitle>
                      <p className="text-sm text-gray-600 mb-2">{drink.description}</p>
                    </div>
                    <Badge className="bg-red-400 text-white">🔥 Trending</Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <Button
                    className="w-full bg-rose-400 hover:bg-rose-500 text-white"
                    onClick={(e) => { e.stopPropagation(); openRecipeModal(drink); }}
                  >
                    <Droplets className="h-4 w-4 mr-2" />
                    Try This Trend
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-rose-50 to-red-50 border-rose-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-rose-400">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-rose-400">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-rose-400">
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
