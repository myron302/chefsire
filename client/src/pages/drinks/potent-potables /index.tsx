import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Search, Filter, Shuffle, Camera, Share2, BookOpen,
  Wine, Coffee, GlassWater, MessageCircle, ThumbsUp, 
  Eye, Play, Pause, RotateCcw, Crown, Gem
} from 'lucide-react';

// Mock data - replace with your actual API calls
const mockDrinks = [
  {
    id: "1",
    name: "Cosmic Martini",
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop",
    category: "Cocktail",
    alcoholic: "Alcoholic",
    difficulty: "Medium",
    prepTime: 5,
    rating: 4.8,
    reviews: 234,
    calories: 180,
    trending: true,
    featured: false,
    ingredients: ["Vodka", "Blue Curacao", "Lime Juice", "Simple Syrup"],
    instructions: "Shake with ice, strain into chilled glass, garnish with star fruit",
    tags: ["Party", "Elegant", "Blue"],
    createdBy: "MixMaster_Alex",
    likes: 1247,
    shares: 89,
    collections: 156
  },
  {
    id: "2", 
    name: "Tropical Sunset",
    image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop",
    category: "Mocktail",
    alcoholic: "Non_Alcoholic", 
    difficulty: "Easy",
    prepTime: 3,
    rating: 4.6,
    reviews: 156,
    calories: 120,
    trending: false,
    featured: true,
    ingredients: ["Orange Juice", "Pineapple Juice", "Grenadine", "Ice"],
    instructions: "Layer ingredients carefully for sunset effect",
    tags: ["Tropical", "Refreshing", "Family-Friendly"],
    createdBy: "SunsetSipper",
    likes: 892,
    shares: 67,
    collections: 234
  },
  {
    id: "3",
    name: "Midnight Express",
    image: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=300&fit=crop",
    category: "Coffee Cocktail",
    alcoholic: "Alcoholic",
    difficulty: "Hard",
    prepTime: 8,
    rating: 4.9,
    reviews: 89,
    calories: 220,
    trending: true,
    featured: true,
    ingredients: ["Espresso", "Kahlua", "Vodka", "Cream"],
    instructions: "Brew fresh espresso, combine with spirits, top with cream",
    tags: ["Coffee", "Night", "Sophisticated"],
    createdBy: "CaffeineCrafter",
    likes: 445,
    shares: 34,
    collections: 123
  },
  {
    id: "4",
    name: "Berry Bliss Smoothie",
    image: "https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=400&h=300&fit=crop",
    category: "Smoothie",
    alcoholic: "Non_Alcoholic",
    difficulty: "Easy", 
    prepTime: 2,
    rating: 4.7,
    reviews: 312,
    calories: 95,
    trending: true,
    featured: false,
    ingredients: ["Mixed Berries", "Banana", "Yogurt", "Honey"],
    instructions: "Blend all ingredients until smooth, serve immediately",
    tags: ["Healthy", "Breakfast", "Antioxidants"],
    createdBy: "HealthyHabits",
    likes: 1089,
    shares: 156,
    collections: 287
  },
  {
    id: "5",
    name: "Golden Turmeric Latte",
    image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&h=300&fit=crop",
    category: "Wellness Drink",
    alcoholic: "Non_Alcoholic",
    difficulty: "Medium",
    prepTime: 7,
    rating: 4.5,
    reviews: 178,
    calories: 140,
    trending: false,
    featured: true,
    ingredients: ["Turmeric", "Coconut Milk", "Ginger", "Cinnamon", "Honey"],
    instructions: "Heat milk, whisk in spices, strain and serve warm",
    tags: ["Anti-inflammatory", "Cozy", "Wellness"],
    createdBy: "WellnessWizard",
    likes: 634,
    shares: 89,
    collections: 245
  },
  {
    id: "6",
    name: "Sparkling Elderflower",
    image: "https://images.unsplash.com/photo-1571988840298-3b5301d5109b?w=400&h=300&fit=crop",
    category: "Sparkling",
    alcoholic: "Non_Alcoholic",
    difficulty: "Easy",
    prepTime: 2,
    rating: 4.4,
    reviews: 97,
    calories: 85,
    trending: false,
    featured: false,
    ingredients: ["Elderflower Cordial", "Sparkling Water", "Lime", "Mint"],
    instructions: "Mix cordial with sparkling water, garnish with lime and mint",
    tags: ["Floral", "Refreshing", "Light"],
    createdBy: "BubbleMaster",
    likes: 456,
    shares: 34,
    collections: 123
  }
];

