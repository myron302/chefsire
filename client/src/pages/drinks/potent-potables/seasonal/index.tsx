import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { Snowflake, Sun, Leaf, Flower2, Clock, Heart, Target, Sparkles, Wine, Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater, TrendingUp, Award, Cherry, Cloud, Zap, Home, Droplets, Apple, Martini, Crown, Clipboard, RotateCcw, Check, Coffee } from "lucide-react";
import { useDrinks } from '@/contexts/DrinksContext';
import RecipeKit from '@/components/recipes/RecipeKit';
import { seasonalCocktails } from "@/data/drinks/potent-potables/seasonal";
import { resolveCanonicalDrinkSlug } from '@/data/drinks/canonical';

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
    case 'tsp': return { amount: Math.round(amount * 5), unit: 'ml' };
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

  const descriptors = new Set(['bourbon', 'fresh', 'vodka', 'vanilla', 'blanco', 'hot', 'heavy', 'lightly']);
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



const seasons = [
  { 
    id: 'winter', 
    name: 'Winter', 
    icon: Snowflake,
    color: 'bg-blue-500',
    description: 'Warm and cozy cocktails',
    months: 'December - February'
  },
  { 
    id: 'spring', 
    name: 'Spring', 
    icon: Flower2,
    color: 'bg-pink-500',
    description: 'Fresh and floral drinks',
    months: 'March - May'
  },
  { 
    id: 'summer', 
    name: 'Summer', 
    icon: Sun,
    color: 'bg-yellow-500',
    description: 'Cool and refreshing cocktails',
    months: 'June - August'
  },
  { 
    id: 'fall', 
    name: 'Fall', 
    icon: Leaf,
    color: 'bg-orange-500',
    description: 'Spiced autumn cocktails',
    months: 'September - November'
  }
];

const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Fall';
  return 'Winter';
};

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
  { id: 'classic', name: 'Classic Cocktails', path: '/drinks/potent-potables/cocktails', icon: Wine, description: 'Timeless recipes' },
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

