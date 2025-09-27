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
  Dumbbell, Activity, BarChart3, Shuffle, Camera, Share2,
  Muscle, Scale, Gauge, Mountain, Waves, Shield
} from 'lucide-react';

type Params = { params?: Record<string, string> };

// Protein sources database
const proteinSources = {
  whey: [
    { name: "Whey Isolate", protein: 25, calories: 110, carbs: 1, fat: 0.5, icon: "🥛", absorption: "fast", cost: "$$" },
    { name: "Whey Concentrate", protein: 20, calories: 130, carbs: 3, fat: 2, icon: "🥛", absorption: "fast", cost: "$" },
    { name: "Hydrolyzed Whey", protein: 24, calories: 100, carbs: 0, fat: 0, icon: "🥛", absorption: "ultra-fast", cost: "$$$" }
  ],
  plant: [
    { name: "Pea Protein", protein: 22, calories: 120, carbs: 2, fat: 1.5, icon: "🌱", absorption: "medium", cost: "$" },
    { name: "Hemp Protein", protein: 15, calories: 120, carbs: 8, fat: 3, icon: "🌿", absorption: "slow", cost: "$$" },
    { name: "Rice Protein", protein: 24, calories: 110, carbs: 1, fat: 1, icon: "🌾", absorption: "medium", cost: "$" },
    { name: "Soy Protein", protein: 23, calories: 95, carbs: 1, fat: 0.5, icon: "🫘", absorption: "medium", cost: "$" }
  ],
  casein: [
    { name: "Micellar Casein", protein: 24, calories: 110, carbs: 1, fat: 0.5, icon: "🧀", absorption: "slow", cost: "$$" },
    { name: "Calcium Caseinate", protein: 23, calories: 105, carbs: 2, fat: 1, icon: "🧀", absorption: "slow", cost: "$" }
  ]
};

const additives = [
  { name: "Creatine", amount: "5g", benefit: "Strength & Power", calories: 0, icon: "⚡", category: "performance" },
  { name: "L-Glutamine", amount: "5g", benefit: "Recovery", calories: 0, icon: "🔄", category: "recovery" },
  { name: "BCAA", amount: "10g", benefit: "Muscle Protection", calories: 40, icon: "🛡️", category: "muscle" },
  { name: "Beta-Alanine", amount: "3g", benefit: "Endurance", calories: 0, icon: "🏃", category: "endurance" },
  { name: "L-Carnitine", amount: "2g", benefit: "Fat Burning", calories: 0, icon: "🔥", category: "fat-loss" },
  { name: "Caffeine", amount: "200mg", benefit: "Energy Boost", calories: 0, icon: "☕", category: "energy" }
];

// Fitness goals with macro targets
const fitnessGoals = [
  { 
    id: 'bulk', 
    name: 'Muscle Building', 
    icon: '💪', 
    color: 'bg-red-500', 
    description: 'High protein, higher calories for muscle growth',
    targetProtein: [30, 50],
    targetCalories: [400, 600],
    recommendedTiming: ['Post-Workout', 'Before Bed'],
    tips: 'Add healthy fats and complex carbs for muscle building'
  },
  { 
    id: 'cut', 
    name: 'Fat Loss', 
    icon: '🔥', 
    color: 'bg-orange-500', 
    description: 'High protein, lower calories to preserve muscle',
    targetProtein: [25, 40],
    targetCalories: [150, 300],
    recommendedTiming: ['Morning', 'Pre-Workout'],
    tips: 'Focus on lean proteins and minimal additives'
  },
  { 
    id: 'maintain', 
    name: 'Maintenance', 
    icon: '⚖️', 
    color: 'bg-blue-500', 
    description: 'Balanced nutrition for maintaining current physique',
    targetProtein: [20, 35],
    targetCalories: [200, 400],
    recommendedTiming: ['Post-Workout', 'Afternoon'],
    tips: 'Consistent daily protein intake is key'
  },
  { 
    id: 'strength', 
    name: 'Strength Training', 
    icon: '🏋️', 
    color: 'bg-purple-500', 
    description: 'Power-focused nutrition for strength gains',
    targetProtein: [25, 45],
    targetCalories: [300, 500],
    recommendedTiming: ['Pre-Workout', 'Post-Workout'],
    tips: 'Add creatine and fast-absorbing proteins'
  },
  { 
    id: 'endurance', 
    name: 'Endurance Sports', 
    icon: '🏃', 
    color: 'bg-green-500', 
    description: 'Sustained energy for long training sessions',
    targetProtein: [20, 30],
    targetCalories: [250, 450],
    recommendedTiming: ['Pre-Workout', 'During Long Sessions'],
    tips: 'Include electrolytes and sustained-release proteins'
  },
  { 
    id: 'recovery', 
    name: 'Recovery Focus', 
    icon: '😌', 
    color: 'bg-teal-500', 
    description: 'Enhanced recovery and muscle repair',
    targetProtein: [25, 40],
    targetCalories: [200, 350],
    recommendedTiming: ['Post-Workout', 'Before Bed'],
    tips: 'Slow-absorbing proteins and recovery supplements'
  }
];

