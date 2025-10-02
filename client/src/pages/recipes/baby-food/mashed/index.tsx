import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Apple, Clock, Heart, Star, ArrowLeft, Leaf, Search, Share2,
  AlertCircle, Info, CheckCircle, Snowflake, Baby, Utensils, BookOpen
} from 'lucide-react';

const mashedRecipes = [
  {
    id: 'mashed-1',
    name: 'Apple & Pear Mash',
    description: 'Naturally sweet fruit combo with gentle fiber',
    category: 'Fruits',
    prepTime: 20,
    servings: 6,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 48,
      protein: 0,
      carbs: 13,
      fat: 0,
      fiber: 3,
      vitaminC: 'Good'
    },
    ingredients: [
      '2 medium apples, peeled and chopped',
      '2 medium pears, peeled and chopped',
      'Water for steaming'
    ],
    instructions: [
      'Steam fruit for 15 minutes until soft',
      'Mash with fork leaving some texture',
      'Cool completely before serving',
      'Add water if too thick'
    ],
    storage: 'Refrigerate 3 days or freeze up to 3 months',
    rating: 4.8,
    reviews: 987,
    freezable: true,
    featured: true,
    texture: 'Lumpy',
    tips: 'Leave some chunks for texture progression. Mix varieties for complex flavor.'
  },
  {
    id: 'mashed-2',
    name: 'Chicken & Sweet Potato',
    description: 'Complete protein with iron-rich vegetable',
    category: 'Protein',
    prepTime: 30,
    servings: 8,
    difficulty: 'Medium',
    organic: false,
    vegetarian: false,
    vegan: false,
    allergens: [],
    nutrition: {
      calories: 85,
      protein: 8,
      carbs: 10,
      fat: 1,
      fiber: 2,
      iron: 1.2
    },
    ingredients: [
      '1 chicken breast, cooked and shredded',
      '1 large sweet potato, cooked',
      'Breast milk or formula to thin'
    ],
    instructions: [
      'Cook chicken thoroughly',
      'Steam sweet potato until very soft',
      'Blend or mash together with liquid',
      'Leave some texture for practice'
    ],
    storage: 'Refrigerate 2 days or freeze up to 2 months',
    rating: 4.7,
    reviews: 756,
    freezable: true,
    featured: true,
    texture: 'Thick & Chunky',
    tips: 'First meat introduction! Ensure chicken is fully cooked. Good source of iron.'
  },
  {
    id: 'mashed-3',
    name: 'Avocado Banana Blend',
    description: 'Creamy no-cook option with healthy fats',
    category: 'Fruits',
    prepTime: 3,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 72,
      protein: 1,
      carbs: 9,
      fat: 4,
      fiber: 3,
      omega3: 'Present'
    },
    ingredients: [
      '1/2 ripe avocado',
      '1 ripe banana',
      'Optional: breast milk to thin'
    ],
    instructions: [
      'Mash avocado with fork',
      'Mash banana separately',
      'Combine and mix lightly',
      'Serve immediately'
    ],
    storage: 'Best served fresh, does not freeze well',
    rating: 4.9,
    reviews: 1234,
    freezable: false,
    featured: true,
    texture: 'Smooth & Creamy',
    tips: 'Quick energy food! Perfect pre or post-nap snack. Rich in brain-building fats.'
  },
  {
    id: 'mashed-4',
    name: 'Lentil & Veggie Mash',
    description: 'Plant-based protein with mixed vegetables',
    category: 'Protein',
    prepTime: 35,
    servings: 10,
    difficulty: 'Medium',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 62,
      protein: 4,
      carbs: 11,
      fat: 0,
      fiber: 3,
      iron: 1.5
    },
    ingredients: [
      '1/2 cup red lentils',
      '1 carrot, chopped',
      '1 zucchini, chopped',
      '1.5 cups low-sodium vegetable broth'
    ],
    instructions: [
      'Combine lentils, vegetables, and broth',
      'Simmer 25 minutes until very soft',
      'Mash to desired consistency',
      'Add more broth if needed'
    ],
    storage: 'Refrigerate 3 days or freeze up to 3 months',
    rating: 4.6,
    reviews: 567,
    freezable: true,
    featured: false,
    texture: 'Thick & Hearty',
    tips: 'Red lentils are easiest to digest. Great iron source for vegetarian babies.'
  },
  {
    id: 'mashed-5',
    name: 'Yogurt Berry Bowl',
    description: 'Probiotic-rich dairy with antioxidant fruits',
    category: 'Dairy',
    prepTime: 5,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: false,
    allergens: ['Dairy'],
    nutrition: {
      calories: 78,
      protein: 4,
      carbs: 12,
      fat: 2,
      calcium: 120,
      probiotics: 'Present'
    },
    ingredients: [
      '1/2 cup plain whole milk yogurt',
      '1/4 cup mashed blueberries',
      '1/4 cup mashed strawberries'
    ],
    instructions: [
      'Mash berries with fork',
      'Mix into yogurt',
      'Serve immediately',
      'Can slightly warm if too cold'
    ],
    storage: 'Best fresh, refrigerate 1 day max',
    rating: 4.8,
    reviews: 892,
    freezable: false,
    featured: true,
    texture: 'Creamy',
    tips: 'Use whole milk yogurt for healthy fats. Introduce dairy carefully if first time.'
  },
  {
    id: 'mashed-6',
    name: 'Quinoa Veggie Mix',
    description: 'Complete protein grain with colorful vegetables',
    category: 'Grains',
    prepTime: 25,
    servings: 8,
    difficulty: 'Easy',
    organic: false,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 58,
      protein: 3,
      carbs: 10,
      fat: 1,
      fiber: 2,
      complete_protein: true
    },
    ingredients: [
      '1/2 cup cooked quinoa',
      '1/2 cup steamed broccoli',
      '1/2 cup steamed carrots',
      'Water or broth to moisten'
    ],
    instructions: [
      'Cook quinoa according to package',
      'Steam vegetables until very soft',
      'Combine and mash together',
      'Add liquid for consistency'
    ],
    storage: 'Refrigerate 3 days or freeze up to 3 months',
    rating: 4.5,
    reviews: 445,
    freezable: true,
    featured: false,
    texture: 'Grainy',
    tips: 'Quinoa is a complete protein! Rinse well before cooking to remove bitterness.'
  },
  {
    id: 'mashed-7',
    name: 'Butternut Mac & Cheese',
    description: 'Hidden veggie pasta with cheese',
    category: 'Grains',
    prepTime: 30,
    servings: 8,
    difficulty: 'Medium',
    organic: true,
    vegetarian: true,
    vegan: false,
    allergens: ['Dairy', 'Wheat'],
    nutrition: {
      calories: 95,
      protein: 4,
      carbs: 14,
      fat: 3,
      calcium: 85,
      vitaminA: 'High'
    },
    ingredients: [
      '1/2 cup small pasta, cooked',
      '1 cup butternut squash puree',
      '2 tbsp shredded mild cheddar',
      'Breast milk or formula to thin'
    ],
    instructions: [
      'Cook pasta very soft',
      'Mix warm squash with cheese',
      'Combine with pasta',
      'Mash to chunky consistency'
    ],
    storage: 'Refrigerate 2 days or freeze up to 2 months',
    rating: 4.9,
    reviews: 1567,
    freezable: true,
    featured: true,
    texture: 'Soft & Chunky',
    tips: 'Sneaky veggie addition! Use small pasta shapes. First wheat introduction.'
  },
  {
    id: 'mashed-8',
    name: 'Mango Coconut Rice',
    description: 'Tropical fruit with gentle grain',
    category: 'Grains',
    prepTime: 25,
    servings: 6,
    difficulty: 'Easy',
    organic: false,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 68,
      protein: 1,
      carbs: 15,
      fat: 1,
      vitaminC: 'High',
      vitaminA: 'Good'
    },
    ingredients: [
      '1/2 cup cooked white rice',
      '1 ripe mango, mashed',
      '2 tbsp coconut milk (full fat)',
      'Pinch of cinnamon (optional)'
    ],
    instructions: [
      'Cook rice very soft',
      'Mash mango thoroughly',
      'Mix rice, mango, and coconut milk',
      'Warm gently if needed'
    ],
    storage: 'Refrigerate 2 days or freeze up to 2 months',
    rating: 4.7,
    reviews: 678,
    freezable: true,
    featured: false,
    texture: 'Soft & Sticky',
    tips: 'Choose very ripe mango for sweetness. Iron-fortified rice adds nutrition.'
  }
];

