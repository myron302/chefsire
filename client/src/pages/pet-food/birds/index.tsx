import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bird, Dog, Cat, Rabbit, Clock, Heart, Star, Shield, AlertTriangle,
  Search, Share2, ArrowLeft, Check, Clipboard, RotateCcw, Zap, Award, ArrowRight, X, Home, Crown, Leaf, Target
} from 'lucide-react';
import RecipeKit from '@/components/recipes/RecipeKit';

// Helpers
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

const toMetric = (unit: string, amount: number) => {
  const gramsPerCup = 240, gramsPerTbsp = 15, gramsPerTsp = 5;
  switch (unit) {
    case 'cup': case 'cups': return { amount: Math.round(amount * gramsPerCup), unit: 'g' };
    case 'tbsp': return { amount: Math.round(amount * gramsPerTbsp), unit: 'g' };
    case 'tsp': return { amount: Math.round(amount * gramsPerTsp), unit: 'g' };
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
  { id: 'cats', name: 'Cats', path: '/pet-food/cats', icon: Cat, description: 'Kitten to senior' },
  { id: 'small-pets', name: 'Small Pets', path: '/pet-food/small-pets', icon: Rabbit, description: 'Rabbits & rodents' }
];

// Bird recipes - 9 total
const birdRecipes = [
  {
    id: 'bird-1',
    name: 'Parrot Power Mix',
    category: 'Parrots',
    difficulty: 'Easy',
    prepTime: 15,
    rating: 4.9,
    reviews: 287,
    nutrition: { calories: 180, protein: 12, fat: 15, carbs: 38 },
    badges: ['High Energy', 'Nut-Rich', 'Parrots'],
    recipe: {
      servings: 2,
      measurements: [
        m(0.5, 'cups', 'raw almonds'),
        m(0.25, 'cups', 'raw walnuts'),
        m(0.25, 'cups', 'dried papaya'),
        m(0.25, 'cups', 'dried mango'),
        m(2, 'tbsp', 'sunflower seeds'),
        m(2, 'tbsp', 'pumpkin seeds'),
        m(1, 'tbsp', 'chia seeds')
      ],
      directions: [
        'Chop almonds and walnuts into smaller pieces',
        'Dice dried fruits into bite-sized pieces',
        'Mix all seeds together',
        'Combine nuts, fruits, and seeds thoroughly',
        'Store in airtight container',
        'Serve 2-3 tablespoons per day for medium parrots'
      ]
    }
  },
  {
    id: 'bird-2',
    name: 'Canary Premium Seed Blend',
    category: 'Canaries',
    difficulty: 'Easy',
    prepTime: 10,
    rating: 4.8,
    reviews: 342,
    nutrition: { calories: 140, protein: 14, fat: 12, carbs: 32 },
    badges: ['Seed Mix', 'Singing Support', 'Canaries'],
    recipe: {
      servings: 3,
      measurements: [
        m(1, 'cup', 'canary grass seed'),
        m(0.5, 'cups', 'millet (white and red)'),
        m(0.25, 'cups', 'rapeseed'),
        m(0.25, 'cups', 'niger seed'),
        m(2, 'tbsp', 'flax seeds'),
        m(2, 'tbsp', 'hemp seeds'),
        m(1, 'tbsp', 'sesame seeds')
      ],
      directions: [
        'Mix all seeds in large bowl',
        'Ensure even distribution',
        'Store in cool, dry place',
        'Provide 1-2 teaspoons per day',
        'Supplement with fresh greens',
        'Always provide fresh water'
      ]
    }
  },
  {
    id: 'bird-3',
    name: 'Finch Fruit & Seed Delight',
    category: 'Finches',
    difficulty: 'Easy',
    prepTime: 12,
    rating: 4.7,
    reviews: 198,
    nutrition: { calories: 125, protein: 10, fat: 8, carbs: 28 },
    badges: ['Fruit & Seed', 'Small Birds', 'Finches'],
    recipe: {
      servings: 2,
      measurements: [
        m(0.5, 'cups', 'millet'),
        m(0.25, 'cups', 'canary seed'),
        m(0.25, 'cups', 'dried currants'),
        m(2, 'tbsp', 'dried cranberries, chopped'),
        m(2, 'tbsp', 'oat groats'),
        m(1, 'tbsp', 'niger seed'),
        m(1, 'tbsp', 'dried apple, finely diced')
      ],
      directions: [
        'Mix all seeds together',
        'Chop dried fruits into tiny pieces',
        'Combine seeds and fruits',
        'Store in sealed container',
        'Offer 1 teaspoon per finch daily',
        'Provide cuttlebone for calcium'
      ]
    }
  },
  {
    id: 'bird-4',
    name: 'Budgie Veggie Garden Bowl',
    category: 'Budgies',
    difficulty: 'Easy',
    prepTime: 15,
    rating: 4.9,
    reviews: 423,
    nutrition: { calories: 95, protein: 8, fat: 5, carbs: 22 },
    badges: ['Fresh Veggies', 'Low Fat', 'Budgies'],
    recipe: {
      servings: 1,
      measurements: [
        m(0.25, 'cups', 'finely chopped broccoli'),
        m(0.25, 'cups', 'grated carrot'),
        m(2, 'tbsp', 'chopped spinach'),
        m(2, 'tbsp', 'millet'),
        m(1, 'tbsp', 'quinoa (cooked)'),
        m(1, 'tsp', 'sesame seeds'),
        m(1, 'small piece', 'apple (no seeds)')
      ],
      directions: [
        'Wash all vegetables thoroughly',
        'Chop broccoli into tiny florets',
        'Grate carrot finely',
        'Cook quinoa and let cool',
        'Mix all ingredients together',
        'Serve fresh daily'
      ]
    }
  },
  {
    id: 'bird-5',
    name: 'Cockatiel Morning Feast',
    category: 'Cockatiels',
    difficulty: 'Medium',
    prepTime: 20,
    rating: 4.8,
    reviews: 312,
    nutrition: { calories: 165, protein: 11, fat: 13, carbs: 35 },
    badges: ['Balanced Diet', 'Nutrient-Rich', 'Cockatiels'],
    recipe: {
      servings: 2,
      measurements: [
        m(0.5, 'cups', 'millet spray'),
        m(0.25, 'cups', 'safflower seeds'),
        m(0.25, 'cups', 'oat groats'),
        m(2, 'tbsp', 'dried banana chips'),
        m(2, 'tbsp', 'pumpkin seeds'),
        m(1, 'tbsp', 'flax seeds'),
        m(1, 'tbsp', 'dried coconut')
      ],
      directions: [
        'Break up millet spray into smaller pieces',
        'Chop banana chips into small bits',
        'Mix all seeds together',
        'Add dried fruits and coconut',
        'Store in airtight container',
        'Serve 2 tablespoons per bird daily'
      ]
    }
  },
  {
    id: 'bird-6',
    name: 'Lovebird Tropical Paradise',
    category: 'Lovebirds',
    difficulty: 'Easy',
    prepTime: 18,
    rating: 4.9,
    reviews: 267,
    nutrition: { calories: 155, protein: 10, fat: 11, carbs: 32 },
    badges: ['Tropical Fruits', 'Colorful', 'Lovebirds'],
    recipe: {
      servings: 2,
      measurements: [
        m(0.25, 'cups', 'dried papaya'),
        m(0.25, 'cups', 'dried pineapple'),
        m(0.25, 'cups', 'dried mango'),
        m(0.25, 'cups', 'sunflower seeds'),
        m(2, 'tbsp', 'pumpkin seeds'),
        m(2, 'tbsp', 'millet'),
        m(1, 'tbsp', 'dried hibiscus flowers')
      ],
      directions: [
        'Dice all dried fruits into small pieces',
        'Mix fruits with seeds',
        'Add crushed hibiscus flowers',
        'Combine thoroughly',
        'Store away from moisture',
        'Offer 1-2 tablespoons daily'
      ]
    }
  },
  {
    id: 'bird-7',
    name: 'Conure Energy Blend',
    category: 'Conures',
    difficulty: 'Medium',
    prepTime: 25,
    rating: 4.7,
    reviews: 189,
    nutrition: { calories: 195, protein: 13, fat: 16, carbs: 40 },
    badges: ['High Energy', 'Active Birds', 'Conures'],
    recipe: {
      servings: 3,
      measurements: [
        m(0.5, 'cups', 'raw cashews'),
        m(0.25, 'cups', 'raw pistachios'),
        m(0.25, 'cups', 'dried berries'),
        m(0.25, 'cups', 'whole oats'),
        m(2, 'tbsp', 'pepitas'),
        m(2, 'tbsp', 'flax seeds'),
        m(1, 'tbsp', 'bee pollen')
      ],
      directions: [
        'Chop nuts into smaller pieces',
        'Mix nuts with dried berries',
        'Add oats and seeds',
        'Sprinkle bee pollen on top',
        'Mix well to distribute',
        'Serve 2-3 tablespoons per bird'
      ]
    }
  },
  {
    id: 'bird-8',
    name: 'Macaw Mega Nut Mix',
    category: 'Macaws',
    difficulty: 'Easy',
    prepTime: 20,
    rating: 4.8,
    reviews: 156,
    nutrition: { calories: 220, protein: 15, fat: 18, carbs: 42 },
    badges: ['Large Birds', 'Nut-Heavy', 'Macaws'],
    recipe: {
      servings: 4,
      measurements: [
        m(0.5, 'cups', 'brazil nuts'),
        m(0.5, 'cups', 'raw almonds'),
        m(0.25, 'cups', 'raw macadamias'),
        m(0.25, 'cups', 'dried papaya chunks'),
        m(0.25, 'cups', 'dried coconut chunks'),
        m(2, 'tbsp', 'pumpkin seeds'),
        m(2, 'tbsp', 'sunflower seeds')
      ],
      directions: [
        'Use whole or halved nuts for large beaks',
        'Cut dried fruits into larger chunks',
        'Mix all ingredients',
        'Store in large airtight container',
        'Serve 1/4 cup per large macaw daily',
        'Monitor for selective eating'
      ]
    }
  },
  {
    id: 'bird-9',
    name: 'Universal Pellet Topper',
    category: 'All Birds',
    difficulty: 'Easy',
    prepTime: 10,
    rating: 4.9,
    reviews: 534,
    nutrition: { calories: 110, protein: 9, fat: 7, carbs: 25 },
    badges: ['Pellet Topper', 'Universal', 'Daily Use'],
    recipe: {
      servings: 3,
      measurements: [
        m(0.5, 'cups', 'mixed seeds (millet, canary)'),
        m(0.25, 'cups', 'finely chopped vegetables'),
        m(2, 'tbsp', 'dried cranberries'),
        m(2, 'tbsp', 'sunflower seeds'),
        m(1, 'tbsp', 'ground flaxseed'),
        m(1, 'tbsp', 'bee pollen'),
        m(1, 'tsp', 'spirulina powder')
      ],
      directions: [
        'Mix all seeds together',
        'Add finely chopped fresh or dried vegetables',
        'Sprinkle with bee pollen and spirulina',
        'Use as topper for pellet food',
        'Add 1-2 tablespoons to daily pellets',
        'Adjust portion based on bird size'
      ]
    }
  }
];

export default function BirdsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'time'>('rating');
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const categories = ['All', 'Parrots', 'Canaries', 'Finches', 'Budgies', 'Cockatiels', 'Lovebirds', 'Conures', 'Macaws', 'All Birds'];

  const filteredRecipes = useMemo(() => {
    let filtered = birdRecipes.filter(recipe => {
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
    const text = `${recipe.name} • ${recipe.category}\n${preview || ''}`;
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
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-sky-50">
      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="cyan"
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
                <Bird className="h-6 w-6 text-cyan-600" />
                <h1 className="text-2xl font-bold text-gray-900">Bird Food Recipes</h1>
                <Badge className="bg-cyan-100 text-cyan-800">9 Recipes</Badge>
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
                    <Button variant="outline" className="w-full justify-start hover:bg-cyan-50 hover:border-cyan-300">
                      <Icon className="h-4 w-4 mr-2 text-cyan-600" />
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
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-cyan-600">11g+</div><div className="text-sm text-gray-600">Avg Protein</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-600">4.8★</div><div className="text-sm text-gray-600">Avg Rating</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-cyan-600">16 min</div><div className="text-sm text-gray-600">Avg Prep</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-600">9</div><div className="text-sm text-gray-600">Recipes</div></CardContent></Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input placeholder="Search bird food recipes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
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
        <Card className="mb-8 border-cyan-200 bg-cyan-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-900 text-lg">
              <Shield className="h-5 w-5" />
              Important Safety Tips for Birds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-2 text-cyan-900">✓ Safe for Birds:</div>
                <ul className="space-y-1 text-cyan-800 ml-4">
                  <li>• Fresh fruits (apples, berries, mango, papaya)</li>
                  <li>• Fresh vegetables (carrots, broccoli, spinach)</li>
                  <li>• Seeds (millet, sunflower, pumpkin, flax)</li>
                  <li>• Nuts (almonds, walnuts, cashews - unsalted)</li>
                  <li>• Grains (oats, quinoa, brown rice)</li>
                  <li>• Flowers (hibiscus, rose petals, dandelion)</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2 text-red-700">✗ Toxic for Birds:</div>
                <ul className="space-y-1 text-red-700 ml-4">
                  <li>• Avocado (highly toxic)</li>
                  <li>• Chocolate, caffeine, alcohol</li>
                  <li>• Salt, sugar (in large amounts)</li>
                  <li>• Onions, garlic, chives</li>
                  <li>• Apple seeds, cherry pits, peach pits</li>
                  <li>• Raw beans, mushrooms</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
              <p className="text-sm text-blue-900 font-semibold">
                ⚠️ IMPORTANT: Remove all fruit pits and apple seeds before feeding. Avoid teflon/non-stick cookware around birds (toxic fumes).
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
                          <Badge key={badge} className="bg-cyan-100 text-cyan-800 text-xs">{badge}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Nutrition Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                    <div><div className="font-bold text-cyan-600">{recipe.nutrition?.protein ?? '—'}{recipe.nutrition?.protein ? 'g' : ''}</div><div className="text-gray-500">Protein</div></div>
                    <div><div className="font-bold text-blue-600">{recipe.nutrition?.calories ?? '—'}</div><div className="text-gray-500">Calories</div></div>
                    <div><div className="font-bold text-cyan-600">{recipe.prepTime}min</div><div className="text-gray-500">Prep</div></div>
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
                              <Check className="h-4 w-4 text-cyan-600 mt-0.5" />
                              <span><span className="text-cyan-700 font-semibold">{show.amount} {show.unit}</span> {ing.item}{ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}</span>
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

                  {/* Tags - CYAN color */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {recipe.badges.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs bg-cyan-100 text-cyan-800 hover:bg-cyan-200">{tag}</Badge>
                    ))}
                  </div>

                  {/* Action */}
                  <div className="mt-3">
                    <Button className="w-full bg-cyan-600 hover:bg-cyan-700" onClick={() => openRecipeModal(recipe)}>
                      <Zap className="h-4 w-4 mr-2" />Make Recipe (+40 XP)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Progress Card */}
        <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2 text-cyan-900">Your Bird Food Journey</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-cyan-700">Level 2</Badge>
                  <Badge variant="outline" className="text-cyan-700">4/9 Recipes</Badge>
                </div>
              </div>
              <Crown className="h-12 w-12 text-cyan-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
