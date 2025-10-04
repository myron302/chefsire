import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star,
  Target, Flame, Droplets, Wine, ArrowRight,
  GlassWater, Martini, ChefHat
} from 'lucide-react';
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';

const potentPotablesSubcategories = [
  { id: 'vodka', name: 'Vodka Cocktails', icon: Droplets, count: 12, route: '/drinks/potent-potables/vodka', color: 'from-cyan-500 to-blue-500', description: 'Clean, versatile, and endlessly mixable' },
  { id: 'whiskey-bourbon', name: 'Whiskey & Bourbon', icon: Wine, count: 12, route: '/drinks/potent-potables/whiskey-bourbon', color: 'from-amber-500 to-orange-500', description: 'From Kentucky bourbon to classic rye whiskey' },
  { id: 'tequila-mezcal', name: 'Tequila & Mezcal', icon: Flame, count: 12, route: '/drinks/potent-potables/tequila-mezcal', color: 'from-lime-500 to-green-500', description: 'Agave spirits from Mexico' },
  { id: 'rum', name: 'Rum Cocktails', icon: GlassWater, count: 12, route: '/drinks/potent-potables/rum', color: 'from-orange-500 to-red-500', description: 'Caribbean classics and tropical vibes' },
  { id: 'cognac-brandy', name: 'Cognac & Brandy', icon: Wine, count: 12, route: '/drinks/potent-potables/cognac-brandy', color: 'from-orange-600 to-red-600', description: 'Sophisticated French spirits' },
  { id: 'scotch-irish-whiskey', name: 'Scotch & Irish', icon: Wine, count: 12, route: '/drinks/potent-potables/scotch-irish-whiskey', color: 'from-amber-600 to-yellow-700', description: 'Classic whiskeys from the UK and Ireland' },
  { id: 'martinis', name: 'Martinis', icon: Martini, count: 8, route: '/drinks/potent-potables/martinis', color: 'from-purple-500 to-pink-500', description: 'Elegant and timeless' },
  { id: 'cocktails', name: 'Classic Cocktails', icon: GlassWater, count: 15, route: '/drinks/potent-potables/cocktails', color: 'from-blue-500 to-indigo-500', description: 'Timeless recipes and favorites' },
  { id: 'seasonal', name: 'Seasonal Specials', icon: Sparkles, count: 10, route: '/drinks/potent-potables/seasonal', color: 'from-teal-500 to-cyan-500', description: 'Drinks for every season' },
  { id: 'mocktails', name: 'Mocktails', icon: Sparkles, count: 12, route: '/drinks/potent-potables/mocktails', color: 'from-green-500 to-emerald-500', description: 'Zero-proof sophisticated drinks' },
  { id: 'virgin-cocktails', name: 'Virgin Cocktails', icon: Sparkles, count: 14, route: '/drinks/potent-potables/virgin', color: 'from-emerald-500 to-teal-500', description: 'Alcohol-free alternatives' }
];

const featuredCocktails = [
  {
    id: 'featured-1',
    name: "Old Fashioned",
    spirit: "Whiskey",
    difficulty: "Easy",
    rating: 4.9,
    reviews: 5234,
    time: "5 min",
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop",
    tags: ['Classic', 'Strong', 'Sophisticated']
  },
  {
    id: 'featured-2',
    name: "Margarita",
    spirit: "Tequila",
    difficulty: "Easy",
    rating: 4.8,
    reviews: 4892,
    time: "3 min",
    image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop",
    tags: ['Citrus', 'Refreshing', 'Party']
  },
  {
    id: 'featured-3',
    name: "Mojito",
    spirit: "Rum",
    difficulty: "Medium",
    rating: 4.7,
    reviews: 3654,
    time: "7 min",
    image: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=300&fit=crop",
    tags: ['Minty', 'Refreshing', 'Summer']
  }
];

