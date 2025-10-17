import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Rabbit, Dog, Cat, Bird, Clock, Heart, Star, Shield,
  Search, Share2, ArrowLeft, Check, Clipboard, RotateCcw, Award, ArrowRight, Home, Crown, Leaf, Target
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
  { id: 'birds', name: 'Birds', path: '/pet-food/birds', icon: Bird, description: 'Seed & fruit mixes' }
];

// Small Pet recipes - 9 total with images
const smallPetRecipes = [
  {
    id: 'small-1',
    name: 'Rabbit Premium Hay Mix',
    category: 'Rabbits',
    difficulty: 'Easy',
    prepTime: 10,
    rating: 4.9,
    reviews: 456,
    image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800',
    nutrition: { calories: 120, protein: 14, fat: 3, fiber: 28 },
    badges: ['High Fiber', 'Timothy Hay', 'Rabbits'],
    recipe: {
      servings: 3,
      measurements: [
        m(2, 'cups', 'timothy hay'),
        m(0.5, 'cups', 'orchard grass hay'),
        m(0.25, 'cups', 'oat hay'),
        m(2, 'tbsp', 'dried dandelion leaves'),
        m(1, 'tbsp', 'dried rose petals'),
        m(1, 'tbsp', 'dried chamomile'),
        m(1, 'tsp', 'dried mint')
      ],
      directions: [
        'Mix all hay varieties thoroughly',
        'Add dried herbs evenly throughout',
        'Store in dry, well-ventilated area',
        'Provide unlimited access daily',
        'Replace uneaten hay after 24 hours',
        'Always ensure fresh water is available'
      ]
    }
  },
  {
    id: 'small-2',
    name: 'Guinea Pig Vitamin C Feast',
    category: 'Guinea Pigs',
    difficulty: 'Easy',
    prepTime: 15,
    rating: 4.8,
    reviews: 523,
    image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800',
    nutrition: { calories: 95, protein: 8, fat: 2, fiber: 18 },
    badges: ['Vitamin C Rich', 'Fresh Veggies', 'Guinea Pigs'],
    recipe: {
      servings: 2,
      measurements: [
        m(0.5, 'cups', 'chopped bell peppers'),
        m(0.25, 'cups', 'kale, chopped'),
        m(0.25, 'cups', 'romaine lettuce'),
        m(2, 'tbsp', 'fresh parsley'),
        m(2, 'tbsp', 'guinea pig pellets'),
        m(1, 'tbsp', 'grated carrot'),
        m(1, 'small slice', 'orange (for vitamin C)')
      ],
      directions: [
        'Wash all vegetables thoroughly',
        'Chop into small, bite-sized pieces',
        'Mix pellets with fresh vegetables',
        'Add orange slice on side',
        'Serve fresh twice daily',
        'Remove uneaten portions after 4 hours'
      ]
    }
  },
  {
    id: 'small-3',
    name: 'Hamster Wholesome Seed Blend',
    category: 'Hamsters',
    difficulty: 'Easy',
    prepTime: 8,
    rating: 4.7,
    reviews: 389,
    image: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=800',
    nutrition: { calories: 140, protein: 12, fat: 8, fiber: 6 },
    badges: ['Balanced', 'Seed Mix', 'Hamsters'],
    recipe: {
      servings: 4,
      measurements: [
        m(0.5, 'cups', 'mixed grains (oats, wheat, barley)'),
        m(0.25, 'cups', 'sunflower seeds'),
        m(0.25, 'cups', 'pumpkin seeds'),
        m(2, 'tbsp', 'mealworms (dried)'),
        m(2, 'tbsp', 'dried corn kernels'),
        m(1, 'tbsp', 'flax seeds'),
        m(1, 'tbsp', 'sesame seeds')
      ],
      directions: [
        'Mix all seeds and grains together',
        'Add dried mealworms for protein',
        'Store in airtight container',
        'Provide 1-2 tablespoons daily',
        'Hide portions in cage for foraging',
        'Supplement with fresh vegetables weekly'
      ]
    }
  },
  {
    id: 'small-4',
    name: 'Gerbil Complete Nutrition Mix',
    category: 'Gerbils',
    difficulty: 'Easy',
    prepTime: 12,
    rating: 4.8,
    reviews: 267,
    image: 'https://images.unsplash.com/photo-1612540448025-ae3523b7d937?w=800',
    nutrition: { calories: 135, protein: 14, fat: 6, fiber: 8 },
    badges: ['Complete', 'Protein-Rich', 'Gerbils'],
    recipe: {
      servings: 3,
      measurements: [
        m(0.5, 'cups', 'mixed seeds (millet, canary)'),
        m(0.25, 'cups', 'whole oats'),
        m(0.25, 'cups', 'dried vegetables'),
        m(2, 'tbsp', 'sunflower seeds'),
        m(2, 'tbsp', 'pumpkin seeds'),
        m(1, 'tbsp', 'dried mealworms'),
        m(1, 'tbsp', 'whole wheat pasta (uncooked)')
      ],
      directions: [
        'Combine all seeds and grains',
        'Mix in dried vegetables',
        'Break pasta into small pieces',
        'Store in dry container',
        'Provide 1-2 teaspoons per gerbil daily',
        'Ensure constant access to fresh water'
      ]
    }
  },
  {
    id: 'small-5',
    name: 'Rabbit Garden Harvest Bowl',
    category: 'Rabbits',
    difficulty: 'Medium',
    prepTime: 20,
    rating: 4.9,
    reviews: 612,
    image: 'https://images.unsplash.com/photo-1535241749838-299277b6305f?w=800',
    nutrition: { calories: 85, protein: 10, fat: 2, fiber: 24 },
    badges: ['Fresh Greens', 'High Fiber', 'Rabbits'],
    recipe: {
      servings: 2,
      measurements: [
        m(1, 'cup', 'romaine lettuce, chopped'),
        m(0.5, 'cups', 'fresh cilantro'),
        m(0.25, 'cups', 'fresh basil'),
        m(0.25, 'cups', 'fresh parsley'),
        m(2, 'tbsp', 'grated carrot'),
        m(1, 'tbsp', 'chopped bell pepper'),
        m(1, 'cup', 'timothy hay (on side)')
      ],
      directions: [
        'Wash all greens thoroughly',
        'Chop into bite-sized pieces',
        'Mix herbs together',
        'Add small amount of vegetables',
        'Serve with unlimited timothy hay',
        'Feed twice daily, morning and evening'
      ]
    }
  },
  {
    id: 'small-6',
    name: 'Guinea Pig Fortified Pellet Mix',
    category: 'Guinea Pigs',
    difficulty: 'Easy',
    prepTime: 10,
    rating: 4.7,
    reviews: 445,
    image: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800',
    nutrition: { calories: 110, protein: 16, fat: 3, fiber: 20 },
    badges: ['Fortified', 'Vitamin C', 'Guinea Pigs'],
    recipe: {
      servings: 3,
      measurements: [
        m(1, 'cup', 'guinea pig pellets (vitamin C fortified)'),
        m(0.25, 'cups', 'timothy hay, finely chopped'),
        m(2, 'tbsp', 'dried bell pepper'),
        m(1, 'tbsp', 'dried parsley'),
        m(1, 'tbsp', 'rolled oats'),
        m(1, 'tsp', 'ground flaxseed'),
        m(1, 'tsp', 'dried rose hips')
      ],
      directions: [
        'Mix pellets with chopped hay',
        'Add dried vegetables and herbs',
        'Incorporate oats and flaxseed',
        'Store in cool, dry place',
        'Provide 1/8 cup per guinea pig daily',
        'Always supplement with fresh vegetables'
      ]
    }
  },
  {
    id: 'small-7',
    name: 'Hamster Protein Power Mix',
    category: 'Hamsters',
    difficulty: 'Medium',
    prepTime: 15,
    rating: 4.8,
    reviews: 334,
    image: 'https://images.unsplash.com/photo-1452857297128-d9c29adba80b?w=800',
    nutrition: { calories: 155, protein: 18, fat: 9, fiber: 5 },
    badges: ['High Protein', 'Energy', 'Hamsters'],
    recipe: {
      servings: 4,
      measurements: [
        m(0.5, 'cups', 'whole oats'),
        m(0.25, 'cups', 'mixed seeds'),
        m(3, 'tbsp', 'dried mealworms'),
        m(2, 'tbsp', 'unsalted peanuts, chopped'),
        m(2, 'tbsp', 'pumpkin seeds'),
        m(1, 'tbsp', 'dried chickpeas'),
        m(1, 'tbsp', 'whole grain cereal (unsweetened)')
      ],
      directions: [
        'Combine all ingredients in bowl',
        'Chop larger pieces into hamster-sized portions',
        'Mix thoroughly to distribute protein sources',
        'Store in sealed container',
        'Serve 1-2 tablespoons daily',
        'Provide alongside fresh vegetables'
      ]
    }
  },
  {
    id: 'small-8',
    name: 'Chinchilla Safe Treat Mix',
    category: 'Chinchillas',
    difficulty: 'Easy',
    prepTime: 10,
    rating: 4.9,
    reviews: 198,
    image: 'https://images.unsplash.com/photo-1553990872-7e4587f7b7f1?w=800',
    nutrition: { calories: 90, protein: 10, fat: 3, fiber: 22 },
    badges: ['Low Fat', 'High Fiber', 'Chinchillas'],
    recipe: {
      servings: 3,
      measurements: [
        m(1, 'cup', 'timothy hay pellets'),
        m(0.5, 'cups', 'dried rose hips'),
        m(0.25, 'cups', 'dried hibiscus flowers'),
        m(2, 'tbsp', 'rolled oats'),
        m(1, 'tbsp', 'dried apple (no seeds)'),
        m(1, 'tbsp', 'dried rose petals'),
        m(1, 'tsp', 'dried chamomile')
      ],
      directions: [
        'Mix hay pellets with dried flowers',
        'Add oats and dried fruit',
        'Combine all ingredients thoroughly',
        'Store in moisture-free container',
        'Offer 1-2 tablespoons as weekly treat',
        'Main diet should be hay and pellets'
      ]
    }
  },
  {
    id: 'small-9',
    name: 'Multi-Small Pet Veggie Delight',
    category: 'All Small Pets',
    difficulty: 'Easy',
    prepTime: 18,
    rating: 4.8,
    reviews: 489,
    image: 'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=800',
    nutrition: { calories: 75, protein: 6, fat: 1, fiber: 16 },
    badges: ['Fresh Veggies', 'Universal', 'All Species'],
    recipe: {
      servings: 4,
      measurements: [
        m(0.5, 'cups', 'chopped romaine lettuce'),
        m(0.25, 'cups', 'grated carrot'),
        m(0.25, 'cups', 'chopped cucumber'),
        m(2, 'tbsp', 'fresh parsley'),
        m(2, 'tbsp', 'chopped bell pepper'),
        m(1, 'tbsp', 'fresh cilantro'),
        m(1, 'small piece', 'broccoli floret')
      ],
      directions: [
        'Wash all vegetables thoroughly',
        'Chop into appropriate sizes for your pet',
        'Mix all ingredients together',
        'Serve fresh daily',
        'Adjust portions based on pet size',
        'Remove uneaten portions after 4 hours'
      ]
    }
  }
];

