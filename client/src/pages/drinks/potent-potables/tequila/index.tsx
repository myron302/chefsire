import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Sun, Clock, Heart, Star, Target, Sparkles, Wine, 
  Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater,
  TrendingUp, Award, Cherry, Leaf, Zap, Crown, Apple
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const tequilaCocktails = [
  // CLASSIC TEQUILA COCKTAILS
  {
    id: 'tequila-1',
    name: 'Classic Margarita',
    description: 'The iconic tequila cocktail - lime, tequila, triple sec',
    tequilaType: 'Blanco',
    origin: 'Mexico',
    glassware: 'Margarita Glass',
    servingSize: '6 oz',
    nutrition: {
      calories: 185,
      carbs: 8,
      sugar: 6,
      alcohol: 15
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Triple Sec (1 oz)',
      'Fresh Lime Juice (1 oz)',
      'Salt (for rim)',
      'Lime Wheel',
      'Ice'
    ],
    profile: ['Tangy', 'Sweet', 'Citrus', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 6234,
    trending: true,
    featured: true,
    estimatedCost: 4.25,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Classic Margaritas',
    garnish: 'Salt rim, lime wheel',
    method: 'Shake',
    abv: '25-30%',
    iba_official: true,
    era: '1930s-1940s'
  },
  {
    id: 'tequila-2',
    name: 'Paloma',
    description: 'Mexico\'s favorite - tequila with grapefruit soda',
    tequilaType: 'Blanco',
    origin: 'Mexico',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 195,
      carbs: 18,
      sugar: 16,
      alcohol: 11
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Grapefruit Juice (2 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Grapefruit Soda (4 oz)',
      'Salt (for rim)',
      'Grapefruit Wedge',
      'Ice'
    ],
    profile: ['Citrus', 'Bitter-Sweet', 'Refreshing', 'Effervescent'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 4892,
    trending: true,
    featured: true,
    estimatedCost: 3.75,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Salt rim, grapefruit wedge',
    method: 'Build',
    abv: '15-18%',
    iba_official: false,
    era: '1950s'
  },
  {
    id: 'tequila-3',
    name: 'Tequila Sunrise',
    description: 'Beautiful gradient cocktail with orange and grenadine',
    tequilaType: 'Blanco',
    origin: 'Tijuana, Mexico',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 210,
      carbs: 24,
      sugar: 22,
      alcohol: 10
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Orange Juice (6 oz)',
      'Grenadine (0.5 oz)',
      'Orange Slice',
      'Maraschino Cherry',
      'Ice'
    ],
    profile: ['Fruity', 'Sweet', 'Beautiful', 'Tropical'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 3654,
    trending: false,
    featured: true,
    estimatedCost: 3.25,
    bestTime: 'Brunch',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Orange slice, cherry',
    method: 'Build & Layer',
    abv: '12-15%',
    iba_official: true,
    era: '1970s'
  },
  {
    id: 'tequila-4',
    name: 'Tommy\'s Margarita',
    description: 'Simplified margarita with agave nectar',
    tequilaType: 'Blanco',
    origin: 'San Francisco',
    glassware: 'Rocks Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 165,
      carbs: 10,
      sugar: 8,
      alcohol: 14
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Lime Juice (1 oz)',
      'Agave Nectar (0.5 oz)',
      'Salt (optional rim)',
      'Lime Wheel',
      'Ice'
    ],
    profile: ['Pure', 'Tart', 'Agave-Forward', 'Clean'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 2987,
    trending: true,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Margaritas',
    garnish: 'Lime wheel',
    method: 'Shake',
    abv: '25-28%',
    iba_official: false,
    era: '1990s'
  },

  // MODERN TEQUILA COCKTAILS
  {
    id: 'tequila-5',
    name: 'Spicy Jalapeño Margarita',
    description: 'Margarita with fresh jalapeño kick',
    tequilaType: 'Blanco',
    origin: 'United States',
    glassware: 'Rocks Glass',
    servingSize: '6 oz',
    nutrition: {
      calories: 190,
      carbs: 9,
      sugar: 7,
      alcohol: 15
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Jalapeño (3 slices)',
      'Fresh Lime Juice (1 oz)',
      'Triple Sec (0.75 oz)',
      'Agave Nectar (0.5 oz)',
      'Chili Salt (rim)',
      'Jalapeño Slice',
      'Ice'
    ],
    profile: ['Spicy', 'Tangy', 'Bold', 'Complex'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 3421,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Margaritas',
    garnish: 'Chili salt rim, jalapeño',
    method: 'Muddle & Shake',
    abv: '24-28%',
    iba_official: false,
    era: '2000s'
  },
  {
    id: 'tequila-6',
    name: 'Frozen Strawberry Margarita',
    description: 'Blended margarita with fresh strawberries',
    tequilaType: 'Blanco',
    origin: 'United States',
    glassware: 'Margarita Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 225,
      carbs: 22,
      sugar: 18,
      alcohol: 12
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Strawberries (1 cup)',
      'Fresh Lime Juice (1 oz)',
      'Triple Sec (0.5 oz)',
      'Agave Nectar (0.5 oz)',
      'Ice (2 cups)',
      'Strawberry (garnish)'
    ],
    profile: ['Fruity', 'Sweet', 'Frozen', 'Fun'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 4123,
    trending: true,
    featured: false,
    estimatedCost: 4.25,
    bestTime: 'Afternoon',
    occasion: 'Party',
    allergens: [],
    category: 'Frozen Margaritas',
    garnish: 'Strawberry, lime wheel',
    method: 'Blend',
    abv: '18-22%',
    iba_official: false,
    era: '1970s'
  },
  {
    id: 'tequila-7',
    name: 'Mezcal Margarita',
    description: 'Smoky variation with mezcal',
    tequilaType: 'Mezcal',
    origin: 'Oaxaca, Mexico',
    glassware: 'Rocks Glass',
    servingSize: '6 oz',
    nutrition: {
      calories: 180,
      carbs: 8,
      sugar: 6,
      alcohol: 15
    },
    ingredients: [
      'Mezcal (2 oz)',
      'Fresh Lime Juice (1 oz)',
      'Triple Sec (0.75 oz)',
      'Agave Nectar (0.25 oz)',
      'Salt (rim)',
      'Lime Wheel',
      'Ice'
    ],
    profile: ['Smoky', 'Complex', 'Earthy', 'Bold'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 2543,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Margaritas',
    garnish: 'Salt rim, lime wheel',
    method: 'Shake',
    abv: '25-30%',
    iba_official: false,
    era: '2010s'
  },
  {
    id: 'tequila-8',
    name: 'Tequila Old Fashioned',
    description: 'Classic Old Fashioned reimagined with reposado',
    tequilaType: 'Reposado',
    origin: 'United States',
    glassware: 'Rocks Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 155,
      carbs: 4,
      sugar: 3,
      alcohol: 14
    },
    ingredients: [
      'Reposado Tequila (2 oz)',
      'Agave Nectar (1 tsp)',
      'Angostura Bitters (2 dashes)',
      'Orange Bitters (1 dash)',
      'Orange Peel',
      'Large Ice Cube'
    ],
    profile: ['Oak', 'Agave', 'Bitter-Sweet', 'Sophisticated'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.7,
    reviews: 1987,
    trending: false,
    featured: true,
    estimatedCost: 4.75,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Contemporary Tequila',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '28-32%',
    iba_official: false,
    era: '2000s'
  },

  // PREMIUM/AGED TEQUILA COCKTAILS
  {
    id: 'tequila-9',
    name: 'Añejo Manhattan',
    description: 'Manhattan with aged tequila instead of whiskey',
    tequilaType: 'Añejo',
    origin: 'United States',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 170,
      carbs: 5,
      sugar: 4,
      alcohol: 16
    },
    ingredients: [
      'Añejo Tequila (2 oz)',
      'Sweet Vermouth (1 oz)',
      'Angostura Bitters (2 dashes)',
      'Orange Bitters (1 dash)',
      'Maraschino Cherry',
      'Ice for stirring'
    ],
    profile: ['Complex', 'Oak', 'Sweet', 'Elegant'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1654,
    trending: false,
    featured: false,
    estimatedCost: 5.75,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Contemporary Tequila',
    garnish: 'Maraschino cherry',
    method: 'Stir',
    abv: '30-34%',
    iba_official: false,
    era: '2010s'
  },
  {
    id: 'tequila-10',
    name: 'Ranch Water',
    description: 'Texas favorite - tequila, lime, Topo Chico',
    tequilaType: 'Blanco',
    origin: 'West Texas',
    glassware: 'Highball',
    servingSize: '12 oz',
    nutrition: {
      calories: 125,
      carbs: 3,
      sugar: 2,
      alcohol: 11
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Topo Chico or Sparkling Water (8 oz)',
      'Lime Wedges',
      'Ice'
    ],
    profile: ['Crisp', 'Light', 'Refreshing', 'Simple'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 2876,
    trending: true,
    featured: false,
    estimatedCost: 3.25,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Contemporary Tequila',
    garnish: 'Lime wedges',
    method: 'Build',
    abv: '14-16%',
    iba_official: false,
    era: '2010s'
  },
  {
    id: 'tequila-11',
    name: 'El Diablo',
    description: 'Tequila with ginger beer and cassis',
    tequilaType: 'Blanco',
    origin: 'United States',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 195,
      carbs: 18,
      sugar: 15,
      alcohol: 11
    },
    ingredients: [
      'Blanco Tequila (1.5 oz)',
      'Crème de Cassis (0.5 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Ginger Beer (5 oz)',
      'Lime Wheel',
      'Ice'
    ],
    profile: ['Spicy', 'Fruity', 'Complex', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2134,
    trending: false,
    featured: true,
    estimatedCost: 4.25,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Lime wheel',
    method: 'Build',
    abv: '14-18%',
    iba_official: false,
    era: '1940s'
  },
  {
    id: 'tequila-12',
    name: 'Batanga',
    description: 'Mexican highball with tequila and Coca-Cola',
    tequilaType: 'Blanco',
    origin: 'Tequila, Mexico',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 215,
      carbs: 28,
      sugar: 26,
      alcohol: 10
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Coca-Cola (6 oz)',
      'Salt (rim)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Sweet', 'Fizzy', 'Simple', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 1987,
    trending: false,
    featured: false,
    estimatedCost: 2.75,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Salt rim, lime wedge',
    method: 'Build',
    abv: '12-14%',
    iba_official: false,
    era: '1961'
  }
];

const tequilaTypes = [
  { 
    id: 'all', 
    name: 'All Types', 
    icon: Sun,
    color: 'bg-yellow-500',
    description: 'Every tequila style'
  },
  { 
    id: 'blanco', 
    name: 'Blanco', 
    icon: Sparkles,
    color: 'bg-cyan-500',
    description: 'Unaged, pure agave'
  },
  { 
    id: 'reposado', 
    name: 'Reposado', 
    icon: Leaf,
    color: 'bg-amber-500',
    description: 'Aged 2-12 months'
  },
  { 
    id: 'añejo', 
    name: 'Añejo', 
    icon: Crown,
    color: 'bg-orange-600',
    description: 'Aged 1-3 years'
  },
  { 
    id: 'mezcal', 
    name: 'Mezcal', 
    icon: Flame,
    color: 'bg-slate-600',
    description: 'Smoky agave spirit'
  }
];

export default function TequilaCocktailsPage() {
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
  const [selectedCocktail, setSelectedCocktail] = useState<typeof tequilaCocktails[0] | null>(null);
  const [alcoholRange, setAlcoholRange] = useState([0, 35]);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyIBA, setOnlyIBA] = useState(false);

  const filteredCocktails = tequilaCocktails.filter(cocktail => {
    if (selectedType !== 'all' && cocktail.tequilaType.toLowerCase() !== selectedType) {
      return false;
    }
    if (selectedStyle !== 'All Styles') {
      if (selectedStyle === 'Margaritas' && !cocktail.category.includes('Margaritas')) return false;
      if (selectedStyle === 'Classic' && !cocktail.category.includes('Classic')) return false;
      if (selectedStyle === 'Contemporary' && !cocktail.category.includes('Contemporary')) return false;
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

  const handleCocktailClick = (cocktail: typeof tequilaCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'Tequila Cocktails',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof tequilaCocktails[0]) => {
    incrementDrinksMade();
    addPoints(35, 'Made a tequila cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50">
        {/* Universal Search */}
        <div className="bg-white border-b border-yellow-100 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <UniversalSearch />
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 text-white py-8">
          <div className="max-w-7xl mx-auto px-4">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Potent Potables
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <Sun className="w-10 h-10" />
                  Tequila & Mezcal Cocktails
                </h1>
                <p className="text-yellow-100 text-lg">From classic margaritas to smoky mezcal creations</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{filteredCocktails.length}</div>
                <div className="text-yellow-100">Recipes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Tequila Type Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {tequilaTypes.map(type => {
              const Icon = type.icon;
              const typeCocktails = tequilaCocktails.filter(c => 
                type.id === 'all' || c.tequilaType.toLowerCase() === type.id
              );
              
              return (
                <Card 
                  key={type.id}
                  className={`cursor-pointer transition-all ${
                    selectedType === type.id ? 'ring-2 ring-yellow-500 ring-offset-2' : ''
                  }`}
                  onClick={() => setSelectedType(type.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`inline-flex p-3 ${type.color.replace('bg-', 'bg-').replace('-500', '-100').replace('-600', '-100')} rounded-full mb-3`}>
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
                  placeholder="Search tequila cocktails..."
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
              <option value="Margaritas">Margaritas</option>
              <option value="Classic">Classic</option>
              <option value="Contemporary">Contemporary</option>
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
            <Card className="mb-6 bg-white border-yellow-200">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Alcohol Content: {alcoholRange[0]}-{alcoholRange[1]}% ABV
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="35"
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
              const typeData = tequilaTypes.find(t => t.id === cocktail.tequilaType.toLowerCase());
              const TypeIcon = typeData?.icon || Sun;
              
              return (
                <Card 
                  key={cocktail.id} 
                  className="hover:shadow-lg transition-all cursor-pointer bg-white border-yellow-100 hover:border-yellow-300"
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
                            category: 'Tequila Cocktails',
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
                        {cocktail.tequilaType}
                      </Badge>
                      {cocktail.trending && (
                        <Badge className="bg-purple-500">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                      {cocktail.featured && (
                        <Badge className="bg-yellow-500">
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
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span>{cocktail.nutrition.calories} cal</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span>{cocktail.prepTime} min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-yellow-500" />
                        <span>{cocktail.abv} ABV</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{cocktail.rating} ({cocktail.reviews})</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {cocktail.profile.slice(0, 3).map(trait => (
                        <Badge key={trait} variant="outline" className="text-xs border-yellow-300">
                          {trait}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm font-medium text-yellow-600">{cocktail.method}</span>
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
                    <Badge className="bg-yellow-100 text-yellow-700">{selectedCocktail.tequilaType}</Badge>
                    <Badge className="bg-orange-100 text-orange-700">{selectedCocktail.difficulty}</Badge>
                    {selectedCocktail.iba_official && (
                      <Badge className="bg-blue-100 text-blue-700">IBA Official</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Stats */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-yellow-500" />
                        Cocktail Stats
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-yellow-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Calories</div>
                          <div className="text-xl font-bold text-yellow-600">{selectedCocktail.nutrition.calories}</div>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">ABV</div>
                          <div className="text-xl font-bold text-orange-600">{selectedCocktail.abv}</div>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Sugar</div>
                          <div className="text-xl font-bold text-red-600">{selectedCocktail.nutrition.sugar}g</div>
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
                          <div className="text-sm font-bold text-cyan-600">{selectedCocktail.method}</div>
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
                            <Plus className="w-4 h-4 text-yellow-500" />
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
                        <Target className="w-5 h-5 text-yellow-500" />
                        Instructions
                      </h3>
                      {selectedCocktail.method === 'Shake' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add all ingredients to cocktail shaker</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Fill shaker with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Shake vigorously for 10-15 seconds</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Strain into {selectedCocktail.glassware}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Build' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Fill {selectedCocktail.glassware} with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Add tequila and other liquid ingredients</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Stir gently to combine</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Top with any carbonated ingredients</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish and serve immediately</span>
                          </li>
                        </ol>
                      )}
                      {selectedCocktail.method === 'Blend' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Add all ingredients to blender</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Add ice (about 2 cups)</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Blend on high until smooth (30-60 seconds)</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Pour into {selectedCocktail.glassware}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                        </ol>
                      )}
                      {(selectedCocktail.method === 'Build & Layer' || selectedCocktail.method === 'Muddle & Shake' || selectedCocktail.method === 'Stir') && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Prepare ingredients and glassware</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Follow method: {selectedCocktail.method}</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Add ingredients in proper order</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Mix or layer as specified</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish with {selectedCocktail.garnish}</span>
                          </li>
                        </ol>
                      )}
                    </div>

                    {/* Pro Tips */}
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-500" />
                        Pro Tips
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li>• Use 100% agave tequila for best quality and flavor</li>
                        <li>• Fresh lime juice is essential - never use bottled</li>
                        <li>• Salt or chili salt rim adds complexity and balance</li>
                        <li>• Blanco for margaritas, reposado for sipping cocktails</li>
                        <li>• Mezcal adds smoky depth to any tequila cocktail</li>
                      </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700"
                        onClick={() => handleMakeCocktail(selectedCocktail)}
                      >
                        <Sun className="w-4 h-4 mr-2" />
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
          <Card className="mt-12 bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="w-6 h-6 text-yellow-500" />
                Understanding Tequila & Mezcal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-6">
                <div>
                  <Sparkles className="w-8 h-8 text-cyan-500 mb-2" />
                  <h3 className="font-semibold mb-2 text-cyan-600">Blanco (Silver)</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Unaged or aged less than 2 months. Pure agave flavor, crisp and bright. 
                    Perfect for margaritas and fresh cocktails.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Patrón Silver, Espolòn Blanco</p>
                </div>
                <div>
                  <Leaf className="w-8 h-8 text-amber-500 mb-2" />
                  <h3 className="font-semibold mb-2 text-amber-600">Reposado (Rested)</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Aged 2-12 months in oak barrels. Smooth with vanilla and caramel notes. 
                    Great for sipping and sophisticated cocktails.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Herradura Reposado, Don Julio</p>
                </div>
                <div>
                  <Crown className="w-8 h-8 text-orange-600 mb-2" />
                  <h3 className="font-semibold mb-2 text-orange-600">Añejo (Aged)</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Aged 1-3 years. Complex with oak, spice, and dried fruit. 
                    Best for sipping or whiskey-style cocktails.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Patrón Añejo, Casa Noble</p>
                </div>
                <div>
                  <Flame className="w-8 h-8 text-slate-600 mb-2" />
                  <h3 className="font-semibold mb-2 text-slate-600">Mezcal</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Smoky agave spirit from Oaxaca. Roasted in underground pits. 
                    Adds earthy, smoky complexity to cocktails.
                  </p>
                  <p className="text-xs text-gray-500 italic">Examples: Del Maguey, Vida, Montelobos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Margarita Guide */}
          <Card className="mt-8 bg-white border-yellow-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-6 h-6 text-yellow-500" />
                The Perfect Margarita
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-yellow-600">The Golden Ratio</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    The classic margarita ratio is 2:1:1 (tequila:lime:orange liqueur). 
                    This creates perfect balance between spirit, acid, and sweetness.
                  </p>
                  <p className="text-xs text-gray-500 italic">Adjust sweetness to taste</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-orange-600">Fresh is Essential</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Always use fresh lime juice - never bottled or sour mix. 
                    The difference is night and day. Squeeze just before making.
                  </p>
                  <p className="text-xs text-gray-500 italic">One lime = ~1 oz juice</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-red-600">Salt Rim Technique</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Run lime wedge around half the rim only. Dip in coarse salt. 
                    This lets drinkers choose salt or no salt with each sip.
                  </p>
                  <p className="text-xs text-gray-500 italic">Use coarse sea salt or kosher salt</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cocktail Categories */}
          <Card className="mt-8 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wine className="w-6 h-6 text-orange-500" />
                Tequila Cocktail Styles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-lg border border-yellow-200">
                  <div className="font-semibold text-yellow-600 mb-2">Classic Margaritas</div>
                  <div className="text-sm text-gray-700">Traditional lime-based margaritas in various styles and flavors.</div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-orange-200">
                  <div className="font-semibold text-orange-600 mb-2">Frozen Margaritas</div>
                  <div className="text-sm text-gray-700">Blended cocktails perfect for hot weather and parties.</div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-red-200">
                  <div className="font-semibold text-red-600 mb-2">Classic Tequila</div>
                  <div className="text-sm text-gray-700">Traditional Mexican cocktails like Paloma and Batanga.</div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-slate-200">
                  <div className="font-semibold text-slate-600 mb-2">Contemporary</div>
                  <div className="text-sm text-gray-700">Modern creations with mezcal and aged tequilas.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