export default function PotentPotablesPage() {
  const { userProgress, addToFavorites, isFavorite, favorites } = useDrinks();

  const handleDrinkSelection = (drink) => {
    console.log('Selected drink from universal search:', drink);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
          
          {/* Header with User Stats */}
          <div className="text-center relative">
            <div className="absolute top-0 right-0 bg-white rounded-2xl p-4 shadow-lg border">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="font-bold">Level {userProgress.level}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="font-bold">{userProgress.currentStreak} day streak</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-purple-500" />
                  <span className="font-bold">{userProgress.totalPoints} XP</span>
                </div>
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Potent Potables Hub 🍸
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              Cocktails, mocktails, and specialty beverages for every occasion
            </p>

            <div className="max-w-md mx-auto mb-6">
              <Badge className="bg-orange-500 text-white text-xs">
                21+ Content • Please drink responsibly
              </Badge>
            </div>
          </div>

          {/* Universal Search */}
          <div className="max-w-2xl mx-auto mb-8">
            <UniversalSearch 
              onSelectDrink={handleDrinkSelection}
              placeholder="Search all drinks or find cocktail inspiration..."
              className="w-full"
            />
          </div>

          {/* Spirit Categories Grid */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <GlassWater className="w-5 h-5 text-purple-500" />
                Explore Spirit Categories
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {potentPotablesSubcategories.map((subcategory) => {
                  const Icon = subcategory.icon;
                  return (
                    <Card
                      key={subcategory.id}
                      className="group cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden border-2"
                      onClick={() => window.location.href = subcategory.route}
                    >
                      <div className={`h-24 bg-gradient-to-br ${subcategory.color} p-4 flex items-center justify-center`}>
                        <Icon className="h-12 w-12 text-white group-hover:scale-110 transition-transform" />
                      </div>
                      <CardContent className="p-3">
                        <div className="font-medium text-sm mb-1">{subcategory.name}</div>
                        <div className="text-xs text-gray-600 mb-2">{subcategory.description}</div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{subcategory.count} recipes</span>
                          <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Favorites */}
          {favorites.filter(f => f.category === 'potent-potables' || f.category === 'cocktails').length > 0 && (
            <Card className="bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-purple-500" />
                  Your Favorite Cocktails ({favorites.filter(f => f.category === 'potent-potables' || f.category === 'cocktails').length})
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {favorites.filter(f => f.category === 'potent-potables' || f.category === 'cocktails').slice(0, 5).map((drink) => (
                    <div key={drink.id} className="flex-shrink-0 bg-white rounded-lg p-3 shadow-sm min-w-[200px]">
                      <div className="font-medium text-sm mb-1">{drink.name}</div>
                      <div className="text-xs text-gray-600 mb-2">Cocktail</div>
                      <Button size="sm" variant="outline" className="w-full text-xs">
                        Make Again
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Featured Cocktails */}
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-500" />
              Featured Cocktails
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredCocktails.map((cocktail) => (
                <Card key={cocktail.id} className="overflow-hidden hover:shadow-xl transition-all hover:scale-105">
                  <div className="relative">
                    <img src={cocktail.image} alt={cocktail.name} className="w-full h-48 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-2 left-2">
                      <Badge className="bg-purple-500 text-white">{cocktail.spirit}</Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Button variant="ghost" size="sm" className="bg-white/80 hover:bg-white text-gray-600">
                        <Heart className={`h-4 w-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold">{cocktail.name}</h3>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="text-sm font-bold">{cocktail.rating}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{cocktail.time}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{cocktail.reviews.toLocaleString()}</span>
                      </div>
                      <Badge variant="outline">{cocktail.difficulty}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {cocktail.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                      View Recipe
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Education */}
          <Card className="bg-gradient-to-r from-purple-50 to-orange-50 border-purple-200">
            <CardContent className="p-6">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <ChefHat className="w-6 h-6 text-purple-600" />
                Mixology 101
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 text-purple-600">Essential Techniques</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Shaking vs Stirring</li>
                    <li>• Muddling herbs and fruits</li>
                    <li>• Building in glass</li>
                    <li>• Proper garnishing</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-orange-600">Bar Essentials</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Quality spirits</li>
                    <li>• Fresh citrus</li>
                    <li>• Simple syrup</li>
                    <li>• Bitters collection</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-pink-600">Pro Tips</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Use fresh ingredients</li>
                    <li>• Measure accurately</li>
                    <li>• Chill your glassware</li>
                    <li>• Taste and adjust</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">Explore More Drinks</h3>
                  <p className="text-gray-600 mb-4">Discover smoothies, protein shakes, and detoxes</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/drinks/smoothies'}>Smoothies</Button>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/drinks/protein-shakes'}>Protein Shakes</Button>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/drinks/detoxes'}>Detoxes</Button>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">{userProgress.totalDrinksMade}</div>
                  <div className="text-sm text-gray-600 mb-2">Total Drinks Made</div>
                  <Progress value={userProgress.dailyGoalProgress} className="w-24" />
                  <div className="text-xs text-gray-500 mt-1">Daily Goal</div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </RequireAgeGate>
  );
}
