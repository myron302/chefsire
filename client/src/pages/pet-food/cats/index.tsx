import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Cat, Dog, Bird, Rabbit,
  Clock, Heart, Target, Fish, Shield, 
  Search, Share2, ArrowLeft, Home, Award, Crown, Sparkles,
  Check, Clipboard, RotateCcw
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

const catRecipes = [
  {
    id: 'kitten-chicken-feast',
    name: 'Kitten Growth Formula',
    category: 'Kitten',
    prepTime: 20,
    servings: 3,
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 428,
    image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800',
    calories: 385,
    protein: 35,
    fat: 18,
    carbs: 12,
    taurine: 'High',
    badges: ['High Protein', 'Taurine-Rich', 'Kitten'],
    ingredients: ['1.5 lbs chicken thighs (with skin)', '4 oz chicken liver', '2 oz chicken heart', '0.25 cups bone broth', '2 tbsp fish oil', '1 tsp taurine supplement', '0.5 tsp calcium powder'],
    instructions: [
      'Bake chicken thighs at 375°F until fully cooked',
      'Sauté liver and heart until cooked through',
      'Remove bones and chop meat finely',
      'Combine all meats in food processor',
      'Add bone broth and pulse to desired consistency',
      'Mix in fish oil, taurine, and calcium',
      'Store in small portions, refrigerate up to 3 days'
    ]
  },
  {
    id: 'adult-salmon-dinner',
    name: 'Adult Salmon & Tuna Bowl',
    category: 'Adult',
    prepTime: 25,
    servings: 4,
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 612,
    image: 'https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=800',
    calories: 360,
    protein: 32,
    fat: 16,
    carbs: 8,
    taurine: 'Very High',
    badges: ['High Protein', 'Omega-3', 'Adult'],
    ingredients: ['1 lb fresh salmon', '8 oz canned tuna in water', '4 oz turkey liver', '1 egg, hard boiled', '2 tbsp olive oil', '1 tsp taurine supplement', '0.5 cups pumpkin puree'],
    instructions: [
      'Bake salmon until flaky, remove any bones',
      'Cook turkey liver thoroughly',
      'Hard boil egg, remove shell',
      'Combine salmon, tuna (drained), and liver',
      'Chop egg and mix in',
      'Add pumpkin puree for fiber',
      'Mix in olive oil and taurine supplement'
    ]
  },
  {
    id: 'senior-gentle-turkey',
    name: 'Senior Gentle Turkey Care',
    category: 'Senior',
    prepTime: 30,
    servings: 3,
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 389,
    image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800',
    calories: 320,
    protein: 30,
    fat: 14,
    carbs: 10,
    taurine: 'High',
    badges: ['Senior', 'Easy Digest', 'Kidney Support'],
    ingredients: ['1.5 lbs ground turkey', '4 oz turkey liver', '0.5 cups cooked white rice', '2 tbsp bone broth', '1 tbsp salmon oil', '1 tsp taurine supplement', '0.25 tsp omega-3 powder'],
    instructions: [
      'Cook ground turkey until well done',
      'Sauté liver until cooked through',
      'Cook rice until very soft',
      'Combine turkey, liver, and rice',
      'Add bone broth for moisture',
      'Mix in salmon oil, taurine, and omega-3',
      'Ensure texture is easy to chew and digest'
    ]
  },
  {
    id: 'high-protein-beef',
    name: 'High Protein Beef Power',
    category: 'Special Diet',
    prepTime: 25,
    servings: 4,
    difficulty: 'Medium',
    rating: 4.7,
    reviews: 334,
    image: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=800',
    calories: 395,
    protein: 38,
    fat: 20,
    carbs: 6,
    taurine: 'Very High',
    badges: ['Very High Protein', 'Low Carb', 'Muscle Building'],
    ingredients: ['1.5 lbs lean ground beef', '6 oz beef heart', '4 oz beef liver', '2 eggs', '3 tbsp beef tallow', '2 tsp taurine supplement', '1 tsp vitamin E'],
    instructions: [
      'Brown ground beef thoroughly',
      'Cook heart and liver until done',
      'Scramble eggs',
      'Chop heart and liver into small pieces',
      'Combine all ingredients',
      'Mix in tallow while warm',
      'Add taurine and vitamin E supplements'
    ]
  },
  {
    id: 'low-carb-chicken',
    name: 'Low Carb Chicken Medley',
    category: 'Special Diet',
    prepTime: 30,
    servings: 4,
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 267,
    image: 'https://images.unsplash.com/photo-1615789591457-74a63395c990?w=800',
    calories: 350,
    protein: 34,
    fat: 17,
    carbs: 4,
    taurine: 'High',
    badges: ['Low Carb', 'Diabetic-Friendly', 'Weight Control'],
    ingredients: ['1.5 lbs chicken breast and thighs', '4 oz chicken liver', '2 oz chicken heart', '0.25 cups zucchini, finely diced', '2 tbsp coconut oil', '1.5 tsp taurine supplement', '0.5 tsp psyllium husk'],
    instructions: [
      'Cook chicken pieces until done',
      'Sauté liver and heart',
      'Steam zucchini until soft',
      'Chop all meats to appropriate size',
      'Combine with zucchini',
      'Mix in coconut oil and taurine',
      'Add psyllium husk for gentle fiber'
    ]
  },
  {
    id: 'hairball-control',
    name: 'Hairball Control Formula',
    category: 'Special Diet',
    prepTime: 25,
    servings: 4,
    difficulty: 'Easy',
    rating: 4.6,
    reviews: 298,
    image: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=800',
    calories: 340,
    protein: 31,
    fat: 15,
    carbs: 12,
    taurine: 'High',
    badges: ['Hairball Control', 'High Fiber', 'Indoor Cats'],
    ingredients: ['1.5 lbs white fish (cod or tilapia)', '4 oz turkey', '0.5 cups pumpkin puree', '2 tbsp psyllium husk', '2 tbsp fish oil', '1 tsp taurine supplement', '0.5 cups cooked oat bran'],
    instructions: [
      'Bake fish until flaky',
      'Cook turkey thoroughly',
      'Cook oat bran with extra water',
      'Combine fish and turkey',
      'Mix in pumpkin puree and oat bran for fiber',
      'Add psyllium husk',
      'Stir in fish oil and taurine'
    ]
  },
  {
    id: 'urinary-health',
    name: 'Urinary Health Support',
    category: 'Special Diet',
    prepTime: 30,
    servings: 3,
    difficulty: 'Medium',
    rating: 4.9,
    reviews: 412,
    image: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=800',
    calories: 330,
    protein: 33,
    fat: 16,
    carbs: 8,
    taurine: 'Very High',
    badges: ['Urinary Health', 'High Moisture', 'pH Balanced'],
    ingredients: ['1 lb chicken breast', '6 oz white fish', '4 oz chicken liver', '0.5 cups bone broth (extra for moisture)', '1 tbsp cranberry powder', '2 tsp taurine supplement', '1 tsp vitamin C'],
    instructions: [
      'Poach chicken breast in water',
      'Steam white fish',
      'Cook liver thoroughly',
      'Shred all proteins finely',
      'Add extra bone broth for high moisture content',
      'Mix in cranberry powder for urinary support',
      'Add taurine and vitamin C supplements'
    ]
  },
  {
    id: 'sensitive-stomach',
    name: 'Sensitive Stomach Soother',
    category: 'Special Diet',
    prepTime: 35,
    servings: 3,
    difficulty: 'Easy',
    rating: 4.7,
    reviews: 245,
    image: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=800',
    calories: 310,
    protein: 29,
    fat: 13,
    carbs: 14,
    taurine: 'High',
    badges: ['Limited Ingredient', 'Easy Digest', 'Sensitive Stomach'],
    ingredients: ['1.5 lbs ground turkey (lean)', '0.5 cups sweet potato, well cooked', '2 tbsp bone broth', '1 tbsp pumpkin puree', '1 tbsp turkey fat', '1.5 tsp taurine supplement', '0.5 tsp probiotics'],
    instructions: [
      'Cook turkey very thoroughly',
      'Bake sweet potato until very soft, mash well',
      'Combine turkey and sweet potato',
      'Mix in bone broth and pumpkin',
      'Add turkey fat for essential fatty acids',
      'Stir in taurine supplement',
      'Add probiotics after cooling to room temperature'
    ]
  }
];

