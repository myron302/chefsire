import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple, Moon,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Search, Filter, Shuffle, Camera, Share2, ArrowLeft,
  Dumbbell, Activity, BarChart3, FlaskConical, Weight, 
  Gauge, Waves, Shield, Milk, Bone
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';

// Navigation data
const otherDrinkHubs = [
  {
    id: 'smoothies',
    name: 'Smoothies',
    route: '/drinks/smoothies',
    icon: FlaskConical,
    description: 'Fruit & vegetable blends'
  },
  {
    id: 'protein-shakes',
    name: 'Protein Shakes',
    route: '/drinks/protein-shakes',
    icon: Dumbbell,
    description: 'Muscle building & recovery'
  },
  {
    id: 'potent-potables',
    name: 'Potent Potables',
    route: '/drinks/potent-potables',
    icon: Trophy,
    description: 'Enhanced performance drinks'
  },
  {
    id: 'detoxes',
    name: 'Detoxes',
    route: '/drinks/detoxes',
    icon: Sparkles,
    description: 'Cleansing & renewal'
  }
];

const proteinSubcategories = [
  {
    id: 'whey',
    name: 'Whey Protein',
    path: '/drinks/protein-shakes/whey',
    icon: Zap,
    color: 'blue',
    description: 'Fast absorption for post-workout',
    stats: { protein: '35g+', absorption: '30-60min', recipes: 6 }
  },
  {
    id: 'casein',
    name: 'Casein Protein',
    path: '/drinks/protein-shakes/casein',
    icon: Moon,
    color: 'purple',
    description: 'Slow release for overnight recovery',
    stats: { protein: '26g', absorption: '7-8hrs', recipes: 6 }
  },
  {
    id: 'plant-based',
    name: 'Plant-Based',
    path: '/drinks/protein-shakes/plant-based',
    icon: Leaf,
    color: 'green',
    description: 'Vegan & allergen-free options',
    stats: { protein: '21g', absorption: 'Medium', recipes: 6 }
  },
  {
    id: 'collagen',
    name: 'Collagen',
    path: '/drinks/protein-shakes/collagen',
    icon: Sparkles,
    color: 'pink',
    description: 'Beauty & joint support',
    stats: { protein: '18g', absorption: 'Fast', recipes: 6 }
  }
];

// Protein data from your existing file
const fitnessGoals = [
  { id: 'muscle', name: 'Muscle Building', icon: Dumbbell, color: 'bg-red-500', protein: 35, carbs: 40, description: 'Maximum muscle growth and recovery' },
  { id: 'lean', name: 'Lean Muscle', icon: Target, color: 'bg-blue-500', protein: 30, carbs: 20, description: 'Build muscle while staying lean' },
  { id: 'strength', name: 'Strength', icon: Trophy, color: 'bg-purple-500', protein: 32, carbs: 35, description: 'Power and performance focused' },
  { id: 'endurance', name: 'Endurance', icon: Activity, color: 'bg-green-500', protein: 25, carbs: 45, description: 'Sustained energy and recovery' },
  { id: 'weight-loss', name: 'Weight Loss', icon: TrendingUp, color: 'bg-orange-500', protein: 28, carbs: 15, description: 'Fat loss with muscle preservation' },
  { id: 'recovery', name: 'Recovery', icon: Heart, color: 'bg-pink-500', protein: 30, carbs: 25, description: 'Optimal recovery and repair' }
];

const proteinTypes = [
  { id: 'whey', name: 'Whey Protein', absorption: 'Fast', timing: 'Post-workout', biovalue: 95, description: 'Complete amino profile, fast absorption', icon: Zap },
  { id: 'casein', name: 'Casein', absorption: 'Slow', timing: 'Before bed', biovalue: 85, description: 'Sustained release, anti-catabolic', icon: Moon },
  { id: 'plant', name: 'Plant Protein', absorption: 'Medium', timing: 'Anytime', biovalue: 75, description: 'Vegan-friendly, digestive friendly', icon: Leaf },
  { id: 'collagen', name: 'Collagen Protein', absorption: 'Fast', timing: 'Morning', biovalue: 90, description: 'Skin, hair, and joint support', icon: Sparkles }
];

