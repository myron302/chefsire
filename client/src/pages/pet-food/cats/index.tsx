import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Cat, Fish, Heart, Star, ArrowLeft, Search, Leaf,
  Clock, Utensils, CheckCircle, Info, AlertCircle, Target,
  Scale, Thermometer, Filter, X, BookOpen
} from 'lucide-react';

// Recipe data for cats
const catRecipes = [
  {
    id: 'cat-1',
    name: 'Salmon & Tuna Pate',
    description: 'Omega-3 rich recipe for healthy coat and skin',
    image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop',
    prepTime: 20,
    servings: 6,
    difficulty: 'Easy',
    organic: false,
    rating: 4.8,
    reviews: 654,
    ageGroup: 'All Ages',
    specialDiet: ['High Protein', 'Low Carb', 'Omega-3'],
    nutrition: {
      calories: 180,
      protein: 18,
      fat: 12,
      carbs: 2,
      taurine: 'High'
    },
    ingredients: [
      '8 oz wild salmon fillet',
      '6 oz tuna in water',
      '2 oz chicken liver',
      '1 tbsp fish oil',
      '1/4 tsp taurine supplement',
      '1/4 cup water'
    ],
    instructions: [
      'Cook salmon and drain tuna',
      'Lightly cook chicken liver',
      'Blend all ingredients until smooth',
      'Add fish oil and taurine',
      'Thin with water to desired consistency',
      'Refrigerate and serve at room temperature'
    ]
  },
  {
    id: 'cat-2',
    name: 'Chicken & Liver Delight',
    description: 'Classic recipe rich in essential nutrients',
    image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop',
    prepTime: 25,
    servings: 8,
    difficulty: 'Easy',
    organic: true,
    rating: 4.9,
    reviews: 892,
    ageGroup: 'All Ages',
    specialDiet: ['High Protein', 'Grain-Free'],
    nutrition: {
      calories: 165,
      protein: 20,
      fat: 9,
      carbs: 1,
      taurine: 'Very High'
    },
    ingredients: [
      '1 lb chicken thighs, boneless',
      '4 oz chicken liver',
      '2 oz chicken heart',
      '1 tbsp olive oil',
      '1/4 tsp taurine supplement',
      '1/4 cup bone broth'
    ],
    instructions: [
      'Cook chicken thighs thoroughly',
      'Lightly cook liver and heart',
      'Shred or finely chop all meat',
      'Mix with olive oil and bone broth',
      'Add taurine supplement',
      'Serve at room temperature'
    ]
  },
  {
    id: 'cat-3',
    name: 'Turkey & Pumpkin Bowl',
    description: 'Gentle on sensitive stomachs',
    image: 'https://images.unsplash.com/photo-1548681528-6a5c45b66b42?w=400&h=300&fit=crop',
    prepTime: 30,
    servings: 6,
    difficulty: 'Easy',
    organic: false,
    rating: 4.7,
    reviews: 445,
    ageGroup: 'Senior',
    specialDiet: ['Low Fat', 'Easy Digest', 'Fiber'],
    nutrition: {
      calories: 145,
      protein: 17,
      fat: 6,
      carbs: 5,
      fiber: 2
    },
    ingredients: [
      '12 oz ground turkey',
      '1/4 cup pumpkin puree',
      '1 egg, cooked',
      '1 tbsp coconut oil',
      '1/4 tsp taurine supplement',
      '2 tbsp water'
    ],
    instructions: [
      'Cook ground turkey thoroughly',
      'Cook and mash the egg',
      'Mix turkey, egg, and pumpkin',
      'Add coconut oil and taurine',
      'Add water for moisture',
      'Cool before serving'
    ]
  },
  {
    id: 'cat-4',
    name: 'Mackerel & Shrimp Medley',
    description: 'Seafood feast with omega fatty acids',
    image: 'https://images.unsplash.com/photo-1551124709-f4f7ca0b8b3c?w=400&h=300&fit=crop',
    prepTime: 25,
    servings: 6,
    difficulty: 'Medium',
    organic: false,
    rating: 4.8,
    reviews: 523,
    ageGroup: 'Adult',
    specialDiet: ['High Protein', 'Omega-3', 'Low Carb'],
    nutrition: {
      calories: 175,
      protein: 19,
      fat: 11,
      carbs: 1,
      omega3: 'Very High'
    },
    ingredients: [
      '8 oz mackerel fillet',
      '4 oz cooked shrimp',
      '2 oz salmon roe (optional)',
      '1 tbsp fish oil',
      '1/4 tsp taurine supplement',
      '1/4 cup water'
    ],
    instructions: [
      'Cook mackerel and remove bones',
      'Chop shrimp into small pieces',
      'Flake mackerel finely',
      'Mix seafood together',
      'Add fish oil and taurine',
      'Thin with water if needed'
    ]
  },
  {
    id: 'cat-5',
    name: 'Beef & Egg Power Bowl',
    description: 'Protein-rich meal for active cats',
    image: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400&h=300&fit=crop',
    prepTime: 20,
    servings: 8,
    difficulty: 'Easy',
    organic: true,
    rating: 4.6,
    reviews: 378,
    ageGroup: 'Adult',
    specialDiet: ['High Protein', 'Grain-Free'],
    nutrition: {
      calories: 190,
      protein: 21,
      fat: 11,
      carbs: 2,
      iron: 'High'
    },
    ingredients: [
      '12 oz lean ground beef',
      '2 eggs',
      '2 oz beef liver',
      '1 tbsp beef tallow',
      '1/4 tsp taurine supplement',
      '2 tbsp bone broth'
    ],
    instructions: [
      'Cook ground beef thoroughly',
      'Cook eggs and chop finely',
      'Lightly cook beef liver',
      'Mix all ingredients together',
      'Add taurine and bone broth',
      'Serve at room temperature'
    ]
  },
  {
    id: 'cat-6',
    name: 'Kitten Growth Formula',
    description: 'Nutrient-dense for growing kittens',
    image: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=300&fit=crop',
    prepTime: 30,
    servings: 6,
    difficulty: 'Medium',
    organic: true,
    rating: 4.9,
    reviews: 567,
    ageGroup: 'Kitten',
    specialDiet: ['High Protein', 'High Fat', 'Growth'],
    nutrition: {
      calories: 210,
      protein: 22,
      fat: 14,
      carbs: 2,
      calcium: 'High'
    },
    ingredients: [
      '10 oz chicken breast',
      '3 oz chicken liver',
      '2 eggs',
      '1 tbsp salmon oil',
      '1/2 tsp taurine supplement',
      '1/4 tsp calcium carbonate'
    ],
    instructions: [
      'Cook chicken breast and liver',
      'Cook eggs until firm',
      'Finely chop or grind all ingredients',
      'Mix with salmon oil',
      'Add taurine and calcium',
      'Ensure small, kitten-friendly pieces'
    ]
  },
  {
    id: 'cat-7',
    name: 'Duck & Sweet Potato',
    description: 'Novel protein for food sensitivities',
    image: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=400&h=300&fit=crop',
    prepTime: 40,
    servings: 8,
    difficulty: 'Medium',
    organic: true,
    rating: 4.7,
    reviews: 289,
    ageGroup: 'Adult',
    specialDiet: ['Novel Protein', 'Allergy-Friendly'],
    nutrition: {
      calories: 185,
      protein: 19,
      fat: 10,
      carbs: 6,
      fiber: 1
    },
    ingredients: [
      '12 oz duck breast',
      '1/4 cup sweet potato, cooked',
      '1 tbsp duck fat',
      '1/4 tsp taurine supplement',
      '2 tbsp water',
      'Pinch of parsley'
    ],
    instructions: [
      'Roast duck breast until cooked',
      'Cook and mash sweet potato',
      'Remove duck skin and dice meat',
      'Mix duck with sweet potato',
      'Add duck fat and taurine',
      'Thin with water to desired consistency'
    ]
  },
  {
    id: 'cat-8',
    name: 'Rabbit & Carrot Mix',
    description: 'Alternative protein for picky eaters',
    image: 'https://images.unsplash.com/photo-1604908815883-5f9a4d96569d?w=400&h=300&fit=crop',
    prepTime: 45,
    servings: 8,
    difficulty: 'Hard',
    organic: true,
    rating: 4.6,
    reviews: 234,
    ageGroup: 'Adult',
    specialDiet: ['Novel Protein', 'Low Fat'],
    nutrition: {
      calories: 160,
      protein: 20,
      fat: 7,
      carbs: 4,
      b12: 'High'
    },
    ingredients: [
      '1 lb rabbit meat',
      '2 tbsp carrot, finely grated',
      '2 oz rabbit liver',
      '1 tbsp olive oil',
      '1/4 tsp taurine supplement',
      '1/4 cup bone broth'
    ],
    instructions: [
      'Cook rabbit meat thoroughly',
      'Lightly cook rabbit liver',
      'Finely chop or grind meat',
      'Mix in grated carrot',
      'Add olive oil, taurine, and broth',
      'Ensure no small bones remain'
    ]
  },
  {
    id: 'cat-9',
    name: 'Sardine & Egg Breakfast',
    description: 'Quick omega-3 rich meal',
    image: 'https://images.unsplash.com/photo-1599909533265-0f327bfa6e27?w=400&h=300&fit=crop',
    prepTime: 15,
    servings: 4,
    difficulty: 'Easy',
    organic: false,
    rating: 4.8,
    reviews: 445,
    ageGroup: 'All Ages',
    specialDiet: ['High Protein', 'Omega-3', 'Quick'],
    nutrition: {
      calories: 170,
      protein: 18,
      fat: 11,
      carbs: 1,
      omega3: 'Very High'
    },
    ingredients: [
      '6 oz sardines in water',
      '1 egg',
      '1 tbsp fish oil',
      '1/4 tsp taurine supplement',
      'Pinch of catnip (optional)',
      '1 tbsp water'
    ],
    instructions: [
      'Drain sardines and remove any large bones',
      'Cook egg and chop finely',
      'Mash sardines with fork',
      'Mix with egg',
      'Add fish oil and taurine',
      'Serve immediately'
    ]
  },
  {
    id: 'cat-10',
    name: 'Venison & Blueberry',
    description: 'Gourmet meal with antioxidants',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&h=300&fit=crop',
    prepTime: 50,
    servings: 8,
    difficulty: 'Hard',
    organic: true,
    rating: 4.7,
    reviews: 198,
    ageGroup: 'Adult',
    specialDiet: ['Novel Protein', 'Antioxidants'],
    nutrition: {
      calories: 175,
      protein: 21,
      fat: 8,
      carbs: 4,
      iron: 'Very High'
    },
    ingredients: [
      '12 oz ground venison',
      '2 tbsp blueberries, mashed',
      '2 oz venison liver',
      '1 tbsp venison fat',
      '1/4 tsp taurine supplement',
      '2 tbsp bone broth'
    ],
    instructions: [
      'Cook ground venison thoroughly',
      'Lightly cook venison liver',
      'Mash blueberries',
      'Mix venison, liver, and berries',
      'Add fat, taurine, and broth',
      'Cool before serving'
    ]
  },
  {
    id: 'cat-11',
    name: 'Senior Cat Comfort Food',
    description: 'Easy-to-digest for older cats',
    image: 'https://images.unsplash.com/photo-1567529692333-de9fd6772897?w=400&h=300&fit=crop',
    prepTime: 25,
    servings: 6,
    difficulty: 'Easy',
    organic: false,
    rating: 4.8,
    reviews: 412,
    ageGroup: 'Senior',
    specialDiet: ['Low Fat', 'Easy Digest', 'Joint Support'],
    nutrition: {
      calories: 150,
      protein: 18,
      fat: 7,
      carbs: 3,
      glucosamine: 'Added'
    },
    ingredients: [
      '10 oz white fish (cod or halibut)',
      '2 oz chicken liver',
      '1 egg yolk',
      '1 tbsp fish oil',
      '1/4 tsp taurine supplement',
      '1/4 tsp glucosamine powder'
    ],
    instructions: [
      'Steam white fish until flaky',
      'Lightly cook chicken liver',
      'Cook egg yolk',
      'Flake fish and chop liver finely',
      'Mix all ingredients with oil',
      'Add taurine and glucosamine'
    ]
  },
  {
    id: 'cat-12',
    name: 'Chicken & Cranberry Urinary Health',
    description: 'Supports urinary tract health',
    image: 'https://images.unsplash.com/photo-1606193309091-8f0b45328815?w=400&h=300&fit=crop',
    prepTime: 30,
    servings: 8,
    difficulty: 'Medium',
    organic: true,
    rating: 4.6,
    reviews: 334,
    ageGroup: 'Adult',
    specialDiet: ['Urinary Health', 'High Moisture'],
    nutrition: {
      calories: 165,
      protein: 19,
      fat: 9,
      carbs: 3,
      moisture: 'Very High'
    },
    ingredients: [
      '12 oz chicken breast',
      '2 tbsp cranberries, fresh',
      '2 oz chicken liver',
      '1 tbsp chicken fat',
      '1/4 tsp taurine supplement',
      '1/2 cup water or broth'
    ],
    instructions: [
      'Cook chicken breast and liver',
      'Finely chop cranberries',
      'Shred chicken finely',
      'Mix all ingredients with extra moisture',
      'Add taurine supplement',
      'Ensure high water content for urinary health'
    ]
  }
];

