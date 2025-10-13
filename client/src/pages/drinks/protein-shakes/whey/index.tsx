import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Dumbbell, Clock, Heart, Star, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Search, Filter, Shuffle, Camera, Share2, ArrowLeft,
  Beaker, Activity, BarChart3, Sparkles, Moon, Wine, ArrowRight, X, Check, Clipboard
} from 'lucide-react';
import { useDrinks } from "@/contexts/DrinksContext";
import UniversalSearch from '@/components/UniversalSearch';
import RecipeKit from '@/components/recipes/RecipeKit';

// ---------- Helpers (mirror Egg page) ----------
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// basic US -> metric conversion for inline preview (RecipeKit has its own too)
const toMetric = (unit: string, amount: number) => {
  const mlPerCup = 240, mlPerTbsp = 15, mlPerTsp = 5;
  const gPerScoop30 = 30;
  switch (unit) {
    case 'cup': return { amount: Math.round(amount * mlPerCup), unit: 'ml' };
    case 'tbsp': return { amount: Math.round(amount * mlPerTbsp), unit: 'ml' };
    case 'tsp': return { amount: Math.round(amount * mlPerTsp), unit: 'ml' };
    case 'scoop (30g)': return { amount: Math.round(amount * gPerScoop30), unit: 'g' };
    case 'scoop (32g)': return { amount: Math.round(amount * 32), unit: 'g' };
    case 'tbsp (~25g)': return { amount: Math.round(amount * 25), unit: 'g' };
    default: return { amount, unit };
  }
};

// ---------- Navigation data (unchanged) ----------
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const proteinSubcategories = [
  { id: 'plant', name: 'Plant-Based', icon: Leaf, route: '/drinks/protein-shakes/plant-based', description: 'Vegan friendly' },
  { id: 'casein', name: 'Casein', icon: Moon, route: '/drinks/protein-shakes/casein', description: 'Slow release' },
  { id: 'collagen', name: 'Collagen', icon: Sparkles, route: '/drinks/protein-shakes/collagen', description: 'Beauty support' },
  { id: 'egg', name: 'Egg Protein', icon: Target, route: '/drinks/protein-shakes/egg', description: 'Complete amino' },
  { id: 'beef', name: 'Beef Protein', icon: Flame, route: '/drinks/protein-shakes/beef', description: 'Natural creatine' }
];

