import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Wine, Clock, Heart, Target, Sparkles,
  CheckCircle, Flame, Droplets, Plus,
  Search, Share2, ArrowLeft, Check, X,
  Camera, GlassWater, Crown, Gem,
  BookOpen, Home, Zap, Apple, Leaf, Martini,
  Clipboard, RotateCcw
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

// Classic cocktail data with RecipeKit measurements
const classicCocktails = [
  {
    id: 'classic-1',
    name: 'Old Fashioned',
    description: 'The grandfather of all cocktails, simple and timeless',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop',
    ingredients: ['2 oz Bourbon or Rye whiskey', '1 sugar cube', '2-3 dashes Angostura bitters', 'Orange peel', 'Ice'],
    glassware: 'Rocks glass',
    method: 'Muddle',
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 2341,
    trending: true,
    featured: true,
    tags: ['Whiskey', 'Classic', 'Strong', 'Stirred'],
    instructions: 'Muddle sugar cube with bitters and a splash of water in rocks glass. Add whiskey and large ice cube. Stir until chilled. Express orange peel oils over drink, then garnish.',
    history: 'Dating back to the 1880s, considered the original cocktail.',
    abv: '35%',
    era: '1880s',
    origin: 'United States',
    category: 'Spirit-forward',
    garnish: 'Orange peel',
    profile: ['Strong', 'Bitter-sweet', 'Aromatic', 'Classic']
  },
  {
    id: 'classic-2',
    name: 'Martini',
    description: 'The king of cocktails, gin and vermouth in perfect harmony',
    ingredients: ['2.5 oz Gin', '0.5 oz Dry vermouth', 'Lemon twist or olive', 'Ice'],
    glassware: 'Martini glass',
    method: 'Stir',
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.7,
    reviews: 1876,
    trending: false,
    featured: true,
    tags: ['Gin', 'Dry', 'Elegant', 'Stirred'],
    instructions: 'Stir gin and vermouth with ice until very cold. Strain into chilled martini glass. Garnish with lemon twist or olive.',
    history: 'Evolved from the Martinez in the 1880s, perfected in the early 1900s.',
    abv: '28%',
    era: '1880s',
    origin: 'United States',
    category: 'Spirit-forward',
    garnish: 'Lemon twist or olive',
    profile: ['Dry', 'Botanical', 'Strong', 'Elegant']
  },
  {
    id: 'classic-3',
    name: 'Manhattan',
    description: 'Sophisticated whiskey cocktail with sweet vermouth and bitters',
    ingredients: ['2 oz Rye whiskey', '1 oz Sweet vermouth', '2 dashes Angostura bitters', 'Maraschino cherry'],
    glassware: 'Coupe or Martini glass',
    method: 'Stir',
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 1432,
    trending: false,
    featured: true,
    tags: ['Whiskey', 'Sweet', 'Elegant', 'Stirred'],
    instructions: 'Stir all ingredients with ice. Strain into chilled glass. Garnish with cherry.',
    history: 'Created in 1870s at the Manhattan Club in New York City.',
    abv: '30%',
    era: '1870s',
    origin: 'New York, USA',
    category: 'Spirit-forward',
    garnish: 'Maraschino cherry',
    profile: ['Sweet', 'Rich', 'Complex', 'Smooth']
  },
  {
    id: 'classic-4',
    name: 'Negroni',
    description: 'Italian aperitif with gin, Campari, and sweet vermouth',
    ingredients: ['1 oz Gin', '1 oz Campari', '1 oz Sweet vermouth', 'Orange peel'],
    glassware: 'Rocks glass',
    method: 'Stir',
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 1198,
    trending: true,
    featured: false,
    tags: ['Gin', 'Bitter', 'Aperitif', 'Italian'],
    instructions: 'Stir all ingredients with ice in rocks glass. Garnish with orange peel.',
    history: 'Invented in 1919 by Count Camillo Negroni in Florence, Italy.',
    abv: '24%',
    era: '1919',
    origin: 'Florence, Italy',
    category: 'Aperitif',
    garnish: 'Orange peel',
    profile: ['Bitter', 'Herbal', 'Bold', 'Aperitif']
  },
  {
    id: 'classic-5',
    name: 'Whiskey Sour',
    description: 'Perfect balance of whiskey, lemon, and sugar',
    ingredients: ['2 oz Bourbon whiskey', '0.75 oz Fresh lemon juice', '0.75 oz Simple syrup', 'Egg white (optional)', 'Cherry and orange'],
    glassware: 'Rocks glass',
    method: 'Shake',
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.4,
    reviews: 987,
    trending: false,
    featured: false,
    tags: ['Whiskey', 'Sour', 'Refreshing', 'Shaken'],
    instructions: 'Shake all ingredients with ice. Strain over fresh ice. Garnish with cherry and orange.',
    history: 'First published in 1862 bartender manual by Jerry Thomas.',
    abv: '20%',
    era: '1862',
    origin: 'United States',
    category: 'Sour',
    garnish: 'Cherry and orange slice',
    profile: ['Sour', 'Sweet', 'Balanced', 'Refreshing']
  },
  {
    id: 'classic-6',
    name: 'Daiquiri',
    description: 'Cuban classic with rum, lime, and sugar',
    ingredients: ['2 oz White rum', '1 oz Fresh lime juice', '0.75 oz Simple syrup'],
    glassware: 'Coupe glass',
    method: 'Shake',
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.3,
    reviews: 756,
    trending: false,
    featured: false,
    tags: ['Rum', 'Citrus', 'Cuban', 'Shaken'],
    instructions: 'Shake all ingredients with ice. Double strain into chilled coupe glass.',
    history: 'Created in Cuba around 1900, popularized by Hemingway.',
    abv: '18%',
    era: '1900',
    origin: 'Cuba',
    category: 'Sour',
    garnish: 'Lime wheel',
    profile: ['Tart', 'Sweet', 'Refreshing', 'Clean']
  },
  {
    id: 'classic-7',
    name: 'Sazerac',
    description: 'New Orleans classic with rye whiskey and absinthe rinse',
    ingredients: ['2 oz Rye whiskey', '0.25 oz Simple syrup', '2 dashes Peychauds bitters', 'Absinthe rinse', 'Lemon peel'],
    glassware: 'Rocks glass',
    method: 'Stir',
    difficulty: 'Hard',
    prepTime: 6,
    rating: 4.6,
    reviews: 445,
    trending: false,
    featured: true,
    tags: ['Whiskey', 'New Orleans', 'Absinthe', 'Complex'],
    instructions: 'Rinse glass with absinthe. Stir whiskey, syrup, and bitters with ice. Strain into glass. Express lemon peel.',
    history: 'Official cocktail of New Orleans, dating to 1850s.',
    abv: '32%',
    era: '1850s',
    origin: 'New Orleans, USA',
    category: 'Spirit-forward',
    garnish: 'Lemon peel',
    profile: ['Complex', 'Herbal', 'Anise', 'Bold']
  },
  {
    id: 'classic-8',
    name: 'Mint Julep',
    description: 'Kentucky Derby tradition with bourbon and fresh mint',
    ingredients: ['2.5 oz Bourbon whiskey', '0.5 oz Simple syrup', '8-10 Fresh mint leaves', 'Crushed ice', 'Mint sprig'],
    glassware: 'Julep cup or rocks glass',
    method: 'Muddle',
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.2,
    reviews: 623,
    trending: false,
    featured: false,
    tags: ['Bourbon', 'Mint', 'Southern', 'Derby'],
    instructions: 'Gently muddle mint with syrup. Add bourbon and crushed ice. Stir until frosted. Garnish with mint sprig.',
    history: 'Southern American classic, official drink of Kentucky Derby since 1938.',
    abv: '25%',
    era: '1800s',
    origin: 'Southern USA',
    category: 'Refreshing',
    garnish: 'Mint sprig',
    profile: ['Minty', 'Sweet', 'Refreshing', 'Southern']
  }
];

