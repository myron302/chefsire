import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Sparkles, Clock, Heart, Star, Target, Leaf, Droplets, 
  Search, Share2, ArrowLeft, Plus, Camera, GlassWater,
  TrendingUp, Award, Crown, Coffee, Zap, Cherry, Sun, Citrus
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import { virginDrinks } from "@/data/drinks/potent-potables/virgin-cocktails";
import { resolveCanonicalDrinkSlug } from '@/data/drinks/canonical';



export default function VirginDrinksPage() {
  const { favorites, toggleFavorite } = useDrinks();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<typeof virginDrinks[0] | null>(null);

  const categories = ['Classic Virgin', 'Sophisticated Mocktails', 'Fruit Blends', 'Herbal & Tea'];
  const difficulties = ['Very Easy', 'Easy', 'Medium'];

  const filteredDrinks = virginDrinks.filter(drink => {
    const matchesSearch = drink.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         drink.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || drink.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || drink.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        {showUniversalSearch && (
          <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
        )}

        {selectedDrink && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto pt-8 pb-8">
            <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl">
              <div className="relative bg-gradient-to-br from-green-100 to-emerald-100 p-8 rounded-t-2xl">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDrink(null)}
                  className="absolute top-4 right-4 bg-white/80 hover:bg-white"
                >
                  <span className="text-xl">×</span>
                </Button>
                
                <div className="flex items-start gap-4">
                  <Sparkles className="w-16 h-16 text-emerald-600 flex-shrink-0" />
                  <div className="md:max-w-3xl md:flex-1">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedDrink.name}</h2>
                    <p className="text-gray-700 mb-3">{selectedDrink.description}</p>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                      <Badge className="bg-emerald-600">{selectedDrink.category}</Badge>
                      <Badge variant="outline">{selectedDrink.difficulty}</Badge>
                      {selectedDrink.vegan && (
                        <Badge className="bg-green-600">
                          <Leaf className="w-3 h-3 mr-1" />
                          Vegan
                        </Badge>
                      )}
                      {selectedDrink.glutenFree && (
                        <Badge className="bg-amber-600">Gluten-Free</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs text-gray-500">Prep Time</div>
                    <div className="font-semibold">{selectedDrink.prepTime} min</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <GlassWater className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs text-gray-500">Glass</div>
                    <div className="font-semibold text-sm">{selectedDrink.glassware}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Droplets className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs text-gray-500">Serving</div>
                    <div className="font-semibold">{selectedDrink.servingSize}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Sun className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs text-gray-500">Best Time</div>
                    <div className="font-semibold text-sm">{selectedDrink.bestTime}</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Nutrition Information</h3>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">{selectedDrink.nutrition.calories}</div>
                      <div className="text-xs text-gray-500">Calories</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">{selectedDrink.nutrition.carbs}g</div>
                      <div className="text-xs text-gray-500">Carbs</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">{selectedDrink.nutrition.sugar}g</div>
                      <div className="text-xs text-gray-500">Sugar</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">{selectedDrink.nutrition.protein}g</div>
                      <div className="text-xs text-gray-500">Protein</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-emerald-600" />
                    Ingredients
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <ul className="space-y-2">
                      {selectedDrink.ingredients.map((ingredient, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-emerald-600 mt-1">•</span>
                          <span className="text-gray-700">{ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-600" />
                    Method
                  </h3>
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Badge className="bg-emerald-600">{selectedDrink.method}</Badge>
                      <span className="text-sm">for this mocktail</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Flavor Profile</h3>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                    {selectedDrink.profile.map((flavor, index) => (
                      <Badge key={index} variant="secondary" className="text-sm">
                        {flavor}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Cherry className="w-5 h-5 text-emerald-600" />
                    Garnish
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">{selectedDrink.garnish}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Origin:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedDrink.origin}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Occasion:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedDrink.occasion}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Est. Cost:</span>
                    <span className="ml-2 font-semibold text-gray-900">${selectedDrink.estimatedCost.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rating:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedDrink.rating} / 5.0</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => toggleFavorite(selectedDrink.id, 'virgin-drinks')}
                >
                  <Heart
                    className={`w-4 h-4 mr-2 ${
                      favorites['virgin-drinks']?.includes(selectedDrink.id) ? 'fill-white' : ''
                    }`}
                  />
                  {favorites['virgin-drinks']?.includes(selectedDrink.id) ? 'Saved' : 'Save Recipe'}
                </Button>
                <Button variant="outline" className="flex-1">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.history.back()}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <Sparkles className="w-12 h-12" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Virgin Drinks & Mocktails</h1>
                <p className="text-xl text-white/90">Alcohol-free sophistication and refreshment</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search virgin drinks & mocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 py-6 text-lg bg-white/95 border-0"
                />
              </div>
              <Button
                onClick={() => setShowUniversalSearch(true)}
                className="bg-white text-emerald-600 hover:bg-white/90 px-6"
                size="lg"
              >
                <Target className="w-5 h-5 mr-2" />
                Advanced Search
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{virginDrinks.length}</div>
                <div className="text-white/80 text-sm">Mocktails</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{categories.length}</div>
                <div className="text-white/80 text-sm">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{virginDrinks.filter(d => d.vegan).length}</div>
                <div className="text-white/80 text-sm">Vegan</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{virginDrinks.filter(d => d.glutenFree).length}</div>
                <div className="text-white/80 text-sm">Gluten-Free</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Filters and Sort */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="md:max-w-3xl md:flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search virgin drinks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <select
                value={selectedCategory || 'all'}
                onChange={(e) => setSelectedCategory(e.target.value === 'all' ? null : e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-[240px]"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select
                value={selectedDifficulty || 'all'}
                onChange={(e) => setSelectedDifficulty(e.target.value === 'all' ? null : e.target.value)}
                className="px-4 py-3 border rounded-lg bg-white text-base sm:text-sm w-full sm:w-[240px]"
              >
                <option value="all">All Levels</option>
                {difficulties.map(diff => (
                  <option key={diff} value={diff}>{diff}</option>
                ))}
              </select>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Target className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrinks.map((drink) => {
              const canonicalSlug = resolveCanonicalDrinkSlug({ slug: drink.slug, name: drink.name, sourceRoute: '/drinks/potent-potables/virgin-cocktails' });
              return (
              <Card key={drink.id} className="hover:shadow-lg transition-all duration-300 overflow-hidden group">
                <div className="relative bg-gradient-to-br from-green-100 to-emerald-100 p-6 h-48 flex items-center justify-center">
                  <Sparkles className="w-20 h-20 text-emerald-600 group-hover:scale-110 transition-transform" />
                  {drink.trending && (
                    <Badge className="absolute top-3 left-3 bg-teal-500">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Trending
                    </Badge>
                  )}
                  {drink.vegan && (
                    <Badge className="absolute top-3 right-3 bg-green-600">
                      <Leaf className="w-3 h-3 mr-1" />
                      Vegan
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute bottom-3 right-3 bg-white/80 hover:bg-white"
                    onClick={() => toggleFavorite(drink.id, 'virgin-drinks')}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        favorites['virgin-drinks']?.includes(drink.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-gray-600'
                      }`}
                    />
                  </Button>
                </div>

                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl">{drink.name}</CardTitle>
                    <Badge variant="outline" className="ml-2">
                      {drink.difficulty}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{drink.description}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <GlassWater className="w-4 h-4 text-emerald-600" />
                      <span className="text-gray-600">{drink.glassware}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span className="text-gray-600">{drink.prepTime} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-emerald-600" />
                      <span className="text-gray-600">{drink.baseIngredient}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-emerald-600" />
                      <span className="text-gray-600">{drink.bestTime}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <GlassWater
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(drink.rating)
                              ? 'fill-emerald-500 text-emerald-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">{drink.rating}</span>
                    <span className="text-sm text-gray-500">({Number(drink.reviews ?? 0).toLocaleString()})</span>
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                    {drink.profile.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                    {drink.vegan && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                        <Leaf className="w-3 h-3 mr-1" />
                        Vegan
                      </Badge>
                    )}
                    {drink.glutenFree && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">
                        Gluten-Free
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-3 border-t text-center">
                    <div>
                      <div className="text-xs text-gray-500">Cal</div>
                      <div className="font-semibold text-sm">{drink.nutrition.calories}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Carbs</div>
                      <div className="font-semibold text-sm">{drink.nutrition.carbs}g</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Sugar</div>
                      <div className="font-semibold text-sm">{drink.nutrition.sugar}g</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Protein</div>
                      <div className="font-semibold text-sm">{drink.nutrition.protein}g</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <div className="text-sm font-semibold mb-2 text-gray-700">Main Ingredients:</div>
                    <div className="text-sm text-gray-600">
                      {drink.ingredients.slice(0, 3).join(' • ')}
                      {drink.ingredients.length > 3 && '...'}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3">
                    <Button 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setSelectedDrink(drink)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Open Recipe
                    </Button>
                    <Button variant="outline" size="icon">
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )})}
          </div>

          <Card className="mt-12 bg-gradient-to-br from-green-50 to-emerald-50 border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="w-7 h-7 text-emerald-600" />
                About Virgin Drinks & Mocktails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-gray-700 leading-relaxed">
                Virgin drinks and mocktails offer all the sophistication, flavor, and fun of cocktails without 
                the alcohol. Whether you're the designated driver, pregnant, in recovery, health-conscious, or 
                simply prefer non-alcoholic beverages, these drinks prove that you don't need alcohol to enjoy 
                a delicious, beautifully crafted beverage.
              </p>

              <div>
                <h3 className="font-semibold text-lg mb-3 text-emerald-700">Benefits of Mocktails</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-emerald-200">
                    <div className="font-semibold text-emerald-600 mb-2 flex items-center gap-2">
                      <Leaf className="w-4 h-4" />
                      Health Conscious
                    </div>
                    <div className="text-sm text-gray-700">Lower calories, no alcohol-related health risks, often packed with vitamins.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-emerald-200">
                    <div className="font-semibold text-teal-600 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Inclusive
                    </div>
                    <div className="text-sm text-gray-700">Everyone can enjoy sophisticated drinks regardless of lifestyle choices.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-emerald-200">
                    <div className="font-semibold text-green-600 mb-2 flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      Anytime Enjoyment
                    </div>
                    <div className="text-sm text-gray-700">Perfect for any time of day without impairment or hangover concerns.</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3 text-emerald-700">Mocktail Categories</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
                    <div className="font-semibold text-blue-700 mb-2">Classic Virgin</div>
                    <div className="text-sm text-gray-700">Traditional mocktails like Virgin Mojito, Shirley Temple, and Virgin Mary that have stood the test of time.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                    <div className="font-semibold text-purple-700 mb-2">Sophisticated Mocktails</div>
                    <div className="text-sm text-gray-700">Craft cocktail-inspired creations with complex flavors, fresh herbs, and premium ingredients.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
                    <div className="font-semibold text-orange-700 mb-2">Fruit Blends</div>
                    <div className="text-sm text-gray-700">Fresh juice combinations that highlight seasonal fruits and natural sweetness.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                    <div className="font-semibold text-green-700 mb-2">Herbal & Tea</div>
                    <div className="text-sm text-gray-700">Tea-based mocktails and herbal infusions with wellness benefits and unique flavors.</div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-emerald-800 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Tips for Amazing Mocktails
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-emerald-700 mb-2">Ingredient Quality:</div>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      <li>Use fresh, high-quality ingredients</li>
                      <li>Make homemade syrups and infusions</li>
                      <li>Choose premium mixers and juices</li>
                      <li>Fresh herbs make a huge difference</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-teal-700 mb-2">Presentation:</div>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      <li>Use proper glassware</li>
                      <li>Garnish thoughtfully</li>
                      <li>Consider color and layering</li>
                      <li>Serve at the right temperature</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3 text-emerald-700">Building Complex Flavors</h3>
                <div className="grid md:grid-cols-4 gap-3">
                  <div className="p-3 bg-white rounded-lg text-center">
                    <div className="text-2xl mb-1">🍋</div>
                    <div className="font-semibold text-xs text-emerald-700 mb-1">Acid</div>
                    <div className="text-xs text-gray-600">Citrus, vinegar</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg text-center">
                    <div className="text-2xl mb-1">🍯</div>
                    <div className="font-semibold text-xs text-emerald-700 mb-1">Sweet</div>
                    <div className="text-xs text-gray-600">Syrups, honey</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg text-center">
                    <div className="text-2xl mb-1">🌿</div>
                    <div className="font-semibold text-xs text-emerald-700 mb-1">Herbal</div>
                    <div className="text-xs text-gray-600">Mint, basil, rosemary</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg text-center">
                    <div className="text-2xl mb-1">🫧</div>
                    <div className="font-semibold text-xs text-emerald-700 mb-1">Effervescence</div>
                    <div className="text-xs text-gray-600">Soda, sparkling water</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3 text-emerald-700">Zero-Proof Spirits</h3>
                <p className="text-sm text-gray-700 mb-3">
                  The mocktail revolution has brought sophisticated non-alcoholic spirits that mimic the complexity 
                  of traditional spirits. Brands like Seedlip, Ritual, and Lyre's offer botanical distillates, 
                  non-alcoholic gin alternatives, and spirit-free versions of whiskey, rum, and tequila.
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-2">
                  <Badge variant="outline" className="text-xs">Seedlip (Botanical)</Badge>
                  <Badge variant="outline" className="text-xs">Ritual Zero Proof</Badge>
                  <Badge variant="outline" className="text-xs">Lyre's Non-Alcoholic</Badge>
                  <Badge variant="outline" className="text-xs">Ghia Aperitif</Badge>
                  <Badge variant="outline" className="text-xs">Curious Elixirs</Badge>
                  <Badge variant="outline" className="text-xs">Kin Euphorics</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
