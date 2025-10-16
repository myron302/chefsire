import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Bird, Heart, Star, ArrowLeft, Search, Leaf, Apple,
  Clock, Utensils, CheckCircle, Info, AlertCircle, Feather
} from 'lucide-react';

// Recipe data for birds
const birdRecipes = [
  {
    id: 'bird-1',
    name: 'Tropical Fruit Medley',
    description: 'Colorful mix of exotic fruits for parrots',
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400&h=300&fit=crop',
    prepTime: 15,
    servings: 4,
    difficulty: 'Easy',
    organic: true,
    rating: 4.9,
    reviews: 234,
    birdType: 'Parrots',
    specialDiet: ['Vitamin Rich', 'Antioxidants'],
    nutrition: {
      calories: 85,
      protein: 2,
      fat: 1,
      carbs: 20,
      vitaminC: 'Very High'
    },
    ingredients: [
      '1/4 cup mango, diced',
      '1/4 cup papaya, diced',
      '2 tbsp pomegranate seeds',
      '2 tbsp blueberries',
      '1 tbsp chia seeds',
      'Mint leaves for garnish'
    ],
    instructions: [
      'Wash all fruits thoroughly',
      'Dice mango and papaya into bird-safe sizes',
      'Mix fruits in a bowl',
      'Sprinkle chia seeds on top',
      'Garnish with mint',
      'Serve fresh daily'
    ]
  },
  {
    id: 'bird-2',
    name: 'Sprouted Seed Mix',
    description: 'Nutritious sprouted seeds for energy',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&h=300&fit=crop',
    prepTime: 72,
    servings: 10,
    difficulty: 'Medium',
    organic: true,
    rating: 4.8,
    reviews: 456,
    birdType: 'All Birds',
    specialDiet: ['High Protein', 'Enzyme Rich'],
    nutrition: {
      calories: 120,
      protein: 8,
      fat: 4,
      carbs: 15,
      enzymes: 'High'
    },
    ingredients: [
      '1 cup mung beans',
      '1/2 cup sunflower seeds',
      '1/2 cup quinoa',
      '1/4 cup alfalfa seeds',
      'Water for sprouting',
      'Apple cider vinegar (1 tsp per rinse)'
    ],
    instructions: [
      'Soak seeds overnight in water',
      'Rinse and drain twice daily',
      'Keep in dark place for 2-3 days',
      'Sprouts ready when 1/4 inch long',
      'Rinse with diluted apple cider vinegar',
      'Store in fridge up to 5 days'
    ]
  },
  {
    id: 'bird-3',
    name: 'Veggie Chop Mix',
    description: 'Colorful vegetable blend for daily nutrition',
    image: 'https://images.unsplash.com/photo-1604908815883-5f9a4d96569d?w=400&h=300&fit=crop',
    prepTime: 20,
    servings: 8,
    difficulty: 'Easy',
    organic: false,
    rating: 4.7,
    reviews: 389,
    birdType: 'Parrots',
    specialDiet: ['Low Fat', 'High Fiber'],
    nutrition: {
      calories: 45,
      protein: 3,
      fat: 0.5,
      carbs: 9,
      fiber: 4
    },
    ingredients: [
      '1 cup kale, chopped',
      '1 cup carrots, grated',
      '1/2 cup bell peppers, diced',
      '1/2 cup broccoli florets',
      '1/4 cup parsley, chopped',
      '2 tbsp flax seeds'
    ],
    instructions: [
      'Wash all vegetables thoroughly',
      'Chop into small, bird-safe pieces',
      'Mix all vegetables together',
      'Add flax seeds',
      'Store in portions in freezer',
      'Thaw daily portion and serve'
    ]
  },
  {
    id: 'bird-4',
    name: 'Berry & Nut Power Bowl',
    description: 'Energy-rich mix for active birds',
    image: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=400&h=300&fit=crop',
    prepTime: 10,
    servings: 6,
    difficulty: 'Easy',
    organic: true,
    rating: 4.8,
    reviews: 312,
    birdType: 'Parrots',
    specialDiet: ['High Energy', 'Omega-3'],
    nutrition: {
      calories: 140,
      protein: 5,
      fat: 7,
      carbs: 16,
      omega3: 'High'
    },
    ingredients: [
      '1/4 cup almonds, chopped',
      '1/4 cup walnuts, chopped',
      '1/2 cup strawberries',
      '1/2 cup raspberries',
      '2 tbsp hemp seeds',
      '1 tsp coconut oil'
    ],
    instructions: [
      'Chop nuts into small pieces',
      'Cut berries to appropriate size',
      'Mix nuts and berries',
      'Add hemp seeds',
      'Drizzle with melted coconut oil',
      'Serve immediately'
    ]
  },
  {
    id: 'bird-5',
    name: 'Millet & Veggie Sticks',
    description: 'Fun foraging treats for smaller birds',
    image: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400&h=300&fit=crop',
    prepTime: 25,
    servings: 12,
    difficulty: 'Medium',
    organic: false,
    rating: 4.6,
    reviews: 267,
    birdType: 'Canaries & Finches',
    specialDiet: ['Foraging', 'Entertainment'],
    nutrition: {
      calories: 95,
      protein: 4,
      fat: 2,
      carbs: 18,
      minerals: 'Good'
    },
    ingredients: [
      '1 cup millet spray',
      '1/4 cup dried vegetables',
      '2 tbsp sesame seeds',
      '1 tbsp honey (light drizzle)',
      'Wooden skewers',
      'String for hanging'
    ],
    instructions: [
      'Thread millet on wooden skewers',
      'Mix dried veggies with sesame seeds',
      'Press mixture onto millet',
      'Drizzle lightly with honey',
      'Let dry for 2 hours',
      'Hang in cage for foraging'
    ]
  },
  {
    id: 'bird-6',
    name: 'Egg & Quinoa Protein Boost',
    description: 'High-protein meal for breeding season',
    image: 'https://images.unsplash.com/photo-1599909533265-0f327bfa6e27?w=400&h=300&fit=crop',
    prepTime: 30,
    servings: 8,
    difficulty: 'Easy',
    organic: true,
    rating: 4.9,
    reviews: 445,
    birdType: 'Parrots',
    specialDiet: ['High Protein', 'Breeding'],
    nutrition: {
      calories: 110,
      protein: 9,
      fat: 4,
      carbs: 12,
      calcium: 'High'
    },
    ingredients: [
      '2 eggs, hard-boiled',
      '1 cup cooked quinoa',
      '1/4 cup spinach, chopped',
      '2 tbsp calcium powder',
      '1 tbsp nutritional yeast',
      'Pinch of turmeric'
    ],
    instructions: [
      'Hard-boil eggs and chop finely',
      'Cook quinoa and let cool',
      'Steam spinach briefly',
      'Mix eggs, quinoa, and spinach',
      'Add calcium and nutritional yeast',
      'Sprinkle turmeric and serve'
    ]
  },
  {
    id: 'bird-7',
    name: 'Sweet Potato & Bean Mash',
    description: 'Warm comfort food for cold days',
    image: 'https://images.unsplash.com/photo-1567529692333-de9fd6772897?w=400&h=300&fit=crop',
    prepTime: 40,
    servings: 10,
    difficulty: 'Easy',
    organic: true,
    rating: 4.7,
    reviews: 334,
    birdType: 'Parrots',
    specialDiet: ['Warming', 'Digestive Health'],
    nutrition: {
      calories: 90,
      protein: 5,
      fat: 1,
      carbs: 18,
      fiber: 5
    },
    ingredients: [
      '1 large sweet potato',
      '1/2 cup black beans, cooked',
      '1/4 cup butternut squash',
      '2 tbsp pumpkin seeds',
      '1 tsp cinnamon',
      'Water for consistency'
    ],
    instructions: [
      'Bake sweet potato until soft',
      'Cook butternut squash',
      'Mash sweet potato and squash',
      'Add cooked black beans',
      'Mix in pumpkin seeds and cinnamon',
      'Add water to desired consistency'
    ]
  },
  {
    id: 'bird-8',
    name: 'Apple & Carrot Crunch',
    description: 'Crunchy treat for beak exercise',
    image: 'https://images.unsplash.com/photo-1606193309091-8f0b45328815?w=400&h=300&fit=crop',
    prepTime: 15,
    servings: 6,
    difficulty: 'Easy',
    organic: false,
    rating: 4.5,
    reviews: 289,
    birdType: 'All Birds',
    specialDiet: ['Beak Exercise', 'Vitamin A'],
    nutrition: {
      calories: 55,
      protein: 1,
      fat: 0.3,
      carbs: 14,
      vitaminA: 'High'
    },
    ingredients: [
      '1 apple, cored',
      '2 carrots, whole',
      '1/4 cup sunflower seeds',
      'Wooden skewers',
      'Hanging hardware',
      'Optional: coconut pieces'
    ],
    instructions: [
      'Cut apple into thick slices',
      'Cut carrots into chunks',
      'Thread on skewers alternating',
      'Add sunflower seeds in between',
      'Hang in cage',
      'Replace daily'
    ]
  },
  {
    id: 'bird-9',
    name: 'Pellet Smoothie Bowl',
    description: 'Nutritious wet food for picky eaters',
    image: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=300&fit=crop',
    prepTime: 10,
    servings: 4,
    difficulty: 'Easy',
    organic: false,
    rating: 4.6,
    reviews: 198,
    birdType: 'Parrots',
    specialDiet: ['Picky Eaters', 'Hydration'],
    nutrition: {
      calories: 100,
      protein: 6,
      fat: 3,
      carbs: 14,
      hydration: 'High'
    },
    ingredients: [
      '1/4 cup high-quality pellets',
      '1/4 cup warm water',
      '2 tbsp mashed banana',
      '1 tbsp almond butter',
      '1 tsp spirulina powder',
      'Berries for topping'
    ],
    instructions: [
      'Soak pellets in warm water',
      'Let sit for 5 minutes',
      'Mash with banana and almond butter',
      'Add spirulina powder',
      'Top with fresh berries',
      'Serve immediately'
    ]
  },
  {
    id: 'bird-10',
    name: 'Seed & Grain Bake',
    description: 'Homemade seed cake for enrichment',
    image: 'https://images.unsplash.com/photo-1551124709-f4f7ca0b8b3c?w=400&h=300&fit=crop',
    prepTime: 60,
    servings: 20,
    difficulty: 'Hard',
    organic: true,
    rating: 4.8,
    reviews: 412,
    birdType: 'All Birds',
    specialDiet: ['Foraging', 'Entertainment'],
    nutrition: {
      calories: 105,
      protein: 5,
      fat: 4,
      carbs: 15,
      variety: 'Excellent'
    },
    ingredients: [
      '1 cup mixed seeds',
      '1/2 cup oats',
      '1/4 cup whole wheat flour',
      '2 eggs',
      '1/4 cup applesauce',
      '2 tbsp honey'
    ],
    instructions: [
      'Mix dry ingredients together',
      'Beat eggs and mix with applesauce',
      'Combine wet and dry ingredients',
      'Press into muffin tins or molds',
      'Bake at 350°F for 25-30 minutes',
      'Cool completely and store in fridge'
    ]
  },
  {
    id: 'bird-11',
    name: 'Herb Garden Mix',
    description: 'Fresh herbs for digestive health',
    image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop',
    prepTime: 5,
    servings: 6,
    difficulty: 'Easy',
    organic: true,
    rating: 4.4,
    reviews: 167,
    birdType: 'All Birds',
    specialDiet: ['Digestive Aid', 'Fresh'],
    nutrition: {
      calories: 15,
      protein: 1,
      fat: 0.2,
      carbs: 3,
      antioxidants: 'High'
    },
    ingredients: [
      '1/4 cup fresh basil',
      '1/4 cup fresh parsley',
      '2 tbsp cilantro',
      '2 tbsp dill',
      '1 tbsp oregano',
      '1 tbsp thyme'
    ],
    instructions: [
      'Wash all herbs thoroughly',
      'Chop into small pieces',
      'Mix together',
      'Serve fresh daily',
      'Can hang bunches in cage',
      'Grows easily in pots'
    ]
  },
  {
    id: 'bird-12',
    name: 'Rice & Lentil Power Mix',
    description: 'Complete protein for optimal health',
    image: 'https://images.unsplash.com/photo-1548681528-6a5c45b66b42?w=400&h=300&fit=crop',
    prepTime: 45,
    servings: 12,
    difficulty: 'Medium',
    organic: false,
    rating: 4.7,
    reviews: 278,
    birdType: 'Parrots',
    specialDiet: ['Complete Protein', 'Balanced'],
    nutrition: {
      calories: 95,
      protein: 7,
      fat: 1,
      carbs: 17,
      complete: 'Yes'
    },
    ingredients: [
      '1 cup brown rice',
      '1/2 cup red lentils',
      '1/4 cup green peas',
      '2 tbsp nutritional yeast',
      '1 tsp turmeric',
      'Mixed vegetables'
    ],
    instructions: [
      'Cook brown rice as directed',
      'Cook lentils separately',
      'Steam green peas',
      'Mix rice, lentils, and peas',
      'Add nutritional yeast and turmeric',
      'Portion and freeze for convenience'
    ]
  }
];

