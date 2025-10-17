import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Cat, Dog, Bird, Rabbit, Clock, Heart, Star, Shield, Sparkles,
  Search, Share2, ArrowLeft, Check, Clipboard, RotateCcw, Zap, Award, ArrowRight, X, Home, Crown, Fish, Target
} from 'lucide-react';
import RecipeKit from '@/components/recipes/RecipeKit';

// Helpers
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

const toMetric = (unit: string, amount: number) => {
  const gramsPerCup = 240, gramsPerTbsp = 15, gramsPerTsp = 5, gramsPerLb = 453.6, gramsPerOz = 28.35;
  switch (unit) {
    case 'cup': case 'cups': return { amount: Math.round(amount * gramsPerCup), unit: 'g' };
    case 'tbsp': return { amount: Math.round(amount * gramsPerTbsp), unit: 'g' };
    case 'tsp': return { amount: Math.round(amount * gramsPerTsp), unit: 'g' };
    case 'lb': case 'lbs': return { amount: Math.round(amount * gramsPerLb), unit: 'g' };
    case 'oz': return { amount: Math.round(amount * gramsPerOz), unit: 'g' };
    default: return { amount, unit };
  }
};

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

// Sister pages (excluding current page)
const sisterPetFoodPages = [
  { id: 'dogs', name: 'Dogs', path: '/pet-food/dogs', icon: Dog, description: 'Puppy to senior' },
  { id: 'birds', name: 'Birds', path: '/pet-food/birds', icon: Bird, description: 'Seed & fruit mixes' },
  { id: 'small-pets', name: 'Small Pets', path: '/pet-food/small-pets', icon: Rabbit, description: 'Rabbits & rodents' }
];

