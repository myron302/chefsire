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
  const [selectedDrink, setSelectedDrink] = useState<typeof virginDrinks[0] | null>(null);

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

        {/* Recipe Detail Modal */}
        {selectedDrink && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto pt-8 pb-8">
            <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl">
              {/* Modal Header */}
              <div className="relative bg-gradient-to-br from-green-100 to-emerald-100 p-8 rounded-t-2xl">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDrink(null)}
                  className="absolute top-4 right-4 bg-white/80 hover:bg-white"
                >
                  <span className="text-xl">×</span>
                </Button>
                
                <div className="flex items-start gap-4">
                  <Sparkles className="w-16 h-16 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedDrink.name}</h2>
                    <p className="text-gray-700 mb-3">{selectedDrink.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-emerald-600">{selectedDrink.category}</Badge>
                      <Badge variant="outline">{selectedDrink.difficulty}</Badge>
                      {selectedDrink.vegan && (
                        <Badge className="bg-green-600">
                          <Leaf className="w-3 h-3 mr-1" />
                          Vegan
                        </Badge>
                      )}
                      {selectedDrink.glutenFree && (
                        <Badge className="bg-amber-600">Gluten-Free</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto">
                {/* Quick Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs text-gray-500">Prep Time</div>
                    <div className="font-semibold">{selectedDrink.prepTime} min</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <GlassWater className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs text-gray-500">Glass</div>
                    <div className="font-semibold text-sm">{selectedDrink.glassware}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Droplets className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs text-gray-500">Serving</div>
                    <div className="font-semibold">{selectedDrink.servingSize}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Sun className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs text-gray-500">Best Time</div>
                    <div className="font-semibold text-sm">{selectedDrink.bestTime}</div>
                  </div>
                </div>

                {/* Nutrition Facts */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Nutrition Information</h3>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">{selectedDrink.nutrition.calories}</div>
                      <div className="text-xs text-gray-500">Calories</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">{selectedDrink.nutrition.carbs}g</div>
                      <div className="text-xs text-gray-500">Carbs</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">{selectedDrink.nutrition.sugar}g</div>
                      <div className="text-xs text-gray-500">Sugar</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">{selectedDrink.nutrition.protein}g</div>
                      <div className="text-xs text-gray-500">Protein</div>
                    </div>
                  </div>
                </div>

                {/* Ingredients */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-emerald-600" />
                    Ingredients
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <ul className="space-y-2">
                      {selectedDrink.ingredients.map((ingredient, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-emerald-600 mt-1">•</span>
                          <span className="text-gray-700">{ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Method */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-600" />
                    Method
                  </h3>
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Badge className="bg-emerald-600">{selectedDrink.method}</Badge>
                      <span className="text-sm">for this mocktail</span>
                    </div>
                  </div>
                </div>

                {/* Flavor Profile */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Flavor Profile</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDrink.profile.map((flavor, index) => (
                      <Badge key={index} variant="secondary" className="text-sm">
                        {flavor}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Garnish */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Cherry className="w-5 h-5 text-emerald-600" />
                    Garnish
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">{selectedDrink.garnish}</p>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Origin:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedDrink.origin}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Occasion:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedDrink.occasion}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Est. Cost:</span>
                    <span className="ml-2 font-semibold text-gray-900">${selectedDrink.estimatedCost.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">
