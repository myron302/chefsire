// client/src/pages/drinks/smoothies/dessert/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  IceCream, Heart, Star, Search, Share2, ArrowLeft,
  Camera, Cookie, ChefHat, X, Check, Zap, Activity, Sun, Sparkles, Trophy, Crown, Leaf,
  Clipboard, RotateCcw
, Coffee} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import RecipeKit from '@/components/recipes/RecipeKit';
import { 
  dessertTypes,
  dessertCategories,
  smoothieSubcategories,
  otherDrinkHubs 
} from '../../data/smoothies';

// Hardcoded 12 dessert smoothie recipes to ensure they all show up
const dessertSmoothies = [
  {
    id: "1",
    name: "Chocolate Banana Smoothie",
    description: "A classic chocolate and banana blend that's creamy and satisfying.",
    ingredients: [
      "1 frozen banana",
      "2 tablespoons cocoa powder",
      "½ cup plain Greek yogurt",
      "1 cup unsweetened almond milk"
    ],
    nutrition: {
      calories: 250,
      protein: 15,
      added_sugar: 0
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.7,
    reviews: 120,
    bestTime: "Anytime",
    benefits: ["Energy boost", "Heart healthy"],
    trending: true,
    dessertType: "Chocolate",
    category: "Dessert",
    estimatedCost: 2.0,
    image: "https://images.unsplash.com/photo-1596392803986-3a548b6c07f5?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "2",
    name: "Chocolate Mint Smoothie",
    description: "Refreshing mint combined with rich chocolate for a cool treat.",
    ingredients: [
      "2 tablespoons cocoa powder",
      "1 frozen banana",
      "½ cup fresh mint leaves",
      "1 cup unsweetened almond milk"
    ],
    nutrition: {
      calories: 220,
      protein: 8,
      added_sugar: 0
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.6,
    reviews: 95,
    bestTime: "Morning",
    benefits: ["Digestive aid", "Refreshing"],
    trending: false,
    dessertType: "Mint Chocolate",
    category: "Dessert",
    estimatedCost: 1.8,
    image: "https://images.unsplash.com/photo-1595981335254-8a596b296416?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "3",
    name: "Chocolate Avocado Smoothie",
    description: "Creamy avocado adds richness to this chocolate delight.",
    ingredients: [
      "½ ripe avocado",
      "1 cup fresh spinach leaves",
      "2 tablespoons cocoa powder",
      "1 cup unsweetened almond milk"
    ],
    nutrition: {
      calories: 280,
      protein: 6,
      added_sugar: 0
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.5,
    reviews: 85,
    bestTime: "Afternoon",
    benefits: ["Healthy fats", "Nutrient dense"],
    trending: true,
    dessertType: "Chocolate Avocado",
    category: "Dessert",
    estimatedCost: 2.2,
    image: "https://images.unsplash.com/photo-1562440499-64c109a3adb5?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "4",
    name: "Chocolate Cherry Smoothie",
    description: "Tart cherries meet chocolate for a decadent flavor.",
    ingredients: [
      "1 cup frozen cherries",
      "2 tablespoons cocoa powder",
      "¼ cup almond butter",
      "1 cup unsweetened almond milk"
    ],
    nutrition: {
      calories: 320,
      protein: 12,
      added_sugar: 0
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.8,
    reviews: 110,
    bestTime: "Evening",
    benefits: ["Antioxidants", "Muscle recovery"],
    trending: false,
    dessertType: "Chocolate Cherry",
    category: "Dessert",
    estimatedCost: 2.5,
    image: "https://images.unsplash.com/photo-1599946347374-1c6be64c5ee4?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "5",
    name: "Chocolate Espresso Smoothie",
    description: "A caffeinated chocolate boost with espresso.",
    ingredients: [
      "1 shot of espresso",
      "2 tablespoons cocoa powder",
      "1 frozen banana",
      "1 cup unsweetened almond milk",
      "1 tablespoon agave nectar (optional)"
    ],
    nutrition: {
      calories: 240,
      protein: 5,
      added_sugar: 5
    },
    difficulty: "Medium",
    prepTime: 7,
    rating: 4.7,
    reviews: 100,
    bestTime: "Morning",
    benefits: ["Energy boost", "Focus"],
    trending: true,
    dessertType: "Chocolate Espresso",
    category: "Dessert",
    estimatedCost: 2.0,
    image: "https://images.unsplash.com/photo-1596392803986-3a548b6c07f5?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "6",
    name: "Chocolate Strawberry Smoothie",
    description: "Sweet strawberries enhance the chocolate flavor.",
    ingredients: [
      "1 banana",
      "4 large strawberries",
      "¼ cup plain Greek yogurt",
      "½ teaspoon vanilla extract",
      "2-3 teaspoons cocoa powder"
    ],
    nutrition: {
      calories: 210,
      protein: 10,
      added_sugar: 0
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.6,
    reviews: 90,
    bestTime: "Anytime",
    benefits: ["Vitamin C", "Antioxidants"],
    trending: false,
    dessertType: "Chocolate Strawberry",
    category: "Dessert",
    estimatedCost: 1.5,
    image: "https://images.unsplash.com/photo-1599946347374-1c6be64c5ee4?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "7",
    name: "Mexican Hot Chocolate Smoothie",
    description: "Spicy cinnamon and cayenne in a chocolate base.",
    ingredients: [
      "2 tablespoons cocoa powder",
      "1 frozen banana",
      "¼ teaspoon ground cinnamon",
      "⅛ teaspoon ground cayenne pepper",
      "¼ cup almond butter",
      "1 cup unsweetened almond milk",
      "1 tablespoon maple syrup (optional)"
    ],
    nutrition: {
      calories: 300,
      protein: 10,
      added_sugar: 5
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.5,
    reviews: 80,
    bestTime: "Evening",
    benefits: ["Metabolism boost", "Warming"],
    trending: true,
    dessertType: "Spicy Chocolate",
    category: "Dessert",
    estimatedCost: 2.3,
    image: "https://images.unsplash.com/photo-1562440499-64c109a3adb5?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "8",
    name: "Chocolate Protein Smoothie",
    description: "High-protein chocolate smoothie for post-workout.",
    ingredients: [
      "1 cup ice",
      "1 cup coconut milk",
      "2 tablespoons cocoa powder",
      "2 tablespoons chia seeds",
      "2 scoops chocolate flavored protein powder",
      "½ banana, frozen",
      "Handful of kale"
    ],
    nutrition: {
      calories: 350,
      protein: 30,
      added_sugar: 0
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.8,
    reviews: 150,
    bestTime: "Post-Workout",
    benefits: ["Muscle repair", "Satiating"],
    trending: false,
    dessertType: "Protein Chocolate",
    category: "Dessert",
    estimatedCost: 3.0,
    image: "https://images.unsplash.com/photo-1596392803986-3a548b6c07f5?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "9",
    name: "Chocolate Matcha Smoothie",
    description: "Earthy matcha paired with chocolate.",
    ingredients: [
      "1 tablespoon cocoa powder",
      "1 teaspoon matcha powder",
      "1 frozen banana",
      "¼ cup coconut milk",
      "½ cup unsweetened almond milk"
    ],
    nutrition: {
      calories: 230,
      protein: 7,
      added_sugar: 0
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.4,
    reviews: 70,
    bestTime: "Morning",
    benefits: ["Antioxidants", "Energy"],
    trending: true,
    dessertType: "Matcha Chocolate",
    category: "Dessert",
    estimatedCost: 2.1,
    image: "https://images.unsplash.com/photo-1599946347374-1c6be64c5ee4?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "10",
    name: "Raspberry Chocolate Smoothie",
    description: "Tart raspberries with rich chocolate.",
    ingredients: [
      "1 cup frozen raspberries (or berry mixture)",
      "1 cup almond milk",
      "handful spinach or other greens",
      "1 tablespoon almond butter",
      "1 tablespoon cocoa powder",
      "1 scoop protein powder",
      "Ice if desired"
    ],
    nutrition: {
      calories: 280,
      protein: 20,
      added_sugar: 0
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.7,
    reviews: 105,
    bestTime: "Anytime",
    benefits: ["Fiber rich", "Antioxidants"],
    trending: false,
    dessertType: "Berry Chocolate",
    category: "Dessert",
    estimatedCost: 2.4,
    image: "https://images.unsplash.com/photo-1562440499-64c109a3adb5?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "11",
    name: "Chocolate Orange Smoothie",
    description: "Citrusy orange complements chocolate.",
    ingredients: [
      "2 tablespoons cocoa powder",
      "1 frozen banana",
      "½ cup fresh orange juice",
      "1 cup unsweetened almond milk"
    ],
    nutrition: {
      calories: 260,
      protein: 6,
      added_sugar: 0
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.6,
    reviews: 90,
    bestTime: "Morning",
    benefits: ["Vitamin C", "Immune boost"],
    trending: true,
    dessertType: "Citrus Chocolate",
    category: "Dessert",
    estimatedCost: 1.9,
    image: "https://images.unsplash.com/photo-1596392803986-3a548b6c07f5?w=400&h=400&fit=crop&auto=format"
  },
  {
    id: "12",
    name: "Chocolate Peanut Butter Smoothie",
    description: "Nutty peanut butter with chocolate goodness.",
    ingredients: [
      "1 cup unsweetened almond milk",
      "1 scoop chocolate protein powder",
      "1 tablespoon cocoa powder",
      "2 tablespoons peanut butter",
      "½ cup plain Greek yogurt",
      "½ cup ice cubes"
    ],
    nutrition: {
      calories: 340,
      protein: 25,
      added_sugar: 0
    },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.9,
    reviews: 200,
    bestTime: "Post-Workout",
    benefits: ["Satiating", "Protein rich"],
    trending: false,
    dessertType: "Peanut Butter Chocolate",
    category: "Dessert",
    estimatedCost: 2.6,
    image: "https://images.unsplash.com/photo-1599946347374-1c6be64c5ee4?w=400&h=400&fit=crop&auto=format"
  }
];

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
  const descriptors = new Set(['low-fat', 'frozen', 'unsweetened', 'natural', 'vanilla', 'plain']);
  if (descriptors.has(unit)) {
    item = [unit, item].filter(Boolean).join(' ').trim();
    unit = 'item'; // generic unit
  }

  // Handle notes like "(for color)"
  if (item.includes('(for color)')) {
    item = item.replace('(for color)', '').trim();
    return m(amount, unit, item, 'for color');
  }
  
  return m(amount, unit, item);
};

export default function DessertSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDessertType, setSelectedDessertType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [maxCalories, setMaxCalories] = useState<number | 'all'>('all'); // FIXED: Now supports 'all'
  const [onlyNaturalSweetener, setOnlyNaturalSweetener] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'cost' | 'calories'>('rating');
  const [activeTab, setActiveTab] = useState<'browse'|'dessert-types'|'categories'|'featured'>('browse');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert dessert smoothies to RecipeKit format with ROBUST parsing
  const smoothieRecipesWithMeasurements = useMemo(() => {
    return dessertSmoothies.map((s) => {
      // FIXED: Handle various data shapes for ingredients
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
            'Pour into glass and serve immediately',
            'Enjoy your dessert smoothie!'
          ]
        }
      };
    });
  }, []);

  const handleShareSmoothie = async (smoothie: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[smoothie.id] ?? (smoothie.recipe?.servings || 1);
    const preview = smoothie.ingredients.slice(0, 4).join(' • ');
    const text = `${smoothie.name} • ${smoothie.dessertType} • ${smoothie.bestTime}\n${preview}${smoothie.ingredients.length > 4 ? ` …plus ${smoothie.ingredients.length - 4} more` : ''}`;
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
        description: `${selectedRecipe.dessertType || ''} • ${selectedRecipe.bestTime || ''}`,
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

  const getFilteredSmoothies = () => {
    let filtered = smoothieRecipesWithMeasurements.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedDessertType || smoothie.dessertType === selectedDessertType;
      const matchesCategory = !selectedCategory || (Array.isArray(smoothie.category)
        ? smoothie.category.includes(selectedCategory)
        : smoothie.category === selectedCategory);
      // FIXED: Proper calorie filtering with 'all' option
      const matchesCalories = maxCalories === 'all' || smoothie.nutrition.calories <= maxCalories;
      const matchesSweetener = !onlyNaturalSweetener || smoothie.nutrition.added_sugar === 0;
      return matchesSearch && matchesType && matchesCategory && matchesCalories && matchesSweetener;
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
  const featuredSmoothies = smoothieRecipesWithMeasurements.filter(s => s.trending);

  // Share page handler
  const handleSharePage = async () => {
    const shareData = {
      title: 'Dessert Smoothies',
      text: `Browse ${dessertSmoothies.length} dessert smoothies on ChefSire.`,
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

  // Sister smoothie categories with all 7
  const allSmoothieSubcategories = [
    { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Zap, description: 'High-protein blends' },
    { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Crown, description: 'Morning fuel' },
    { id: 'workout', name: 'Workout', path: '/drinks/smoothies/workout', icon: Activity, description: 'Pre & post workout' },
    { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Superfood greens' },
    { id: 'tropical', name: 'Tropical', path: '/drinks/smoothies/tropical', icon: Sun, description: 'Exotic fruits' },
    { id: 'berry', name: 'Berry', path: '/drinks/smoothies/berry', icon: Heart, description: 'Antioxidant rich' },
    { id: 'detox', name: 'Detox', path: '/drinks/smoothies/detox', icon: Trophy, description: 'Cleansing blends' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
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
          accent="pink"
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
                <IceCream className="h-6 w-6 text-pink-600" />
                <h1 className="text-2xl font-bold text-gray-900">Dessert Smoothies</h1>
                <Badge className="bg-pink-100 text-pink-800">Guilt-Free</Badge>
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
              <Button size="sm" className="bg-pink-600 hover:bg-pink-700" onClick={handleSharePage}>
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
            <h3 className="text-text font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-pink-50 hover:border-pink-300">
                      <Icon className="h-4 w-4 mr-2 text-pink-600" />
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

        {/* SISTER SUBPAGES NAVIGATION - ALL 7 SMOOTHIE TYPES */}
        <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {allSmoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-pink-50 hover:border-pink-300">
                      <Icon className="h-4 w-4 mr-2 text-pink-600" />
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
              <div className="text-2xl font-bold text-pink-600">320</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-pink-600">12g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-pink-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-pink-600">{dessertSmoothies.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'dessert-types', label: 'Dessert Types', icon: Cookie },
            { id: 'categories', label: 'Categories', icon: Cookie },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map(tab => {
            const Icon = tab.icon as any;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id as any)}
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
                      placeholder="Search dessert smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedDessertType}
                      onChange={(e) => setSelectedDessertType(e.target.value)}
                    >
                      <option value="">All Types</option>
                      {Array.from(new Set(dessertTypes.map(t => t.name))).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>

                    <select 
                      className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm bg-white whitespace-nowrap"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {dessertCategories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    
                    {/* FIXED: Calorie filter with 'all' option */}
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
                      <option value={400}>Under 400 cal</option>
                      <option value={450}>Under 450 cal</option>
                    </select>
                    
                    <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                      <input
                        type="checkbox"
                        checked={onlyNaturalSweetener}
                        onChange={(e) => setOnlyNaturalSweetener(e.target.checked)}
                      />
                      Natural
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
                            fitnessGoal: 'Dessert',
                            bestTime: smoothie.bestTime
                          })}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-pink-100 text-pink-800">{smoothie.dessertType}</Badge>
                        {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-pink-600">{smoothie.nutrition.calories}</div>
                          <div className="text-gray-500">Cal</div>
                        </div>
                        <div>
                          <div className="font-bold text-pink-600">{smoothie.nutrition.protein}g</div>
                          <div className="text-gray-500">Protein</div>
                        </div>
                        <div>
                          <div className="font-bold text-pink-600">{smoothie.prepTime}m</div>
                          <div className="text-gray-500">Prep</div>
                        </div>
                      </div>

                      {/* RATING & DIFFICULTY - IMMEDIATELY ABOVE RECIPE CARD */}
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

                      {/* FIXED: RecipeKit Preview with robust measurements check */}
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
                                  <Check className="h-4 w-4 text-pink-600 mt-0.5" />
                                  <span>
                                    <span className="text-pink-700 font-semibold">
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
                          <span className="font-medium text-pink-600">{smoothie.bestTime}</span>
                        </div>
                      </div>

                      {/* Benefits Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {smoothie.benefits?.slice(0, 3).map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-pink-100 text-pink-800 hover:bg-pink-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Make Smoothie Button */}
                      <div className="mt-3">
                        <Button 
                          className="w-full bg-pink-600 hover:bg-pink-700"
                          onClick={() => openRecipeModal(smoothie)}
                        >
                          <IceCream className="h-4 w-4 mr-2" />
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

        {/* Rest of the tabs remain the same structure */}
        {activeTab === 'dessert-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dessertTypes.map(type => {
              const Icon = type.icon as any;
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
                        <div className="text-sm font-medium text-gray-700 mb-1">Key Benefit</div>
                        <div className="text-lg font-bold text-pink-600">{type.keyBenefit}</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Healthy Ingredients:</h4>
                        <div className="flex flex-wrap gap-1">
                          {type.healthyIngredients.map((ingredient: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs bg-pink-100 text-pink-800">
                              {ingredient}
                            </Badge>
                          ))}
                        </div>
                      </div>
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

        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dessertCategories.map(category => {
              const Icon = category.icon as any;
              return (
                <Card key={category.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 ${category.color.replace('-500', '-100')} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${category.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <p className="text-sm text-gray-600">{category.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-center bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Calorie Range</div>
                        <div className="text-lg font-bold text-pink-600">{category.calorieRange}</div>
                      </div>
                    </div>
                    
                    <Button className="w-full" onClick={() => setActiveTab('browse')}>
                      View {category.name}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

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
                  <Badge className="absolute top-4 left-4 bg-pink-500 text-white">Featured</Badge>
                </div>
                
                <CardHeader>
                  <CardTitle>{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-pink-600 hover:bg-pink-700"
                    onClick={() => openRecipeModal(smoothie)}
                  >
                    <IceCream className="h-4 w-4 mr-2" />
                    Make This Dessert
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-pink-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-pink-600">
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
