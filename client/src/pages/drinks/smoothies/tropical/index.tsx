import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Palmtree, Sun, Heart, Star, Search, Share2, ArrowLeft,
  Camera, Zap, Waves, Droplets, X, Check, Apple, Leaf, Sparkles
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

// Tropical smoothies data
const tropicalSmoothies = [
  {
    id: 'tropical-1',import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Palmtree, Sun, Heart, Star, Search, Share2, ArrowLeft,
  Camera, Zap, Waves, Droplets, X, Check, Apple, Leaf, Sparkles,
  Clipboard, RotateCcw, Crown, Activity, Wine, Flame
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

// Enhanced tropical smoothies data with proper measurements
const tropicalSmoothies = [
  {
    id: 'tropical-1',
    name: 'Island Paradise',
    description: 'Mango, pineapple, and coconut blend',
    ingredients: [
      '1 cup mango chunks',
      '1/2 cup pineapple',
      '1/4 cup coconut milk',
      '1/2 banana',
      '1 cup ice'
    ],
    benefits: ['Vitamin C boost', 'Immune support', 'Tropical energy', 'Hydrating'],
    nutrition: { calories: 280, protein: 4, carbs: 58, fiber: 5, sugar: 45, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 342,
    flavor: 'Sweet & Tropical',
    featured: true,
    trending: true,
    bestTime: 'Morning/Afternoon',
    image: 'https://images.unsplash.com/photo-1546548970-71785318a17b?w=400&h=300&fit=crop',
    estimatedCost: 3.50
  },
  {
    id: 'tropical-2',
    name: 'Piña Colada Dream',
    description: 'Classic tropical vacation in a glass',
    ingredients: [
      '1 cup pineapple chunks',
      '1/2 cup coconut cream',
      '1/4 cup Greek yogurt',
      '1 tbsp honey',
      '1 cup ice'
    ],
    benefits: ['Digestive enzymes', 'Creamy satisfaction', 'Energy boost', 'Tropical flavor'],
    nutrition: { calories: 320, protein: 8, carbs: 52, fiber: 4, sugar: 42, added_sugar: 12 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 445,
    flavor: 'Creamy Coconut',
    featured: true,
    bestTime: 'Afternoon',
    image: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&h=300&fit=crop',
    estimatedCost: 3.80
  },
  {
    id: 'tropical-3',
    name: 'Mango Madness',
    description: 'Pure mango bliss with tropical twist',
    ingredients: [
      '1.5 cups mango',
      '1/2 cup orange juice',
      '1/4 cup passion fruit',
      '1 tbsp lime juice',
      '1 cup ice'
    ],
    benefits: ['Antioxidant rich', 'Vitamin A', 'Eye health', 'Skin glow'],
    nutrition: { calories: 240, protein: 3, carbs: 56, fiber: 6, sugar: 48, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 298,
    flavor: 'Sweet Mango',
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=300&fit=crop',
    estimatedCost: 3.20
  },
  {
    id: 'tropical-4',
    name: 'Passionfruit Paradise',
    description: 'Exotic passionfruit with pineapple',
    ingredients: [
      '3 passionfruit',
      '1 cup pineapple',
      '1/2 banana',
      '1/2 cup coconut water',
      '1 cup ice'
    ],
    benefits: ['Exotic flavor', 'Vitamin C', 'Hydration', 'Digestive support'],
    nutrition: { calories: 260, protein: 4, carbs: 60, fiber: 8, sugar: 44, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.6,
    reviews: 187,
    flavor: 'Tangy Tropical',
    trending: true,
    bestTime: 'Afternoon',
    estimatedCost: 4.00
  },
  {
    id: 'tropical-5',
    name: 'Hawaiian Sunrise',
    description: 'Papaya, guava, and citrus sunshine',
    ingredients: [
      '1 cup papaya',
      '1/2 cup guava juice',
      '1/2 orange',
      '1 tbsp honey',
      '1 cup ice'
    ],
    benefits: ['Digestive enzymes', 'Immune boost', 'Morning energy', 'Tropical vibes'],
    nutrition: { calories: 220, protein: 3, carbs: 52, fiber: 5, sugar: 40, added_sugar: 12 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 156,
    flavor: 'Citrus Tropical',
    bestTime: 'Morning',
    estimatedCost: 3.60
  },
  {
    id: 'tropical-6',
    name: 'Coconut Beach Bliss',
    description: 'Creamy coconut with tropical fruits',
    ingredients: [
      '1/2 cup coconut milk',
      '1 cup mixed tropical fruit',
      '1/2 banana',
      '1 tbsp coconut flakes',
      '1 cup ice'
    ],
    benefits: ['Healthy fats', 'Sustained energy', 'Creamy texture', 'Tropical escape'],
    nutrition: { calories: 340, protein: 5, carbs: 48, fiber: 6, sugar: 38, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 234,
    flavor: 'Creamy Coconut',
    featured: true,
    bestTime: 'Afternoon',
    estimatedCost: 3.90
  },
  {
    id: 'tropical-7',
    name: 'Dragon Fruit Delight',
    description: 'Vibrant pink dragon fruit blend',
    ingredients: [
      '1 dragon fruit',
      '1/2 cup pineapple',
      '1/2 banana',
      '1/2 cup coconut water',
      '1 cup ice'
    ],
    benefits: ['Antioxidants', 'Instagram-worthy', 'Vitamin C', 'Exotic taste'],
    nutrition: { calories: 200, protein: 3, carbs: 48, fiber: 7, sugar: 35, added_sugar: 0 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.9,
    reviews: 389,
    flavor: 'Mild Sweet',
    trending: true,
    bestTime: 'Morning/Afternoon',
    estimatedCost: 4.50
  },
  {
    id: 'tropical-8',
    name: 'Tropical Green Fusion',
    description: 'Spinach meets tropical paradise',
    ingredients: [
      '1 cup spinach',
      '1 cup mango',
      '1/2 pineapple',
      '1/2 cup coconut water',
      '1 cup ice'
    ],
    benefits: ['Green nutrition', 'Tropical taste', 'Vitamin boost', 'Hidden veggies'],
    nutrition: { calories: 210, protein: 4, carbs: 50, fiber: 6, sugar: 38, added_sugar: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 267,
    flavor: 'Tropical Green',
    bestTime: 'Morning',
    estimatedCost: 3.30
  }
];

const tropicalFlavors = [
  { id: 'sweet', name: 'Sweet & Tropical', description: 'Naturally sweet tropical fruits' },
  { id: 'creamy', name: 'Creamy Coconut', description: 'Rich coconut-based blends' },
  { id: 'tangy', name: 'Tangy Tropical', description: 'Tart and refreshing flavors' },
  { id: 'citrus', name: 'Citrus Tropical', description: 'Citrus-infused tropical mixes' },
  { id: 'green', name: 'Tropical Green', description: 'Greens with tropical fruits' }
];

const tropicalBenefitsList = [
  { id: 'vitamin-c', name: 'Vitamin C Boost', description: 'Immune system support' },
  { id: 'hydration', name: 'Hydration', description: 'Natural electrolyte balance' },
  { id: 'energy', name: 'Natural Energy', description: 'Sustained tropical energy' },
  { id: 'digestive', name: 'Digestive Support', description: 'Enzyme-rich fruits' },
  { id: 'antioxidants', name: 'Antioxidants', description: 'Tropical superfood power' },
  { id: 'skin-health', name: 'Skin Health', description: 'Glowing complexion' }
];

// ---------- Cross-nav - Top Level Drink Categories ----------
const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'smoothies', name: 'All Smoothies', icon: Sparkles, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Flame, route: '/drinks', description: 'Browse everything' }
];

// Sister smoothie subcategories (excluding tropical since we're on tropical page)
const allSmoothieSubcategories = [
  { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Zap, description: 'High-protein blends' },
  { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Crown, description: 'Morning fuel' },
  { id: 'workout', name: 'Workout', path: '/drinks/smoothies/workout', icon: Activity, description: 'Pre & post workout' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Superfood greens' },
  { id: 'berry', name: 'Berry', path: '/drinks/smoothies/berry', icon: Heart, description: 'Antioxidant rich' },
  { id: 'detox', name: 'Detox', path: '/drinks/smoothies/detox', icon: Droplets, description: 'Cleansing blends' },
  { id: 'dessert', name: 'Dessert', path: '/drinks/smoothies/dessert', icon: Sparkles, description: 'Healthy treats' }
];

const tropicalAdvantages = [
  { icon: Sun, title: 'Vitamin C Power', description: 'Rich in immune-boosting vitamins', color: 'text-orange-600' },
  { icon: Palmtree, title: 'Natural Energy', description: 'Sustained energy from tropical fruits', color: 'text-yellow-600' },
  { icon: Heart, title: 'Heart Health', description: 'Supports cardiovascular function', color: 'text-red-600' },
  { icon: Sparkles, title: 'Hydration', description: 'Natural electrolytes and hydration', color: 'text-blue-600' },
  { icon: Leaf, title: 'Digestive Enzymes', description: 'Improves digestion naturally', color: 'text-green-600' },
  { icon: Zap, title: 'Mood Boost', description: 'Tropical flavors elevate mood', color: 'text-pink-600' }
];

export default function TropicalSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlavor, setSelectedFlavor] = useState('');
  const [selectedBenefit, setSelectedBenefit] = useState('');
  const [maxCalories, setMaxCalories] = useState<number | 'all'>('all');
  const [onlyNaturalSweetener, setOnlyNaturalSweetener] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'fiber' | 'cost' | 'calories'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'flavors'|'benefits'|'featured'|'trending'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert tropical smoothies to RecipeKit format with robust parsing
  const smoothieRecipesWithMeasurements = useMemo(() => {
    return tropicalSmoothies.map((s) => {
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
            'Add tropical fruits and liquid to blender first',
            'Blend until fruits are completely broken down',
            'Add remaining ingredients and blend until smooth and creamy',
            'Pour into glass and enjoy your tropical paradise!'
          ]
        }
      };
    });
  }, []);

  const handleShareSmoothie = async (smoothie: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[smoothie.id] ?? (smoothie.recipe?.servings || 1);
    const preview = smoothie.ingredients.slice(0, 4).join(' • ');
    const text = `${smoothie.name} • ${smoothie.flavor} • ${smoothie.bestTime}\n${preview}${smoothie.ingredients.length > 4 ? ` …plus ${smoothie.ingredients.length - 4} more` : ''}`;
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
        description: `${selectedRecipe.flavor || ''} • ${selectedRecipe.bestTime || ''}`,
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
      addPoints(25); // XP for tropical smoothies
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const getFilteredSmoothies = () => {
    let filtered = smoothieRecipesWithMeasurements.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFlavor = !selectedFlavor || smoothie.flavor === selectedFlavor;
      const matchesBenefit = !selectedBenefit || smoothie.benefits.some((b: string) => b.toLowerCase().includes(selectedBenefit.toLowerCase()));
      const matchesCalories = maxCalories === 'all' || smoothie.nutrition.calories <= maxCalories;
      const matchesSweetener = !onlyNaturalSweetener || smoothie.nutrition.added_sugar === 0;
      return matchesSearch && matchesFlavor && matchesBenefit && matchesCalories && matchesSweetener;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'fiber': return (b.nutrition.fiber || 0) - (a.nutrition.fiber || 0);
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
      title: 'Tropical Smoothies',
      text: `Browse ${tropicalSmoothies.length} tropical smoothies for island vibes and delicious flavor.`,
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50">
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
          accent="orange"
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
              <Link href="/drinks/smoothies">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Smoothies
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Palmtree className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">Tropical Smoothies</h1>
                <Badge className="bg-orange-100 text-orange-800">Island Vibes</Badge>
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
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={handleSharePage}>
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
                    <Button variant="outline" className="w-full justify-start hover:bg-orange-50 hover:border-orange-300">
                      <Icon className="h-4 w-4 mr-2 text-orange-600" />
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

        {/* SISTER SUBPAGES NAVIGATION - ALL SMOOTHIE TYPES (No Tropical) */}
        <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {allSmoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-orange-50 hover:border-orange-300">
                      <Icon className="h-4 w-4 mr-2 text-orange-600" />
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

        {/* Tropical Advantages */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Palmtree className="h-6 w-6 text-orange-500" />
              Why Tropical Smoothies?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tropicalAdvantages.map((advantage, index) => {
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
              <div className="text-2xl font-bold text-orange-600">250</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-pink-600">4 min</div>
              <div className="text-sm text-gray-600">Avg Prep</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{tropicalSmoothies.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'flavors', label: 'Tropical Flavors', icon: Palmtree },
            { id: 'benefits', label: 'Health Benefits', icon: Heart },
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search tropical smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={selectedFlavor}
                      onChange={(e) => setSelectedFlavor(e.target.value)}
                    >
                      <option value="">All Flavors</option>
                      {tropicalFlavors.map(flavor => (
                        <option key={flavor.id} value={flavor.name}>{flavor.name}</option>
                      ))}
                    </select>

                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={selectedBenefit}
                      onChange={(e) => setSelectedBenefit(e.target.value)}
                    >
                      <option value="">All Benefits</option>
                      {tropicalBenefitsList.map(benefit => (
                        <option key={benefit.id} value={benefit.name}>{benefit.name}</option>
                      ))}
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
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
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="fiber">Sort by Fiber</option>
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
                        <div className="flex-1">
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
                            fitnessGoal: 'Tropical Energy',
                            bestTime: smoothie.bestTime
                          })}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className="bg-orange-100 text-orange-800">{smoothie.flavor}</Badge>
                        {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-orange-600">{smoothie.nutrition.calories}</div>
                          <div className="text-gray-500">Calories</div>
                        </div>
                        <div>
                          <div className="font-bold text-yellow-600">{smoothie.nutrition.fiber}g</div>
                          <div className="text-gray-500">Fiber</div>
                        </div>
                        <div>
                          <div className="font-bold text-pink-600">{smoothie.prepTime}m</div>
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
                                  <Check className="h-4 w-4 text-orange-600 mt-0.5" />
                                  <span>
                                    <span className="text-orange-700 font-semibold">
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
                          <span className="font-medium text-orange-600">{smoothie.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {smoothie.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-orange-100 text-orange-800 hover:bg-orange-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Smoothie Button */}
                      <div className="mt-3">
                        <Button 
                          className="w-full bg-orange-600 hover:bg-orange-700"
                          onClick={() => openRecipeModal(smoothie)}
                        >
                          <Apple className="h-4 w-4 mr-2" />
                          Make Smoothie (+25 XP)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Tropical Flavors Tab */}
        {activeTab === 'flavors' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tropicalFlavors.map(flavor => (
              <Card key={flavor.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Palmtree className="h-6 w-6 text-orange-600" />
                    </div>
                    <CardTitle className="text-lg">{flavor.name}</CardTitle>
                    <p className="text-sm text-gray-600">{flavor.description}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-orange-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Tropical Vibe</div>
                    <div className="text-lg font-bold text-orange-600">Island Paradise</div>
                  </div>
                  <Button className="w-full" onClick={() => setActiveTab('browse')}>
                    Explore {flavor.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Benefits Tab */}
        {activeTab === 'benefits' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tropicalBenefitsList.map(benefit => (
              <Card key={benefit.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Heart className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{benefit.name}</CardTitle>
                      <p className="text-sm text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center bg-orange-50 p-3 rounded-lg mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Health Focus</div>
                    <div className="text-lg font-bold text-orange-600">Wellness</div>
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
                  <img 
                    src={smoothie.image} 
                    alt={smoothie.name}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-4 left-4 bg-orange-500 text-white">Featured</Badge>
                </div>
                
                <CardHeader>
                  <CardTitle>{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    onClick={() => openRecipeModal(smoothie)}
                  >
                    <Apple className="h-4 w-4 mr-2" />
                    Make This Tropical Smoothie
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
              <Card key={smoothie.id} className="hover:shadow-lg transition-shadow border-2 border-orange-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                      <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                    </div>
                    <Badge className="bg-red-500 text-white">🔥 Trending</Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    onClick={() => openRecipeModal(smoothie)}
                  >
                    <Apple className="h-4 w-4 mr-2" />
                    Try This Trend
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-orange-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-yellow-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-pink-600">
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
    name: 'Island Paradise',
    description: 'Mango, pineapple, and coconut blend',
    ingredients: ['1 cup mango chunks', '1/2 cup pineapple', '1/4 cup coconut milk', '1/2 banana', 'Ice'],
    benefits: ['Vitamin C boost', 'Immune support', 'Tropical energy', 'Hydrating'],
    nutrition: { calories: 280, protein: 4, carbs: 58, fiber: 5, sugar: 45 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 342,
    flavor: 'Sweet & Tropical',
    featured: true,
    trending: true,
    bestTime: 'Morning/Afternoon',
    image: 'https://images.unsplash.com/photo-1546548970-71785318a17b?w=400&h=300&fit=crop'
  },
  {
    id: 'tropical-2',
    name: 'Piña Colada Dream',
    description: 'Classic tropical vacation in a glass',
    ingredients: ['1 cup pineapple chunks', '1/2 cup coconut cream', '1/4 cup Greek yogurt', '1 tbsp honey', 'Ice'],
    benefits: ['Digestive enzymes', 'Creamy satisfaction', 'Energy boost', 'Tropical flavor'],
    nutrition: { calories: 320, protein: 8, carbs: 52, fiber: 4, sugar: 42 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 445,
    flavor: 'Creamy Coconut',
    featured: true,
    bestTime: 'Afternoon',
    image: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&h=300&fit=crop'
  },
  {
    id: 'tropical-3',
    name: 'Mango Madness',
    description: 'Pure mango bliss with tropical twist',
    ingredients: ['1.5 cups mango', '1/2 orange juice', '1/4 cup passion fruit', '1 tbsp lime juice', 'Ice'],
    benefits: ['Antioxidant rich', 'Vitamin A', 'Eye health', 'Skin glow'],
    nutrition: { calories: 240, protein: 3, carbs: 56, fiber: 6, sugar: 48 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 298,
    flavor: 'Sweet Mango',
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=300&fit=crop'
  },
  {
    id: 'tropical-4',
    name: 'Passionfruit Paradise',
    description: 'Exotic passionfruit with pineapple',
    ingredients: ['3 passionfruit', '1 cup pineapple', '1/2 banana', '1/2 cup coconut water', 'Ice'],
    benefits: ['Exotic flavor', 'Vitamin C', 'Hydration', 'Digestive support'],
    nutrition: { calories: 260, protein: 4, carbs: 60, fiber: 8, sugar: 44 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.6,
    reviews: 187,
    flavor: 'Tangy Tropical',
    trending: true,
    bestTime: 'Afternoon'
  },
  {
    id: 'tropical-5',
    name: 'Hawaiian Sunrise',
    description: 'Papaya, guava, and citrus sunshine',
    ingredients: ['1 cup papaya', '1/2 cup guava juice', '1/2 orange', '1 tbsp honey', 'Ice'],
    benefits: ['Digestive enzymes', 'Immune boost', 'Morning energy', 'Tropical vibes'],
    nutrition: { calories: 220, protein: 3, carbs: 52, fiber: 5, sugar: 40 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 156,
    flavor: 'Citrus Tropical',
    bestTime: 'Morning'
  },
  {
    id: 'tropical-6',
    name: 'Coconut Beach Bliss',
    description: 'Creamy coconut with tropical fruits',
    ingredients: ['1/2 cup coconut milk', '1 cup mixed tropical fruit', '1/2 banana', '1 tbsp coconut flakes', 'Ice'],
    benefits: ['Healthy fats', 'Sustained energy', 'Creamy texture', 'Tropical escape'],
    nutrition: { calories: 340, protein: 5, carbs: 48, fiber: 6, sugar: 38 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 234,
    flavor: 'Creamy Coconut',
    featured: true,
    bestTime: 'Afternoon'
  },
  {
    id: 'tropical-7',
    name: 'Dragon Fruit Delight',
    description: 'Vibrant pink dragon fruit blend',
    ingredients: ['1 dragon fruit', '1/2 cup pineapple', '1/2 banana', '1/2 cup coconut water', 'Ice'],
    benefits: ['Antioxidants', 'Instagram-worthy', 'Vitamin C', 'Exotic taste'],
    nutrition: { calories: 200, protein: 3, carbs: 48, fiber: 7, sugar: 35 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.9,
    reviews: 389,
    flavor: 'Mild Sweet',
    trending: true,
    bestTime: 'Morning/Afternoon'
  },
  {
    id: 'tropical-8',
    name: 'Tropical Green Fusion',
    description: 'Spinach meets tropical paradise',
    ingredients: ['1 cup spinach', '1 cup mango', '1/2 pineapple', '1/2 cup coconut water', 'Ice'],
    benefits: ['Green nutrition', 'Tropical taste', 'Vitamin boost', 'Hidden veggies'],
    nutrition: { calories: 210, protein: 4, carbs: 50, fiber: 6, sugar: 38 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 267,
    flavor: 'Tropical Green',
    bestTime: 'Morning'
  }
];

const smoothieSubcategories = [
  { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Apple, description: 'High protein blends' },
  { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Sun, description: 'Morning fuel' },
  { id: 'workout', name: 'Workout', path: '/drinks/smoothies/workout', icon: Zap, description: 'Performance boost' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Leafy greens' },
  { id: 'berry', name: 'Berry', path: '/drinks/smoothies/berry', icon: Heart, description: 'Antioxidant rich' },
  { id: 'detox', name: 'Detox', path: '/drinks/smoothies/detox', icon: Droplets, description: 'Cleansing blends' },
  { id: 'dessert', name: 'Dessert', path: '/drinks/smoothies/dessert', icon: Sparkles, description: 'Sweet treats' }
];

const otherDrinkHubs = [
  { id: 'juices', name: 'Fresh Juices', route: '/drinks/juices', icon: Droplets, description: 'Cold-pressed nutrition' },
  { id: 'teas', name: 'Specialty Teas', route: '/drinks/teas', icon: Sun, description: 'Hot & iced teas' },
  { id: 'coffee', name: 'Coffee Drinks', route: '/drinks/coffee', icon: Zap, description: 'Artisan coffee' },
  { id: 'protein-shakes', name: 'Protein Shakes', route: '/drinks/protein-shakes', icon: Apple, description: 'Muscle fuel' }
];

export default function TropicalSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlavor, setSelectedFlavor] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSmoothie, setSelectedSmoothie] = useState<any>(null);

  const getFilteredSmoothies = () => {
    let filtered = tropicalSmoothies.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFlavor = !selectedFlavor || smoothie.flavor.toLowerCase().includes(selectedFlavor.toLowerCase());
      
      return matchesSearch && matchesFlavor;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        case 'time': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = tropicalSmoothies.filter(s => s.featured);
  const trendingSmoothies = tropicalSmoothies.filter(s => s.trending);

  const handleMakeSmoothie = (smoothie: any) => {
    setSelectedSmoothie(smoothie);
    setShowModal(true);
  };

  const handleCompleteSmoothie = () => {
    if (selectedSmoothie) {
      addToRecentlyViewed({
        id: selectedSmoothie.id,
        name: selectedSmoothie.name,
        category: 'smoothies',
        description: selectedSmoothie.description,
        ingredients: selectedSmoothie.ingredients,
        nutrition: selectedSmoothie.nutrition,
        difficulty: selectedSmoothie.difficulty,
        prepTime: selectedSmoothie.prepTime,
        rating: selectedSmoothie.rating,
        fitnessGoal: 'Tropical Energy',
        bestTime: selectedSmoothie.bestTime
      });
      incrementDrinksMade();
      addPoints(25);
    }
    setShowModal(false);
    setSelectedSmoothie(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50">
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

      {/* Make Smoothie Modal */}
      {showModal && selectedSmoothie && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedSmoothie.name}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Ingredients:</h3>
                <ul className="space-y-2">
                  {selectedSmoothie.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-orange-600" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Tropical Benefits:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {selectedSmoothie.benefits.map((benefit, idx) => (
                    <li key={idx}>• {benefit}</li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-orange-50 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-orange-600">{selectedSmoothie.nutrition.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{selectedSmoothie.nutrition.fiber}g</div>
                  <div className="text-xs text-gray-600">Fiber</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">{selectedSmoothie.prepTime}min</div>
                  <div className="text-xs text-gray-600">Prep</div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                  onClick={handleCompleteSmoothie}
                >
                  Complete Smoothie (+25 XP)
                </Button>
              </div>
            </div>
          </div>
        </div>
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
                <Palmtree className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">Tropical Smoothies</h1>
                <Badge className="bg-orange-100 text-orange-800">Island Vibes</Badge>
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
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                <Camera className="h-4 w-4 mr-2" />
                Share Recipe
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
                    <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
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
        <Card className="bg-gradient-to-r from-orange-50 to-pink-50 border-orange-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {smoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-orange-50 hover:border-orange-300">
                      <Icon className="h-4 w-4 mr-2 text-orange-600" />
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">250</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">4 min</div>
              <div className="text-sm text-gray-600">Avg Prep</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{tropicalSmoothies.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'featured', label: 'Featured', icon: Star },
            { id: 'trending', label: 'Trending', icon: Zap }
          ].map(tab => {
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

        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search tropical smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={selectedFlavor}
                      onChange={(e) => setSelectedFlavor(e.target.value)}
                    >
                      <option value="">All Flavors</option>
                      <option value="Sweet">Sweet & Tropical</option>
                      <option value="Creamy">Creamy Coconut</option>
                      <option value="Tangy">Tangy Tropical</option>
                      <option value="Citrus">Citrus Tropical</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="calories">Sort by Calories</option>
                      <option value="time">Sort by Prep Time</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Smoothie Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSmoothies.map(smoothie => (
                <Card key={smoothie.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
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
                          fitnessGoal: 'Tropical Energy',
                          bestTime: smoothie.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-orange-100 text-orange-800">{smoothie.flavor}</Badge>
                      {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-orange-600">{smoothie.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
                        <div className="text-gray-500">Fiber</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{smoothie.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{smoothie.rating}</span>
                        <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {smoothie.difficulty}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                        onClick={() => handleMakeSmoothie(smoothie)}
                      >
                        <Palmtree className="h-4 w-4 mr-2" />
                        Make Smoothie
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img 
                    src={smoothie.image} 
                    alt={smoothie.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-orange-500 text-white">Featured Tropical</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-orange-100 text-orange-800">{smoothie.flavor}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{smoothie.rating}</span>
                      <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleMakeSmoothie(smoothie)}
                    >
                      <Palmtree className="h-4 w-4 mr-2" />
                      Make This Smoothie
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

        {activeTab === 'trending' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="hover:shadow-lg transition-shadow border-2 border-orange-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                      <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                    </div>
                    <Badge className="bg-red-500 text-white">🔥 Trending</Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    onClick={() => handleMakeSmoothie(smoothie)}
                  >
                    <Palmtree className="h-4 w-4 mr-2" />
                    Try This Trend
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress (in-content) */}
        <Card className="bg-gradient-to-r from-orange-50 to-pink-50 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-orange-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-yellow-600">
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
