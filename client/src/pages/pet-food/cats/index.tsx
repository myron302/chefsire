import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Cat, Fish, Heart, Star, ArrowLeft, Leaf,
  Search, Clock, Users, Award, ChefHat
} from 'lucide-react';

interface CatRecipe {
  id: string;
  name: string;
  description: string;
  image: string;
  category: string;
  ageGroup: 'Kitten' | 'Adult' | 'Senior';
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
    taurine?: string;
  };
  ingredients: string[];
  instructions: string[];
  rating: number;
  reviews: number;
  featured?: boolean;
}

const catRecipes: CatRecipe[] = [
  {
    id: 'cat-1',
    name: 'Tuna & Salmon Feast',
    description: 'Omega-3 rich seafood meal for healthy coat',
    image: 'https://images.unsplash.com/photo-1551708337-95b1ea8fa1c4?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 20,
    servings: 3,
    difficulty: 'Easy',
    organic: true,
    specialDiet: ['High-Protein', 'Grain-Free'],
    nutrition: {
      calories: 180,
      protein: 25,
      fat: 8,
      carbs: 2,
      taurine: 'High'
    },
    ingredients: [
      '1 cup fresh tuna, cooked',
      '1/2 cup salmon, cooked',
      '1 tbsp fish oil',
      '1/4 cup pumpkin puree',
      '1 tsp taurine supplement'
    ],
    instructions: [
      'Lightly cook tuna and salmon',
      'Flake the fish into small pieces',
      'Mix with pumpkin puree',
      'Add fish oil and taurine',
      'Serve at room temperature'
    ],
    rating: 4.9,
    reviews: 456,
    featured: true
  },
  {
    id: 'cat-2',
    name: 'Chicken & Turkey Medley',
    description: 'Classic poultry combo for picky eaters',
    image: 'https://images.unsplash.com/photo-1591081943659-247207947851?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 25,
    servings: 4,
    difficulty: 'Easy',
    organic: false,
    specialDiet: [],
    nutrition: {
      calories: 165,
      protein: 24,
      fat: 7,
      carbs: 1,
      taurine: 'Moderate'
    },
    ingredients: [
      '1 cup chicken breast, diced',
      '1/2 cup ground turkey',
      '1/4 cup chicken liver',
      '2 tbsp olive oil',
      '1/2 tsp taurine supplement'
    ],
    instructions: [
      'Cook chicken breast and dice finely',
      'Brown ground turkey thoroughly',
      'Cook liver until done',
      'Combine all meats',
      'Mix in olive oil and taurine'
    ],
    rating: 4.7,
    reviews: 312,
    featured: true
  },
  {
    id: 'cat-3',
    name: 'Kitten Growth Formula',
    description: 'High-calorie meal for growing kittens',
    image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Kitten',
    prepTime: 30,
    servings: 2,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['High-Protein', 'High-Calorie'],
    nutrition: {
      calories: 220,
      protein: 28,
      fat: 11,
      carbs: 3,
      taurine: 'Very High'
    },
    ingredients: [
      '1.5 cups ground chicken',
      '1/4 cup chicken liver',
      '1 egg yolk',
      '2 tbsp salmon oil',
      '1 tsp taurine supplement',
      '1/4 cup goat milk'
    ],
    instructions: [
      'Cook ground chicken thoroughly',
      'Cook and mash chicken liver',
      'Mix in raw egg yolk',
      'Add salmon oil and taurine',
      'Blend with goat milk for smooth texture'
    ],
    rating: 4.8,
    reviews: 189,
    featured: true
  },
  {
    id: 'cat-4',
    name: 'Senior Gentle Blend',
    description: 'Easy-to-digest meal for older cats',
    image: 'https://images.unsplash.com/photo-1573865526739-10c1dd3bb7b0?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Senior',
    prepTime: 35,
    servings: 3,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['Low-Fat', 'Kidney Support'],
    nutrition: {
      calories: 145,
      protein: 20,
      fat: 5,
      carbs: 4,
      taurine: 'Moderate'
    },
    ingredients: [
      '1 cup white fish, cooked',
      '1/2 cup chicken breast, finely chopped',
      '1/4 cup sweet potato, mashed',
      '1 tbsp fish oil',
      '1/2 tsp taurine supplement'
    ],
    instructions: [
      'Steam fish until fully cooked',
      'Finely chop chicken breast',
      'Mash sweet potato very smooth',
      'Combine all ingredients gently',
      'Ensure very soft texture for easy eating'
    ],
    rating: 4.9,
    reviews: 234,
    featured: false
  },
  {
    id: 'cat-5',
    name: 'Duck & Liver Pâté',
    description: 'Rich, protein-packed meal for finicky cats',
    image: 'https://images.unsplash.com/photo-1598688090314-d5ff48bb1fb6?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 30,
    servings: 4,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['High-Protein', 'Novel Protein'],
    nutrition: {
      calories: 195,
      protein: 26,
      fat: 9,
      carbs: 2,
      taurine: 'High'
    },
    ingredients: [
      '1 cup duck breast, cooked',
      '1/2 cup chicken liver',
      '1/4 cup duck liver',
      '2 tbsp duck fat',
      '1 tsp taurine supplement'
    ],
    instructions: [
      'Cook duck breast thoroughly',
      'Steam both livers until done',
      'Blend all meats together',
      'Mix in duck fat',
      'Add taurine and serve smooth'
    ],
    rating: 4.8,
    reviews: 178,
    featured: false
  },
  {
    id: 'cat-6',
    name: 'Salmon & Shrimp Delight',
    description: 'Seafood lovers special with extra omega-3',
    image: 'https://images.unsplash.com/photo-1615751072497-5f5169febe17?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 25,
    servings: 3,
    difficulty: 'Easy',
    organic: false,
    specialDiet: ['Grain-Free', 'Skin & Coat'],
    nutrition: {
      calories: 175,
      protein: 24,
      fat: 8,
      carbs: 1,
      taurine: 'High'
    },
    ingredients: [
      '1 cup fresh salmon, cooked',
      '1/2 cup cooked shrimp, chopped',
      '2 tbsp salmon oil',
      '1/4 cup bone broth',
      '1 tsp taurine supplement'
    ],
    instructions: [
      'Bake salmon until cooked through',
      'Boil and chop shrimp',
      'Flake salmon into small pieces',
      'Mix with shrimp and bone broth',
      'Add oil and taurine before serving'
    ],
    rating: 4.7,
    reviews: 267,
    featured: false
  },
  {
    id: 'cat-7',
    name: 'Turkey & Giblets Mix',
    description: 'Nutrient-dense organ meat combination',
    image: 'https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 30,
    servings: 4,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['High-Protein', 'Iron-Rich'],
    nutrition: {
      calories: 185,
      protein: 27,
      fat: 7,
      carbs: 2,
      taurine: 'Very High'
    },
    ingredients: [
      '1 cup ground turkey',
      '1/2 cup turkey heart, chopped',
      '1/4 cup turkey liver',
      '1/4 cup turkey gizzard',
      '1 tbsp coconut oil'
    ],
    instructions: [
      'Cook all turkey parts thoroughly',
      'Finely chop heart and gizzard',
      'Mash liver smooth',
      'Mix all ingredients together',
      'Add coconut oil before serving'
    ],
    rating: 4.6,
    reviews: 145,
    featured: false
  },
  {
    id: 'cat-8',
    name: 'Chicken & Bone Broth',
    description: 'Hydrating meal for cats who don\'t drink enough',
    image: 'https://images.unsplash.com/photo-1569613856878-f3bbaf1c36f3?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 20,
    servings: 3,
    difficulty: 'Easy',
    organic: false,
    specialDiet: ['Hydrating', 'Low-Carb'],
    nutrition: {
      calories: 160,
      protein: 23,
      fat: 6,
      carbs: 1,
      taurine: 'Moderate'
    },
    ingredients: [
      '1.5 cups chicken breast, shredded',
      '1 cup homemade bone broth',
      '1 tbsp chicken fat',
      '1/2 tsp taurine supplement'
    ],
    instructions: [
      'Poach chicken in bone broth',
      'Shred chicken finely',
      'Keep warm bone broth',
      'Mix chicken with broth',
      'Add taurine and serve warm'
    ],
    rating: 4.8,
    reviews: 298,
    featured: false
  },
  {
    id: 'cat-9',
    name: 'Tuna Treats',
    description: 'Crispy training treats cats can\'t resist',
    image: 'https://images.unsplash.com/photo-1589883661923-6476cb0ae9f2?w=400&h=300&fit=crop',
    category: 'Treats',
    ageGroup: 'Adult',
    prepTime: 25,
    servings: 30,
    difficulty: 'Easy',
    organic: false,
    specialDiet: [],
    nutrition: {
      calories: 15,
      protein: 3,
      fat: 0.5,
      carbs: 0.5,
      taurine: 'Low'
    },
    ingredients: [
      '1 can tuna in water, drained',
      '1 egg',
      '1/2 cup oat flour',
      '1/4 tsp catnip (optional)'
    ],
    instructions: [
      'Preheat oven to 350°F',
      'Mix all ingredients into paste',
      'Roll into small balls',
      'Flatten slightly on baking sheet',
      'Bake for 12 minutes until crispy'
    ],
    rating: 4.9,
    reviews: 523,
    featured: true
  },
  {
    id: 'cat-10',
    name: 'Rabbit & Pumpkin Blend',
    description: 'Novel protein for cats with allergies',
    image: 'https://images.unsplash.com/photo-1609682285687-9372a50e0d60?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Adult',
    prepTime: 35,
    servings: 4,
    difficulty: 'Hard',
    organic: true,
    specialDiet: ['Novel Protein', 'Hypoallergenic'],
    nutrition: {
      calories: 170,
      protein: 25,
      fat: 6,
      carbs: 3,
      taurine: 'Moderate'
    },
    ingredients: [
      '1.5 cups ground rabbit',
      '1/4 cup pumpkin puree',
      '1/4 cup rabbit liver',
      '1 tbsp olive oil',
      '1 tsp taurine supplement'
    ],
    instructions: [
      'Cook ground rabbit thoroughly',
      'Cook and mash rabbit liver',
      'Mix meats together',
      'Blend in pumpkin puree',
      'Add oil and taurine before serving'
    ],
    rating: 4.7,
    reviews: 134,
    featured: false
  },
  {
    id: 'cat-11',
    name: 'Kitten Tuna Bites',
    description: 'Soft treats perfect for young kittens',
    image: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=300&fit=crop',
    category: 'Treats',
    ageGroup: 'Kitten',
    prepTime: 20,
    servings: 20,
    difficulty: 'Easy',
    organic: true,
    specialDiet: [],
    nutrition: {
      calories: 20,
      protein: 4,
      fat: 1,
      carbs: 0.5,
      taurine: 'Low'
    },
    ingredients: [
      '1 can tuna in water',
      '1/4 cup oat flour',
      '1 egg',
      '1/2 tsp taurine supplement'
    ],
    instructions: [
      'Preheat oven to 300°F',
      'Blend all ingredients smooth',
      'Drop small spoonfuls on sheet',
      'Bake for 10 minutes',
      'Cool before serving'
    ],
    rating: 4.8,
    reviews: 187,
    featured: false
  },
  {
    id: 'cat-12',
    name: 'Senior Chicken Mousse',
    description: 'Ultra-soft meal for cats with dental issues',
    image: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=400&h=300&fit=crop',
    category: 'Main Meal',
    ageGroup: 'Senior',
    prepTime: 25,
    servings: 3,
    difficulty: 'Medium',
    organic: true,
    specialDiet: ['Soft Food', 'Easy Digest'],
    nutrition: {
      calories: 155,
      protein: 21,
      fat: 6,
      carbs: 2,
      taurine: 'Moderate'
    },
    ingredients: [
      '1.5 cups chicken breast, cooked',
      '1/2 cup chicken broth',
      '1 tbsp chicken liver, cooked',
      '1 tbsp salmon oil',
      '1/2 tsp taurine supplement'
    ],
    instructions: [
      'Blend chicken with broth until smooth',
      'Add cooked liver and blend',
      'Mix in salmon oil',
      'Add taurine supplement',
      'Serve as smooth mousse'
    ],
    rating: 4.9,
    reviews: 167,
    featured: false
  }
];

