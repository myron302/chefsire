import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Cookie, Clock, Heart, Star, ArrowLeft, Leaf, Search, Share2,
  AlertCircle, Info, CheckCircle, Snowflake, Baby, Utensils, BookOpen,
  Apple
} from 'lucide-react';

const fingerFoodRecipes = [
  {
    id: 'finger-1',
    name: 'Sweet Potato Toast Strips',
    description: 'Perfect first finger food - soft, easy to grip, nutrient-dense',
    category: 'Vegetables',
    prepTime: 25,
    servings: 4,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 45,
      protein: 1,
      carbs: 11,
      fat: 0,
      fiber: 2,
      vitaminA: 'Very High'
    },
    ingredients: [
      '1 large sweet potato',
      'Olive oil spray (optional)'
    ],
    instructions: [
      'Slice sweet potato lengthwise into 1/2 inch thick planks',
      'Bake at 400°F for 20-25 minutes until soft',
      'Let cool, cut into strips baby can hold',
      'Serve at room temperature'
    ],
    storage: 'Refrigerate 3 days or freeze up to 2 months',
    rating: 4.9,
    reviews: 2134,
    freezable: true,
    featured: true,
    chokingRisk: 'Low',
    gripStyle: 'Strip',
    tips: 'Perfect size for baby to hold. Soft enough to gum but sturdy enough not to break apart.'
  },
  {
    id: 'finger-2',
    name: 'Mini Veggie Muffins',
    description: 'Hidden vegetables in portable, baby-friendly bites',
    category: 'Baked Goods',
    prepTime: 30,
    servings: 12,
    difficulty: 'Medium',
    organic: false,
    vegetarian: true,
    vegan: false,
    allergens: ['Eggs', 'Wheat', 'Dairy'],
    nutrition: {
      calories: 65,
      protein: 3,
      carbs: 9,
      fat: 2,
      fiber: 1,
      iron: 0.8
    },
    ingredients: [
      '1 cup whole wheat flour',
      '2 eggs',
      '1 cup grated zucchini',
      '1/2 cup grated carrot',
      '1/4 cup shredded cheese',
      '1/4 cup plain yogurt'
    ],
    instructions: [
      'Mix wet and dry ingredients separately',
      'Fold in vegetables and cheese',
      'Fill mini muffin tins 3/4 full',
      'Bake at 350°F for 15-18 minutes'
    ],
    storage: 'Refrigerate 4 days or freeze up to 3 months',
    rating: 4.8,
    reviews: 1567,
    freezable: true,
    featured: true,
    chokingRisk: 'Low',
    gripStyle: 'Pinch',
    tips: 'Great for batch cooking! Freeze individually wrapped. Perfect pincer grasp practice.'
  },
  {
    id: 'finger-3',
    name: 'Banana Oat Pancakes',
    description: 'Two-ingredient breakfast perfect for self-feeding',
    category: 'Breakfast',
    prepTime: 15,
    servings: 8,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 52,
      protein: 2,
      carbs: 10,
      fat: 1,
      fiber: 2,
      potassium: 'Good'
    },
    ingredients: [
      '2 ripe bananas',
      '1 cup oat flour (blended oats)',
      'Optional: cinnamon'
    ],
    instructions: [
      'Mash bananas thoroughly',
      'Mix in oat flour until combined',
      'Cook small pancakes on griddle',
      'Cut into strips when cool'
    ],
    storage: 'Refrigerate 3 days or freeze up to 2 months',
    rating: 4.7,
    reviews: 2890,
    freezable: true,
    featured: true,
    chokingRisk: 'Low',
    gripStyle: 'Strip',
    tips: 'No added sugar needed! Naturally sweet and soft. Great for breakfast or snacks.'
  },
  {
    id: 'finger-4',
    name: 'Cheese & Broccoli Tots',
    description: 'Veggie-packed bites with protein boost',
    category: 'Vegetables',
    prepTime: 35,
    servings: 16,
    difficulty: 'Medium',
    organic: false,
    vegetarian: true,
    vegan: false,
    allergens: ['Dairy', 'Eggs'],
    nutrition: {
      calories: 48,
      protein: 3,
      carbs: 4,
      fat: 2,
      calcium: 65,
      vitaminC: 'Good'
    },
    ingredients: [
      '2 cups finely chopped broccoli, cooked',
      '1 cup shredded cheddar',
      '1 egg',
      '1/4 cup breadcrumbs'
    ],
    instructions: [
      'Steam broccoli until very soft, chop fine',
      'Mix all ingredients',
      'Form into small tots',
      'Bake at 375°F for 20 minutes'
    ],
    storage: 'Refrigerate 3 days or freeze up to 2 months',
    rating: 4.6,
    reviews: 1234,
    freezable: true,
    featured: false,
    chokingRisk: 'Low',
    gripStyle: 'Pinch',
    tips: 'Great way to introduce cruciferous vegetables! Soft interior, slightly crispy outside.'
  },
  {
    id: 'finger-5',
    name: 'Soft Pasta Spirals',
    description: 'Fun shape, easy to grip, perfect plain or with sauce',
    category: 'Grains',
    prepTime: 12,
    servings: 4,
    difficulty: 'Easy',
    organic: false,
    vegetarian: true,
    vegan: true,
    allergens: ['Wheat'],
    nutrition: {
      calories: 78,
      protein: 3,
      carbs: 15,
      fat: 1,
      fiber: 1,
      iron: 0.5
    },
    ingredients: [
      '1 cup spiral pasta',
      'Water for cooking',
      'Optional: small amount olive oil or butter'
    ],
    instructions: [
      'Cook pasta 2-3 minutes longer than package says',
      'Drain and rinse with cool water',
      'Toss with tiny bit of oil if desired',
      'Serve at room temperature'
    ],
    storage: 'Refrigerate 2 days, does not freeze well',
    rating: 4.5,
    reviews: 987,
    freezable: false,
    featured: false,
    chokingRisk: 'Low',
    gripStyle: 'Pinch',
    tips: 'Overcook the pasta - it should be very soft! Spiral shape is easier to pick up than tubes.'
  },
  {
    id: 'finger-6',
    name: 'Avocado Fries',
    description: 'Healthy fats in easy-to-hold strips',
    category: 'Fruits',
    prepTime: 5,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 80,
      protein: 1,
      carbs: 4,
      fat: 7,
      fiber: 3,
      omega3: 'Present'
    },
    ingredients: [
      '1 ripe but firm avocado',
      'Optional: ground flax for coating'
    ],
    instructions: [
      'Cut avocado in half, remove pit',
      'Slice into thick strips',
      'Leave skin on for easier gripping',
      'Baby eats the soft part, leaves skin'
    ],
    storage: 'Best served fresh, browns quickly',
    rating: 4.8,
    reviews: 1456,
    freezable: false,
    featured: true,
    chokingRisk: 'Low',
    gripStyle: 'Strip',
    tips: 'Leave the skin on - gives baby something to hold! Choose firm avocado so it doesn\'t mush.'
  },
  {
    id: 'finger-7',
    name: 'Mini Turkey Meatballs',
    description: 'Protein-rich, iron-packed soft meatballs',
    category: 'Protein',
    prepTime: 25,
    servings: 20,
    difficulty: 'Medium',
    organic: false,
    vegetarian: false,
    vegan: false,
    allergens: [],
    nutrition: {
      calories: 42,
      protein: 5,
      carbs: 2,
      fat: 2,
      iron: 1.2,
      zinc: 'Good'
    },
    ingredients: [
      '1 lb ground turkey',
      '1/4 cup breadcrumbs',
      '1 egg',
      '1/4 cup finely grated zucchini'
    ],
    instructions: [
      'Mix all ingredients gently',
      'Form into marble-sized balls',
      'Bake at 375°F for 15-18 minutes',
      'Ensure fully cooked through'
    ],
    storage: 'Refrigerate 2 days or freeze up to 2 months',
    rating: 4.7,
    reviews: 1789,
    freezable: true,
    featured: true,
    chokingRisk: 'Low',
    gripStyle: 'Pinch',
    tips: 'Keep them small and moist. Hidden veggie adds moisture. Great iron source!'
  },
  {
    id: 'finger-8',
    name: 'Soft Steamed Carrot Sticks',
    description: 'Classic first veggie stick, naturally sweet',
    category: 'Vegetables',
    prepTime: 15,
    servings: 4,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 25,
      protein: 1,
      carbs: 6,
      fat: 0,
      fiber: 2,
      vitaminA: 'Very High'
    },
    ingredients: [
      '2 large carrots',
      'Water for steaming'
    ],
    instructions: [
      'Cut carrots into thick sticks (3 inches long)',
      'Steam 12-15 minutes until very soft',
      'Cool completely',
      'Test by squishing between fingers - should mash easily'
    ],
    storage: 'Refrigerate 3 days, does not freeze well',
    rating: 4.4,
    reviews: 1123,
    freezable: false,
    featured: false,
    chokingRisk: 'Low',
    gripStyle: 'Strip',
    tips: 'Must be very soft! Baby should be able to mash with gums. Great for teething.'
  }
];

