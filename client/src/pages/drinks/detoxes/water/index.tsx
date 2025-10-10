// client/src/pages/drinks/detoxes/water/index.tsx
import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Waves, Clock, Heart, Star, Target, Sparkles,
  Search, Share2, ArrowLeft, Zap, Camera, Droplets, Leaf,
  Apple, FlaskConical, GlassWater, Coffee, X, Check
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import { otherDrinkHubs, infusedWaters, waterTypes } from '../../data/detoxes';
import { DetoxRecipe } from '../../types/detox';

export default function DetoxWatersPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedWaterType, setSelectedWaterType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedWater, setSelectedWater] = useState<DetoxRecipe | null>(null);

  const getFilteredWaters = () => {
    let filtered = infusedWaters.filter(water => {
      const matchesSearch = water.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           water.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedWaterType || water.waterType?.toLowerCase().includes(selectedWaterType.toLowerCase());
      const matchesCategory = !selectedCategory || water.category?.toLowerCase().includes(selectedCategory.toLowerCase());
      
      return matchesSearch && matchesType && matchesCategory;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        case 'prepTime': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredWaters = getFilteredWaters();
  const featuredWaters = infusedWaters.filter(water => water.featured);

  const handleMakeWater = (water: DetoxRecipe) => {
    setSelectedWater(water);
    setShowModal(true);
  };

  const handleCompleteWater = () => {
    if (selectedWater) {
      addToRecentlyViewed({
        id: selectedWater.id,
        name: selectedWater.name,
        category: 'detoxes',
        description: selectedWater.description,
        ingredients: selectedWater.ingredients,
        nutrition: selectedWater.nutrition,
        difficulty: selectedWater.difficulty,
        prepTime: selectedWater.prepTime,
        rating: selectedWater.rating,
        bestTime: selectedWater.bestTime
      });
      incrementDrinksMade();
      addPoints(15);
    }
    setShowModal(false);
    setSelectedWater(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50">
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

      {/* Make Water Modal */}
      {showModal && selectedWater && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedWater.name}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Ingredients:</h3>
                <ul className="space-y-2">
                  {selectedWater.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-cyan-600" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Benefits:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {selectedWater.benefits.map((benefit, idx) => (
                    <li key={idx}>• {benefit}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-cyan-50 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Infusion Time:</span>
                    <div className="font-medium">{selectedWater.infusionTime}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Temperature:</span>
                    <div className="font-medium">{selectedWater.temperature}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-blue-100 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-cyan-600">{selectedWater.nutrition.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{selectedWater.nutrition.sugar}g</div>
                  <div className="text-xs text-gray-600">Sugar</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">{selectedWater.prepTime}min</div>
                  <div className="text-xs text-gray-600">Prep</div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                  onClick={handleCompleteWater}
                >
                  Complete Water (+15 XP)
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
                <Waves className="h-6 w-6 text-cyan-600" />
                <h1 className="text-2xl font-bold text-gray-900">Detox Infused Waters</h1>
                <Badge className="bg-cyan-100 text-cyan-800">Hydrating</Badge>
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
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700">
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
        <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Detox Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link href="/drinks/detoxes/juice">
                <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                  <Droplets className="h-4 w-4 mr-2 text-green-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Detox Juices</div>
                    <div className="text-xs text-gray-500">Cold-pressed cleansing</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
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
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-600">10</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">0g</div>
              <div className="text-sm text-gray-600">Fat</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">100%</div>
              <div className="text-sm text-gray-600">Natural</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">10</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'water-types', label: 'Water Types', icon: Waves },
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
                      placeholder="Search infused waters..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={selectedWaterType}
                      onChange={(e) => setSelectedWaterType(e.target.value)}
                    >
                      <option value="">All Water Types</option>
                      <option value="Hydrating">Hydrating</option>
                      <option value="Antioxidant">Antioxidant</option>
                      <option value="Metabolic">Metabolic</option>
                      <option value="Energizing">Energizing</option>
                      <option value="Calming">Calming</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="">All Categories</option>
                      <option value="Classic">Classic Infusions</option>
                      <option value="Fruity">Fruity Infusions</option>
                      <option value="Citrus">Citrus Infusions</option>
                      <option value="Herbal">Herbal Infusions</option>
                      <option value="Tropical">Tropical Infusions</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="calories">Sort by Calories</option>
                      <option value="prepTime">Sort by Prep Time</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Water Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWaters.map(water => (
                <Card key={water.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{water.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{water.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToFavorites({
                          id: water.id,
                          name: water.name,
                          category: 'detoxes',
                          description: water.description,
                          ingredients: water.ingredients,
                          nutrition: water.nutrition,
                          difficulty: water.difficulty,
                          prepTime: water.prepTime,
                          rating: water.rating,
                          bestTime: water.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(water.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-cyan-100 text-cyan-800">{water.waterType}</Badge>
                      <Badge variant="outline">{water.flavorProfile}</Badge>
                      {water.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-cyan-600">{water.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{water.nutrition.sugar}g</div>
                        <div className="text-gray-500">Sugar</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{water.prepTime}m</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                    </div>

                    <div className="mb-4 bg-cyan-50 p-3 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Infusion:</span>
                          <span className="font-medium ml-1">{water.infusionTime}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Temp:</span>
                          <span className="font-medium ml-1">{water.temperature}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Benefits:</h4>
                      <div className="flex flex-wrap gap-1">
                        {water.benefits.slice(0, 3).map((benefit, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{water.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">{water.duration}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{water.rating}</span>
                        <span className="text-gray-500 text-sm">({water.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {water.difficulty}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                        onClick={() => handleMakeWater(water)}
                      >
                        <Waves className="h-4 w-4 mr-2" />
                        Make Water
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

        {activeTab === 'water-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {waterTypes.map(type => {
              const Icon = type.icon;
              const typeWaters = infusedWaters.filter(water => 
                water.waterType?.toLowerCase().includes(type.name.toLowerCase())
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
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Best For:</div>
                        <div className="text-sm text-blue-800">{type.bestFor}</div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color} mb-1`}>
                        {typeWaters.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedWaterType(type.name.split(' ')[0]);
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
            {featuredWaters.map(water => (
              <Card key={water.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative bg-gradient-to-br from-cyan-100 to-blue-100 h-48 flex items-center justify-center">
                  <Waves className="h-24 w-24 text-cyan-600 opacity-20" />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-cyan-500 text-white">Featured Water</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-cyan-800">{water.nutrition.calories} Cal</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{water.name}</CardTitle>
                  <p className="text-gray-600">{water.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-cyan-100 text-cyan-800">{water.waterType}</Badge>
                    <Badge variant="outline">{water.flavorProfile}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{water.rating}</span>
                      <span className="text-gray-500 text-sm">({water.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-cyan-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-cyan-600">{water.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{water.nutrition.sugar}g</div>
                      <div className="text-xs text-gray-600">Sugar</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{water.prepTime}m</div>
                      <div className="text-xs text-gray-600">Prep Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">${water.estimatedCost}</div>
                      <div className="text-xs text-gray-600">Cost</div>
                    </div>
                  </div>

                  <div className="mb-4 bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Infusion Details:</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Infusion Time:</span>
                        <div className="font-semibold text-cyan-600">{water.infusionTime}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Temperature:</span>
                        <div className="font-semibold text-cyan-600">{water.temperature}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Health Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {water.benefits.map((benefit, index) => (
                        <Badge key={index} className="bg-cyan-100 text-cyan-800 text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-cyan-600 font-semibold">{water.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Duration:</div>
                        <div className="text-blue-600 font-semibold">{water.duration}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {water.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Leaf className="h-3 w-3 text-cyan-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                      onClick={() => handleMakeWater(water)}
                    >
                      <Waves className="h-4 w-4 mr-2" />
                      Infuse This Water
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
        <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-cyan-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-green-600">
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
