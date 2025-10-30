import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles, Clock, Users, Trophy, Heart, Star,
  CheckCircle, Target, Flame, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift,
  Dumbbell, Activity, BarChart3, Shuffle, Camera, Share2,
  FlaskConical, GlassWater, ArrowLeft, Coffee, IceCream,
  X, Wine, ArrowRight, Droplets
} from 'lucide-react';

import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';

const smoothieSubcategories = [
  { id: 'protein', name: 'High-Protein', icon: Zap, count: 24, route: '/drinks/smoothies/protein', description: 'Natural protein for muscle building' },
  { id: 'breakfast', name: 'Breakfast', icon: Coffee, count: 26, route: '/drinks/smoothies/breakfast', description: 'Morning fuel with balanced nutrition' },
  { id: 'workout', name: 'Workout', icon: Dumbbell, count: 22, route: '/drinks/smoothies/workout', description: 'Pre and post-workout energy' },
  { id: 'green', name: 'Green Superfood', icon: Leaf, count: 28, route: '/drinks/smoothies/green', description: 'Nutrient-dense greens and superfoods' },
  { id: 'tropical', name: 'Tropical', icon: Sparkles, count: 18, route: '/drinks/smoothies/tropical', description: 'Island flavors and exotic fruits' },
  { id: 'berry', name: 'Berry', icon: Heart, count: 20, route: '/drinks/smoothies/berry', description: 'Antioxidant-rich berry blends' },
  { id: 'detox', name: 'Detox', icon: GlassWater, count: 16, route: '/drinks/smoothies/detox', description: 'Cleansing and detoxifying blends' },
  { id: 'dessert', name: 'Dessert', icon: IceCream, count: 32, route: '/drinks/smoothies/dessert', description: 'Guilt-free indulgent flavors' }
];

const ingredients = {
  fruits: [
    { name: "Banana", calories: 89, protein: 1.1, carbs: 22.8, fiber: 2.6, icon: "🍌", boost: "potassium" },
    { name: "Strawberry", calories: 32, protein: 0.7, carbs: 7.7, fiber: 2.0, icon: "🍓", boost: "vitamin-c" },
    { name: "Blueberry", calories: 57, protein: 0.7, carbs: 14.5, fiber: 2.4, icon: "🫐", boost: "antioxidants" },
    { name: "Mango", calories: 60, protein: 0.8, carbs: 15.0, fiber: 1.6, icon: "🥭", boost: "vitamin-a" },
    { name: "Pineapple", calories: 50, protein: 0.5, carbs: 13.1, fiber: 1.4, icon: "🍍", boost: "bromelain" }
  ],
  vegetables: [
    { name: "Spinach", calories: 7, protein: 0.9, carbs: 1.1, fiber: 0.7, icon: "🥬", boost: "iron" },
    { name: "Kale", calories: 8, protein: 0.6, carbs: 1.4, fiber: 0.6, icon: "🥬", boost: "vitamin-k" },
    { name: "Carrot", calories: 10, protein: 0.2, carbs: 2.3, fiber: 0.7, icon: "🥕", boost: "beta-carotene" },
    { name: "Beetroot", calories: 13, protein: 0.4, carbs: 2.8, fiber: 0.8, icon: "🟣", boost: "nitrates" }
  ],
  liquids: [
    { name: "Almond Milk", calories: 15, protein: 0.6, carbs: 0.6, fiber: 0.3, icon: "🥛", boost: "calcium" },
    { name: "Coconut Water", calories: 19, protein: 0.7, carbs: 3.7, fiber: 1.1, icon: "🥥", boost: "electrolytes" },
    { name: "Greek Yogurt", calories: 59, protein: 10.0, carbs: 3.6, fiber: 0, icon: "🥛", boost: "probiotics" },
    { name: "Oat Milk", calories: 16, protein: 0.3, carbs: 1.9, fiber: 0.7, icon: "🥛", boost: "fiber" }
  ],
  boosters: [
    { name: "Protein Powder", calories: 120, protein: 25.0, carbs: 2.0, fiber: 1.0, icon: "💪", boost: "muscle-building" },
    { name: "Chia Seeds", calories: 58, protein: 2.0, carbs: 5.1, fiber: 4.9, icon: "🌰", boost: "omega-3" },
    { name: "Flax Seeds", calories: 55, protein: 1.9, carbs: 3.0, fiber: 2.8, icon: "🌰", boost: "lignans" },
    { name: "Spirulina", calories: 4, protein: 0.8, carbs: 0.2, fiber: 0.1, icon: "🟢", boost: "chlorophyll" }
  ]
};