const textureGuide = [
  {
    stage: 'Early 6 months',
    texture: 'Thick & Smooth',
    description: 'Slightly thicker than purees but still very smooth',
    examples: ['Mashed banana', 'Thick yogurt']
  },
  {
    stage: 'Mid 6-7 months',
    texture: 'Lumpy & Mashed',
    description: 'Some soft lumps, fork-mashed consistency',
    examples: ['Mashed avocado', 'Lumpy oatmeal']
  },
  {
    stage: 'Late 7-8 months',
    texture: 'Chunky Mash',
    description: 'Larger soft chunks, more texture',
    examples: ['Chunky fruit', 'Soft pasta pieces']
  }
];

export default function MashedFoodsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showOrganic, setShowOrganic] = useState(false);
  const [showVegetarian, setShowVegetarian] = useState(false);
  const [showVegan, setShowVegan] = useState(false);
  const [sortBy, setSortBy] = useState('rating');

  const getFilteredRecipes = () => {
    let filtered = mashedRecipes.filter(recipe => {
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
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
                <Apple className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">Exploring Textures (6-8 Months)</h1>
                <Badge className="bg-orange-100 text-orange-800">Mashed & Lumpy</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{mashedRecipes.length}</div>
              <div className="text-sm text-gray-600">Total Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{mashedRecipes.filter(r => r.vegetarian).length}</div>
              <div className="text-sm text-gray-600">Vegetarian</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{mashedRecipes.filter(r => r.vegan).length}</div>
              <div className="text-sm text-gray-600">Vegan</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{mashedRecipes.filter(r => r.category === 'Protein').length}</div>
              <div className="text-sm text-gray-600">Protein Rich</div>
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
                <option value="Fruits">Fruits</option>
                <option value="Protein">Protein</option>
                <option value="Grains">Grains</option>
                <option value="Dairy">Dairy</option>
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

        <Card className="mb-8 bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-orange-600" />
              Texture Progression Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              This stage is about gradually introducing texture. Start smoother and progress to chunkier as baby gets comfortable.
            </p>
            <div className="space-y-4">
              {textureGuide.map((guide, idx) => (
                <div key={idx} className="flex gap-4 items-start p-3 bg-white rounded-lg">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600 text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">{guide.stage}</div>
                    <div className="text-sm font-medium text-orange-600 mb-1">{guide.texture}</div>
                    <div className="text-sm text-gray-600 mb-2">{guide.description}</div>
                    <div className="flex flex-wrap gap-2">
                      {guide.examples.map((example, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {example}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
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
                <div className="relative h-48 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                  <Baby className="h-20 w-20 text-orange-300 opacity-40" />
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
                  <div className="absolute bottom-3 right-3">
                    <Badge className="bg-white text-orange-800 text-xs">
                      {recipe.texture}
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
                      <div className="font-bold text-orange-600">{recipe.nutrition.calories}</div>
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
                      <div className="font-bold text-green-600">{recipe.servings}</div>
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

                  <Button className="w-full bg-orange-600 hover:bg-orange-700">
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
                Combination Foods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Now that baby has tried single ingredients, you can start combining flavors!
              </p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Mix fruits with yogurt for protein boost</div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Combine vegetables with mild proteins</div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Add grains for energy and texture practice</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-orange-500" />
                Allergen Introduction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                6-8 months is prime time for introducing common allergens!
              </p>
              <div className="space-y-2">
                <div className="p-2 bg-orange-50 rounded text-sm">
                  <strong>Eggs:</strong> Start with well-cooked yolk or whole egg
                </div>
                <div className="p-2 bg-blue-50 rounded text-sm">
                  <strong>Dairy:</strong> Yogurt and cheese are safe before milk
                </div>
                <div className="p-2 bg-yellow-50 rounded text-sm">
                  <strong>Wheat:</strong> Try soft pasta or baby cereal
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
