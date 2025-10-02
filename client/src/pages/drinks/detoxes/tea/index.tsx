// client/src/pages/drinks/detoxes/tea/index.tsx
import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Coffee, Clock, Heart, Star, Target, Flame, Leaf, Sparkles,
  Search, Share2, ArrowLeft, Plus, Zap, Activity, Camera, Droplets,
  Apple, FlaskConical, GlassWater, Waves
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import { otherDrinkHubs, detoxTeas, teaTypes } from '../../data/detoxes';
import { DetoxRecipe } from '../../types/detox';

export default function DetoxTeasPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedTeaType, setSelectedTeaType] = useState('');
  const [selectedFocus, setSelectedFocus] = useState('');
  const [caffeineLevel, setCaffeineLevel] = useState(['Any']);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const getFilteredTeas = () => {
    let filtered = detoxTeas.filter(tea => {
      const matchesSearch = tea.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           tea.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedTeaType || tea.teaType?.toLowerCase().includes(selectedTeaType.toLowerCase());
      const matchesFocus = !selectedFocus || tea.detoxFocus?.toLowerCase().includes(selectedFocus.toLowerCase());
      const matchesCaffeine = caffeineLevel[0] === 'Any' || 
        (caffeineLevel[0] === 'Caffeinated' && (tea.nutrition.caffeine || 0) > 0) ||
        (caffeineLevel[0] === 'Caffeine-Free' && (tea.nutrition.caffeine || 0) === 0);
      
      return matchesSearch && matchesType && matchesFocus && matchesCaffeine;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'prepTime': return (a.prepTime || 0) - (b.prepTime || 0);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredTeas = getFilteredTeas();
  const featuredTeas = detoxTeas.filter(tea => tea.featured);

  const handleMakeTea = (tea: DetoxRecipe) => {
    addToRecentlyViewed({
      id: tea.id,
      name: tea.name,
      category: 'detoxes',
      description: tea.description,
      ingredients: tea.ingredients,
      nutrition: tea.nutrition,
      difficulty: tea.difficulty,
      prepTime: tea.prepTime,
      rating: tea.rating,
      bestTime: tea.bestTime
    });
    incrementDrinksMade();
    addPoints(20);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
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
              <Link href="/drinks/detoxes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Detoxes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Coffee className="h-6 w-6 text-amber-600" />
                <h1 className="text-2xl font-bold text-gray-900">Detox Teas</h1>
                <Badge className="bg-amber-100 text-amber-800">Cleansing</Badge>
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
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
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
              <Link href="/drinks/smoothies">
                <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                  <Apple className="h-4 w-4 mr-2 text-green-600" />
                  <span>Smoothies</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/protein-shakes">
                <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                  <FlaskConical className="h-4 w-4 mr-2 text-blue-600" />
                  <span>Protein Shakes</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/detoxes">
                <Button variant="outline" className="w-full justify-start hover:bg-teal-50 hover:border-teal-300 border-teal-400">
                  <Leaf className="h-4 w-4 mr-2 text-teal-600" />
                  <span className="font-semibold">Detoxes Hub</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/potent-potables">
                <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                  <GlassWater className="h-4 w-4 mr-2 text-purple-600" />
                  <span>Potent Potables</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* SISTER SUBPAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Detox Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link href="/drinks/detoxes/juice">
                <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                  <Droplets className="h-4 w-4 mr-2 text-green-600" />
                  <span>Detox Juices</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/detoxes/water">
                <Button variant="outline" className="w-full justify-start hover:bg-cyan-50 hover:border-cyan-300">
                  <Waves className="h-4 w-4 mr-2 text-cyan-600" />
                  <span>Infused Waters</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">4</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">50%</div>
              <div className="text-sm text-gray-600">Caffeine-Free</div>
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
              <div className="text-2xl font-bold text-purple-600">8</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'tea-types', label: 'Tea Types', icon: Coffee },
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
          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search detox teas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedTeaType}
                  onChange={(e) => setSelectedTeaType(e.target.value)}
                >
                  <option value="">All Tea Types</option>
                  <option value="Green">Green Tea</option>
                  <option value="Herbal">Herbal</option>
                  <option value="White">White Tea</option>
                  <option value="Oolong">Oolong</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedFocus}
                  onChange={(e) => setSelectedFocus(e.target.value)}
                >
                  <option value="">All Focus Areas</option>
                  <option value="Metabolic">Metabolic</option>
                  <option value="Digestive">Digestive</option>
                  <option value="Liver">Liver Support</option>
                  <option value="Anti-inflammatory">Anti-inflammatory</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={caffeineLevel[0]}
                  onChange={(e) => setCaffeineLevel([e.target.value])}
                >
                  <option value="Any">Any Caffeine Level</option>
                  <option value="Caffeinated">Caffeinated</option>
                  <option value="Caffeine-Free">Caffeine-Free</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="prepTime">Sort by Prep Time</option>
                  <option value="cost">Sort by Cost</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeas.map(tea => (
                <Card key={tea.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{tea.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{tea.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToFavorites({
                          id: tea.id,
                          name: tea.name,
                          category: 'detoxes',
                          description: tea.description,
                          ingredients: tea.ingredients,
                          nutrition: tea.nutrition,
                          difficulty: tea.difficulty,
                          prepTime: tea.prepTime,
                          rating: tea.rating,
                          bestTime: tea.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(tea.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-amber-100 text-amber-800">{tea.teaType}</Badge>
                      <Badge variant="outline">{tea.detoxFocus}</Badge>
                      {tea.nutrition.caffeine === 0 && <Badge className="bg-green-100 text-green-800">Caffeine-Free</Badge>}
                      {tea.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-amber-600">{tea.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{tea.nutrition.caffeine}mg</div>
                        <div className="text-gray-500">Caffeine</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-orange-600">{tea.prepTime}m</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                    </div>

                    <div className="mb-4 bg-amber-50 p-3 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Brew:</span>
                          <span className="font-medium ml-1">{tea.brewTemp}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Steep:</span>
                          <span className="font-medium ml-1">{tea.steepTime}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Benefits:</h4>
                      <div className="flex flex-wrap gap-1">
                        {tea.benefits.slice(0, 3).map((benefit, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{tea.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">{tea.duration}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{tea.rating}</span>
                        <span className="text-gray-500 text-sm">({tea.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {tea.difficulty}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-amber-600 hover:bg-amber-700"
                        onClick={() => handleMakeTea(tea)}
                      >
                        <Coffee className="h-4 w-4 mr-2" />
                        Brew Tea
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

        {activeTab === 'tea-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {teaTypes.map(type => {
              const Icon = type.icon;
              const typeTeas = detoxTeas.filter(tea => 
                tea.teaType?.toLowerCase().includes(type.name.toLowerCase()) ||
                tea.category?.toLowerCase().includes(type.name.toLowerCase())
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
                        <div className="text-sm font-medium text-gray-700 mb-1">Caffeine Level</div>
                        <div className="text-lg font-bold text-amber-600">{type.caffeine}</div>
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
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Best For:</div>
                        <div className="text-sm text-blue-800">{type.bestFor}</div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color} mb-1`}>
                        {typeTeas.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedTeaType(type.name.split(' ')[0]);
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
            {featuredTeas.map(tea => (
              <Card key={tea.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative bg-gradient-to-br from-amber-100 to-orange-100 h-48 flex items-center justify-center">
                  <Coffee className="h-24 w-24 text-amber-600 opacity-20" />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-amber-500 text-white">Featured Tea</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-amber-800">{tea.nutrition.caffeine}mg Caffeine</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{tea.name}</CardTitle>
                  <p className="text-gray-600">{tea.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-amber-100 text-amber-800">{tea.teaType}</Badge>
                    <Badge variant="outline">{tea.detoxFocus}</Badge>
                    {tea.nutrition.caffeine === 0 && <Badge className="bg-green-100 text-green-800">Caffeine-Free</Badge>}
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{tea.rating}</span>
                      <span className="text-gray-500 text-sm">({tea.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-amber-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-600">{tea.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{tea.nutrition.caffeine}mg</div>
                      <div className="text-xs text-gray-600">Caffeine</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{tea.prepTime}m</div>
                      <div className="text-xs text-gray-600">Prep Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">${tea.estimatedCost}</div>
                      <div className="text-xs text-gray-600">Cost</div>
                    </div>
                  </div>

                  <div className="mb-4 bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Brewing Instructions:</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Temperature:</span>
                        <div className="font-semibold text-amber-600">{tea.brewTemp}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Steep Time:</span>
                        <div className="font-semibold text-amber-600">{tea.steepTime}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Detox Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {tea.benefits.map((benefit, index) => (
                        <Badge key={index} className="bg-amber-100 text-amber-800 text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-amber-600 font-semibold">{tea.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Duration:</div>
                        <div className="text-blue-600 font-semibold">{tea.duration}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {tea.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Leaf className="h-3 w-3 text-amber-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-amber-600 hover:bg-amber-700"
                      onClick={() => handleMakeTea(tea)}
                    >
                      <Coffee className="h-4 w-4 mr-2" />
                      Brew This Tea
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

      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="rounded-full w-14 h-14 bg-amber-600 hover:bg-amber-700 shadow-lg"
          onClick={() => setActiveTab('browse')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-amber-600" />
              <span className="text-gray-600">Detox Teas Found:</span>
              <span className="font-bold text-amber-600">{filteredTeas.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">Your Level:</span>
              <span className="font-bold text-yellow-600">{userProgress.level}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-gray-600">XP:</span>
              <span className="font-bold text-amber-600">{userProgress.totalPoints}</span>
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
