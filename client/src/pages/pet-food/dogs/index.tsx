import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dog, Cat, Bird, Rabbit,
  Clock, Heart, Target, Bone, Shield, 
  Search, Share2, ArrowLeft, Home, Award, Crown,
  Check, Clipboard, RotateCcw, Plus
} from 'lucide-react';
import RecipeKit from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));
const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = { 0: '', 1: '¼', 2: '½', 3: '¾' };
  const fracStr = fracMap[frac];
  if (!whole && fracStr) return fracStr;
  if (whole && fracStr) return `${whole} ${fracStr}`;
  return `${whole}`;
};
const scaleAmount = (baseAmount: number | string, servings: number) => {
  const n = typeof baseAmount === 'number' ? baseAmount : parseFloat(String(baseAmount));
  if (Number.isNaN(n)) return baseAmount;
  return toNiceFraction(n * servings);
};

const toMetric = (unit: string, amount: number) => {
  const gramsPerCup = 240;
  const gramsPerTbsp = 15;
  const gramsPerTsp = 5;
  switch (unit) {
    case 'cup':
    case 'cups': return { amount: Math.round(amount * gramsPerCup), unit: 'g' };
    case 'tbsp': return { amount: Math.round(amount * gramsPerTbsp), unit: 'g' };
    case 'tsp': return { amount: Math.round(amount * gramsPerTsp), unit: 'g' };
    case 'lb':
    case 'lbs': return { amount: Math.round(amount * 453.592), unit: 'g' };
    case 'oz': return { amount: Math.round(amount * 28.35), unit: 'g' };
    default: return { amount, unit };
  }
};