export default function CatsPage() {
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
    localStorage.setItem('catFavorites', JSON.stringify([...newFavorites]));
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('catFavorites');
    if (saved) {
      setFavorites(new Set(JSON.parse(saved)));
    }
  }, []);

  const getFilteredRecipes = () => {
    let filtered = catRecipes.filter(recipe => {
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
  const featuredRecipes = catRecipes.filter(r => r.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50">
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
                <Cat className="h-6 w-6 text-purple-600" />
                <h1 className="text-2xl font-bold text-gray-900">Cat Food Recipes</h1>
                <Badge className="bg-purple-100 text-purple-800">Homemade</Badge>
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
              <div className="text-2xl font-bold text-purple-600">{catRecipes.length}</div>
              <div className="text-sm text-gray-600">Total Recipes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{catRecipes.filter(r => r.organic).length}</div>
              <div className="text-sm text-gray-600">Organic Options</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{catRecipes.filter(r => r.category === 'Main Meal').length}</div>
              <div className="text-sm text-gray-600">Main Meals</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-pink-600">{catRecipes.filter(r => r.category === 'Treats').length}</div>
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
                <option value="Kitten">Kitten</option>
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
                        <div className="font-bold text-purple-600">{recipe.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">{recipe.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="font-bold text-pink-600">{recipe.prepTime}m</div>
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

                    <Button className="w-full bg-purple-600 hover:bg-purple-700">
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
                      <div className="font-bold text-purple-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">{recipe.nutrition.protein}g</div>
                      <div className="text-gray-500">Protein</div>
                    </div>
                    <div>
                      <div className="font-bold text-pink-600">{recipe.prepTime}m</div>
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

                  <Button className="w-full bg-purple-600 hover:bg-purple-700">
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
                <Fish className="h-6 w-6 text-purple-500" />
                Feeding Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="font-semibold text-sm text-purple-800 mb-1">Taurine is Essential</div>
                  <div className="text-xs text-purple-700">Cats cannot produce taurine - always supplement homemade meals</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-semibold text-sm text-blue-800 mb-1">High Protein Diet</div>
                  <div className="text-xs text-blue-700">Cats are obligate carnivores - minimum 70% meat in their diet</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-semibold text-sm text-green-800 mb-1">Small Portions</div>
                  <div className="text-xs text-green-700">Cats prefer multiple small meals throughout the day</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cat className="h-6 w-6 text-red-500" />
                Safety Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="font-semibold text-sm text-red-800 mb-1">Toxic Foods</div>
                  <div className="text-xs text-red-700">Never feed: onions, garlic, grapes, chocolate, xylitol, or raw dough</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-sm text-yellow-800 mb-1">Cooked Fish Only</div>
                  <div className="text-xs text-yellow-700">Raw fish can contain harmful bacteria and thiaminase enzyme</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-semibold text-sm text-orange-800 mb-1">Consult Your Vet</div>
                  <div className="text-xs text-orange-700">Always discuss diet changes with your veterinarian first</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}