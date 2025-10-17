import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dog, Cat, Bird, Rabbit,
  Clock, Heart, Target, Bone, Shield, 
  Search, Share2, ArrowLeft, Home,
  Award, Crown, Activity
} from 'lucide-react';

// SISTER PAGES
const sisterPetFoodPages = [
  { id: 'dogs', name: 'Dogs', path: '/pet-food/dogs', icon: Dog, description: 'Puppy to senior' },
  { id: 'cats', name: 'Cats', path: '/pet-food/cats', icon: Cat, description: 'Kitten to senior' },
  { id: 'birds', name: 'Birds', path: '/pet-food/birds', icon: Bird, description: 'Seed & fruit mixes' },
  { id: 'small-pets', name: 'Small Pets', path: '/pet-food/small-pets', icon: Rabbit, description: 'Rabbits & rodents' }
];

const dogRecipes = [
  {
    id: 'puppy-chicken-rice',
    name: 'Puppy Growth Formula',
    category: 'Puppy',
    prepTime: '25 min',
    servings: '4 cups',
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 342,
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800',
    calories: 425,
    protein: 28,
    fat: 15,
    carbs: 42,
    badges: ['High Protein', 'Grain-Inclusive', 'Puppy'],
    ingredients: [
      '2 lbs ground chicken breast',
      '2 cups brown rice',
      '1 cup sweet potato, diced',
      '1 cup carrots, finely chopped',
      '1/2 cup green beans',
      '2 tbsp fish oil',
      '1 tsp calcium powder'
    ],
    instructions: [
      'Cook brown rice according to package directions',
      'Brown ground chicken in large skillet until fully cooked',
      'Steam sweet potato, carrots, and green beans until tender',
      'Combine all ingredients in large bowl',
      'Mix in fish oil and calcium powder',
      'Cool completely before serving',
      'Store in refrigerator up to 4 days or freeze portions'
    ]
  },
  {
    id: 'adult-beef-veggie',
    name: 'Adult Maintenance Bowl',
    category: 'Adult',
    prepTime: '30 min',
    servings: '6 cups',
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 567,
    image: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=800',
    calories: 380,
    protein: 25,
    fat: 12,
    carbs: 38,
    badges: ['Balanced', 'Adult', 'Heart Health'],
    ingredients: [
      '2 lbs lean ground beef',
      '2 cups quinoa',
      '1 cup pumpkin puree',
      '1 cup spinach, chopped',
      '1/2 cup blueberries',
      '2 eggs, hard boiled',
      '1 tbsp coconut oil'
    ],
    instructions: [
      'Cook quinoa according to package directions',
      'Brown ground beef, drain excess fat',
      'Hard boil eggs, cool and chop',
      'Mix cooked beef with quinoa',
      'Fold in pumpkin puree and coconut oil',
      'Add spinach, blueberries, and chopped eggs',
      'Serve at room temperature'
    ]
  },
  {
    id: 'senior-turkey-gentle',
    name: 'Senior Gentle Digest',
    category: 'Senior',
    prepTime: '35 min',
    servings: '5 cups',
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 423,
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800',
    calories: 320,
    protein: 22,
    fat: 10,
    carbs: 35,
    badges: ['Senior', 'Easy Digest', 'Joint Support'],
    ingredients: [
      '2 lbs ground turkey',
      '2 cups white rice',
      '1 cup zucchini, finely diced',
      '1/2 cup cottage cheese',
      '1/4 cup bone broth',
      '1 tbsp glucosamine powder',
      '1 tsp turmeric'
    ],
    instructions: [
      'Cook white rice until very soft',
      'Cook ground turkey thoroughly',
      'Steam zucchini until very tender',
      'Combine turkey, rice, and zucchini',
      'Mix in cottage cheese and bone broth',
      'Add glucosamine and turmeric',
      'Ensure all pieces are small and easy to chew'
    ]
  },
  {
    id: 'grain-free-salmon',
    name: 'Grain-Free Salmon Power',
    category: 'Special Diet',
    prepTime: '30 min',
    servings: '5 cups',
    difficulty: 'Medium',
    rating: 4.7,
    reviews: 289,
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    calories: 395,
    protein: 30,
    fat: 18,
    carbs: 28,
    badges: ['Grain-Free', 'Omega-3', 'Skin & Coat'],
    ingredients: [
      '2 lbs fresh salmon fillet',
      '2 cups sweet potato',
      '1 cup green peas',
      '1/2 cup carrots',
      '1/4 cup flaxseed meal',
      '2 tbsp olive oil',
      '1 tsp kelp powder'
    ],
    instructions: [
      'Bake salmon at 375°F until cooked through',
      'Boil sweet potato until fork-tender',
      'Steam peas and carrots',
      'Flake cooked salmon, remove any bones',
      'Mash sweet potato',
      'Combine all ingredients',
      'Mix in flaxseed meal, olive oil, and kelp'
    ]
  },
  {
    id: 'weight-management',
    name: 'Lean & Green Weight Loss',
    category: 'Special Diet',
    prepTime: '25 min',
    servings: '6 cups',
    difficulty: 'Easy',
    rating: 4.6,
    reviews: 234,
    image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800',
    calories: 285,
    protein: 26,
    fat: 8,
    carbs: 30,
    badges: ['Low Fat', 'High Fiber', 'Weight Management'],
    ingredients: [
      '2 lbs chicken breast',
      '2 cups green beans',
      '1 cup broccoli',
      '1 cup cauliflower',
      '1 cup pumpkin puree',
      '1/2 cup oat bran',
      '1 tbsp fish oil'
    ],
    instructions: [
      'Boil chicken breast until fully cooked',
      'Steam all vegetables until tender',
      'Chop chicken into small pieces',
      'Combine chicken with vegetables',
      'Mix in pumpkin puree and oat bran',
      'Add fish oil for essential fatty acids',
      'Portion according to weight loss plan'
    ]
  },
  {
    id: 'allergy-sensitive',
    name: 'Allergy-Friendly Lamb',
    category: 'Special Diet',
    prepTime: '35 min',
    servings: '5 cups',
    difficulty: 'Medium',
    rating: 4.8,
    reviews: 198,
    image: 'https://images.unsplash.com/photo-1546527868-ccb7ee7dfa6a?w=800',
    calories: 405,
    protein: 27,
    fat: 16,
    carbs: 36,
    badges: ['Limited Ingredient', 'Novel Protein', 'Allergy-Friendly'],
    ingredients: [
      '2 lbs ground lamb',
      '2 cups white potato',
      '1 cup parsnips',
      '1/2 cup pears, diced',
      '2 tbsp sunflower oil',
      '1 tsp zinc supplement',
      '1 tsp vitamin E'
    ],
    instructions: [
      'Cook ground lamb thoroughly',
      'Boil white potato and parsnips until soft',
      'Dice pears into small pieces',
      'Combine lamb with cooked vegetables',
      'Mix in sunflower oil',
      'Add supplements as directed',
      'Cool before serving'
    ]
  },
  {
    id: 'high-energy-athlete',
    name: 'Athlete Performance Fuel',
    category: 'Special Diet',
    prepTime: '30 min',
    servings: '6 cups',
    difficulty: 'Medium',
    rating: 4.9,
    reviews: 276,
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800',
    calories: 485,
    protein: 32,
    fat: 20,
    carbs: 45,
    badges: ['High Energy', 'Performance', 'Working Dogs'],
    ingredients: [
      '2 lbs beef heart',
      '2 cups oatmeal',
      '1 cup liver',
      '1 cup sweet potato',
      '3 eggs',
      '1/4 cup coconut oil',
      '2 tbsp blackstrap molasses'
    ],
    instructions: [
      'Cook beef heart and liver until done',
      'Prepare oatmeal with extra water',
      'Bake sweet potato',
      'Scramble eggs',
      'Chop meats into appropriate sizes',
      'Combine all ingredients',
      'Mix in coconut oil and molasses for energy'
    ]
  },
  {
    id: 'dental-health',
    name: 'Dental Health Crunch',
    category: 'Special Diet',
    prepTime: '40 min',
    servings: '4 cups',
    difficulty: 'Medium',
    rating: 4.7,
    reviews: 167,
    image: 'https://images.unsplash.com/photo-1534351450181-ea9f78427fe8?w=800',
    calories: 360,
    protein: 24,
    fat: 14,
    carbs: 32,
    badges: ['Dental Health', 'Crunchy', 'Fresh Breath'],
    ingredients: [
      '2 lbs ground turkey',
      '1 cup carrots, large chunks',
      '1 cup apples, sliced thick',
      '1/2 cup parsley',
      '1/4 cup mint leaves',
      '1 cup rolled oats',
      '2 tbsp coconut oil'
    ],
    instructions: [
      'Form turkey into small meatballs, bake until done',
      'Cut carrots and apples into chewable chunks',
      'Mix in fresh parsley and mint',
      'Combine with cooked oats',
      'Add coconut oil',
      'Serve with crunchy elements for teeth cleaning',
      'Supervise eating to ensure proper chewing'
    ]
  }
];