export default function CatsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const categories = ['All', 'Kitten', 'Adult', 'Senior', 'Special Diet'];

  // Convert recipes to RecipeKit format
  const recipesWithMeasurements = useMemo(() => {
    return catRecipes.map((recipe) => {
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
    const text = `${recipe.name} - Cat Food Recipe\nTaurine: ${recipe.taurine}`;
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-fuchsia-50">
      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="purple"
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
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-fuchsia-600 text-white shadow-lg">
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
      <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-fuchsia-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <Cat className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-5xl font-bold mb-2">Cat Food Recipes</h1>
              <p className="text-xl text-purple-100">High-protein, taurine-rich meals for your feline friend</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Fish className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">8</div>
              <div className="text-sm text-purple-100">Recipes</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Clock className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">20-35min</div>
              <div className="text-sm text-purple-100">Prep Time</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Target className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">All Ages</div>
              <div className="text-sm text-purple-100">Life Stages</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Shield className="h-8 w-8 mb-2" />
              <div className="text-2xl font-bold">Taurine+</div>
              <div className="text-sm text-purple-100">Essential Amino Acid</div>
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
              className="pl-10 bg-white border-purple-200 focus:border-purple-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat || (!selectedCategory && cat === 'All') ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={selectedCategory === cat || (!selectedCategory && cat === 'All') 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'border-purple-200 hover:border-purple-400'}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* SAFETY TIPS */}
        <Card className="mb-8 border-purple-200 bg-purple-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <Shield className="h-5 w-5" />
              Important Safety Tips for Cats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-purple-800">
              <div>
                <div className="font-semibold mb-2">✓ Safe for Cats:</div>
                <ul className="space-y-1 ml-4">
                  <li>• Chicken, turkey, beef (cooked)</li>
                  <li>• Fish (salmon, tuna, white fish)</li>
                  <li>• Liver and heart (in moderation)</li>
                  <li>• Eggs (cooked)</li>
                  <li>• Small amounts of pumpkin, zucchini</li>
                  <li>• MUST include taurine supplement</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2 text-red-700">✗ Toxic for Cats:</div>
                <ul className="space-y-1 ml-4 text-red-700">
                  <li>• Onions, garlic, chives, leeks</li>
                  <li>• Grapes, raisins</li>
                  <li>• Chocolate, caffeine, alcohol</li>
                  <li>• Xylitol (artificial sweetener)</li>
                  <li>• Raw dough, bones</li>
                  <li>• Lilies and many houseplants</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-3 bg-pink-100 rounded-lg border border-pink-300">
              <p className="text-sm text-pink-900 font-semibold">
                ⚠️ CRITICAL: Cats require TAURINE in their diet - they cannot produce it themselves. All homemade cat food MUST include taurine supplements or your cat will develop serious health problems.
              </p>
            </div>
            <p className="mt-3 text-xs text-purple-700 italic">
              Consult your veterinarian before switching to homemade food. Cats are obligate carnivores and need meat-based diets with proper supplements.
            </p>
          </CardContent>
        </Card>

        {/* RECIPES GRID */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredRecipes.map((recipe) => {
            const useMetric = !!metricFlags[recipe.id];
            const servings = servingsById[recipe.id] ?? recipe.servings;

            return (
              <Card key={recipe.id} className="group hover:shadow-xl transition-all duration-300 border-purple-200 hover:border-purple-400 overflow-hidden">
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={recipe.image} 
                    alt={recipe.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    {recipe.badges.slice(0, 2).map((badge) => (
                      <Badge key={badge} className="bg-purple-600 text-white">
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
                          <Cat className="h-4 w-4" />
                          {recipe.servings} cups
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CAT RATING */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Cat
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(recipe.rating)
                              ? 'fill-purple-500 text-purple-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="font-medium ml-1">{recipe.rating}</span>
                      <span className="text-gray-500 text-sm">({recipe.reviews})</span>
                    </div>
                  </div>

                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-2 mb-4">
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-pink-600" />
                      <span className="font-semibold text-pink-900">Taurine: {recipe.taurine}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                    <div className="bg-purple-50 rounded p-2">
                      <div className="text-xs text-gray-600">Calories</div>
                      <div className="font-bold text-purple-700">{recipe.calories}</div>
                    </div>
                    <div className="bg-pink-50 rounded p-2">
                      <div className="text-xs text-gray-600">Protein</div>
                      <div className="font-bold text-pink-700">{recipe.protein}g</div>
                    </div>
                    <div className="bg-purple-50 rounded p-2">
                      <div className="text-xs text-gray-600">Fat</div>
                      <div className="font-bold text-purple-700">{recipe.fat}g</div>
                    </div>
                    <div className="bg-pink-50 rounded p-2">
                      <div className="text-xs text-gray-600">Carbs</div>
                      <div className="font-bold text-pink-700">{recipe.carbs}g</div>
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
                              <Check className="h-4 w-4 text-purple-500 mt-0.5" />
                              <span>
                                <span className="text-purple-600 font-semibold">
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
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      onClick={() => openRecipeModal(recipe)}
                    >
                      View Recipe
                    </Button>
                    <Button variant="outline" size="icon" className="border-purple-200 hover:border-purple-400">
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* SISTER PAGES NAVIGATION */}
        <Card className="mb-8 border-purple-200 bg-gradient-to-br from-white to-purple-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <Home className="h-5 w-5" />
              Explore Other Pet Food Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sisterPetFoodPages.map((page) => {
                const Icon = page.icon;
                const isActive = page.id === 'cats';
                return (
                  <Link key={page.id} href={page.path}>
                    <Card className={`cursor-pointer transition-all hover:shadow-lg ${
                      isActive 
                        ? 'border-2 border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-purple-300'
                    }`}>
                      <CardContent className="p-4 text-center">
                        <Icon className={`h-8 w-8 mx-auto mb-2 ${
                          isActive ? 'text-purple-600' : 'text-gray-600'
                        }`} />
                        <div className={`font-semibold mb-1 ${
                          isActive ? 'text-purple-900' : 'text-gray-900'
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
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <Award className="h-5 w-5" />
              Your Cat Food Journey
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-900">Recipes Tried</span>
                  <span className="text-sm font-bold text-purple-700">2/8</span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full" style={{ width: '25%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-900">Cat Level</span>
                  <span className="text-sm font-bold text-purple-700">Level 1</span>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-purple-600" />
                  <span className="text-xs text-gray-600">Keep cooking to reach Level 2!</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-900">Achievements</span>
                  <span className="text-sm font-bold text-purple-700">1</span>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-purple-600">First Meal</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
