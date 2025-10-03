import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Castle, Clock, Heart, Star, Target, Sparkles, Mountain, 
  Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater,
  TrendingUp, Award, Crown, Coffee, Leaf, Zap, Cherry, Wind,
  Droplets, BookOpen
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const scotchIrishCocktails = [
  // CLASSIC SCOTCH COCKTAILS
  {
    id: 'scotch-1',
    name: 'Penicillin',
    description: 'Modern classic with honey, ginger, and smoky scotch',
    spiritType: 'Blended Scotch',
    origin: 'New York City, USA',
    glassware: 'Old Fashioned Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 12,
      sugar: 10,
      alcohol: 16
    },
    ingredients: [
      'Blended Scotch (2 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Honey-Ginger Syrup (0.75 oz)',
      'Islay Scotch (float, 0.25 oz)',
      'Candied Ginger',
      'Ice'
    ],
    profile: ['Smoky', 'Spicy', 'Balanced', 'Modern'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 2891,
    trending: true,
    featured: true,
    estimatedCost: 7.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Scotch',
    garnish: 'Candied ginger',
    method: 'Shake',
    abv: '26-30%',
    iba_official: false,
    instructions: 'Shake blended scotch, lemon juice, and honey-ginger syrup with ice. Strain over fresh ice in rocks glass. Float Islay scotch on top. Garnish with candied ginger.'
  },
  {
    id: 'scotch-2',
    name: 'Rob Roy',
    description: 'Scotch Manhattan with sweet vermouth',
    spiritType: 'Blended Scotch',
    origin: 'New York City, USA',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 185,
      carbs: 6,
      sugar: 4,
      alcohol: 18
    },
    ingredients: [
      'Scotch Whisky (2 oz)',
      'Sweet Vermouth (1 oz)',
      'Angostura Bitters (2 dashes)',
      'Lemon Peel',
      'Ice'
    ],
    profile: ['Rich', 'Herbal', 'Classic', 'Smooth'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 2345,
    trending: false,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Scotch',
    garnish: 'Lemon peel or cherry',
    method: 'Stir',
    abv: '30-34%',
    iba_official: true,
    instructions: 'Stir scotch, sweet vermouth, and bitters with ice until well chilled. Strain into chilled coupe glass. Garnish with lemon peel or cherry.'
  },
  {
    id: 'scotch-3',
    name: 'Blood and Sand',
    description: 'Equal parts scotch, cherry, orange, and vermouth',
    spiritType: 'Blended Scotch',
    origin: 'London, England',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 210,
      carbs: 15,
      sugar: 12,
      alcohol: 15
    },
    ingredients: [
      'Scotch Whisky (0.75 oz)',
      'Cherry Heering (0.75 oz)',
      'Sweet Vermouth (0.75 oz)',
      'Fresh Orange Juice (0.75 oz)',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Fruity', 'Complex', 'Balanced', 'Unique'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 1876,
    trending: false,
    featured: true,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Adventurous',
    allergens: [],
    category: 'Classic Scotch',
    garnish: 'Orange peel',
    method: 'Shake',
    abv: '22-26%',
    iba_official: true,
    instructions: 'Shake all equal parts with ice vigorously. Double strain into chilled coupe glass. Express orange peel over drink and garnish.'
  },
  {
    id: 'scotch-4',
    name: 'Rusty Nail',
    description: 'Simple scotch and Drambuie combination',
    spiritType: 'Blended Scotch',
    origin: 'Scotland',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 205,
      carbs: 10,
      sugar: 9,
      alcohol: 18
    },
    ingredients: [
      'Scotch Whisky (1.5 oz)',
      'Drambuie (0.75 oz)',
      'Lemon Peel',
      'Ice'
    ],
    profile: ['Honey', 'Herbal', 'Smooth', 'Classic'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 1654,
    trending: false,
    featured: false,
    estimatedCost: 5.50,
    bestTime: 'After Dinner',
    occasion: 'Relaxed',
    allergens: [],
    category: 'Classic Scotch',
    garnish: 'Lemon peel',
    method: 'Build',
    abv: '32-36%',
    iba_official: true,
    instructions: 'Add scotch and Drambuie to rocks glass with ice. Stir gently. Express lemon peel over drink and drop in.'
  },
  {
    id: 'scotch-5',
    name: 'Godfather',
    description: 'Scotch and amaretto over ice',
    spiritType: 'Blended Scotch',
    origin: 'United States',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 195,
      carbs: 9,
      sugar: 8,
      alcohol: 18
    },
    ingredients: [
      'Scotch Whisky (1.5 oz)',
      'Amaretto (0.75 oz)',
      'Ice'
    ],
    profile: ['Nutty', 'Sweet', 'Smooth', 'Simple'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.3,
    reviews: 1432,
    trending: false,
    featured: false,
    estimatedCost: 4.50,
    bestTime: 'After Dinner',
    occasion: 'Casual',
    allergens: ['Almonds'],
    category: 'Classic Scotch',
    garnish: 'None',
    method: 'Build',
    abv: '34-38%',
    iba_official: true,
    instructions: 'Pour scotch and amaretto over ice in rocks glass. Stir briefly and serve.'
  },

  // IRISH WHISKEY COCKTAILS
  {
    id: 'irish-1',
    name: 'Irish Coffee',
    description: 'Hot coffee with Irish whiskey and cream',
    spiritType: 'Irish Whiskey',
    origin: 'County Limerick, Ireland',
    glassware: 'Irish Coffee Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 210,
      carbs: 10,
      sugar: 8,
      alcohol: 12
    },
    ingredients: [
      'Irish Whiskey (1.5 oz)',
      'Hot Coffee (4 oz)',
      'Brown Sugar (1 tsp)',
      'Heavy Cream (lightly whipped)'
    ],
    profile: ['Warm', 'Coffee', 'Creamy', 'Classic'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 4521,
    trending: false,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'After Dinner',
    occasion: 'Cozy',
    allergens: ['Dairy'],
    category: 'Irish Classics',
    garnish: 'Whipped cream float',
    method: 'Build',
    abv: '10-14%',
    iba_official: true,
    instructions: 'Preheat glass with hot water. Add brown sugar and hot coffee, stir to dissolve. Add Irish whiskey. Float lightly whipped cream on top by pouring over the back of a spoon.'
  },
  {
    id: 'irish-2',
    name: 'Irish Mule',
    description: 'Irish whiskey twist on the Moscow Mule',
    spiritType: 'Irish Whiskey',
    origin: 'Modern',
    glassware: 'Copper Mug',
    servingSize: '10 oz',
    nutrition: {
      calories: 185,
      carbs: 16,
      sugar: 14,
      alcohol: 12
    },
    ingredients: [
      'Irish Whiskey (2 oz)',
      'Ginger Beer (4 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Spicy', 'Refreshing', 'Gingery', 'Easy'],
    difficulty: 'Very Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 2134,
    trending: true,
    featured: false,
    estimatedCost: 4.00,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Irish Modern',
    garnish: 'Lime wedge, mint',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill copper mug with ice. Add Irish whiskey and lime juice. Top with ginger beer. Stir gently. Garnish with lime wedge and mint sprig.'
  },
  {
    id: 'irish-3',
    name: 'Irish Old Fashioned',
    description: 'Classic old fashioned with Irish whiskey',
    spiritType: 'Irish Whiskey',
    origin: 'Modern',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 170,
      carbs: 5,
      sugar: 4,
      alcohol: 17
    },
    ingredients: [
      'Irish Whiskey (2 oz)',
      'Simple Syrup (0.25 oz)',
      'Angostura Bitters (2 dashes)',
      'Orange Bitters (1 dash)',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Smooth', 'Balanced', 'Classic', 'Refined'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 1876,
    trending: false,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Irish Modern',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '32-36%',
    iba_official: false,
    instructions: 'Add simple syrup and bitters to rocks glass. Add large ice cube and Irish whiskey. Stir until well chilled. Express orange peel over drink and garnish.'
  },
  {
    id: 'irish-4',
    name: 'Tipperary',
    description: 'Irish whiskey with sweet vermouth and Chartreuse',
    spiritType: 'Irish Whiskey',
    origin: 'Ireland',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 8,
      sugar: 6,
      alcohol: 17
    },
    ingredients: [
      'Irish Whiskey (2 oz)',
      'Sweet Vermouth (1 oz)',
      'Green Chartreuse (0.5 oz)',
      'Angostura Bitters (2 dashes)',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Herbal', 'Complex', 'Sophisticated', 'Classic'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.5,
    reviews: 987,
    trending: false,
    featured: false,
    estimatedCost: 7.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Irish Classics',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '28-32%',
    iba_official: false,
    instructions: 'Stir all ingredients with ice until well chilled. Strain into chilled coupe glass. Express orange peel over drink and garnish.'
  },

  // MODERN INTERPRETATIONS
  {
    id: 'scotch-6',
    name: 'Smoky Martini',
    description: 'Gin martini with Islay scotch rinse',
    spiritType: 'Islay Scotch',
    origin: 'Modern',
    glassware: 'Coupe Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 165,
      carbs: 2,
      sugar: 1,
      alcohol: 19
    },
    ingredients: [
      'Gin (2 oz)',
      'Dry Vermouth (0.5 oz)',
      'Islay Scotch (rinse)',
      'Lemon Peel',
      'Ice'
    ],
    profile: ['Smoky', 'Dry', 'Elegant', 'Bold'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.7,
    reviews: 1543,
    trending: true,
    featured: true,
    estimatedCost: 7.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Scotch',
    garnish: 'Lemon peel',
    method: 'Stir',
    abv: '36-40%',
    iba_official: false,
    instructions: 'Rinse chilled coupe glass with Islay scotch and discard excess. Stir gin and vermouth with ice until very cold. Strain into rinsed glass. Express lemon peel and garnish.'
  },
  {
    id: 'scotch-7',
    name: 'Highland Sour',
    description: 'Scotch sour with honey and lemon',
    spiritType: 'Highland Scotch',
    origin: 'Modern',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 185,
      carbs: 11,
      sugar: 9,
      alcohol: 15
    },
    ingredients: [
      'Highland Scotch (2 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Honey Syrup (0.5 oz)',
      'Egg White (optional)',
      'Angostura Bitters',
      'Ice'
    ],
    profile: ['Bright', 'Honey', 'Smooth', 'Refreshing'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.6,
    reviews: 1234,
    trending: true,
    featured: false,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Cocktail Party',
    allergens: ['Eggs'],
    category: 'Modern Scotch',
    garnish: 'Lemon wheel, bitters',
    method: 'Shake',
    abv: '24-28%',
    iba_official: false,
    instructions: 'Dry shake egg white (if using) first. Add scotch, lemon juice, honey syrup and ice. Shake vigorously. Double strain into coupe. Garnish with lemon wheel and drops of bitters.'
  },
  {
    id: 'irish-5',
    name: 'Emerald Isle',
    description: 'Irish whiskey with mint and cream',
    spiritType: 'Irish Whiskey',
    origin: 'Modern',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 220,
      carbs: 12,
      sugar: 10,
      alcohol: 14
    },
    ingredients: [
      'Irish Whiskey (2 oz)',
      'Green Crème de Menthe (0.5 oz)',
      'Heavy Cream (0.5 oz)',
      'Simple Syrup (0.25 oz)',
      'Mint Leaves',
      'Ice'
    ],
    profile: ['Minty', 'Creamy', 'Sweet', 'Festive'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.4,
    reviews: 876,
    trending: false,
    featured: false,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'St. Patrick\'s Day',
    allergens: ['Dairy'],
    category: 'Irish Modern',
    garnish: 'Mint sprig',
    method: 'Shake',
    abv: '20-24%',
    iba_official: false,
    instructions: 'Shake all ingredients with ice until well chilled and frothy. Strain into coupe glass. Garnish with fresh mint sprig.'
  },
  {
    id: 'scotch-8',
    name: 'Cameron\'s Kick',
    description: 'Scotch and Irish whiskey with orgeat',
    spiritType: 'Blended Scotch',
    origin: 'London, England',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 200,
      carbs: 13,
      sugar: 11,
      alcohol: 16
    },
    ingredients: [
      'Blended Scotch (1 oz)',
      'Irish Whiskey (1 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Orgeat Syrup (0.75 oz)',
      'Angostura Bitters (2 dashes)',
      'Ice'
    ],
    profile: ['Nutty', 'Citrus', 'Complex', 'Balanced'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.5,
    reviews: 765,
    trending: false,
    featured: false,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: ['Almonds'],
    category: 'Modern Scotch',
    garnish: 'Lemon peel',
    method: 'Shake',
    abv: '26-30%',
    iba_official: true,
    instructions: 'Shake both whiskies, lemon juice, orgeat, and bitters with ice vigorously. Double strain into chilled coupe. Express lemon peel and garnish.'
  }
];

