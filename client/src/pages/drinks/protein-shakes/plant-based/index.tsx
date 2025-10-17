import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Leaf, Heart, Star, Search, ArrowLeft, Sparkles, Wine, Zap, Moon,
  Target, Flame, Apple, Sprout, Dumbbell, ArrowRight, Camera,
  Check, Clipboard, Share2, RotateCcw
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import RecipeKit, { Measured } from '@/components/recipes/RecipeKit';
import type { RecipeKitHandle } from '@/components/recipes/RecipeKit';

// ---------- Nav data ----------
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const proteinSubcategories = [
  { id: 'whey', name: 'Whey Protein', icon: Zap, path: '/drinks/protein-shakes/whey', description: 'Fast absorption' },
  { id: 'casein', name: 'Casein', icon: Moon, path: '/drinks/protein-shakes/casein', description: 'Slow release' },
  { id: 'collagen', name: 'Collagen', icon: Sparkles, path: '/drinks/protein-shakes/collagen', description: 'Beauty support' },
  { id: 'egg', name: 'Egg Protein', icon: Target, path: '/drinks/protein-shakes/egg', description: 'Complete amino' },
  { id: 'beef', name: 'Beef Protein', icon: Flame, path: '/drinks/protein-shakes/beef', description: 'Natural creatine' }
];

// ---------- Helpers ----------
type Nutrition = { calories: number; protein: number; carbs?: number; fat?: number; fiber?: number };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// Scaling helpers to match Whey/Egg pages
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

