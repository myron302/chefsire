import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Martini, Clock, Heart, Star, Target, Sparkles, Leaf, Wine,
  Search, Share2, ArrowLeft, Plus, Zap, Cherry, Camera, Flame,
  GlassWater, Award, TrendingUp, Crown, Home, Droplets, Apple
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const mocktails = [
  {
    id: 'mocktail-1',
    name: 'Virgin Mojito',
    description: 'Classic Cuban refreshment with mint and lime',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop',
    drinkStyle: 'Refreshing',
    glassware: 'Highball',
    servingSize: '12 oz',
    nutrition: {
      calories: 95,
      carbs: 24,
      sugar: 22,
      sodium: 5
    },
    ingredients: [
      'Fresh Mint Leaves (10-12)',
      'Lime (1 whole, cut in wedges)',
      'White Sugar (2 tsp)',
      'Club Soda (8 oz)',
      'Crushed Ice',
      'Lime Wheel (garnish)'
    ],
    benefits: ['Refreshing', 'Digestive Aid', 'Cooling', 'Low Calorie'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.8,
    reviews: 2345,
    trending: true,
    featured: true,
    estimatedCost: 2.50,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Mocktails',
    garnish: 'Lime wheel, mint sprig',
    method: 'Muddle'
  },
  {
    id: 'mocktail-2',
    name: 'Shirley Temple',
    description: 'Sweet and bubbly with grenadine and cherry',
    image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop',
    drinkStyle: 'Sweet',
    glassware: 'Collins',
    servingSize: '10 oz',
    nutrition: {
      calories: 120,
      carbs: 30,
      sugar: 28,
      sodium: 8
    },
    ingredients: [
      'Ginger Ale (8 oz)',
      'Grenadine (1 oz)',
      'Fresh Lime Juice (1/2 oz)',
      'Ice Cubes',
      'Maraschino Cherries (2)',
      'Orange Slice (garnish)'
    ],
    benefits: ['Fun & Festive', 'Kid-Friendly', 'Party Classic', 'Bubbly'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1876,
    trending: false,
    featured: true,
    estimatedCost: 2.00,
    bestTime: 'Anytime',
    occasion: 'Party',
    allergens: [],
    category: 'Classic Mocktails',
    garnish: 'Cherry, orange slice',
    method: 'Build'
  },
  {
    id: 'mocktail-3',
    name: 'Cucumber Cooler',
    description: 'Crisp cucumber with elderflower and lime',
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop',
    drinkStyle: 'Refreshing',
    glassware: 'Coupe',
    servingSize: '8 oz',
    nutrition: {
      calories: 65,
      carbs: 16,
      sugar: 14,
      sodium: 3
    },
    ingredients: [
      'Fresh Cucumber (1/4 sliced)',
      'Elderflower Cordial (1 oz)',
      'Fresh Lime Juice (1 oz)',
      'Tonic Water (4 oz)',
      'Fresh Basil (3 leaves)',
      'Ice'
    ],
    benefits: ['Hydrating', 'Sophisticated', 'Low Calorie', 'Refreshing'],
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.7,
    reviews: 1234,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Brunch',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Mocktails',
    garnish: 'Cucumber ribbon, basil',
    method: 'Shake'
  },
  {
    id: 'mocktail-4',
    name: 'Tropical Sunrise',
    description: 'Pineapple and orange with grenadine gradient',
    image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&h=300&fit=crop',
    drinkStyle: 'Fruity',
    glassware: 'Hurricane',
    servingSize: '12 oz',
    nutrition: {
      calories: 140,
      carbs: 35,
      sugar: 32,
      vitamin_c: 80
    },
    ingredients: [
      'Pineapple Juice (4 oz)',
      'Orange Juice (4 oz)',
      'Grenadine (1 oz)',
      'Fresh Pineapple (2 chunks)',
      'Ice',
      'Cherry (garnish)'
    ],
    benefits: ['Vitamin C', 'Energizing', 'Tropical', 'Party Favorite'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 2156,
    trending: true,
    featured: false,
    estimatedCost: 2.75,
    bestTime: 'Brunch',
    occasion: 'Party',
    allergens: [],
    category: 'Tropical Mocktails',
    garnish: 'Pineapple wedge, cherry',
    method: 'Layer'
  },
  {
    id: 'mocktail-5',
    name: 'Lavender Lemonade Fizz',
    description: 'Floral lavender with tart lemon and bubbles',
    image: 'https://images.unsplash.com/photo-1544145945-35c2d99f5f96?w=400&h=300&fit=crop',
    drinkStyle: 'Floral',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 85,
      carbs: 22,
      sugar: 20,
      sodium: 6
    },
    ingredients: [
      'Lavender Syrup (1 oz)',
      'Fresh Lemon Juice (1.5 oz)',
      'Club Soda (6 oz)',
      'Fresh Lavender (sprig)',
      'Lemon Wheel',
      'Ice'
    ],
    benefits: ['Calming', 'Aromatic', 'Elegant', 'Stress Relief'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.5,
    reviews: 987,
    trending: false,
    featured: true,
    estimatedCost: 3.25,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Floral Mocktails',
    garnish: 'Lavender sprig, lemon wheel',
    method: 'Build'
  },
  {
    id: 'mocktail-6',
    name: 'Watermelon Mint Smash',
    description: 'Fresh watermelon muddled with mint',
    image: 'https://images.unsplash.com/photo-1587223962930-cb7f31384c19?w=400&h=300&fit=crop',
    drinkStyle: 'Refreshing',
    glassware: 'Rocks',
    servingSize: '10 oz',
    nutrition: {
      calories: 75,
      carbs: 19,
      sugar: 17,
      lycopene: 'High'
    },
    ingredients: [
      'Fresh Watermelon (2 cups cubed)',
      'Fresh Mint (8 leaves)',
      'Fresh Lime Juice (1 oz)',
      'Simple Syrup (0.5 oz)',
      'Club Soda (2 oz)',
      'Ice'
    ],
    benefits: ['Hydrating', 'Summer Perfect', 'Antioxidants', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 1654,
    trending: true,
    featured: false,
    estimatedCost: 2.50,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Fruity Mocktails',
    garnish: 'Watermelon triangle, mint',
    method: 'Muddle'
  },
  {
    id: 'mocktail-7',
    name: 'Ginger Spice Mule',
    description: 'Spicy ginger beer with lime - Moscow Mule style',
    image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&h=300&fit=crop',
    drinkStyle: 'Spicy',
    glassware: 'Copper Mug',
    servingSize: '10 oz',
    nutrition: {
      calories: 110,
      carbs: 28,
      sugar: 26,
      ginger: 'High'
    },
    ingredients: [
      'Ginger Beer (8 oz)',
      'Fresh Lime Juice (1 oz)',
      'Fresh Ginger (2 slices)',
      'Lime Wedges (2)',
      'Mint Sprig',
      'Ice'
    ],
    benefits: ['Digestive Aid', 'Anti-inflammatory', 'Warming', 'Energizing'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1432,
    trending: false,
    featured: true,
    estimatedCost: 2.25,
    bestTime: 'Evening',
    occasion: 'Casual',
    allergens: [],
    category: 'Spiced Mocktails',
    garnish: 'Lime wheel, mint, ginger',
    method: 'Build'
  },
  {
    id: 'mocktail-8',
    name: 'Berry Basil Smash',
    description: 'Mixed berries muddled with fresh basil',
    image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop',
    drinkStyle: 'Fruity',
    glassware: 'Rocks',
    servingSize: '8 oz',
    nutrition: {
      calories: 90,
      carbs: 23,
      sugar: 20,
      antioxidants: 'Very High'
    },
    ingredients: [
      'Mixed Berries (1/2 cup)',
      'Fresh Basil (5 leaves)',
      'Fresh Lemon Juice (1 oz)',
      'Simple Syrup (0.75 oz)',
      'Club Soda (3 oz)',
      'Ice'
    ],
    benefits: ['Antioxidants', 'Heart Health', 'Aromatic', 'Refreshing'],
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.8,
    reviews: 1789,
    trending: true,
    featured: true,
    estimatedCost: 3.75,
    bestTime: 'Brunch',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Berry Mocktails',
    garnish: 'Berry skewer, basil leaf',
    method: 'Muddle'
  },
  {
    id: 'mocktail-9',
    name: 'Pomegranate Sparkler',
    description: 'Tart pomegranate with sparkling wine alternative',
    image: 'https://images.unsplash.com/photo-1587223962930-cb7f31384c19?w=400&h=300&fit=crop',
    drinkStyle: 'Sophisticated',
    glassware: 'Champagne Flute',
    servingSize: '8 oz',
    nutrition: {
      calories: 95,
      carbs: 24,
      sugar: 22,
      antioxidants: 'High'
    },
    ingredients: [
      'Pomegranate Juice (2 oz)',
      'Sparkling White Grape Juice (5 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Pomegranate Seeds (2 tbsp)',
      'Rosemary Sprig',
      'Ice (optional)'
    ],
    benefits: ['Antioxidants', 'Elegant', 'Heart Health', 'Celebration'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 1345,
    trending: false,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Evening',
    occasion: 'Celebration',
    allergens: [],
    category: 'Sparkling Mocktails',
    garnish: 'Pomegranate seeds, rosemary',
    method: 'Build'
  },
  {
    id: 'mocktail-10',
    name: 'Mango Chili Margarita',
    description: 'Sweet mango with a spicy chili rim',
    image: 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=400&h=300&fit=crop',
    drinkStyle: 'Spicy',
    glassware: 'Margarita',
    servingSize: '10 oz',
    nutrition: {
      calories: 125,
      carbs: 31,
      sugar: 28,
      vitamin_a: 'High'
    },
    ingredients: [
      'Fresh Mango (1 cup)',
      'Fresh Lime Juice (1.5 oz)',
      'Agave Nectar (1 oz)',
      'Chili Powder (rim)',
      'Salt (rim)',
      'Lime Sparkling Water (2 oz)',
      'Ice'
    ],
    benefits: ['Vitamin A', 'Spicy Kick', 'Tropical', 'Party Favorite'],
    difficulty: 'Medium',
    prepTime: 7,
    rating: 4.9,
    reviews: 2234,
    trending: true,
    featured: true,
    estimatedCost: 3.25,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Margarita Style',
    garnish: 'Chili-salt rim, lime wheel',
    method: 'Blend'
  },
  {
    id: 'mocktail-11',
    name: 'Pineapple Cilantro Refresher',
    description: 'Sweet pineapple with savory cilantro twist',
    image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&h=300&fit=crop',
    drinkStyle: 'Refreshing',
    glassware: 'Highball',
    servingSize: '10 oz',
    nutrition: {
      calories: 105,
      carbs: 27,
      sugar: 24,
      vitamin_c: 'High'
    },
    ingredients: [
      'Fresh Pineapple (1 cup)',
      'Fresh Cilantro (1/4 cup)',
      'Fresh Lime Juice (1 oz)',
      'Coconut Water (3 oz)',
      'Agave (0.5 oz)',
      'Ice'
    ],
    benefits: ['Digestive Enzymes', 'Hydrating', 'Unique Flavor', 'Tropical'],
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.4,
    reviews: 876,
    trending: false,
    featured: false,
    estimatedCost: 3.00,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Tropical Mocktails',
    garnish: 'Pineapple wedge, cilantro',
    method: 'Blend'
  },
  {
    id: 'mocktail-12',
    name: 'Espresso Martini (Mocktail)',
    description: 'Coffee-forward with vanilla and cream',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop',
    drinkStyle: 'Rich',
    glassware: 'Martini',
    servingSize: '6 oz',
    nutrition: {
      calories: 135,
      carbs: 22,
      sugar: 18,
      caffeine: '60mg'
    },
    ingredients: [
      'Cold Brew Coffee (2 oz)',
      'Vanilla Syrup (1 oz)',
      'Heavy Cream (1 oz)',
      'Simple Syrup (0.5 oz)',
      'Ice',
      'Coffee Beans (3 for garnish)'
    ],
    benefits: ['Energy Boost', 'Dessert Alternative', 'Sophisticated', 'Coffee Lover'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 1567,
    trending: true,
    featured: true,
    estimatedCost: 2.75,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: ['Dairy'],
    category: 'Coffee Mocktails',
    garnish: '3 coffee beans',
    method: 'Shake'
  }
];

const mocktailCategories = [
  { id: 'all', name: 'All Mocktails', icon: Martini },
  { id: 'classic', name: 'Classic', icon: Star },
  { id: 'modern', name: 'Modern', icon: Sparkles },
  { id: 'tropical', name: 'Tropical', icon: Cherry },
  { id: 'berry', name: 'Berry', icon: Heart },
  { id: 'sparkling', name: 'Sparkling', icon: Wine },
  { id: 'spiced', name: 'Spiced', icon: Flame },
  { id: 'coffee', name: 'Coffee', icon: Target }
];

const occasions = [
  'All Occasions',
  'Casual',
  'Party',
  'Sophisticated',
  'Celebration',
  'Brunch'
];

// SISTER PAGES
const sisterPotentPotablesPages = [
  { id: 'vodka', name: 'Vodka', path: '/drinks/potent-potables/vodka', icon: Droplets, description: 'Clean & versatile' },
  { id: 'whiskey', name: 'Whiskey & Bourbon', path: '/drinks/potent-potables/whiskey-bourbon', icon: Wine, description: 'Kentucky classics' },
  { id: 'tequila', name: 'Tequila & Mezcal', path: '/drinks/potent-potables/tequila-mezcal', icon: Flame, description: 'Agave spirits' },
  { id: 'rum', name: 'Rum', path: '/drinks/potent-potables/rum', icon: GlassWater, description: 'Caribbean vibes' },
  { id: 'cognac', name: 'Cognac & Brandy', path: '/drinks/potent-potables/cognac-brandy', icon: Wine, description: 'French sophistication' },
  { id: 'daiquiri', name: 'Daiquiri', path: '/drinks/potent-potables/daiquiri', icon: Droplets, description: 'Rum classics' },
  { id: 'scotch', name: 'Scotch & Irish', path: '/drinks/potent-potables/scotch-irish-whiskey', icon: Wine, description: 'UK whiskeys' },
  { id: 'martinis', name: 'Martinis', path: '/drinks/potent-potables/martinis', icon: Martini, description: 'Elegant classics' },
  { id: 'classic', name: 'Classic Cocktails', path: '/drinks/potent-potables/classic-cocktails', icon: Wine, description: 'Timeless recipes' }
];

// CROSS-HUB
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'protein', name: 'Protein Shakes', icon: Zap, route: '/drinks/protein-shakes', description: 'Muscle building' },
  { id: 'detox', name: 'Detoxes', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing blends' },
  { id: 'all', name: 'All Drinks', icon: Wine, route: '/drinks', description: 'Browse everything' }
];

export default function MocktailsPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedOccasion, setSelectedOccasion] = useState('All Occasions');
  const [sortBy, setSortBy] = useState('trending');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMocktail, setSelectedMocktail] = useState<typeof mocktails[0] | null>(null);
  const [calorieRange, setCalorieRange] = useState([0, 150]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMocktails = mocktails.filter(mocktail => {
    if (selectedCategory !== 'all' && !mocktail.category.toLowerCase().includes(selectedCategory.toLowerCase())) {
      return false;
    }
    if (selectedOccasion !== 'All Occasions' && mocktail.occasion !== selectedOccasion) {
      return false;
    }
    if (mocktail.nutrition.calories < calorieRange[0] || mocktail.nutrition.calories > calorieRange[1]) {
      return false;
    }
    if (searchQuery && !mocktail.name.toLowerCase().includes(searchQuery.toLowerCase())) {
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

  const handleMocktailClick = (mocktail: typeof mocktails[0]) => {
    setSelectedMocktail(mocktail);
    addToRecentlyViewed({
      id: mocktail.id,
      name: mocktail.name,
      category: 'Mocktails',
      timestamp: Date.now()
    });
  };

  const handleMakeMocktail = (mocktail: typeof mocktails[0]) => {
    incrementDrinksMade();
    addPoints(20, 'Made a mocktail');
    setSelectedMocktail(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Universal Search */}
      <div className="bg-white border-b border-purple-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <UniversalSearch />
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Potent Potables
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Martini className="w-10 h-10" />
                Mocktails
              </h1>
              <p className="text-purple-100 text-lg">Sophisticated non-alcoholic cocktails for every occasion</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{filteredMocktails.length}</div>
              <div className="text-purple-100">Recipes</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Home className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-600">Explore Other Drink Categories</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Button key={hub.id} variant="outline" className="w-full justify-start hover:bg-pink-50 hover:border-pink-300">
                    <Icon className="h-4 w-4 mr-2 text-purple-500" />
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{hub.name}</div>
                      <div className="text-xs text-gray-500">{hub.description}</div>
                    </div>
                    <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SISTER PAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Potent Potables</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {sisterPotentPotablesPages.map((page) => {
                const Icon = page.icon;
                return (
                  <Button key={page.id} variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                    <Icon className="h-4 w-4 mr-2 text-purple-500" />
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{page.name}</div>
                      <div className="text-xs text-gray-500">{page.description}</div>
                    </div>
                    <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border-pink-200">
            <CardContent className="p-4 text-center">
              <Martini className="w-8 h-8 text-pink-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-pink-600">12</div>
              <div className="text-sm text-gray-600">Unique Recipes</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-purple-200">
            <CardContent className="p-4 text-center">
              <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-600">~100</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-blue-200">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">5 min</div>
              <div className="text-sm text-gray-600">Avg Prep</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-green-200">
            <CardContent className="p-4 text-center">
              <Award className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">0%</div>
              <div className="text-sm text-gray-600">Alcohol</div>
            </CardContent>
          </Card>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {mocktailCategories.map(category => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className={selectedCategory === category.id ? "bg-purple-500 hover:bg-purple-600" : "hover:bg-purple-50"}
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
                placeholder="Search mocktails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <select 
            value={selectedOccasion}
            onChange={(e) => setSelectedOccasion(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            {occasions.map(occasion => (
              <option key={occasion} value={occasion}>{occasion}</option>
            ))}
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
                    Calorie Range: {calorieRange[0]} - {calorieRange[1]} cal
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="150"
                    value={calorieRange[1]}
                    onChange={(e) => setCalorieRange([calorieRange[0], parseInt(e.target.value)])}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mocktails Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMocktails.map(mocktail => (
            <Card 
              key={mocktail.id} 
              className="hover:shadow-lg transition-all cursor-pointer bg-white border-purple-100 hover:border-purple-300"
              onClick={() => handleMocktailClick(mocktail)}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-lg">{mocktail.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToFavorites({
                        id: mocktail.id,
                        name: mocktail.name,
                        category: 'Mocktails',
                        timestamp: Date.now()
                      });
                    }}
                  >
                    <Heart className={`w-4 h-4 ${isFavorite(mocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                </div>
                {mocktail.trending && (
                  <Badge className="bg-purple-500 mb-2">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Trending
                  </Badge>
                )}
                {mocktail.featured && (
                  <Badge className="bg-pink-500 mb-2 ml-2">
                    <GlassWater className="fill-cyan-500 text-cyan-500" />
                    Featured
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{mocktail.description}</p>
                
                <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span>{mocktail.nutrition.calories} cal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{mocktail.prepTime} min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GlassWater className="w-4 h-4 text-purple-500" />
                    <span>{mocktail.glassware}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{mocktail.rating} ({mocktail.reviews})</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {mocktail.benefits.slice(0, 3).map(benefit => (
                    <Badge key={benefit} variant="outline" className="text-xs border-purple-300">
                      {benefit}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm font-medium text-purple-600">{mocktail.drinkStyle}</span>
                  <span className="text-sm text-gray-500">${mocktail.estimatedCost.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mocktail Detail Modal - Keeping compact for token limit */}
        {selectedMocktail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedMocktail(null)}>
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-2xl">{selectedMocktail.name}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedMocktail(null)}>×</Button>
                </div>
                <p className="text-gray-600">{selectedMocktail.description}</p>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  onClick={() => handleMakeMocktail(selectedMocktail)}
                >
                  <Martini className="w-4 h-4 mr-2" />
                  Make This Mocktail
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Educational Content - Keeping compact */}
        <Card className="mt-12 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-500" />
              The Art of Mocktails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              Mocktails offer complex flavor profiles using fresh herbs, quality ingredients, and creative 
              techniques. They're designed to provide the same sophisticated experience as traditional cocktails 
              for everyone to enjoy.
            </p>
          </CardContent>
        </Card>

        {/* Your Progress Card */}
        <Card className="mt-12 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-purple-600" />
                  Your Progress
                </h3>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <GlassWater className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-gray-600">Level:</span>
                    <Badge className="bg-purple-600 text-white">{userProgress.level}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-pink-500" />
                    <span className="text-sm text-gray-600">XP:</span>
                    <Badge className="bg-pink-600 text-white">{userProgress.totalPoints}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Martini className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-gray-600">Drinks Made:</span>
                    <Badge className="bg-purple-100 text-purple-800">{userProgress.totalDrinksMade}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-pink-500" />
                    <span className="text-sm text-gray-600">Mocktails Found:</span>
                    <Badge className="bg-pink-100 text-pink-800">{filteredMocktails.length}</Badge>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="border-purple-300 hover:bg-purple-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2 rotate-90" />
                Back to Top
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