// Cat recipes - 9 total
const catRecipes = [
  {
    id: 'cat-1',
    name: 'Kitten Growth Formula',
    category: 'Kitten',
    difficulty: 'Easy',
    prepTime: 20,
    rating: 4.9,
    reviews: 428,
    nutrition: { calories: 385, protein: 35, fat: 18, carbs: 12 },
    taurine: 'High',
    badges: ['High Protein', 'Taurine-Rich', 'Kitten'],
    recipe: {
      servings: 3,
      measurements: [
        m(1.5, 'lbs', 'chicken thighs (with skin)'),
        m(4, 'oz', 'chicken liver'),
        m(2, 'oz', 'chicken heart'),
        m(0.25, 'cups', 'bone broth'),
        m(2, 'tbsp', 'fish oil'),
        m(1, 'tsp', 'taurine supplement'),
        m(0.5, 'tsp', 'calcium powder')
      ],
      directions: [
        'Bake chicken thighs at 375°F until fully cooked',
        'Sauté liver and heart until cooked through',
        'Remove bones and chop meat finely',
        'Combine all meats in food processor',
        'Add bone broth and pulse to desired consistency',
        'Mix in fish oil, taurine, and calcium'
      ]
    }
  },
  {
    id: 'cat-2',
    name: 'Adult Salmon & Tuna Bowl',
    category: 'Adult',
    difficulty: 'Easy',
    prepTime: 25,
    rating: 4.8,
    reviews: 612,
    nutrition: { calories: 360, protein: 32, fat: 16, carbs: 8 },
    taurine: 'Very High',
    badges: ['High Protein', 'Omega-3', 'Adult'],
    recipe: {
      servings: 4,
      measurements: [
        m(1, 'lb', 'fresh salmon'),
        m(8, 'oz', 'canned tuna in water'),
        m(4, 'oz', 'turkey liver'),
        m(1, 'whole', 'egg, hard boiled'),
        m(2, 'tbsp', 'olive oil'),
        m(1, 'tsp', 'taurine supplement'),
        m(0.5, 'cups', 'pumpkin puree')
      ],
      directions: [
        'Bake salmon until flaky, remove any bones',
        'Cook turkey liver thoroughly',
        'Hard boil egg, remove shell',
        'Combine salmon, tuna (drained), and liver',
        'Chop egg and mix in',
        'Add pumpkin puree and mix in olive oil and taurine'
      ]
    }
  },
  {
    id: 'cat-3',
    name: 'Senior Gentle Turkey Care',
    category: 'Senior',
    difficulty: 'Easy',
    prepTime: 30,
    rating: 4.9,
    reviews: 389,
    nutrition: { calories: 320, protein: 30, fat: 14, carbs: 10 },
    taurine: 'High',
    badges: ['Senior', 'Easy Digest', 'Kidney Support'],
    recipe: {
      servings: 3,
      measurements: [
        m(1.5, 'lbs', 'ground turkey'),
        m(4, 'oz', 'turkey liver'),
        m(0.5, 'cups', 'cooked white rice'),
        m(2, 'tbsp', 'bone broth'),
        m(1, 'tbsp', 'salmon oil'),
        m(1, 'tsp', 'taurine supplement'),
        m(0.25, 'tsp', 'omega-3 powder')
      ],
      directions: [
        'Cook ground turkey until well done',
        'Sauté liver until cooked through',
        'Cook rice until very soft',
        'Combine turkey, liver, and rice',
        'Add bone broth for moisture',
        'Mix in salmon oil, taurine, and omega-3'
      ]
    }
  },
  {
    id: 'cat-4',
    name: 'High Protein Beef Power',
    category: 'Special Diet',
    difficulty: 'Medium',
    prepTime: 25,
    rating: 4.7,
    reviews: 334,
    nutrition: { calories: 395, protein: 38, fat: 20, carbs: 6 },
    taurine: 'Very High',
    badges: ['Very High Protein', 'Low Carb', 'Muscle Building'],
    recipe: {
      servings: 4,
      measurements: [
        m(1.5, 'lbs', 'lean ground beef'),
        m(6, 'oz', 'beef heart'),
        m(4, 'oz', 'beef liver'),
        m(2, 'whole', 'eggs'),
        m(3, 'tbsp', 'beef tallow'),
        m(2, 'tsp', 'taurine supplement'),
        m(1, 'tsp', 'vitamin E')
      ],
      directions: [
        'Brown ground beef thoroughly',
        'Cook heart and liver until done',
        'Scramble eggs',
        'Chop heart and liver into small pieces',
        'Combine all ingredients',
        'Mix in tallow while warm, add taurine and vitamin E'
      ]
    }
  },
  {
    id: 'cat-5',
    name: 'Low Carb Chicken Medley',
    category: 'Special Diet',
    difficulty: 'Easy',
    prepTime: 30,
    rating: 4.8,
    reviews: 267,
    nutrition: { calories: 350, protein: 34, fat: 17, carbs: 4 },
    taurine: 'High',
    badges: ['Low Carb', 'Diabetic-Friendly', 'Weight Control'],
    recipe: {
      servings: 4,
      measurements: [
        m(1.5, 'lbs', 'chicken breast and thighs'),
        m(4, 'oz', 'chicken liver'),
        m(2, 'oz', 'chicken heart'),
        m(0.25, 'cups', 'zucchini, finely diced'),
        m(2, 'tbsp', 'coconut oil'),
        m(1.5, 'tsp', 'taurine supplement'),
        m(0.5, 'tsp', 'psyllium husk')
      ],
      directions: [
        'Cook chicken pieces until done',
        'Sauté liver and heart',
        'Steam zucchini until soft',
        'Chop all meats to appropriate size',
        'Combine with zucchini',
        'Mix in coconut oil and taurine, add psyllium husk'
      ]
    }
  },
  {
    id: 'cat-6',
    name: 'Hairball Control Formula',
    category: 'Special Diet',
    difficulty: 'Easy',
    prepTime: 25,
    rating: 4.6,
    reviews: 298,
    nutrition: { calories: 340, protein: 31, fat: 15, carbs: 12 },
    taurine: 'High',
    badges: ['Hairball Control', 'High Fiber', 'Indoor Cats'],
    recipe: {
      servings: 4,
      measurements: [
        m(1.5, 'lbs', 'white fish (cod or tilapia)'),
        m(4, 'oz', 'turkey'),
        m(0.5, 'cups', 'pumpkin puree'),
        m(2, 'tbsp', 'psyllium husk'),
        m(2, 'tbsp', 'fish oil'),
        m(1, 'tsp', 'taurine supplement'),
        m(0.5, 'cups', 'cooked oat bran')
      ],
      directions: [
        'Bake fish until flaky',
        'Cook turkey thoroughly',
        'Cook oat bran with extra water',
        'Combine fish and turkey',
        'Mix in pumpkin puree and oat bran',
        'Add psyllium husk, fish oil, and taurine'
      ]
    }
  },
  {
    id: 'cat-7',
    name: 'Urinary Health Support',
    category: 'Special Diet',
    difficulty: 'Medium',
    prepTime: 30,
    rating: 4.9,
    reviews: 412,
    nutrition: { calories: 330, protein: 33, fat: 16, carbs: 8 },
    taurine: 'Very High',
    badges: ['Urinary Health', 'High Moisture', 'pH Balanced'],
    recipe: {
      servings: 3,
      measurements: [
        m(1, 'lb', 'chicken breast'),
        m(6, 'oz', 'white fish'),
        m(4, 'oz', 'chicken liver'),
        m(0.5, 'cups', 'bone broth (extra for moisture)'),
        m(1, 'tbsp', 'cranberry powder'),
        m(2, 'tsp', 'taurine supplement'),
        m(1, 'tsp', 'vitamin C')
      ],
      directions: [
        'Poach chicken breast in water',
        'Steam white fish',
        'Cook liver thoroughly',
        'Shred all proteins finely',
        'Add extra bone broth for high moisture',
        'Mix in cranberry powder, taurine, and vitamin C'
      ]
    }
  },
  {
    id: 'cat-8',
    name: 'Sensitive Stomach Soother',
    category: 'Special Diet',
    difficulty: 'Easy',
    prepTime: 35,
    rating: 4.7,
    reviews: 245,
    nutrition: { calories: 310, protein: 29, fat: 13, carbs: 14 },
    taurine: 'High',
    badges: ['Limited Ingredient', 'Easy Digest', 'Sensitive Stomach'],
    recipe: {
      servings: 3,
      measurements: [
        m(1.5, 'lbs', 'ground turkey (lean)'),
        m(0.5, 'cups', 'sweet potato, well cooked'),
        m(2, 'tbsp', 'bone broth'),
        m(1, 'tbsp', 'pumpkin puree'),
        m(1, 'tbsp', 'turkey fat'),
        m(1.5, 'tsp', 'taurine supplement'),
        m(0.5, 'tsp', 'probiotics')
      ],
      directions: [
        'Cook turkey very thoroughly',
        'Bake sweet potato until very soft, mash well',
        'Combine turkey and sweet potato',
        'Mix in bone broth and pumpkin',
        'Add turkey fat and taurine',
        'Add probiotics after cooling to room temperature'
      ]
    }
  },
  {
    id: 'cat-9',
    name: 'Complete Balance Fish Feast',
    category: 'Adult',
    difficulty: 'Medium',
    prepTime: 30,
    rating: 4.8,
    reviews: 356,
    nutrition: { calories: 370, protein: 33, fat: 18, carbs: 9 },
    taurine: 'Very High',
    badges: ['Balanced', 'Omega-Rich', 'Complete Nutrition'],
    recipe: {
      servings: 4,
      measurements: [
        m(1, 'lb', 'mackerel'),
        m(8, 'oz', 'chicken breast'),
        m(4, 'oz', 'chicken liver'),
        m(1, 'whole', 'egg yolk'),
        m(2, 'tbsp', 'fish oil'),
        m(1.5, 'tsp', 'taurine supplement'),
        m(0.5, 'cups', 'cooked pumpkin')
      ],
      directions: [
        'Bake mackerel until cooked, remove bones',
        'Poach chicken breast',
        'Cook liver thoroughly',
        'Combine all proteins',
        'Mix in egg yolk and pumpkin',
        'Add fish oil and taurine supplement'
      ]
    }
  }
];

