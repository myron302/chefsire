import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Wine, Clock, Heart, Star, Target, Sparkles, Flame, 
  Search, Share2, ArrowLeft, Plus, Camera, GlassWater,
  TrendingUp, Award, Crown, Leaf, Mountain, Droplets, Zap
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const whiskeyCocktails = [
  // BOURBON COCKTAILS
  {
    id: 'whiskey-1',
    name: 'Old Fashioned',
    description: 'The grandfather of cocktails - bourbon, sugar, bitters',
    whiskeyType: 'Bourbon',
    origin: 'Louisville, Kentucky',
    glassware: 'Rocks Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 155,
      carbs: 4,
      sugar: 3,
      alcohol: 14
    },
    ingredients: [
      'Bourbon (2 oz)',
      'Sugar Cube (1)',
      'Angostura Bitters (2-3 dashes)',
      'Orange Peel',
      'Maraschino Cherry',
      'Large Ice Cube'
    ],
    profile: ['Strong', 'Bitter-Sweet', 'Aromatic', 'Classic'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.9,
    reviews: 5234,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Bourbon Classics',
    garnish: 'Orange peel, cherry',
    method: 'Build & Muddle',
    abv: '30-35%',
    iba_official: true,
    era: '1880s'
  },
  {
    id: 'whiskey-2',
    name: 'Mint Julep',
    description: 'Kentucky Derby classic with bourbon and fresh mint',
    whiskeyType: 'Bourbon',
    origin: 'Southern United States',
    glassware: 'Julep Cup',
    servingSize: '8 oz',
    nutrition: {
      calories: 168,
      carbs: 12,
      sugar: 10,
      alcohol: 12
    },
    ingredients: [
      'Bourbon (2.5 oz)',
      'Fresh Mint Leaves (10-12)',
      'Simple Syrup (0.5 oz)',
      'Crushed Ice',
      'Mint Sprig',
      'Powdered Sugar (optional)'
    ],
    profile: ['Refreshing', 'Minty', 'Sweet', 'Southern'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 3876,
    trending: true,
    featured: true,
    estimatedCost: 3.75,
    bestTime: 'Afternoon',
    occasion: 'Derby Party',
    allergens: [],
    category: 'Bourbon Classics',
    garnish: 'Mint sprig, powdered sugar',
    method: 'Muddle',
    abv: '25-30%',
    iba_official: true,
    era: '1800s'
  },
  {
    id: 'whiskey-3',
    name: 'Boulevardier',
    description: 'Bourbon Negroni - bourbon, Campari, vermouth',
    whiskeyType: 'Bourbon',
    origin: 'Paris, France',
    glassware: 'Rocks Glass',
    servingSize: '3.5 oz',
    nutrition: {
      calories: 195,
      carbs: 6,
      sugar: 5,
      alcohol: 15
    },
    ingredients: [
      'Bourbon (1.5 oz)',
      'Campari (1 oz)',
      'Sweet Vermouth (1 oz)',
      'Orange Peel',
      'Large Ice Cube'
    ],
    profile: ['Bitter', 'Complex', 'Sophisticated', 'Aperitif'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2543,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Bourbon Modern',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '28-32%',
    iba_official: false,
    era: '1920s'
  },
  {
    id: 'whiskey-4',
    name: 'Whiskey Sour',
    description: 'Perfect balance of bourbon, lemon, and sweetness',
    whiskeyType: 'Bourbon',
    origin: 'United States',
    glassware: 'Rocks Glass',
    servingSize: '5 oz',
    nutrition: {
      calories: 175,
      carbs: 12,
      sugar: 10,
      alcohol: 13
    },
    ingredients: [
      'Bourbon (2 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Simple Syrup (0.75 oz)',
      'Egg White (optional)',
      'Angostura Bitters (2 dashes)',
      'Cherry & Orange Flag'
    ],
    profile: ['Sour', 'Sweet', 'Frothy', 'Classic'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 4321,
    trending: false,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: ['Egg'],
    category: 'Bourbon Classics',
    garnish: 'Cherry, orange flag',
    method: 'Dry Shake',
    abv: '20-25%',
    iba_official: true,
    era: '1862'
  },

  // RYE WHISKEY COCKTAILS
  {
    id: 'whiskey-5',
    name: 'Manhattan',
    description: 'New York classic with rye and sweet vermouth',
    whiskeyType: 'Rye',
    origin: 'New York City',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 165,
      carbs: 5,
      sugar: 4,
      alcohol: 16
    },
    ingredients: [
      'Rye Whiskey (2 oz)',
      'Sweet Vermouth (1 oz)',
      'Angostura Bitters (2 dashes)',
      'Maraschino Cherry',
      'Ice for stirring'
    ],
    profile: ['Sweet', 'Complex', 'Aromatic', 'Elegant'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 4567,
    trending: true,
    featured: true,
    estimatedCost: 4.75,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Rye Classics',
    garnish: 'Maraschino cherry',
    method: 'Stir',
    abv: '30-35%',
    iba_official: true,
    era: '1870s'
  },
  {
    id: 'whiskey-6',
    name: 'Sazerac',
    description: 'New Orleans classic with rye and absinthe rinse',
    whiskeyType: 'Rye',
    origin: 'New Orleans',
    glassware: 'Rocks Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 155,
      carbs: 3,
      sugar: 2,
      alcohol: 17
    },
    ingredients: [
      'Rye Whiskey (2 oz)',
      'Simple Syrup (0.25 oz)',
      'Peychaud\'s Bitters (3 dashes)',
      'Absinthe (rinse)',
      'Lemon Peel',
      'Ice for stirring'
    ],
    profile: ['Strong', 'Herbaceous', 'Complex', 'Anise'],
    difficulty: 'Hard',
    prepTime: 6,
    rating: 4.7,
    reviews: 2876,
    trending: false,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Rye Classics',
    garnish: 'Lemon peel',
    method: 'Stir',
    abv: '32-36%',
    iba_official: true,
    era: '1850s'
  },
  {
    id: 'whiskey-7',
    name: 'Vieux Carré',
    description: 'French Quarter cocktail with rye, cognac, and vermouth',
    whiskeyType: 'Rye',
    origin: 'New Orleans',
    glassware: 'Rocks Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 185,
      carbs: 4,
      sugar: 3,
      alcohol: 16
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
    profile: ['Complex', 'Rich', 'Herbaceous', 'Sophisticated'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.6,
    reviews: 1987,
    trending: false,
    featured: false,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Rye Modern',
    garnish: 'Lemon peel',
    method: 'Stir',
    abv: '30-35%',
    iba_official: true,
    era: '1930s'
  },

  // SCOTCH COCKTAILS
  {
    id: 'whiskey-8',
    name: 'Penicillin',
    description: 'Modern classic with blended scotch, honey, and ginger',
    whiskeyType: 'Scotch',
    origin: 'New York City',
    glassware: 'Rocks Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 175,
      carbs: 14,
      sugar: 12,
      alcohol: 13
    },
    ingredients: [
      'Blended Scotch (2 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Honey-Ginger Syrup (0.75 oz)',
      'Islay Scotch (0.25 oz float)',
      'Candied Ginger',
      'Ice'
    ],
    profile: ['Smoky', 'Sweet', 'Spicy', 'Medicinal'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.9,
    reviews: 3654,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Contemporary',
    allergens: [],
    category: 'Scotch Modern',
    garnish: 'Candied ginger',
    method: 'Shake',
    abv: '22-26%',
    iba_official: false,
    era: '2005'
  },
  {
    id: 'whiskey-9',
    name: 'Blood and Sand',
    description: 'Prohibition-era scotch with cherry and vermouth',
    whiskeyType: 'Scotch',
    origin: 'United Kingdom',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 185,
      carbs: 12,
      sugar: 10,
      alcohol: 14
    },
    ingredients: [
      'Blended Scotch (0.75 oz)',
      'Cherry Heering (0.75 oz)',
      'Sweet Vermouth (0.75 oz)',
      'Fresh Orange Juice (0.75 oz)',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Fruity', 'Complex', 'Balanced', 'Vintage'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 2134,
    trending: false,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Scotch Classics',
    garnish: 'Orange peel',
    method: 'Shake',
    abv: '20-24%',
    iba_official: true,
    era: '1920s'
  },
  {
    id: 'whiskey-10',
    name: 'Rob Roy',
    description: 'Scottish Manhattan with scotch and vermouth',
    whiskeyType: 'Scotch',
    origin: 'Scotland',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 170,
      carbs: 5,
      sugar: 4,
      alcohol: 16
    },
    ingredients: [
      'Blended Scotch (2 oz)',
      'Sweet Vermouth (1 oz)',
      'Angostura Bitters (2 dashes)',
      'Maraschino Cherry',
      'Ice for stirring'
    ],
    profile: ['Smooth', 'Sweet', 'Aromatic', 'Classic'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2543,
    trending: false,
    featured: false,
    estimatedCost: 4.75,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Scotch Classics',
    garnish: 'Maraschino cherry',
    method: 'Stir',
    abv: '30-35%',
    iba_official: false,
    era: '1890s'
  },

  // IRISH WHISKEY COCKTAILS
  {
    id: 'whiskey-11',
    name: 'Irish Coffee',
    description: 'Hot coffee with Irish whiskey and cream',
    whiskeyType: 'Irish',
    origin: 'Ireland',
    glassware: 'Irish Coffee Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 210,
      carbs: 18,
      sugar: 15,
      alcohol: 10
    },
    ingredients: [
      'Irish Whiskey (1.5 oz)',
      'Hot Coffee (6 oz)',
      'Brown Sugar (2 tsp)',
      'Heavy Cream (lightly whipped)',
      'Coffee Beans (garnish)'
    ],
    profile: ['Warm', 'Sweet', 'Coffee', 'Creamy'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 4123,
    trending: true,
    featured: true,
    estimatedCost: 4.25,
    bestTime: 'Morning',
    occasion: 'Brunch',
    allergens: ['Dairy'],
    category: 'Irish Classics',
    garnish: 'Coffee beans',
    method: 'Build',
    abv: '12-15%',
    iba_official: true,
    era: '1940s'
  },
  {
    id: 'whiskey-12',
    name: 'Irish Mule',
    description: 'Irish whiskey with ginger beer and lime',
    whiskeyType: 'Irish',
    origin: 'United States',
    glassware: 'Copper Mug',
    servingSize: '10 oz',
    nutrition: {
      calories: 180,
      carbs: 16,
      sugar: 14,
      alcohol: 11
    },
    ingredients: [
      'Irish Whiskey (2 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Ginger Beer (6 oz)',
      'Lime Wedge',
      'Mint Sprig',
      'Ice'
    ],
    profile: ['Spicy', 'Citrus', 'Refreshing', 'Smooth'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 2987,
    trending: true,
    featured: false,
    estimatedCost: 3.75,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: [],
    category: 'Irish Modern',
    garnish: 'Lime wedge, mint',
    method: 'Build',
    abv: '15-18%',
    iba_official: false,
    era: '2000s'
  }
];

const whiskeyTypes = [
  { 
    id: 'all', 
    name: 'All Whiskeys', 
    icon: Wine,
    color: 'bg-amber-500',
    description: 'Every whiskey style'
  },
  { 
    id: 'bourbon', 
    name: 'Bourbon', 
    icon: Flame,
    color: 'bg-orange-500',
    description: 'Kentucky straight bourbon'
  },
  { 
    id: 'rye', 
    name: 'Rye', 
    icon: Leaf,
    color: 'bg-red-500',
    description: 'Spicy rye whiskey'
  },
  { 
    id: 'scotch', 
    name: 'Scotch', 
    icon: Mountain,
    color: 'bg-slate-500',
    description: 'Scottish whisky'
  },
  { 
    id: 'irish', 
    name: 'Irish', 
    icon: Droplets,
    color: 'bg-green-500',
    description: 'Smooth Irish whiskey'
  }
];

export default function WhiskeyBourbonPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedType, setSelectedType] = useState('all');
  const [selectedStyle, setSelectedStyle] = useState('All Styles');
  const [sortBy, setSortBy] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCocktail, setSelectedCocktail] = useState<typeof whiskeyCocktails[0] | null>(null);
  const [alcoholRange, setAlcoholRange] = useState([0, 40]);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyIBA, setOnlyIBA] = useState(false);

  const filteredCocktails = whiskeyCocktails.filter(cocktail => {
    if (selectedType !== 'all' && cocktail.whiskeyType.toLowerCase() !== selectedType) {
      return false;
    }
    if (selectedStyle !== 'All Styles') {
      if (selectedStyle === 'Classic' && !cocktail.category.includes('Classics')) return false;
      if (selectedStyle === 'Modern' && !cocktail.category.includes('Modern')) return false;
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

  const handleCocktailClick = (cocktail: typeof whiskeyCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'Whiskey & Bourbon',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof whiskeyCocktails[0]) => {
    incrementDrinksMade();
    addPoints(40, 'Made a whiskey cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        {/* Universal Search */}
        <div className="bg-white border-b border-amber-100 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <UniversalSearch />
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-orange-700 to-red-700 text-white py-8">
          <div className="max-w-7xl mx-auto px-4">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Potent Potables
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <Wine className="w-10 h-10" />
                  Whiskey & Bourbon Cocktails
                </h1>
                <p className="text-amber-100 text-lg">From Kentucky bourbon to Scottish single malts</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{filteredCocktails.length}</div>
                <div className="text-amber-100">Recipes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Whiskey Type Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {whiskeyTypes.map(type => {
              const Icon = type.icon;
              const typeCocktails = whiskeyCocktails.filter(c => 
                type.id === 'all' || c.whiskeyType.toLowerCase() === type.id
              );
              
              return (
                <Card 
                  key={type.id}
                  className={`cursor-pointer transition-all ${
                    selectedType === type.id ? 'ring-2 ring-amber-500 ring-offset-2' : ''
                  }`}
                  onClick={() => setSelectedType(type.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`inline-flex p-3 ${type.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-full mb-3`}>
                      <Icon className={`w-6 h-6 ${type.color.replace('bg-', 'text-')}`} />
                    </div>
                    <h3 className="font-bold mb-1">{type.name}</h3>
                    <p className="text-xs text-gray-600 mb-2">{type.description}</p>
                    <div className="text-2xl font-bold text-gray-900">{typeCocktails.length}</div>
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
                  placeholder="Search whiskey cocktails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select 
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              <option value="All Styles">All Styles</option>
              <option value="Classic">Classic</option>
              <option value="Modern">Modern</option>
            </select>
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
            <Card className="mb-6 bg-white border-amber-200">
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
              const typeData = whiskeyTypes.find(t => t.id === cocktail.whiskeyType.toLowerCase());
              const TypeIcon = typeData?.icon || Wine;
              
              return (
                <Card 
                  key={cocktail.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-amber-100 hover:border-amber-300"
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
                            category: 'Whiskey & Bourbon',
                            timestamp: Date.now()
                          });
                        }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge className={typeData?.color}>
                        <TypeIcon className="w-3 h-3 mr-1" />
                        {cocktail.whiskeyType}
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
                        <Crown className="w-4 h-4 text-amber-500" />
                        <span>{cocktail.era}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span>{cocktail.prepTime} min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span>{cocktail.abv} ABV</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{cocktail.rating} ({cocktail.reviews})</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {cocktail.profile.slice(0, 3).map(trait => (
                        <Badge key={trait} variant="outline" className="text-xs border-amber-300">
                          {trait}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm font-medium text-amber-600">{cocktail.method}</span>
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
                    {(() => {
                      const typeData = whiskeyTypes.find(t => t.id === selectedCocktail.whiskeyType.toLowerCase());
                      return (
                        <Badge className={typeData?.color}>
                          {selectedCocktail.whiskeyType}
                        </Badge>
                      );
                    })()}
                    <Badge className="bg-orange-100 text-orange-700">{selectedCocktail.difficulty}</Badge>
                    {selectedCocktail.iba_official && (
                      <Badge className="bg-blue-100 text-blue-700">IBA Official</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Cocktail Stats */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-amber-500" />
                        Cocktail Stats
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-amber-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Calories</div>
                          <div className="text-xl font-bold text-amber-600">{selectedCocktail.nutrition.calories}</div>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">ABV</div>
                          <div className="text-xl font-bold text-orange-600">{selectedCocktail.abv}</div>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Era</div>
                          <div className="text-lg font-bold text-red-600">{selectedCocktail.era}</div>
                        </div>
                      </div>
                    </div>

                    {/* Preparation Details */}
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
                            <Plus className="w-4 h-4 text-amber-500" />
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
                        <Target className="w-5 h-5 text-amber-500" />
                        Instructions
                      </h3>
                      {selectedCocktail.method.includes('Stir') && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add all ingredients to mixing glass with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Stir gently for 30-40 seconds until well chilled</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Strain into {selectedCocktail.glassware}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Serve immediately and enjoy</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Shake' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add all ingredients to cocktail shaker</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Fill shaker with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Shake vigorously for 10-15 seconds</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Double strain into {selectedCocktail.glassware}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method.includes('Muddle') && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add sugar and bitters to glass</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Muddle until sugar dissolves</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Add whiskey and large ice cube</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Stir gently to combine</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Express orange peel and garnish</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Build' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Warm {selectedCocktail.glassware} with hot water</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Add sugar and coffee to glass</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Stir to dissolve sugar completely</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Add whiskey and stir</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Float cream on top and garnish</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Dry Shake' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add all ingredients WITHOUT ice (dry shake)</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Shake vigorously for 15 seconds to emulsify egg white</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Add ice and shake again for 10 seconds</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Double strain into {selectedCocktail.glassware}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish and add bitters on foam if desired</span>
                          </li>
                        </ol>
                      )}
                    </div>

                    {/* Historical Note */}
                    <div className="bg-amber-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Crown className="w-5 h-5 text-amber-500" />
                        Historical Note
                      </h3>
                      <p className="text-sm text-gray-700">
                        The {selectedCocktail.name} originated in {selectedCocktail.origin} during the {selectedCocktail.era}. 
                        This {selectedCocktail.whiskeyType.toLowerCase()}-based cocktail represents the rich heritage of 
                        American and international cocktail culture.
                      </p>
                    </div>

                    {/* Pro Tips */}
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-orange-500" />
                        Pro Tips
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li>• Use premium {selectedCocktail.whiskeyType.toLowerCase()} - quality matters in whiskey cocktails</li>
                        <li>• Large ice cubes melt slower and dilute less</li>
                        <li>• Express citrus oils over the drink before garnishing</li>
                        <li>• Room temperature whiskey releases more flavor</li>
                        <li>• Fresh ingredients make all the difference</li>
                      </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
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
          <Card className="mt-12 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-amber-500" />
                Understanding Whiskey Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <Flame className="w-8 h-8 text-orange-500 mb-2" />
                  <h3 className="font-semibold mb-2 text-orange-600">Bourbon</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Made in USA with at least 51% corn. Sweet, full-bodied with notes of vanilla, 
                    caramel, and oak. Perfect for Old Fashioneds and Mint Juleps.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Buffalo Trace, Maker's Mark, Woodford Reserve</p>
                </div>
                <div>
                  <Leaf className="w-8 h-8 text-red-500 mb-2" />
                  <h3 className="font-semibold mb-2 text-red-600">Rye Whiskey</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Made with at least 51% rye grain. Spicy, dry, with peppery notes. 
                    Traditional choice for Manhattans and Sazeracs.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Bulleit Rye, Rittenhouse, High West</p>
                </div>
                <div>
                  <Mountain className="w-8 h-8 text-slate-500 mb-2" />
                  <h3 className="font-semibold mb-2 text-slate-600">Scotch Whisky</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Made in Scotland from malted barley. Range from light/floral to heavily 
                    peated/smoky. Excellent for Penicillins and Rob Roys.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Glenlivet, Laphroaig, Johnnie Walker</p>
                </div>
                <div>
                  <Droplets className="w-8 h-8 text-green-500 mb-2" />
                  <h3 className="font-semibold mb-2 text-green-600">Irish Whiskey</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Triple-distilled for smoothness. Light, approachable, with notes of honey 
                    and grain. Perfect for Irish Coffee and simple mixed drinks.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Jameson, Bushmills, Redbreast</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mixing Techniques */}
          <Card className="mt-8 bg-white border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-6 h-6 text-amber-500" />
                Whiskey Cocktail Techniques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-amber-600">Stirring Spirit-Forward Drinks</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    For Manhattans and Old Fashioneds, stir gently for 30-40 seconds. 
                    This chills and dilutes without aerating, maintaining silky texture.
                  </p>
                  <p className="text-xs text-gray-500 italic">Key: Gentle, controlled motion</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-orange-600">Muddling for Flavor</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    For Mint Juleps and sugar-based drinks, muddle gently to release oils 
                    and dissolve sugar. Don't pulverize - you want essence, not bits.
                  </p>
                  <p className="text-xs text-gray-500 italic">Key: Gentle pressure, circular motion</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-red-600">The Perfect Ice</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Large format ice (2" cubes or spheres) melts slowly, preventing over-dilution 
                    in whiskey cocktails. Essential for Old Fashioneds.
                  </p>
                  <p className="text-xs text-gray-500 italic">Key: Bigger is better</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Glassware Guide */}
          <Card className="mt-8 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GlassWater className="w-6 h-6 text-orange-500" />
                Essential Whiskey Glassware
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-lg">
                  <div className="font-semibold text-amber-600 mb-2">Rocks Glass</div>
                  <div className="text-sm text-gray-700">Short tumbler for Old Fashioneds, Sazeracs, and neat pours. Fits large ice cubes perfectly.</div>
                </div>
                <div className="p-4 bg-white rounded-lg">
                  <div className="font-semibold text-orange-600 mb-2">Coupe Glass</div>
                  <div className="text-sm text-gray-700">Elegant stemware for Manhattans and stirred whiskey cocktails. Shows off clarity.</div>
                </div>
                <div className="p-4 bg-white rounded-lg">
                  <div className="font-semibold text-red-600 mb-2">Julep Cup</div>
                  <div className="text-sm text-gray-700">Traditional silver cup for Mint Juleps. Metal frosts beautifully when filled with crushed ice.</div>
                </div>
                <div className="p-4 bg-white rounded-lg">
                  <div className="font-semibold text-green-600 mb-2">Irish Coffee Glass</div>
                  <div className="text-sm text-gray-700">Heat-safe footed glass for Irish Coffee. Shows off layered cream topping.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