const workoutGoals = [
  { id: 'pre-workout', name: 'Pre-Workout Energy', icon: '⚡', color: 'bg-orange-500', focus: 'carbs' },
  { id: 'post-workout', name: 'Post-Workout Recovery', icon: '💪', color: 'bg-blue-500', focus: 'protein' },
  { id: 'weight-loss', name: 'Weight Loss', icon: '🔥', color: 'bg-red-500', focus: 'low-cal' },
  { id: 'muscle-gain', name: 'Muscle Building', icon: '🏋️', color: 'bg-green-500', focus: 'protein' },
  { id: 'endurance', name: 'Endurance', icon: '🏃', color: 'bg-purple-500', focus: 'electrolytes' },
  { id: 'recovery', name: 'Recovery', icon: '😌', color: 'bg-pink-500', focus: 'antioxidants' }
];

const premadeRecipes = [
  {
    id: 1,
    name: "Green Goddess Power",
    ingredients: ["Spinach", "Banana", "Mango", "Coconut Water", "Chia Seeds"],
    calories: 245,
    protein: 8.2,
    difficulty: "Easy",
    time: "3 min",
    rating: 4.8,
    likes: 1247,
    workoutType: "pre-workout",
    image: "https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop"
  },
  {
    id: 2,
    name: "Chocolate Protein Beast",
    ingredients: ["Banana", "Protein Powder", "Almond Milk", "Flax Seeds"],
    calories: 320,
    protein: 28.5,
    difficulty: "Easy", 
    time: "2 min",
    rating: 4.9,
    likes: 2156,
    workoutType: "post-workout",
    image: "https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=400&h=300&fit=crop"
  },
  {
    id: 3,
    name: "Berry Antioxidant Blast",
    ingredients: ["Blueberry", "Strawberry", "Greek Yogurt", "Spirulina"],
    calories: 180,
    protein: 12.8,
    difficulty: "Medium",
    time: "4 min", 
    rating: 4.7,
    likes: 892,
    workoutType: "recovery",
    image: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop"
  }
];

const dailyChallenge = {
  name: "Green Machine Monday",
  description: "Create a smoothie with at least 3 green ingredients",
  progress: 2,
  goal: 3,
  participants: 3247,
  reward: "Green Warrior Badge + 200 XP",
  timeLeft: "18h 42m"
};

