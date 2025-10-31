import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Coffee, Clock, Heart, Star, Search, Share2, ArrowLeft, ArrowRight,
  Zap, Flame, Droplet, Leaf, Apple, Wine, Sparkles, X, Check, Clipboard, RotateCcw, Target, Sun, Camera
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

// metric conversion for espresso drinks
const toMetric = (unit: string, amount: number) => {
  const mlPerOz = 30, mlPerCup = 240;
  switch (unit) {
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
    case 'cup': return { amount: Math.round(amount * mlPerCup), unit: 'ml' };
    case 'tbsp': return { amount: Math.round(amount * 15), unit: 'ml' };
    case 'tsp': return { amount: Math.round(amount * 5), unit: 'ml' };
    default: return { amount, unit };
  }
};

// ---------- Navigation data ----------
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const caffeinatedSubcategories = [
  { id: 'cold-brew', name: 'Cold Brew', icon: Droplet, route: '/drinks/caffeinated/cold-brew', description: 'Smooth cold coffee' },
  { id: 'tea', name: 'Tea', icon: Leaf, route: '/drinks/caffeinated/tea', description: 'Hot and iced teas' },
  { id: 'matcha', name: 'Matcha', icon: Sparkles, route: '/drinks/caffeinated/matcha', description: 'Japanese green tea' },
  { id: 'energy', name: 'Energy Drinks', icon: Zap, route: '/drinks/caffeinated/energy', description: 'Natural energy' },
  { id: 'specialty', name: 'Specialty Coffee', icon: Star, route: '/drinks/caffeinated/specialty', description: 'Unique creations' },
  { id: 'lattes', name: 'Lattes & Cappuccinos', icon: Heart, route: '/drinks/caffeinated/lattes', description: 'Milk-based coffee' },
  { id: 'iced', name: 'Iced Coffee', icon: Droplet, route: '/drinks/caffeinated/iced', description: 'Refreshing iced' }
];

