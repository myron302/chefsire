// client/src/pages/drinks/detoxes/juice/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Droplets, Clock, Heart, Star, Target, Flame, Leaf, Sparkles,
  Search, Share2, ArrowLeft, Zap, Apple, Camera,
  FlaskConical, GlassWater, Coffee, Waves, X, Check, Clipboard, RotateCcw
} from 'lucide-react';
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

// metric conversion for detox juices
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

// ---------- Navigation data ----------
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'caffeinated', name: 'Caffeinated Drinks', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea & energy' },
  { id: 'detoxes', name: 'Detoxes', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: GlassWater, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const detoxTypes = [
  {
    id: 'gentle',
    name: 'Gentle Cleanse',
    description: 'Daily maintenance and gentle detoxification',
    icon: Leaf,
    intensity: 'Gentle',
    duration: 'Daily',
    color: 'text-green-600',
    benefits: ['Daily maintenance', 'Gentle cleansing', 'Hydration support']
  },
  {
    id: 'moderate',
    name: 'Moderate Reset',
    description: 'Weekly reset for digestive and liver health',
    icon: Target,
    intensity: 'Moderate',
    duration: '3-7 days',
    color: 'text-blue-600',
    benefits: ['Liver support', 'Digestive reset', 'Toxin elimination']
  },
  {
    id: 'intense',
    name: 'Intense Cleanse',
    description: 'Deep cellular cleansing and heavy metal support',
    icon: Flame,
    intensity: 'Intense',
    duration: '1-3 days',
    color: 'text-red-600',
    benefits: ['Deep cleansing', 'Heavy metal support', 'Cellular detox']
  },
  {
    id: 'seasonal',
    name: 'Seasonal Cleanse',
    description: 'Seasonal transitions and immune system support',
    icon: Sparkles,
    intensity: 'Moderate',
    duration: 'Seasonal',
    color: 'text-purple-600',
    benefits: ['Immune support', 'Seasonal transition', 'Allergy relief']
  }
];

// ---------- Detox Juices Data ----------
const detoxJuices = [
  {
    id: 'green-detox-1',
    name: 'Green Cleanse Elixir',
    description: 'Powerful chlorophyll-rich blend for deep cellular cleansing',
    nutrition: { calories: 85, protein: 2, carbs: 18, fat: 1, fiber: 4 },
    difficulty: 'Easy',
    prepTime: 8,
    rating: 4.8,
    reviews: 342,
    trending: true,
    featured: true,
    detoxType: 'Deep Cleanse',
    detoxLevel: 'Intense',
    category: 'Green',
    bestTime: 'Morning (empty stomach)',
    duration: '3-5 days',
    estimatedCost: 3.50,
    ingredients: ['2 cups kale', '1 cucumber', '2 celery stalks', '1 green apple', '1 lemon', '1 inch ginger'],
    benefits: ['Liver detoxification', 'Alkalizing', 'Digestive cleanse', 'Skin clarity'],
    specialInstructions: 'Drink immediately after juicing for maximum enzyme activity'
  },
  {
    id: 'liver-flush-1',
    name: 'Liver Flush Tonic',
    description: 'Targeted liver support with bitter herbs and citrus',
    nutrition: { calories: 95, protein: 1, carbs: 22, fat: 0, fiber: 3 },
    difficulty: 'Easy',
    prepTime: 7,
    rating: 4.6,
    reviews: 287,
    trending: false,
    featured: false,
    detoxType: 'Liver Support',
    detoxLevel: 'Moderate',
    category: 'Citrus',
    bestTime: 'Between meals',
    duration: '7-10 days',
    estimatedCost: 4.20,
    ingredients: ['1 grapefruit', '2 lemons', '1 beet', '1 carrot', '1 inch turmeric'],
    benefits: ['Liver cleansing', 'Gallbladder support', 'Antioxidant boost', 'Inflammation reduction'],
    specialInstructions: 'Best consumed 2 hours after meals'
  },
  {
    id: 'digestive-rescue',
    name: 'Digestive Rescue Juice',
    description: 'Soothing blend for gut health and digestive restoration',
    nutrition: { calories: 78, protein: 2, carbs: 16, fat: 1, fiber: 5 },
    difficulty: 'Easy',
    prepTime: 6,
    rating: 4.7,
    reviews: 198,
    trending: true,
    featured: false,
    detoxType: 'Digestive',
    detoxLevel: 'Gentle',
    category: 'Root',
    bestTime: 'Before meals',
    duration: 'Ongoing',
    estimatedCost: 3.80,
    ingredients: ['1 fennel bulb', '2 carrots', '1 pear', '1 inch ginger', '1 tsp aloe vera'],
    benefits: ['Gut healing', 'Anti-inflammatory', 'Bloating relief', 'Digestive enzyme support'],
    specialInstructions: 'Sip slowly 20 minutes before main meals'
  },
  {
    id: 'immunity-shield',
    name: 'Immunity Shield Booster',
    description: 'Vitamin C powerhouse for immune system fortification',
    nutrition: { calories: 112, protein: 2, carbs: 26, fat: 1, fiber: 4 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.9,
    reviews: 423,
    trending: false,
    featured: true,
    detoxType: 'Immune Support',
    detoxLevel: 'Moderate',
    category: 'Citrus',
    bestTime: 'Morning or when feeling run down',
    duration: 'Seasonal',
    estimatedCost: 4.50,
    ingredients: ['3 oranges', '1 lemon', '2 carrots', '1 inch ginger', '1 tsp manuka honey'],
    benefits: ['Immune boosting', 'Antiviral', 'Vitamin C rich', 'Energy enhancement'],
    specialInstructions: 'Consume daily during cold/flu season'
  },
  {
    id: 'red-radiance',
    name: 'Red Radiance Cleanse',
    description: 'Antioxidant-rich red juice for cellular protection',
    nutrition: { calories: 105, protein: 2, carbs: 24, fat: 1, fiber: 5 },
    difficulty: 'Easy',
    prepTime: 9,
    rating: 4.5,
    reviews: 156,
    trending: false,
    featured: false,
    detoxType: 'Deep Cleanse',
    detoxLevel: 'Moderate',
    category: 'Red',
    bestTime: 'Afternoon',
    duration: '5-7 days',
    estimatedCost: 5.20,
    ingredients: ['2 beets', '3 carrots', '1 apple', '1 cup strawberries', '1 lemon'],
    benefits: ['Blood purification', 'Antioxidant rich', 'Skin health', 'Circulation boost'],
    specialInstructions: 'Stain alert: beet juice can temporarily color urine'
  },
  {
    id: 'kidney-cleanser',
    name: 'Kidney Cleanser Elixir',
    description: 'Gentle diuretic blend to support kidney function and flush toxins',
    nutrition: { calories: 65, protein: 1, carbs: 15, fat: 0, fiber: 3 },
    difficulty: 'Easy',
    prepTime: 6,
    rating: 4.4,
    reviews: 134,
    trending: true,
    featured: false,
    detoxType: 'Deep Cleanse',
    detoxLevel: 'Gentle',
    category: 'Green',
    bestTime: 'Morning and afternoon',
    duration: '3-7 days',
    estimatedCost: 3.20,
    ingredients: ['1 cucumber', '2 celery stalks', '1 pear', '1 lemon', '1 cup watermelon', 'sprig of parsley'],
    benefits: ['Kidney support', 'Natural diuretic', 'Hydration', 'Electrolyte balance'],
    specialInstructions: 'Drink 2-3 times daily during cleanse period'
  },
  {
    id: 'skin-glow-elixir',
    name: 'Skin Glow Elixir',
    description: 'Beauty-focused juice for radiant skin and collagen support',
    nutrition: { calories: 120, protein: 3, carbs: 28, fat: 1, fiber: 6 },
    difficulty: 'Medium',
    prepTime: 10,
    rating: 4.8,
    reviews: 278,
    trending: true,
    featured: true,
    detoxType: 'Beauty Detox',
    detoxLevel: 'Moderate',
    category: 'Red',
    bestTime: 'Morning',
    duration: 'Ongoing',
    estimatedCost: 6.50,
    ingredients: ['2 carrots', '1 cup papaya', '1 orange', '1 tbsp chia seeds', '1 inch turmeric', '1 cup spinach'],
    benefits: ['Collagen production', 'Skin hydration', 'Anti-aging', 'Vitamin A & C boost'],
    specialInstructions: 'Add chia seeds after juicing for fiber benefits'
  },
  {
    id: 'adrenal-revive',
    name: 'Adrenal Revive Tonic',
    description: 'Adaptogenic juice to support adrenal function and stress resilience',
    nutrition: { calories: 88, protein: 2, carbs: 20, fat: 1, fiber: 4 },
    difficulty: 'Medium',
    prepTime: 8,
    rating: 4.6,
    reviews: 189,
    trending: false,
    featured: false,
    detoxType: 'Stress Support',
    detoxLevel: 'Gentle',
    category: 'Root',
    bestTime: 'Morning or during stress',
    duration: '2-4 weeks',
    estimatedCost: 5.80,
    ingredients: ['1 sweet potato', '2 carrots', '1 orange', '1 tsp maca powder', '1 inch ashwagandha root'],
    benefits: ['Adrenal support', 'Stress adaptation', 'Energy balance', 'Hormone regulation'],
    specialInstructions: 'Best consumed before stressful events or in the morning'
  },
  {
    id: 'heavy-metal-cleanse',
    name: 'Heavy Metal Cleanse',
    description: 'Chelating juice to help remove environmental toxins and heavy metals',
    nutrition: { calories: 95, protein: 2, carbs: 21, fat: 1, fiber: 5 },
    difficulty: 'Hard',
    prepTime: 12,
    rating: 4.3,
    reviews: 97,
    trending: false,
    featured: false,
    detoxType: 'Deep Cleanse',
    detoxLevel: 'Intense',
    category: 'Green',
    bestTime: 'Under supervision',
    duration: 'Medical supervision required',
    estimatedCost: 7.20,
    ingredients: ['2 cups cilantro', '1 cup parsley', '2 celery stalks', '1 lemon', '1 green apple', '1 tsp chlorella'],
    benefits: ['Heavy metal chelation', 'Antioxidant protection', 'Liver support', 'Cellular detox'],
    specialInstructions: 'CONSULT HEALTHCARE PROVIDER - Intensive detox protocol'
  },
  {
    id: 'morning-glory',
    name: 'Morning Glory Energizer',
    description: 'Morning juice to kickstart metabolism and provide natural energy',
    nutrition: { calories: 92, protein: 2, carbs: 20, fat: 1, fiber: 4 },
    difficulty: 'Easy',
    prepTime: 7,
    rating: 4.7,
    reviews: 312,
    trending: true,
    featured: false,
    detoxType: 'Metabolic',
    detoxLevel: 'Gentle',
    category: 'Green',
    bestTime: 'Morning',
    duration: 'Daily',
    estimatedCost: 4.10,
    ingredients: ['2 cups spinach', '1 green apple', '1/2 lemon', '1 inch ginger', '1 tbsp wheatgrass powder'],
    benefits: ['Metabolism boost', 'Natural energy', 'Alkalizing', 'Mental clarity'],
    specialInstructions: 'Best consumed on empty stomach for maximum absorption'
  },
  {
    id: 'sunset-serenity',
    name: 'Sunset Serenity Juice',
    description: 'Evening juice to promote relaxation and overnight detoxification',
    nutrition: { calories: 78, protein: 1, carbs: 18, fat: 1, fiber: 3 },
    difficulty: 'Easy',
    prepTime: 6,
    rating: 4.5,
    reviews: 201,
    trending: false,
    featured: false,
    detoxType: 'Relaxation',
    detoxLevel: 'Gentle',
    category: 'Red',
    bestTime: 'Evening',
    duration: 'Daily',
    estimatedCost: 3.90,
    ingredients: ['1 beet', '2 carrots', '1/2 cup cherries', '1 tsp lavender', '1 cup coconut water'],
    benefits: ['Relaxation support', 'Sleep quality', 'Overnight detox', 'Blood sugar balance'],
    specialInstructions: 'Consume 1-2 hours before bedtime for best results'
  },
  {
    id: 'gut-hero',
    name: 'Gut Hero Restorer',
    description: 'Specialized juice for gut microbiome and digestive system healing',
    nutrition: { calories: 85, protein: 2, carbs: 19, fat: 1, fiber: 5 },
    difficulty: 'Medium',
    prepTime: 9,
    rating: 4.6,
    reviews: 178,
    trending: true,
    featured: true,
    detoxType: 'Digestive',
    detoxLevel: 'Moderate',
    category: 'Root',
    bestTime: 'Between meals',
    duration: '2-4 weeks',
    estimatedCost: 5.50,
    ingredients: ['1 cabbage', '2 carrots', '1 pear', '1 inch ginger', '1 tsp slippery elm', '1 cup kefir'],
    benefits: ['Gut microbiome', 'Leaky gut support', 'Inflammation reduction', 'Digestive healing'],
    specialInstructions: 'Add kefir after juicing for probiotic benefits'
  }
];

export default function DetoxJuicesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedDetoxType, setSelectedDetoxType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [detoxIntensity, setDetoxIntensity] = useState(['Any']);
  const [maxCalories, setMaxCalories] = useState(200);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert detox recipes to RecipeKit format
  const detoxRecipesWithMeasurements = useMemo(() => {
    return detoxJuices.map(juice => ({
      ...juice,
      recipe: {
        servings: 1,
        measurements: juice.ingredients.map((ing, index) => {
          // Parse ingredients into measured format
          const parts = ing.split(' ');
          if (parts.length >= 2 && !isNaN(parseFloat(parts[0]))) {
            const amount = parts[0];
            const unit = parts[1];
            const item = parts.slice(2).join(' ');
            return m(amount, unit, item);
          }
          return m('1', 'item', ing);
        }),
        directions: [
          'Wash all ingredients thoroughly',
          'Peel and prepare ingredients as needed',
          'Juice according to your juicer instructions',
          'Stir well and serve immediately',
          ...(juice.specialInstructions ? [juice.specialInstructions] : [])
        ]
      }
    }));
  }, []);

  const handleShareJuice = async (juice: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[juice.id] ?? (juice.recipe?.servings || 1);
    const preview = juice.ingredients.slice(0, 4).join(' • ');
    const text = `${juice.name} • ${juice.detoxType} • ${juice.detoxLevel}\n${preview}${juice.ingredients.length > 4 ? ` …plus ${juice.ingredients.length - 4} more` : ''}`;
    const shareData = { title: juice.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${juice.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${juice.name}\n${text}\n${url}`);
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
        category: 'detoxes' as const,
        description: `${selectedRecipe.detoxType || ''} • ${selectedRecipe.detoxLevel || ''}`,
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
      addPoints(25);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredJuices = () => {
    let filtered = detoxRecipesWithMeasurements.filter(juice => {
      const matchesSearch = juice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           juice.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedDetoxType || juice.detoxType?.toLowerCase().includes(selectedDetoxType.toLowerCase());
      const matchesCategory = !selectedCategory || juice.category?.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesIntensity = detoxIntensity[0] === 'Any' || juice.detoxLevel === detoxIntensity[0];
      const matchesCalories = juice.nutrition.calories <= maxCalories;
      
      return matchesSearch && matchesType && matchesCategory && matchesIntensity && matchesCalories;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        case 'intensity':
          const intensityOrder = { 'Intense': 3, 'Moderate': 2, 'Gentle': 1 };
          return (intensityOrder[b.detoxLevel || ''] || 0) - (intensityOrder[a.detoxLevel || ''] || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredJuices = getFilteredJuices();
  const featuredJuices = detoxRecipesWithMeasurements.filter(juice => juice.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
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
              <Link href="/drinks/detoxes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Detoxes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Droplets className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Detox Juices</h1>
                <Badge className="bg-green-100 text-green-800">Cleansing</Badge>
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
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                      <Icon className="h-4 w-4 mr-2 text-green-600" />
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

        {/* SISTER SUBPAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Detox Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link href="/drinks/detoxes/tea">
                <Button variant="outline" className="w-full justify-start hover:bg-amber-50 hover:border-amber-300">
                  <Coffee className="h-4 w-4 mr-2 text-amber-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Detox Teas</div>
                    <div className="text-xs text-gray-500">Herbal infusions</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/detoxes/water">
                <Button variant="outline" className="w-full justify-start hover:bg-cyan-50 hover:border-cyan-300">
                  <Waves className="h-4 w-4 mr-2 text-cyan-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Infused Waters</div>
                    <div className="text-xs text-gray-500">Fruit & herb hydration</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">105</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">4.2g</div>
              <div className="text-sm text-gray-600">Avg Fiber</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">100%</div>
              <div className="text-sm text-gray-600">Natural</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{detoxJuices.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'detox-types', label: 'Detox Types', icon: Target },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 ${activeTab === tab.id ? 'bg-white shadow-sm !text-gray-900 hover:!text-gray-900' : ''}`}
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
                      placeholder="Search detox juices..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={selectedDetoxType}
                      onChange={(e) => setSelectedDetoxType(e.target.value)}
                    >
                      <option value="">All Detox Types</option>
                      <option value="Deep Cleanse">Deep Cleanse</option>
                      <option value="Liver Support">Liver Support</option>
                      <option value="Digestive">Digestive</option>
                      <option value="Immune Support">Immune Support</option>
                      <option value="Beauty Detox">Beauty Detox</option>
                      <option value="Stress Support">Stress Support</option>
                      <option value="Metabolic">Metabolic</option>
                      <option value="Relaxation">Relaxation</option>
                    </select>
                    
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="">All Categories</option>
                      <option value="Green">Green Juices</option>
                      <option value="Root">Root Juices</option>
                      <option value="Citrus">Citrus Juices</option>
                      <option value="Red">Red Juices</option>
                    </select>
                    
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={detoxIntensity[0]}
                      onChange={(e) => setDetoxIntensity([e.target.value])}
                    >
                      <option value="Any">Any Intensity</option>
                      <option value="Intense">Intense</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Gentle">Gentle</option>
                    </select>
                    
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={maxCalories}
                      onChange={(e) => setMaxCalories(Number(e.target.value))}
                    >
                      <option value={200}>All Calories</option>
                      <option value={50}>Under 50 cal</option>
                      <option value={75}>Under 75 cal</option>
                      <option value={100}>Under 100 cal</option>
                      <option value={125}>Under 125 cal</option>
                      <option value={150}>Under 150 cal</option>
                    </select>
                    
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="calories">Sort by Calories</option>
                      <option value="intensity">Sort by Intensity</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recipe Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJuices.map(juice => {
                const useMetric = !!metricFlags[juice.id];
                const servings = servingsById[juice.id] ?? (juice.recipe?.servings || 1);

                return (
                  <Card key={juice.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="md:max-w-3xl md:flex-1">
                          <CardTitle className="text-lg mb-1">{juice.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{juice.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addToFavorites({
                            id: juice.id,
                            name: juice.name,
                            category: 'detoxes',
                            description: juice.description,
                            ingredients: juice.ingredients,
                            nutrition: juice.nutrition,
                            difficulty: juice.difficulty,
                            prepTime: juice.prepTime,
                            rating: juice.rating,
                            bestTime: juice.bestTime
                          })}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(juice.id) ? 'fill-red-500 text-red-500' : ''}`} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-100 text-green-800">{juice.detoxType}</Badge>
                        <Badge variant="outline">{juice.detoxLevel}</Badge>
                        {juice.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>

                      {/* Rating and Difficulty immediately above recipe card */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{juice.rating}</span>
                          <span className="text-gray-500 text-sm">({juice.reviews})</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {juice.difficulty}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-green-600">{juice.nutrition.calories}</div>
                          <div className="text-gray-500">Cal</div>
                        </div>
                        <div>
                          <div className="font-bold text-blue-600">{juice.nutrition.fiber}g</div>
                          <div className="text-gray-500">Fiber</div>
                        </div>
                        <div>
                          <div className="font-bold text-orange-600">{juice.prepTime}m</div>
                          <div className="text-gray-500">Prep</div>
                        </div>
                      </div>

                      {/* RecipeKit Preview */}
                      {juice.recipe?.measurements && (
                        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-900">
                              Recipe (serves {servings})
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [juice.id]: clamp((prev[juice.id] ?? (juice.recipe?.servings || 1)) - 1) }))
                                }
                                aria-label="decrease servings"
                              >
                                −
                              </button>
                              <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                              <button
                                className="px-2 py-1 border rounded text-sm"
                                onClick={() =>
                                  setServingsById(prev => ({ ...prev, [juice.id]: clamp((prev[juice.id] ?? (juice.recipe?.servings || 1)) + 1) }))
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
                                  next[juice.id] = juice.recipe?.servings || 1;
                                  return next;
                                })}
                                title="Reset servings"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                              </Button>
                            </div>
                          </div>

                          <ul className="text-sm leading-6 text-gray-800 space-y-1">
                            {juice.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                              const isNum = typeof ing.amount === 'number';
                              const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount;
                              const show = useMetric && isNum
                                ? toMetric(ing.unit, Number((typeof ing.amount === 'number' ? (ing.amount as number) : parseFloat(String(ing.amount))) * servings))
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
                            {juice.recipe.measurements.length > 4 && (
                              <li className="text-xs text-gray-600">
                                …plus {juice.recipe.measurements.length - 4} more •{" "}
                                <button
                                  type="button"
                                  onClick={() => openRecipeModal(juice)}
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
                                const lines = juice.ingredients.map((ing: string) => `- ${ing}`);
                                const txt = `${juice.name} (serves ${servings})\n${lines.join('\n')}`;
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
                            <Button variant="outline" size="sm" onClick={() => handleShareJuice(juice, servings)}>
                              <Share2 className="w-4 h-4 mr-1" /> Share
                            </Button>
                            {/* Metric Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setMetricFlags((prev) => ({ ...prev, [juice.id]: !prev[juice.id] }))
                              }
                            >
                              {useMetric ? 'US' : 'Metric'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Duration and Time above tags */}
                      <div className="space-y-2 mb-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Best Time:</span>
                          <span className="font-medium">{juice.bestTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium">{juice.duration}</span>
                        </div>
                      </div>

                      {/* Benefits Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {juice.benefits.slice(0, 3).map((benefit, index) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-800 hover:bg-green-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Juice Button */}
                      <div className="mt-3">
                        <Button 
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => openRecipeModal(juice)}
                        >
                          <Droplets className="h-4 w-4 mr-2" />
                          Make Juice (+25 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'detox-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {detoxTypes.map(type => {
              const Icon = type.icon;
              const typeJuices = detoxJuices.filter(juice => 
                juice.detoxLevel === type.intensity ||
                juice.detoxType?.toLowerCase().includes(type.name.toLowerCase())
              );
              
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${type.color}`} />
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-center bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Intensity</div>
                        <div className="text-lg font-bold text-green-600">{type.intensity}</div>
                      </div>
                      
                      <div className="text-center bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Duration</div>
                        <div className="text-sm text-blue-800">{type.duration}</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Benefits:</h4>
                        <div className="flex flex-wrap gap-1">
                          {type.benefits.map((benefit, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color} mb-1`}>
                        {typeJuices.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setDetoxIntensity([type.intensity]);
                          setActiveTab('browse');
                        }}
                      >
                        Explore {type.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredJuices.map(juice => (
              <Card key={juice.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative bg-gradient-to-br from-green-100 to-emerald-100 h-48 flex items-center justify-center">
                  <Droplets className="h-24 w-24 text-green-600 opacity-20" />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-green-500 text-white">Featured Cleanse</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-green-800">{juice.nutrition.calories} Cal</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{juice.name}</CardTitle>
                  <p className="text-gray-600">{juice.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-green-100 text-green-800">{juice.detoxType}</Badge>
                    <Badge variant="outline">{juice.detoxLevel}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{juice.rating}</span>
                      <span className="text-gray-500 text-sm">({juice.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-green-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{juice.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{juice.nutrition.fiber}g</div>
                      <div className="text-xs text-gray-600">Fiber</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{juice.prepTime}m</div>
                      <div className="text-xs text-gray-600">Prep Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-600">${juice.estimatedCost}</div>
                      <div className="text-xs text-gray-600">Cost</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Detox Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {juice.benefits.map((benefit, index) => (
                        <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-green-600 font-semibold">{juice.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Duration:</div>
                        <div className="text-blue-600 font-semibold">{juice.duration}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {juice.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Leaf className="h-3 w-3 text-green-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => openRecipeModal(juice)}
                    >
                      <Droplets className="h-4 w-4 mr-2" />
                      Start Cleanse
                    </Button>
                    <Button variant="outline">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-green-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-emerald-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
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
