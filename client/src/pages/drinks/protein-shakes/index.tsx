import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar,
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Dumbbell, Activity, BarChart3, Shuffle, Camera, Share2,
  FlaskConical, Weight, Gauge, Triangle, Waves, Shield,
  Search, ArrowRight, Wine, Home, ArrowLeft, Moon, Coffee, GlassWater
} from 'lucide-react';

import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';
import { otherDrinkHubs } from '../data/detoxes';

type Params = { params?: Record<string, string> };

const fitnessGoals = [
  { id: 'muscle', name: 'Muscle Building', icon: Dumbbell, color: 'bg-red-500', protein: 35, carbs: 40, description: 'Maximum muscle growth and recovery' },
  { id: 'lean', name: 'Lean Muscle', icon: Target, color: 'bg-blue-500', protein: 30, carbs: 20, description: 'Build muscle while staying lean' },
  { id: 'strength', name: 'Strength', icon: Trophy, color: 'bg-purple-500', protein: 32, carbs: 35, description: 'Power and performance focused' },
  { id: 'endurance', name: 'Endurance', icon: Activity, color: 'bg-green-500', protein: 25, carbs: 45, description: 'Sustained energy and recovery' },
  { id: 'weight-loss', name: 'Weight Loss', icon: TrendingUp, color: 'bg-orange-500', protein: 28, carbs: 15, description: 'Fat loss with muscle preservation' },
  { id: 'recovery', name: 'Recovery', icon: Heart, color: 'bg-pink-500', protein: 30, carbs: 25, description: 'Optimal recovery and repair' }
];

const proteinTypes = [
  { id: 'whey', name: 'Whey Protein', absorption: 'Fast', timing: 'Post-workout', biovalue: 95, description: 'Complete amino profile, fast absorption' },
  { id: 'casein', name: 'Casein', absorption: 'Slow', timing: 'Before bed', biovalue: 85, description: 'Sustained release, anti-catabolic' },
  { id: 'plant', name: 'Plant Protein', absorption: 'Medium', timing: 'Anytime', biovalue: 75, description: 'Vegan-friendly, digestive friendly' },
  { id: 'egg', name: 'Egg Protein', absorption: 'Medium', timing: 'Morning', biovalue: 90, description: 'Complete amino acids, lactose-free' },
  { id: 'beef', name: 'Beef Protein', absorption: 'Fast', timing: 'Post-workout', biovalue: 88, description: 'Rich in creatine and amino acids' }
];

const supplements = [
  { id: 'creatine', name: 'Creatine', amount: '5g', benefit: 'Strength & Power', timing: 'Post-workout' },
  { id: 'bcaa', name: 'BCAA', amount: '10g', benefit: 'Muscle Recovery', timing: 'Intra-workout' },
  { id: 'glutamine', name: 'L-Glutamine', amount: '5g', benefit: 'Recovery & Immunity', timing: 'Post-workout' },
  { id: 'beta-alanine', name: 'Beta-Alanine', amount: '3g', benefit: 'Endurance', timing: 'Pre-workout' },
  { id: 'hmb', name: 'HMB', amount: '3g', benefit: 'Anti-Catabolic', timing: 'Post-workout' }
];

const workoutPhases = [
  {
    name: 'Pre-Workout',
    timing: '30-60 min before',
    icon: Timer,
    color: 'bg-orange-500',
    focus: 'Energy & Focus',
    recommendations: ['Light protein', 'Fast carbs', 'Caffeine', 'Beta-Alanine']
  },
  {
    name: 'Post-Workout',
    timing: '0-30 min after',
    icon: Zap,
    color: 'bg-green-500',
    focus: 'Recovery & Growth',
    recommendations: ['Fast protein', 'Simple carbs', 'Creatine', 'Glutamine']
  },
  {
    name: 'Before Bed',
    timing: '1-2 hours before bed',
    icon: Calendar,
    color: 'bg-purple-500',
    focus: 'Overnight Recovery',
    recommendations: ['Casein protein', 'Avoid caffeine', 'Magnesium', 'ZMA']
  },
  {
    name: 'Intra-Workout',
    timing: 'During training',
    icon: Activity,
    color: 'bg-blue-500',
    focus: 'Performance & Hydration',
    recommendations: ['BCAA', 'Electrolytes', 'Simple carbs', 'Caffeine']
  }
];

