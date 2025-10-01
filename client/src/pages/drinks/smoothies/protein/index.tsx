import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Apple, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Milk,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Search, Filter, Shuffle, Camera, Share2, ArrowLeft,
  Activity, BarChart3, Sparkles, Crown, Dumbbell, Banana
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

// High-protein smoothie data
const proteinSmoothies = [
  {
    id: 'protein-smoothie-1',
    name: 'Greek Goddess Berry Blast',
    description: 'Greek yogurt and berries for creamy protein power',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
    primaryProtein: 'Greek Yogurt',
    proteinSources: ['Greek Yogurt', 'Protein Powder', 'Chia Seeds'],
    flavor: 'Mixed Berry',
    servingSize: '16 oz',
    nutrition: {
      calories: 320,
      protein: 28,
      carbs: 35,
      fat: 8,
      fiber: 12,
      sugar: 22,
      calcium: 350
    },
    ingredients: ['Greek Yogurt (1 cup)', 'Mixed Berries (1 cup)', 'Vanilla Protein Powder (1 scoop)', 'Chia Seeds (1 tbsp)', 'Honey (1 tbsp)', 'Almond Milk (1/2 cup)'],
    benefits: ['High Protein', 'Probiotics', 'Antioxidants', 'Sustained Energy'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 1456,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Breakfast',
    fitnessGoal: 'Muscle Building',
    naturalProtein: true,
    allergens: ['Dairy'],
    category: 'Breakfast Smoothies'
  },
  {
    id: 'protein-smoothie-2',
    name: 'Peanut Butter Power Bowl',
    description: 'Creamy peanut butter with banana for natural protein',
    primaryProtein: 'Peanut Butter',
    proteinSources: ['Natural Peanut Butter', 'Greek Yogurt', 'Oats'],
    flavor: 'Peanut Butter Banana',
    servingSize: '18 oz',
    nutrition: {
      calories: 450,
      protein: 24,
      carbs: 42,
      fat: 22,
      fiber: 8,
      sugar: 18,
      potassium: 650
    },
    ingredients: ['Natural Peanut Butter (2 tbsp)', 'Banana (1 large)', 'Greek Yogurt (1/2 cup)', 'Rolled Oats (1/3 cup)', 'Almond Milk (1 cup)', 'Cinnamon (pinch)'],
    benefits: ['Healthy Fats', 'Sustained Energy', 'Heart Health', 'Muscle Recovery'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 1234,
    trending: false,
    featured: true,
    estimatedCost: 3.75,
    bestTime: 'Post-Workout',
    fitnessGoal: 'Weight Gain',
    naturalProtein: true,
    allergens: ['Nuts', 'Dairy'],
    category: 'Recovery Smoothies'
  },
  {
    id: 'protein-smoothie-3',
    name: 'Tropical Cottage Cheese Paradise',
    description: 'Cottage cheese with tropical fruits for casein protein',
    primaryProtein: 'Cottage Cheese',
    proteinSources: ['Low-Fat Cottage Cheese', 'Coconut Flakes'],
    flavor: 'Tropical Mango',
    servingSize: '16 oz',
    nutrition: {
      calories: 280,
      protein: 26,
      carbs: 32,
      fat: 6,
      fiber: 5,
      sugar: 26,
      vitamin_c: 95
    },
    ingredients: ['Low-Fat Cottage Cheese (1/2 cup)', 'Mango Chunks (1 cup)', 'Pineapple (1/2 cup)', 'Coconut Flakes (1 tbsp)', 'Coconut Water (1 cup)', 'Lime Juice (1 tsp)'],
    benefits: ['Casein Protein', 'Tropical Vitamins', 'Digestive Health', 'Hydration'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 892,
    trending: true,
    featured: false,
    estimatedCost: 4.25,
    bestTime: 'Snack',
    fitnessGoal: 'Weight Management',
    naturalProtein: true,
    allergens: ['Dairy'],
    category: 'Tropical Smoothies'
  },
  {
    id: 'protein-smoothie-4',
    name: 'Chocolate Almond Butter Dream',
    description: 'Rich chocolate with almond butter for plant protein',
    primaryProtein: 'Almond Butter',
    proteinSources: ['Almond Butter', 'Cacao Powder', 'Hemp Seeds'],
    flavor: 'Chocolate Almond',
    servingSize: '16 oz',
    nutrition: {
      calories: 380,
      protein: 18,
      carbs: 28,
      fat: 24,
      fiber: 10,
      sugar: 14,
      vitamin_e: 8
    },
    ingredients: ['Almond Butter (2 tbsp)', 'Raw Cacao Powder (2 tbsp)', 'Banana (1 medium)', 'Hemp Seeds (1 tbsp)', 'Almond Milk (1.5 cups)', 'Dates (2 pitted)'],
    benefits: ['Plant Protein', 'Antioxidants', 'Healthy Fats', 'Natural Sweetness'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 678,
    trending: false,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Afternoon',
    fitnessGoal: 'Plant-Based',
    naturalProtein: true,
    allergens: ['Nuts'],
    category: 'Chocolate Smoothies'
  },
  {
    id: 'protein-smoothie-5',
    name: 'Green Goddess Protein',
    description: 'Spinach and avocado with natural protein sources',
    primaryProtein: 'Hemp Hearts',
    proteinSources: ['Hemp Hearts', 'Spirulina', 'Greek Yogurt'],
    flavor: 'Green Apple',
    servingSize: '18 oz',
    nutrition: {
      calories: 295,
      protein: 20,
      carbs: 25,
      fat: 16,
      fiber: 11,
      sugar: 16,
      iron: 4.2
    },
    ingredients: ['Baby Spinach (2 cups)', 'Avocado (1/2 medium)', 'Green Apple (1 medium)', 'Hemp Hearts (3 tbsp)', 'Greek Yogurt (1/3 cup)', 'Coconut Water (1 cup)', 'Lemon Juice (1 tbsp)'],
    benefits: ['Greens Power', 'Healthy Fats', 'Alkalizing', 'Nutrient Dense'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.4,
    reviews: 534,
    trending: true,
    featured: false,
    estimatedCost: 4.75,
    bestTime: 'Morning',
    fitnessGoal: 'Detox',
    naturalProtein: true,
    allergens: ['Dairy'],
    category: 'Green Smoothies'
  },
  {
    id: 'protein-smoothie-6',
    name: 'Vanilla Cashew Cream',
    description: 'Soaked cashews for creamy plant-based protein',
    primaryProtein: 'Cashews',
    proteinSources: ['Raw Cashews', 'Vanilla Protein Powder'],
    flavor: 'Vanilla Bean',
    servingSize: '16 oz',
    nutrition: {
      calories: 420,
      protein: 22,
      carbs: 30,
      fat: 26,
      fiber: 4,
      sugar: 20,
      magnesium: 180
    },
    ingredients: ['Soaked Raw Cashews (1/3 cup)', 'Vanilla Protein Powder (1/2 scoop)', 'Banana (1 medium)', 'Vanilla Extract (1 tsp)', 'Oat Milk (1.5 cups)', 'Maple Syrup (1 tbsp)'],
    benefits: ['Creamy Texture', 'Plant Protein', 'Minerals', 'Sustained Energy'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.3,
    reviews: 445,
    trending: false,
    featured: false,
    estimatedCost: 6.25,
    bestTime: 'Dessert',
    fitnessGoal: 'Plant-Based',
    naturalProtein: true,
    allergens: ['Nuts'],
    category: 'Dessert Smoothies'
  },
  {
    id: 'protein-smoothie-7',
    name: 'Coffee Shop Mocha Boost',
    description: 'Cold brew coffee with protein for morning energy',
    primaryProtein: 'Protein Powder',
    proteinSources: ['Chocolate Protein Powder', 'Greek Yogurt'],
    flavor: 'Mocha Coffee',
    servingSize: '16 oz',
    nutrition: {
      calories: 350,
      protein: 30,
      carbs: 28,
      fat: 12,
      fiber: 6,
      sugar: 18,
      caffeine: 95
    },
    ingredients: ['Cold Brew Coffee (1 cup)', 'Chocolate Protein Powder (1 scoop)', 'Greek Yogurt (1/2 cup)', 'Banana (1/2 medium)', 'Almond Butter (1 tbsp)', 'Ice Cubes'],
    benefits: ['Energy Boost', 'Caffeine', 'High Protein', 'Morning Fuel'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 987,
    trending: true,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Morning',
    fitnessGoal: 'Energy',
    naturalProtein: false,
    allergens: ['Dairy', 'Nuts'],
    category: 'Coffee Smoothies'
  },
  {
    id: 'protein-smoothie-8',
    name: 'Oatmeal Cookie Protein',
    description: 'Oats and spices for a healthy cookie flavor',
    primaryProtein: 'Oats',
    proteinSources: ['Steel-Cut Oats', 'Protein Powder', 'Almond Butter'],
    flavor: 'Oatmeal Cookie',
    servingSize: '18 oz',
    nutrition: {
      calories: 395,
      protein: 25,
      carbs: 45,
      fat: 14,
      fiber: 9,
      sugar: 16,
      beta_glucan: 3
    },
    ingredients: ['Cooked Steel-Cut Oats (1/2 cup)', 'Vanilla Protein Powder (1 scoop)', 'Almond Butter (1 tbsp)', 'Cinnamon (1 tsp)', 'Nutmeg (pinch)', 'Almond Milk (1 cup)', 'Banana (1/2 medium)'],
    benefits: ['Complex Carbs', 'Fiber Rich', 'Heart Health', 'Comfort Food'],
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.5,
    reviews: 623,
    trending: false,
    featured: false,
    estimatedCost: 3.50,
    bestTime: 'Breakfast',
    fitnessGoal: 'Endurance',
    naturalProtein: true,
    allergens: ['Nuts'],
    category: 'Comfort Smoothies'
  }
];

const proteinSources = [
  {
    id: 'greek-yogurt',
    name: 'Greek Yogurt',
    description: 'High protein, probiotics, creamy texture',
    icon: Milk,
    color: 'text-blue-600',
    proteinPer100g: 20,
    benefits: ['Probiotics', 'Calcium', 'Complete Protein', 'Creamy Texture'],
    bestFor: 'Breakfast & Recovery',
    cost: 'Low',
    allergens: ['Dairy']
  },
  {
    id: 'nut-butters',
    name: 'Nut Butters',
    description: 'Natural protein with healthy fats',
    icon: Apple,
    color: 'text-amber-600',
    proteinPer100g: 25,
    benefits: ['Healthy Fats', 'Vitamin E', 'Sustained Energy', 'Natural'],
    bestFor: 'Weight Gain & Satiety',
    cost: 'Medium',
    allergens: ['Nuts']
  },
  {
    id: 'cottage-cheese',
    name: 'Cottage Cheese',
    description: 'Casein protein for slow release',
    icon: Droplets,
    color: 'text-green-600',
    proteinPer100g: 18,
    benefits: ['Casein Protein', 'Low Fat', 'Slow Release', 'Versatile'],
    bestFor: 'Night Time & Satiety',
    cost: 'Low',
    allergens: ['Dairy']
  },
  {
    id: 'seeds-nuts',
    name: 'Seeds & Nuts',
    description: 'Plant protein with minerals',
    icon: Sparkles,
    color: 'text-purple-600',
    proteinPer100g: 15,
    benefits: ['Plant Protein', 'Minerals', 'Fiber', 'Omega Fats'],
    bestFor: 'Plant-Based & Nutrition',
    cost: 'Medium',
    allergens: ['Nuts (varies)']
  }
];

const smoothieCategories = [
  {
    id: 'breakfast',
    name: 'Breakfast Smoothies',
    description: 'Morning fuel with balanced nutrition',
    icon: Crown,
    color: 'bg-yellow-500',
    proteinTarget: '20-25g',
    timing: 'Within 1 hour of waking'
  },
  {
    id: 'recovery',
    name: 'Recovery Smoothies',
    description: 'Post-workout muscle repair',
    icon: Dumbbell,
    color: 'bg-red-500',
    proteinTarget: '25-30g',
    timing: 'Within 30 minutes post-workout'
  },
  {
    id: 'meal-replacement',
    name: 'Meal Replacement',
    description: 'Complete nutrition in a glass',
    icon: Target,
    color: 'bg-blue-500',
    proteinTarget: '20-30g',
    timing: 'Anytime as meal substitute'
  },
  {
    id: 'plant-based',
    name: 'Plant-Based Power',
    description: 'Vegan protein from whole foods',
    icon: Leaf,
    color: 'bg-green-500',
    proteinTarget: '15-25g',
    timing: 'Anytime'
  }
];

export default function HighProteinSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedProteinSource, setSelectedProteinSource] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAllergen, setSelectedAllergen] = useState('');
  const [onlyNaturalProtein, setOnlyNaturalProtein] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const getFilteredSmoothies = () => {
    let filtered = proteinSmoothies.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProteinSource = !selectedProteinSource || 
                                  smoothie.primaryProtein.toLowerCase().includes(selectedProteinSource.toLowerCase());
      const matchesCategory = !selectedCategory || smoothie.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesAllergen = !selectedAllergen || !smoothie.allergens.includes(selectedAllergen);
      const matchesNatural = !onlyNaturalProtein || smoothie.naturalProtein;
      
      return matchesSearch && matchesProteinSource && matchesCategory && matchesAllergen && matchesNatural;
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
  const featuredSmoothies = proteinSmoothies.filter(smoothie => smoothie.featured);

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
    addPoints(20);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50">
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
                <Apple className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">High-Protein Smoothies</h1>
                <Badge className="bg-orange-100 text-orange-800">Natural</Badge>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">23g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">350</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">75%</div>
              <div className="text-sm text-gray-600">Natural Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">8</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'protein-sources', label: 'Protein Sources', icon: Apple },
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
                  placeholder="Search protein smoothies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedProteinSource}
                  onChange={(e) => setSelectedProteinSource(e.target.value)}
                >
                  <option value="">All Protein Sources</option>
                  <option value="Greek Yogurt">Greek Yogurt</option>
                  <option value="Nut Butter">Nut Butters</option>
                  <option value="Cottage Cheese">Cottage Cheese</option>
                  <option value="Seeds">Seeds & Nuts</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Recovery">Recovery</option>
                  <option value="Green">Green</option>
                  <option value="Chocolate">Chocolate</option>
                  <option value="Tropical">Tropical</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedAllergen}
                  onChange={(e) => setSelectedAllergen(e.target.value)}
                >
                  <option value="">Include All</option>
                  <option value="Dairy">Dairy-Free</option>
                  <option value="Nuts">Nut-Free</option>
                </select>
                
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                  <input
                    type="checkbox"
                    checked={onlyNaturalProtein}
                    onChange={(e) => setOnlyNaturalProtein(e.target.checked)}
                    className="rounded"
                  />
                  Natural Only
                </label>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
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
                      <Badge className="bg-orange-100 text-orange-800">{smoothie.primaryProtein}</Badge>
                      <Badge variant="outline">{smoothie.flavor}</Badge>
                      {smoothie.naturalProtein && <Badge className="bg-green-100 text-green-800">Natural</Badge>}
                      {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-orange-600">{smoothie.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
                        <div className="text-gray-500">Fiber</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-600">${smoothie.estimatedCost}</div>
                        <div className="text-gray-500">Cost</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Protein Sources:</h4>
                      <div className="flex flex-wrap gap-1">
                        {smoothie.proteinSources.map((source, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </div>

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
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                        onClick={() => handleMakeSmoothie(smoothie)}
                      >
                        <Apple className="h-4 w-4 mr-2" />
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

        {/* Protein Sources Tab */}
        {activeTab === 'protein-sources' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {proteinSources.map(source => {
              const Icon = source.icon;
              const sourceSmoothies = proteinSmoothies.filter(smoothie => 
                smoothie.primaryProtein.toLowerCase().includes(source.name.toLowerCase().split(' ')[0])
              );
              
              return (
                <Card key={source.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${source.color}`} />
                      <CardTitle className="text-lg">{source.name}</CardTitle>
                      <p className="text-sm text-gray-600">{source.description}</p>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-center bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Protein per 100g</div>
                        <div className="text-2xl font-bold text-orange-600">{source.proteinPer100g}g</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Benefits:</h4>
                        <div className="flex flex-wrap gap-1">
                          {source.benefits.map((benefit, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-blue-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Cost</div>
                          <div className="font-semibold text-blue-600">{source.cost}</div>
                        </div>
                        <div className="bg-red-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Allergens</div>
                          <div className="font-semibold text-red-600 text-xs">{source.allergens.join(', ')}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${source.color} mb-1`}>
                        {sourceSmoothies.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedProteinSource(source.name.split(' ')[0]);
                          setActiveTab('browse');
                        }}
                      >
                        Explore {source.name}
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
            {smoothieCategories.map(category => {
              const Icon = category.icon;
              const categorySmoothies = proteinSmoothies.filter(smoothie => 
                smoothie.category.toLowerCase().includes(category.name.toLowerCase().split(' ')[0])
              );
              
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
                        <div className="text-sm font-medium text-gray-700 mb-1">Protein Target:</div>
                        <div className="text-lg font-bold text-orange-600">{category.proteinTarget}</div>
                      </div>
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Timing:</div>
                        <div className="text-sm text-blue-800">{category.timing}</div>
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
                          setSelectedCategory(category.name.split(' ')[0]);
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
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop';
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-orange-500 text-white">Featured Recipe</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-orange-800">{smoothie.nutrition.protein}g Protein</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-orange-100 text-orange-800">{smoothie.primaryProtein}</Badge>
                    <Badge variant="outline">{smoothie.flavor}</Badge>
                    {smoothie.naturalProtein && <Badge className="bg-green-100 text-green-800">Natural</Badge>}
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{smoothie.rating}</span>
                      <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-orange-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{smoothie.nutrition.protein}g</div>
                      <div className="text-xs text-gray-600">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
                      <div className="text-xs text-gray-600">Fiber</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-600">${smoothie.estimatedCost}</div>
                      <div className="text-xs text-gray-600">Est. Cost</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Protein Sources:</h4>
                    <div className="flex flex-wrap gap-1">
                      {smoothie.proteinSources.map((source, index) => (
                        <Badge key={index} className="bg-blue-100 text-blue-800 text-xs">
                          {source}
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
                        <div className="text-orange-600 font-semibold">{smoothie.bestTime}</div>
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
                          <Apple className="h-3 w-3 text-orange-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleMakeSmoothie(smoothie)}
                    >
                      <Apple className="h-4 w-4 mr-2" />
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
          className="rounded-full w-14 h-14 bg-orange-600 hover:bg-orange-700 shadow-lg"
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
              <Apple className="h-4 w-4 text-orange-600" />
              <span className="text-gray-600">Protein Smoothies Found:</span>
              <span className="font-bold text-orange-600">{filteredSmoothies.length}</span>
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
