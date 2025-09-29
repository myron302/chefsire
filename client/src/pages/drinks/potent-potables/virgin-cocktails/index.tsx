import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Sparkles, Clock, Heart, Star, Target, Leaf, Droplets, 
  Search, Share2, ArrowLeft, Plus, Camera, GlassWater,
  TrendingUp, Award, Crown, Coffee, Zap, Cherry, Sun, Citrus
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const virginDrinks = [
  // CLASSIC VIRGIN COCKTAILS
  {
    id: 'virgin-1',
    name: 'Virgin Mojito',
    description: 'Refreshing mint and lime without the rum',
    baseIngredient: 'Mint & Lime',
    origin: 'Cuba',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 95,
      carbs: 24,
      sugar: 20,
      protein: 0
    },
    ingredients: [
      'Fresh Mint Leaves (10-12)',
      'Fresh Lime Juice (1 oz)',
      'Simple Syrup (0.75 oz)',
      'Soda Water (top)',
      'Lime Wedges',
      'Ice'
    ],
    profile: ['Refreshing', 'Minty', 'Citrus', 'Light'],
    difficulty: 'Very Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 4521,
    trending: true,
    featured: true,
    estimatedCost: 2.50,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Virgin',
    garnish: 'Mint sprig, lime wheel',
    method: 'Muddle & Build',
    vegan: true,
    glutenFree: true
  },
  {
    id: 'virgin-2',
    name: 'Virgin Mary',
    description: 'Spicy tomato juice cocktail without vodka',
    baseIngredient: 'Tomato Juice',
    origin: 'United States',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 65,
      carbs: 14,
      sugar: 10,
      protein: 2
    },
    ingredients: [
      'Tomato Juice (6 oz)',
      'Fresh Lemon Juice (0.5 oz)',
      'Worcestershire Sauce (3 dashes)',
      'Hot Sauce (2 dashes)',
      'Celery Salt',
      'Black Pepper',
      'Celery Stalk',
      'Ice'
    ],
    profile: ['Savory', 'Spicy', 'Umami', 'Brunch'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 2876,
    trending: false,
    featured: true,
    estimatedCost: 3.00,
    bestTime: 'Brunch',
    occasion: 'Morning',
    allergens: [],
    category: 'Classic Virgin',
    garnish: 'Celery stalk, lemon wedge, olives',
    method: 'Build & Stir',
    vegan: false,
    glutenFree: false
  },
  {
    id: 'virgin-3',
    name: 'Shirley Temple',
    description: 'Sweet ginger ale with grenadine',
    baseIngredient: 'Ginger Ale',
    origin: 'United States',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 125,
      carbs: 32,
      sugar: 30,
      protein: 0
    },
    ingredients: [
      'Ginger Ale (6 oz)',
      'Grenadine (0.5 oz)',
      'Fresh Lime Juice (0.25 oz)',
      'Maraschino Cherry',
      'Orange Slice',
      'Ice'
    ],
    profile: ['Sweet', 'Fizzy', 'Fruity', 'Kid-Friendly'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 3421,
    trending: false,
    featured: false,
    estimatedCost: 2.00,
    bestTime: 'Anytime',
    occasion: 'Family',
    allergens: [],
    category: 'Classic Virgin',
    garnish: 'Cherry, orange slice',
    method: 'Build',
    vegan: true,
    glutenFree: true
  },
  {
    id: 'virgin-4',
    name: 'Roy Rogers',
    description: 'Cola with grenadine and cherry',
    baseIngredient: 'Cola',
    origin: 'United States',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 135,
      carbs: 36,
      sugar: 34,
      protein: 0
    },
    ingredients: [
      'Cola (6 oz)',
      'Grenadine (0.5 oz)',
      'Maraschino Cherry',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Sweet', 'Cola', 'Nostalgic', 'Kid-Friendly'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.4,
    reviews: 2134,
    trending: false,
    featured: false,
    estimatedCost: 1.75,
    bestTime: 'Anytime',
    occasion: 'Family',
    allergens: [],
    category: 'Classic Virgin',
    garnish: 'Cherry, lime wedge',
    method: 'Build',
    vegan: true,
    glutenFree: true
  },

  // SOPHISTICATED MOCKTAILS
  {
    id: 'virgin-5',
    name: 'Cucumber Mint Cooler',
    description: 'Spa-inspired refreshing mocktail',
    baseIngredient: 'Cucumber',
    origin: 'Modern',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 45,
      carbs: 11,
      sugar: 8,
      protein: 1
    },
    ingredients: [
      'Fresh Cucumber (4 slices)',
      'Fresh Mint Leaves (6-8)',
      'Fresh Lime Juice (0.75 oz)',
      'Agave Syrup (0.5 oz)',
      'Soda Water (top)',
      'Ice'
    ],
    profile: ['Fresh', 'Herbal', 'Light', 'Spa-like'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 1987,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Afternoon',
    occasion: 'Wellness',
    allergens: [],
    category: 'Sophisticated Mocktails',
    garnish: 'Cucumber ribbon, mint sprig',
    method: 'Muddle & Build',
    vegan: true,
    glutenFree: true
  },
  {
    id: 'virgin-6',
    name: 'Grapefruit Rosemary Spritz',
    description: 'Botanical and citrus sparkler',
    baseIngredient: 'Grapefruit',
    origin: 'Modern',
    glassware: 'Wine Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 85,
      carbs: 20,
      sugar: 17,
      protein: 1
    },
    ingredients: [
      'Fresh Grapefruit Juice (3 oz)',
      'Rosemary Syrup (0.75 oz)',
      'Fresh Lemon Juice (0.5 oz)',
      'Sparkling Water (top)',
      'Rosemary Sprig',
      'Ice'
    ],
    profile: ['Citrus', 'Herbal', 'Sophisticated', 'Bitter-sweet'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 1654,
    trending: true,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Evening',
    occasion: 'Elegant',
    allergens: [],
    category: 'Sophisticated Mocktails',
    garnish: 'Rosemary sprig, grapefruit wheel',
    method: 'Build',
    vegan: true,
    glutenFree: true
  },
  {
    id: 'virgin-7',
    name: 'Lavender Lemonade',
    description: 'Floral and refreshing twist on lemonade',
    baseIngredient: 'Lemon',
    origin: 'Modern',
    glassware: 'Mason Jar',
    servingSize: '10 oz',
    nutrition: {
      calories: 110,
      carbs: 28,
      sugar: 25,
      protein: 0
    },
    ingredients: [
      'Fresh Lemon Juice (2 oz)',
      'Lavender Syrup (1 oz)',
      'Water (6 oz)',
      'Lavender Sprig',
      'Lemon Wheel',
      'Ice'
    ],
    profile: ['Floral', 'Tart', 'Aromatic', 'Refreshing'],
    difficulty: 'Very Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2345,
    trending: false,
    featured: true,
    estimatedCost: 3.00,
    bestTime: 'Afternoon',
    occasion: 'Garden Party',
    allergens: [],
    category: 'Sophisticated Mocktails',
    garnish: 'Lavender sprig, lemon wheel',
    method: 'Build & Stir',
    vegan: true,
    glutenFree: true
  },
  {
    id: 'virgin-8',
    name: 'Watermelon Basil Refresher',
    description: 'Summer fruit with herbal notes',
    baseIngredient: 'Watermelon',
    origin: 'Modern',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 75,
      carbs: 18,
      sugar: 15,
      protein: 1
    },
    ingredients: [
      'Fresh Watermelon Juice (4 oz)',
      'Fresh Basil Leaves (4-5)',
      'Fresh Lime Juice (0.5 oz)',
      'Simple Syrup (0.25 oz)',
      'Soda Water (top)',
      'Ice'
    ],
    profile: ['Fruity', 'Herbal', 'Light', 'Summer'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 1432,
    trending: true,
    featured: false,
    estimatedCost: 3.50,
    bestTime: 'Afternoon',
    occasion: 'Poolside',
    allergens: [],
    category: 'Sophisticated Mocktails',
    garnish: 'Basil leaf, watermelon wedge',
    method: 'Muddle & Build',
    vegan: true,
    glutenFree: true
  },

  // FRUIT JUICE BLENDS
  {
    id: 'virgin-9',
    name: 'Tropical Sunrise',
    description: 'Layered orange and pineapple with grenadine',
    baseIngredient: 'Orange Juice',
    origin: 'Modern',
    glassware: 'Hurricane Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 165,
      carbs: 40,
      sugar: 36,
      protein: 2
    },
    ingredients: [
      'Orange Juice (4 oz)',
      'Pineapple Juice (3 oz)',
      'Grenadine (0.5 oz)',
      'Fresh Lime Juice (0.25 oz)',
      'Orange Slice',
      'Ice'
    ],
    profile: ['Tropical', 'Sweet', 'Fruity', 'Vibrant'],
    difficulty: 'Very Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 2876,
    trending: false,
    featured: false,
    estimatedCost: 2.50,
    bestTime: 'Morning',
    occasion: 'Brunch',
    allergens: [],
    category: 'Fruit Blends',
    garnish: 'Orange slice, cherry',
    method: 'Build & Layer',
    vegan: true,
    glutenFree: true
  },
  {
    id: 'virgin-10',
    name: 'Berry Blast',
    description: 'Mixed berry smoothie mocktail',
    baseIngredient: 'Mixed Berries',
    origin: 'Modern',
    glassware: 'Hurricane Glass',
    servingSize: '12 oz',
    nutrition: {
      calories: 125,
      carbs: 30,
      sugar: 24,
      protein: 2
    },
    ingredients: [
      'Mixed Berries (1 cup)',
      'Orange Juice (2 oz)',
      'Honey (0.5 oz)',
      'Fresh Lemon Juice (0.25 oz)',
      'Ice',
      'Soda Water (splash)'
    ],
    profile: ['Berry', 'Tart', 'Refreshing', 'Antioxidant'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 1765,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    bestTime: 'Morning',
    occasion: 'Healthy',
    allergens: [],
    category: 'Fruit Blends',
    garnish: 'Fresh berries, mint',
    method: 'Blend',
    vegan: false,
    glutenFree: true
  },
  {
    id: 'virgin-11',
    name: 'Pineapple Ginger Fizz',
    description: 'Spicy ginger with sweet pineapple',
    baseIngredient: 'Pineapple',
    origin: 'Modern',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 105,
      carbs: 26,
      sugar: 22,
      protein: 1
    },
    ingredients: [
      'Pineapple Juice (4 oz)',
      'Fresh Ginger (3 slices)',
      'Fresh Lime Juice (0.5 oz)',
      'Honey (0.5 oz)',
      'Ginger Beer (top)',
      'Ice'
    ],
    profile: ['Tropical', 'Spicy', 'Sweet', 'Zingy'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 1543,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Afternoon',
    occasion: 'Refreshing',
    allergens: [],
    category: 'Fruit Blends',
    garnish: 'Pineapple wedge, candied ginger',
    method: 'Muddle & Build',
    vegan: false,
    glutenFree: true
  },

  // HERBAL & TEA BASED
  {
    id: 'virgin-12',
    name: 'Iced Hibiscus Tea Spritzer',
    description: 'Floral tea with citrus sparkle',
    baseIngredient: 'Hibiscus Tea',
    origin: 'Modern',
    glassware: 'Wine Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 55,
      carbs: 14,
      sugar: 12,
      protein: 0
    },
    ingredients: [
      'Hibiscus Tea (4 oz, chilled)',
      'Fresh Lemon Juice (0.5 oz)',
      'Agave Syrup (0.5 oz)',
      'Sparkling Water (top)',
      'Lemon Wheel',
      'Ice'
    ],
    profile: ['Floral', 'Tart', 'Refreshing', 'Antioxidant'],
    difficulty: 'Very Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1234,
    trending: false,
    featured: false,
    estimatedCost: 2.50,
    bestTime: 'Afternoon',
    occasion: 'Wellness',
    allergens: [],
    category: 'Herbal & Tea',
    garnish: 'Lemon wheel, edible flower',
    method: 'Build',
    vegan: true,
    glutenFree: true
  },
  {
    id: 'virgin-13',
    name: 'Matcha Mint Cooler',
    description: 'Green tea with mint and honey',
    baseIngredient: 'Matcha',
    origin: 'Modern',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 70,
      carbs: 16,
      sugar: 13,
      protein: 1
    },
    ingredients: [
      'Matcha Powder (1 tsp)',
      'Fresh Mint Leaves (6-8)',
      'Honey (0.75 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Cold Water (6 oz)',
      'Ice'
    ],
    profile: ['Earthy', 'Minty', 'Energizing', 'Smooth'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.5,
    reviews: 987,
    trending: true,
    featured: false,
    estimatedCost: 4.50,
    bestTime: 'Morning',
    occasion: 'Energizing',
    allergens: [],
    category: 'Herbal & Tea',
    garnish: 'Mint sprig, lime wheel',
    method: 'Whisk & Build',
    vegan: false,
    glutenFree: true
  },
  {
    id: 'virgin-14',
    name: 'Spiced Apple Cider Mocktail',
    description: 'Warm fall spices with apple',
    baseIngredient: 'Apple Cider',
    origin: 'Traditional',
    glassware: 'Irish Coffee Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 135,
      carbs: 34,
      sugar: 30,
      protein: 0
    },
    ingredients: [
      'Apple Cider (6 oz)',
      'Cinnamon Stick',
      'Star Anise',
      'Orange Peel',
      'Honey (0.5 oz)',
      'Lemon Juice (0.25 oz)'
    ],
    profile: ['Warm', 'Spicy', 'Cozy', 'Seasonal'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.8,
    reviews: 2456,
    trending: false,
    featured: true,
    estimatedCost: 3.00,
    bestTime: 'Evening',
    occasion: 'Fall/Winter',
    allergens: [],
    category: 'Herbal & Tea',
    garnish: 'Cinnamon stick, apple slice',
    method: 'Heat & Steep',
    vegan: false,
    glutenFree: true
  }
];