export default function SmallPetsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'time'>('rating');
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const categories = ['All', 'Rabbits', 'Guinea Pigs', 'Hamsters', 'Gerbils', 'Chinchillas', 'All Small Pets'];

  const filteredRecipes = useMemo(() => {
    let filtered = smallPetRecipes.filter(recipe => {
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50">
      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="green"
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
      <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/pet-food">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Pet Food
              </Button>
            </Link>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Heart className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <Rabbit className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-5xl font-bold mb-2">Small Pet Food Recipes</h1>
              <p className="text-xl text-emerald-100">Hay-based diets and veggie mixes for small animals</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Leaf className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">9</div>
              <div className="text-sm text-emerald-100">Recipes</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Clock className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">8-20min</div>
              <div className="text-sm text-emerald-100">Prep Time</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Target className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">All Species</div>
              <div className="text-sm text-emerald-100">Rabbits & More</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Shield className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">High Fiber</div>
              <div className="text-sm text-emerald-100">Healthy & Safe</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sister Pages Navigation */}
        <Card className="bg-gradient-to-r from-amber-50 to-purple-50 border-amber-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Pet Food Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {sisterPetFoodPages.map((page) => {
                const Icon = page.icon;
                return (
                  <Link key={page.id} href={page.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-emerald-50 hover:border-emerald-300">
                      <Icon className="h-4 w-4 mr-2 text-emerald-600" />
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

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input placeholder="Search small pet food recipes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
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
        <Card className="mb-8 border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900 text-lg">
              <Shield className="h-5 w-5" />
              Important Safety Tips for Small Pets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-2 text-emerald-900">✓ Safe for Small Pets:</div>
                <ul className="space-y-1 text-emerald-800 ml-4">
                  <li>• Timothy hay (unlimited for rabbits & guinea pigs)</li>
                  <li>• Fresh greens (romaine, parsley, cilantro)</li>
                  <li>• Vegetables (bell peppers, carrots, cucumber)</li>
                  <li>• Seeds & grains (oats, millet, sunflower seeds)</li>
                  <li>• Dried herbs (rose hips, dandelion, chamomile)</li>
                  <li>• Small amounts of fruit as treats</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2 text-red-700">✗ Toxic for Small Pets:</div>
                <ul className="space-y-1 text-red-700 ml-4">
                  <li>• Chocolate, caffeine, alcohol</li>
                  <li>• Avocado (highly toxic)</li>
                  <li>• Onions, garlic, chives</li>
                  <li>• Potato leaves, tomato leaves</li>
                  <li>• Iceberg lettuce (too much water, no nutrients)</li>
                  <li>• Apple seeds, stone fruit pits</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-3 bg-green-100 rounded-lg border border-green-300">
              <p className="text-sm text-green-900 font-semibold">
                ⚠️ IMPORTANT: Guinea pigs require Vitamin C in their diet. Rabbits need unlimited timothy hay. Never feed fatty or sugary foods.
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
              <Card key={recipe.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                {/* Recipe Image */}
                {recipe.image && (
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={recipe.image} 
                      alt={recipe.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute top-3 right-3 flex gap-2">
                      {recipe.badges.slice(0, 2).map((badge: string) => (
                        <Badge key={badge} className="bg-emerald-600 text-white text-xs">{badge}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{recipe.name}</CardTitle>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">{recipe.category}</Badge>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Clock className="h-3 w-3" />
                          {recipe.prepTime}min
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Nutrition Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                    <div><div className="font-bold text-emerald-600">{recipe.nutrition?.protein ?? '—'}{recipe.nutrition?.protein ? 'g' : ''}</div><div className="text-gray-500">Protein</div></div>
                    <div><div className="font-bold text-green-600">{recipe.nutrition?.fiber ?? '—'}{recipe.nutrition?.fiber ? 'g' : ''}</div><div className="text-gray-500">Fiber</div></div>
                    <div><div className="font-bold text-emerald-600">{recipe.prepTime}min</div><div className="text-gray-500">Prep</div></div>
                  </div>

                  {/* Difficulty & Reviews - JUST ABOVE recipe box */}
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
                              <Check className="h-4 w-4 text-emerald-600 mt-0.5" />
                              <span><span className="text-emerald-700 font-semibold">{show.amount} {show.unit}</span> {ing.item}{ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}</span>
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

                  {/* Tags - EMERALD/GREEN color */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {recipe.badges.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-200">{tag}</Badge>
                    ))}
                  </div>

                  {/* Action - RABBIT ICON instead of Zap */}
                  <div className="mt-3">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => openRecipeModal(recipe)}>
                      <Rabbit className="h-4 w-4 mr-2" />
                      Make Recipe (+40 XP)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Progress Card */}
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2 text-emerald-900">Your Small Pet Food Journey</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-emerald-700">Level 3</Badge>
                  <Badge variant="outline" className="text-emerald-700">5/9 Recipes</Badge>
                </div>
              </div>
              <Crown className="h-12 w-12 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
