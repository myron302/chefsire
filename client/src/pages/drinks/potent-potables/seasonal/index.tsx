import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Snowflake, Sun, Leaf, Flower2, Clock, Heart, Star, Target, 
  Sparkles, Wine, Search, Share2, ArrowLeft, Plus, Camera, 
  Flame, GlassWater, TrendingUp, Award, Cherry, Cloud, Zap
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const seasonalCocktails = [
  // WINTER COCKTAILS
  {
    id: 'seasonal-1',
    name: 'Hot Toddy',
    description: 'Warm whiskey with honey, lemon, and spices',
    season: 'Winter',
    spirit: 'Whiskey',
    temperature: 'Hot',
    glassware: 'Irish Coffee Mug',
    servingSize: '8 oz',
    nutrition: {
      calories: 145,
      carbs: 12,
      sugar: 10,
      alcohol: 10
    },
    ingredients: [
      'Bourbon or Whiskey (2 oz)',
      'Honey (1 tbsp)',
      'Fresh Lemon Juice (0.5 oz)',
      'Hot Water (4-6 oz)',
      'Cinnamon Stick',
      'Lemon Wheel',
      'Star Anise (optional)'
    ],
    profile: ['Warming', 'Soothing', 'Spiced'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 1876,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Evening',
    occasion: 'Cozy Night',
    allergens: [],
    category: 'Winter Warmers',
    garnish: 'Cinnamon stick, lemon wheel',
    method: 'Build',
    abv: '15-18%',
    monthsAvailable: [11, 12, 1, 2]
  },
  {
    id: 'seasonal-2',
    name: 'Peppermint White Russian',
    description: 'Festive twist on classic with peppermint',
    season: 'Winter',
    spirit: 'Vodka',
    temperature: 'Cold',
    glassware: 'Rocks',
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
      'Peppermint Schnapps (0.5 oz)',
      'Crushed Candy Cane (rim)',
      'Ice'
    ],
    profile: ['Creamy', 'Minty', 'Festive'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 1432,
    trending: true,
    featured: true,
    estimatedCost: 4.25,
    bestTime: 'Evening',
    occasion: 'Holiday Party',
    allergens: ['Dairy'],
    category: 'Winter Cocktails',
    garnish: 'Candy cane rim',
    method: 'Build',
    abv: '20-25%',
    monthsAvailable: [12, 1]
  },
  {
    id: 'seasonal-3',
    name: 'Mulled Wine',
    description: 'Spiced red wine heated with citrus and spices',
    season: 'Winter',
    spirit: 'Wine',
    temperature: 'Hot',
    glassware: 'Heat-Safe Mug',
    servingSize: '8 oz',
    nutrition: {
      calories: 185,
      carbs: 18,
      sugar: 15,
      alcohol: 8
    },
    ingredients: [
      'Red Wine (6 oz)',
      'Orange Slices (2)',
      'Cinnamon Sticks (2)',
      'Star Anise (2)',
      'Cloves (4)',
      'Honey (1 tbsp)',
      'Brandy (1 oz, optional)'
    ],
    profile: ['Spiced', 'Warming', 'Aromatic'],
    difficulty: 'Medium',
    prepTime: 20,
    rating: 4.8,
    reviews: 2341,
    trending: false,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Winter Gathering',
    allergens: [],
    category: 'Winter Warmers',
    garnish: 'Orange slice, cinnamon stick',
    method: 'Simmer',
    abv: '10-12%',
    monthsAvailable: [11, 12, 1, 2]
  },

  // SPRING COCKTAILS
  {
    id: 'seasonal-4',
    name: 'Elderflower Gin Fizz',
    description: 'Floral gin cocktail with elderflower and citrus',
    season: 'Spring',
    spirit: 'Gin',
    temperature: 'Cold',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 165,
      carbs: 14,
      sugar: 12,
      alcohol: 11
    },
    ingredients: [
      'Gin (2 oz)',
      'Elderflower Liqueur (0.75 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Club Soda (3 oz)',
      'Cucumber Slice',
      'Mint Sprig',
      'Ice'
    ],
    profile: ['Floral', 'Refreshing', 'Light'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 1654,
    trending: true,
    featured: true,
    estimatedCost: 4.75,
    bestTime: 'Afternoon',
    occasion: 'Garden Party',
    allergens: [],
    category: 'Spring Cocktails',
    garnish: 'Cucumber, mint sprig',
    method: 'Shake & Top',
    abv: '15-18%',
    monthsAvailable: [3, 4, 5]
  },
  {
    id: 'seasonal-5',
    name: 'Lavender Lemon Drop',
    description: 'Spring twist on classic with lavender syrup',
    season: 'Spring',
    spirit: 'Vodka',
    temperature: 'Cold',
    glassware: 'Martini',
    servingSize: '4 oz',
    nutrition: {
      calories: 155,
      carbs: 10,
      sugar: 8,
      alcohol: 13
    },
    ingredients: [
      'Vodka (2 oz)',
      'Lavender Syrup (0.75 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Sugar (for rim)',
      'Lavender Sprig',
      'Ice'
    ],
    profile: ['Floral', 'Tart', 'Elegant'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 1234,
    trending: false,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Evening',
    occasion: 'Brunch',
    allergens: [],
    category: 'Spring Cocktails',
    garnish: 'Sugar rim, lavender sprig',
    method: 'Shake',
    abv: '22-25%',
    monthsAvailable: [4, 5, 6]
  },
  {
    id: 'seasonal-6',
    name: 'Strawberry Basil Smash',
    description: 'Fresh strawberries muddled with basil and gin',
    season: 'Spring',
    spirit: 'Gin',
    temperature: 'Cold',
    glassware: 'Rocks',
    servingSize: '8 oz',
    nutrition: {
      calories: 175,
      carbs: 15,
      sugar: 12,
      alcohol: 12
    },
    ingredients: [
      'Gin (2 oz)',
      'Fresh Strawberries (4)',
      'Fresh Basil (5 leaves)',
      'Fresh Lemon Juice (0.75 oz)',
      'Simple Syrup (0.5 oz)',
      'Club Soda (2 oz)',
      'Ice'
    ],
    profile: ['Fruity', 'Herbal', 'Refreshing'],
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.8,
    reviews: 2156,
    trending: true,
    featured: false,
    estimatedCost: 4.50,
    bestTime: 'Afternoon',
    occasion: 'Spring Brunch',
    allergens: [],
    category: 'Spring Cocktails',
    garnish: 'Strawberry, basil leaf',
    method: 'Muddle',
    abv: '18-20%',
    monthsAvailable: [4, 5, 6]
  },

  // SUMMER COCKTAILS
  {
    id: 'seasonal-7',
    name: 'Watermelon Margarita',
    description: 'Fresh watermelon blended with tequila and lime',
    season: 'Summer',
    spirit: 'Tequila',
    temperature: 'Cold',
    glassware: 'Margarita',
    servingSize: '10 oz',
    nutrition: {
      calories: 195,
      carbs: 18,
      sugar: 15,
      alcohol: 13
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Watermelon (2 cups)',
      'Fresh Lime Juice (1 oz)',
      'Triple Sec (0.5 oz)',
      'Agave Nectar (0.5 oz)',
      'Salt (rim)',
      'Ice'
    ],
    profile: ['Fruity', 'Refreshing', 'Sweet'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.9,
    reviews: 3421,
    trending: true,
    featured: true,
    estimatedCost: 4.25,
    bestTime: 'Afternoon',
    occasion: 'Pool Party',
    allergens: [],
    category: 'Summer Cocktails',
    garnish: 'Watermelon triangle, salt rim',
    method: 'Blend',
    abv: '18-22%',
    monthsAvailable: [6, 7, 8]
  },
  {
    id: 'seasonal-8',
    name: 'Frozen Piña Colada',
    description: 'Tropical blend of rum, pineapple, and coconut',
    season: 'Summer',
    spirit: 'Rum',
    temperature: 'Frozen',
    glassware: 'Hurricane',
    servingSize: '12 oz',
    nutrition: {
      calories: 285,
      carbs: 32,
      sugar: 28,
      alcohol: 10
    },
    ingredients: [
      'White Rum (2 oz)',
      'Coconut Cream (2 oz)',
      'Fresh Pineapple (1 cup)',
      'Pineapple Juice (2 oz)',
      'Lime Juice (0.5 oz)',
      'Ice (2 cups)'
    ],
    profile: ['Tropical', 'Creamy', 'Sweet'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 2987,
    trending: true,
    featured: true,
    estimatedCost: 4.75,
    bestTime: 'Afternoon',
    occasion: 'Beach Day',
    allergens: [],
    category: 'Summer Cocktails',
    garnish: 'Pineapple wedge, cherry',
    method: 'Blend',
    abv: '12-15%',
    monthsAvailable: [6, 7, 8, 9]
  },
  {
    id: 'seasonal-9',
    name: 'Cucumber Gin & Tonic',
    description: 'Refreshing G&T with muddled cucumber',
    season: 'Summer',
    spirit: 'Gin',
    temperature: 'Cold',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 158,
      carbs: 10,
      sugar: 8,
      alcohol: 12
    },
    ingredients: [
      'Gin (2 oz)',
      'Fresh Cucumber (4 slices)',
      'Tonic Water (6 oz)',
      'Fresh Lime (2 wedges)',
      'Mint Leaves (3)',
      'Ice'
    ],
    profile: ['Crisp', 'Refreshing', 'Botanical'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1876,
    trending: false,
    featured: false,
    estimatedCost: 3.75,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: [],
    category: 'Summer Cocktails',
    garnish: 'Cucumber ribbon, mint',
    method: 'Build',
    abv: '15-18%',
    monthsAvailable: [6, 7, 8]
  },

  // FALL COCKTAILS
  {
    id: 'seasonal-10',
    name: 'Apple Cider Bourbon Smash',
    description: 'Autumn bourbon cocktail with apple cider',
    season: 'Fall',
    spirit: 'Whiskey',
    temperature: 'Cold',
    glassware: 'Rocks',
    servingSize: '8 oz',
    nutrition: {
      calories: 195,
      carbs: 16,
      sugar: 14,
      alcohol: 13
    },
    ingredients: [
      'Bourbon (2 oz)',
      'Apple Cider (3 oz)',
      'Fresh Lemon Juice (0.5 oz)',
      'Maple Syrup (0.5 oz)',
      'Cinnamon Stick',
      'Apple Slice',
      'Ice'
    ],
    profile: ['Spiced', 'Apple', 'Warming'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 2543,
    trending: true,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Evening',
    occasion: 'Fall Gathering',
    allergens: [],
    category: 'Fall Cocktails',
    garnish: 'Apple slice, cinnamon stick',
    method: 'Shake',
    abv: '18-22%',
    monthsAvailable: [9, 10, 11]
  },
  {
    id: 'seasonal-11',
    name: 'Pumpkin Spice Espresso Martini',
    description: 'Fall twist on classic with pumpkin spice',
    season: 'Fall',
    spirit: 'Vodka',
    temperature: 'Cold',
    glassware: 'Martini',
    servingSize: '5 oz',
    nutrition: {
      calories: 185,
      carbs: 14,
      sugar: 11,
      alcohol: 14
    },
    ingredients: [
      'Vanilla Vodka (2 oz)',
      'Pumpkin Spice Liqueur (0.5 oz)',
      'Coffee Liqueur (0.5 oz)',
      'Espresso (1 oz)',
      'Pumpkin Spice (sprinkle)',
      'Ice'
    ],
    profile: ['Spiced', 'Coffee', 'Creamy'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 1987,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Fall Party',
    allergens: [],
    category: 'Fall Cocktails',
    garnish: 'Pumpkin spice rim, coffee beans',
    method: 'Shake',
    abv: '22-25%',
    monthsAvailable: [9, 10, 11]
  },
  {
    id: 'seasonal-12',
    name: 'Cranberry Moscow Mule',
    description: 'Holiday twist on classic mule with cranberry',
    season: 'Fall',
    spirit: 'Vodka',
    temperature: 'Cold',
    glassware: 'Copper Mug',
    servingSize: '10 oz',
    nutrition: {
      calories: 165,
      carbs: 15,
      sugar: 13,
      alcohol: 11
    },
    ingredients: [
      'Vodka (2 oz)',
      'Cranberry Juice (2 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Ginger Beer (4 oz)',
      'Fresh Cranberries',
      'Rosemary Sprig',
      'Ice'
    ],
    profile: ['Tart', 'Spicy', 'Festive'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1654,
    trending: false,
    featured: true,
    estimatedCost: 3.75,
    bestTime: 'Evening',
    occasion: 'Holiday Party',
    allergens: [],
    category: 'Fall Cocktails',
    garnish: 'Cranberries, rosemary, lime',
    method: 'Build',
    abv: '15-18%',
    monthsAvailable: [10, 11, 12]
  }
];

const seasons = [
  { 
    id: 'winter', 
    name: 'Winter', 
    icon: Snowflake,
    color: 'bg-blue-500',
    description: 'Warm and cozy cocktails',
    months: 'December - February'
  },
  { 
    id: 'spring', 
    name: 'Spring', 
    icon: Flower2,
    color: 'bg-pink-500',
    description: 'Fresh and floral drinks',
    months: 'March - May'
  },
  { 
    id: 'summer', 
    name: 'Summer', 
    icon: Sun,
    color: 'bg-yellow-500',
    description: 'Cool and refreshing cocktails',
    months: 'June - August'
  },
  { 
    id: 'fall', 
    name: 'Fall', 
    icon: Leaf,
    color: 'bg-orange-500',
    description: 'Spiced autumn cocktails',
    months: 'September - November'
  }
];

const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Fall';
  return 'Winter';
};

export default function SeasonalCocktailsPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedSeason, setSelectedSeason] = useState(getCurrentSeason());
  const [selectedTemperature, setSelectedTemperature] = useState('All');
  const [sortBy, setSortBy] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCocktail, setSelectedCocktail] = useState<typeof seasonalCocktails[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCocktails = seasonalCocktails.filter(cocktail => {
    if (selectedSeason !== 'All' && cocktail.season !== selectedSeason) {
      return false;
    }
    if (selectedTemperature !== 'All' && cocktail.temperature !== selectedTemperature) {
      return false;
    }
    if (searchQuery && !cocktail.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'trending') return b.reviews - a.reviews;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'calories-low') return a.nutrition.calories - b.nutrition.calories;
    if (sortBy === 'cost-low') return a.estimatedCost - b.estimatedCost;
    if (sortBy === 'time-quick') return a.prepTime - b.prepTime;
    return 0;
  });

  const handleCocktailClick = (cocktail: typeof seasonalCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'Seasonal Cocktails',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof seasonalCocktails[0]) => {
    incrementDrinksMade();
    addPoints(30, 'Made a seasonal cocktail');
    setSelectedCocktail(null);
  };

  const currentSeason = getCurrentSeason();

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-orange-50">
        {/* Universal Search */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <UniversalSearch />
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 via-pink-500 to-orange-500 text-white py-8">
          <div className="max-w-7xl mx-auto px-4">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Potent Potables
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <Sparkles className="w-10 h-10" />
                  Seasonal Cocktails
                </h1>
                <p className="text-blue-100 text-lg">Perfect drinks for every season of the year</p>
                <Badge className="mt-2 bg-white/20 text-white border-white/30">
                  Current Season: {currentSeason}
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{filteredCocktails.length}</div>
                <div className="text-blue-100">Recipes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Season Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {seasons.map(season => {
              const Icon = season.icon;
              const seasonCocktails = seasonalCocktails.filter(c => c.season === season.name);
              const isCurrentSeason = season.name === currentSeason;
              
              return (
                <Card 
                  key={season.id}
                  className={`cursor-pointer transition-all ${
                    selectedSeason === season.name 
                      ? 'ring-2 ring-offset-2' 
                      : ''
                  } ${isCurrentSeason ? 'border-2 border-yellow-400' : ''}`}
                  onClick={() => setSelectedSeason(season.name)}
                >
                  <CardContent className="p-6 text-center">
                    <div className={`inline-flex p-4 ${season.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-full mb-4`}>
                      <Icon className={`w-8 h-8 ${season.color.replace('bg-', 'text-')}`} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{season.name}</h3>
                    {isCurrentSeason && (
                      <Badge className="mb-2 bg-yellow-500">Current Season</Badge>
                    )}
                    <p className="text-sm text-gray-600 mb-2">{season.description}</p>
                    <p className="text-xs text-gray-500 mb-4">{season.months}</p>
                    <div className="text-2xl font-bold text-gray-900">{seasonCocktails.length}</div>
                    <div className="text-sm text-gray-600">Cocktails</div>
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
                  placeholder="Search seasonal cocktails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select 
              value={selectedTemperature}
              onChange={(e) => setSelectedTemperature(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              <option value="All">All Temperatures</option>
              <option value="Hot">Hot</option>
              <option value="Cold">Cold</option>
              <option value="Frozen">Frozen</option>
            </select>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              <option value="trending">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="calories-low">Lowest Calories</option>
              <option value="cost-low">Most Budget-Friendly</option>
              <option value="time-quick">Quickest Prep</option>
            </select>
            <Button 
              variant="outline"
              onClick={() => setSelectedSeason('All')}
            >
              View All Seasons
            </Button>
          </div>

          {/* Cocktails Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map(cocktail => {
              const seasonData = seasons.find(s => s.name === cocktail.season);
              const SeasonIcon = seasonData?.icon || Sparkles;
              
              return (
                <Card 
                  key={cocktail.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white"
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
                            category: 'Seasonal Cocktails',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className={seasonData?.color}>
                        <SeasonIcon className="w-3 h-3 mr-1" />
                        {cocktail.season}
                      </Badge>
                      {cocktail.trending && (
                        <Badge className="bg-purple-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.featured && (
                        <Badge className="bg-amber-500">
                          <Star className="w-3 h-3 mr-1" />
                          Featured
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
                        {cocktail.temperature === 'Hot' && <Flame className="w-4 h-4 text-red-500" />}
                        {cocktail.temperature === 'Cold' && <Snowflake className="w-4 h-4 text-blue-500" />}
                        {cocktail.temperature === 'Frozen' && <Cloud className="w-4 h-4 text-cyan-500" />}
                        <span>{cocktail.temperature}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{cocktail.rating} ({cocktail.reviews})</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {cocktail.profile.slice(0, 3).map(trait => (
                        <Badge key={trait} variant="outline" className="text-xs">
                          {trait}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm font-medium text-purple-600">{cocktail.spirit}</span>
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
                      <p className="text-sm text-gray-500 mt-1">{selectedCocktail.occasion}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCocktail(null)}>×</Button>
                  </div>
                  <p className="text-gray-600">{selectedCocktail.description}</p>
                  <div className="flex gap-2 mt-2">
                    {(() => {
                      const seasonData = seasons.find(s => s.name === selectedCocktail.season);
                      const SeasonIcon = seasonData?.icon || Sparkles;
                      return (
                        <Badge className={seasonData?.color}>
                          <SeasonIcon className="w-3 h-3 mr-1" />
                          {selectedCocktail.season}
                        </Badge>
                      );
                    })()}
                    <Badge className="bg-purple-100 text-purple-700">{selectedCocktail.spirit}</Badge>
                    <Badge className="bg-blue-100 text-blue-700">{selectedCocktail.difficulty}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Nutrition & Stats */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-500" />
                        Cocktail Stats
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-orange-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Calories</div>
                          <div className="text-xl font-bold text-orange-600">{selectedCocktail.nutrition.calories}</div>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">ABV</div>
                          <div className="text-xl font-bold text-purple-600">{selectedCocktail.abv}</div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Temp</div>
                          <div className="text-xl font-bold text-blue-600">{selectedCocktail.temperature}</div>
                        </div>
                      </div>
                    </div>

                    {/* Glassware & Method */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <GlassWater className="w-5 h-5 text-blue-500" />
                        Preparation Details
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Glassware</div>
                          <div className="text-lg font-bold text-blue-600">{selectedCocktail.glassware}</div>
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
                        <Cherry className="w-5 h-5 text-red-500" />
                        Ingredients
                      </h3>
                      <div className="space-y-2">
                        {selectedCocktail.ingredients.map((ingredient, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <Plus className="w-4 h-4 text-purple-500" />
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
                        <Target className="w-5 h-5 text-purple-500" />
                        Instructions
                      </h3>
                      {selectedCocktail.method === 'Build' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Fill {selectedCocktail.glassware} with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Add ingredients in order listed</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Stir gently to combine</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Serve immediately and enjoy</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Shake' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add all ingredients to cocktail shaker</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Fill shaker with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Shake vigorously for 10-15 seconds</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Strain into {selectedCocktail.glassware}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Blend' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add all ingredients to blender</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Add ice (about 2 cups)</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Blend on high until smooth (30-60 seconds)</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Pour into {selectedCocktail.glassware}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Muddle' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add fresh ingredients to glass</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Muddle gently to release flavors and oils</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Add spirits and remaining ingredients</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Fill with ice and stir gently</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Simmer' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add wine and spices to pot</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Heat on medium-low, do not boil</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Simmer for 15-20 minutes to infuse flavors</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Strain into heat-safe mugs</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish and serve hot</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Shake & Top' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add spirits and citrus to shaker with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Shake well for 10-15 seconds</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Strain into ice-filled glass</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Top with club soda or tonic</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                        </ol>
                      )}
                    </div>

                    {/* Seasonal Tips */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-500" />
                        Seasonal Tips
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-700">
                        {selectedCocktail.season === 'Winter' && (
                          <>
                            <li>• Perfect for cold evenings and holiday gatherings</li>
                            <li>• Use warm mugs or heat-safe glassware</li>
                            <li>• Garnish with warming spices for aroma</li>
                          </>
                        )}
                        {selectedCocktail.season === 'Spring' && (
                          <>
                            <li>• Best with fresh seasonal flowers and herbs</li>
                            <li>• Light and refreshing for outdoor occasions</li>
                            <li>• Use edible flowers for garnish when available</li>
                          </>
                        )}
                        {selectedCocktail.season === 'Summer' && (
                          <>
                            <li>• Serve extra cold or frozen for maximum refreshment</li>
                            <li>• Make ahead and keep in cooler for parties</li>
                            <li>• Perfect for pool parties and BBQs</li>
                          </>
                        )}
                        {selectedCocktail.season === 'Fall' && (
                          <>
                            <li>• Incorporate seasonal spices and flavors</li>
                            <li>• Perfect for Thanksgiving and harvest celebrations</li>
                            <li>• Pair with autumn appetizers and desserts</li>
                          </>
                        )}
                        <li>• Always use fresh, seasonal ingredients when possible</li>
                        <li>• Adjust sweetness to taste preferences</li>
                      </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        onClick={() => handleMakeCocktail(selectedCocktail)}
                      >
                        <Wine className="w-4 h-4 mr-2" />
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
          <Card className="mt-12 bg-gradient-to-br from-blue-50 to-orange-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-500" />
                Seasonal Cocktail Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-6">
                {seasons.map(season => {
                  const Icon = season.icon;
                  return (
                    <div key={season.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-5 h-5 ${season.color.replace('bg-', 'text-')}`} />
                        <h3 className="font-semibold">{season.name}</h3>
                      </div>
                      <p className="text-sm text-gray-700">
                        {season.name === 'Winter' && 'Warm, spiced drinks perfect for cold weather. Think hot toddies, mulled wine, and cozy flavors.'}
                        {season.name === 'Spring' && 'Fresh, floral cocktails with herbs and light spirits. Garden-inspired and refreshing.'}
                        {season.name === 'Summer' && 'Cold, tropical drinks for hot days. Frozen, fruity, and perfect for outdoor entertaining.'}
                        {season.name === 'Fall' && 'Spiced, harvest-inspired cocktails with apple, pumpkin, and warming flavors.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Temperature Guide */}
          <Card className="mt-8 bg-white border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-orange-500" />
                Temperature & Serving Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <Flame className="w-6 h-6 text-red-500 mb-2" />
                  <div className="font-semibold text-red-600 mb-2">Hot Cocktails</div>
                  <div className="text-sm text-gray-700">Served 160-180°F in heat-safe glassware. Perfect for winter evenings.</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <Snowflake className="w-6 h-6 text-blue-500 mb-2" />
                  <div className="font-semibold text-blue-600 mb-2">Cold Cocktails</div>
                  <div className="text-sm text-gray-700">Served 35-45°F with ice. Most common serving temperature for cocktails.</div>
                </div>
                <div className="p-4 bg-cyan-50 rounded-lg">
                  <Cloud className="w-6 h-6 text-cyan-500 mb-2" />
                  <div className="font-semibold text-cyan-600 mb-2">Frozen Cocktails</div>
                  <div className="text-sm text-gray-700">Blended with ice to slushy consistency. Ultimate summer refreshment.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