// Popular protein shake recipes
const popularRecipes = [
  {
    id: 1,
    name: "Beast Mode Builder",
    goal: "bulk",
    protein: 42,
    calories: 580,
    ingredients: ["Whey Concentrate", "Banana", "Peanut Butter", "Oats", "Milk"],
    supplements: ["Creatine", "L-Glutamine"],
    timing: "Post-Workout",
    difficulty: "Easy",
    rating: 4.9,
    likes: 2340,
    image: "https://images.unsplash.com/photo-1544829099-b9a0c5303bff?w=400&h=300&fit=crop"
  },
  {
    id: 2,
    name: "Lean Machine",
    goal: "cut",
    protein: 35,
    calories: 180,
    ingredients: ["Whey Isolate", "Berries", "Spinach", "Almond Milk"],
    supplements: ["L-Carnitine", "Caffeine"],
    timing: "Morning",
    difficulty: "Easy",
    rating: 4.7,
    likes: 1890,
    image: "https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=400&h=300&fit=crop"
  },
  {
    id: 3,
    name: "Power Plant Stack",
    goal: "strength",
    protein: 38,
    calories: 420,
    ingredients: ["Pea Protein", "Hemp Protein", "Banana", "Coconut Milk", "Dates"],
    supplements: ["Creatine", "Beta-Alanine"],
    timing: "Pre-Workout",
    difficulty: "Medium",
    rating: 4.8,
    likes: 1567,
    image: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop"
  }
];

// Workout tracking integration
const workoutPhases = [
  { name: "Pre-Workout", timing: "30-60 min before", focus: "Energy & Pump", icon: "⚡" },
  { name: "Intra-Workout", timing: "During training", focus: "Sustained Performance", icon: "🏋️" },
  { name: "Post-Workout", timing: "0-30 min after", focus: "Recovery & Growth", icon: "🔄" },
  { name: "Before Bed", timing: "1-2 hours before sleep", focus: "Overnight Recovery", icon: "😴" }
];

const userStats = {
  level: 12,
  xp: 1890,
  streak: 8,
  shakesMade: 34,
  favoriteGoal: 'bulk',
  workoutsTracked: 45,
  muscleGained: 3.2
};

