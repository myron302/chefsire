import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Dumbbell, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Search, Filter, Shuffle, Camera, Share2, ArrowLeft,
  Activity, BarChart3, Sparkles, Play, Pause
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';

// Workout-specific smoothie data
const workoutSmoothies = [
  {
    id: 'workout-1',
    name: 'Pre-Workout Power Boost',
    description: 'Natural energy blend with caffeine from green tea and guarana',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
    nutrition: { calories: 280, protein: 12, carbs: 45, fat: 6 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 892,
    trending: true,
    featured: true,
    tags: ['Pre-workout', 'Energy', 'Caffeine', 'Natural'],
    ingredients: ['Banana', 'Green tea matcha', 'Guarana', 'Coconut water', 'Dates', 'Chia seeds'],
    instructions: 'Blend all ingredients until smooth. Consume 30-45 minutes before workout.',
    benefits: ['Sustained energy', 'Enhanced focus', 'Natural caffeine', 'Electrolyte balance'],
    bestTime: 'Pre-workout (30-45 min)',
    workoutType: 'Pre-workout',
    energyLevel: 'High',
    caffeineContent: '80mg'
  },
  {
    id: 'workout-2',
    name: 'Post-Workout Recovery Shake',
    description: 'Protein-rich recovery blend optimized for muscle repair',
    image: 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=400&h=300&fit=crop',
    nutrition: { calories: 420, protein: 25, carbs: 48, fat: 12 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 1203,
    trending: false,
    featured: true,
    tags: ['Post-workout', 'Recovery', 'High protein', 'Muscle repair'],
    ingredients: ['Vanilla protein powder', 'Banana', 'Blueberries', 'Greek yogurt', 'Almond milk', 'Honey'],
    instructions: 'Blend until creamy. Consume within 30 minutes post-workout for optimal recovery.',
    benefits: ['Muscle recovery', 'Protein synthesis', 'Glycogen replenishment', 'Reduced soreness'],
    bestTime: 'Post-workout (0-30 min)',
    workoutType: 'Post-workout',
    energyLevel: 'Recovery',
    proteinContent: '25g'
  },
  {
    id: 'workout-3',
    name: 'Endurance Fuel Smoothie',
    description: 'Complex carb blend for sustained energy during long workouts',
    nutrition: { calories: 350, protein: 8, carbs: 65, fat: 4 },
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.6,
    reviews: 567,
    trending: true,
    featured: false,
    tags: ['Endurance', 'Complex carbs', 'Sustained energy', 'Hydration'],
    ingredients: ['Oats', 'Sweet potato', 'Apple', 'Spinach', 'Coconut water', 'Ginger'],
    instructions: 'Steam sweet potato first, then blend all ingredients. Perfect for endurance activities.',
    benefits: ['Sustained energy', 'Complex carbohydrates', 'Hydration', 'Anti-inflammatory'],
    bestTime: 'Pre-workout (60-90 min)',
    workoutType: 'Endurance',
    energyLevel: 'Sustained',
    carbContent: '65g'
  },
  {
    id: 'workout-4',
    name: 'HIIT Recovery Smoothie',
    description: 'Quick recovery blend for high-intensity interval training',
    nutrition: { calories: 300, protein: 20, carbs: 35, fat: 8 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 445,
    trending: false,
    featured: false,
    tags: ['HIIT', 'Quick recovery', 'Antioxidants', 'Anti-inflammatory'],
    ingredients: ['Tart cherry juice', 'Protein powder', 'Spinach', 'Pineapple', 'Ginger', 'Coconut milk'],
    instructions: 'Blend until smooth. The tart cherries help reduce inflammation from intense training.',
    benefits: ['Reduced inflammation', 'Quick recovery', 'Antioxidants', 'Muscle repair'],
    bestTime: 'Post-HIIT (immediately)',
    workoutType: 'HIIT',
    energyLevel: 'Recovery',
    antioxidants: 'High'
  },
  {
    id: 'workout-5',
    name: 'Strength Training Builder',
    description: 'High-protein blend optimized for muscle building and strength',
    nutrition: { calories: 480, protein: 30, carbs: 42, fat: 18 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 723,
    trending: false,
    featured: true,
    tags: ['Strength training', 'Muscle building', 'High protein', 'Calorie dense'],
    ingredients: ['Chocolate protein powder', 'Peanut butter', 'Banana', 'Oats', 'Whole milk', 'Creatine'],
    instructions: 'Blend all ingredients. Add creatine for enhanced strength gains. Perfect for bulking phases.',
    benefits: ['Muscle building', 'Strength gains', 'Calorie dense', 'Creatine boost'],
    bestTime: 'Post-strength training',
    workoutType: 'Strength',
    energyLevel: 'Building',
    creatineContent: '5g'
  },
  {
    id: 'workout-6',
    name: 'Morning Yoga Energizer',
    description: 'Light, energizing blend perfect for yoga and mindful movement',
    nutrition: { calories: 180, protein: 6, carbs: 32, fat: 4 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.4,
    reviews: 334,
    trending: false,
    featured: false,
    tags: ['Yoga', 'Morning', 'Light', 'Mindful'],
    ingredients: ['Mango', 'Coconut water', 'Lime', 'Mint', 'Spirulina', 'Agave'],
    instructions: 'Blend gently for a light, refreshing smoothie. Perfect before yoga or gentle movement.',
    benefits: ['Light energy', 'Hydration', 'Mental clarity', 'Digestive friendly'],
    bestTime: 'Pre-yoga (30 min)',
    workoutType: 'Yoga',
    energyLevel: 'Gentle',
    mindfulness: 'Enhanced'
  }
];

const workoutTypes = [
  { 
    id: 'pre-workout', 
    name: 'Pre-Workout', 
    icon: Zap,
    color: 'bg-orange-500',
    description: 'Energy and focus for peak performance',
    timing: '30-60 minutes before',
    focus: 'Energy & Focus'
  },
  { 
    id: 'post-workout', 
    name: 'Post-Workout', 
    icon: Target,
    color: 'bg-green-500',
    description: 'Recovery and muscle repair',
    timing: '0-30 minutes after',
    focus: 'Recovery & Repair'
  },
  { 
    id: 'endurance', 
    name: 'Endurance', 
    icon: Activity,
    color: 'bg-blue-500',
    description: 'Sustained energy for long activities',
    timing: '60-90 minutes before',
    focus: 'Sustained Energy'
  },
  { 
    id: 'strength', 
    name: 'Strength Training', 
    icon: Dumbbell,
    color: 'bg-red-500',
    description: 'Muscle building and strength gains',
    timing: 'Post-workout',
    focus: 'Muscle Building'
  },
  { 
    id: 'hiit', 
    name: 'HIIT Recovery', 
    icon: Flame,
    color: 'bg-purple-500',
    description: 'Quick recovery from intense training',
    timing: 'Immediately after',
    focus: 'Quick Recovery'
  },
  { 
    id: 'yoga', 
    name: 'Yoga & Mindful', 
    icon: Leaf,
    color: 'bg-teal-500',
    description: 'Light energy for mindful movement',
    timing: '30 minutes before',
    focus: 'Mindful Energy'
  }
];

export default function WorkoutSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedWorkoutType, setSelectedWorkoutType] = useState('');
  const [selectedIntensity, setSelectedIntensity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');

  // Filter and sort smoothies
  const getFilteredSmoothies = () => {
    let filtered = workoutSmoothies.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesWorkoutType = !selectedWorkoutType || smoothie.workoutType.toLowerCase().includes(selectedWorkoutType.toLowerCase());
      const matchesIntensity = !selectedIntensity || smoothie.energyLevel.toLowerCase().includes(selectedIntensity.toLowerCase());
      
      return matchesSearch && matchesWorkoutType && matchesIntensity;
    });

    // Sort results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition?.protein || 0) - (a.nutrition?.protein || 0);
        case 'calories': return (a.nutrition?.calories || 0) - (b.nutrition?.calories || 0);
        case 'time': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = workoutSmoothies.filter(smoothie => smoothie.featured);
  const trendingSmoothies = workoutSmoothies.filter(smoothie => smoothie.trending);

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
      fitnessGoal: smoothie.workoutType,
      bestTime: smoothie.bestTime
    });
    incrementDrinksMade();
    addPoints(30);
    
    console.log(`Made ${smoothie.name}! +30 XP`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Header */}
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
                <Activity className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">Workout Smoothies</h1>
                <Badge className="bg-orange-100 text-orange-800">Performance</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
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
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">15g+</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">4.6★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">4 min</div>
              <div className="text-sm text-gray-600">Avg Prep</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">6</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'types', label: 'Workout Types', icon: Activity },
            { id: 'timing', label: 'By Timing', icon: Clock },
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

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div>
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search workout smoothies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedWorkoutType}
                  onChange={(e) => setSelectedWorkoutType(e.target.value)}
                >
                  <option value="">All Workout Types</option>
                  {workoutTypes.map(type => (
                    <option key={type.id} value={type.name}>{type.name}</option>
                  ))}
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedIntensity}
                  onChange={(e) => setSelectedIntensity(e.target.value)}
                >
                  <option value="">All Intensities</option>
                  <option value="High">High Energy</option>
                  <option value="Recovery">Recovery</option>
                  <option value="Sustained">Sustained</option>
                  <option value="Gentle">Gentle</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
                  <option value="calories">Sort by Calories</option>
                  <option value="time">Sort by Prep Time</option>
                </select>
              </div>
            </div>

            {/* Results */}
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
                          fitnessGoal: smoothie.workoutType,
                          bestTime: smoothie.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{smoothie.workoutType}</Badge>
                      <Badge className="bg-orange-100 text-orange-800">{smoothie.energyLevel}</Badge>
                      {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Nutrition Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-orange-600">{smoothie.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="font-bold text-green-600">{smoothie.nutrition.calories}</div>
                        <div className="text-gray-500">Calories</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">{smoothie.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                    </div>

                    {/* Key Info */}
                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium text-xs">{smoothie.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Energy Level:</span>
                        <span className="font-medium">{smoothie.energyLevel}</span>
                      </div>
                    </div>

                    {/* Rating */}
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

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                        onClick={() => handleMakeSmoothie(smoothie)}
                      >
                        <Zap className="h-4 w-4 mr-2" />
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

        {/* Workout Types Tab */}
        {activeTab === 'types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workoutTypes.map(type => {
              const Icon = type.icon;
              const typeSmoothies = workoutSmoothies.filter(smoothie => 
                smoothie.workoutType.toLowerCase().includes(type.id.replace('-', ' '))
              );
              
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${type.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${type.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{type.name}</CardTitle>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Timing:</span>
                        <span className="font-medium">{type.timing}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Focus:</span>
                        <span className="font-medium">{type.focus}</span>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color.replace('bg-', 'text-')} mb-1`}>
                        {typeSmoothies.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedWorkoutType(type.name);
                          setActiveTab('browse');
                        }}
                      >
                        View {type.name} Smoothies
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Timing Tab */}
        {activeTab === 'timing' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['Pre-workout', 'Post-workout', 'Anytime'].map(timing => {
                const timingSmoothies = workoutSmoothies.filter(smoothie => 
                  timing === 'Pre-workout' ? smoothie.bestTime.includes('Pre') :
                  timing === 'Post-workout' ? smoothie.bestTime.includes('Post') || smoothie.bestTime.includes('after') :
                  !smoothie.bestTime.includes('Pre') && !smoothie.bestTime.includes('Post')
                );
                
                return (
                  <Card key={timing} className="p-6">
                    <h3 className="text-xl font-bold mb-4 text-center">{timing}</h3>
                    <div className="space-y-3">
                      {timingSmoothies.slice(0, 3).map(smoothie => (
                        <div key={smoothie.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">{smoothie.name}</div>
                            <div className="text-xs text-gray-600">{smoothie.nutrition.calories} cal</div>
                          </div>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Featured Tab */}
        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  {smoothie.image && (
                    <img 
                      src={smoothie.image} 
                      alt={smoothie.name}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-yellow-500 text-white">Featured</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{smoothie.workoutType}</Badge>
                    <Badge className="bg-orange-100 text-orange-800">{smoothie.energyLevel}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{smoothie.rating}</span>
                      <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Enhanced nutrition display */}
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{smoothie.nutrition.protein}g</div>
                      <div className="text-xs text-gray-600">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{smoothie.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.carbs}g</div>
                      <div className="text-xs text-gray-600">Carbs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">{smoothie.prepTime}min</div>
                      <div className="text-xs text-gray-600">Prep</div>
                    </div>
                  </div>

                  {/* Detailed info */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Best Time:</span>
                      <span className="font-medium">{smoothie.bestTime}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Energy Level:</span>
                      <span className="font-medium">{smoothie.energyLevel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Workout Type:</span>
                      <span className="font-medium">{smoothie.workoutType}</span>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Key Ingredients:</h4>
                    <div className="flex flex-wrap gap-1">
                      {smoothie.ingredients.slice(0, 4).map((ingredient, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {ingredient}
                        </Badge>
                      ))}
                      {smoothie.ingredients.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{smoothie.ingredients.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Key Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {smoothie.benefits.map((benefit, index) => (
                        <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleMakeSmoothie(smoothie)}
                    >
                      <Zap className="h-4 w-4 mr-2" />
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
              <Activity className="h-4 w-4 text-orange-600" />
              <span className="text-gray-600">Smoothies Found:</span>
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
