import React, { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import RequireAgeGate from "@/components/RequireAgeGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Search, Filter, Shuffle, Camera, Share2, BookOpen,
  Wine, Coffee, GlassWater, MessageCircle, ThumbsUp, 
  Eye, Play, Pause, RotateCcw, Crown, Gem, RefreshCw,
  ArrowRight
} from 'lucide-react';

// ✅ Import the universal search and context
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';

// Types from TheCocktailDB
type Cocktail = {
  idDrink: string;
  strDrink: string;
  strCategory: string | null;
  strAlcoholic: string | null;
  strGlass: string | null;
  strInstructions: string | null;
  strDrinkThumb: string | null;
  [key: string]: string | null;
};

// API helpers
async function fetchRandomCocktail(): Promise<Cocktail> {
  const r = await fetch("https://www.thecocktaildb.com/api/json/v1/1/random.php");
  if (!r.ok) throw new Error("Failed to fetch random cocktail");
  const data = await r.json();
  if (!data?.drinks?.[0]) throw new Error("No cocktail found");
  return data.drinks[0] as Cocktail;
}

async function fetchNRandomCocktails(n = 6): Promise<Cocktail[]> {
  const arr = await Promise.all(Array.from({ length: n }, () => fetchRandomCocktail()));
  const map = new Map(arr.map((d) => [d.idDrink, d]));
  return Array.from(map.values());
}

async function searchCocktailsByName(query: string): Promise<Cocktail[]> {
  if (!query.trim()) return [];
  const r = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`);
  if (!r.ok) throw new Error("Search failed");
  const data = await r.json();
  return data?.drinks || [];
}

async function searchCocktailsByIngredient(ingredient: string): Promise<Cocktail[]> {
  if (!ingredient.trim()) return [];
  const r = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredient)}`);
  if (!r.ok) throw new Error("Search failed");
  const data = await r.json();
  return data?.drinks || [];
}

function getIngredients(drink: Cocktail) {
  const items: { name: string; measure?: string }[] = [];
  for (let i = 1; i <= 15; i++) {
    const name = drink[`strIngredient${i}`];
    const measure = drink[`strMeasure${i}`] ?? undefined;
    if (name && name.trim()) items.push({ name, measure });
  }
  return items;
}

const quickFilters = [
  { id: "trending", label: "🔥 Trending", color: "bg-red-500" },
  { id: "easy", label: "⚡ Quick & Easy", color: "bg-green-500" },
  { id: "featured", label: "⭐ Featured", color: "bg-yellow-500" },
  { id: "alcoholic", label: "🍸 Alcoholic", color: "bg-purple-500" },
  { id: "mocktail", label: "🥤 Mocktails", color: "bg-blue-500" },
  { id: "classic", label: "🎩 Classic", color: "bg-amber-600" }
];

const categories = [
  { name: "Cocktails", icon: Wine, count: 2847, color: "text-purple-500" },
  { name: "Shots", icon: Zap, count: 456, color: "text-orange-500" },
  { name: "Punches", icon: Droplets, count: 234, color: "text-teal-500" },
  { name: "Coffee Drinks", icon: Coffee, count: 189, color: "text-amber-500" },
  { name: "Mocktails", icon: GlassWater, count: 567, color: "text-blue-500" },
  { name: "Beer & Wine", icon: Wine, count: 389, color: "text-red-500" }
];

// ✅ Potent Potables subcategories for navigation
const potentPotablesSubcategories = [
  { id: 'cocktails', name: 'Classic Cocktails', icon: Wine, count: 15, route: '/drinks/potent-potables/cocktails' },
  { id: 'mocktails', name: 'Mocktails', icon: GlassWater, count: 8, route: '/drinks/potent-potables/mocktails' },
  { id: 'shots', name: 'Shots & Shooters', icon: Zap, count: 6, route: '/drinks/potent-potables/shots' },
  { id: 'punches', name: 'Punches & Bowls', icon: Droplets, count: 4, route: '/drinks/potent-potables/punches' }
];

