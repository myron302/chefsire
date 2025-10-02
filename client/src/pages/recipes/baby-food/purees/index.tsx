import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Droplets, Clock, Heart, Star, ArrowLeft, Plus, Leaf,
  Search, Share2, AlertCircle, Info, CheckCircle, Snowflake,
  Baby, Apple, Utensils, BookOpen
} from 'lucide-react';

const pureeRecipes = [
  {
    id: 'puree-1',
    name: 'Sweet Potato Puree',
    description: 'Creamy, naturally sweet first food packed with vitamin A',
    image: 'sweetpotato',
    category: 'Vegetables',
    prepTime: 25,
    servings: 8,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 42,
      protein: 1,
      carbs: 10,
      fat: 0,
      fiber: 2,
      iron: 0.4,
      vitaminA: 'Very High'
    },
    ingredients: [
      '1 medium organic sweet potato',
      'Water or breast milk/formula for thinning'
    ],
    instructions: [
      'Wash and peel sweet potato',
      'Cut into 1-inch cubes',
      'Steam for 15-20 minutes until very soft',
      'Blend until smooth, adding liquid as needed',
      'Cool completely before serving'
    ],
    storage: 'Refrigerate 2-3 days or freeze up to 3 months',
    rating: 4.9,
    reviews: 1234,
    freezable: true,
    featured: true,
    bestTime: 'First introduction',
    tips: 'Great first food! Rich in beta-carotene. Can mix with breast milk for familiar taste.'
  },
  {
    id: 'puree-2',
    name: 'Avocado Mash',
    description: 'No-cook option with healthy fats for brain development',
    image: 'avocado',
    category: 'Fruits',
    prepTime: 3,
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
      omega3: 'Present',
      folate: 'High'
    },
    ingredients: [
      '1/2 ripe organic avocado',
      'Breast milk or formula (optional for thinning)'
    ],
    instructions: [
      'Cut avocado in half and remove pit',
      'Scoop out flesh',
      'Mash with fork until smooth',
      'Add liquid if needed for consistency',
      'Serve immediately'
    ],
    storage: 'Best fresh - does not freeze well',
    rating: 4.8,
    reviews: 892,
    freezable: false,
    featured: true,
    bestTime: 'After 6 months',
    tips: 'Serve fresh as avocado browns quickly. High in healthy fats essential for baby\'s brain.'
  },
  {
    id: 'puree-3',
    name: 'Banana Puree',
    description: 'Quick, no-cook option naturally sweet and easy to digest',
    image: 'banana',
    category: 'Fruits',
    prepTime: 2,
    servings: 2,
    difficulty: 'Easy',
    organic: false,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 52,
      protein: 1,
      carbs: 13,
      fat: 0,
      fiber: 2,
      potassium: 'High',
      vitaminB6: 'Good'
    },
    ingredients: [
      '1 ripe banana',
      'Breast milk or formula (optional)'
    ],
    instructions: [
      'Peel ripe banana',
      'Mash thoroughly with fork',
      'Add liquid for thinner consistency',
      'Serve immediately'
    ],
    storage: 'Best fresh - browns quickly',
    rating: 4.7,
    reviews: 1567,
    freezable: false,
    featured: true,
    bestTime: 'First fruits',
    tips: 'Choose very ripe banana with brown spots for sweetness and easier digestion.'
  },
  {
    id: 'puree-4',
    name: 'Butternut Squash Puree',
    description: 'Mild, sweet squash perfect for sensitive tummies',
    image: 'squash',
    category: 'Vegetables',
    prepTime: 30,
    servings: 10,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 40,
      protein: 1,
      carbs: 10,
      fat: 0,
      fiber: 2,
      vitaminA: 'Very High',
      vitaminC: 'Good'
    },
    ingredients: [
      '1 small butternut squash',
      'Water for thinning'
    ],
    instructions: [
      'Cut squash in half, remove seeds',
      'Place cut-side down on baking sheet',
      'Roast at 400°F for 40-50 minutes',
      'Scoop out flesh and blend smooth',
      'Add water to desired consistency'
    ],
    storage: 'Refrigerate 3 days or freeze up to 3 months',
    rating: 4.8,
    reviews: 678,
    freezable: true,
    featured: false,
    bestTime: 'Early introduction',
    tips: 'Roasting enhances natural sweetness. Can also steam if preferred.'
  },
  {
    id: 'puree-5',
    name: 'Pea Puree',
    description: 'Protein-rich green vegetable with mild flavor',
    image: 'peas',
    category: 'Vegetables',
    prepTime: 15,
    servings: 6,
    difficulty: 'Easy',
    organic: false,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 35,
      protein: 2,
      carbs: 6,
      fat: 0,
      fiber: 2,
      iron: 0.8,
      vitaminK: 'High'
    },
    ingredients: [
      '1 cup frozen or fresh peas',
      'Water for steaming and thinning'
    ],
    instructions: [
      'Steam peas for 10-12 minutes until very soft',
      'Blend until completely smooth',
      'Strain through fine mesh if needed (removes skins)',
      'Add liquid to thin if necessary',
      'Cool before serving'
    ],
    storage: 'Refrigerate 3 days or freeze up to 3 months',
    rating: 4.4,
    reviews: 445,
    freezable: true,
    featured: false,
    bestTime: 'After root vegetables',
    tips: 'Straining removes skins for ultra-smooth texture. Good source of plant protein.'
  },
  {
    id: 'puree-6',
    name: 'Apple Puree',
    description: 'Classic first fruit with natural sweetness',
    image: 'apple',
    category: 'Fruits',
    prepTime: 20,
    servings: 8,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 45,
      protein: 0,
      carbs: 12,
      fat: 0,
      fiber: 2,
      vitaminC: 'Good',
      pectin: 'Present'
    },
    ingredients: [
      '3 medium apples (sweet variety like Gala)',
      'Water for steaming'
    ],
    instructions: [
      'Peel, core, and chop apples',
      'Steam for 15 minutes until soft',
      'Blend until smooth',
      'No need to add liquid - natural moisture is sufficient',
      'Cool completely'
    ],
    storage: 'Refrigerate 3 days or freeze up to 3 months',
    rating: 4.6,
    reviews: 789,
    freezable: true,
    featured: true,
    bestTime: 'After vegetables',
    tips: 'Choose sweeter apple varieties. Can help with constipation due to pectin content.'
  },
  {
    id: 'puree-7',
    name: 'Carrot Puree',
    description: 'Sweet root vegetable rich in beta-carotene',
    image: 'carrot',
    category: 'Vegetables',
    prepTime: 25,
    servings: 8,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 38,
      protein: 1,
      carbs: 9,
      fat: 0,
      fiber: 2,
      vitaminA: 'Very High',
      betaCarotene: 'Excellent'
    },
    ingredients: [
      '4 medium organic carrots',
      'Water for steaming and thinning'
    ],
    instructions: [
      'Peel and chop carrots into rounds',
      'Steam for 20 minutes until very tender',
      'Blend until silky smooth',
      'Add steaming water to thin if needed',
      'Cool before serving'
    ],
    storage: 'Refrigerate 3 days or freeze up to 3 months',
    rating: 4.7,
    reviews: 923,
    freezable: true,
    featured: false,
    bestTime: 'Early introduction',
    tips: 'Naturally sweet - babies usually love this! Great source of vitamin A for eye health.'
  },
  {
    id: 'puree-8',
    name: 'Prune Puree',
    description: 'Natural remedy for constipation with iron',
    image: 'prune',
    category: 'Fruits',
    prepTime: 15,
    servings: 6,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 55,
      protein: 1,
      carbs: 14,
      fat: 0,
      fiber: 3,
      iron: 0.5,
      sorbitol: 'Present'
    },
    ingredients: [
      '1 cup pitted prunes',
      '1 cup water'
    ],
    instructions: [
      'Simmer prunes in water for 10 minutes',
      'Let cool slightly',
      'Blend with soaking liquid until smooth',
      'Add more water if needed',
      'Serve small amounts (1-2 tsp)'
    ],
    storage: 'Refrigerate up to 5 days or freeze up to 3 months',
    rating: 4.5,
    reviews: 334,
    freezable: true,
    featured: false,
    bestTime: 'When needed',
    tips: 'Great for constipation! Start with small amounts. Can mix with other purees.'
  }
];

