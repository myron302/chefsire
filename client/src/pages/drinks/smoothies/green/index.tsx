// client/src/pages/drinks/smoothies/green/index.tsx
import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Leaf, Heart, Star, Search, Share2, ArrowLeft,
  Plus, Camera, Sparkles, Target
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import { 
  greenSmoothies, 
  greensTypes,
  greenCategories,
  smoothieSubcategories,
  otherDrinkHubs 
} from '../../data/smoothies'; // FIXED PATH - 2 levels up

export default function GreenSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedGreenType, setSelectedGreenType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [maxCalories, setMaxCalories] = useState([400]);
  const [onlySuperfood, setOnlySuperfood] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const getFilteredSmoothies = () => {
    let filtered = greenSmoothies.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGreenType = !selectedGreenType || 
                              smoothie.primaryGreens.toLowerCase().includes(selectedGreenType.toLowerCase());
      const matchesCategory = !selectedCategory || smoothie.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesCalories = smoothie.nutrition.calories <= maxCalories[0];
      const matchesSuperfood = !onlySuperfood || smoothie.superfoods.length > 0;
      
      return matchesSearch && matchesGreenType && matchesCategory && matchesCalories && matchesSuperfood;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'nutrition': return (b.nutrition.fiber + b.nutrition.protein) - (a.nutrition.fiber + a.nutrition.protein);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = greenSmoothies.filter(smoothie => smoothie.featured);

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
      fitnessGoal: smoothie.fitnessGoal,
      bestTime: smoothie.bestTime
    });
    incrementDrinksMade();
    addPoints(15);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4">
            <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/smoothies">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Smoothies
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Leaf className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Green Superfood Smoothies</h1>
                <Badge className="bg-green-100 text-green-800">Detox</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowUniversalSearch(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
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
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {smoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                      <Icon className="h-4 w-4 mr-2 text-green-600" />
                      <span>{subcategory.name}</span>
                      <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Rest of your Green Smoothies page content remains exactly the same */}
        {/* ... all your existing tabs, filters, and smoothie cards ... */}

      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">Green Smoothies Found:</span>
              <span className="font-bold text-green-600">{filteredSmoothies.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">Your Level:</span>
              <span className="font-bold text-yellow-600">{userProgress.level}</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-500" />
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

      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="rounded-full w-14 h-14 bg-green-600 hover:bg-green-700 shadow-lg"
          onClick={() => setActiveTab('browse')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