export default function VirginDrinksPage() {
  const { favorites, toggleFavorite } = useDrinks();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const categories = ['Classic Virgin', 'Sophisticated Mocktails', 'Fruit Blends', 'Herbal & Tea'];
  const difficulties = ['Very Easy', 'Easy', 'Medium'];

  const filteredDrinks = virginDrinks.filter(drink => {
    const matchesSearch = drink.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         drink.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || drink.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || drink.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        {/* Universal Search Modal */}
        {showUniversalSearch && (
          <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white py-16 px-4">
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
              <Sparkles className="w-12 h-12" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Virgin Drinks & Mocktails</h1>
                <p className="text-xl text-white/90">Alcohol-free sophistication and refreshment</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search virgin drinks & mocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 py-6 text-lg bg-white/95 border-0"
                />
              </div>
              <Button
                onClick={() => setShowUniversalSearch(true)}
                className="bg-white text-emerald-600 hover:bg-white/90 px-6"
                size="lg"
              >
                <Target className="w-5 h-5 mr-2" />
                Advanced Search
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{virginDrinks.length}</div>
                <div className="text-white/80 text-sm">Mocktails</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{categories.length}</div>
                <div className="text-white/80 text-sm">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{virginDrinks.filter(d => d.vegan).length}</div>
                <div className="text-white/80 text-sm">Vegan</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{virginDrinks.filter(d => d.glutenFree).length}</div>
                <div className="text-white/80 text-sm">Gluten-Free</div>
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
                    className={selectedCategory === null ? "bg-emerald-600" : ""}
                  >
                    All
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={selectedCategory === category ? "bg-emerald-600" : ""}
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
                    className={selectedDifficulty === null ? "bg-emerald-600" : ""}
                  >
                    All Levels
                  </Button>
                  {difficulties.map(diff => (
                    <Button
                      key={diff}
                      variant={selectedDifficulty === diff ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDifficulty(diff)}
                      className={selectedDifficulty === diff ? "bg-emerald-600" : ""}
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
            Showing {filteredDrinks.length} of {virginDrinks.length} drinks
          </div>

          {/* Drinks Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrinks.map((drink) => (
              <Card key={drink.id} className="hover:shadow-lg transition-all duration-300 overflow-hidden group">
                <div className="relative bg-gradient-to-br from-green-100 to-emerald-100 p-6 h-48 flex items-center justify-center">
                  <Sparkles className="w-20 h-20 text-emerald-600 group-hover:scale-110 transition-transform" />
                  {drink.trending && (
                    <Badge className="absolute top-3 left-3 bg-teal-500">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Trending
                    </Badge>
                  )}
                  {drink.vegan && (
                    <Badge className="absolute top-3 right-3 bg-green-600">
                      <Leaf className="w-3 h-3 mr-1" />
                      Vegan
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute bottom-3 right-3 bg-white/80 hover:bg-white"
                    onClick={() => toggleFavorite(drink.id, 'virgin-drinks')}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        favorites['virgin-drinks']?.includes(drink.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-gray-600'
                      }`}
                    />
                  </Button>
                </div>

                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl">{drink.name}</CardTitle>
                    <Badge variant="outline" className="ml-2">
                      {drink.difficulty}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{drink.description}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Key Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <GlassWater className="w-4 h-4 text-emerald-600" />
                      <span className="text-gray-600">{drink.glassware}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span className="text-gray-600">{drink.prepTime} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-emerald-600" />
                      <span className="text-gray-600">{drink.baseIngredient}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-emerald-600" />
                      <span className="text-gray-600">{drink.bestTime}</span>
                    </div>
                  </div>

                  {/* Rating with Martini Glasses */}
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <GlassWater
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(drink.rating)
                              ? 'fill-emerald-500 text-emerald-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">{drink.rating}</span>
                    <span className="text-sm text-gray-500">({drink.reviews.toLocaleString()})</span>
                  </div>

                  {/* Profile Tags */}
                  <div className="flex flex-wrap gap-2">
                    {drink.profile.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Dietary Badges */}
                  <div className="flex flex-wrap gap-2">
                    {drink.vegan && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                        <Leaf className="w-3 h-3 mr-1" />
                        Vegan
                      </Badge>
                    )}
                    {drink.glutenFree && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">
                        Gluten-Free
                      </Badge>
                    )}
                  </div>

                  {/* Nutrition Highlights */}
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t text-center">
                    <div>
                      <div className="text-xs text-gray-500">Cal</div>
                      <div className="font-semibold text-sm">{drink.nutrition.calories}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Carbs</div>
                      <div className="font-semibold text-sm">{drink.nutrition.carbs}g</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Sugar</div>
                      <div className="font-semibold text-sm">{drink.nutrition.sugar}g</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Protein</div>
                      <div className="font-semibold text-sm">{drink.nutrition.protein}g</div>
                    </div>
                  </div>

                  {/* Ingredients Preview */}
                  <div className="pt-3 border-t">
                    <div className="text-sm font-semibold mb-2 text-gray-700">Main Ingredients:</div>
                    <div className="text-sm text-gray-600">
                      {drink.ingredients.slice(0, 3).join(' • ')}
                      {drink.ingredients.length > 3 && '...'}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3">
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700">
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
          <Card className="mt-12 bg-gradient-to-br from-green-50 to-emerald-50 border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="w-7 h-7 text-emerald-600" />
                About Virgin Drinks & Mocktails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-gray-700 leading-relaxed">
                Virgin drinks and mocktails offer all the sophistication, flavor, and fun of cocktails without 
                the alcohol. Whether you're the designated driver, pregnant, in recovery, health-conscious, or 
                simply prefer non-alcoholic beverages, these drinks prove that you don't need alcohol to enjoy 
                a delicious, beautifully crafted beverage.
              </p>

              {/* Benefits */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-emerald-700">Benefits of Mocktails</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-emerald-200">
                    <div className="font-semibold text-emerald-600 mb-2 flex items-center gap-2">
                      <Leaf className="w-4 h-4" />
                      Health Conscious
                    </div>
                    <div className="text-sm text-gray-700">Lower calories, no alcohol-related health risks, often packed with vitamins.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-emerald-200">
                    <div className="font-semibold text-teal-600 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Inclusive
                    </div>
                    <div className="text-sm text-gray-700">Everyone can enjoy sophisticated drinks regardless of lifestyle choices.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-emerald-200">
                    <div className="font-semibold text-green-600 mb-2 flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      Anytime Enjoyment
                    </div>
                    <div className="text-sm text-gray-700">Perfect for any time of day without impairment or hangover concerns.</div>
                  </div>
                </div>
              </div>

              {/* Categories Explained */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-emerald-700">Mocktail Categories</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
                    <div className="font-semibold text-blue-700 mb-2">Classic Virgin</div>
                    <div className="text-sm text-gray-700">Traditional mocktails like Virgin Mojito, Shirley Temple, and Virgin Mary that have stood the test of time.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                    <div className="font-semibold text-purple-700 mb-2">Sophisticated Mocktails</div>
                    <div className="text-sm text-gray-700">Craft cocktail-inspired creations with complex flavors, fresh herbs, and premium ingredients.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
                    <div className="font-semibold text-orange-700 mb-2">Fruit Blends</div>
                    <div className="text-sm text-gray-700">Fresh juice combinations that highlight seasonal fruits and natural sweetness.</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                    <div className="font-semibold text-green-700 mb-2">Herbal & Tea</div>
                    <div className="text-sm text-gray-700">Tea-based mocktails and herbal infusions with wellness benefits and unique flavors.</div>
                  </div>
                </div>
              </div>

              {/* Tips for Making Great Mocktails */}
              <div className="p-6 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-emerald-800 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Tips for Amazing Mocktails
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-emerald-700 mb-2">Ingredient Quality:</div>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      <li>Use fresh, high-quality ingredients</li>
                      <li>Make homemade syrups and infusions</li>
                      <li>Choose premium mixers and juices</li>
                      <li>Fresh herbs make a huge difference</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-teal-700 mb-2">Presentation:</div>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      <li>Use proper glassware</li>
                      <li>Garnish thoughtfully</li>
                      <li>Consider color and layering</li>
                      <li>Serve at the right temperature</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Flavor Building */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-emerald-700">Building Complex Flavors</h3>
                <div className="grid md:grid-cols-4 gap-3">
                  <div className="p-3 bg-white rounded-lg text-center">
                    <div className="text-2xl mb-1">🍋</div>
                    <div className="font-semibold text-xs text-emerald-700 mb-1">Acid</div>
                    <div className="text-xs text-gray-600">Citrus, vinegar</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg text-center">
                    <div className="text-2xl mb-1">🍯</div>
                    <div className="font-semibold text-xs text-emerald-700 mb-1">Sweet</div>
                    <div className="text-xs text-gray-600">Syrups, honey</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg text-center">
                    <div className="text-2xl mb-1">🌿</div>
                    <div className="font-semibold text-xs text-emerald-700 mb-1">Herbal</div>
                    <div className="text-xs text-gray-600">Mint, basil, rosemary</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg text-center">
                    <div className="text-2xl mb-1">🫧</div>
                    <div className="font-semibold text-xs text-emerald-700 mb-1">Effervescence</div>
                    <div className="text-xs text-gray-600">Soda, sparkling water</div>
                  </div>
                </div>
              </div>

              {/* Non-Alcoholic Spirit Alternatives */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-emerald-700">Zero-Proof Spirits</h3>
                <p className="text-sm text-gray-700 mb-3">
                  The mocktail revolution has brought sophisticated non-alcoholic spirits that mimic the complexity 
                  of traditional spirits. Brands like Seedlip, Ritual, and Lyre's offer botanical distillates, 
                  non-alcoholic gin alternatives, and spirit-free versions of whiskey, rum, and tequila.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">Seedlip (Botanical)</Badge>
                  <Badge variant="outline" className="text-xs">Ritual Zero Proof</Badge>
                  <Badge variant="outline" className="text-xs">Lyre's Non-Alcoholic</Badge>
                  <Badge variant="outline" className="text-xs">Ghia Aperitif</Badge>
                  <Badge variant="outline" className="text-xs">Curious Elixirs</Badge>
                  <Badge variant="outline" className="text-xs">Kin Euphorics</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
