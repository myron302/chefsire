import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Dumbbell, Activity, BarChart3, Shuffle, Camera, Share2
} from 'lucide-react';

type Params = { params?: Record<string, string> };

// Mock smoothie ingredients database
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

const userStats = {
  level: 15,
  xp: 2890,
  streak: 12,
  smoothiesMade: 47,
  caloriesSaved: 15420,
  workoutsEnhanced: 23
};

export default function SmoothiesPage({ params }: Params) {
  const type = params?.type?.replaceAll("-", " ");
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
  const [createdSmoothie, setCreatedSmoothie] = useState(null);

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

  const createSmoothie = () => {
    if (customSmoothie.ingredients.length >= 3) {
      setCreatedSmoothie(customSmoothie);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      
      {/* Success Animation */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white p-8 rounded-3xl shadow-2xl animate-bounce">
            <div className="text-center">
              <Sparkles className="w-20 h-20 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Smoothie Created! 🥤</h2>
              <p className="text-xl">+150 XP earned!</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
        
        {/* Header with User Stats */}
        <div className="text-center relative">
          <div className="absolute top-0 right-0 bg-white rounded-2xl p-4 shadow-lg border">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="font-bold">Level {userStats.level}</span>
                </div>
                <div className="text-xs text-gray-600">{userStats.xp} XP</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="font-bold">{userStats.streak}</span>
                </div>
                <div className="text-xs text-gray-600">day streak</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Dumbbell className="w-4 h-4 text-purple-500" />
                  <span className="font-bold">{userStats.workoutsEnhanced}</span>
                </div>
                <div className="text-xs text-gray-600">workouts</div>
              </div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Smoothie Creation Studio 🥤
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Craft the perfect smoothie for your fitness goals and taste preferences
          </p>
          
          {type && (
            <Badge className="mb-4 text-lg px-4 py-2 bg-purple-100 text-purple-800">
              {type}
            </Badge>
          )}
        </div>

        {/* Daily Challenge Banner */}
        <Card className="bg-gradient-to-r from-green-500 to-teal-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Target className="w-6 h-6" />
                  {dailyChallenge.name}
                </h3>
                <p className="text-green-100 mb-3">{dailyChallenge.description}</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Timer className="w-4 h-4" />
                    <span>{dailyChallenge.timeLeft} left</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{dailyChallenge.participants.toLocaleString()} participating</span>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-2">{dailyChallenge.progress}/{dailyChallenge.goal}</div>
                <Progress value={(dailyChallenge.progress / dailyChallenge.goal) * 100} className="w-32 mb-3" />
                <div className="text-sm">🎁 {dailyChallenge.reward}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white p-1 rounded-2xl shadow-lg flex gap-1">
            {[
              { id: 'create', label: '🧪 Create Custom', icon: Plus },
              { id: 'recipes', label: '📋 Popular Recipes', icon: Star },
              { id: 'workout', label: '💪 Workout Goals', icon: Dumbbell }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Creation Tab */}
        {activeTab === 'create' && (
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Ingredient Selection */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Workout Goal Selection */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-500" />
                    Choose Your Goal
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {workoutGoals.map((goal) => (
                      <button
                        key={goal.id}
                        onClick={() => setSelectedGoal(goal)}
                        className={`p-3 rounded-lg transition-all text-left ${
                          selectedGoal.id === goal.id 
                            ? `${goal.color} text-white shadow-lg scale-105` 
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                        }`}
                      >
                        <div className="text-2xl mb-1">{goal.icon}</div>
                        <div className="font-bold text-sm">{goal.name}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Ingredient Categories */}
              {Object.entries(ingredients).map(([category, items]) => (
                <Card key={category}>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold mb-4 capitalize flex items-center gap-2">
                      <ChefHat className="w-5 h-5 text-orange-500" />
                      {category}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {items.map((ingredient) => (
                        <button
                          key={ingredient.name}
                          onClick={() => addIngredient(ingredient, category)}
                          className="p-3 bg-gray-50 hover:bg-purple-50 rounded-lg transition-all hover:scale-105 text-left"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{ingredient.icon}</span>
                            <span className="font-bold text-sm">{ingredient.name}</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {ingredient.calories} cal • {ingredient.protein}g protein
                          </div>
                          <Badge className="mt-1 text-xs">{ingredient.boost}</Badge>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Smoothie Builder */}
            <div className="space-y-6">
              <Card className="sticky top-4">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Your Smoothie</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={randomizeSmoothie}
                      className="flex items-center gap-1"
                    >
                      <Shuffle className="w-4 h-4" />
                      Randomize
                    </Button>
                  </div>
                  
                  {/* Current Ingredients */}
                  <div className="space-y-2 mb-4">
                    {customSmoothie.ingredients.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        Add ingredients to build your smoothie
                      </p>
                    ) : (
                      customSmoothie.ingredients.map((ingredient) => (
                        <div key={ingredient.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <span>{ingredient.icon}</span>
                            <span className="text-sm font-medium">{ingredient.name}</span>
                          </div>
                          <button
                            onClick={() => removeIngredient(ingredient.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Nutrition Info */}
                  {customSmoothie.ingredients.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-4 rounded-lg mb-4">
                      <h4 className="font-bold mb-2 text-purple-800">Nutrition Facts</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Calories: <span className="font-bold">{Math.round(customSmoothie.calories)}</span></div>
                        <div>Protein: <span className="font-bold">{Math.round(customSmoothie.protein * 10) / 10}g</span></div>
                        <div>Carbs: <span className="font-bold">{Math.round(customSmoothie.carbs * 10) / 10}g</span></div>
                        <div>Fiber: <span className="font-bold">{Math.round(customSmoothie.fiber * 10) / 10}g</span></div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button 
                      onClick={createSmoothie}
                      disabled={customSmoothie.ingredients.length < 3}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      Create Smoothie (+150 XP)
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Camera className="w-4 h-4 mr-1" />
                        Photo
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Share2 className="w-4 h-4 mr-1" />
                        Share
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Popular Recipes Tab */}
        {activeTab === 'recipes' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {premadeRecipes.map((recipe) => (
              <Card key={recipe.id} className="overflow-hidden hover:shadow-xl transition-all hover:scale-105">
                <div className="relative">
                  <img 
                    src={recipe.image} 
                    alt={recipe.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-2 left-2">
                    <Badge className="bg-purple-500 text-white">
                      {recipe.workoutType.replace('-', ' ')}
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 backdrop-blur-lg rounded-full px-2 py-1 flex items-center gap-1">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span className="text-white text-sm">{recipe.likes}</span>
                  </div>
                </div>

                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold">{recipe.name}</h3>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-bold">{recipe.rating}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-orange-600">{recipe.calories}</div>
                      <div className="text-xs text-gray-600">calories</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-blue-600">{recipe.protein}g</div>
                      <div className="text-xs text-gray-600">protein</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-600">{recipe.time}</div>
                      <div className="text-xs text-gray-600">prep time</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 text-sm">Ingredients:</h4>
                    <div className="flex flex-wrap gap-1">
                      {recipe.ingredients.map((ingredient, index) => (
                        <span key={index} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                    Make This (+100 XP)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Workout Goals Tab */}
        {activeTab === 'workout' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workoutGoals.map((goal) => (
              <Card key={goal.id} className={`${goal.color} text-white overflow-hidden hover:scale-105 transition-all`}>
                <CardContent className="p-6 text-center">
                  <div className="text-6xl mb-4">{goal.icon}</div>
                  <h3 className="text-2xl font-bold mb-3">{goal.name}</h3>
                  <p className="mb-4 opacity-90">
                    Optimized recipes focusing on {goal.focus}
                  </p>
                  <Button variant="secondary" className="bg-white text-gray-800 hover:bg-gray-100">
                    View Recipes
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Dumbbell, Activity, BarChart3, Shuffle, Camera, Share2,
  Search, ArrowRight, Coffee, IceCream, X
} from 'lucide-react';

import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';

type Params = { params?: Record<string, string> };

const smoothieSubcategories = [
  { id: 'protein', name: 'High-Protein', icon: Zap, count: 24, route: '/drinks/smoothies/protein', description: 'Natural protein for muscle building' },
  { id: 'green', name: 'Green Superfood', icon: Leaf, count: 28, route: '/drinks/smoothies/green', description: 'Nutrient-dense greens and superfoods' },
  { id: 'dessert', name: 'Dessert', icon: IceCream, count: 32, route: '/drinks/smoothies/dessert', description: 'Guilt-free indulgent flavors' },
  { id: 'breakfast', name: 'Breakfast', icon: Coffee, count: 26, route: '/drinks/smoothies/breakfast', description: 'Morning fuel with balanced nutrition' },
  { id: 'workout', name: 'Workout', icon: Dumbbell, count: 22, route: '/drinks/smoothies/workout', description: 'Pre and post-workout energy' }
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

export default function SmoothiesPage({ params }: Params) {
  const { 
    userProgress, 
    addPoints, 
    incrementDrinksMade, 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    favorites
  } = useDrinks();

  const type = params?.type?.replaceAll("-", " ");
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
  const [createdSmoothie, setCreatedSmoothie] = useState(null);

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

  const createSmoothie = () => {
    if (customSmoothie.ingredients.length >= 3) {
      const smoothieData = {
        id: `custom-${Date.now()}`,
        name: `Custom ${selectedGoal.name} Smoothie`,
        category: 'smoothies' as const,
        description: `Custom blend with ${customSmoothie.ingredients.length} ingredients`,
        ingredients: customSmoothie.ingredients.map(ing => ing.name),
        nutrition: {
          calories: Math.round(customSmoothie.calories),
          protein: Math.round(customSmoothie.protein * 10) / 10,
          carbs: Math.round(customSmoothie.carbs * 10) / 10,
          fat: 2
        },
        difficulty: 'Custom' as const,
        prepTime: 5,
        rating: 5,
        fitnessGoal: selectedGoal.name,
        bestTime: selectedGoal.id.includes('pre') ? 'Pre-workout' : 'Post-workout'
      };

      setCreatedSmoothie(customSmoothie);
      setShowSuccess(true);
      
      addToRecentlyViewed(smoothieData);
      incrementDrinksMade();
      addPoints(150);
      
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const makePremadeRecipe = (recipe) => {
    const smoothieData = {
      id: `recipe-${recipe.id}`,
      name: recipe.name,
      category: 'smoothies' as const,
      description: `Popular recipe with ${recipe.rating}★ rating`,
      ingredients: recipe.ingredients,
      nutrition: {
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: Math.round(recipe.calories * 0.6 / 4),
        fat: 3
      },
      difficulty: recipe.difficulty as 'Easy' | 'Medium' | 'Hard',
      prepTime: parseInt(recipe.time),
      rating: recipe.rating,
      fitnessGoal: recipe.workoutType,
      bestTime: recipe.workoutType.includes('pre') ? 'Pre-workout' : 'Post-workout'
    };

    addToRecentlyViewed(smoothieData);
    incrementDrinksMade();
    addPoints(100);
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
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

  const handleDrinkSelection = (drink) => {
    console.log('Selected drink from universal search:', drink);
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

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
        
        {/* Header with User Stats */}
        <div className="text-center relative">
          <div className="absolute top-0 right-0 bg-white rounded-2xl p-4 shadow-lg border">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="font-bold">Level {userProgress.level}</span>
                </div>
                <div className="text-xs text-gray-600">{userProgress.totalPoints} XP</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="font-bold">{userProgress.currentStreak}</span>
                </div>
                <div className="text-xs text-gray-600">day streak</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Dumbbell className="w-4 h-4 text-purple-500" />
                  <span className="font-bold">{userProgress.totalDrinksMade}</span>
                </div>
                <div className="text-xs text-gray-600">drinks made</div>
              </div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Smoothie Creation Studio
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Craft the perfect smoothie for your fitness goals and taste preferences
          </p>
          
          {type && (
            <Badge className="mb-4 text-lg px-4 py-2 bg-purple-100 text-purple-800">
              {type}
            </Badge>
          )}
        </div>

        {/* Universal Search */}
        <div className="max-w-2xl mx-auto mb-8">
          <UniversalSearch 
            onSelectDrink={handleDrinkSelection}
            placeholder="Search all drinks or find smoothie inspiration..."
            className="w-full"
          />
        </div>

        {/* Smoothie Subcategories Navigation */}
        <Card className="bg-gradient-to-r from-green-50 to-purple-50 border-green-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Apple className="w-5 h-5 text-green-500" />
              Explore Smoothie Types
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {smoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Button
                    key={subcategory.id}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-2 hover:bg-green-50 hover:border-green-300"
                    onClick={() => window.location.href = subcategory.route}
                  >
                    <Icon className="h-6 w-6 text-green-600" />
                    <div className="text-center">
                      <div className="font-medium text-sm">{subcategory.name}</div>
                      <div className="text-xs text-gray-500">{subcategory.count} recipes</div>
                    </div>
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500 fill-current" />
                Your Favorite Smoothies ({favorites.length})
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {favorites.slice(0, 3).map((fav) => (
                  <div key={fav.id} className="p-4 bg-white rounded-lg border">
                    <div className="font-semibold mb-1">{fav.name}</div>
                    <div className="text-sm text-gray-600 mb-2">{fav.description}</div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        {fav.nutrition.calories} cal
                      </span>
                      <span className="flex items-center gap-1">
                        <Dumbbell className="h-3 w-3" />
                        {fav.nutrition.protein}g
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Tabs */}
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

        {activeTab === 'create' && (
          <div className="space-y-6">
            {/* Fitness Goal Selection */}
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

            {/* Ingredient Selection */}
            <div className="grid md:grid-cols-2 gap-6">
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
                    {/* Fruits */}
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

                    {/* Vegetables */}
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

                    {/* Liquids */}
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

                    {/* Boosters */}
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

              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Your Custom Smoothie
                  </h3>

                  {/* Selected Ingredients */}
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

                  {/* Nutrition Summary */}
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

                        <div className="flex gap-2">
                          <Button
                            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                            onClick={() => makePremadeRecipe(recipe)}
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Make It
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const recipeData = {
                                id: `recipe-${recipe.id}`,
                                name: recipe.name,
                                category: 'smoothies' as const,
                                description: `Popular recipe with ${recipe.rating}★ rating`,
                                ingredients: recipe.ingredients,
                                nutrition: {
                                  calories: recipe.calories,
                                  protein: recipe.protein,
                                  carbs: Math.round(recipe.calories * 0.6 / 4),
                                  fat: 3
                                },
                                difficulty: recipe.difficulty as 'Easy' | 'Medium' | 'Hard',
                                prepTime: parseInt(recipe.time),
                                rating: recipe.rating,
                                fitnessGoal: recipe.workoutType,
                                bestTime: recipe.workoutType.includes('pre') ? 'Pre-workout' : 'Post-workout'
                              };
                              if (isFavorite(recipeData.id)) {
                                // Remove from favorites logic would go here
                              } else {
                                addToFavorites(recipeData);
                              }
                            }}
                          >
                            <Heart
                              className={`w-4 h-4 ${
                                isFavorite(`recipe-${recipe.id}`)
                                  ? 'fill-current text-red-500'
                                  : ''
                              }`}
                            />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tips & Benefits */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Leaf className="w-5 h-5 text-green-600" />
                Smoothie Pro Tips
              </h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Use frozen fruits for a thicker, creamier texture without ice</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Add liquid first to help blender process ingredients smoothly</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Balance sweet fruits with greens for optimal nutrition</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Prep ingredient packs in advance for quick morning smoothies</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Add protein powder after blending for best texture</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                Health Benefits
              </h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Heart className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>Boosts energy levels with natural sugars and nutrients</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>Supports muscle recovery with protein and antioxidants</span>
                </li>
                <li className="flex items-start gap-2">
                  <Droplets className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span>Improves hydration with high water content fruits</span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <span>Aids weight management with fiber and protein</span>
                </li>
                <li className="flex items-start gap-2">
                  <Award className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <span>Enhances immune system with vitamins and minerals</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Smoothie Stats */}
        <Card className="bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              Your Smoothie Journey
            </h3>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {userProgress.totalDrinksMade}
                </div>
                <div className="text-sm text-gray-600">Smoothies Made</div>
                <Progress value={userProgress.dailyGoalProgress} className="mt-2 h-2" />
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {userProgress.currentStreak}
                </div>
                <div className="text-sm text-gray-600">Day Streak</div>
                <div className="flex justify-center gap-1 mt-2">
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded ${
                        i < userProgress.currentStreak
                          ? 'bg-orange-400'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {favorites.length}
                </div>
                <div className="text-sm text-gray-600">Favorite Recipes</div>
                <div className="flex justify-center gap-1 mt-2">
                  <Heart className="w-6 h-6 text-red-400 fill-current" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  Level {userProgress.level}
                </div>
                <div className="text-sm text-gray-600">{userProgress.totalPoints} XP</div>
                <Progress 
                  value={(userProgress.totalPoints % 1000) / 10} 
                  className="mt-2 h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <Gift className="w-16 h-16 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Share Your Creation!</h3>
            <p className="text-purple-100 mb-6">
              Post your custom smoothies to inspire others and earn bonus XP
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="secondary" size="lg">
                <Camera className="w-5 h-5 mr-2" />
                Take Photo
              </Button>
              <Button variant="secondary" size="lg">
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