const birdTypes = [
  { id: 'all', name: 'All Birds' },
  { id: 'parrots', name: 'Parrots' },
  { id: 'canaries', name: 'Canaries & Finches' }
];

const specialDiets = [
  'Vitamin Rich',
  'Antioxidants',
  'High Protein',
  'Enzyme Rich',
  'Low Fat',
  'High Fiber',
  'High Energy',
  'Omega-3',
  'Foraging',
  'Breeding',
  'Digestive Health',
  'Beak Exercise'
];

export default function BirdsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedDiet, setSelectedDiet] = useState('');
  const [showOrganic, setShowOrganic] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('petFoodFavorites');
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
  }, []);

  const toggleFavorite = (recipeId: string) => {
    const newFavorites = favorites.includes(recipeId)
      ? favorites.filter(id => id !== recipeId)
      : [...favorites, recipeId];
    setFavorites(newFavorites);
    localStorage.setItem('petFoodFavorites', JSON.stringify(newFavorites));
  };

  const getFilteredRecipes = () => {
    let filtered = birdRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedType || recipe.birdType === selectedType || recipe.birdType === 'All Birds';
      const matchesDiet = !selectedDiet || recipe.specialDiet.includes(selectedDiet);
      const matchesOrganic = !showOrganic || recipe.organic;
      
      return matchesSearch && matchesType && matchesDiet && matchesOrganic;
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
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
                <Bird className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Bird Recipes</h1>
                <Badge className="bg-blue-100 text-blue-800">Avian Nutrition</Badge>
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
              <div className="text-2xl font-bold text-blue-600">{birdRecipes.length}</div>
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
              <div className="text-2xl font-bold text-cyan-600">{favorites.length}</div>
              <div className="text-sm text-gray-600">Favorites</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-teal-600">4.7★</div>
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
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">All Bird Types</option>
                {birdTypes.map(type => (
                  <option key={type.id} value={type.name}>{type.name}</option>
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
                <div className="relative h-48 bg-gradient-to-br from-blue-100 to-cyan-100">
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
                    <Badge className="bg-blue-500 text-white text-xs">
                      {recipe.birdType}
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
                      <div className="font-bold text-blue-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
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

                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
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
                    <div className="font-semibold text-sm">Fresh is Best</div>
                    <div className="text-xs text-gray-600">Always provide fresh food daily and remove uneaten portions</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Variety is Key</div>
                    <div className="text-xs text-gray-600">Rotate recipes to provide diverse nutrients</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Wash Thoroughly</div>
                    <div className="text-xs text-gray-600">Clean all fruits and vegetables to remove pesticides</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Portion Control</div>
                    <div className="text-xs text-gray-600">Feed appropriate amounts based on bird size and activity</div>
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
                  <div className="text-xs text-red-700">Never use: avocado, chocolate, caffeine, salt, alcohol, onions</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-semibold text-sm text-orange-800 mb-1">No Seasonings</div>
                  <div className="text-xs text-orange-700">Avoid salt, sugar, and any seasonings</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-sm text-yellow-800 mb-1">Pit Removal</div>
                  <div className="text-xs text-yellow-700">Remove all pits, seeds, and cores from fruits</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-semibold text-sm text-blue-800 mb-1">Temperature</div>
                  <div className="text-xs text-blue-700">Serve food at room temperature, never hot or frozen</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}