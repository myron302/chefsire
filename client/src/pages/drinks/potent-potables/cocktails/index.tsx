import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Wine, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Search, Filter, Shuffle, Camera, Share2, ArrowLeft,
  Activity, BarChart3, Sparkles, Crown, GlassWater,
  BookOpen, Gem, Copy, Ruler
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';

// Classic cocktail data with servings
const classicCocktails = [
  {
    id: 'classic-1',
    name: 'Old Fashioned',
    description: 'The grandfather of all cocktails, simple and timeless',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop',
    ingredients: [
      { amount: '2 oz', item: 'Bourbon or Rye whiskey' },
      { amount: '1', item: 'Sugar cube' },
      { amount: '2-3 dashes', item: 'Angostura bitters' },
      { amount: '1', item: 'Orange peel' },
      { amount: 'As needed', item: 'Ice' }
    ],
    servings: 1,
    glassware: 'Rocks glass',
    method: 'Muddle',
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.8,
    reviews: 2341,
    trending: true,
    featured: true,
    tags: ['Whiskey', 'Classic', 'Strong', 'Stirred'],
    primaryTags: ['Spirit-forward'],
    secondaryTags: ['Strong'],
    benefits: ['Classic', 'Sophisticated', 'Timeless'],
    instructions: 'Muddle sugar cube with bitters and a splash of water in rocks glass. Add whiskey and large ice cube. Stir until chilled. Express orange peel oils over drink, then garnish.',
    history: 'Dating back to the 1880s, considered the original cocktail.',
    abv: '35%',
    era: '1880s',
    origin: 'United States',
    category: 'Spirit-forward',
    garnish: 'Orange peel',
    profile: ['Strong', 'Bitter-sweet', 'Aromatic', 'Classic'],
    calories: 180,
    bestTime: 'Evening',
    duration: '5 min'
  },
  {
    id: 'classic-2',
    name: 'Martini',
    description: 'The king of cocktails, gin and vermouth in perfect harmony',
    ingredients: [
      { amount: '2.5 oz', item: 'Gin' },
      { amount: '0.5 oz', item: 'Dry vermouth' },
      { amount: '1', item: 'Lemon twist or olive' },
      { amount: 'As needed', item: 'Ice' }
    ],
    servings: 1,
    glassware: 'Martini glass',
    method: 'Stir',
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.7,
    reviews: 1876,
    trending: false,
    featured: true,
    tags: ['Gin', 'Dry', 'Elegant', 'Stirred'],
    primaryTags: ['Spirit-forward'],
    secondaryTags: ['Dry'],
    benefits: ['Elegant', 'Sophisticated', 'Classic'],
    instructions: 'Stir gin and vermouth with ice until very cold. Strain into chilled martini glass. Garnish with lemon twist or olive.',
    history: 'Evolved from the Martinez in the 1880s, perfected in the early 1900s.',
    abv: '28%',
    era: '1880s',
    origin: 'United States',
    category: 'Spirit-forward',
    garnish: 'Lemon twist or olive',
    profile: ['Dry', 'Botanical', 'Strong', 'Elegant'],
    calories: 160,
    bestTime: 'Evening',
    duration: '3 min'
  },
  // ... other cocktails with similar structure updates
];

const cocktailEras = [
  { 
    id: '1850s-1880s', 
    name: 'Golden Age', 
    icon: Crown,
    color: 'bg-yellow-500',
    description: 'Birth of the cocktail era',
    cocktails: ['Sazerac', 'Old Fashioned', 'Manhattan']
  },
  // ... other eras
];

const cocktailCategories = [
  {
    id: 'spirit-forward',
    name: 'Spirit-Forward',
    description: 'Strong cocktails with minimal mixers',
    icon: Wine,
    color: 'text-purple-600',
    examples: ['Old Fashioned', 'Manhattan', 'Martini']
  },
  // ... other categories
];

