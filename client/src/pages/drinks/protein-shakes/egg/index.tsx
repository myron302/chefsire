// pages/drinks/protein-shakes/egg.tsx
import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Target, Heart, Star, Zap, Flame, Leaf, Sparkles, Moon, Wine, Search, ArrowLeft, ArrowRight, Camera, X, Plus, Dumbbell, Check, Clipboard, Share2, RotateCcw, Coffee } from "lucide-react";
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';
import RecipeKit, { Measured } from '@/components/recipes/RecipeKit';
import type { RecipeKitHandle } from '@/components/recipes/RecipeKit';
import { resolveCanonicalDrinkSlug } from '@/data/drinks/canonical';
import { redirectToCanonicalRecipe } from '@/lib/canonical-routing';
import { eggProteinRecipes } from '@/data/drinks/protein-shakes/egg';

// ---------- Helpers ----------
type Nutrition = { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// Scaling helpers to match Whey page
const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));
const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = { 0: '', 1: '1/4', 2: '1/2', 3: '3/4' };
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

// ---------- Cross-nav ----------
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Leaf, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const proteinSubcategories = [
  { id: 'whey', name: 'Whey Protein', icon: Zap, path: '/drinks/protein-shakes/whey', description: 'Fast absorption' },
  { id: 'plant', name: 'Plant-Based', icon: Leaf, path: '/drinks/protein-shakes/plant-based', description: 'Vegan friendly' },
  { id: 'casein', name: 'Casein', icon: Moon, path: '/drinks/protein-shakes/casein', description: 'Slow release' },
  { id: 'collagen', name: 'Collagen', icon: Sparkles, path: '/drinks/protein-shakes/collagen', description: 'Beauty support' },
  { id: 'beef', name: 'Beef Protein', icon: Flame, path: '/drinks/protein-shakes/beef', description: 'Natural creatine' }
];

