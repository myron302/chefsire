import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, ArrowRight,
  Search
} from 'lucide-react';

// ✅ Import the universal search and context
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';

type Params = { params?: Record<string, string> };

// Mock data for detox programs
const detoxPrograms = [
  {
    id: 'detox-program-1',
    name: "Green Goddess 3-Day Reset",
    duration: "3 days",
    difficulty: "Beginner",
    participants: 2847,
    rating: 4.8,
    description: "Gentle introduction to detoxing with nutrient-rich green juices",
    benefits: ["Increased Energy", "Better Digestion", "Clearer Skin"],
    calories: "800-1000/day",
    image: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop",
    featured: true,
    trending: true
  },
  {
    id: 'detox-program-2',
    name: "Citrus Burst 1-Day Cleanse",
    duration: "1 day",
    difficulty: "Beginner", 
    participants: 1563,
    rating: 4.6,
    description: "Quick vitamin C boost with energizing citrus blends",
    benefits: ["Vitamin C Boost", "Immune Support", "Mental Clarity"],
    calories: "600-800/day",
    image: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&h=300&fit=crop",
    featured: false,
    trending: false
  },
  {
    id: 'detox-program-3',
    name: "Ultimate 7-Day Transformation",
    duration: "7 days",
    difficulty: "Advanced",
    participants: 892,
    rating: 4.9,
    description: "Complete body reset with structured meal plans and supplements",
    benefits: ["Deep Cleanse", "Weight Loss", "Habit Reset", "Increased Metabolism"],
    calories: "1000-1200/day",
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop",
    featured: true,
    trending: true
  }
];

const quickDetoxes = [
  {
    id: 'quick-detox-1',
    name: "Morning Kickstart",
    time: "5 min",
    ingredients: ["Lemon", "Ginger", "Cayenne", "Water"],
    benefits: "Metabolism boost",
    icon: "🌅"
  },
  {
    id: 'quick-detox-2',
    name: "Green Power Shot",
    time: "3 min", 
    ingredients: ["Spinach", "Apple", "Cucumber", "Mint"],
    benefits: "Instant energy",
    icon: "⚡"
  },
  {
    id: 'quick-detox-3',
    name: "Afternoon Refresh",
    time: "4 min",
    ingredients: ["Cucumber", "Lime", "Coconut Water"],
    benefits: "Hydration boost",
    icon: "💧"
  }
];

// ✅ Detox subcategories for navigation
const detoxSubcategories = [
  { id: 'juice', name: 'Juice Cleanses', icon: Droplets, count: 8, route: '/drinks/detoxes/juice' },
  { id: 'green', name: 'Green Detoxes', icon: Leaf, count: 6, route: '/drinks/detoxes/green' },
  { id: 'tea', name: 'Detox Teas', icon: Calendar, count: 5, route: '/drinks/detoxes/tea' },
  { id: 'water', name: 'Infused Waters', icon: Droplets, count: 4, route: '/drinks/detoxes/water' }
];