export default function SeasonalCocktailsPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedSeason, setSelectedSeason] = useState(getCurrentSeason());
  const [selectedTemperature, setSelectedTemperature] = useState('All');
  const [sortBy, setSortBy] = useState('trending');
  const [selectedCocktail, setSelectedCocktail] = useState<typeof seasonalCocktails[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert cocktails to RecipeKit format
  const cocktailRecipesWithMeasurements = useMemo(() => {
    return seasonalCocktails.map((c) => {
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
    const text = `${cocktail.name} • ${cocktail.season} • ${cocktail.method}\n${preview}${cocktail.ingredients.length > 4 ? ` …plus ${cocktail.ingredients.length - 4} more` : ''}`;
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
        category: 'seasonal-cocktails',
        timestamp: Date.now()
      });
      incrementDrinksMade();
      addPoints(30);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const filteredCocktails = cocktailRecipesWithMeasurements.filter(cocktail => {
    if (selectedSeason !== 'All' && cocktail.season !== selectedSeason) {
      return false;
    }
    if (selectedTemperature !== 'All' && cocktail.temperature !== selectedTemperature) {
      return false;
    }
    if (searchQuery && !cocktail.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'trending') return b.reviews - a.reviews;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'calories-low') return a.nutrition.calories - b.nutrition.calories;
    if (sortBy === 'cost-low') return a.estimatedCost - b.estimatedCost;
    if (sortBy === 'time-quick') return a.prepTime - b.prepTime;
    return 0;
  });

  const handleCocktailClick = (cocktail: typeof seasonalCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'Seasonal Cocktails',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof seasonalCocktails[0]) => {
    incrementDrinksMade();
    addPoints(30, 'Made a seasonal cocktail');
    setSelectedCocktail(null);
  };

  const currentSeason = getCurrentSeason();

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-orange-50">
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
              baseNutrition: {},
              defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1
            }}
          />
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 via-pink-500 to-orange-500 text-white py-8">
          <div className="max-w-7xl mx-auto px-4">
            <Link href="/drinks/potent-potables">
              <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Potent Potables
              </Button>
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <Sparkles className="w-10 h-10" />
                  Seasonal Cocktails
                </h1>
                <p className="text-blue-100 text-lg">Perfect drinks for every season of the year</p>
                <Badge className="mt-2 bg-white/20 text-white border-white/30">
                  Current Season: {currentSeason}
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{filteredCocktails.length}</div>
                <div className="text-blue-100">Recipes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* CROSS-HUB NAVIGATION */}
          <Card className="bg-gradient-to-r from-blue-50 to-pink-50 border-blue-300 mb-6">
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
          <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-300 mb-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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

          {/* Season Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {seasons.map(season => {
              const Icon = season.icon;
              const seasonCocktails = seasonalCocktails.filter(c => c.season === season.name);
              const isCurrentSeason = season.name === currentSeason;
              
              return (
                <Card 
                  key={season.id}
                  className={`cursor-pointer transition-all ${
                    selectedSeason === season.name 
                      ? 'ring-2 ring-offset-2' 
                      : ''
                  } ${isCurrentSeason ? 'border-2 border-yellow-400' : ''}`}
                  onClick={() => setSelectedSeason(season.name)}
                >
                  <CardContent className="p-6 text-center">
                    <div className={`inline-flex p-4 ${season.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-full mb-4`}>
                      <Icon className={`w-8 h-8 ${season.color.replace('bg-', 'text-')}`} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{season.name}</h3>
                    {isCurrentSeason && (
                      <Badge className="mb-2 bg-yellow-500">Current Season</Badge>
                    )}
                    <p className="text-sm text-gray-600 mb-2">{season.description}</p>
                    <p className="text-xs text-gray-500 mb-4">{season.months}</p>
                    <div className="text-2xl font-bold text-gray-900">{seasonCocktails.length}</div>
                    <div className="text-sm text-gray-600">Cocktails</div>

                    {canonicalSlug ? (
                      <div className="mt-3 flex gap-2 text-xs text-muted-foreground"> 
                        <Link href={`/drinks/recipe/${canonicalSlug}`} className="underline underline-offset-2 hover:text-foreground"> 
                          Canonical recipe
                        </Link>
                        <span>•</span>
                        <Link href={`/drinks/submit?remix=${encodeURIComponent(canonicalSlug)}`} className="underline underline-offset-2 hover:text-foreground"> 
                          Remix
                        </Link>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="md:max-w-3xl md:flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search seasonal cocktails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <select
                value={selectedTemperature}
                onChange={(e) => setSelectedTemperature(e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-[240px]"
              >
                <option value="All">All Temperatures</option>
                <option value="Hot">Hot</option>
                <option value="Cold">Cold</option>
                <option value="Frozen">Frozen</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-[240px]"
              >
                <option value="trending">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="calories-low">Lowest Calories</option>
                <option value="cost-low">Most Budget-Friendly</option>
                <option value="time-quick">Quickest Prep</option>
              </select>
              <Button
                variant="outline"
                onClick={() => setSelectedSeason('All')}
                className="w-full sm:w-auto"
              >
                View All Seasons
              </Button>
            </div>
          </div>

          {/* Cocktails Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map(cocktail => {
              const seasonData = seasons.find(s => s.name === cocktail.season);
              const SeasonIcon = seasonData?.icon || Sparkles;
              const useMetric = !!metricFlags[cocktail.id];
              const canonicalSlug = resolveCanonicalDrinkSlug({ slug: cocktail.slug, name: cocktail.name, sourceRoute: '/drinks/potent-potables/seasonal' });
              const servings = servingsById[cocktail.id] ?? (cocktail.recipe?.servings || 1);
              
              return (
                <Card 
                  key={cocktail.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white"
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
                            category: 'Seasonal Cocktails',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className={seasonData?.color}>
                        <SeasonIcon className="w-3 h-3 mr-1" />
                        {cocktail.season}
                      </Badge>
                      {cocktail.trending && (
                        <Badge className="bg-purple-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.featured && (
                        <Badge className="bg-amber-500">
                          Featured
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{cocktail.description}</p>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-purple-600">{cocktail.abv}</div>
                        <div className="text-gray-500">ABV</div>
                      </div>
                      <div>
                        <div className="font-bold text-pink-600">{cocktail.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-purple-600">{cocktail.temperature}</div>
                        <div className="text-gray-500">Temp</div>
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
                                ? 'fill-purple-500 text-purple-500'
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
                              -
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
                      {cocktail.profile.slice(0, 3).map(trait => (
                        <Badge key={trait} variant="outline" className="text-xs">
                          {trait}
                        </Badge>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                      <Button 
                        className="flex-1 bg-purple-600 hover:bg-purple-700"
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

          {/* Educational Content */}
          <Card className="mt-12 bg-gradient-to-br from-blue-50 to-orange-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-500" />
                Seasonal Cocktail Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-6">
                {seasons.map(season => {
                  const Icon = season.icon;
                  return (
                    <div key={season.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-5 h-5 ${season.color.replace('bg-', 'text-')}`} />
                        <h3 className="font-semibold">{season.name}</h3>
                      </div>
                      <p className="text-sm text-gray-700">
                        {season.name === 'Winter' && 'Warm, spiced drinks perfect for cold weather. Think hot toddies, mulled wine, and cozy flavors.'}
                        {season.name === 'Spring' && 'Fresh, floral cocktails with herbs and light spirits. Garden-inspired and refreshing.'}
                        {season.name === 'Summer' && 'Cold, tropical drinks for hot days. Frozen, fruity, and perfect for outdoor entertaining.'}
                        {season.name === 'Fall' && 'Spiced, harvest-inspired cocktails with apple, pumpkin, and warming flavors.'}
                      </p>
                    </div>
                  );
                })}
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
                      <Sparkles className="h-4 w-4 text-pink-500" />
                      <span className="text-sm text-gray-600">Cocktails Found:</span>
                      <Badge className="bg-pink-100 text-pink-800">{filteredCocktails.length}</Badge>
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
