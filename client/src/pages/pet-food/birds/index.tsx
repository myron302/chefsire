import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Bird, Leaf, Heart, Star, ArrowLeft, Apple,
  Search, Clock, Users, Award, ChefHat, Sparkles
} from 'lucide-react';

interface BirdRecipe {
  id: string;
  name: string;
  description: string;
  image: string;
  category: string;
  birdType: 'Parrot' | 'Canary' | 'Finch' | 'Cockatiel' | 'All Birds';
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

const birdRecipes: BirdRecipe[] = [
  {
    id: 'bird-1',
    name: 'Tropical Fruit Medley',
    description: 'Colorful mix of fresh fruits for all parrots',
    image: 'https://images.unsplash.com/photo-1558005137-d9619a37a4d5?w=400&h=300&fit=crop',
    category: 'Fresh Food',
    birdType: 'Parrot',
    prepTime: 10,
    servings: 4,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Fresh', 'Vitamin-Rich'],
    nutrition: {
      calories: 85,
      protein: 1,
      fat: 0.5,
      carbs: 20,
      fiber: 3
    },
    ingredients: [
      '1/2 cup mango, diced',
      '1/2 cup papaya, diced',
      '1/4 cup kiwi, sliced',
      '1/4 cup pomegranate seeds',
      '2 tbsp banana, sliced'
    ],
    instructions: [
      'Wash all fruits thoroughly',
      'Dice fruits into bird-appropriate sizes',
      'Mix all fruits together',
      'Serve fresh immediately',
      'Remove uneaten portions after 2 hours'
    ],
    rating: 4.9,
    reviews: 267,
    featured: true
  },
  {
    id: 'bird-2',
    name: 'Seed & Nut Power Mix',
    description: 'Protein and healthy fat blend for energy',
    image: 'https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?w=400&h=300&fit=crop',
    category: 'Dry Food',
    birdType: 'All Birds',
    prepTime: 5,
    servings: 10,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['High-Protein', 'Energy'],
    nutrition: {
      calories: 145,
      protein: 6,
      fat: 11,
      carbs: 8,
      fiber: 2
    },
    ingredients: [
      '1 cup sunflower seeds',
      '1/2 cup pumpkin seeds',
      '1/2 cup almonds, chopped',
      '1/4 cup walnuts, chopped',
      '1/4 cup safflower seeds'
    ],
    instructions: [
      'Ensure all nuts are unsalted',
      'Chop larger nuts to appropriate size',
      'Mix all ingredients thoroughly',
      'Store in airtight container',
      'Serve 1-2 tablespoons daily'
    ],
    rating: 4.8,
    reviews: 342,
    featured: true
  },
  {
    id: 'bird-3',
    name: 'Veggie Chop Bowl',
    description: 'Nutrient-dense vegetable mix for parrots',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
    category: 'Fresh Food',
    birdType: 'Parrot',
    prepTime: 15,
    servings: 6,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Low-Fat', 'Vitamin-Rich'],
    nutrition: {
      calories: 35,
      protein: 2,
      fat: 0.3,
      carbs: 7,
      fiber: 2
    },
    ingredients: [
      '1/2 cup kale, finely chopped',
      '1/4 cup carrots, grated',
      '1/4 cup bell peppers, diced',
      '2 tbsp broccoli florets, minced',
      '2 tbsp sweet potato, cooked and mashed'
    ],
    instructions: [
      'Wash all vegetables thoroughly',
      'Chop into very small pieces',
      'Mix all vegetables together',
      'Add mashed sweet potato',
      'Serve fresh, refrigerate extras'
    ],
    rating: 4.7,
    reviews: 198,
    featured: true
  },
  {
    id: 'bird-4',
    name: 'Quinoa & Sprout Mix',
    description: 'Sprouted grains for optimal nutrition',
    image: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=400&h=300&fit=crop',
    category: 'Cooked Food',
    birdType: 'All Birds',
    prepTime: 20,
    servings: 8,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['Sprouted', 'High-Protein'],
    nutrition: {
      calories: 75,
      protein: 4,
      fat: 1.5,
      carbs: 12,
      fiber: 2
    },
    ingredients: [
      '1 cup cooked quinoa',
      '1/2 cup mung bean sprouts',
      '1/4 cup lentil sprouts',
      '2 tbsp chia seeds',
      '1 tbsp flax seeds'
    ],
    instructions: [
      'Cook quinoa and let cool',
      'Rinse sprouts thoroughly',
      'Mix quinoa with sprouts',
      'Add seeds',
      'Serve at room temperature'
    ],
    rating: 4.8,
    reviews: 156,
    featured: false
  },
  {
    id: 'bird-5',
    name: 'Berry & Greens Blend',
    description: 'Antioxidant-rich meal for canaries',
    image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&h=300&fit=crop',
    category: 'Fresh Food',
    birdType: 'Canary',
    prepTime: 10,
    servings: 4,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Antioxidant-Rich'],
    nutrition: {
      calories: 45,
      protein: 1,
      fat: 0.4,
      carbs: 11,
      fiber: 3
    },
    ingredients: [
      '1/4 cup blueberries',
      '1/4 cup strawberries, diced',
      '2 tbsp spinach, finely chopped',
      '2 tbsp kale, finely chopped',
      '1 tbsp dandelion greens'
    ],
    instructions: [
      'Wash all berries and greens',
      'Dice berries to small sizes',
      'Finely chop all greens',
      'Mix ingredients gently',
      'Serve fresh daily'
    ],
    rating: 4.6,
    reviews: 134,
    featured: false
  },
  {
    id: 'bird-6',
    name: 'Egg & Veggie Scramble',
    description: 'Protein-packed meal for breeding birds',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&h=300&fit=crop',
    category: 'Cooked Food',
    birdType: 'All Birds',
    prepTime: 15,
    servings: 6,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['High-Protein', 'Breeding'],
    nutrition: {
      calories: 95,
      protein: 7,
      fat: 6,
      carbs: 3,
      fiber: 1
    },
    ingredients: [
      '2 eggs, scrambled',
      '2 tbsp peas, mashed',
      '2 tbsp carrots, grated',
      '1 tbsp broccoli, minced',
      '1 tsp nutritional yeast'
    ],
    instructions: [
      'Scramble eggs without oil or butter',
      'Mix in finely chopped vegetables',
      'Cook until fully done',
      'Let cool completely',
      'Sprinkle nutritional yeast on top'
    ],
    rating: 4.9,
    reviews: 223,
    featured: false
  },
  {
    id: 'bird-7',
    name: 'Millet Spray Treats',
    description: 'Natural treat loved by all small birds',
    image: 'https://images.unsplash.com/photo-1589329482896-a0e08fc6b5e6?w=400&h=300&fit=crop',
    category: 'Treats',
    birdType: 'Finch',
    prepTime: 5,
    servings: 1,
    difficulty: 'Easy',
    organic: false,
    specialDiet: [],
    nutrition: {
      calories: 120,
      protein: 4,
      fat: 4,
      carbs: 18,
      fiber: 2
    },
    ingredients: [
      '1 spray millet',
      'Optional: sprinkle of chia seeds'
    ],
    instructions: [
      'Attach millet spray to cage',
      'Ensure fresh and dry',
      'Replace when eaten',
      'Limit to 2-3 times per week',
      'Monitor for overfeeding'
    ],
    rating: 4.7,
    reviews: 445,
    featured: false
  },
  {
    id: 'bird-8',
    name: 'Pellet & Fresh Mix',
    description: 'Balanced daily diet base for cockatiels',
    image: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=400&h=300&fit=crop',
    category: 'Complete Meal',
    birdType: 'Cockatiel',
    prepTime: 5,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Balanced'],
    nutrition: {
      calories: 110,
      protein: 5,
      fat: 3,
      carbs: 16,
      fiber: 3
    },
    ingredients: [
      '2 tbsp high-quality pellets',
      '1 tbsp fresh apple, diced',
      '1 tbsp carrot, grated',
      '1 tsp leafy greens',
      'Pinch of seeds'
    ],
    instructions: [
      'Measure pellets as base',
      'Add fresh fruits and veggies',
      'Mix gently',
      'Top with seeds sparingly',
      'Refresh twice daily'
    ],
    rating: 4.8,
    reviews: 289,
    featured: false
  },
  {
    id: 'bird-9',
    name: 'Banana Oat Bites',
    description: 'Baked treats for training and bonding',
    image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop',
    category: 'Treats',
    birdType: 'Parrot',
    prepTime: 25,
    servings: 20,
    difficulty: 'Medium',
    organic: true,
    specialDiet: [],
    nutrition: {
      calories: 25,
      protein: 1,
      fat: 0.5,
      carbs: 5,
      fiber: 1
    },
    ingredients: [
      '1 ripe banana, mashed',
      '1/4 cup oat flour',
      '2 tbsp ground flax',
      '1 tbsp applesauce',
      '1 tsp cinnamon'
    ],
    instructions: [
      'Preheat oven to 300°F',
      'Mix all ingredients',
      'Roll into small balls',
      'Bake for 15 minutes',
      'Cool completely before serving'
    ],
    rating: 4.9,
    reviews: 367,
    featured: true
  },
  {
    id: 'bird-10',
    name: 'Coconut & Grain Mix',
    description: 'Tropical-inspired dry food blend',
    image: 'https://images.unsplash.com/photo-1622973536968-3ead9e780960?w=400&h=300&fit=crop',
    category: 'Dry Food',
    birdType: 'Parrot',
    prepTime: 10,
    servings: 12,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Tropical'],
    nutrition: {
      calories: 135,
      protein: 3,
      fat: 8,
      carbs: 14,
      fiber: 3
    },
    ingredients: [
      '1/2 cup unsweetened coconut flakes',
      '1/4 cup amaranth',
      '1/4 cup buckwheat',
      '2 tbsp dried papaya, chopped',
      '2 tbsp hemp seeds'
    ],
    instructions: [
      'Mix all dry ingredients',
      'Ensure coconut is unsweetened',
      'Chop dried fruit small',
      'Store in airtight container',
      'Serve 1-2 tablespoons daily'
    ],
    rating: 4.6,
    reviews: 178,
    featured: false
  },
  {
    id: 'bird-11',
    name: 'Apple & Carrot Chop',
    description: 'Sweet and crunchy mix for all birds',
    image: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&h=300&fit=crop',
    category: 'Fresh Food',
    birdType: 'All Birds',
    prepTime: 12,
    servings: 5,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Crunchy'],
    nutrition: {
      calories: 55,
      protein: 0.5,
      fat: 0.3,
      carbs: 14,
      fiber: 3
    },
    ingredients: [
      '1 apple, finely diced',
      '1 large carrot, grated',
      '2 tbsp celery, minced',
      '1 tbsp parsley, chopped',
      'Pinch of cinnamon'
    ],
    instructions: [
      'Remove apple seeds (toxic)',
      'Dice apple into small pieces',
      'Grate carrot finely',
      'Mince celery and parsley',
      'Mix all with light cinnamon dusting'
    ],
    rating: 4.7,
    reviews: 234,
    featured: false
  },
  {
    id: 'bird-12',
    name: 'Legume & Veggie Stew',
    description: 'Warm comfort food for cold days',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop',
    category: 'Cooked Food',
    birdType: 'Parrot',
    prepTime: 30,
    servings: 8,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['Warm Food', 'High-Fiber'],
    nutrition: {
      calories: 90,
      protein: 5,
      fat: 1,
      carbs: 16,
      fiber: 4
    },
    ingredients: [
      '1/4 cup lentils, cooked',
      '1/4 cup chickpeas, cooked',
      '1/4 cup sweet potato, diced',
      '2 tbsp peas',
      '2 tbsp carrots, diced',
      '1 cup low-sodium vegetable broth'
    ],
    instructions: [
      'Cook lentils and chickpeas separately',
      'Dice sweet potato small',
      'Simmer all in broth for 15 minutes',
      'Cool completely before serving',
      'Freeze extras in portions'
    ],
    rating: 4.8,
    reviews: 167,
    featured: false
  }
];

export default function BirdsPage() {
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
    localStorage.setItem('birdFavorites', JSON.stringify([...newFavorites]));
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('birdFavorites');
    if (saved) {
      setFavorites(new Set(JSON.parse(saved)));
    }
  }, []);

  const getFilteredRecipes = () => {
    let filtered = birdRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedType || recipe.birdType === selectedType || recipe.birdType === 'All Birds';
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
  const featuredRecipes = birdRecipes.filter(r => r.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50">
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
                <Bird className="h-6 w-6 text-sky-600" />
                <h1 className="text-2xl font-bold text-gray-900">Bird Food Recipes</h1>
                <Badge className="bg-sky-100 text-sky-800">Homemade</Badge>
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
              <div className="text-2xl font-bold text-sky-600">{birdRecipes.length}</div>
              <div className="text-sm text-gray-600">Total Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{birdRecipes.filter(r => r.organic).length}</div>
              <div className="text-sm text-gray-600">Organic Options</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{birdRecipes.filter(r => r.category === 'Fresh Food').length}</div>
              <div className="text-sm text-gray-600">Fresh Foods</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-600">{birdRecipes.filter(r => r.category === 'Treats').length}</div>
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
                <option value="">All Bird Types</option>
                <option value="Parrot">Parrot</option>
                <option value="Canary">Canary</option>
                <option value="Finch">Finch</option>
                <option value="Cockatiel">Cockatiel</option>
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
                        <Badge variant="outline" className="text-xs mb-2">{recipe.birdType}</Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                    
                    <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                      <div>
                        <div className="font-bold text-sky-600">{recipe.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">{recipe.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="font-bold text-cyan-600">{recipe.prepTime}m</div>
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

                    <Button className="w-full bg-sky-600 hover:bg-sky-700">
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
                      <Badge variant="outline" className="text-xs mb-2">{recipe.birdType}</Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                  
                  <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                    <div>
                      <div className="font-bold text-sky-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">{recipe.nutrition.protein}g</div>
                      <div className="text-gray-500">Protein</div>
                    </div>
                    <div>
                      <div className="font-bold text-cyan-600">{recipe.prepTime}m</div>
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

                  <Button className="w-full bg-sky-600 hover:bg-sky-700">
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
                <Apple className="h-6 w-6 text-sky-500" />
                Feeding Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                  <div className="font-semibold text-sm text-sky-800 mb-1">Fresh Daily</div>
                  <div className="text-xs text-sky-700">Remove fresh food after 2 hours to prevent spoilage</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-semibold text-sm text-blue-800 mb-1">Variety is Key</div>
                  <div className="text-xs text-blue-700">Offer different foods daily for balanced nutrition</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-semibold text-sm text-green-800 mb-1">Chop Small</div>
                  <div className="text-xs text-green-700">Cut food to appropriate size for your bird's beak</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bird className="h-6 w-6 text-red-500" />
                Safety Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="font-semibold text-sm text-red-800 mb-1">Toxic Foods</div>
                  <div className="text-xs text-red-700">Never feed: avocado, chocolate, caffeine, salt, or apple seeds</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-sm text-yellow-800 mb-1">No Teflon Cookware</div>
                  <div className="text-xs text-yellow-700">Teflon fumes are deadly to birds - use stainless steel or cast iron</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-semibold text-sm text-orange-800 mb-1">Clean Water Daily</div>
                  <div className="text-xs text-orange-700">Change water at least twice daily and clean bowls thoroughly</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}