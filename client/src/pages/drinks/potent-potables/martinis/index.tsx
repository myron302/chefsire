import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Wine, Clock, Heart, Target, Sparkles, Grape,
  Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater,
  TrendingUp, Award, Crown, Zap, Apple, Leaf, Martini,
  Clipboard, RotateCcw, Check, BookOpen, Home, Droplets, Cherry
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

  const descriptors = new Set(['fresh', 'large', 'sugar', 'simple', 'sweet', 'dry']);
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

const cognacCocktails = [
  {
    id: 'cognac-1',
    name: 'Sidecar',
    description: 'Classic cognac sour with orange liqueur',
    spiritType: 'Cognac',
    origin: 'Paris, France',
    glassware: 'Coupe Glass',
    ingredients: ['2 oz Cognac', '0.75 oz Triple Sec', '0.75 oz Fresh Lemon Juice', 'Sugar (for rim)', 'Orange Peel', 'Ice'],
    profile: ['Sophisticated', 'Citrus', 'Balanced', 'Elegant'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 3421,
    trending: true,
    featured: true,
    category: 'Classic Cognac',
    garnish: 'Sugar rim, orange peel',
    method: 'Shake',
    abv: '30%',
    era: '1920s',
    instructions: 'Rim coupe glass with sugar. Shake cognac, triple sec, and lemon juice with ice. Strain into glass. Garnish with orange peel.'
  },
  {
    id: 'cognac-2',
    name: 'French Connection',
    description: 'Simple yet elegant cognac and amaretto',
    spiritType: 'Cognac',
    origin: 'France',
    glassware: 'Rocks Glass',
    ingredients: ['1.5 oz Cognac', '1.5 oz Amaretto', 'Large Ice Cube'],
    profile: ['Sweet', 'Nutty', 'Smooth', 'Rich'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 2134,
    trending: false,
    featured: true,
    category: 'Classic Cognac',
    garnish: 'None',
    method: 'Build',
    abv: '34%',
    era: '1970s',
    instructions: 'Add cognac and amaretto to rocks glass with large ice cube. Stir gently.'
  },
  {
    id: 'cognac-3',
    name: 'Vieux Carré',
    description: 'New Orleans classic with cognac and rye',
    spiritType: 'Cognac',
    origin: 'New Orleans',
    glassware: 'Rocks Glass',
    ingredients: ['0.75 oz Rye Whiskey', '0.75 oz Cognac', '0.75 oz Sweet Vermouth', '0.25 oz Bénédictine', '1 dash Peychauds Bitters', '1 dash Angostura Bitters', 'Lemon Peel'],
    profile: ['Complex', 'Rich', 'Herbaceous', 'Layered'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 1876,
    trending: false,
    featured: true,
    category: 'Classic Cognac',
    garnish: 'Lemon peel',
    method: 'Stir',
    abv: '34%',
    era: '1930s',
    instructions: 'Stir all ingredients with ice. Strain into rocks glass with ice. Express lemon peel over drink.'
  },
  {
    id: 'cognac-4',
    name: 'Sazerac (Cognac)',
    description: 'Original Sazerac with cognac before rye',
    spiritType: 'Cognac',
    origin: 'New Orleans',
    glassware: 'Rocks Glass',
    ingredients: ['2 oz Cognac', '0.25 oz Simple Syrup', '3 dashes Peychauds Bitters', 'Absinthe rinse', 'Lemon Peel', 'Ice for stirring'],
    profile: ['Strong', 'Herbaceous', 'Anise', 'Historic'],
    difficulty: 'Hard',
    prepTime: 6,
    rating: 4.8,
    reviews: 2543,
    trending: true,
    featured: true,
    category: 'Classic Cognac',
    garnish: 'Lemon peel',
    method: 'Stir',
    abv: '36%',
    era: '1850s',
    instructions: 'Rinse glass with absinthe. Stir cognac, syrup, and bitters with ice. Strain into glass. Express lemon peel.'
  },
  {
    id: 'cognac-5',
    name: 'Cognac Old Fashioned',
    description: 'Classic Old Fashioned with cognac',
    spiritType: 'Cognac',
    origin: 'United States',
    glassware: 'Rocks Glass',
    ingredients: ['2 oz Cognac', '0.25 oz Demerara Syrup', '2 dashes Angostura Bitters', '1 dash Orange Bitters', 'Orange Peel', 'Large Ice Cube'],
    profile: ['Sophisticated', 'Smooth', 'Oak', 'Aromatic'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.7,
    reviews: 2876,
    trending: true,
    featured: true,
    category: 'Modern Cognac',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '32%',
    era: '2000s',
    instructions: 'Add bitters and syrup to glass. Add cognac and large ice cube. Stir until chilled. Express orange peel.'
  },
  {
    id: 'cognac-6',
    name: 'French 75 (Cognac)',
    description: 'Champagne cocktail with cognac',
    spiritType: 'Cognac',
    origin: 'Paris, France',
    glassware: 'Champagne Flute',
    ingredients: ['1 oz Cognac', '0.5 oz Fresh Lemon Juice', '0.5 oz Simple Syrup', '3 oz Champagne', 'Lemon Twist', 'Ice'],
    profile: ['Sparkling', 'Citrus', 'Elegant', 'Celebration'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 3124,
    trending: true,
    featured: true,
    category: 'Modern Cognac',
    garnish: 'Lemon twist',
    method: 'Shake & Top',
    abv: '20%',
    era: '1915',
    instructions: 'Shake cognac, lemon juice, and syrup with ice. Strain into flute. Top with champagne. Garnish with lemon twist.'
  },
  {
    id: 'cognac-7',
    name: 'Brandy Alexander',
    description: 'Creamy dessert cocktail with brandy',
    spiritType: 'Brandy',
    origin: 'United Kingdom',
    glassware: 'Coupe Glass',
    ingredients: ['1.5 oz Brandy', '1 oz Crème de Cacao', '1 oz Heavy Cream', 'Grated Nutmeg', 'Ice'],
    profile: ['Creamy', 'Chocolate', 'Dessert', 'Luxurious'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2987,
    trending: false,
    featured: true,
    category: 'Classic Brandy',
    garnish: 'Grated nutmeg',
    method: 'Shake',
    abv: '24%',
    era: '1920s',
    instructions: 'Shake all ingredients with ice. Strain into coupe glass. Garnish with grated nutmeg.'
  },
  {
    id: 'cognac-8',
    name: 'Metropolitan',
    description: 'Brandy-based cosmopolitan variation',
    spiritType: 'Brandy',
    origin: 'New York City',
    glassware: 'Martini Glass',
    ingredients: ['1.5 oz Brandy', '0.5 oz Triple Sec', '0.5 oz Fresh Lime Juice', '1 oz Cranberry Juice', 'Lime Twist', 'Ice'],
    profile: ['Fruity', 'Tart', 'Sophisticated', 'Smooth'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 1654,
    trending: false,
    featured: false,
    category: 'Modern Brandy',
    garnish: 'Lime twist',
    method: 'Shake',
    abv: '22%',
    era: '1990s',
    instructions: 'Shake all ingredients with ice. Strain into martini glass. Garnish with lime twist.'
  },
  {
    id: 'cognac-9',
    name: 'Jack Rose',
    description: 'Apple brandy with grenadine and lime',
    spiritType: 'Apple Brandy',
    origin: 'United States',
    glassware: 'Coupe Glass',
    ingredients: ['2 oz Apple Brandy', '0.5 oz Fresh Lime Juice', '0.5 oz Grenadine', 'Lime Wheel', 'Ice'],
    profile: ['Fruity', 'Tart', 'Apple', 'Classic'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 2134,
    trending: true,
    featured: true,
    category: 'Apple Brandy',
    garnish: 'Lime wheel',
    method: 'Shake',
    abv: '24%',
    era: '1920s',
    instructions: 'Shake apple brandy, lime juice, and grenadine with ice. Strain into coupe. Garnish with lime wheel.'
  },
  {
    id: 'cognac-10',
    name: 'Between the Sheets',
    description: 'Cognac and rum with citrus',
    spiritType: 'Cognac',
    origin: 'Paris, France',
    glassware: 'Coupe Glass',
    ingredients: ['0.75 oz Cognac', '0.75 oz White Rum', '0.75 oz Triple Sec', '0.75 oz Fresh Lemon Juice', 'Lemon Twist', 'Ice'],
    profile: ['Citrus', 'Complex', 'Smooth', 'Balanced'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 2345,
    trending: true,
    featured: true,
    category: 'Classic Cognac',
    garnish: 'Lemon twist',
    method: 'Shake',
    abv: '28%',
    era: '1930s',
    instructions: 'Shake all ingredients with ice. Strain into coupe glass. Garnish with lemon twist.'
  },
  {
    id: 'cognac-11',
    name: 'Cognac Sour',
    description: 'Classic sour template with cognac',
    spiritType: 'Cognac',
    origin: 'United States',
    glassware: 'Rocks Glass',
    ingredients: ['2 oz Cognac', '0.75 oz Fresh Lemon Juice', '0.5 oz Simple Syrup', 'Egg White (optional)', '2 dashes Angostura Bitters', 'Lemon Wheel', 'Ice'],
    profile: ['Tart', 'Smooth', 'Frothy', 'Balanced'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.6,
    reviews: 1987,
    trending: false,
    featured: true,
    category: 'Modern Cognac',
    garnish: 'Lemon wheel',
    method: 'Dry Shake',
    abv: '24%',
    era: '2000s',
    instructions: 'Dry shake egg white if using. Add other ingredients and ice. Shake hard. Strain into rocks glass. Garnish.'
  },
  {
    id: 'cognac-12',
    name: 'Corpse Reviver No. 1',
    description: 'Cognac-based hangover cure',
    spiritType: 'Cognac',
    origin: 'London, UK',
    glassware: 'Coupe Glass',
    ingredients: ['1.5 oz Cognac', '0.75 oz Calvados', '0.75 oz Sweet Vermouth', 'Lemon Twist', 'Ice'],
    profile: ['Strong', 'Apple', 'Herbal', 'Revival'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 1432,
    trending: false,
    featured: false,
    category: 'Classic Cognac',
    garnish: 'Lemon twist',
    method: 'Shake',
    abv: '30%',
    era: '1930s',
    instructions: 'Shake all ingredients with ice. Strain into coupe glass. Garnish with lemon twist.'
  }
];

const spiritCategories = [
  { 
    id: 'all', 
    name: 'All Spirits', 
    icon: Grape,
    color: 'bg-orange-500',
    description: 'Every cognac & brandy'
  },
  { 
    id: 'cognac', 
    name: 'Cognac', 
    icon: Crown,
    color: 'bg-orange-600',
    description: 'French grape brandy'
  },
  { 
    id: 'brandy', 
    name: 'Brandy', 
    icon: Wine,
    color: 'bg-red-500',
    description: 'Grape-based spirits'
  },
  { 
    id: 'apple brandy', 
    name: 'Apple Brandy', 
    icon: Cherry,
    color: 'bg-red-600',
    description: 'Calvados & applejack'
  }
];

// SISTER PAGES
const sisterPotentPotablesPages = [
  { id: 'vodka', name: 'Vodka', path: '/drinks/potent-potables/vodka', icon: Droplets, description: 'Clean & versatile' },
  { id: 'whiskey', name: 'Whiskey & Bourbon', path: '/drinks/potent-potables/whiskey-bourbon', icon: Wine, description: 'Kentucky classics' },
  { id: 'tequila', name: 'Tequila & Mezcal', path: '/drinks/potent-potables/tequila-mezcal', icon: Flame, description: 'Agave spirits' },
  { id: 'rum', name: 'Rum', path: '/drinks/potent-potables/rum', icon: GlassWater, description: 'Caribbean vibes' },
  { id: 'daiquiri', name: 'Daiquiri', path: '/drinks/potent-potables/daiquiri', icon: Droplets, description: 'Rum classics' },
  { id: 'scotch', name: 'Scotch & Irish', path: '/drinks/potent-potables/scotch-irish-whiskey', icon: Wine, description: 'UK whiskeys' },
  { id: 'classic', name: 'Classic Cocktails', path: '/drinks/potent-potables/classic-cocktails', icon: Wine, description: 'Timeless recipes' },
  { id: 'seasonal', name: 'Seasonal', path: '/drinks/potent-potables/seasonal', icon: Sparkles, description: 'Festive drinks' },
  { id: 'mocktails', name: 'Mocktails', path: '/drinks/potent-potables/mocktails', icon: Sparkles, description: 'Zero-proof' }
];

// CROSS-HUB
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'protein', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'detox', name: 'Detoxes', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing blends' },
  { id: 'all', name: 'All Drinks', icon: Wine, route: '/drinks', description: 'Browse everything' }
];

export default function CognacBrandyPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCocktail, setSelectedCocktail] = useState<typeof cognacCocktails[0] | null>(null);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert cocktails to RecipeKit format
  const cocktailRecipesWithMeasurements = useMemo(() => {
    return cognacCocktails.map((c) => {
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
    const text = `${cocktail.name} • ${cocktail.category} • ${cocktail.era}\n${preview}${cocktail.ingredients.length > 4 ? ` …plus ${cocktail.ingredients.length - 4} more` : ''}`;
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
        category: 'cognac-brandy',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(45);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredCocktails = cocktailRecipesWithMeasurements.filter(cocktail => {
    if (selectedCategory !== 'all' && cocktail.spiritType.toLowerCase() !== selectedCategory) {
      return false;
    }
    if (searchQuery && !cocktail.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'trending') return b.reviews - a.reviews;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'abv') return parseInt(b.abv) - parseInt(a.abv);
    return 0;
  });

  const featuredCocktails = cocktailRecipesWithMeasurements.filter(c => c.featured);

  const handleCocktailClick = (cocktail: typeof cognacCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'cognac-brandy',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof cognacCocktails[0]) => {
    incrementDrinksMade();
    addPoints(45, 'Made a cognac/brandy cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="orange"
            pointsReward={45}
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
                  <Grape className="h-6 w-6 text-orange-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Cognac & Brandy</h1>
                  <Badge className="bg-orange-100 text-orange-800">Premium</Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <GlassWater className="fill-orange-500 text-orange-500" />
                  <span>Level {userProgress.level}</span>
                  <div className="w-px h-4 bg-gray-300" />
                  <span>{userProgress.totalPoints} XP</span>
                </div>
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                  <Camera className="h-4 w-4 mr-2" />
                  Share Recipe
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-orange-300 mb-6">
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
                      <Button variant="outline" className="w-full justify-start hover:bg-orange-50 hover:border-orange-300">
                        <Icon className="h-4 w-4 mr-2 text-orange-500" />
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
          <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-red-300 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-red-50 hover:border-red-300">
                        <Icon className="h-4 w-4 mr-2 text-red-500" />
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
                <div className="text-2xl font-bold text-orange-600">28%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">4.6★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">3.5 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">12</div>
                <div className="text-sm text-gray-600">Cocktails</div>
              </CardContent>
            </Card>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'browse', label: 'Browse All', icon: Search },
              { id: 'spirits', label: 'By Spirit', icon: Grape },
              { id: 'featured', label: 'Featured', icon: Crown }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 ${activeTab === tab.id ? 'bg-white shadow-sm' : ''}`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          {/* Browse Tab */}
          {activeTab === 'browse' && (
            <div>
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search cognac & brandy cocktails..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="flex gap-2">
                  <select 
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="trending">Most Popular</option>
                    <option value="rating">Highest Rated</option>
                    <option value="abv">Highest ABV</option>
                  </select>
                </div>
              </div>

              {/* Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCocktails.map(cocktail => {
                  const useMetric = !!metricFlags[cocktail.id];
                  const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);
                  const categoryData = spiritCategories.find(c => c.id === cocktail.spiritType.toLowerCase());

                  return (
                    <Card 
                      key={cocktail.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => handleCocktailClick(cocktail)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-1">{cocktail.name}</CardTitle>
                            <p className="text-sm text-gray-600 mb-2">{cocktail.description}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToFavorites({
                                id: cocktail.id,
                                name: cocktail.name,
                                category: 'cognac-brandy',
                                timestamp: Date.now()
                              });
                            }}
                            className="text-gray-400 hover:text-orange-500"
                          >
                            <Heart className={`h-4 w-4 ${isFavorite(cocktail.id) ? 'fill-orange-500 text-orange-500' : ''}`} />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={categoryData?.color}>{cocktail.spiritType}</Badge>
                          <Badge variant="outline">{cocktail.era}</Badge>
                          {cocktail.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        {/* Key Info Grid */}
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                          <div>
                            <div className="font-bold text-orange-600">{cocktail.abv}</div>
                            <div className="text-gray-500">ABV</div>
                          </div>
                          <div>
                            <div className="font-bold text-red-600">{cocktail.prepTime}min</div>
                            <div className="text-gray-500">Prep</div>
                          </div>
                          <div>
                            <div className="font-bold text-orange-600">{cocktail.method}</div>
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
                                    ? 'fill-orange-500 text-orange-500'
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
                                    <Check className="h-4 w-4 text-orange-500 mt-0.5" />
                                    <span>
                                      <span className="text-orange-600 font-semibold">
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
                            <Badge key={tag} variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button 
                            className="flex-1 bg-orange-600 hover:bg-orange-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRecipeModal(cocktail);
                            }}
                          >
                            <Grape className="h-4 w-4 mr-2" />
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
            </div>
          )}

          {/* By Spirit Tab */}
          {activeTab === 'spirits' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {spiritCategories.map(category => {
                const Icon = category.icon;
                const categoryCocktails = cognacCocktails.filter(c => 
                  category.id === 'all' || c.spiritType.toLowerCase() === category.id
                );
                
                return (
                  <Card 
                    key={category.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setActiveTab('browse');
                    }}
                  >
                    <CardHeader>
                      <div className="text-center">
                        <div className={`inline-flex p-3 ${category.color.replace('bg-', 'bg-').replace('-500', '-100').replace('-600', '-100')} rounded-full mb-3`}>
                          <Icon className={`w-8 h-8 ${category.color.replace('bg-', 'text-')}`} />
                        </div>
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="text-center">
                      <div className={`text-3xl font-bold ${category.color.replace('bg-', 'text-')} mb-1`}>
                        {categoryCocktails.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-4">Cocktails</div>
                      <Button className="w-full bg-orange-600 hover:bg-orange-700">
                        Explore {category.name}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Featured Tab */}
          {activeTab === 'featured' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {featuredCocktails.map(cocktail => (
                <Card 
                  key={cocktail.id} 
                  className="overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => handleCocktailClick(cocktail)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Badge className="bg-orange-500 text-white mb-2">Featured</Badge>
                        <CardTitle className="text-xl">{cocktail.name}</CardTitle>
                        <p className="text-gray-600 mt-1">{cocktail.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">{cocktail.era}</Badge>
                      <Badge className="bg-orange-100 text-orange-800">{cocktail.category}</Badge>
                      <div className="flex items-center gap-1 ml-auto">
                        {[...Array(5)].map((_, i) => (
                          <GlassWater
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(cocktail.rating)
                                ? 'fill-orange-500 text-orange-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="font-medium ml-1">{cocktail.rating}</span>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-orange-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-xl font-bold text-orange-600">{cocktail.abv}</div>
                        <div className="text-xs text-gray-600">ABV</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-red-600">{cocktail.prepTime}min</div>
                        <div className="text-xs text-gray-600">Prep</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-orange-600">{cocktail.method}</div>
                        <div className="text-xs text-gray-600">Method</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-red-600">{cocktail.difficulty}</div>
                        <div className="text-xs text-gray-600">Level</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                      <ul className="space-y-1">
                        {cocktail.ingredients.map((ingredient, index) => (
                          <li key={index} className="text-sm flex items-center gap-2">
                            <Droplets className="h-3 w-3 text-orange-500" />
                            {ingredient}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 mb-2">Instructions:</h4>
                      <p className="text-sm text-gray-700">{cocktail.instructions}</p>
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-orange-600 to-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecipeModal(cocktail);
                        }}
                      >
                        <Grape className="h-4 w-4 mr-2" />
                        View Full Recipe
                      </Button>
                      <Button variant="outline" onClick={(e) => {
                        e.stopPropagation();
                        handleShareCocktail(cocktail);
                      }}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Educational Content */}
          <Card className="mt-12 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 border-orange-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-orange-500" />
                Understanding Cognac & Brandy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Crown className="w-8 h-8 text-orange-600 mb-2" />
                  <h3 className="font-semibold mb-2 text-orange-600">Cognac</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    French brandy from Cognac region. Double-distilled in copper pot stills, aged in oak. 
                    Classified by age: VS (2+ years), VSOP (4+ years), XO (10+ years).
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Hennessy, Rémy Martin, Courvoisier</p>
                </div>
                <div>
                  <Wine className="w-8 h-8 text-red-500 mb-2" />
                  <h3 className="font-semibold mb-2 text-red-600">Brandy</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Distilled wine from grapes. Made worldwide with regional variations. 
                    Smooth, fruity, with notes of vanilla, caramel, and dried fruit.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: E&J, Paul Masson, Spanish brandy</p>
                </div>
                <div>
                  <Cherry className="w-8 h-8 text-red-600 mb-2" />
                  <h3 className="font-semibold mb-2 text-red-600">Apple Brandy</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Distilled from apples. Calvados from Normandy, Applejack from America. 
                    Apple-forward with oak aging complexity.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Calvados Boulard, Laird's Applejack</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

          {/* Your Progress Card */}
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-orange-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-orange-600" />
                    Your Progress
                  </h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <GlassWater className="h-4 w-4 text-orange-500" />
                      <span className="text-sm text-gray-600">Level:</span>
                      <Badge className="bg-orange-600 text-white">{userProgress.level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-gray-600">XP:</span>
                      <Badge className="bg-red-600 text-white">{userProgress.totalPoints}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Grape className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-gray-600">Drinks Made:</span>
                      <Badge className="bg-orange-100 text-orange-800">{userProgress.totalDrinksMade}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-gray-600">Cocktails Found:</span>
                      <Badge className="bg-red-100 text-red-800">{filteredCocktails.length}</Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="border-orange-300 hover:bg-orange-50"
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