export default function ClassicCocktailsPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedEra, setSelectedEra] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [selectedCocktail, setSelectedCocktail] = useState<typeof classicCocktails[0] | null>(null);
  const [servings, setServings] = useState(1);
  const [showAllIngredients, setShowAllIngredients] = useState(false);

  // Color mapping for cocktails
  const cocktailColor = 'purple'; // From specification: Cocktails: Purple (purple-600)

  const handleServingsChange = (change: number) => {
    const newServings = servings + change;
    if (newServings >= 1 && newServings <= 10) {
      setServings(newServings);
    }
  };

  const resetServings = () => {
    setServings(selectedCocktail?.servings || 1);
  };

  const getAdjustedAmount = (amount: string, baseServings: number) => {
    if (amount === 'As needed' || amount === 'To taste') return amount;
    
    const numericMatch = amount.match(/([\d.-]+)\s*(.*)/);
    if (numericMatch) {
      const [, number, unit] = numericMatch;
      const adjusted = (parseFloat(number) / baseServings) * servings;
      return `${adjusted % 1 === 0 ? adjusted : adjusted.toFixed(1)} ${unit}`.trim();
    }
    return amount;
  };

  const handleMakeCocktail = (cocktail: typeof classicCocktails[0]) => {
    incrementDrinksMade();
    addPoints(30, 'Made a classic cocktail'); // +30 XP for cocktails per spec
    setSelectedCocktail(null);
  };

  // Filter and sort logic remains the same...
  const getFilteredCocktails = () => {
    let filtered = classicCocktails.filter(cocktail => {
      const matchesSearch = cocktail.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           cocktail.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesEra = !selectedEra || cocktail.era.includes(selectedEra);
      const matchesCategory = !selectedCategory || cocktail.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesDifficulty = !selectedDifficulty || cocktail.difficulty === selectedDifficulty;
      
      return matchesSearch && matchesEra && matchesCategory && matchesDifficulty;
    });

    // Sort results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'era': return a.era.localeCompare(b.era);
        case 'difficulty': 
          const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
          return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
        case 'abv': return parseFloat(b.abv) - parseFloat(a.abv);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredCocktails = getFilteredCocktails();

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Potent Potables
                </Button>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-2">
                  <GlassWater className="h-6 w-6 text-purple-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Classic Cocktails</h1>
                  <Badge className="bg-purple-100 text-purple-800">Premium</Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <GlassWater className="fill-cyan-500 text-cyan-500" />
                  <span>Level {userProgress.level}</span>
                  <div className="w-px h-4 bg-gray-300" />
                  <span>{userProgress.totalPoints} XP</span>
                </div>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Camera className="h-4 w-4 mr-2" />
                  Share Recipe
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">26%</div>
                <div className="text-sm text-gray-600">Avg ABV</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">4.5★</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">4 min</div>
                <div className="text-sm text-gray-600">Avg Prep</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">8</div>
                <div className="text-sm text-gray-600">Classics</div>
              </CardContent>
            </Card>
          </div>

          {/* Rest of the component remains similar until we get to the cocktail cards */}

          {/* Updated Cocktail Card to match specification */}
          {filteredCocktails.map(cocktail => (
            <Card key={cocktail.id} className="mb-6 hover:shadow-lg transition-shadow">
              <CardHeader>
                {/* Title & Favorite Button */}
                <div className="flex items-start justify-between mb-3">
                  <CardTitle className="text-xl text-gray-900">{cocktail.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addToFavorites({
                      id: cocktail.id,
                      name: cocktail.name,
                      category: 'potent-potables',
                      timestamp: Date.now()
                    })}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Heart className={`h-5 w-5 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                </div>

                {/* Description */}
                <p className="text-gray-600 mb-4">{cocktail.description}</p>

                {/* Primary Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {cocktail.primaryTags?.map((tag, index) => (
                    <Badge key={index} className={`bg-${cocktailColor}-100 text-${cocktailColor}-800`}>
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Secondary Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {cocktail.secondaryTags?.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs">{cocktail.era}</Badge>
                  {cocktail.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                </div>

                {/* Rating & Difficulty - CRITICAL: Immediately above recipe card */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="font-medium">{cocktail.rating}</span>
                    <span className="text-gray-500 text-sm">({cocktail.reviews})</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {cocktail.difficulty}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                {/* Nutrition Grid */}
                <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{cocktail.calories}</div>
                    <div className="text-xs text-gray-600">Calories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{cocktail.abv}</div>
                    <div className="text-xs text-gray-600">ABV</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{cocktail.prepTime}m</div>
                    <div className="text-xs text-gray-600">Prep Time</div>
                  </div>
                </div>

                {/* Recipe Card Preview */}
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  {/* Recipe Header with Serving Controls */}
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900">Recipe (serves {cocktail.servings})</h4>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleServingsChange(-1)}
                        disabled={servings <= 1}
                        className="h-8 w-8 p-0"
                      >
                        -
                      </Button>
                      <span className="text-sm font-medium w-8 text-center">{servings}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleServingsChange(1)}
                        disabled={servings >= 10}
                        className="h-8 w-8 p-0"
                      >
                        +
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetServings}
                        className="h-8 text-xs"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div className="space-y-2 mb-4">
                    {cocktail.ingredients.slice(0, showAllIngredients ? cocktail.ingredients.length : 4).map((ingredient, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className={`h-4 w-4 text-${cocktailColor}-600`} />
                        <span className="text-sm">
                          <span className={`text-${cocktailColor}-700 font-semibold`}>
                            {getAdjustedAmount(ingredient.amount, cocktail.servings)}
                          </span>{' '}
                          {ingredient.item}
                        </span>
                      </div>
                    ))}
                    
                    {cocktail.ingredients.length > 4 && !showAllIngredients && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllIngredients(true)}
                        className="text-purple-600 hover:text-purple-700 text-xs"
                      >
                        +{cocktail.ingredients.length - 4} more ingredients
                      </Button>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Ruler className="h-4 w-4 mr-2" />
                      Metric
                    </Button>
                  </div>
                </div>

                {/* Duration & Best Time */}
                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{cocktail.duration}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Best in {cocktail.bestTime}</span>
                  </div>
                </div>

                {/* Benefits Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {cocktail.benefits?.slice(0, 3).map((benefit, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary"
                      className={`bg-${cocktailColor}-100 text-${cocktailColor}-800 hover:bg-${cocktailColor}-200`}
                    >
                      {benefit}
                    </Badge>
                  ))}
                </div>

                {/* Make Button */}
                <Button 
                  className={`w-full bg-${cocktailColor}-600 hover:bg-${cocktailColor}-700`}
                  onClick={() => {
                    setSelectedCocktail(cocktail);
                    setServings(cocktail.servings);
                    setShowAllIngredients(false);
                  }}
                >
                  <GlassWater className="h-4 w-4 mr-2" />
                  Make Cocktail (+30 XP)
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Updated Cocktail Detail Modal */}
          {selectedCocktail && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedCocktail(null)}>
              <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <CardTitle className="text-2xl text-gray-900">{selectedCocktail.name}</CardTitle>
                      <p className="text-gray-600 mt-1">{selectedCocktail.description}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCocktail(null)}>×</Button>
                  </div>

                  {/* Primary Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedCocktail.primaryTags?.map((tag, index) => (
                      <Badge key={index} className={`bg-${cocktailColor}-100 text-${cocktailColor}-800`}>
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Secondary Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedCocktail.secondaryTags?.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-xs">{selectedCocktail.era}</Badge>
                    <Badge variant="outline" className="text-xs">{selectedCocktail.category}</Badge>
                  </div>

                  {/* Rating & Difficulty - CRITICAL: Immediately above recipe card */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{selectedCocktail.rating}</span>
                      <span className="text-gray-500 text-sm">({selectedCocktail.reviews})</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {selectedCocktail.difficulty}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Nutrition Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{selectedCocktail.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{selectedCocktail.abv}</div>
                      <div className="text-xs text-gray-600">ABV</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{selectedCocktail.prepTime}m</div>
                      <div className="text-xs text-gray-600">Prep Time</div>
                    </div>
                  </div>

                  {/* Recipe Card Preview */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    {/* Recipe Header with Serving Controls */}
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">Recipe (serves {selectedCocktail.servings})</h4>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleServingsChange(-1)}
                          disabled={servings <= 1}
                          className="h-8 w-8 p-0"
                        >
                          -
                        </Button>
                        <span className="text-sm font-medium w-8 text-center">{servings}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleServingsChange(1)}
                          disabled={servings >= 10}
                          className="h-8 w-8 p-0"
                        >
                          +
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={resetServings}
                          className="h-8 text-xs"
                        >
                          Reset
                        </Button>
                      </div>
                    </div>

                    {/* Ingredients */}
                    <div className="space-y-2 mb-4">
                      {selectedCocktail.ingredients.slice(0, showAllIngredients ? selectedCocktail.ingredients.length : 4).map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <CheckCircle className={`h-4 w-4 text-${cocktailColor}-600`} />
                          <span className="text-sm">
                            <span className={`text-${cocktailColor}-700 font-semibold`}>
                              {getAdjustedAmount(ingredient.amount, selectedCocktail.servings)}
                            </span>{' '}
                            {ingredient.item}
                          </span>
                        </div>
                      ))}
                      
                      {selectedCocktail.ingredients.length > 4 && !showAllIngredients && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllIngredients(true)}
                          className={`text-${cocktailColor}-600 hover:text-${cocktailColor}-700 text-xs`}
                        >
                          +{selectedCocktail.ingredients.length - 4} more ingredients
                        </Button>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Ruler className="h-4 w-4 mr-2" />
                        Metric
                      </Button>
                    </div>
                  </div>

                  {/* Additional cocktail details */}
                  <div className="space-y-4">
                    {/* Historical Note */}
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Historical Note
                      </h4>
                      <p className="text-sm text-purple-800">{selectedCocktail.history}</p>
                    </div>

                    {/* Instructions */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-500" />
                        Instructions
                      </h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-700">{selectedCocktail.instructions}</p>
                      </div>
                    </div>

                    {/* Glassware & Garnish */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-gray-600">Glassware</div>
                        <div className="font-bold text-blue-600">{selectedCocktail.glassware}</div>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-sm text-gray-600">Garnish</div>
                        <div className="font-bold text-green-600">{selectedCocktail.garnish}</div>
                      </div>
                    </div>

                    {/* Duration & Best Time */}
                    <div className="flex items-center justify-between text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{selectedCocktail.duration}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Best in {selectedCocktail.bestTime}</span>
                      </div>
                    </div>

                    {/* Benefits Tags */}
                    <div className="flex flex-wrap gap-2">
                      {selectedCocktail.benefits?.slice(0, 3).map((benefit, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          className={`bg-${cocktailColor}-100 text-${cocktailColor}-800 hover:bg-${cocktailColor}-200`}
                        >
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Make Button */}
                  <Button 
                    className={`w-full mt-6 bg-${cocktailColor}-600 hover:bg-${cocktailColor}-700`}
                    onClick={() => handleMakeCocktail(selectedCocktail)}
                  >
                    <GlassWater className="h-4 w-4 mr-2" />
                    Make Cocktail (+30 XP)
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </RequireAgeGate>
  );
}
