// client/src/pages/drinks/caffeinated/espresso/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Coffee, Clock, Heart, Star, Search,
  Share2, ArrowLeft, Camera, Zap, X, Check,
  Clipboard, RotateCcw, Sparkles, Wine, Flame,
  Target, Leaf, Palmtree, Droplets, Sun, Crown
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
  const mlPerOz = 30;
  switch (unit) {
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
    case 'shot': return { amount: Math.round(amount * 30), unit: 'ml' };
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

  // If unit looks like a descriptor (not a real unit), fold it back into the item
  const descriptors = new Set(['hot', 'cold', 'fresh', 'ground', 'brewed', 'espresso']);
  if (descriptors.has(unit)) {
    item = [unit, item].filter(Boolean).join(' ').trim();
    unit = 'item';
  }

  // Handle notes like "(optional)"
  if (item.includes('(optional)')) {
    item = item.replace('(optional)', '').trim();
    return m(amount, unit, item, 'optional');
  }

  return m(amount, unit, item);
};

// Enhanced espresso drinks data with proper measurements
const espressoDrinks = [
  {
    id: 'classic-espresso',
    name: 'Classic Espresso Shot',
    description: 'Pure, intense coffee flavor in a small shot',
    ingredients: [
      '1 shot espresso',
      '18 grams ground coffee'
    ],
    benefits: ['Quick energy', 'Mental clarity', 'Focus boost', 'Antioxidants'],
    nutrition: { calories: 3, protein: 0, carbs: 0, fiber: 0, caffeine: 64 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.9,
    reviews: 1523,
    drinkType: 'Espresso Shot',
    energyLevel: 'High',
    featured: true,
    trending: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&h=300&fit=crop',
    estimatedCost: 0.80
  },
  {
    id: 'doppio',
    name: 'Doppio',
    description: 'Double shot of espresso for double the energy',
    ingredients: [
      '2 shot espresso',
      '36 grams ground coffee'
    ],
    benefits: ['High energy', 'Intense flavor', 'Quick caffeine hit', 'Alertness'],
    nutrition: { calories: 6, protein: 0, carbs: 0, fiber: 0, caffeine: 128 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 987,
    drinkType: 'Double Shot',
    energyLevel: 'Very High',
    featured: true,
    trending: false,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=300&fit=crop',
    estimatedCost: 1.20
  },
  {
    id: 'macchiato',
    name: 'Espresso Macchiato',
    description: 'Espresso "marked" with a dollop of foamed milk',
    ingredients: [
      '1 shot espresso',
      '1 tbsp foamed milk'
    ],
    benefits: ['Smooth taste', 'Less intense', 'Balanced flavor', 'Creamy'],
    nutrition: { calories: 10, protein: 0, carbs: 1, fiber: 0, caffeine: 64 },
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.7,
    reviews: 756,
    drinkType: 'Milk Espresso',
    energyLevel: 'High',
    featured: false,
    trending: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=300&fit=crop',
    estimatedCost: 1.50
  },
  {
    id: 'americano',
    name: 'Caffè Americano',
    description: 'Espresso diluted with hot water for a fuller cup',
    ingredients: [
      '2 shot espresso',
      '6 oz hot water'
    ],
    benefits: ['Sustained energy', 'Smooth flavor', 'Less intense', 'Hydrating'],
    nutrition: { calories: 6, protein: 0, carbs: 0, fiber: 0, caffeine: 128 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1234,
    drinkType: 'Diluted Espresso',
    energyLevel: 'High',
    featured: false,
    trending: false,
    bestTime: 'Anytime',
    image: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400&h=300&fit=crop',
    estimatedCost: 1.00
  },
  {
    id: 'ristretto',
    name: 'Ristretto',
    description: 'Short shot of espresso for concentrated flavor',
    ingredients: [
      '1 shot espresso',
      '15 grams ground coffee'
    ],
    benefits: ['Intense flavor', 'Less bitter', 'Smooth finish', 'Sweet notes'],
    nutrition: { calories: 2, protein: 0, carbs: 0, fiber: 0, caffeine: 50 },
    difficulty: 'Medium',
    prepTime: 2,
    rating: 4.8,
    reviews: 543,
    drinkType: 'Short Shot',
    energyLevel: 'Medium',
    featured: false,
    trending: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400&h=300&fit=crop',
    estimatedCost: 0.90
  },
  {
    id: 'lungo',
    name: 'Lungo',
    description: 'Long shot of espresso with more water',
    ingredients: [
      '1 shot espresso',
      '2 oz hot water',
      '18 grams ground coffee'
    ],
    benefits: ['Milder taste', 'More volume', 'Balanced caffeine', 'Smooth'],
    nutrition: { calories: 4, protein: 0, carbs: 0, fiber: 0, caffeine: 80 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 432,
    drinkType: 'Long Shot',
    energyLevel: 'Medium',
    featured: false,
    trending: false,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop',
    estimatedCost: 1.00
  },
  {
    id: 'cortado',
    name: 'Cortado',
    description: 'Espresso cut with equal parts steamed milk',
    ingredients: [
      '1 shot espresso',
      '1 oz steamed milk'
    ],
    benefits: ['Balanced flavor', 'Creamy texture', 'Smooth finish', 'Less acidic'],
    nutrition: { calories: 25, protein: 2, carbs: 2, fiber: 0, caffeine: 64 },
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.7,
    reviews: 678,
    drinkType: 'Milk Espresso',
    energyLevel: 'High',
    featured: true,
    trending: false,
    bestTime: 'Afternoon',
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop',
    estimatedCost: 1.80
  },
  {
    id: 'affogato',
    name: 'Affogato',
    description: 'Espresso poured over vanilla gelato or ice cream',
    ingredients: [
      '1 shot espresso',
      '1 scoop vanilla gelato'
    ],
    benefits: ['Dessert drink', 'Sweet indulgence', 'Energy boost', 'Unique flavor'],
    nutrition: { calories: 180, protein: 3, carbs: 22, fiber: 0, caffeine: 64 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 892,
    drinkType: 'Dessert Espresso',
    energyLevel: 'High',
    featured: true,
    trending: true,
    bestTime: 'Dessert',
    image: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=300&fit=crop',
    estimatedCost: 3.50
  }
];

const espressoTypes = [
  {
    id: 'single-shot',
    name: 'Single Shot',
    icon: Coffee,
    description: 'Classic single espresso shot',
    color: 'text-amber-400',
    timing: 'Morning',
    focus: 'Quick Energy'
  },
  {
    id: 'double-shot',
    name: 'Double Shot',
    icon: Zap,
    description: 'Double the espresso, double the energy',
    color: 'text-amber-400',
    timing: 'Morning',
    focus: 'High Caffeine'
  },
  {
    id: 'milk-based',
    name: 'Milk-Based',
    icon: Droplets,
    description: 'Espresso with milk or foam',
    color: 'text-amber-400',
    timing: 'Anytime',
    focus: 'Smooth & Creamy'
  },
  {
    id: 'diluted',
    name: 'Diluted',
    icon: Target,
    description: 'Espresso with water added',
    color: 'text-amber-400',
    timing: 'Anytime',
    focus: 'Milder Taste'
  }
];

const espressoBenefitsList = [
  { id: 'energy', name: 'Energy Boost', description: 'Quick caffeine hit for alertness' },
  { id: 'focus', name: 'Mental Clarity', description: 'Enhanced focus and concentration' },
  { id: 'antioxidants', name: 'Antioxidants', description: 'Rich in beneficial compounds' },
  { id: 'metabolism', name: 'Metabolism', description: 'May boost metabolic rate' }
];

// ---------- Cross-nav - Top Level Drink Categories ----------
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Sparkles, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'caffeinated', name: 'All Caffeinated', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Flame, route: '/drinks', description: 'Browse everything' }
];

// Sister caffeinated subcategories (excluding espresso since we're on espresso page)
const allCaffeinatedSubcategories = [
  { id: 'cold-brew', name: 'Cold Brew', path: '/drinks/caffeinated/cold-brew', icon: Droplets, description: 'Smooth cold coffee' },
  { id: 'energy', name: 'Energy', path: '/drinks/caffeinated/energy', icon: Zap, description: 'Energy drinks' },
  { id: 'iced', name: 'Iced Coffee', path: '/drinks/caffeinated/iced', icon: Sun, description: 'Refreshing iced' },
  { id: 'lattes', name: 'Lattes', path: '/drinks/caffeinated/lattes', icon: Heart, description: 'Milk-based coffee' },
  { id: 'matcha', name: 'Matcha', path: '/drinks/caffeinated/matcha', icon: Leaf, description: 'Green tea powder' },
  { id: 'tea', name: 'Tea', path: '/drinks/caffeinated/tea', icon: Leaf, description: 'Tea varieties' },
  { id: 'specialty', name: 'Specialty', path: '/drinks/caffeinated/specialty', icon: Star, description: 'Unique creations' }
];

const espressoAdvantages = [
  { icon: Zap, title: 'Quick Energy', description: 'Fast-acting caffeine for instant alertness', color: 'text-amber-400' },
  { icon: Clock, title: 'Fast Prep', description: 'Ready in minutes with minimal equipment', color: 'text-amber-400' },
  { icon: Heart, title: 'Rich Flavor', description: 'Intense, complex coffee taste', color: 'text-amber-400' },
  { icon: Target, title: 'Precise Doses', description: 'Controlled caffeine intake', color: 'text-amber-400' },
  { icon: Star, title: 'Versatile Base', description: 'Foundation for many coffee drinks', color: 'text-amber-400' },
  { icon: Crown, title: 'Barista Quality', description: 'Professional-level coffee at home', color: 'text-amber-400' }
];

export default function EspressoDrinks() {
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
  const [maxCaffeine, setMaxCaffeine] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'caffeine' | 'cost'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'espresso-types'|'benefits'|'featured'|'trending'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert espresso drinks to RecipeKit format
  const drinkRecipesWithMeasurements = useMemo(() => {
    return espressoDrinks.map((d) => {
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
            'Preheat espresso machine',
            'Grind coffee beans to fine consistency',
            'Tamp grounds evenly and firmly',
            'Extract espresso shot (25-30 seconds)',
            'Serve immediately for best flavor'
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
      addPoints(30); // XP for espresso drinks
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
      const matchesCaffeine = maxCaffeine === 'all' || drink.nutrition.caffeine <= maxCaffeine;
      return matchesSearch && matchesType && matchesBenefit && matchesCaffeine;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'caffeine': return (b.nutrition.caffeine || 0) - (a.nutrition.caffeine || 0);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredDrinks = getFilteredDrinks();
  const featuredDrinks = drinkRecipesWithMeasurements.filter(d => d.featured);
  const trendingDrinks = drinkRecipesWithMeasurements.filter(d => d.trending);

  // Share page handler
  const handleSharePage = async () => {
    const shareData = {
      title: 'Espresso Drinks',
      text: `Browse ${espressoDrinks.length} espresso drinks for quick energy and rich flavor.`,
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
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
              <Link href="/drinks/caffeinated">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Caffeinated
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Coffee className="h-6 w-6 text-amber-400" />
                <h1 className="text-2xl font-bold text-gray-900">Espresso Drinks</h1>
                <Badge className="bg-amber-100 text-amber-600 border-amber-200">Pure Coffee</Badge>
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

        {/* CROSS-HUB NAVIGATION - Top Level Drink Categories */}
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

        {/* SISTER SUBPAGES NAVIGATION - ALL CAFFEINATED TYPES (No Espresso) */}
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

        {/* Espresso Advantages */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Coffee className="h-6 w-6 text-amber-400" />
              Why Espresso?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {espressoAdvantages.map((advantage, index) => {
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
              <div className="text-2xl font-bold text-amber-400">32</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">73mg</div>
              <div className="text-sm text-gray-600">Avg Caffeine</div>
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
              <div className="text-2xl font-bold text-amber-400">{espressoDrinks.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'espresso-types', label: 'Espresso Types', icon: Coffee },
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
                      placeholder="Search espresso drinks..."
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
                      {espressoTypes.map(type => (
                        <option key={type.id} value={type.name}>{type.name}</option>
                      ))}
                    </select>

                    <select
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={selectedBenefit}
                      onChange={(e) => setSelectedBenefit(e.target.value)}
                    >
                      <option value="">All Benefits</option>
                      {espressoBenefitsList.map(benefit => (
                        <option key={benefit.id} value={benefit.name}>{benefit.name}</option>
                      ))}
                    </select>

                    <select
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={maxCaffeine}
                      onChange={(e) => {
                        const v = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setMaxCaffeine(v);
                      }}
                    >
                      <option value="all">All Caffeine</option>
                      <option value={50}>Under 50mg</option>
                      <option value={75}>Under 75mg</option>
                      <option value={100}>Under 100mg</option>
                      <option value={150}>Under 150mg</option>
                    </select>

                    <select
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="caffeine">Sort by Caffeine</option>
                      <option value="cost">Sort by Cost</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Drinks Grid */}
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
                        <Badge variant="outline">{drink.energyLevel}</Badge>
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
                          <div className="font-bold text-amber-400">{drink.nutrition.caffeine}mg</div>
                          <div className="text-gray-500">Caffeine</div>
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
                            {/* Metric Button */}
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

                      {/* Benefits Tags */}
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
                          Make Drink (+30 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Espresso Types Tab */}
        {activeTab === 'espresso-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {espressoTypes.map(type => {
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {espressoBenefitsList.map(benefit => (
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
                    <div className="text-sm font-medium text-gray-700 mb-1">Coffee Benefits</div>
                    <div className="text-lg font-bold text-amber-400">Espresso Power</div>
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
                <div className="relative h-48">
                  {drink.image && (
                    <img
                      src={drink.image}
                      alt={drink.name}
                      className="w-full h-full object-cover"
                    />
                  )}
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
                    Make This Espresso Drink
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
