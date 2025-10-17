import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Bird, Dog, Cat, Rabbit,
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

const birdRecipes = [
  {
    id: 'parrot-power-mix',
    name: 'Parrot Power Mix',
    category: 'Parrots',
    prepTime: '15 min',
    servings: '2 cups',
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 287,
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800',
    calories: 180,
    protein: 12,
    fat: 15,
    carbs: 38,
    badges: ['High Energy', 'Nut-Rich', 'Parrots'],
    ingredients: [
      '1/2 cup raw almonds',
      '1/4 cup raw walnuts',
      '1/4 cup dried papaya',
      '1/4 cup dried mango',
      '2 tbsp sunflower seeds',
      '2 tbsp pumpkin seeds',
      '1 tbsp chia seeds'
    ],
    instructions: [
      'Chop almonds and walnuts into smaller pieces',
      'Dice dried fruits into bite-sized pieces',
      'Mix all seeds together',
      'Combine nuts, fruits, and seeds thoroughly',
      'Store in airtight container',
      'Serve 2-3 tablespoons per day for medium parrots',
      'Adjust portions based on bird size'
    ]
  },
  {
    id: 'canary-seed-blend',
    name: 'Canary Premium Seed Blend',
    category: 'Canaries',
    prepTime: '10 min',
    servings: '3 cups',
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 342,
    image: 'https://images.unsplash.com/photo-1550670256-6d2e5e8d6f28?w=800',
    calories: 140,
    protein: 14,
    fat: 12,
    carbs: 32,
    badges: ['Seed Mix', 'Singing Support', 'Canaries'],
    ingredients: [
      '1 cup canary grass seed',
      '1/2 cup millet (white and red)',
      '1/4 cup rapeseed',
      '1/4 cup niger seed',
      '2 tbsp flax seeds',
      '2 tbsp hemp seeds',
      '1 tbsp sesame seeds'
    ],
    instructions: [
      'Mix all seeds in large bowl',
      'Ensure even distribution',
      'Store in cool, dry place',
      'Provide 1-2 teaspoons per day',
      'Supplement with fresh greens',
      'Always provide fresh water',
      'Rotate with fresh fruits weekly'
    ]
  },
  {
    id: 'finch-fruit-delight',
    name: 'Finch Fruit & Seed Delight',
    category: 'Finches',
    prepTime: '12 min',
    servings: '2 cups',
    difficulty: 'Easy',
    rating: 4.7,
    reviews: 198,
    image: 'https://images.unsplash.com/photo-1582845512747-e42001c95638?w=800',
    calories: 125,
    protein: 10,
    fat: 8,
    carbs: 28,
    badges: ['Fruit & Seed', 'Small Birds', 'Finches'],
    ingredients: [
      '1/2 cup millet',
      '1/4 cup canary seed',
      '1/4 cup dried currants',
      '2 tbsp dried cranberries, chopped',
      '2 tbsp oat groats',
      '1 tbsp niger seed',
      '1 tbsp dried apple, finely diced'
    ],
    instructions: [
      'Mix all seeds together',
      'Chop dried fruits into tiny pieces',
      'Combine seeds and fruits',
      'Store in sealed container',
      'Offer 1 teaspoon per finch daily',
      'Provide cuttlebone for calcium',
      'Fresh greens 2-3 times per week'
    ]
  },
  {
    id: 'budgie-veggie-bowl',
    name: 'Budgie Veggie Garden Bowl',
    category: 'Budgies',
    prepTime: '15 min',
    servings: '1 cup',
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 423,
    image: 'https://images.unsplash.com/photo-1589666564459-93cdd3ab856a?w=800',
    calories: 95,
    protein: 8,
    fat: 5,
    carbs: 22,
    badges: ['Fresh Veggies', 'Low Fat', 'Budgies'],
    ingredients: [
      '1/4 cup finely chopped broccoli',
      '1/4 cup grated carrot',
      '2 tbsp chopped spinach',
      '2 tbsp millet',
      '1 tbsp quinoa (cooked)',
      '1 tsp sesame seeds',
      '1 small piece apple (no seeds)'
    ],
    instructions: [
      'Wash all vegetables thoroughly',
      'Chop broccoli into tiny florets',
      'Grate carrot finely',
      'Cook quinoa and let cool',
      'Mix all ingredients together',
      'Serve fresh daily',
      'Remove uneaten portions after 2 hours'
    ]
  },
  {
    id: 'cockatiel-breakfast',
    name: 'Cockatiel Morning Feast',
    category: 'Cockatiels',
    prepTime: '20 min',
    servings: '2 cups',
    difficulty: 'Medium',
    rating: 4.8,
    reviews: 312,
    image: 'https://images.unsplash.com/photo-1563281746-3e5c80b1cd19?w=800',
    calories: 165,
    protein: 11,
    fat: 13,
    carbs: 35,
    badges: ['Balanced Diet', 'Nutrient-Rich', 'Cockatiels'],
    ingredients: [
      '1/2 cup millet spray',
      '1/4 cup safflower seeds',
      '1/4 cup oat groats',
      '2 tbsp dried banana chips',
      '2 tbsp pumpkin seeds',
      '1 tbsp flax seeds',
      '1 tbsp dried coconut'
    ],
    instructions: [
      'Break up millet spray into smaller pieces',
      'Chop banana chips into small bits',
      'Mix all seeds together',
      'Add dried fruits and coconut',
      'Store in airtight container',
      'Serve 2 tablespoons per bird daily',
      'Supplement with fresh vegetables'
    ]
  },
  {
    id: 'lovebird-tropical',
    name: 'Lovebird Tropical Paradise',
    category: 'Lovebirds',
    prepTime: '18 min',
    servings: '2 cups',
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 267,
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800',
    calories: 155,
    protein: 10,
    fat: 11,
    carbs: 32,
    badges: ['Tropical Fruits', 'Colorful', 'Lovebirds'],
    ingredients: [
      '1/4 cup dried papaya',
      '1/4 cup dried pineapple',
      '1/4 cup dried mango',
      '1/4 cup sunflower seeds',
      '2 tbsp pumpkin seeds',
      '2 tbsp millet',
      '1 tbsp dried hibiscus flowers'
    ],
    instructions: [
      'Dice all dried fruits into small pieces',
      'Mix fruits with seeds',
      'Add crushed hibiscus flowers',
      'Combine thoroughly',
      'Store away from moisture',
      'Offer 1-2 tablespoons daily',
      'Rotate with fresh tropical fruits when available'
    ]
  },
  {
    id: 'conure-power-pellet',
    name: 'Conure Energy Blend',
    category: 'Conures',
    prepTime: '25 min',
    servings: '3 cups',
    difficulty: 'Medium',
    rating: 4.7,
    reviews: 189,
    image: 'https://images.unsplash.com/photo-1580156783729-1e93a8e90b78?w=800',
    calories: 195,
    protein: 13,
    fat: 16,
    carbs: 40,
    badges: ['High Energy', 'Active Birds', 'Conures'],
    ingredients: [
      '1/2 cup raw cashews',
      '1/4 cup raw pistachios',
      '1/4 cup dried berries',
      '1/4 cup whole oats',
      '2 tbsp pepitas',
      '2 tbsp flax seeds',
      '1 tbsp bee pollen'
    ],
    instructions: [
      'Chop nuts into smaller pieces',
      'Mix nuts with dried berries',
      'Add oats and seeds',
      'Sprinkle bee pollen on top',
      'Mix well to distribute',
      'Serve 2-3 tablespoons per bird',
      'Great for active, playful conures'
    ]
  },
  {
    id: 'macaw-mega-mix',
    name: 'Macaw Mega Nut Mix',
    category: 'Macaws',
    prepTime: '20 min',
    servings: '4 cups',
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 156,
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
    calories: 220,
    protein: 15,
    fat: 18,
    carbs: 42,
    badges: ['Large Birds', 'Nut-Heavy', 'Macaws'],
    ingredients: [
      '1/2 cup brazil nuts',
      '1/2 cup raw almonds',
      '1/4 cup raw macadamias',
      '1/4 cup dried papaya chunks',
      '1/4 cup dried coconut chunks',
      '2 tbsp pumpkin seeds',
      '2 tbsp sunflower seeds'
    ],
    instructions: [
      'Use whole or halved nuts for large beaks',
      'Cut dried fruits into larger chunks',
      'Mix all ingredients',
      'Store in large airtight container',
      'Serve 1/4 cup per large macaw daily',
      'Monitor for selective eating',
      'Supplement with fresh vegetables and fruits'
    ]
  }
];

