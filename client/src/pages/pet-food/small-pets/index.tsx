import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Rabbit, Dog, Cat, Bird,
  Clock, Heart, Target, Leaf, Shield, 
  Search, Share2, ArrowLeft, Home,
  Award, Crown
} from 'lucide-react';

// SISTER PAGES
const sisterPetFoodPages = [
  { id: 'dogs', name: 'Dogs', path: '/pet-food/dogs', icon: Dog, description: 'Puppy to senior' },
  { id: 'cats', name: 'Cats', path: '/pet-food/cats', icon: Cat, description: 'Kitten to senior' },
  { id: 'birds', name: 'Birds', path: '/pet-food/birds', icon: Bird, description: 'Seed & fruit mixes' },
  { id: 'small-pets', name: 'Small Pets', path: '/pet-food/small-pets', icon: Rabbit, description: 'Rabbits & rodents' }
];

const smallPetRecipes = [
  {
    id: 'rabbit-hay-blend',
    name: 'Rabbit Premium Hay Mix',
    category: 'Rabbits',
    prepTime: '10 min',
    servings: '4 cups',
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 456,
    image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800',
    calories: 220,
    protein: 14,
    fat: 2,
    fiber: 28,
    badges: ['High Fiber', 'Hay-Based', 'Rabbits'],
    ingredients: [
      '2 cups timothy hay',
      '1 cup orchard grass hay',
      '1/2 cup oat hay',
      '1/4 cup dried dandelion leaves',
      '2 tbsp dried rose petals',
      '1 tbsp dried chamomile',
      '1 tbsp dried plantain leaves'
    ],
    instructions: [
      'Mix all types of hay together',
      'Add dried herbs evenly throughout',
      'Store in dry, ventilated container',
      'Provide unlimited access to hay',
      'Supplement with fresh vegetables daily',
      'Always ensure fresh water is available',
      'Hay should make up 80% of diet'
    ]
  },
  {
    id: 'guinea-pig-veggie-feast',
    name: 'Guinea Pig Vitamin C Feast',
    category: 'Guinea Pigs',
    prepTime: '15 min',
    servings: '2 cups',
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 389,
    image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800',
    calories: 180,
    protein: 10,
    fat: 3,
    fiber: 22,
    badges: ['Vitamin C', 'Fresh Veggies', 'Guinea Pigs'],
    ingredients: [
      '1/2 cup red bell pepper, diced',
      '1/2 cup romaine lettuce, chopped',
      '1/4 cup cilantro',
      '1/4 cup parsley',
      '2 tbsp carrot, grated',
      '2 cherry tomatoes, halved',
      '1 small slice orange (occasional treat)'
    ],
    instructions: [
      'Wash all vegetables thoroughly',
      'Dice bell pepper into small pieces',
      'Chop leafy greens',
      'Grate carrot finely',
      'Mix all ingredients together',
      'Serve fresh daily',
      'Remove uneaten food after 4 hours'
    ]
  },
  {
    id: 'hamster-seed-mix',
    name: 'Hamster Wholesome Seed Blend',
    category: 'Hamsters',
    prepTime: '12 min',
    servings: '3 cups',
    difficulty: 'Easy',
    rating: 4.7,
    reviews: 312,
    image: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=800',
    calories: 165,
    protein: 16,
    fat: 8,
    fiber: 12,
    badges: ['Balanced Mix', 'Seed Variety', 'Hamsters'],
    ingredients: [
      '1/2 cup whole oats',
      '1/4 cup millet',
      '1/4 cup wheat',
      '2 tbsp sunflower seeds',
      '2 tbsp pumpkin seeds',
      '1 tbsp flax seeds',
      '1 tbsp dried peas'
    ],
    instructions: [
      'Combine all seeds and grains',
      'Mix thoroughly to distribute evenly',
      'Store in airtight container',
      'Provide 1-2 tablespoons daily',
      'Supplement with fresh vegetables',
      'Offer occasional protein (mealworms, eggs)',
      'Remove uneaten fresh food daily'
    ]
  },
  {
    id: 'gerbil-complete-diet',
    name: 'Gerbil Complete Nutrition Mix',
    category: 'Gerbils',
    prepTime: '15 min',
    servings: '3 cups',
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 234,
    image: 'https://images.unsplash.com/photo-1619734086067-24bf8889ea7d?w=800',
    calories: 155,
    protein: 14,
    fat: 6,
    fiber: 14,
    badges: ['Complete Diet', 'Varied Mix', 'Gerbils'],
    ingredients: [
      '1/2 cup whole oats',
      '1/4 cup barley',
      '1/4 cup millet',
      '2 tbsp sunflower seeds',
      '2 tbsp pumpkin seeds',
      '1 tbsp dried mealworms',
      '1 tbsp dried vegetables'
    ],
    instructions: [
      'Mix all grains together',
      'Add seeds and dried protein',
      'Include dried vegetables for variety',
      'Store in cool, dry place',
      'Feed 1-2 tablespoons daily',
      'Provide small amounts of fresh produce',
      'Always have fresh water available'
    ]
  },
  {
    id: 'rabbit-veggie-garden',
    name: 'Rabbit Garden Harvest Bowl',
    category: 'Rabbits',
    prepTime: '20 min',
    servings: '3 cups',
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 498,
    image: 'https://images.unsplash.com/photo-1535241749838-299277b6305f?w=800',
    calories: 95,
    protein: 8,
    fat: 1,
    fiber: 18,
    badges: ['Fresh Veggies', 'Low Calorie', 'Rabbits'],
    ingredients: [
      '1 cup romaine lettuce',
      '1/2 cup kale',
      '1/4 cup cilantro',
      '1/4 cup parsley',
      '3 baby carrots',
      '2 radish tops',
      '1 small piece broccoli'
    ],
    instructions: [
      'Wash all vegetables thoroughly',
      'Tear lettuce and kale into pieces',
      'Chop herbs',
      'Slice carrots thinly',
      'Mix all greens and vegetables',
      'Serve fresh alongside unlimited hay',
      'Feed 2 cups per 5 lbs body weight daily'
    ]
  },
  {
    id: 'guinea-pig-pellet-mix',
    name: 'Guinea Pig Fortified Pellet Mix',
    category: 'Guinea Pigs',
    prepTime: '10 min',
    servings: '4 cups',
    difficulty: 'Easy',
    rating: 4.7,
    reviews: 356,
    image: 'https://images.unsplash.com/photo-1612535854692-419d8e4f9d19?w=800',
    calories: 240,
    protein: 18,
    fat: 4,
    fiber: 16,
    badges: ['Vitamin C', 'Pellets', 'Guinea Pigs'],
    ingredients: [
      '2 cups timothy hay pellets',
      '1 cup alfalfa pellets (for young GPs)',
      '1/2 cup oat groats',
      '1/4 cup dried bell pepper',
      '2 tbsp rose hips (vitamin C)',
      '2 tbsp dried parsley',
      '1 tbsp flax seeds'
    ],
    instructions: [
      'Mix pellets together',
      'Add dried vegetables and herbs',
      'Include rose hips for vitamin C boost',
      'Store in airtight container away from light',
      'Feed 1/8 cup per guinea pig daily',
      'Must supplement with fresh vitamin C sources',
      'Never replace fresh veggies with pellets'
    ]
  },
  {
    id: 'hamster-protein-boost',
    name: 'Hamster Protein Power Mix',
    category: 'Hamsters',
    prepTime: '15 min',
    servings: '2 cups',
    difficulty: 'Medium',
    rating: 4.8,
    reviews: 267,
    image: 'https://images.unsplash.com/photo-1452857297128-d9c29adba80b?w=800',
    calories: 195,
    protein: 22,
    fat: 10,
    fiber: 10,
    badges: ['High Protein', 'Nursing/Young', 'Hamsters'],
    ingredients: [
      '1/2 cup whole oats',
      '1/4 cup millet',
      '2 tbsp sunflower seeds',
      '2 tbsp dried mealworms',
      '1 tbsp pumpkin seeds',
      '1 tbsp hemp seeds',
      '1 hard-boiled egg, chopped (fresh)'
    ],
    instructions: [
      'Mix all dry ingredients together',
      'Add dried mealworms for protein',
      'Prepare hard-boiled egg separately',
      'Offer 1 tablespoon of dry mix daily',
      'Add small amount of egg 2-3x per week',
      'Great for pregnant, nursing, or young hamsters',
      'Remove fresh protein after 2 hours'
    ]
  },
  {
    id: 'chinchilla-dust-free',
    name: 'Chinchilla Safe Treat Mix',
    category: 'Chinchillas',
    prepTime: '12 min',
    servings: '2 cups',
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 198,
    image: 'https://images.unsplash.com/photo-1553481187-be93c21490a9?w=800',
    calories: 135,
    protein: 12,
    fat: 3,
    fiber: 24,
    badges: ['Low Fat', 'High Fiber', 'Chinchillas'],
    ingredients: [
      '1 cup timothy hay pellets',
      '1/2 cup dried rose hips',
      '1/4 cup dried apple (no seeds)',
      '2 tbsp dried hibiscus flowers',
      '2 tbsp rolled oats',
      '1 tbsp dried dandelion leaves',
      '1 tbsp dried rose petals'
    ],
    instructions: [
      'Crush pellets slightly for variety',
      'Mix all dried ingredients',
      'Ensure no added sugar or oils',
      'Store in moisture-free container',
      'Treats only - 1-2 tablespoons weekly',
      'Main diet should be hay and pellets',
      'Never feed fatty or sugary foods'
    ]
  }
];

