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
  X, Wine, Milk, Droplet, Sunrise, Moon, Sun, Cloudy, ArrowRight, Droplets
} from 'lucide-react';

import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';
import { otherDrinkHubs } from '../data/detoxes';

const caffeinatedSubcategories = [
  { id: 'espresso', name: 'Espresso Drinks', icon: Coffee, count: 32, route: '/drinks/caffeinated/espresso', description: 'Classic espresso-based beverages' },
  { id: 'cold-brew', name: 'Cold Brew', icon: GlassWater, count: 18, route: '/drinks/caffeinated/cold-brew', description: 'Smooth cold coffee drinks' },
  { id: 'tea', name: 'Tea', icon: Leaf, count: 28, route: '/drinks/caffeinated/tea', description: 'Hot and iced tea varieties' },
  { id: 'matcha', name: 'Matcha', icon: Sparkles, count: 16, route: '/drinks/caffeinated/matcha', description: 'Japanese green tea powder drinks' },
  { id: 'energy', name: 'Energy Drinks', icon: Zap, count: 24, route: '/drinks/caffeinated/energy', description: 'Natural energy boosters' },
  { id: 'specialty', name: 'Specialty Coffee', icon: Star, count: 20, route: '/drinks/caffeinated/specialty', description: 'Unique coffee creations' },
  { id: 'lattes', name: 'Lattes & Cappuccinos', icon: Milk, count: 26, route: '/drinks/caffeinated/lattes', description: 'Milk-based coffee drinks' },
  { id: 'iced', name: 'Iced Coffee', icon: Droplet, count: 22, route: '/drinks/caffeinated/iced', description: 'Refreshing iced coffee drinks' }
];

const ingredients = {
  base: [
    { name: "Espresso", calories: 3, caffeine: 64, carbs: 0, sugar: 0, icon: "☕", boost: "focus" },
    { name: "Cold Brew", calories: 5, caffeine: 200, carbs: 0, sugar: 0, icon: "🧊", boost: "energy" },
    { name: "Black Tea", calories: 2, caffeine: 47, carbs: 0.7, sugar: 0, icon: "🍵", boost: "antioxidants" },
    { name: "Green Tea", calories: 2, caffeine: 28, carbs: 0, sugar: 0, icon: "🍃", boost: "metabolism" },
    { name: "Matcha", calories: 5, caffeine: 70, carbs: 1, sugar: 0, icon: "🍵", boost: "calm-energy" }
  ],
  milk: [
    { name: "Whole Milk", calories: 149, caffeine: 0, carbs: 12, sugar: 12, icon: "🥛", boost: "creaminess" },
    { name: "Oat Milk", calories: 120, caffeine: 0, carbs: 16, sugar: 7, icon: "🌾", boost: "fiber" },
    { name: "Almond Milk", calories: 30, caffeine: 0, carbs: 1, sugar: 0, icon: "🌰", boost: "low-cal" },
    { name: "Coconut Milk", calories: 45, caffeine: 0, carbs: 1, sugar: 0, icon: "🥥", boost: "flavor" }
  ],
  sweeteners: [
    { name: "Honey", calories: 64, caffeine: 0, carbs: 17, sugar: 17, icon: "🍯", boost: "natural-sweet" },
    { name: "Vanilla Syrup", calories: 20, caffeine: 0, carbs: 5, sugar: 5, icon: "🌿", boost: "flavor" },
    { name: "Caramel Syrup", calories: 20, caffeine: 0, carbs: 5, sugar: 5, icon: "🍮", boost: "indulgent" },
    { name: "Stevia", calories: 0, caffeine: 0, carbs: 0, sugar: 0, icon: "🌱", boost: "zero-cal" }
  ],
  boosters: [
    { name: "Protein Powder", calories: 120, caffeine: 0, carbs: 2, sugar: 1, icon: "💪", boost: "muscle" },
    { name: "MCT Oil", calories: 100, caffeine: 0, carbs: 0, sugar: 0, icon: "🥥", boost: "energy" },
    { name: "Collagen", calories: 35, caffeine: 0, carbs: 0, sugar: 0, icon: "✨", boost: "skin" },
    { name: "Cinnamon", calories: 6, caffeine: 0, carbs: 2, sugar: 0, icon: "🌟", boost: "metabolism" }
  ]
};

const caffeineGoals = [
  { id: 'morning-boost', name: 'Morning Boost', icon: '🌅', color: 'bg-orange-500', focus: 'high-caffeine' },
  { id: 'afternoon-pick', name: 'Afternoon Pick-Me-Up', icon: '☀️', color: 'bg-yellow-500', focus: 'moderate-caffeine' },
  { id: 'focus', name: 'Focus & Productivity', icon: '🎯', color: 'bg-blue-500', focus: 'steady-energy' },
  { id: 'pre-workout', name: 'Pre-Workout', icon: '⚡', color: 'bg-red-500', focus: 'energy' },
  { id: 'social', name: 'Social Drink', icon: '🤝', color: 'bg-purple-500', focus: 'flavor' },
  { id: 'evening', name: 'Light Caffeine', icon: '🌙', color: 'bg-indigo-500', focus: 'low-caffeine' }
];