// ---------- Espresso data WITH measured recipes ----------
const espressoDrinks = [
  {
    id: 'classic-espresso',
    name: 'Classic Espresso Shot',
    description: 'Pure, intense coffee flavor in a small shot',
    ingredients: ['1 shot espresso (1 oz)', 'Hot water for Americano variation'],
    benefits: ['Quick energy', 'Mental clarity', 'Focus boost', 'Antioxidants'],
    nutrition: { calories: 3, caffeine: 64, carbs: 0, sugar: 0 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.9,
    reviews: 1850,
    image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400',
    espressoType: 'Classic',
    trending: true,
    featured: true,
    bestTime: 'Morning',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'oz', 'espresso shot', 'freshly pulled'),
        m(1, 'item', 'espresso cup or demitasse')
      ],
      directions: [
        'Preheat your espresso cup with hot water.',
        'Pull a fresh espresso shot (25-30 seconds).',
        'Serve immediately for best flavor.',
        'Optional: Add hot water for an Americano.'
      ]
    }
  },
  {
    id: 'doppio',
    name: 'Doppio',
    description: 'Double shot of espresso for double the energy',
    ingredients: ['2 shots espresso (2 oz)'],
    benefits: ['High energy', 'Intense flavor', 'Quick caffeine hit', 'Metabolism boost'],
    nutrition: { calories: 6, caffeine: 128, carbs: 0, sugar: 0 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 1420,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400',
    espressoType: 'Classic',
    trending: false,
    featured: true,
    bestTime: 'Morning',
    recipe: {
      servings: 1,
      measurements: [
        m(2, 'oz', 'espresso shots', 'double pull'),
        m(1, 'item', 'espresso cup')
      ],
      directions: [
        'Preheat your espresso cup.',
        'Pull a double espresso shot (25-30 seconds).',
        'Enjoy immediately for maximum flavor.'
      ]
    }
  },
  {
    id: 'macchiato',
    name: 'Espresso Macchiato',
    description: 'Espresso "marked" with a dollop of foamed milk',
    ingredients: ['1 shot espresso', '1 tbsp foamed milk'],
    benefits: ['Smooth taste', 'Less intense', 'Balanced flavor', 'Creamy texture'],
    nutrition: { calories: 10, caffeine: 64, carbs: 1, sugar: 1 },
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.7,
    reviews: 980,
    image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400',
    espressoType: 'Milk-based',
    trending: true,
    featured: false,
    bestTime: 'Morning',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'oz', 'espresso shot'),
        m(1, 'tbsp', 'foamed milk', 'or milk foam'),
        m(1, 'item', 'demitasse cup')
      ],
      directions: [
        'Pull a fresh espresso shot.',
        'Steam and foam a small amount of milk.',
        'Top the espresso with a dollop of milk foam.',
        'Serve immediately.'
      ]
    }
  },
  {
    id: 'americano',
    name: 'Caffè Americano',
    description: 'Espresso diluted with hot water for a fuller cup',
    ingredients: ['2 shots espresso', '6 oz hot water'],
    benefits: ['Sustained energy', 'Smooth flavor', 'Less intense', 'Hydrating'],
    nutrition: { calories: 6, caffeine: 128, carbs: 0, sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2100,
    image: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400',
    espressoType: 'Classic',
    trending: false,
    featured: true,
    bestTime: 'Any Time',
    recipe: {
      servings: 1,
      measurements: [
        m(2, 'oz', 'espresso shots', 'double pull'),
        m(6, 'oz', 'hot water', 'just off boil'),
        m(1, 'item', 'coffee mug')
      ],
      directions: [
        'Pull a double espresso shot.',
        'Add hot water to the espresso.',
        'Adjust water ratio to taste preference.',
        'Enjoy hot or over ice for an iced Americano.'
      ]
    }
  },
  {
    id: 'ristretto',
    name: 'Ristretto',
    description: 'Short shot of espresso for concentrated flavor',
    ingredients: ['1 ristretto shot (0.75 oz espresso)'],
    benefits: ['Intense flavor', 'Less bitter', 'Smooth finish', 'Sweet notes'],
    nutrition: { calories: 2, caffeine: 50, carbs: 0, sugar: 0 },
    difficulty: 'Medium',
    prepTime: 2,
    rating: 4.8,
    reviews: 670,
    image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400',
    espressoType: 'Specialty',
    trending: true,
    featured: false,
    bestTime: 'Morning',
    recipe: {
      servings: 1,
      measurements: [
        m(0.75, 'oz', 'ristretto shot', 'short pull 15-20 seconds'),
        m(1, 'item', 'demitasse cup')
      ],
      directions: [
        'Use same coffee amount as regular espresso.',
        'Pull a shorter shot (15-20 seconds).',
        'Result is sweeter and less bitter.',
        'Serve immediately.'
      ]
    }
  },
  {
    id: 'lungo',
    name: 'Lungo',
    description: 'Long shot of espresso with more water',
    ingredients: ['1 lungo shot (2 oz espresso)'],
    benefits: ['Milder taste', 'More volume', 'Balanced caffeine', 'Extended flavor'],
    nutrition: { calories: 4, caffeine: 80, carbs: 0, sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 540,
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400',
    espressoType: 'Specialty',
    trending: false,
    featured: false,
    bestTime: 'Morning',
    recipe: {
      servings: 1,
      measurements: [
        m(2, 'oz', 'lungo shot', 'long pull 35-40 seconds'),
        m(1, 'item', 'espresso cup')
      ],
      directions: [
        'Use same coffee amount as regular espresso.',
        'Pull a longer shot (35-40 seconds).',
        'Result is more bitter but larger volume.',
        'Enjoy immediately.'
      ]
    }
  },
  {
    id: 'cortado',
    name: 'Cortado',
    description: 'Equal parts espresso and steamed milk',
    ingredients: ['2 oz espresso', '2 oz steamed milk'],
    benefits: ['Balanced flavor', 'Creamy texture', 'Moderate caffeine', 'Smooth'],
    nutrition: { calories: 45, caffeine: 128, carbs: 4, sugar: 4 },
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.9,
    reviews: 820,
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400',
    espressoType: 'Milk-based',
    trending: true,
    featured: true,
    bestTime: 'Afternoon',
    recipe: {
      servings: 1,
      measurements: [
        m(2, 'oz', 'espresso shots', 'double pull'),
        m(2, 'oz', 'steamed milk', 'warm not hot'),
        m(1, 'item', 'gibraltar glass or small cup')
      ],
      directions: [
        'Pull a double espresso shot.',
        'Steam milk to 130-140°F (not too hot).',
        'Pour steamed milk over espresso in equal parts.',
        'Serve immediately.'
      ]
    }
  },
  {
    id: 'affogato',
    name: 'Affogato',
    description: 'Espresso poured over vanilla gelato or ice cream',
    ingredients: ['1 shot espresso', '1 scoop vanilla gelato'],
    benefits: ['Dessert coffee', 'Sweet treat', 'Energy boost', 'Indulgent'],
    nutrition: { calories: 180, caffeine: 64, carbs: 24, sugar: 20 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 1250,
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400',
    espressoType: 'Dessert',
    trending: true,
    featured: true,
    bestTime: 'Dessert',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'oz', 'espresso shot', 'hot and fresh'),
        m(1, 'scoop', 'vanilla gelato or ice cream'),
        m(1, 'item', 'dessert bowl or glass')
      ],
      directions: [
        'Place gelato or ice cream in a bowl or glass.',
        'Pull a fresh hot espresso shot.',
        'Pour espresso over gelato immediately.',
        'Enjoy while hot espresso melts the cold gelato.'
      ]
    }
  }
];

