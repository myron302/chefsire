import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { Martini, Clock, Heart, Target, Sparkles, Wine, Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater, TrendingUp, Award, Zap, Crown, Cherry, Home, Droplets, Apple, Leaf, Clipboard, RotateCcw, Check, Coffee } from "lucide-react";
import { useDrinks } from '@/contexts/DrinksContext';
import RecipeKit from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

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

const toMetric = (unit: string, amount: number) => {
  const mlPerOz = 30;
  switch (unit) {
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
    case 'dash': return { amount: Math.round(amount * 1), unit: 'dash' };
    default: return { amount, unit };
  }
};

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

  const descriptors = new Set(['fresh', 'large', 'premium', 'london', 'vanilla']);
  if (descriptors.has(unit.toLowerCase())) {
    item = [unit, item].filter(Boolean).join(' ').trim();
    unit = 'item';
  }

  if (item.includes('(optional)')) {
    item = item.replace('(optional)', '').trim();
    return m(amount, unit, item, 'optional');
  }
  
  return m(amount, unit, item);
};

const martinis = [
  {
    id: 'martini-1',
    name: 'Classic Gin Martini',
    description: 'The original - gin and dry vermouth, stirred to perfection',
    baseSpirit: 'Gin',
    style: 'Classic',
    glassware: 'Martini Glass',
    servingSize: '3.5 oz',
    nutrition: { calories: 175, carbs: 0, sugar: 0, alcohol: 18 },
    ingredients: ['2.5 oz London Dry Gin', '0.5 oz Dry Vermouth', 'Ice for stirring', 'Lemon Twist or Olives'],
    profile: ['Dry', 'Botanical', 'Strong', 'Elegant'],
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.9,
    reviews: 4567,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    category: 'Classic Martinis',
    garnish: 'Lemon twist or olives',
    method: 'Stir',
    abv: '35-40%',
    iba_official: true,
    ratio: '5:1 (Gin:Vermouth)',
    temperature: 'Very Cold',
    instructions: 'Add gin and vermouth to mixing glass with ice. Stir for 30 seconds until very cold. Strain into chilled martini glass. Garnish with lemon twist or olives.'
  },
  {
    id: 'martini-2',
    name: 'Vodka Martini',
    description: 'Smooth and clean with vodka instead of gin',
    baseSpirit: 'Vodka',
    style: 'Classic',
    glassware: 'Martini Glass',
    servingSize: '3.5 oz',
    nutrition: { calories: 170, carbs: 0, sugar: 0, alcohol: 18 },
    ingredients: ['2.5 oz Premium Vodka', '0.5 oz Dry Vermouth', 'Ice for stirring', 'Lemon Twist or Olives'],
    profile: ['Clean', 'Smooth', 'Strong', 'Crisp'],
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.7,
    reviews: 3892,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    category: 'Classic Martinis',
    garnish: 'Lemon twist or olives',
    method: 'Stir',
    abv: '35-40%',
    iba_official: false,
    ratio: '5:1 (Vodka:Vermouth)',
    temperature: 'Very Cold',
    instructions: 'Add vodka and vermouth to mixing glass with ice. Stir for 30 seconds until very cold. Strain into chilled martini glass. Garnish with lemon twist or olives.'
  },
  {
    id: 'martini-3',
    name: 'Dirty Martini',
    description: 'Classic martini with olive brine for savory depth',
    baseSpirit: 'Gin',
    style: 'Classic',
    glassware: 'Martini Glass',
    servingSize: '3.5 oz',
    nutrition: { calories: 180, carbs: 1, sugar: 0, alcohol: 17 },
    ingredients: ['2.5 oz Gin or Vodka', '0.5 oz Dry Vermouth', '0.5 oz Olive Brine', 'Ice for stirring', '3 Olives'],
    profile: ['Savory', 'Briny', 'Strong', 'Bold'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 3124,
    trending: false,
    featured: true,
    estimatedCost: 4.75,
    category: 'Classic Martinis',
    garnish: 'Olives (3)',
    method: 'Stir',
    abv: '30-35%',
    iba_official: false,
    ratio: '5:1:1',
    temperature: 'Very Cold',
    instructions: 'Add gin, vermouth, and olive brine to mixing glass with ice. Stir for 30 seconds. Strain into chilled martini glass. Garnish with 3 olives on a pick.'
  },
  {
    id: 'martini-4',
    name: 'Espresso Martini',
    description: 'Coffee-forward dessert martini with vodka',
    baseSpirit: 'Vodka',
    style: 'Modern',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: { calories: 195, carbs: 12, sugar: 10, alcohol: 14 },
    ingredients: ['2 oz Vodka', '1 oz Coffee Liqueur', '1 oz Fresh Espresso', '0.25 oz Simple Syrup', 'Ice', '3 Coffee Beans'],
    profile: ['Coffee', 'Sweet', 'Creamy', 'Energizing'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 5234,
    trending: true,
    featured: true,
    estimatedCost: 4.25,
    category: 'Modern Martinis',
    garnish: '3 coffee beans',
    method: 'Shake',
    abv: '20-25%',
    iba_official: true,
    ratio: '2:1:1',
    temperature: 'Cold',
    instructions: 'Add vodka, coffee liqueur, fresh espresso, and simple syrup to shaker with ice. Shake vigorously for 15 seconds. Strain into chilled martini glass. Garnish with 3 coffee beans.'
  },
  {
    id: 'martini-5',
    name: 'Pornstar Martini',
    description: 'Passion fruit vodka martini with prosecco side',
    baseSpirit: 'Vodka',
    style: 'Modern',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: { calories: 215, carbs: 16, sugar: 14, alcohol: 13 },
    ingredients: ['2 oz Vanilla Vodka', '0.75 oz Passion Fruit Liqueur', '0.5 oz Passion Fruit Purée', '0.5 oz Fresh Lime Juice', '0.25 oz Simple Syrup', 'Prosecco (shot on side)', 'Passion Fruit Half'],
    profile: ['Fruity', 'Tropical', 'Sweet', 'Fun'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 4123,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    category: 'Modern Martinis',
    garnish: 'Passion fruit half',
    method: 'Shake',
    abv: '18-22%',
    iba_official: true,
    ratio: 'Complex',
    temperature: 'Cold',
    instructions: 'Add vodka, passion fruit liqueur, purée, lime juice, and syrup to shaker with ice. Shake hard for 10 seconds. Strain into chilled martini glass. Serve with prosecco shot on side. Garnish with passion fruit half.'
  },
  {
    id: 'martini-6',
    name: 'Lychee Martini',
    description: 'Sweet and floral Asian-inspired martini',
    baseSpirit: 'Vodka',
    style: 'Modern',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: { calories: 185, carbs: 14, sugar: 12, alcohol: 13 },
    ingredients: ['2 oz Vodka', '1 oz Lychee Liqueur', '0.5 oz Fresh Lime Juice', '0.5 oz Lychee Syrup', 'Ice', 'Lychee Fruit'],
    profile: ['Floral', 'Sweet', 'Exotic', 'Delicate'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2876,
    trending: false,
    featured: true,
    estimatedCost: 4.75,
    category: 'Modern Martinis',
    garnish: 'Lychee fruit',
    method: 'Shake',
    abv: '20-25%',
    iba_official: false,
    ratio: '2:1',
    temperature: 'Cold',
    instructions: 'Add vodka, lychee liqueur, lime juice, and lychee syrup to shaker with ice. Shake for 10 seconds. Strain into chilled martini glass. Garnish with lychee fruit.'
  },
  {
    id: 'martini-7',
    name: 'French Martini',
    description: 'Vodka with pineapple and Chambord',
    baseSpirit: 'Vodka',
    style: 'Modern',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: { calories: 205, carbs: 18, sugar: 15, alcohol: 12 },
    ingredients: ['2 oz Vodka', '0.5 oz Chambord', '1.5 oz Pineapple Juice', 'Ice', 'Pineapple Wedge'],
    profile: ['Fruity', 'Sweet', 'Smooth', 'Tropical'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 2543,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    category: 'Modern Martinis',
    garnish: 'Pineapple wedge',
    method: 'Shake',
    abv: '18-22%',
    iba_official: true,
    ratio: '4:1:3',
    temperature: 'Cold',
    instructions: 'Add vodka, Chambord, and pineapple juice to shaker with ice. Shake for 10 seconds. Strain into chilled martini glass. Garnish with pineapple wedge.'
  },
  {
    id: 'martini-8',
    name: 'Vesper Martini',
    description: 'James Bond\'s preferred martini with gin, vodka, and Lillet',
    baseSpirit: 'Gin',
    style: 'Classic',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: { calories: 195, carbs: 2, sugar: 1, alcohol: 19 },
    ingredients: ['3 oz Gin', '1 oz Vodka', '0.5 oz Lillet Blanc', 'Ice for shaking', 'Lemon Peel'],
    profile: ['Strong', 'Complex', 'Sophisticated', 'Iconic'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.8,
    reviews: 3124,
    trending: true,
    featured: true,
    estimatedCost: 5.75,
    category: 'Classic Martinis',
    garnish: 'Lemon peel',
    method: 'Shake',
    abv: '35-40%',
    iba_official: true,
    ratio: '6:2:1',
    temperature: 'Very Cold',
    instructions: 'Add gin, vodka, and Lillet Blanc to shaker with ice. Shake hard for 10 seconds (Bond style). Strain into chilled martini glass. Express lemon peel over drink and garnish.'
  }
];

const martiniCategories = [
  { id: 'all', name: 'All Martinis', icon: Martini, description: 'Every martini variation' },
  { id: 'classic', name: 'Classic', icon: Crown, description: 'Traditional gin & vodka martinis' },
  { id: 'modern', name: 'Modern', icon: Sparkles, description: 'Flavored & contemporary' }
];

const spirits = ['All Spirits', 'Gin', 'Vodka'];
const methods = ['All Methods', 'Stir', 'Shake'];

// SISTER PAGES
const sisterPotentPotablesPages = [
  { id: 'vodka', name: 'Vodka', path: '/drinks/potent-potables/vodka', icon: Droplets, description: 'Clean & versatile' },
  { id: 'whiskey', name: 'Whiskey & Bourbon', path: '/drinks/potent-potables/whiskey-bourbon', icon: Wine, description: 'Kentucky classics' },
  { id: 'tequila', name: 'Tequila & Mezcal', path: '/drinks/potent-potables/tequila-mezcal', icon: Flame, description: 'Agave spirits' },
  { id: 'rum', name: 'Rum', path: '/drinks/potent-potables/rum', icon: GlassWater, description: 'Caribbean vibes' },
  { id: 'gin', name: 'Gin', path: '/drinks/potent-potables/gin', icon: Droplets, description: 'Botanical spirits' },
  { id: 'cognac', name: 'Cognac & Brandy', path: '/drinks/potent-potables/cognac-brandy', icon: Wine, description: 'French elegance' },
  { id: 'liqueurs', name: 'Liqueurs', path: '/drinks/potent-potables/liqueurs', icon: Sparkles, description: 'Sweet & strong' },
  { id: 'daiquiri', name: 'Daiquiri', path: '/drinks/potent-potables/daiquiri', icon: Droplets, description: 'Rum classics' },
  { id: 'scotch', name: 'Scotch & Irish', path: '/drinks/potent-potables/scotch-irish-whiskey', icon: Wine, description: 'UK whiskeys' },
  { id: 'spritz', name: 'Spritz & Mimosas', path: '/drinks/potent-potables/spritz', icon: Sparkles, description: 'Bubbly refreshers' },
  { id: 'classic', name: 'Classic Cocktails', path: '/drinks/potent-potables/cocktails', icon: Wine, description: 'Timeless recipes' },
  { id: 'seasonal', name: 'Seasonal', path: '/drinks/potent-potables/seasonal', icon: Sparkles, description: 'Festive drinks' },
  { id: 'hot-drinks', name: 'Hot Drinks', path: '/drinks/potent-potables/hot-drinks', icon: Flame, description: 'Warming cocktails' },
  { id: 'mocktails', name: 'Mocktails', path: '/drinks/potent-potables/mocktails', icon: Sparkles, description: 'Zero-proof' }
];

// CROSS-HUB
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'protein', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'detox', name: 'Detoxes', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing blends' },
  { id: 'all', name: 'All Drinks', icon: Wine, route: '/drinks', description: 'Browse everything' }
];

export default function MartinisPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSpirit, setSelectedSpirit] = useState('All Spirits');
  const [selectedMethod, setSelectedMethod] = useState('All Methods');
  const [sortBy, setSortBy] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMartini, setSelectedMartini] = useState<typeof martinis[0] | null>(null);
  const [alcoholRange, setAlcoholRange] = useState([0, 45]);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyIBA, setOnlyIBA] = useState(false);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert martinis to RecipeKit format
  const martiniRecipesWithMeasurements = useMemo(() => {
    return martinis.map((m) => {
      const rawList = Array.isArray(m.ingredients) ? m.ingredients : [];
      const measurements = rawList.map((ing: any) => {
        if (typeof ing === 'string') return parseIngredient(ing);
        const { amount = 1, unit = 'item', item = '', note = '' } = ing || {};
        return { amount, unit, item, note };
      });

      return {
        ...m,
        recipe: {
          servings: 1,
          measurements,
          directions: [m.instructions]
        }
      };
    });
  }, []);

  const handleShareMartini = async (martini: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[martini.id] ?? 1;
    const preview = martini.ingredients.slice(0, 4).join(' • ');
    const text = `${martini.name} • ${martini.category} • ${martini.method}\n${preview}${martini.ingredients.length > 4 ? ` …plus ${martini.ingredients.length - 4} more` : ''}`;
    const shareData = { title: martini.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${martini.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${martini.name}\n${text}\n${url}`);
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
      addToRecentlyViewed({
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: 'martinis',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(35);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredMartinis = martiniRecipesWithMeasurements.filter(martini => {
    if (selectedCategory !== 'all' && martini.style.toLowerCase() !== selectedCategory) return false;
    if (selectedSpirit !== 'All Spirits' && martini.baseSpirit !== selectedSpirit) return false;
    if (selectedMethod !== 'All Methods' && martini.method !== selectedMethod) return false;
    const abvNum = parseInt(martini.abv);
    if (abvNum < alcoholRange[0] || abvNum > alcoholRange[1]) return false;
    if (searchQuery && !martini.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (onlyIBA && !martini.iba_official) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'trending') return b.reviews - a.reviews;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'alcohol-low') return parseInt(a.abv) - parseInt(b.abv);
    if (sortBy === 'alcohol-high') return parseInt(b.abv) - parseInt(a.abv);
    if (sortBy === 'cost-low') return a.estimatedCost - b.estimatedCost;
    return 0;
  });

  const handleMartiniClick = (martini: typeof martinis[0]) => {
    setSelectedMartini(martini);
    addToRecentlyViewed({
      id: martini.id,
      name: martini.name,
      category: 'Martinis',
      timestamp: Date.now()
    });
  };

  const handleMakeMartini = (martini: typeof martinis[0]) => {
    incrementDrinksMade();
    addPoints(35, 'Made a martini');
    setSelectedMartini(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="purple"
            pointsReward={35}
            onComplete={handleCompleteRecipe}
            item={{
              id: selectedRecipe.id,
              name: selectedRecipe.name,
              prepTime: selectedRecipe.prepTime,
              directions: selectedRecipe.recipe?.directions || [],
              measurements: selectedRecipe.recipe?.measurements || [],
              baseNutrition: {},
              defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1
            }}
          />
        )}

        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link href="/drinks/potent-potables">
                  <Button variant="ghost" size="sm" className="text-gray-500">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Potent Potables
                  </Button>
                </Link>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-2">
                  <Martini className="h-6 w-6 text-purple-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Martinis</h1>
                  <Badge className="bg-purple-100 text-purple-800">Elegant Classics</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <GlassWater className="fill-purple-500 text-purple-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Home className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600">Explore Other Drink Categories</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {otherDrinkHubs.map((hub) => {
                  const Icon = hub.icon;
                  return (
                    <Link key={hub.id} href={hub.route}>
                      <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                        <Icon className="h-4 w-4 mr-2 text-purple-500" />
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

          {/* SISTER PAGES NAVIGATION */}
          <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-pink-50 hover:border-pink-300">
                        <Icon className="h-4 w-4 mr-2 text-pink-500" />
                        <div className="text-left flex-1">
                          <div className="font-medium text-sm">{page.name}</div>
                          <div className="text-xs text-gray-500">{page.description}</div>
                        </div>
                        <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
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
                <div className="text-2xl font-bold text-purple-600">30%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-pink-600">4.7★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">3.5 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-pink-600">{martinis.length}</div>
                <div className="text-sm text-gray-600">Recipes</div>
              </CardContent>
            </Card>
          </div>

          {/* Categories */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {martiniCategories.map(category => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className={selectedCategory === category.id ? "bg-purple-500 hover:bg-purple-600" : "hover:bg-purple-50"}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {category.name}
                </Button>
              );
            })}
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="md:max-w-md md:flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search martinis..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 md:min-w-fit">
              <select
                value={selectedSpirit}
                onChange={(e) => setSelectedSpirit(e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-auto"
              >
                {spirits.map(spirit => (
                  <option key={spirit} value={spirit}>{spirit}</option>
                ))}
              </select>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-auto"
              >
                {methods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-auto"
              >
                <option value="trending">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="alcohol-low">Lowest ABV</option>
                <option value="alcohol-high">Highest ABV</option>
                <option value="cost-low">Most Budget-Friendly</option>
              </select>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="w-full sm:w-auto"
              >
                <Target className="w-4 h-4 mr-2" />
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <Card className="mb-6 bg-white border-purple-200">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Alcohol Content: {alcoholRange[0]}-{alcoholRange[1]}% ABV
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="45"
                      value={alcoholRange[1]}
                      onChange={(e) => setAlcoholRange([alcoholRange[0], parseInt(e.target.value)])}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="iba-only"
                      checked={onlyIBA}
                      onChange={(e) => setOnlyIBA(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="iba-only" className="text-sm font-medium">
                      IBA Official Martinis Only
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Martinis Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMartinis.map(martini => {
              const useMetric = !!metricFlags[martini.id];
              const servings = servingsById[martini.id] ?? (martini.recipe?.servings || 1);

              return (
                <Card 
                  key={martini.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-purple-100 hover:border-purple-300"
                  onClick={() => handleMartiniClick(martini)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-lg">{martini.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToFavorites({
                            id: martini.id,
                            name: martini.name,
                            category: 'Martinis',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(martini.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className="bg-purple-100 text-purple-700">{martini.style}</Badge>
                      {martini.trending && (
                        <Badge className="bg-pink-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {martini.featured && (
                        <Badge className="bg-purple-500">
                          <GlassWater className="w-3 h-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                      {martini.iba_official && (
                        <Badge className="bg-blue-500">
                          <Award className="w-3 h-3 mr-1" />
                          IBA
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{martini.description}</p>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-purple-600">{martini.abv}</div>
                        <div className="text-gray-500">ABV</div>
                      </div>
                      <div>
                        <div className="font-bold text-pink-600">{martini.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-purple-600">{martini.method}</div>
                        <div className="text-gray-500">Method</div>
                      </div>
                    </div>

                    {/* GLASS RATING */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <GlassWater
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(martini.rating)
                                ? 'fill-purple-500 text-purple-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="font-medium ml-1">{martini.rating}</span>
                        <span className="text-gray-500 text-sm">({martini.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {martini.difficulty}
                      </Badge>
                    </div>

                    {/* RecipeKit Preview */}
                    {Array.isArray(martini.recipe?.measurements) && martini.recipe.measurements.length > 0 && (
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
                                setServingsById(prev => ({ ...prev, [martini.id]: clamp((prev[martini.id] ?? 1) - 1) }));
                              }}
                            >
                              −
                            </button>
                            <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                            <button
                              className="px-2 py-1 border rounded text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setServingsById(prev => ({ ...prev, [martini.id]: clamp((prev[martini.id] ?? 1) + 1) }));
                              }}
                            >
                              +
                            </button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setServingsById(prev => ({ ...prev, [martini.id]: 1 }));
                              }}
                              title="Reset servings"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                            </Button>
                          </div>
                        </div>

                        <ul className="text-sm leading-6 text-gray-800 space-y-1">
                          {martini.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                            const isNum = typeof ing.amount === 'number';
                            const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                            const show = useMetric && isNum
                              ? toMetric(ing.unit, Number(ing.amount) * servings)
                              : { amount: scaledDisplay, unit: ing.unit };

                            return (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-purple-500 mt-0.5" />
                                <span>
                                  <span className="text-purple-600 font-semibold">
                                    {show.amount} {show.unit}
                                  </span>{" "}
                                  {ing.item}
                                  {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                </span>
                              </li>
                            );
                          })}
                          {martini.recipe.measurements.length > 4 && (
                            <li className="text-xs text-gray-600">
                              …plus {martini.recipe.measurements.length - 4} more •{" "}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRecipeModal(martini);
                                }}
                                className="underline"
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
                              const lines = martini.ingredients.map((ing: string) => `- ${ing}`);
                              const txt = `${martini.name} (serves ${servings})\n${lines.join('\n')}`;
                              try {
                                await navigator.clipboard.writeText(txt);
                                alert('Recipe copied!');
                              } catch {
                                alert('Unable to copy.');
                              }
                            }}
                          >
                            <Clipboard className="w-4 h-4 mr-1" /> Copy
                          </Button>
                          <Button variant="outline" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            handleShareMartini(martini, servings);
                          }}>
                            <Share2 className="w-4 w-4 mr-1" /> Share
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMetricFlags((prev) => ({ ...prev, [martini.id]: !prev[martini.id] }));
                            }}
                          >
                            {useMetric ? 'US' : 'Metric'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {martini.profile?.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 md:min-w-fit">
                      <Button 
                        className="flex-1 bg-purple-600 hover:bg-purple-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecipeModal(martini);
                        }}
                      >
                        <Martini className="h-4 w-4 mr-2" />
                        View Recipe
                      </Button>
                      <Button variant="outline" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        handleShareMartini(martini);
                      }}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Educational Content */}
          <Card className="mt-12 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-purple-500" />
                The Art of the Martini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Martini className="w-8 h-8 text-purple-500 mb-2" />
                  <h3 className="font-semibold mb-2">The Perfect Ratio</h3>
                  <p className="text-sm text-gray-700">
                    The classic martini ratio is 5:1 or 6:1 (gin to vermouth). A "dry" martini uses less vermouth, 
                    while "wet" uses more. Find your perfect ratio.
                  </p>
                </div>
                <div>
                  <Award className="w-8 h-8 text-blue-500 mb-2" />
                  <h3 className="font-semibold mb-2">Shaken vs Stirred</h3>
                  <p className="text-sm text-gray-700">
                    Traditional martinis are stirred to maintain clarity and silky texture. Shaking aerates the drink. 
                    Most bartenders prefer stirred.
                  </p>
                </div>
                <div>
                  <Sparkles className="w-8 h-8 text-pink-500 mb-2" />
                  <h3 className="font-semibold mb-2">Temperature Matters</h3>
                  <p className="text-sm text-gray-700">
                    A martini should be served as cold as possible - around 28-30°F. Pre-chill your glass, 
                    use fresh ice, and serve immediately.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Progress Card */}
          <Card className="mt-12 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-purple-600" />
                    Your Progress
                  </h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <GlassWater className="h-4 w-4 text-purple-500" />
                      <span className="text-sm text-gray-600">Level:</span>
                      <Badge className="bg-purple-600 text-white">{userProgress.level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-pink-500" />
                      <span className="text-sm text-gray-600">XP:</span>
                      <Badge className="bg-pink-600 text-white">{userProgress.totalPoints}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Martini className="h-4 w-4 text-purple-600" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-purple-100 text-purple-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-pink-500" />
                      <span className="text-sm text-gray-600">Martinis Found:</span>
                      <Badge className="bg-pink-100 text-pink-800">{filteredMartinis.length}</Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="border-purple-300 hover:bg-purple-50"
                >
                  <ArrowLeft className="h-4 w-4 mr-2 rotate-90" />
                  Back to Top
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
