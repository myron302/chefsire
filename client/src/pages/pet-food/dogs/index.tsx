import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dog, Cat, Bird, Rabbit, Clock, Heart, Star, Shield,
  Search, Share2, ArrowLeft, Check, Clipboard, RotateCcw, Award, ArrowRight, Home, Crown, Bone, Target
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
  { id: 'cats', name: 'Cats', path: '/pet-food/cats', icon: Cat, description: 'Kitten to senior' },
  { id: 'birds', name: 'Birds', path: '/pet-food/birds', icon: Bird, description: 'Seed & fruit mixes' },
  { id: 'small-pets', name: 'Small Pets', path: '/pet-food/small-pets', icon: Rabbit, description: 'Rabbits & rodents' }
];

// Dog recipes - 9 total with images
const dogRecipes = [
  {
    id: 'dog-1',
    name: 'Puppy Growth Formula',
    category: 'Puppy',
    difficulty: 'Easy',
    prepTime: 25,
    rating: 4.9,
    reviews: 342,
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800',
    nutrition: { calories: 425, protein: 28, fat: 15, carbs: 42 },
    badges: ['High Protein', 'Grain-Inclusive', 'Puppy'],
    recipe: {
      servings: 4,
      measurements: [
        m(2, 'lbs', 'ground chicken breast'),
        m(2, 'cups', 'brown rice'),
        m(1, 'cup', 'sweet potato, diced'),
        m(1, 'cup', 'carrots, finely chopped'),
        m(0.5, 'cups', 'green beans'),
        m(2, 'tbsp', 'fish oil'),
        m(1, 'tsp', 'calcium powder')
      ],
      directions: [
        'Cook brown rice according to package directions',
        'Brown ground chicken in large skillet until fully cooked',
        'Steam sweet potato, carrots, and green beans until tender',
        'Combine all ingredients in large bowl',
        'Mix in fish oil and calcium powder',
        'Cool completely before serving'
      ]
    }
  },
  {
    id: 'dog-2',
    name: 'Adult Maintenance Bowl',
    category: 'Adult',
    difficulty: 'Easy',
    prepTime: 30,
    rating: 4.8,
    reviews: 567,
    image: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=800',
    nutrition: { calories: 380, protein: 25, fat: 12, carbs: 38 },
    badges: ['Balanced', 'Adult', 'Heart Health'],
    recipe: {
      servings: 6,
      measurements: [
        m(2, 'lbs', 'lean ground beef'),
        m(2, 'cups', 'quinoa'),
        m(1, 'cup', 'pumpkin puree'),
        m(1, 'cup', 'spinach, chopped'),
        m(0.5, 'cups', 'blueberries'),
        m(2, 'whole', 'eggs, hard boiled'),
        m(1, 'tbsp', 'coconut oil')
      ],
      directions: [
        'Cook quinoa according to package directions',
        'Brown ground beef, drain excess fat',
        'Hard boil eggs, cool and chop',
        'Mix cooked beef with quinoa',
        'Fold in pumpkin puree and coconut oil',
        'Add spinach, blueberries, and chopped eggs'
      ]
    }
  },
  {
    id: 'dog-3',
    name: 'Senior Gentle Digest',
    category: 'Senior',
    difficulty: 'Easy',
    prepTime: 35,
    rating: 4.9,
    reviews: 423,
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800',
    nutrition: { calories: 320, protein: 22, fat: 10, carbs: 35 },
    badges: ['Senior', 'Easy Digest', 'Joint Support'],
    recipe: {
      servings: 5,
      measurements: [
        m(2, 'lbs', 'ground turkey'),
        m(2, 'cups', 'white rice'),
        m(1, 'cup', 'zucchini, finely diced'),
        m(0.5, 'cups', 'cottage cheese'),
        m(0.25, 'cups', 'bone broth'),
        m(1, 'tbsp', 'glucosamine powder'),
        m(1, 'tsp', 'turmeric')
      ],
      directions: [
        'Cook white rice until very soft',
        'Cook ground turkey thoroughly',
        'Steam zucchini until very tender',
        'Combine turkey, rice, and zucchini',
        'Mix in cottage cheese and bone broth',
        'Add glucosamine and turmeric'
      ]
    }
  },
  {
    id: 'dog-4',
    name: 'Grain-Free Salmon Power',
    category: 'Special Diet',
    difficulty: 'Medium',
    prepTime: 30,
    rating: 4.7,
    reviews: 289,
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    nutrition: { calories: 395, protein: 30, fat: 18, carbs: 28 },
    badges: ['Grain-Free', 'Omega-3', 'Skin & Coat'],
    recipe: {
      servings: 5,
      measurements: [
        m(2, 'lbs', 'fresh salmon fillet'),
        m(2, 'cups', 'sweet potato'),
        m(1, 'cup', 'green peas'),
        m(0.5, 'cups', 'carrots'),
        m(0.25, 'cups', 'flaxseed meal'),
        m(2, 'tbsp', 'olive oil'),
        m(1, 'tsp', 'kelp powder')
      ],
      directions: [
        'Bake salmon at 375°F until cooked through',
        'Boil sweet potato until fork-tender',
        'Steam peas and carrots',
        'Flake cooked salmon, remove any bones',
        'Mash sweet potato',
        'Combine all ingredients with flaxseed, olive oil, and kelp'
      ]
    }
  },
  {
    id: 'dog-5',
    name: 'Lean & Green Weight Loss',
    category: 'Special Diet',
    difficulty: 'Easy',
    prepTime: 25,
    rating: 4.6,
    reviews: 234,
    image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800',
    nutrition: { calories: 285, protein: 26, fat: 8, carbs: 30 },
    badges: ['Low Fat', 'High Fiber', 'Weight Management'],
    recipe: {
      servings: 6,
      measurements: [
        m(2, 'lbs', 'chicken breast'),
        m(2, 'cups', 'green beans'),
        m(1, 'cup', 'broccoli'),
        m(1, 'cup', 'cauliflower'),
        m(1, 'cup', 'pumpkin puree'),
        m(0.5, 'cups', 'oat bran'),
        m(1, 'tbsp', 'fish oil')
      ],
      directions: [
        'Boil chicken breast until fully cooked',
        'Steam all vegetables until tender',
        'Chop chicken into small pieces',
        'Combine chicken with vegetables',
        'Mix in pumpkin puree and oat bran',
        'Add fish oil for essential fatty acids'
      ]
    }
  },
  {
    id: 'dog-6',
    name: 'Allergy-Friendly Lamb',
    category: 'Special Diet',
    difficulty: 'Medium',
    prepTime: 35,
    rating: 4.8,
    reviews: 198,
    image: 'https://images.unsplash.com/photo-1546527868-ccb7ee7dfa6a?w=800',
    nutrition: { calories: 405, protein: 27, fat: 16, carbs: 36 },
    badges: ['Limited Ingredient', 'Novel Protein', 'Allergy-Friendly'],
    recipe: {
      servings: 5,
      measurements: [
        m(2, 'lbs', 'ground lamb'),
        m(2, 'cups', 'white potato'),
        m(1, 'cup', 'parsnips'),
        m(0.5, 'cups', 'pears, diced'),
        m(2, 'tbsp', 'sunflower oil'),
        m(1, 'tsp', 'zinc supplement'),
        m(1, 'tsp', 'vitamin E')
      ],
      directions: [
        'Cook ground lamb thoroughly',
        'Boil white potato and parsnips until soft',
        'Dice pears into small pieces',
        'Combine lamb with cooked vegetables',
        'Mix in sunflower oil',
        'Add supplements as directed'
      ]
    }
  },
  {
    id: 'dog-7',
    name: 'Athlete Performance Fuel',
    category: 'Special Diet',
    difficulty: 'Medium',
    prepTime: 30,
    rating: 4.9,
    reviews: 276,
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800',
    nutrition: { calories: 485, protein: 32, fat: 20, carbs: 45 },
    badges: ['High Energy', 'Performance', 'Working Dogs'],
    recipe: {
      servings: 6,
      measurements: [
        m(2, 'lbs', 'beef heart'),
        m(2, 'cups', 'oatmeal'),
        m(1, 'cup', 'liver'),
        m(1, 'cup', 'sweet potato'),
        m(3, 'whole', 'eggs'),
        m(0.25, 'cups', 'coconut oil'),
        m(2, 'tbsp', 'blackstrap molasses')
      ],
      directions: [
        'Cook beef heart and liver until done',
        'Prepare oatmeal with extra water',
        'Bake sweet potato',
        'Scramble eggs',
        'Chop meats into appropriate sizes',
        'Combine all ingredients with coconut oil and molasses'
      ]
    }
  },
  {
    id: 'dog-8',
    name: 'Dental Health Crunch',
    category: 'Special Diet',
    difficulty: 'Medium',
    prepTime: 40,
    rating: 4.7,
    reviews: 167,
    image: 'https://images.unsplash.com/photo-1534351450181-ea9f78427fe8?w=800',
    nutrition: { calories: 360, protein: 24, fat: 14, carbs: 32 },
    badges: ['Dental Health', 'Crunchy', 'Fresh Breath'],
    recipe: {
      servings: 4,
      measurements: [
        m(2, 'lbs', 'ground turkey'),
        m(1, 'cup', 'carrots, large chunks'),
        m(1, 'cup', 'apples, sliced thick'),
        m(0.5, 'cups', 'parsley'),
        m(0.25, 'cups', 'mint leaves'),
        m(1, 'cup', 'rolled oats'),
        m(2, 'tbsp', 'coconut oil')
      ],
      directions: [
        'Form turkey into small meatballs, bake until done',
        'Cut carrots and apples into chewable chunks',
        'Mix in fresh parsley and mint',
        'Combine with cooked oats',
        'Add coconut oil',
        'Serve with crunchy elements for teeth cleaning'
      ]
    }
  },
  {
    id: 'dog-9',
    name: 'Digestive Support Chicken',
    category: 'Special Diet',
    difficulty: 'Easy',
    prepTime: 25,
    rating: 4.8,
    reviews: 312,
    image: 'https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?w=800',
    nutrition: { calories: 340, protein: 28, fat: 11, carbs: 33 },
    badges: ['Probiotic', 'Digestive Health', 'Sensitive Stomach'],
    recipe: {
      servings: 5,
      measurements: [
        m(2, 'lbs', 'chicken breast, boneless'),
        m(2, 'cups', 'white rice, cooked'),
        m(1, 'cup', 'plain yogurt'),
        m(0.5, 'cups', 'pumpkin puree'),
        m(0.25, 'cups', 'bone broth'),
        m(1, 'tbsp', 'ginger, grated'),
        m(1, 'tsp', 'probiotic powder')
      ],
      directions: [
        'Poach chicken breast in water until cooked',
        'Shred chicken into small pieces',
        'Mix chicken with cooked rice',
        'Fold in yogurt and pumpkin puree',
        'Add bone broth and grated ginger',
        'Cool to room temperature, then add probiotic powder'
      ]
    }
  }
];