const supplements = [
  { id: 'creatine', name: 'Creatine', amount: '5g', benefit: 'Strength & Power', timing: 'Post-workout', icon: Zap },
  { id: 'bcaa', name: 'BCAA', amount: '10g', benefit: 'Muscle Recovery', timing: 'Intra-workout', icon: Activity },
  { id: 'glutamine', name: 'L-Glutamine', amount: '5g', benefit: 'Recovery & Immunity', timing: 'Post-workout', icon: Shield },
  { id: 'beta-alanine', name: 'Beta-Alanine', amount: '3g', benefit: 'Endurance', timing: 'Pre-workout', icon: Flame }
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
    icon: Moon,
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
    name: 'Beast Mode Builder',
    protein: 35,
    carbs: 42,
    calories: 380,
    ingredients: ['Whey Protein', 'Banana', 'Oats', 'Peanut Butter', 'Milk'],
    rating: 4.8,
    reviews: 234,
    goal: 'muscle',
    type: 'whey',
    prepTime: 3
  },
  {
    name: 'Lean Machine',
    protein: 30,
    carbs: 18,
    calories: 220,
    ingredients: ['Plant Protein', 'Berries', 'Spinach', 'Almond Milk', 'Chia Seeds'],
    rating: 4.6,
    reviews: 189,
    goal: 'lean',
    type: 'plant',
    prepTime: 2
  },
  {
    name: 'Midnight Recovery',
    protein: 28,
    carbs: 8,
    calories: 180,
    ingredients: ['Casein Protein', 'Almond Milk', 'Cinnamon', 'Greek Yogurt'],
    rating: 4.7,
    reviews: 156,
    goal: 'recovery',
    type: 'casein',
    prepTime: 2
  }
];

type Params = { params?: Record<string, string> };

