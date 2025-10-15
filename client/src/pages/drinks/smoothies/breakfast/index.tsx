// client/src/pages/drinks/smoothies/breakfast/index.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Sun, Clock, Heart, Star, Target, Zap,
  Search, Share2, ArrowLeft, Camera, Apple, Droplets, Leaf,
  Coffee, X, Check, Clipboard, RotateCcw
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

// Breakfast smoothies data
const breakfastSmoothies = [
  {
    id: 'overnight-oats-smoothie',
    name: 'Overnight Oats Smoothie',
    description: 'Creamy oats and banana for sustained morning energy',
    ingredients: ['1/2 cup rolled oats', '1 banana', '1 cup milk', '1 tbsp chia seeds', '1 tsp honey', 'Ice'],
    benefits: ['Sustained energy', 'Fiber rich', 'Heart healthy', 'Digestive support'],
    nutrition: { calories: 320, protein: 12, carbs: 58, fiber: 8, sugar: 22 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 423,
    smoothieType: 'Oat-Based',
    featured: true,
    trending: true,
    bestTime: 'Morning',
    caffeineFree: true,
    image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop'
  },
  {
    id: 'green-breakfast-power',
    name: 'Green Breakfast Power',
    description: 'Spinach and fruit blend to start your day right',
    ingredients: ['1 cup spinach', '1/2 banana', '1/2 cup pineapple', '1/2 cup Greek yogurt', '1 tbsp flax seeds', 'Ice'],
    benefits: ['Energy boost', 'Nutrient dense', 'Protein packed', 'Immune support'],
    nutrition: { calories: 280, protein: 15, carbs: 42, fiber: 7, sugar: 28 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 367,
    smoothieType: 'Green',
    featured: false,
    trending: true,
    bestTime: 'Morning',
    caffeineFree: true
  },
  {
    id: 'coffee-protein-shake',
    name: 'Coffee Protein Shake',
    description: 'Morning coffee meets protein power',
    ingredients: ['1/2 cup cold brew', '1 scoop vanilla protein', '1/2 banana', '1/2 cup almond milk', 'Ice'],
    benefits: ['Caffeine boost', 'Muscle fuel', 'Mental clarity', 'Morning energy'],
    nutrition: { calories: 240, protein: 25, carbs: 22, fiber: 3, sugar: 12 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 512,
    smoothieType: 'Coffee',
    featured: true,
    trending: false,
    bestTime: 'Morning',
    caffeineFree: false
  },
  {
    id: 'berry-yogurt-breakfast',
    name: 'Berry Yogurt Breakfast',
    description: 'Classic berry and yogurt combination',
    ingredients: ['1 cup mixed berries', '3/4 cup Greek yogurt', '1/4 cup orange juice', '1 tbsp honey', 'Ice'],
    benefits: ['Antioxidants', 'Probiotics', 'Vitamin C', 'Calcium rich'],
    nutrition: { calories: 290, protein: 18, carbs: 45, fiber: 6, sugar: 32 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 289,
    smoothieType: 'Yogurt',
    featured: false,
    trending: false,
    bestTime: 'Morning',
    caffeineFree: true
  },
  {
    id: 'tropical-morning-bliss',
    name: 'Tropical Morning Bliss',
    description: 'Island flavors to brighten your morning',
    ingredients: ['1/2 cup mango', '1/2 cup pineapple', '1/2 banana', '1/2 cup coconut milk', '1 tbsp shredded coconut', 'Ice'],
    benefits: ['Vitamin C', 'Tropical flavor', 'Energy boost', 'Hydrating'],
    nutrition: { calories: 310, protein: 4, carbs: 52, fiber: 5, sugar: 38 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 198,
    smoothieType: 'Tropical',
    featured: false,
    trending: false,
    bestTime: 'Morning',
    caffeineFree: true
  },
  {
    id: 'peanut-butter-energy',
    name: 'Peanut Butter Energy',
    description: 'Creamy peanut butter for lasting morning fuel',
    ingredients: ['2 tbsp peanut butter', '1 banana', '1 cup milk', '1/4 cup oats', '1 tsp cinnamon', 'Ice'],
    benefits: ['Protein rich', 'Healthy fats', 'Sustained energy', 'Satisfying'],
    nutrition: { calories: 380, protein: 16, carbs: 44, fiber: 6, sugar: 24 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 345,
    smoothieType: 'Nut Butter',
    featured: false,
    trending: true,
    bestTime: 'Morning',
    caffeineFree: true
  },
  {
    id: 'chocolate-breakfast-treat',
    name: 'Chocolate Breakfast Treat',
    description: 'Healthy chocolate smoothie that feels like dessert',
    ingredients: ['1 tbsp cocoa powder', '1 banana', '1 cup milk', '1 scoop chocolate protein', '1 tbsp almond butter', 'Ice'],
    benefits: ['Antioxidants', 'Protein packed', 'Mood boosting', 'Indulgent'],
    nutrition: { calories: 350, protein: 28, carbs: 36, fiber: 7, sugar: 20 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 278,
    smoothieType: 'Chocolate',
    featured: true,
    trending: false,
    bestTime: 'Morning',
    caffeineFree: true
  },
  {
    id: 'sunrise-citrus-boost',
    name: 'Sunrise Citrus Boost',
    description: 'Bright citrus flavors to wake up your senses',
    ingredients: ['1 orange', '1/2 grapefruit', '1/2 banana', '1/2 cup Greek yogurt', '1 tbsp honey', 'Ice'],
    benefits: ['Vitamin C', 'Immune support', 'Refreshing', 'Digestive aid'],
    nutrition: { calories: 260, protein: 12, carbs: 48, fiber: 5, sugar: 35 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.4,
    reviews: 167,
    smoothieType: 'Citrus',
    featured: false,
    trending: false,
    bestTime: 'Morning',
    caffeineFree: true
  }
];

const smoothieSubcategories = [
  { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Zap, description: 'High protein blends' },
  { id: 'workout', name: 'Workout', path: '/drinks/smoothies/workout', icon: Target, description: 'Performance boost' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Leafy greens' },
  { id: 'tropical', name: 'Tropical', path: '/drinks/smoothies/tropical', icon: Sun, description: 'Island flavors' },
  { id: 'berry', name: 'Berry', path: '/drinks/smoothies/berry', icon: Heart, description: 'Antioxidant rich' },
  { id: 'detox', name: 'Detox', path: '/drinks/smoothies/detox', icon: Droplets, description: 'Cleansing blends' },
  { id: 'dessert', name: 'Dessert', path: '/drinks/smoothies/dessert', icon: Star, description: 'Sweet treats' }
];

const otherDrinkHubs = [
  { id: 'juices', name: 'Fresh Juices', route: '/drinks/juices', icon: Droplets, description: 'Cold-pressed nutrition' },
  { id: 'teas', name: 'Specialty Teas', route: '/drinks/teas', icon: Coffee, description: 'Hot & iced teas' },
  { id: 'coffee', name: 'Coffee Drinks', route: '/drinks/coffee', icon: Zap, description: 'Artisan coffee' },
  { id: 'protein-shakes', name: 'Protein Shakes', route: '/drinks/protein-shakes', icon: Apple, description: 'Muscle fuel' }
];

export default function BreakfastSmoothiesPage() {
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
  const [selectedSmoothieType, setSelectedSmoothieType] = useState('');
  const [caffeineLevel, setCaffeineLevel] = useState(['Any']);
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  
  // RecipeKit state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  // Convert breakfast smoothies to RecipeKit format
  const smoothieRecipesWithMeasurements = useMemo(() => {
    return breakfastSmoothies.map(smoothie => ({
      ...smoothie,
      recipe: {
        servings: 1,
        measurements: smoothie.ingredients.map((ing, index) => {
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
          'Add all ingredients to blender',
          'Blend until smooth and creamy',
          'Pour into glass and serve immediately',
          'Enjoy your breakfast smoothie!'
        ]
      }
    }));
  }, []);

  const handleShareSmoothie = async (smoothie: any, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[smoothie.id] ?? (smoothie.recipe?.servings || 1);
    const preview = smoothie.ingredients.slice(0, 4).join(' • ');
    const text = `${smoothie.name} • ${smoothie.smoothieType} • ${smoothie.bestTime}\n${preview}${smoothie.ingredients.length > 4 ? ` …plus ${smoothie.ingredients.length - 4} more` : ''}`;
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
        description: `${selectedRecipe.smoothieType || ''} • ${selectedRecipe.bestTime || ''}`,
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
      const matchesType = !selectedSmoothieType || smoothie.smoothieType?.toLowerCase().includes(selectedSmoothieType.toLowerCase());
      const matchesCaffeine = caffeineLevel[0] === 'Any' || 
        (caffeineLevel[0] === 'Caffeinated' && !smoothie.caffeineFree) ||
        (caffeineLevel[0] === 'Caffeine-Free' && smoothie.caffeineFree);
      
      return matchesSearch && matchesType && matchesCaffeine;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        case 'time': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = smoothieRecipesWithMeasurements.filter(s => s.featured);
  const trendingSmoothies = smoothieRecipesWithMeasurements.filter(s => s.trending);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-50">
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
                <Sun className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">Breakfast Smoothies</h1>
                <Badge className="bg-orange-100 text-orange-800">Morning Fuel</Badge>
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

        {/* SISTER SUBPAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
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
              <div className="text-2xl font-bold text-orange-600">305</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">15g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{breakfastSmoothies.length}</div>
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
                      placeholder="Search breakfast smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={selectedSmoothieType}
                      onChange={(e) => setSelectedSmoothieType(e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="Oat-Based">Oat-Based</option>
                      <option value="Green">Green</option>
                      <option value="Coffee">Coffee</option>
                      <option value="Yogurt">Yogurt</option>
                      <option value="Tropical">Tropical</option>
                      <option value="Nut Butter">Nut Butter</option>
                      <option value="Chocolate">Chocolate</option>
                      <option value="Citrus">Citrus</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={caffeineLevel[0]}
                      onChange={(e) => setCaffeineLevel([e.target.value])}
                    >
                      <option value="Any">Any Caffeine</option>
                      <option value="Caffeinated">With Caffeine</option>
                      <option value="Caffeine-Free">Caffeine-Free</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="protein">Sort by Protein</option>
                      <option value="calories">Sort by Calories</option>
                      <option value="time">Sort by Prep Time</option>
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
                            bestTime: smoothie.bestTime
                          })}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : ''}`} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-orange-100 text-orange-800">{smoothie.smoothieType}</Badge>
                        {!smoothie.caffeineFree && <Badge className="bg-amber-100 text-amber-800">Caffeinated</Badge>}
                        {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="font-bold text-orange-600">{smoothie.nutrition.calories}</div>
                          <div className="text-gray-500">Cal</div>
                        </div>
                        <div>
                          <div className="font-bold text-orange-600">{smoothie.nutrition.protein}g</div>
                          <div className="text-gray-500">Protein</div>
                        </div>
                        <div>
                          <div className="font-bold text-orange-600">{smoothie.prepTime}m</div>
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

                      {/* RecipeKit Preview */}
                      {smoothie.recipe?.measurements && (
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
                        {smoothie.benefits.slice(0, 3).map((benefit, index) => (
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

        {/* Rest of the tabs remain the same structure */}
        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  {smoothie.image && (
                    <img 
                      src={smoothie.image} 
                      alt={smoothie.name}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-orange-500 text-white">Featured</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-orange-100 text-orange-800">{smoothie.smoothieType}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium text-orange-600">{smoothie.rating}</span>
                      <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    onClick={() => openRecipeModal(smoothie)}
                  >
                    <Apple className="h-4 w-4 mr-2" />
                    Make This Smoothie
                  </Button>
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
                  <Badge variant="outline" className="text-orange-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-orange-600">
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
