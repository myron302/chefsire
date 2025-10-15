import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Heart, Star, Search, Share2, ArrowLeft, ArrowRight,
  Camera, Zap, Sparkles, X, Check, Crown, 
  Clipboard, RotateCcw, Wine, Flame, GlassWater,
  Clock, BookOpen, Target, ChefHat, Gem,
  Home, FlaskConical, Leaf, Apple, Martini, Droplets
} from 'lucide-react';
import { useDrinks } from "@/contexts/DrinksContext";
import UniversalSearch from '@/components/UniversalSearch';
import RecipeKit from '@/components/recipes/RecipeKit';
import RequireAgeGate from '@/components/RequireAgeGate';

// ---------- Helpers ----------
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// metric conversion for cocktails
const toMetric = (unit: string, amount: number) => {
  const mlPerOz = 30;
  switch (unit) {
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
    case 'dash': return { amount: Math.round(amount * 0.5), unit: 'ml' };
    default: return { amount, unit };
  }
};

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

// ---------- Navigation data ----------
const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'smoothies', name: 'All Smoothies', icon: Sparkles, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Flame, route: '/drinks', description: 'Browse everything' }
];

const cocktailSubcategories = [
  { id: 'vodka', name: 'Vodka Cocktails', icon: Droplets, route: '/drinks/potent-potables/vodka', description: 'Clean and versatile', color: 'from-cyan-500 to-blue-500' },
  { id: 'whiskey-bourbon', name: 'Whiskey & Bourbon', icon: Wine, route: '/drinks/potent-potables/whiskey-bourbon', description: 'Kentucky classics', color: 'from-amber-500 to-orange-500' },
  { id: 'tequila-mezcal', name: 'Tequila & Mezcal', icon: Flame, route: '/drinks/potent-potables/tequila-mezcal', description: 'Agave spirits', color: 'from-lime-500 to-green-500' },
  { id: 'rum', name: 'Rum Cocktails', icon: GlassWater, route: '/drinks/potent-potables/rum', description: 'Tropical vibes', color: 'from-orange-500 to-red-500' },
  { id: 'martinis', name: 'Martinis', icon: Martini, route: '/drinks/potent-potables/martinis', description: 'Elegant and timeless', color: 'from-purple-500 to-pink-500' }
];

