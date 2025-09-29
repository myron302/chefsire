import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Droplets, Clock, Heart, Star, Target, Snowflake, Leaf, Sparkles,
  Search, Share2, ArrowLeft, Plus, Zap, Sun, Camera, Flame
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const detoxWaters = [
  {
    id: 'water-1',
    name: 'Cucumber Mint Refresh',
    description: 'Hydrating and cooling with cucumber and fresh mint',
    waterType: 'Hydration',
    infusionTime: '2-4 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 8,
      sugar: 2,
      electrolytes: 'Moderate',
      hydration_level: 'Very High'
    },
    ingredients: ['Cucumber (1/2 sliced)', 'Fresh Mint (10 leaves)', 'Lemon (1/2 sliced)', 'Cold Water (32 oz)', 'Ice'],
    benefits: ['Deep Hydration', 'Skin Glow', 'Cooling', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 1456,
    trending: true,
    featured: true,
    estimatedCost: 1.25,
    bestTime: 'All Day',
    duration: 'Daily',
    allergens: [],
    category: 'Hydrating Waters'
  },
  {
    id: 'water-2',
    name: 'Lemon Ginger Detox',
    description: 'Metabolism-boosting citrus with warming ginger',
    waterType: 'Metabolic',
    infusionTime: '1-2 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 12,
      sugar: 3,
      vitamin_c: 'High',
      thermogenic: 'Present'
    },
    ingredients: ['Lemon (1 whole sliced)', 'Fresh Ginger (2 inches sliced)', 'Honey (1 tsp optional)', 'Warm Water (32 oz)'],
    benefits: ['Metabolism Boost', 'Digestive Aid', 'Vitamin C', 'Morning Energy'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 2134,
    trending: false,
    featured: true,
    estimatedCost: 0.75,
    bestTime: 'Morning',
    duration: 'Daily',
    allergens: [],
    category: 'Metabolic Waters'
  },
  {
    id: 'water-3',
    name: 'Berry Antioxidant Splash',
    description: 'Mixed berries for powerful antioxidant benefits',
    waterType: 'Antioxidant',
    infusionTime: '3-6 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 18,
      sugar: 5,
      antioxidants: 'Very High',
      vitamin_c: 'High'
    },
    ingredients: ['Strawberries (5 sliced)', 'Blueberries (1/4 cup)', 'Raspberries (1/4 cup)', 'Lime (1/2 sliced)', 'Cold Water (32 oz)', 'Basil (3 leaves)'],
    benefits: ['Antioxidant Power', 'Anti-aging', 'Immune Support', 'Cell Protection'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 987,
    trending: true,
    featured: false,
    estimatedCost: 3.25,
    bestTime: 'Afternoon',
    duration: 'Daily',
    allergens: [],
    category: 'Antioxidant Waters'
  },
  {
    id: 'water-4',
    name: 'Apple Cinnamon Spa Water',
    description: 'Sweet and spiced for metabolism and flavor',
    waterType: 'Metabolic',
    infusionTime: '2-4 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 15,
      sugar: 4,
      fiber: 'Present',
      blood_sugar_support: 'Yes'
    },
    ingredients: ['Green Apple (1 sliced)', 'Cinnamon Stick (2)', 'Lemon (1/2 sliced)', 'Filtered Water (32 oz)', 'Ice'],
    benefits: ['Blood Sugar Balance', 'Metabolism', 'Digestive Support', 'Natural Sweetness'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 743,
    trending: false,
    featured: true,
    estimatedCost: 1.50,
    bestTime: 'Morning',
    duration: 'Daily',
    allergens: [],
    category: 'Metabolic Waters'
  },
  {
    id: 'water-5',
    name: 'Tropical Paradise Hydration',
    description: 'Pineapple, coconut, and citrus for island vibes',
    waterType: 'Hydration',
    infusionTime: '2-3 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 22,
      sugar: 6,
      electrolytes: 'High',
      vitamin_c: 'Moderate'
    },
    ingredients: ['Pineapple (1 cup chunks)', 'Coconut Water (1 cup)', 'Orange (1/2 sliced)', 'Mint (5 leaves)', 'Filtered Water (16 oz)'],
    benefits: ['Electrolyte Balance', 'Hydration', 'Digestive Enzymes', 'Tropical Energy'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 1123,
    trending: true,
    featured: false,
    estimatedCost: 2.75,
    bestTime: 'Post-Workout',
    duration: 'As Needed',
    allergens: [],
    category: 'Hydrating Waters'
  },
  {
    id: 'water-6',
    name: 'Citrus Mint Energizer',
    description: 'Triple citrus with mint for morning awakening',
    waterType: 'Energizing',
    infusionTime: '1-2 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 10,
      sugar: 3,
      vitamin_c: 'Very High',
      alkalizing: 'Yes'
    },
    ingredients: ['Lemon (1/2 sliced)', 'Lime (1/2 sliced)', 'Orange (1/2 sliced)', 'Fresh Mint (8 leaves)', 'Cold Water (32 oz)'],
    benefits: ['Morning Energy', 'Vitamin C Boost', 'Alkalizing', 'Mental Clarity'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 1567,
    trending: true,
    featured: true,
    estimatedCost: 1.75,
    bestTime: 'Morning',
    duration: 'Daily',
    allergens: [],
    category: 'Energizing Waters'
  },
  {
    id: 'water-7',
    name: 'Watermelon Basil Cooler',
    description: 'Refreshing watermelon with aromatic basil',
    waterType: 'Hydration',
    infusionTime: '2-3 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 20,
      sugar: 5,
      lycopene: 'High',
      hydration_level: 'Very High'
    },
    ingredients: ['Watermelon (2 cups cubed)', 'Fresh Basil (6 leaves)', 'Lime (1/2 sliced)', 'Filtered Water (24 oz)', 'Ice'],
    benefits: ['Deep Hydration', 'Lycopene', 'Cooling', 'Summer Refresh'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 892,
    trending: false,
    featured: false,
    estimatedCost: 2.25,
    bestTime: 'Afternoon',
    duration: 'Daily',
    allergens: [],
    category: 'Hydrating Waters'
  },
  {
    id: 'water-8',
    name: 'Grapefruit Rosemary Detox',
    description: 'Bitter grapefruit with aromatic rosemary',
    waterType: 'Detoxifying',
    infusionTime: '2-4 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 16,
      sugar: 4,
      vitamin_c: 'High',
      liver_support: 'Yes'
    },
    ingredients: ['Grapefruit (1/2 sliced)', 'Fresh Rosemary (2 sprigs)', 'Lemon (1/4 sliced)', 'Cold Water (32 oz)', 'Ice'],
    benefits: ['Liver Support', 'Fat Metabolism', 'Detoxification', 'Digestion'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 654,
    trending: false,
    featured: false,
    estimatedCost: 1.50,
    bestTime: 'Morning',
    duration: '3-7 Days',
    allergens: [],
    category: 'Detoxifying Waters'
  },
  {
    id: 'water-9',
    name: 'Strawberry Kiwi Vitamin Boost',
    description: 'Vitamin C powerhouse with strawberry and kiwi',
    waterType: 'Vitamin Rich',
    infusionTime: '3-5 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 24,
      sugar: 6,
      vitamin_c: 'Very High',
      vitamin_k: 'High'
    },
    ingredients: ['Strawberries (6 sliced)', 'Kiwi (2 sliced)', 'Lime (1/2 sliced)', 'Filtered Water (32 oz)', 'Mint (4 leaves)'],
    benefits: ['Immune Boost', 'Vitamin C', 'Digestive Health', 'Skin Health'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 1089,
    trending: true,
    featured: false,
    estimatedCost: 3.00,
    bestTime: 'Anytime',
    duration: 'Daily',
    allergens: [],
    category: 'Vitamin Waters'
  },
  {
    id: 'water-10',
    name: 'Lavender Lemon Calm',
    description: 'Soothing lavender with gentle lemon',
    waterType: 'Relaxation',
    infusionTime: '1-2 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 6,
      sugar: 2,
      calming_compounds: 'Present',
      antioxidants: 'Moderate'
    },
    ingredients: ['Culinary Lavender (1 tsp)', 'Lemon (1/2 sliced)', 'Honey (1 tsp)', 'Filtered Water (32 oz)', 'Ice'],
    benefits: ['Stress Relief', 'Calming', 'Sleep Support', 'Gentle Detox'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 567,
    trending: false,
    featured: true,
    estimatedCost: 1.25,
    bestTime: 'Evening',
    duration: 'As Needed',
    allergens: [],
    category: 'Relaxation Waters'
  },
  {
    id: 'water-11',
    name: 'Peach Ginger Sunset',
    description: 'Sweet peaches with spicy ginger kick',
    waterType: 'Metabolic',
    infusionTime: '2-4 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 18,
      sugar: 5,
      vitamin_a: 'High',
      thermogenic: 'Present'
    },
    ingredients: ['Peach (1 sliced)', 'Fresh Ginger (1 inch sliced)', 'Lemon (1/4 sliced)', 'Filtered Water (32 oz)', 'Basil (3 leaves)'],
    benefits: ['Metabolism', 'Digestive Fire', 'Vitamin A', 'Anti-inflammatory'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 789,
    trending: false,
    featured: false,
    estimatedCost: 2.00,
    bestTime: 'Afternoon',
    duration: 'Daily',
    allergens: [],
    category: 'Metabolic Waters'
  },
  {
    id: 'water-12',
    name: 'Blackberry Sage Elixir',
    description: 'Dark berries with earthy sage for deep flavor',
    waterType: 'Antioxidant',
    infusionTime: '3-6 hours',
    servingSize: '32 oz',
    nutrition: {
      calories: 20,
      sugar: 5,
      antioxidants: 'Very High',
      anthocyanins: 'High'
    },
    ingredients: ['Blackberries (1/2 cup)', 'Fresh Sage (4 leaves)', 'Lemon (1/2 sliced)', 'Filtered Water (32 oz)', 'Ice'],
    benefits: ['Brain Health', 'Antioxidants', 'Memory Support', 'Anti-aging'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 634,
    trending: false,
    featured: false,
    estimatedCost: 2.50,
    bestTime: 'Anytime',
    duration: 'Daily',
    allergens: [],
    category: 'Antioxidant Waters'
  }
];

const waterCategories = [
  { id: 'all', name: 'All Waters', icon: Droplets },
  { id: 'hydration', name: 'Hydrating', icon: Droplets },
  { id: 'metabolic', name: 'Metabolic', icon: Flame },
  { id: 'antioxidant', name: 'Antioxidant', icon: Sparkles },
  { id: 'energizing', name: 'Energizing', icon: Zap },
  { id: 'relaxation', name: 'Relaxation', icon: Leaf },
  { id: 'vitamin', name: 'Vitamin Rich', icon: Sun }
];

export default function DetoxWatersPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedWater, setSelectedWater] = useState<typeof detoxWaters[0] | null>(null);
  const [calorieRange, setCalorieRange] = useState([0, 30]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWaters = detoxWaters.filter(water => {
    if (selectedCategory !== 'all' && !water.category.toLowerCase().includes(selectedCategory.toLowerCase())) {
      return false;
    }
    if (water.nutrition.calories < calorieRange[0] || water.nutrition.calories > calorieRange[1]) {
      return false;
    }
    if (searchQuery && !water.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'trending') return b.reviews - a.reviews;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'calories-low') return a.nutrition.calories - b.nutrition.calories;
    if (sortBy === 'cost-low') return a.estimatedCost - b.estimatedCost;
    if (sortBy === 'time-quick') return a.prepTime - b.prepTime;
    return 0;
  });

  const handleWaterClick = (water: typeof detoxWaters[0]) => {
    setSelectedWater(water);
    addToRecentlyViewed({
      id: water.id,
      name: water.name,
      category: 'Detox Waters',
      timestamp: Date.now()
    });
  };

  const handleMakeWater = (water: typeof detoxWaters[0]) => {
    incrementDrinksMade();
    addPoints(15, 'Made a detox water');
    setSelectedWater(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-teal-50">
      {/* Universal Search */}
      <div className="bg-white border-b border-cyan-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <UniversalSearch />
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-teal-500 text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Detoxes
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Droplets className="w-10 h-10" />
                Detox Infused Waters
              </h1>
              <p className="text-cyan-100 text-lg">Zero-calorie hydration with natural detox benefits</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{filteredWaters.length}</div>
              <div className="text-cyan-100">Recipes</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border-cyan-200">
            <CardContent className="p-4 text-center">
              <Droplets className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-cyan-600">~10</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-blue-200">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">2-4 hrs</div>
              <div className="text-sm text-gray-600">Infusion Time</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-teal-200">
            <CardContent className="p-4 text-center">
              <Target className="w-8 h-8 text-teal-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-teal-600">32 oz</div>
              <div className="text-sm text-gray-600">Standard Size</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-purple-200">
            <CardContent className="p-4 text-center">
              <Sparkles className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-600">Natural</div>
              <div className="text-sm text-gray-600">Zero Added Sugar</div>
            </CardContent>
          </Card>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {waterCategories.map(category => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className={selectedCategory === category.id ? "bg-cyan-500 hover:bg-cyan-600" : "hover:bg-cyan-50"}
              >
                <Icon className="w-4 h-4 mr-2" />
                {category.name}
              </Button>
            );
          })}
        </div>

        {/* Filters and Sort */}
        <div className="flex gap-4 mb-6 items-center flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search infused waters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="trending">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="calories-low">Lowest Calories</option>
            <option value="cost-low">Most Budget-Friendly</option>
            <option value="time-quick">Quickest Prep</option>
          </select>
          <Button 
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Target className="w-4 h-4 mr-2" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card className="mb-6 bg-white border-cyan-200">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Calorie Range: {calorieRange[0]} - {calorieRange[1]} cal
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={calorieRange[1]}
                    onChange={(e) => setCalorieRange([calorieRange[0], parseInt(e.target.value)])}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Waters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWaters.map(water => (
            <Card 
              key={water.id} 
              className="hover:shadow-lg transition-all cursor-pointer bg-white border-cyan-100 hover:border-cyan-300"
              onClick={() => handleWaterClick(water)}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-lg">{water.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToFavorites({
                        id: water.id,
                        name: water.name,
                        category: 'Detox Waters',
                        timestamp: Date.now()
                      });
                    }}
                  >
                    <Heart className={`w-4 h-4 ${isFavorite(water.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                </div>
                {water.trending && (
                  <Badge className="bg-cyan-500 mb-2">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Trending
                  </Badge>
                )}
                {water.featured && (
                  <Badge className="bg-purple-500 mb-2 ml-2">
                    <Star className="w-3 h-3 mr-1" />
                    Featured
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{water.description}</p>
                
                <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span>{water.nutrition.calories} cal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{water.infusionTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-cyan-500" />
                    <span>{water.servingSize}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{water.rating} ({water.reviews})</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {water.benefits.slice(0, 3).map(benefit => (
                    <Badge key={benefit} variant="outline" className="text-xs border-cyan-300">
                      {benefit}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm font-medium text-cyan-600">{water.waterType}</span>
                  <span className="text-sm text-gray-500">${water.estimatedCost.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Water Detail Modal */}
        {selectedWater && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedWater(null)}>
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-2xl">{selectedWater.name}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedWater(null)}>×</Button>
                </div>
                <p className="text-gray-600">{selectedWater.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Nutrition Facts */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5 text-cyan-500" />
                      Nutrition Facts
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-cyan-50 rounded-lg">
                        <div className="text-sm text-gray-600">Calories</div>
                        <div className="text-xl font-bold text-cyan-600">{selectedWater.nutrition.calories}</div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-gray-600">Sugar</div>
                        <div className="text-xl font-bold text-blue-600">{selectedWater.nutrition.sugar}g</div>
                      </div>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Leaf className="w-5 h-5 text-green-500" />
                      Ingredients
                    </h3>
                    <div className="space-y-2">
                      {selectedWater.ingredients.map((ingredient, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <Plus className="w-4 h-4 text-cyan-500" />
                          <span className="text-sm">{ingredient}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Benefits */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      Health Benefits
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedWater.benefits.map(benefit => (
                        <Badge key={benefit} className="bg-purple-100 text-purple-700 border-purple-300">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Preparation Details */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-500" />
                      Preparation
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-blue-50 rounded-lg text-center">
                        <div className="text-sm text-gray-600">Prep Time</div>
                        <div className="text-lg font-bold text-blue-600">{selectedWater.prepTime} min</div>
                      </div>
                      <div className="p-3 bg-cyan-50 rounded-lg text-center">
                        <div className="text-sm text-gray-600">Infusion</div>
                        <div className="text-lg font-bold text-cyan-600">{selectedWater.infusionTime}</div>
                      </div>
                      <div className="p-3 bg-teal-50 rounded-lg text-center">
                        <div className="text-sm text-gray-600">Best Time</div>
                        <div className="text-lg font-bold text-teal-600">{selectedWater.bestTime}</div>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5 text-cyan-500" />
                      Instructions
                    </h3>
                    <ol className="space-y-3">
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                        <span className="text-sm">Wash and slice all fresh ingredients</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                        <span className="text-sm">Add ingredients to a large pitcher or jar</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                        <span className="text-sm">Fill with cold filtered water ({selectedWater.servingSize})</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                        <span className="text-sm">Refrigerate and let infuse for {selectedWater.infusionTime}</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                        <span className="text-sm">Strain or serve with ingredients for visual appeal</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">6</span>
                        <span className="text-sm">Best consumed within 24 hours for freshness</span>
                      </li>
                    </ol>
                  </div>

                  {/* Tips */}
                  <div className="bg-cyan-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-cyan-500" />
                      Pro Tips
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>• Muddle herbs gently to release more flavor</li>
                      <li>• Use room temperature water for faster infusion</li>
                      <li>• Refill water 2-3 times before replacing ingredients</li>
                      <li>• Double the recipe for meal prep convenience</li>
                      <li>• Add ice when serving, not during infusion</li>
                    </ul>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                      onClick={() => handleMakeWater(selectedWater)}
                    >
                      <Droplets className="w-4 h-4 mr-2" />
                      Make This Water
                    </Button>
                    <Button variant="outline" size="icon">
                      <Share2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Educational Content */}
        <Card className="mt-12 bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-cyan-500" />
              The Science of Infused Waters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-cyan-500" />
                  Hydration Benefits
                </h3>
                <p className="text-sm text-gray-700">
                  Infused waters make hydration more enjoyable and can help you reach your daily water intake goals. 
                  The natural flavors encourage more frequent sipping throughout the day.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-green-500" />
                  Nutrient Infusion
                </h3>
                <p className="text-sm text-gray-700">
                  While infused waters contain minimal calories, they do absorb small amounts of vitamins, 
                  minerals, and antioxidants from the fruits and herbs used.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Sun className="w-5 h-5 text-orange-500" />
                  Natural & Clean
                </h3>
                <p className="text-sm text-gray-700">
                  Unlike flavored beverages, infused waters contain no artificial sweeteners, colors, or preservatives. 
                  They're a pure, natural way to enjoy flavored hydration.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Infusion Time Guide */}
        <Card className="mt-8 bg-white border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-500" />
              Infusion Time Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="font-semibold text-blue-600 mb-2">30 min - 1 hour</div>
                <div className="text-sm text-gray-700">Citrus fruits, ginger, mint - Quick flavor release</div>
              </div>
              <div className="p-4 bg-cyan-50 rounded-lg">
                <div className="font-semibold text-cyan-600 mb-2">2-4 hours</div>
                <div className="text-sm text-gray-700">Most fruits and herbs - Optimal flavor balance</div>
              </div>
              <div className="p-4 bg-teal-50 rounded-lg">
                <div className="font-semibold text-teal-600 mb-2">4-8 hours</div>
                <div className="text-sm text-gray-700">Berries, melons - Deep fruit infusion</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="font-semibold text-purple-600 mb-2">Overnight</div>
                <div className="text-sm text-gray-700">Maximum flavor extraction for meal prep</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Popular Combinations */}
        <Card className="mt-8 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-6 h-6 text-purple-500" />
              Popular Flavor Pairings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-lg border border-purple-200">
                <div className="font-semibold text-purple-600 mb-2">Citrus + Herbs</div>
                <div className="text-sm text-gray-700">Lemon, lime, orange with mint, basil, or rosemary</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-pink-200">
                <div className="font-semibold text-pink-600 mb-2">Berry + Citrus</div>
                <div className="text-sm text-gray-700">Strawberry, raspberry with lemon or lime</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-cyan-200">
                <div className="font-semibold text-cyan-600 mb-2">Cucumber + Herbs</div>
                <div className="text-sm text-gray-700">Cucumber with mint, basil, or dill</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-orange-200">
                <div className="font-semibold text-orange-600 mb-2">Tropical Mix</div>
                <div className="text-sm text-gray-700">Pineapple, mango with coconut or ginger</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
