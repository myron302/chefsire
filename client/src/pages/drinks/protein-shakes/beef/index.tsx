// pages/drinks/protein-shakes/beef.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Target, Heart, Star, Zap, Flame, Leaf, Sparkles, Moon, Wine, Search, ArrowLeft, ArrowRight, Camera, X, Dumbbell, Trophy, Activity, Shield, Copy, Share2, BarChart3, Check, Clipboard, RotateCcw, Coffee } from "lucide-react";
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';
import RecipeKit, { Measured } from '@/components/recipes/RecipeKit';
import type { RecipeKitHandle } from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
type Nutrition = { calories?: number; protein?: number; carbs?: number; fat?: number; creatine?: number; iron?: number };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// Scaling helpers to match Plant-Based/Casein pages
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
  { id: 'egg', name: 'Egg Protein', icon: Target, path: '/drinks/protein-shakes/egg', description: 'Complete amino' }
];

// ---------- Data (Beef) - UPDATED WITH ABSORPTION INFO ----------
const beefProteinShakes = [
  {
    id: 'beef-1',
    name: 'Carnivore Power Blast',
    description: 'Slow-digesting micellar casein for 8-hour muscle feeding',
    flavor: 'Natural Beef',
    protein: 28,
    carbs: 2,
    calories: 120,
    creatine: 0.5,
    iron: 4.5,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 523,
    trending: true,
    featured: true,
    price: 45.99,
    bestTime: 'Post-Workout',
    fitnessGoal: 'Muscle Building',
    absorptionTime: '60-90 minutes',
    leucineContent: '2.3g',
    tags: ['Grass-Fed', 'Paleo-Friendly', 'Muscle Building', 'Natural Creatine'],
    benefits: ['Natural Creatine', 'High Iron', 'Complete Amino Profile', 'Paleo-Friendly'],
    ingredients: ['Grass-Fed Beef Protein Isolate', 'Natural Flavors', 'Sea Salt', 'Digestive Enzymes'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'grass-fed beef protein'),
        m(1, 'cup', 'cold water or milk'),
        m(1, 'tsp', 'honey or maple syrup', 'optional'),
        m(1, 'pinch', 'sea salt'),
        m(4, 'ice cubes', 'ice', 'optional')
      ],
      directions: [
        'Add liquid first, then slowly add beef protein while blending',
        'Blend for 45-60 seconds until completely smooth',
        'Add ice for colder, thicker consistency'
      ]
    }
  },
  {
    id: 'beef-2',
    name: 'Primal Strength Formula',
    description: 'Rich chocolate casein for evening muscle repair',
    flavor: 'Chocolate Beef',
    protein: 26,
    carbs: 3,
    calories: 125,
    creatine: 0.4,
    iron: 3.8,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 445,
    trending: false,
    featured: true,
    price: 42.99,
    bestTime: 'Post-Workout',
    fitnessGoal: 'Strength',
    absorptionTime: '45-75 minutes',
    leucineContent: '2.1g',
    tags: ['Hydrolyzed', 'Joint Support', 'Keto-Friendly', 'Strength'],
    benefits: ['Joint Support', 'Muscle Recovery', 'Gut Health', 'Keto-Friendly'],
    ingredients: ['Hydrolyzed Beef Protein', 'Beef Collagen', 'Cocoa Powder', 'Monk Fruit', 'MCT Oil'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (32g)', 'hydrolyzed beef protein'),
        m(1, 'cup', 'almond milk'),
        m(1, 'tbsp', 'cocoa powder'),
        m(1, 'tsp', 'MCT oil'),
        m(1, 'pinch', 'sea salt')
      ],
      directions: [
        'Mix protein with small amount of liquid first to create paste',
        'Gradually add remaining liquid while blending',
        'Blend until rich and chocolatey'
      ]
    }
  },
  {
    id: 'beef-3',
    name: 'Paleo Performance Shake',
    description: 'Natural banana with tryptophan for better sleep',
    flavor: 'Vanilla Bean',
    protein: 27,
    carbs: 2,
    calories: 115,
    creatine: 0.45,
    iron: 5.0,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 367,
    trending: false,
    featured: false,
    price: 39.99,
    bestTime: 'Morning',
    fitnessGoal: 'General Wellness',
    absorptionTime: '50-80 minutes',
    leucineContent: '2.0g',
    tags: ['Paleo Certified', 'Clean Ingredients', 'Iron Rich', 'General Wellness'],
    benefits: ['Paleo Approved', 'Clean Ingredients', 'Natural Energy', 'Iron Rich'],
    ingredients: ['Grass-Fed Beef Protein', 'Vanilla Bean Extract', 'Stevia', 'Himalayan Salt'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (28g)', 'beef protein isolate'),
        m(1, 'cup', 'coconut water'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'honey', 'optional'),
        m(1, 'pinch', 'cinnamon')
      ],
      directions: [
        'Combine all ingredients in blender',
        'Blend until smooth and frothy',
        'Enjoy as morning energy boost'
      ]
    }
  },
  {
    id: 'beef-4',
    name: 'Beef & Berry Recovery',
    description: 'Antioxidant-rich blueberry casein for overnight repair',
    flavor: 'Mixed Berry',
    protein: 25,
    carbs: 8,
    calories: 140,
    creatine: 0.4,
    iron: 4.2,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 289,
    trending: false,
    featured: false,
    price: 46.99,
    bestTime: 'Post-Workout',
    fitnessGoal: 'Recovery',
    absorptionTime: '55-85 minutes',
    leucineContent: '1.9g',
    tags: ['Antioxidant Boost', 'Muscle Recovery', 'Fiber Rich', 'Immune Support'],
    benefits: ['Antioxidant Boost', 'Muscle Recovery', 'Fiber Rich', 'Immune Support'],
    ingredients: ['Grass-Fed Beef Protein', 'Mixed Berry Blend', 'Acai Powder', 'Chia Seeds', 'Natural Berry Flavor'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'beef protein'),
        m(1, 'cup', 'unsweetened almond milk'),
        m(0.5, 'cup', 'mixed berries, frozen'),
        m(1, 'tsp', 'acai powder'),
        m(1, 'tsp', 'chia seeds'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend beef protein with almond milk first',
        'Add frozen berries and acai powder',
        'Blend until smooth, stir in chia seeds last'
      ]
    }
  },
  {
    id: 'beef-5',
    name: 'Coffee Beef Energizer',
    description: 'Decaf coffee casein for evening caffeine lovers',
    flavor: 'Mocha',
    protein: 26,
    carbs: 4,
    calories: 130,
    creatine: 0.42,
    iron: 3.5,
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.6,
    reviews: 412,
    trending: true,
    featured: false,
    price: 44.99,
    bestTime: 'Pre-Workout',
    fitnessGoal: 'Mental Performance',
    absorptionTime: '40-70 minutes',
    leucineContent: '2.2g',
    tags: ['Pre-Workout', 'Sustained Energy', 'Mental Focus', 'Keto'],
    benefits: ['Sustained Energy', 'Mental Focus', 'Pre-Workout Boost', 'Mood Support'],
    ingredients: ['Hydrolyzed Beef Protein', 'Coffee Extract', 'Cocoa Powder', 'L-Theanine', 'Natural Mocha Flavor'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (33g)', 'mocha beef protein'),
        m(1, 'cup', 'cold brew coffee'),
        m(2, 'tbsp', 'cream or milk alternative'),
        m(1, 'tsp', 'cocoa powder'),
        m(1, 'pinch', 'cinnamon')
      ],
      directions: [
        'Brew coffee and let cool completely',
        'Blend coffee with beef protein and cocoa',
        'Add cream and blend until frothy'
      ]
    }
  },
  {
    id: 'beef-6',
    name: 'Tropical Beef Fusion',
    description: 'Creamy peanut butter casein for sustained nourishment',
    flavor: 'Pina Colada',
    protein: 24,
    carbs: 7,
    calories: 135,
    creatine: 0.38,
    iron: 3.2,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.3,
    reviews: 198,
    trending: false,
    featured: true,
    price: 49.99,
    bestTime: 'Any Time',
    fitnessGoal: 'General Wellness',
    absorptionTime: '60-90 minutes',
    leucineContent: '1.8g',
    tags: ['Electrolyte Balance', 'Hydration', 'Tropical Taste', 'Digestive Support'],
    benefits: ['Electrolyte Balance', 'Digestive Support', 'Tropical Taste', 'Hydration'],
    ingredients: ['Beef Protein Isolate', 'Pineapple Extract', 'Coconut Cream Powder', 'Natural Flavors', 'Sea Salt'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (29g)', 'tropical beef protein'),
        m(1, 'cup', 'coconut water'),
        m(0.25, 'cup', 'pineapple chunks, frozen'),
        m(1, 'tsp', 'coconut cream powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend beef protein with coconut water',
        'Add frozen pineapple and coconut cream',
        'Blend until tropical smoothie consistency'
      ]
    }
  }
];