export default function PotentPotablesPage() {
  // ✅ Use the drinks context
  const { 
    userProgress, 
    addPoints, 
    incrementDrinksMade, 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    favorites,
    getRecommendations
  } = useDrinks();

  const [selectedDrink, setSelectedDrink] = useState<Cocktail | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'ingredient'>('name');
  const [showAchievements, setShowAchievements] = useState(false);
  const [mixingAnimation, setMixingAnimation] = useState(false);
  const [likedDrinks, setLikedDrinks] = useState(new Set<string>());
  const [viewMode, setViewMode] = useState<'featured' | 'search' | 'random'>('featured');
  const [dailyChallenge, setDailyChallenge] = useState({
    title: "Mixology Monday",
    description: "Try a classic cocktail to earn 50 bonus points!",
    progress: 0,
    total: 1,
    reward: 50
  });

  // ✅ Get recommendations from context
  const recommendations = getRecommendations('potent-potables');

  // Queries
  const featuredDrinks = useQuery({
    queryKey: ["featuredCocktails"],
    queryFn: () => fetchNRandomCocktails(6),
    refetchOnWindowFocus: false,
  });

  const searchResults = useQuery({
    queryKey: ["searchCocktails", searchQuery, searchType],
    queryFn: () => searchType === 'name' 
      ? searchCocktailsByName(searchQuery)
      : searchCocktailsByIngredient(searchQuery),
    enabled: searchQuery.length > 2,
    refetchOnWindowFocus: false,
  });

  const randomDrink = useQuery({
    queryKey: ["randomCocktail", Date.now()],
    queryFn: fetchRandomCocktail,
    enabled: false,
    refetchOnWindowFocus: false,
  });

  const displayDrinks = viewMode === 'search' ? searchResults.data || [] : 
                       viewMode === 'random' ? (randomDrink.data ? [randomDrink.data] : []) :
                       featuredDrinks.data || [];

  const isLoading = featuredDrinks.isLoading || searchResults.isLoading || randomDrink.isLoading;

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 2) {
      setViewMode('search');
    }
  };

  const handleRandomDrink = () => {
    setViewMode('random');
    randomDrink.refetch();
  };

  // ✅ Enhanced handleLikeDrink with context integration
  const handleLikeDrink = (drinkId: string, drink?: Cocktail) => {
    setLikedDrinks(prev => {
      const newLiked = new Set(prev);
      if (newLiked.has(drinkId)) {
        newLiked.delete(drinkId);
      } else {
        newLiked.add(drinkId);
        addPoints(5);
        
        // Add to context favorites if drink data available
        if (drink) {
          const drinkData = {
            id: drink.idDrink,
            name: drink.strDrink,
            category: 'potent-potables' as const,
            description: drink.strInstructions || `${drink.strAlcoholic} ${drink.strCategory}`,
            ingredients: getIngredients(drink).map(ing => ing.name),
            nutrition: {
              calories: drink.strAlcoholic === 'Alcoholic' ? 150 : 50,
              protein: 0,
              carbs: 15,
              fat: 0
            },
            difficulty: 'Medium' as const,
            prepTime: 5,
            rating: 4.5,
            fitnessGoal: 'Social',
            bestTime: 'Evening'
          };
          addToFavorites(drinkData);
        }
      }
      return newLiked;
    });
  };

  // ✅ Enhanced handleStartMixing with context integration
  const handleStartMixing = (drink: Cocktail) => {
    setMixingAnimation(true);
    setSelectedDrink(drink);
    
    const drinkData = {
      id: drink.idDrink,
      name: drink.strDrink,
      category: 'potent-potables' as const,
      description: drink.strInstructions || `${drink.strAlcoholic} ${drink.strCategory}`,
      ingredients: getIngredients(drink).map(ing => ing.name),
      nutrition: {
        calories: drink.strAlcoholic === 'Alcoholic' ? 150 : 50,
        protein: 0,
        carbs: 15,
        fat: 0
      },
      difficulty: 'Medium' as const,
      prepTime: 5,
      rating: 4.5,
      fitnessGoal: 'Social',
      bestTime: 'Evening'
    };

    setTimeout(() => {
      setMixingAnimation(false);
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(25);
    }, 3000);
  };

  // ✅ Handle cross-page drink selection
  const handleDrinkSelection = (drink) => {
    console.log('Selected drink from universal search:', drink);
  };

  const toggleFilter = (filterId: string) => {
    setActiveFilters(prev => 
      prev.includes(filterId) 
        ? prev.filter(f => f !== filterId)
        : [...prev, filterId]
    );
  };

  const filteredDisplayDrinks = displayDrinks.filter(drink => {
    if (activeFilters.length === 0) return true;
    
    return activeFilters.some(filter => {
      switch(filter) {
        case 'alcoholic': return drink.strAlcoholic === 'Alcoholic';
        case 'mocktail': return drink.strAlcoholic === 'Non alcoholic';
        case 'classic': return ['Old-fashioned', 'Ordinary Drink', 'Cocktail'].includes(drink.strCategory || '');
        default: return true;
      }
    });
  });

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <GlassWater className="h-10 w-10" />
                  Potent Potables
                  <Badge className="bg-yellow-400 text-yellow-900 ml-2">
                    <Crown className="h-3 w-3 mr-1" />
                    Premium
                  </Badge>
                </h1>
                <p className="text-xl opacity-90">Your ultimate mixology destination powered by TheCocktailDB</p>
              </div>
              {/* ✅ Enhanced header with context data */}
              <div className="text-right">
                <div className="text-2xl font-bold">{userProgress.totalPoints.toLocaleString()} pts</div>
                <div className="text-sm opacity-80">Level {userProgress.level} Mixologist</div>
                <div className="text-xs opacity-70">{userProgress.totalDrinksMade} drinks made</div>
              </div>
            </div>

            {/* ✅ Enhanced Daily Challenge with Context Integration */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-400 p-2 rounded-full">
                      <Gift className="h-5 w-5 text-yellow-900" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{dailyChallenge.title}</h3>
                      <p className="text-sm opacity-80">{dailyChallenge.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">+{dailyChallenge.reward} pts</div>
                    <Progress value={(dailyChallenge.progress / dailyChallenge.total) * 100} className="w-20 h-2" />
                    <div className="text-xs opacity-70 mt-1">Streak: {userProgress.currentStreak} days</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* ✅ Universal Search Component */}
          <div className="mb-6">
            <UniversalSearch 
              onSelectDrink={handleDrinkSelection}
              placeholder="Search all drinks or find cocktail inspiration..."
              className="w-full mb-4"
            />
          </div>

          {/* ✅ Potent Potables Subcategories Navigation */}
          <Card className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Wine className="w-5 h-5 text-purple-500" />
                Explore Cocktail Categories
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {potentPotablesSubcategories.map((subcategory) => {
                  const Icon = subcategory.icon;
                  return (
                    <Button
                      key={subcategory.id}
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-300"
                      onClick={() => window.location.href = subcategory.route}
                    >
                      <Icon className="h-6 w-6 text-purple-600" />
                      <div className="text-center">
                        <div className="font-medium text-sm">{subcategory.name}</div>
                        <div className="text-xs text-gray-500">{subcategory.count} recipes</div>
                      </div>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ✅ Favorites Quick Access */}
          {favorites.filter(f => f.category === 'potent-potables').length > 0 && (
            <Card className="mb-6 bg-gradient-to-r from-purple-100 to-blue-100 border-purple-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-purple-500" />
                  Your Favorite Cocktails ({favorites.filter(f => f.category === 'potent-potables').length})
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {favorites.filter(f => f.category === 'potent-potables').slice(0, 5).map((drink) => (
                    <div key={drink.id} className="flex-shrink-0 bg-white rounded-lg p-3 shadow-sm min-w-[200px]">
                      <div className="font-medium text-sm mb-1">{drink.name}</div>
                      <div className="text-xs text-gray-600 mb-2">{drink.difficulty} cocktail</div>
                      <Button size="sm" variant="outline" className="w-full text-xs">
                        Mix Again
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search and Controls */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="text"
                  placeholder={`Search by ${searchType === 'name' ? 'drink name' : 'ingredient'}...`}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-12 text-lg"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={searchType === 'name' ? 'default' : 'outline'}
                  onClick={() => setSearchType('name')}
                >
                  By Name
                </Button>
                <Button 
                  variant={searchType === 'ingredient' ? 'default' : 'outline'}
                  onClick={() => setSearchType('ingredient')}
                >
                  By Ingredient
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleRandomDrink}
                  disabled={randomDrink.isLoading}
                >
                  {randomDrink.isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                  Random
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => setShowAchievements(!showAchievements)}
                  className="flex items-center gap-2"
                >
                  <Trophy className="h-5 w-5" />
                  Achievements
                </Button>
              </div>
            </div>

            {/* View Mode Buttons */}
            <div className="flex gap-2">
              <Button 
                variant={viewMode === 'featured' ? 'default' : 'outline'}
                onClick={() => setViewMode('featured')}
              >
                <Star className="h-4 w-4 mr-2" />
                Featured
              </Button>
              <Button 
                variant={viewMode === 'search' ? 'default' : 'outline'}
                onClick={() => setViewMode('search')}
                disabled={!searchQuery}
              >
                <Search className="h-4 w-4 mr-2" />
                Search Results
              </Button>
              <Button 
                variant={viewMode === 'random' ? 'default' : 'outline'}
                onClick={() => setViewMode('random')}
              >
                <Shuffle className="h-4 w-4 mr-2" />
                Random
              </Button>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap gap-2">
              {quickFilters.map(filter => (
                <Badge
                  key={filter.id}
                  variant={activeFilters.includes(filter.id) ? "default" : "outline"}
                  className={`cursor-pointer px-3 py-1 transition-all hover:scale-105 ${
                    activeFilters.includes(filter.id) ? filter.color + ' text-white' : ''
                  }`}
                  onClick={() => toggleFilter(filter.id)}
                >
                  {filter.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* ✅ Enhanced Achievements Panel with Context Data */}
          {showAchievements && (
            <Card className="mb-6 border-2 border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-yellow-500" />
                  Your Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userProgress.achievements.map((achievement, index) => (
                    <div key={achievement} className="p-4 rounded-lg border bg-green-50 border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-green-500" />
                          <span className="font-semibold">{achievement}</span>
                        </div>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Achievement unlocked!</p>
                      <Progress value={100} className="h-2" />
                      <div className="text-xs text-gray-500 mt-1">Completed</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Categories Overview */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {categories.map(category => (
              <Card key={category.name} className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="p-4 text-center">
                  <category.icon className={`h-8 w-8 mx-auto mb-2 ${category.color}`} />
                  <h3 className="font-semibold text-sm">{category.name}</h3>
                  <p className="text-xs text-gray-500">{category.count} recipes</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 rounded-lg bg-gray-200 animate-pulse" />
              ))}
            </div>
          )}

          {/* Drinks Grid */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDisplayDrinks.map(drink => (
                <CocktailCard 
                  key={drink.idDrink} 
                  drink={drink}
                  isLiked={likedDrinks.has(drink.idDrink)}
                  onLike={() => handleLikeDrink(drink.idDrink, drink)}
                  onMix={() => handleStartMixing(drink)}
                  isFavorite={isFavorite}
                  addToFavorites={addToFavorites}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredDisplayDrinks.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Sparkles className="w-10 h-10 mx-auto mb-3 text-purple-500" />
                <h3 className="text-xl font-semibold mb-2">No drinks found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search or filters, or discover something new with a random cocktail.
                </p>
                <Button onClick={handleRandomDrink}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Get Random Cocktail
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ✅ Enhanced Mixing Animation Modal */}
          {mixingAnimation && selectedDrink && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <Card className="w-80 p-6 text-center">
                <div className="mb-4">
                  <Zap className="h-16 w-16 mx-auto text-purple-500 animate-bounce" />
                </div>
                <h3 className="text-xl font-bold mb-2">Mixing {selectedDrink.strDrink}...</h3>
                <p className="text-gray-600 mb-4">Following the recipe step by step</p>
                <Progress value={66} className="mb-4" />
                <p className="text-sm text-green-600">+25 XP earned!</p>
                <p className="text-xs text-blue-600 mt-1">Drink added to your history</p>
              </Card>
            </div>
          )}

          {/* Refresh Featured Button */}
          {viewMode === 'featured' && (
            <div className="text-center mt-8">
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => featuredDrinks.refetch()}
                disabled={featuredDrinks.isLoading}
              >
                {featuredDrinks.isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Refresh Featured Drinks
              </Button>
            </div>
          )}

          {/* ✅ Enhanced Stats Footer with Context Data */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4">
              <div className="text-2xl font-bold text-purple-600">{filteredDisplayDrinks.length}</div>
              <div className="text-sm text-gray-500">Drinks Found</div>
            </div>
            <div className="p-4">
              <div className="text-2xl font-bold text-blue-600">{userProgress.totalPoints.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Total Points</div>
            </div>
            <div className="p-4">
              <div className="text-2xl font-bold text-green-600">{likedDrinks.size}</div>
              <div className="text-sm text-gray-500">Drinks Liked</div>
            </div>
            <div className="p-4">
              <div className="text-2xl font-bold text-orange-600">{userProgress.level}</div>
              <div className="text-sm text-gray-500">Current Level</div>
            </div>
          </div>

          {/* ✅ Cross-Page Integration Footer */}
          <Card className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">Explore More Drinks</h3>
                  <p className="text-gray-600 mb-4">Discover smoothies, protein shakes, and detoxes</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Smoothies</Button>
                    <Button variant="outline" size="sm">Protein Shakes</Button>
                    <Button variant="outline" size="sm">Detox Drinks</Button>
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

// ✅ Enhanced Cocktail Card Component with Context Integration
function CocktailCard({ 
  drink, 
  isLiked, 
  onLike, 
  onMix,
  isFavorite,
  addToFavorites
}: { 
  drink: Cocktail; 
  isLiked: boolean; 
  onLike: () => void; 
  onMix: () => void;
  isFavorite: (id: string) => boolean;
  addToFavorites: (drink: any) => void;
}) {
  const ingredients = React.useMemo(() => getIngredients(drink), [drink]);

  return (
    <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
      <div className="relative">
        {drink.strDrinkThumb ? (
          <img 
            src={drink.strDrinkThumb} 
            alt={drink.strDrink}
            className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
            <GlassWater className="h-16 w-16 text-white opacity-50" />
          </div>
        )}
        
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
          {drink.strAlcoholic && (
            <Badge className={drink.strAlcoholic === 'Alcoholic' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}>
              {drink.strAlcoholic}
            </Badge>
          )}
          {drink.strCategory && (
            <Badge variant="secondary">{drink.strCategory}</Badge>
          )}
        </div>
        
        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              // Share functionality
            }}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-lg group-hover:text-purple-600 transition-colors line-clamp-2">
            {drink.strDrink}
          </h3>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            4.{Math.floor(Math.random() * 9) + 1}
          </div>
        </div>
        
        {drink.strGlass && (
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
            <GlassWater className="h-4 w-4" />
            {drink.strGlass}
          </div>
        )}

        {/* Instructions */}
        {drink.strInstructions && (
          <div className="mb-3">
            <p className="text-sm text-gray-600 line-clamp-3">{drink.strInstructions}</p>
          </div>
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <div className="mb-3">
            <h4 className="font-semibold text-sm mb-1">Ingredients</h4>
            <div className="flex flex-wrap gap-1">
              {ingredients.slice(0, 3).map((ing, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {ing.name}
                </Badge>
              ))}
              {ingredients.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{ingredients.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-4 w-4" />
              {Math.floor(Math.random() * 500) + 100}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {Math.floor(Math.random() * 50) + 10}
            </span>
          </div>
          <Button
            size="sm"
            onClick={onMix}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            <Zap className="h-4 w-4 mr-1" />
            Mix It!
          </Button>
        </div>

        <div className="mt-3 pt-3 border-t">
          <div className="text-xs text-gray-500 mb-1">TheCocktailDB ID</div>
          <div className="text-sm font-medium">#{drink.idDrink}</div>
        </div>
      </CardContent>
    </Card>
  );
}
