import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Flame, Clock, Heart, Star, Target, Sparkles, Sun, 
  Search, Share2, ArrowLeft, Plus, Camera, GlassWater,
  TrendingUp, Award, Crown, Coffee, Leaf, Zap, Cherry, Citrus,
  Droplets, BookOpen, Home, Apple, Wine, Martini,
  Clipboard, RotateCcw, Check
} from 'lucide-react';
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

  const descriptors = new Set(['fresh', 'blanco', 'reposado', 'añejo', 'vanilla']);
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

const tequilaMezcalCocktails = [
  {
    id: 'tequila-1',
    name: 'Classic Margarita',
    description: 'The perfect balance of tequila, lime, and orange liqueur',
    spiritType: 'Blanco Tequila',
    origin: 'Mexico',
    glassware: 'Margarita Glass',
    servingSize: '5 oz',
    nutrition: { calories: 195, carbs: 12, sugar: 10, alcohol: 14 },
    ingredients: ['2 oz Blanco Tequila', '1 oz Fresh Lime Juice', '1 oz Triple Sec', 'Salt (for rim)', 'Lime Wheel', 'Ice'],
    profile: ['Citrus', 'Refreshing', 'Balanced', 'Classic'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 8234,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Salt rim, lime wheel',
    method: 'Shake',
    abv: '18-22%',
    iba_official: true,
    instructions: 'Rim glass with salt. Shake tequila, lime juice, and triple sec with ice. Strain into prepared glass over fresh ice. Garnish with lime wheel.'
  },
  {
    id: 'tequila-2',
    name: 'Paloma',
    description: 'Mexico\'s most popular cocktail with grapefruit soda',
    spiritType: 'Blanco Tequila',
    origin: 'Mexico',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: { calories: 185, carbs: 16, sugar: 14, alcohol: 12 },
    ingredients: ['2 oz Blanco Tequila', '0.5 oz Fresh Lime Juice', '4 oz Grapefruit Soda', 'Salt (for rim)', 'Grapefruit Slice', 'Ice'],
    profile: ['Citrus', 'Refreshing', 'Light', 'Popular'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 5678,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Salt rim, grapefruit slice',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Rim highball glass with salt and fill with ice. Add tequila and lime juice. Top with grapefruit soda. Stir gently and garnish with grapefruit slice.'
  },
  {
    id: 'tequila-3',
    name: 'Tequila Sunrise',
    description: 'Layered sunrise effect with tequila and grenadine',
    spiritType: 'Blanco Tequila',
    origin: 'California, USA',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: { calories: 215, carbs: 22, sugar: 20, alcohol: 12 },
    ingredients: ['2 oz Blanco Tequila', '4 oz Orange Juice', '0.5 oz Grenadine', 'Orange Slice', 'Cherry', 'Ice'],
    profile: ['Fruity', 'Sweet', 'Colorful', 'Easy'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 4321,
    trending: false,
    featured: false,
    estimatedCost: 3.50,
    bestTime: 'Brunch',
    occasion: 'Poolside',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Orange slice, cherry',
    method: 'Build & Layer',
    abv: '10-12%',
    iba_official: true,
    instructions: 'Fill glass with ice. Add tequila and orange juice, stir. Slowly pour grenadine down the side to create sunrise effect. Garnish with orange slice and cherry.'
  },
  {
    id: 'tequila-4',
    name: 'Tommy\'s Margarita',
    description: 'Agave-sweetened margarita without triple sec',
    spiritType: 'Blanco Tequila',
    origin: 'San Francisco, USA',
    glassware: 'Rocks Glass',
    servingSize: '4 oz',
    nutrition: { calories: 175, carbs: 10, sugar: 9, alcohol: 15 },
    ingredients: ['2 oz Blanco Tequila', '1 oz Fresh Lime Juice', '0.5 oz Agave Nectar', 'Salt (for rim)', 'Lime Wheel', 'Ice'],
    profile: ['Pure', 'Agave-forward', 'Citrus', 'Refined'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 3456,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Salt rim, lime wheel',
    method: 'Shake',
    abv: '22-26%',
    iba_official: false,
    instructions: 'Rim glass with salt. Shake tequila, lime juice, and agave nectar with ice. Strain over fresh ice. Garnish with lime wheel.'
  },
  {
    id: 'mezcal-1',
    name: 'Mezcal Margarita',
    description: 'Smoky twist on the classic margarita',
    spiritType: 'Mezcal',
    origin: 'Mexico',
    glassware: 'Rocks Glass',
    servingSize: '5 oz',
    nutrition: { calories: 195, carbs: 12, sugar: 10, alcohol: 14 },
    ingredients: ['2 oz Mezcal', '1 oz Fresh Lime Juice', '0.75 oz Agave Nectar', 'Salt (for rim)', 'Lime Wheel', 'Ice'],
    profile: ['Smoky', 'Citrus', 'Complex', 'Bold'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 3987,
    trending: true,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Mezcal Cocktails',
    garnish: 'Salt rim, lime wheel',
    method: 'Shake',
    abv: '18-22%',
    iba_official: false,
    instructions: 'Rim glass with salt. Shake mezcal, lime juice, and agave nectar with ice. Strain over fresh ice. Garnish with lime wheel.'
  },
  {
    id: 'mezcal-2',
    name: 'Oaxaca Old Fashioned',
    description: 'Mezcal and tequila old fashioned variation',
    spiritType: 'Mezcal',
    origin: 'New York City, USA',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: { calories: 175, carbs: 5, sugar: 4, alcohol: 17 },
    ingredients: ['1.5 oz Reposado Tequila', '0.5 oz Mezcal', '0.25 oz Agave Nectar', '2 dashes Angostura Bitters', 'Orange Peel', 'Large Ice Cube'],
    profile: ['Smoky', 'Rich', 'Complex', 'Bold'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 2876,
    trending: true,
    featured: true,
    estimatedCost: 7.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Mezcal Cocktails',
    garnish: 'Orange peel, flamed',
    method: 'Stir',
    abv: '32-36%',
    iba_official: false,
    instructions: 'Add agave nectar and bitters to glass. Add large ice cube, tequila, and mezcal. Stir until chilled. Flame orange peel over drink and garnish.'
  },
  {
    id: 'tequila-5',
    name: 'Spicy Margarita',
    description: 'Jalapeño-infused margarita with heat',
    spiritType: 'Blanco Tequila',
    origin: 'Modern',
    glassware: 'Rocks Glass',
    servingSize: '5 oz',
    nutrition: { calories: 195, carbs: 13, sugar: 11, alcohol: 14 },
    ingredients: ['2 oz Blanco Tequila', '1 oz Fresh Lime Juice', '0.75 oz Triple Sec', '3-4 Jalapeño Slices', '0.25 oz Agave Nectar', 'Salt (for rim)', 'Ice'],
    profile: ['Spicy', 'Citrus', 'Bold', 'Heat'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 3214,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Tequila',
    garnish: 'Salt rim, jalapeño slice',
    method: 'Shake & Muddle',
    abv: '18-22%',
    iba_official: false,
    instructions: 'Muddle jalapeño slices in shaker. Add tequila, lime juice, triple sec, and agave nectar with ice. Shake vigorously. Strain over fresh ice in salt-rimmed glass. Garnish with jalapeño slice.'
  },
  {
    id: 'tequila-6',
    name: 'Tequila Old Fashioned',
    description: 'Classic old fashioned with aged tequila',
    spiritType: 'Añejo Tequila',
    origin: 'Modern',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: { calories: 165, carbs: 5, sugar: 4, alcohol: 17 },
    ingredients: ['2 oz Añejo Tequila', '0.25 oz Agave Nectar', '2 dashes Angostura Bitters', '1 dash Orange Bitters', 'Orange Peel', 'Large Ice Cube'],
    profile: ['Rich', 'Smooth', 'Complex', 'Sophisticated'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 1876,
    trending: true,
    featured: true,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Tequila',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '32-36%',
    iba_official: false,
    instructions: 'Add agave nectar and bitters to rocks glass. Add large ice cube and tequila. Stir until well chilled. Express orange peel over drink and garnish.'
  }
];

// SISTER PAGES
const sisterPotentPotablesPages = [
  { id: 'vodka', name: 'Vodka', path: '/drinks/potent-potables/vodka', icon: Droplets, description: 'Clean & versatile' },
  { id: 'whiskey', name: 'Whiskey & Bourbon', path: '/drinks/potent-potables/whiskey-bourbon', icon: Wine, description: 'Kentucky classics' },
  { id: 'rum', name: 'Rum', path: '/drinks/potent-potables/rum', icon: GlassWater, description: 'Caribbean vibes' },
  { id: 'gin', name: 'Gin', path: '/drinks/potent-potables/gin', icon: Droplets, description: 'Botanical spirits' },
  { id: 'cognac', name: 'Cognac & Brandy', path: '/drinks/potent-potables/cognac-brandy', icon: Wine, description: 'French elegance' },
  { id: 'liqueurs', name: 'Liqueurs', path: '/drinks/potent-potables/liqueurs', icon: Sparkles, description: 'Sweet & strong' },
  { id: 'daiquiri', name: 'Daiquiri', path: '/drinks/potent-potables/daiquiri', icon: Droplets, description: 'Rum classics' },
  { id: 'scotch', name: 'Scotch & Irish', path: '/drinks/potent-potables/scotch-irish-whiskey', icon: Wine, description: 'UK whiskeys' },
  { id: 'martinis', name: 'Martinis', path: '/drinks/potent-potables/martinis', icon: Martini, description: 'Elegant classics' },
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

export default function TequilaMezcalPage() {
  const { 
    addToFavorites,
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedCocktail, setSelectedCocktail] = useState<typeof tequilaMezcalCocktails[0] | null>(null);

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const categories = ['Classic Tequila', 'Modern Tequila', 'Mezcal Cocktails'];
  const difficulties = ['Very Easy', 'Easy', 'Medium'];

  // Convert cocktails to RecipeKit format
  const cocktailRecipesWithMeasurements = useMemo(() => {
    return tequilaMezcalCocktails.map((c) => {
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
    const text = `${cocktail.name} • ${cocktail.category}\n${preview}${cocktail.ingredients.length > 4 ? ` …plus ${cocktail.ingredients.length - 4} more` : ''}`;
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
        category: 'tequila-mezcal',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(40);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredCocktails = cocktailRecipesWithMeasurements.filter(cocktail => {
    const matchesSearch = cocktail.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cocktail.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || cocktail.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || cocktail.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const handleCocktailClick = (cocktail: typeof tequilaMezcalCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'tequila-mezcal',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof tequilaMezcalCocktails[0]) => {
    incrementDrinksMade();
    addPoints(40, 'Made a tequila/mezcal cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-lime-50 via-green-50 to-emerald-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="green"
            pointsReward={40}
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

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-lime-600 via-green-600 to-emerald-600 text-white py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/drinks/potent-potables">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Potent Potables
                </Button>
              </Link>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <Flame className="w-12 h-12" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Tequila & Mezcal</h1>
                <p className="text-xl text-white/90">From smooth blanco to smoky mezcal</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search tequila & mezcal cocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 py-6 text-lg bg-white/95 border-0"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{tequilaMezcalCocktails.length}</div>
                <div className="text-white/80 text-sm">Cocktails</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{categories.length}</div>
                <div className="text-white/80 text-sm">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{tequilaMezcalCocktails.filter(c => c.trending).length}</div>
                <div className="text-white/80 text-sm">Trending</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{tequilaMezcalCocktails.filter(c => c.spiritType === 'Mezcal').length}</div>
                <div className="text-white/80 text-sm">Mezcal</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-lime-50 to-green-50 border-green-300 mb-6">
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
                      <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                        <Icon className="h-4 w-4 mr-2 text-green-500" />
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
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-emerald-300 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-emerald-50 hover:border-emerald-300">
                        <Icon className="h-4 w-4 mr-2 text-emerald-500" />
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

          {/* Filters and Sort */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="md:max-w-2xl md:flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search tequila & mezcal cocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <select
                value={selectedCategory || 'all'}
                onChange={(e) => setSelectedCategory(e.target.value === 'all' ? null : e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm min-w-[180px]"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select
                value={selectedDifficulty || 'all'}
                onChange={(e) => setSelectedDifficulty(e.target.value === 'all' ? null : e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm min-w-[180px]"
              >
                <option value="all">All Levels</option>
                {difficulties.map(diff => (
                  <option key={diff} value={diff}>{diff}</option>
                ))}
              </select>
              <Button
                variant="outline"
                className="min-w-[140px]"
              >
                <Target className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>

          {/* Cocktails Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map((cocktail) => {
              const useMetric = !!metricFlags[cocktail.id];
              const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);

              return (
                <Card
                  key={cocktail.id}
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-green-100 hover:border-green-300"
                  onClick={() => handleCocktailClick(cocktail)}
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
                            category: 'Tequila & Mezcal',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className="bg-green-100 text-green-700">{cocktail.category}</Badge>
                      {cocktail.trending && (
                        <Badge className="bg-emerald-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.spiritType === 'Mezcal' && (
                        <Badge className="bg-orange-600">
                          <Flame className="w-3 h-3 mr-1" />
                          Mezcal
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

                    {/* Key Info */}
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-green-600">{cocktail.abv}</div>
                        <div className="text-gray-500">ABV</div>
                      </div>
                      <div>
                        <div className="font-bold text-lime-600">{cocktail.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-green-600">{cocktail.method}</div>
                        <div className="text-gray-500">Method</div>
                      </div>
                    </div>

                    {/* GLASS RATING */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <GlassWater
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(cocktail.rating)
                                ? 'fill-lime-500 text-lime-500'
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
                                <Check className="h-4 w-4 text-green-500 mt-0.5" />
                                <span>
                                  <span className="text-green-600 font-semibold">
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
                        <Badge key={tag} variant="secondary" className="text-xs bg-green-100 text-green-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-3">
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecipeModal(cocktail);
                        }}
                      >
                        <Flame className="h-4 w-4 mr-2" />
                        View Recipe
                      </Button>
                      <Button variant="outline" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        handleShareCocktail(cocktail);
                      }}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Educational Section */}
          <Card className="mt-12 bg-gradient-to-br from-lime-50 to-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Flame className="w-7 h-7 text-green-600" />
                About Tequila & Mezcal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-lime-700">Tequila</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    Tequila is made exclusively from blue agave in specific regions of Mexico, primarily Jalisco. 
                    It must contain at least 51% blue agave (100% agave tequilas are premium). The production 
                    involves harvesting mature agave plants (8-12 years old), cooking the piñas, fermenting, 
                    and distilling the liquid.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-green-700">Mezcal</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    Mezcal can be made from over 30 types of agave across nine Mexican states, primarily Oaxaca. 
                    The distinctive smoky flavor comes from roasting agave hearts in underground pits. Often 
                    produced in small batches using traditional methods, mezcal offers complex, artisanal flavors.
                  </p>
                </div>
              </div>

              {/* Tequila Types */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-lime-700">Tequila Classifications</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-lime-200">
                    <div className="font-semibold text-lime-600 mb-2">Blanco (Silver)</div>
                    <div className="text-sm text-gray-700">Unaged or aged up to 2 months. Pure agave flavor, crisp and clean.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-lime-200">
                    <div className="font-semibold text-yellow-600 mb-2">Reposado</div>
                    <div className="text-sm text-gray-700">Aged 2-12 months. Golden color, smooth with oak notes.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-lime-200">
                    <div className="font-semibold text-amber-600 mb-2">Añejo</div>
                    <div className="text-sm text-gray-700">Aged 1-3 years. Dark amber, complex, sipping quality.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-lime-200">
                    <div className="font-semibold text-orange-700 mb-2">Extra Añejo</div>
                    <div className="text-sm text-gray-700">Aged 3+ years. Ultra-premium, rich and smooth.</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Progress Card */}
          <Card className="bg-gradient-to-r from-lime-50 to-green-50 border-green-300 mt-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-green-600" />
                    Your Progress
                  </h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <GlassWater className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-600">Level:</span>
                      <Badge className="bg-green-600 text-white">{userProgress.level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-lime-500" />
                      <span className="text-sm text-gray-600">XP:</span>
                      <Badge className="bg-lime-600 text-white">{userProgress.totalPoints}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-green-100 text-green-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-lime-500" />
                      <span className="text-sm text-gray-600">Cocktails Found:</span>
                      <Badge className="bg-lime-100 text-lime-800">{filteredCocktails.length}</Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="border-green-300 hover:bg-green-50"
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
