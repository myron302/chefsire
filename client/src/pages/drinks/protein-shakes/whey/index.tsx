import React, { useState } from 'react';
import { Link } from 'wouter';
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
  Beaker, Activity, BarChart3, Sparkles, FlaskConical, Weight
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';

// Navigation data
const otherDrinkHubs = [
  {
    id: 'smoothies',
    name: 'Smoothies',
    route: '/drinks/smoothies',
    icon: FlaskConical
  },
  {
    id: 'protein-shakes',
    name: 'Protein Shakes',
    route: '/drinks/protein-shakes',
    icon: Dumbbell
  },
  {
    id: 'potent-potables',
    name: 'Potent Potables',
    route: '/drinks/potent-potables',
    icon: Trophy
  },
  {
    id: 'detoxes',
    name: 'Detoxes',
    route: '/drinks/detoxes',
    icon: Sparkles
  }
];

const proteinSubcategories = [
  {
    id: 'whey',
    name: 'Whey Protein',
    path: '/drinks/protein-shakes/whey',
    icon: Zap,
    color: 'blue'
  },
  {
    id: 'casein',
    name: 'Casein Protein',
    path: '/drinks/protein-shakes/casein',
    icon: Moon,
    color: 'purple'
  },
  {
    id: 'plant-based',
    name: 'Plant-Based',
    path: '/drinks/protein-shakes/plant-based',
    icon: Leaf,
    color: 'green'
  },
  {
    id: 'collagen',
    name: 'Collagen',
    path: '/drinks/protein-shakes/collagen',
    icon: Sparkles,
    color: 'pink'
  }
];

