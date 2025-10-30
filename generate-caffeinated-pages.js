const fs = require('fs');
const path = require('path');

// Template for caffeinated drink pages
const generatePage = (config) => {
  const {
    pageName,
    displayName,
    description,
    icon,
    accentColor,
    drinks,
    drinkTypes,
    benefits
  } = config;

  return `// client/src/pages/drinks/caffeinated/${pageName}/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ${icon}, Clock, Heart, Star, Search,
  Share2, ArrowLeft, Camera, Zap, X, Check,
  Clipboard, RotateCcw, Sparkles, Wine, Flame,
  Target, Leaf, Palmtree, Droplets, Sun, Crown
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
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
  if (whole && fracStr) return \`\${whole} \${fracStr}\`;
  return \`\${whole}\`;
};
const scaleAmount = (baseAmount: number | string, servings: number) => {
  const n = typeof baseAmount === 'number' ? baseAmount : parseFloat(String(baseAmount));
  if (Number.isNaN(n)) return baseAmount;
  return toNiceFraction(n * servings);
};

const toMetric = (unit: string, amount: number) => {
  const mlPerOz = 30, mlPerCup = 240;
  switch (unit) {
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
    case 'cup': return { amount: Math.round(amount * mlPerCup), unit: 'ml' };
    default: return { amount, unit };
  }
};

const parseIngredient = (ingredient: string): Measured => {
  const fractionMap: Record<string, number> = {
    '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75
  };

  const parts = ingredient.trim().split(/\\s+/);
  if (parts.length < 2) return m('1', 'item', ingredient);

  let amountStr = parts[0];
  let amount: number | string = fractionMap[amountStr] ??
    (isNaN(Number(amountStr)) ? amountStr : Number(amountStr));

  let unit = parts[1];
  let item = parts.slice(2).join(' ');

  if (item.includes('(optional)')) {
    item = item.replace('(optional)', '').trim();
    return m(amount, unit, item, 'optional');
  }

  return m(amount, unit, item);
};

// Drinks data
const drinks = ${JSON.stringify(drinks, null, 2)};

const drinkTypes = ${JSON.stringify(drinkTypes, null, 2)};

const benefitsList = ${JSON.stringify(benefits, null, 2)};

const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Sparkles, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'caffeinated', name: 'All Caffeinated', icon: ${icon}, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Flame, route: '/drinks', description: 'Browse everything' }
];

const allCaffeinatedSubcategories = [
  ${pageName !== 'espresso' ? "{ id: 'espresso', name: 'Espresso', path: '/drinks/caffeinated/espresso', icon: Coffee, description: 'Pure espresso' }," : ''}
  ${pageName !== 'cold-brew' ? "{ id: 'cold-brew', name: 'Cold Brew', path: '/drinks/caffeinated/cold-brew', icon: Droplets, description: 'Smooth cold coffee' }," : ''}
  ${pageName !== 'energy' ? "{ id: 'energy', name: 'Energy', path: '/drinks/caffeinated/energy', icon: Zap, description: 'Energy drinks' }," : ''}
  ${pageName !== 'iced' ? "{ id: 'iced', name: 'Iced Coffee', path: '/drinks/caffeinated/iced', icon: Sun, description: 'Refreshing iced' }," : ''}
  ${pageName !== 'lattes' ? "{ id: 'lattes', name: 'Lattes', path: '/drinks/caffeinated/lattes', icon: Heart, description: 'Milk-based coffee' }," : ''}
  ${pageName !== 'matcha' ? "{ id: 'matcha', name: 'Matcha', path: '/drinks/caffeinated/matcha', icon: Leaf, description: 'Green tea powder' }," : ''}
  ${pageName !== 'tea' ? "{ id: 'tea', name: 'Tea', path: '/drinks/caffeinated/tea', icon: Leaf, description: 'Tea varieties' }," : ''}
  ${pageName !== 'specialty' ? "{ id: 'specialty', name: 'Specialty', path: '/drinks/caffeinated/specialty', icon: Star, description: 'Unique creations' }" : ''}
].filter(Boolean);

export default function ${displayName.replace(/\\s+/g, '')}Page() {
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
  const [maxCaffeine, setMaxCaffeine] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'caffeine' | 'cost'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'types'|'benefits'|'featured'|'trending'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const drinkRecipesWithMeasurements = useMemo(() => {
    return drinks.map((d) => {
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
          directions: d.directions || [
            'Gather all ingredients',
            'Follow preparation steps for this drink',
            'Serve and enjoy immediately'
          ]
        }
      };
    });
  }, []);

  const handleShareDrink = async (drink: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[drink.id] ?? 1;
    const preview = drink.ingredients.slice(0, 4).join(' • ');
    const text = \`\${drink.name} • \${drink.drinkType} • \${drink.bestTime}\\n\${preview}\`;
    const shareData = { title: drink.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(\`\${drink.name}\\n\${text}\\n\${url}\`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(\`\${drink.name}\\n\${text}\\n\${url}\`);
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
        description: \`\${selectedRecipe.drinkType || ''} • \${selectedRecipe.bestTime || ''}\`,
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
      addPoints(30);
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
      const matchesCaffeine = maxCaffeine === 'all' || drink.nutrition.caffeine <= maxCaffeine;
      return matchesSearch && matchesType && matchesBenefit && matchesCaffeine;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'caffeine': return (b.nutrition.caffeine || 0) - (a.nutrition.caffeine || 0);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
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
      title: '${displayName}',
      text: \`Browse \${drinks.length} ${displayName.toLowerCase()} for energy and flavor.\`,
      url: typeof window !== 'undefined' ? window.location.href : ''
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(\`\${shareData.title}\\n\${shareData.text}\\n\${shareData.url}\`);
        alert('Link copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(\`\${shareData.title}\\n\${shareData.text}\\n\${shareData.url}\`);
        alert('Link copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-${accentColor}-50 via-orange-50 to-yellow-50">
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

      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="${accentColor}"
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
                <${icon} className="h-6 w-6 text-${accentColor}-400" />
                <h1 className="text-2xl font-bold text-gray-900">${displayName}</h1>
                <Badge className="bg-${accentColor}-100 text-${accentColor}-600 border-${accentColor}-200">${description}</Badge>
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
              <Button size="sm" className="bg-${accentColor}-400 hover:bg-${accentColor}-500 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card className="bg-gradient-to-r from-${accentColor}-50 to-orange-50 border-${accentColor}-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-${accentColor}-50 hover:border-${accentColor}-300">
                      <Icon className="h-4 w-4 mr-2 text-${accentColor}-400" />
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

        <Card className="bg-gradient-to-r from-${accentColor}-50 to-yellow-50 border-${accentColor}-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Caffeinated Drinks</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {allCaffeinatedSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-${accentColor}-50 hover:border-${accentColor}-300">
                      <Icon className="h-4 w-4 mr-2 text-${accentColor}-400" />
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-${accentColor}-400">{drinks.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-${accentColor}-400">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-${accentColor}-400">150mg</div>
              <div className="text-sm text-gray-600">Avg Caffeine</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-${accentColor}-400">3min</div>
              <div className="text-sm text-gray-600">Avg Prep</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search ${displayName.toLowerCase()}..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                    <option value="rating">Sort by Rating</option>
                    <option value="caffeine">Sort by Caffeine</option>
                    <option value="cost">Sort by Cost</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrinks.map(drink => {
              const useMetric = !!metricFlags[drink.id];
              const servings = servingsById[drink.id] ?? 1;

              return (
                <Card key={drink.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{drink.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{drink.description}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => addToFavorites(drink)}>
                        <Heart className={\`h-4 w-4 \${isFavorite(drink.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}\`} />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className="bg-${accentColor}-100 text-${accentColor}-600 border-${accentColor}-200">{drink.drinkType}</Badge>
                      <Badge variant="outline">{drink.energyLevel}</Badge>
                      {drink.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-${accentColor}-400">{drink.nutrition.calories}</div>
                        <div className="text-gray-500">Calories</div>
                      </div>
                      <div>
                        <div className="font-bold text-${accentColor}-400">{drink.nutrition.caffeine}mg</div>
                        <div className="text-gray-500">Caffeine</div>
                      </div>
                      <div>
                        <div className="font-bold text-${accentColor}-400">{drink.prepTime}m</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{drink.rating}</span>
                        <span className="text-gray-500 text-sm">({drink.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{drink.difficulty}</Badge>
                    </div>

                    {Array.isArray(drink.recipe?.measurements) && drink.recipe.measurements.length > 0 && (
                      <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-900">Recipe (serves {servings})</div>
                          <div className="flex items-center gap-2">
                            <button className="px-2 py-1 border rounded text-sm" onClick={() => setServingsById(prev => ({ ...prev, [drink.id]: clamp((prev[drink.id] ?? 1) - 1) }))}>−</button>
                            <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                            <button className="px-2 py-1 border rounded text-sm" onClick={() => setServingsById(prev => ({ ...prev, [drink.id]: clamp((prev[drink.id] ?? 1) + 1) }))}>+</button>
                          </div>
                        </div>

                        <ul className="text-sm leading-6 text-gray-800 space-y-1">
                          {drink.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                            const isNum = typeof ing.amount === 'number';
                            const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                            const show = useMetric && isNum ? toMetric(ing.unit, Number(ing.amount) * servings) : { amount: scaledDisplay, unit: ing.unit };

                            return (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-${accentColor}-400 mt-0.5" />
                                <span>
                                  <span className="text-${accentColor}-500 font-semibold">{show.amount} {show.unit}</span>{" "}
                                  {ing.item}
                                  {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                </span>
                              </li>
                            );
                          })}
                          {drink.recipe.measurements.length > 4 && (
                            <li className="text-xs text-gray-600">
                              …plus {drink.recipe.measurements.length - 4} more •{" "}
                              <button type="button" onClick={() => openRecipeModal(drink)} className="underline underline-offset-2">
                                Show more
                              </button>
                            </li>
                          )}
                        </ul>

                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" size="sm" onClick={async () => {
                            const lines = drink.ingredients.map((ing: string) => \`- \${ing}\`);
                            const txt = \`\${drink.name} (serves \${servings})\\n\${lines.join('\\n')}\`;
                            try {
                              await navigator.clipboard.writeText(txt);
                              alert('Recipe copied!');
                            } catch {
                              alert('Unable to copy on this device.');
                            }
                          }}>
                            <Clipboard className="w-4 h-4 mr-1" /> Copy
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleShareDrink(drink, servings)}>
                            <Share2 className="w-4 h-4 mr-1" /> Share
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setMetricFlags((prev) => ({ ...prev, [drink.id]: !prev[drink.id] }))}>
                            {useMetric ? 'US' : 'Metric'}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 mb-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium text-${accentColor}-400">{drink.bestTime}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {drink.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-${accentColor}-100 text-${accentColor}-600 hover:bg-${accentColor}-200">
                          {benefit}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-3">
                      <Button className="w-full bg-${accentColor}-400 hover:bg-${accentColor}-500 text-white" onClick={() => openRecipeModal(drink)}>
                        <${icon} className="h-4 w-4 mr-2" />
                        Make Drink (+30 XP)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="bg-gradient-to-r from-${accentColor}-50 to-orange-50 border-${accentColor}-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-${accentColor}-400">Level {userProgress.level}</Badge>
                  <Badge variant="outline" className="text-${accentColor}-400">{userProgress.totalPoints} XP</Badge>
                  <Badge variant="outline" className="text-${accentColor}-400">{userProgress.totalDrinksMade} Drinks Made</Badge>
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
`;
};

