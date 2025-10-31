// client/src/pages/drinks/caffeinated/iced/index.tsx
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
  Droplet, Leaf, Apple, Droplets, Target, Sun
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

// Improved ingredient parser
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

  const descriptors = new Set(['cold', 'iced', 'fresh', 'brewed', 'strong', 'double', 'vanilla', 'chocolate']);
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

// Iced coffee drinks data
const icedCoffeeDrinks = [
  {
    id: 'classic-iced-coffee',
    name: 'Classic Iced Coffee',
    description: 'Simple and refreshing iced coffee perfection',
    ingredients: [
      '2 cup cold brew coffee',
      '½ cup milk',
      '2 tbsp simple syrup',
      '2 cup ice'
    ],
    benefits: ['Caffeine boost', 'Refreshing', 'Simple prep', 'Customizable'],
    nutrition: { calories: 80, protein: 2, carbs: 16, fiber: 0, sugar: 14, added_sugar: 14 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 892,
    drinkType: 'Classic Iced',
    caffeineLevel: 'High',
    featured: true,
    trending: true,
    bestTime: 'Anytime',
    estimatedCost: 1.80
  },
  {
    id: 'vanilla-iced-latte',
    name: 'Vanilla Iced Latte',
    description: 'Smooth espresso with vanilla and cold milk',
    ingredients: [
      '2 shot espresso',
      '1 cup milk',
      '2 tbsp vanilla syrup',
      '1½ cup ice'
    ],
    benefits: ['Creamy', 'Sweet flavor', 'Caffeine kick', 'Coffeehouse classic'],
    nutrition: { calories: 140, protein: 6, carbs: 22, fiber: 0, sugar: 20, added_sugar: 18 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 654,
    drinkType: 'Iced Latte',
    caffeineLevel: 'Medium',
    featured: false,
    trending: true,
    bestTime: 'Morning',
    estimatedCost: 2.40
  },
  {
    id: 'caramel-iced-coffee',
    name: 'Caramel Iced Coffee',
    description: 'Rich caramel sweetness over cold coffee',
    ingredients: [
      '2 cup cold brew coffee',
      '½ cup milk',
      '3 tbsp caramel sauce',
      '2 cup ice'
    ],
    benefits: ['Sweet indulgence', 'Energy boost', 'Dessert-like', 'Satisfying'],
    nutrition: { calories: 180, protein: 3, carbs: 32, fiber: 0, sugar: 28, added_sugar: 26 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 1203,
    drinkType: 'Flavored Iced',
    caffeineLevel: 'High',
    featured: true,
    trending: false,
    bestTime: 'Afternoon',
    estimatedCost: 2.60
  },
  {
    id: 'mocha-iced-coffee',
    name: 'Mocha Iced Coffee',
    description: 'Chocolate and coffee blend over ice',
    ingredients: [
      '2 shot espresso',
      '1 cup milk',
      '2 tbsp chocolate syrup',
      '1 tbsp cocoa powder',
      '1½ cup ice'
    ],
    benefits: ['Chocolate fix', 'Caffeine boost', 'Antioxidants', 'Mood lifting'],
    nutrition: { calories: 160, protein: 7, carbs: 26, fiber: 2, sugar: 22, added_sugar: 18 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 487,
    drinkType: 'Mocha',
    caffeineLevel: 'Medium',
    featured: false,
    trending: false,
    bestTime: 'Anytime',
    estimatedCost: 2.80
  },
  {
    id: 'coconut-iced-coffee',
    name: 'Coconut Iced Coffee',
    description: 'Tropical coconut meets bold coffee',
    ingredients: [
      '2 cup cold brew coffee',
      '½ cup coconut milk',
      '2 tbsp coconut syrup',
      '2 cup ice'
    ],
    benefits: ['Tropical flavor', 'Dairy-free', 'Energy boost', 'Creamy texture'],
    nutrition: { calories: 120, protein: 1, carbs: 18, fiber: 0, sugar: 16, added_sugar: 14 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 342,
    drinkType: 'Flavored Iced',
    caffeineLevel: 'High',
    featured: false,
    trending: true,
    bestTime: 'Morning',
    estimatedCost: 2.50
  },
  {
    id: 'hazelnut-iced-latte',
    name: 'Hazelnut Iced Latte',
    description: 'Nutty hazelnut flavor in a smooth latte',
    ingredients: [
      '2 shot espresso',
      '1 cup milk',
      '2 tbsp hazelnut syrup',
      '1½ cup ice'
    ],
    benefits: ['Nutty flavor', 'Creamy', 'Caffeine boost', 'Coffeehouse favorite'],
    nutrition: { calories: 150, protein: 6, carbs: 24, fiber: 0, sugar: 22, added_sugar: 20 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 521,
    drinkType: 'Iced Latte',
    caffeineLevel: 'Medium',
    featured: false,
    trending: false,
    bestTime: 'Morning',
    estimatedCost: 2.70
  },
  {
    id: 'salted-caramel-iced-coffee',
    name: 'Salted Caramel Iced Coffee',
    description: 'Sweet and salty caramel perfection',
    ingredients: [
      '2 cup cold brew coffee',
      '½ cup milk',
      '3 tbsp caramel sauce',
      '¼ tsp sea salt',
      '2 cup ice'
    ],
    benefits: ['Sweet & salty', 'Energy boost', 'Indulgent', 'Balanced flavor'],
    nutrition: { calories: 190, protein: 3, carbs: 34, fiber: 0, sugar: 30, added_sugar: 28 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 678,
    drinkType: 'Flavored Iced',
    caffeineLevel: 'High',
    featured: true,
    trending: true,
    bestTime: 'Afternoon',
    estimatedCost: 2.80
  },
  {
    id: 'peppermint-mocha-iced',
    name: 'Peppermint Mocha Iced',
    description: 'Refreshing mint and chocolate coffee blend',
    ingredients: [
      '2 shot espresso',
      '1 cup milk',
      '2 tbsp chocolate syrup',
      '1 tbsp peppermint syrup',
      '1½ cup ice'
    ],
    benefits: ['Minty fresh', 'Chocolate blend', 'Refreshing', 'Seasonal favorite'],
    nutrition: { calories: 170, protein: 7, carbs: 28, fiber: 1, sugar: 24, added_sugar: 22 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 412,
    drinkType: 'Mocha',
    caffeineLevel: 'Medium',
    featured: false,
    trending: false,
    bestTime: 'Afternoon',
    estimatedCost: 3.00
  }
];

const icedCoffeeTypes = [
  {
    id: 'classic-iced',
    name: 'Classic Iced',
    icon: Droplet,
    description: 'Simple cold coffee over ice',
    color: 'text-amber-400',
    timing: 'Anytime',
    focus: 'Pure Coffee'
  },
  {
    id: 'iced-latte',
    name: 'Iced Latte',
    icon: Coffee,
    description: 'Espresso with cold milk',
    color: 'text-amber-400',
    timing: 'Morning',
    focus: 'Creamy & Smooth'
  },
  {
    id: 'flavored-iced',
    name: 'Flavored Iced',
    icon: Sparkles,
    description: 'Syrups and flavor additions',
    color: 'text-amber-400',
    timing: 'Anytime',
    focus: 'Sweet & Flavorful'
  },
  {
    id: 'mocha',
    name: 'Mocha',
    icon: Heart,
    description: 'Chocolate meets coffee',
    color: 'text-amber-400',
    timing: 'Afternoon',
    focus: 'Chocolate Blend'
  }
];

const icedCoffeeBenefitsList = [
  { id: 'refreshing', name: 'Refreshing', description: 'Cool and energizing' },
  { id: 'caffeine', name: 'Caffeine Boost', description: 'Mental alertness' },
  { id: 'customizable', name: 'Customizable', description: 'Endless flavor options' },
  { id: 'convenient', name: 'Convenient', description: 'Ready in minutes' },
  { id: 'versatile', name: 'Versatile', description: 'Works any time of day' },
  { id: 'satisfying', name: 'Satisfying', description: 'Delicious and filling' }
];

// ---------- Cross-nav - Top Level Drink Categories ----------
const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'caffeinated', name: 'All Caffeinated', icon: Sparkles, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Flame, route: '/drinks', description: 'Browse everything' }
];

// Sister caffeinated subcategories (excluding iced since we're on iced page)
const allCaffeinatedSubcategories = [
  { id: 'espresso', name: 'Espresso', path: '/drinks/caffeinated/espresso', icon: Coffee, description: 'Pure & intense' },
  { id: 'cold-brew', name: 'Cold Brew', path: '/drinks/caffeinated/cold-brew', icon: Droplets, description: 'Smooth cold coffee' },
  { id: 'tea', name: 'Tea', path: '/drinks/caffeinated/tea', icon: Leaf, description: 'Tea varieties' },
  { id: 'matcha', name: 'Matcha', path: '/drinks/caffeinated/matcha', icon: Leaf, description: 'Green tea powder' },
  { id: 'lattes', name: 'Lattes', path: '/drinks/caffeinated/lattes', icon: Coffee, description: 'Milk & espresso' },
  { id: 'specialty', name: 'Specialty', path: '/drinks/caffeinated/specialty', icon: Crown, description: 'Unique creations' },
  { id: 'energy', name: 'Energy', path: '/drinks/caffeinated/energy', icon: Zap, description: 'High-energy drinks' }
];

const icedCoffeeAdvantages = [
  { icon: Droplet, title: 'Refreshingly Cold', description: 'Perfect cool coffee experience', color: 'text-amber-400' },
  { icon: Clock, title: 'Quick Prep', description: 'Ready in 2-4 minutes', color: 'text-amber-400' },
  { icon: Zap, title: 'Energy Boost', description: 'Caffeine when you need it', color: 'text-amber-400' },
  { icon: Star, title: 'Versatile', description: 'Endless flavor combinations', color: 'text-amber-400' },
  { icon: Sun, title: 'Anytime Drink', description: 'Perfect for any time of day', color: 'text-amber-400' },
  { icon: Heart, title: 'Customizable', description: 'Make it exactly how you like', color: 'text-amber-400' }
];

export default function IcedCoffeePage() {
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
  const [onlyNaturalSweetener, setOnlyNaturalSweetener] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'cost' | 'calories'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'drink-types'|'benefits'|'featured'|'trending'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert drinks to RecipeKit format
  const drinkRecipesWithMeasurements = useMemo(() => {
    return icedCoffeeDrinks.map((d) => {
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
            'Add coffee or espresso',
            'Pour in milk and flavorings',
            'Stir well and enjoy cold'
          ]
        }
      };
    });
  }, []);

  const handleShareDrink = async (drink: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[drink.id] ?? (drink.recipe?.servings || 1);
    const preview = drink.ingredients.slice(0, 4).join(' • ');
    const text = `${drink.name} • ${drink.drinkType} • ${drink.bestTime}\n${preview}${drink.ingredients.length > 4 ? ` …plus ${drink.ingredients.length - 4} more` : ''}`;
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
      addPoints(20);
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
      const matchesSweetener = !onlyNaturalSweetener || drink.nutrition.added_sugar === 0;
      return matchesSearch && matchesType && matchesBenefit && matchesCalories && matchesSweetener;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
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
      title: 'Iced Coffee Drinks',
      text: `Browse ${icedCoffeeDrinks.length} iced coffee drinks for refreshing energy.`,
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
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
          accent="amber"
          pointsReward={20}
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
                <Droplet className="h-6 w-6 text-amber-400" />
                <h1 className="text-2xl font-bold text-gray-900">Iced Coffee</h1>
                <Badge className="bg-amber-100 text-amber-600 border-amber-200">Cold & Refreshing</Badge>
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
              <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-amber-50 hover:border-amber-300">
                      <Icon className="h-4 w-4 mr-2 text-amber-400" />
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
        <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Caffeinated Drinks</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {allCaffeinatedSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-amber-50 hover:border-amber-300">
                      <Icon className="h-4 w-4 mr-2 text-amber-400" />
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

        {/* Iced Coffee Advantages */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Droplet className="h-6 w-6 text-amber-400" />
              Why Iced Coffee?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {icedCoffeeAdvantages.map((advantage, index) => {
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
              <div className="text-2xl font-bold text-amber-400">149</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">4.4g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{icedCoffeeDrinks.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'drink-types', label: 'Drink Types', icon: Coffee },
            { id: 'benefits', label: 'Benefits', icon: Heart },
            { id: 'featured', label: 'Featured', icon: Star },
            { id: 'trending', label: 'Trending', icon: Zap }
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
                      placeholder="Search iced coffee drinks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={selectedDrinkType}
                      onChange={(e) => setSelectedDrinkType(e.target.value)}
                    >
                      <option value="">All Drink Types</option>
                      {icedCoffeeTypes.map(type => (
                        <option key={type.id} value={type.name}>{type.name}</option>
                      ))}
                    </select>

                    <select
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={selectedBenefit}
                      onChange={(e) => setSelectedBenefit(e.target.value)}
                    >
                      <option value="">All Benefits</option>
                      {icedCoffeeBenefitsList.map(benefit => (
                        <option key={benefit.id} value={benefit.name}>{benefit.name}</option>
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
                      <option value="protein">Sort by Protein</option>
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
                  <Card key={drink.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{drink.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{drink.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addToFavorites({
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
                          })}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(drink.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-100 text-amber-600 border-amber-200">{drink.drinkType}</Badge>
                        <Badge variant="outline">{drink.caffeineLevel}</Badge>
                        {drink.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-amber-400">{drink.nutrition.calories}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-amber-400">{drink.nutrition.protein}g</div>
                          <div className="text-gray-500">Protein</div>
                        </div>
                        <div>
                          <div className="font-bold text-amber-400">{drink.prepTime}m</div>
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
                                onClick={() => setServingsById(prev => {
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
                                  <Check className="h-4 w-4 text-amber-400 mt-0.5" />
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
                                  onClick={() => openRecipeModal(drink)}
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
                            <Button variant="outline" size="sm" onClick={() => handleShareDrink(drink, servings)}>
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
                          <span className="font-medium text-amber-400">{drink.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags - BELOW DESCRIPTION */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {drink.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-amber-100 text-amber-600 hover:bg-amber-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Drink Button */}
                      <div className="mt-3">
                        <Button
                          className="w-full bg-amber-400 hover:bg-amber-500 text-white"
                          onClick={() => openRecipeModal(drink)}
                        >
                          <Coffee className="h-4 w-4 mr-2" />
                          Make Drink (+20 XP)
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
            {icedCoffeeTypes.map(type => {
              const Icon = type.icon;
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Icon className="h-6 w-6 text-amber-400" />
                      </div>
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center bg-amber-50 p-3 rounded-lg mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-1">Timing</div>
                      <div className="text-lg font-bold text-amber-400">{type.timing}</div>
                    </div>
                    <Button className="w-full bg-amber-400 hover:bg-amber-500 text-white" onClick={() => setActiveTab('browse')}>
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
            {icedCoffeeBenefitsList.map(benefit => (
              <Card key={benefit.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Heart className="h-6 w-6 text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{benefit.name}</CardTitle>
                      <p className="text-sm text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-amber-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Coffee Focus</div>
                    <div className="text-lg font-bold text-amber-400">Iced Support</div>
                  </div>
                  <Button className="w-full bg-amber-400 hover:bg-amber-500 text-white" onClick={() => setActiveTab('browse')}>
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
                <div className="relative h-48 bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center">
                  <Droplet className="h-24 w-24 text-amber-400 opacity-50" />
                  <Badge className="absolute top-4 left-4 bg-amber-400 text-white">Featured</Badge>
                </div>

                <CardHeader>
                  <CardTitle>{drink.name}</CardTitle>
                  <p className="text-gray-600">{drink.description}</p>
                </CardHeader>

                <CardContent>
                  <Button
                    className="w-full bg-amber-400 hover:bg-amber-500 text-white"
                    onClick={() => openRecipeModal(drink)}
                  >
                    <Coffee className="h-4 w-4 mr-2" />
                    Make This Iced Coffee
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
              <Card key={drink.id} className="hover:shadow-lg transition-shadow border-2 border-amber-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{drink.name}</CardTitle>
                      <p className="text-sm text-gray-600 mb-2">{drink.description}</p>
                    </div>
                    <Badge className="bg-red-400 text-white">🔥 Trending</Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <Button
                    className="w-full bg-amber-400 hover:bg-amber-500 text-white"
                    onClick={() => openRecipeModal(drink)}
                  >
                    <Coffee className="h-4 w-4 mr-2" />
                    Try This Trend
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-amber-400">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-amber-400">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-amber-400">
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
