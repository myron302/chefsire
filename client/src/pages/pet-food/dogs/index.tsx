import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Dog, Bone, Heart, Star, ArrowLeft, Leaf,
  Search, Clock, Users, Award, ChefHat
} from 'lucide-react';

interface DogRecipe {
  id: string;
  name: string;
  description: string;
  image: string;
  category: string;
  ageGroup: 'Puppy' | 'Adult' | 'Senior';
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

const dogRecipes: DogRecipe[] = [
  {
    id: 'dog-1',
    name: 'Chicken & Sweet Potato Bowl',
    description: 'Protein-rich meal perfect for active adult dogs',
    image: 'https://images.unsplash.com/photo-1587764379873-97837921fd44?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 30,
    servings: 4,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['Grain-Free'],
    nutrition: {
      calories: 285,
      protein: 25,
      fat: 12,
      carbs: 18,
      fiber: 3
    },
    ingredients: [
      '2 cups cooked chicken breast, diced',
      '1 cup sweet potato, cooked and mashed',
      '1/2 cup green beans, chopped',
      '1/4 cup carrots, diced',
      '1 tbsp olive oil'
    ],
    instructions: [
      'Cook chicken breast thoroughly and dice',
      'Steam or boil sweet potato until tender',
      'Lightly steam green beans and carrots',
      'Mix all ingredients together',
      'Let cool before serving'
    ],
    rating: 4.9,
    reviews: 342,
    featured: true
  },
  {
    id: 'dog-2',
    name: 'Beef & Rice Delight',
    description: 'Classic comfort food for sensitive stomachs',
    image: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 35,
    servings: 6,
    difficulty: 'Easy',
    organic: false,
    specialDiet: [],
    nutrition: {
      calories: 320,
      protein: 28,
      fat: 14,
      carbs: 22,
      fiber: 2
    },
    ingredients: [
      '1 lb lean ground beef',
      '2 cups brown rice, cooked',
      '1 cup peas',
      '1/2 cup carrots, diced',
      '1 tbsp fish oil'
    ],
    instructions: [
      'Brown ground beef in a pan',
      'Cook brown rice according to package',
      'Steam peas and carrots',
      'Combine all ingredients',
      'Add fish oil and mix well'
    ],
    rating: 4.7,
    reviews: 289,
    featured: true
  },
  {
    id: 'dog-3',
    name: 'Puppy Growth Formula',
    description: 'Nutrient-dense meal for growing puppies',
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Puppy',
    prepTime: 25,
    servings: 3,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['High-Protein'],
    nutrition: {
      calories: 340,
      protein: 32,
      fat: 16,
      carbs: 20,
      fiber: 3
    },
    ingredients: [
      '1.5 cups ground turkey',
      '1 cup quinoa, cooked',
      '1/2 cup pumpkin puree',
      '1/4 cup blueberries',
      '1 egg, scrambled'
    ],
    instructions: [
      'Cook ground turkey thoroughly',
      'Prepare quinoa as directed',
      'Scramble egg separately',
      'Mix all ingredients including blueberries',
      'Serve at room temperature'
    ],
    rating: 4.8,
    reviews: 198,
    featured: true
  },
  {
    id: 'dog-4',
    name: 'Senior Gentle Blend',
    description: 'Easy-to-digest meal for older dogs',
    image: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Senior',
    prepTime: 40,
    servings: 4,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['Low-Fat', 'Joint Support'],
    nutrition: {
      calories: 240,
      protein: 22,
      fat: 8,
      carbs: 24,
      fiber: 4
    },
    ingredients: [
      '2 cups white fish, cooked and flaked',
      '1 cup oatmeal, cooked',
      '1/2 cup zucchini, steamed',
      '1/4 cup spinach, chopped',
      '1 tsp glucosamine powder'
    ],
    instructions: [
      'Bake or steam fish until fully cooked',
      'Cook oatmeal with extra water for soft texture',
      'Steam vegetables until very soft',
      'Flake fish and mix with oatmeal',
      'Add vegetables and glucosamine'
    ],
    rating: 4.9,
    reviews: 156,
    featured: false
  },
  {
    id: 'dog-5',
    name: 'Turkey & Veggie Medley',
    description: 'Balanced nutrition for all life stages',
    image: 'https://images.unsplash.com/photo-1609097718276-0e7f464f1c56?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 30,
    servings: 5,
    difficulty: 'Easy',
    organic: false,
    specialDiet: [],
    nutrition: {
      calories: 295,
      protein: 26,
      fat: 11,
      carbs: 20,
      fiber: 3
    },
    ingredients: [
      '2 cups ground turkey',
      '1 cup butternut squash, cubed',
      '1/2 cup green beans',
      '1/2 cup carrots',
      '1 tbsp coconut oil'
    ],
    instructions: [
      'Brown turkey in a large pan',
      'Roast butternut squash until tender',
      'Steam green beans and carrots',
      'Combine all ingredients',
      'Mix in coconut oil before serving'
    ],
    rating: 4.6,
    reviews: 234,
    featured: false
  },
  {
    id: 'dog-6',
    name: 'Lamb & Barley Stew',
    description: 'Hearty meal for cold weather',
    image: 'https://images.unsplash.com/photo-1546933999-e6f0aae6423b?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 45,
    servings: 6,
    difficulty: 'Medium',
    organic: true,
    specialDiet: [],
    nutrition: {
      calories: 310,
      protein: 24,
      fat: 13,
      carbs: 25,
      fiber: 4
    },
    ingredients: [
      '1.5 lbs lamb, cubed',
      '1 cup pearl barley, cooked',
      '1 cup sweet potato, diced',
      '1/2 cup peas',
      '2 cups low-sodium broth'
    ],
    instructions: [
      'Brown lamb cubes in pot',
      'Add vegetables and broth',
      'Simmer for 30 minutes',
      'Add cooked barley',
      'Cool completely before serving'
    ],
    rating: 4.8,
    reviews: 167,
    featured: false
  },
  {
    id: 'dog-7',
    name: 'Salmon & Potato Power',
    description: 'Omega-3 rich recipe for healthy coat',
    image: 'https://images.unsplash.com/photo-1574418011647-f0c1cd0e3359?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 35,
    servings: 4,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['Grain-Free', 'Skin & Coat'],
    nutrition: {
      calories: 305,
      protein: 27,
      fat: 15,
      carbs: 18,
      fiber: 3
    },
    ingredients: [
      '2 cups fresh salmon, cooked',
      '1.5 cups white potato, boiled',
      '1/2 cup broccoli, steamed',
      '1/4 cup carrots, diced',
      '1 tbsp flaxseed oil'
    ],
    instructions: [
      'Bake salmon until fully cooked',
      'Boil potatoes until tender',
      'Steam broccoli and carrots',
      'Flake salmon and mix with vegetables',
      'Drizzle with flaxseed oil'
    ],
    rating: 4.9,
    reviews: 278,
    featured: true
  },
  {
    id: 'dog-8',
    name: 'Peanut Butter Training Treats',
    description: 'Healthy homemade treats for training sessions',
    image: 'https://images.unsplash.com/photo-1623387641168-d9803ddd3f35?w=400&h=300&fit=crop',
    category: 'Treats',
    ageGroup: 'Adult',
    prepTime: 20,
    servings: 24,
    difficulty: 'Easy',
    organic: false,
    specialDiet: [],
    nutrition: {
      calories: 45,
      protein: 2,
      fat: 2,
      carbs: 5,
      fiber: 1
    },
    ingredients: [
      '1 cup whole wheat flour',
      '1/2 cup natural peanut butter',
      '1 egg',
      '1/4 cup water',
      '1 tbsp honey'
    ],
    instructions: [
      'Preheat oven to 350°F',
      'Mix all ingredients into dough',
      'Roll out and cut into small pieces',
      'Bake for 15 minutes',
      'Cool completely before storing'
    ],
    rating: 4.7,
    reviews: 412,
    featured: false
  },
  {
    id: 'dog-9',
    name: 'Chicken Liver Superfood',
    description: 'Iron-rich meal for energy and vitality',
    image: 'https://images.unsplash.com/photo-1583511655826-05700d7ba960?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 25,
    servings: 4,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['High-Protein', 'Iron-Rich'],
    nutrition: {
      calories: 280,
      protein: 30,
      fat: 10,
      carbs: 16,
      fiber: 2
    },
    ingredients: [
      '1 lb chicken liver',
      '1 cup brown rice, cooked',
      '1/2 cup spinach, chopped',
      '1/4 cup carrots, grated',
      '1 tbsp parsley, chopped'
    ],
    instructions: [
      'Thoroughly cook chicken liver',
      'Chop liver into small pieces',
      'Mix with cooked rice',
      'Add vegetables',
      'Serve in small portions'
    ],
    rating: 4.5,
    reviews: 145,
    featured: false
  },
  {
    id: 'dog-10',
    name: 'Veggie Dental Chews',
    description: 'Natural dental health treats',
    image: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=400&h=300&fit=crop',
    category: 'Treats',
    ageGroup: 'Adult',
    prepTime: 30,
    servings: 20,
    difficulty: 'Hard',
    organic: true,
    specialDiet: ['Dental Health', 'Vegetarian'],
    nutrition: {
      calories: 35,
      protein: 1,
      fat: 1,
      carbs: 6,
      fiber: 2
    },
    ingredients: [
      '1 cup oat flour',
      '1/2 cup carrot, pureed',
      '1/2 cup parsley, finely chopped',
      '1 egg',
      '2 tbsp coconut oil'
    ],
    instructions: [
      'Preheat oven to 325°F',
      'Blend all ingredients into stiff dough',
      'Roll into stick shapes',
      'Bake for 25 minutes until hard',
      'Store in airtight container'
    ],
    rating: 4.6,
    reviews: 189,
    featured: false
  },
  {
    id: 'dog-11',
    name: 'Puppy Banana Bites',
    description: 'Gentle treats for teething puppies',
    image: 'https://images.unsplash.com/photo-1615751072497-5f5169febe17?w=400&h=300&fit=crop',
    category: 'Treats',
    ageGroup: 'Puppy',
    prepTime: 15,
    servings: 15,
    difficulty: 'Easy',
    organic: true,
    specialDiet: [],
    nutrition: {
      calories: 40,
      protein: 2,
      fat: 1,
      carbs: 7,
      fiber: 1
    },
    ingredients: [
      '1 ripe banana, mashed',
      '1/2 cup oat flour',
      '1 egg',
      '1 tbsp honey',
      '1/4 tsp cinnamon'
    ],
    instructions: [
      'Preheat oven to 300°F',
      'Mix mashed banana with egg',
      'Add flour and honey',
      'Drop small spoonfuls on baking sheet',
      'Bake for 12 minutes'
    ],
    rating: 4.8,
    reviews: 223,
    featured: false
  },
  {
    id: 'dog-12',
    name: 'Senior Joint Support Meal',
    description: 'Anti-inflammatory ingredients for aging joints',
    image: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Senior',
    prepTime: 35,
    servings: 4,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['Joint Support', 'Anti-Inflammatory'],
    nutrition: {
      calories: 260,
      protein: 24,
      fat: 9,
      carbs: 22,
      fiber: 4
    },
    ingredients: [
      '2 cups turkey breast, cooked',
      '1 cup sweet potato, mashed',
      '1/2 cup kale, finely chopped',
      '1/4 cup blueberries',
      '1 tsp turmeric powder',
      '1 tbsp fish oil'
    ],
    instructions: [
      'Cook turkey and dice finely',
      'Steam sweet potato until very soft',
      'Lightly steam kale',
      'Mix all ingredients thoroughly',
      'Add turmeric and fish oil before serving'
    ],
    rating: 4.9,
    reviews: 134,
    featured: true
  }
];

export default function DogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('');
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
    // Save to localStorage
    localStorage.setItem('dogFavorites', JSON.stringify([...newFavorites]));
  };

  // Load favorites from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('dogFavorites');
    if (saved) {
      setFavorites(new Set(JSON.parse(saved)));
    }
  }, []);

  const getFilteredRecipes = () => {
    let filtered = dogRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAge = !selectedAge || recipe.ageGroup === selectedAge;
      const matchesDifficulty = !selectedDifficulty || recipe.difficulty === selectedDifficulty;
      const matchesOrganic = !showOrganic || recipe.organic;
      
      return matchesSearch && matchesAge && matchesDifficulty && matchesOrganic;
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
  const featuredRecipes = dogRecipes.filter(r => r.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
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
                <Dog className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">Dog Food Recipes</h1>
                <Badge className="bg-orange-100 text-orange-800">Homemade</Badge>
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
              <div className="text-2xl font-bold text-orange-600">{dogRecipes.length}</div>
              <div className="text-sm text-gray-600">Total Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{dogRecipes.filter(r => r.organic).length}</div>
              <div className="text-sm text-gray-600">Organic Options</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{dogRecipes.filter(r => r.category === 'Main Meal').length}</div>
              <div className="text-sm text-gray-600">Main Meals</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{dogRecipes.filter(r => r.category === 'Treats').length}</div>
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
                value={selectedAge}
                onChange={(e) => setSelectedAge(e.target.value)}
              >
                <option value="">All Ages</option>
                <option value="Puppy">Puppy</option>
                <option value="Adult">Adult</option>
                <option value="Senior">Senior</option>
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
                        <Badge variant="outline" className="text-xs mb-2">{recipe.ageGroup}</Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                    
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
                      <Badge variant="outline" className="text-xs mb-2">{recipe.ageGroup}</Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                  
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
                <Bone className="h-6 w-6 text-orange-500" />
                Feeding Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-semibold text-sm text-orange-800 mb-1">Portion Control</div>
                  <div className="text-xs text-orange-700">Adjust serving sizes based on your dog's weight and activity level</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-semibold text-sm text-blue-800 mb-1">Gradual Transition</div>
                  <div className="text-xs text-blue-700">Mix new foods gradually with current diet over 7-10 days</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-semibold text-sm text-green-800 mb-1">Fresh Water</div>
                  <div className="text-xs text-green-700">Always provide clean, fresh water alongside meals</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Dog className="h-6 w-6 text-red-500" />
                Safety Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="font-semibold text-sm text-red-800 mb-1">Toxic Foods</div>
                  <div className="text-xs text-red-700">Never feed: chocolate, grapes, onions, garlic, xylitol, or avocado pits</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-sm text-yellow-800 mb-1">Cooked Bones Only</div>
                  <div className="text-xs text-yellow-700">Avoid cooked bones - they can splinter. Raw meaty bones are safer</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="font-semibold text-sm text-purple-800 mb-1">Consult Your Vet</div>
                  <div className="text-xs text-purple-700">Discuss diet changes with your veterinarian, especially for health issues</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}