export default function ProteinShakesPage({ params }: Params) {
  const type = params?.type?.replaceAll("-", " ");
  const [activeTab, setActiveTab] = useState('create');
  const [selectedGoal, setSelectedGoal] = useState(fitnessGoals[0]);
  const [selectedPhase, setSelectedPhase] = useState(workoutPhases[2]); // Post-workout default
  const [customShake, setCustomShake] = useState({
    protein: null,
    additives: [],
    totalProtein: 0,
    totalCalories: 0,
    cost: 0
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [workoutData, setWorkoutData] = useState({
    bodyWeight: 180,
    targetWeight: 185,
    dailyProteinGoal: 140,
    currentIntake: 85
  });

  const addProtein = (protein, category) => {
    setCustomShake(prev => ({
      ...prev,
      protein: { ...protein, category },
      totalProtein: protein.protein,
      totalCalories: protein.calories,
      cost: protein.cost === '$' ? 1 : protein.cost === '$$' ? 2 : 3
    }));
  };

  const toggleAdditive = (additive) => {
    setCustomShake(prev => {
      const exists = prev.additives.find(a => a.name === additive.name);
      if (exists) {
        return {
          ...prev,
          additives: prev.additives.filter(a => a.name !== additive.name),
          totalCalories: prev.totalCalories - additive.calories
        };
      } else {
        return {
          ...prev,
          additives: [...prev.additives, additive],
          totalCalories: prev.totalCalories + additive.calories
        };
      }
    });
  };

  const createShake = () => {
    if (customShake.protein) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const getGoalColor = (goal) => {
    return fitnessGoals.find(g => g.id === goal)?.color || 'bg-gray-500';
  };

  const isInTargetRange = (value, range) => {
    return value >= range[0] && value <= range[1];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      
      {/* Success Animation */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-8 rounded-3xl shadow-2xl animate-bounce">
            <div className="text-center">
              <Muscle className="w-20 h-20 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Shake Created! 💪</h2>
              <p className="text-xl">+200 XP earned!</p>
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
                  <Muscle className="w-4 h-4 text-red-500" />
                  <span className="font-bold">+{userStats.muscleGained}lbs</span>
                </div>
                <div className="text-xs text-gray-600">muscle</div>
              </div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            Protein Shake Lab 🥤💪
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Science-backed protein combinations for your fitness goals
          </p>
          
          {type && (
            <Badge className="mb-4 text-lg px-4 py-2 bg-red-100 text-red-800">
              {type}
            </Badge>
          )}
        </div>

        {/* Daily Protein Progress Banner */}
        <Card className="bg-gradient-to-r from-red-500 to-orange-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Target className="w-6 h-6" />
                  Daily Protein Goal
                </h3>
                <p className="text-red-100 mb-3">
                  {workoutData.currentIntake}g / {workoutData.dailyProteinGoal}g consumed today
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Scale className="w-4 h-4" />
                    <span>Current: {workoutData.bodyWeight}lbs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mountain className="w-4 h-4" />
                    <span>Goal: {workoutData.targetWeight}lbs</span>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-2">
                  {Math.round((workoutData.currentIntake / workoutData.dailyProteinGoal) * 100)}%
                </div>
                <Progress 
                  value={(workoutData.currentIntake / workoutData.dailyProteinGoal) * 100} 
                  className="w-32 mb-3" 
                />
                <div className="text-sm">
                  {workoutData.dailyProteinGoal - workoutData.currentIntake}g remaining
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white p-1 rounded-2xl shadow-lg flex gap-1">
            {[
              { id: 'create', label: '🧪 Custom Builder', icon: Plus },
              { id: 'recipes', label: '📋 Popular Recipes', icon: Star },
              { id: 'goals', label: '🎯 Fitness Goals', icon: Target },
              { id: 'timing', label: '⏰ Workout Timing', icon: Timer }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Builder Tab */}
        {activeTab === 'create' && (
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Protein Selection */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Goal & Phase Selection */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Target className="w-5 h-5 text-red-500" />
                      Your Goal
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {fitnessGoals.slice(0, 4).map((goal) => (
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

                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Timer className="w-5 h-5 text-orange-500" />
                      Workout Timing
                    </h3>
                    <div className="space-y-2">
                      {workoutPhases.map((phase) => (
                        <button
                          key={phase.name}
                          onClick={() => setSelectedPhase(phase)}
                          className={`w-full p-3 rounded-lg transition-all text-left ${
                            selectedPhase.name === phase.name 
                              ? 'bg-orange-500 text-white shadow-lg' 
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{phase.icon}</span>
                            <span className="font-bold text-sm">{phase.name}</span>
                          </div>
                          <div className="text-xs opacity-80">{phase.timing}</div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Protein Source Selection */}
              {Object.entries(proteinSources).map(([category, proteins]) => (
                <Card key={category}>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold mb-4 capitalize flex items-center gap-2">
                      <ChefHat className="w-5 h-5 text-red-500" />
                      {category} Proteins
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {proteins.map((protein) => (
                        <button
                          key={protein.name}
                          onClick={() => addProtein(protein, category)}
                          className={`p-4 rounded-lg transition-all text-left border-2 ${
                            customShake.protein?.name === protein.name 
                              ? 'border-red-500 bg-red-50' 
                              : 'border-gray-200 bg-gray-50 hover:bg-red-50 hover:border-red-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{protein.icon}</span>
                            <span className="font-bold text-sm">{protein.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                            <div>Protein: <span className="font-bold">{protein.protein}g</span></div>
                            <div>Calories: <span className="font-bold">{protein.calories}</span></div>
                            <div>Carbs: <span className="font-bold">{protein.carbs}g</span></div>
                            <div>Fat: <span className="font-bold">{protein.fat}g</span></div>
                          </div>
                          <div className="flex justify-between items-center">
                            <Badge className="text-xs">{protein.absorption}</Badge>
                            <span className="text-xs font-bold">{protein.cost}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Supplements & Additives */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    Supplements & Additives
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {additives.map((additive) => {
                      const isSelected = customShake.additives.some(a => a.name === additive.name);
                      return (
                        <button
                          key={additive.name}
                          onClick={() => toggleAdditive(additive)}
                          className={`p-3 rounded-lg transition-all text-left border-2 ${
                            isSelected 
                              ? 'border-yellow-500 bg-yellow-50' 
                              : 'border-gray-200 bg-gray-50 hover:bg-yellow-50 hover:border-yellow-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{additive.icon}</span>
                            <span className="font-bold text-sm">{additive.name}</span>
                          </div>
                          <div className="text-xs text-gray-600 mb-1">{additive.amount}</div>
                          <Badge className="text-xs">{additive.benefit}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Shake Builder Panel */}
            <div className="space-y-6">
              <Card className="sticky top-4">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Your Shake</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCustomShake({ protein: null, additives: [], totalProtein: 0, totalCalories: 0, cost: 0 })}
                      className="flex items-center gap-1"
                    >
                      <Shuffle className="w-4 h-4" />
                      Reset
                    </Button>
                  </div>
                  
                  {/* Current Selection */}
                  <div className="space-y-3 mb-4">
                    {customShake.protein ? (
                      <div className="bg-red-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span>{customShake.protein.icon}</span>
                          <span className="font-bold text-sm">{customShake.protein.name}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {customShake.protein.protein}g protein • {customShake.protein.calories} cal
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">
                        Select a protein source to start
                      </p>
                    )}

                    {customShake.additives.map((additive) => (
                      <div key={additive.name} className="bg-yellow-50 p-2 rounded flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{additive.icon}</span>
                          <span className="text-sm font-medium">{additive.name}</span>
                        </div>
                        <button
                          onClick={() => toggleAdditive(additive)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Nutrition Analysis */}
                  {customShake.protein && (
                    <div className="bg-gradient-to-r from-red-100 to-orange-100 p-4 rounded-lg mb-4">
                      <h4 className="font-bold mb-3 text-red-800">Nutrition Analysis</h4>
                      
                      {/* Goal Targets */}
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-sm">
                          <span>Protein Target:</span>
                          <span className={`font-bold ${
                            isInTargetRange(customShake.totalProtein, selectedGoal.targetProtein) 
                              ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            {customShake.totalProtein}g / {selectedGoal.targetProtein[0]}-{selectedGoal.targetProtein[1]}g
                          </span>
                        </div>
                        <Progress 
                          value={Math.min((customShake.totalProtein / selectedGoal.targetProtein[1]) * 100, 100)} 
                          className="h-2"
                        />
                        
                        <div className="flex justify-between text-sm">
                          <span>Calories:</span>
                          <span className={`font-bold ${
                            isInTargetRange(customShake.totalCalories, selectedGoal.targetCalories) 
                              ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            {customShake.totalCalories} / {selectedGoal.targetCalories[0]}-{selectedGoal.targetCalories[1]}
                          </span>
                        </div>
                        <Progress 
                          value={Math.min((customShake.totalCalories / selectedGoal.targetCalories[1]) * 100, 100)} 
                          className="h-2"
                        />
                      </div>

                      {/* Goal Match Score */}
                      <div className="text-center p-2 bg-white rounded">
                        <div className="text-2xl font-bold text-red-600">
                          {Math.round(
                            ((isInTargetRange(customShake.totalProtein, selectedGoal.targetProtein) ? 50 : 0) +
                             (isInTargetRange(customShake.totalCalories, selectedGoal.targetCalories) ? 50 : 0))
                          )}%
                        </div>
                        <div className="text-xs text-gray-600">Goal Match Score</div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button 
                      onClick={createShake}
                      disabled={!customShake.protein}
                      className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                    >
                      Create Shake (+200 XP)
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
            {popularRecipes.map((recipe) => (
              <Card key={recipe.id} className="overflow-hidden hover:shadow-xl transition-all hover:scale-105">
                <div className="relative">
                  <img 
                    src={recipe.image} 
                    alt={recipe.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-2 left-2">
                    <Badge className={`${getGoalColor(recipe.goal)} text-white`}>
                      {fitnessGoals.find(g => g.id === recipe.goal)?.name}
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
                      <div className="font-bold text-red-600">{recipe.protein}g</div>
                      <div className="text-xs text-gray-600">protein</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-orange-600">{recipe.calories}</div>
                      <div className="text-xs text-gray-600">calories</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-600">{recipe.timing}</div>
                      <div className="text-xs text-gray-600">timing</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 text-sm">Ingredients:</h4>
                    <div className="flex flex-wrap gap-1">
                      {recipe.ingredients.map((ingredient, index) => (
                        <span key={index} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </div>

                  {recipe.supplements.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 text-sm">Supplements:</h4>
                      <div className="flex flex-wrap gap-1">
                        {recipe.supplements.map((supplement, index) => (
                          <span key={index} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            {supplement}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600">
                    Make This (+150 XP)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Fitness Goals Tab */}
        {activeTab === 'goals' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fitnessGoals.map((goal) => (
              <Card key={goal.id} className={`${goal.color} text-white overflow-hidden hover:scale-105 transition-all`}>
                <CardContent className="p-6">
                  <div className="text-center mb-4">
                    <div className="text-6xl mb-4">{goal.icon}</div>
                    <h3 className="text-2xl font-bold mb-3">{goal.name}</h3>
                    <p className="mb-4 opacity-90">
                      {goal.description}
                    </p>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span>Protein Target:</span>
                      <span className="font-bold">{goal.targetProtein[0]}-{goal.targetProtein[1]}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Calories:</span>
                      <span className="font-bold">{goal.targetCalories[0]}-{goal.targetCalories[1]}</span>
                    </div>
                    <div className="text-xs opacity-75 mt-2">
                      <strong>Best timing:</strong> {goal.recommendedTiming.join(', ')}
                    </div>
                    <div className="text-xs opacity-75">
                      <strong>Tip:</strong> {goal.tips}
                    </div>
                  </div>
                  
                  <Button variant="secondary" className="w-full bg-white text-gray-800 hover:bg-gray-100">
                    View Recipes
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Workout Timing Tab */}
        {activeTab === 'timing' && (
          <div className="grid md:grid-cols-2 gap-6">
            {workoutPhases.map((phase) => (
              <Card key={phase.name} className="overflow-hidden hover:shadow-xl transition-all">
                <CardContent className="p-6">
                  <div className="text-center mb-4">
                    <div className="text-4xl mb-3">{phase.icon}</div>
                    <h3 className="text-xl font-bold mb-2">{phase.name}</h3>
                    <Badge className="mb-3">{phase.timing}</Badge>
                    <p className="text-gray-600 mb-4">{phase.focus}</p>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-semibold">Recommended for this phase:</h4>
                    {phase.name === 'Pre-Workout' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Fast-absorbing protein:</span>
                          <span className="font-bold">15-25g</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Caffeine:</span>
                          <span className="font-bold">100-200mg</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Creatine:</span>
                          <span className="font-bold">3-5g</span>
                        </div>
                      </div>
                    )}
                    
                    {phase.name === 'Post-Workout' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Protein:</span>
                          <span className="font-bold">25-40g</span>
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
                  
                  <Button className="w-full mt-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600">
                    Build {phase.name} Shake
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