const beefProteinBenefits = [
  { icon: Dumbbell, title: 'Natural Creatine', description: '0.4-0.5g per serving for strength gains', color: 'text-red-600' },
  { icon: Shield, title: 'High Iron Content', description: 'Supports energy and blood health', color: 'text-orange-600' },
  { icon: Zap, title: 'Fast Absorption', description: 'Quickly digested for rapid recovery', color: 'text-yellow-600' },
  { icon: Flame, title: 'Complete Amino Profile', description: 'All essential amino acids (BV 88)', color: 'text-red-600' },
  { icon: Trophy, title: 'Paleo & Keto Friendly', description: 'Perfect for low-carb diets', color: 'text-purple-600' },
  { icon: Heart, title: 'No Dairy Allergens', description: 'Lactose-free alternative to whey', color: 'text-pink-600' }
];

// ---------- Component - UPDATED TO MATCH STRUCTURE ----------
export default function BeefProteinPage() {
  const {
    userProgress,
    addPoints,
    incrementDrinksMade,
    addToFavorites,
    isFavorite,
    addToRecentlyViewed
  } = useDrinks();

  const [activeTab, setActiveTab] = useState<'browse'|'benefits'|'featured'>('browse');
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [filterTag, setFilterTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'creatine'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // RecipeKit refs
  const kitRefs = useRef<Record<string, RecipeKitHandle | null>>({});

  // deep-link (?id=beef-1) — scroll card into view
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
      title: 'Beef Protein Shakes',
      text: 'Browse beef protein shake recipes with natural creatine and high iron.',
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
    const text = `${shake.name} • ${shake.flavor} • ${shake.protein}g Protein\n${preview || (shake.ingredients?.slice(0,4)?.join(', ') ?? '')}`;
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
        ingredients: selectedRecipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || selectedRecipe.ingredients,
        nutrition: {
          calories: selectedRecipe.calories,
          protein: selectedRecipe.protein,
          carbs: selectedRecipe.carbs,
          fat: 0.5,
          creatine: selectedRecipe.creatine,
          iron: selectedRecipe.iron
        } as Nutrition,
        difficulty: selectedRecipe.difficulty as 'Easy' | 'Medium' | 'Hard',
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        fitnessGoal: selectedRecipe.fitnessGoal,
        bestTime: selectedRecipe.bestTime
      };
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(100);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  // Filter and sort
  const getFilteredShakes = () => {
    let filtered = beefProteinShakes.filter(recipe => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        recipe.name.toLowerCase().includes(q) ||
        recipe.description.toLowerCase().includes(q) ||
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
        case 'creatine': return (b.creatine || 0) - (a.creatine || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredShakes = getFilteredShakes();
  const featuredShakes = beefProteinShakes.filter(shake => shake.featured);
  const allTags = ['All', ...new Set(beefProteinShakes.flatMap(r => r.tags))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
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

      {/* Controlled RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="red"
          pointsReward={100}
          onComplete={handleCompleteRecipe}
          item={{
            id: selectedRecipe.id,
            name: selectedRecipe.name,
            prepTime: selectedRecipe.prepTime,
            directions: selectedRecipe.recipe?.directions || [],
            measurements: selectedRecipe.recipe?.measurements || [],
            baseNutrition: { 
              calories: selectedRecipe.calories, 
              protein: selectedRecipe.protein,
              creatine: selectedRecipe.creatine,
              iron: selectedRecipe.iron
            },
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
                <Flame className="h-6 w-6 text-red-600" />
                <h1 className="text-2xl font-bold text-gray-900">Beef Protein</h1>
                <Badge className="bg-red-100 text-red-800">Natural Creatine</Badge>
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
              <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={handleSharePage}>
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
        <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Other Protein Types
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon as any;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-red-50 hover:border-red-300">
                      <Icon className="h-4 w-4 mr-2 text-red-600" />
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

        {/* Beef Protein Benefits */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Star className="h-6 w-6 text-red-500" />
              Why Beef Protein?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {beefProteinBenefits.map((benefit, index) => {
                const Icon = benefit.icon as any;
                return (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow">
                    <Icon className={`h-6 w-6 ${benefit.color} flex-shrink-0`} />
                    <div>
                      <h3 className="font-semibold mb-1">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">26g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">0.43g</div>
              <div className="text-sm text-gray-600">Avg Creatine</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">4.6mg</div>
              <div className="text-sm text-gray-600">Avg Iron</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">6</div>
              <div className="text-sm text-gray-600">Beef Formulas</div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'benefits', label: 'Benefits', icon: Shield },
            { id: 'featured', label: 'Featured', icon: Star },
          ].map((tab) => {
            const Icon = tab.icon as any;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 ${activeTab === tab.id ? "bg-white shadow-sm" : ""}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {/* Browse Tab */}
        {activeTab === "browse" && (
          <div>
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  placeholder="Search beef proteins..."
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
                  <option value="creatine">Sort by Creatine</option>
                </select>
              </div>
            </div>

            {/* Recipe Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShakes.map((shake) => {
                const useMetric = !!metricFlags[shake.id];
                const servings = servingsById[shake.id] ?? (shake.recipe?.servings || 1);

                return (
                  <Card key={shake.id} id={`card-${shake.id}`} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="md:max-w-3xl md:flex-1">
                          <CardTitle className="text-lg mb-1">{shake.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{shake.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const drinkData = {
                              id: shake.id,
                              name: shake.name,
                              category: 'protein-shakes' as const,
                              description: shake.description,
                              ingredients: shake.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || shake.ingredients,
                              nutrition: { 
                                calories: shake.calories, 
                                protein: shake.protein, 
                                carbs: shake.carbs, 
                                fat: 0.5,
                                creatine: shake.creatine,
                                iron: shake.iron
                              },
                              difficulty: shake.difficulty as 'Easy' | 'Medium' | 'Hard',
                              prepTime: shake.prepTime,
                              rating: shake.rating,
                              fitnessGoal: shake.fitnessGoal,
                              bestTime: shake.bestTime
                            };
                            addToFavorites(drinkData);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(shake.id) ? 'fill-red-500 text-red-500' : ''}`} />
                        </Button>
                      </div>

                      {/* Tags at top */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        <Badge className="bg-red-100 text-red-800">Beef Protein</Badge>
                        <Badge variant="outline">{shake.flavor}</Badge>
                        {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="text-xl font-bold text-red-600">{shake.protein}g</div>
                          <div className="text-gray-500">Protein</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-blue-600">{shake.calories}</div>
                          <div className="text-gray-500">Cal</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-orange-600">{shake.creatine}g</div>
                          <div className="text-gray-500">Creatine</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-amber-600">{shake.iron}mg</div>
                          <div className="text-gray-500">Iron</div>
                        </div>
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

                      {/* Compact recipe preview with serving controls */}
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
                                ? { amount: Math.round(Number(ing.amount) * servings), unit: 'g' }
                                : { amount: scaledDisplay, unit: ing.unit };

                              return (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-red-600 mt-0.5" />
                                  <span>
                                    <span className="text-red-700 font-semibold">
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
                                <div className="text-red-600 font-medium">{shake.leucineContent}</div>
                              </div>
                            </div>
                            <div className="text-center mt-2">
                              <div className="font-semibold text-gray-700">Best Time:</div>
                              <div className="text-red-600 font-medium text-sm">{shake.bestTime}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Benefits tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {shake.benefits.map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-red-100 text-red-800 hover:bg-red-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Full-width CTA */}
                      <div className="mt-3">
                        <Button
                          className="w-full bg-red-500 hover:bg-red-600 text-white"
                          size="sm"
                          onClick={() => openRecipeModal(shake)}
                        >
                          <Flame className="h-4 w-4 mr-1" />
                          Make Shake (+100 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Benefits Tab */}
        {activeTab === "benefits" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {beefProteinBenefits.map((benefit, index) => {
              const Icon = benefit.icon as any;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${benefit.color}`} />
                      <CardTitle className="text-lg">{benefit.title}</CardTitle>
                      <p className="text-sm text-gray-600">{benefit.description}</p>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}

        {/* Featured Tab */}
        {activeTab === "featured" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredShakes.map((shake) => {
              const useMetric = !!metricFlags[shake.id];
              const servings = servingsById[shake.id] ?? (shake.recipe?.servings || 1);

              return (
                <Card key={shake.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-xl">{shake.name}</CardTitle>
                    <p className="text-gray-600">{shake.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge className="bg-red-100 text-red-800">Beef Protein</Badge>
                      <Badge variant="outline">{shake.flavor}</Badge>
                      {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Enhanced nutrition display */}
                    <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-red-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-xl font-bold text-red-600">{shake.protein}g</div>
                        <div className="text-xs text-gray-600">Protein</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">{shake.calories}</div>
                        <div className="text-xs text-gray-600">Calories</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-orange-600">{shake.creatine}g</div>
                        <div className="text-xs text-gray-600">Creatine</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-amber-600">{shake.iron}mg</div>
                        <div className="text-xs text-gray-600">Iron</div>
                      </div>
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

                    {/* Compact recipe preview for featured cards */}
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
                              ? { amount: Math.round(Number(ing.amount) * servings), unit: 'g' }
                              : { amount: scaledDisplay, unit: ing.unit };

                            return (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-red-600 mt-0.5" />
                                <span>
                                  <span className="text-red-700 font-semibold">
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
                              <div className="text-red-600 font-medium">{shake.leucineContent}</div>
                            </div>
                          </div>
                          <div className="text-center mt-2">
                            <div className="font-semibold text-gray-700">Best Time:</div>
                            <div className="text-red-600 font-medium text-sm">{shake.bestTime}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Benefits tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {shake.benefits.map((benefit: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-red-100 text-red-800 hover:bg-red-200">
                          {benefit}
                        </Badge>
                      ))}
                    </div>

                    {/* Full-width CTA */}
                    <div className="mt-3">
                      <Button
                        className="w-full bg-red-500 hover:bg-red-600 text-white"
                        onClick={() => openRecipeModal(shake)}
                      >
                        <Flame className="h-4 w-4 mr-2" />
                        Make Shake (+100 XP)
                      </Button>
                    </div>
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
    </div>
  );
}
