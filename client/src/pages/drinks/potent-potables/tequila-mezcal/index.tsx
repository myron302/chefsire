import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Flame, Clock, Heart, Star, Target, Sparkles, Sun, 
  Search, Share2, ArrowLeft, Plus, Camera, GlassWater,
  TrendingUp, Award, Crown, Coffee, Leaf, Zap, Cherry, Citrus,
  Droplets, BookOpen
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const tequilaMezcalCocktails = [
  // CLASSIC TEQUILA COCKTAILS
  {
    id: 'tequila-1',
    name: 'Classic Margarita',
    description: 'The perfect balance of tequila, lime, and orange liqueur',
    spiritType: 'Blanco Tequila',
    origin: 'Mexico',
    glassware: 'Margarita Glass',
    servingSize: '5 oz',
    nutrition: {
      calories: 195,
      carbs: 12,
      sugar: 10,
      alcohol: 14
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Lime Juice (1 oz)',
      'Triple Sec (1 oz)',
      'Salt (for rim)',
      'Lime Wheel',
      'Ice'
    ],
    profile: ['Citrus', 'Refreshing', 'Balanced', 'Classic'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 8234,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Salt rim, lime wheel',
    method: 'Shake',
    abv: '18-22%',
    iba_official: true,
    instructions: 'Rim glass with salt. Shake tequila, lime juice, and triple sec with ice. Strain into prepared glass over fresh ice. Garnish with lime wheel.'
  },
  {
    id: 'tequila-2',
    name: 'Paloma',
    description: 'Mexico\'s most popular cocktail with grapefruit soda',
    spiritType: 'Blanco Tequila',
    origin: 'Mexico',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 185,
      carbs: 16,
      sugar: 14,
      alcohol: 12
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Grapefruit Soda (4 oz)',
      'Salt (for rim)',
      'Grapefruit Slice',
      'Ice'
    ],
    profile: ['Citrus', 'Refreshing', 'Light', 'Popular'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 5678,
    trending: true,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Salt rim, grapefruit slice',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Rim highball glass with salt and fill with ice. Add tequila and lime juice. Top with grapefruit soda. Stir gently and garnish with grapefruit slice.'
  },
  {
    id: 'tequila-3',
    name: 'Tequila Sunrise',
    description: 'Layered sunrise effect with tequila and grenadine',
    spiritType: 'Blanco Tequila',
    origin: 'California, USA',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: {
      calories: 215,
      carbs: 22,
      sugar: 20,
      alcohol: 12
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Orange Juice (4 oz)',
      'Grenadine (0.5 oz)',
      'Orange Slice',
      'Cherry',
      'Ice'
    ],
    profile: ['Fruity', 'Sweet', 'Colorful', 'Easy'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 4321,
    trending: false,
    featured: false,
    estimatedCost: 3.50,
    bestTime: 'Brunch',
    occasion: 'Poolside',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Orange slice, cherry',
    method: 'Build & Layer',
    abv: '10-12%',
    iba_official: true,
    instructions: 'Fill glass with ice. Add tequila and orange juice, stir. Slowly pour grenadine down the side to create sunrise effect. Garnish with orange slice and cherry.'
  },
  {
    id: 'tequila-4',
    name: 'Tommy\'s Margarita',
    description: 'Agave-sweetened margarita without triple sec',
    spiritType: 'Blanco Tequila',
    origin: 'San Francisco, USA',
    glassware: 'Rocks Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 175,
      carbs: 10,
      sugar: 9,
      alcohol: 15
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Lime Juice (1 oz)',
      'Agave Nectar (0.5 oz)',
      'Salt (for rim)',
      'Lime Wheel',
      'Ice'
    ],
    profile: ['Pure', 'Agave-forward', 'Citrus', 'Refined'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 3456,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Salt rim, lime wheel',
    method: 'Shake',
    abv: '22-26%',
    iba_official: false,
    instructions: 'Rim glass with salt. Shake tequila, lime juice, and agave nectar with ice. Strain over fresh ice. Garnish with lime wheel.'
  },
  {
    id: 'tequila-5',
    name: 'El Diablo',
    description: 'Spicy ginger beer tequila cocktail',
    spiritType: 'Reposado Tequila',
    origin: 'Mexico',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 195,
      carbs: 18,
      sugar: 15,
      alcohol: 12
    },
    ingredients: [
      'Reposado Tequila (2 oz)',
      'Crème de Cassis (0.5 oz)',
      'Fresh Lime Juice (0.5 oz)',
      'Ginger Beer (4 oz)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Spicy', 'Fruity', 'Complex', 'Refreshing'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2134,
    trending: false,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Adventurous',
    allergens: [],
    category: 'Classic Tequila',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill glass with ice. Add tequila, cassis, and lime juice. Top with ginger beer. Stir gently and garnish with lime wedge.'
  },
  {
    id: 'tequila-6',
    name: 'Tequila Old Fashioned',
    description: 'Classic old fashioned with aged tequila',
    spiritType: 'Añejo Tequila',
    origin: 'Modern',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 165,
      carbs: 5,
      sugar: 4,
      alcohol: 17
    },
    ingredients: [
      'Añejo Tequila (2 oz)',
      'Agave Nectar (0.25 oz)',
      'Angostura Bitters (2 dashes)',
      'Orange Bitters (1 dash)',
      'Orange Peel',
      'Large Ice Cube'
    ],
    profile: ['Rich', 'Smooth', 'Complex', 'Sophisticated'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 1876,
    trending: true,
    featured: true,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Tequila',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '32-36%',
    iba_official: false,
    instructions: 'Add agave nectar and bitters to rocks glass. Add large ice cube and tequila. Stir until well chilled. Express orange peel over drink and garnish.'
  },

  // MEZCAL COCKTAILS
  {
    id: 'mezcal-1',
    name: 'Mezcal Margarita',
    description: 'Smoky twist on the classic margarita',
    spiritType: 'Mezcal',
    origin: 'Mexico',
    glassware: 'Rocks Glass',
    servingSize: '5 oz',
    nutrition: {
      calories: 195,
      carbs: 12,
      sugar: 10,
      alcohol: 14
    },
    ingredients: [
      'Mezcal (2 oz)',
      'Fresh Lime Juice (1 oz)',
      'Agave Nectar (0.75 oz)',
      'Salt (for rim)',
      'Lime Wheel',
      'Ice'
    ],
    profile: ['Smoky', 'Citrus', 'Complex', 'Bold'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 3987,
    trending: true,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Mezcal Cocktails',
    garnish: 'Salt rim, lime wheel',
    method: 'Shake',
    abv: '18-22%',
    iba_official: false,
    instructions: 'Rim glass with salt. Shake mezcal, lime juice, and agave nectar with ice. Strain over fresh ice. Garnish with lime wheel.'
  },
  {
    id: 'mezcal-2',
    name: 'Oaxaca Old Fashioned',
    description: 'Mezcal and tequila old fashioned variation',
    spiritType: 'Mezcal',
    origin: 'New York City, USA',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: {
      calories: 175,
      carbs: 5,
      sugar: 4,
      alcohol: 17
    },
    ingredients: [
      'Reposado Tequila (1.5 oz)',
      'Mezcal (0.5 oz)',
      'Agave Nectar (0.25 oz)',
      'Angostura Bitters (2 dashes)',
      'Orange Peel',
      'Large Ice Cube'
    ],
    profile: ['Smoky', 'Rich', 'Complex', 'Bold'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 2876,
    trending: true,
    featured: true,
    estimatedCost: 7.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Mezcal Cocktails',
    garnish: 'Orange peel, flamed',
    method: 'Stir',
    abv: '32-36%',
    iba_official: false,
    instructions: 'Add agave nectar and bitters to glass. Add large ice cube, tequila, and mezcal. Stir until chilled. Flame orange peel over drink and garnish.'
  },
  {
    id: 'mezcal-3',
    name: 'Naked and Famous',
    description: 'Equal parts Last Word variation with mezcal',
    spiritType: 'Mezcal',
    origin: 'New York City, USA',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 185,
      carbs: 10,
      sugar: 8,
      alcohol: 16
    },
    ingredients: [
      'Mezcal (0.75 oz)',
      'Yellow Chartreuse (0.75 oz)',
      'Aperol (0.75 oz)',
      'Fresh Lime Juice (0.75 oz)',
      'Ice'
    ],
    profile: ['Smoky', 'Herbal', 'Bitter-Sweet', 'Complex'],
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.7,
    reviews: 1654,
    trending: true,
    featured: true,
    estimatedCost: 8.00,
    bestTime: 'Evening',
    occasion: 'Craft Cocktail',
    allergens: [],
    category: 'Mezcal Cocktails',
    garnish: 'None',
    method: 'Shake',
    abv: '26-30%',
    iba_official: false,
    instructions: 'Shake all equal parts with ice vigorously. Double strain into chilled coupe glass.'
  },
  {
    id: 'mezcal-4',
    name: 'Mezcal Negroni',
    description: 'Smoky mezcal replaces gin in this classic',
    spiritType: 'Mezcal',
    origin: 'Modern',
    glassware: 'Old Fashioned Glass',
    servingSize: '4 oz',
    nutrition: {
      calories: 195,
      carbs: 8,
      sugar: 6,
      alcohol: 18
    },
    ingredients: [
      'Mezcal (1 oz)',
      'Campari (1 oz)',
      'Sweet Vermouth (1 oz)',
      'Orange Peel',
      'Ice'
    ],
    profile: ['Smoky', 'Bitter', 'Complex', 'Bold'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 1987,
    trending: false,
    featured: true,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Adventurous',
    allergens: [],
    category: 'Mezcal Cocktails',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '30-34%',
    iba_official: false,
    instructions: 'Stir all equal parts with ice in rocks glass. Express orange peel over drink and garnish.'
  },
  {
    id: 'tequila-7',
    name: 'Ranch Water',
    description: 'Texas favorite with tequila and Topo Chico',
    spiritType: 'Blanco Tequila',
    origin: 'West Texas, USA',
    glassware: 'Highball Glass',
    servingSize: '10 oz',
    nutrition: {
      calories: 145,
      carbs: 3,
      sugar: 2,
      alcohol: 12
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Lime Juice (1 oz)',
      'Topo Chico or Sparkling Water (6 oz)',
      'Lime Wedge',
      'Ice'
    ],
    profile: ['Refreshing', 'Light', 'Crisp', 'Simple'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 2765,
    trending: true,
    featured: false,
    estimatedCost: 3.50,
    bestTime: 'Afternoon',
    occasion: 'Poolside',
    allergens: [],
    category: 'Modern Tequila',
    garnish: 'Lime wedge',
    method: 'Build',
    abv: '10-12%',
    iba_official: false,
    instructions: 'Fill glass with ice. Add tequila and lime juice. Top with sparkling water. Stir gently and garnish with lime wedge.'
  },
  {
    id: 'tequila-8',
    name: 'Spicy Margarita',
    description: 'Jalapeño-infused margarita with heat',
    spiritType: 'Blanco Tequila',
    origin: 'Modern',
    glassware: 'Rocks Glass',
    servingSize: '5 oz',
    nutrition: {
      calories: 195,
      carbs: 13,
      sugar: 11,
      alcohol: 14
    },
    ingredients: [
      'Blanco Tequila (2 oz)',
      'Fresh Lime Juice (1 oz)',
      'Triple Sec (0.75 oz)',
      'Jalapeño Slices (3-4)',
      'Agave Nectar (0.25 oz)',
      'Salt (for rim)',
      'Ice'
    ],
    profile: ['Spicy', 'Citrus', 'Bold', 'Heat'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 3214,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Party',
    allergens: [],
    category: 'Modern Tequila',
    garnish: 'Salt rim, jalapeño slice',
    method: 'Shake & Muddle',
    abv: '18-22%',
    iba_official: false,
    instructions: 'Muddle jalapeño slices in shaker. Add tequila, lime juice, triple sec, and agave nectar with ice. Shake vigorously. Strain over fresh ice in salt-rimmed glass. Garnish with jalapeño slice.'
  },
  {
    id: 'mezcal-5',
    name: 'Mezcal Sour',
    description: 'Smoky twist on the classic sour',
    spiritType: 'Mezcal',
    origin: 'Modern',
    glassware: 'Coupe Glass',
    servingSize: '5 oz',
    nutrition: {
      calories: 185,
      carbs: 12,
      sugar: 10,
      alcohol: 14
    },
    ingredients: [
      'Mezcal (2 oz)',
      'Fresh Lemon Juice (0.75 oz)',
      'Agave Nectar (0.5 oz)',
      'Egg White (1)',
      'Angostura Bitters',
      'Ice'
    ],
    profile: ['Smoky', 'Tart', 'Frothy', 'Complex'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 1543,
    trending: false,
    featured: true,
    estimatedCost: 6.50,
    bestTime: 'Evening',
    occasion: 'Craft Cocktail',
    allergens: ['Eggs'],
    category: 'Mezcal Cocktails',
    garnish: 'Bitters design',
    method: 'Shake',
    abv: '22-26%',
    iba_official: false,
    instructions: 'Dry shake egg white first. Add mezcal, lemon juice, agave nectar, and ice. Shake vigorously. Double strain into coupe. Add drops of bitters on foam and create design.'
  }
];

export default function TequilaMezcalPage() {
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
  const [selectedCocktail, setSelectedCocktail] = useState<typeof tequilaMezcalCocktails[0] | null>(null);

  const categories = ['Classic Tequila', 'Modern Tequila', 'Mezcal Cocktails'];
  const difficulties = ['Very Easy', 'Easy', 'Medium'];

  const filteredCocktails = tequilaMezcalCocktails.filter(cocktail => {
    const matchesSearch = cocktail.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cocktail.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || cocktail.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || cocktail.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const handleCocktailClick = (cocktail: typeof tequilaMezcalCocktails[0]) => {
    setSelectedCocktail(cocktail);
    addToRecentlyViewed({
      id: cocktail.id,
      name: cocktail.name,
      category: 'tequila-mezcal',
      timestamp: Date.now()
    });
  };

  const handleMakeCocktail = (cocktail: typeof tequilaMezcalCocktails[0]) => {
    incrementDrinksMade();
    addPoints(40, 'Made a tequila/mezcal cocktail');
    setSelectedCocktail(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-lime-50 via-green-50 to-emerald-50">
        {/* Universal Search Modal */}
        {showUniversalSearch && (
          <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-lime-600 via-green-600 to-emerald-600 text-white py-16 px-4">
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
              <Flame className="w-12 h-12" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Tequila & Mezcal</h1>
                <p className="text-xl text-white/90">From smooth blanco to smoky mezcal</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search tequila & mezcal cocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 py-6 text-lg bg-white/95 border-0"
                />
              </div>
              <Button
                onClick={() => setShowUniversalSearch(true)}
                className="bg-white text-green-600 hover:bg-white/90 px-6"
                size="lg"
              >
                <Target className="w-5 h-5 mr-2" />
                Advanced Search
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{tequilaMezcalCocktails.length}</div>
                <div className="text-white/80 text-sm">Cocktails</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{categories.length}</div>
                <div className="text-white/80 text-sm">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{tequilaMezcalCocktails.filter(c => c.trending).length}</div>
                <div className="text-white/80 text-sm">Trending</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{tequilaMezcalCocktails.filter(c => c.spiritType === 'Mezcal').length}</div>
                <div className="text-white/80 text-sm">Mezcal</div>
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
                    className={selectedCategory === null ? "bg-green-600" : ""}
                  >
                    All
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={selectedCategory === category ? "bg-green-600" : ""}
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
                    className={selectedDifficulty === null ? "bg-green-600" : ""}
                  >
                    All Levels
                  </Button>
                  {difficulties.map(diff => (
                    <Button
                      key={diff}
                      variant={selectedDifficulty === diff ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDifficulty(diff)}
                      className={selectedDifficulty === diff ? "bg-green-600" : ""}
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
            Showing {filteredCocktails.length} of {tequilaMezcalCocktails.length} cocktails
          </div>

          {/* Cocktails Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map((cocktail) => (
              <Card 
                key={cocktail.id} 
                className="hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
                onClick={() => handleCocktailClick(cocktail)}
              >
                <div className="relative bg-gradient-to-br from-lime-100 to-green-100 p-6 h-48 flex items-center justify-center">
                  <Flame className="w-20 h-20 text-green-600 group-hover:scale-110 transition-transform" />
                  {cocktail.trending && (
                    <Badge className="absolute top-3 left-3 bg-emerald-500">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Trending
                    </Badge>
                  )}
                  {cocktail.spiritType === 'Mezcal' && (
                    <Badge className="absolute top-3 right-3 bg-orange-600">
                      <Flame className="w-3 h-3 mr-1" />
                      Mezcal
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
                        category: 'tequila-mezcal',
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
                      <GlassWater className="w-4 h-4 text-green-600" />
                      <span className="text-gray-600">{cocktail.glassware}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span className="text-gray-600">{cocktail.prepTime} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-green-600" />
                      <span className="text-gray-600">{cocktail.abv} ABV</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-green-600" />
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
                              ? 'fill-lime-500 text-lime-500'
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
                      className="flex-1 bg-green-600 hover:bg-green-700"
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
                    <Badge className="bg-green-100 text-green-700">{selectedCocktail.category}</Badge>
                    <Badge className="bg-lime-100 text-lime-700">{selectedCocktail.spiritType}</Badge>
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
                        <Target className="w-5 h-5 text-green-500" />
                        Cocktail Stats
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                          <div className="text-sm text-gray-600">ABV</div>
                          <div className="text-xl font-bold text-green-600">{selectedCocktail.abv}</div>
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
                        <Sparkles className="w-5 h-5 text-lime-500" />
                        Ingredients
                      </h3>
                      <div className="space-y-2">
                        {selectedCocktail.ingredients.map((ingredient, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <Plus className="w-4 h-4 text-green-500" />
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
                        <BookOpen className="w-5 h-5 text-green-500" />
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
                    <div className="bg-lime-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-lime-500" />
                        Pro Tips
                      </h3>
                      <ul className="space-y-2 text-sm text-lime-900">
                        {selectedCocktail.spiritType === 'Mezcal' ? (
                          <>
                            <li>• Quality mezcal makes all the difference - look for artisanal brands</li>
                            <li>• A little smoke goes a long way - don't overpower other flavors</li>
                            <li>• Pair with agave nectar instead of simple syrup</li>
                            <li>• Mezcal is best savored - take your time with each sip</li>
                          </>
                        ) : (
                          <>
                            <li>• Always use 100% agave tequila for best results</li>
                            <li>• Fresh lime juice is essential - never use bottled</li>
                            <li>• Salt rim is traditional but optional - try tajín for a twist</li>
                            <li>• Chill your glassware for the perfect serve</li>
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
                        className="flex-1 bg-gradient-to-r from-green-600 to-lime-600 hover:from-green-700 hover:to-lime-700"
                        onClick={() => handleMakeCocktail(selectedCocktail)}
                      >
                        <Flame className="w-4 h-4 mr-2" />
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
          <Card className="mt-12 bg-gradient-to-br from-lime-50 to-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Flame className="w-7 h-7 text-green-600" />
                About Tequila & Mezcal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-lime-700">Tequila</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    Tequila is made exclusively from blue agave in specific regions of Mexico, primarily Jalisco. 
                    It must contain at least 51% blue agave (100% agave tequilas are premium). The production 
                    involves harvesting mature agave plants (8-12 years old), cooking the piñas, fermenting, 
                    and distilling the liquid.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-green-700">Mezcal</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    Mezcal can be made from over 30 types of agave across nine Mexican states, primarily Oaxaca. 
                    The distinctive smoky flavor comes from roasting agave hearts in underground pits. Often 
                    produced in small batches using traditional methods, mezcal offers complex, artisanal flavors.
                  </p>
                </div>
              </div>

              {/* Tequila Types */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-lime-700">Tequila Classifications</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-lime-200">
                    <div className="font-semibold text-lime-600 mb-2">Blanco (Silver)</div>
                    <div className="text-sm text-gray-700">Unaged or aged up to 2 months. Pure agave flavor, crisp and clean.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-lime-200">
                    <div className="font-semibold text-yellow-600 mb-2">Reposado</div>
                    <div className="text-sm text-gray-700">Aged 2-12 months. Golden color, smooth with oak notes.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-lime-200">
                    <div className="font-semibold text-amber-600 mb-2">Añejo</div>
                    <div className="text-sm text-gray-700">Aged 1-3 years. Dark amber, complex, sipping quality.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-lime-200">
                    <div className="font-semibold text-orange-700 mb-2">Extra Añejo</div>
                    <div className="text-sm text-gray-700">Aged 3+ years. Ultra-premium, rich and smooth.</div>
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