const dietaryCategories = [
  {
    id: 'organic',
    name: 'Organic',
    icon: Leaf,
    color: 'bg-green-100 text-green-800',
    description: 'Made with certified organic ingredients'
  },
  {
    id: 'vegetarian',
    name: 'Vegetarian',
    icon: Apple,
    color: 'bg-blue-100 text-blue-800',
    description: 'No meat, fish, or poultry'
  },
  {
    id: 'vegan',
    name: 'Vegan',
    icon: Leaf,
    color: 'bg-purple-100 text-purple-800',
    description: 'No animal products at all'
  }
];

const introductionOrder = [
  { stage: 1, foods: ['Sweet Potato', 'Avocado', 'Banana'], age: '4-5 months' },
  { stage: 2, foods: ['Butternut Squash', 'Carrot', 'Apple'], age: '5-6 months' },
  { stage: 3, foods: ['Peas', 'Prunes', 'Pear'], age: '6+ months' }
];

export default function PureesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showOrganic, setShowOrganic] = useState(false);
  const [showVegetarian, setShowVegetarian] = useState(false);
  const [showVegan, setShowVegan] = useState(false);
  const [sortBy, setSortBy] = useState('rating');

  const getFilteredRecipes = () => {
    let filtered = pureeRecipes.filter(recipe => {
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
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredRecipes = getFilteredRecipes();
  const featuredRecipes = pureeRecipes.filter(r => r.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
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
                <Droplets className="h-6 w-6 text-pink-600" />
                <h1 className="text-2xl font-bold text-gray-900">First Foods (4-6 Months)</h1>
                <Badge className="bg-pink-100 text-pink-800">Smooth Purees</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-pink-600">{pureeRecipes.length}</div>
              <div className="text-sm text-gray-600">Total Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{pureeRecipes.filter(r => r.organic).length}</div>
              <div className="text-sm text-gray-600">Organic Options</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{pureeRecipes.filter(r => r.vegan).length}</div>
              <div className="text-sm text-gray-600">Vegan</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{pureeRecipes.filter(r => r.freezable).length}</div>
              <div className="text-sm text-gray-600">Freezable</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
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
                <option value="name">Sort by Name</option>
              </select>
            </div>
          </CardContent>
        </Card>
        {/* Introduction Order Guide */}
        <Card className="mb-8 bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-purple-600" />
              Recommended Introduction Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Start with single-ingredient purees, waiting 3-5 days between new foods to watch for reactions.
            </p>
            <div className="space-y-4">
              {introductionOrder.map(stage => (
                <div key={stage.stage} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">
                    {stage.stage}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">{stage.age}</div>
                    <div className="flex flex-wrap gap-2">
                      {stage.foods.map((food, idx) => (
                        <Badge key={idx} variant="outline" className="text-sm">
                          {food}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recipe Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            All Recipes ({filteredRecipes.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map(recipe => (
              <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
                <div className="relative h-48 bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                  <Baby className="h-20 w-20 text-purple-300 opacity-40" />
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
                  <div className="absolute top-3 right-3">
                    {recipe.freezable && (
                      <Badge className="bg-blue-500 text-white text-xs">
                        <Snowflake className="h-3 w-3 mr-1" />
                        Freezable
                      </Badge>
                    )}
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
                  
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                    <div>
                      <div className="font-bold text-pink-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-purple-600">{recipe.prepTime}m</div>
                      <div className="text-gray-500">Prep</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">{recipe.servings}</div>
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

                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">Best Time:</div>
                    <div className="text-xs text-gray-600">{recipe.bestTime}</div>
                  </div>

                  <Button className="w-full bg-pink-600 hover:bg-pink-700">
                    <Utensils className="h-4 w-4 mr-2" />
                    View Recipe
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Tips & Safety */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-6 w-6 text-blue-500" />
                Preparation Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Steam, Don't Boil</div>
                    <div className="text-xs text-gray-600">Steaming preserves more nutrients than boiling</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Use Ice Cube Trays</div>
                    <div className="text-xs text-gray-600">Perfect 1-2 oz portions for quick thawing</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Label Everything</div>
                    <div className="text-xs text-gray-600">Date and contents on all frozen purees</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Thin with Liquid</div>
                    <div className="text-xs text-gray-600">Use breast milk, formula, or water to adjust consistency</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-red-500" />
                Safety Reminders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="font-semibold text-sm text-red-800 mb-1">No Honey</div>
                  <div className="text-xs text-red-700">Never give honey to babies under 12 months - risk of botulism</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-semibold text-sm text-orange-800 mb-1">Test Temperature</div>
                  <div className="text-xs text-orange-700">Always test on your wrist before feeding baby</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-sm text-yellow-800 mb-1">Watch for Reactions</div>
                  <div className="text-xs text-yellow-700">Wait 3-5 days between new foods to identify allergies</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-semibold text-sm text-blue-800 mb-1">Storage Times</div>
                  <div className="text-xs text-blue-700">Refrigerate 2-3 days max, freeze up to 3 months</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
