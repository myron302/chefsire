import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Dumbbell, Clock, Users, Trophy, Heart, Star, 
  Search, Filter, Share2, ArrowLeft, Activity,
  BarChart3, Sparkles, Plus, Camera, Zap, X, Check,
  Apple, Sun, Leaf, Palmtree, Droplets, Clipboard, RotateCcw,
  Crown, Wine, Flame
, Coffee} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import RecipeKit from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// scaling helpers
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

// metric conversion for smoothies
const toMetric = (unit: string, amount: number) => {
  const mlPerCup = 240, mlPerOz = 30;
  switch (unit) {
    case 'cup': return { amount: Math.round(amount * mlPerCup), unit: 'ml' };
    case 'oz': return { amount: Math.round(amount * mlPerOz), unit: 'ml' };
    case 'tbsp': return { amount: Math.round(amount * 15), unit: 'ml' };
    case 'tsp': return { amount: Math.round(amount * 5), unit: 'ml' };
    default: return { amount, unit };
  }
};

// Improved ingredient parser that handles fractions and descriptors properly
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

  // If unit looks like a descriptor (not a real unit), fold it back into the item
  const descriptors = new Set(['low-fat', 'frozen', 'unsweetened', 'natural', 'vanilla', 'plain', 'fresh']);
  if (descriptors.has(unit)) {
    item = [unit, item].filter(Boolean).join(' ').trim();
    unit = 'item'; // generic unit
  }

  // Handle notes like "(optional)"
  if (item.includes('(optional)')) {
    item = item.replace('(optional)', '').trim();
    return m(amount, unit, item, 'optional');
  }
  
  return m(amount, unit, item);
};