const quickFilters = [
  { id: "trending", label: "🔥 Trending", color: "bg-red-500" },
  { id: "easy", label: "⚡ Quick & Easy", color: "bg-green-500" },
  { id: "featured", label: "⭐ Featured", color: "bg-yellow-500" },
  { id: "alcoholic", label: "🍸 Alcoholic", color: "bg-purple-500" },
  { id: "mocktail", label: "🥤 Mocktails", color: "bg-blue-500" },
  { id: "coffee", label: "☕ Coffee", color: "bg-amber-600" }
];

const categories = [
  { name: "Cocktails", icon: Wine, count: 2847, color: "text-purple-500" },
  { name: "Mocktails", icon: GlassWater, count: 1234, color: "text-blue-500" },
  { name: "Coffee Drinks", icon: Coffee, count: 567, color: "text-amber-500" },
  { name: "Wine Cocktails", icon: Wine, count: 389, color: "text-red-500" },
  { name: "Shots", icon: Zap, count: 456, color: "text-orange-500" },
  { name: "Punches", icon: Droplets, count: 234, color: "text-teal-500" }
];

const achievements = [
  { id: "mixmaster", name: "Mix Master", description: "Create 10 drinks", progress: 7, total: 10, icon: Trophy, unlocked: false },
  { id: "trendwatcher", name: "Trend Watcher", description: "Try 5 trending drinks", progress: 3, total: 5, icon: TrendingUp, unlocked: false },
  { id: "socialite", name: "Social Butterfly", description: "Share 20 drinks", progress: 15, total: 20, icon: Share2, unlocked: false },
  { id: "collector", name: "Recipe Collector", description: "Save 50 recipes", progress: 50, total: 50, icon: BookOpen, unlocked: true }
];