export default function ScotchIrishWhiskeyPage() {
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
  const [selectedCocktail, setSelectedCocktail] = useState<typeof scotchIrishCocktails[0] | null>(null);

  const categories = ['Classic Scotch', 'Irish Classics', 'Modern Scotch', 'Irish Modern'];
  const difficulties = ['Very Easy', 'Easy', 'Medium', 'Hard'];

  const filteredCocktails = scotchIrishCocktails.filter(cocktail => {
    const matchesSearch = cocktail.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cocktail.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || cocktail.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || cocktail.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const handleCocktailClick = (cocktail: typeof scotchIrishCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'scotch-irish-whiskey',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof scotchIrishCocktails[0]) => {
    incrementDrinksMade();
    addPoints(40, 'Made a Scotch/Irish cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-green-50">
        {/* Universal Search Modal */}
        {showUniversalSearch && (
          <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-amber-700 via-orange-700 to-green-700 text-white py-16 px-4">
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
              <Castle className="w-12 h-12" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Scotch & Irish Whiskey</h1>
                <p className="text-xl text-white/90">Celtic spirits and timeless traditions</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search Scotch & Irish cocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 py-6 text-lg bg-white/95 border-0"
                />
              </div>
              <Button
                onClick={() => setShowUniversalSearch(true)}
                className="bg-white text-orange-700 hover:bg-white/90 px-6"
                size="lg"
              >
                <Target className="w-5 h-5 mr-2" />
                Advanced Search
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{scotchIrishCocktails.length}</div>
                <div className="text-white/80 text-sm">Cocktails</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{categories.length}</div>
                <div className="text-white/80 text-sm">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{scotchIrishCocktails.filter(c => c.trending).length}</div>
                <div className="text-white/80 text-sm">Trending</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{scotchIrishCocktails.filter(c => c.iba_official).length}</div>
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
                    className={selectedCategory === null ? "bg-orange-700" : ""}
                  >
                    All
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={selectedCategory === category ? "bg-orange-700" : ""}
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
                    className={selectedDifficulty === null ? "bg-orange-700" : ""}
                  >
                    All Levels
                  </Button>
                  {difficulties.map(diff => (
                    <Button
                      key={diff}
                      variant={selectedDifficulty === diff ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDifficulty(diff)}
                      className={selectedDifficulty === diff ? "bg-orange-700" : ""}
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
            Showing {filteredCocktails.length} of {scotchIrishCocktails.length} cocktails
          </div>

          {/* Cocktails Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map((cocktail) => (
              <Card 
                key={cocktail.id} 
                className="hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
                onClick={() => handleCocktailClick(cocktail)}
              >
                <div className="relative bg-gradient-to-br from-amber-100 to-orange-100 p-6 h-48 flex items-center justify-center">
                  <Castle className="w-20 h-20 text-orange-700 group-hover:scale-110 transition-transform" />
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
                    onClick={(e) => {
                      e.stopPropagation();
                      addToFavorites({
                        id: cocktail.id,
                        name: cocktail.name,
                        category: 'scotch-irish-whiskey',
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
                      <GlassWater className="w-4 h-4 text-orange-700" />
                      <span className="text-gray-600">{cocktail.glassware}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-700" />
                      <span className="text-gray-600">{cocktail.prepTime} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-700" />
                      <span className="text-gray-600">{cocktail.abv} ABV</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mountain className="w-4 h-4 text-orange-700" />
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
                    <Button 
                      className="flex-1 bg-orange-700 hover:bg-orange-800"
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
                    <Badge className="bg-orange-100 text-orange-700">{selectedCocktail.category}</Badge>
                    <Badge className="bg-amber-100 text-amber-700">{selectedCocktail.spiritType}</Badge>
                    <Badge className="bg-blue-100 text-blue-700">{selectedCocktail.difficulty}</Badge>
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
                        <Target className="w-5 h-5 text-orange-500" />
                        Cocktail Stats
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-orange-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">ABV</div>
                          <div className="text-xl font-bold text-orange-600">{selectedCocktail.abv}</div>
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
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        Ingredients
                      </h3>
                      <div className="space-y-2">
                        {selectedCocktail.ingredients.map((ingredient, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <Plus className="w-4 h-4 text-orange-500" />
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
                        <BookOpen className="w-5 h-5 text-orange-500" />
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
                    <div className="bg-amber-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        Pro Tips
                      </h3>
                      <ul className="space-y-2 text-sm text-amber-900">
                        {selectedCocktail.category.includes('Scotch') ? (
                          <>
                            <li>• Quality scotch makes all the difference - don't use bottom-shelf</li>
                            <li>• For peated cocktails, a little Islay goes a long way</li>
                            <li>• Consider the region's character when selecting your scotch</li>
                            <li>• Chill your glassware for the best experience</li>
                          </>
                        ) : (
                          <>
                            <li>• Irish whiskey's smoothness shines in cocktails</li>
                            <li>• Triple-distilled means lighter, more approachable drinks</li>
                            <li>• Perfect for whiskey newcomers</li>
                            <li>• Works beautifully in both stirred and shaken drinks</li>
                          </>
                        )}
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
                        className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
                        onClick={() => handleMakeCocktail(selectedCocktail)}
                      >
                        <Castle className="w-4 h-4 mr-2" />
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
          <Card className="mt-12 bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Castle className="w-7 h-7 text-orange-700" />
                About Scotch & Irish Whiskey
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-amber-700">Scotch Whisky</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    Scotch whisky must be distilled and aged in Scotland for at least three years in oak casks. 
                    Known for its diverse regional characteristics, from the peaty, smoky flavors of Islay to 
                    the lighter, more delicate Highland styles. Scotch is typically spelled without an "e" and 
                    can be either single malt (from one distillery using malted barley) or blended (combining 
                    malt and grain whiskies).
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-green-700">Irish Whiskey</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    Irish whiskey is known for its smooth, approachable character and is typically triple-distilled, 
                    making it lighter and smoother than most Scotch. It must be aged in Ireland for at least three 
                    years. Irish whiskey includes single pot still (using both malted and unmalted barley), single 
                    malt, grain, and blended varieties. The extra "e" in whiskey is the Irish (and American) spelling.
                  </p>
                </div>
              </div>

              {/* Scotch Regions */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-amber-700">Scotch Whisky Regions</h3>
                <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-slate-100 rounded-lg border border-gray-200">
                    <div className="font-semibold text-gray-700 mb-2">Islay</div>
                    <div className="text-sm text-gray-600">Peaty, smoky, maritime character. Bold and intense.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-100 rounded-lg border border-amber-200">
                    <div className="font-semibold text-amber-700 mb-2">Highland</div>
                    <div className="text-sm text-gray-600">Diverse styles. Often rich, full-bodied, and complex.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-100 rounded-lg border border-blue-200">
                    <div className="font-semibold text-blue-700 mb-2">Speyside</div>
                    <div className="text-sm text-gray-600">Elegant, sweet, fruity. Often sherried notes.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg border border-green-200">
                    <div className="font-semibold text-green-700 mb-2">Lowland</div>
                    <div className="text-sm text-gray-600">Light, delicate, floral. Triple-distilled tradition.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-red-100 rounded-lg border border-orange-200">
                    <div className="font-semibold text-orange-700 mb-2">Campbeltown</div>
                    <div className="text-sm text-gray-600">Briny, slightly smoky. Maritime influence.</div>
                  </div>
                </div>
              </div>

              {/* Irish Whiskey Styles */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-green-700">Irish Whiskey Styles</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="font-semibold text-green-700 mb-2">Single Pot Still</div>
                    <div className="text-sm text-gray-600">Malted and unmalted barley. Spicy, full-bodied character.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="font-semibold text-green-700 mb-2">Single Malt</div>
                    <div className="text-sm text-gray-600">100% malted barley from one distillery. Complex flavors.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="font-semibold text-green-700 mb-2">Grain Whiskey</div>
                    <div className="text-sm text-gray-600">Made from grains other than malted barley. Lighter style.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="font-semibold text-green-700 mb-2">Blended</div>
                    <div className="text-sm text-gray-600">Mix of pot still, malt, and grain. Smooth, balanced.</div>
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
