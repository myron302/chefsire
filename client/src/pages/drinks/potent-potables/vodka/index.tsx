import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Droplets, Clock, Heart, Star, Target, Sparkles, Wine, 
  Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater,
  TrendingUp, Award, Snowflake, Cherry, Coffee, Zap, Crown
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const vodkaCocktails = [
  // CLASSIC VODKA COCKTAILS
  {
    id: 'vodka-1',
    name: 'Moscow Mule',
    description: 'Spicy ginger beer with vodka and lime in copper mug',
    vodkaStyle: 'Classic',
    origin: 'Los Angeles, USA',
    glassware: 'Copper Mug',
    servingSize: '10 oz',
    nutrition: {
      calories: 182,
      carbs: 18,
      sugar: 16,
      alcohol: 11
    },
    ingredients: [
      'Vodka (2 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Ginger Beer (6 oz)',
      'Lime Wedge',
      'Fresh Mint',
      'Ice'
    ],
    profile: ['Spicy', 'Citrus', 'Refreshing', 'Effervescent'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 4892,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Vodka',
    garnish: 'Lime wedge, mint sprig',
    method: 'Build',
    abv: '15-20%',
    iba_official: true,
    era: '1940s'
  },
  {
    id: 'vodka-2',
    name: 'Cosmopolitan',
    description: '90s icon with cranberry, lime, and triple sec',
    vodkaStyle: 'Classic',
    origin: 'New York City',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 150,
      carbs: 8,
      sugar: 7,
      alcohol: 12
    },
    ingredients: [
      'Vodka (1.5 oz)',
      'Triple Sec (0.5 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Cranberry Juice (1 oz)',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Tart', 'Fruity', 'Smooth', 'Elegant'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 3421,
    trending: false,
    featured: true,
    estimatedCost: 4.25,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Classic Vodka',
    garnish: 'Orange peel twist',
    method: 'Shake',
    abv: '20-25%',
    iba_official: true,
    era: '1980s'
  },
  {
    id: 'vodka-3',
    name: 'Bloody Mary',
    description: 'Savory brunch classic with tomato juice and spices',
    vodkaStyle: 'Classic',
    origin: 'Paris, France',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 125,
      carbs: 10,
      sugar: 6,
      alcohol: 10
    },
    ingredients: [
      'Vodka (2 oz)',
      'Tomato Juice (4 oz)',
      'Fresh Lemon Juice (0.5 oz)',
      'Worcestershire Sauce (3 dashes)',
      'Hot Sauce (2-3 dashes)',
      'Celery Salt',
      'Black Pepper',
      'Celery Stalk',
      'Lemon Wedge'
    ],
    profile: ['Savory', 'Spicy', 'Umami', 'Brunch'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 3987,
    trending: false,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Morning',
    occasion: 'Brunch',
    allergens: [],
    category: 'Classic Vodka',
    garnish: 'Celery stalk, lemon wedge',
    method: 'Roll',
    abv: '12-16%',
    iba_official: true,
    era: '1920s'
  },
  {
    id: 'vodka-4',
    name: 'White Russian',
    description: 'Creamy coffee cocktail with vodka and Kahlúa',
    vodkaStyle: 'Classic',
    origin: 'Belgium',
    glassware: 'Rocks Glass',
    servingSize: '6 oz',
    nutrition: {
      calories: 225,
      carbs: 15,
      sugar: 12,
      alcohol: 12
    },
    ingredients: [
      'Vodka (2 oz)',
      'Coffee Liqueur (1 oz)',
      'Heavy Cream (1 oz)',
      'Ice'
    ],
    profile: ['Creamy', 'Coffee', 'Sweet', 'Dessert'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 3124,
    trending: false,
    featured: false,
    estimatedCost: 4.25,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: ['Dairy'],
    category: 'Classic Vodka',
    garnish: 'None',
    method: 'Build',
    abv: '20-25%',
    iba_official: true,
    era: '1960s'
  },

  // MODERN VODKA COCKTAILS
  {
    id: 'vodka-5',
    name: 'Espresso Martini',
    description: 'Coffee-forward dessert martini',
    vodkaStyle: 'Modern',
    origin: 'London, UK',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 12,
      sugar: 10,
      alcohol: 14
    },
    ingredients: [
      'Vodka (2 oz)',
      'Coffee Liqueur (1 oz)',
      'Fresh Espresso (1 oz)',
      'Simple Syrup (0.25 oz)',
      'Ice',
      'Coffee Beans (3)'
    ],
    profile: ['Coffee', 'Sweet', 'Energizing', 'Smooth'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 5234,
    trending: true,
    featured: true,
    estimatedCost: 4.25,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Vodka',
    garnish: '3 coffee beans',
    method: 'Shake',
    abv: '20-25%',
    iba_official: true,
    era: '1980s'
  },
  {
    id: 'vodka-6',
    name: 'Lemon Drop Martini',
    description: 'Sweet and tart vodka martini with sugar rim',
    vodkaStyle: 'Modern',
    origin: 'San Francisco',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 165,
      carbs: 12,
      sugar: 10,
      alcohol: 13
    },
    ingredients: [
      'Vodka (2 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Simple Syrup (0.5 oz)',
      'Triple Sec (0.5 oz)',
      'Sugar (for rim)',
      'Lemon Twist',
      'Ice'
    ],
    profile: ['Tart', 'Sweet', 'Citrus', 'Fun'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 2876,
    trending: false,
    featured: true,
    estimatedCost: 3.75,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Vodka',
    garnish: 'Sugar rim, lemon twist',
    method: 'Shake',
    abv: '20-25%',
    iba_official: false,
    era: '1970s'
  },
  {
    id: 'vodka-7',
    name: 'Sex on the Beach',
    description: 'Fruity beach cocktail with peach and cranberry',
    vodkaStyle: 'Modern',
    origin: 'Florida, USA',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 215,
      carbs: 22,
      sugar: 20,
      alcohol: 10
    },
    ingredients: [
      'Vodka (1.5 oz)',
      'Peach Schnapps (0.5 oz)',
      'Cranberry Juice (2 oz)',
      'Orange Juice (2 oz)',
      'Orange Slice',
      'Cherry',
      'Ice'
    ],
    profile: ['Fruity', 'Sweet', 'Tropical', 'Fun'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 3654,
    trending: false,
    featured: false,
    estimatedCost: 3.50,
    bestTime: 'Afternoon',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Vodka',
    garnish: 'Orange slice, cherry',
    method: 'Shake',
    abv: '12-16%',
    iba_official: true,
    era: '1980s'
  },
  {
    id: 'vodka-8',
    name: 'Vesper Martini',
    description: 'James Bond\'s martini with gin, vodka, and Lillet',
    vodkaStyle: 'Classic',
    origin: 'Literary (James Bond)',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 2,
      sugar: 1,
      alcohol: 19
    },
    ingredients: [
      'Gin (3 oz)',
      'Vodka (1 oz)',
      'Lillet Blanc (0.5 oz)',
      'Ice for shaking',
      'Lemon Peel'
    ],
    profile: ['Strong', 'Complex', 'Sophisticated', 'Iconic'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.8,
    reviews: 2543,
    trending: true,
    featured: true,
    estimatedCost: 5.75,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Vodka',
    garnish: 'Lemon peel',
    method: 'Shake',
    abv: '35-40%',
    iba_official: true,
    era: '1950s'
  },

  // CONTEMPORARY VODKA COCKTAILS
  {
    id: 'vodka-9',
    name: 'French Martini',
    description: 'Vodka with pineapple and Chambord',
    vodkaStyle: 'Modern',
    origin: 'New York City',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 205,
      carbs: 18,
      sugar: 15,
      alcohol: 12
    },
    ingredients: [
      'Vodka (2 oz)',
      'Chambord (0.5 oz)',
      'Pineapple Juice (1.5 oz)',
      'Ice',
      'Pineapple Wedge'
    ],
    profile: ['Fruity', 'Sweet', 'Smooth', 'Tropical'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 2987,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Vodka',
    garnish: 'Pineapple wedge',
    method: 'Shake',
    abv: '18-22%',
    iba_official: true,
    era: '1980s'
  },
  {
    id: 'vodka-10',
    name: 'Vodka Soda',
    description: 'Simple, low-calorie vodka with club soda',
    vodkaStyle: 'Simple',
    origin: 'Universal',
    glassware: 'Highball',
    servingSize: '8 oz',
    nutrition: {
      calories: 96,
      carbs: 0,
      sugar: 0,
      alcohol: 14
    },
    ingredients: [
      'Vodka (2 oz)',
      'Club Soda (6 oz)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Clean', 'Crisp', 'Light', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 1,
    rating: 4.3,
    reviews: 2134,
    trending: false,
    featured: false,
    estimatedCost: 2.50,
    bestTime: 'Anytime',
    occasion: 'Casual',
    allergens: [],
    category: 'Simple Vodka',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '18-22%',
    iba_official: false,
    era: 'Modern'
  },
  {
    id: 'vodka-11',
    name: 'Vodka Tonic',
    description: 'Crisp vodka with tonic water and lime',
    vodkaStyle: 'Simple',
    origin: 'Universal',
    glassware: 'Highball',
    servingSize: '8 oz',
    nutrition: {
      calories: 175,
      carbs: 16,
      sugar: 14,
      alcohol: 12
    },
    ingredients: [
      'Vodka (2 oz)',
      'Tonic Water (6 oz)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Bitter', 'Crisp', 'Quinine', 'Simple'],
    difficulty: 'Easy',
    prepTime: 1,
    rating: 4.4,
    reviews: 1987,
    trending: false,
    featured: false,
    estimatedCost: 2.75,
    bestTime: 'Anytime',
    occasion: 'Casual',
    allergens: [],
    category: 'Simple Vodka',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '15-18%',
    iba_official: false,
    era: 'Modern'
  },
  {
    id: 'vodka-12',
    name: 'Screwdriver',
    description: 'Classic vodka and orange juice',
    vodkaStyle: 'Simple',
    origin: 'United States',
    glassware: 'Highball',
    servingSize: '8 oz',
    nutrition: {
      calories: 190,
      carbs: 18,
      sugar: 16,
      alcohol: 11
    },
    ingredients: [
      'Vodka (2 oz)',
      'Fresh Orange Juice (6 oz)',
      'Orange Slice',
      'Ice'
    ],
    profile: ['Fruity', 'Sweet', 'Simple', 'Brunch'],
    difficulty: 'Easy',
    prepTime: 1,
    rating: 4.5,
    reviews: 2765,
    trending: false,
    featured: false,
    estimatedCost: 2.50,
    bestTime: 'Brunch',
    occasion: 'Casual',
    allergens: [],
    category: 'Simple Vodka',
    garnish: 'Orange slice',
    method: 'Build',
    abv: '12-15%',
    iba_official: false,
    era: '1950s'
  }
];

const vodkaCategories = [
  { 
    id: 'all', 
    name: 'All Vodka', 
    icon: Droplets,
    color: 'bg-cyan-500',
    description: 'Every vodka cocktail'
  },
  { 
    id: 'classic', 
    name: 'Classic', 
    icon: Crown,
    color: 'bg-blue-500',
    description: 'Timeless vodka cocktails'
  },
  { 
    id: 'modern', 
    name: 'Modern', 
    icon: Sparkles,
    color: 'bg-purple-500',
    description: 'Contemporary creations'
  },
  { 
    id: 'simple', 
    name: 'Simple', 
    icon: Zap,
    color: 'bg-green-500',
    description: 'Easy 2-ingredient drinks'
  }
];

export default function VodkaCocktailsPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCocktail, setSelectedCocktail] = useState<typeof vodkaCocktails[0] | null>(null);
  const [calorieRange, setCalorieRange] = useState([0, 250]);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyIBA, setOnlyIBA] = useState(false);

  const filteredCocktails = vodkaCocktails.filter(cocktail => {
    if (selectedCategory !== 'all' && cocktail.vodkaStyle.toLowerCase() !== selectedCategory) {
      return false;
    }
    if (cocktail.nutrition.calories < calorieRange[0] || cocktail.nutrition.calories > calorieRange[1]) {
      return false;
    }
    if (searchQuery && !cocktail.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (onlyIBA && !cocktail.iba_official) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'trending') return b.reviews - a.reviews;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'calories-low') return a.nutrition.calories - b.nutrition.calories;
    if (sortBy === 'alcohol-low') return parseInt(a.abv) - parseInt(b.abv);
    if (sortBy === 'cost-low') return a.estimatedCost - b.estimatedCost;
    return 0;
  });

  const handleCocktailClick = (cocktail: typeof vodkaCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'Vodka Cocktails',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof vodkaCocktails[0]) => {
    incrementDrinksMade();
    addPoints(30, 'Made a vodka cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50">
        {/* Universal Search */}
        <div className="bg-white border-b border-cyan-100 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <UniversalSearch />
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white py-8">
          <div className="max-w-7xl mx-auto px-4">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Potent Potables
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <Droplets className="w-10 h-10" />
                  Vodka Cocktails
                </h1>
                <p className="text-cyan-100 text-lg">Clean, versatile, and endlessly mixable</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{filteredCocktails.length}</div>
                <div className="text-cyan-100">Recipes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Category Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {vodkaCategories.map(category => {
              const Icon = category.icon;
              const categoryCocktails = vodkaCocktails.filter(c => 
                category.id === 'all' || c.vodkaStyle.toLowerCase() === category.id
              );
              
              return (
                <Card 
                  key={category.id}
                  className={`cursor-pointer transition-all ${
                    selectedCategory === category.id ? 'ring-2 ring-cyan-500 ring-offset-2' : ''
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`inline-flex p-3 ${category.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-full mb-3`}>
                      <Icon className={`w-6 h-6 ${category.color.replace('bg-', 'text-')}`} />
                    </div>
                    <h3 className="font-bold mb-1">{category.name}</h3>
                    <p className="text-xs text-gray-600 mb-2">{category.description}</p>
                    <div className="text-2xl font-bold text-gray-900">{categoryCocktails.length}</div>
                    <div className="text-xs text-gray-600">Cocktails</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Filters and Sort */}
          <div className="flex gap-4 mb-6 items-center flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search vodka cocktails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              <option value="trending">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="calories-low">Lowest Calories</option>
              <option value="alcohol-low">Lowest ABV</option>
              <option value="cost-low">Most Budget-Friendly</option>
            </select>
            <Button 
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Target className="w-4 h-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <Card className="mb-6 bg-white border-cyan-200">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Calorie Range: {calorieRange[0]}-{calorieRange[1]} cal
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="250"
                      value={calorieRange[1]}
                      onChange={(e) => setCalorieRange([calorieRange[0], parseInt(e.target.value)])}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="iba-only"
                      checked={onlyIBA}
                      onChange={(e) => setOnlyIBA(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="iba-only" className="text-sm font-medium">
                      IBA Official Cocktails Only
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cocktails Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map(cocktail => {
              const categoryData = vodkaCategories.find(c => c.id === cocktail.vodkaStyle.toLowerCase());
              const CategoryIcon = categoryData?.icon || Droplets;
              
              return (
                <Card 
                  key={cocktail.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-cyan-100 hover:border-cyan-300"
                  onClick={() => handleCocktailClick(cocktail)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-lg">{cocktail.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToFavorites({
                            id: cocktail.id,
                            name: cocktail.name,
                            category: 'Vodka Cocktails',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className={categoryData?.color}>
                        <CategoryIcon className="w-3 h-3 mr-1" />
                        {cocktail.vodkaStyle}
                      </Badge>
                      {cocktail.trending && (
                        <Badge className="bg-purple-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.featured && (
                        <Badge className="bg-cyan-500">
                          <GlassWater className="fill-cyan-500 text-cyan-500" />
                          Featured
                        </Badge>
                      )}
                      {cocktail.iba_official && (
                        <Badge className="bg-blue-500">
                          <Award className="w-3 h-3 mr-1" />
                          IBA
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{cocktail.description}</p>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span>{cocktail.nutrition.calories} cal</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span>{cocktail.prepTime} min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-cyan-500" />
                        <span>{cocktail.abv} ABV</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{cocktail.rating} ({cocktail.reviews})</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {cocktail.profile.slice(0, 3).map(trait => (
                        <Badge key={trait} variant="outline" className="text-xs border-cyan-300">
                          {trait}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm font-medium text-cyan-600">{cocktail.method}</span>
                      <span className="text-sm text-gray-500">${cocktail.estimatedCost.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Cocktail Detail Modal */}
          {selectedCocktail && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedCocktail(null)}>
              <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{selectedCocktail.name}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">{selectedCocktail.origin} • {selectedCocktail.era}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCocktail(null)}>×</Button>
                  </div>
                  <p className="text-gray-600">{selectedCocktail.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge className="bg-cyan-100 text-cyan-700">{selectedCocktail.vodkaStyle}</Badge>
                    <Badge className="bg-blue-100 text-blue-700">{selectedCocktail.difficulty}</Badge>
                    {selectedCocktail.iba_official && (
                      <Badge className="bg-purple-100 text-purple-700">IBA Official</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Stats */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-cyan-500" />
                        Cocktail Stats
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-cyan-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Calories</div>
                          <div className="text-xl font-bold text-cyan-600">{selectedCocktail.nutrition.calories}</div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">ABV</div>
                          <div className="text-xl font-bold text-blue-600">{selectedCocktail.abv}</div>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Sugar</div>
                          <div className="text-xl font-bold text-purple-600">{selectedCocktail.nutrition.sugar}g</div>
                        </div>
                      </div>
                    </div>

                    {/* Preparation */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <GlassWater className="w-5 h-5 text-blue-500" />
                        Preparation Details
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Glassware</div>
                          <div className="text-sm font-bold text-blue-600">{selectedCocktail.glassware}</div>
                        </div>
                        <div className="p-3 bg-cyan-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Method</div>
                          <div className="text-lg font-bold text-cyan-600">{selectedCocktail.method}</div>
                        </div>
                        <div className="p-3 bg-teal-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Prep Time</div>
                          <div className="text-lg font-bold text-teal-600">{selectedCocktail.prepTime} min</div>
                        </div>
                      </div>
                    </div>

                    {/* Ingredients */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        Ingredients
                      </h3>
                      <div className="space-y-2">
                        {selectedCocktail.ingredients.map((ingredient, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <Plus className="w-4 h-4 text-cyan-500" />
                            <span className="text-sm">{ingredient}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Flavor Profile */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500" />
                        Flavor Profile
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCocktail.profile.map(trait => (
                          <Badge key={trait} className="bg-yellow-100 text-yellow-700 border-yellow-300">
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Instructions */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-cyan-500" />
                        Instructions
                      </h3>
                      {selectedCocktail.method === 'Build' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Fill {selectedCocktail.glassware} with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Add vodka and other liquid ingredients</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Stir gently to combine</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Serve immediately and enjoy</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Shake' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add all ingredients to cocktail shaker</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Fill shaker with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Shake vigorously for 10-15 seconds</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Double strain into {selectedCocktail.glassware}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Roll' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add all ingredients to mixing glass with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Pour back and forth between glasses 3-4 times</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">This gently mixes without creating foam</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Pour into serving glass with fresh ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish and serve</span>
                          </li>
                        </ol>
                      )}
                    </div>

                    {/* Pro Tips */}
                    <div className="bg-cyan-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-500" />
                        Pro Tips
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li>• Use premium vodka - quality shows in simple cocktails</li>
                        <li>• Keep vodka in the freezer for extra-cold drinks</li>
                        <li>• Fresh citrus juice makes all the difference</li>
                        <li>• Strain twice for perfectly smooth texture</li>
                        <li>• Garnish is part of the experience</li>
                      </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                        onClick={() => handleMakeCocktail(selectedCocktail)}
                      >
                        <Droplets className="w-4 h-4 mr-2" />
                        Make This Cocktail
                      </Button>
                      <Button variant="outline" size="icon">
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon">
                        <Camera className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Educational Content */}
          <Card className="mt-12 bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="w-6 h-6 text-cyan-500" />
                Why Vodka is the Perfect Cocktail Base
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Snowflake className="w-5 h-5 text-cyan-500" />
                    Clean & Neutral
                  </h3>
                  <p className="text-sm text-gray-700">
                    Vodka's neutral flavor profile makes it the perfect canvas for other ingredients. 
                    It enhances without overpowering, letting fruits, herbs, and mixers shine.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-500" />
                    Infinitely Versatile
                  </h3>
                  <p className="text-sm text-gray-700">
                    From sweet to savory, hot to frozen, vodka works in every style of cocktail. 
                    It's the most mixable spirit, pairing beautifully with almost any ingredient.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Award className="w-5 h-5 text-purple-500" />
                    Premium Quality
                  </h3>
                  <p className="text-sm text-gray-700">
                    Modern vodka production creates exceptionally smooth spirits. Multiple distillations 
                    and filtration remove impurities for a clean, crisp drinking experience.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vodka Selection Guide */}
          <Card className="mt-8 bg-white border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-500" />
                Choosing Your Vodka
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-blue-600">Premium Vodka</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Multiple distillations, ultra-smooth, perfect for martinis and sipping. 
                    Best for cocktails where vodka is the star.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Grey Goose, Belvedere, Ketel One</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-cyan-600">Mid-Range Vodka</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Great quality-to-price ratio. Clean, smooth, perfect for mixed drinks. 
                    Ideal for most cocktail applications.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Tito's, Stolichnaya, Absolut</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-purple-600">Flavored Vodka</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Infused with natural flavors. Great for adding complexity without extra ingredients. 
                    Perfect for creative cocktails.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Vanilla, Citrus, Berry varieties</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cocktail Categories */}
          <Card className="mt-8 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wine className="w-6 h-6 text-blue-500" />
                Vodka Cocktail Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-lg border border-blue-200">
                  <Crown className="w-6 h-6 text-blue-500 mb-2" />
                  <div className="font-semibold text-blue-600 mb-2">Classic</div>
                  <div className="text-sm text-gray-700">Timeless recipes like Moscow Mule, Cosmopolitan, and Bloody Mary.</div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-purple-200">
                  <Sparkles className="w-6 h-6 text-purple-500 mb-2" />
                  <div className="font-semibold text-purple-600 mb-2">Modern</div>
                  <div className="text-sm text-gray-700">Contemporary creations like Espresso Martini and French Martini.</div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <Zap className="w-6 h-6 text-green-500 mb-2" />
                  <div className="font-semibold text-green-600 mb-2">Simple</div>
                  <div className="text-sm text-gray-700">Easy 2-ingredient drinks like Vodka Soda and Screwdriver.</div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-cyan-200">
                  <Coffee className="w-6 h-6 text-cyan-500 mb-2" />
                  <div className="font-semibold text-cyan-600 mb-2">Dessert</div>
                  <div className="text-sm text-gray-700">Sweet treats like White Russian and Espresso Martini.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
