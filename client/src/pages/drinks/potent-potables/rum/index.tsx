import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Palmtree, Clock, Heart, Star, Target, Sparkles, Sun, 
  Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater,
  TrendingUp, Award, Crown, Coffee, Leaf, Zap, Cherry, Waves
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const rumCocktails = [
  // CLASSIC RUM COCKTAILS
  {
    id: 'rum-1',
    name: 'Mojito',
    description: 'Refreshing Cuban classic with mint and lime',
    spiritType: 'White Rum',
    origin: 'Havana, Cuba',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 217,
      carbs: 24,
      sugar: 20,
      alcohol: 13
    },
    ingredients: [
      'White Rum (2 oz)',
      'Fresh Lime Juice (1 oz)',
      'Simple Syrup (0.75 oz)',
      'Fresh Mint Leaves (8-10)',
      'Soda Water (top)',
      'Ice'
    ],
    profile: ['Refreshing', 'Minty', 'Citrus', 'Tropical'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.8,
    reviews: 5642,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Afternoon',
    occasion: 'Beach',
    allergens: [],
    category: 'Classic Rum',
    garnish: 'Mint sprig, lime wheel',
    method: 'Muddle & Build',
    abv: '10-12%',
    iba_official: true
  },
  {
    id: 'rum-2',
    name: 'Daiquiri',
    description: 'Perfect balance of rum, lime, and sugar',
    spiritType: 'White Rum',
    origin: 'Santiago de Cuba',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 186,
      carbs: 9,
      sugar: 7,
      alcohol: 15
    },
    ingredients: [
      'White Rum (2 oz)',
      'Fresh Lime Juice (1 oz)',
      'Simple Syrup (0.75 oz)',
      'Ice'
    ],
    profile: ['Clean', 'Citrus', 'Balanced', 'Classic'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 4328,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Rum',
    garnish: 'Lime wheel',
    method: 'Shake',
    abv: '20-24%',
    iba_official: true
  },
  {
    id: 'rum-3',
    name: 'Piña Colada',
    description: 'Creamy tropical paradise in a glass',
    spiritType: 'White Rum',
    origin: 'San Juan, Puerto Rico',
    glassware: 'Hurricane Glass',
    servingSize: '12 oz',
    nutrition: {
      calories: 490,
      carbs: 58,
      sugar: 52,
      alcohol: 16
    },
    ingredients: [
      'White Rum (2 oz)',
      'Coconut Cream (3 oz)',
      'Pineapple Juice (3 oz)',
      'Pineapple Chunks (optional)',
      'Crushed Ice'
    ],
    profile: ['Creamy', 'Tropical', 'Sweet', 'Indulgent'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 6234,
    trending: false,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Beach',
    occasion: 'Vacation',
    allergens: ['Coconut'],
    category: 'Tropical Rum',
    garnish: 'Pineapple wedge, cherry',
    method: 'Blend',
    abv: '12-15%',
    iba_official: true
  },
  {
    id: 'rum-4',
    name: 'Mai Tai',
    description: 'Complex tiki classic with almond and citrus notes',
    spiritType: 'Dark Rum',
    origin: 'Oakland, California',
    glassware: 'Old Fashioned Glass',
    servingSize: '6 oz',
    nutrition: {
      calories: 254,
      carbs: 18,
      sugar: 15,
      alcohol: 17
    },
    ingredients: [
      'Dark Rum (2 oz)',
      'Orange Curaçao (0.5 oz)',
      'Orgeat Syrup (0.5 oz)',
      'Fresh Lime Juice (1 oz)',
      'Simple Syrup (0.25 oz)',
      'Crushed Ice'
    ],
    profile: ['Complex', 'Nutty', 'Citrus', 'Tropical'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 3987,
    trending: true,
    featured: true,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Tiki Bar',
    allergens: ['Almonds'],
    category: 'Tiki Rum',
    garnish: 'Mint sprig, lime shell, pineapple',
    method: 'Shake',
    abv: '20-24%',
    iba_official: true
  },
  {
    id: 'rum-5',
    name: 'Dark and Stormy',
    description: 'Bold ginger beer and dark rum combination',
    spiritType: 'Dark Rum',
    origin: 'Bermuda',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 235,
      carbs: 26,
      sugar: 23,
      alcohol: 13
    },
    ingredients: [
      'Dark Rum (2 oz)',
      'Ginger Beer (4 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Spicy', 'Bold', 'Refreshing', 'Gingery'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 3456,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Rum',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: false
  },
  {
    id: 'rum-6',
    name: 'Zombie',
    description: 'Powerful tiki drink with multiple rums',
    spiritType: 'Mixed Rum',
    origin: 'Hollywood, California',
    glassware: 'Tiki Mug',
    servingSize: '8 oz',
    nutrition: {
      calories: 315,
      carbs: 24,
      sugar: 20,
      alcohol: 22
    },
    ingredients: [
      'White Rum (1.5 oz)',
      'Gold Rum (1.5 oz)',
      'Overproof Rum (1 oz)',
      'Lime Juice (0.75 oz)',
      'Pineapple Juice (1 oz)',
      'Passion Fruit Syrup (0.5 oz)',
      'Grenadine (0.5 oz)',
      'Angostura Bitters (1 dash)',
      'Ice'
    ],
    profile: ['Strong', 'Complex', 'Fruity', 'Intense'],
    difficulty: 'Hard',
    prepTime: 7,
    rating: 4.7,
    reviews: 2145,
    trending: true,
    featured: true,
    estimatedCost: 8.00,
    bestTime: 'Night',
    occasion: 'Party',
    allergens: [],
    category: 'Tiki Rum',
    garnish: 'Mint sprig, cherry, pineapple',
    method: 'Shake',
    abv: '28-32%',
    iba_official: true
  },
  {
    id: 'rum-7',
    name: 'Cuba Libre',
    description: 'Rum and coke elevated with fresh lime',
    spiritType: 'White Rum',
    origin: 'Havana, Cuba',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 185,
      carbs: 18,
      sugar: 17,
      alcohol: 12
    },
    ingredients: [
      'White Rum (2 oz)',
      'Coca-Cola (4 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Sweet', 'Refreshing', 'Easy', 'Classic'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.3,
    reviews: 4567,
    trending: false,
    featured: false,
    estimatedCost: 3.00,
    bestTime: 'Anytime',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Rum',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '9-11%',
    iba_official: true
  },
  {
    id: 'rum-8',
    name: 'Hurricane',
    description: 'New Orleans party drink with passion fruit',
    spiritType: 'Dark Rum',
    origin: 'New Orleans, Louisiana',
    glassware: 'Hurricane Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 325,
      carbs: 38,
      sugar: 34,
      alcohol: 16
    },
    ingredients: [
      'White Rum (2 oz)',
      'Dark Rum (2 oz)',
      'Passion Fruit Syrup (1 oz)',
      'Orange Juice (2 oz)',
      'Lime Juice (1 oz)',
      'Simple Syrup (0.5 oz)',
      'Grenadine (splash)',
      'Ice'
    ],
    profile: ['Fruity', 'Strong', 'Party', 'Tropical'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.6,
    reviews: 2876,
    trending: false,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Night',
    occasion: 'Party',
    allergens: [],
    category: 'Tropical Rum',
    garnish: 'Orange slice, cherry',
    method: 'Shake',
    abv: '14-18%',
    iba_official: false
  },

  // CONTEMPORARY RUM
  {
    id: 'rum-9',
    name: 'Ti\' Punch',
    description: 'Simple Martinique rum cocktail',
    spiritType: 'Rhum Agricole',
    origin: 'Martinique',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 165,
      carbs: 8,
      sugar: 7,
      alcohol: 16
    },
    ingredients: [
      'Rhum Agricole (2 oz)',
      'Lime (1 disc)',
      'Cane Syrup (1 barspoon)',
      'Ice (optional)'
    ],
    profile: ['Grassy', 'Bright', 'Simple', 'Authentic'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 987,
    trending: true,
    featured: false,
    estimatedCost: 5.00,
    bestTime: 'Afternoon',
    occasion: 'Authentic',
    allergens: [],
    category: 'Contemporary Rum',
    garnish: 'Lime disc',
    method: 'Build',
    abv: '30-35%',
    iba_official: false
  },
  {
    id: 'rum-10',
    name: 'Painkiller',
    description: 'Pusser\'s rum tropical blend from BVI',
    spiritType: 'Dark Rum',
    origin: 'British Virgin Islands',
    glassware: 'Hurricane Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 425,
      carbs: 48,
      sugar: 42,
      alcohol: 15
    },
    ingredients: [
      'Pusser\'s Rum (2 oz)',
      'Pineapple Juice (4 oz)',
      'Orange Juice (1 oz)',
      'Cream of Coconut (1 oz)',
      'Crushed Ice'
    ],
    profile: ['Creamy', 'Tropical', 'Sweet', 'Beach'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 2134,
    trending: false,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Beach',
    occasion: 'Vacation',
    allergens: ['Coconut'],
    category: 'Tropical Rum',
    garnish: 'Nutmeg, orange slice, cherry',
    method: 'Shake',
    abv: '12-15%',
    iba_official: false
  },
  {
    id: 'rum-11',
    name: 'Jungle Bird',
    description: 'Bitter-sweet tiki drink with Campari',
    spiritType: 'Dark Rum',
    origin: 'Kuala Lumpur, Malaysia',
    glassware: 'Old Fashioned Glass',
    servingSize: '6 oz',
    nutrition: {
      calories: 235,
      carbs: 22,
      sugar: 18,
      alcohol: 15
    },
    ingredients: [
      'Dark Rum (1.5 oz)',
      'Campari (0.75 oz)',
      'Pineapple Juice (1.5 oz)',
      'Lime Juice (0.5 oz)',
      'Simple Syrup (0.5 oz)',
      'Ice'
    ],
    profile: ['Bitter', 'Sweet', 'Tropical', 'Complex'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.6,
    reviews: 1654,
    trending: true,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Adventurous',
    allergens: [],
    category: 'Contemporary Rum',
    garnish: 'Pineapple wedge',
    method: 'Shake',
    abv: '18-22%',
    iba_official: false
  },
  {
    id: 'rum-12',
    name: 'Rum Old Fashioned',
    description: 'Classic old fashioned with aged rum',
    spiritType: 'Aged Rum',
    origin: 'Modern',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 175,
      carbs: 5,
      sugar: 4,
      alcohol: 18
    },
    ingredients: [
      'Aged Rum (2 oz)',
      'Demerara Syrup (0.25 oz)',
      'Angostura Bitters (2 dashes)',
      'Orange Bitters (1 dash)',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Rich', 'Complex', 'Smooth', 'Sophisticated'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 1876,
    trending: true,
    featured: false,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Contemporary Rum',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '32-36%',
    iba_official: false
  }
];

export default function RumCocktailsPage() {
  const { favorites, toggleFavorite } = useDrinks();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const categories = ['Classic Rum', 'Tropical Rum', 'Tiki Rum', 'Contemporary Rum'];
  const difficulties = ['Very Easy', 'Easy', 'Medium', 'Hard'];

  const filteredCocktails = rumCocktails.filter(cocktail => {
    const matchesSearch = cocktail.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cocktail.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || cocktail.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || cocktail.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        {/* Universal Search Modal */}
        {showUniversalSearch && (
          <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white py-16 px-4">
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
              <Palmtree className="w-12 h-12" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Rum Cocktails</h1>
                <p className="text-xl text-white/90">From Caribbean classics to tiki treasures</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search rum cocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 py-6 text-lg bg-white/95 border-0"
                />
              </div>
              <Button
                onClick={() => setShowUniversalSearch(true)}
                className="bg-white text-orange-600 hover:bg-white/90 px-6"
                size="lg"
              >
                <Target className="w-5 h-5 mr-2" />
                Advanced Search
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{rumCocktails.length}</div>
                <div className="text-white/80 text-sm">Cocktails</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{categories.length}</div>
                <div className="text-white/80 text-sm">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{rumCocktails.filter(c => c.trending).length}</div>
                <div className="text-white/80 text-sm">Trending</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{rumCocktails.filter(c => c.iba_official).length}</div>
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
                    className={selectedCategory === null ? "bg-orange-600" : ""}
                  >
                    All
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={selectedCategory === category ? "bg-orange-600" : ""}
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
                    className={selectedDifficulty === null ? "bg-orange-600" : ""}
                  >
                    All Levels
                  </Button>
                  {difficulties.map(diff => (
                    <Button
                      key={diff}
                      variant={selectedDifficulty === diff ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDifficulty(diff)}
                      className={selectedDifficulty === diff ? "bg-orange-600" : ""}
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
            Showing {filteredCocktails.length} of {rumCocktails.length} cocktails
          </div>

          {/* Cocktails Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map((cocktail) => (
              <Card key={cocktail.id} className="hover:shadow-lg transition-all duration-300 overflow-hidden group">
                <div className="relative bg-gradient-to-br from-amber-100 to-orange-100 p-6 h-48 flex items-center justify-center">
                  <Palmtree className="w-20 h-20 text-orange-600 group-hover:scale-110 transition-transform" />
                  {cocktail.trending && (
                    <Badge className="absolute top-3 left-3 bg-red-500">
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
                    onClick={() => toggleFavorite(cocktail.id, 'rum-cocktails')}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        favorites['rum-cocktails']?.includes(cocktail.id)
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
                      <GlassWater className="w-4 h-4 text-orange-600" />
                      <span className="text-gray-600">{cocktail.glassware}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-gray-600">{cocktail.prepTime} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-600" />
                      <span className="text-gray-600">{cocktail.abv} ABV</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Waves className="w-4 h-4 text-orange-600" />
                      <span className="text-gray-600">{cocktail.spiritType}</span>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(cocktail.rating)
                              ? 'fill-yellow-400 text-yellow-400'
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
                    <Button className="flex-1 bg-orange-600 hover:bg-orange-700">
                      <Plus className="w-4 h-4 mr-2" />
                      View Recipe
                    </Button>
                    <Button variant="outline" size="icon">
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Educational Section */}
          <Card className="mt-12 bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Palmtree className="w-7 h-7 text-orange-600" />
                About Rum
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-gray-700 leading-relaxed">
                Rum is a spirit distilled from sugarcane byproducts such as molasses or directly from sugarcane juice. 
                Originating in the Caribbean, rum has become one of the world's most versatile spirits, ranging from light 
                and crisp to dark and full-bodied. The diversity of rum makes it perfect for everything from refreshing 
                tropical drinks to complex aged sipping spirits.
              </p>

              {/* Rum Types */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-orange-700">Types of Rum</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-orange-200">
                    <div className="font-semibold text-amber-600 mb-2">White/Light Rum</div>
                    <div className="text-sm text-gray-700">Clear, mild flavor. Perfect for mojitos and daiquiris.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-orange-200">
                    <div className="font-semibold text-yellow-700 mb-2">Gold/Amber Rum</div>
                    <div className="text-sm text-gray-700">Aged briefly, medium-bodied. Great for mixing.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-orange-200">
                    <div className="font-semibold text-amber-800 mb-2">Dark Rum</div>
                    <div className="text-sm text-gray-700">Rich, full-bodied. Ideal for tropical drinks and sipping.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-orange-200">
                    <div className="font-semibold text-green-700 mb-2">Rhum Agricole</div>
                    <div className="text-sm text-gray-700">Made from fresh cane juice. Grassy, complex flavor.</div>
                  </div>
                </div>
              </div>

              {/* Regions */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-orange-700">Rum Regions</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
                    <div className="font-semibold text-blue-700 mb-2">Caribbean</div>
                    <div className="text-sm text-gray-700">Jamaica, Barbados, Trinidad. Rich, funky, traditional styles.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
                    <div className="font-semibold text-orange-700 mb-2">Latin America</div>
                    <div className="text-sm text-gray-700">Cuba, Dominican Republic, Puerto Rico. Light, smooth rums.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                    <div className="font-semibold text-green-700 mb-2">French Islands</div>
                    <div className="text-sm text-gray-700">Martinique, Guadeloupe. Agricole-style, grassy notes.</div>
                  </div>
                </div>
              </div>

              {/* Cocktail Styles */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-orange-700">Rum Cocktail Styles</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2 text-amber-600">Classic Caribbean</h4>
                    <p className="text-sm text-gray-700">Traditional drinks like Mojito, Daiquiri, and Cuba Libre that showcase rum's versatility.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-orange-600">Tiki Tropical</h4>
                    <p className="text-sm text-gray-700">Complex, multi-rum concoctions like Mai Tai, Zombie, and Hurricane from the tiki era.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-red-600">Contemporary Craft</h4>
                    <p className="text-sm text-gray-700">Modern interpretations and premium aged rum cocktails for sophisticated palates.</p>
                  </div>
                </div>
              </div>

              {/* Tiki Culture */}
              <div className="p-6 bg-gradient-to-r from-orange-100 to-red-100 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-orange-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  The Tiki Movement
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Tiki culture emerged in the 1930s-60s in America, creating elaborate tropical-themed bars and complex 
                  rum cocktails. Pioneers like Donn Beach and Trader Vic crafted multi-layered drinks using various rum 
                  styles, exotic juices, and secret spice blends. Today's craft cocktail renaissance has revived interest 
                  in these historical recipes, with bartenders rediscovering authentic tiki techniques and quality rum blends.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