const espressoTypes = [
  { id: 'classic', name: 'Classic', description: 'Traditional espresso shots' },
  { id: 'milk-based', name: 'Milk-based', description: 'Espresso with milk' },
  { id: 'specialty', name: 'Specialty', description: 'Unique espresso variations' },
  { id: 'dessert', name: 'Dessert', description: 'Sweet espresso treats' }
];

const espressoBenefitsList = [
  { id: 'energy', name: 'Quick Energy', description: 'Fast-acting caffeine boost' },
  { id: 'focus', name: 'Mental Clarity', description: 'Enhanced focus and concentration' },
  { id: 'antioxidants', name: 'Antioxidants', description: 'Rich in beneficial compounds' },
  { id: 'metabolism', name: 'Metabolism', description: 'Supports metabolic function' }
];

const espressoBenefits = [
  { icon: Zap, title: 'Quick Energy', description: 'Fast-acting caffeine for instant alertness', color: 'text-amber-600' },
  { icon: Target, title: 'Mental Focus', description: 'Enhanced concentration and clarity', color: 'text-orange-600' },
  { icon: Flame, title: 'Metabolism Boost', description: 'Supports fat burning and energy', color: 'text-red-600' },
  { icon: Heart, title: 'Antioxidants', description: 'Rich in protective compounds', color: 'text-pink-600' },
  { icon: Sparkles, title: 'Low Calorie', description: 'Pure espresso has almost zero calories', color: 'text-yellow-600' },
  { icon: Sun, title: 'Morning Ritual', description: 'Perfect way to start your day', color: 'text-amber-700' }
];