const popularRecipes = [
  {
    id: 'protein-recipe-1',
    name: 'Beast Mode Builder',
    protein: 35,
    carbs: 42,
    calories: 380,
    ingredients: ['Whey Protein', 'Banana', 'Oats', 'Peanut Butter', 'Milk'],
    rating: 4.8,
    reviews: 234,
    goal: 'muscle'
  },
  {
    id: 'protein-recipe-2',
    name: 'Lean Machine',
    protein: 30,
    carbs: 18,
    calories: 220,
    ingredients: ['Plant Protein', 'Berries', 'Spinach', 'Almond Milk', 'Chia Seeds'],
    rating: 4.6,
    reviews: 189,
    goal: 'lean'
  },
  {
    id: 'protein-recipe-3',
    name: 'Power Surge',
    protein: 32,
    carbs: 38,
    calories: 340,
    ingredients: ['Whey Protein', 'Sweet Potato', 'Cinnamon', 'Greek Yogurt'],
    rating: 4.7,
    reviews: 156,
    goal: 'strength'
  }
];

const proteinSubcategories = [
  {
    id: 'whey',
    name: 'Whey Protein',
    icon: Zap,
    count: 6,
    route: '/drinks/protein-shakes/whey',
    description: 'Fast absorption, post-workout',
    image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600&h=400&fit=crop',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-600',
    trending: true,
    avgCalories: 320,
    avgTime: '3 min',
    topBenefit: 'Muscle Recovery'
  },
  {
    id: 'plant',
    name: 'Plant-Based',
    icon: Leaf,
    count: 6,
    route: '/drinks/protein-shakes/plant-based',
    description: 'Vegan, allergen-friendly',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&h=400&fit=crop',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-600',
    featured: true,
    avgCalories: 280,
    avgTime: '4 min',
    topBenefit: 'Plant Power'
  },
  {
    id: 'casein',
    name: 'Casein',
    icon: Moon,
    count: 6,
    route: '/drinks/protein-shakes/casein',
    description: 'Slow release, nighttime',
    image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&h=400&fit=crop',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-600',
    avgCalories: 300,
    avgTime: '3 min',
    topBenefit: 'Night Recovery'
  },
  {
    id: 'collagen',
    name: 'Collagen',
    icon: Sparkles,
    count: 6,
    route: '/drinks/protein-shakes/collagen',
    description: 'Beauty & joint support',
    image: 'https://images.unsplash.com/photo-1622484211443-76c4deea5047?w=600&h=400&fit=crop',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-600',
    trending: true,
    avgCalories: 240,
    avgTime: '2 min',
    topBenefit: 'Skin & Joints'
  },
  {
    id: 'egg',
    name: 'Egg Protein',
    icon: Target,
    count: 6,
    route: '/drinks/protein-shakes/egg',
    description: 'Complete amino, lactose-free',
    image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&h=400&fit=crop',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-600',
    avgCalories: 310,
    avgTime: '3 min',
    topBenefit: 'Complete Amino'
  },
  {
    id: 'beef',
    name: 'Beef Protein',
    icon: Flame,
    count: 6,
    route: '/drinks/protein-shakes/beef',
    description: 'Natural creatine, carnivore',
    image: 'https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?w=600&h=400&fit=crop',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-600',
    avgCalories: 350,
    avgTime: '3 min',
    topBenefit: 'Creatine Boost'
  }
];

