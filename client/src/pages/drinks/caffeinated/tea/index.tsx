// client/src/pages/drinks/caffeinated/tea/index.tsx
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
  Leaf, Apple, Droplets, Target, Sun, Droplet
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

  const descriptors = new Set(['hot', 'green', 'black', 'herbal', 'white', 'oolong', 'fresh', 'brewed']);
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

// Tea drinks data
const teaDrinks = [
  {
    id: 'classic-green-tea',
    name: 'Classic Green Tea',
    description: 'Pure and refreshing green tea',
    ingredients: [
      '1 green tea bag',
      '2 cup hot water',
      '1 tsp honey',
      '1 lemon wedge'
    ],
    benefits: ['Antioxidants', 'Metabolism boost', 'Mental clarity', 'Natural energy'],
    nutrition: { calories: 25, protein: 0, carbs: 6, fiber: 0, sugar: 6, added_sugar: 6 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 1156,
    drinkType: 'Green Tea',
    caffeineLevel: 'Medium',
    featured: true,
    trending: true,
    bestTime: 'Morning',
    estimatedCost: 0.50
  },
  {
    id: 'earl-grey-tea',
    name: 'Earl Grey Tea',
    description: 'Bergamot-infused black tea',
    ingredients: [
      '1 Earl Grey tea bag',
      '2 cup hot water',
      '1 tbsp milk',
      '1 tsp sugar'
    ],
    benefits: ['Energy boost', 'Focus', 'Classic flavor', 'Stress relief'],
    nutrition: { calories: 30, protein: 1, carbs: 7, fiber: 0, sugar: 7, added_sugar: 4 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 892,
    drinkType: 'Black Tea',
    caffeineLevel: 'High',
    featured: false,
    trending: true,
    bestTime: 'Morning',
    estimatedCost: 0.60
  },
  {
    id: 'chamomile-tea',
    name: 'Chamomile Tea',
    description: 'Calming herbal tea for relaxation',
    ingredients: [
      '1 chamomile tea bag',
      '2 cup hot water',
      '1 tsp honey',
      '½ lemon'
    ],
    benefits: ['Relaxation', 'Sleep aid', 'Stress relief', 'Caffeine-free'],
    nutrition: { calories: 20, protein: 0, carbs: 5, fiber: 0, sugar: 5, added_sugar: 5 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 734,
    drinkType: 'Herbal',
    caffeineLevel: 'None',
    featured: true,
    trending: false,
    bestTime: 'Evening',
    estimatedCost: 0.70
  },
  {
    id: 'jasmine-tea',
    name: 'Jasmine Tea',
    description: 'Fragrant floral green tea',
    ingredients: [
      '1 jasmine tea bag',
      '2 cup hot water',
      '½ tsp honey',
      '1 mint sprig'
    ],
    benefits: ['Aromatic', 'Antioxidants', 'Mood lifting', 'Gentle energy'],
    nutrition: { calories: 15, protein: 0, carbs: 4, fiber: 0, sugar: 3, added_sugar: 3 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 567,
    drinkType: 'Green Tea',
    caffeineLevel: 'Medium',
    featured: false,
    trending: false,
    bestTime: 'Afternoon',
    estimatedCost: 0.80
  },
  {
    id: 'chai-tea-latte',
    name: 'Chai Tea Latte',
    description: 'Spiced tea with steamed milk',
    ingredients: [
      '1 chai tea bag',
      '1 cup hot water',
      '1 cup steamed milk',
      '2 tbsp honey',
      '¼ tsp cinnamon'
    ],
    benefits: ['Spiced flavor', 'Warming', 'Energy boost', 'Comforting'],
    nutrition: { calories: 180, protein: 8, carbs: 32, fiber: 0, sugar: 30, added_sugar: 24 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.9,
    reviews: 1423,
    drinkType: 'Chai',
    caffeineLevel: 'Medium',
    featured: true,
    trending: true,
    bestTime: 'Afternoon',
    estimatedCost: 1.50
  },
  {
    id: 'peppermint-tea',
    name: 'Peppermint Tea',
    description: 'Refreshing minty herbal tea',
    ingredients: [
      '1 peppermint tea bag',
      '2 cup hot water',
      '1 tsp honey',
      '1 mint sprig'
    ],
    benefits: ['Digestive aid', 'Refreshing', 'Caffeine-free', 'Soothing'],
    nutrition: { calories: 20, protein: 0, carbs: 5, fiber: 0, sugar: 5, added_sugar: 5 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 498,
    drinkType: 'Herbal',
    caffeineLevel: 'None',
    featured: false,
    trending: false,
    bestTime: 'Evening',
    estimatedCost: 0.60
  },
  {
    id: 'oolong-tea',
    name: 'Oolong Tea',
    description: 'Traditional semi-oxidized tea',
    ingredients: [
      '1 oolong tea bag',
      '2 cup hot water',
      '½ tsp honey'
    ],
    benefits: ['Metabolism', 'Weight management', 'Focus', 'Smooth flavor'],
    nutrition: { calories: 15, protein: 0, carbs: 4, fiber: 0, sugar: 3, added_sugar: 3 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 612,
    drinkType: 'Oolong',
    caffeineLevel: 'Medium',
    featured: false,
    trending: true,
    bestTime: 'Afternoon',
    estimatedCost: 0.90
  },
  {
    id: 'english-breakfast-tea',
    name: 'English Breakfast Tea',
    description: 'Bold black tea blend',
    ingredients: [
      '1 English Breakfast tea bag',
      '2 cup hot water',
      '2 tbsp milk',
      '1 tsp sugar'
    ],
    benefits: ['Strong flavor', 'Morning energy', 'Focus', 'Classic blend'],
    nutrition: { calories: 35, protein: 1, carbs: 8, fiber: 0, sugar: 8, added_sugar: 4 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 987,
    drinkType: 'Black Tea',
    caffeineLevel: 'High',
    featured: false,
    trending: false,
    bestTime: 'Morning',
    estimatedCost: 0.60
  }
];

const teaTypes = [
  {
    id: 'green-tea',
    name: 'Green Tea',
    icon: Leaf,
    description: 'Light and antioxidant-rich',
    color: 'text-green-400',
    timing: 'Morning',
    focus: 'Health & Energy'
  },
  {
    id: 'black-tea',
    name: 'Black Tea',
    icon: Coffee,
    description: 'Bold and energizing',
    color: 'text-green-400',
    timing: 'Morning',
    focus: 'Caffeine & Focus'
  },
  {
    id: 'herbal',
    name: 'Herbal',
    icon: Sparkles,
    description: 'Caffeine-free relaxation',
    color: 'text-green-400',
    timing: 'Evening',
    focus: 'Calming & Soothing'
  },
  {
    id: 'chai',
    name: 'Chai',
    icon: Heart,
    description: 'Spiced milk tea',
    color: 'text-green-400',
    timing: 'Afternoon',
    focus: 'Warming & Spiced'
  },
  {
    id: 'oolong',
    name: 'Oolong',
    icon: Target,
    description: 'Semi-oxidized traditional',
    color: 'text-green-400',
    timing: 'Afternoon',
    focus: 'Metabolism & Balance'
  }
];

const teaBenefitsList = [
  { id: 'antioxidants', name: 'Antioxidants', description: 'Fight free radicals' },
  { id: 'energy', name: 'Natural Energy', description: 'Gentle caffeine boost' },
  { id: 'relaxation', name: 'Relaxation', description: 'Calming properties' },
  { id: 'metabolism', name: 'Metabolism', description: 'Supports weight management' },
  { id: 'focus', name: 'Focus', description: 'Mental clarity' },
  { id: 'digestion', name: 'Digestion', description: 'Soothes stomach' }
];

// ---------- Cross-nav - Top Level Drink Categories ----------
const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'caffeinated', name: 'All Caffeinated', icon: Sparkles, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Flame, route: '/drinks', description: 'Browse everything' }
];

// Sister caffeinated subcategories (excluding tea since we're on tea page)
const allCaffeinatedSubcategories = [
  { id: 'espresso', name: 'Espresso', path: '/drinks/caffeinated/espresso', icon: Coffee, description: 'Pure & intense' },
  { id: 'cold-brew', name: 'Cold Brew', path: '/drinks/caffeinated/cold-brew', icon: Droplets, description: 'Smooth cold coffee' },
  { id: 'iced', name: 'Iced Coffee', path: '/drinks/caffeinated/iced', icon: Droplet, description: 'Refreshing coffee' },
  { id: 'matcha', name: 'Matcha', path: '/drinks/caffeinated/matcha', icon: Leaf, description: 'Green tea powder' },
  { id: 'lattes', name: 'Lattes', path: '/drinks/caffeinated/lattes', icon: Coffee, description: 'Milk & espresso' },
  { id: 'specialty', name: 'Specialty', path: '/drinks/caffeinated/specialty', icon: Crown, description: 'Unique creations' },
  { id: 'energy', name: 'Energy', path: '/drinks/caffeinated/energy', icon: Zap, description: 'High-energy drinks' }
];

const teaAdvantages = [
  { icon: Leaf, title: 'Natural Health', description: 'Rich in antioxidants and nutrients', color: 'text-green-400' },
  { icon: Clock, title: 'Quick Brew', description: 'Ready in 3-5 minutes', color: 'text-green-400' },
  { icon: Zap, title: 'Gentle Energy', description: 'Steady caffeine without jitters', color: 'text-green-400' },
  { icon: Star, title: 'Variety', description: 'Countless flavors and types', color: 'text-green-400' },
  { icon: Sun, title: 'Any Time', description: 'Morning, afternoon, or evening', color: 'text-green-400' },
  { icon: Heart, title: 'Wellness', description: 'Supports overall health', color: 'text-green-400' }
];

export default function TeaPage() {
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
    return teaDrinks.map((d) => {
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
            'Boil water to appropriate temperature',
            'Steep tea bag for 3-5 minutes',
            'Remove tea bag and add sweetener if desired',
            'Enjoy hot or let cool and serve over ice'
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
      title: 'Tea Drinks',
      text: `Browse ${teaDrinks.length} tea drinks for health and wellness.`,
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
                <Leaf className="h-6 w-6 text-green-400" />
                <h1 className="text-2xl font-bold text-gray-900">Tea Drinks</h1>
                <Badge className="bg-green-100 text-green-600 border-green-200">Health & Wellness</Badge>
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
              <Button size="sm" className="bg-green-400 hover:bg-green-500 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                      <Icon className="h-4 w-4 mr-2 text-green-400" />
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
        <Card className="bg-gradient-to-r from-green-50 to-yellow-50 border-green-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Caffeinated Drinks</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {allCaffeinatedSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                      <Icon className="h-4 w-4 mr-2 text-green-400" />
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

        {/* Tea Advantages */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Leaf className="h-6 w-6 text-green-400" />
              Why Tea?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teaAdvantages.map((advantage, index) => {
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
              <div className="text-2xl font-bold text-green-400">45</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">1.3g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{teaDrinks.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'drink-types', label: 'Tea Types', icon: Leaf },
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
                className={`flex-1 ${activeTab === tab.id ? 'bg-green-500 shadow-sm !text-white hover:!text-white hover:bg-green-600' : ''}`}
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
                      placeholder="Search tea drinks..."
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
                      <option value="">All Tea Types</option>
                      {teaTypes.map(type => (
                        <option key={type.id} value={type.name}>{type.name}</option>
                      ))}
                    </select>

                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedBenefit}
                      onChange={(e) => setSelectedBenefit(e.target.value)}
                    >
                      <option value="">All Benefits</option>
                      {teaBenefitsList.map(benefit => (
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
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
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
                        <div className="md:max-w-3xl md:flex-1">
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
                        <Badge className="bg-green-100 text-green-600 border-green-200">{drink.drinkType}</Badge>
                        <Badge variant="outline">{drink.caffeineLevel}</Badge>
                        {drink.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-green-400">{drink.nutrition.calories}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-green-400">{drink.nutrition.protein}g</div>
                          <div className="text-gray-500">Protein</div>
                        </div>
                        <div>
                          <div className="font-bold text-green-400">{drink.prepTime}m</div>
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
                                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                                  <span>
                                    <span className="text-green-500 font-semibold">
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
                          <span className="font-medium text-green-400">{drink.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags - BELOW DESCRIPTION */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {drink.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-600 hover:bg-green-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Drink Button */}
                      <div className="mt-3">
                        <Button
                          className="w-full bg-green-400 hover:bg-green-500 text-white"
                          onClick={() => openRecipeModal(drink)}
                        >
                          <Leaf className="h-4 w-4 mr-2" />
                          Make Tea (+20 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Tea Types Tab */}
        {activeTab === 'drink-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teaTypes.map(type => {
              const Icon = type.icon;
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Icon className="h-6 w-6 text-green-400" />
                      </div>
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center bg-green-50 p-3 rounded-lg mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-1">Timing</div>
                      <div className="text-lg font-bold text-green-400">{type.timing}</div>
                    </div>
                    <Button className="w-full bg-green-400 hover:bg-green-500 text-white" onClick={() => setActiveTab('browse')}>
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
            {teaBenefitsList.map(benefit => (
              <Card key={benefit.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Heart className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{benefit.name}</CardTitle>
                      <p className="text-sm text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-green-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Tea Focus</div>
                    <div className="text-lg font-bold text-green-400">Health Support</div>
                  </div>
                  <Button className="w-full bg-green-400 hover:bg-green-500 text-white" onClick={() => setActiveTab('browse')}>
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
                <div className="relative h-48 bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center">
                  <Leaf className="h-24 w-24 text-green-400 opacity-50" />
                  <Badge className="absolute top-4 left-4 bg-green-400 text-white">Featured</Badge>
                </div>

                <CardHeader>
                  <CardTitle>{drink.name}</CardTitle>
                  <p className="text-gray-600">{drink.description}</p>
                </CardHeader>

                <CardContent>
                  <Button
                    className="w-full bg-green-400 hover:bg-green-500 text-white"
                    onClick={() => openRecipeModal(drink)}
                  >
                    <Leaf className="h-4 w-4 mr-2" />
                    Make This Tea
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
              <Card key={drink.id} className="hover:shadow-lg transition-shadow border-2 border-green-200">
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
                    className="w-full bg-green-400 hover:bg-green-500 text-white"
                    onClick={() => openRecipeModal(drink)}
                  >
                    <Leaf className="h-4 w-4 mr-2" />
                    Try This Trend
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
                  <Badge variant="outline" className="text-green-400">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-green-400">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-green-400">
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
