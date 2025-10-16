import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Rabbit, Heart, Star, ArrowLeft, Search, Leaf, Apple,
  Clock, Utensils, CheckCircle, Info, AlertCircle, Carrot
} from 'lucide-react';

// Recipe data for small pets (rabbits, guinea pigs, hamsters)
const smallPetRecipes = [
  {
    id: 'small-1',
    name: 'Fresh Veggie Salad Bowl',
    description: 'Daily fresh vegetable mix for rabbits',
    image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&h=300&fit=crop',
    prepTime: 10,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    rating: 4.9,
    reviews: 567,
    petType: 'Rabbits',
    specialDiet: ['High Fiber', 'Vitamin Rich'],
    nutrition: {
      calories: 35,
      protein: 2,
      fat: 0.3,
      carbs: 7,
      fiber: 3
    },
    ingredients: [
      '2 cups romaine lettuce',
      '1/2 cup cilantro',
      '1/4 cup parsley',
      '3 carrots (with tops)',
      '1 small bell pepper',
      '2 celery stalks'
    ],
    instructions: [
      'Wash all vegetables thoroughly',
      'Chop into bite-sized pieces',
      'Mix leafy greens together',
      'Add chopped vegetables',
      'Serve fresh twice daily',
      'Remove uneaten portions after 4 hours'
    ]
  },
  {
    id: 'small-2',
    name: 'Guinea Pig Vitamin C Boost',
    description: 'Essential vitamin C rich meal',
    image: 'https://images.unsplash.com/photo-1548681528-6a5c45b66b42?w=400&h=300&fit=crop',
    prepTime: 15,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    rating: 4.8,
    reviews: 445,
    petType: 'Guinea Pigs',
    specialDiet: ['Vitamin C', 'Antioxidants'],
    nutrition: {
      calories: 40,
      protein: 2,
      fat: 0.4,
      carbs: 9,
      vitaminC: 'Very High'
    },
    ingredients: [
      '1 red bell pepper',
      '1/4 cup kale',
      '3 cherry tomatoes',
      '1/4 cup parsley',
      '1 small orange slice',
      '2 tbsp cilantro'
    ],
    instructions: [
      'Remove seeds from bell pepper',
      'Chop all vegetables finely',
      'Mix together in bowl',
      'Serve fresh daily',
      'Guinea pigs cannot produce vitamin C',
      'Provide twice daily'
    ]
  },
  {
    id: 'small-3',
    name: 'Hamster Seed & Veggie Mix',
    description: 'Balanced diet for active hamsters',
    image: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=400&h=300&fit=crop',
    prepTime: 10,
    servings: 4,
    difficulty: 'Easy',
    organic: false,
    rating: 4.7,
    reviews: 334,
    petType: 'Hamsters',
    specialDiet: ['Protein Balance', 'Energy'],
    nutrition: {
      calories: 55,
      protein: 4,
      fat: 2,
      carbs: 8,
      variety: 'Excellent'
    },
    ingredients: [
      '2 tbsp sunflower seeds',
      '2 tbsp pumpkin seeds',
      '1 tbsp oats',
      '1 tbsp dried vegetables',
      'Small piece of carrot',
      'Small piece of apple'
    ],
    instructions: [
      'Mix seeds and oats together',
      'Add dried vegetables',
      'Chop fresh carrot and apple small',
      'Combine all ingredients',
      'Portion into daily servings',
      'Remove fresh items after 12 hours'
    ]
  },
  {
    id: 'small-4',
    name: 'Rabbit Herb Garden Mix',
    description: 'Fresh herbs for digestive health',
    image: 'https://images.unsplash.com/photo-1604908815883-5f9a4d96569d?w=400&h=300&fit=crop',
    prepTime: 5,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    rating: 4.9,
    reviews: 489,
    petType: 'Rabbits',
    specialDiet: ['Digestive Health', 'Fresh Herbs'],
    nutrition: {
      calories: 15,
      protein: 1,
      fat: 0.2,
      carbs: 3,
      digestiveAid: 'High'
    },
    ingredients: [
      '1/4 cup fresh basil',
      '1/4 cup fresh mint',
      '1/4 cup fresh dill',
      '2 tbsp oregano',
      '2 tbsp thyme',
      '1/4 cup dandelion greens'
    ],
    instructions: [
      'Wash all herbs thoroughly',
      'Mix herbs together',
      'Serve fresh daily',
      'Can grow in pots',
      'Rotate herb varieties',
      'Great for digestive health'
    ]
  },
  {
    id: 'small-5',
    name: 'Guinea Pig Fruit Salad',
    description: 'Occasional fruit treat (limited quantity)',
    image: 'https://images.unsplash.com/photo-1599909533265-0f327bfa6e27?w=400&h=300&fit=crop',
    prepTime: 10,
    servings: 2,
    difficulty: 'Easy',
    organic: true,
    rating: 4.6,
    reviews: 278,
    petType: 'Guinea Pigs',
    specialDiet: ['Treats', 'Vitamin C'],
    nutrition: {
      calories: 45,
      protein: 1,
      fat: 0.3,
      carbs: 11,
      sugar: 8
    },
    ingredients: [
      '2 strawberries, sliced',
      '1/4 cup blueberries',
      '2 small apple slices',
      '1 small orange slice',
      '2 raspberries',
      'Mint leaf for garnish'
    ],
    instructions: [
      'Wash all fruits thoroughly',
      'Remove seeds and cores',
      'Cut into small pieces',
      'Mix together',
      'Feed only 1-2 times per week',
      'Limit to prevent obesity'
    ]
  },
  {
    id: 'small-6',
    name: 'Hamster Protein Boost',
    description: 'High-protein meal for active hamsters',
    image: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400&h=300&fit=crop',
    prepTime: 15,
    servings: 4,
    difficulty: 'Easy',
    organic: false,
    rating: 4.7,
    reviews: 312,
    petType: 'Hamsters',
    specialDiet: ['High Protein', 'Energy'],
    nutrition: {
      calories: 65,
      protein: 7,
      fat: 3,
      carbs: 6,
      complete: 'Yes'
    },
    ingredients: [
      '1 hard-boiled egg (small piece)',
      '1 tbsp cooked chicken (plain)',
      '1 tbsp mealworms (dried)',
      '1 tbsp plain yogurt',
      '1 tsp pumpkin seeds',
      'Pinch of oats'
    ],
    instructions: [
      'Hard-boil egg and cool',
      'Cook chicken plain (no seasoning)',
      'Chop into tiny pieces',
      'Mix all protein sources',
      'Add small amount of yogurt',
      'Feed 2-3 times per week only'
    ]
  },
  {
    id: 'small-7',
    name: 'Rabbit Root Veggie Feast',
    description: 'Seasonal root vegetables for variety',
    image: 'https://images.unsplash.com/photo-1567529692333-de9fd6772897?w=400&h=300&fit=crop',
    prepTime: 20,
    servings: 3,
    difficulty: 'Easy',
    organic: true,
    rating: 4.8,
    reviews: 423,
    petType: 'Rabbits',
    specialDiet: ['Variety', 'Seasonal'],
    nutrition: {
      calories: 45,
      protein: 2,
      fat: 0.3,
      carbs: 10,
      fiber: 4
    },
    ingredients: [
      '2 carrots with tops',
      '1 small parsnip',
      '1/4 cup beet greens',
      '1 small turnip',
      '1/4 cup radish tops',
      'Fresh herbs'
    ],
    instructions: [
      'Wash all vegetables and greens',
      'Chop root vegetables into chunks',
      'Leave leafy tops attached',
      'Mix with fresh herbs',
      'Serve at room temperature',
      'Feed as part of varied diet'
    ]
  },
  {
    id: 'small-8',
    name: 'Guinea Pig Bell Pepper Boats',
    description: 'Fun presentation for vitamin C',
    image: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=400&h=300&fit=crop',
    prepTime: 15,
    servings: 2,
    difficulty: 'Medium',
    organic: true,
    rating: 4.9,
    reviews: 234,
    petType: 'Guinea Pigs',
    specialDiet: ['Vitamin C', 'Interactive'],
    nutrition: {
      calories: 35,
      protein: 2,
      fat: 0.4,
      carbs: 7,
      vitaminC: 'Excellent'
    },
    ingredients: [
      '1 large bell pepper (any color)',
      '1/4 cup romaine lettuce',
      '2 tbsp parsley',
      '3 cherry tomatoes',
      '2 tbsp cucumber',
      'Cilantro for garnish'
    ],
    instructions: [
      'Cut bell pepper in half lengthwise',
      'Remove seeds carefully',
      'Chop lettuce, parsley, tomatoes',
      'Fill pepper halves with mixture',
      'Top with cilantro',
      'Provides enrichment and nutrition'
    ]
  },
  {
    id: 'small-9',
    name: 'Hamster Whole Grain Mix',
    description: 'Balanced grain blend for energy',
    image: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=300&fit=crop',
    prepTime: 5,
    servings: 6,
    difficulty: 'Easy',
    organic: false,
    rating: 4.5,
    reviews: 198,
    petType: 'Hamsters',
    specialDiet: ['Whole Grains', 'Fiber'],
    nutrition: {
      calories: 50,
      protein: 3,
      fat: 1.5,
      carbs: 9,
      fiber: 2
    },
    ingredients: [
      '2 tbsp rolled oats',
      '1 tbsp barley',
      '1 tbsp wheat berries',
      '1 tbsp millet',
      '1 tsp flax seeds',
      'Pinch of dried herbs'
    ],
    instructions: [
      'Mix all grains together',
      'Can lightly toast for variety',
      'Add flax seeds',
      'Store in airtight container',
      'Portion daily',
      'Ensure fresh water available'
    ]
  },
  {
    id: 'small-10',
    name: 'Rabbit Timothy Hay Blend',
    description: 'Essential hay mix for digestive health',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&h=300&fit=crop',
    prepTime: 5,
    servings: 1,
    difficulty: 'Easy',
    organic: true,
    rating: 4.9,
    reviews: 678,
    petType: 'Rabbits',
    specialDiet: ['Digestive Essential', 'Dental Health'],
    nutrition: {
      calories: 25,
      protein: 1,
      fat: 0.2,
      carbs: 6,
      fiber: 5
    },
    ingredients: [
      '2 cups timothy hay',
      '1/4 cup orchard grass',
      '1/4 cup botanical hay',
      'Dried chamomile flowers',
      'Dried rose petals',
      'Fresh herbs (optional)'
    ],
    instructions: [
      'Mix timothy hay with other hays',
      'Add dried flowers',
      'Provide unlimited access',
      'Replace daily',
      'Hay should be 80% of diet',
      'Essential for dental wear'
    ]
  },
  {
    id: 'small-11',
    name: 'Gerbil Seed Tower',
    description: 'Fun foraging tower for enrichment',
    image: 'https://images.unsplash.com/photo-1606193309091-8f0b45328815?w=400&h=300&fit=crop',
    prepTime: 20,
    servings: 8,
    difficulty: 'Medium',
    organic: false,
    rating: 4.6,
    reviews: 145,
    petType: 'Gerbils',
    specialDiet: ['Foraging', 'Enrichment'],
    nutrition: {
      calories: 60,
      protein: 4,
      fat: 3,
      carbs: 8,
      entertainment: 'High'
    },
    ingredients: [
      '2 tbsp sunflower seeds',
      '2 tbsp pumpkin seeds',
      '1 tbsp millet',
      '1 tbsp dried vegetables',
      'Cardboard tube',
      'Natural peanut butter (thin layer)'
    ],
    instructions: [
      'Mix all seeds and vegetables',
      'Spread thin layer of peanut butter on tube',
      'Roll tube in seed mixture',
      'Let dry for 1 hour',
      'Hang in cage',
      'Provides enrichment and exercise'
    ]
  },
  {
    id: 'small-12',
    name: 'Chinchilla Dust Bath Treats',
    description: 'Safe chew treats for dental health',
    image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop',
    prepTime: 30,
    servings: 10,
    difficulty: 'Hard',
    organic: true,
    rating: 4.7,
    reviews: 267,
    petType: 'Chinchillas',
    specialDiet: ['Dental Health', 'Low Sugar'],
    nutrition: {
      calories: 30,
      protein: 2,
      fat: 0.5,
      carbs: 6,
      fiber: 3
    },
    ingredients: [
      '1/2 cup timothy hay pellets',
      '1/4 cup rolled oats',
      '2 tbsp rose hips',
      '1 tbsp dried hibiscus',
      '1 tbsp apple wood chips',
      'Water to bind'
    ],
    instructions: [
      'Grind pellets into powder',
      'Mix with oats and dried flowers',
      'Add water slowly to form dough',
      'Shape into small sticks',
      'Bake at 200°F for 90 minutes',
      'Cool completely and store dry'
    ]
  }
];

