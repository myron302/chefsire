import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Utensils, Clock, Heart, Star, ArrowLeft, Leaf, Search, Share2,
  AlertCircle, Info, CheckCircle, Snowflake, Baby, BookOpen, Apple
} from 'lucide-react';

const toddlerRecipes = [
  {
    id: 'toddler-1',
    name: 'Mini Veggie Pizzas',
    description: 'Fun, customizable pizzas perfect for little hands',
    category: 'Main Dish',
    prepTime: 20,
    servings: 4,
    difficulty: 'Easy',
    organic: false,
    vegetarian: true,
    vegan: false,
    allergens: ['Wheat', 'Dairy'],
    nutrition: {
      calories: 145,
      protein: 7,
      carbs: 18,
      fat: 5,
      fiber: 2,
      calcium: 120
    },
    ingredients: [
      '4 whole wheat English muffins',
      '1/2 cup tomato sauce',
      '1 cup shredded mozzarella',
      'Diced vegetables (peppers, mushrooms)',
      'Italian seasoning'
    ],
    instructions: [
      'Split English muffins in half',
      'Spread sauce on each half',
      'Top with cheese and vegetables',
      'Bake at 375°F for 10-12 minutes',
      'Cool slightly, cut into quarters'
    ],
    storage: 'Refrigerate 3 days or freeze up to 2 months',
    rating: 4.9,
    reviews: 3421,
    freezable: true,
    featured: true,
    familyFriendly: true,
    tips: 'Let toddler help add toppings! Cut into manageable pieces. Great for picky eaters.'
  },
  {
    id: 'toddler-2',
    name: 'Chicken & Veggie Nuggets',
    description: 'Homemade nuggets with hidden vegetables',
    category: 'Protein',
    prepTime: 30,
    servings: 16,
    difficulty: 'Medium',
    organic: true,
    vegetarian: false,
    vegan: false,
    allergens: ['Wheat', 'Eggs'],
    nutrition: {
      calories: 78,
      protein: 9,
      carbs: 6,
      fat: 2,
      iron: 0.8,
      zinc: 'Good'
    },
    ingredients: [
      '1 lb ground chicken',
      '1/2 cup finely grated zucchini',
      '1/2 cup breadcrumbs',
      '1 egg',
      'Garlic powder, onion powder'
    ],
    instructions: [
      'Mix all ingredients thoroughly',
      'Form into small nugget shapes',
      'Bake at 400°F for 18-20 minutes',
      'Flip halfway through',
      'Ensure fully cooked'
    ],
    storage: 'Refrigerate 3 days or freeze up to 3 months',
    rating: 4.8,
    reviews: 2567,
    freezable: true,
    featured: true,
    familyFriendly: true,
    tips: 'Batch cook and freeze! Much healthier than store-bought. Serve with dipping sauces.'
  },
  {
    id: 'toddler-3',
    name: 'Mac & Cheese with Hidden Veggies',
    description: 'Creamy comfort food with butternut squash',
    category: 'Main Dish',
    prepTime: 25,
    servings: 6,
    difficulty: 'Easy',
    organic: false,
    vegetarian: true,
    vegan: false,
    allergens: ['Wheat', 'Dairy'],
    nutrition: {
      calories: 185,
      protein: 8,
      carbs: 24,
      fat: 6,
      calcium: 150,
      vitaminA: 'High'
    },
    ingredients: [
      '2 cups pasta (elbow or shells)',
      '1 cup butternut squash puree',
      '1 cup shredded cheddar',
      '1/2 cup milk',
      'Salt, pepper'
    ],
    instructions: [
      'Cook pasta until very soft',
      'Heat squash puree with milk',
      'Stir in cheese until melted',
      'Mix with pasta',
      'Serve warm'
    ],
    storage: 'Refrigerate 3 days or freeze up to 2 months',
    rating: 4.7,
    reviews: 4123,
    freezable: true,
    featured: true,
    familyFriendly: true,
    tips: 'Squash makes it extra creamy and adds nutrition without changing the taste!'
  },
  {
    id: 'toddler-4',
    name: 'Banana Oat Breakfast Cookies',
    description: 'Grab-and-go breakfast with no added sugar',
    category: 'Breakfast',
    prepTime: 25,
    servings: 12,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 68,
      protein: 2,
      carbs: 12,
      fat: 2,
      fiber: 2,
      potassium: 'Good'
    },
    ingredients: [
      '2 ripe bananas, mashed',
      '1.5 cups rolled oats',
      '1/4 cup raisins',
      '1 tsp cinnamon',
      '2 tbsp nut butter (optional)'
    ],
    instructions: [
      'Mash bananas thoroughly',
      'Mix in oats, raisins, cinnamon',
      'Drop spoonfuls on baking sheet',
      'Bake at 350°F for 12-15 minutes',
      'Cool on wire rack'
    ],
    storage: 'Refrigerate 5 days or freeze up to 3 months',
    rating: 4.6,
    reviews: 2890,
    freezable: true,
    featured: false,
    familyFriendly: true,
    tips: 'Perfect for busy mornings! Naturally sweet, no sugar needed. Great for school snacks.'
  },
  {
    id: 'toddler-5',
    name: 'Mini Meatballs in Tomato Sauce',
    description: 'Protein-rich dinner the whole family enjoys',
    category: 'Protein',
    prepTime: 35,
    servings: 20,
    difficulty: 'Medium',
    organic: false,
    vegetarian: false,
    vegan: false,
    allergens: ['Eggs'],
    nutrition: {
      calories: 62,
      protein: 7,
      carbs: 3,
      fat: 3,
      iron: 1.2,
      zinc: 'Good'
    },
    ingredients: [
      '1 lb ground beef or turkey',
      '1 egg',
      '1/4 cup breadcrumbs',
      '1/4 cup grated Parmesan',
      '2 cups marinara sauce'
    ],
    instructions: [
      'Mix meat, egg, breadcrumbs, cheese',
      'Form into small meatballs',
      'Brown in skillet',
      'Add sauce, simmer 15 minutes',
      'Serve over pasta or rice'
    ],
    storage: 'Refrigerate 3 days or freeze up to 3 months',
    rating: 4.9,
    reviews: 3789,
    freezable: true,
    featured: true,
    familyFriendly: true,
    tips: 'Make them small for toddlers. Freeze extras for quick dinners. Serve with pasta!'
  },
  {
    id: 'toddler-6',
    name: 'Veggie Quesadillas',
    description: 'Cheesy, vegetable-packed Mexican favorite',
    category: 'Main Dish',
    prepTime: 15,
    servings: 4,
    difficulty: 'Easy',
    organic: false,
    vegetarian: true,
    vegan: false,
    allergens: ['Wheat', 'Dairy'],
    nutrition: {
      calories: 165,
      protein: 8,
      carbs: 20,
      fat: 6,
      calcium: 180,
      fiber: 3
    },
    ingredients: [
      '4 whole wheat tortillas',
      '1 cup shredded cheese',
      '1/2 cup black beans',
      '1/2 cup diced bell peppers',
      'Avocado for serving'
    ],
    instructions: [
      'Spread cheese on half of tortilla',
      'Add beans and peppers',
      'Fold tortilla in half',
      'Cook in skillet 2-3 min per side',
      'Cut into triangles'
    ],
    storage: 'Best fresh, refrigerate 2 days',
    rating: 4.7,
    reviews: 2234,
    freezable: false,
    featured: false,
    familyFriendly: true,
    tips: 'Quick and easy! Let toddler help sprinkle cheese. Serve with mild salsa or guac.'
  },
  {
    id: 'toddler-7',
    name: 'Lentil Bolognese',
    description: 'Plant-based protein pasta sauce',
    category: 'Main Dish',
    prepTime: 40,
    servings: 8,
    difficulty: 'Easy',
    organic: true,
    vegetarian: true,
    vegan: true,
    allergens: [],
    nutrition: {
      calories: 142,
      protein: 8,
      carbs: 24,
      fat: 2,
      fiber: 6,
      iron: 2.5
    },
    ingredients: [
      '1 cup red lentils',
      '1 can crushed tomatoes',
      '1 diced carrot',
      '1 diced celery stalk',
      'Italian herbs, garlic'
    ],
    instructions: [
      'Sauté vegetables until soft',
      'Add lentils and tomatoes',
      'Simmer 25-30 minutes',
      'Blend slightly for smoother texture',
      'Serve over pasta'
    ],
    storage: 'Refrigerate 4 days or freeze up to 3 months',
    rating: 4.5,
    reviews: 1567,
    freezable: true,
    featured: false,
    familyFriendly: true,
    tips: 'Great iron source! Tastes like regular bolognese. Sneaky way to add protein and fiber.'
  },
  {
    id: 'toddler-8',
    name: 'Cheesy Broccoli Rice Bake',
    description: 'One-dish meal with hidden vegetables',
    category: 'Main Dish',
    prepTime: 45,
    servings: 6,
    difficulty: 'Medium',
    organic: false,
    vegetarian: true,
    vegan: false,
    allergens: ['Dairy'],
    nutrition: {
      calories: 195,
      protein: 9,
      carbs: 28,
      fat: 5,
      calcium: 210,
      vitaminC: 'Good'
    },
    ingredients: [
      '2 cups cooked rice',
      '2 cups chopped broccoli',
      '1.5 cups shredded cheddar',
      '1/2 cup milk',
      'Garlic powder'
    ],
    instructions: [
      'Steam broccoli until very soft',
      'Mix rice, broccoli, cheese, milk',
      'Pour into baking dish',
      'Top with extra cheese',
      'Bake at 350°F for 25 minutes'
    ],
    storage: 'Refrigerate 3 days or freeze up to 2 months',
    rating: 4.6,
    reviews: 1890,
    freezable: true,
    featured: true,
    familyFriendly: true,
    tips: 'Make ahead for busy nights! Kids love the cheesy flavor. Good way to use leftover rice.'
  }
];

