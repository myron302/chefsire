import React, { useState, useEffect } from 'react';
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