export default function ProteinShakesPage({ params }: Params) {
  const { 
    userProgress, 
    addPoints, 
    incrementDrinksMade, 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    favorites,
    getRecommendations
  } = useDrinks();

  const [selectedGoal, setSelectedGoal] = useState(fitnessGoals[0]);
  const [selectedProtein, setSelectedProtein] = useState(proteinTypes[0]);
  const [selectedSupplements, setSelectedSupplements] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState(workoutPhases[1]);
  const [proteinAmount, setProteinAmount] = useState([30]);
  const [showNutrition, setShowNutrition] = useState(false);
  const [dailyProteinGoal] = useState(150);
  const [consumedProtein, setConsumedProtein] = useState(85);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const type = params?.type?.replaceAll("-", " ");
  const recommendations = getRecommendations('protein-shakes');

  const calculateNutrition = () => {
    const protein = proteinAmount[0];
    const carbs = selectedGoal.carbs;
    const calories = (protein * 4) + (carbs * 4) + 50;
    return { protein, carbs, calories };
  };

  const nutrition = calculateNutrition();
  const proteinProgress = (consumedProtein / dailyProteinGoal) * 100;

  const buildShake = () => {
    const shakeData = {
      id: `custom-protein-${Date.now()}`,
      name: `Custom ${selectedGoal.name} Protein Shake`,
      category: 'protein-shakes' as const,
      description: `${selectedProtein.name} shake optimized for ${selectedGoal.name.toLowerCase()}`,
      ingredients: [selectedProtein.name, 'Water/Milk', ...selectedSupplements.map(s => s.name)],
      nutrition: {
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: 3
      },
      difficulty: 'Easy' as const,
      prepTime: 3,
      rating: 5,
      fitnessGoal: selectedGoal.name,
      bestTime: selectedProtein.timing
    };

    addToRecentlyViewed(shakeData);
    incrementDrinksMade();
    addPoints(125);
    setConsumedProtein(prev => prev + nutrition.protein);
    
    console.log(`Built ${shakeData.name}! +125 XP`);
  };

  const makeRecipe = (recipe) => {
    const shakeData = {
      id: recipe.id,
      name: recipe.name,
      category: 'protein-shakes' as const,
      description: `Popular ${recipe.goal} protein shake`,
      ingredients: recipe.ingredients,
      nutrition: {
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: 5
      },
      difficulty: 'Easy' as const,
      prepTime: 3,
      rating: recipe.rating,
      fitnessGoal: recipe.goal,
      bestTime: 'Post-workout'
    };

    addToRecentlyViewed(shakeData);
    incrementDrinksMade();
    addPoints(100);
    setConsumedProtein(prev => prev + recipe.protein);
    
    console.log(`Made ${recipe.name}! +100 XP`);
  };

  const handleDrinkSelection = (drink) => {
    console.log('Selected drink from universal search:', drink);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* UNIFORM HERO SECTION */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-12 px-6 rounded-xl shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <Link href="/drinks">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Drinks Hub
            </Button>
          </Link>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <FlaskConical className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Protein Shakes</h1>
              <p className="text-xl text-blue-100">Science-backed protein solutions for your fitness goals</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
              <CardContent className="p-4 text-center">
                <FlaskConical className="h-8 w-8 mx-auto mb-2 text-blue-300" />
                <div className="text-2xl font-bold">18</div>
                <div className="text-sm text-blue-100">Total Recipes</div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
              <CardContent className="p-4 text-center">
                <Dumbbell className="h-8 w-8 mx-auto mb-2 text-purple-300" />
                <div className="text-2xl font-bold">30g</div>
                <div className="text-sm text-blue-100">Avg Protein</div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
              <CardContent className="p-4 text-center">
                <Star className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
                <div className="text-2xl font-bold">{userProgress.totalDrinksMade}</div>
                <div className="text-sm text-blue-100">Shakes Made</div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
              <CardContent className="p-4 text-center">
                <Trophy className="h-8 w-8 mx-auto mb-2 text-orange-400" />
                <div className="text-2xl font-bold">Level {userProgress.level}</div>
                <div className="text-sm text-blue-100">{userProgress.totalPoints} XP</div>
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
            {otherDrinkHubs.filter(hub => hub.id !== 'protein-shakes').map((hub) => {
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
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-bold text-base truncate">{hub.name}</div>
                        <div className="text-xs text-gray-600 line-clamp-2">{hub.description}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
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
          placeholder="Search all drinks or find protein shake inspiration..."
          className="w-full"
        />
      </div>

      {/* Protein Subcategories Navigation */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-blue-600" />
          Browse Protein Types
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {proteinSubcategories.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.id} href={category.route}>
                <Card
                  className={`cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${category.borderColor} overflow-hidden`}
                  onMouseEnter={() => setHoveredCard(category.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="relative h-48 overflow-hidden">
                    {category.image && (
                      <img
                        src={category.image}
                        alt={category.name}
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                          hoveredCard === category.id ? 'scale-110' : 'scale-100'
                        }`}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                    {category.trending && (
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-orange-500 text-white border-0">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Trending
                        </Badge>
                      </div>
                    )}

                    {category.featured && (
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-purple-500 text-white border-0">
                          <Star className="h-3 w-3 mr-1" />
                          Featured
                        </Badge>
                      </div>
                    )}

                    <div className="absolute bottom-3 right-3">
                      <div className={`p-2 bg-white/90 rounded-full`}>
                        <Icon className={`h-5 w-5 ${category.textColor}`} />
                      </div>
                    </div>
                  </div>

                  <CardHeader>
                    <CardTitle className="text-xl flex items-center justify-between">
                      {category.name}
                      <Badge variant="outline">{category.count} recipes</Badge>
                    </CardTitle>
                    <p className="text-gray-600">{category.description}</p>
                  </CardHeader>

                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-bold">{category.avgCalories}</span>
                        </div>
                        <div className="text-xs text-gray-500">Calories</div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-bold">{category.avgTime}</span>
                        </div>
                        <div className="text-xs text-gray-500">Prep Time</div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Trophy className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-bold">4.8</span>
                        </div>
                        <div className="text-xs text-gray-500">Rating</div>
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 p-2 rounded ${category.bgColor}`}>
                      <Target className={`h-4 w-4 ${category.textColor}`} />
                      <span className="text-sm font-medium">{category.topBenefit}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Rest of the content remains the same... */}
      {favorites.filter(f => f.category === 'protein-shakes').length > 0 && (
        <Card className="bg-gradient-to-r from-red-100 to-orange-100 border-red-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Your Favorite Protein Shakes ({favorites.filter(f => f.category === 'protein-shakes').length})
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {favorites.filter(f => f.category === 'protein-shakes').slice(0, 5).map((drink) => (
                <div key={drink.id} className="flex-shrink-0 bg-white rounded-lg p-3 shadow-sm min-w-[200px]">
                  <div className="font-medium text-sm mb-1">{drink.name}</div>
                  <div className="text-xs text-gray-600 mb-2">{drink.nutrition?.protein}g protein</div>
                  <Button size="sm" variant="outline" className="w-full text-xs">
                    Make Again
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Daily Protein Progress</h3>
            <div className="flex items-center gap-4">
              <Badge className="bg-blue-500">
                <Target className="h-4 w-4 mr-1" />
                {Math.round(proteinProgress)}% Complete
              </Badge>
              <Badge variant="outline" className="text-blue-600">
                Level {userProgress.level}
              </Badge>
            </div>
          </div>
          <Progress value={proteinProgress} className="h-4 mb-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{consumedProtein}g consumed</span>
            <span>{dailyProteinGoal - consumedProtein}g remaining</span>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            Total drinks made: {userProgress.totalDrinksMade} • XP: {userProgress.totalPoints}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Target className="h-6 w-6" />
                Choose Your Goal
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {fitnessGoals.map(goal => (
                  <div
                    key={goal.id}
                    onClick={() => setSelectedGoal(goal)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      selectedGoal.id === goal.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <goal.icon className={`h-8 w-8 mx-auto mb-2 ${
                      selectedGoal.id === goal.id ? 'text-blue-500' : 'text-gray-500'
                    }`} />
                    <h4 className="font-semibold text-center text-sm">{goal.name}</h4>
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      {goal.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FlaskConical className="h-6 w-6" />
                Protein Type
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {proteinTypes.map(protein => (
                  <div
                    key={protein.id}
                    onClick={() => setSelectedProtein(protein)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedProtein.id === protein.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{protein.name}</h4>
                      <Badge variant="outline">{protein.biovalue} BV</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{protein.description}</p>
                    <div className="flex gap-2">
                      <Badge className="text-xs">{protein.absorption}</Badge>
                      <Badge variant="outline" className="text-xs">{protein.timing}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Weight className="h-6 w-6" />
                Protein Amount
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Protein: {proteinAmount[0]}g</span>
                  <Badge>Recommended: {selectedGoal.protein}g</Badge>
                </div>
                <Slider
                  value={proteinAmount}
                  onValueChange={setProteinAmount}
                  max={50}
                  min={15}
                  step={5}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Nutrition Facts
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Protein:</span>
                  <span className="font-bold">{nutrition.protein}g</span>
                </div>
                <div className="flex justify-between">
                  <span>Carbs:</span>
                  <span className="font-bold">{nutrition.carbs}g</span>
                </div>
                <div className="flex justify-between">
                  <span>Calories:</span>
                  <span className="font-bold">{nutrition.calories}</span>
                </div>
                <div className="pt-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Goal: {selectedGoal.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Protein: {selectedProtein.name}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <Button 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                onClick={buildShake}
              >
                <Plus className="h-4 w-4 mr-2" />
                Build This Shake (+125 XP)
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  const shakeData = {
                    id: `custom-protein-${Date.now()}`,
                    name: `Custom ${selectedGoal.name} Protein Shake`,
                    category: 'protein-shakes' as const,
                    description: `${selectedProtein.name} shake optimized for ${selectedGoal.name.toLowerCase()}`,
                    ingredients: [selectedProtein.name, 'Water/Milk'],
                    nutrition: nutrition,
                    difficulty: 'Easy' as const,
                    prepTime: 3,
                    rating: 5,
                    fitnessGoal: selectedGoal.name,
                    bestTime: selectedProtein.timing
                  };
                  addToFavorites(shakeData);
                }}
              >
                <Heart className="h-4 w-4 mr-2" />
                Save Recipe (+10 XP)
              </Button>
              <Button variant="outline" className="w-full">
                <Share2 className="h-4 w-4 mr-2" />
                Share Recipe
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add Supplements</h3>
              <div className="space-y-2">
                {supplements.slice(0, 3).map(supplement => (
                  <div key={supplement.id} className="flex items-center justify-between p-2 rounded border">
                    <div>
                      <div className="font-medium text-sm">{supplement.name}</div>
                      <div className="text-xs text-muted-foreground">{supplement.benefit}</div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Workout Timing Optimization
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {workoutPhases.map(phase => (
              <Card key={phase.name} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-full ${phase.color}`}>
                      <phase.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{phase.name}</h4>
                      <p className="text-xs text-muted-foreground">{phase.timing}</p>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="text-sm font-medium text-blue-600">{phase.focus}</div>
                  </div>

                  <div className="space-y-2">
                    {phase.name === 'Post-Workout' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Fast protein:</span>
                          <span className="font-bold">25-35g</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Simple carbs:</span>
                          <span className="font-bold">30-50g</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Creatine:</span>
                          <span className="font-bold">5g</span>
                        </div>
                      </div>
                    )}
                    
                    {phase.name === 'Pre-Workout' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Light protein:</span>
                          <span className="font-bold">15-20g</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Carbs (optional):</span>
                          <span className="font-bold">20-30g</span>
                        </div>
                        <div className="flex justify-between">
                          <span>L-Glutamine:</span>
                          <span className="font-bold">5-10g</span>
                        </div>
                      </div>
                    )}
                    
                    {phase.name === 'Before Bed' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Casein protein:</span>
                          <span className="font-bold">20-30g</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avoid caffeine:</span>
                          <span className="font-bold">Important</span>
                        </div>
                      </div>
                    )}
                    
                    {phase.name === 'Intra-Workout' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>BCAA:</span>
                          <span className="font-bold">10-15g</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Electrolytes:</span>
                          <span className="font-bold">As needed</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    className="w-full mt-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                    onClick={() => buildShake()}
                  >
                    Build {phase.name} Shake
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Star className="h-6 w-6" />
            Popular Recipes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {popularRecipes.map((recipe, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{recipe.name}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const shakeData = {
                          id: recipe.id,
                          name: recipe.name,
                          category: 'protein-shakes' as const,
                          description: `Popular ${recipe.goal} protein shake`,
                          ingredients: recipe.ingredients,
                          nutrition: {
                            calories: recipe.calories,
                            protein: recipe.protein,
                            carbs: recipe.carbs,
                            fat: 5
                          },
                          difficulty: 'Easy' as const,
                          prepTime: 3,
                          rating: recipe.rating,
                          fitnessGoal: recipe.goal,
                          bestTime: 'Post-workout'
                        };
                        addToFavorites(shakeData);
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Heart className={`h-4 w-4 ${isFavorite(recipe.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{recipe.rating}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">({recipe.reviews} reviews)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div>
                      <div className="font-bold text-blue-600">{recipe.protein}g</div>
                      <div className="text-xs text-muted-foreground">Protein</div>
                    </div>
                    <div>
                      <div className="font-bold text-green-600">{recipe.carbs}g</div>
                      <div className="text-xs text-muted-foreground">Carbs</div>
                    </div>
                    <div>
                      <div className="font-bold text-orange-600">{recipe.calories}</div>
                      <div className="text-xs text-muted-foreground">Calories</div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    {recipe.ingredients.join(', ')}
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => makeRecipe(recipe)}
                  >
                    Try This Recipe (+100 XP)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold mb-2">Explore More Drinks</h3>
              <p className="text-gray-600 mb-4">Discover smoothies, detoxes, and cocktails</p>
              <div className="flex gap-2">
                <Link href="/drinks/smoothies">
                  <Button variant="outline" size="sm">Smoothies</Button>
                </Link>
                <Link href="/drinks/detoxes">
                  <Button variant="outline" size="sm">Detox Drinks</Button>
                </Link>
                <Link href="/drinks/potent-potables">
                  <Button variant="outline" size="sm">Cocktails</Button>
                </Link>
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">{userProgress.totalDrinksMade}</div>
              <div className="text-sm text-gray-600 mb-2">Total Drinks Made</div>
              <Progress value={userProgress.dailyGoalProgress} className="w-24" />
              <div className="text-xs text-gray-500 mt-1">Daily Goal</div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