const parseIngredient = (ingredient: string): Measured => {
  const parts = ingredient.trim().split(/\s+/);
  if (parts.length < 2) return m(1, 'item', ingredient);

  let amountStr = parts[0];
  let amount: number | string = isNaN(Number(amountStr)) ? amountStr : Number(amountStr);

  let unit = parts[1];
  let item = parts.slice(2).join(' ');

  if (item.includes('(optional)')) {
    item = item.replace('(optional)', '').trim();
    return m(amount, unit, item, 'optional');
  }
  
  return m(amount, unit, item);
};

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
    prepTime: 25,
    servings: 4,
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 342,
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800',
    calories: 425,
    protein: 28,
    fat: 15,
    carbs: 42,
    badges: ['High Protein', 'Grain-Inclusive', 'Puppy'],
    ingredients: ['2 lbs ground chicken breast', '2 cups brown rice', '1 cup sweet potato, diced', '1 cup carrots, finely chopped', '0.5 cups green beans', '2 tbsp fish oil', '1 tsp calcium powder'],
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
    prepTime: 30,
    servings: 6,
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 567,
    image: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=800',
    calories: 380,
    protein: 25,
    fat: 12,
    carbs: 38,
    badges: ['Balanced', 'Adult', 'Heart Health'],
    ingredients: ['2 lbs lean ground beef', '2 cups quinoa', '1 cup pumpkin puree', '1 cup spinach, chopped', '0.5 cups blueberries', '2 eggs, hard boiled', '1 tbsp coconut oil'],
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
    prepTime: 35,
    servings: 5,
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 423,
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800',
    calories: 320,
    protein: 22,
    fat: 10,
    carbs: 35,
    badges: ['Senior', 'Easy Digest', 'Joint Support'],
    ingredients: ['2 lbs ground turkey', '2 cups white rice', '1 cup zucchini, finely diced', '0.5 cups cottage cheese', '0.25 cups bone broth', '1 tbsp glucosamine powder', '1 tsp turmeric'],
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
    prepTime: 30,
    servings: 5,
    difficulty: 'Medium',
    rating: 4.7,
    reviews: 289,
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    calories: 395,
    protein: 30,
    fat: 18,
    carbs: 28,
    badges: ['Grain-Free', 'Omega-3', 'Skin & Coat'],
    ingredients: ['2 lbs fresh salmon fillet', '2 cups sweet potato', '1 cup green peas', '0.5 cups carrots', '0.25 cups flaxseed meal', '2 tbsp olive oil', '1 tsp kelp powder'],
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
    prepTime: 25,
    servings: 6,
    difficulty: 'Easy',
    rating: 4.6,
    reviews: 234,
    image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800',
    calories: 285,
    protein: 26,
    fat: 8,
    carbs: 30,
    badges: ['Low Fat', 'High Fiber', 'Weight Management'],
    ingredients: ['2 lbs chicken breast', '2 cups green beans', '1 cup broccoli', '1 cup cauliflower', '1 cup pumpkin puree', '0.5 cups oat bran', '1 tbsp fish oil'],
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
    prepTime: 35,
    servings: 5,
    difficulty: 'Medium',
    rating: 4.8,
    reviews: 198,
    image: 'https://images.unsplash.com/photo-1546527868-ccb7ee7dfa6a?w=800',
    calories: 405,
    protein: 27,
    fat: 16,
    carbs: 36,
    badges: ['Limited Ingredient', 'Novel Protein', 'Allergy-Friendly'],
    ingredients: ['2 lbs ground lamb', '2 cups white potato', '1 cup parsnips', '0.5 cups pears, diced', '2 tbsp sunflower oil', '1 tsp zinc supplement', '1 tsp vitamin E'],
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
    prepTime: 30,
    servings: 6,
    difficulty: 'Medium',
    rating: 4.9,
    reviews: 276,
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800',
    calories: 485,
    protein: 32,
    fat: 20,
    carbs: 45,
    badges: ['High Energy', 'Performance', 'Working Dogs'],
    ingredients: ['2 lbs beef heart', '2 cups oatmeal', '1 cup liver', '1 cup sweet potato', '3 eggs', '0.25 cups coconut oil', '2 tbsp blackstrap molasses'],
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
    prepTime: 40,
    servings: 4,
    difficulty: 'Medium',
    rating: 4.7,
    reviews: 167,
    image: 'https://images.unsplash.com/photo-1534351450181-ea9f78427fe8?w=800',
    calories: 360,
    protein: 24,
    fat: 14,
    carbs: 32,
    badges: ['Dental Health', 'Crunchy', 'Fresh Breath'],
    ingredients: ['2 lbs ground turkey', '1 cup carrots, large chunks', '1 cup apples, sliced thick', '0.5 cups parsley', '0.25 cups mint leaves', '1 cup rolled oats', '2 tbsp coconut oil'],
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
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const categories = ['All', 'Puppy', 'Adult', 'Senior', 'Special Diet'];

  // Convert recipes to RecipeKit format
  const recipesWithMeasurements = useMemo(() => {
    return dogRecipes.map((recipe) => {
      const measurements = recipe.ingredients.map(ing => parseIngredient(ing));
      return {
        ...recipe,
        recipe: {
          servings: recipe.servings,
          measurements,
          directions: recipe.instructions
        }
      };
    });
  }, []);

  const filteredRecipes = useMemo(() => {
    return recipesWithMeasurements.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          recipe.badges.some(b => b.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !selectedCategory || selectedCategory === 'All' || recipe.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, recipesWithMeasurements]);

  const openRecipeModal = (recipe: any) => {
    setSelectedRecipe(recipe);
    setShowKit(true);
  };

  const handleCompleteRecipe = () => {
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const handleShareRecipe = async (recipe: any) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `${recipe.name} - Dog Food Recipe\n${recipe.description || ''}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.name, text, url });
      } else {
        await navigator.clipboard.writeText(`${recipe.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${recipe.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="amber"
          pointsReward={40}
          onComplete={handleCompleteRecipe}
          item={{
            id: selectedRecipe.id,
            name: selectedRecipe.name,
            prepTime: selectedRecipe.prepTime,
            directions: selectedRecipe.recipe?.directions || [],
            measurements: selectedRecipe.recipe?.measurements || [],
            baseNutrition: {},
            defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1
          }}
        />
      )}

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
          {filteredRecipes.map((recipe) => {
            const useMetric = !!metricFlags[recipe.id];
            const servings = servingsById[recipe.id] ?? recipe.servings;

            return (
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
                          {recipe.prepTime}min
                        </span>
                        <span className="flex items-center gap-1">
                          <Dog className="h-4 w-4" />
                          {recipe.servings} cups
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* DOG RATING */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Dog
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(recipe.rating)
                              ? 'fill-amber-500 text-amber-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="font-medium ml-1">{recipe.rating}</span>
                      <span className="text-gray-500 text-sm">({recipe.reviews})</span>
                    </div>
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

                  {/* RecipeKit Preview */}
                  {recipe.recipe?.measurements && recipe.recipe.measurements.length > 0 && (
                    <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-900">
                          Ingredients (serves {servings})
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 border rounded text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setServingsById(prev => ({ ...prev, [recipe.id]: clamp((prev[recipe.id] ?? recipe.servings) - 1) }));
                            }}
                          >
                            −
                          </button>
                          <div className="min-w-[2ch] text-center text-sm">{servings}</div>
                          <button
                            className="px-2 py-1 border rounded text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setServingsById(prev => ({ ...prev, [recipe.id]: clamp((prev[recipe.id] ?? recipe.servings) + 1) }));
                            }}
                          >
                            +
                          </button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setServingsById(prev => ({ ...prev, [recipe.id]: recipe.servings }));
                            }}
                            title="Reset"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <ul className="text-sm leading-6 text-gray-800 space-y-1">
                        {recipe.recipe.measurements.slice(0, 4).map((ing: Measured, i: number) => {
                          const isNum = typeof ing.amount === 'number';
                          const scaledAmount = isNum ? (ing.amount as number) * servings / recipe.servings : ing.amount;
                          const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings / recipe.servings) : ing.amount;
                          const show = useMetric && isNum
                            ? toMetric(ing.unit, scaledAmount as number)
                            : { amount: scaledDisplay, unit: ing.unit };

                          return (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-amber-500 mt-0.5" />
                              <span>
                                <span className="text-amber-600 font-semibold">
                                  {show.amount} {show.unit}
                                </span>{" "}
                                {ing.item}
                                {ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                              </span>
                            </li>
                          );
                        })}
                        {recipe.recipe.measurements.length > 4 && (
                          <li className="text-xs text-gray-600">
                            …plus {recipe.recipe.measurements.length - 4} more
                          </li>
                        )}
                      </ul>

                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMetricFlags((prev) => ({ ...prev, [recipe.id]: !prev[recipe.id] }));
                          }}
                        >
                          {useMetric ? 'US' : 'Metric'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          handleShareRecipe(recipe);
                        }}>
                          <Share2 className="w-4 h-4 mr-1" /> Share
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                      onClick={() => openRecipeModal(recipe)}
                    >
                      View Recipe
                    </Button>
                    <Button variant="outline" size="icon" className="border-amber-200 hover:border-amber-400">
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