// Enhanced workout smoothies data with proper measurements
const workoutSmoothies = [
  {
    id: 'workout-1',
    name: 'Pre-Workout Power Blend',
    description: 'Energy-boosting smoothie for intense workouts',
    ingredients: [
      '1 banana',
      '1/2 cup oats',
      '1 tbsp peanut butter',
      '1 cup almond milk',
      '1 tsp honey',
      '1 cup ice'
    ],
    benefits: ['Sustained energy', 'Complex carbs', 'Healthy fats', 'Pre-workout fuel'],
    nutrition: { calories: 350, protein: 12, carbs: 48, fiber: 7, sugar: 24, added_sugar: 12 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 523,
    workoutType: 'Pre-Workout',
    energyLevel: 'High',
    featured: true,
    trending: true,
    bestTime: '30-60 min before workout',
    image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop',
    estimatedCost: 3.20
  },
  {
    id: 'workout-2',
    name: 'Post-Workout Recovery',
    description: 'Protein-packed recovery smoothie',
    ingredients: [
      '1 cup mixed berries',
      '1 scoop protein powder',
      '1 banana',
      '1 cup coconut water',
      '1 tbsp chia seeds',
      '1 cup ice'
    ],
    benefits: ['Muscle recovery', 'Protein synthesis', 'Rehydration', 'Antioxidants'],
    nutrition: { calories: 320, protein: 25, carbs: 42, fiber: 8, sugar: 28, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 687,
    workoutType: 'Post-Workout',
    energyLevel: 'Recovery',
    featured: true,
    bestTime: 'Within 30 min after workout',
    estimatedCost: 4.50
  },
  {
    id: 'workout-3',
    name: 'HIIT Energy Booster',
    description: 'Quick energy for high-intensity training',
    ingredients: [
      '1/2 cup pineapple',
      '1/2 banana',
      '1 cup spinach',
      '1/2 cup coconut water',
      '1 tbsp honey',
      '1 cup ice'
    ],
    benefits: ['Quick energy', 'Electrolytes', 'Natural sugars', 'Hydration'],
    nutrition: { calories: 180, protein: 3, carbs: 42, fiber: 4, sugar: 35, added_sugar: 12 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 412,
    workoutType: 'Pre-Workout',
    energyLevel: 'Very High',
    trending: true,
    bestTime: '15-30 min before workout',
    estimatedCost: 2.80
  },
  {
    id: 'workout-4',
    name: 'Endurance Builder',
    description: 'Sustained energy for long workouts',
    ingredients: [
      '1/2 cup oats',
      '1 banana',
      '2 tbsp almond butter',
      '1 cup milk',
      '1 tsp cinnamon',
      '1 cup ice'
    ],
    benefits: ['Long-lasting energy', 'Slow-release carbs', 'Healthy fats', 'Stamina boost'],
    nutrition: { calories: 420, protein: 15, carbs: 52, fiber: 9, sugar: 28, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 298,
    workoutType: 'Endurance',
    energyLevel: 'Sustained',
    bestTime: '1 hour before workout',
    estimatedCost: 3.60
  },
  {
    id: 'workout-5',
    name: 'Strength Training Fuel',
    description: 'Muscle-building pre-workout blend',
    ingredients: [
      '1 cup Greek yogurt',
      '1/2 cup oats',
      '1 banana',
      '2 tbsp peanut butter',
      '1/2 cup milk',
      '1 cup ice'
    ],
    benefits: ['Muscle fuel', 'Protein rich', 'Energy boost', 'Strength support'],
    nutrition: { calories: 480, protein: 28, carbs: 58, fiber: 7, sugar: 32, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 534,
    workoutType: 'Strength',
    energyLevel: 'High',
    featured: true,
    bestTime: '45 min before workout',
    estimatedCost: 4.20
  },
  {
    id: 'workout-6',
    name: 'Cardio Crush',
    description: 'Light and energizing for cardio sessions',
    ingredients: [
      '1 cup watermelon',
      '1/2 cup strawberries',
      '1/2 banana',
      '1 cup coconut water',
      '1 tbsp lime juice',
      '1 cup ice'
    ],
    benefits: ['Hydration', 'Natural electrolytes', 'Light energy', 'Fat burning support'],
    nutrition: { calories: 160, protein: 3, carbs: 38, fiber: 4, sugar: 30, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 367,
    workoutType: 'Cardio',
    energyLevel: 'Medium',
    bestTime: '30 min before cardio',
    estimatedCost: 2.50
  },
  {
    id: 'workout-7',
    name: 'Recovery Greens',
    description: 'Anti-inflammatory post-workout blend',
    ingredients: [
      '2 cups spinach',
      '1/2 avocado',
      '1/2 banana',
      '1 cup coconut water',
      '1 tbsp ginger',
      '1 tsp honey',
      '1 cup ice'
    ],
    benefits: ['Reduces inflammation', 'Aids recovery', 'Nutrient dense', 'Alkalizing'],
    nutrition: { calories: 240, protein: 5, carbs: 32, fiber: 10, sugar: 18, added_sugar: 12 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 445,
    workoutType: 'Recovery',
    energyLevel: 'Recovery',
    bestTime: 'After workout',
    estimatedCost: 3.80
  },
  {
    id: 'workout-8',
    name: 'Yoga Flow Blend',
    description: 'Light and energizing for yoga practice',
    ingredients: [
      '1 cup mango',
      '1/2 cup pineapple',
      '1/2 cup spinach',
      '1 cup coconut water',
      '1 tsp matcha powder',
      '1 cup ice'
    ],
    benefits: ['Gentle energy', 'Mindful fuel', 'Antioxidants', 'Calm focus'],
    nutrition: { calories: 200, protein: 4, carbs: 44, fiber: 5, sugar: 36, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 389,
    workoutType: 'Yoga',
    energyLevel: 'Gentle',
    trending: true,
    bestTime: '30-60 min before practice',
    estimatedCost: 3.40
  }
];

const workoutTypes = [
  {
    id: 'pre-workout',
    name: 'Pre-Workout',
    icon: Zap,
    description: 'Energy boost before training',
    color: 'text-sky-600',
    timing: '30-60 min before',
    focus: 'Energy & Performance'
  },
  {
    id: 'post-workout',
    name: 'Post-Workout',
    icon: Trophy,
    description: 'Recovery and muscle repair',
    color: 'text-sky-600',
    timing: 'Within 30 min after',
    focus: 'Recovery & Protein'
  },
  {
    id: 'endurance',
    name: 'Endurance',
    icon: Activity,
    description: 'Sustained energy for long sessions',
    color: 'text-sky-600',
    timing: '1 hour before',
    focus: 'Stamina & Endurance'
  },
  {
    id: 'strength',
    name: 'Strength',
    icon: Dumbbell,
    description: 'Muscle-building support',
    color: 'text-sky-600',
    timing: '45 min before',
    focus: 'Strength & Power'
  },
  {
    id: 'cardio',
    name: 'Cardio',
    icon: Activity,
    description: 'Light fuel for cardio sessions',
    color: 'text-sky-600',
    timing: '30 min before',
    focus: 'Endurance & Hydration'
  },
  {
    id: 'recovery',
    name: 'Recovery',
    icon: Heart,
    description: 'Post-workout restoration',
    color: 'text-sky-600',
    timing: 'After workout',
    focus: 'Recovery & Repair'
  }
];

const workoutBenefitsList = [
  { id: 'energy', name: 'Energy Boost', description: 'Enhanced workout performance' },
  { id: 'recovery', name: 'Muscle Recovery', description: 'Faster post-workout repair' },
  { id: 'hydration', name: 'Hydration', description: 'Electrolyte balance' },
  { id: 'protein', name: 'Protein Synthesis', description: 'Muscle building support' },
  { id: 'endurance', name: 'Endurance', description: 'Extended workout capacity' },
  { id: 'recovery', name: 'Inflammation Reduction', description: 'Reduced muscle soreness' }
];

// ---------- Cross-nav - Top Level Drink Categories ----------
const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'smoothies', name: 'All Smoothies', icon: Sparkles, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Flame, route: '/drinks', description: 'Browse everything' }
];

// Sister smoothie subcategories (excluding workout since we're on workout page)
const allSmoothieSubcategories = [
  { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Zap, description: 'High-protein blends' },
  { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Crown, description: 'Morning fuel' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Superfood greens' },
  { id: 'tropical', name: 'Tropical', path: '/drinks/smoothies/tropical', icon: Palmtree, description: 'Island flavors' },
  { id: 'berry', name: 'Berry', path: '/drinks/smoothies/berry', icon: Heart, description: 'Antioxidant rich' },
  { id: 'detox', name: 'Detox', path: '/drinks/smoothies/detox', icon: Droplets, description: 'Cleansing blends' },
  { id: 'dessert', name: 'Dessert', path: '/drinks/smoothies/dessert', icon: Sparkles, description: 'Healthy treats' }
];

const workoutAdvantages = [
  { icon: Zap, title: 'Performance Boost', description: 'Enhanced workout energy and stamina', color: 'text-sky-600' },
  { icon: Trophy, title: 'Faster Recovery', description: 'Reduced muscle soreness and fatigue', color: 'text-sky-600' },
  { icon: Activity, title: 'Muscle Support', description: 'Protein for muscle repair and growth', color: 'text-sky-600' },
  { icon: Heart, title: 'Hydration', description: 'Electrolyte balance and fluid replacement', color: 'text-sky-600' },
  { icon: Dumbbell, title: 'Strength Building', description: 'Nutrients for muscle development', color: 'text-sky-600' },
  { icon: Clock, title: 'Optimal Timing', description: 'Perfect fuel for workout schedules', color: 'text-sky-600' }
];

export default function WorkoutSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkoutType, setSelectedWorkoutType] = useState('');
  const [selectedBenefit, setSelectedBenefit] = useState('');
  const [maxCalories, setMaxCalories] = useState<number | 'all'>('all');
  const [onlyNaturalSweetener, setOnlyNaturalSweetener] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'cost' | 'calories'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'workout-types'|'benefits'|'featured'|'trending'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert workout smoothies to RecipeKit format with robust parsing
  const smoothieRecipesWithMeasurements = useMemo(() => {
    return workoutSmoothies.map((s) => {
      const rawList = Array.isArray(s.ingredients) ? s.ingredients : [];
      
      // Normalize everything to { amount, unit, item, note }
      const measurements = rawList.map((ing: any) => {
        if (typeof ing === 'string') return parseIngredient(ing);
        // If already measured object, keep as-is
        const { amount = 1, unit = 'item', item = '', note = '' } = ing || {};
        return { amount, unit, item, note };
      });

      return {
        ...s,
        recipe: {
          servings: 1,
          measurements,
          directions: [
            'Add all ingredients to blender',
            'Blend until smooth and creamy',
            'Drink 30-60 minutes before workout for pre-workout smoothies',
            'Consume within 30 minutes after workout for recovery smoothies'
          ]
        }
      };
    });
  }, []);

  const handleShareSmoothie = async (smoothie: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[smoothie.id] ?? (smoothie.recipe?.servings || 1);
    const preview = smoothie.ingredients.slice(0, 4).join(' • ');
    const text = `${smoothie.name} • ${smoothie.workoutType} • ${smoothie.bestTime}\n${preview}${smoothie.ingredients.length > 4 ? ` …plus ${smoothie.ingredients.length - 4} more` : ''}`;
    const shareData = { title: smoothie.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${smoothie.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${smoothie.name}\n${text}\n${url}`);
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
        category: 'smoothies' as const,
        description: `${selectedRecipe.workoutType || ''} • ${selectedRecipe.bestTime || ''}`,
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
      addPoints(30); // XP for workout smoothies
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredSmoothies = () => {
    let filtered = smoothieRecipesWithMeasurements.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedWorkoutType || smoothie.workoutType === selectedWorkoutType;
      const matchesBenefit = !selectedBenefit || smoothie.benefits.some((b: string) => b.toLowerCase().includes(selectedBenefit.toLowerCase()));
      const matchesCalories = maxCalories === 'all' || smoothie.nutrition.calories <= maxCalories;
      const matchesSweetener = !onlyNaturalSweetener || smoothie.nutrition.added_sugar === 0;
      return matchesSearch && matchesType && matchesBenefit && matchesCalories && matchesSweetener;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = smoothieRecipesWithMeasurements.filter(s => s.featured);
  const trendingSmoothies = smoothieRecipesWithMeasurements.filter(s => s.trending);

  // Share page handler
  const handleSharePage = async () => {
    const shareData = {
      title: 'Workout Smoothies',
      text: `Browse ${workoutSmoothies.length} workout smoothies for performance and recovery.`,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50">
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

      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="sky"
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

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/smoothies">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Smoothies
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Activity className="h-6 w-6 text-sky-600" />
                <h1 className="text-2xl font-bold text-gray-900">Workout Smoothies</h1>
                <Badge className="bg-sky-100 text-sky-800">Performance</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowUniversalSearch(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-sky-600 hover:bg-sky-700" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* CROSS-HUB NAVIGATION - Top Level Drink Categories */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-sky-50 hover:border-sky-300">
                      <Icon className="h-4 w-4 mr-2 text-sky-600" />
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

        {/* SISTER SUBPAGES NAVIGATION - ALL SMOOTHIE TYPES (No Workout) */}
        <Card className="bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {allSmoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-sky-50 hover:border-sky-300">
                      <Icon className="h-4 w-4 mr-2 text-sky-600" />
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

        {/* Workout Advantages */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Activity className="h-6 w-6 text-sky-500" />
              Why Workout Smoothies?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workoutAdvantages.map((advantage, index) => {
                const Icon = advantage.icon as any;
                return (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow">
                    <Icon className={`h-6 w-6 ${advantage.color} flex-shrink-0`} />
                    <div>
                      <h3 className="font-semibold mb-1">{advantage.title}</h3>
                      <p className="text-sm text-muted-foreground">{advantage.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-sky-600">15g+</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-600">4 min</div>
              <div className="text-sm text-gray-600">Avg Prep</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{workoutSmoothies.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'workout-types', label: 'Workout Types', icon: Activity },
            { id: 'benefits', label: 'Benefits', icon: Trophy },
            { id: 'featured', label: 'Featured', icon: Star },
            { id: 'trending', label: 'Trending', icon: Zap }
          ].map(tab => {
            const Icon = tab.icon as any;
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

        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      placeholder="Search workout smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedWorkoutType}
                      onChange={(e) => setSelectedWorkoutType(e.target.value)}
                    >
                      <option value="">All Workout Types</option>
                      {workoutTypes.map(type => (
                        <option key={type.id} value={type.name}>{type.name}</option>
                      ))}
                    </select>

                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedBenefit}
                      onChange={(e) => setSelectedBenefit(e.target.value)}
                    >
                      <option value="">All Benefits</option>
                      {workoutBenefitsList.map(benefit => (
                        <option key={benefit.id} value={benefit.name}>{benefit.name}</option>
                      ))}
                    </select>
                    
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={maxCalories}
                      onChange={(e) => {
                        const v = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setMaxCalories(v);
                      }}
                    >
                      <option value="all">All Calories</option>
                      <option value={200}>Under 200 cal</option>
                      <option value={250}>Under 250 cal</option>
                      <option value={300}>Under 300 cal</option>
                      <option value={350}>Under 350 cal</option>
                    </select>
                    
                    <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                      <input
                        type="checkbox"
                        checked={onlyNaturalSweetener}
                        onChange={(e) => setOnlyNaturalSweetener(e.target.checked)}
                      />
                      Natural Sweeteners
                    </label>

                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="protein">Sort by Protein</option>
                      <option value="cost">Sort by Cost</option>
                      <option value="calories">Sort by Calories</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Smoothie Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSmoothies.map(smoothie => {
                const useMetric = !!metricFlags[smoothie.id];
                const servings = servingsById[smoothie.id] ?? (smoothie.recipe?.servings || 1);

                return (
                  <Card key={smoothie.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="md:max-w-3xl md:flex-1">
                          <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addToFavorites({
                            id: smoothie.id,
                            name: smoothie.name,
                            category: 'smoothies',
                            description: smoothie.description,
                            ingredients: smoothie.ingredients,
                            nutrition: smoothie.nutrition,
                            difficulty: smoothie.difficulty,
                            prepTime: smoothie.prepTime,
                            rating: smoothie.rating,
                            fitnessGoal: smoothie.workoutType,
                            bestTime: smoothie.bestTime
                          })}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className="bg-sky-100 text-sky-800">{smoothie.workoutType}</Badge>
                        <Badge variant="outline">{smoothie.energyLevel}</Badge>
                        {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-sky-600">{smoothie.nutrition.protein}g</div>
                          <div className="text-gray-500">Protein</div>
                        </div>
                        <div>
                          <div className="font-bold text-blue-600">{smoothie.nutrition.calories}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-cyan-600">{smoothie.prepTime}m</div>
                          <div className="text-gray-500">Prep</div>
                        </div>
                      </div>

                      {/* RATING & DIFFICULTY - Immediately above recipe card */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{smoothie.rating}</span>
                          <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {smoothie.difficulty}
                        </Badge>
                      </div>

                      {/* RecipeKit Preview */}
                      {Array.isArray(smoothie.recipe?.measurements) && smoothie.recipe.measurements.length > 0 && (
                        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-900">
                              Recipe (serves {servings})
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [smoothie.id]: clamp((prev[smoothie.id] ?? (smoothie.recipe?.servings || 1)) - 1) }))
                                }
                                aria-label="decrease servings"
                              >
                                −
                              </button>
                              <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [smoothie.id]: clamp((prev[smoothie.id] ?? (smoothie.recipe?.servings || 1)) + 1) }))
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
                                  next[smoothie.id] = smoothie.recipe?.servings || 1;
                                  return next;
                                })}
                                title="Reset servings"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                              </Button>
                            </div>
                          </div>

                          <ul className="text-sm leading-6 text-gray-800 space-y-1">
                            {smoothie.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                              const isNum = typeof ing.amount === 'number';
                              const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                              const show = useMetric && isNum
                                ? toMetric(ing.unit, Number((typeof ing.amount === 'number' ? (ing.amount as number) : parseFloat(String(ing.amount))) * servings))
                                : { amount: scaledDisplay, unit: ing.unit };

                              return (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-sky-600 mt-0.5" />
                                  <span>
                                    <span className="text-sky-700 font-semibold">
                                      {show.amount} {show.unit}
                                    </span>{" "}
                                    {ing.item}
                                    {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                                  </span>
                                </li>
                              );
                            })}
                            {smoothie.recipe.measurements.length > 4 && (
                              <li className="text-xs text-gray-600">
                                …plus {smoothie.recipe.measurements.length - 4} more •{" "}
                                <button
                                  type="button"
                                  onClick={() => openRecipeModal(smoothie)}
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
                                const lines = smoothie.ingredients.map((ing: string) => `- ${ing}`);
                                const txt = `${smoothie.name} (serves ${servings})\n${lines.join('\n')}`;
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
                            <Button variant="outline" size="sm" onClick={() => handleShareSmoothie(smoothie, servings)}>
                              <Share2 className="w-4 h-4 mr-1" /> Share
                            </Button>
                            {/* Metric Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setMetricFlags((prev) => ({ ...prev, [smoothie.id]: !prev[smoothie.id] }))
                              }
                            >
                              {useMetric ? 'US' : 'Metric'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Best Time */}
                      <div className="space-y-2 mb-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Best Time:</span>
                          <span className="font-medium text-sky-600">{smoothie.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {smoothie.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-sky-100 text-sky-800 hover:bg-sky-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Smoothie Button */}
                      <div className="mt-3">
                        <Button 
                          className="w-full bg-sky-600 hover:bg-sky-700"
                          onClick={() => openRecipeModal(smoothie)}
                        >
                          <Activity className="h-4 w-4 mr-2" />
                          Make Smoothie (+30 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Workout Types Tab */}
        {activeTab === 'workout-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workoutTypes.map(type => {
              const Icon = type.icon;
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Icon className="h-6 w-6 text-sky-600" />
                      </div>
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center bg-sky-50 p-3 rounded-lg mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-1">Timing</div>
                      <div className="text-lg font-bold text-sky-600">{type.timing}</div>
                    </div>
                    <Button className="w-full" onClick={() => setActiveTab('browse')}>
                      Explore {type.name}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Benefits Tab */}
        {activeTab === 'benefits' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workoutBenefitsList.map(benefit => (
              <Card key={benefit.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-100 rounded-lg">
                      <Trophy className="h-6 w-6 text-sky-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{benefit.name}</CardTitle>
                      <p className="text-sm text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-sky-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Performance Focus</div>
                    <div className="text-lg font-bold text-sky-600">Workout Support</div>
                  </div>
                  <Button className="w-full" onClick={() => setActiveTab('browse')}>
                    View {benefit.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Featured Tab */}
        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative h-48">
                  {smoothie.image && (
                    <img 
                      src={smoothie.image} 
                      alt={smoothie.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <Badge className="absolute top-4 left-4 bg-sky-500 text-white">Featured</Badge>
                </div>
                
                <CardHeader>
                  <CardTitle>{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-sky-600 hover:bg-sky-700"
                    onClick={() => openRecipeModal(smoothie)}
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Make This Workout Smoothie
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Trending Tab */}
        {activeTab === 'trending' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="hover:shadow-lg transition-shadow border-2 border-sky-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="md:max-w-3xl md:flex-1">
                      <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                      <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                    </div>
                    <Badge className="bg-red-500 text-white">🔥 Trending</Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-sky-600 hover:bg-sky-700"
                    onClick={() => openRecipeModal(smoothie)}
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Try This Trend
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-sky-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-cyan-600">
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
