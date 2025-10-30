import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Droplets, Clock, Heart, Target, Sparkles, Wine, 
  Search, Share2, ArrowLeft, GlassWater, Flame,
  TrendingUp, Award, Zap, Crown, Apple, Leaf,
  Clipboard, RotateCcw, Check, Home, Martini
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

const ginCocktails = [
  {
    id: 'gin-1',
    name: 'Classic Gin & Tonic',
    description: 'Simple perfection - gin, tonic, and lime',
    spiritType: 'London Dry Gin',
    origin: 'United Kingdom',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: { calories: 175, carbs: 15, sugar: 14, alcohol: 12 },
    ingredients: ['2 oz Gin', '5 oz Tonic Water', 'Lime Wedge', 'Ice'],
    profile: ['Crisp', 'Bitter', 'Refreshing', 'Botanical'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 6234,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    category: 'Classic Gin',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill highball glass with ice. Add gin. Top with tonic water. Stir gently. Garnish with lime wedge.'
  },
  {
    id: 'gin-2',
    name: 'Negroni',
    description: 'Equal parts gin, Campari, and sweet vermouth',
    spiritType: 'Gin',
    origin: 'Florence, Italy',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: { calories: 195, carbs: 8, sugar: 6, alcohol: 17 },
    ingredients: ['1 oz Gin', '1 oz Campari', '1 oz Sweet Vermouth', 'Orange Peel', 'Ice'],
    profile: ['Bitter', 'Complex', 'Bold', 'Sophisticated'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 5892,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    category: 'Classic Gin',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '28-32%',
    iba_official: true,
    instructions: 'Add gin, Campari, and vermouth to mixing glass with ice. Stir for 30 seconds. Strain into old fashioned glass with large ice cube. Express orange peel and garnish.'
  },
  {
    id: 'gin-3',
    name: 'Tom Collins',
    description: 'Refreshing gin sour topped with soda',
    spiritType: 'Old Tom Gin',
    origin: 'London, England',
    glassware: 'Collins Glass',
    servingSize: '8 oz',
    nutrition: { calories: 185, carbs: 14, sugar: 12, alcohol: 12 },
    ingredients: ['2 oz Gin', '1 oz Fresh Lemon Juice', '0.5 oz Simple Syrup', 'Soda Water', 'Lemon Wheel', 'Maraschino Cherry', 'Ice'],
    profile: ['Citrus', 'Refreshing', 'Bubbly', 'Classic'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 4123,
    trending: false,
    featured: true,
    estimatedCost: 3.50,
    category: 'Classic Gin',
    garnish: 'Lemon wheel, cherry',
    method: 'Shake & Build',
    abv: '12-15%',
    iba_official: true,
    instructions: 'Shake gin, lemon juice, and simple syrup with ice. Strain into Collins glass with fresh ice. Top with soda water. Stir gently. Garnish with lemon wheel and cherry.'
  },
  {
    id: 'gin-4',
    name: 'Aviation',
    description: 'Floral gin cocktail with violet liqueur',
    spiritType: 'Gin',
    origin: 'New York, USA',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: { calories: 175, carbs: 10, sugar: 8, alcohol: 14 },
    ingredients: ['2 oz Gin', '0.5 oz Maraschino Liqueur', '0.25 oz Crème de Violette', '0.75 oz Fresh Lemon Juice', 'Lemon Twist', 'Ice'],
    profile: ['Floral', 'Tart', 'Elegant', 'Purple'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.7,
    reviews: 3456,
    trending: true,
    featured: true,
    estimatedCost: 6.00,
    category: 'Modern Gin',
    garnish: 'Lemon twist',
    method: 'Shake',
    abv: '22-26%',
    iba_official: true,
    instructions: 'Add gin, maraschino liqueur, crème de violette, and lemon juice to shaker with ice. Shake for 10 seconds. Strain into chilled coupe glass. Garnish with lemon twist.'
  },
  {
    id: 'gin-5',
    name: 'French 75',
    description: 'Gin sour topped with champagne',
    spiritType: 'Gin',
    origin: 'Paris, France',
    glassware: 'Champagne Flute',
    servingSize: '5 oz',
    nutrition: { calories: 165, carbs: 8, sugar: 7, alcohol: 13 },
    ingredients: ['1 oz Gin', '0.5 oz Fresh Lemon Juice', '0.5 oz Simple Syrup', '3 oz Champagne', 'Lemon Twist', 'Ice'],
    profile: ['Bubbly', 'Citrus', 'Elegant', 'Celebratory'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 4567,
    trending: true,
    featured: true,
    estimatedCost: 7.00,
    category: 'Classic Gin',
    garnish: 'Lemon twist',
    method: 'Shake & Top',
    abv: '16-20%',
    iba_official: true,
    instructions: 'Shake gin, lemon juice, and simple syrup with ice. Strain into champagne flute. Top with champagne. Garnish with lemon twist.'
  },
  {
    id: 'gin-6',
    name: 'Bramble',
    description: 'Gin sour with blackberry liqueur drizzle',
    spiritType: 'Gin',
    origin: 'London, England',
    glassware: 'Old Fashioned Glass',
    servingSize: '5 oz',
    nutrition: { calories: 195, carbs: 16, sugar: 14, alcohol: 13 },
    ingredients: ['2 oz Gin', '1 oz Fresh Lemon Juice', '0.5 oz Simple Syrup', '0.5 oz Crème de Mure', 'Blackberries', 'Lemon Slice', 'Crushed Ice'],
    profile: ['Fruity', 'Tart', 'Refreshing', 'Berry'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 2987,
    trending: false,
    featured: true,
    estimatedCost: 5.50,
    category: 'Modern Gin',
    garnish: 'Blackberries, lemon slice',
    method: 'Build',
    abv: '18-22%',
    iba_official: true,
    instructions: 'Fill old fashioned glass with crushed ice. Add gin, lemon juice, and simple syrup. Stir. Drizzle crème de mure over top. Garnish with blackberries and lemon slice.'
  },
  {
    id: 'gin-7',
    name: 'Last Word',
    description: 'Equal parts gin, Chartreuse, maraschino, lime',
    spiritType: 'Gin',
    origin: 'Detroit, USA',
    glassware: 'Coupe Glass',
    servingSize: '3 oz',
    nutrition: { calories: 185, carbs: 10, sugar: 8, alcohol: 16 },
    ingredients: ['0.75 oz Gin', '0.75 oz Green Chartreuse', '0.75 oz Maraschino Liqueur', '0.75 oz Fresh Lime Juice', 'Lime Twist', 'Ice'],
    profile: ['Herbal', 'Balanced', 'Complex', 'Green'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 2345,
    trending: true,
    featured: true,
    estimatedCost: 7.50,
    category: 'Classic Gin',
    garnish: 'Lime twist',
    method: 'Shake',
    abv: '24-28%',
    iba_official: false,
    instructions: 'Add gin, Chartreuse, maraschino, and lime juice to shaker with ice. Shake for 10 seconds. Strain into chilled coupe glass. Garnish with lime twist.'
  },
  {
    id: 'gin-8',
    name: 'Bee\'s Knees',
    description: 'Prohibition-era gin sour with honey',
    spiritType: 'Gin',
    origin: 'United States',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: { calories: 195, carbs: 14, sugar: 12, alcohol: 14 },
    ingredients: ['2 oz Gin', '0.75 oz Fresh Lemon Juice', '0.75 oz Honey Syrup', 'Lemon Twist', 'Ice'],
    profile: ['Sweet', 'Citrus', 'Smooth', 'Vintage'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2876,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    category: 'Classic Gin',
    garnish: 'Lemon twist',
    method: 'Shake',
    abv: '22-26%',
    iba_official: false,
    instructions: 'Add gin, lemon juice, and honey syrup to shaker with ice. Shake hard for 10 seconds. Strain into chilled coupe glass. Garnish with lemon twist.'
  },
  {
    id: 'gin-9',
    name: 'Southside',
    description: 'Gin sour with fresh mint',
    spiritType: 'Gin',
    origin: 'Chicago, USA',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: { calories: 175, carbs: 12, sugar: 10, alcohol: 14 },
    ingredients: ['2 oz Gin', '0.75 oz Fresh Lime Juice', '0.75 oz Simple Syrup', '6 Fresh Mint Leaves', 'Mint Sprig', 'Ice'],
    profile: ['Minty', 'Refreshing', 'Citrus', 'Bright'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 1987,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    category: 'Classic Gin',
    garnish: 'Mint sprig',
    method: 'Shake',
    abv: '20-24%',
    iba_official: false,
    instructions: 'Muddle mint leaves with simple syrup in shaker. Add gin, lime juice, and ice. Shake for 10 seconds. Strain into chilled coupe glass. Garnish with mint sprig.'
  },
  {
    id: 'gin-10',
    name: 'Corpse Reviver #2',
    description: 'Complex gin cocktail with absinthe rinse',
    spiritType: 'Gin',
    origin: 'London, England',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: { calories: 185, carbs: 8, sugar: 6, alcohol: 16 },
    ingredients: ['0.75 oz Gin', '0.75 oz Cointreau', '0.75 oz Lillet Blanc', '0.75 oz Fresh Lemon Juice', 'Absinthe rinse', 'Orange Peel', 'Ice'],
    profile: ['Complex', 'Herbal', 'Citrus', 'Sophisticated'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 1654,
    trending: true,
    featured: true,
    estimatedCost: 7.00,
    category: 'Classic Gin',
    garnish: 'Orange peel',
    method: 'Shake',
    abv: '26-30%',
    iba_official: true,
    instructions: 'Rinse chilled coupe with absinthe, discard excess. Shake gin, Cointreau, Lillet, and lemon juice with ice. Strain into prepared glass. Express orange peel and garnish.'
  }
];

const ginCategories = [
  { id: 'all', name: 'All Cocktails', icon: Droplets, description: 'Every gin cocktail' },
  { id: 'classic', name: 'Classic Gin', icon: Crown, description: 'Traditional favorites' },
  { id: 'modern', name: 'Modern Gin', icon: Sparkles, description: 'Contemporary creations' }
];

const methods = ['All Methods', 'Build', 'Shake', 'Stir'];

// SISTER PAGES
const sisterPotentPotablesPages = [
  { id: 'vodka', name: 'Vodka', path: '/drinks/potent-potables/vodka', icon: Droplets, description: 'Clean & versatile' },
  { id: 'whiskey', name: 'Whiskey & Bourbon', path: '/drinks/potent-potables/whiskey-bourbon', icon: Wine, description: 'Kentucky classics' },
  { id: 'tequila', name: 'Tequila & Mezcal', path: '/drinks/potent-potables/tequila-mezcal', icon: Flame, description: 'Agave spirits' },
  { id: 'rum', name: 'Rum', path: '/drinks/potent-potables/rum', icon: GlassWater, description: 'Caribbean vibes' },
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

export default function GinCocktailsPage() {
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
  const ginRecipesWithMeasurements = useMemo(() => {
    return ginCocktails.map((c) => {
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
        category: 'gin-cocktails',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(35);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredCocktails = ginRecipesWithMeasurements.filter(cocktail => {
    if (selectedCategory !== 'all') {
      const categoryMap: Record<string, string> = {
        'classic': 'Classic Gin',
        'modern': 'Modern Gin'
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-cyan-50">
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
                  <Droplets className="h-6 w-6 text-blue-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Gin Cocktails</h1>
                  <Badge className="bg-blue-100 text-blue-800">Botanical Spirits</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <GlassWater className="fill-blue-500 text-blue-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-blue-50 to-teal-50 border-blue-200 mb-6">
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
                      <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                        <Icon className="h-4 w-4 mr-2 text-blue-500" />
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
          <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-teal-50 hover:border-teal-300">
                        <Icon className="h-4 w-4 mr-2 text-teal-500" />
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
                <div className="text-2xl font-bold text-blue-600">20%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-teal-600">4.7★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">3.5 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-teal-600">{ginCocktails.length}</div>
                <div className="text-sm text-gray-600">Recipes</div>
              </CardContent>
            </Card>
          </div>

          {/* Categories */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {ginCategories.map(category => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className={selectedCategory === category.id ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-blue-50"}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {category.name}
                </Button>
              );
            })}
          </div>

          {/* Filters and Sort */}
          <div className="flex gap-4 mb-6 items-center flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search gin cocktails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select 
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              {methods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
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
            >
              <Target className="w-4 h-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <Card className="mb-6 bg-white border-blue-200">
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
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-blue-100 hover:border-blue-300"
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
                            category: 'Gin Cocktails',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className="bg-blue-100 text-blue-700">{cocktail.category}</Badge>
                      {cocktail.trending && (
                        <Badge className="bg-teal-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.featured && (
                        <Badge className="bg-blue-500">
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
                        <div className="font-bold text-blue-600">{cocktail.abv}</div>
                        <div className="text-gray-500">ABV</div>
                      </div>
                      <div>
                        <div className="font-bold text-teal-600">{cocktail.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">{cocktail.method.split(' ')[0]}</div>
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
                              i < Math.floor(cocktail.rating)
                                ? 'fill-blue-500 text-blue-500'
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
                                <Check className="h-4 w-4 text-blue-500 mt-0.5" />
                                <span>
                                  <span className="text-blue-600 font-semibold">
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
                        <Badge key={tag} variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecipeModal(cocktail);
                        }}
                      >
                        <Droplets className="h-4 w-4 mr-2" />
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

          {/* Educational Content */}
          <Card className="mt-12 bg-gradient-to-br from-blue-50 to-teal-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-blue-500" />
                The World of Gin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Droplets className="w-8 h-8 text-blue-500 mb-2" />
                  <h3 className="font-semibold mb-2">Botanical Spirit</h3>
                  <p className="text-sm text-gray-700">
                    Gin is flavored primarily with juniper berries and botanicals. Each distiller creates unique 
                    botanical blends for distinct flavor profiles.
                  </p>
                </div>
                <div>
                  <Award className="w-8 h-8 text-teal-500 mb-2" />
                  <h3 className="font-semibold mb-2">Gin Styles</h3>
                  <p className="text-sm text-gray-700">
                    London Dry is crisp and juniper-forward. Old Tom is slightly sweeter. Plymouth has earthy notes. 
                    New American features creative botanicals.
                  </p>
                </div>
                <div>
                  <Sparkles className="w-8 h-8 text-cyan-500 mb-2" />
                  <h3 className="font-semibold mb-2">Perfect Balance</h3>
                  <p className="text-sm text-gray-700">
                    Gin's botanical complexity pairs beautifully with citrus, herbs, and tonic. It's incredibly 
                    versatile in both classic and modern cocktails.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Progress Card */}
          <Card className="mt-12 bg-gradient-to-r from-blue-50 to-teal-50 border-blue-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-blue-600" />
                    Your Progress
                  </h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <GlassWater className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-gray-600">Level:</span>
                      <Badge className="bg-blue-600 text-white">{userProgress.level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-teal-500" />
                      <span className="text-sm text-gray-600">XP:</span>
                      <Badge className="bg-teal-600 text-white">{userProgress.totalPoints}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-blue-100 text-blue-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-teal-500" />
                      <span className="text-sm text-gray-600">Cocktails Found:</span>
                      <Badge className="bg-teal-100 text-teal-800">{filteredCocktails.length}</Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="border-blue-300 hover:bg-blue-50"
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