const safetyGuidelines = [
  {
    title: 'Size & Shape',
    icon: AlertCircle,
    color: 'text-red-600',
    tips: [
      'Strips should be 2-3 inches long, width of adult finger',
      'Small pieces should be no larger than a pea',
      'Avoid round, coin-shaped foods'
    ]
  },
  {
    title: 'Texture Test',
    icon: CheckCircle,
    color: 'text-green-600',
    tips: [
      'Should squish easily between thumb and finger',
      'Baby should be able to gum it',
      'Not hard, crunchy, or sticky'
    ]
  },
  {
    title: 'Supervision',
    icon: AlertCircle,
    color: 'text-orange-600',
    tips: [
      'Always stay within arm\'s reach',
      'Baby should be sitting upright',
      'Never leave baby alone while eating'
    ]
  }
];

export default function FingerFoodsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showOrganic, setShowOrganic] = useState(false);
  const [showVegetarian, setShowVegetarian] = useState(false);
  const [showVegan, setShowVegan] = useState(false);
  const [sortBy, setSortBy] = useState('rating');

  const getFilteredRecipes = () => {
    let filtered = fingerFoodRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || recipe.category === selectedCategory;
      const matchesOrganic = !showOrganic || recipe.organic;
      const matchesVegetarian = !showVegetarian || recipe.vegetarian;
      const matchesVegan = !showVegan || recipe.vegan;
      
      return matchesSearch && matchesCategory && matchesOrganic && matchesVegetarian && matchesVegan;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'prepTime': return (a.prepTime || 0) - (b.prepTime || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredRecipes = getFilteredRecipes();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/recipes/baby-food">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Baby Food
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Cookie className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Self-Feeding (8-12 Months)</h1>
                <Badge className="bg-green-100 text-green-800">Soft Chunks</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{fingerFoodRecipes.length}</div>
              <div className="text-sm text-gray-600">Total Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{fingerFoodRecipes.filter(r => r.chokingRisk === 'Low').length}</div>
              <div className="text-sm text-gray-600">Low Choking Risk</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{fingerFoodRecipes.filter(r => r.vegan).length}</div>
              <div className="text-sm text-gray-600">Vegan</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{fingerFoodRecipes.filter(r => r.freezable).length}</div>
              <div className="text-sm text-gray-600">Freezable</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search recipes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <select 
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="Vegetables">Vegetables</option>
                <option value="Fruits">Fruits</option>
                <option value="Protein">Protein</option>
                <option value="Grains">Grains</option>
                <option value="Baked Goods">Baked Goods</option>
                <option value="Breakfast">Breakfast</option>
              </select>
              
              <div className="flex gap-2">
                <Button
                  variant={showOrganic ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOrganic(!showOrganic)}
                  className={showOrganic ? 'bg-green-600' : ''}
                >
                  <Leaf className="h-4 w-4 mr-1" />
                  Organic
                </Button>
                <Button
                  variant={showVegetarian ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowVegetarian(!showVegetarian)}
                  className={showVegetarian ? 'bg-blue-600' : ''}
                >
                  <Apple className="h-4 w-4 mr-1" />
                  Vegetarian
                </Button>
                <Button
                  variant={showVegan ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowVegan(!showVegan)}
                  className={showVegan ? 'bg-purple-600' : ''}
                >
                  <Leaf className="h-4 w-4 mr-1" />
                  Vegan
                </Button>
              </div>
              
              <select 
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="rating">Sort by Rating</option>
                <option value="prepTime">Sort by Prep Time</option>
                <option value="protein">Sort by Protein</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-red-600" />
              Critical Safety Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {safetyGuidelines.map((guide, idx) => {
                const Icon = guide.icon;
                return (
                  <div key={idx}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`h-5 w-5 ${guide.color}`} />
                      <h3 className="font-semibold">{guide.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {guide.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-gray-400">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            All Recipes ({filteredRecipes.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map(recipe => (
              <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
                <div className="relative h-48 bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                  <Baby className="h-20 w-20 text-green-300 opacity-40" />
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {recipe.organic && (
                      <Badge className="bg-green-500 text-white text-xs">
                        <Leaf className="h-3 w-3 mr-1" />
                        Organic
                      </Badge>
                    )}
                    {recipe.vegan && (
                      <Badge className="bg-purple-500 text-white text-xs">
                        <Leaf className="h-3 w-3 mr-1" />
                        Vegan
                      </Badge>
                    )}
                  </div>
                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    {recipe.freezable && (
                      <Badge className="bg-blue-500 text-white text-xs">
                        <Snowflake className="h-3 w-3 mr-1" />
                        Freezable
                      </Badge>
                    )}
                    <Badge className={`text-xs ${
                      recipe.chokingRisk === 'Low' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-yellow-500 text-white'
                    }`}>
                      {recipe.chokingRisk} Risk
                    </Badge>
                  </div>
                  <div className="absolute bottom-3 right-3">
                    <Badge className="bg-white text-green-800 text-xs">
                      {recipe.gripStyle}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">{recipe.name}</h3>
                      <Badge variant="outline" className="text-xs mb-2">{recipe.category}</Badge>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                  
                  {recipe.allergens.length > 0 && (
                    <div className="mb-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                      <div className="flex items-center gap-1 text-xs text-yellow-800">
                        <AlertCircle className="h-3 w-3" />
                        Contains: {recipe.allergens.join(', ')}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                    <div>
                      <div className="font-bold text-green-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">{recipe.nutrition.protein}g</div>
                      <div className="text-gray-500">Protein</div>
                    </div>
                    <div>
                      <div className="font-bold text-purple-600">{recipe.prepTime}m</div>
                      <div className="text-gray-500">Prep</div>
                    </div>
                    <div>
                      <div className="font-bold text-orange-600">{recipe.servings}</div>
                      <div className="text-gray-500">Servings</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium text-sm">{recipe.rating}</span>
                      <span className="text-gray-500 text-xs">({recipe.reviews})</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{recipe.difficulty}</Badge>
                  </div>

                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    <Utensils className="h-4 w-4 mr-2" />
                    View Recipe
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-6 w-6 text-blue-500" />
                Pincer Grasp Development
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Around 9 months, baby develops the pincer grasp (thumb and forefinger). Offer a variety of sizes!
              </p>
              <div className="space-y-2">
                <div className="p-2 bg-blue-50 rounded text-sm">
                  <strong>8-9 months:</strong> Larger pieces, palmar grasp (whole hand)
                </div>
                <div className="p-2 bg-green-50 rounded text-sm">
                  <strong>9-10 months:</strong> Smaller pieces as pincer develops
                </div>
                <div className="p-2 bg-purple-50 rounded text-sm">
                  <strong>10-12 months:</strong> Pea-sized pieces, refined pincer grasp
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-green-500" />
                Baby-Led Weaning Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Let baby feed themselves - messy is normal!</div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Offer variety - different textures, colors, tastes</div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Food before one is just for fun - milk is still main nutrition</div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Trust baby to know when they're full</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