export default function DetoxesPage({ params }: Params) {
  // ✅ Use the drinks context
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

  const type = params?.type?.replaceAll("-", " ");
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [currentChallenge, setCurrentChallenge] = useState({
    name: "7-Day Green Challenge",
    progress: 65,
    participants: 1247,
    daysLeft: 2
  });
  const [showSuccess, setShowSuccess] = useState(false);

  // ✅ Get recommendations from context
  const recommendations = getRecommendations('detoxes');

  // ✅ Enhanced handleStartProgram with context integration
  const handleStartProgram = (program) => {
    const detoxData = {
      id: program.id,
      name: program.name,
      category: 'detoxes' as const,
      description: program.description,
      ingredients: ['Various detox ingredients'],
      nutrition: {
        calories: parseInt(program.calories.split('-')[0]) || 800,
        protein: 5,
        carbs: 30,
        fat: 2
      },
      difficulty: program.difficulty as 'Easy' | 'Medium' | 'Hard',
      prepTime: parseInt(program.duration) * 24 * 60, // Convert days to minutes
      rating: program.rating,
      fitnessGoal: 'Detox',
      bestTime: 'Morning'
    };

    setSelectedProgram(program);
    setShowSuccess(true);
    
    // ✅ Update context
    addToRecentlyViewed(detoxData);
    incrementDrinksMade();
    addPoints(100);
    
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // ✅ Enhanced makeQuickDetox with context integration
  const makeQuickDetox = (shot) => {
    const detoxData = {
      id: shot.id,
      name: shot.name,
      category: 'detoxes' as const,
      description: `Quick ${shot.benefits.toLowerCase()} detox shot`,
      ingredients: shot.ingredients,
      nutrition: {
        calories: 25,
        protein: 1,
        carbs: 6,
        fat: 0
      },
      difficulty: 'Easy' as const,
      prepTime: parseInt(shot.time),
      rating: 4.5,
      fitnessGoal: 'Detox',
      bestTime: 'Morning'
    };

    addToRecentlyViewed(detoxData);
    incrementDrinksMade();
    addPoints(25);
    
    console.log(`Made ${shot.name}! +25 XP`);
  };

  // ✅ Handle cross-page drink selection
  const handleDrinkSelection = (drink) => {
    console.log('Selected drink from universal search:', drink);
  };

  const getDifficultyColor = (difficulty) => {
    switch(difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Success Animation */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-green-500 text-white p-6 rounded-2xl shadow-2xl animate-bounce">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Detox Started! 🌱</h2>
              <p className="text-lg">+{selectedProgram ? '100' : '25'} XP earned!</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
        
        {/* Header with User Stats */}
        <div className="text-center relative">
          {/* ✅ Enhanced User Stats with Context Data */}
          <div className="absolute top-0 right-0 bg-white rounded-2xl p-4 shadow-lg border">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="font-bold">Level {userProgress.level}</span>
              </div>
              <div className="flex items-center gap-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="font-bold">{userProgress.currentStreak} day streak</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-blue-500" />
                <span className="font-bold">{userProgress.totalPoints} XP</span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Detox & Cleanse Hub 🌿
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Transform your body, boost your energy, and reset your health
          </p>
          
          {type && (
            <Badge className="mb-4 text-lg px-4 py-2 bg-green-100 text-green-800">
              {type}
            </Badge>
          )}
        </div>

        {/* ✅ Universal Search Component */}
        <div className="max-w-2xl mx-auto mb-8">
          <UniversalSearch 
            onSelectDrink={handleDrinkSelection}
            placeholder="Search all drinks or find detox inspiration..."
            className="w-full"
          />
        </div>

        {/* ✅ Detox Subcategories Navigation */}
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-green-500" />
              Explore Detox Types
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {detoxSubcategories.map((subcategory) => {
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

        {/* ✅ Favorites Quick Access */}
        {favorites.filter(f => f.category === 'detoxes').length > 0 && (
          <Card className="bg-gradient-to-r from-green-100 to-teal-100 border-green-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-green-500" />
                Your Favorite Detoxes ({favorites.filter(f => f.category === 'detoxes').length})
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {favorites.filter(f => f.category === 'detoxes').slice(0, 5).map((drink) => (
                  <div key={drink.id} className="flex-shrink-0 bg-white rounded-lg p-3 shadow-sm min-w-[200px]">
                    <div className="font-medium text-sm mb-1">{drink.name}</div>
                    <div className="text-xs text-gray-600 mb-2">Detox program</div>
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      Start Again
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ✅ Enhanced Current Challenge Banner with User Progress */}
        <Card className="bg-gradient-to-r from-green-500 to-teal-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Target className="w-6 h-6" />
                  {currentChallenge.name}
                </h3>
                <p className="text-green-100 mb-3">
                  Join {currentChallenge.participants.toLocaleString()} others in this community challenge
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Timer className="w-4 h-4" />
                    <span>{currentChallenge.daysLeft} days left</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{currentChallenge.participants.toLocaleString()} participants</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Trophy className="w-4 h-4" />
                    <span>Level {userProgress.level}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold mb-2">{currentChallenge.progress}%</div>
                <Progress value={currentChallenge.progress} className="w-32 mb-3" />
                <Button variant="secondary" className="bg-white text-green-600 hover:bg-green-50">
                  Continue Challenge
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ✅ Enhanced Quick Detox Shots with Context Integration */}
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Quick Detox Shots
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {quickDetoxes.map((shot, index) => (
              <Card key={index} className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{shot.icon}</span>
                      <div>
                        <h3 className="font-bold">{shot.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span>{shot.time}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const shotData = {
                          id: shot.id,
                          name: shot.name,
                          category: 'detoxes' as const,
                          description: `Quick ${shot.benefits.toLowerCase()} detox shot`,
                          ingredients: shot.ingredients,
                          nutrition: { calories: 25, protein: 1, carbs: 6, fat: 0 },
                          difficulty: 'Easy' as const,
                          prepTime: parseInt(shot.time),
                          rating: 4.5,
                          fitnessGoal: 'Detox',
                          bestTime: 'Morning'
                        };
                        addToFavorites(shotData);
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Heart className={`h-4 w-4 ${isFavorite(shot.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1">
                      {shot.ingredients.map((ingredient, i) => (
                        <span key={i} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{shot.benefits}</p>
                  <Button 
                    size="sm" 
                    className="w-full bg-green-500 hover:bg-green-600"
                    onClick={() => makeQuickDetox(shot)}
                  >
                    Make Now (+25 XP)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ✅ Enhanced Featured Detox Programs with Context Integration */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-purple-500" />
              Detox Programs
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-1" />
                1 Day
              </Button>
              <Button variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-1" />
                3 Days
              </Button>
              <Button variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-1" />
                7+ Days
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {detoxPrograms.map((program) => (
              <Card key={program.id} className={`relative overflow-hidden transition-all hover:scale-105 hover:shadow-xl ${program.featured ? 'ring-2 ring-purple-500' : ''}`}>
                {program.featured && (
                  <div className="absolute top-2 left-2 z-10">
                    <Badge className="bg-purple-500 text-white">
                      <Star className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  </div>
                )}
                {program.trending && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge className="bg-red-500 text-white">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Trending
                    </Badge>
                  </div>
                )}
                
                <div className="relative">
                  <img 
                    src={program.image} 
                    alt={program.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-2 left-2 text-white">
                    <Badge className={getDifficultyColor(program.difficulty)}>
                      {program.difficulty}
                    </Badge>
                  </div>
                  <div className="absolute top-2 left-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const programData = {
                          id: program.id,
                          name: program.name,
                          category: 'detoxes' as const,
                          description: program.description,
                          ingredients: ['Various detox ingredients'],
                          nutrition: {
                            calories: parseInt(program.calories.split('-')[0]) || 800,
                            protein: 5,
                            carbs: 30,
                            fat: 2
                          },
                          difficulty: program.difficulty as 'Easy' | 'Medium' | 'Hard',
                          prepTime: parseInt(program.duration) * 24 * 60,
                          rating: program.rating,
                          fitnessGoal: 'Detox',
                          bestTime: 'Morning'
                        };
                        addToFavorites(programData);
                      }}
                      className="bg-white/80 hover:bg-white text-gray-600 hover:text-red-500"
                    >
                      <Heart className={`h-4 w-4 ${isFavorite(program.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>
                </div>

                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold">{program.name}</h3>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-bold">{program.rating}</span>
                    </div>
                  </div>

                  <p className="text-gray-600 mb-4">{program.description}</p>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>{program.duration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      <span>{program.participants.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Apple className="w-4 h-4 text-red-500" />
                      <span>{program.calories}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-pink-500" />
                      <span>Health boost</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 text-sm">Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {program.benefits.map((benefit, index) => (
                        <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {benefit}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700"
                    onClick={() => handleStartProgram(program)}
                  >
                    Start Program (+100 XP)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ✅ Enhanced Achievement Showcase with Context Data */}
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-6">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-600" />
              Your Achievements
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {userProgress.achievements.map((badge, index) => (
                <div key={index} className="flex items-center gap-3 bg-white rounded-lg p-3 shadow-sm">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{badge}</div>
                    <div className="text-xs text-gray-600">Unlocked!</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                You've completed <span className="font-bold text-green-600">{userProgress.totalDrinksMade}</span> drinks 
                and earned <span className="font-bold text-blue-600">{userProgress.totalPoints}</span> total XP!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Community Feed Preview */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-500" />
              Community Activity
            </h3>
            <div className="space-y-3">
              {[
                { user: "Sarah_Wellness", action: "completed", program: "Green Goddess 3-Day", time: "2 hours ago" },
                { user: "HealthyMike92", action: "started", program: "Citrus Burst Cleanse", time: "4 hours ago" },
                { user: "DetoxQueen", action: "shared", program: "Ultimate 7-Day", time: "6 hours ago" }
              ].map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {activity.user[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-bold">{activity.user}</span> {activity.action} <span className="text-green-600 font-medium">{activity.program}</span>
                    </p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                  <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 cursor-pointer" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ✅ Cross-Page Integration Footer */}
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Explore More Drinks</h3>
                <p className="text-gray-600 mb-4">Discover smoothies, protein shakes, and cocktails</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Smoothies</Button>
                  <Button variant="outline" size="sm">Protein Shakes</Button>
                  <Button variant="outline" size="sm">Cocktails</Button>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">{userProgress.totalDrinksMade}</div>
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
