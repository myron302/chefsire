import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Dog, Bone, Heart, Star, ArrowLeft, Search, Leaf,
  Clock, Utensils, CheckCircle, Info, AlertCircle, Target,
  Scale, Thermometer, Filter, X, BookOpen
} from 'lucide-react';

// Recipe data for dogs
const dogRecipes = [
  {
    id: 'dog-1',
    name: 'Chicken & Sweet Potato Delight',
    description: 'Protein-rich meal perfect for active dogs',
    image: 'https://images.unsplash.com/photo-1567529692333-de9fd6772897?w=400&h=300&fit=crop',
    prepTime: 35,
    servings: 8,
    difficulty: 'Easy',
    organic: true,
    rating: 4.9,
    reviews: 892,
    ageGroup: 'All Ages',
    specialDiet: ['Grain-Free Option', 'High Protein'],
    nutrition: {
      calories: 285,
      protein: 24,
      fat: 8,
      carbs: 32,
      fiber: 4
    },
    ingredients: [
      '2 lbs boneless chicken breast',
      '2 medium sweet potatoes, diced',
      '2 cups carrots, chopped',
      '1 cup green beans, chopped',
      '2 cups brown rice (optional for grain-free)',
      '2 tbsp fish oil'
    ],
    instructions: [
      'Cook chicken thoroughly and dice into small pieces',
      'Steam sweet potatoes and carrots until soft',
      'Cook brown rice according to package directions',
      'Mix all ingredients together',
      'Add fish oil and mix well',
      'Let cool before serving'
    ]
  },
  {
    id: 'dog-2',
    name: 'Beef & Vegetable Stew',
    description: 'Hearty meal packed with vitamins and minerals',
    image: 'https://images.unsplash.com/photo-1606193309091-8f0b45328815?w=400&h=300&fit=crop',
    prepTime: 45,
    servings: 10,
    difficulty: 'Medium',
    organic: true,
    rating: 4.7,
    reviews: 523,
    ageGroup: 'Adult',
    specialDiet: ['High Fiber', 'Weight Management'],
    nutrition: {
      calories: 310,
      protein: 22,
      fat: 14,
      carbs: 28,
      fiber: 5
    },
    ingredients: [
      '2 lbs lean ground beef',
      '2 cups pumpkin puree',
      '2 cups spinach, chopped',
      '1 cup blueberries',
      '1 cup quinoa',
      '1 tbsp coconut oil'
    ],
    instructions: [
      'Brown ground beef in a large pot',
      'Cook quinoa according to package directions',
      'Add pumpkin, spinach, and blueberries to beef',
      'Simmer for 15 minutes',
      'Mix in cooked quinoa and coconut oil',
      'Cool completely before serving'
    ]
  },
  {
    id: 'dog-3',
    name: 'Turkey & Rice Bowl',
    description: 'Gentle on sensitive stomachs',
    image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop',
    prepTime: 30,
    servings: 6,
    difficulty: 'Easy',
    organic: false,
    rating: 4.8,
    reviews: 678,
    ageGroup: 'Senior',
    specialDiet: ['Low Fat', 'Easy Digest'],
    nutrition: {
      calories: 220,
      protein: 20,
      fat: 5,
      carbs: 30,
      fiber: 3
    },
    ingredients: [
      '1.5 lbs ground turkey',
      '2 cups white rice',
      '1 cup zucchini, diced',
      '1 cup carrots, shredded',
      '1/2 cup parsley, chopped',
      '1 tsp turmeric'
    ],
    instructions: [
      'Cook ground turkey thoroughly',
      'Prepare white rice as directed',
      'Steam zucchini and carrots until tender',
      'Combine all ingredients',
      'Add parsley and turmeric',
      'Mix well and cool before serving'
    ]
  },
  {
    id: 'dog-4',
    name: 'Salmon & Veggie Mix',
    description: 'Omega-3 rich for healthy coat and joints',
    image: 'https://images.unsplash.com/photo-1599909533265-0f327bfa6e27?w=400&h=300&fit=crop',
    prepTime: 40,
    servings: 8,
    difficulty: 'Medium',
    organic: true,
    rating: 4.9,
    reviews: 445,
    ageGroup: 'All Ages',
    specialDiet: ['Omega-3', 'Joint Health'],
    nutrition: {
      calories: 295,
      protein: 26,
      fat: 12,
      carbs: 24,
      fiber: 4
    },
    ingredients: [
      '2 lbs fresh salmon fillets',
      '2 cups sweet potato, cubed',
      '1 cup broccoli florets',
      '1 cup peas',
      '1 cup brown rice',
      '2 tbsp flax seeds'
    ],
    instructions: [
      'Bake salmon at 350°F for 20 minutes',
      'Remove bones and flake salmon',
      'Steam sweet potato and broccoli',
      'Cook brown rice and peas',
      'Combine all ingredients',
      'Sprinkle with ground flax seeds and mix'
    ]
  },
  {
    id: 'dog-5',
    name: 'Lamb & Apple Feast',
    description: 'Novel protein option for allergies',
    image: 'https://images.unsplash.com/photo-1548681528-6a5c45b66b42?w=400&h=300&fit=crop',
    prepTime: 50,
    servings: 10,
    difficulty: 'Medium',
    organic: true,
    rating: 4.6,
    reviews: 334,
    ageGroup: 'Adult',
    specialDiet: ['Novel Protein', 'Allergy-Friendly'],
    nutrition: {
      calories: 320,
      protein: 23,
      fat: 16,
      carbs: 26,
      fiber: 4
    },
    ingredients: [
      '2 lbs ground lamb',
      '2 apples, cored and diced',
      '2 cups butternut squash, cubed',
      '1 cup kale, chopped',
      '1 cup oatmeal',
      '1 tbsp rosemary'
    ],
    instructions: [
      'Brown ground lamb in large skillet',
      'Roast butternut squash at 400°F for 25 minutes',
      'Cook oatmeal according to directions',
      'Steam kale until wilted',
      'Mix lamb, squash, apples, kale, and oatmeal',
      'Add rosemary and cool before serving'
    ]
  },
  {
    id: 'dog-6',
    name: 'Puppy Power Bowl',
    description: 'Nutrient-dense for growing puppies',
    image: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400&h=300&fit=crop',
    prepTime: 35,
    servings: 6,
    difficulty: 'Easy',
    organic: true,
    rating: 4.8,
    reviews: 567,
    ageGroup: 'Puppy',
    specialDiet: ['High Protein', 'Growth Formula'],
    nutrition: {
      calories: 340,
      protein: 28,
      fat: 14,
      carbs: 30,
      fiber: 3
    },
    ingredients: [
      '1.5 lbs ground chicken',
      '2 eggs, scrambled',
      '2 cups sweet potato, mashed',
      '1 cup cottage cheese',
      '1 cup carrots, finely chopped',
      '1 tbsp calcium powder'
    ],
    instructions: [
      'Cook ground chicken thoroughly',
      'Scramble eggs and set aside',
      'Steam and mash sweet potatoes',
      'Finely chop carrots and steam',
      'Mix all ingredients including cottage cheese',
      'Add calcium powder and cool before serving'
    ]
  },
  {
    id: 'dog-7',
    name: 'Senior Comfort Stew',
    description: 'Easy-to-digest meal for older dogs',
    image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop',
    prepTime: 40,
    servings: 8,
    difficulty: 'Easy',
    organic: false,
    rating: 4.7,
    reviews: 412,
    ageGroup: 'Senior',
    specialDiet: ['Low Fat', 'Joint Support'],
    nutrition: {
      calories: 210,
      protein: 18,
      fat: 6,
      carbs: 28,
      fiber: 4
    },
    ingredients: [
      '2 lbs chicken breast, boneless',
      '2 cups white rice',
      '2 cups pumpkin puree',
      '1 cup green beans, chopped',
      '1/2 cup blueberries',
      '1 tbsp glucosamine supplement'
    ],
    instructions: [
      'Boil chicken until fully cooked and shred',
      'Cook white rice until very soft',
      'Steam green beans until tender',
      'Mix chicken, rice, pumpkin, and green beans',
      'Add blueberries and glucosamine',
      'Ensure everything is soft and easy to chew'
    ]
  },
  {
    id: 'dog-8',
    name: 'Veggie Power Mix',
    description: 'Vegetarian option with complete protein',
    image: 'https://images.unsplash.com/photo-1604908815883-5f9a4d96569d?w=400&h=300&fit=crop',
    prepTime: 35,
    servings: 8,
    difficulty: 'Medium',
    organic: true,
    rating: 4.5,
    reviews: 289,
    ageGroup: 'Adult',
    specialDiet: ['Vegetarian', 'Weight Management'],
    nutrition: {
      calories: 240,
      protein: 15,
      fat: 8,
      carbs: 32,
      fiber: 8
    },
    ingredients: [
      '2 cups lentils, cooked',
      '4 eggs, hard-boiled',
      '2 cups mixed vegetables',
      '1 cup quinoa',
      '1 cup cottage cheese',
      '2 tbsp nutritional yeast'
    ],
    instructions: [
      'Cook lentils and quinoa separately',
      'Hard-boil eggs and chop',
      'Steam mixed vegetables until soft',
      'Combine all ingredients',
      'Add cottage cheese and nutritional yeast',
      'Mix thoroughly and cool'
    ]
  },
  {
    id: 'dog-9',
    name: 'Pork & Apple Medley',
    description: 'Alternative protein with sweet flavor',
    image: 'https://images.unsplash.com/photo-1551124709-f4f7ca0b8b3c?w=400&h=300&fit=crop',
    prepTime: 45,
    servings: 10,
    difficulty: 'Medium',
    organic: false,
    rating: 4.6,
    reviews: 356,
    ageGroup: 'Adult',
    specialDiet: ['Alternative Protein'],
    nutrition: {
      calories: 305,
      protein: 21,
      fat: 13,
      carbs: 29,
      fiber: 4
    },
    ingredients: [
      '2 lbs lean pork, ground',
      '3 apples, cored and diced',
      '2 cups barley',
      '2 cups cabbage, shredded',
      '1 cup carrots, grated',
      '1 tbsp thyme'
    ],
    instructions: [
      'Cook ground pork thoroughly',
      'Prepare barley according to package',
      'Steam cabbage and carrots',
      'Mix pork, barley, and vegetables',
      'Add diced apples and thyme',
      'Combine well and cool before serving'
    ]
  },
  {
    id: 'dog-10',
    name: 'Liver & Rice Training Treats',
    description: 'High-value training rewards',
    image: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=400&h=300&fit=crop',
    prepTime: 60,
    servings: 50,
    difficulty: 'Hard',
    organic: false,
    rating: 4.9,
    reviews: 723,
    ageGroup: 'All Ages',
    specialDiet: ['Training Treats', 'High Value'],
    nutrition: {
      calories: 45,
      protein: 8,
      fat: 2,
      carbs: 4,
      fiber: 1
    },
    ingredients: [
      '1 lb chicken liver',
      '2 cups rice flour',
      '2 eggs',
      '1/4 cup parsley, chopped',
      '1/2 cup water',
      '1 tsp garlic powder (optional)'
    ],
    instructions: [
      'Puree chicken liver in food processor',
      'Mix liver puree with eggs and water',
      'Add rice flour and parsley',
      'Spread thin on baking sheet',
      'Bake at 350°F for 15-20 minutes',
      'Cut into small training-size pieces and store in fridge'
    ]
  },
  {
    id: 'dog-11',
    name: 'Duck & Cranberry Bowl',
    description: 'Gourmet meal for special occasions',
    image: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=300&fit=crop',
    prepTime: 55,
    servings: 8,
    difficulty: 'Hard',
    organic: true,
    rating: 4.8,
    reviews: 234,
    ageGroup: 'Adult',
    specialDiet: ['Gourmet', 'Novel Protein'],
    nutrition: {
      calories: 330,
      protein: 25,
      fat: 15,
      carbs: 27,
      fiber: 5
    },
    ingredients: [
      '2 lbs duck breast',
      '1 cup dried cranberries',
      '2 cups wild rice',
      '2 cups Brussels sprouts, halved',
      '1 cup parsnips, diced',
      '2 tbsp coconut oil'
    ],
    instructions: [
      'Roast duck breast at 375°F until cooked',
      'Let cool and dice into small pieces',
      'Cook wild rice according to package',
      'Roast Brussels sprouts and parsnips',
      'Rehydrate cranberries in warm water',
      'Mix all ingredients with coconut oil'
    ]
  },
  {
    id: 'dog-12',
    name: 'Bison & Root Veggie Mix',
    description: 'Lean protein with complex carbohydrates',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&h=300&fit=crop',
    prepTime: 50,
    servings: 10,
    difficulty: 'Medium',
    organic: true,
    rating: 4.7,
    reviews: 198,
    ageGroup: 'Adult',
    specialDiet: ['Low Fat', 'Novel Protein'],
    nutrition: {
      calories: 270,
      protein: 24,
      fat: 9,
      carbs: 28,
      fiber: 5
    },
    ingredients: [
      '2 lbs ground bison',
      '2 cups turnips, diced',
      '2 cups beets, diced',
      '1 cup parsnips, diced',
      '1 cup millet',
      '1 tbsp oregano'
    ],
    instructions: [
      'Brown ground bison thoroughly',
      'Roast turnips, beets, and parsnips at 400°F',
      'Cook millet according to package',
      'Combine bison with roasted vegetables',
      'Mix in millet and oregano',
      'Cool completely before serving'
    ]
  }
];