const cocktailEras = [
  { 
    id: '1850s-1880s', 
    name: 'Golden Age', 
    icon: Crown,
    color: 'bg-blue-500',
    description: 'Birth of the cocktail era',
    cocktails: ['Sazerac', 'Old Fashioned', 'Manhattan']
  },
  { 
    id: '1900s-1920s', 
    name: 'Pre-Prohibition', 
    icon: Gem,
    color: 'bg-indigo-500',
    description: 'Cocktail refinement period',
    cocktails: ['Martini', 'Daiquiri', 'Mint Julep']
  },
  { 
    id: '1920s-1933', 
    name: 'Prohibition Era', 
    icon: Wine,
    color: 'bg-purple-500',
    description: 'Hidden speakeasy culture',
    cocktails: ['Negroni', 'Whiskey Sour']
  }
];

const cocktailCategories = [
  {
    id: 'spirit-forward',
    name: 'Spirit-Forward',
    description: 'Strong cocktails with minimal mixers',
    icon: Wine,
    color: 'text-blue-600',
    examples: ['Old Fashioned', 'Manhattan', 'Martini']
  },
  {
    id: 'sour',
    name: 'Sours',
    description: 'Balance of spirit, citrus, and sweetener',
    icon: Apple,
    color: 'text-indigo-600',
    examples: ['Whiskey Sour', 'Daiquiri']
  },
  {
    id: 'aperitif',
    name: 'Aperitifs',
    description: 'Pre-dinner appetite stimulants',
    icon: Sparkles,
    color: 'text-purple-600',
    examples: ['Negroni']
  },
  {
    id: 'refreshing',
    name: 'Refreshing',
    description: 'Light and cooling cocktails',
    icon: Droplets,
    color: 'text-cyan-600',
    examples: ['Mint Julep']
  }
];

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
  { id: 'spritz', name: 'Spritz & Mimosas', path: '/drinks/potent-potables/spritz', icon: Sparkles, description: 'Bubbly refreshers' },
  { id: 'seasonal', name: 'Seasonal', path: '/drinks/potent-potables/seasonal', icon: Sparkles, description: 'Festive drinks' },
  { id: 'hot-drinks', name: 'Hot Drinks', path: '/drinks/potent-potables/hot-drinks', icon: Flame, description: 'Warming cocktails' },
  { id: 'mocktails', name: 'Mocktails', path: '/drinks/potent-potables/mocktails', icon: Sparkles, description: 'Zero-proof' }
];