// ---------- Whey data WITH measured recipes (serves 1) ----------
const wheyProteinShakes = [
  {
    id: 'whey-1',
    name: 'Classic Vanilla Post-Workout',
    description: 'Fast-absorbing whey isolate for maximum protein synthesis',
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop',
    nutrition: { calories: 180, protein: 35, carbs: 3, fat: 1 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 1247,
    trending: false,
    featured: true,
    tags: ['Whey Isolate', 'Fast absorption', 'Muscle recovery', 'Low carb'],
    ingredients: ['Whey protein isolate (30g)', 'Water or almond milk', 'Vanilla extract', 'Ice cubes'],
    instructions: 'Blend for 30 seconds. Consume within 30 minutes post-workout for optimal absorption.',
    benefits: ['Fast protein absorption', 'Muscle recovery', 'Low carb'],
    bestTime: 'Post-workout (0-30 minutes)',
    fitnessGoal: 'Muscle Building',
    wheyType: 'Whey Isolate',
    absorptionTime: '30-60 minutes',
    leucineContent: '2.5g',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'whey isolate'),
        m(1, 'cup', 'water or unsweetened almond milk'),
        m(0.25, 'tsp', 'vanilla extract'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Add liquid first, then powder and vanilla, then ice.',
        'Blend 30–45 seconds until smooth.'
      ]
    }
  },
  {
    id: 'whey-2',
    name: 'Chocolate Peanut Butter Powerhouse',
    description: 'Rich chocolate whey with natural peanut butter for mass gaining',
    image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop',
    nutrition: { calories: 420, protein: 40, carbs: 15, fat: 18 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.9,
    reviews: 567,
    trending: false,
    featured: true,
    tags: ['Whey Concentrate', 'High Calorie', 'Mass Gain', 'Chocolate'],
    ingredients: ['Whey protein concentrate (35g)', 'Natural peanut butter (2 tbsp)', 'Banana', 'Whole milk', 'Honey'],
    instructions: 'Blend until creamy. Add extra milk if too thick. Perfect for bulking phases.',
    benefits: ['High protein', 'Calorie dense', 'Great taste', 'Sustained energy'],
    bestTime: 'Post-workout or meal replacement',
    fitnessGoal: 'Mass Gaining',
    wheyType: 'Whey Concentrate',
    absorptionTime: '60-90 minutes',
    leucineContent: '3.2g',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'whey concentrate, chocolate preferred'),
        m(2, 'tbsp', 'natural peanut butter'),
        m(1, 'small', 'banana, ripe'),
        m(1, 'cup', 'whole milk'),
        m(1, 'tsp', 'honey (optional)'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Blend milk + powder 10 seconds.',
        'Add banana, peanut butter, honey, and ice; blend creamy.'
      ]
    }
  },
  {
    id: 'whey-3',
    name: 'Strawberry Lean Machine',
    description: 'Low-calorie whey isolate perfect for cutting phases',
    nutrition: { calories: 160, protein: 30, carbs: 5, fat: 1 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 234,
    trending: true,
    featured: false,
    tags: ['Whey Isolate', 'Low Calorie', 'Cutting', 'Fat Loss'],
    ingredients: ['Whey protein isolate (30g)', 'Frozen strawberries', 'Water', 'Stevia', 'Ice'],
    instructions: 'Blend with ice for refreshing texture. Ideal for maintaining muscle during calorie deficit.',
    benefits: ['Low calorie', 'Fat burning support', 'Refreshing', 'Muscle preservation'],
    bestTime: 'Morning or pre-workout',
    fitnessGoal: 'Fat Loss',
    wheyType: 'Whey Isolate',
    absorptionTime: '30-60 minutes',
    leucineContent: '2.4g',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'whey isolate, vanilla or strawberry'),
        m(0.75, 'cup', 'frozen strawberries'),
        m(1, 'cup', 'cold water'),
        m(1, 'tsp', 'stevia or to taste'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Blend all ingredients 30–45 seconds; adjust sweetness to taste.'
      ]
    }
  },
  {
    id: 'whey-4',
    name: 'Pre-Workout Energy Blast',
    description: 'Whey protein with natural energy boosters for enhanced performance',
    nutrition: { calories: 320, protein: 32, carbs: 25, fat: 6 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 189,
    trending: false,
    featured: false,
    tags: ['Whey Concentrate', 'Pre-workout', 'Energy', 'Performance'],
    ingredients: ['Whey protein concentrate (30g)', 'Cold brew coffee', 'Banana', 'Oats', 'Cinnamon'],
    instructions: 'Blend well. Consume 30-60 minutes before workout for sustained energy and protein.',
    benefits: ['Energy boost', 'Sustained fuel', 'Performance enhancement', 'Muscle protection'],
    bestTime: 'Pre-workout (30-60 minutes)',
    fitnessGoal: 'Performance',
    wheyType: 'Whey Concentrate',
    absorptionTime: '60-90 minutes',
    leucineContent: '2.8g',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'whey concentrate, vanilla'),
        m(0.75, 'cup', 'cold brew coffee'),
        m(0.5, 'small', 'banana'),
        m(2, 'tbsp', 'rolled oats'),
        m(0.25, 'tsp', 'ground cinnamon'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Blend coffee + powder first; add banana, oats, cinnamon, ice; blend smooth.'
      ]
    }
  },
  {
    id: 'whey-5',
    name: 'Hydrolyzed Recovery Formula',
    description: 'Premium hydrolyzed whey for ultra-fast absorption',
    nutrition: { calories: 200, protein: 38, carbs: 6, fat: 2 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.9,
    reviews: 89,
    trending: true,
    featured: true,
    tags: ['Hydrolyzed Whey', 'Premium', 'Ultra-fast', 'Recovery'],
    ingredients: ['Hydrolyzed whey protein (35g)', 'Coconut water', 'Sea salt', 'Lemon juice'],
    instructions: 'Mix gently - no blending needed. Consume immediately post-workout.',
    benefits: ['Fastest absorption', 'Superior recovery', 'Reduced muscle soreness', 'Premium quality'],
    bestTime: 'Immediately post-workout',
    fitnessGoal: 'Elite Performance',
    wheyType: 'Hydrolyzed Whey',
    absorptionTime: '15-30 minutes',
    leucineContent: '3.8g',
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'hydrolyzed whey protein'),
        m(1, 'cup', 'coconut water'),
        m(1, 'pinch', 'sea salt'),
        m(0.5, 'tsp', 'fresh lemon juice'),
      ],
      directions: [
        'Shake in a bottle 10–15 seconds; no blender required.'
      ]
    }
  },
  {
    id: 'whey-6',
    name: 'Bedtime Casein-Whey Blend',
    description: 'Slow and fast protein combination for overnight recovery',
    nutrition: { calories: 280, protein: 35, carbs: 8, fat: 8 },
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.5,
    reviews: 156,
    trending: false,
    featured: false,
    tags: ['Whey-Casein Blend', 'Night Formula', 'Slow Release', 'Recovery'],
    ingredients: ['Whey protein (20g)', 'Casein protein (15g)', 'Almond milk', 'Greek yogurt', 'Vanilla'],
    instructions: 'Blend until smooth. Consume 30 minutes before bed for overnight muscle recovery.',
    benefits: ['Sustained protein release', 'Overnight recovery', 'Muscle preservation', 'Better sleep'],
    bestTime: 'Before bed (30 minutes)',
    fitnessGoal: 'Recovery & Growth',
    wheyType: 'Whey-Casein Blend',
    absorptionTime: '2-8 hours',
    leucineContent: '3.0g',
    recipe: {
      servings: 1,
      measurements: [
        m(2/3, 'scoop (30g)', 'whey protein (≈20g)'),
        m(0.5, 'scoop (30g)', 'micellar casein (≈15g)'),
        m(0.75, 'cup', 'unsweetened almond milk'),
        m(0.25, 'cup', 'plain Greek yogurt'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(4, 'ice cubes', 'ice'),
      ],
      directions: [
        'Blend liquids + proteins 15 seconds.',
        'Add yogurt, vanilla, ice; blend silky.'
      ]
    }
  }
];

