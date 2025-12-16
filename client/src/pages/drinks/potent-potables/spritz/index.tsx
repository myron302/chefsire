import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Sparkles, Clock, Heart, Target, Wine, Droplets, 
  Search, Share2, ArrowLeft, GlassWater, Flame,
  TrendingUp, Award, Zap, Crown, Apple, Leaf,
  Clipboard, RotateCcw, Check, Home, Martini, Sun
, Coffee} from 'lucide-react';
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
    case 'tbsp': return { amount: Math.round(amount * 15), unit: 'ml' };
    default: return { amount, unit };
  }
};

const parseIngredient = (ingredient: string): Measured => {
  const fractionMap: Record<string, number> = {
    '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅛': 0.125
  };
  
  const parts = ingredient.trim().replace(/\sof\s/i, ' ').replace(/[()]/g, '').split(/\s+/);
  if (parts.length < 2) return m('1', 'item', ingredient);

  let amountStr = parts[0];
  let amount: number | string = fractionMap[amountStr] ?? 
    (isNaN(Number(amountStr)) ? amountStr : Number(amountStr));

  let unit = parts[1];
  let item = parts.slice(2).join(' ');

  return m(amount, unit, item);
};

const spritzCocktails = [
  {
    id: 'spritz-1',
    name: 'Classic Mimosa',
    description: 'Simple brunch favorite with champagne and orange juice',
    drinkType: 'Mimosa',
    origin: 'Paris, France',
    glassware: 'Champagne Flute',
    servingSize: '6 oz',
    nutrition: { calories: 135, carbs: 12, sugar: 11, alcohol: 10 },
    ingredients: ['3 oz Champagne', '3 oz Fresh Orange Juice', 'Orange Twist'],
    profile: ['Bubbly', 'Citrus', 'Brunch', 'Light'],
    difficulty: 'Very Easy',
    prepTime: 1,
    rating: 4.8,
    reviews: 8234,
    trending: true,
    featured: true,
    estimatedCost: 4.00,
    category: 'Mimosas',
    garnish: 'Orange twist',
    method: 'Build',
    abv: '8-10%',
    iba_official: true,
    instructions: 'Pour champagne into flute. Top with fresh orange juice. Garnish with orange twist. Serve immediately.'
  },
  {
    id: 'spritz-2',
    name: 'Aperol Spritz',
    description: 'Italian classic with Aperol, prosecco, and soda',
    drinkType: 'Spritz',
    origin: 'Venice, Italy',
    glassware: 'Wine Glass',
    servingSize: '8 oz',
    nutrition: { calories: 165, carbs: 14, sugar: 12, alcohol: 11 },
    ingredients: ['3 oz Prosecco', '2 oz Aperol', '1 oz Soda Water', 'Orange Slice', 'Ice'],
    profile: ['Bitter-Sweet', 'Orange', 'Bubbly', 'Refreshing'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 9876,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    category: 'Spritzes',
    garnish: 'Orange slice',
    method: 'Build',
    abv: '10-12%',
    iba_official: true,
    instructions: 'Fill wine glass with ice. Add prosecco, Aperol, and soda water. Stir gently. Garnish with orange slice.'
  },
  {
    id: 'spritz-3',
    name: 'Bellini',
    description: 'Peach purée with prosecco',
    drinkType: 'Bellini',
    origin: 'Venice, Italy',
    glassware: 'Champagne Flute',
    servingSize: '5 oz',
    nutrition: { calories: 145, carbs: 14, sugar: 13, alcohol: 9 },
    ingredients: ['2 oz White Peach Purée', '3 oz Prosecco', 'Peach Slice'],
    profile: ['Peachy', 'Sweet', 'Bubbly', 'Elegant'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 5432,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    category: 'Bellinis',
    garnish: 'Peach slice',
    method: 'Build',
    abv: '8-10%',
    iba_official: true,
    instructions: 'Add peach purée to champagne flute. Top with prosecco. Stir gently. Garnish with peach slice.'
  },
  {
    id: 'spritz-4',
    name: 'Strawberry Mimosa',
    description: 'Berry twist on the classic mimosa',
    drinkType: 'Mimosa',
    origin: 'United States',
    glassware: 'Champagne Flute',
    servingSize: '6 oz',
    nutrition: { calories: 145, carbs: 14, sugar: 13, alcohol: 10 },
    ingredients: ['3 oz Champagne', '2 oz Strawberry Purée', '1 oz Orange Juice', 'Fresh Strawberry'],
    profile: ['Berry', 'Sweet', 'Bubbly', 'Fruity'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 4321,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    category: 'Mimosas',
    garnish: 'Fresh strawberry',
    method: 'Build',
    abv: '8-10%',
    iba_official: false,
    instructions: 'Add strawberry purée to flute. Add orange juice. Top with champagne. Stir gently. Garnish with strawberry.'
  },
  {
    id: 'spritz-5',
    name: 'Hugo Spritz',
    description: 'Elderflower spritz with mint and lime',
    drinkType: 'Spritz',
    origin: 'South Tyrol, Italy',
    glassware: 'Wine Glass',
    servingSize: '8 oz',
    nutrition: { calories: 155, carbs: 12, sugar: 11, alcohol: 10 },
    ingredients: ['3 oz Prosecco', '1.5 oz Elderflower Syrup', '2 oz Soda Water', 'Fresh Mint Leaves', 'Lime Wedge', 'Ice'],
    profile: ['Floral', 'Minty', 'Light', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 3456,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    category: 'Spritzes',
    garnish: 'Mint sprig, lime wedge',
    method: 'Build',
    abv: '8-10%',
    iba_official: false,
    instructions: 'Muddle mint leaves in wine glass. Fill with ice. Add elderflower syrup, prosecco, and soda. Stir gently. Garnish with mint and lime.'
  },
  {
    id: 'spritz-6',
    name: 'Mimosa Royale',
    description: 'Elevated mimosa with Grand Marnier',
    drinkType: 'Mimosa',
    origin: 'France',
    glassware: 'Champagne Flute',
    servingSize: '6 oz',
    nutrition: { calories: 165, carbs: 14, sugar: 12, alcohol: 12 },
    ingredients: ['3 oz Champagne', '2 oz Fresh Orange Juice', '0.5 oz Grand Marnier', 'Orange Wheel'],
    profile: ['Citrus', 'Orange', 'Sophisticated', 'Bubbly'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 2876,
    trending: false,
    featured: true,
    estimatedCost: 6.00,
    category: 'Mimosas',
    garnish: 'Orange wheel',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Pour Grand Marnier into flute. Add orange juice. Top with champagne. Stir gently. Garnish with orange wheel.'
  },
  {
    id: 'spritz-7',
    name: 'Campari Spritz',
    description: 'Bitter Italian aperitif spritz',
    drinkType: 'Spritz',
    origin: 'Italy',
    glassware: 'Wine Glass',
    servingSize: '8 oz',
    nutrition: { calories: 155, carbs: 12, sugar: 10, alcohol: 11 },
    ingredients: ['3 oz Prosecco', '2 oz Campari', '1 oz Soda Water', 'Orange Slice', 'Ice'],
    profile: ['Bitter', 'Bold', 'Herbal', 'Sophisticated'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 2345,
    trending: false,
    featured: false,
    estimatedCost: 5.00,
    category: 'Spritzes',
    garnish: 'Orange slice',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill wine glass with ice. Add prosecco, Campari, and soda. Stir gently. Garnish with orange slice.'
  },
  {
    id: 'spritz-8',
    name: 'Pineapple Mimosa',
    description: 'Tropical twist with pineapple juice',
    drinkType: 'Mimosa',
    origin: 'United States',
    glassware: 'Champagne Flute',
    servingSize: '6 oz',
    nutrition: { calories: 140, carbs: 13, sugar: 12, alcohol: 10 },
    ingredients: ['3 oz Champagne', '3 oz Fresh Pineapple Juice', 'Pineapple Wedge'],
    profile: ['Tropical', 'Sweet', 'Fruity', 'Bubbly'],
    difficulty: 'Very Easy',
    prepTime: 1,
    rating: 4.6,
    reviews: 3124,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    category: 'Mimosas',
    garnish: 'Pineapple wedge',
    method: 'Build',
    abv: '8-10%',
    iba_official: false,
    instructions: 'Pour champagne into flute. Top with pineapple juice. Garnish with pineapple wedge.'
  },
  {
    id: 'spritz-9',
    name: 'Limoncello Spritz',
    description: 'Lemon liqueur spritz',
    drinkType: 'Spritz',
    origin: 'Italy',
    glassware: 'Wine Glass',
    servingSize: '8 oz',
    nutrition: { calories: 175, carbs: 16, sugar: 14, alcohol: 11 },
    ingredients: ['3 oz Prosecco', '2 oz Limoncello', '2 oz Soda Water', 'Lemon Slice', 'Fresh Mint', 'Ice'],
    profile: ['Lemon', 'Sweet', 'Refreshing', 'Italian'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 4567,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    category: 'Spritzes',
    garnish: 'Lemon slice, mint',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill wine glass with ice. Add prosecco, limoncello, and soda. Stir gently. Garnish with lemon and mint.'
  },
  {
    id: 'spritz-10',
    name: 'Rossini',
    description: 'Strawberry prosecco cocktail',
    drinkType: 'Bellini',
    origin: 'Venice, Italy',
    glassware: 'Champagne Flute',
    servingSize: '5 oz',
    nutrition: { calories: 145, carbs: 14, sugar: 13, alcohol: 9 },
    ingredients: ['2 oz Strawberry Purée', '3 oz Prosecco', 'Fresh Strawberry'],
    profile: ['Berry', 'Sweet', 'Bubbly', 'Elegant'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 2987,
    trending: false,
    featured: true,
    estimatedCost: 5.50,
    category: 'Bellinis',
    garnish: 'Fresh strawberry',
    method: 'Build',
    abv: '8-10%',
    iba_official: false,
    instructions: 'Add strawberry purée to champagne flute. Top with prosecco. Stir gently. Garnish with strawberry.'
  }
];

const spritzCategories = [
  { id: 'all', name: 'All Drinks', icon: Sparkles, description: 'Every bubbly drink' },
  { id: 'mimosas', name: 'Mimosas', icon: Sun, description: 'Champagne & juice' },
  { id: 'spritzes', name: 'Spritzes', icon: Wine, description: 'Prosecco cocktails' },
  { id: 'bellinis', name: 'Bellinis', icon: GlassWater, description: 'Fruit purée & prosecco' }
];

const methods = ['All Methods', 'Build'];

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
  { id: 'martinis', name: 'Martinis', path: '/drinks/potent-potables/martinis', icon: Martini, description: 'Elegant classics' },
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

export default function SpritzMimosasPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('All Methods');
  const [sortBy, setSortBy] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [alcoholRange, setAlcoholRange] = useState([0, 45]);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyIBA, setOnlyIBA] = useState(false);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert cocktails to RecipeKit format
  const spritzRecipesWithMeasurements = useMemo(() => {
    return spritzCocktails.map((c) => {
      const rawList = Array.isArray(c.ingredients) ? c.ingredients : [];
      const measurements = rawList.map((ing: any) => {
        if (typeof ing === 'string') return parseIngredient(ing);
        const { amount = 1, unit = 'item', item = '', note = '' } = ing || {};
        return { amount, unit, item, note };
      });

      return {
        ...c,
        recipe: {
          servings: 1,
          measurements,
          directions: [c.instructions]
        }
      };
    });
  }, []);

  const handleShareCocktail = async (cocktail: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[cocktail.id] ?? 1;
    const preview = cocktail.ingredients.slice(0, 4).join(' • ');
    const text = `${cocktail.name} • ${cocktail.category} • ${cocktail.method}\n${preview}${cocktail.ingredients.length > 4 ? ` …plus ${cocktail.ingredients.length - 4} more` : ''}`;
    const shareData = { title: cocktail.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${cocktail.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${cocktail.name}\n${text}\n${url}`);
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
        category: 'spritz-mimosas',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(35);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredCocktails = spritzRecipesWithMeasurements.filter(cocktail => {
    if (selectedCategory !== 'all') {
      const categoryMap: Record<string, string> = {
        'mimosas': 'Mimosas',
        'spritzes': 'Spritzes',
        'bellinis': 'Bellinis'
      };
      if (cocktail.category !== categoryMap[selectedCategory]) return false;
    }
    if (selectedMethod !== 'All Methods' && !cocktail.method.includes(selectedMethod)) return false;
    const abvNum = parseInt(cocktail.abv);
    if (abvNum < alcoholRange[0] || abvNum > alcoholRange[1]) return false;
    if (searchQuery && !cocktail.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (onlyIBA && !cocktail.iba_official) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'trending') return b.reviews - a.reviews;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'alcohol-low') return parseInt(a.abv) - parseInt(b.abv);
    if (sortBy === 'alcohol-high') return parseInt(b.abv) - parseInt(a.abv);
    if (sortBy === 'cost-low') return a.estimatedCost - b.estimatedCost;
    return 0;
  });

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="amber"
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
                  <Sparkles className="h-6 w-6 text-yellow-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Spritz & Mimosas</h1>
                  <Badge className="bg-yellow-100 text-yellow-800">Bubbly Brunch</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <GlassWater className="fill-yellow-500 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 mb-6">
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
                      <Button variant="outline" className="w-full justify-start hover:bg-yellow-50 hover:border-yellow-300">
                        <Icon className="h-4 w-4 mr-2 text-yellow-500" />
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
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-orange-50 hover:border-orange-300">
                        <Icon className="h-4 w-4 mr-2 text-orange-500" />
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
                <div className="text-2xl font-bold text-yellow-600">10%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">4.7★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">2 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{spritzCocktails.length}</div>
                <div className="text-sm text-gray-600">Recipes</div>
              </CardContent>
            </Card>
          </div>

          {/* Categories */}
          <div className="flex flex-col sm:flex-row gap-2 mb-6 sm:overflow-x-auto pb-2">
            {spritzCategories.map(category => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className={selectedCategory === category.id ? "bg-yellow-600 hover:bg-yellow-700" : "hover:bg-yellow-50"}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {category.name}
                </Button>
              );
            })}
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="md:max-w-3xl md:flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search bubbly drinks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-[240px]"
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
            <Card className="mb-6 bg-white border-yellow-200">
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
                      IBA Official Cocktails Only
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cocktails Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map(cocktail => {
              const useMetric = !!metricFlags[cocktail.id];
              const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);

              return (
                <Card 
                  key={cocktail.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-yellow-100 hover:border-yellow-300"
                  onClick={() => openRecipeModal(cocktail)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-lg">{cocktail.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToFavorites({
                            id: cocktail.id,
                            name: cocktail.name,
                            category: 'Spritz & Mimosas',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className="bg-yellow-100 text-yellow-700">{cocktail.category}</Badge>
                      {cocktail.trending && (
                        <Badge className="bg-orange-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.featured && (
                        <Badge className="bg-yellow-500">
                          <GlassWater className="w-3 h-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                      {cocktail.iba_official && (
                        <Badge className="bg-blue-600">
                          <Award className="w-3 h-3 mr-1" />
                          IBA
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{cocktail.description}</p>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-yellow-600">{cocktail.abv}</div>
                        <div className="text-gray-500">ABV</div>
                      </div>
                      <div>
                        <div className="font-bold text-orange-600">{cocktail.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-yellow-600">{cocktail.method}</div>
                        <div className="text-gray-500">Method</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <GlassWater
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(cocktail.rating)
                                ? 'fill-yellow-500 text-yellow-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="font-medium ml-1">{cocktail.rating}</span>
                        <span className="text-gray-500 text-sm">({cocktail.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {cocktail.difficulty}
                      </Badge>
                    </div>

                    {/* RecipeKit Preview */}
                    {Array.isArray(cocktail.recipe?.measurements) && cocktail.recipe.measurements.length > 0 && (
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
                                setServingsById(prev => ({ ...prev, [cocktail.id]: clamp((prev[cocktail.id] ?? 1) - 1) }));
                              }}
                            >
                              −
                            </button>
                            <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                            <button
                              className="px-2 py-1 border rounded text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setServingsById(prev => ({ ...prev, [cocktail.id]: clamp((prev[cocktail.id] ?? 1) + 1) }));
                              }}
                            >
                              +
                            </button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setServingsById(prev => ({ ...prev, [cocktail.id]: 1 }));
                              }}
                              title="Reset servings"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                            </Button>
                          </div>
                        </div>

                        <ul className="text-sm leading-6 text-gray-800 space-y-1">
                          {cocktail.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                            const isNum = typeof ing.amount === 'number';
                            const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                            const show = useMetric && isNum
                              ? toMetric(ing.unit, Number(ing.amount) * servings)
                              : { amount: scaledDisplay, unit: ing.unit };

                            return (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-yellow-500 mt-0.5" />
                                <span>
                                  <span className="text-yellow-600 font-semibold">
                                    {show.amount} {show.unit}
                                  </span>{" "}
                                  {ing.item}
                                  {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                </span>
                              </li>
                            );
                          })}
                          {cocktail.recipe.measurements.length > 4 && (
                            <li className="text-xs text-gray-600">
                              …plus {cocktail.recipe.measurements.length - 4} more •{" "}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRecipeModal(cocktail);
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
                              const lines = cocktail.ingredients.map((ing: string) => `- ${ing}`);
                              const txt = `${cocktail.name} (serves ${servings})\n${lines.join('\n')}`;
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
                            handleShareCocktail(cocktail, servings);
                          }}>
                            <Share2 className="w-4 w-4 mr-1" /> Share
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMetricFlags((prev) => ({ ...prev, [cocktail.id]: !prev[cocktail.id] }));
                            }}
                          >
                            {useMetric ? 'US' : 'Metric'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {cocktail.profile?.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Educational Content */}
          <Card className="mt-12 bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-yellow-500" />
                Brunch Favorites
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Sun className="w-8 h-8 text-yellow-500 mb-2" />
                  <h3 className="font-semibold mb-2">Perfect for Brunch</h3>
                  <p className="text-sm text-gray-700">
                    Mimosas and spritzes are the ideal daytime drinks - light, refreshing, and low in alcohol. 
                    Perfect for brunches, celebrations, and afternoon gatherings.
                  </p>
                </div>
                <div>
                  <Award className="w-8 h-8 text-orange-500 mb-2" />
                  <h3 className="font-semibold mb-2">Italian Classics</h3>
                  <p className="text-sm text-gray-700">
                    Many spritzes originated in Italy, especially Venice. The Aperol Spritz and Bellini are iconic 
                    Italian aperitifs enjoyed before meals.
                  </p>
                </div>
                <div>
                  <Sparkles className="w-8 h-8 text-amber-500 mb-2" />
                  <h3 className="font-semibold mb-2">Endless Variations</h3>
                  <p className="text-sm text-gray-700">
                    The basic formula is simple: champagne or prosecco plus juice or liqueur. Experiment with 
                    different fruits and spirits to create your signature drink!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Progress Card */}
          <Card className="mt-12 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-600" />
                    Your Progress
                  </h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <GlassWater className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-gray-600">Level:</span>
                      <Badge className="bg-yellow-600 text-white">{userProgress.level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-500" />
                      <span className="text-sm text-gray-600">XP:</span>
                      <Badge className="bg-orange-600 text-white">{userProgress.totalPoints}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-yellow-100 text-yellow-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-orange-500" />
                      <span className="text-sm text-gray-600">Cocktails Found:</span>
                      <Badge className="bg-orange-100 text-orange-800">{filteredCocktails.length}</Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="border-yellow-300 hover:bg-yellow-50"
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