// Configuration for each drink type
const drinkConfigs = {
  'cold-brew': {
    pageName: 'cold-brew',
    displayName: 'Cold Brew Coffee',
    description: 'Smooth & Cold',
    icon: 'Coffee',
    accentColor: 'amber',
    drinks: [
      {
        id: 'classic-cold-brew',
        name: 'Classic Cold Brew',
        description: 'Smooth, naturally sweet cold coffee',
        ingredients: ['1 cup coarse ground coffee', '4 cup cold water'],
        benefits: ['Low acidity', 'Smooth taste', 'Natural sweetness', 'Long-lasting energy'],
        nutrition: { calories: 5, protein: 0, carbs: 0, fiber: 0, caffeine: 200 },
        difficulty: 'Easy',
        prepTime: 5,
        rating: 4.8,
        reviews: 2341,
        drinkType: 'Cold Brew',
        energyLevel: 'High',
        featured: true,
        trending: true,
        bestTime: 'Morning',
        estimatedCost: 1.50,
        directions: [
          'Mix coarse ground coffee with cold water',
          'Refrigerate for 12-24 hours',
          'Strain through coffee filter',
          'Serve over ice',
          'Dilute with water or milk if desired'
        ]
      },
      {
        id: 'vanilla-cold-brew',
        name: 'Vanilla Cold Brew',
        description: 'Cold brew with vanilla sweetness',
        ingredients: ['1 cup cold brew concentrate', '1 tsp vanilla extract', '1 cup milk', '1 cup ice'],
        benefits: ['Smooth vanilla flavor', 'Creamy texture', 'Energy boost'],
        nutrition: { calories: 120, protein: 8, carbs: 12, fiber: 0, caffeine: 200 },
        difficulty: 'Easy',
        prepTime: 3,
        rating: 4.7,
        reviews: 1876,
        drinkType: 'Flavored Cold Brew',
        energyLevel: 'High',
        featured: true,
        trending: false,
        bestTime: 'Anytime',
        estimatedCost: 2.50
      },
      {
        id: 'nitro-cold-brew',
        name: 'Nitro Cold Brew',
        description: 'Nitrogen-infused cold brew for creamy texture',
        ingredients: ['1 cup cold brew', '1 nitrogen cartridge'],
        benefits: ['Creamy texture', 'No added sugar', 'Cascading effect', 'Smooth finish'],
        nutrition: { calories: 5, protein: 0, carbs: 0, fiber: 0, caffeine: 200 },
        difficulty: 'Medium',
        prepTime: 5,
        rating: 4.9,
        reviews: 3421,
        drinkType: 'Nitro Brew',
        energyLevel: 'High',
        featured: true,
        trending: true,
        bestTime: 'Morning',
        estimatedCost: 3.50
      }
    ],
    drinkTypes: [
      { id: 'classic', name: 'Classic', description: 'Traditional cold brew' },
      { id: 'flavored', name: 'Flavored', description: 'With added flavors' },
      { id: 'nitro', name: 'Nitro', description: 'Nitrogen-infused' }
    ],
    benefits: [
      { id: 'low-acid', name: 'Low Acidity', description: 'Gentle on stomach' },
      { id: 'smooth', name: 'Smooth Taste', description: 'Naturally sweet flavor' },
      { id: 'energy', name: 'Long Energy', description: 'Sustained caffeine release' }
    ]
  },
  'energy': {
    pageName: 'energy',
    displayName: 'Energy Drinks',
    description: 'Power Boost',
    icon: 'Zap',
    accentColor: 'red',
    drinks: [
      {
        id: 'green-tea-energy',
        name: 'Green Tea Energy Boost',
        description: 'Natural energy from green tea and ginseng',
        ingredients: ['2 cup brewed green tea', '1 tsp honey', '1 tsp ginseng powder', '1 cup ice'],
        benefits: ['Natural energy', 'Antioxidants', 'Mental clarity', 'No crash'],
        nutrition: { calories: 30, protein: 0, carbs: 8, fiber: 0, caffeine: 80 },
        difficulty: 'Easy',
        prepTime: 5,
        rating: 4.6,
        reviews: 987,
        drinkType: 'Natural Energy',
        energyLevel: 'Medium',
        featured: true,
        trending: true,
        bestTime: 'Morning',
        estimatedCost: 2.00
      },
      {
        id: 'citrus-energy',
        name: 'Citrus Energy Blast',
        description: 'Vitamin C and B12 for sustained energy',
        ingredients: ['1 cup orange juice', '½ cup lemon juice', '1 tsp B12 supplement', '1 tsp guarana'],
        benefits: ['Vitamin boost', 'Natural caffeine', 'Hydration', 'Immune support'],
        nutrition: { calories: 110, protein: 2, carbs: 26, fiber: 1, caffeine: 100 },
        difficulty: 'Easy',
        prepTime: 3,
        rating: 4.5,
        reviews: 654,
        drinkType: 'Vitamin Energy',
        energyLevel: 'High',
        featured: true,
        trending: false,
        bestTime: 'Pre-Workout',
        estimatedCost: 2.50
      },
      {
        id: 'matcha-energy',
        name: 'Matcha Energy Drink',
        description: 'Ceremonial matcha for calm energy',
        ingredients: ['1 tsp matcha powder', '1 cup almond milk', '1 tsp honey', '1 cup ice'],
        benefits: ['L-theanine', 'Calm focus', 'Antioxidants', 'Metabolism boost'],
        nutrition: { calories: 90, protein: 1, carbs: 18, fiber: 1, caffeine: 70 },
        difficulty: 'Easy',
        prepTime: 4,
        rating: 4.8,
        reviews: 1432,
        drinkType: 'Tea Energy',
        energyLevel: 'Medium',
        featured: false,
        trending: true,
        bestTime: 'Afternoon',
        estimatedCost: 3.00
      }
    ],
    drinkTypes: [
      { id: 'natural', name: 'Natural', description: 'Plant-based energy' },
      { id: 'vitamin', name: 'Vitamin', description: 'Vitamin-fortified' },
      { id: 'tea', name: 'Tea-Based', description: 'Tea energy drinks' }
    ],
    benefits: [
      { id: 'natural', name: 'Natural Energy', description: 'Plant-based caffeine' },
      { id: 'vitamins', name: 'Vitamins', description: 'B vitamins and more' },
      { id: 'no-crash', name: 'No Crash', description: 'Sustained energy' }
    ]
  }
};

// Generate all files
Object.values(drinkConfigs).forEach(config => {
  const content = generatePage(config);
  const filePath = path.join(__dirname, 'client', 'src', 'pages', 'drinks', 'caffeinated', config.pageName, 'index.tsx');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Generated: ${filePath}`);
});

console.log('\\nAll caffeinated drink pages generated successfully!');