// ---------- Data ----------
const plantBasedShakes = [
  {
    id: 'plant-1',
    name: 'Pea Power Green Machine',
    description: 'Complete amino acid profile with organic pea protein',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop',
    proteinSource: 'Pea Protein Isolate',
    proteinType: 'pea',
    flavor: 'Vanilla Mint',
    servingSize: '30g',
    nutrition: { calories: 120, protein: 25, carbs: 3, fat: 1, fiber: 2 },
    certifications: ['Organic', 'Non-GMO', 'Vegan', 'Gluten-Free'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 847,
    trending: true,
    featured: true,
    price: 32.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Nuts'],
    sustainability: 'Carbon Negative',
    fitnessGoal: 'Muscle Building',
    bestTime: 'Post-Workout',
    absorptionTime: '90-120 minutes',
    leucineContent: '2.1g',
    recipe: {
      measurements: [
        m(1, 'scoop (30g)', 'pea protein isolate'),
        m(1, 'cup', 'unsweetened almond milk'),
        m(1, 'cup', 'spinach, loosely packed'),
        m(0.5, 'frozen banana', 'banana'),
        m(0.5, 'tsp', 'pure vanilla extract'),
        m(2, 'leaves', 'fresh mint', 'or 1–2 drops mint extract'),
        m(1, 'tsp', 'MCT oil', 'optional'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Add liquids first, then powders, then solids.',
        'Blend 40–60 seconds until silky; add ice to thicken.',
        'Taste and adjust mint/vanilla; serve cold.'
      ]
    }
  },
  {
    id: 'plant-2',
    name: 'Hemp Heart Hero',
    description: 'Omega-rich hemp protein with natural nutty flavor',
    proteinSource: 'Hemp Protein Powder',
    proteinType: 'hemp',
    flavor: 'Natural Nutty',
    servingSize: '30g',
    nutrition: { calories: 110, protein: 20, carbs: 4, fat: 3, fiber: 8 },
    certifications: ['Organic', 'Raw', 'Vegan', 'Non-GMO'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 623,
    trending: false,
    featured: true,
    price: 29.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten'],
    sustainability: 'Regenerative',
    fitnessGoal: 'General Wellness',
    bestTime: 'Morning',
    absorptionTime: '90-120 minutes',
    leucineContent: '1.8g',
    recipe: {
      measurements: [
        m(1, 'scoop (30g)', 'hemp protein'),
        m(1, 'cup', 'oat milk'),
        m(1, 'tbsp', 'chia seeds'),
        m(1, 'tsp', 'maple syrup', 'optional'),
        m(0.25, 'tsp', 'cinnamon'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Soak chia in oat milk for 5 minutes (optional thicker body).',
        'Blend with hemp protein, cinnamon, sweetener, and ice.',
        'Pulse to desired texture.'
      ]
    }
  },
  // ... (add absorptionTime and leucineContent to all other recipes similarly)
];

// ... (rest of the data remains the same)

export default function PlantBasedProteinPage() {
  const {
    addToFavorites,
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState<'browse'|'protein-types'|'goals'|'featured'>('browse');
  const [selectedProteinType, setSelectedProteinType] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedAllergen, setSelectedAllergen] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating'|'protein'|'price'|'calories'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // RecipeKit refs
  const kitRefs = useRef<Record<string, RecipeKitHandle | null>>({});

  // deep-link (?id=plant-7) — scroll card into view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      const el = document.getElementById(`card-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleSharePage = async () => {
    const shareData = {
      title: 'Plant-Based Protein',
      text: 'Explore plant-based protein options, types, and benefits.',
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
    const text = `${shake.name} • ${shake.flavor} • ${shake.proteinSource}\n${preview || (shake.ingredients?.slice(0,4)?.join(', ') ?? '')}`;
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
    setSelectedRecipe(recipe);
    setShowKit(true);
  };

  const handleCompleteRecipe = () => {
    if (selectedRecipe) {
      const drinkData = {
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: 'protein-shakes' as const,
        description: selectedRecipe.description,
        ingredients: selectedRecipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || [],
        nutrition: selectedRecipe.nutrition,
        difficulty: selectedRecipe.difficulty as 'Easy' | 'Medium' | 'Hard',
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        fitnessGoal: selectedRecipe.fitnessGoal,
        bestTime: selectedRecipe.bestTime
      };
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(25);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredShakes = () => {
    let filtered = plantBasedShakes.filter(shake => {
      const matchesSearch =
        shake.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shake.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedProteinType || shake.proteinType === selectedProteinType;
      const matchesGoal = !selectedGoal || shake.fitnessGoal.toLowerCase().includes(selectedGoal.toLowerCase());
      const matchesAllergen =
        !selectedAllergen ||
        (shake.allergenFree || []).some((a: string) => (a || '').toLowerCase().includes(selectedAllergen.toLowerCase()));
      return matchesSearch && matchesType && matchesGoal && matchesAllergen;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
        case 'price': return (a.price || 0) - (b.price || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredShakes = getFilteredShakes();
  const featuredShakes = plantBasedShakes.filter(shake => shake.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setShowUniversalSearch(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">Search All Drinks</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowUniversalSearch(false)}>
                <span className="sr-only">Close</span>✕
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
          accent="green"
          pointsReward={25}
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
              <Link href="/drinks/protein-shakes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Protein Shakes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Leaf className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Plant-Based Protein</h1>
                <Badge className="bg-green-100 text-green-800">Vegan</Badge>
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
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cross-Hub Navigation */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
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

        {/* Sister Subpages */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Protein Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                      <Icon className="h-4 w-4 mr-2 text-green-600" />
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
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">21g</div><div className="text-sm text-gray-600">Avg Protein</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-600">0mg</div><div className="text-sm text-gray-600">Cholesterol</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-purple-600">100%</div><div className="text-sm text-gray-600">Plant-Based</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{plantBasedShakes.length}</div><div className="text-sm text-gray-600">Protein Options</div></CardContent></Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'protein-types', label: 'Protein Types', icon: Leaf },
            { id: 'goals', label: 'By Goal', icon: Target },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map((tab: any) => {
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

        {/* Browse */}
        {activeTab === 'browse' && (
          <div>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search plant-based proteins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={selectedProteinType} onChange={(e) => setSelectedProteinType(e.target.value)}>
                  <option value="">All Protein Types</option>
                  {proteinTypes.map(type => (<option key={type.id} value={type.id}>{type.name}</option>))}
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value)}>
                  <option value="">All Goals</option>
                  {fitnessGoals.map(goal => (<option key={goal.id} value={goal.name}>{goal.name}</option>))}
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={selectedAllergen} onChange={(e) => setSelectedAllergen(e.target.value)}>
                  <option value="">All Allergen-Free</option>
                  <option value="Dairy">Dairy-Free</option>
                  <option value="Soy">Soy-Free</option>
                  <option value="Gluten">Gluten-Free</option>
                  <option value="Nuts">Nut-Free</option>
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
                  <option value="price">Sort by Price</option>
                  <option value="calories">Sort by Calories</option>
                </select>
              </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShakes.map(shake => {
                const useMetric = !!metricFlags[shake.id];
                const servings = servingsById[shake.id] ?? (shake.recipe?.servings || 1);

                return (
                  <Card key={shake.id} id={`card-${shake.id}`} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{shake.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{shake.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addToFavorites({
                            id: shake.id,
                            name: shake.name,
                            category: 'protein-shakes',
                            description: shake.description,
                            ingredients: shake.recipe?.measurements?.map(m => m.item) ?? [],
                            nutrition: shake.nutrition,
                            difficulty: shake.difficulty,
                            prepTime: shake.prepTime,
                            rating: shake.rating,
                            fitnessGoal: shake.fitnessGoal,
                            bestTime: shake.bestTime
                          })}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(shake.id) ? 'fill-red-500 text-red-500' : ''}`} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-100 text-green-800">{shake.proteinSource}</Badge>
                        <Badge variant="outline">{shake.flavor}</Badge>
                        {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>

                      {/* MOVED: Rating and Difficulty just above recipe box */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{shake.rating}</span>
                          <span className="text-gray-500 text-sm">({shake.reviews})</span>
                        </div>
                        <Badge variant="outline">{shake.difficulty}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Nutrition */}
                      <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                        <div><div className="text-xl font-bold text-green-600">{shake.nutrition.protein}g</div><div className="text-gray-500">Protein</div></div>
                        <div><div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div><div className="text-gray-500">Cal</div></div>
                        <div><div className="text-xl font-bold text-purple-600">{shake.nutrition.fiber ?? '—'}{shake.nutrition.fiber ? 'g':''}</div><div className="text-gray-500">Fiber</div></div>
                        <div><div className="text-xl font-bold text-amber-600">${shake.price}</div><div className="text-gray-500">Price</div></div>
                      </div>

                      {/* Compact measured recipe preview + inline actions (Whey/Egg pattern) */}
                      {shake.recipe?.measurements && (
                        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-900">
                              Recipe (serves {servings})
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [shake.id]: clamp((prev[shake.id] ?? (shake.recipe?.servings || 1)) - 1) }))
                                }
                                aria-label="decrease servings"
                              >
                                −
                              </button>
                              <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [shake.id]: clamp((prev[shake.id] ?? (shake.recipe?.servings || 1)) + 1) }))
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
                                  next[shake.id] = shake.recipe?.servings || 1;
                                  return next;
                                })}
                                title="Reset servings"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                              </Button>
                            </div>
                          </div>

                          <ul className="text-sm leading-6 text-gray-800 space-y-1">
                            {shake.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                              const isNum = typeof ing.amount === 'number';
                              const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                              const show = useMetric && isNum
                                ? { amount: Math.round(Number(ing.amount) * servings), unit: 'g' } // Simplified metric conversion
                                : { amount: scaledDisplay, unit: ing.unit };

                              return (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-green-600 mt-0.5" />
                                  <span>
                                    <span className="text-green-700 font-semibold">
                                      {show.amount} {show.unit}
                                    </span>{" "}
                                    {ing.item}
                                    {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                  </span>
                                </li>
                              );
                            })}
                            {shake.recipe.measurements.length > 4 && (
                              <li className="text-xs text-gray-600">
                                …plus {shake.recipe.measurements.length - 4} more •{" "}
                                <button
                                  type="button"
                                  onClick={() => openRecipeModal(shake)}
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
                                const lines = (shake.recipe?.measurements || []).map((ing: Measured) => {
                                  if (useMetric && typeof ing.amount === 'number') {
                                    return `- ${Math.round(Number(ing.amount) * servings)}g ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                                  }
                                  const scaled = typeof ing.amount === 'number' ? scaleAmount(ing.amount, servings) : ing.amount;
                                  return `- ${scaled} ${ing.unit} ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                                });
                                const txt = `${shake.name} (serves ${servings})\n${lines.join('\n')}`;
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
                            <Button variant="outline" size="sm" onClick={() => handleShareShake(shake, servings)}>
                              <Share2 className="w-4 h-4 mr-1" /> Share
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setMetricFlags((prev) => ({ ...prev, [shake.id]: !prev[shake.id] }))
                              }
                            >
                              {useMetric ? 'US' : 'Metric'}
                            </Button>
                          </div>

                          {/* ADDED: Absorption content below recipe box */}
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="text-center">
                                <div className="font-semibold text-gray-700">Absorption:</div>
                                <div className="text-blue-600 font-medium">{shake.absorptionTime}</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-gray-700">Leucine:</div>
                                <div className="text-green-600 font-medium">{shake.leucineContent}</div>
                              </div>
                            </div>
                            <div className="text-center mt-2">
                              <div className="font-semibold text-gray-700">Best Time:</div>
                              <div className="text-purple-600 font-medium text-sm">{shake.bestTime}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tags moved below recipe box */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {shake.certifications.map((cert: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">{cert}</Badge>
                        ))}
                      </div>

                      {/* Full-width CTA only (no extra Share next to it) */}
                      <div className="mt-3">
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700"
                          size="sm"
                          onClick={() => openRecipeModal(shake)}
                        >
                          <Dumbbell className="h-4 w-4 mr-1" />
                          Make Shake (+25 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ... (rest of the tabs remain the same) */}

        {/* Progress */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-purple-600">Level {userProgress.level}</Badge>
                  <Badge variant="outline" className="text-blue-600">{userProgress.totalPoints} XP</Badge>
                  <Badge variant="outline" className="text-green-600">{userProgress.totalDrinksMade} Drinks Made</Badge>
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