export default function BirdsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = ['All', 'Parrots', 'Canaries', 'Finches', 'Budgies', 'Cockatiels', 'Lovebirds', 'Conures', 'Macaws'];

  const filteredRecipes = useMemo(() => {
    return birdRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          recipe.badges.some(b => b.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !selectedCategory || selectedCategory === 'All' || recipe.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-sky-50">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-sky-600 text-white shadow-lg">
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
      <div className="bg-gradient-to-br from-cyan-600 via-blue-600 to-sky-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <Bird className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-5xl font-bold mb-2">Bird Food Recipes</h1>
              <p className="text-xl text-cyan-100">Nutritious seed mixes, fruits, and treats for your feathered friends</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Leaf className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">8</div>
              <div className="text-sm text-cyan-100">Recipes</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Clock className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">10-25min</div>
              <div className="text-sm text-cyan-100">Prep Time</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Target className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">All Species</div>
              <div className="text-sm text-cyan-100">Bird Types</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Shield className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">Fresh & Safe</div>
              <div className="text-sm text-cyan-100">Quality Ingredients</div>
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
              className="pl-10 bg-white border-cyan-200 focus:border-cyan-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat || (!selectedCategory && cat === 'All') ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={selectedCategory === cat || (!selectedCategory && cat === 'All') 
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                  : 'border-cyan-200 hover:border-cyan-400'}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* SAFETY TIPS */}
        <Card className="mb-8 border-cyan-200 bg-cyan-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-900">
              <Shield className="h-5 w-5" />
              Important Safety Tips for Birds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-cyan-800">
              <div>
                <div className="font-semibold mb-2">✓ Safe for Birds:</div>
                <ul className="space-y-1 ml-4">
                  <li>• Fresh fruits (apples, berries, mango, papaya)</li>
                  <li>• Fresh vegetables (carrots, broccoli, spinach)</li>
                  <li>• Seeds (millet, sunflower, pumpkin, flax)</li>
                  <li>• Nuts (almonds, walnuts, cashews - unsalted)</li>
                  <li>• Grains (oats, quinoa, brown rice)</li>
                  <li>• Flowers (hibiscus, rose petals, dandelion)</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2 text-red-700">✗ Toxic for Birds:</div>
                <ul className="space-y-1 ml-4 text-red-700">
                  <li>• Avocado (highly toxic)</li>
                  <li>• Chocolate, caffeine, alcohol</li>
                  <li>• Salt, sugar (in large amounts)</li>
                  <li>• Onions, garlic, chives</li>
                  <li>• Apple seeds, cherry pits, peach pits</li>
                  <li>• Raw beans, mushrooms</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
              <p className="text-sm text-blue-900 font-semibold">
                ⚠️ IMPORTANT: Remove all fruit pits and apple seeds before feeding. Always provide fresh water. Avoid teflon/non-stick cookware around birds (toxic fumes).
              </p>
            </div>
            <p className="mt-3 text-xs text-cyan-700 italic">
              Different bird species have different nutritional needs. Consult an avian veterinarian for species-specific dietary requirements.
            </p>
          </CardContent>
        </Card>

        {/* RECIPES GRID */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredRecipes.map((recipe) => (
            <Card key={recipe.id} className="group hover:shadow-xl transition-all duration-300 border-cyan-200 hover:border-cyan-400 overflow-hidden">
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={recipe.image} 
                  alt={recipe.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute top-3 right-3 flex flex-col gap-2">
                  {recipe.badges.slice(0, 2).map((badge) => (
                    <Badge key={badge} className="bg-cyan-600 text-white">
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
                        <Bird className="h-4 w-4" />
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
                  <div className="bg-cyan-50 rounded p-2">
                    <div className="text-xs text-gray-600">Calories</div>
                    <div className="font-bold text-cyan-700">{recipe.calories}</div>
                  </div>
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-xs text-gray-600">Protein</div>
                    <div className="font-bold text-blue-700">{recipe.protein}g</div>
                  </div>
                  <div className="bg-cyan-50 rounded p-2">
                    <div className="text-xs text-gray-600">Fat</div>
                    <div className="font-bold text-cyan-700">{recipe.fat}g</div>
                  </div>
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-xs text-gray-600">Carbs</div>
                    <div className="font-bold text-blue-700">{recipe.carbs}g</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
                    View Recipe
                  </Button>
                  <Button variant="outline" size="icon" className="border-cyan-200 hover:border-cyan-400">
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* SISTER PAGES NAVIGATION */}
        <Card className="mb-8 border-cyan-200 bg-gradient-to-br from-white to-cyan-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-900">
              <Home className="h-5 w-5" />
              Explore Other Pet Food Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sisterPetFoodPages.map((page) => {
                const Icon = page.icon;
                const isActive = page.id === 'birds';
                return (
                  <Link key={page.id} href={page.path}>
                    <Card className={`cursor-pointer transition-all hover:shadow-lg ${
                      isActive 
                        ? 'border-2 border-cyan-500 bg-cyan-50' 
                        : 'border-gray-200 hover:border-cyan-300'
                    }`}>
                      <CardContent className="p-4 text-center">
                        <Icon className={`h-8 w-8 mx-auto mb-2 ${
                          isActive ? 'text-cyan-600' : 'text-gray-600'
                        }`} />
                        <div className={`font-semibold mb-1 ${
                          isActive ? 'text-cyan-900' : 'text-gray-900'
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
        <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-900">
              <Award className="h-5 w-5" />
              Your Bird Food Journey
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-cyan-900">Recipes Tried</span>
                  <span className="text-sm font-bold text-cyan-700">4/8</span>
                </div>
                <div className="w-full bg-cyan-200 rounded-full h-2">
                  <div className="bg-gradient-to-r from-cyan-600 to-blue-600 h-2 rounded-full" style={{ width: '50%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-cyan-900">Bird Level</span>
                  <span className="text-sm font-bold text-cyan-700">Level 2</span>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-cyan-600" />
                  <span className="text-xs text-gray-600">Halfway to Level 3!</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-cyan-900">Achievements</span>
                  <span className="text-sm font-bold text-cyan-700">3</span>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-cyan-600">First Mix</Badge>
                  <Badge className="bg-blue-600">Variety</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
