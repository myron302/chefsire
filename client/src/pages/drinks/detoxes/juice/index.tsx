// client/src/pages/drinks/detoxes/juice/index.tsx
import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { 
  Droplets, Clock, Heart, Star, Target, Flame, Leaf, Sparkles,
  Search, Share2, ArrowLeft, Zap, Apple, Camera,
  FlaskConical, GlassWater, Coffee, Waves, X, Check
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import { otherDrinkHubs, detoxJuices, detoxTypes } from '../../data/detoxes';
import { DetoxRecipe } from '../../types/detox';

export default function DetoxJuicesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedDetoxType, setSelectedDetoxType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [detoxIntensity, setDetoxIntensity] = useState(['Any']);
  const [maxCalories, setMaxCalories] = useState([200]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedJuice, setSelectedJuice] = useState<DetoxRecipe | null>(null);

  const getFilteredJuices = () => {
    let filtered = detoxJuices.filter(juice => {
      const matchesSearch = juice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           juice.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedDetoxType || juice.detoxType?.toLowerCase().includes(selectedDetoxType.toLowerCase());
      const matchesCategory = !selectedCategory || juice.category?.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesIntensity = detoxIntensity[0] === 'Any' || juice.detoxLevel === detoxIntensity[0];
      const matchesCalories = juice.nutrition.calories <= maxCalories[0];
      
      return matchesSearch && matchesType && matchesCategory && matchesIntensity && matchesCalories;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        case 'intensity':
          const intensityOrder = { 'Intense': 3, 'Moderate': 2, 'Gentle': 1 };
          return (intensityOrder[b.detoxLevel || ''] || 0) - (intensityOrder[a.detoxLevel || ''] || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredJuices = getFilteredJuices();
  const featuredJuices = detoxJuices.filter(juice => juice.featured);

  const handleMakeJuice = (juice: DetoxRecipe) => {
    setSelectedJuice(juice);
    setShowModal(true);
  };

  const handleCompleteJuice = () => {
    if (selectedJuice) {
      addToRecentlyViewed({
        id: selectedJuice.id,
        name: selectedJuice.name,
        category: 'detoxes',
        description: selectedJuice.description,
        ingredients: selectedJuice.ingredients,
        nutrition: selectedJuice.nutrition,
        difficulty: selectedJuice.difficulty,
        prepTime: selectedJuice.prepTime,
        rating: selectedJuice.rating,
        bestTime: selectedJuice.bestTime
      });
      incrementDrinksMade();
      addPoints(25);
    }
    setShowModal(false);
    setSelectedJuice(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setShowUniversalSearch(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">Search All Drinks</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowUniversalSearch(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Make Juice Modal */}
      {showModal && selectedJuice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedJuice.name}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Ingredients:</h3>
                <ul className="space-y-2">
                  {selectedJuice.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Benefits:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {selectedJuice.benefits.map((benefit, idx) => (
                    <li key={idx}>• {benefit}</li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-green-50 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-green-600">{selectedJuice.nutrition.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{selectedJuice.nutrition.fiber}g</div>
                  <div className="text-xs text-gray-600">Fiber</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-orange-600">{selectedJuice.prepTime}min</div>
                  <div className="text-xs text-gray-600">Prep</div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  onClick={handleCompleteJuice}
                >
                  Complete Juice (+25 XP)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/detoxes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Detoxes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Droplets className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Detox Juices</h1>
                <Badge className="bg-green-100 text-green-800">Cleansing</Badge>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Link href="/drinks/smoothies">
                <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                  <Apple className="h-4 w-4 mr-2 text-green-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Smoothies</div>
                    <div className="text-xs text-gray-500">Nutrient-packed blends</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/protein-shakes">
                <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                  <FlaskConical className="h-4 w-4 mr-2 text-blue-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Protein Shakes</div>
                    <div className="text-xs text-gray-500">Fitness-focused nutrition</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/detoxes">
                <Button variant="outline" className="w-full justify-start hover:bg-teal-50 hover:border-teal-300 border-teal-400">
                  <Leaf className="h-4 w-4 mr-2 text-teal-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Detoxes Hub</div>
                    <div className="text-xs text-gray-500">Cleanse & wellness</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/potent-potables">
                <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                  <GlassWater className="h-4 w-4 mr-2 text-purple-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Potent Potables</div>
                    <div className="text-xs text-gray-500">Cocktails & beverages</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* SISTER SUBPAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Detox Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link href="/drinks/detoxes/tea">
                <Button variant="outline" className="w-full justify-start hover:bg-amber-50 hover:border-amber-300">
                  <Coffee className="h-4 w-4 mr-2 text-amber-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Detox Teas</div>
                    <div className="text-xs text-gray-500">Herbal infusions</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/detoxes/water">
                <Button variant="outline" className="w-full justify-start hover:bg-cyan-50 hover:border-cyan-300">
                  <Waves className="h-4 w-4 mr-2 text-cyan-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Infused Waters</div>
                    <div className="text-xs text-gray-500">Fruit & herb hydration</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">105</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">4.2g</div>
              <div className="text-sm text-gray-600">Avg Fiber</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">100%</div>
              <div className="text-sm text-gray-600">Natural</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">8</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'detox-types', label: 'Detox Types', icon: Target },
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

        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search detox juices..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={selectedDetoxType}
                      onChange={(e) => setSelectedDetoxType(e.target.value)}
                    >
                      <option value="">All Detox Types</option>
                      <option value="Deep Cleanse">Deep Cleanse</option>
                      <option value="Liver">Liver Support</option>
                      <option value="Digestive">Digestive</option>
                      <option value="Immune">Immune Support</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="">All Categories</option>
                      <option value="Green">Green Juices</option>
                      <option value="Root">Root Juices</option>
                      <option value="Citrus">Citrus Juices</option>
                      <option value="Red">Red Juices</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={detoxIntensity[0]}
                      onChange={(e) => setDetoxIntensity([e.target.value])}
                    >
                      <option value="Any">Any Intensity</option>
                      <option value="Intense">Intense</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Gentle">Gentle</option>
                    </select>
                    
                    <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white min-w-[120px]">
                      <span>Max Cal:</span>
                      <Slider
                        value={maxCalories}
                        onValueChange={setMaxCalories}
                        max={200}
                        min={50}
                        step={10}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-500">{maxCalories[0]}</span>
                    </div>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="calories">Sort by Calories</option>
                      <option value="intensity">Sort by Intensity</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recipe Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJuices.map(juice => (
                <Card key={juice.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{juice.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{juice.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToFavorites({
                          id: juice.id,
                          name: juice.name,
                          category: 'detoxes',
                          description: juice.description,
                          ingredients: juice.ingredients,
                          nutrition: juice.nutrition,
                          difficulty: juice.difficulty,
                          prepTime: juice.prepTime,
                          rating: juice.rating,
                          bestTime: juice.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(juice.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-100 text-green-800">{juice.detoxType}</Badge>
                      <Badge variant="outline">{juice.detoxLevel}</Badge>
                      {juice.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-green-600">{juice.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{juice.nutrition.fiber}g</div>
                        <div className="text-gray-500">Fiber</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-orange-600">{juice.prepTime}m</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Benefits:</h4>
                      <div className="flex flex-wrap gap-1">
                        {juice.benefits.slice(0, 3).map((benefit, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{juice.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">{juice.duration}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{juice.rating}</span>
                        <span className="text-gray-500 text-sm">({juice.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {juice.difficulty}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleMakeJuice(juice)}
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
        )}

        {activeTab === 'detox-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {detoxTypes.map(type => {
              const Icon = type.icon;
              const typeJuices = detoxJuices.filter(juice => 
                juice.detoxLevel === type.intensity ||
                juice.detoxType?.toLowerCase().includes(type.name.toLowerCase())
              );
              
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${type.color}`} />
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-center bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Intensity</div>
                        <div className="text-lg font-bold text-green-600">{type.intensity}</div>
                      </div>
                      
                      <div className="text-center bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Duration</div>
                        <div className="text-sm text-blue-800">{type.duration}</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Benefits:</h4>
                        <div className="flex flex-wrap gap-1">
                          {type.benefits.map((benefit, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color} mb-1`}>
                        {typeJuices.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setDetoxIntensity([type.intensity]);
                          setActiveTab('browse');
                        }}
                      >
                        Explore {type.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredJuices.map(juice => (
              <Card key={juice.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative bg-gradient-to-br from-green-100 to-emerald-100 h-48 flex items-center justify-center">
                  <Droplets className="h-24 w-24 text-green-600 opacity-20" />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-green-500 text-white">Featured Cleanse</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-green-800">{juice.nutrition.calories} Cal</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{juice.name}</CardTitle>
                  <p className="text-gray-600">{juice.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-green-100 text-green-800">{juice.detoxType}</Badge>
                    <Badge variant="outline">{juice.detoxLevel}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{juice.rating}</span>
                      <span className="text-gray-500 text-sm">({juice.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-green-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{juice.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{juice.nutrition.fiber}g</div>
                      <div className="text-xs text-gray-600">Fiber</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{juice.prepTime}m</div>
                      <div className="text-xs text-gray-600">Prep Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-600">${juice.estimatedCost}</div>
                      <div className="text-xs text-gray-600">Cost</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Detox Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {juice.benefits.map((benefit, index) => (
                        <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-green-600 font-semibold">{juice.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Duration:</div>
                        <div className="text-blue-600 font-semibold">{juice.duration}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {juice.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Leaf className="h-3 w-3 text-green-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleMakeJuice(juice)}
                    >
                      <Droplets className="h-4 w-4 mr-2" />
                      Start Cleanse
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

        {/* Your Progress (in-content) */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-green-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-emerald-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
                    {userProgress.totalDrinksMade} Drinks Made
                  </Badge>
                </div>
              </div>
              <div className="text-center">
                <Progress value={userProgress.dailyGoalProgress} className="w-32 mb-2" />
                <div className="text-xs text-gray-500">Daily Goal Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