// CROSS-HUB - Top level drink categories
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'protein', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'detox', name: 'Detoxes', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing blends' },
  { id: 'all', name: 'All Drinks', icon: Wine, route: '/drinks', description: 'Browse everything' }
];

export default function ClassicCocktailsPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedEra, setSelectedEra] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [selectedCocktail, setSelectedCocktail] = useState<typeof classicCocktails[0] | null>(null);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert cocktails to RecipeKit format
  const cocktailRecipesWithMeasurements = useMemo(() => {
    return classicCocktails.map((c) => {
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
        category: 'potent-potables',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(40);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredCocktails = () => {
    let filtered = cocktailRecipesWithMeasurements.filter(cocktail => {
      const matchesSearch = cocktail.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           cocktail.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesEra = !selectedEra || cocktail.era.includes(selectedEra);
      const matchesCategory = !selectedCategory || cocktail.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesDifficulty = !selectedDifficulty || cocktail.difficulty === selectedDifficulty;
      
      return matchesSearch && matchesEra && matchesCategory && matchesDifficulty;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'era': return a.era.localeCompare(b.era);
        case 'difficulty': 
          const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
          return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
        case 'abv': return parseFloat(b.abv) - parseFloat(a.abv);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredCocktails = getFilteredCocktails();
  const featuredCocktails = cocktailRecipesWithMeasurements.filter(c => c.featured);
  const trendingCocktails = cocktailRecipesWithMeasurements.filter(c => c.trending);

  const handleCocktailClick = (cocktail: typeof classicCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'potent-potables',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof classicCocktails[0]) => {
    incrementDrinksMade();
    addPoints(40, 'Made a classic cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="blue"
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
                  <Wine className="h-6 w-6 text-blue-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Classic Cocktails</h1>
                  <Badge className="bg-blue-100 text-blue-800">Premium</Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <GlassWater className="fill-blue-500 text-blue-500" />
                  <span>Level {userProgress.level}</span>
                  <div className="w-px h-4 bg-gray-300" />
                  <span>{userProgress.totalPoints} XP</span>
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Camera className="h-4 w-4 mr-2" />
                  Share Recipe
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 mb-6">
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
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sisterPotentPotablesPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link key={page.id} href={page.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-indigo-50 hover:border-indigo-300">
                        <Icon className="h-4 w-4 mr-2 text-indigo-500" />
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
                <div className="text-2xl font-bold text-blue-600">26%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600">4.5★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">4 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">8</div>
                <div className="text-sm text-gray-600">Classics</div>
              </CardContent>
            </Card>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'browse', label: 'Browse All', icon: Search },
              { id: 'eras', label: 'By Era', icon: Clock },
              { id: 'categories', label: 'Categories', icon: BookOpen },
              { id: 'featured', label: 'Featured', icon: GlassWater }
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
                    placeholder="Search classic cocktails..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="flex gap-2">
                  <select 
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={selectedEra}
                    onChange={(e) => setSelectedEra(e.target.value)}
                  >
                    <option value="">All Eras</option>
                    <option value="1850">Golden Age (1850s-1880s)</option>
                    <option value="1900">Pre-Prohibition (1900s-1920s)</option>
                    <option value="1920">Prohibition (1920s-1933)</option>
                  </select>
                  
                  <select 
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {cocktailCategories.map(category => (
                      <option key={category.id} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                  
                  <select 
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                  >
                    <option value="">All Difficulties</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                  
                  <select 
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="rating">Sort by Rating</option>
                    <option value="era">Sort by Era</option>
                    <option value="difficulty">Sort by Difficulty</option>
                    <option value="abv">Sort by ABV</option>
                  </select>
                </div>
              </div>

              {/* Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCocktails.map(cocktail => {
                  const useMetric = !!metricFlags[cocktail.id];
                  const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);

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
                                category: 'potent-potables',
                                timestamp: Date.now()
                              });
                            }}
                            className="text-gray-400 hover:text-blue-500"
                          >
                            <Heart className={`h-4 w-4 ${isFavorite(cocktail.id) ? 'fill-blue-500 text-blue-500' : ''}`} />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{cocktail.era}</Badge>
                          <Badge className="bg-blue-100 text-blue-800">{cocktail.category}</Badge>
                          {cocktail.trending && <Badge className="bg-indigo-100 text-indigo-800">Trending</Badge>}
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        {/* Key Info Grid */}
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                          <div>
                            <div className="font-bold text-blue-600">{cocktail.abv}</div>
                            <div className="text-gray-500">ABV</div>
                          </div>
                          <div>
                            <div className="font-bold text-indigo-600">{cocktail.prepTime}min</div>
                            <div className="text-gray-500">Prep</div>
                          </div>
                          <div>
                            <div className="font-bold text-purple-600">{cocktail.method}</div>
                            <div className="text-gray-500">Method</div>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-2 mb-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Glassware:</span>
                            <span className="font-medium text-xs">{cocktail.glassware}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Origin:</span>
                            <span className="font-medium">{cocktail.origin}</span>
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
                                  aria-label="decrease servings"
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
                                  aria-label="increase servings"
                                >
                                  +
                                </button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setServingsById(prev => {
                                      const next = { ...prev };
                                      next[cocktail.id] = 1;
                                      return next;
                                    });
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
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const lines = cocktail.ingredients.map((ing: string) => `- ${ing}`);
                                  const txt = `${cocktail.name} (serves ${servings})\n${lines.join('\n')}`;
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
                              <Button variant="outline" size="sm" onClick={(e) => {
                                e.stopPropagation();
                                handleShareCocktail(cocktail, servings);
                              }}>
                                <Share2 className="w-4 h-4 mr-1" /> Share
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
                          {cocktail.tags?.slice(0, 3).map((tag: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200">
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
                            <Wine className="h-4 w-4 mr-2" />
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

          {/* Eras Tab */}
          {activeTab === 'eras' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cocktailEras.map(era => {
                const Icon = era.icon;
                const eraCocktails = classicCocktails.filter(cocktail => 
                  era.cocktails.some(name => cocktail.name.includes(name))
                );
                
                return (
                  <Card key={era.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 ${era.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-lg`}>
                          <Icon className={`h-6 w-6 ${era.color.replace('bg-', 'text-')}`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{era.name}</CardTitle>
                          <p className="text-sm text-gray-600">{era.description}</p>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-3 mb-4">
                        <h4 className="font-semibold">Classic Cocktails:</h4>
                        <ul className="space-y-1">
                          {era.cocktails.map((cocktail, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm">
                              <Wine className="h-3 w-3 text-blue-500" />
                              {cocktail}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${era.color.replace('bg-', 'text-')} mb-1`}>
                          {eraCocktails.length}
                        </div>
                        <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                        <Button 
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          onClick={() => {
                            setSelectedEra(era.id.split('-')[0]);
                            setActiveTab('browse');
                          }}
                        >
                          Explore {era.name}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {cocktailCategories.map(category => {
                const Icon = category.icon;
                const categoryCocktails = classicCocktails.filter(cocktail => 
                  cocktail.category.toLowerCase().includes(category.id.replace('-', ' '))
                );
                
                return (
                  <Card key={category.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="text-center">
                        <Icon className={`h-8 w-8 mx-auto mb-2 ${category.color}`} />
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <p className="text-sm text-gray-600">{category.description}</p>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-3 mb-4">
                        <h4 className="font-semibold text-sm">Examples:</h4>
                        <div className="flex flex-wrap gap-1">
                          {category.examples.map((example, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {example}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${category.color} mb-1`}>
                          {categoryCocktails.length}
                        </div>
                        <div className="text-sm text-gray-600 mb-3">Cocktails</div>
                        <Button 
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          onClick={() => {
                            setSelectedCategory(category.name);
                            setActiveTab('browse');
                          }}
                        >
                          View {category.name}
                        </Button>
                      </div>
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
                  <div className="relative">
                    {cocktail.image && (
                      <img 
                        src={cocktail.image} 
                        alt={cocktail.name}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-blue-500 text-white">Featured Classic</Badge>
                    </div>
                  </div>
                  
                  <CardHeader>
                    <CardTitle className="text-xl">{cocktail.name}</CardTitle>
                    <p className="text-gray-600">{cocktail.description}</p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">{cocktail.era}</Badge>
                      <Badge className="bg-blue-100 text-blue-800">{cocktail.category}</Badge>
                      <div className="flex items-center gap-1 ml-auto">
                        {[...Array(5)].map((_, i) => (
                          <GlassWater
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(cocktail.rating)
                                ? 'fill-blue-500 text-blue-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="font-medium ml-1">{cocktail.rating}</span>
                        <span className="text-gray-500 text-sm">({cocktail.reviews})</span>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                      <h4 className="font-medium text-blue-900 mb-2">Historical Note:</h4>
                      <p className="text-sm text-blue-800">{cocktail.history}</p>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">{cocktail.abv}</div>
                        <div className="text-xs text-gray-600">ABV</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-indigo-600">{cocktail.prepTime}min</div>
                        <div className="text-xs text-gray-600">Prep</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-purple-600">{cocktail.method}</div>
                        <div className="text-xs text-gray-600">Method</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">{cocktail.difficulty}</div>
                        <div className="text-xs text-gray-600">Level</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                      <ul className="space-y-1">
                        {cocktail.ingredients.map((ingredient, index) => (
                          <li key={index} className="text-sm flex items-center gap-2">
                            <Droplets className="h-3 w-3 text-blue-500" />
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
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecipeModal(cocktail);
                        }}
                      >
                        <Wine className="h-4 w-4 mr-2" />
                        View Full Recipe
                      </Button>
                      <Button variant="outline" onClick={(e) => {
                        e.stopPropagation();
                        handleShareCocktail(cocktail);
                      }}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Cocktail Detail Modal */}
          {selectedCocktail && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedCocktail(null)}>
              <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{selectedCocktail.name}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">{selectedCocktail.origin}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCocktail(null)}>×</Button>
                  </div>
                  <p className="text-gray-600">{selectedCocktail.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge className="bg-blue-100 text-blue-700">{selectedCocktail.era}</Badge>
                    <Badge className="bg-indigo-100 text-indigo-700">{selectedCocktail.category}</Badge>
                    <Badge className="bg-purple-100 text-purple-700">{selectedCocktail.difficulty}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Historical Note
                      </h4>
                      <p className="text-sm text-blue-800">{selectedCocktail.history}</p>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-500" />
                        Cocktail Stats
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">ABV</div>
                          <div className="text-xl font-bold text-blue-600">{selectedCocktail.abv}</div>
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Prep Time</div>
                          <div className="text-xl font-bold text-indigo-600">{selectedCocktail.prepTime} min</div>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Method</div>
                          <div className="text-xl font-bold text-purple-600">{selectedCocktail.method}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <GlassWater className="w-5 h-5 text-blue-500" />
                        Glassware & Garnish
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-gray-600">Glassware</div>
                          <div className="font-bold text-blue-600">{selectedCocktail.glassware}</div>
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-lg">
                          <div className="text-sm text-gray-600">Garnish</div>
                          <div className="font-bold text-indigo-600">{selectedCocktail.garnish}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-500" />
                        Ingredients
                      </h3>
                      <div className="space-y-2">
                        {selectedCocktail.ingredients.map((ingredient, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <Plus className="w-4 h-4 text-blue-500" />
                            <span className="text-sm">{ingredient}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <GlassWater className="w-5 h-5 text-blue-500" />
                        Flavor Profile
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCocktail.profile.map(trait => (
                          <Badge key={trait} className="bg-blue-100 text-blue-700 border-blue-300">
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-500" />
                        Instructions
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-700">{selectedCocktail.instructions}</p>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-500" />
                        Pro Tips
                      </h3>
                      <ul className="space-y-2 text-sm text-blue-900">
                        <li>• Always use fresh ice and pre-chill your glassware</li>
                        <li>• Quality ingredients make all the difference in classic cocktails</li>
                        <li>• Follow the specified method - stir or shake matters!</li>
                        <li>• Fresh citrus juice is essential - never use bottled</li>
                        <li>• Take your time with the preparation - classics deserve respect</li>
                      </ul>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {[...Array(5)].map((_, i) => (
                          <GlassWater
                            key={i}
                            className={`h-5 w-5 ${
                              i < Math.floor(selectedCocktail.rating)
                                ? 'fill-blue-500 text-blue-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="font-bold text-lg">{selectedCocktail.rating}</span>
                        <span className="text-gray-500">({selectedCocktail.reviews} reviews)</span>
                      </div>
                      <Badge variant="outline">{selectedCocktail.difficulty}</Badge>
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        onClick={() => handleMakeCocktail(selectedCocktail)}
                      >
                        <Wine className="w-4 h-4 mr-2" />
                        Make This Cocktail
                      </Button>
                      <Button variant="outline" size="icon">
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon">
                        <Camera className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <div className="fixed bottom-6 right-6 z-50">
          <Button 
            size="lg" 
            className="rounded-full w-14 h-14 bg-blue-600 hover:bg-blue-700 shadow-lg"
            onClick={() => setActiveTab('browse')}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Wine className="h-4 w-4 text-blue-600" />
                <span className="text-gray-600">Cocktails Found:</span>
                <span className="font-bold text-blue-600">{filteredCocktails.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <GlassWater className="h-4 w-4 text-indigo-500" />
                <span className="text-gray-600">Your Level:</span>
                <span className="font-bold text-indigo-600">{userProgress.level}</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" />
                <span className="text-gray-600">XP:</span>
                <span className="font-bold text-purple-600">{userProgress.totalPoints}</span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Back to Top
            </Button>
          </div>
        </div>
      </div>
    </RequireAgeGate>
  );
}