// ---------- Classic Cocktails data WITH measured recipes ----------
const classicCocktails = [
  {
    id: 'classic-1',
    name: 'Old Fashioned',
    description: 'The grandfather of all cocktails, simple and timeless',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop',
    nutrition: { calories: 180, carbs: 8, sugar: 7 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 2341,
    trending: false,
    featured: true,
    tags: ['Whiskey', 'Classic', 'Strong', 'Spirit-forward'],
    ingredients: ['Bourbon or Rye whiskey', 'Sugar cube', 'Angostura bitters', 'Orange peel', 'Ice'],
    instructions: 'Muddle sugar cube with bitters and a splash of water in rocks glass. Add whiskey and large ice cube. Stir until chilled. Express orange peel oils over drink, then garnish.',
    benefits: ['Classic', 'Sophisticated', 'Timeless', 'Spirit-forward'],
    bestTime: 'Evening',
    cocktailType: 'Whiskey',
    era: '1880s',
    category: 'Spirit-forward',
    estimatedCost: 4.50,
    abv: '35%',
    glassware: 'Rocks glass',
    method: 'Stirred',
    recipe: {
      servings: 1,
      measurements: [
        m(2, 'oz', 'Bourbon or Rye whiskey'),
        m(1, '', 'sugar cube'),
        m(3, 'dashes', 'Angostura bitters'),
        m(1, '', 'orange peel'),
        m('As needed', '', 'ice')
      ],
      directions: [
        'Muddle sugar cube with bitters and a splash of water in rocks glass',
        'Add whiskey and large ice cube',
        'Stir until chilled (about 30 seconds)',
        'Express orange peel oils over drink, then garnish'
      ]
    }
  },
  {
    id: 'classic-2',
    name: 'Martini',
    description: 'The king of cocktails, gin and vermouth in perfect harmony',
    image: 'https://images.unsplash.com/photo-1570593729070-d9fa0d2fa0a9?w=400&h=300&fit=crop',
    nutrition: { calories: 160, carbs: 2, sugar: 0 },
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.7,
    reviews: 1876,
    trending: false,
    featured: true,
    tags: ['Gin', 'Elegant', 'Sophisticated', 'Dry'],
    ingredients: ['Gin', 'Dry vermouth', 'Lemon twist or olive', 'Ice'],
    instructions: 'Stir gin and vermouth with ice until very cold. Strain into chilled martini glass. Garnish with lemon twist or olive.',
    benefits: ['Elegant', 'Sophisticated', 'Classic', 'Dry'],
    bestTime: 'Evening',
    cocktailType: 'Gin',
    era: '1880s',
    category: 'Spirit-forward',
    estimatedCost: 4.20,
    abv: '28%',
    glassware: 'Martini glass',
    method: 'Stirred',
    recipe: {
      servings: 1,
      measurements: [
        m(2.5, 'oz', 'gin'),
        m(0.5, 'oz', 'dry vermouth'),
        m(1, '', 'lemon twist or olive'),
        m('As needed', '', 'ice')
      ],
      directions: [
        'Stir gin and vermouth with ice for 20-30 seconds',
        'Strain into chilled martini glass',
        'Garnish with lemon twist or olive'
      ]
    }
  },
  {
    id: 'classic-3',
    name: 'Manhattan',
    description: 'Sophisticated whiskey cocktail with sweet vermouth and bitters',
    nutrition: { calories: 210, carbs: 12, sugar: 10 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 1432,
    trending: false,
    featured: true,
    tags: ['Whiskey', 'Rich', 'Complex', 'Sweet'],
    ingredients: ['Rye whiskey', 'Sweet vermouth', 'Angostura bitters', 'Maraschino cherry'],
    instructions: 'Stir all ingredients with ice. Strain into chilled glass. Garnish with cherry.',
    benefits: ['Rich', 'Complex', 'Classic', 'Sweet'],
    bestTime: 'Evening',
    cocktailType: 'Whiskey',
    era: '1870s',
    category: 'Spirit-forward',
    estimatedCost: 4.80,
    abv: '30%',
    glassware: 'Coupe glass',
    method: 'Stirred',
    recipe: {
      servings: 1,
      measurements: [
        m(2, 'oz', 'rye whiskey'),
        m(1, 'oz', 'sweet vermouth'),
        m(2, 'dashes', 'Angostura bitters'),
        m(1, '', 'maraschino cherry')
      ],
      directions: [
        'Stir all ingredients with ice for 20-30 seconds',
        'Strain into chilled coupe glass',
        'Garnish with maraschino cherry'
      ]
    }
  },
  {
    id: 'classic-4',
    name: 'Negroni',
    description: 'Italian aperitif with gin, Campari, and sweet vermouth',
    nutrition: { calories: 190, carbs: 14, sugar: 12 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 1198,
    trending: true,
    featured: false,
    tags: ['Gin', 'Bitter', 'Aperitif', 'Italian'],
    ingredients: ['Gin', 'Campari', 'Sweet vermouth', 'Orange peel'],
    instructions: 'Stir all ingredients with ice in rocks glass. Garnish with orange peel.',
    benefits: ['Bitter', 'Aperitif', 'Italian', 'Complex'],
    bestTime: 'Pre-dinner',
    cocktailType: 'Gin',
    era: '1919',
    category: 'Aperitif',
    estimatedCost: 5.10,
    abv: '24%',
    glassware: 'Rocks glass',
    method: 'Stirred',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'oz', 'gin'),
        m(1, 'oz', 'Campari'),
        m(1, 'oz', 'sweet vermouth'),
        m(1, '', 'orange peel')
      ],
      directions: [
        'Stir all ingredients with ice in rocks glass',
        'Garnish with orange peel'
      ]
    }
  },
  {
    id: 'classic-5',
    name: 'Whiskey Sour',
    description: 'Perfect balance of whiskey, lemon, and sugar',
    nutrition: { calories: 220, carbs: 18, sugar: 16 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.4,
    reviews: 987,
    trending: false,
    featured: false,
    tags: ['Whiskey', 'Balanced', 'Refreshing', 'Sour'],
    ingredients: ['Bourbon whiskey', 'Fresh lemon juice', 'Simple syrup', 'Egg white (optional)', 'Ice'],
    instructions: 'Shake all ingredients with ice. Strain over fresh ice. Garnish with cherry and orange.',
    benefits: ['Balanced', 'Refreshing', 'Classic', 'Sour'],
    bestTime: 'Anytime',
    cocktailType: 'Whiskey',
    era: '1862',
    category: 'Sour',
    estimatedCost: 3.90,
    abv: '20%',
    glassware: 'Rocks glass',
    method: 'Shaken',
    recipe: {
      servings: 1,
      measurements: [
        m(2, 'oz', 'bourbon whiskey'),
        m(0.75, 'oz', 'fresh lemon juice'),
        m(0.75, 'oz', 'simple syrup'),
        m(1, '', 'egg white (optional)'),
        m('As needed', '', 'ice')
      ],
      directions: [
        'Shake all ingredients with ice for 10-15 seconds',
        'Strain over fresh ice in rocks glass',
        'Garnish with cherry and orange slice'
      ]
    }
  },
  {
    id: 'classic-6',
    name: 'Daiquiri',
    description: 'Cuban classic with rum, lime, and sugar',
    nutrition: { calories: 180, carbs: 15, sugar: 14 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.3,
    reviews: 756,
    trending: false,
    featured: false,
    tags: ['Rum', 'Tropical', 'Refreshing', 'Sour'],
    ingredients: ['White rum', 'Fresh lime juice', 'Simple syrup', 'Ice'],
    instructions: 'Shake all ingredients with ice. Double strain into chilled coupe glass.',
    benefits: ['Tropical', 'Refreshing', 'Classic', 'Sour'],
    bestTime: 'Summer',
    cocktailType: 'Rum',
    era: '1900',
    category: 'Sour',
    estimatedCost: 3.60,
    abv: '18%',
    glassware: 'Coupe glass',
    method: 'Shaken',
    recipe: {
      servings: 1,
      measurements: [
        m(2, 'oz', 'white rum'),
        m(1, 'oz', 'fresh lime juice'),
        m(0.75, 'oz', 'simple syrup'),
        m('As needed', '', 'ice')
      ],
      directions: [
        'Shake all ingredients with ice for 10-15 seconds',
        'Double strain into chilled coupe glass'
      ]
    }
  },
  {
    id: 'classic-7',
    name: 'Sazerac',
    description: 'New Orleans classic with rye whiskey and absinthe rinse',
    nutrition: { calories: 200, carbs: 6, sugar: 5 },
    difficulty: 'Hard',
    prepTime: 6,
    rating: 4.6,
    reviews: 445,
    trending: false,
    featured: true,
    tags: ['Whiskey', 'Complex', 'Herbal', 'New Orleans'],
    ingredients: ['Rye whiskey', 'Simple syrup', 'Peychauds bitters', 'Absinthe', 'Lemon peel'],
    instructions: 'Rinse glass with absinthe. Stir whiskey, syrup, and bitters with ice. Strain into glass. Express lemon peel.',
    benefits: ['Complex', 'Herbal', 'New Orleans', 'Sophisticated'],
    bestTime: 'Evening',
    cocktailType: 'Whiskey',
    era: '1850s',
    category: 'Spirit-forward',
    estimatedCost: 5.50,
    abv: '32%',
    glassware: 'Rocks glass',
    method: 'Stirred',
    recipe: {
      servings: 1,
      measurements: [
        m(2, 'oz', 'rye whiskey'),
        m(0.25, 'oz', 'simple syrup'),
        m(4, 'dashes', 'Peychauds bitters'),
        m(1, 'rinse', 'absinthe'),
        m(1, '', 'lemon peel')
      ],
      directions: [
        'Rinse chilled rocks glass with absinthe',
        'Stir whiskey, syrup, and bitters with ice for 20-30 seconds',
        'Strain into prepared glass',
        'Express lemon peel over drink'
      ]
    }
  },
  {
    id: 'classic-8',
    name: 'Mint Julep',
    description: 'Kentucky Derby tradition with bourbon and fresh mint',
    nutrition: { calories: 210, carbs: 10, sugar: 9 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.2,
    reviews: 623,
    trending: false,
    featured: false,
    tags: ['Whiskey', 'Refreshing', 'Southern', 'Minty'],
    ingredients: ['Bourbon whiskey', 'Simple syrup', 'Fresh mint leaves', 'Crushed ice', 'Mint sprig'],
    instructions: 'Gently muddle mint with syrup. Add bourbon and crushed ice. Stir until frosted. Garnish with mint sprig.',
    benefits: ['Refreshing', 'Southern', 'Minty', 'Classic'],
    bestTime: 'Summer',
    cocktailType: 'Whiskey',
    era: '1800s',
    category: 'Refreshing',
    estimatedCost: 4.30,
    abv: '25%',
    glassware: 'Julep cup',
    method: 'Muddled',
    recipe: {
      servings: 1,
      measurements: [
        m(2.5, 'oz', 'bourbon whiskey'),
        m(0.5, 'oz', 'simple syrup'),
        m(8, 'leaves', 'fresh mint'),
        m('As needed', '', 'crushed ice'),
        m(1, 'sprig', 'mint')
      ],
      directions: [
        'Gently muddle mint leaves with simple syrup',
        'Add bourbon and fill with crushed ice',
        'Stir until glass is frosted',
        'Garnish with mint sprig'
      ]
    }
  }
];

// ---------- Filters ----------
const cocktailTypes = [
  { id: 'whiskey', name: 'Whiskey', icon: Wine, count: 4, color: 'text-amber-600' },
  { id: 'gin', name: 'Gin', icon: Droplets, count: 2, color: 'text-green-600' },
  { id: 'rum', name: 'Rum', icon: GlassWater, count: 1, color: 'text-orange-600' }
];

const cocktailEras = [
  { id: '1850s', name: 'Golden Age (1850s-1880s)', icon: Crown, count: 3, color: 'text-yellow-600' },
  { id: '1900s', name: 'Pre-Prohibition (1900s-1920s)', icon: BookOpen, count: 3, color: 'text-purple-600' },
  { id: '1920s', name: 'Prohibition Era (1920s-1933)', icon: Gem, count: 2, color: 'text-red-600' }
];

const cocktailAdvantages = [
  { icon: Crown, title: 'Timeless Recipes', description: 'Proven classics that never go out of style' },
  { icon: Star, title: 'Craftsmanship', description: 'Perfect your mixology skills with fundamentals' },
  { icon: BookOpen, title: 'Rich History', description: 'Each cocktail has a story and tradition' },
  { icon: Target, title: 'Perfect Balance', description: 'Master the art of flavor harmony' },
  { icon: ChefHat, title: 'Professional Techniques', description: 'Learn proper mixing methods' },
  { icon: Gem, title: 'Sophistication', description: 'Elevate your home bartending game' }
];

// ---------- Component ----------
export default function ClassicCocktailsPage() {
  const {
    addToFavorites,
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState<'browse' | 'types' | 'eras' | 'featured'>('browse');
  const [selectedType, setSelectedType] = useState('');
  const [selectedEra, setSelectedEra] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'abv' | 'calories' | 'time'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  // RecipeKit controlled modal
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);

  // per-card Metric toggle for inline preview
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // per-card servings (inline preview)
  const [servingsById, setServingsById] = useState<Record<string, number>>({});

  const handleSharePage = async () => {
    const shareData = {
      title: 'Classic Cocktails',
      text: 'Explore timeless cocktail recipes with rich history and perfect balance.',
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

  const handleShareCocktail = async (cocktail: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);
    const preview = (cocktail?.recipe?.measurements || [])
      .slice(0, 4)
      .map((r: Measured) => {
        const scaled =
          typeof r.amount === 'number'
            ? `${scaleAmount(r.amount, servings)} ${r.unit}`
            : `${r.amount} ${r.unit}`;
        return `${scaled} ${r.item}`;
      })
      .join(' · ');
    const text = `${cocktail.name} • ${cocktail.cocktailType} • ${cocktail.abv} ABV\n${preview || (cocktail.ingredients?.slice(0,4)?.join(', ') ?? '')}`;
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
      const drinkData = {
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: 'potent-potables' as const,
        description: `${selectedRecipe.cocktailType || ''} • ${selectedRecipe.abv || ''} ABV`,
        ingredients: selectedRecipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || selectedRecipe.ingredients,
        nutrition: selectedRecipe.nutrition,
        difficulty: selectedRecipe.difficulty as 'Easy' | 'Medium' | 'Hard',
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        tags: selectedRecipe.tags
      };
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(30); // +30 XP for cocktails
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  // Filter and sort
  const filteredCocktails = useMemo(() => {
    let filtered = classicCocktails.filter(cocktail => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        cocktail.name.toLowerCase().includes(q) ||
        cocktail.description.toLowerCase().includes(q) ||
        (cocktail.ingredients || []).some((ing: string) => ing.toLowerCase().includes(q));
      const matchesType = !selectedType || cocktail.cocktailType.toLowerCase().includes(selectedType.toLowerCase());
      const matchesEra = !selectedEra || cocktail.era.includes(selectedEra);
      return matchesSearch && matchesType && matchesEra;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'abv': return parseFloat(b.abv) - parseFloat(a.abv);
        case 'calories': return (a.nutrition?.calories || 0) - (b.nutrition?.calories || 0);
        case 'time': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  }, [searchQuery, selectedType, selectedEra, sortBy]);

  const featuredCocktails = useMemo(() => 
    classicCocktails.filter(cocktail => cocktail.featured), 
  []);

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-violet-50 to-pink-50">
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

        {/* RecipeKit modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="purple"
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
                <Link href="/drinks/potent-potables">
                  <Button variant="ghost" size="sm" className="text-gray-500">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Potent Potables
                  </Button>
                </Link>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-2">
                  <Crown className="h-6 w-6 text-purple-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Classic Cocktails</h1>
                  <Badge className="bg-purple-100 text-purple-800">Timeless</Badge>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => setShowUniversalSearch(true)}>
                  <Search className="h-4 w-4 mr-2" />
                  Universal Search
                </Button>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span>Level {userProgress.level}</span>
                  <div className="w-px h-4 bg-gray-300" />
                  <span>{userProgress.totalPoints} XP</span>
                </div>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={handleSharePage}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Page
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Cross-Hub Navigation */}
          <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {otherDrinkHubs.map((hub) => {
                  const Icon = hub.icon;
                  return (
                    <Link key={hub.id} href={hub.route}>
                      <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                        <Icon className="h-4 w-4 mr-2 text-purple-600" />
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

          {/* Sister Subpages Navigation */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Cocktail Types</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {cocktailSubcategories.map((subcategory) => {
                  const Icon = subcategory.icon;
                  return (
                    <Link key={subcategory.id} href={subcategory.route}>
                      <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                        <Icon className="h-4 w-4 mr-2 text-purple-600" />
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

          {/* Cocktail Advantages */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Crown className="h-6 w-6 text-purple-600" />
                Why Classic Cocktails?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cocktailAdvantages.map((advantage, index) => {
                  const Icon = advantage.icon;
                  return (
                    <div key={index} className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow">
                      <Icon className="h-6 w-6 text-purple-500 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold mb-1">{advantage.title}</h3>
                        <p className="text-sm text-gray-600">{advantage.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-purple-600">26%</div><div className="text-sm text-gray-600">Avg ABV</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-purple-600">4.7★</div><div className="text-sm text-gray-600">Avg Rating</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-purple-600">4 min</div><div className="text-sm text-gray-600">Avg Prep</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-purple-600">{classicCocktails.length}</div><div className="text-sm text-gray-600">Recipes</div></CardContent></Card>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'browse', label: 'Browse All', icon: Search },
              { id: 'types', label: 'Spirit Types', icon: Wine },
              { id: 'eras', label: 'Historical Eras', icon: BookOpen },
              { id: 'featured', label: 'Featured', icon: Star }
            ].map(tab => {
              const Icon = tab.icon;
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
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                  >
                    <option value="">All Spirits</option>
                    {cocktailTypes.map(type => (
                      <option key={type.id} value={type.name}>{type.name}</option>
                    ))}
                  </select>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={selectedEra}
                    onChange={(e) => setSelectedEra(e.target.value)}
                  >
                    <option value="">All Eras</option>
                    {cocktailEras.map(era => (
                      <option key={era.id} value={era.id}>{era.name}</option>
                    ))}
                  </select>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <option value="rating">Sort by Rating</option>
                    <option value="abv">Sort by ABV</option>
                    <option value="calories">Sort by Calories</option>
                    <option value="time">Sort by Prep Time</option>
                  </select>
                </div>
              </div>

              {/* Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCocktails.map(cocktail => {
                  const useMetric = !!metricFlags[cocktail.id];
                  const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);

                  return (
                    <Card key={cocktail.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-1">{cocktail.name}</CardTitle>
                            <p className="text-sm text-gray-600 mb-2">{cocktail.description}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const drinkData = {
                                id: cocktail.id,
                                name: cocktail.name,
                                category: 'potent-potables' as const,
                                description: `${cocktail.cocktailType} • ${cocktail.abv} ABV`,
                                ingredients: cocktail.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || cocktail.ingredients,
                                nutrition: cocktail.nutrition,
                                difficulty: cocktail.difficulty as 'Easy' | 'Medium' | 'Hard',
                                prepTime: cocktail.prepTime,
                                rating: cocktail.rating,
                                tags: cocktail.tags,
                              };
                              addToFavorites(drinkData);
                            }}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Heart className={`h-4 w-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{cocktail.cocktailType}</Badge>
                          <Badge className="bg-purple-100 text-purple-800">{cocktail.era}</Badge>
                          {cocktail.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                        </div>
                      </CardHeader>

                      <CardContent>
                        {/* Nutrition Grid */}
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                          <div>
                            <div className="font-bold text-purple-600">{cocktail.abv}</div>
                            <div className="text-gray-500">ABV</div>
                          </div>
                          <div>
                            <div className="font-bold text-purple-600">{cocktail.nutrition?.calories ?? '—'}</div>
                            <div className="text-gray-500">Calories</div>
                          </div>
                          <div>
                            <div className="font-bold text-purple-600">{cocktail.prepTime}min</div>
                            <div className="text-gray-500">Prep</div>
                          </div>
                        </div>

                        {/* Key Info */}
                        <div className="space-y-2 mb-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Glassware:</span>
                            <span className="font-medium">{cocktail.glassware}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Method:</span>
                            <span className="font-medium">{cocktail.method}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Best Time:</span>
                            <span className="font-medium text-xs">{cocktail.bestTime}</span>
                          </div>
                        </div>

                        {/* Rating / Difficulty */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="font-medium">{cocktail.rating}</span>
                            <span className="text-gray-500 text-sm">({cocktail.reviews})</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {cocktail.difficulty}
                          </Badge>
                        </div>

                        {/* Compact measured recipe preview */}
                        {cocktail.recipe?.measurements && (
                          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-semibold text-gray-900">
                                Recipe (serves {servings})
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  className="px-2 py-1 border rounded text-sm"
                                  onClick={() =>
                                    setServingsById(prev => ({ ...prev, [cocktail.id]: clamp((prev[cocktail.id] ?? (cocktail.recipe?.servings || 1)) - 1) }))
                                  }
                                  aria-label="decrease servings"
                                >
                                  −
                                </button>
                                <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                                <button
                                  className="px-2 py-1 border rounded text-sm"
                                  onClick={() =>
                                    setServingsById(prev => ({ ...prev, [cocktail.id]: clamp((prev[cocktail.id] ?? (cocktail.recipe?.servings || 1)) + 1) }))
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
                                    next[cocktail.id] = cocktail.recipe?.servings || 1;
                                    return next;
                                  })}
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
                                  ? toMetric(ing.unit, Number((typeof ing.amount === 'number' ? (ing.amount as number) : parseFloat(String(ing.amount))) * servings))
                                  : { amount: scaledDisplay, unit: ing.unit };

                                return (
                                  <li key={i} className="flex items-start gap-2">
                                    <Check className="h-4 w-4 text-purple-600 mt-0.5" />
                                    <span>
                                      <span className="text-purple-700 font-semibold">
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
                                    onClick={() => openRecipeModal(cocktail)}
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
                                  const lines = (cocktail.recipe?.measurements || []).map((ing: Measured) => {
                                    if (useMetric && typeof ing.amount === 'number') {
                                      const mm = toMetric(ing.unit, Number(ing.amount) * servings);
                                      return `- ${mm.amount} ${mm.unit} ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                                    }
                                    const scaled = typeof ing.amount === 'number' ? scaleAmount(ing.amount, servings) : ing.amount;
                                    return `- ${scaled} ${ing.unit} ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                                  });
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
                              <Button variant="outline" size="sm" onClick={() => handleShareCocktail(cocktail, servings)}>
                                <Share2 className="w-4 h-4 mr-1" /> Share
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setMetricFlags((prev) => ({ ...prev, [cocktail.id]: !prev[cocktail.id] }))
                                }
                              >
                                {useMetric ? 'US' : 'Metric'}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mb-4">
                          {cocktail.tags.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-200">
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        {/* Make Cocktail Button */}
                        <div className="mt-3">
                          <Button
                            className="w-full bg-purple-600 hover:bg-purple-700"
                            onClick={() => openRecipeModal(cocktail)}
                          >
                            <GlassWater className="h-4 w-4 mr-2" />
                            Make Cocktail (+30 XP)
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spirit Types Tab */}
          {activeTab === 'types' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cocktailTypes.map(type => {
                const Icon = type.icon;
                const typeCocktails = classicCocktails.filter(cocktail =>
                  cocktail.cocktailType.toLowerCase().includes(type.id)
                );

                return (
                  <Card key={type.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Icon className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{type.name}</CardTitle>
                          <div className="text-sm text-gray-600">{typeCocktails.length} recipes</div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600 mb-1">
                          {typeCocktails.length}
                        </div>
                        <div className="text-sm text-gray-600 mb-3">Classic Recipes</div>
                        <Button
                          className="w-full"
                          onClick={() => {
                            setSelectedType(type.name);
                            setActiveTab('browse');
                          }}
                        >
                          View {type.name} Cocktails
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Eras Tab */}
          {activeTab === 'eras' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cocktailEras.map(era => {
                const Icon = era.icon;
                const eraCocktails = classicCocktails.filter(cocktail =>
                  cocktail.era.includes(era.id)
                );

                return (
                  <Card key={era.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${era.color.replace('text-', 'bg-').replace('-600', '-100')}`}>
                          <Icon className={`h-6 w-6 ${era.color}`} />
                        </div>
                        <CardTitle className="text-lg">{era.name}</CardTitle>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${era.color} mb-1`}>
                          {eraCocktails.length}
                        </div>
                        <div className="text-sm text-gray-600 mb-4">Historical Recipes</div>
                        <Button
                          className="w-full"
                          onClick={() => {
                            setSelectedEra(era.id);
                            setActiveTab('browse');
                          }}
                        >
                          View {era.name} Cocktails
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
              {featuredCocktails.map(cocktail => {
                const useMetric = !!metricFlags[cocktail.id];
                const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);

                return (
                  <Card key={cocktail.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                    <div className="relative">
                      {cocktail.image && (
                        <img
                          src={cocktail.image}
                          alt={cocktail.name}
                          className="w-full h-48 object-cover"
                        />
                      )}
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-yellow-500 text-white">Featured</Badge>
                      </div>
                      <div className="absolute top-4 right-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const drinkData = {
                              id: cocktail.id,
                              name: cocktail.name,
                              category: 'potent-potables' as const,
                              description: `${cocktail.cocktailType} • ${cocktail.abv} ABV`,
                              ingredients: cocktail.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || cocktail.ingredients,
                              nutrition: cocktail.nutrition,
                              difficulty: cocktail.difficulty as 'Easy' | 'Medium' | 'Hard',
                              prepTime: cocktail.prepTime,
                              rating: cocktail.rating,
                              tags: cocktail.tags,
                            };
                            addToFavorites(drinkData);
                          }}
                          className="bg-white/80 hover:bg-white text-gray-600 hover:text-red-500"
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                        </Button>
                      </div>
                    </div>

                    <CardHeader>
                      <CardTitle className="text-xl">{cocktail.name}</CardTitle>
                      <p className="text-gray-600">{cocktail.description}</p>

                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{cocktail.cocktailType}</Badge>
                        <Badge className="bg-purple-100 text-purple-800">{cocktail.era}</Badge>
                        <div className="flex items-center gap-1 ml-auto">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{cocktail.rating}</span>
                          <span className="text-gray-500 text-sm">({cocktail.reviews})</span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Enhanced info display */}
                      <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                        <div className="text-center">
                          <div className="text-xl font-bold text-purple-600">{cocktail.abv}</div>
                          <div className="text-xs text-gray-600">ABV</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600">{cocktail.nutrition?.calories ?? '—'}</div>
                          <div className="text-xs text-gray-600">Calories</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-purple-600">{cocktail.glassware}</div>
                          <div className="text-xs text-gray-600">Glass</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-orange-600">{cocktail.prepTime}min</div>
                          <div className="text-xs text-gray-600">Prep</div>
                        </div>
                      </div>

                      {/* Detailed info */}
                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Method:</span>
                          <span className="font-medium">{cocktail.method}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Best Time:</span>
                          <span className="font-medium">{cocktail.bestTime}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Historical Era:</span>
                          <span className="font-medium">{cocktail.era}</span>
                        </div>
                      </div>

                      {/* Compact measured recipe preview */}
                      {cocktail.recipe?.measurements && (
                        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-900">
                              Recipe (serves {servings})
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [cocktail.id]: clamp((prev[cocktail.id] ?? (cocktail.recipe?.servings || 1)) - 1) }))
                                }
                                aria-label="decrease servings"
                              >
                                −
                              </button>
                              <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [cocktail.id]: clamp((prev[cocktail.id] ?? (cocktail.recipe?.servings || 1)) + 1) }))
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
                                  next[cocktail.id] = cocktail.recipe?.servings || 1;
                                  return next;
                                })}
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
                                ? toMetric(ing.unit, Number((typeof ing.amount === 'number' ? (ing.amount as number) : parseFloat(String(ing.amount))) * servings))
                                : { amount: scaledDisplay, unit: ing.unit };

                              return (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-purple-600 mt-0.5" />
                                  <span>
                                    <span className="text-purple-700 font-semibold">
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
                                  onClick={() => openRecipeModal(cocktail)}
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
                                const lines = (cocktail.recipe?.measurements || []).map((ing: Measured) => {
                                  if (useMetric && typeof ing.amount === 'number') {
                                    const mm = toMetric(ing.unit, Number(ing.amount) * servings);
                                    return `- ${mm.amount} ${mm.unit} ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                                  }
                                  const scaled = typeof ing.amount === 'number' ? scaleAmount(ing.amount, servings) : ing.amount;
                                  return `- ${scaled} ${ing.unit} ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                                });
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
                            <Button variant="outline" size="sm" onClick={() => handleShareCocktail(cocktail, servings)}>
                              <Share2 className="w-4 h-4 mr-1" /> Share
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setMetricFlags((prev) => ({ ...prev, [cocktail.id]: !prev[cocktail.id] }))
                              }
                            >
                              {useMetric ? 'US' : 'Metric'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {cocktail.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-200">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      {/* Action button */}
                      <div className="mt-3">
                        <Button
                          className="w-full bg-purple-600 hover:bg-purple-700"
                          onClick={() => openRecipeModal(cocktail)}
                        >
                          <GlassWater className="h-4 w-4 mr-2" />
                          Make This Cocktail (+30 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Your Progress */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 mt-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-purple-600">
                      Level {userProgress.level}
                    </Badge>
                    <Badge variant="outline" className="text-purple-600">
                      {userProgress.totalPoints} XP
                    </Badge>
                    <Badge variant="outline" className="text-purple-600">
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
    </RequireAgeGate>
  );
}
