import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Droplets, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Apple, Leaf,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Search, Filter, Shuffle, Camera, Share2, ArrowLeft,
  Activity, BarChart3, Sparkles, Beaker, RefreshCw
} from 'lucide-react';

// Mock user progress for standalone functionality
const mockUserProgress = {
  level: 8,
  totalPoints: 1250,
  currentStreak: 5,
  totalDrinksMade: 28,
  dailyGoalProgress: 65
};

// Juice cleanse data
const juiceCleanses = [
  {
    id: 'juice-1',
    name: 'Green Goddess Detox',
    description: 'Alkalizing green juice blend with celery, cucumber, and lemon',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop',
    nutrition: { calories: 45, protein: 2, carbs: 9, fat: 0 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.8,
    reviews: 1247,
    trending: true,
    featured: true,
    tags: ['Green', 'Alkalizing', 'Hydrating', 'Beginner-friendly'],
    ingredients: ['Celery', 'Cucumber', 'Spinach', 'Lemon', 'Ginger', 'Parsley'],
    instructions: 'Juice all ingredients in order. Drink immediately for maximum nutrients.',
    benefits: ['Alkalizes body', 'Reduces inflammation', 'Boosts hydration', 'Liver support'],
    bestTime: 'Morning (empty stomach)',
    cleanseType: 'Green',
    intensity: 'Gentle',
    duration: '1-3 days'
  },
  {
    id: 'juice-2',
    name: 'Citrus Immunity Blast',
    description: 'Vitamin C powerhouse with orange, grapefruit, and turmeric',
    nutrition: { calories: 85, protein: 1, carbs: 21, fat: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 892,
    trending: false,
    featured: true,
    tags: ['Citrus', 'Vitamin C', 'Immunity', 'Energizing'],
    ingredients: ['Orange', 'Grapefruit', 'Lemon', 'Turmeric', 'Ginger', 'Cayenne'],
    instructions: 'Juice citrus fruits, then blend with turmeric and spices. Strain if desired.',
    benefits: ['Immune support', 'High vitamin C', 'Anti-inflammatory', 'Energy boost'],
    bestTime: 'Morning or midday',
    cleanseType: 'Citrus',
    intensity: 'Moderate',
    duration: '1-5 days'
  },
  // ... (continuing with the rest of the data)
];

const cleanseTypes = [
  { 
    id: 'green', 
    name: 'Green Cleanses', 
    icon: Leaf,
    color: 'bg-green-500',
    description: 'Alkalizing greens for gentle detox',
    benefits: ['Alkalizing', 'Hydrating', 'Gentle'],
    bestFor: 'Beginners and daily use'
  },
  // ... (other cleanse types)
];

export default function JuiceCleansesPage() {
  // Mock functions to replace context functionality
  const [favorites, setFavorites] = useState(new Set());
  const [userPoints, setUserPoints] = useState(1250);
  
  const addToFavorites = (cleanse) => {
    setFavorites(prev => new Set([...prev, cleanse.id]));
    setUserPoints(prev => prev + 10);
  };
  
  const isFavorite = (id) => favorites.has(id);
  
  const addToRecentlyViewed = (cleanse) => {
    console.log('Added to recently viewed:', cleanse.name);
  };
  
  const incrementDrinksMade = () => {
    console.log('Drink made count incremented');
  };
  
  const addPoints = (points) => {
    setUserPoints(prev => prev + points);
  };

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedCleanseType, setSelectedCleanseType] = useState('');
  const [selectedIntensity, setSelectedIntensity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');

  // Filter and sort cleanses
  const getFilteredCleanses = () => {
    let filtered = juiceCleanses.filter(cleanse => {
      const matchesSearch = cleanse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           cleanse.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedCleanseType || cleanse.cleanseType.toLowerCase().includes(selectedCleanseType.toLowerCase());
      const matchesIntensity = !selectedIntensity || cleanse.intensity.toLowerCase().includes(selectedIntensity.toLowerCase());
      
      return matchesSearch && matchesType && matchesIntensity;
    });

    // Sort results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'calories': return (a.nutrition?.calories || 0) - (b.nutrition?.calories || 0);
        case 'time': return (a.prepTime || 0) - (b.prepTime || 0);
        case 'reviews': return (b.reviews || 0) - (a.reviews || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredCleanses = getFilteredCleanses();
  const featuredCleanses = juiceCleanses.filter(cleanse => cleanse.featured);

  const handleMakeJuice = (cleanse) => {
    addToRecentlyViewed(cleanse);
    incrementDrinksMade();
    addPoints(35);
    console.log(`Made ${cleanse.name}! +35 XP`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="text-gray-500">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Detoxes
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Droplets className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Juice Cleanses</h1>
                <Badge className="bg-green-100 text-green-800">Detox</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {mockUserProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userPoints} XP</span>
              </div>
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                <Camera className="h-4 w-4 mr-2" />
                Share Recipe
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search juice cleanses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCleanses.map(cleanse => (
            <Card key={cleanse.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{cleanse.name}</CardTitle>
                    <p className="text-sm text-gray-600 mb-2">{cleanse.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addToFavorites(cleanse)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Heart className={`h-4 w-4 ${isFavorite(cleanse.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{cleanse.cleanseType}</Badge>
                  <Badge className="bg-green-100 text-green-800">{cleanse.intensity}</Badge>
                  {cleanse.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                </div>
              </CardHeader>
              
              <CardContent>
                {/* Nutrition Grid */}
                <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                  <div>
                    <div className="font-bold text-green-600">{cleanse.nutrition.calories}</div>
                    <div className="text-gray-500">Calories</div>
                  </div>
                  <div>
                    <div className="font-bold text-blue-600">{cleanse.nutrition.carbs}g</div>
                    <div className="text-gray-500">Carbs</div>
                  </div>
                  <div>
                    <div className="font-bold text-purple-600">{cleanse.prepTime}min</div>
                    <div className="text-gray-500">Prep</div>
                  </div>
                </div>

                {/* Key Info */}
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Best Time:</span>
                    <span className="font-medium text-xs">{cleanse.bestTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{cleanse.duration}</span>
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="font-medium">{cleanse.rating}</span>
                    <span className="text-gray-500 text-sm">({cleanse.reviews})</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {cleanse.difficulty}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleMakeJuice(cleanse)}
                  >
                    <Droplets className="h-4 w-4 mr-2" />
                    Make Juice
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
    </div>
  );
}
