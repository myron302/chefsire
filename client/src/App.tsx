import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Coffee, Clock, Star, Heart, Flame, Leaf, Apple,
  Search, Share2, ArrowLeft, Zap, Sun, Trophy
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';

const breakfastSmoothies = [
  {
    id: 'breakfast-1',
    name: 'Power Morning Fuel',
    description: 'Complete nutrition to kickstart your day',
    nutrition: { calories: 420, protein: 22, carbs: 58, fat: 12, fiber: 14 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 1892,
    trending: true,
    bestTime: 'Early Morning',
    energyDuration: '4-5 hours'
  },
  {
    id: 'breakfast-2',
    name: 'Coffee Kick Mocha',
    description: 'Espresso-infused energy boost',
    nutrition: { calories: 320, protein: 18, carbs: 42, fat: 8, fiber: 6 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 1456,
    trending: true,
    bestTime: 'Morning',
    energyDuration: '3-4 hours'
  },
  {
    id: 'breakfast-3',
    name: 'Tropical Sunrise',
    description: 'Vitamin C-packed morning refresher',
    nutrition: { calories: 280, protein: 12, carbs: 52, fat: 4, fiber: 8 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1234,
    trending: false,
    bestTime: 'Morning',
    energyDuration: '3 hours'
  }
];

export default function BreakfastSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('browse');

  const filteredSmoothies = breakfastSmoothies.filter(smoothie =>
    smoothie.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMakeSmoothie = (smoothie: any) => {
    addToRecentlyViewed({
      id: smoothie.id,
      name: smoothie.name,
      category: 'smoothies',
      description: smoothie.description,
      ingredients: [],
      nutrition: smoothie.nutrition,
      difficulty: smoothie.difficulty,
      prepTime: smoothie.prepTime,
      rating: smoothie.rating,
      fitnessGoal: 'Breakfast',
      bestTime: smoothie.bestTime
    });
    incrementDrinksMade();
    addPoints(25);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Coffee className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">Breakfast Smoothies</h1>
                <Badge className="bg-orange-100 text-orange-800">Morning Fuel</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search breakfast smoothies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Smoothies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSmoothies.map(smoothie => (
            <Card key={smoothie.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                    <p className="text-sm text-gray-600">{smoothie.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addToFavorites({
                      id: smoothie.id,
                      name: smoothie.name,
                      category: 'smoothies',
                      description: smoothie.description,
                      ingredients: [],
                      nutrition: smoothie.nutrition,
                      difficulty: smoothie.difficulty,
                      prepTime: smoothie.prepTime,
                      rating: smoothie.rating,
                      fitnessGoal: 'Breakfast',
                      bestTime: smoothie.bestTime
                    })}
                  >
                    <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  {smoothie.trending && (
                    <Badge className="bg-red-100 text-red-800">
                      <Flame className="h-3 w-3 mr-1" />
                      Trending
                    </Badge>
                  )}
                  <Badge variant="outline">{smoothie.bestTime}</Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                  <div>
                    <div className="text-xl font-bold text-orange-600">{smoothie.nutrition.calories}</div>
                    <div className="text-gray-500">Cal</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.protein}g</div>
                    <div className="text-gray-500">Protein</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
                    <div className="text-gray-500">Fiber</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-purple-600">{smoothie.prepTime}m</div>
                    <div className="text-gray-500">Time</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="font-medium">{smoothie.rating}</span>
                    <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {smoothie.energyDuration}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    onClick={() => handleMakeSmoothie(smoothie)}
                  >
                    <Sun className="h-4 w-4 mr-2" />
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
    </div>
  );
}
