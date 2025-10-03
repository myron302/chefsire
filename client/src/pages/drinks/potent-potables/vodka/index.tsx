import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Droplets, Clock, Heart, Star, Target, Sparkles, Wine, 
  Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater,
  TrendingUp, Award, Snowflake, Cherry, Coffee, Zap, Crown,
  BookOpen
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const vodkaCocktails = [
  // CLASSIC VODKA COCKTAILS
  {
    id: 'vodka-1',
    name: 'Moscow Mule',
    description: 'Spicy ginger beer with vodka and lime in copper mug',
    spiritType: 'Vodka',
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
    difficulty: 'Very Easy',
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
    abv: '10-12%',
    iba_official: true,
    instructions: 'Fill copper mug with ice. Add vodka and lime juice. Top with ginger beer. Stir gently and garnish with lime wedge and mint sprig.'
  },
  {
    id: 'vodka-2',
    name: 'Bloody Mary',
    description: 'Savory tomato juice cocktail with spices and garnishes',
    spiritType: 'Vodka',
    origin: 'Paris, France',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 125,
      carbs: 15,
      sugar: 11,
      alcohol: 14
    },
    ingredients: [
      'Vodka (2 oz)',
      'Tomato Juice (6 oz)',
      'Fresh Lemon Juice (0.5 oz)',
      'Worcestershire Sauce (3 dashes)',
      'Hot Sauce (2-3 dashes)',
      'Celery Salt (pinch)',
      'Black Pepper (pinch)',
      'Horseradish (optional, 1 tsp)',
      'Celery Stalk',
      'Lemon Wedge',
      'Olives',
      'Ice'
    ],
    profile: ['Savory', 'Spicy', 'Umami', 'Brunch'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 5234,
    trending: false,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Brunch',
    occasion: 'Morning',
    allergens: [],
    category: 'Classic Vodka',
    garnish: 'Celery stalk, lemon wedge, olives, bacon (optional)',
    method: 'Build & Stir',
    abv: '12-16%',
    iba_official: true,
    instructions: 'Fill glass with ice. Add vodka, tomato juice, lemon juice, Worcestershire, hot sauce, celery salt, pepper, and horseradish. Stir well. Garnish elaborately with celery, lemon, and olives.'
  },
  {
    id: 'vodka-3',
    name: 'Cosmopolitan',
    description: '90s icon with cranberry, lime, and triple sec',
    spiritType: 'Vodka',
    origin: 'New York City, USA',
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
      'Cranberry Juice (0.25 oz)',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Fruity', 'Tart', 'Sophisticated', 'Pink'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 6234,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Cocktail Party',
    allergens: [],
    category: 'Classic Vodka',
    garnish: 'Orange peel twist',
    method: 'Shake',
    abv: '18-22%',
    iba_official: true,
    instructions: 'Shake vodka, triple sec, lime juice, and cranberry juice with ice. Strain into chilled martini glass. Express orange peel over drink and garnish.'
  },
  {
    id: 'vodka-4',
    name: 'Vodka Martini',
    description: 'Clean, crisp, iconic cocktail',
    spiritType: 'Vodka',
    origin: 'United States',
    glassware: 'Martini Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 175,
      carbs: 1,
      sugar: 0,
      alcohol: 18
    },
    ingredients: [
      'Vodka (2.5 oz)',
      'Dry Vermouth (0.5 oz)',
      'Lemon Peel or Olives',
      'Ice'
    ],
    profile: ['Dry', 'Clean', 'Strong', 'Classic'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 4567,
    trending: false,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Vodka',
    garnish: 'Lemon twist or olives',
    method: 'Stir',
    abv: '30-35%',
    iba_official: true,
    instructions: 'Stir vodka and vermouth with ice until very cold. Strain into chilled martini glass. Garnish with lemon twist or olives.'
  },
  {
    id: 'vodka-5',
    name: 'White Russian',
    description: 'Creamy coffee liqueur dessert cocktail',
    spiritType: 'Vodka',
    origin: 'Belgium',
    glassware: 'Old Fashioned Glass',
    servingSize: '6 oz',
    nutrition: {
      calories: 280,
      carbs: 18,
      sugar: 16,
      alcohol: 14
    },
    ingredients: [
      'Vodka (2 oz)',
      'Coffee Liqueur (1 oz)',
      'Heavy Cream (1 oz)',
      'Ice'
    ],
    profile: ['Creamy', 'Coffee', 'Sweet', 'Dessert'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 3876,
    trending: false,
    featured: false,
    estimatedCost: 4.50,
    bestTime: 'After Dinner',
    occasion: 'Dessert',
    allergens: ['Dairy'],
    category: 'Creamy Vodka',
    garnish: 'None',
    method: 'Build',
    abv: '18-22%',
    iba_official: true,
    instructions: 'Fill rocks glass with ice. Add vodka and coffee liqueur. Float cream on top by pouring over the back of a spoon.'
  },
  {
    id: 'vodka-6',
    name: 'Espresso Martini',
    description: 'Caffeinated vodka cocktail with coffee',
    spiritType: 'Vodka',
    origin: 'London, England',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 12,
      sugar: 10,
      alcohol: 13
    },
    ingredients: [
      'Vodka (2 oz)',
      'Coffee Liqueur (0.5 oz)',
      'Espresso (1 oz, fresh)',
      'Simple Syrup (0.25 oz)',
      'Coffee Beans',
      'Ice'
    ],
    profile: ['Coffee', 'Energizing', 'Smooth', 'Modern'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.8,
    reviews: 5892,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Night Out',
    allergens: [],
    category: 'Modern Vodka',
    garnish: '3 coffee beans',
    method: 'Shake',
    abv: '20-24%',
    iba_official: true,
    instructions: 'Shake vodka, coffee liqueur, fresh espresso, and simple syrup vigorously with ice. Double strain into chilled martini glass. Garnish with 3 coffee beans.'
  },
  {
    id: 'vodka-7',
    name: 'Vodka Tonic',
    description: 'Simple, refreshing highball',
    spiritType: 'Vodka',
    origin: 'Modern',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 175,
      carbs: 15,
      sugar: 14,
      alcohol: 12
    },
    ingredients: [
      'Vodka (2 oz)',
      'Tonic Water (5 oz)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Crisp', 'Bitter', 'Light', 'Refreshing'],
    difficulty: 'Very Easy',
    prepTime: 1,
    rating: 4.3,
    reviews: 2345,
    trending: false,
    featured: false,
    estimatedCost: 3.00,
    bestTime: 'Anytime',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Vodka',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill highball glass with ice. Add vodka and top with tonic water. Stir gently and garnish with lime wedge.'
  },
  {
    id: 'vodka-8',
    name: 'Lemon Drop',
    description: 'Sweet and sour citrus vodka cocktail',
    spiritType: 'Vodka',
    origin: 'San Francisco, USA',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 185,
      carbs: 14,
      sugar: 12,
      alcohol: 13
    },
    ingredients: [
      'Vodka (2 oz)',
      'Triple Sec (0.5 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Simple Syrup (0.5 oz)',
      'Sugar (for rim)',
      'Lemon Wheel',
      'Ice'
    ],
    profile: ['Citrus', 'Sweet', 'Tart', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 3456,
    trending: false,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Classic Vodka',
    garnish: 'Sugar rim, lemon wheel',
    method: 'Shake',
    abv: '20-24%',
    iba_official: false,
    instructions: 'Rim glass with sugar. Shake vodka, triple sec, lemon juice, and simple syrup with ice. Strain into prepared glass. Garnish with lemon wheel.'
  },
  {
    id: 'vodka-9',
    name: 'Sea Breeze',
    description: 'Fruity vodka with cranberry and grapefruit',
    spiritType: 'Vodka',
    origin: 'United States',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 175,
      carbs: 16,
      sugar: 14,
      alcohol: 11
    },
    ingredients: [
      'Vodka (1.5 oz)',
      'Cranberry Juice (3 oz)',
      'Grapefruit Juice (1.5 oz)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Fruity', 'Tart', 'Refreshing', 'Beach'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 2876,
    trending: false,
    featured: false,
    estimatedCost: 3.50,
    bestTime: 'Afternoon',
    occasion: 'Beach',
    allergens: [],
    category: 'Fruity Vodka',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: true,
    instructions: 'Fill glass with ice. Add vodka, cranberry juice, and grapefruit juice. Stir and garnish with lime wedge.'
  },
  {
    id: 'vodka-10',
    name: 'Black Russian',
    description: 'Simple vodka and coffee liqueur',
    spiritType: 'Vodka',
    origin: 'Belgium',
    glassware: 'Old Fashioned Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 220,
      carbs: 15,
      sugar: 14,
      alcohol: 16
    },
    ingredients: [
      'Vodka (2 oz)',
      'Coffee Liqueur (1 oz)',
      'Ice'
    ],
    profile: ['Coffee', 'Strong', 'Simple', 'Classic'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 1987,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    bestTime: 'After Dinner',
    occasion: 'Nightcap',
    allergens: [],
    category: 'Classic Vodka',
    garnish: 'None',
    method: 'Build',
    abv: '25-30%',
    iba_official: true,
    instructions: 'Fill rocks glass with ice. Add vodka and coffee liqueur. Stir briefly.'
  },
  {
    id: 'vodka-11',
    name: 'French Martini',
    description: 'Vodka with pineapple and raspberry',
    spiritType: 'Vodka',
    origin: 'New York City, USA',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 12,
      sugar: 10,
      alcohol: 13
    },
    ingredients: [
      'Vodka (2 oz)',
      'Chambord (0.5 oz)',
      'Pineapple Juice (1 oz)',
      'Ice'
    ],
    profile: ['Fruity', 'Sweet', 'Sophisticated', 'Berry'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 3124,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Date Night',
    allergens: [],
    category: 'Modern Vodka',
    garnish: 'Raspberry',
    method: 'Shake',
    abv: '20-24%',
    iba_official: false,
    instructions: 'Shake vodka, Chambord, and pineapple juice with ice. Strain into chilled martini glass. Garnish with fresh raspberry.'
  },
  {
    id: 'vodka-12',
    name: 'Vodka Cranberry',
    description: 'Simple vodka and cranberry juice',
    spiritType: 'Vodka',
    origin: 'United States',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 165,
      carbs: 14,
      sugar: 13,
      alcohol: 12
    },
    ingredients: [
      'Vodka (2 oz)',
      'Cranberry Juice (5 oz)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Fruity', 'Tart', 'Simple', 'Easy'],
    difficulty: 'Very Easy',
    prepTime: 1,
    rating: 4.2,
    reviews: 4321,
    trending: false,
    featured: false,
    estimatedCost: 3.00,
    bestTime: 'Anytime',
    occasion: 'Casual',
    allergens: [],
    category: 'Fruity Vodka',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill glass with ice. Add vodka and cranberry juice. Stir and garnish with lime wedge.'
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [selectedCocktail, setSelectedCocktail] = useState<typeof vodkaCocktails[0] | null>(null);

  const categories = ['Classic Vodka', 'Modern Vodka', 'Fruity Vodka', 'Creamy Vodka'];
  const difficulties = ['Very Easy', 'Easy', 'Medium'];

  const filteredCocktails = vodkaCocktails.filter(cocktail => {
    const matchesSearch = cocktail.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cocktail.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || cocktail.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || cocktail.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const handleCocktailClick = (cocktail: typeof vodkaCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'vodka-cocktails',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof vodkaCocktails[0]) => {
    incrementDrinksMade();
    addPoints(40, 'Made a vodka cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50">
        {/* Universal Search Modal */}
        {showUniversalSearch && (
          <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white py-16 px-4">
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
              <Droplets className="w-12 h-12" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Vodka Cocktails</h1>
                <p className="text-xl text-white/90">Clean, versatile, and endlessly mixable</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search vodka cocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 py-6 text-lg bg-white/95 border-0"
                />
              </div>
              <Button
                onClick={() => setShowUniversalSearch(true)}
                className="bg-white text-cyan-600 hover:bg-white/90 px-6"
                size="lg"
              >
                <Target className="w-5 h-5 mr-2" />
                Advanced Search
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{vodkaCocktails.length}</div>
                <div className="text-white/80 text-sm">Cocktails</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{categories.length}</div>
                <div className="text-white/80 text-sm">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{vodkaCocktails.filter(c => c.trending).length}</div>
                <div className="text-white/80 text-sm">Trending</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{vodkaCocktails.filter(c => c.iba_official).length}</div>
                <div className="text-white/80 text-sm">IBA Official</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-gray-700">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    className={selectedCategory === null ? "bg-cyan-600" : ""}
                  >
                    All
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={selectedCategory === category ? "bg-cyan-600" : ""}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-gray-700">Difficulty</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedDifficulty === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDifficulty(null)}
                    className={selectedDifficulty === null ? "bg-cyan-600" : ""}
                  >
                    All Levels
                  </Button>
                  {difficulties.map(diff => (
                    <Button
                      key={diff}
                      variant={selectedDifficulty === diff ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDifficulty(diff)}
                      className={selectedDifficulty === diff ? "bg-cyan-600" : ""}
                    >
                      {diff}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-4 text-gray-600">
            Showing {filteredCocktails.length} of {vodkaCocktails.length} cocktails
          </div>

          {/* Cocktails Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map((cocktail) => (
              <Card 
                key={cocktail.id} 
                className="hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
                onClick={() => handleCocktailClick(cocktail)}
              >
                <div className="relative bg-gradient-to-br from-cyan-100 to-blue-100 p-6 h-48 flex items-center justify-center">
                  <Droplets className="w-20 h-20 text-cyan-600 group-hover:scale-110 transition-transform" />
                  {cocktail.trending && (
                    <Badge className="absolute top-3 left-3 bg-purple-500">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Trending
                    </Badge>
                  )}
                  {cocktail.iba_official && (
                    <Badge className="absolute top-3 right-3 bg-blue-600">
                      <Award className="w-3 h-3 mr-1" />
                      IBA
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute bottom-3 right-3 bg-white/80 hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToFavorites({
                        id: cocktail.id,
                        name: cocktail.name,
                        category: 'vodka-cocktails',
                        timestamp: Date.now()
                      });
                    }}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        isFavorite(cocktail.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-gray-600'
                      }`}
                    />
                  </Button>
                </div>

                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl">{cocktail.name}</CardTitle>
                    <Badge variant="outline" className="ml-2">
                      {cocktail.difficulty}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{cocktail.description}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Key Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <GlassWater className="w-4 h-4 text-cyan-600" />
                      <span className="text-gray-600">{cocktail.glassware}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-600" />
                      <span className="text-gray-600">{cocktail.prepTime} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-cyan-600" />
                      <span className="text-gray-600">{cocktail.abv} ABV</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-cyan-600" />
                      <span className="text-gray-600">{cocktail.spiritType}</span>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <GlassWater
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(cocktail.rating)
                              ? 'fill-cyan-500 text-cyan-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">{cocktail.rating}</span>
                    <span className="text-sm text-gray-500">({cocktail.reviews.toLocaleString()})</span>
                  </div>

                  {/* Profile Tags */}
                  <div className="flex flex-wrap gap-2">
                    {cocktail.profile.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Nutrition Highlights */}
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t text-center">
                    <div>
                      <div className="text-xs text-gray-500">Cal</div>
                      <div className="font-semibold text-sm">{cocktail.nutrition.calories}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Carbs</div>
                      <div className="font-semibold text-sm">{cocktail.nutrition.carbs}g</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Sugar</div>
                      <div className="font-semibold text-sm">{cocktail.nutrition.sugar}g</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Alc</div>
                      <div className="font-semibold text-sm">{cocktail.nutrition.alcohol}g</div>
                    </div>
                  </div>

                  {/* Ingredients Preview */}
                  <div className="pt-3 border-t">
                    <div className="text-sm font-semibold mb-2 text-gray-700">Main Ingredients:</div>
                    <div className="text-sm text-gray-600">
                      {cocktail.ingredients.slice(0, 3).join(' • ')}
                      {cocktail.ingredients.length > 3 && '...'}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3">
                    <Button 
                      className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCocktailClick(cocktail);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      View Recipe
                    </Button>
                    <Button variant="outline" size="icon" onClick={(e) => e.stopPropagation()}>
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Cocktail Detail Modal */}
          {selectedCocktail && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedCocktail(null)}>
              <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{selectedCocktail.name}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">{selectedCocktail.origin}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCocktail(null)}>×</Button>
                  </div>
                  <p className="text-gray-600">{selectedCocktail.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge className="bg-cyan-100 text-cyan-700">{selectedCocktail.category}</Badge>
                    <Badge className="bg-blue-100 text-blue-700">{selectedCocktail.spiritType}</Badge>
                    <Badge className="bg-purple-100 text-purple-700">{selectedCocktail.difficulty}</Badge>
                    {selectedCocktail.iba_official && (
                      <Badge className="bg-blue-500 text-white">IBA Official</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Cocktail Stats */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-cyan-500" />
                        Cocktail Stats
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-cyan-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">ABV</div>
                          <div className="text-xl font-bold text-cyan-600">{selectedCocktail.abv}</div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Prep Time</div>
                          <div className="text-xl font-bold text-blue-600">{selectedCocktail.prepTime} min</div>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Method</div>
                          <div className="text-xl font-bold text-purple-600">{selectedCocktail.method}</div>
                        </div>
                      </div>
                    </div>

                    {/* Glassware & Garnish */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <GlassWater className="w-5 h-5 text-blue-500" />
                        Glassware & Garnish
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-gray-600">Glassware</div>
                          <div className="font-bold text-blue-600">{selectedCocktail.glassware}</div>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="text-sm text-gray-600">Garnish</div>
                          <div className="font-bold text-green-600">{selectedCocktail.garnish}</div>
                        </div>
                      </div>
                    </div>

                    {/* Ingredients */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-500" />
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
                        <BookOpen className="w-5 h-5 text-cyan-500" />
                        Instructions
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-700">{selectedCocktail.instructions}</p>
                      </div>
                    </div>

                    {/* Nutrition */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Droplets className="w-5 h-5 text-cyan-500" />
                        Nutrition Information
                      </h3>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="p-3 bg-red-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Calories</div>
                          <div className="text-xl font-bold text-red-600">{selectedCocktail.nutrition.calories}</div>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Carbs</div>
                          <div className="text-xl font-bold text-yellow-600">{selectedCocktail.nutrition.carbs}g</div>
                        </div>
                        <div className="p-3 bg-pink-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Sugar</div>
                          <div className="text-xl font-bold text-pink-600">{selectedCocktail.nutrition.sugar}g</div>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Alcohol</div>
                          <div className="text-xl font-bold text-purple-600">{selectedCocktail.nutrition.alcohol}g</div>
                        </div>
                      </div>
                    </div>

                    {/* Pro Tips */}
                    <div className="bg-cyan-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-500" />
                        Pro Tips
                      </h3>
                      <ul className="space-y-2 text-sm text-cyan-900">
                        <li>• Use premium vodka for the cleanest taste</li>
                        <li>• Always chill your glassware beforehand</li>
                        <li>• Fresh ingredients make all the difference</li>
                        <li>• Vodka's neutrality lets other flavors shine</li>
                        <li>• Store vodka in the freezer for extra smoothness</li>
                      </ul>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-400 fill-current" />
                        <span className="font-bold text-lg">{selectedCocktail.rating}</span>
                        <span className="text-gray-500">({selectedCocktail.reviews.toLocaleString()} reviews)</span>
                      </div>
                      <Badge variant="outline">{selectedCocktail.difficulty}</Badge>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
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

          {/* Educational Section */}
          <Card className="mt-12 bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Droplets className="w-7 h-7 text-cyan-600" />
                About Vodka
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-gray-700 leading-relaxed">
                Vodka is a clear distilled spirit originating from Eastern Europe, traditionally made from grains 
                or potatoes. Known for its neutral flavor profile and versatility, vodka has become the world's 
                most popular spirit and the foundation for countless cocktails. Its clean taste allows other 
                ingredients to shine while providing the alcoholic backbone that defines mixed drinks.
              </p>

              {/* Vodka Types */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-cyan-700">Types of Vodka</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-cyan-200">
                    <div className="font-semibold text-cyan-600 mb-2">Grain Vodka</div>
                    <div className="text-sm text-gray-700">Made from wheat, rye, or corn. Smooth and neutral flavor.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-cyan-200">
                    <div className="font-semibold text-blue-600 mb-2">Potato Vodka</div>
                    <div className="text-sm text-gray-700">Creamy texture with slightly earthy notes. Traditional style.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-cyan-200">
                    <div className="font-semibold text-purple-600 mb-2">Flavored Vodka</div>
                    <div className="text-sm text-gray-700">Infused with fruits, herbs, or spices. Popular for mixing.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-cyan-200">
                    <div className="font-semibold text-indigo-600 mb-2">Premium Vodka</div>
                    <div className="text-sm text-gray-700">Multiple distillations and filtrations. Ultra-smooth finish.</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