export default function PotentPotablesPage() {
  const [selectedDrink, setSelectedDrink] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [activeFilters, setActiveFilters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAchievements, setShowAchievements] = useState(false);
  const [mixingAnimation, setMixingAnimation] = useState(false);
  const [userPoints, setUserPoints] = useState(2847);
  const [userLevel, setUserLevel] = useState(12);
  const [likedDrinks, setLikedDrinks] = useState(new Set());
  const [dailyChallenge, setDailyChallenge] = useState({
    title: "Tropical Tuesday",
    description: "Make a tropical drink to earn 50 bonus points!",
    progress: 0,
    total: 1,
    reward: 50
  });

  const filteredDrinks = mockDrinks.filter(drink => {
    const matchesSearch = drink.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         drink.ingredients.some(ing => ing.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilters = activeFilters.length === 0 || activeFilters.some(filter => {
      switch(filter) {
        case 'trending': return drink.trending;
        case 'easy': return drink.difficulty === 'Easy';
        case 'featured': return drink.featured;
        case 'alcoholic': return drink.alcoholic === 'Alcoholic';
        case 'mocktail': return drink.alcoholic === 'Non_Alcoholic';
        case 'coffee': return drink.category.includes('Coffee');
        default: return true;
      }
    });
    
    return matchesSearch && matchesFilters;
  });

  const toggleFilter = (filterId) => {
    setActiveFilters(prev => 
      prev.includes(filterId) 
        ? prev.filter(f => f !== filterId)
        : [...prev, filterId]
    );
  };

  const handleLikeDrink = (drinkId) => {
    setLikedDrinks(prev => {
      const newLiked = new Set(prev);
      if (newLiked.has(drinkId)) {
        newLiked.delete(drinkId);
      } else {
        newLiked.add(drinkId);
        setUserPoints(points => points + 5);
      }
      return newLiked;
    });
  };

  const handleStartMixing = (drink) => {
    setMixingAnimation(true);
    setSelectedDrink(drink);
    setTimeout(() => {
      setMixingAnimation(false);
      setUserPoints(prev => prev + 25);
      // Check if this completes daily challenge
      if (drink.tags.includes('Tropical') && dailyChallenge.progress === 0) {
        setDailyChallenge(prev => ({ ...prev, progress: 1 }));
        setUserPoints(prev => prev + dailyChallenge.reward);
      }
    }, 3000);
  };

  const handleShareDrink = (drinkId) => {
    setUserPoints(prev => prev + 10);
    // Simulate share action
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <GlassWater className="h-10 w-10" />
                Potent Potables
                <Badge className="bg-yellow-400 text-yellow-900 ml-2">
                  <Crown className="h-3 w-3 mr-1" />
                  Premium
                </Badge>
              </h1>
              <p className="text-xl opacity-90">Your ultimate mixology destination</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{userPoints.toLocaleString()} pts</div>
              <div className="text-sm opacity-80">Level {userLevel} Mixologist</div>
            </div>
          </div>

          {/* Daily Challenge */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-400 p-2 rounded-full">
                    <Gift className="h-5 w-5 text-yellow-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{dailyChallenge.title}</h3>
                    <p className="text-sm opacity-80">{dailyChallenge.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">+{dailyChallenge.reward} pts</div>
                  <Progress value={(dailyChallenge.progress / dailyChallenge.total) * 100} className="w-20 h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search drinks, ingredients, or creators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-lg"
              />
            </div>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setShowAchievements(!showAchievements)}
              className="flex items-center gap-2"
            >
              <Trophy className="h-5 w-5" />
              Achievements
            </Button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            {quickFilters.map(filter => (
              <Badge
                key={filter.id}
                variant={activeFilters.includes(filter.id) ? "default" : "outline"}
                className={`cursor-pointer px-3 py-1 transition-all hover:scale-105 ${
                  activeFilters.includes(filter.id) ? filter.color + ' text-white' : ''
                }`}
                onClick={() => toggleFilter(filter.id)}
              >
                {filter.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Achievements Panel */}
        {showAchievements && (
          <Card className="mb-6 border-2 border-yellow-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Your Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {achievements.map(achievement => (
                  <div key={achievement.id} className={`p-4 rounded-lg border ${achievement.unlocked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <achievement.icon className={`h-5 w-5 ${achievement.unlocked ? 'text-green-500' : 'text-gray-400'}`} />
                        <span className="font-semibold">{achievement.name}</span>
                      </div>
                      {achievement.unlocked && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                    <Progress value={(achievement.progress / achievement.total) * 100} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">{achievement.progress}/{achievement.total}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categories Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {categories.map(category => (
            <Card key={category.name} className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1">
              <CardContent className="p-4 text-center">
                <category.icon className={`h-8 w-8 mx-auto mb-2 ${category.color}`} />
                <h3 className="font-semibold text-sm">{category.name}</h3>
                <p className="text-xs text-gray-500">{category.count} recipes</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Drinks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDrinks.map(drink => (
            <Card key={drink.id} className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
              <div className="relative">
                <img 
                  src={drink.image} 
                  alt={drink.name}
                  className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2 flex gap-1">
                  {drink.trending && (
                    <Badge className="bg-red-500 text-white text-xs">
                      <Flame className="h-3 w-3 mr-1" />
                      Trending
                    </Badge>
                  )}
                  {drink.featured && (
                    <Badge className="bg-yellow-500 text-white text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                </div>
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLikeDrink(drink.id);
                    }}
                  >
                    <Heart className={`h-4 w-4 ${likedDrinks.has(drink.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareDrink(drink.id);
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-lg group-hover:text-purple-600 transition-colors">
                    {drink.name}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    {drink.rating}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {drink.prepTime}m
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    {drink.difficulty}
                  </span>
                  <span>{drink.calories} cal</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {drink.tags.slice(0, 2).map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4" />
                      {drink.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {drink.reviews}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleStartMixing(drink)}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    Mix It!
                  </Button>
                </div>

                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-gray-500 mb-1">Created by</div>
                  <div className="text-sm font-medium">{drink.createdBy}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mixing Animation Modal */}
        {mixingAnimation && selectedDrink && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-80 p-6 text-center">
              <div className="mb-4">
                <Zap className="h-16 w-16 mx-auto text-purple-500 animate-bounce" />
              </div>
              <h3 className="text-xl font-bold mb-2">Mixing {selectedDrink.name}...</h3>
              <p className="text-gray-600 mb-4">Following the recipe step by step</p>
              <Progress value={66} className="mb-4" />
              <p className="text-sm text-green-600">+25 points earned!</p>
              {selectedDrink.tags.includes('Tropical') && dailyChallenge.progress === 0 && (
                <p className="text-sm text-yellow-600 mt-2">Daily challenge completed! +{dailyChallenge.reward} bonus points!</p>
              )}
            </Card>
          </div>
        )}

        {/* Load More */}
        <div className="text-center mt-8">
          <Button size="lg" variant="outline" className="px-8">
            <Plus className="h-4 w-4 mr-2" />
            Load More Recipes
          </Button>
        </div>

        {/* Stats Footer */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4">
            <div className="text-2xl font-bold text-purple-600">{filteredDrinks.length}</div>
            <div className="text-sm text-gray-500">Recipes Found</div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-bold text-blue-600">{userPoints.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Total Points</div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-bold text-green-600">{likedDrinks.size}</div>
            <div className="text-sm text-gray-500">Drinks Liked</div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-bold text-orange-600">{userLevel}</div>
            <div className="text-sm text-gray-500">Current Level</div>
          </div>
        </div>
      </div>
    </div>
  );
