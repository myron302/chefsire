import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Wine, Clock, Heart, Star, Target, Sparkles, Flame, 
  Search, Share2, ArrowLeft, Plus, Camera, GlassWater,
  TrendingUp, Award, Crown, Leaf, Mountain, Droplets, Zap, Cherry
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const whiskeyCocktails = [
  {
    id: 'whiskey-1',
    name: 'Old Fashioned',
    description: 'The grandfather of cocktails - bourbon, sugar, bitters',
    spiritType: 'Bourbon',
    origin: 'Louisville, Kentucky',
    glassware: 'Old Fashioned Glass',
    servingSize: '4 oz',
    nutrition: { calories: 155, carbs: 4, sugar: 3, alcohol: 14 },
    ingredients: ['Bourbon (2 oz)', 'Sugar Cube (1)', 'Angostura Bitters (2-3 dashes)', 'Orange Peel', 'Maraschino Cherry', 'Large Ice Cube'],
    profile: ['Strong', 'Bitter-Sweet', 'Aromatic', 'Classic'],
    difficulty: 'Easy',
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
    iba_official: true
  },
  {
    id: 'whiskey-2',
    name: 'Mint Julep',
    description: 'Kentucky Derby classic with bourbon and fresh mint',
    spiritType: 'Bourbon',
    origin: 'Southern United States',
    glassware: 'Julep Cup',
    servingSize: '8 oz',
    nutrition: { calories: 168, carbs: 12, sugar: 10, alcohol: 12 },
    ingredients: ['Bourbon (2.5 oz)', 'Fresh Mint Leaves (10-12)', 'Simple Syrup (0.5 oz)', 'Crushed Ice', 'Mint Sprig', 'Powdered Sugar (optional)'],
    profile: ['Minty', 'Refreshing', 'Southern', 'Classic'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 3892,
    trending: false,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Afternoon',
    occasion: 'Derby Party',
    allergens: [],
    category: 'Bourbon Classics',
    garnish: 'Mint sprig, powdered sugar',
    method: 'Muddle & Build',
    abv: '20-24%',
    iba_official: true
  },
  {
    id: 'whiskey-3',
    name: 'Manhattan',
    description: 'Sophisticated blend of whiskey and vermouth',
    spiritType: 'Rye Whiskey',
    origin: 'New York City, USA',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: { calories: 185, carbs: 6, sugar: 4, alcohol: 16 },
    ingredients: ['Rye Whiskey (2 oz)', 'Sweet Vermouth (1 oz)', 'Angostura Bitters (2 dashes)', 'Maraschino Cherry', 'Ice'],
    profile: ['Rich', 'Complex', 'Herbal', 'Sophisticated'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 4567,
    trending: true,
    featured: true,
    estimatedCost: 5.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Whiskey Classics',
    garnish: 'Maraschino cherry',
    method: 'Stir',
    abv: '28-32%',
    iba_official: true
  },
  {
    id: 'whiskey-4',
    name: 'Whiskey Sour',
    description: 'Classic sour with whiskey, lemon, and egg white',
    spiritType: 'Bourbon',
    origin: 'United States',
    glassware: 'Coupe Glass',
    servingSize: '5 oz',
    nutrition: { calories: 195, carbs: 12, sugar: 10, alcohol: 13 },
    ingredients: ['Bourbon (2 oz)', 'Fresh Lemon Juice (0.75 oz)', 'Simple Syrup (0.5 oz)', 'Egg White (1)', 'Angostura Bitters', 'Ice'],
    profile: ['Tart', 'Frothy', 'Balanced', 'Classic'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 4123,
    trending: true,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Evening',
    occasion: 'Cocktail Party',
    allergens: ['Eggs'],
    category: 'Bourbon Classics',
    garnish: 'Lemon wheel, bitters design',
    method: 'Shake',
    abv: '22-26%',
    iba_official: true
  },
  {
    id: 'whiskey-5',
    name: 'Boulevardier',
    description: 'Whiskey Negroni with bourbon, Campari, vermouth',
    spiritType: 'Bourbon',
    origin: 'Paris, France',
    glassware: 'Old Fashioned Glass',
    servingSize: '4 oz',
    nutrition: { calories: 195, carbs: 8, sugar: 6, alcohol: 17 },
    ingredients: ['Bourbon (1.5 oz)', 'Campari (1 oz)', 'Sweet Vermouth (1 oz)', 'Orange Peel', 'Ice'],
    profile: ['Bitter', 'Complex', 'Bold', 'Sophisticated'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 2876,
    trending: true,
    featured: true,
    estimatedCost: 5.50,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Modern Whiskey',
    garnish: 'Orange peel',
    method: 'Stir',
    abv: '30-34%',
    iba_official: false
  },
  {
    id: 'whiskey-6',
    name: 'Sazerac',
    description: 'New Orleans classic with rye and absinthe rinse',
    spiritType: 'Rye Whiskey',
    origin: 'New Orleans, Louisiana',
    glassware: 'Old Fashioned Glass',
    servingSize: '3 oz',
    nutrition: { calories: 180, carbs: 4, sugar: 3, alcohol: 19 },
    ingredients: ['Rye Whiskey (2 oz)', 'Sugar Cube (1)', "Peychaud's Bitters (3 dashes)", 'Absinthe (rinse)', 'Lemon Peel', 'Ice'],
    profile: ['Anise', 'Bold', 'Aromatic', 'Historic'],
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.7,
    reviews: 2345,
    trending: false,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Sophisticated',
    allergens: [],
    category: 'Whiskey Classics',
    garnish: 'Lemon peel',
    method: 'Stir',
    abv: '35-40%',
    iba_official: true
  },
  {
    id: 'whiskey-7',
    name: 'Whiskey Highball',
    description: 'Simple Japanese-style whiskey and soda',
    spiritType: 'Japanese Whisky',
    origin: 'Japan',
    glassware: 'Highball Glass',
    servingSize: '8 oz',
    nutrition: { calories: 155, carbs: 0, sugar: 0, alcohol: 12 },
    ingredients: ['Japanese Whisky (2 oz)', 'Soda Water (5 oz)', 'Lemon Peel', 'Large Ice Cubes'],
    profile: ['Clean', 'Crisp', 'Refreshing', 'Simple'],
    difficulty: 'Very Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 1987,
    trending: true,
    featured: false,
    estimatedCost: 4.50,
    bestTime: 'Anytime',
    occasion: 'Casual',
    allergens: [],
    category: 'Modern Whiskey',
    garnish: 'Lemon peel',
    method: 'Build',
    abv: '12-15%',
    iba_official: false
  },
  {
    id: 'whiskey-8',
    name: 'Gold Rush',
    description: 'Modern classic with bourbon, honey, and lemon',
    spiritType: 'Bourbon',
    origin: 'New York City, USA',
    glassware: 'Old Fashioned Glass',
    servingSize: '4 oz',
    nutrition: { calories: 205, carbs: 14, sugar: 12, alcohol: 14 },
    ingredients: ['Bourbon (2 oz)', 'Fresh Lemon Juice (0.75 oz)', 'Honey Syrup (0.75 oz)', 'Lemon Wheel', 'Ice'],
    profile: ['Sweet', 'Tart', 'Smooth', 'Modern'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 3456,
    trending: true,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Evening',
    occasion: 'Cocktail Party',
    allergens: [],
    category: 'Modern Whiskey',
    garnish: 'Lemon wheel',
    method: 'Shake',
    abv: '24-28%',
    iba_official: false
  },
  {
    id: 'whiskey-9',
    name: 'New York Sour',
    description: 'Whiskey sour with red wine float',
    spiritType: 'Rye Whiskey',
    origin: 'New York City, USA',
    glassware: 'Old Fashioned Glass',
    servingSize: '5 oz',
    nutrition: { calories: 220, carbs: 15, sugar: 12, alcohol: 15 },
    ingredients: ['Rye Whiskey (2 oz)', 'Fresh Lemon Juice (0.75 oz)', 'Simple Syrup (0.5 oz)', 'Egg White (1)', 'Red Wine (float, 0.5 oz)', 'Ice'],
    profile: ['Tart', 'Complex', 'Layered', 'Sophisticated'],
    difficulty: 'Hard',
    prepTime: 6,
    rating: 4.7,
    reviews: 1654,
    trending: true,
    featured: true,
    estimatedCost: 6.00,
    bestTime: 'Evening',
    occasion: 'Impressive',
    allergens: ['Eggs'],
    category: 'Modern Whiskey',
    garnish: 'Lemon wheel',
    method: 'Shake & Float',
    abv: '22-26%',
    iba_official: false
  },
  {
    id: 'whiskey-10',
    name: 'Hot Toddy',
    description: 'Warm whiskey with honey, lemon, and spices',
    spiritType: 'Bourbon',
    origin: 'Scotland/Ireland',
    glassware: 'Irish Coffee Glass',
    servingSize: '8 oz',
    nutrition: { calories: 175, carbs: 12, sugar: 10, alcohol: 12 },
    ingredients: ['Bourbon (2 oz)', 'Honey (1 tbsp)', 'Fresh Lemon Juice (0.5 oz)', 'Hot Water (4 oz)', 'Cinnamon Stick', 'Cloves (2-3)', 'Lemon Wheel'],
    profile: ['Warm', 'Soothing', 'Spicy', 'Comforting'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 2987,
    trending: false,
    featured: true,
    estimatedCost: 3.50,
    bestTime: 'Evening',
    occasion: 'Cold Weather',
    allergens: [],
    category: 'Bourbon Classics',
    garnish: 'Cinnamon stick, lemon wheel',
    method: 'Build',
    abv: '12-15%',
    iba_official: false
  },
  {
    id: 'whiskey-11',
    name: 'Whiskey Smash',
    description: 'Refreshing bourbon with lemon and mint',
    spiritType: 'Bourbon',
    origin: 'United States',
    glassware: 'Old Fashioned Glass',
    servingSize: '5 oz',
    nutrition: { calories: 185, carbs: 11, sugar: 9, alcohol: 13 },
    ingredients: ['Bourbon (2 oz)', 'Fresh Lemon Juice (0.75 oz)', 'Simple Syrup (0.5 oz)', 'Fresh Mint Leaves (6-8)', 'Mint Sprig', 'Ice'],
    profile: ['Refreshing', 'Minty', 'Citrus', 'Balanced'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 2234,
    trending: false,
    featured: false,
    estimatedCost: 4.00,
    bestTime: 'Afternoon',
    occasion: 'Casual',
    allergens: [],
    category: 'Bourbon Classics',
    garnish: 'Mint sprig',
    method: 'Muddle & Shake',
    abv: '20-24%',
    iba_official: false
  },
  {
    id: 'whiskey-12',
    name: 'Paper Plane',
    description: 'Modern equal-parts cocktail with bourbon and Aperol',
    spiritType: 'Bourbon',
    origin: 'Chicago, USA',
    glassware: 'Coupe Glass',
    servingSize: '4 oz',
    nutrition: { calories: 195, carbs: 10, sugar: 8, alcohol: 15 },
    ingredients: ['Bourbon (0.75 oz)', 'Aperol (0.75 oz)', 'Amaro Nonino (0.75 oz)', 'Fresh Lemon Juice (0.75 oz)', 'Ice'],
    profile: ['Balanced', 'Bitter-Sweet', 'Citrus', 'Complex'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 1876,
    trending: true,
    featured: true,
    estimatedCost: 7.00,
    bestTime: 'Evening',
    occasion: 'Cocktail Party',
    allergens: [],
    category: 'Modern Whiskey',
    garnish: 'None',
    method: 'Shake',
    abv: '24-28%',
    iba_official: false
  }
];

export default function WhiskeyBourbonPage() {
  const { favorites, toggleFavorite } = useDrinks();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [selectedCocktail, setSelectedCocktail] = useState<typeof whiskeyCocktails[0] | null>(null);

  const categories = ['Bourbon Classics', 'Whiskey Classics', 'Modern Whiskey'];
  const difficulties = ['Very Easy', 'Easy', 'Medium', 'Hard'];

  const filteredCocktails = whiskeyCocktails.filter(cocktail => {
    const matchesSearch = cocktail.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cocktail.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || cocktail.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || cocktail.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });
 return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        {showUniversalSearch && (
          <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
        )}

        {selectedCocktail && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto pt-8 pb-8">
            <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl">
              <div className="relative bg-gradient-to-br from-amber-100 to-orange-100 p-8 rounded-t-2xl">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedCocktail(null)}
                  className="absolute top-4 right-4 bg-white/80 hover:bg-white"
                >
                  <span className="text-xl">×</span>
                </Button>
                
                <div className="flex items-start gap-4">
                  <Wine className="w-16 h-16 text-amber-700 flex-shrink-0" />
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedCocktail.name}</h2>
                    <p className="text-gray-700 mb-3">{selectedCocktail.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-amber-700">{selectedCocktail.category}</Badge>
                      <Badge variant="outline">{selectedCocktail.difficulty}</Badge>
                      {selectedCocktail.iba_official && (
                        <Badge className="bg-blue-600">
                          <Award className="w-3 h-3 mr-1" />
                          IBA Official
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-5 h-5 mx-auto mb-1 text-amber-700" />
                    <div className="text-xs text-gray-500">Prep Time</div>
                    <div className="font-semibold">{selectedCocktail.prepTime} min</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <GlassWater className="w-5 h-5 mx-auto mb-1 text-amber-700" />
                    <div className="text-xs text-gray-500">Glass</div>
                    <div className="font-semibold text-sm">{selectedCocktail.glassware}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Wine className="w-5 h-5 mx-auto mb-1 text-amber-700" />
                    <div className="text-xs text-gray-500">Serving</div>
                    <div className="font-semibold">{selectedCocktail.servingSize}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Flame className="w-5 h-5 mx-auto mb-1 text-amber-700" />
                    <div className="text-xs text-gray-500">ABV</div>
                    <div className="font-semibold text-sm">{selectedCocktail.abv}</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Nutrition Information</h3>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-amber-700">{selectedCocktail.nutrition.calories}</div>
                      <div className="text-xs text-gray-500">Calories</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-700">{selectedCocktail.nutrition.carbs}g</div>
                      <div className="text-xs text-gray-500">Carbs</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-700">{selectedCocktail.nutrition.sugar}g</div>
                      <div className="text-xs text-gray-500">Sugar</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-700">{selectedCocktail.nutrition.alcohol}g</div>
                      <div className="text-xs text-gray-500">Alcohol</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-amber-700" />
                    Ingredients
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <ul className="space-y-2">
                      {selectedCocktail.ingredients.map((ingredient, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-amber-700 mt-1">•</span>
                          <span className="text-gray-700">{ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-700" />
                    Method
                  </h3>
                  <div className="bg-amber-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Badge className="bg-amber-700">{selectedCocktail.method}</Badge>
                      <span className="text-sm">for this cocktail</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Flavor Profile</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCocktail.profile.map((flavor, index) => (
                      <Badge key={index} variant="secondary" className="text-sm">
                        {flavor}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Cherry className="w-5 h-5 text-amber-700" />
                    Garnish
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">{selectedCocktail.garnish}</p>
                  </div>
                </div>

                {selectedCocktail.allergens.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Allergens</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCocktail.allergens.map((allergen, index) => (
                        <Badge key={index} variant="destructive" className="text-sm">
                          {allergen}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Origin:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedCocktail.origin}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Occasion:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedCocktail.occasion}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Est. Cost:</span>
                    <span className="ml-2 font-semibold text-gray-900">${selectedCocktail.estimatedCost.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rating:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedCocktail.rating} / 5.0</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
                <Button 
                  className="flex-1 bg-amber-700 hover:bg-amber-800"
                  onClick={() => toggleFavorite(selectedCocktail.id, 'whiskey-bourbon')}
                >
                  <Heart
                    className={`w-4 h-4 mr-2 ${
                      favorites['whiskey-bourbon']?.includes(selectedCocktail.id) ? 'fill-white' : ''
                    }`}
                  />
                  {favorites['whiskey-bourbon']?.includes(selectedCocktail.id) ? 'Saved' : 'Save Recipe'}
                </Button>
                <Button variant="outline" className="flex-1">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-amber-700 via-orange-700 to-red-700 text-white py-16 px-4">
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
              <Wine className="w-12 h-12" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Whiskey & Bourbon</h1>
                <p className="text-xl text-white/90">From Kentucky bourbon to classic rye whiskey</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search whiskey cocktails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 py-6 text-lg bg-white/95 border-0"
                />
              </div>
              <Button
                onClick={() => setShowUniversalSearch(true)}
                className="bg-white text-amber-700 hover:bg-white/90 px-6"
                size="lg"
              >
                <Target className="w-5 h-5 mr-2" />
                Advanced Search
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{whiskeyCocktails.length}</div>
                <div className="text-white/80 text-sm">Cocktails</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{categories.length}</div>
                <div className="text-white/80 text-sm">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{whiskeyCocktails.filter(c => c.trending).length}</div>
                <div className="text-white/80 text-sm">Trending</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold">{whiskeyCocktails.filter(c => c.iba_official).length}</div>
                <div className="text-white/80 text-sm">IBA Official</div>
              </div>
            </div>
          </div>
        </div>

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
                    className={selectedCategory === null ? "bg-amber-700" : ""}
                  >
                    All
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={selectedCategory === category ? "bg-amber-700" : ""}
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
                    className={selectedDifficulty === null ? "bg-amber-700" : ""}
                  >
                    All Levels
                  </Button>
                  {difficulties.map(diff => (
                    <Button
                      key={diff}
                      variant={selectedDifficulty === diff ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDifficulty(diff)}
                      className={selectedDifficulty === diff ? "bg-amber-700" : ""}
                    >
                      {diff}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 text-gray-600">
            Showing {filteredCocktails.length} of {whiskeyCocktails.length} cocktails
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCocktails.map((cocktail) => (
              <Card key={cocktail.id} className="hover:shadow-lg transition-all duration-300 overflow-hidden group">
                <div className="relative bg-gradient-to-br from-amber-100 to-orange-100 p-6 h-48 flex items-center justify-center">
                  <Wine className="w-20 h-20 text-amber-700 group-hover:scale-110 transition-transform" />
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
                    onClick={() => toggleFavorite(cocktail.id, 'whiskey-bourbon')}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        favorites['whiskey-bourbon']?.includes(cocktail.id)
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
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <GlassWater className="w-4 h-4 text-amber-700" />
                      <span className="text-gray-600">{cocktail.glassware}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-700" />
                      <span className="text-gray-600">{cocktail.prepTime} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-700" />
                      <span className="text-gray-600">{cocktail.abv} ABV</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wine className="w-4 h-4 text-amber-700" />
                      <span className="text-gray-600">{cocktail.spiritType}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <GlassWater
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(cocktail.rating)
                              ? 'fill-amber-500 text-amber-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">{cocktail.rating}</span>
                    <span className="text-sm text-gray-500">({cocktail.reviews.toLocaleString()})</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {cocktail.profile.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

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

                  <div className="pt-3 border-t">
                    <div className="text-sm font-semibold mb-2 text-gray-700">Main Ingredients:</div>
                    <div className="text-sm text-gray-600">
                      {cocktail.ingredients.slice(0, 3).join(' • ')}
                      {cocktail.ingredients.length > 3 && '...'}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3">
                    <Button 
                      className="flex-1 bg-amber-700 hover:bg-amber-800"
                      onClick={() => setSelectedCocktail(cocktail)}
                    >
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

          <Card className="mt-12 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Wine className="w-7 h-7 text-amber-700" />
                About Whiskey & Bourbon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-gray-700 leading-relaxed">
                Whiskey is a distilled spirit made from fermented grain mash, aged in wooden barrels. The term 
                encompasses many regional styles including bourbon, rye, Tennessee whiskey, and more. Each style 
                has distinct characteristics based on the grains used, distillation method, and aging process.
              </p>

              <div>
                <h3 className="font-semibold text-lg mb-3 text-amber-700">Types of Whiskey</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-amber-200">
                    <div className="font-semibold text-amber-700 mb-2">Bourbon</div>
                    <div className="text-sm text-gray-700">Must be made in USA with 51%+ corn. Aged in new charred oak. Sweet, vanilla notes.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-amber-200">
                    <div className="font-semibold text-orange-700 mb-2">Rye Whiskey</div>
                    <div className="text-sm text-gray-700">51%+ rye grain. Spicy, peppery character. Popular in classic cocktails.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-amber-200">
                    <div className="font-semibold text-red-700 mb-2">Tennessee Whiskey</div>
                    <div className="text-sm text-gray-700">Similar to bourbon but charcoal filtered. Smooth, mellow flavor.</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-amber-200">
                    <div className="font-semibold text-yellow-700 mb-2">Japanese Whisky</div>
                    <div className="text-sm text-gray-700">Inspired by Scotch. Delicate, refined, increasingly popular worldwide.</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3 text-amber-700">Whiskey Cocktail Traditions</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2 text-amber-600">Bourbon Classics</h4>
                    <p className="text-sm text-gray-700">Southern staples like Old Fashioned, Mint Julep, and Whiskey Sour that celebrate American bourbon.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-orange-600">Rye Heritage</h4>
                    <p className="text-sm text-gray-700">Historic cocktails like Manhattan and Sazerac that showcase rye's spicy character.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-red-600">Modern Craft</h4>
                    <p className="text-sm text-gray-700">Contemporary creations like Paper Plane and Gold Rush from today's mixology scene.</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-r from-amber-100 to-orange-100 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-amber-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  What Makes It Bourbon?
                </h3>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• Must be made in the United States</li>
                  <li>• Mash bill must be at least 51% corn</li>
                  <li>• Distilled to no more than 160 proof (80% ABV)</li>
                  <li>• Aged in new charred oak barrels</li>
                  <li>• Entered into barrel at no more than 125 proof</li>
                  <li>• Bottled at 80 proof or higher</li>
                  <li>• No additives allowed except water</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
} 
