import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Leaf, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Apple, Milk,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Search, Filter, Shuffle, Camera, Share2, ArrowLeft,
  Activity, BarChart3, Sparkles, Crown, Dumbbell, TreePine
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

// Green superfood smoothie data
const greenSmoothies = [
  {
    id: 'green-smoothie-1',
    name: 'Ultimate Green Goddess',
    description: 'Spinach, kale, and spirulina for maximum nutrition',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop',
    primaryGreens: 'Spinach & Kale',
    greensContent: ['Baby Spinach', 'Kale', 'Spirulina', 'Chlorella'],
    flavor: 'Fresh Green',
    servingSize: '16 oz',
    nutrition: {
      calories: 185,
      protein: 8,
      carbs: 28,
      fat: 6,
      fiber: 12,
      sugar: 18,
      iron: 4.2,
      vitamin_k: 350,
      folate: 125
    },
    ingredients: ['Baby Spinach (2 cups)', 'Kale (1 cup)', 'Green Apple (1 medium)', 'Cucumber (1/2 medium)', 'Spirulina (1 tsp)', 'Lemon Juice (2 tbsp)', 'Coconut Water (1 cup)', 'Fresh Mint (6 leaves)'],
    benefits: ['Detoxification', 'Alkalizing', 'High Iron', 'Antioxidants', 'Energy Boost'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 892,
    trending: true,
    featured: true,
    estimatedCost: 3.75,
    bestTime: 'Morning',
    fitnessGoal: 'Detox',
    superfoods: ['Spirulina', 'Chlorella'],
    allergens: [],
    category: 'Detox Greens'
  },
  {
    id: 'green-smoothie-2',
    name: 'Tropical Green Paradise',
    description: 'Pineapple and mango mask the greens perfectly',
    primaryGreens: 'Spinach',
    greensContent: ['Baby Spinach', 'Romaine Hearts'],
    flavor: 'Tropical Sweet',
    servingSize: '18 oz',
    nutrition: {
      calories: 220,
      protein: 5,
      carbs: 48,
      fat: 3,
      fiber: 8,
      sugar: 38,
      vitamin_c: 180,
      potassium: 750
    },
    ingredients: ['Baby Spinach (2 cups)', 'Pineapple Chunks (1 cup)', 'Mango (1/2 large)', 'Banana (1/2 medium)', 'Coconut Milk (1/2 cup)', 'Lime Juice (1 tbsp)', 'Chia Seeds (1 tbsp)'],
    benefits: ['Vitamin C Boost', 'Digestive Health', 'Hidden Veggies', 'Natural Sweetness'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 1234,
    trending: false,
    featured: true,
    estimatedCost: 4.25,
    bestTime: 'Snack',
    fitnessGoal: 'Energy',
    superfoods: ['Chia Seeds'],
    allergens: [],
    category: 'Tropical Greens'
  },
  {
    id: 'green-smoothie-3',
    name: 'Chocolate Mint Green Machine',
    description: 'Cacao and mint make greens taste like dessert',
    primaryGreens: 'Spinach',
    greensContent: ['Baby Spinach', 'Fresh Mint'],
    flavor: 'Chocolate Mint',
    servingSize: '16 oz',
    nutrition: {
      calories: 285,
      protein: 12,
      carbs: 35,
      fat: 12,
      fiber: 11,
      sugar: 20,
      magnesium: 95,
      antioxidants: 'High'
    },
    ingredients: ['Baby Spinach (2.5 cups)', 'Raw Cacao Powder (2 tbsp)', 'Fresh Mint (8 leaves)', 'Avocado (1/4 medium)', 'Banana (1 medium)', 'Almond Butter (1 tbsp)', 'Almond Milk (1.5 cups)', 'Stevia (to taste)'],
    benefits: ['Antioxidant Rich', 'Healthy Fats', 'Natural Sweetness', 'Mood Boost'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.5,
    reviews: 678,
    trending: true,
    featured: false,
    estimatedCost: 4.75,
    bestTime: 'Afternoon',
    fitnessGoal: 'Craving Control',
    superfoods: ['Raw Cacao', 'Avocado'],
    allergens: ['Nuts'],
    category: 'Dessert Greens'
  },
  {
    id: 'green-smoothie-4',
    name: 'Cucumber Celery Cleanse',
    description: 'Hydrating greens for ultimate detoxification',
    primaryGreens: 'Celery & Cucumber',
    greensContent: ['Celery', 'Cucumber', 'Parsley', 'Cilantro'],
    flavor: 'Fresh Vegetal',
    servingSize: '20 oz',
    nutrition: {
      calories: 125,
      protein: 4,
      carbs: 22,
      fat: 2,
      fiber: 6,
      sugar: 14,
      sodium: 180,
      potassium: 650
    },
    ingredients: ['Celery Stalks (3 large)', 'Cucumber (1 large)', 'Fresh Parsley (1/4 cup)', 'Cilantro (1/4 cup)', 'Green Apple (1 small)', 'Lemon Juice (2 tbsp)', 'Ginger (1 inch)', 'Coconut Water (1 cup)'],
    benefits: ['Deep Cleanse', 'Hydration', 'Anti-inflammatory', 'Liver Support'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.2,
    reviews: 445,
    trending: false,
    featured: false,
    estimatedCost: 3.25,
    bestTime: 'Morning Fasted',
    fitnessGoal: 'Cleanse',
    superfoods: ['Fresh Ginger'],
    allergens: [],
    category: 'Cleanse Greens'
  },
  {
    id: 'green-smoothie-5',
    name: 'Matcha Green Tea Fusion',
    description: 'Ceremonial matcha with greens for focused energy',
    primaryGreens: 'Spinach',
    greensContent: ['Baby Spinach', 'Matcha Powder'],
    flavor: 'Matcha Vanilla',
    servingSize: '14 oz',
    nutrition: {
      calories: 195,
      protein: 9,
      carbs: 28,
      fat: 6,
      fiber: 5,
      sugar: 20,
      caffeine: 70,
      l_theanine: 25
    },
    ingredients: ['Baby Spinach (1.5 cups)', 'Ceremonial Matcha (1 tsp)', 'Vanilla Greek Yogurt (1/2 cup)', 'Banana (1/2 medium)', 'Honey (1 tbsp)', 'Coconut Milk (1 cup)', 'Ice Cubes'],
    benefits: ['Sustained Energy', 'Mental Focus', 'Antioxidants', 'Metabolism Boost'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 756,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Pre-Workout',
    fitnessGoal: 'Energy & Focus',
    superfoods: ['Matcha', 'Greek Yogurt'],
    allergens: ['Dairy'],
    category: 'Energy Greens'
  },
  {
    id: 'green-smoothie-6',
    name: 'Avocado Green Dream',
    description: 'Ultra-creamy avocado base with nutrient-dense greens',
    primaryGreens: 'Kale',
    greensContent: ['Lacinato Kale', 'Swiss Chard'],
    flavor: 'Creamy Green',
    servingSize: '16 oz',
    nutrition: {
      calories: 320,
      protein: 8,
      carbs: 32,
      fat: 18,
      fiber: 15,
      sugar: 16,
      folate: 180,
      vitamin_k: 280
    },
    ingredients: ['Lacinato Kale (1.5 cups)', 'Avocado (1/2 large)', 'Green Grapes (1/2 cup)', 'Pear (1 medium)', 'Swiss Chard (1/2 cup)', 'Lime Juice (1 tbsp)', 'Coconut Water (1.5 cups)'],
    benefits: ['Healthy Fats', 'Fiber Rich', 'Heart Health', 'Satiety'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.4,
    reviews: 534,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    bestTime: 'Lunch',
    fitnessGoal: 'Weight Management',
    superfoods: ['Avocado'],
    allergens: [],
    category: 'Creamy Greens'
  },
  {
    id: 'green-smoothie-7',
    name: 'Wheatgrass Wonder Boost',
    description: 'Potent wheatgrass shot in smoothie form',
    primaryGreens: 'Wheatgrass',
    greensContent: ['Wheatgrass Powder', 'Spinach', 'Parsley'],
    flavor: 'Earthy Fresh',
    servingSize: '12 oz',
    nutrition: {
      calories: 155,
      protein: 6,
      carbs: 28,
      fat: 3,
      fiber: 8,
      sugar: 18,
      chlorophyll: 'Very High',
      enzymes: 'Active'
    },
    ingredients: ['Wheatgrass Powder (1 tbsp)', 'Baby Spinach (1 cup)', 'Fresh Parsley (2 tbsp)', 'Green Apple (1 small)', 'Lemon Juice (2 tbsp)', 'Ginger (1/2 inch)', 'Coconut Water (1 cup)', 'Stevia (optional)'],
    benefits: ['Chlorophyll Boost', 'Enzyme Rich', 'Alkalizing', 'Immune Support'],
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.1,
    reviews: 312,
    trending: false,
    featured: false,
    estimatedCost: 4.50,
    bestTime: 'Morning',
    fitnessGoal: 'Immune Health',
    superfoods: ['Wheatgrass', 'Fresh Ginger'],
    allergens: [],
    category: 'Superfood Greens'
  },
  {
    id: 'green-smoothie-8',
    name: 'Green Protein Power Blend',
    description: 'Plant protein meets nutrient-dense greens',
    primaryGreens: 'Mixed Greens',
    greensContent: ['Spinach', 'Kale', 'Hemp Hearts'],
    flavor: 'Vanilla Green',
    servingSize: '18 oz',
    nutrition: {
      calories: 275,
      protein: 18,
      carbs: 26,
      fat: 12,
      fiber: 10,
      sugar: 14,
      omega_3: 'High',
      complete_protein: true
    },
    ingredients: ['Mixed Greens (2 cups)', 'Vanilla Plant Protein (1 scoop)', 'Hemp Hearts (2 tbsp)', 'Banana (1/2 medium)', 'Almond Butter (1 tbsp)', 'Vanilla Extract (1/2 tsp)', 'Oat Milk (1.5 cups)'],
    benefits: ['Complete Protein', 'Omega Fatty Acids', 'Sustained Energy', 'Muscle Recovery'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 698,
    trending: true,
    featured: true,
    estimatedCost: 5.25,
    bestTime: 'Post-Workout',
    fitnessGoal: 'Muscle Building',
    superfoods: ['Hemp Hearts', 'Plant Protein'],
    allergens: ['Nuts'],
    category: 'Protein Greens'
  }
];

const greensTypes = [
  {
    id: 'spinach',
    name: 'Spinach',
    description: 'Mild flavor, nutrient powerhouse',
    icon: Leaf,
    color: 'text-green-600',
    nutritionHighlights: ['Iron', 'Folate', 'Vitamin K'],
    flavor: 'Very Mild',
    benefits: ['High Iron', 'Folate Rich', 'Versatile', 'Kid-Friendly'],
    bestFor: 'Beginners',
    cost: 'Low',
    seasonality: 'Year-Round'
  },
  {
    id: 'kale',
    name: 'Kale',
    description: 'Superfood with robust nutrition profile',
    icon: TreePine,
    color: 'text-emerald-600',
    nutritionHighlights: ['Vitamin C', 'Vitamin K', 'Antioxidants'],
    flavor: 'Earthy',
    benefits: ['Antioxidant Rich', 'Vitamin C', 'Calcium', 'Fiber'],
    bestFor: 'Nutrition Focus',
    cost: 'Medium',
    seasonality: 'Cool Weather'
  },
  {
    id: 'cucumber',
    name: 'Cucumber',
    description: 'Hydrating and refreshing base',
    icon: Droplets,
    color: 'text-cyan-600',
    nutritionHighlights: ['Hydration', 'Silica', 'Low Calorie'],
    flavor: 'Fresh & Mild',
    benefits: ['Hydrating', 'Low Calorie', 'Cooling', 'Anti-inflammatory'],
    bestFor: 'Hydration & Cleanse',
    cost: 'Low',
    seasonality: 'Summer'
  },
  {
    id: 'superfoods',
    name: 'Superfoods',
    description: 'Spirulina, chlorella, wheatgrass',
    icon: Sparkles,
    color: 'text-purple-600',
    nutritionHighlights: ['Chlorophyll', 'B-Vitamins', 'Protein'],
    flavor: 'Intense',
    benefits: ['Nutrient Dense', 'Detoxifying', 'Energy Boost', 'Alkalizing'],
    bestFor: 'Advanced Users',
    cost: 'High',
    seasonality: 'Year-Round'
  }
];

const greenCategories = [
  {
    id: 'beginner',
    name: 'Beginner-Friendly',
    description: 'Mild greens masked with sweet fruits',
    icon: Heart,
    color: 'bg-pink-500',
    greensLevel: 'Light',
    sweetness: 'High'
  },
  {
    id: 'detox',
    name: 'Detox Powerhouse',
    description: 'Maximum nutrition for cleansing',
    icon: Flame,
    color: 'bg-orange-500',
    greensLevel: 'Heavy',
    sweetness: 'Low'
  },
  {
    id: 'energy',
    name: 'Energy Boosters',
    description: 'Natural caffeine and sustained energy',
    icon: Zap,
    color: 'bg-yellow-500',
    greensLevel: 'Medium',
    sweetness: 'Medium'
  },
  {
    id: 'protein',
    name: 'Protein Enhanced',
    description: 'Greens plus plant protein power',
    icon: Target,
    color: 'bg-blue-500',
    greensLevel: 'Medium',
    sweetness: 'Medium'
  }
];

export default function GreenSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedGreenType, setSelectedGreenType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [greensIntensity, setGreensIntensity] = useState([1]);
  const [maxCalories, setMaxCalories] = useState([400]);
  const [onlySuperfood, setOnlySuperfood] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const getFilteredSmoothies = () => {
    let filtered = greenSmoothies.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGreenType = !selectedGreenType || 
                              smoothie.primaryGreens.toLowerCase().includes(selectedGreenType.toLowerCase());
      const matchesCategory = !selectedCategory || smoothie.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesCalories = smoothie.nutrition.calories <= maxCalories[0];
      const matchesSuperfood = !onlySuperfood || smoothie.superfoods.length > 0;
      
      return matchesSearch && matchesGreenType && matchesCategory && matchesCalories && matchesSuperfood;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'nutrition': return (b.nutrition.fiber + b.nutrition.protein) - (a.nutrition.fiber + a.nutrition.protein);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = greenSmoothies.filter(smoothie => smoothie.featured);

  const handleMakeSmoothie = (smoothie: any) => {
    addToRecentlyViewed({
      id: smoothie.id,
      name: smoothie.name,
      category: 'smoothies',
      description: smoothie.description,
      ingredients: smoothie.ingredients,
      nutrition: smoothie.nutrition,
      difficulty: smoothie.difficulty,
      prepTime: smoothie.prepTime,
      rating: smoothie.rating,
      fitnessGoal: smoothie.fitnessGoal,
      bestTime: smoothie.bestTime
    });
    incrementDrinksMade();
    addPoints(15);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4">
            <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="text-gray-500">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Smoothies
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Leaf className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Green Superfood Smoothies</h1>
                <Badge className="bg-green-100 text-green-800">Detox</Badge>
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
                Share Recipe
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">8.5g</div>
              <div className="text-sm text-gray-600">Avg Fiber</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">210</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">100%</div>
              <div className="text-sm text-gray-600">Natural</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">8</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'greens-guide', label: 'Greens Guide', icon: Leaf },
            { id: 'categories', label: 'Categories', icon: Target },
            { id: 'featured', label: 'Featured', icon: Star }
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
          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search green smoothies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedGreenType}
                  onChange={(e) => setSelectedGreenType(e.target.value)}
                >
                  <option value="">All Greens</option>
                  <option value="Spinach">Spinach</option>
                  <option value="Kale">Kale</option>
                  <option value="Cucumber">Cucumber</option>
                  <option value="Celery">Celery</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="Detox">Detox</option>
                  <option value="Tropical">Tropical</option>
                  <option value="Energy">Energy</option>
                  <option value="Protein">Protein</option>
                </select>
                
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white min-w-[120px]">
                  <span>Max Cal:</span>
                  <Slider
                    value={maxCalories}
                    onValueChange={setMaxCalories}
                    max={400}
                    min={100}
                    step={25}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500">{maxCalories[0]}</span>
                </div>
                
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                  <input
                    type="checkbox"
                    checked={onlySuperfood}
                    onChange={(e) => setOnlySuperfood(e.target.checked)}
                    className="rounded"
                  />
                  Superfood
                </label>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="nutrition">Sort by Nutrition</option>
                  <option value="cost">Sort by Cost</option>
                  <option value="calories">Sort by Calories</option>
                </select>
              </div>
            </div>

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
                          fitnessGoal: smoothie.fitnessGoal,
                          bestTime: smoothie.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-100 text-green-800">{smoothie.primaryGreens}</Badge>
                      <Badge variant="outline">{smoothie.flavor}</Badge>
                      {smoothie.superfoods.length > 0 && <Badge className="bg-purple-100 text-purple-800">Superfood</Badge>}
                      {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
                        <div className="text-gray-500">Fiber</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-purple-600">{smoothie.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-600">${smoothie.estimatedCost}</div>
                        <div className="text-gray-500">Cost</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Greens Content:</h4>
                      <div className="flex flex-wrap gap-1">
                        {smoothie.greensContent.map((green, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {green}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {smoothie.superfoods.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-sm text-gray-700 mb-2">Superfoods:</h4>
                        <div className="flex flex-wrap gap-1">
                          {smoothie.superfoods.map((superfood, index) => (
                            <Badge key={index} className="bg-purple-100 text-purple-800 text-xs">
                              {superfood}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{smoothie.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Prep Time:</span>
                        <span className="font-medium">{smoothie.prepTime} min</span>
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
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleMakeSmoothie(smoothie)}
                      >
                        <Leaf className="h-4 w-4 mr-2" />
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

        {/* Greens Guide Tab */}
        {activeTab === 'greens-guide' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {greensTypes.map(green => {
              const Icon = green.icon;
              const greenSmoothiesCount = greenSmoothies.filter(smoothie => 
                smoothie.primaryGreens.toLowerCase().includes(green.name.toLowerCase())
              );
              
              return (
                <Card key={green.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${green.color}`} />
                      <CardTitle className="text-lg">{green.name}</CardTitle>
                      <p className="text-sm text-gray-600">{green.description}</p>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-center bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Flavor Profile</div>
                        <div className="text-lg font-bold text-green-600">{green.flavor}</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Nutrition Highlights:</h4>
                        <div className="flex flex-wrap gap-1">
                          {green.nutritionHighlights.map((nutrient, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {nutrient}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Benefits:</h4>
                        <div className="flex flex-wrap gap-1">
                          {green.benefits.map((benefit, index) => (
                            <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-blue-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Best For</div>
                          <div className="font-semibold text-blue-600 text-xs">{green.bestFor}</div>
                        </div>
                        <div className="bg-amber-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Cost</div>
                          <div className="font-semibold text-amber-600">{green.cost}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${green.color} mb-1`}>
                        {greenSmoothiesCount.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedGreenType(green.name);
                          setActiveTab('browse');
                        }}
                      >
                        Explore {green.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {greenCategories.map(category => {
              const Icon = category.icon;
              const categorySmoothies = greenSmoothies.filter(smoothie => {
                if (category.id === 'beginner') return smoothie.flavor.includes('Sweet') || smoothie.flavor.includes('Tropical');
                if (category.id === 'detox') return smoothie.category.includes('Detox') || smoothie.category.includes('Cleanse');
                if (category.id === 'energy') return smoothie.category.includes('Energy') || smoothie.superfoods.includes('Matcha');
                if (category.id === 'protein') return smoothie.category.includes('Protein') || smoothie.nutrition.protein >= 15;
                return false;
              });
              
              return (
                <Card key={category.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${category.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-lg`}>
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
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Greens Level:</div>
                        <div className="text-lg font-bold text-green-600">{category.greensLevel}</div>
                      </div>
                      
                      <div className="bg-orange-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Sweetness:</div>
                        <div className="text-sm text-orange-800">{category.sweetness}</div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${category.color.replace('bg-', 'text-')} mb-1`}>
                        {categorySmoothies.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          if (category.id === 'beginner') setSelectedCategory('Tropical');
                          else if (category.id === 'detox') setSelectedCategory('Detox');
                          else if (category.id === 'energy') setSelectedCategory('Energy');
                          else if (category.id === 'protein') setSelectedCategory('Protein');
                          setActiveTab('browse');
                        }}
                      >
                        View {category.name}
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
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img 
                    src={smoothie.image} 
                    alt={smoothie.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop';
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-green-500 text-white">Featured Recipe</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-green-800">{smoothie.nutrition.fiber}g Fiber</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-green-100 text-green-800">{smoothie.primaryGreens}</Badge>
                    <Badge variant="outline">{smoothie.flavor}</Badge>
                    {smoothie.superfoods.length > 0 && <Badge className="bg-purple-100 text-purple-800">Superfood</Badge>}
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{smoothie.rating}</span>
                      <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-green-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
                      <div className="text-xs text-gray-600">Fiber</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">{smoothie.nutrition.protein}g</div>
                      <div className="text-xs text-gray-600">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-600">${smoothie.estimatedCost}</div>
                      <div className="text-xs text-gray-600">Est. Cost</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Greens & Superfoods:</h4>
                    <div className="flex flex-wrap gap-1">
                      {smoothie.greensContent.map((green, index) => (
                        <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                          {green}
                        </Badge>
                      ))}
                      {smoothie.superfoods.map((superfood, index) => (
                        <Badge key={index} className="bg-purple-100 text-purple-800 text-xs">
                          {superfood}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Key Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {smoothie.benefits.map((benefit, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-green-600 font-semibold">{smoothie.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Fitness Goal:</div>
                        <div className="text-blue-600 font-semibold">{smoothie.fitnessGoal}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {smoothie.ingredients.map((ingredient, index) => (
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
                      onClick={() => handleMakeSmoothie(smoothie)}
                    >
                      <Leaf className="h-4 w-4 mr-2" />
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
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="rounded-full w-14 h-14 bg-green-600 hover:bg-green-700 shadow-lg"
          onClick={() => setActiveTab('browse')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Bottom Stats Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">Green Smoothies Found:</span>
              <span className="font-bold text-green-600">{filteredSmoothies.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">Your Level:</span>
              <span className="font-bold text-yellow-600">{userProgress.level}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <span className="text-gray-600">XP:</span>
              <span className="font-bold text-green-600">{userProgress.totalPoints}</span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to Top
          </Button>
        </div>
      </div>
    </div>
  );
}