export default function CatsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'time'>('rating');
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const categories = ['All', 'Kitten', 'Adult', 'Senior', 'Special Diet'];

  const filteredRecipes = useMemo(() => {
    let filtered = catRecipes.filter(recipe => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || recipe.name.toLowerCase().includes(q) || recipe.badges.some((badge: string) => badge.toLowerCase().includes(q));
      const matchesCategory = !selectedCategory || selectedCategory === 'All' || recipe.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition?.protein || 0) - (a.nutrition?.protein || 0);
        case 'calories': return (a.nutrition?.calories || 0) - (b.nutrition?.calories || 0);
        case 'time': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  }, [searchQuery, selectedCategory, sortBy]);

  const openRecipeModal = (recipe: any) => {
    setSelectedRecipe(recipe);
    setShowKit(true);
  };

  const handleCompleteRecipe = () => {
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const handleShareRecipe = async (recipe: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[recipe.id] ?? recipe.recipe?.servings ?? 1;
    const preview = (recipe?.recipe?.measurements || [])
      .slice(0, 4)
      .map((r: Measured) => {
        const scaled = typeof r.amount === 'number' ? `${scaleAmount(r.amount, servings)} ${r.unit}` : `${r.amount} ${r.unit}`;
        return `${scaled} ${r.item}`;
      })
      .join(' · ');
    const text = `${recipe.name} • Taurine: ${recipe.taurine}\n${preview || ''}`;
    const shareData = { title: recipe.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${recipe.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${recipe.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-fuchsia-50">
      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="purple"
          pointsReward={40}
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
              <Link href="/pet-food">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Pet Food
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Cat className="h-6 w-6 text-purple-600" />
                <h1 className="text-2xl font-bold text-gray-900">Cat Food Recipes</h1>
                <Badge className="bg-purple-100 text-purple-800">9 Recipes</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sister Pages Navigation */}
        <Card className="bg-gradient-to-r from-amber-50 to-emerald-50 border-amber-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Pet Food Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {sisterPetFoodPages.map((page) => {
                const Icon = page.icon;
                return (
                  <Link key={page.id} href={page.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                      <Icon className="h-4 w-4 mr-2 text-purple-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{page.name}</div>
                        <div className="text-xs text-gray-500">{page.description}</div>
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
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-purple-600">32g+</div><div className="text-sm text-gray-600">Avg Protein</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-pink-600">4.8★</div><div className="text-sm text-gray-600">Avg Rating</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-purple-600">27 min</div><div className="text-sm text-gray-600">Avg Prep</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-pink-600">9</div><div className="text-sm text-gray-600">Recipes</div></CardContent></Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input placeholder="Search cat food recipes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2">
            <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.filter(c => c !== 'All').map(cat => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
            <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="rating">Sort by Rating</option>
              <option value="protein">Sort by Protein</option>
              <option value="calories">Sort by Calories</option>
              <option value="time">Sort by Prep Time</option>
            </select>
          </div>
        </div>

        {/* Safety Card */}
        <Card className="mb-8 border-purple-200 bg-purple-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900 text-lg">
              <Shield className="h-5 w-5" />
              Important Safety Tips for Cats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-2 text-purple-900">✓ Safe for Cats:</div>
                <ul className="space-y-1 text-purple-800 ml-4">
                  <li>• Chicken, turkey, beef (cooked)</li>
                  <li>• Fish (salmon, tuna, white fish)</li>
                  <li>• Liver and heart (in moderation)</li>
                  <li>• Eggs (cooked)</li>
                  <li>• Small amounts of pumpkin, zucchini</li>
                  <li>• MUST include taurine supplement</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2 text-red-700">✗ Toxic for Cats:</div>
                <ul className="space-y-1 text-red-700 ml-4">
                  <li>• Onions, garlic, chives, leeks</li>
                  <li>• Grapes, raisins</li>
                  <li>• Chocolate, caffeine, alcohol</li>
                  <li>• Xylitol (artificial sweetener)</li>
                  <li>• Raw dough, bones</li>
                  <li>• Lilies and many houseplants</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-3 bg-pink-100 rounded-lg border border-pink-300">
              <p className="text-sm text-pink-900 font-semibold">
                ⚠️ CRITICAL: Cats require TAURINE in their diet - they cannot produce it themselves. All homemade cat food MUST include taurine supplements.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map(recipe => {
            const useMetric = !!metricFlags[recipe.id];
            const servings = servingsById[recipe.id] ?? (recipe.recipe?.servings || 1);

            return (
              <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{recipe.name}</CardTitle>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">{recipe.category}</Badge>
                        {recipe.badges.slice(0, 2).map((badge: string) => (
                          <Badge key={badge} className="bg-purple-100 text-purple-800 text-xs">{badge}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Taurine Badge */}
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-2 mb-3">
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-pink-600" />
                      <span className="font-semibold text-pink-900">Taurine: {recipe.taurine}</span>
                    </div>
                  </div>

                  {/* Nutrition Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                    <div><div className="font-bold text-purple-600">{recipe.nutrition?.protein ?? '—'}{recipe.nutrition?.protein ? 'g' : ''}</div><div className="text-gray-500">Protein</div></div>
                    <div><div className="font-bold text-pink-600">{recipe.nutrition?.calories ?? '—'}</div><div className="text-gray-500">Calories</div></div>
                    <div><div className="font-bold text-purple-600">{recipe.prepTime}min</div><div className="text-gray-500">Prep</div></div>
                  </div>

                  {/* Difficulty & Reviews */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{recipe.rating}</span>
                      <span className="text-gray-500 text-sm">({recipe.reviews})</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{recipe.difficulty}</Badge>
                  </div>

                  {/* Recipe preview */}
                  {recipe.recipe?.measurements && (
                    <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-900">Recipe (serves {servings})</div>
                        <div className="flex items-center gap-2">
                          <button className="px-2 py-1 border rounded text-sm" onClick={() => setServingsById(prev => ({ ...prev, [recipe.id]: clamp((prev[recipe.id] ?? (recipe.recipe?.servings || 1)) - 1) }))}>−</button>
                          <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                          <button className="px-2 py-1 border rounded text-sm" onClick={() => setServingsById(prev => ({ ...prev, [recipe.id]: clamp((prev[recipe.id] ?? (recipe.recipe?.servings || 1)) + 1) }))}>+</button>
                          <Button variant="outline" size="sm" onClick={() => setServingsById(prev => { const next = { ...prev }; next[recipe.id] = recipe.recipe?.servings || 1; return next; })} title="Reset servings"><RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset</Button>
                        </div>
                      </div>

                      <ul className="text-sm leading-6 text-gray-800 space-y-1">
                        {recipe.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                          const isNum = typeof ing.amount === 'number';
                          const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                          const show = useMetric && isNum ? toMetric(ing.unit, Number((typeof ing.amount === 'number' ? (ing.amount as number) : parseFloat(String(ing.amount))) * servings)) : { amount: scaledDisplay, unit: ing.unit };

                          return (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-purple-600 mt-0.5" />
                              <span><span className="text-purple-700 font-semibold">{show.amount} {show.unit}</span> {ing.item}{ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}</span>
                            </li>
                          );
                        })}
                        {recipe.recipe.measurements.length > 4 && (
                          <li className="text-xs text-gray-600">…plus {recipe.recipe.measurements.length - 4} more • <button type="button" onClick={() => openRecipeModal(recipe)} className="underline underline-offset-2">Show more</button></li>
                        )}
                      </ul>

                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" onClick={async () => {
                          const lines = (recipe.recipe?.measurements || []).map((ing: Measured) => {
                            if (useMetric && typeof ing.amount === 'number') {
                              const mm = toMetric(ing.unit, Number(ing.amount) * servings);
                              return `- ${mm.amount} ${mm.unit} ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                            }
                            const scaled = typeof ing.amount === 'number' ? scaleAmount(ing.amount, servings) : ing.amount;
                            return `- ${scaled} ${ing.unit} ${ing.item}${(ing.note ? ` — ${ing.note}` : '')}`;
                          });
                          const txt = `${recipe.name} (serves ${servings})\n${lines.join('\n')}`;
                          try { await navigator.clipboard.writeText(txt); alert('Recipe copied!'); } catch { alert('Unable to copy on this device.'); }
                        }}><Clipboard className="w-4 h-4 mr-1" /> Copy</Button>
                        <Button variant="outline" size="sm" onClick={() => handleShareRecipe(recipe, servings)}><Share2 className="w-4 h-4 mr-1" /> Share</Button>
                        <Button variant="outline" size="sm" onClick={() => setMetricFlags((prev) => ({ ...prev, [recipe.id]: !prev[recipe.id] }))}>{useMetric ? 'US' : 'Metric'}</Button>
                      </div>
                    </div>
                  )}

                  {/* Tags - PURPLE color */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {recipe.badges.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-200">{tag}</Badge>
                    ))}
                  </div>

                  {/* Action */}
                  <div className="mt-3">
                    <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => openRecipeModal(recipe)}>
                      <Zap className="h-4 w-4 mr-2" />Make Recipe (+40 XP)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Progress Card */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2 text-purple-900">Your Cat Food Journey</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-purple-700">Level 1</Badge>
                  <Badge variant="outline" className="text-purple-700">2/9 Recipes</Badge>
                </div>
              </div>
              <Crown className="h-12 w-12 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
