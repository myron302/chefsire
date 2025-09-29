import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Wine, Clock, Heart, Star, Target, Sparkles, Grape, 
  Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater,
  TrendingUp, Award, Crown, Coffee, Leaf, Zap, Cherry
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const cognacCocktails = [
  // CLASSIC COGNAC COCKTAILS
  {
    id: 'cognac-1',
    name: 'Sidecar',
    description: 'Classic cognac sour with orange liqueur',
    spiritType: 'Cognac',
    origin: 'Paris, France',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 10,
      sugar: 8,
      alcohol: 16
    },
    ingredients: [
      'Cognac (2 oz)',
      'Triple Sec (0.75 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Sugar (for rim)',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Sophisticated', 'Citrus', 'Balanced', 'Elegant'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 3421,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Cognac',
    garnish: 'Sugar rim, orange peel',
    method: 'Shake',
    abv: '28-32%',
    iba_official: true,
    era: '1920s'
  },
  {
    id: 'cognac-2',
    name: 'French Connection',
    description: 'Simple yet elegant cognac and amaretto',
    spiritType: 'Cognac',
    origin: 'France',
    glassware: 'Rocks Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 185,
      carbs: 8,
      sugar: 7,
      alcohol: 17
    },
    ingredients: [
      'Cognac (1.5 oz)',
      'Amaretto (1.5 oz)',
      'Large Ice Cube'
    ],
    profile: ['Sweet', 'Nutty', 'Smooth', 'Rich'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 2134,
    trending: false,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Cognac',
    garnish: 'None',
    method: 'Build',
    abv: '32-36%',
    iba_official: false,
    era: '1970s'
  },
  {
    id: 'cognac-3',
    name: 'Vieux Carré',
    description: 'New Orleans classic with cognac and rye',
    spiritType: 'Cognac',
    origin: 'New Orleans',
    glassware: 'Rocks Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 5,
      sugar: 4,
      alcohol: 18
    },
    ingredients: [
      'Rye Whiskey (0.75 oz)',
      'Cognac (0.75 oz)',
      'Sweet Vermouth (0.75 oz)',
      'Bénédictine (0.25 oz)',
      'Peychaud\'s Bitters (1 dash)',
      'Angostura Bitters (1 dash)',
      'Lemon Peel'
    ],
    profile: ['Complex', 'Rich', 'Herbaceous', 'Layered'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 1876,
    trending: false,
    featured: true,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Cognac',
    garnish: 'Lemon peel',
    method: 'Stir',
    abv: '32-36%',
    iba_official: true,
    era: '1930s'
  },
  {
    id: 'cognac-4',
    name: 'Sazerac (Cognac)',
    description: 'Original Sazerac with cognac before rye',
    spiritType: 'Cognac',
    origin: 'New Orleans',
    glassware: 'Rocks Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 165,
      carbs: 3,
      sugar: 2,
      alcohol: 18
    },
    ingredients: [
      'Cognac (2 oz)',
      'Simple Syrup (0.25 oz)',
      'Peychaud\'s Bitters (3 dashes)',
      'Absinthe (rinse)',
      'Lemon Peel',
      'Ice for stirring'
    ],
    profile: ['Strong', 'Herbaceous', 'Anise', 'Historic'],
    difficulty: 'Hard',
    prepTime: 6,
    rating: 4.8,
    reviews: 2543,
    trending: true,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Cognac',
    garnish: 'Lemon peel',
    method: 'Stir',
    abv: '34-38%',
    iba_official: false,
    era: '1850s'
  },

  // MODERN COGNAC COCKTAILS
  {
    id: 'cognac-5',
    name: 'Cognac Old Fashioned',
    description: 'Classic Old Fashioned with cognac',
    spiritType: 'Cognac',
    origin: 'United States',
    glassware: 'Rocks Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 175,
      carbs: 5,
      sugar: 4,
      alcohol: 16
    },
    ingredients: [
      'Cognac (2 oz)',
      'Demerara Syrup (0.25 oz)',
      'Angostura Bitters (2 dashes)',
      'Orange Bitters (1 dash)',
      'Orange Peel',
      'Large Ice Cube'
    ],
    profile: ['Sophisticated', 'Smooth', 'Oak', 'Aromatic'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.7,
    reviews: 2876,
    trending: true,
    featured: true,
    estimatedCost: 5.75,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Cognac',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '30-34%',
    iba_official: false,
    era: '2000s'
  },
  {
    id: 'cognac-6',
    name: 'French 75 (Cognac)',
    description: 'Champagne cocktail with cognac',
    spiritType: 'Cognac',
    origin: 'Paris, France',
    glassware: 'Champagne Flute',
    servingSize: '6 oz',
    nutrition: {
      calories: 155,
      carbs: 8,
      sugar: 6,
      alcohol: 13
    },
    ingredients: [
      'Cognac (1 oz)',
      'Fresh Lemon Juice (0.5 oz)',
      'Simple Syrup (0.5 oz)',
      'Champagne (3 oz)',
      'Lemon Twist',
      'Ice'
    ],
    profile: ['Sparkling', 'Citrus', 'Elegant', 'Celebration'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 3124,
    trending: true,
    featured: true,
    estimatedCost: 6.25,
    bestTime: 'Evening',
    occasion: 'Celebration',
    allergens: [],
    category: 'Modern Cognac',
    garnish: 'Lemon twist',
    method: 'Shake & Top',
    abv: '18-22%',
    iba_official: false,
    era: '1915'
  },

  // BRANDY COCKTAILS
  {
    id: 'cognac-7',
    name: 'Brandy Alexander',
    description: 'Creamy dessert cocktail with brandy',
    spiritType: 'Brandy',
    origin: 'United Kingdom',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 235,
      carbs: 14,
      sugar: 12,
      alcohol: 14
    },
    ingredients: [
      'Brandy (1.5 oz)',
      'Crème de Cacao (1 oz)',
      'Heavy Cream (1 oz)',
      'Nutmeg (grated)',
      'Ice'
    ],
    profile: ['Creamy', 'Chocolate', 'Dessert', 'Luxurious'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2987,
    trending: false,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Dessert',
    allergens: ['Dairy'],
    category: 'Classic Brandy',
    garnish: 'Grated nutmeg',
    method: 'Shake',
    abv: '22-26%',
    iba_official: true,
    era: '1920s'
  },
  {
    id: 'cognac-8',
    name: 'Metropolitan',
    description: 'Brandy-based cosmopolitan variation',
    spiritType: 'Brandy',
    origin: 'New York City',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 175,
      carbs: 10,
      sugar: 8,
      alcohol: 14
    },
    ingredients: [
      'Brandy (1.5 oz)',
      'Triple Sec (0.5 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Cranberry Juice (1 oz)',
      'Lime Twist',
      'Ice'
    ],
    profile: ['Fruity', 'Tart', 'Sophisticated', 'Smooth'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 1654,
    trending: false,
    featured: false,
    estimatedCost: 4.75,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Brandy',
    garnish: 'Lime twist',
    method: 'Shake',
    abv: '20-24%',
    iba_official: false,
    era: '1990s'
  },

  // APPLE BRANDY / CALVADOS
  {
    id: 'cognac-9',
    name: 'Jack Rose',
    description: 'Apple brandy with grenadine and lime',
    spiritType: 'Apple Brandy',
    origin: 'United States',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 165,
      carbs: 12,
      sugar: 10,
      alcohol: 13
    },
    ingredients: [
      'Apple Brandy (2 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Grenadine (0.5 oz)',
      'Lime Wheel',
      'Ice'
    ],
    profile: ['Fruity', 'Tart', 'Apple', 'Classic'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 2134,
    trending: true,
    featured: true,
    estimatedCost: 5.25,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Apple Brandy',
    garnish: 'Lime wheel',
    method: 'Shake',
    abv: '22-26%',
    iba_official: true,
    era: '1920s'
  },
  {
    id: 'cognac-10',
    name: 'Corpse Reviver No. 1',
    description: 'Cognac-based hangover cure',
    spiritType: 'Cognac',
    origin: 'London, UK',
    glassware: 'Coupe Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 185,
      carbs: 6,
      sugar: 5,
      alcohol: 16
    },
    ingredients: [
      'Cognac (1.5 oz)',
      'Calvados (0.75 oz)',
      'Sweet Vermouth (0.75 oz)',
      'Lemon Twist',
      'Ice'
    ],
    profile: ['Strong', 'Apple', 'Herbal', 'Revival'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 1432,
    trending: false,
    featured: false,
    estimatedCost: 5.75,
    bestTime: 'Morning',
    occasion: 'Brunch',
    allergens: [],
    category: 'Classic Cognac',
    garnish: 'Lemon twist',
    method: 'Shake',
    abv: '28-32%',
    iba_official: false,
    era: '1930s'
  },

  // CONTEMPORARY COGNAC
  {
    id: 'cognac-11',
    name: 'Cognac Sour',
    description: 'Classic sour template with cognac',
    spiritType: 'Cognac',
    origin: 'United States',
    glassware: 'Rocks Glass',
    servingSize: '5 oz',
    nutrition: {
      calories: 185,
      carbs: 12,
      sugar: 10,
      alcohol: 14
    },
    ingredients: [
      'Cognac (2 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Simple Syrup (0.5 oz)',
      'Egg White (optional)',
      'Angostura Bitters (2 dashes)',
      'Lemon Wheel',
      'Ice'
    ],
    profile: ['Tart', 'Smooth', 'Frothy', 'Balanced'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.6,
    reviews: 1987,
    trending: false,
    featured: true,
    estimatedCost: 5.25,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: ['Egg'],
    category: 'Modern Cognac',
    garnish: 'Lemon wheel',
    method: 'Dry Shake',
    abv: '22-26%',
    iba_official: false,
    era: '2000s'
  },
  {
    id: 'cognac-12',
    name: 'Between the Sheets',
    description: 'Cognac and rum with citrus',
    spiritType: 'Cognac',
    origin: 'Paris, France',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 8,
      sugar: 6,
      alcohol: 17
    },
    ingredients: [
      'Cognac (0.75 oz)',
      'White Rum (0.75 oz)',
      'Triple Sec (0.75 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Lemon Twist',
      'Ice'
    ],
    profile: ['Citrus', 'Complex', 'Smooth', 'Balanced'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 2345,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Classic Cognac',
    garnish: 'Lemon twist',
    method: 'Shake',
    abv: '26-30%',
    iba_official: true,
    era: '1930s'
  }
];

const spiritCategories = [
  { 
    id: 'all', 
    name: 'All Spirits', 
    icon: Grape,
    color: 'bg-purple-500',
    description: 'Every cognac & brandy'
  },
  { 
    id: 'cognac', 
    name: 'Cognac', 
    icon: Crown,
    color: 'bg-amber-600',
    description: 'French grape brandy'
  },
  { 
    id: 'brandy', 
    name: 'Brandy', 
    icon: Wine,
    color: 'bg-orange-500',
    description: 'Grape-based spirits'
  },
  { 
    id: 'apple brandy', 
    name: 'Apple Brandy', 
    icon: Cherry,
    color: 'bg-red-500',
    description: 'Calvados & applejack'
  }
];

export default function CognacBrandyPage() {
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
  const [selectedCocktail, setSelectedCocktail] = useState<typeof cognacCocktails[0] | null>(null);
  const [alcoholRange, setAlcoholRange] = useState([0, 40]);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyIBA, setOnlyIBA] = useState(false);

  const filteredCocktails = cognacCocktails.filter(cocktail => {
    if (selectedCategory !== 'all' && cocktail.spiritType.toLowerCase() !== selectedCategory) {
      return false;
    }
    const abvNum = parseInt(cocktail.abv);
    if (abvNum < alcoholRange[0] || abvNum > alcoholRange[1]) {
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
    if (sortBy === 'alcohol-low') return parseInt(a.abv) - parseInt(b.abv);
    if (sortBy === 'alcohol-high') return parseInt(b.abv) - parseInt(a.abv);
    if (sortBy === 'cost-low') return a.estimatedCost - b.estimatedCost;
    return 0;
  });

  const handleCocktailClick = (cocktail: typeof cognacCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'Cognac & Brandy',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof cognacCocktails[0]) => {
    incrementDrinksMade();
    addPoints(45, 'Made a cognac/brandy cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-amber-50 to-orange-50">
        {/* Universal Search */}
        <div className="bg-white border-b border-purple-100 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <UniversalSearch />
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 via-amber-700 to-orange-700 text-white py-8">
          <div className="max-w-7xl mx-auto px-4">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Potent Potables
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <Grape className="w-10 h-10" />
                  Cognac & Brandy Cocktails
                </h1>
                <p className="text-purple-100 text-lg">Refined grape spirits from France and beyond</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{filteredCocktails.length}</div>
                <div className="text-purple-100">Recipes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Spirit Type Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {spiritCategories.map(category => {
              const Icon = category.icon;
              const categoryCocktails = cognacCocktails.filter(c => 
                category.id === 'all' || c.spiritType.toLowerCase() === category.id
              );
              
              return (
                <Card 
                  key={category.id}
                  className={`cursor-pointer transition-all ${
                    selectedCategory === category.id ? 'ring-2 ring-purple-500 ring-offset-2' : ''
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`inline-flex p-3 ${category.color.replace('bg-', 'bg-').replace('-500', '-100').replace('-600', '-100')} rounded-full mb-3`}>
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
                  placeholder="Search cognac & brandy cocktails..."
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
              <option value="alcohol-low">Lowest ABV</option>
              <option value="alcohol-high">Highest ABV</option>
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
            <Card className="mb-6 bg-white border-purple-200">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Alcohol Content: {alcoholRange[0]}-{alcoholRange[1]}% ABV
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={alcoholRange[1]}
                      onChange={(e) => setAlcoholRange([alcoholRange[0], parseInt(e.target.value)])}
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
              const categoryData = spiritCategories.find(c => c.id === cocktail.spiritType.toLowerCase());
              const CategoryIcon = categoryData?.icon || Grape;
              
              return (
                <Card 
                  key={cocktail.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-purple-100 hover:border-purple-300"
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
                            category: 'Cognac & Brandy',
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
                        {cocktail.spiritType}
                      </Badge>
                      {cocktail.trending && (
                        <Badge className="bg-purple-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.featured && (
                        <Badge className="bg-amber-500">
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
                        <Grape className="w-4 h-4 text-purple-500" />
                        <span>{cocktail.abv} ABV</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{cocktail.rating} ({cocktail.reviews})</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {cocktail.profile.slice(0, 3).map(trait => (
                        <Badge key={trait} variant="outline" className="text-xs border-purple-300">
                          {trait}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm font-medium text-purple-600">{cocktail.method}</span>
                      <span className="text-sm text-gray-500">${cocktail.estimatedCost.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Cocktail Detail Modal - Keeping implementation concise for token limit */}
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
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-purple-50 rounded-lg text-center">
                        <div className="text-sm text-gray-600">Calories</div>
                        <div className="text-xl font-bold text-purple-600">{selectedCocktail.nutrition.calories}</div>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-lg text-center">
                        <div className="text-sm text-gray-600">ABV</div>
                        <div className="text-xl font-bold text-amber-600">{selectedCocktail.abv}</div>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg text-center">
                        <div className="text-sm text-gray-600">Type</div>
                        <div className="text-sm font-bold text-orange-600">{selectedCocktail.spiritType}</div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Ingredients</h3>
                      <div className="space-y-1">
                        {selectedCocktail.ingredients.map((ing, i) => (
                          <div key={i} className="text-sm flex items-center gap-2">
                            <Plus className="w-3 h-3 text-purple-500" />
                            {ing}
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button 
                      className="w-full bg-gradient-to-r from-purple-600 to-amber-600"
                      onClick={() => handleMakeCocktail(selectedCocktail)}
                    >
                      <Grape className="w-4 h-4 mr-2" />
                      Make This Cocktail
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Educational Content */}
          <Card className="mt-12 bg-gradient-to-br from-purple-50 to-amber-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-purple-500" />
                Understanding Cognac & Brandy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Crown className="w-8 h-8 text-amber-600 mb-2" />
                  <h3 className="font-semibold mb-2 text-amber-600">Cognac</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    French brandy from Cognac region. Double-distilled in copper pot stills, aged in oak. 
                    Classified by age: VS (2+ years), VSOP (4+ years), XO (10+ years).
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Hennessy, Rémy Martin, Courvoisier</p>
                </div>
                <div>
                  <Wine className="w-8 h-8 text-orange-500 mb-2" />
                  <h3 className="font-semibold mb-2 text-orange-600">Brandy</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Distilled wine from grapes. Made worldwide with regional variations. 
                    Smooth, fruity, with notes of vanilla, caramel, and dried fruit.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: E&J, Paul Masson, Spanish brandy</p>
                </div>
                <div>
                  <Cherry className="w-8 h-8 text-red-500 mb-2" />
                  <h3 className="font-semibold mb-2 text-red-600">Apple Brandy</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Distilled from apples. Calvados from Normandy, Applejack from America. 
                    Apple-forward with oak aging complexity.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Calvados Boulard, Laird's Applejack</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cognac Classifications */}
          <Card className="mt-8 bg-white border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-6 h-6 text-amber-500" />
                Cognac Age Classifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="p-4 bg-amber-50 rounded-lg">
                  <div className="font-semibold text-amber-600 mb-2">VS (Very Special)</div>
                  <div className="text-sm text-gray-700">Aged minimum 2 years. Vibrant, fruity, perfect for mixing.</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="font-semibold text-orange-600 mb-2">VSOP (Very Superior Old Pale)</div>
                  <div className="text-sm text-gray-700">Aged minimum 4 years. Smooth, complex, great for cocktails.</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="font-semibold text-red-600 mb-2">XO (Extra Old)</div>
                  <div className="text-sm text-gray-700">Aged minimum 10 years. Rich, luxurious, best for sipping.</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="font-semibold text-purple-600 mb-2">Hors d'âge</div>
                  <div className="text-sm text-gray-700">Beyond age categories. Ultra-premium, rare expressions.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cocktail Styles */}
          <Card className="mt-8 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wine className="w-6 h-6 text-orange-500" />
                Cognac Cocktail Styles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-purple-600">Classic Cognac</h3>
                  <p className="text-sm text-gray-700">Timeless recipes from the golden age like Sidecar and Vieux Carré.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-orange-600">Brandy Desserts</h3>
                  <p className="text-sm text-gray-700">Creamy, indulgent cocktails like Brandy Alexander.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-red-600">Contemporary</h3>
                  <p className="text-sm text-gray-700">Modern interpretations and innovative combinations.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