export default function DogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'time'>('rating');
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const categories = ['All', 'Puppy', 'Adult', 'Senior', 'Special Diet'];

  const filteredRecipes = useMemo(() => {
    let filtered = dogRecipes.filter(recipe => {
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="amber"
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
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg">
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
      <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <Dog className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-5xl font-bold mb-2">Dog Food Recipes</h1>
              <p className="text-xl text-amber-100">Nutritious homemade meals for your best friend</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Bone className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">9</div>
              <div className="text-sm text-amber-100">Recipes</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Clock className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">25-40min</div>
              <div className="text-sm text-amber-100">Prep Time</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Target className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">All Ages</div>
              <div className="text-sm text-amber-100">Life Stages</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Shield className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">Vet-Approved</div>
              <div className="text-sm text-amber-100">Safe & Balanced</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sister Pages Navigation */}
        <Card className="bg-gradient-to-r from-purple-50 to-emerald-50 border-purple-200 mb-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Other Pet Food Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sisterPetFoodPages.map((page) => {
                const Icon = page.icon;
                return (
                  <Link key={page.id} href={page.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-amber-50 hover:border-amber-300 h-auto py-4">
                      <Icon className="h-6 w-6 mr-3 text-amber-600" />
                      <div className="text-left flex-1">
                        <div className="font-semibold text-base">{page.name}</div>
                        <div className="text-sm text-gray-600">{page.description}</div>
                      </div>
                      <ArrowRight className="h-5 w-5 ml-auto" />
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input placeholder="Search dog food recipes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 text-base" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
            <select className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm w-full sm:w-auto" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.filter(c => c !== 'All').map(cat => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
            <select className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm w-full sm:w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="rating">Sort by Rating</option>
              <option value="protein">Sort by Protein</option>
              <option value="calories">Sort by Calories</option>
              <option value="time">Sort by Prep Time</option>
            </select>
          </div>
        </div>

        {/* Safety Card */}
        <Card className="mb-8 border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 text-lg">
              <Shield className="h-5 w-5" />
              Important Safety Tips for Dogs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-2 text-amber-900">✓ Safe for Dogs:</div>
                <ul className="space-y-1 text-amber-800 ml-4">
                  <li>• Lean meats (chicken, turkey, beef, lamb)</li>
                  <li>• Fish (salmon, sardines)</li>
                  <li>• Rice, oats, quinoa</li>
                  <li>• Sweet potato, pumpkin, carrots</li>
                  <li>• Blueberries, apples (no seeds)</li>
                  <li>• Green beans, broccoli, spinach</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2 text-red-700">✗ Toxic for Dogs:</div>
                <ul className="space-y-1 text-red-700 ml-4">
                  <li>• Chocolate, caffeine, alcohol</li>
                  <li>• Grapes, raisins, currants</li>
                  <li>• Onions, garlic, chives, leeks</li>
                  <li>• Xylitol (artificial sweetener)</li>
                  <li>• Macadamia nuts, walnuts</li>
                  <li>• Avocado, raw dough, cooked bones</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-xs text-amber-700 italic">
              Always consult your veterinarian before switching to homemade food. Ensure calcium and vitamin supplements are added as needed.
            </p>
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
                        <Badge key={badge} className="bg-amber-600 text-white text-xs">{badge}</Badge>
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
                    <div><div className="font-bold text-amber-600">{recipe.nutrition?.protein ?? '—'}{recipe.nutrition?.protein ? 'g' : ''}</div><div className="text-gray-500">Protein</div></div>
                    <div><div className="font-bold text-orange-600">{recipe.nutrition?.calories ?? '—'}</div><div className="text-gray-500">Calories</div></div>
                    <div><div className="font-bold text-amber-600">{recipe.prepTime}min</div><div className="text-gray-500">Prep</div></div>
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
                              <Check className="h-4 w-4 text-amber-600 mt-0.5" />
                              <span><span className="text-amber-700 font-semibold">{show.amount} {show.unit}</span> {ing.item}{ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}</span>
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

                  {/* Tags - AMBER color */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {recipe.badges.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200">{tag}</Badge>
                    ))}
                  </div>

                  {/* Action - DOG ICON instead of Zap */}
                  <div className="mt-3">
                    <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => openRecipeModal(recipe)}>
                      <Dog className="h-4 w-4 mr-2" />
                      Make Recipe (+40 XP)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Progress Card */}
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2 text-amber-900">Your Dog Food Journey</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-amber-700">Level 2</Badge>
                  <Badge variant="outline" className="text-amber-700">3/9 Recipes</Badge>
                </div>
              </div>
              <Crown className="h-12 w-12 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
