import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Martini, Clock, Heart, Star, Target, Sparkles, Wine, 
  Search, Share2, ArrowLeft, Plus, Camera, Flame, GlassWater,
  TrendingUp, Award, Zap, Crown, Coffee, Cherry, Leaf
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const martinis = [
  // CLASSIC MARTINIS
  {
    id: 'martini-1',
    name: 'Classic Gin Martini',
    description: 'The original - gin and dry vermouth, stirred to perfection',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop',
    baseSpirit: 'Gin',
    style: 'Classic',
    glassware: 'Martini Glass',
    servingSize: '3.5 oz',
    nutrition: {
      calories: 175,
      carbs: 0,
      sugar: 0,
      alcohol: 18
    },
    ingredients: [
      'London Dry Gin (2.5 oz)',
      'Dry Vermouth (0.5 oz)',
      'Ice for stirring',
      'Lemon Twist or Olives'
    ],
    profile: ['Dry', 'Botanical', 'Strong', 'Elegant'],
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.9,
    reviews: 4567,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Martinis',
    garnish: 'Lemon twist or olives',
    method: 'Stir',
    abv: '35-40%',
    iba_official: true,
    ratio: '5:1 (Gin:Vermouth)',
    temperature: 'Very Cold'
  },
  {
    id: 'martini-2',
    name: 'Vodka Martini',
    description: 'Smooth and clean with vodka instead of gin',
    baseSpirit: 'Vodka',
    style: 'Classic',
    glassware: 'Martini Glass',
    servingSize: '3.5 oz',
    nutrition: {
      calories: 170,
      carbs: 0,
      sugar: 0,
      alcohol: 18
    },
    ingredients: [
      'Premium Vodka (2.5 oz)',
      'Dry Vermouth (0.5 oz)',
      'Ice for stirring',
      'Lemon Twist or Olives'
    ],
    profile: ['Clean', 'Smooth', 'Strong', 'Crisp'],
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.7,
    reviews: 3892,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Martinis',
    garnish: 'Lemon twist or olives',
    method: 'Stir',
    abv: '35-40%',
    iba_official: false,
    ratio: '5:1 (Vodka:Vermouth)',
    temperature: 'Very Cold'
  },
  {
    id: 'martini-3',
    name: 'Dirty Martini',
    description: 'Classic martini with olive brine for savory depth',
    baseSpirit: 'Gin',
    style: 'Classic',
    glassware: 'Martini Glass',
    servingSize: '3.5 oz',
    nutrition: {
      calories: 180,
      carbs: 1,
      sugar: 0,
      alcohol: 17
    },
    ingredients: [
      'Gin or Vodka (2.5 oz)',
      'Dry Vermouth (0.5 oz)',
      'Olive Brine (0.5 oz)',
      'Ice for stirring',
      'Olives (3)'
    ],
    profile: ['Savory', 'Briny', 'Strong', 'Bold'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 3124,
    trending: false,
    featured: true,
    estimatedCost: 4.75,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Martinis',
    garnish: 'Olives (3)',
    method: 'Stir',
    abv: '30-35%',
    iba_official: false,
    ratio: '5:1:1',
    temperature: 'Very Cold'
  },
  {
    id: 'martini-4',
    name: 'Dry Martini',
    description: 'Extra dry with minimal vermouth - for purists',
    baseSpirit: 'Gin',
    style: 'Classic',
    glassware: 'Martini Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 165,
      carbs: 0,
      sugar: 0,
      alcohol: 19
    },
    ingredients: [
      'London Dry Gin (2.75 oz)',
      'Dry Vermouth (0.25 oz or less)',
      'Ice for stirring',
      'Lemon Twist'
    ],
    profile: ['Very Dry', 'Gin-Forward', 'Strong', 'Clean'],
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.5,
    reviews: 2341,
    trending: false,
    featured: false,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Martinis',
    garnish: 'Lemon twist',
    method: 'Stir',
    abv: '38-42%',
    iba_official: false,
    ratio: '10:1 or 15:1',
    temperature: 'Very Cold'
  },

  // MODERN/FLAVORED MARTINIS
  {
    id: 'martini-5',
    name: 'Espresso Martini',
    description: 'Coffee-forward dessert martini with vodka',
    baseSpirit: 'Vodka',
    style: 'Modern',
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
    profile: ['Coffee', 'Sweet', 'Creamy', 'Energizing'],
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
    category: 'Modern Martinis',
    garnish: '3 coffee beans',
    method: 'Shake',
    abv: '20-25%',
    iba_official: true,
    ratio: '2:1:1',
    temperature: 'Cold'
  },
  {
    id: 'martini-6',
    name: 'Pornstar Martini',
    description: 'Passion fruit vodka martini with prosecco side',
    baseSpirit: 'Vodka',
    style: 'Modern',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 215,
      carbs: 16,
      sugar: 14,
      alcohol: 13
    },
    ingredients: [
      'Vanilla Vodka (2 oz)',
      'Passion Fruit Liqueur (0.75 oz)',
      'Passion Fruit Purée (0.5 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Simple Syrup (0.25 oz)',
      'Prosecco (shot on side)',
      'Passion Fruit Half'
    ],
    profile: ['Fruity', 'Tropical', 'Sweet', 'Fun'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 4123,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Martinis',
    garnish: 'Passion fruit half',
    method: 'Shake',
    abv: '18-22%',
    iba_official: true,
    ratio: 'Complex',
    temperature: 'Cold'
  },
  {
    id: 'martini-7',
    name: 'Lychee Martini',
    description: 'Sweet and floral Asian-inspired martini',
    baseSpirit: 'Vodka',
    style: 'Modern',
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
      'Lychee Liqueur (1 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Lychee Syrup (0.5 oz)',
      'Ice',
      'Lychee Fruit'
    ],
    profile: ['Floral', 'Sweet', 'Exotic', 'Delicate'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2876,
    trending: false,
    featured: true,
    estimatedCost: 4.75,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Martinis',
    garnish: 'Lychee fruit',
    method: 'Shake',
    abv: '20-25%',
    iba_official: false,
    ratio: '2:1',
    temperature: 'Cold'
  },
  {
    id: 'martini-8',
    name: 'Apple Martini (Appletini)',
    description: 'Bright green apple flavored vodka martini',
    baseSpirit: 'Vodka',
    style: 'Modern',
    glassware: 'Martini Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 15,
      sugar: 13,
      alcohol: 13
    },
    ingredients: [
      'Vodka (2 oz)',
      'Apple Liqueur (1 oz)',
      'Apple Juice (0.5 oz)',
      'Fresh Lemon Juice (0.5 oz)',
      'Ice',
      'Apple Slice'
    ],
    profile: ['Fruity', 'Sweet', 'Tart', 'Fun'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 3421,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Martinis',
    garnish: 'Apple slice',
    method: 'Shake',
    abv: '20-25%',
    iba_official: false,
    ratio: '2:1',
    temperature: 'Cold'
  },

  // CONTEMPORARY/CRAFT MARTINIS
  {
    id: 'martini-9',
    name: 'Smoky Martini',
    description: 'Mezcal-infused modern twist on classic',
    baseSpirit: 'Gin',
    style: 'Contemporary',
    glassware: 'Martini Glass',
    servingSize: '3.5 oz',
    nutrition: {
      calories: 180,
      carbs: 1,
      sugar: 0,
      alcohol: 17
    },
    ingredients: [
      'Gin (2 oz)',
      'Mezcal (0.5 oz)',
      'Dry Vermouth (0.5 oz)',
      'Orange Bitters (2 dashes)',
      'Ice',
      'Lemon Twist'
    ],
    profile: ['Smoky', 'Complex', 'Herbal', 'Bold'],
    difficulty: 'Medium',
    prepTime: 4,
    rating: 4.7,
    reviews: 1987,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Contemporary Martinis',
    garnish: 'Lemon twist',
    method: 'Stir',
    abv: '32-35%',
    iba_official: false,
    ratio: '4:1:1',
    temperature: 'Very Cold'
  },
  {
    id: 'martini-10',
    name: 'Gibson',
    description: 'Gin martini garnished with cocktail onions',
    baseSpirit: 'Gin',
    style: 'Classic',
    glassware: 'Martini Glass',
    servingSize: '3.5 oz',
    nutrition: {
      calories: 175,
      carbs: 1,
      sugar: 0,
      alcohol: 18
    },
    ingredients: [
      'London Dry Gin (2.5 oz)',
      'Dry Vermouth (0.5 oz)',
      'Ice for stirring',
      'Cocktail Onions (2-3)'
    ],
    profile: ['Dry', 'Savory', 'Strong', 'Classic'],
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.5,
    reviews: 1654,
    trending: false,
    featured: false,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Martinis',
    garnish: 'Cocktail onions',
    method: 'Stir',
    abv: '35-40%',
    iba_official: false,
    ratio: '5:1',
    temperature: 'Very Cold'
  },
  {
    id: 'martini-11',
    name: 'French Martini',
    description: 'Vodka with pineapple and Chambord',
    baseSpirit: 'Vodka',
    style: 'Modern',
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
    reviews: 2543,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Martinis',
    garnish: 'Pineapple wedge',
    method: 'Shake',
    abv: '18-22%',
    iba_official: true,
    ratio: '4:1:3',
    temperature: 'Cold'
  },
  {
    id: 'martini-12',
    name: 'Vesper Martini',
    description: 'James Bond\'s preferred martini with gin, vodka, and Lillet',
    baseSpirit: 'Gin',
    style: 'Classic',
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
    reviews: 3124,
    trending: true,
    featured: true,
    estimatedCost: 5.75,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Martinis',
    garnish: 'Lemon peel',
    method: 'Shake',
    abv: '35-40%',
    iba_official: true,
    ratio: '6:2:1',
    temperature: 'Very Cold'
  }
];