export default function SmallPetsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = ['All', 'Rabbits', 'Guinea Pigs', 'Hamsters', 'Gerbils', 'Chinchillas'];

  const filteredRecipes = useMemo(() => {
    return smallPetRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          recipe.badges.some(b => b.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !selectedCategory || selectedCategory === 'All' || recipe.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-lime-50">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-lime-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/pet-food">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Pet Food
              </Button>
            </Link>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Heart className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="bg-gradient-to-br from-emerald-600 via-green-600 to-lime-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <Rabbit className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-5xl font-bold mb-2">Small Pet Food Recipes</h1>
              <p className="text-xl text-emerald-100">Nutritious hay-based diets and veggie mixes for small animals</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Leaf className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">8</div>
              <div className="text-sm text-emerald-100">Recipes</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Clock className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">10-20min</div>
              <div className="text-sm text-emerald-100">Prep Time</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Target className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">5 Species</div>
              <div className="text-sm text-emerald-100">Small Pets</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Shield className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">High Fiber</div>
              <div className="text-sm text-emerald-100">Digestive Health</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* SEARCH & FILTER */}
        <div className="mb-8">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-emerald-200 focus:border-emerald-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat || (!selectedCategory && cat === 'All') ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={selectedCategory === cat || (!selectedCategory && cat === 'All') 
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white'
                  : 'border-emerald-200 hover:border-emerald-400'}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* SAFETY TIPS */}
        <Card className="mb-8 border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <Shield className="h-5 w-5" />
              Important Safety Tips for Small Pets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-emerald-800">
              <div>
                <div className="font-semibold mb-2">✓ Safe for Small Pets:</div>
                <ul className="space-y-1 ml-4">
                  <li>• Timothy hay, orchard grass, oat hay (unlimited)</li>
                  <li>• Leafy greens (romaine, kale, cilantro, parsley)</li>
                  <li>• Bell peppers, carrots, broccoli (small amounts)</li>
                  <li>• Whole grains (oats, millet, barley)</li>
                  <li>• Small amounts of fruits as treats</li>
                  <li>• Species-appropriate pellets</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2 text-red-700">✗ Toxic for Small Pets:</div>
                <ul className="space-y-1 ml-4 text-red-700">
                  <li>• Chocolate, caffeine, alcohol</li>
                  <li>• Avocado, potato leaves/sprouts</li>
                  <li>• Onions, garlic, chives, leeks</li>
                  <li>• Rhubarb leaves (toxic)</li>
                  <li>• Apple seeds, cherry pits</li>
                  <li>• Iceberg lettuce (low nutrition, can cause diarrhea)</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-3 bg-green-100 rounded-lg border border-green-300">
              <p className="text-sm text-green-900 font-semibold mb-2">
                ⚠️ Species-Specific Notes:
              </p>
              <ul className="text-sm text-green-800 space-y-1 ml-4">
                <li>• <strong>Rabbits & Guinea Pigs:</strong> Need unlimited hay (80%+ of diet) and fresh vitamin C sources daily</li>
                <li>• <strong>Hamsters & Gerbils:</strong> Need protein sources (mealworms, eggs) 2-3x per week</li>
                <li>• <strong>Chinchillas:</strong> Need very low-fat, high-fiber diet; treats sparingly</li>
              </ul>
            </div>
            <p className="mt-3 text-xs text-emerald-700 italic">
              Always consult a small animal veterinarian for species-specific dietary needs. Introduce new foods gradually.
            </p>
          </CardContent>
        </Card>

        {/* RECIPES GRID */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredRecipes.map((recipe) => (
            <Card key={recipe.id} className="group hover:shadow-xl transition-all duration-300 border-emerald-200 hover:border-emerald-400 overflow-hidden">
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={recipe.image} 
                  alt={recipe.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute top-3 right-3 flex flex-col gap-2">
                  {recipe.badges.slice(0, 2).map((badge) => (
                    <Badge key={badge} className="bg-emerald-600 text-white">
                      {badge}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1">{recipe.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {recipe.prepTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Rabbit className="h-4 w-4" />
                        {recipe.servings}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <div className="flex text-yellow-500">
                    {'★'.repeat(Math.floor(recipe.rating))}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{recipe.rating}</span>
                  <span className="text-sm text-gray-500">({recipe.reviews})</span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                  <div className="bg-emerald-50 rounded p-2">
                    <div className="text-xs text-gray-600">Calories</div>
                    <div className="font-bold text-emerald-700">{recipe.calories}</div>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-xs text-gray-600">Protein</div>
                    <div className="font-bold text-green-700">{recipe.protein}g</div>
                  </div>
                  <div className="bg-emerald-50 rounded p-2">
                    <div className="text-xs text-gray-600">Fat</div>
                    <div className="font-bold text-emerald-700">{recipe.fat}g</div>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-xs text-gray-600">Fiber</div>
                    <div className="font-bold text-green-700">{recipe.fiber}g</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700">
                    View Recipe
                  </Button>
                  <Button variant="outline" size="icon" className="border-emerald-200 hover:border-emerald-400">
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* SISTER PAGES NAVIGATION */}
        <Card className="mb-8 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <Home className="h-5 w-5" />
              Explore Other Pet Food Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sisterPetFoodPages.map((page) => {
                const Icon = page.icon;
                const isActive = page.id === 'small-pets';
                return (
                  <Link key={page.id} href={page.path}>
                    <Card className={`cursor-pointer transition-all hover:shadow-lg ${
                      isActive 
                        ? 'border-2 border-emerald-500 bg-emerald-50' 
                        : 'border-gray-200 hover:border-emerald-300'
                    }`}>
                      <CardContent className="p-4 text-center">
                        <Icon className={`h-8 w-8 mx-auto mb-2 ${
                          isActive ? 'text-emerald-600' : 'text-gray-600'
                        }`} />
                        <div className={`font-semibold mb-1 ${
                          isActive ? 'text-emerald-900' : 'text-gray-900'
                        }`}>
                          {page.name}
                        </div>
                        <div className="text-xs text-gray-600">{page.description}</div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* YOUR PROGRESS CARD */}
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <Award className="h-5 w-5" />
              Your Small Pet Food Journey
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-emerald-900">Recipes Tried</span>
                  <span className="text-sm font-bold text-emerald-700">5/8</span>
                </div>
                <div className="w-full bg-emerald-200 rounded-full h-2">
                  <div className="bg-gradient-to-r from-emerald-600 to-green-600 h-2 rounded-full" style={{ width: '62.5%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-emerald-900">Pet Level</span>
                  <span className="text-sm font-bold text-emerald-700">Level 3</span>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-emerald-600" />
                  <span className="text-xs text-gray-600">Almost to Level 4!</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-emerald-900">Achievements</span>
                  <span className="text-sm font-bold text-emerald-700">4</span>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-emerald-600">Hay Master</Badge>
                  <Badge className="bg-green-600">Veggie Pro</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