const ageGroups = [
  { id: 'all', name: 'All Ages' },
  { id: 'puppy', name: 'Puppy' },
  { id: 'adult', name: 'Adult' },
  { id: 'senior', name: 'Senior' }
];

const specialDiets = [
  'Grain-Free Option',
  'High Protein',
  'High Fiber',
  'Weight Management',
  'Low Fat',
  'Easy Digest',
  'Omega-3',
  'Joint Health',
  'Novel Protein',
  'Allergy-Friendly',
  'Vegetarian',
  'Training Treats'
];

export default function DogsPage() {
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
    let filtered = dogRecipes.filter(recipe => {
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
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
                <Dog className="h-6 w-6 text-amber-600" />
                <h1 className="text-2xl font-bold text-gray-900">Dog Recipes</h1>
                <Badge className="bg-amber-100 text-amber-800">Homemade Nutrition</Badge>
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
              <div className="text-2xl font-bold text-amber-600">{dogRecipes.length}</div>
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
              <div className="text-2xl font-bold text-blue-600">{favorites.length}</div>
              <div className="text-sm text-gray-600">Favorites</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">4.7★</div>
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
                <div className="relative h-48 bg-gradient-to-br from-amber-100 to-orange-100">
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
                    <Badge className="bg-amber-500 text-white text-xs">
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
                      <div className="font-bold text-amber-600">{recipe.nutrition.calories}</div>
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
                        <div className="font-semibold">{recipe.nutrition.fiber}g</div>
                        <div className="text-gray-500">Fiber</div>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full bg-amber-600 hover:bg-amber-700">
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
                    <div className="font-semibold text-sm">Cook Thoroughly</div>
                    <div className="text-xs text-gray-600">All meat should be cooked to safe internal temperatures</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Cool Before Serving</div>
                    <div className="text-xs text-gray-600">Let food cool to room temperature to prevent burns</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Portion Control</div>
                    <div className="text-xs text-gray-600">Feed 2-3% of body weight daily, adjust for activity level</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Storage</div>
                    <div className="text-xs text-gray-600">Refrigerate up to 3 days or freeze up to 3 months</div>
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
                  <div className="text-xs text-red-700">Never use: chocolate, grapes, onions, garlic, xylitol, avocado</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-semibold text-sm text-orange-800 mb-1">Bones Warning</div>
                  <div className="text-xs text-orange-700">Remove all bones that can splinter (chicken, pork, cooked)</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-sm text-yellow-800 mb-1">Consult Vet</div>
                  <div className="text-xs text-yellow-700">Always consult your vet before changing your dog's diet</div>
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