// ---------- Filters ----------
const fitnessGoals = [
  { id: 'muscle-building', name: 'Muscle Building', icon: Dumbbell, count: 15, color: 'text-blue-600' },
  { id: 'fat-loss', name: 'Fat Loss', icon: Flame, count: 8, color: 'text-red-600' },
  { id: 'performance', name: 'Performance', icon: Zap, count: 6, color: 'text-yellow-600' },
  { id: 'recovery', name: 'Recovery', icon: Heart, count: 12, color: 'text-green-600' },
  { id: 'mass-gain', name: 'Mass Gain', icon: TrendingUp, count: 9, color: 'text-purple-600' },
  { id: 'maintenance', name: 'Maintenance', icon: Target, count: 11, color: 'text-gray-600' }
];

const wheyTypes = [
  {
    id: 'isolate',
    name: 'Whey Isolate',
    description: 'Fastest absorption, lowest carbs',
    icon: Zap,
    absorptionTime: '30-60 min',
    proteinContent: '90-95%',
    bestFor: 'Post-workout, cutting'
  },
  {
    id: 'concentrate',
    name: 'Whey Concentrate',
    description: 'Great taste, cost-effective',
    icon: Award,
    absorptionTime: '60-90 min',
    proteinContent: '70-80%',
    bestFor: 'General use, mass gain'
  },
  {
    id: 'hydrolyzed',
    name: 'Hydrolyzed Whey',
    description: 'Pre-digested, ultra-fast',
    icon: Sparkles,
    absorptionTime: '15-30 min',
    proteinContent: '85-95%',
    bestFor: 'Elite athletes, recovery'
  }
];

