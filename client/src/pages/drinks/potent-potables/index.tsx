import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Search, Filter, Heart, Star, Clock, Users, Trophy, Zap, 
  Sparkles, Flame, Droplets, Wine, GlassWater, Leaf, Apple,
  ChefHat, Target, Crown, ArrowRight, ArrowLeft, Camera,
  Share2, TrendingUp, Calendar, CheckCircle, Plus
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

// Main drink categories
const drinkCategories = [
  {
    id: 'smoothies',
    name: 'Smoothies',
    description: 'Nutrient-packed fruit and vegetable blends',
    icon: Sparkles,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-200',
    count: 45,
    rating: 4.8,
    prepTime: '3-5 min',
    featured: true,
    subcategories: [
      { name: 'Berry', path: '/drinks/smoothies/berry', color: 'red' },
      { name: 'Protein', path: '/drinks/smoothies/protein', color: 'blue' },
      { name: 'Green', path: '/drinks/smoothies/green', color: 'emerald' },
      { name: 'Tropical', path: '/drinks/smoothies/tropical', color: 'orange' }
    ]
  },
  {
    id: 'protein-shakes',
    name: 'Protein Shakes',
    description: 'Muscle-building and recovery drinks',
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'from-blue-50 to-cyan-50',
    borderColor: 'border-blue-200',
    count: 32,
    rating: 4.7,
    prepTime: '2-4 min',
    featured: true,
    subcategories: [
      { name: 'Whey', path: '/drinks/protein-shakes/whey', color: 'blue' },
      { name: 'Plant', path: '/drinks/protein-shakes/plant', color: 'green' },
      { name: 'Meal Replacement', path: '/drinks/protein-shakes/meal', color: 'purple' }
    ]
  },
  {
    id: 'detoxes',
    name: 'Detox & Cleanses',
    description: 'Cleansing and rejuvenating beverages',
    icon: Leaf,
    color: 'from-emerald-500 to-green-500',
    bgColor: 'from-emerald-50 to-green-50',
    borderColor: 'border-emerald-200',
    count: 28,
    rating: 4.6,
    prepTime: '4-6 min',
    subcategories: [
      { name: 'Juices', path: '/drinks/detoxes/juices', color: 'green' },
      { name: 'Teas', path: '/drinks/detoxes/teas', color: 'amber' },
      { name: 'Waters', path: '/drinks/detoxes/waters', color: 'cyan' }
    ]
  },
  {
    id: 'potent-potables',
    name: 'Potent Potables',
    description: 'Cocktails and sophisticated drinks (21+)',
    icon: Wine,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'from-purple-50 to-pink-50',
    borderColor: 'border-purple-200',
    count: 67,
    rating: 4.9,
    prepTime: '5-8 min',
    ageRestricted: true,
    featured: true,
    subcategories: [
      { name: 'Classic Cocktails', path: '/drinks/potent-potables/cocktails', color: 'purple' },
      { name: 'Vodka', path: '/drinks/potent-potables/vodka', color: 'cyan' },
      { name: 'Whiskey', path: '/drinks/potent-potables/whiskey', color: 'amber' }
    ]
  },
  {
    id: 'energizers',
    name: 'Energy & Focus',
    description: 'Drinks to boost energy and mental clarity',
    icon: Flame,
    color: 'from-orange-500 to-red-500',
    bgColor: 'from-orange-50 to-red-50',
    borderColor: 'border-orange-200',
    count: 23,
    rating: 4.5,
    prepTime: '3-5 min',
    subcategories: [
      { name: 'Pre-Workout', path: '/drinks/energizers/pre-workout', color: 'red' },
      { name: 'Mental Focus', path: '/drinks/energizers/focus', color: 'yellow' }
    ]
  },
  {
    id: 'hydration',
    name: 'Hydration',
    description: 'Electrolyte and hydration solutions',
    icon: Droplets,
    color: 'from-cyan-500 to-blue-500',
    bgColor: 'from-cyan-50 to-blue-50',
    borderColor: 'border-cyan-200',
    count: 18,
    rating: 4.4,
    prepTime: '1-2 min',
    subcategories: [
      { name: 'Electrolyte', path: '/drinks/hydration/electrolyte', color: 'blue' },
      { name: 'Infused Water', path: '/drinks/hydration/infused', color: 'cyan' }
    ]
  }
];