export default function DogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = ['All', 'Puppy', 'Adult', 'Senior', 'Special Diet'];

  const filteredRecipes = useMemo(() => {
    return dogRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          recipe.badges.some(b => b.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !selectedCategory || selectedCategory === 'All' || recipe.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg">
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
      <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <Dog className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-5xl font-bold mb-2">Dog Food Recipes</h1>
              <p className="text-xl text-amber-100">Nutritious homemade meals for your best friend</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Bone className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">8</div>
              <div className="text-sm text-amber-100">Recipes</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Clock className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">25-40min</div>
              <div className="text-sm text-amber-100">Prep Time</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Target className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">All Ages</div>
              <div className="text-sm text-amber-100">Life Stages</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Shield className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">Vet-Approved</div>
              <div className="text-sm text-amber-100">Safe & Balanced</div>
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
              className="pl-10 bg-white border-amber-200 focus:border-amber-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat || (!selectedCategory && cat === 'All') ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={selectedCategory === cat || (!selectedCategory && cat === 'All') 
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
                  : 'border-amber-200 hover:border-amber-400'}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* SAFETY TIPS */}
        <Card className="mb-8 border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Shield className="h-5 w-5" />
              Important Safety Tips for Dogs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-amber-800">
              <div>
                <div className="font-semibold mb-2">✓ Safe for Dogs:</div>
                <ul className="space-y-1 ml-4">
                  <li>• Lean meats (chicken, turkey, beef, lamb)</li>
                  <li>• Fish (salmon, sardines)</li>
                  <li>• Rice, oats, quinoa</li>
                  <li>• Sweet potato, pumpkin, carrots</li>
                  <li>• Blueberries, apples (no seeds)</li>
                  <li>• Green beans, broccoli, spinach</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2 text-red-700">✗ Toxic for Dogs:</div>
                <ul className="space-y-1 ml-4 text-red-700">
                  <li>• Chocolate, caffeine, alcohol</li>
                  <li>• Grapes, raisins, currants</li>
                  <li>• Onions, garlic, chives, leeks</li>
                  <li>• Xylitol (artificial sweetener)</li>
                  <li>• Macadamia nuts, walnuts</li>
                  <li>• Avocado, raw dough, cooked bones</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-xs text-amber-700 italic">
              Always consult your veterinarian before switching to homemade food. Ensure calcium and vitamin supplements are added as needed.
            </p>
          </CardContent>
        </Card>

        {/* RECIPES GRID */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredRecipes.map((recipe) => (
            <Card key={recipe.id} className="group hover:shadow-xl transition-all duration-300 border-amber-200 hover:border-amber-400 overflow-hidden">
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={recipe.image} 
                  alt={recipe.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute top-3 right-3 flex gap-2">
                  {recipe.badges.slice(0, 2).map((badge) => (
                    <Badge key={badge} className="bg-amber-600 text-white">
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
                        <Dog className="h-4 w-4" />
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
                  <div className="bg-amber-50 rounded p-2">
                    <div className="text-xs text-gray-600">Calories</div>
                    <div className="font-bold text-amber-700">{recipe.calories}</div>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <div className="text-xs text-gray-600">Protein</div>
                    <div className="font-bold text-orange-700">{recipe.protein}g</div>
                  </div>
                  <div className="bg-amber-50 rounded p-2">
                    <div className="text-xs text-gray-600">Fat</div>
                    <div className="font-bold text-amber-700">{recipe.fat}g</div>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <div className="text-xs text-gray-600">Carbs</div>
                    <div className="font-bold text-orange-700">{recipe.carbs}g</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">
                    View Recipe
                  </Button>
                  <Button variant="outline" size="icon" className="border-amber-200 hover:border-amber-400">
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* SISTER PAGES NAVIGATION */}
        <Card className="mb-8 border-amber-200 bg-gradient-to-br from-white to-amber-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Home className="h-5 w-5" />
              Explore Other Pet Food Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sisterPetFoodPages.map((page) => {
                const Icon = page.icon;
                const isActive = page.id === 'dogs';
                return (
                  <Link key={page.id} href={page.path}>
                    <Card className={`cursor-pointer transition-all hover:shadow-lg ${
                      isActive 
                        ? 'border-2 border-amber-500 bg-amber-50' 
                        : 'border-gray-200 hover:border-amber-300'
                    }`}>
                      <CardContent className="p-4 text-center">
                        <Icon className={`h-8 w-8 mx-auto mb-2 ${
                          isActive ? 'text-amber-600' : 'text-gray-600'
                        }`} />
                        <div className={`font-semibold mb-1 ${
                          isActive ? 'text-amber-900' : 'text-gray-900'
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
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Award className="h-5 w-5" />
              Your Dog Food Journey
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-900">Recipes Tried</span>
                  <span className="text-sm font-bold text-amber-700">3/8</span>
                </div>
                <div className="w-full bg-amber-200 rounded-full h-2">
                  <div className="bg-gradient-to-r from-amber-600 to-orange-600 h-2 rounded-full" style={{ width: '37.5%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-900">Dog Level</span>
                  <span className="text-sm font-bold text-amber-700">Level 2</span>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-600" />
                  <span className="text-xs text-gray-600">Keep cooking to reach Level 3!</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-900">Achievements</span>
                  <span className="text-sm font-bold text-amber-700">2</span>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-amber-600">First Recipe</Badge>
                  <Badge className="bg-orange-600">Puppy Pro</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