// ---------- Component ----------
export default function WheyProteinShakesPage() {
  const {
    addToFavorites,
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState<'browse' | 'types' | 'goals' | 'featured'>('browse');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedWheyType, setSelectedWheyType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'time'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  // RecipeKit controlled modal (mirror Egg)
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);

  // per-card Metric toggle for inline preview
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const handleSharePage = async () => {
    const shareData = {
      title: 'Whey Protein Shakes',
      text: 'Explore whey protein shake recipes and benefits.',
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

  const handleShareShake = async (shake: any) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const preview = shake?.recipe?.measurements?.slice(0, 4)
      .map((r: Measured) => `${r.amount} ${r.unit} ${r.item}`).join(' · ');
    const text = `${shake.name} • ${shake.fitnessGoal} • ${shake.wheyType}\n${preview || (shake.ingredients?.slice(0,4)?.join(', ') ?? '')}`;
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
        description: `${selectedRecipe.fitnessGoal || ''} • ${selectedRecipe.wheyType || ''}`,
        ingredients: selectedRecipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || selectedRecipe.ingredients,
        nutrition: selectedRecipe.nutrition,
        difficulty: selectedRecipe.difficulty as 'Easy' | 'Medium' | 'Hard',
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        tags: selectedRecipe.tags
      };
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      // Preserve your original XP choice for Whey (+25) unless you want to align to Egg (+100):
      addPoints(25);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  // Filter and sort
  const filteredShakes = useMemo(() => {
    let filtered = wheyProteinShakes.filter(shake => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        shake.name.toLowerCase().includes(q) ||
        shake.description.toLowerCase().includes(q) ||
        (shake.ingredients || []).some((ing: string) => ing.toLowerCase().includes(q));
      const matchesGoal = !selectedGoal || shake.fitnessGoal.toLowerCase().includes(selectedGoal.toLowerCase());
      const matchesWheyType = !selectedWheyType || shake.wheyType.toLowerCase().includes(selectedWheyType.toLowerCase());
      return matchesSearch && matchesGoal && matchesWheyType;
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
  }, [searchQuery, selectedGoal, selectedWheyType, sortBy]);

  const featuredShakes = wheyProteinShakes.filter(shake => shake.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
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

      {/* RecipeKit modal (controlled) */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="blue"
          pointsReward={25}
          onComplete={handleCompleteRecipe}
          item={{
            id: selectedRecipe.id,
            name: selectedRecipe.name,
            prepTime: selectedRecipe.prepTime,
            directions: selectedRecipe.recipe?.directions || [],
            measurements: selectedRecipe.recipe?.measurements || [],
            baseNutrition: selectedRecipe.nutrition || {},
            defaultServings: selectedRecipe.recipe?.servings || 1
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
                <Dumbbell className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Whey Protein Shakes</h1>
                <Badge className="bg-blue-100 text-blue-800">Premium</Badge>
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
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSharePage}>
                <Share2 className="h-4 w-4 mr-2" />
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

        {/* Sister Subpages Navigation */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Protein Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
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
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-600">35g+</div><div className="text-sm text-gray-600">Avg Protein</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">4.7★</div><div className="text-sm text-gray-600">Avg Rating</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-purple-600">3 min</div><div className="text-sm text-gray-600">Avg Prep</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-orange-600">6</div><div className="text-sm text-gray-600">Recipes</div></CardContent></Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'types', label: 'Whey Types', icon: Beaker },
            { id: 'goals', label: 'By Goal', icon: Target },
            { id: 'featured', label: 'Featured', icon: Star }
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

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div>
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search whey protein shakes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedGoal}
                  onChange={(e) => setSelectedGoal(e.target.value)}
                >
                  <option value="">All Goals</option>
                  {fitnessGoals.map(goal => (
                    <option key={goal.id} value={goal.name}>{goal.name}</option>
                  ))}
                </select>
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedWheyType}
                  onChange={(e) => setSelectedWheyType(e.target.value)}
                >
                  <option value="">All Types</option>
                  {wheyTypes.map(type => (
                    <option key={type.id} value={type.name}>{type.name}</option>
                  ))}
                </select>
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
                  <option value="calories">Sort by Calories</option>
                  <option value="time">Sort by Prep Time</option>
                </select>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShakes.map(shake => {
                const useMetric = !!metricFlags[shake.id];
                return (
                  <Card key={shake.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
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
                              description: `${shake.fitnessGoal} • ${shake.wheyType}`,
                              ingredients: shake.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || shake.ingredients,
                              nutrition: shake.nutrition,
                              difficulty: shake.difficulty as 'Easy' | 'Medium' | 'Hard',
                              prepTime: shake.prepTime,
                              rating: shake.rating,
                              tags: shake.tags,
                            };
                            addToFavorites(drinkData);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(shake.id) ? 'fill-red-500 text-red-500' : ''}`} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{shake.wheyType}</Badge>
                        <Badge className="bg-blue-100 text-blue-800">{shake.fitnessGoal}</Badge>
                        {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-blue-600">{shake.nutrition?.protein ?? '—'}{shake.nutrition?.protein ? 'g' : ''}</div>
                          <div className="text-gray-500">Protein</div>
                        </div>
                        <div>
                          <div className="font-bold text-green-600">{shake.nutrition?.calories ?? '—'}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-purple-600">{shake.prepTime}min</div>
                          <div className="text-gray-500">Prep</div>
                        </div>
                      </div>

                      {/* Key Info */}
                      <div className="space-y-2 mb-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Absorption:</span>
                          <span className="font-medium">{shake.absorptionTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Leucine:</span>
                          <span className="font-medium">{shake.leucineContent}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Best Time:</span>
                          <span className="font-medium text-xs">{shake.bestTime}</span>
                        </div>
                      </div>

                      {/* Rating */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{shake.rating}</span>
                          <span className="text-gray-500 text-sm">({shake.reviews})</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {shake.difficulty}
                        </Badge>
                      </div>

                      {/* Compact measured recipe preview + inline actions (Egg pattern) */}
                      {shake.recipe?.measurements && (
                        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="text-sm font-semibold text-gray-900 mb-1">
                            Recipe (serves {shake.recipe.servings || 1})
                          </div>
                          <ul className="text-sm leading-6 text-gray-800 space-y-1">
                            {shake.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                              const isNum = typeof ing.amount === 'number';
                              const display = useMetric && isNum
                                ? toMetric(ing.unit, ing.amount as number)
                                : { amount: ing.amount as number | string, unit: ing.unit };
                              return (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-blue-600 mt-0.5" />
                                  <span>
                                    <span className="text-blue-700 font-semibold">
                                      {display.amount} {display.unit}
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
                                    const mm = toMetric(ing.unit, ing.amount);
                                    return `- ${mm.amount} ${mm.unit} ${ing.item}${ing.note ? ` — ${ing.note}` : ''}`;
                                  }
                                  return `- ${ing.amount} ${ing.unit} ${ing.item}${ing.note ? ` — ${ing.note}` : ''}`;
                                });
                                const txt = `${shake.name} (serves ${shake.recipe?.servings || 1})\n${lines.join('\n')}`;
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
                            <Button variant="outline" size="sm" onClick={() => handleShareShake(shake)}>
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
                        </div>
                      )}

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {shake.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                          onClick={() => openRecipeModal(shake)}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Make Shake (+25 XP)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleShareShake(shake)}>
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Whey Types Tab */}
        {activeTab === 'types' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {wheyTypes.map(type => {
              const Icon = type.icon;
              const typeShakes = wheyProteinShakes.filter(shake =>
                shake.wheyType.toLowerCase().includes(type.id)
              );

              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Icon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{type.name}</CardTitle>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Absorption:</span>
                        <span className="font-medium">{type.absorptionTime}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Protein Content:</span>
                        <span className="font-medium">{type.proteinContent}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Best For:</span>
                        <span className="font-medium text-xs">{type.bestFor}</span>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-1">
                        {typeShakes.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          setSelectedWheyType(type.name);
                          setActiveTab('browse');
                        }}
                      >
                        View {type.name} Recipes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Goals Tab */}
        {activeTab === 'goals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fitnessGoals.map(goal => {
              const Icon = goal.icon;
              const goalShakes = wheyProteinShakes.filter(shake =>
                shake.fitnessGoal.toLowerCase().includes(goal.name.toLowerCase())
              );

              return (
                <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${goal.color.replace('text-', 'bg-').replace('-600', '-100')}`}>
                        <Icon className={`h-6 w-6 ${goal.color}`} />
                      </div>
                      <CardTitle className="text-lg">{goal.name}</CardTitle>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${goal.color} mb-1`}>
                        {goalShakes.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-4">Optimized Recipes</div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          setSelectedGoal(goal.name);
                          setActiveTab('browse');
                        }}
                      >
                        View {goal.name} Shakes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Featured Tab */}
        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredShakes.map(shake => {
              const useMetric = !!metricFlags[shake.id];
              return (
                <Card key={shake.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="relative">
                    {shake.image && (
                      <img
                        src={shake.image}
                        alt={shake.name}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-yellow-500 text-white">Featured</Badge>
                    </div>
                    <div className="absolute top-4 right-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const drinkData = {
                            id: shake.id,
                            name: shake.name,
                            category: 'protein-shakes' as const,
                            description: `${shake.fitnessGoal} • ${shake.wheyType}`,
                            ingredients: shake.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || shake.ingredients,
                            nutrition: shake.nutrition,
                            difficulty: shake.difficulty as 'Easy' | 'Medium' | 'Hard',
                            prepTime: shake.prepTime,
                            rating: shake.rating,
                            tags: shake.tags,
                          };
                          addToFavorites(drinkData);
                        }}
                        className="bg-white/80 hover:bg-white text-gray-600 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(shake.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                  </div>

                  <CardHeader>
                    <CardTitle className="text-xl">{shake.name}</CardTitle>
                    <p className="text-gray-600">{shake.description}</p>

                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">{shake.wheyType}</Badge>
                      <Badge className="bg-blue-100 text-blue-800">{shake.fitnessGoal}</Badge>
                      <div className="flex items-center gap-1 ml-auto">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{shake.rating}</span>
                        <span className="text-gray-500 text-sm">({shake.reviews})</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Enhanced nutrition display */}
                    <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">{shake.nutrition?.protein ?? '—'}{shake.nutrition?.protein ? 'g' : ''}</div>
                        <div className="text-xs text-gray-600">Protein</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600">{shake.nutrition?.calories ?? '—'}</div>
                        <div className="text-xs text-gray-600">Calories</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-purple-600">{shake.nutrition?.carbs ?? '—'}{shake.nutrition?.carbs ? 'g' : ''}</div>
                        <div className="text-xs text-gray-600">Carbs</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-orange-600">{shake.prepTime}min</div>
                        <div className="text-xs text-gray-600">Prep</div>
                      </div>
                    </div>

                    {/* Detailed info */}
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Absorption Time:</span>
                        <span className="font-medium">{shake.absorptionTime}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Leucine Content:</span>
                        <span className="font-medium">{shake.leucineContent}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{shake.bestTime}</span>
                      </div>
                    </div>

                    {/* Compact measured recipe preview (same as browse) */}
                    {shake.recipe?.measurements && (
                      <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="text-sm font-semibold text-gray-900 mb-1">
                          Recipe (serves {shake.recipe.servings || 1})
                        </div>
                        <ul className="text-sm leading-6 text-gray-800 space-y-1">
                          {shake.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                            const isNum = typeof ing.amount === 'number';
                            const display = useMetric && isNum
                              ? toMetric(ing.unit, ing.amount as number)
                              : { amount: ing.amount as number | string, unit: ing.unit };
                            return (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-blue-600 mt-0.5" />
                                <span>
                                  <span className="text-blue-700 font-semibold">
                                    {display.amount} {display.unit}
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
                                  const mm = toMetric(ing.unit, ing.amount);
                                  return `- ${mm.amount} ${mm.unit} ${ing.item}${ing.note ? ` — ${ing.note}` : ''}`;
                                }
                                return `- ${ing.amount} ${ing.unit} ${ing.item}${ing.note ? ` — ${ing.note}` : ''}`;
                              });
                              const txt = `${shake.name} (serves ${shake.recipe?.servings || 1})\n${lines.join('\n')}`;
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
                          <Button variant="outline" size="sm" onClick={() => handleShareShake(shake)}>
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
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={() => openRecipeModal(shake)}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Make This Shake (+25 XP)
                      </Button>
                      <Button variant="outline" onClick={() => handleShareShake(shake)}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
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