// ---------- Data (Egg) - Expanded to 9 recipes ----------
// ---------- Component ----------
export default function EggProteinPage() {
  const {
    userProgress,
    addPoints,
    incrementDrinksMade,
    addToFavorites,
    isFavorite,
    addToRecentlyViewed
  } = useDrinks();

  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [filterTag, setFilterTag] = useState('All');
  const [activeTab, setActiveTab] = useState<'browse' | 'types' | 'goals' | 'featured'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'prepTime'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // RecipeKit refs
  const kitRefs = useRef<Record<string, RecipeKitHandle | null>>({});

  const allTags = ['All', ...new Set(eggProteinRecipes.flatMap(r => r.tags))];
  const topRatedRecipes = useMemo(
    () => [...eggProteinRecipes].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 6),
    [],
  );
  const flavorTypes = useMemo(
    () => [...new Set(eggProteinRecipes.map((recipe) => recipe.flavor))].sort((a, b) => a.localeCompare(b)),
    [],
  );

  // Filter + sort
  const filteredRecipes = useMemo(() => {
    let filtered = eggProteinRecipes.filter(recipe => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        recipe.name.toLowerCase().includes(q) ||
        recipe.ingredients.some((ing: string) => ing.toLowerCase().includes(q)) ||
        (recipe.flavor || '').toLowerCase().includes(q) ||
        recipe.tags.some(t => t.toLowerCase().includes(q)) ||
        (recipe.benefits || []).some((b: string) => b.toLowerCase().includes(q));
      const matchesTag = filterTag === 'All' || recipe.tags.includes(filterTag);
      return matchesSearch && matchesTag;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.protein || 0) - (a.protein || 0);
        case 'calories': return (a.calories || 0) - (b.calories || 0);
        case 'prepTime': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  }, [searchQuery, filterTag, sortBy]);

  const handleSharePage = async () => {
    const shareData = {
      title: 'Egg Protein Shakes',
      text: 'Browse egg protein shake recipes and benefits.',
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

  const handleShareShake = async (shake: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[shake.id] ?? (shake.recipe?.servings || 1);
    const preview = (shake?.recipe?.measurements || [])
      .slice(0, 4)
      .map((r: Measured) => {
        const scaled =
          typeof r.amount === 'number'
            ? `${scaleAmount(r.amount, servings)} ${r.unit}`
            : `${r.amount} ${r.unit}`;
        return `${scaled} ${r.item}`;
      })
      .join(' · ');
    const text = `${shake.name} • ${shake.flavor} • Egg Protein\n${preview || (shake.ingredients?.slice(0,4)?.join(', ') ?? '')}`;
    const shareData = { title: shake.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shake.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shake.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const openRecipeModal = (recipe: any) => {
    const canonicalSlug = resolveCanonicalDrinkSlug({
      slug: recipe?.slug,
      name: recipe?.name,
    });

    if (redirectToCanonicalRecipe(canonicalSlug, '/drinks/recipe')) {
      return;
    }

    const fallbackSlug = recipe?.slug || String(recipe?.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (fallbackSlug && typeof window !== 'undefined') {
      window.location.href = `/drinks/recipe/${encodeURIComponent(fallbackSlug)}`;
      return;
    }

    setSelectedRecipe(recipe);
    setShowKit(true);
  };

  const handleCompleteRecipe = () => {
    if (selectedRecipe) {
      const drinkData = {
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: 'protein-shakes' as const,
        description: `${selectedRecipe.flavor || ''} egg protein shake`,
        ingredients: selectedRecipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || selectedRecipe.ingredients,
        nutrition: { calories: selectedRecipe.calories, protein: selectedRecipe.protein, carbs: selectedRecipe.carbs, fat: 5 },
        difficulty: selectedRecipe.difficulty as 'Easy' | 'Medium' | 'Hard',
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating
      };
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(25);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-100">
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

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/protein-shakes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Protein Shakes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Target className="h-6 w-6 text-amber-600" />
                <h1 className="text-2xl font-bold text-gray-900">Egg Protein Shakes</h1>
                <Badge className="bg-amber-100 text-amber-800">BV Score: 100</Badge>
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
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cross-Hub Navigation */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon as any;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
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

        {/* Sister Protein Pages Navigation */}
        <Card className="bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Other Protein Types
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon as any;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-amber-50 hover:border-amber-300">
                      <Icon className="h-4 w-4 mr-2 text-amber-600" />
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

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">29g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">100</div>
              <div className="text-sm text-gray-600">BV Score</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">9</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">4.7</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-gray-100 rounded-lg p-1 mb-6">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'types', label: 'Flavor Types', icon: Sparkles },
            { id: 'goals', label: 'Goal Tags', icon: Target },
            { id: 'featured', label: 'Top Rated', icon: Star },
          ].map((tab) => {
            const Icon = tab.icon as any;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 ${activeTab === tab.id ? 'bg-amber-500 shadow-sm !text-white hover:!text-white hover:bg-amber-600' : ''}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {activeTab === 'browse' && (
          <>
            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      placeholder="Search egg protein recipes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={filterTag}
                      onChange={(e) => setFilterTag(e.target.value)}
                    >
                      <option value="All">All Tags</option>
                      {allTags.filter(t => t !== 'All').map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                    <select
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="protein">Sort by Protein</option>
                      <option value="calories">Sort by Calories</option>
                      <option value="prepTime">Sort by Prep Time</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === 'types' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Egg Protein Flavor Types</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {flavorTypes.map((flavor) => (
                <Button key={flavor} variant="outline" className="justify-start" onClick={() => { setSearchQuery(flavor); setActiveTab('browse'); }}>
                  {flavor}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {activeTab === 'goals' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Goal Tags</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {allTags.filter((tag) => tag !== 'All').map((tag) => (
                <Button key={tag} variant="outline" onClick={() => { setFilterTag(tag); setActiveTab('browse'); }}>
                  {tag}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recipe Grid */}
        {(activeTab === 'browse' ? filteredRecipes : topRatedRecipes).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(activeTab === 'browse' ? filteredRecipes : topRatedRecipes).map((recipe) => {
            const useMetric = !!metricFlags[recipe.id];
              const canonicalSlug = resolveCanonicalDrinkSlug({ slug: recipe.slug, name: recipe.name, sourceRoute: '/drinks/protein-shakes/egg' });
            const servings = servingsById[recipe.id] ?? (recipe.recipe?.servings || 1);

            return (
              <Card key={recipe.id} onClick={() => openRecipeModal(recipe)} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="md:max-w-3xl md:flex-1">
                      <CardTitle className="text-lg mb-1">{recipe.name}</CardTitle>
                      <p className="text-sm text-gray-600 mb-2">{recipe.flavor}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const drinkData = {
                          id: recipe.id,
                          name: recipe.name,
                          category: 'protein-shakes' as const,
                          description: `${recipe.flavor || ''} egg protein shake`,
                          ingredients: recipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || recipe.ingredients,
                          nutrition: { calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: 5 },
                          difficulty: recipe.difficulty as 'Easy' | 'Medium' | 'Hard',
                          prepTime: recipe.prepTime,
                          rating: recipe.rating
                        };
                        addToFavorites(drinkData);
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Heart className={`h-5 w-5 ${isFavorite(recipe.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>

                  {/* Tags at top with different colors */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    <Badge className="bg-amber-100 text-amber-800">Egg Protein</Badge>
                    <Badge variant="outline">{recipe.flavor}</Badge>
                    {recipe.tags.includes('Post-Workout') && <Badge className="bg-red-100 text-red-800">Post-Workout</Badge>}
                    {recipe.tags.includes('Lactose-Free') && <Badge className="bg-blue-100 text-blue-800">Lactose-Free</Badge>}
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Nutrition Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                    <div>
                      <div className="text-xl font-bold text-amber-600">{recipe.protein}g</div>
                      <div className="text-gray-500">Protein</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-600">{recipe.calories}</div>
                      <div className="text-gray-500">Calories</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-green-600">{recipe.prepTime}m</div>
                      <div className="text-gray-500">Prep Time</div>
                    </div>
                  </div>

                  {/* MOVED: Rating and Difficulty just above recipe box */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{recipe.rating}</span>
                      <span className="text-gray-500 text-sm">({recipe.reviews})</span>
                    </div>
                    <Badge variant="outline">{recipe.difficulty}</Badge>
                  </div>

                  {/* Compact measured recipe preview + inline actions (Whey pattern) */}
                  {recipe.recipe?.measurements && (
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
                              setServingsById(prev => ({ ...prev, [recipe.id]: clamp((prev[recipe.id] ?? (recipe.recipe?.servings || 1)) - 1) }));
                            }}
                            aria-label="decrease servings"
                          >
                            -
                          </button>
                          <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                          <button
                            className="px-2 py-1 border rounded text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setServingsById(prev => ({ ...prev, [recipe.id]: clamp((prev[recipe.id] ?? (recipe.recipe?.servings || 1)) + 1) }));
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
                                next[recipe.id] = recipe.recipe?.servings || 1;
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
                        {recipe.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                          const isNum = typeof ing.amount === 'number';
                          const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                          const show = useMetric && isNum
                            ? { amount: Math.round(Number(ing.amount) * servings), unit: 'g' } // Simplified metric conversion
                            : { amount: scaledDisplay, unit: ing.unit };

                          return (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-amber-600 mt-0.5" />
                              <span>
                                <span className="text-amber-700 font-semibold">
                                  {show.amount} {show.unit}
                                </span>{" "}
                                {ing.item}
                                {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                              </span>
                            </li>
                          );
                        })}
                        {recipe.recipe.measurements.length > 4 && (
                          <li className="text-xs text-gray-600">
                            …plus {recipe.recipe.measurements.length - 4} more •{" "}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRecipeModal(recipe);
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
                            const lines = (recipe.recipe?.measurements || []).map((ing: Measured) => {
                              if (useMetric && typeof ing.amount === 'number') {
                                return `- ${Math.round(Number(ing.amount) * servings)}g ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                              }
                              const scaled = typeof ing.amount === 'number' ? scaleAmount(ing.amount, servings) : ing.amount;
                              return `- ${scaled} ${ing.unit} ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                            });
                            const txt = `${recipe.name} (serves ${servings})\n${lines.join('\n')}`;
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
                          handleShareShake(recipe, servings);
                        }}>
                          <Share2 className="w-4 h-4 mr-1" /> Share
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMetricFlags((prev) => ({ ...prev, [recipe.id]: !prev[recipe.id] }));
                          }}
                        >
                          {useMetric ? 'US' : 'Metric'}
                        </Button>
                      </div>

                      {/* ADDED: Absorption content below recipe box */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-gray-700">Absorption:</div>
                            <div className="text-blue-600 font-medium">{recipe.absorptionTime}</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-gray-700">Leucine:</div>
                            <div className="text-green-600 font-medium">{recipe.leucineContent}</div>
                          </div>
                        </div>
                        <div className="text-center mt-2">
                          <div className="font-semibold text-gray-700">Best Time:</div>
                          <div className="text-purple-600 font-medium text-sm">{recipe.bestTime}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Benefits tags with Egg color scheme */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {recipe.benefits.map((benefit: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200">
                        {benefit}
                      </Badge>
                    ))}
                  </div>

                  {/* Full-width CTA — Make Shake with lighter amber */}
                  <Button
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToRecentlyViewed({
                        id: recipe.id,
                        name: recipe.name,
                        category: 'protein-shakes',
                        description: recipe.flavor,
                        ingredients: recipe.recipe?.measurements?.map((x: Measured) => x.item) ?? [],
                        nutrition: { calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: 5 },
                        difficulty: recipe.difficulty,
                        prepTime: recipe.prepTime,
                        rating: recipe.rating,
                        fitnessGoal: 'Muscle Building',
                        bestTime: 'Post-Workout'
                      });
                      incrementDrinksMade();
                      addPoints(25);
                      kitRefs.current[recipe.id]?.open?.();
                    }}
                  >
                    <Dumbbell className="h-4 w-4 mr-1" />
                    Open Recipe (+100 XP)
                  </Button>
</CardContent>
              </Card>
            );
            })}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-purple-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-green-600">
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

      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="amber"
          pointsReward={100}
          onComplete={handleCompleteRecipe}
          item={{
            id: selectedRecipe.id,
            name: selectedRecipe.name,
            prepTime: selectedRecipe.prepTime,
            directions: selectedRecipe.recipe?.directions || [],
            measurements: selectedRecipe.recipe?.measurements || [],
            baseNutrition: { calories: selectedRecipe.calories, protein: selectedRecipe.protein, carbs: selectedRecipe.carbs, fat: 5 } || {},
            defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1
          }}
        />
      )}
    </div>
  );
}