// Recently viewed drinks mock data
const recentlyViewedDrinks = [
  {
    id: 'berry-1',
    name: 'Triple Berry Blast',
    category: 'smoothies',
    description: 'Antioxidant-rich berry smoothie',
    rating: 4.8,
    prepTime: 3,
    image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=200&h=150&fit=crop'
  },
  {
    id: 'protein-1',
    name: 'Chocolate Whey Shake',
    category: 'protein-shakes',
    description: 'Creamy chocolate protein shake',
    rating: 4.7,
    prepTime: 2,
    image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=200&h=150&fit=crop'
  },
  {
    id: 'cocktail-1',
    name: 'Old Fashioned',
    category: 'potent-potables',
    description: 'Classic whiskey cocktail',
    rating: 4.9,
    prepTime: 5,
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200&h=150&fit=crop'
  }
];

// Featured recipes
const featuredRecipes = [
  {
    id: 'featured-1',
    name: 'Green Detox Smoothie',
    category: 'smoothies',
    description: 'Cleansing green smoothie with spinach and apple',
    rating: 4.8,
    reviews: 234,
    prepTime: 4,
    difficulty: 'Easy',
    image: 'https://images.unsplash.com/photo-1638176066668-04dd7bb7f5b3?w=300&h=200&fit=crop',
    tags: ['Detox', 'Green', 'Healthy']
  },
  {
    id: 'featured-2',
    name: 'Vanilla Protein Shake',
    category: 'protein-shakes',
    description: 'Creamy vanilla protein for muscle recovery',
    rating: 4.7,
    reviews: 189,
    prepTime: 3,
    difficulty: 'Easy',
    image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=300&h=200&fit=crop',
    tags: ['Protein', 'Recovery', 'Vanilla']
  },
  {
    id: 'featured-3',
    name: 'Classic Margarita',
    category: 'potent-potables',
    description: 'Traditional tequila cocktail with lime',
    rating: 4.9,
    reviews: 312,
    prepTime: 5,
    difficulty: 'Medium',
    image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300&h=200&fit=crop',
    tags: ['Tequila', 'Classic', 'Refreshing']
  }
];