const premadeRecipes = [
  {
    id: 1,
    name: "Classic Vanilla Latte",
    ingredients: ["Espresso", "Whole Milk", "Vanilla Syrup"],
    calories: 190,
    caffeine: 128,
    difficulty: "Easy",
    time: "4 min",
    rating: 4.9,
    likes: 3421,
    goalType: "morning-boost",
    image: "https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=400&h=300&fit=crop"
  },
  {
    id: 2,
    name: "Iced Caramel Macchiato",
    ingredients: ["Espresso", "Oat Milk", "Caramel Syrup"],
    calories: 220,
    caffeine: 150,
    difficulty: "Medium",
    time: "5 min",
    rating: 4.8,
    likes: 2876,
    goalType: "afternoon-pick",
    image: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=300&fit=crop"
  },
  {
    id: 3,
    name: "Matcha Energy Latte",
    ingredients: ["Matcha", "Almond Milk", "Honey", "Collagen"],
    calories: 145,
    caffeine: 70,
    difficulty: "Easy",
    time: "3 min",
    rating: 4.7,
    likes: 1954,
    goalType: "focus",
    image: "https://images.unsplash.com/photo-1536013564743-4f0b72d6b95f?w=400&h=300&fit=crop"
  },
  {
    id: 4,
    name: "Cold Brew Protein",
    ingredients: ["Cold Brew", "Almond Milk", "Protein Powder"],
    calories: 185,
    caffeine: 200,
    difficulty: "Easy",
    time: "2 min",
    rating: 4.9,
    likes: 2345,
    goalType: "pre-workout",
    image: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&h=300&fit=crop"
  }
];

const dailyChallenge = {
  name: "Caffeine Master Monday",
  description: "Create a custom caffeinated drink with at least 100mg caffeine",
  progress: 1,
  goal: 3,
  participants: 2847,
  reward: "Barista Badge + 250 XP",
  timeLeft: "16h 22m"
};

