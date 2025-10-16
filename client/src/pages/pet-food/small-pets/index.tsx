import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Rabbit, Leaf, Heart, Star, ArrowLeft, Carrot,
  Search, Clock, Users, Award, ChefHat, Sparkles
} from 'lucide-react';

interface SmallPetRecipe {
  id: string;
  name: string;
  description: string;
  image: string;
  category: string;
  petType: 'Rabbit' | 'Guinea Pig' | 'Hamster' | 'All Small Pets';
  prepTime: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  organic: boolean;
  specialDiet?: string[];
  nutrition: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber?: number;
  };
  ingredients: string[];
  instructions: string[];
  rating: number;
  reviews: number;
  featured?: boolean;
}

const smallPetRecipes: SmallPetRecipe[] = [
  {
    id: 'small-1',
    name: 'Fresh Veggie Salad Bowl',
    description: 'Colorful mix of fresh vegetables for rabbits',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
    category: 'Fresh Food',
    petType: 'Rabbit',
    prepTime: 10,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Fresh', 'High-Fiber'],
    nutrition: {
      calories: 45,
      protein: 2,
      fat: 0.3,
      carbs: 8,
      fiber: 3
    },
    ingredients: [
      '1 cup romaine lettuce, chopped',
      '1/2 cup kale, chopped',
      '1/4 cup carrots, sliced thin',
      '1/4 cup bell pepper, diced',
      '2 tbsp cilantro, chopped'
    ],
    instructions: [
      'Wash all vegetables thoroughly',
      'Chop into bite-sized pieces',
      'Mix all ingredients together',
      'Serve fresh daily',
      'Remove uneaten portions after 4 hours'
    ],
    rating: 4.9,
    reviews: 378,
    featured: true
  },
  {
    id: 'small-2',
    name: 'Timothy Hay Cookies',
    description: 'Fiber-rich treats for dental health',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
    category: 'Treats',
    petType: 'All Small Pets',
    prepTime: 25,
    servings: 15,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['Dental Health', 'High-Fiber'],
    nutrition: {
      calories: 30,
      protein: 3,
      fat: 1,
      carbs: 5,
      fiber: 2
    },
    ingredients: [
      '1 cup timothy hay, finely ground',
      '1/4 cup oat flour',
      '2 tbsp unsweetened applesauce',
      '1 tbsp ground flaxseed',
      '2 tbsp water'
    ],
    instructions: [
      'Preheat oven to 300°F',
      'Mix all ingredients into dough',
      'Roll into small balls',
      'Flatten slightly',
      'Bake for 20 minutes until hard'
    ],
    rating: 4.8,
    reviews: 445,
    featured: true
  },
  {
    id: 'small-3',
    name: 'Guinea Pig Vitamin C Mix',
    description: 'Essential vitamin C-rich vegetable blend',
    image: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=400&h=300&fit=crop',
    category: 'Fresh Food',
    petType: 'Guinea Pig',
    prepTime: 8,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Vitamin C', 'Fresh'],
    nutrition: {
      calories: 55,
      protein: 2,
      fat: 0.4,
      carbs: 11,
      fiber: 3
    },
    ingredients: [
      '1/2 cup bell pepper (red or yellow)',
      '1/4 cup kale',
      '1/4 cup parsley',
      '2 tbsp tomato, diced',
      '1/4 cup cucumber, sliced'
    ],
    instructions: [
      'Choose vitamin C-rich vegetables',
      'Wash and chop all vegetables',
      'Mix together in bowl',
      'Serve twice daily',
      'Ensure fresh and crisp'
    ],
    rating: 4.9,
    reviews: 289,
    featured: true
  },
  {
    id: 'small-4',
    name: 'Hamster Seed & Grain Mix',
    description: 'Balanced dry food blend for hamsters',
    image: 'https://images.unsplash.com/photo-1574856344991-aaa31b6f4ce3?w=400&h=300&fit=crop',
    category: 'Dry Food',
    petType: 'Hamster',
    prepTime: 5,
    servings: 20,
    difficulty: 'Easy',
    organic: false,
    specialDiet: [],
    nutrition: {
      calories: 85,
      protein: 4,
      fat: 3,
      carbs: 12,
      fiber: 2
    },
    ingredients: [
      '1/4 cup sunflower seeds (unsalted)',
      '1/4 cup millet',
      '1/4 cup oats',
      '2 tbsp flax seeds',
      '2 tbsp pumpkin seeds'
    ],
    instructions: [
      'Ensure all seeds are unsalted',
      'Mix all ingredients thoroughly',
      'Store in airtight container',
      'Serve 1-2 teaspoons daily',
      'Monitor for overfeeding'
    ],
    rating: 4.7,
    reviews: 356,
    featured: false
  },
  {
    id: 'small-5',
    name: 'Carrot & Apple Treat Sticks',
    description: 'Crunchy treats for all small pets',
    image: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&h=300&fit=crop',
    category: 'Treats',
    petType: 'All Small Pets',
    prepTime: 30,
    servings: 12,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['Dental Health'],
    nutrition: {
      calories: 25,
      protein: 0.5,
      fat: 0.2,
      carbs: 6,
      fiber: 1
    },
    ingredients: [
      '1 large carrot, grated',
      '1 apple, grated (no seeds)',
      '1/4 cup oat flour',
      '2 tbsp water',
      '1 tsp cinnamon'
    ],
    instructions: [
      'Preheat oven to 325°F',
      'Grate carrot and apple',
      'Mix with flour and water',
      'Form into stick shapes',
      'Bake for 25 minutes'
    ],
    rating: 4.8,
    reviews: 267,
    featured: false
  },
  {
    id: 'small-6',
    name: 'Rabbit Herb Garden Mix',
    description: 'Fresh herbs for digestive health',
    image: 'https://images.unsplash.com/photo-1628102491926-5c0d6e0d856e?w=400&h=300&fit=crop',
    category: 'Fresh Food',
    petType: 'Rabbit',
    prepTime: 5,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Digestive Health', 'Fresh'],
    nutrition: {
      calories: 15,
      protein: 1,
      fat: 0.2,
      carbs: 2,
      fiber: 1
    },
    ingredients: [
      '2 tbsp fresh basil',
      '2 tbsp fresh cilantro',
      '2 tbsp fresh parsley',
      '1 tbsp fresh mint',
      '1 tbsp fresh dill'
    ],
    instructions: [
      'Rinse herbs thoroughly',
      'Chop into small pieces',
      'Mix together',
      'Serve as small portion',
      'Introduce herbs gradually'
    ],
    rating: 4.7,
    reviews: 189,
    featured: false
  },
  {
    id: 'small-7',
    name: 'Guinea Pig Pellet Blend',
    description: 'Fortified pellets with vitamin C',
    image: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=400&h=300&fit=crop',
    category: 'Dry Food',
    petType: 'Guinea Pig',
    prepTime: 2,
    servings: 1,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Vitamin C', 'Fortified'],
    nutrition: {
      calories: 95,
      protein: 6,
      fat: 2,
      carbs: 14,
      fiber: 4
    },
    ingredients: [
      '1/4 cup timothy-based pellets',
      'Vitamin C supplement as directed'
    ],
    instructions: [
      'Measure appropriate pellet amount',
      'Add vitamin C if needed',
      'Serve in clean bowl',
      'Provide twice daily',
      'Remove uneaten pellets after 24 hours'
    ],
    rating: 4.6,
    reviews: 234,
    featured: false
  },
  {
    id: 'small-8',
    name: 'Hamster Veggie Bites',
    description: 'Small vegetable pieces for variety',
    image: 'https://images.unsplash.com/photo-1583265266850-9013a39e3753?w=400&h=300&fit=crop',
    category: 'Fresh Food',
    petType: 'Hamster',
    prepTime: 8,
    servings: 3,
    difficulty: 'Easy',
    organic: true,
    specialDiet: [],
    nutrition: {
      calories: 20,
      protein: 1,
      fat: 0.2,
      carbs: 4,
      fiber: 1
    },
    ingredients: [
      '1 tbsp cucumber, diced',
      '1 tbsp carrot, diced',
      '1 tbsp zucchini, diced',
      '1 tsp bell pepper, minced',
      '1 tsp broccoli floret, minced'
    ],
    instructions: [
      'Dice all vegetables very small',
      'Mix together in tiny portions',
      'Serve small amount (1-2 tsp)',
      'Offer in evening when active',
      'Remove after 2 hours'
    ],
    rating: 4.5,
    reviews: 167,
    featured: false
  },
  {
    id: 'small-9',
    name: 'Berry & Greens Blend',
    description: 'Antioxidant treat for rabbits',
    image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&h=300&fit=crop',
    category: 'Treats',
    petType: 'Rabbit',
    prepTime: 6,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Antioxidant'],
    nutrition: {
      calories: 35,
      protein: 1,
      fat: 0.3,
      carbs: 8,
      fiber: 2
    },
    ingredients: [
      '3 strawberries, sliced',
      '5 blueberries',
      '1/4 cup romaine lettuce',
      '2 tbsp kale',
      '1 tbsp parsley'
    ],
    instructions: [
      'Wash all fruits and greens',
      'Slice strawberries thin',
      'Mix with greens',
      'Serve as occasional treat',
      'Limit fruit to 1-2 times/week'
    ],
    rating: 4.9,
    reviews: 312,
    featured: false
  },
  {
    id: 'small-10',
    name: 'Oat & Hay Clusters',
    description: 'Chewy treats for dental health',
    image: 'https://images.unsplash.com/photo-1589329482896-a0e08fc6b5e6?w=400&h=300&fit=crop',
    category: 'Treats',
    petType: 'All Small Pets',
    prepTime: 35,
    servings: 18,
    difficulty: 'Hard',
    organic: true,
    specialDiet: ['Dental Health'],
    nutrition: {
      calories: 40,
      protein: 2,
      fat: 1,
      carbs: 7,
      fiber: 2
    },
    ingredients: [
      '1 cup rolled oats',
      '1/2 cup timothy hay, ground',
      '1/4 cup unsweetened applesauce',
      '2 tbsp ground flaxseed',
      '1 tbsp molasses (optional, small amount)'
    ],
    instructions: [
      'Preheat oven to 300°F',
      'Mix all dry ingredients',
      'Add applesauce and mix',
      'Form into small clusters',
      'Bake for 30 minutes until firm'
    ],
    rating: 4.7,
    reviews: 223,
    featured: false
  },
  {
    id: 'small-11',
    name: 'Green Leafy Power Bowl',
    description: 'Calcium-rich greens for guinea pigs',
    image: 'https://images.unsplash.com/photo-1622973536968-3ead9e780960?w=400&h=300&fit=crop',
    category: 'Fresh Food',
    petType: 'Guinea Pig',
    prepTime: 7,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Calcium-Rich', 'Vitamin C'],
    nutrition: {
      calories: 25,
      protein: 2,
      fat: 0.3,
      carbs: 4,
      fiber: 2
    },
    ingredients: [
      '1/2 cup romaine lettuce',
      '1/4 cup spinach',
      '1/4 cup cilantro',
      '2 tbsp parsley',
      '1 tbsp dandelion greens'
    ],
    instructions: [
      'Wash all greens thoroughly',
      'Chop into manageable pieces',
      'Mix variety of greens',
      'Serve twice daily',
      'Rotate greens for variety'
    ],
    rating: 4.8,
    reviews: 278,
    featured: false
  },
  {
    id: 'small-12',
    name: 'Protein Seed Balls',
    description: 'High-energy treats for hamsters',
    image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop',
    category: 'Treats',
    petType: 'Hamster',
    prepTime: 15,
    servings: 10,
    difficulty: 'Medium',
    organic: false,
    specialDiet: ['High-Protein'],
    nutrition: {
      calories: 50,
      protein: 3,
      fat: 3,
      carbs: 4,
      fiber: 1
    },
    ingredients: [
      '2 tbsp sunflower seeds',
      '2 tbsp pumpkin seeds',
      '1 tbsp sesame seeds',
      '1 tbsp oat flour',
      '1 tsp peanut butter (unsalted)'
    ],
    instructions: [
      'Grind seeds coarsely',
      'Mix with oat flour',
      'Add tiny bit of peanut butter',
      'Roll into tiny balls',
      'Serve 1-2 per week as treats'
    ],
    rating: 4.6,
    reviews: 145,
    featured: true
  }
];

