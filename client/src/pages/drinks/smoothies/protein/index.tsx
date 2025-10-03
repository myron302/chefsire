import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Apple, Clock, Heart, Star, Search, Share2, ArrowLeft,
  Plus, Camera, Zap, Trophy, Milk, Sparkles, Target, Leaf,
  Crown, Dumbbell
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import { 
  proteinSmoothies, 
  proteinSources,
  smoothieCategories,
  smoothieSubcategories,
  otherDrinkHubs 
} from '../../data/smoothies';

export default function HighProteinSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedProteinSource, setSelectedProteinSource] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAllergen, setSelectedAllergen] = useState('');
  const [onlyNaturalProtein, setOnlyNaturalProtein] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const getFilteredSmoothies = () => {
    let filtered = proteinSmoothies.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProteinSource = !selectedProteinSource || 
                                  smoothie.primaryProtein.toLowerCase().includes(selectedProteinSource.toLowerCase());
      const matchesCategory = !selectedCategory || smoothie.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesAllergen = !selectedAllergen || !smoothie.allergens.includes(selectedAllergen);
      const matchesNatural = !onlyNaturalProtein || smoothie.naturalProtein;
      
      return matchesSearch && matchesProteinSource && matchesCategory && matchesAllergen && matchesNatural;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = proteinSmoothies.filter(smoothie => smoothie.featured);

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
    addPoints(20);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50">
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
                <Apple className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">High-Protein Smoothies</h1>
                <Badge className="bg-orange-100 text-orange-800">Natural</Badge>
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
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
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
        <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {smoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-orange-50 hover:border-orange-300">
                      <Icon className="h-4 w-4 mr-2 text-orange-600" />
                      <span>{subcategory.name}</span>
                      <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">23g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">350</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">75%</div>
              <div className="text-sm text-gray-600">Natural Protein</div>
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
            { id: 'protein-sources', label: 'Protein Sources', icon: Apple },
            { id: 'categories', label: 'Categories', icon: Target },
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
                  placeholder="Search protein smoothies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedProteinSource}
                  onChange={(e) => setSelectedProteinSource(e.target.value)}
                >
                  <option value="">All Protein Sources</option>
                  <option value="Greek Yogurt">Greek Yogurt</option>
                  <option value="Nut Butter">Nut Butters</option>
                  <option value="Cottage Cheese">Cottage Cheese</option>
                  <option value="Seeds">Seeds & Nuts</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Recovery">Recovery</option>
                  <option value="Green">Green</option>
                  <option value="Chocolate">Chocolate</option>
                  <option value="Tropical">Tropical</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedAllergen}
                  onChange={(e) => setSelectedAllergen(e.target.value)}
                >
                  <option value="">Include All</option>
                  <option value="Dairy">Dairy-Free</option>
                  <option value="Nuts">Nut-Free</option>
                </select>
                
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                  <input
                    type="checkbox"
                    checked={onlyNaturalProtein}
                    onChange={(e) => setOnlyNaturalProtein(e.target.checked)}
                    className="rounded"
                  />
                  Natural Only
                </label>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
                  <option value="cost">Sort by Cost</option>
                  <option value="calories">Sort by Calories</option>
                </select>
              </div>
            </div>

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
                          fitnessGoal: smoothie.fitnessGoal,
                          bestTime: smoothie.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-orange-100 text-orange-800">{smoothie.primaryProtein}</Badge>
                      <Badge variant="outline">{smoothie.flavor}</Badge>
                      {smoothie.naturalProtein && <Badge className="bg-green-100 text-green-800">Natural</Badge>}
                      {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-orange-600">{smoothie.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
                        <div className="text-gray-500">Fiber</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-600">${smoothie.estimatedCost}</div>
                        <div className="text-gray-500">Cost</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Protein Sources:</h4>
                      <div className="flex flex-wrap gap-1">
                        {smoothie.proteinSources.map((source, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{smoothie.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Prep Time:</span>
                        <span className="font-medium">{smoothie.prepTime} min</span>
                      </div>
                    </div>

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

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                        onClick={() => handleMakeSmoothie(smoothie)}
                      >
                        <Apple className="h-4 w-4 mr-2" />
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

        {activeTab === 'protein-sources' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {proteinSources.map(source => {
              const Icon = source.icon;
              const sourceSmoothies = proteinSmoothies.filter(smoothie => 
                smoothie.primaryProtein.toLowerCase().includes(source.name.toLowerCase().split(' ')[0])
              );
              
              return (
                <Card key={source.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${source.color}`} />
                      <CardTitle className="text-lg">{source.name}</CardTitle>
                      <p className="text-sm text-gray-600">{source.description}</p>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-center bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Protein per 100g</div>
                        <div className="text-2xl font-bold text-orange-600">{source.proteinPer100g}g</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Benefits:</h4>
                        <div className="flex flex-wrap gap-1">
                          {source.benefits.map((benefit, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-blue-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Cost</div>
                          <div className="font-semibold text-blue-600">{source.cost}</div>
                        </div>
                        <div className="bg-red-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Allergens</div>
                          <div className="font-semibold text-red-600 text-xs">{source.allergens.join(', ')}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${source.color} mb-1`}>
                        {sourceSmoothies.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedProteinSource(source.name.split(' ')[0]);
                          setActiveTab('browse');
                        }}
                      >
                        Explore {source.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {smoothieCategories.map(category => {
              const Icon = category.icon;
              const categorySmoothies = proteinSmoothies.filter(smoothie => 
                smoothie.category.toLowerCase().includes(category.name.toLowerCase().split(' ')[0])
              );
              
              return (
                <Card key={category.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${category.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${category.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <p className="text-sm text-gray-600">{category.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Protein Target:</div>
                        <div className="text-lg font-bold text-orange-600">{category.proteinTarget}</div>
                      </div>
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Timing:</div>
                        <div className="text-sm text-blue-800">{category.timing}</div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${category.color.replace('bg-', 'text-')} mb-1`}>
                        {categorySmoothies.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedCategory(category.name.split(' ')[0]);
                          setActiveTab('browse');
                        }}
                      >
                        View {category.name}
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
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img 
                    src={smoothie.image} 
                    alt={smoothie.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop';
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-orange-500 text-white">Featured Recipe</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-orange-800">{smoothie.nutrition.protein}g Protein</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-orange-100 text-orange-800">{smoothie.primaryProtein}</Badge>
                    <Badge variant="outline">{smoothie.flavor}</Badge>
                    {smoothie.naturalProtein && <Badge className="bg-green-100 text-green-800">Natural</Badge>}
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{smoothie.rating}</span>
                      <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-orange-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{smoothie.nutrition.protein}g</div>
                      <div className="text-xs text-gray-600">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
                      <div className="text-xs text-gray-600">Fiber</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-600">${smoothie.estimatedCost}</div>
                      <div className="text-xs text-gray-600">Est. Cost</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Protein Sources:</h4>
                    <div className="flex flex-wrap gap-1">
                      {smoothie.proteinSources.map((source, index) => (
                        <Badge key={index} className="bg-blue-100 text-blue-800 text-xs">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Key Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {smoothie.benefits.map((benefit, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-orange-600 font-semibold">{smoothie.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Fitness Goal:</div>
                        <div className="text-blue-600 font-semibold">{smoothie.fitnessGoal}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {smoothie.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Apple className="h-3 w-3 text-orange-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleMakeSmoothie(smoothie)}
                    >
                      <Apple className="h-4 w-4 mr-2" />
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

      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="rounded-full w-14 h-14 bg-orange-600 hover:bg-orange-700 shadow-lg"
          onClick={() => setActiveTab('browse')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Apple className="h-4 w-4 text-orange-600" />
              <span className="text-gray-600">Protein Smoothies Found:</span>
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