const petTypes = [
  { id: 'all', name: 'All Small Pets' },
  { id: 'rabbits', name: 'Rabbits' },
  { id: 'guinea', name: 'Guinea Pigs' },
  { id: 'hamsters', name: 'Hamsters' },
  { id: 'gerbils', name: 'Gerbils' },
  { id: 'chinchillas', name: 'Chinchillas' }
];

const specialDiets = [
  'High Fiber',
  'Vitamin Rich',
  'Vitamin C',
  'Antioxidants',
  'Protein Balance',
  'Digestive Health',
  'Fresh Herbs',
  'Whole Grains',
  'Dental Health',
  'Foraging',
  'Enrichment',
  'Low Sugar'
];

export default function SmallPetsPage() {
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
    let filtered = smallPetRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedType || recipe.petType === selectedType || recipe.petType === 'All Small Pets';
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
                <h1 className="text-2xl font-bold text-gray-900">Small Pet Recipes</h1>
                <Badge className="bg-green-100 text-green-800">Herbivore & Omnivore</Badge>
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
              <div className="text-2xl font-bold text-teal-600">{favorites.length}</div>
              <div className="text-sm text-gray-600">Favorites</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-lime-600">4.7★</div>
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
                <option value="">All Pet Types</option>
                {petTypes.map(type => (
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
                <div className="relative h-48 bg-gradient-to-br from-green-100 to-emerald-100">
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
                    <Badge className="bg-emerald-500 text-white text-xs">
                      {recipe.petType}
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
                      <div className="font-bold text-green-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-emerald-600">{recipe.prepTime}m</div>
                      <div className="text-gray-500">Prep</div>
                    </div>
                    <div>
                      <div className="font-bold text-teal-600">{recipe.servings}</div>
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

                  <Button className="w-full bg-green-600 hover:bg-green-700">
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
                    <div className="font-semibold text-sm">Fresh Daily</div>
                    <div className="text-xs text-gray-600">Provide fresh vegetables daily and remove after 4-6 hours</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Hay is Essential</div>
                    <div className="text-xs text-gray-600">Rabbits & guinea pigs need unlimited hay for dental and digestive health</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Wash Thoroughly</div>
                    <div className="text-xs text-gray-600">Clean all vegetables to remove pesticides and dirt</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Introduce Slowly</div>
                    <div className="text-xs text-gray-600">New foods should be introduced gradually over 1-2 weeks</div>
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
                  <div className="text-xs text-red-700">Never feed: chocolate, avocado, potato, rhubarb, onions, garlic</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-semibold text-sm text-orange-800 mb-1">Limit Fruits</div>
                  <div className="text-xs text-orange-700">Fruits are treats only - high sugar can cause obesity</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-sm text-yellow-800 mb-1">Guinea Pig Vitamin C</div>
                  <div className="text-xs text-yellow-700">Guinea pigs MUST have daily vitamin C - cannot produce it</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-semibold text-sm text-blue-800 mb-1">Fresh Water</div>
                  <div className="text-xs text-blue-700">Provide fresh, clean water at all times</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}