export default function SmallPetsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [showOrganic, setShowOrganic] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFavorite = (recipeId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(recipeId)) {
      newFavorites.delete(recipeId);
    } else {
      newFavorites.add(recipeId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('smallPetFavorites', JSON.stringify([...newFavorites]));
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('smallPetFavorites');
    if (saved) {
      setFavorites(new Set(JSON.parse(saved)));
    }
  }, []);

  const getFilteredRecipes = () => {
    let filtered = smallPetRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedType || recipe.petType === selectedType || recipe.petType === 'All Small Pets';
      const matchesDifficulty = !selectedDifficulty || recipe.difficulty === selectedDifficulty;
      const matchesOrganic = !showOrganic || recipe.organic;
      
      return matchesSearch && matchesType && matchesDifficulty && matchesOrganic;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'prepTime': return (a.prepTime || 0) - (b.prepTime || 0);
        case 'difficulty': return a.difficulty.localeCompare(b.difficulty);
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredRecipes = getFilteredRecipes();
  const featuredRecipes = smallPetRecipes.filter(r => r.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/pet-food">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Pet Food
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Rabbit className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Small Pet Food Recipes</h1>
                <Badge className="bg-green-100 text-green-800">Homemade</Badge>
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
              <div className="text-2xl font-bold text-green-600">{smallPetRecipes.length}</div>
              <div className="text-sm text-gray-600">Total Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{smallPetRecipes.filter(r => r.organic).length}</div>
              <div className="text-sm text-gray-600">Organic Options</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-teal-600">{smallPetRecipes.filter(r => r.category === 'Fresh Food').length}</div>
              <div className="text-sm text-gray-600">Fresh Foods</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-lime-600">{smallPetRecipes.filter(r => r.category === 'Treats').length}</div>
              <div className="text-sm text-gray-600">Treats</div>
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
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">All Pet Types</option>
                <option value="Rabbit">Rabbit</option>
                <option value="Guinea Pig">Guinea Pig</option>
                <option value="Hamster">Hamster</option>
              </select>

              <select 
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
              >
                <option value="">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
              
              <Button
                variant={showOrganic ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOrganic(!showOrganic)}
                className={showOrganic ? 'bg-green-600' : ''}
              >
                <Leaf className="h-4 w-4 mr-1" />
                Organic
              </Button>
              
              <select 
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="rating">Sort by Rating</option>
                <option value="prepTime">Sort by Prep Time</option>
                <option value="difficulty">Sort by Difficulty</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Featured Recipes */}
        {featuredRecipes.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Award className="h-6 w-6 text-yellow-500" />
              Featured Recipes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredRecipes.slice(0, 3).map(recipe => (
                <Card key={recipe.id} className="hover:shadow-lg transition-shadow border-2 border-yellow-200">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={recipe.image} 
                      alt={recipe.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      {recipe.organic && (
                        <Badge className="bg-green-500 text-white text-xs">
                          <Leaf className="h-3 w-3 mr-1" />
                          Organic
                        </Badge>
                      )}
                      <Badge className="bg-yellow-500 text-white text-xs">
                        <Award className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="bg-white/90 hover:bg-white"
                        onClick={() => toggleFavorite(recipe.id)}
                      >
                        <Heart className={`h-4 w-4 ${favorites.has(recipe.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-1">{recipe.name}</h3>
                        <Badge variant="outline" className="text-xs mb-2">{recipe.petType}</Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                    
                    <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                      <div>
                        <div className="font-bold text-green-600">{recipe.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="font-bold text-emerald-600">{recipe.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="font-bold text-teal-600">{recipe.prepTime}m</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                      <div>
                        <div className="font-bold text-lime-600">{recipe.servings}</div>
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
                      <ChefHat className="h-4 w-4 mr-2" />
                      View Recipe
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Recipes */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            All Recipes ({filteredRecipes.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map(recipe => (
              <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={recipe.image} 
                    alt={recipe.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {recipe.organic && (
                      <Badge className="bg-green-500 text-white text-xs">
                        <Leaf className="h-3 w-3 mr-1" />
                        Organic
                      </Badge>
                    )}
                    {recipe.specialDiet && recipe.specialDiet.length > 0 && (
                      <Badge className="bg-blue-500 text-white text-xs">
                        {recipe.specialDiet[0]}
                      </Badge>
                    )}
                  </div>
                  <div className="absolute top-3 right-3">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="bg-white/90 hover:bg-white"
                      onClick={() => toggleFavorite(recipe.id)}
                    >
                      <Heart className={`h-4 w-4 ${favorites.has(recipe.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">{recipe.name}</h3>
                      <Badge variant="outline" className="text-xs mb-2">{recipe.petType}</Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                  
                  <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                    <div>
                      <div className="font-bold text-green-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-emerald-600">{recipe.nutrition.protein}g</div>
                      <div className="text-gray-500">Protein</div>
                    </div>
                    <div>
                      <div className="font-bold text-teal-600">{recipe.prepTime}m</div>
                      <div className="text-gray-500">Prep</div>
                    </div>
                    <div>
                      <div className="font-bold text-lime-600">{recipe.servings}</div>
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
                    <ChefHat className="h-4 w-4 mr-2" />
                    View Recipe
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Safety Tips */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Carrot className="h-6 w-6 text-green-500" />
                Feeding Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-semibold text-sm text-green-800 mb-1">Unlimited Hay</div>
                  <div className="text-xs text-green-700">Timothy hay should be available 24/7 for rabbits and guinea pigs</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="font-semibold text-sm text-emerald-800 mb-1">Fresh Daily</div>
                  <div className="text-xs text-emerald-700">Provide fresh vegetables daily and remove uneaten portions</div>
                </div>
                <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                  <div className="font-semibold text-sm text-teal-800 mb-1">Introduce Slowly</div>
                  <div className="text-xs text-teal-700">Add new foods gradually to avoid digestive upset</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rabbit className="h-6 w-6 text-red-500" />
                Safety Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="font-semibold text-sm text-red-800 mb-1">Toxic Foods</div>
                  <div className="text-xs text-red-700">Never feed: chocolate, avocado, rhubarb leaves, or anything with caffeine</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-sm text-yellow-800 mb-1">Limited Treats</div>
                  <div className="text-xs text-yellow-700">Treats should be less than 10% of daily food intake</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-semibold text-sm text-orange-800 mb-1">Guinea Pig Vitamin C</div>
                  <div className="text-xs text-orange-700">Guinea pigs need daily vitamin C - supplement if not in diet</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}