export default function ProteinShakesPage({ params }: Params) {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [selectedGoal, setSelectedGoal] = useState(fitnessGoals[0]);
  const [selectedProtein, setSelectedProtein] = useState(proteinTypes[0]);
  const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);
  const [selectedPhase, setSelectedPhase] = useState(workoutPhases[1]);
  const [proteinAmount, setProteinAmount] = useState([30]);
  const [showNutrition, setShowNutrition] = useState(false);
  const [dailyProteinGoal] = useState(150);
  const [consumedProtein, setConsumedProtein] = useState(85);
  const [activeTab, setActiveTab] = useState('builder');

  const type = params?.type?.replaceAll("-", " ");

  const calculateNutrition = () => {
    const protein = proteinAmount[0];
    const carbs = selectedGoal.carbs;
    const calories = (protein * 4) + (carbs * 4) + 50;
    return { protein, carbs, calories };
  };

  const nutrition = calculateNutrition();
  const proteinProgress = (consumedProtein / dailyProteinGoal) * 100;

  const handleMakeShake = (recipe: any) => {
    addToRecentlyViewed({
      id: recipe.name.toLowerCase().replace(/\s+/g, '-'),
      name: recipe.name,
      category: 'protein-shakes',
      description: `${recipe.protein}g protein shake for ${recipe.goal}`,
      ingredients: recipe.ingredients,
      nutrition: {
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: 5
      },
      difficulty: 'Easy',
      prepTime: recipe.prepTime,
      rating: recipe.rating,
      fitnessGoal: recipe.goal,
      bestTime: 'Post-workout'
    });
    incrementDrinksMade();
    addPoints(20);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                <FlaskConical className="h-10 w-10 text-blue-500" />
                Protein Shakes
                {type && <span className="text-muted-foreground">• {type}</span>}
              </h1>
              <p className="text-lg text-muted-foreground mt-2">
                Science-backed protein solutions for your fitness goals
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{consumedProtein}g</div>
              <div className="text-sm text-muted-foreground">of {dailyProteinGoal}g daily</div>
              <Progress value={proteinProgress} className="w-24 h-2 mt-1" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button 
                      variant="outline" 
                      className={`w-full justify-start hover:bg-blue-50 hover:border-blue-300 ${
                        hub.id === 'protein-shakes' ? 'bg-blue-50 border-blue-300' : ''
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium">{hub.name}</div>
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

        {/* PROTEIN TYPE NAVIGATION */}
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Choose Your Protein Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {proteinSubcategories.map((protein) => {
                const Icon = protein.icon;
                const colorMap = {
                  blue: 'bg-blue-500',
                  purple: 'bg-purple-500',
                  green: 'bg-green-500',
                  pink: 'bg-pink-500'
                };
                
                return (
                  <Link key={protein.id} href={protein.path}>
                    <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 ${colorMap[protein.color as keyof typeof colorMap]} rounded-lg`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{protein.name}</h4>
                            <p className="text-xs text-gray-600">{protein.description}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                          <div>
                            <div className="font-bold text-blue-600">{protein.stats.protein}</div>
                            <div className="text-gray-500">Protein</div>
                          </div>
                          <div>
                            <div className="font-bold text-green-600">{protein.stats.absorption}</div>
                            <div className="text-gray-500">Absorption</div>
                          </div>
                          <div>
                            <div className="font-bold text-purple-600">{protein.stats.recipes}</div>
                            <div className="text-gray-500">Recipes</div>
                          </div>
                        </div>
                        
                        <Button className="w-full bg-blue-600 hover:bg-blue-700">
                          Explore {protein.name}
                          <ArrowLeft className="h-3 w-3 ml-2 rotate-180" />
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'builder', label: 'Protein Builder', icon: FlaskConical },
            { id: 'workout-timing', label: 'Workout Timing', icon: Clock },
            { id: 'popular', label: 'Popular Recipes', icon: Star },
            { id: 'goals', label: 'Fitness Goals', icon: Target }
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

        {/* Protein Builder Tab */}
        {activeTab === 'builder' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Builder */}
            <div className="lg:col-span-2 space-y-6">
              {/* Daily Protein Tracking */}
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">Daily Protein Progress</h3>
                    <Badge className="bg-blue-500">
                      <Target className="h-4 w-4 mr-1" />
                      {Math.round(proteinProgress)}% Complete
                    </Badge>
                  </div>
                  <Progress value={proteinProgress} className="h-4 mb-2" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{consumedProtein}g consumed</span>
                    <span>{dailyProteinGoal - consumedProtein}g remaining</span>
                  </div>
                </CardContent>
              </Card>

              {/* Fitness Goals */}
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

              {/* Protein Selection */}
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

              {/* Protein Amount */}
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

            {/* Right Column - Nutrition & Actions */}
            <div className="space-y-6">
              {/* Live Nutrition */}
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

              {/* Build Actions */}
              <Card>
                <CardContent className="p-6 space-y-3">
                  <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600">
                    <Plus className="h-4 w-4 mr-2" />
                    Build This Shake
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Heart className="h-4 w-4 mr-2" />
                    Save Recipe
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Recipe
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Add Supplements */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Add Supplements</h3>
                  <div className="space-y-2">
                    {supplements.slice(0, 3).map(supplement => (
                      <div key={supplement.id} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <supplement.icon className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium text-sm">{supplement.name}</div>
                            <div className="text-xs text-muted-foreground">{supplement.benefit}</div>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedSupplements(prev => 
                            prev.includes(supplement.id) 
                              ? prev.filter(id => id !== supplement.id)
                              : [...prev, supplement.id]
                          )}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Workout Timing Tab */}
        {activeTab === 'workout-timing' && (
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

                      <div className="space-y-2 text-sm">
                        {phase.recommendations.map((rec, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                      
                      <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
                        Build {phase.name} Shake
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Popular Recipes Tab */}
        {activeTab === 'popular' && (
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
                        <Badge variant="outline" className="text-xs capitalize">
                          {recipe.type}
                        </Badge>
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
                        onClick={() => handleMakeShake(recipe)}
                      >
                        Try This Recipe
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fitness Goals Tab */}
        {activeTab === 'goals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fitnessGoals.map(goal => {
              const Icon = goal.icon;
              const goalRecipes = popularRecipes.filter(recipe => recipe.goal === goal.id);
              
              return (
                <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${goal.color}`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        <p className="text-sm text-gray-600">{goal.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-gray-50 p-2 rounded">
                          <div className="text-sm font-medium text-gray-700">Protein</div>
                          <div className="text-lg font-bold text-blue-600">{goal.protein}g</div>
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <div className="text-sm font-medium text-gray-700">Carbs</div>
                          <div className="text-lg font-bold text-green-600">{goal.carbs}g</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-1">
                        {goalRecipes.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Optimized Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedGoal(goal);
                          setActiveTab('builder');
                        }}
                      >
                        View {goal.name} Shakes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="rounded-full w-14 h-14 bg-blue-600 hover:bg-blue-700 shadow-lg"
          onClick={() => setActiveTab('builder')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Bottom Stats Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-blue-600" />
              <span className="text-gray-600">Protein Goal:</span>
              <span className="font-bold text-blue-600">{dailyProteinGoal}g</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">Your Level:</span>
              <span className="font-bold text-yellow-600">{userProgress.level}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <span className="text-gray-600">XP:</span>
              <span className="font-bold text-green-500">{userProgress.totalPoints}</span>
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
