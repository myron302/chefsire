import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Dumbbell, Activity, BarChart3, Shuffle, Camera, Share2,
  Search, ArrowRight, Coffee, IceCream
} from 'lucide-react';

// ✅ Import the universal search and context
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';

type Params = { params?: Record<string, string> };

// ✅ Smoothie subcategories for navigation
const smoothieSubcategories = [
  { id: 'protein', name: 'High-Protein', icon: Zap, count: 24, route: '/drinks/smoothies/protein', description: 'Natural protein for muscle building' },
  { id: 'green', name: 'Green Superfood', icon: Leaf, count: 28, route: '/drinks/smoothies/green', description: 'Nutrient-dense greens and superfoods' },
  { id: 'dessert', name: 'Dessert', icon: IceCream, count: 32, route: '/drinks/smoothies/dessert', description: 'Guilt-free indulgent flavors' },
  { id: 'breakfast', name: 'Breakfast', icon: Coffee, count: 26, route: '/drinks/smoothies/breakfast', description: 'Morning fuel with balanced nutrition' },
  { id: 'workout', name: 'Workout', icon: Dumbbell, count: 22, route: '/drinks/smoothies/workout', description: 'Pre and post-workout energy' }
];

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

export default function SmoothiesPage({ params }: Params) {
  // ✅ Use the drinks context
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

  // ✅ Enhanced createSmoothie with context integration
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

  // ✅ Enhanced makePremadeRecipe with context integration
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
      
      {/* Success Animation */}
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

        {/* ✅ Universal Search Component */}
        <div className="max-w-2xl mx-auto mb-8">
          <UniversalSearch 
            onSelectDrink={handleDrinkSelection}
            placeholder="Search all drinks or find smoothie inspiration..."
            className="w-full"
          />
        </div>

        {/* ✅ NEW: Smoothie Subcategories Navigation */}
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

        {/* Rest of the smoothies page continues with favorites, daily challenge, tabs, etc... */}
        {/* (The rest of your existing smoothies code stays the same) */}