// Whey-specific data (keeping your existing data)
const wheyProteinShakes = [
  {
    id: 'whey-1',
    name: 'Classic Vanilla Post-Workout',
    description: 'Fast-absorbing whey isolate for maximum protein synthesis',
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop',
    nutrition: { calories: 180, protein: 35, carbs: 3, fat: 1 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 1247,
    trending: false,
    featured: true,
    tags: ['Whey Isolate', 'Fast absorption', 'Muscle recovery', 'Low carb'],
    ingredients: ['Whey protein isolate (30g)', 'Water or almond milk', 'Vanilla extract', 'Ice cubes'],
    instructions: 'Blend for 30 seconds. Consume within 30 minutes post-workout for optimal absorption.',
    benefits: ['Fast protein absorption', 'Muscle recovery', 'Low carb'],
    bestTime: 'Post-workout (0-30 minutes)',
    fitnessGoal: 'Muscle Building',
    wheyType: 'Isolate',
    absorptionTime: '30-60 minutes',
    leucineContent: '2.5g'
  },
  // ... (keep all your existing whey shakes data)
];

const fitnessGoals = [
  { id: 'muscle-building', name: 'Muscle Building', icon: Dumbbell, count: 15, color: 'text-blue-600' },
  { id: 'fat-loss', name: 'Fat Loss', icon: Flame, count: 8, color: 'text-red-600' },
  { id: 'performance', name: 'Performance', icon: Zap, count: 6, color: 'text-yellow-600' },
  { id: 'recovery', name: 'Recovery', icon: Heart, count: 12, color: 'text-green-600' },
  { id: 'mass-gain', name: 'Mass Gain', icon: TrendingUp, count: 9, color: 'text-purple-600' },
  { id: 'maintenance', name: 'Maintenance', icon: Target, count: 11, color: 'text-gray-600' }
];

const wheyTypes = [
  { 
    id: 'isolate', 
    name: 'Whey Isolate', 
    description: 'Fastest absorption, lowest carbs', 
    icon: Zap,
    absorptionTime: '30-60 min',
    proteinContent: '90-95%',
    bestFor: 'Post-workout, cutting'
  },
  { 
    id: 'concentrate', 
    name: 'Whey Concentrate', 
    description: 'Great taste, cost-effective', 
    icon: Award,
    absorptionTime: '60-90 min',
    proteinContent: '70-80%',
    bestFor: 'General use, mass gain'
  },
  { 
    id: 'hydrolyzed', 
    name: 'Hydrolyzed Whey', 
    description: 'Pre-digested, ultra-fast', 
    icon: Sparkles,
    absorptionTime: '15-30 min',
    proteinContent: '85-95%',
    bestFor: 'Elite athletes, recovery'
  }
];

export default function WheyProteinShakesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedWheyType, setSelectedWheyType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');

  // Filter and sort shakes (keep your existing logic)
  const getFilteredShakes = () => {
    let filtered = wheyProteinShakes.filter(shake => {
      const matchesSearch = shake.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           shake.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGoal = !selectedGoal || shake.fitnessGoal.toLowerCase().includes(selectedGoal.toLowerCase());
      const matchesWheyType = !selectedWheyType || shake.wheyType.toLowerCase().includes(selectedWheyType.toLowerCase());
      
      return matchesSearch && matchesGoal && matchesWheyType;
    });

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

  const filteredShakes = getFilteredShakes();
  const featuredShakes = wheyProteinShakes.filter(shake => shake.featured);
  const trendingShakes = wheyProteinShakes.filter(shake => shake.trending);

  const handleMakeShake = (shake: any) => {
    addToRecentlyViewed(shake);
    incrementDrinksMade();
    addPoints(25);
    
    console.log(`Made ${shake.name}! +25 XP`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/protein-shakes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Protein Shakes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Dumbbell className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Whey Protein Shakes</h1>
                <Badge className="bg-blue-100 text-blue-800">Fast Absorption</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Camera className="h-4 w-4 mr-2" />
                Share Recipe
              </Button>
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
                    <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
                      <span>{hub.name}</span>
                      <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SISTER SUBPAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Protein Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button 
                      variant="outline" 
                      className={`w-full justify-start hover:bg-blue-50 hover:border-blue-300 ${
                        subcategory.id === 'whey' ? 'bg-blue-50 border-blue-300' : ''
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
                      <span>{subcategory.name}</span>
                      <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">35g+</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">3 min</div>
              <div className="text-sm text-gray-600">Avg Prep</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">6</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'types', label: 'Whey Types', icon: Beaker },
            { id: 'goals', label: 'By Goal', icon: Target },
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
                  placeholder="Search whey protein shakes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedGoal}
                  onChange={(e) => setSelectedGoal(e.target.value)}
                >
                  <option value="">All Goals</option>
                  {fitnessGoals.map(goal => (
                    <option key={goal.id} value={goal.name}>{goal.name}</option>
                  ))}
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedWheyType}
                  onChange={(e) => setSelectedWheyType(e.target.value)}
                >
                  <option value="">All Types</option>
                  {wheyTypes.map(type => (
                    <option key={type.id} value={type.name}>{type.name}</option>
                  ))}
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
              {filteredShakes.map(shake => (
                <Card key={shake.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{shake.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{shake.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToFavorites(shake)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(shake.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{shake.wheyType}</Badge>
                      <Badge className="bg-blue-100 text-blue-800">{shake.fitnessGoal}</Badge>
                      {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Nutrition Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-blue-600">{shake.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="font-bold text-green-600">{shake.nutrition.calories}</div>
                        <div className="text-gray-500">Calories</div>
                      </div>
                      <div>
                        <div className="font-bold text-purple-600">{shake.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                    </div>

                    {/* Key Info */}
                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Absorption:</span>
                        <span className="font-medium">{shake.absorptionTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Leucine:</span>
                        <span className="font-medium">{shake.leucineContent}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium text-xs">{shake.bestTime}</span>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{shake.rating}</span>
                        <span className="text-gray-500 text-sm">({shake.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {shake.difficulty}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleMakeShake(shake)}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Make Shake
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

        {/* Rest of your existing tabs (Whey Types, Goals, Featured) remain the same */}
        {/* ... (keep all your existing tab content) */}
        
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="rounded-full w-14 h-14 bg-blue-600 hover:bg-blue-700 shadow-lg"
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
              <Dumbbell className="h-4 w-4 text-blue-600" />
              <span className="text-gray-600">Shakes Found:</span>
              <span className="font-bold text-blue-600">{filteredShakes.length}</span>
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