export default function SmoothiesPage() {
  const { 
    userProgress, 
    addPoints, 
    incrementDrinksMade, 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    favorites
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('create');
  const [selectedGoal, setSelectedGoal] = useState(workoutGoals[0]);
  const [customSmoothie, setCustomSmoothie] = useState({
    ingredients: [],
    calories: 0,
    protein: 0,
    carbs: 0,
    fiber: 0
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const addIngredient = (ingredient, category) => {
    const newIngredient = { ...ingredient, category, id: Date.now() };
    const newIngredients = [...customSmoothie.ingredients, newIngredient];
    
    setCustomSmoothie({
      ingredients: newIngredients,
      calories: newIngredients.reduce((sum, ing) => sum + ing.calories, 0),
      protein: newIngredients.reduce((sum, ing) => sum + ing.protein, 0),
      carbs: newIngredients.reduce((sum, ing) => sum + ing.carbs, 0),
      fiber: newIngredients.reduce((sum, ing) => sum + ing.fiber, 0)
    });
  };

  const removeIngredient = (ingredientId) => {
    const newIngredients = customSmoothie.ingredients.filter(ing => ing.id !== ingredientId);
    setCustomSmoothie({
      ingredients: newIngredients,
      calories: newIngredients.reduce((sum, ing) => sum + ing.calories, 0),
      protein: newIngredients.reduce((sum, ing) => sum + ing.protein, 0),
      carbs: newIngredients.reduce((sum, ing) => sum + ing.carbs, 0),
      fiber: newIngredients.reduce((sum, ing) => sum + ing.fiber, 0)
    });
  };

  const createSmoothie = async () => {
    if (customSmoothie.ingredients.length >= 3) {
      try {
        const response = await fetch('/api/custom-drinks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Custom ${selectedGoal.name} Smoothie`,
            category: 'smoothies',
            drinkType: selectedGoal.id,
            ingredients: customSmoothie.ingredients,
            calories: Math.round(customSmoothie.calories),
            protein: Math.round(customSmoothie.protein * 10) / 10,
            carbs: Math.round(customSmoothie.carbs * 10) / 10,
            fiber: Math.round(customSmoothie.fiber * 10) / 10,
            fat: 2,
            fitnessGoal: selectedGoal.name,
            difficulty: 'Custom',
            prepTime: 5,
            rating: 5,
            isPublic: false
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save smoothie');
        }

        const result = await response.json();
        const savedDrink = result.drink;

        addToRecentlyViewed(savedDrink);
        incrementDrinksMade();
        addPoints(150);

        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setCustomSmoothie({
            ingredients: [],
            calories: 0,
            protein: 0,
            carbs: 0,
            fiber: 0
          });
        }, 3000);
      } catch (error) {
        console.error('Failed to save smoothie:', error);
        alert('Failed to save smoothie. Please try again.');
      }
    }
  };

  const makePremadeRecipe = async (recipe) => {
    try {
      const response = await fetch('/api/custom-drinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: recipe.name,
          category: 'smoothies',
          drinkType: recipe.workoutType,
          ingredients: recipe.ingredients.map(name => ({
            name,
            category: 'ingredient',
            calories: 0,
            protein: 0,
            carbs: 0,
            fiber: 0,
            icon: '🥤'
          })),
          calories: recipe.calories,
          protein: recipe.protein,
          carbs: Math.round(recipe.calories * 0.6 / 4),
          fiber: 2,
          fat: 3,
          fitnessGoal: recipe.workoutType,
          difficulty: recipe.difficulty,
          prepTime: parseInt(recipe.time),
          rating: recipe.rating,
          isPublic: false
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save recipe');
      }

      const result = await response.json();
      const savedDrink = result.drink;

      addToRecentlyViewed(savedDrink);
      incrementDrinksMade();
      addPoints(100);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save recipe:', error);
      alert('Failed to save recipe. Please try again.');
    }
  };

  const randomizeSmoothie = () => {
    const randomFruit = ingredients.fruits[Math.floor(Math.random() * ingredients.fruits.length)];
    const randomLiquid = ingredients.liquids[Math.floor(Math.random() * ingredients.liquids.length)];
    const randomVeggie = ingredients.vegetables[Math.floor(Math.random() * ingredients.vegetables.length)];
    
    const randomIngredients = [
      { ...randomFruit, category: 'fruits', id: Date.now() + 1 },
      { ...randomLiquid, category: 'liquids', id: Date.now() + 2 },
      { ...randomVeggie, category: 'vegetables', id: Date.now() + 3 }
    ];

    setCustomSmoothie({
      ingredients: randomIngredients,
      calories: randomIngredients.reduce((sum, ing) => sum + ing.calories, 0),
      protein: randomIngredients.reduce((sum, ing) => sum + ing.protein, 0),
      carbs: randomIngredients.reduce((sum, ing) => sum + ing.carbs, 0),
      fiber: randomIngredients.reduce((sum, ing) => sum + ing.fiber, 0)
    });
  };

  const handleTakePhoto = async () => {
    setShowCamera(true);
    
    setTimeout(async () => {
      setShowCamera(false);
      
      if (customSmoothie.ingredients.length >= 3) {
        alert('Photo feature coming soon! This would upload your smoothie photo.');
        addPoints(50);
      } else {
        alert('Create a smoothie first, then add a photo!');
      }
    }, 2000);
  };

  const handleShare = async () => {
    setShowShare(true);
    
    const shareData = {
      title: `My Custom ${selectedGoal.name} Smoothie`,
      text: `Check out my smoothie with ${customSmoothie.ingredients.length} ingredients!`,
      url: window.location.href
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        addPoints(25);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setTimeout(() => {
          setShowShare(false);
          alert('Link copied to clipboard!');
        }, 1000);
        addPoints(25);
      }
    } catch (error) {
      console.error('Share failed:', error);
    } finally {
      setShowShare(false);
    }
  };

  const handleDrinkSelection = (drink) => {
    console.log('Selected drink from universal search:', drink);
    addToRecentlyViewed(drink);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white p-8 rounded-3xl shadow-2xl animate-bounce">
            <div className="text-center">
              <Sparkles className="w-20 h-20 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Smoothie Created!</h2>
              <p className="text-xl">+{customSmoothie.ingredients.length >= 3 ? '150' : '100'} XP earned!</p>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-white text-center">
            <Camera className="w-24 h-24 mx-auto mb-4 animate-pulse" />
            <p className="text-2xl">Opening camera...</p>
          </div>
        </div>
      )}

      {showShare && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-white text-center">
            <Share2 className="w-24 h-24 mx-auto mb-4 animate-pulse" />
            <p className="text-2xl">Preparing to share...</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
        
        {/* HERO SECTION */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white py-12 px-6 rounded-xl shadow-2xl">
          <div className="max-w-7xl mx-auto">
            <Link href="/drinks">
              <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Drinks Hub
              </Button>
            </Link>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
                <Apple className="h-12 w-12" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Smoothie Studio</h1>
                <p className="text-xl text-purple-100">Craft the perfect smoothie for your fitness goals</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Apple className="h-8 w-8 mx-auto mb-2 text-pink-300" />
                  <div className="text-2xl font-bold">182</div>
                  <div className="text-sm text-purple-100">Total Recipes</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Flame className="h-8 w-8 mx-auto mb-2 text-orange-300" />
                  <div className="text-2xl font-bold">245</div>
                  <div className="text-sm text-purple-100">Avg Calories</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Heart className="h-8 w-8 mx-auto mb-2 text-red-300" />
                  <div className="text-2xl font-bold">{favorites.length}</div>
                  <div className="text-sm text-purple-100">Favorites</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                  <div className="text-2xl font-bold">{userProgress.currentStreak}</div>
                  <div className="text-sm text-purple-100">Day Streak</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Cross-Hub Navigation */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <GlassWater className="h-6 w-6 text-purple-600" />
              Explore Other Drink Categories
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/drinks/protein-shakes">
                <Button
                  variant="outline"
                  className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:bg-white hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <Dumbbell className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-base">Protein Shakes</div>
                      <div className="text-xs text-gray-600">Build muscle & recover</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="text-xs text-gray-500 ml-11">98 recipes</div>
                </Button>
              </Link>
              <Link href="/drinks/detoxes">
                <Button
                  variant="outline"
                  className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:bg-white hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="p-2 bg-green-600 rounded-lg">
                      <Droplets className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-base">Detox Drinks</div>
                      <div className="text-xs text-gray-600">Cleanse & refresh</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="text-xs text-gray-500 ml-11">26 recipes</div>
                </Button>
              </Link>
              <Link href="/drinks/caffeinated">
                <Button
                  variant="outline"
                  className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:bg-white hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="p-2 bg-amber-600 rounded-lg">
                      <Coffee className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-base">Caffeinated Drinks</div>
                      <div className="text-xs text-gray-600">Coffee, tea & energy drinks</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="text-xs text-gray-500 ml-11">186 recipes</div>
                </Button>
              </Link>
              <Link href="/drinks/potent-potables">
                <Button
                  variant="outline"
                  className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:bg-white hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="p-2 bg-purple-600 rounded-lg">
                      <Wine className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-base">Potent Potables</div>
                      <div className="text-xs text-gray-600">Cocktails & mocktails</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="text-xs text-gray-500 ml-11">168 recipes</div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Universal Search */}
        <div className="max-w-2xl mx-auto">
          <UniversalSearch 
            onSelectDrink={handleDrinkSelection}
            placeholder="Search all drinks or find smoothie inspiration..."
            className="w-full"
          />
        </div>

        {/* Smoothie Subcategories - ALL 8 */}
        <Card className="bg-gradient-to-r from-green-50 to-purple-50 border-green-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Apple className="w-5 h-5 text-green-500" />
              Explore Smoothie Types
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {smoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.route}>
                    <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-green-400">
                      <CardContent className="p-4 text-center">
                        <Icon className="h-8 w-8 mx-auto mb-2 text-green-600" />
                        <div className="font-medium text-sm mb-1">{subcategory.name}</div>
                        <div className="text-xs text-gray-500">{subcategory.count} recipes</div>
                        <div className="text-xs text-gray-400 mt-2">{subcategory.description}</div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Daily Challenge */}
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-6 h-6" />
                  <h3 className="text-2xl font-bold">{dailyChallenge.name}</h3>
                </div>
                <p className="text-blue-100 mb-4">{dailyChallenge.description}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {dailyChallenge.participants.toLocaleString()} participating
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {dailyChallenge.timeLeft} left
                  </span>
                </div>
              </div>
              <div className="text-right">
                <Badge className="bg-yellow-400 text-yellow-900 mb-2">
                  <Award className="w-3 h-3 mr-1" />
                  Reward
                </Badge>
                <div className="text-sm">{dailyChallenge.reward}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress: {dailyChallenge.progress}/{dailyChallenge.goal}</span>
                <span>{Math.round((dailyChallenge.progress / dailyChallenge.goal) * 100)}%</span>
              </div>
              <Progress value={(dailyChallenge.progress / dailyChallenge.goal) * 100} className="h-3 bg-blue-300" />
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b">
          <Button
            variant={activeTab === 'create' ? 'default' : 'ghost'}
            className={activeTab === 'create' ? 'bg-purple-600' : ''}
            onClick={() => setActiveTab('create')}
          >
            <ChefHat className="w-4 h-4 mr-2" />
            Create Custom
          </Button>
          <Button
            variant={activeTab === 'browse' ? 'default' : 'ghost'}
            className={activeTab === 'browse' ? 'bg-purple-600' : ''}
            onClick={() => setActiveTab('browse')}
          >
            <Trophy className="w-4 h-4 mr-2" />
            Popular Recipes
          </Button>
        </div>

        {/* CREATE TAB */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            {/* Goal Selection */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Choose Your Fitness Goal
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {workoutGoals.map((goal) => (
                    <Button
                      key={goal.id}
                      variant={selectedGoal.id === goal.id ? 'default' : 'outline'}
                      className={`h-auto p-4 ${selectedGoal.id === goal.id ? goal.color + ' text-white' : ''}`}
                      onClick={() => setSelectedGoal(goal)}
                    >
                      <div className="text-center w-full">
                        <div className="text-2xl mb-2">{goal.icon}</div>
                        <div className="font-medium">{goal.name}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Ingredient Builder */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Apple className="w-5 h-5 text-red-500" />
                      Select Ingredients
                    </h3>
                    <Button size="sm" variant="outline" onClick={randomizeSmoothie}>
                      <Shuffle className="w-4 h-4 mr-2" />
                      Randomize
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-gray-600">Fruits</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {ingredients.fruits.map((fruit) => (
                          <Button
                            key={fruit.name}
                            size="sm"
                            variant="outline"
                            onClick={() => addIngredient(fruit, 'fruits')}
                            className="justify-start"
                          >
                            <span className="mr-2">{fruit.icon}</span>
                            {fruit.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-gray-600">Vegetables</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {ingredients.vegetables.map((veg) => (
                          <Button
                            key={veg.name}
                            size="sm"
                            variant="outline"
                            onClick={() => addIngredient(veg, 'vegetables')}
                            className="justify-start"
                          >
                            <span className="mr-2">{veg.icon}</span>
                            {veg.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-gray-600">Liquids</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {ingredients.liquids.map((liquid) => (
                          <Button
                            key={liquid.name}
                            size="sm"
                            variant="outline"
                            onClick={() => addIngredient(liquid, 'liquids')}
                            className="justify-start"
                          >
                            <span className="mr-2">{liquid.icon}</span>
                            {liquid.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-gray-600">Boosters</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {ingredients.boosters.map((booster) => (
                          <Button
                            key={booster.name}
                            size="sm"
                            variant="outline"
                            onClick={() => addIngredient(booster, 'boosters')}
                            className="justify-start"
                          >
                            <span className="mr-2">{booster.icon}</span>
                            {booster.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Custom Smoothie Preview */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Your Custom Smoothie
                  </h3>

                  <div className="mb-4 space-y-2">
                    {customSmoothie.ingredients.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Apple className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Start adding ingredients to create your smoothie</p>
                      </div>
                    ) : (
                      customSmoothie.ingredients.map((ing) => (
                        <div key={ing.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{ing.icon}</span>
                            <div>
                              <div className="font-medium">{ing.name}</div>
                              <div className="text-xs text-gray-600">
                                {ing.calories} cal • {ing.protein}g protein
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeIngredient(ing.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  {customSmoothie.ingredients.length > 0 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {Math.round(customSmoothie.calories)}
                          </div>
                          <div className="text-xs text-gray-600">Calories</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {Math.round(customSmoothie.protein * 10) / 10}g
                          </div>
                          <div className="text-xs text-gray-600">Protein</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {Math.round(customSmoothie.carbs * 10) / 10}g
                          </div>
                          <div className="text-xs text-gray-600">Carbs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {Math.round(customSmoothie.fiber * 10) / 10}g
                          </div>
                          <div className="text-xs text-gray-600">Fiber</div>
                        </div>
                      </div>

                      <Button
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        size="lg"
                        onClick={createSmoothie}
                        disabled={customSmoothie.ingredients.length < 3}
                      >
                        {customSmoothie.ingredients.length < 3 ? (
                          <>
                            <Target className="w-5 h-5 mr-2" />
                            Add {3 - customSmoothie.ingredients.length} more ingredients
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            Create Smoothie (+150 XP)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* BROWSE TAB */}
        {activeTab === 'browse' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  Popular Smoothie Recipes
                </h3>
                <div className="grid md:grid-cols-3 gap-6">
                  {premadeRecipes.map((recipe) => (
                    <Card key={recipe.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                      <div className="relative h-48">
                        <img
                          src={recipe.image}
                          alt={recipe.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-white text-gray-900">
                            <Star className="w-3 h-3 mr-1 text-yellow-400 fill-current" />
                            {recipe.rating}
                          </Badge>
                        </div>
                      </div>
                      
                      <CardContent className="p-4">
                        <h4 className="font-bold text-lg mb-2">{recipe.name}</h4>
                        
                        <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {recipe.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-4 h-4" />
                            {recipe.likes}
                          </span>
                        </div>

                        <div className="mb-3">
                          <div className="text-sm font-medium mb-2">Ingredients:</div>
                          <div className="flex flex-wrap gap-1">
                            {recipe.ingredients.map((ing, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {ing}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                          <div className="text-center">
                            <div className="text-lg font-bold text-orange-600">
                              {recipe.calories}
                            </div>
                            <div className="text-xs text-gray-600">Calories</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">
                              {recipe.protein}g
                            </div>
                            <div className="text-xs text-gray-600">Protein</div>
                          </div>
                        </div>

                        <Button
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                          onClick={() => makePremadeRecipe(recipe)}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Make It
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Share CTA */}
        <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <Gift className="w-16 h-16 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Share Your Creation!</h3>
            <p className="text-purple-100 mb-6">
              Post your custom smoothies to inspire others and earn bonus XP
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="secondary" size="lg" onClick={handleTakePhoto}>
                <Camera className="w-5 h-5 mr-2" />
                Take Photo
              </Button>
              <Button variant="secondary" size="lg" onClick={handleShare}>
                <Share2 className="w-5 h-5 mr-2" />
                Share Recipe
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