export default function EspressoDrinksPage() {
  const {
    addToFavorites,
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState<'browse' | 'types' | 'benefits' | 'featured'>('browse');
  const [selectedEspressoType, setSelectedEspressoType] = useState('');
  const [selectedBenefit, setSelectedBenefit] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxCalories, setMaxCalories] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'caffeine' | 'calories' | 'time'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert espresso drinks to RecipeKit format
  const espressoRecipesWithMeasurements = useMemo(() => {
    return espressoDrinks.map((drink) => ({
      ...drink,
      recipe: drink.recipe || {
        servings: 1,
        measurements: [],
        directions: ['Prepare espresso according to standard procedure.']
      }
    }));
  }, []);

  const handleShareDrink = async (drink: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[drink.id] ?? (drink.recipe?.servings || 1);
    const preview = drink.ingredients.slice(0, 3).join(' • ');
    const text = `${drink.name} • ${drink.espressoType} • ${drink.bestTime}\n${preview}`;
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
        description: `${selectedRecipe.espressoType || ''} • ${selectedRecipe.bestTime || ''}`,
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
      addPoints(15); // XP for espresso drinks
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredDrinks = () => {
    let filtered = espressoRecipesWithMeasurements.filter(drink => {
      const matchesSearch = drink.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           drink.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedEspressoType || drink.espressoType === selectedEspressoType;
      const matchesBenefit = !selectedBenefit || drink.benefits.some((b: string) => b.toLowerCase().includes(selectedBenefit.toLowerCase()));
      const matchesCalories = maxCalories === 'all' || drink.nutrition.calories <= maxCalories;
      return matchesSearch && matchesType && matchesBenefit && matchesCalories;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'caffeine': return (b.nutrition.caffeine || 0) - (a.nutrition.caffeine || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        case 'time': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredDrinks = getFilteredDrinks();
  const featuredDrinks = espressoRecipesWithMeasurements.filter(d => d.featured);
  const trendingDrinks = espressoRecipesWithMeasurements.filter(d => d.trending);

  // Share page handler
  const handleSharePage = async () => {
    const shareData = {
      title: 'Espresso Drinks',
      text: `Browse ${espressoDrinks.length} espresso drink recipes for quick energy and intense flavor.`,
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
          pointsReward={15}
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
                  Back to Caffeinated Drinks
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Coffee className="h-6 w-6 text-amber-600" />
                <h1 className="text-2xl font-bold text-gray-900">Espresso Drinks</h1>
                <Badge className="bg-amber-100 text-amber-800">Premium</Badge>
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
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={handleSharePage}>
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
                    <Button variant="outline" className="w-full justify-start hover:bg-amber-50 hover:border-amber-300">
                      <Icon className="h-4 w-4 mr-2 text-amber-600" />
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

        {/* SISTER SUBPAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Caffeinated Drinks</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {caffeinatedSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.route}>
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

        {/* Espresso Benefits */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Star className="h-6 w-6 text-amber-500" />
              Why Espresso?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {espressoBenefits.map((benefit, index) => {
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
              <div className="text-2xl font-bold text-amber-600">75mg</div>
              <div className="text-sm text-gray-600">Avg Caffeine</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">35</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{espressoDrinks.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'types', label: 'Espresso Types', icon: Coffee },
            { id: 'benefits', label: 'Health Benefits', icon: Heart },
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
                      placeholder="Search espresso drinks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={selectedEspressoType}
                      onChange={(e) => setSelectedEspressoType(e.target.value)}
                    >
                      <option value="">All Types</option>
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
                      value={maxCalories}
                      onChange={(e) => {
                        const v = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setMaxCalories(v);
                      }}
                    >
                      <option value="all">All Calories</option>
                      <option value={10}>Under 10 cal</option>
                      <option value={50}>Under 50 cal</option>
                      <option value={100}>Under 100 cal</option>
                      <option value={200}>Under 200 cal</option>
                    </select>

                    <select
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="caffeine">Sort by Caffeine</option>
                      <option value="calories">Sort by Calories</option>
                      <option value="time">Sort by Prep Time</option>
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
                            bestTime: drink.bestTime
                          })}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(drink.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-100 text-amber-800">{drink.espressoType}</Badge>
                        {drink.trending && <Badge className="bg-orange-100 text-orange-800">Trending</Badge>}
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-amber-600">{drink.nutrition.caffeine}mg</div>
                          <div className="text-gray-500">Caffeine</div>
                        </div>
                        <div>
                          <div className="font-bold text-orange-600">{drink.nutrition.calories}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-yellow-600">{drink.prepTime}m</div>
                          <div className="text-gray-500">Prep</div>
                        </div>
                      </div>

                      {/* RATING & DIFFICULTY */}
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
                          <span className="font-medium text-amber-600">{drink.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {drink.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Drink Button */}
                      <div className="mt-3">
                        <Button
                          className="w-full bg-amber-600 hover:bg-amber-700"
                          onClick={() => openRecipeModal(drink)}
                        >
                          <Coffee className="h-4 w-4 mr-2" />
                          Make Espresso (+15 XP)
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
        {activeTab === 'types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {espressoTypes.map(type => (
              <Card key={type.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Coffee className="h-6 w-6 text-amber-600" />
                    </div>
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-amber-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Available</div>
                    <div className="text-lg font-bold text-amber-600">
                      {espressoDrinks.filter(d => d.espressoType === type.name).length} Drinks
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => setActiveTab('browse')}>
                    Explore {type.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'benefits' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {espressoBenefitsList.map(benefit => (
              <Card key={benefit.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Zap className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{benefit.name}</CardTitle>
                      <p className="text-sm text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-amber-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Health Focus</div>
                    <div className="text-lg font-bold text-amber-600">Wellness</div>
                  </div>
                  <Button className="w-full" onClick={() => setActiveTab('browse')}>
                    View {benefit.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredDrinks.map(drink => (
              <Card key={drink.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative h-48">
                  <img
                    src={drink.image}
                    alt={drink.name}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-4 left-4 bg-amber-500 text-white">Featured</Badge>
                </div>

                <CardHeader>
                  <CardTitle>{drink.name}</CardTitle>
                  <p className="text-gray-600">{drink.description}</p>
                </CardHeader>

                <CardContent>
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    onClick={() => openRecipeModal(drink)}
                  >
                    <Coffee className="h-4 w-4 mr-2" />
                    Make This Espresso
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
                  <Badge variant="outline" className="text-amber-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-orange-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-yellow-600">
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