const ageGroups = [
  { id: 'all', name: 'All Ages' },
  { id: 'kitten', name: 'Kitten' },
  { id: 'adult', name: 'Adult' },
  { id: 'senior', name: 'Senior' }
];

const specialDiets = [
  'High Protein',
  'Low Carb',
  'Omega-3',
  'Grain-Free',
  'Low Fat',
  'Easy Digest',
  'Fiber',
  'Novel Protein',
  'Allergy-Friendly',
  'High Fat',
  'Growth',
  'Joint Support',
  'Urinary Health',
  'Antioxidants'
];

export default function CatsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState('');
  const [selectedDiet, setSelectedDiet] = useState('');
  const [showOrganic, setShowOrganic] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('petFoodFavorites');
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
  }, []);

  // Save favorites to localStorage
  const toggleFavorite = (recipeId: string) => {
    const newFavorites = favorites.includes(recipeId)
      ? favorites.filter(id => id !== recipeId)
      : [...favorites, recipeId];
    setFavorites(newFavorites);
    localStorage.setItem('petFoodFavorites', JSON.stringify(newFavorites));
  };

  const getFilteredRecipes = () => {
    let filtered = catRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAge = !selectedAge || recipe.ageGroup === selectedAge || recipe.ageGroup === 'All Ages';
      const matchesDiet = !selectedDiet || recipe.specialDiet.includes(selectedDiet);
      const matchesOrganic = !showOrganic || recipe.organic;
      
      return matchesSearch && matchesAge && matchesDiet && matchesOrganic;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'prepTime': return (a.prepTime || 0) - (b.prepTime || 0);
        case 'difficulty': 
          const diffOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
          return diffOrder[a.difficulty as keyof typeof diffOrder] - diffOrder[b.difficulty as keyof typeof diffOrder];
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredRecipes = getFilteredRecipes();

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
                <h1 className="text-2xl font-bold text-gray-900">Cat Recipes</h1>
                <Badge className="bg-purple-100 text-purple-800">Feline Nutrition</Badge>
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
              <div className="text-2xl font-bold text-blue-600">{favorites.length}</div>
              <div className="text-sm text-gray-600">Favorites</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-pink-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
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
                {ageGroups.map(age => (
                  <option key={age.id} value={age.name}>{age.name}</option>
                ))}
              </select>
              
              <select 
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={selectedDiet}
                onChange={(e) => setSelectedDiet(e.target.value)}
              >
                <option value="">All Diets</option>
                {specialDiets.map(diet => (
                  <option key={diet} value={diet}>{diet}</option>
                ))}
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
              </select>
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
                <div className="relative h-48 bg-gradient-to-br from-purple-100 to-pink-100">
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
                    <Badge className="bg-purple-500 text-white text-xs">
                      {recipe.ageGroup}
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFavorite(recipe.id)}
                      className="bg-white/90 hover:bg-white"
                    >
                      <Heart 
                        className={`h-4 w-4 ${
                          favorites.includes(recipe.id) 
                            ? 'fill-red-500 text-red-500' 
                            : 'text-gray-400'
                        }`} 
                      />
                    </Button>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <div className="mb-2">
                    <h3 className="font-bold text-lg mb-1">{recipe.name}</h3>
                    <p className="text-sm text-gray-600">{recipe.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                    <div>
                      <div className="font-bold text-purple-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">{recipe.prepTime}m</div>
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

                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">Special Diets:</div>
                    <div className="flex flex-wrap gap-1">
                      {recipe.specialDiet.slice(0, 2).map((diet, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {diet}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">Nutrition per serving:</div>
                    <div className="grid grid-cols-4 gap-1 text-xs text-center">
                      <div>
                        <div className="font-semibold">{recipe.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="font-semibold">{recipe.nutrition.fat}g</div>
                        <div className="text-gray-500">Fat</div>
                      </div>
                      <div>
                        <div className="font-semibold">{recipe.nutrition.carbs}g</div>
                        <div className="text-gray-500">Carbs</div>
                      </div>
                      <div>
                        <div className="font-semibold text-purple-600">✓</div>
                        <div className="text-gray-500">Taurine</div>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full bg-purple-600 hover:bg-purple-700">
                    <Utensils className="h-4 w-4 mr-2" />
                    View Recipe
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Safety & Tips Section */}
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
                    <div className="font-semibold text-sm">Taurine is Essential</div>
                    <div className="text-xs text-gray-600">Always add taurine supplement - cats cannot produce it</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">High Protein Diet</div>
                    <div className="text-xs text-gray-600">Cats are obligate carnivores - need 70%+ animal protein</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Moisture Content</div>
                    <div className="text-xs text-gray-600">Add extra water or broth for kidney health</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Storage</div>
                    <div className="text-xs text-gray-600">Refrigerate up to 2 days or freeze up to 2 months</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-red-500" />
                Safety Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="font-semibold text-sm text-red-800 mb-1">Toxic Foods</div>
                  <div className="text-xs text-red-700">Never use: onions, garlic, grapes, chocolate, xylitol, raw fish</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-semibold text-sm text-orange-800 mb-1">Bones Warning</div>
                  <div className="text-xs text-orange-700">Remove ALL fish and chicken bones before serving</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-sm text-yellow-800 mb-1">Consult Vet</div>
                  <div className="text-xs text-yellow-700">Always consult your vet before changing your cat's diet</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-semibold text-sm text-blue-800 mb-1">Transition Slowly</div>
                  <div className="text-xs text-blue-700">Introduce new foods gradually over 7-10 days</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}