const martiniCategories = [
  { 
    id: 'all', 
    name: 'All Martinis', 
    icon: Martini,
    description: 'Every martini variation'
  },
  { 
    id: 'classic', 
    name: 'Classic', 
    icon: Crown,
    description: 'Traditional gin & vodka martinis'
  },
  { 
    id: 'modern', 
    name: 'Modern', 
    icon: Sparkles,
    description: 'Flavored & contemporary'
  },
  { 
    id: 'contemporary', 
    name: 'Contemporary', 
    icon: Zap,
    description: 'Craft & innovative'
  }
];

const spirits = ['All Spirits', 'Gin', 'Vodka', 'Mixed'];
const methods = ['All Methods', 'Stir', 'Shake'];

export default function MartinisPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSpirit, setSelectedSpirit] = useState('All Spirits');
  const [selectedMethod, setSelectedMethod] = useState('All Methods');
  const [sortBy, setSortBy] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMartini, setSelectedMartini] = useState<typeof martinis[0] | null>(null);
  const [alcoholRange, setAlcoholRange] = useState([0, 45]);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyIBA, setOnlyIBA] = useState(false);

  const filteredMartinis = martinis.filter(martini => {
    if (selectedCategory !== 'all' && martini.style.toLowerCase() !== selectedCategory) {
      return false;
    }
    if (selectedSpirit !== 'All Spirits' && martini.baseSpirit !== selectedSpirit) {
      return false;
    }
    if (selectedMethod !== 'All Methods' && martini.method !== selectedMethod) {
      return false;
    }
    const abvNum = parseInt(martini.abv);
    if (abvNum < alcoholRange[0] || abvNum > alcoholRange[1]) {
      return false;
    }
    if (searchQuery && !martini.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (onlyIBA && !martini.iba_official) {
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

  const handleMartiniClick = (martini: typeof martinis[0]) => {
    setSelectedMartini(martini);
    addToRecentlyViewed({
      id: martini.id,
      name: martini.name,
      category: 'Martinis',
      timestamp: Date.now()
    });
  };

  const handleMakeMartini = (martini: typeof martinis[0]) => {
    incrementDrinksMade();
    addPoints(35, 'Made a martini');
    setSelectedMartini(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50">
        {/* Universal Search */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <UniversalSearch />
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 via-gray-700 to-zinc-700 text-white py-8">
          <div className="max-w-7xl mx-auto px-4">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Potent Potables
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <Martini className="w-10 h-10" />
                  Martinis
                </h1>
                <p className="text-gray-200 text-lg">The most iconic cocktail in endless variations</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{filteredMartinis.length}</div>
                <div className="text-gray-200">Recipes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <Card className="bg-white border-slate-200">
              <CardContent className="p-4 text-center">
                <Crown className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-amber-600">4</div>
                <div className="text-sm text-gray-600">Classic Styles</div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4 text-center">
                <Sparkles className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-600">6</div>
                <div className="text-sm text-gray-600">Modern Flavors</div>
              </CardContent>
            </Card>
            <Card className="bg-white border-zinc-200">
              <CardContent className="p-4 text-center">
                <Award className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">50%</div>
                <div className="text-sm text-gray-600">IBA Official</div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200">
              <CardContent className="p-4 text-center">
                <Flame className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-600">~30%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
          </div>

          {/* Categories */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {martiniCategories.map(category => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className={selectedCategory === category.id ? "bg-slate-700 hover:bg-slate-800" : "hover:bg-slate-50"}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {category.name}
                </Button>
              );
            })}
          </div>

          {/* Filters and Sort */}
          <div className="flex gap-4 mb-6 items-center flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search martinis..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select 
              value={selectedSpirit}
              onChange={(e) => setSelectedSpirit(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              {spirits.map(spirit => (
                <option key={spirit} value={spirit}>{spirit}</option>
              ))}
            </select>
            <select 
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              {methods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
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
            <Card className="mb-6 bg-white border-slate-200">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Alcohol Content: {alcoholRange[0]}-{alcoholRange[1]}% ABV
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="45"
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
                      IBA Official Martinis Only
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Martinis Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMartinis.map(martini => (
              <Card 
                key={martini.id} 
                className="hover:shadow-lg transition-all cursor-pointer bg-white border-slate-100 hover:border-slate-300"
                onClick={() => handleMartiniClick(martini)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-lg">{martini.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToFavorites({
                          id: martini.id,
                          name: martini.name,
                          category: 'Martinis',
                          timestamp: Date.now()
                        });
                      }}
                    >
                      <Heart className={`w-4 h-4 ${isFavorite(martini.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Badge className="bg-slate-100 text-slate-700">
                      {martini.style}
                    </Badge>
                    {martini.trending && (
                      <Badge className="bg-purple-500">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Trending
                      </Badge>
                    )}
                    {martini.featured && (
                      <Badge className="bg-amber-500">
                       <GlassWater className="fill-cyan-500 text-cyan-500" />
                        Featured
                      </Badge>
                    )}
                    {martini.iba_official && (
                      <Badge className="bg-blue-500">
                        <Award className="w-3 h-3 mr-1" />
                        IBA
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">{martini.description}</p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Wine className="w-4 h-4 text-slate-500" />
                      <span>{martini.baseSpirit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>{martini.prepTime} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span>{martini.abv} ABV</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span>{martini.rating} ({martini.reviews})</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {martini.profile.slice(0, 3).map(trait => (
                      <Badge key={trait} variant="outline" className="text-xs border-slate-300">
                        {trait}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-sm font-medium text-slate-600">{martini.method}</span>
                    <span className="text-sm text-gray-500">${martini.estimatedCost.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Martini Detail Modal */}
          {selectedMartini && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedMartini(null)}>
              <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{selectedMartini.name}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">{selectedMartini.ratio} Ratio</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMartini(null)}>×</Button>
                  </div>
                  <p className="text-gray-600">{selectedMartini.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge className="bg-slate-100 text-slate-700">{selectedMartini.style}</Badge>
                    <Badge className="bg-purple-100 text-purple-700">{selectedMartini.baseSpirit}</Badge>
                    <Badge className="bg-blue-100 text-blue-700">{selectedMartini.difficulty}</Badge>
                    {selectedMartini.iba_official && (
                      <Badge className="bg-amber-100 text-amber-700">IBA Official</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Martini Stats */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-slate-500" />
                        Martini Stats
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Calories</div>
                          <div className="text-xl font-bold text-slate-600">{selectedMartini.nutrition.calories}</div>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">ABV</div>
                          <div className="text-xl font-bold text-orange-600">{selectedMartini.abv}</div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Temp</div>
                          <div className="text-xl font-bold text-blue-600">{selectedMartini.temperature}</div>
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
                          <div className="text-sm font-bold text-blue-600">{selectedMartini.glassware}</div>
                        </div>
                        <div className="p-3 bg-cyan-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Method</div>
                          <div className="text-lg font-bold text-cyan-600">{selectedMartini.method}</div>
                        </div>
                        <div className="p-3 bg-teal-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">Prep Time</div>
                          <div className="text-lg font-bold text-teal-600">{selectedMartini.prepTime} min</div>
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
                        {selectedMartini.ingredients.map((ingredient, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <Plus className="w-4 h-4 text-slate-500" />
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
                        {selectedMartini.profile.map(trait => (
                          <Badge key={trait} className="bg-yellow-100 text-yellow-700 border-yellow-300">
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Instructions */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-slate-500" />
                        Instructions
                      </h3>
                      {selectedMartini.method === 'Stir' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Chill martini glass in freezer for at least 10 minutes</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Add spirits and vermouth to mixing glass with ice</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Stir gently for 30-40 seconds until well chilled</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Strain into chilled martini glass</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Garnish with {selectedMartini.garnish} and serve immediately</span>
                          </li>
                        </ol>
                      )}
                      {selectedMartini.method === 'Shake' && (
                        <ol className="space-y-3">
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            <span className="text-sm">Chill martini glass in freezer for at least 10 minutes</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            <span className="text-sm">Add all ingredients to cocktail shaker</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            <span className="text-sm">Fill shaker with ice cubes</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            <span className="text-sm">Shake vigorously for 10-15 seconds</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            <span className="text-sm">Double strain into chilled glass</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold">6</span>
                            <span className="text-sm">Garnish with {selectedMartini.garnish}</span>
                          </li>
                        </ol>
                      )}
                    </div>

                    {/* Pro Tips */}
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-slate-500" />
                        Pro Tips
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li>• The colder the martini, the better - always use frozen glassware</li>
                        <li>• Use premium spirits - there's nowhere to hide in a martini</li>
                        <li>• Stir, don't shake (except for martinis with juice/dairy)</li>
                        <li>• Fresh vermouth is key - it oxidizes quickly once opened</li>
                        <li>• Express citrus oils over the drink before garnishing</li>
                        <li>• Serve immediately - martinis warm up fast</li>
                      </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-gradient-to-r from-slate-600 to-gray-600 hover:from-slate-700 hover:to-gray-700"
                        onClick={() => handleMakeMartini(selectedMartini)}
                      >
                        <Martini className="w-4 h-4 mr-2" />
                        Make This Martini
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
          <Card className="mt-12 bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-amber-500" />
                The Art of the Martini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Martini className="w-5 h-5 text-slate-500" />
                    The Perfect Ratio
                  </h3>
                  <p className="text-sm text-gray-700">
                    The classic martini ratio is 5:1 or 6:1 (gin to vermouth). A "dry" martini uses less vermouth, 
                    while "wet" uses more. Some prefer 15:1 or even just a vermouth rinse. Find your perfect ratio.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-500" />
                    Shaken vs Stirred
                  </h3>
                  <p className="text-sm text-gray-700">
                    Traditional martinis are stirred to maintain clarity and silky texture. Shaking aerates the drink 
                    and creates tiny ice shards. James Bond popularized shaken, but most bartenders prefer stirred.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    Temperature Matters
                  </h3>
                  <p className="text-sm text-gray-700">
                    A martini should be served as cold as possible - around 28-30°F. Pre-chill your glass, 
                    use fresh ice, and serve immediately. The drink will warm quickly in your hand.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Martini Styles Guide */}
          <Card className="mt-8 bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wine className="w-6 h-6 text-slate-500" />
                Martini Style Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="font-semibold text-slate-600 mb-2">Classic</div>
                  <div className="text-sm text-gray-700">Traditional gin or vodka with dry vermouth. Stirred, elegant, timeless.</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="font-semibold text-purple-600 mb-2">Modern</div>
                  <div className="text-sm text-gray-700">Flavored variations with liqueurs, fruit juices, and creative garnishes.</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="font-semibold text-blue-600 mb-2">Dirty</div>
                  <div className="text-sm text-gray-700">Classic martini with olive brine for savory, briny character.</div>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <div className="font-semibold text-amber-600 mb-2">Contemporary</div>
                  <div className="text-sm text-gray-700">Craft variations using mezcal, aged spirits, and innovative techniques.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Garnish Guide */}
          <Card className="mt-8 bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cherry className="w-6 h-6 text-red-500" />
                Classic Martini Garnishes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-gray-700">Lemon Twist</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Cut a coin-sized piece of lemon peel. Express oils over drink by twisting, 
                    then rim the glass and drop in or discard.
                  </p>
                  <p className="text-xs text-gray-500 italic">Best for: Dry gin martinis</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-gray-700">Olives</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Use 1-3 high-quality olives on a pick. Castelvetrano, Cerignola, or classic 
                    Spanish olives work well. Never use canned black olives.
                  </p>
                  <p className="text-xs text-gray-500 italic">Best for: Vodka and dirty martinis</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-gray-700">Cocktail Onions</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Traditionally used in a Gibson martini. Small pearl onions pickled in vermouth. 
                    Usually 2-3 on a pick.
                  </p>
                  <p className="text-xs text-gray-500 italic">Best for: Gibson variation</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Spirit Selection Guide */}
          <Card className="mt-8 bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-6 h-6 text-slate-500" />
                Choosing Your Base Spirit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-slate-600">Gin Martinis</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    London Dry gin is traditional - botanical, juniper-forward, and crisp. Plymouth gin 
                    is softer and earthier. New Western gins offer unique botanical profiles.
                  </p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>• <span className="font-medium">Classic:</span> Tanqueray, Beefeater, Bombay Sapphire</p>
                    <p>• <span className="font-medium">Premium:</span> Hendrick's, Monkey 47, The Botanist</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-slate-600">Vodka Martinis</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Premium vodka is essential - clean, smooth, and neutral. Potato vodka tends to be 
                    creamier, while grain vodka is crisper. Avoid flavored vodkas for classic martinis.
                  </p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>• <span className="font-medium">Classic:</span> Ketel One, Grey Goose, Belvedere</p>
                    <p>• <span className="font-medium">Premium:</span> Chopin, Reyka, Stolichnaya Elit</p>
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