export default function CaffeinatedDrinksPage() {
  console.log('✅ CAFFEINATED HUB LOADED - Build timestamp:', new Date().toISOString());
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
  const [selectedGoal, setSelectedGoal] = useState(caffeineGoals[0]);
  const [customDrink, setCustomDrink] = useState({
    ingredients: [],
    calories: 0,
    caffeine: 0,
    carbs: 0,
    sugar: 0
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const addIngredient = (ingredient, category) => {
    const newIngredient = { ...ingredient, category, id: Date.now() };
    const newIngredients = [...customDrink.ingredients, newIngredient];

    setCustomDrink({
      ingredients: newIngredients,
      calories: newIngredients.reduce((sum, ing) => sum + ing.calories, 0),
      caffeine: newIngredients.reduce((sum, ing) => sum + ing.caffeine, 0),
      carbs: newIngredients.reduce((sum, ing) => sum + ing.carbs, 0),
      sugar: newIngredients.reduce((sum, ing) => sum + ing.sugar, 0)
    });
  };

  const removeIngredient = (ingredientId) => {
    const newIngredients = customDrink.ingredients.filter(ing => ing.id !== ingredientId);
    setCustomDrink({
      ingredients: newIngredients,
      calories: newIngredients.reduce((sum, ing) => sum + ing.calories, 0),
      caffeine: newIngredients.reduce((sum, ing) => sum + ing.caffeine, 0),
      carbs: newIngredients.reduce((sum, ing) => sum + ing.carbs, 0),
      sugar: newIngredients.reduce((sum, ing) => sum + ing.sugar, 0)
    });
  };

  const createDrink = async () => {
    if (customDrink.ingredients.length >= 2) {
      try {
        const response = await fetch('/api/custom-drinks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Custom ${selectedGoal.name} Drink`,
            category: 'caffeinated',
            drinkType: selectedGoal.id,
            ingredients: customDrink.ingredients,
            calories: Math.round(customDrink.calories),
            caffeine: Math.round(customDrink.caffeine),
            carbs: Math.round(customDrink.carbs * 10) / 10,
            sugar: Math.round(customDrink.sugar * 10) / 10,
            protein: 2,
            fitnessGoal: selectedGoal.name,
            difficulty: 'Custom',
            prepTime: 4,
            rating: 5,
            isPublic: false
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save drink');
        }

        const result = await response.json();
        const savedDrink = result.drink;

        addToRecentlyViewed(savedDrink);
        incrementDrinksMade();
        addPoints(150);

        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setCustomDrink({
            ingredients: [],
            calories: 0,
            caffeine: 0,
            carbs: 0,
            sugar: 0
          });
        }, 3000);
      } catch (error) {
        console.error('Failed to save drink:', error);
        alert('Failed to save drink. Please try again.');
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
          category: 'caffeinated',
          drinkType: recipe.goalType,
          ingredients: recipe.ingredients.map(name => ({
            name,
            category: 'ingredient',
            calories: 0,
            caffeine: 0,
            carbs: 0,
            sugar: 0,
            icon: '☕'
          })),
          calories: recipe.calories,
          caffeine: recipe.caffeine,
          carbs: Math.round(recipe.calories * 0.5 / 4),
          sugar: 10,
          protein: 2,
          fitnessGoal: recipe.goalType,
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

  const randomizeDrink = () => {
    const randomBase = ingredients.base[Math.floor(Math.random() * ingredients.base.length)];
    const randomMilk = ingredients.milk[Math.floor(Math.random() * ingredients.milk.length)];

    const randomIngredients = [
      { ...randomBase, category: 'base', id: Date.now() + 1 },
      { ...randomMilk, category: 'milk', id: Date.now() + 2 }
    ];

    setCustomDrink({
      ingredients: randomIngredients,
      calories: randomIngredients.reduce((sum, ing) => sum + ing.calories, 0),
      caffeine: randomIngredients.reduce((sum, ing) => sum + ing.caffeine, 0),
      carbs: randomIngredients.reduce((sum, ing) => sum + ing.carbs, 0),
      sugar: randomIngredients.reduce((sum, ing) => sum + ing.sugar, 0)
    });
  };

  const handleTakePhoto = async () => {
    setShowCamera(true);

    setTimeout(async () => {
      setShowCamera(false);

      if (customDrink.ingredients.length >= 2) {
        alert('Photo feature coming soon! This would upload your drink photo.');
        addPoints(50);
      } else {
        alert('Create a drink first, then add a photo!');
      }
    }, 2000);
  };

  const handleShare = async () => {
    setShowShare(true);

    const shareData = {
      title: `My Custom ${selectedGoal.name}`,
      text: `Check out my caffeinated drink with ${customDrink.caffeine}mg caffeine!`,
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">

      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gradient-to-r from-orange-400 to-amber-500 text-white p-8 rounded-3xl shadow-2xl animate-bounce">
            <div className="text-center">
              <Coffee className="w-20 h-20 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Drink Created!</h2>
              <p className="text-xl">+{customDrink.ingredients.length >= 2 ? '150' : '100'} XP earned!</p>
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
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-500 text-white py-12 px-6 rounded-xl shadow-2xl">
          <div className="max-w-7xl mx-auto">
            <Link href="/drinks">
              <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Drinks Hub
              </Button>
            </Link>

            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
                <Coffee className="h-12 w-12" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Caffeinated Drinks Studio</h1>
                <p className="text-xl text-amber-100">Craft the perfect energy boost for your day</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Coffee className="h-8 w-8 mx-auto mb-2 text-amber-300" />
                  <div className="text-2xl font-bold">186</div>
                  <div className="text-sm text-amber-100">Total Recipes</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                  <div className="text-2xl font-bold">127mg</div>
                  <div className="text-sm text-amber-100">Avg Caffeine</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Heart className="h-8 w-8 mx-auto mb-2 text-red-300" />
                  <div className="text-2xl font-bold">{favorites.length}</div>
                  <div className="text-sm text-amber-100">Favorites</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                  <div className="text-2xl font-bold">{userProgress.currentStreak}</div>
                  <div className="text-sm text-amber-100">Day Streak</div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {otherDrinkHubs.filter(hub => hub.id !== 'caffeinated').map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button
                      variant="outline"
                      className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:bg-white hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className={`p-2 ${hub.color} rounded-lg`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-bold text-base">{hub.name}</div>
                          <div className="text-xs text-gray-600">{hub.description}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="text-xs text-gray-500 ml-11">{hub.count}</div>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Universal Search */}
        <div className="max-w-2xl mx-auto">
          <UniversalSearch
            onSelectDrink={handleDrinkSelection}
            placeholder="Search all drinks or find caffeine inspiration..."
            className="w-full"
          />
        </div>

        {/* Caffeinated Subcategories */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Coffee className="w-5 h-5 text-amber-600" />
              Explore Caffeinated Drink Types
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {caffeinatedSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.route}>
                    <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-amber-400">
                      <CardContent className="p-4 text-center">
                        <Icon className="h-8 w-8 mx-auto mb-2 text-amber-600" />
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
        <Card className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-6 h-6" />
                  <h3 className="text-2xl font-bold">{dailyChallenge.name}</h3>
                </div>
                <p className="text-amber-100 mb-4">{dailyChallenge.description}</p>
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
              <Progress value={(dailyChallenge.progress / dailyChallenge.goal) * 100} className="h-3 bg-amber-300" />
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b">
          <Button
            variant={activeTab === 'create' ? 'default' : 'ghost'}
            className={activeTab === 'create' ? 'bg-amber-600' : ''}
            onClick={() => setActiveTab('create')}
          >
            <ChefHat className="w-4 h-4 mr-2" />
            Create Custom
          </Button>
          <Button
            variant={activeTab === 'browse' ? 'default' : 'ghost'}
            className={activeTab === 'browse' ? 'bg-amber-600' : ''}
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
                  <Target className="w-5 h-5 text-amber-600" />
                  Choose Your Caffeine Goal
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {caffeineGoals.map((goal) => (
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
                      <Coffee className="w-5 h-5 text-amber-600" />
                      Select Ingredients
                    </h3>
                    <Button size="sm" variant="outline" onClick={randomizeDrink}>
                      <Shuffle className="w-4 h-4 mr-2" />
                      Randomize
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-gray-600">Coffee/Tea Base</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {ingredients.base.map((item) => (
                          <Button
                            key={item.name}
                            size="sm"
                            variant="outline"
                            onClick={() => addIngredient(item, 'base')}
                            className="justify-start"
                          >
                            <span className="mr-2">{item.icon}</span>
                            {item.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-gray-600">Milk Options</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {ingredients.milk.map((item) => (
                          <Button
                            key={item.name}
                            size="sm"
                            variant="outline"
                            onClick={() => addIngredient(item, 'milk')}
                            className="justify-start"
                          >
                            <span className="mr-2">{item.icon}</span>
                            {item.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-gray-600">Sweeteners</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {ingredients.sweeteners.map((item) => (
                          <Button
                            key={item.name}
                            size="sm"
                            variant="outline"
                            onClick={() => addIngredient(item, 'sweeteners')}
                            className="justify-start"
                          >
                            <span className="mr-2">{item.icon}</span>
                            {item.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-gray-600">Boosters</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {ingredients.boosters.map((item) => (
                          <Button
                            key={item.name}
                            size="sm"
                            variant="outline"
                            onClick={() => addIngredient(item, 'boosters')}
                            className="justify-start"
                          >
                            <span className="mr-2">{item.icon}</span>
                            {item.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Custom Drink Preview */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    Your Custom Drink
                  </h3>

                  <div className="mb-4 space-y-2">
                    {customDrink.ingredients.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Coffee className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Start adding ingredients to create your drink</p>
                      </div>
                    ) : (
                      customDrink.ingredients.map((ing) => (
                        <div key={ing.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{ing.icon}</span>
                            <div>
                              <div className="font-medium">{ing.name}</div>
                              <div className="text-xs text-gray-600">
                                {ing.calories} cal • {ing.caffeine}mg caffeine
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

                  {customDrink.ingredients.length > 0 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {Math.round(customDrink.calories)}
                          </div>
                          <div className="text-xs text-gray-600">Calories</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-amber-600">
                            {Math.round(customDrink.caffeine)}mg
                          </div>
                          <div className="text-xs text-gray-600">Caffeine</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {Math.round(customDrink.carbs * 10) / 10}g
                          </div>
                          <div className="text-xs text-gray-600">Carbs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {Math.round(customDrink.sugar * 10) / 10}g
                          </div>
                          <div className="text-xs text-gray-600">Sugar</div>
                        </div>
                      </div>

                      <Button
                        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white"
                        size="lg"
                        onClick={createDrink}
                        disabled={customDrink.ingredients.length < 2}
                      >
                        {customDrink.ingredients.length < 2 ? (
                          <>
                            <Target className="w-5 h-5 mr-2" />
                            Add {2 - customDrink.ingredients.length} more ingredients
                          </>
                        ) : (
                          <>
                            <Coffee className="w-5 h-5 mr-2" />
                            Create Drink (+150 XP)
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
                  Popular Caffeinated Drinks
                </h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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

                        <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg">
                          <div className="text-center">
                            <div className="text-lg font-bold text-orange-600">
                              {recipe.calories}
                            </div>
                            <div className="text-xs text-gray-600">Calories</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-amber-600">
                              {recipe.caffeine}mg
                            </div>
                            <div className="text-xs text-gray-600">Caffeine</div>
                          </div>
                        </div>

                        <Button
                          className="w-full bg-gradient-to-r from-amber-600 to-orange-600"
                          onClick={() => makePremadeRecipe(recipe)}
                        >
                          <Coffee className="w-4 h-4 mr-2" />
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
        <Card className="bg-gradient-to-r from-amber-600 to-orange-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <Gift className="w-16 h-16 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Share Your Creation!</h3>
            <p className="text-amber-100 mb-6">
              Post your custom caffeinated drinks to inspire others and earn bonus XP
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