export default function DrinksHubPage() {
  const { 
    userProgress, 
    favorites, 
    recentlyViewed,
    addToFavorites,
    isFavorite,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  // Filter categories based on search and selection
  const filteredCategories = useMemo(() => {
    return drinkCategories.filter(category => {
      const matchesSearch = searchQuery === '' || 
        category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || 
        category.id === selectedCategory ||
        (selectedCategory === 'featured' && category.featured);
      
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Handle drink selection from universal search
  const handleDrinkSelection = (drink: any) => {
    console.log('Selected drink:', drink);
    // Navigate to drink page or show details
  };

  // Handle making a drink
  const handleMakeDrink = (drink: any) => {
    incrementDrinksMade();
    addPoints(20, `Made ${drink.name}`);
    // Additional logic for drink completion
  };

  // Handle sharing a drink
  const handleShareDrink = async (drink: any) => {
    const shareData = {
      title: drink.name,
      text: drink.description,
      url: window.location.href
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${drink.name} - ${drink.description}`);
        alert('Drink link copied to clipboard!');
      }
    } catch (err) {
      console.log('Error sharing:', err);
    }
  };

  // Quick stats
  const totalRecipes = drinkCategories.reduce((sum, cat) => sum + cat.count, 0);
  const averageRating = (drinkCategories.reduce((sum, cat) => sum + cat.rating, 0) / drinkCategories.length).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Search All Drinks</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowUniversalSearch(false)}>
                <span className="text-xl">×</span>
              </Button>
            </div>
            <div className="p-4">
              <UniversalSearch onSelectDrink={handleDrinkSelection} onClose={() => setShowUniversalSearch(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <GlassWater className="h-8 w-8 text-blue-500" />
                <h1 className="text-2xl font-bold text-gray-900">Drink Hub</h1>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {totalRecipes}+ Recipes
              </Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button 
                size="sm" 
                className="bg-blue-500 hover:bg-blue-600"
                onClick={() => setShowUniversalSearch(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Search Drinks
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
            Discover Your Perfect Drink
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            From protein shakes to classic cocktails, find the perfect beverage for every occasion
          </p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{totalRecipes}</div>
                <div className="text-sm text-gray-600">Total Recipes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{averageRating}★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{userProgress.totalDrinksMade}</div>
                <div className="text-sm text-gray-600">Drinks Made</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{favorites.length}</div>
                <div className="text-sm text-gray-600">Favorites</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              placeholder="Search drinks, ingredients, or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-6 text-lg border-2 border-gray-200 focus:border-blue-500"
            />
            <Button 
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setShowUniversalSearch(true)}
            >
              Advanced Search
            </Button>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('all')}
          >
            All Drinks
          </Button>
          <Button
            variant={activeFilter === 'featured' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('featured')}
          >
            <Star className="h-4 w-4 mr-2" />
            Featured
          </Button>
          <Button
            variant={activeFilter === 'quick' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('quick')}
          >
            <Clock className="h-4 w-4 mr-2" />
            Quick Prep
          </Button>
          <Button
            variant={activeFilter === 'trending' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('trending')}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Trending
          </Button>
        </div>

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-600" />
                Recently Viewed
              </h3>
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentlyViewed.slice(0, 3).map((drink) => (
                <Card key={drink.id} className="hover:shadow-lg transition-shadow group">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {drink.image && (
                        <img 
                          src={drink.image} 
                          alt={drink.name}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h4 className="font-semibold text-sm truncate">{drink.name}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addToFavorites(drink)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Heart className={`h-4 w-4 ${isFavorite(drink.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{drink.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                            <span className="text-xs font-medium">{drink.rating}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{drink.prepTime}m</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleMakeDrink(drink)}
                      >
                        Make Again
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleShareDrink(drink)}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Featured Recipes */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Featured Recipes
            </h3>
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredRecipes.map((recipe) => (
              <Card key={recipe.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="relative h-48">
                  <img 
                    src={recipe.image} 
                    alt={recipe.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-white/90 backdrop-blur text-gray-800">
                      {recipe.difficulty}
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-white/90 backdrop-blur hover:bg-white"
                      onClick={() => addToFavorites(recipe)}
                    >
                      <Heart className={`h-4 w-4 ${isFavorite(recipe.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-lg">{recipe.name}</h4>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{recipe.rating}</span>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{recipe.description}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{recipe.prepTime} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{recipe.reviews} reviews</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {recipe.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      className="flex-1"
                      onClick={() => handleMakeDrink(recipe)}
                    >
                      Make Drink
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleShareDrink(recipe)}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Main Categories Grid */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold">Drink Categories</h3>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select 
                className="border rounded-md px-3 py-1 text-sm"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="featured">Featured</option>
                {drinkCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              return (
                <Link key={category.id} href={`/drinks/${category.id}`}>
                  <Card className={`group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-2 ${category.borderColor} bg-gradient-to-br ${category.bgColor}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-gradient-to-r ${category.color} text-white`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">{category.name}</CardTitle>
                            <p className="text-sm text-gray-600">{category.description}</p>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-4">
                          <span>{category.count} recipes</span>
                          <span>★ {category.rating}</span>
                          <span>{category.prepTime}</span>
                        </div>
                        {category.ageRestricted && (
                          <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                            21+
                          </Badge>
                        )}
                      </div>

                      {/* Subcategories */}
                      <div className="flex flex-wrap gap-1">
                        {category.subcategories.slice(0, 3).map((subcat, index) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className={`text-xs bg-${subcat.color}-100 text-${subcat.color}-700 border-${subcat.color}-200`}
                          >
                            {subcat.name}
                          </Badge>
                        ))}
                        {category.subcategories.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{category.subcategories.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* User Progress */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Your Drink Journey</h3>
                <p className="text-gray-600 mb-4">
                  Keep exploring and earning rewards for your mixology skills!
                </p>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="bg-white">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="bg-white">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="bg-white">
                    {userProgress.totalDrinksMade} Drinks Made
                  </Badge>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {Math.round(userProgress.dailyGoalProgress)}%
                </div>
                <div className="text-sm text-gray-600 mb-2">Daily Goal</div>
                <Progress value={userProgress.dailyGoalProgress} className="w-32" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="h-20 flex-col gap-2">
            <Plus className="h-6 w-6" />
            <span>Add Custom Recipe</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2">
            <Heart className="h-6 w-6" />
            <span>Favorites ({favorites.length})</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2">
            <Calendar className="h-6 w-6" />
            <span>Drink Planner</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2">
            <ChefHat className="h-6 w-6" />
            <span>My Creations</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