const transitionTips = [
  {
    title: 'Cow\'s Milk Introduction',
    icon: Info,
    color: 'text-blue-600',
    content: 'After 12 months, can introduce whole cow\'s milk. Start with small amounts alongside breast milk or formula.'
  },
  {
    title: 'Family Meals',
    icon: Utensils,
    color: 'text-green-600',
    content: 'Toddlers can eat most family foods! Just cut to appropriate size and avoid high choking-risk foods.'
  },
  {
    title: 'Portion Sizes',
    icon: CheckCircle,
    color: 'text-purple-600',
    content: 'Toddler portions are small - about 1/4 of an adult portion. Let them decide how much to eat.'
  }
];

export default function ToddlerMealsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showOrganic, setShowOrganic] = useState(false);
  const [showVegetarian, setShowVegetarian] = useState(false);
  const [showVegan, setShowVegan] = useState(false);
  const [sortBy, setSortBy] = useState('rating');

  const getFilteredRecipes = () => {
    let filtered = toddlerRecipes.filter(recipe => {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
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
                <Utensils className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Toddler Meals (12+ Months)</h1>
                <Badge className="bg-blue-100 text-blue-800">Family Foods</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{toddlerRecipes.length}</div>
              <div className="text-sm text-gray-600">Total Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{toddlerRecipes.filter(r => r.familyFriendly).length}</div>
              <div className="text-sm text-gray-600">Family Friendly</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{toddlerRecipes.filter(r => r.vegetarian).length}</div>
              <div className="text-sm text-gray-600">Vegetarian</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{toddlerRecipes.filter(r => r.freezable).length}</div>
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
                <option value="Main Dish">Main Dish</option>
                <option value="Protein">Protein</option>
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

        <Card className="mb-8 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-600" />
              Transitioning to Family Foods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              After 12 months, toddlers can enjoy most family foods! Here are key milestones and tips.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {transitionTips.map((tip, idx) => {
                const Icon = tip.icon;
                return (
                  <div key={idx} className="p-4 bg-white rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-5 w-5 ${tip.color}`} />
                      <h3 className="font-semibold text-sm">{tip.title}</h3>
                    </div>
                    <p className="text-xs text-gray-600">{tip.content}</p>
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
                <div className="relative h-48 bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                  <Baby className="h-20 w-20 text-blue-300 opacity-40" />
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
                    {recipe.familyFriendly && (
                      <Badge className="bg-blue-500 text-white text-xs">
                        <Utensils className="h-3 w-3 mr-1" />
                        Family
                      </Badge>
                    )}
                  </div>
                  <div className="absolute top-3 right-3">
                    {recipe.freezable && (
                      <Badge className="bg-cyan-500 text-white text-xs">
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
                      <div className="font-bold text-blue-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-green-600">{recipe.nutrition.protein}g</div>
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

                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
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
                Picky Eating Phase
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Picky eating is normal between 1-3 years. Here's how to navigate it:
              </p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Keep offering rejected foods without pressure</div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Let them see you enjoying varied foods</div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Involve them in meal prep and cooking</div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">Avoid making separate "kids' meals"</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-orange-500" />
                Still Avoid These Foods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Even after 12 months, some foods remain choking hazards:
              </p>
              <div className="space-y-2">
                <div className="p-2 bg-red-50 rounded text-sm">
                  <strong>Whole grapes, cherry tomatoes:</strong> Cut lengthwise into quarters
                </div>
                <div className="p-2 bg-orange-50 rounded text-sm">
                  <strong>Whole nuts, seeds:</strong> Avoid until age 4-5
                </div>
                <div className="p-2 bg-yellow-50 rounded text-sm">
                  <strong>Popcorn, hard candy:</strong> Wait until age 4+
                </div>
                <div className="p-2 bg-red-50 rounded text-sm">
                  <strong>Hot dogs, sausages:</strong> Cut lengthwise, then into small pieces
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
