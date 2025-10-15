import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Heart, Star, Search, Share2, ArrowLeft,
  Camera, Zap, Sparkles, X, Check, Crown, 
  Clipboard, RotateCcw, Wine, Flame, 
  GlassWater, BookOpen, Gem, Target, ChefHat
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

// metric conversion for cocktails
const toMetric = (unit: string, amount: number) => {
  const mlPerOz = 30;
  switch (unit) {
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
    case 'dash': return { amount: Math.round(amount * 0.5), unit: 'ml' };
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

  // Handle notes like "(optional)"
  if (item.includes('(optional)')) {
    item = item.replace('(optional)', '').trim();
    return m(amount, unit, item, 'optional');
  }
  
  return m(amount, unit, item);
};

// Enhanced classic cocktails data with proper measurements
const classicCocktails = [
  {
    id: 'classic-1',
    name: 'Old Fashioned',
    description: 'The grandfather of all cocktails, simple and timeless',
    ingredients: [
      '2 oz Bourbon or Rye whiskey',
      '1 sugar cube', 
      '2-3 dashes Angostura bitters',
      '1 Orange peel',
      'As needed Ice'
    ],
    benefits: ['Classic', 'Sophisticated', 'Timeless', 'Spirit-forward'],
    nutrition: { calories: 180, carbs: 8, sugar: 7, added_sugar: 7 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 2341,
    cocktailType: 'Whiskey',
    era: '1880s',
    category: 'Spirit-forward',
    featured: true,
    trending: true,
    bestTime: 'Evening',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop',
    estimatedCost: 4.50,
    abv: '35%',
    glassware: 'Rocks glass',
    method: 'Stirred'
  },
  {
    id: 'classic-2',
    name: 'Martini',
    description: 'The king of cocktails, gin and vermouth in perfect harmony',
    ingredients: [
      '2.5 oz Gin',
      '0.5 oz Dry vermouth',
      '1 Lemon twist or olive',
      'As needed Ice'
    ],
    benefits: ['Elegant', 'Sophisticated', 'Classic', 'Dry'],
    nutrition: { calories: 160, carbs: 2, sugar: 0, added_sugar: 0 },
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.7,
    reviews: 1876,
    cocktailType: 'Gin',
    era: '1880s',
    category: 'Spirit-forward',
    featured: true,
    bestTime: 'Evening',
    image: 'https://images.unsplash.com/photo-1570593729070-d9fa0d2fa0a9?w=400&h=300&fit=crop',
    estimatedCost: 4.20,
    abv: '28%',
    glassware: 'Martini glass',
    method: 'Stirred'
  },
  {
    id: 'classic-3',
    name: 'Manhattan',
    description: 'Sophisticated whiskey cocktail with sweet vermouth and bitters',
    ingredients: [
      '2 oz Rye whiskey',
      '1 oz Sweet vermouth',
      '2 dashes Angostura bitters',
      '1 Maraschino cherry'
    ],
    benefits: ['Rich', 'Complex', 'Classic', 'Sweet'],
    nutrition: { calories: 210, carbs: 12, sugar: 10, added_sugar: 8 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 1432,
    cocktailType: 'Whiskey',
    era: '1870s',
    category: 'Spirit-forward',
    featured: true,
    bestTime: 'Evening',
    estimatedCost: 4.80,
    abv: '30%',
    glassware: 'Coupe glass',
    method: 'Stirred'
  }
];

const cocktailTypes = [
  { id: 'whiskey', name: 'Whiskey', description: 'Bourbon, rye, and scottch classics' },
  { id: 'gin', name: 'Gin', description: 'Botanical and juniper-forward' },
  { id: 'rum', name: 'Rum', description: 'Tropical and Caribbean classics' }
];

const cocktailEras = [
  { id: '1850s', name: 'Golden Age (1850s-1880s)', description: 'Birth of the cocktail era' },
  { id: '1900s', name: 'Pre-Prohibition (1900s-1920s)', description: 'Cocktail refinement period' },
  { id: '1920s', name: 'Prohibition Era (1920s-1933)', description: 'Hidden speakeasy culture' }
];

const cocktailCategories = [
  { id: 'spirit-forward', name: 'Spirit-Forward', description: 'Strong cocktails with minimal mixers' },
  { id: 'sour', name: 'Sours', description: 'Balance of spirit, citrus, and sweetener' },
  { id: 'aperitif', name: 'Aperitifs', description: 'Pre-dinner appetite stimulants' }
];

// ---------- Cross-nav - Top Level Drink Categories ----------
const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'smoothies', name: 'All Smoothies', icon: Sparkles, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Flame, route: '/drinks', description: 'Browse everything' }
];

// Sister cocktail subcategories (excluding classic since we're on classic page)
const allCocktailSubcategories = [
  { id: 'vodka', name: 'Vodka', path: '/drinks/potent-potables/vodka', icon: GlassWater, description: 'Clean and versatile' },
  { id: 'whiskey-bourbon', name: 'Whiskey & Bourbon', path: '/drinks/potent-potables/whiskey-bourbon', icon: Wine, description: 'Kentucky classics' },
  { id: 'tequila-mezcal', name: 'Tequila & Mezcal', path: '/drinks/potent-potables/tequila-mezcal', icon: Flame, description: 'Agave spirits' },
  { id: 'rum', name: 'Rum', path: '/drinks/potent-potables/rum', icon: GlassWater, description: 'Tropical vibes' }
];

const cocktailAdvantages = [
  { icon: Crown, title: 'Timeless Recipes', description: 'Proven classics that never go out of style', color: 'text-purple-400' },
  { icon: Star, title: 'Craftsmanship', description: 'Perfect your mixology skills with fundamentals', color: 'text-purple-400' },
  { icon: BookOpen, title: 'Rich History', description: 'Each cocktail has a story and tradition', color: 'text-purple-400' },
  { icon: Target, title: 'Perfect Balance', description: 'Master the art of flavor harmony', color: 'text-purple-400' },
  { icon: ChefHat, title: 'Professional Techniques', description: 'Learn proper mixing methods', color: 'text-purple-400' },
  { icon: Gem, title: 'Sophistication', description: 'Elevate your home bartending game', color: 'text-purple-400' }
];

export default function ClassicCocktailsPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCocktailType, setSelectedCocktailType] = useState('');
  const [selectedEra, setSelectedEra] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [maxCalories, setMaxCalories] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'abv' | 'cost' | 'calories'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'cocktail-types'|'eras'|'featured'|'trending'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert cocktails to RecipeKit format with robust parsing
  const cocktailRecipesWithMeasurements = useMemo(() => {
    return classicCocktails.map((cocktail) => {
      const rawList = Array.isArray(cocktail.ingredients) ? cocktail.ingredients : [];
      
      // Normalize everything to { amount, unit, item, note }
      const measurements = rawList.map((ing: any) => {
        if (typeof ing === 'string') return parseIngredient(ing);
        // If already measured object, keep as-is
        const { amount = 1, unit = 'item', item = '', note = '' } = ing || {};
        return { amount, unit, item, note };
      });

      return {
        ...cocktail,
        recipe: {
          servings: 1,
          measurements,
          directions: [
            'Chill your glassware first',
            'Measure all ingredients precisely',
            cocktail.method === 'Shaken' ? 'Add all ingredients to shaker with ice' : 'Add all ingredients to mixing glass with ice',
            cocktail.method === 'Shaken' ? 'Shake vigorously for 10-15 seconds' : 'Stir gently for 20-30 seconds',
            'Strain into prepared glass',
            'Add garnish and serve immediately'
          ]
        }
      };
    });
  }, []);

  const handleShareCocktail = async (cocktail: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);
    const preview = cocktail.ingredients.slice(0, 4).join(' • ');
    const text = `${cocktail.name} • ${cocktail.cocktailType} • ${cocktail.abv} ABV\n${preview}${cocktail.ingredients.length > 4 ? ` …plus ${cocktail.ingredients.length - 4} more` : ''}`;
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
      addPoints(30); // +30 XP for cocktails per specification
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredCocktails = () => {
    let filtered = cocktailRecipesWithMeasurements.filter(cocktail => {
      const matchesSearch = cocktail.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           cocktail.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedCocktailType || cocktail.cocktailType === selectedCocktailType;
      const matchesEra = !selectedEra || cocktail.era.includes(selectedEra);
      const matchesCategory = !selectedCategory || cocktail.category === selectedCategory;
      const matchesCalories = maxCalories === 'all' || cocktail.nutrition.calories <= maxCalories;
      return matchesSearch && matchesType && matchesEra && matchesCategory && matchesCalories;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'abv': return parseFloat(b.abv) - parseFloat(a.abv);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredCocktails = getFilteredCocktails();
  const featuredCocktails = cocktailRecipesWithMeasurements.filter(c => c.featured);
  const trendingCocktails = cocktailRecipesWithMeasurements.filter(c => c.trending);

  // Share page handler
  const handleSharePage = async () => {
    const shareData = {
      title: 'Classic Cocktails',
      text: `Browse ${classicCocktails.length} timeless cocktail recipes with rich history and perfect balance.`,
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

        {/* RecipeKit Modal */}
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
                  <Crown className="h-6 w-6 text-purple-500" />
                  <h1 className="text-2xl font-bold text-gray-900">Classic Cocktails</h1>
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">Timeless</Badge>
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
                <Button size="sm" className="bg-purple-500 hover:bg-purple-600 text-white" onClick={handleSharePage}>
                  <Camera className="h-4 w-4 mr-2" />
                  Share Page
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          
          {/* CROSS-HUB NAVIGATION - Top Level Drink Categories */}
          <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
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

          {/* SISTER SUBPAGES NAVIGATION - ALL COCKTAIL TYPES (No Classic) */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Cocktail Types</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {allCocktailSubcategories.map((subcategory) => {
                  const Icon = subcategory.icon;
                  return (
                    <Link key={subcategory.id} href={subcategory.path}>
                      <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                        <Icon className="h-4 w-4 mr-2 text-purple-500" />
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

          {/* Cocktail Advantages */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Crown className="h-6 w-6 text-purple-500" />
                Why Classic Cocktails?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cocktailAdvantages.map((advantage, index) => {
                  const Icon = advantage.icon;
                  return (
                    <div key={index} className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow">
                      <Icon className={`h-6 w-6 text-purple-500 flex-shrink-0`} />
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

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-500">26%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-500">4.7★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-500">4 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-500">{classicCocktails.length}</div>
                <div className="text-sm text-gray-600">Recipes</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'browse', label: 'Browse All', icon: Search },
              { id: 'cocktail-types', label: 'Spirit Types', icon: Wine },
              { id: 'eras', label: 'Historical Eras', icon: BookOpen },
              { id: 'featured', label: 'Featured', icon: Crown },
              { id: 'trending', label: 'Trending', icon: Flame }
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

          {activeTab === 'browse' && (
            <div className="space-y-6">
              {/* Search and Filters */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search classic cocktails..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <select 
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        value={selectedCocktailType}
                        onChange={(e) => setSelectedCocktailType(e.target.value)}
                      >
                        <option value="">All Spirit Types</option>
                        {cocktailTypes.map(type => (
                          <option key={type.id} value={type.name}>{type.name}</option>
                        ))}
                      </select>

                      <select 
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        value={selectedEra}
                        onChange={(e) => setSelectedEra(e.target.value)}
                      >
                        <option value="">All Eras</option>
                        {cocktailEras.map(era => (
                          <option key={era.id} value={era.id}>{era.name}</option>
                        ))}
                      </select>

                      <select 
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      >
                        <option value="">All Categories</option>
                        {cocktailCategories.map(category => (
                          <option key={category.id} value={category.id}>{category.name}</option>
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
                        <option value={150}>Under 150 cal</option>
                        <option value={200}>Under 200 cal</option>
                        <option value={250}>Under 250 cal</option>
                      </select>

                      <select 
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                      >
                        <option value="rating">Sort by Rating</option>
                        <option value="abv">Sort by ABV</option>
                        <option value="cost">Sort by Cost</option>
                        <option value="calories">Sort by Calories</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cocktail Grid */}
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
                            onClick={() => addToFavorites({
                              id: cocktail.id,
                              name: cocktail.name,
                              category: 'potent-potables',
                              description: cocktail.description,
                              ingredients: cocktail.ingredients,
                              nutrition: cocktail.nutrition,
                              difficulty: cocktail.difficulty,
                              prepTime: cocktail.prepTime,
                              rating: cocktail.rating,
                              bestTime: cocktail.bestTime,
                              tags: cocktail.benefits
                            })}
                          >
                            <Heart className={`h-4 w-4 ${isFavorite(cocktail.id) ? 'fill-purple-500 text-purple-500' : 'text-gray-400'}`} />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200">{cocktail.cocktailType}</Badge>
                          <Badge variant="outline" className="text-xs">{cocktail.era}</Badge>
                          {cocktail.trending && <Badge className="bg-purple-100 text-purple-800">Trending</Badge>}
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        {/* Nutrition Grid */}
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                          <div>
                            <div className="font-bold text-purple-500">{cocktail.abv}</div>
                            <div className="text-gray-500">ABV</div>
                          </div>
                          <div>
                            <div className="font-bold text-purple-500">{cocktail.nutrition.calories}</div>
                            <div className="text-gray-500">Calories</div>
                          </div>
                          <div>
                            <div className="font-bold text-purple-500">{cocktail.prepTime}m</div>
                            <div className="text-gray-500">Prep</div>
                          </div>
                        </div>

                        {/* RATING & DIFFICULTY - Immediately above recipe card */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="font-medium">{cocktail.rating}</span>
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
                              <Button variant="outline" size="sm" onClick={() => handleShareCocktail(cocktail, servings)}>
                                <Share2 className="w-4 h-4 mr-1" /> Share
                              </Button>
                              {/* Metric Button */}
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

                        {/* Glassware & Method */}
                        <div className="space-y-2 mb-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Glassware:</span>
                            <span className="font-medium text-purple-500">{cocktail.glassware}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Method:</span>
                            <span className="font-medium text-purple-500">{cocktail.method}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Best Time:</span>
                            <span className="font-medium text-purple-500">{cocktail.bestTime}</span>
                          </div>
                        </div>

                        {/* Benefits Tags */}
                        <div className="flex flex-wrap gap-1 mb-4">
                          {cocktail.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200">
                              {benefit}
                            </Badge>
                          ))}
                        </div>

                        {/* Make Cocktail Button */}
                        <div className="mt-3">
                          <Button 
                            className="w-full bg-purple-500 hover:bg-purple-600 text-white"
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

          {/* Your Progress */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-purple-500">
                      Level {userProgress.level}
                    </Badge>
                    <Badge variant="outline" className="text-purple-500">
                      {userProgress.totalPoints} XP
                    </Badge>
                    <Badge variant="outline" className="text-purple-500">
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
