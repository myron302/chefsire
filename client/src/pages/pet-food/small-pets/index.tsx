import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Bird, Dog, Cat, Rabbit,
  Clock, Heart, Target, Leaf, Shield, 
  Search, Share2, ArrowLeft, Home, Award, Crown,
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

const birdRecipes = [
  {
    id: 'parrot-power-mix',
    name: 'Parrot Power Mix',
    category: 'Parrots',
    prepTime: 15,
    servings: 2,
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 287,
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800',
    calories: 180,
    protein: 12,
    fat: 15,
    carbs: 38,
    badges: ['High Energy', 'Nut-Rich', 'Parrots'],
    ingredients: ['0.5 cups raw almonds', '0.25 cups raw walnuts', '0.25 cups dried papaya', '0.25 cups dried mango', '2 tbsp sunflower seeds', '2 tbsp pumpkin seeds', '1 tbsp chia seeds'],
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
    prepTime: 10,
    servings: 3,
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 342,
    image: 'https://images.unsplash.com/photo-1550670256-6d2e5e8d6f28?w=800',
    calories: 140,
    protein: 14,
    fat: 12,
    carbs: 32,
    badges: ['Seed Mix', 'Singing Support', 'Canaries'],
    ingredients: ['1 cup canary grass seed', '0.5 cups millet (white and red)', '0.25 cups rapeseed', '0.25 cups niger seed', '2 tbsp flax seeds', '2 tbsp hemp seeds', '1 tbsp sesame seeds'],
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
    prepTime: 12,
    servings: 2,
    difficulty: 'Easy',
    rating: 4.7,
    reviews: 198,
    image: 'https://images.unsplash.com/photo-1582845512747-e42001c95638?w=800',
    calories: 125,
    protein: 10,
    fat: 8,
    carbs: 28,
    badges: ['Fruit & Seed', 'Small Birds', 'Finches'],
    ingredients: ['0.5 cups millet', '0.25 cups canary seed', '0.25 cups dried currants', '2 tbsp dried cranberries, chopped', '2 tbsp oat groats', '1 tbsp niger seed', '1 tbsp dried apple, finely diced'],
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
    prepTime: 15,
    servings: 1,
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 423,
    image: 'https://images.unsplash.com/photo-1589666564459-93cdd3ab856a?w=800',
    calories: 95,
    protein: 8,
    fat: 5,
    carbs: 22,
    badges: ['Fresh Veggies', 'Low Fat', 'Budgies'],
    ingredients: ['0.25 cups finely chopped broccoli', '0.25 cups grated carrot', '2 tbsp chopped spinach', '2 tbsp millet', '1 tbsp quinoa (cooked)', '1 tsp sesame seeds', '1 small piece apple (no seeds)'],
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
    prepTime: 20,
    servings: 2,
    difficulty: 'Medium',
    rating: 4.8,
    reviews: 312,
    image: 'https://images.unsplash.com/photo-1563281746-3e5c80b1cd19?w=800',
    calories: 165,
    protein: 11,
    fat: 13,
    carbs: 35,
    badges: ['Balanced Diet', 'Nutrient-Rich', 'Cockatiels'],
    ingredients: ['0.5 cups millet spray', '0.25 cups safflower seeds', '0.25 cups oat groats', '2 tbsp dried banana chips', '2 tbsp pumpkin seeds', '1 tbsp flax seeds', '1 tbsp dried coconut'],
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
    prepTime: 18,
    servings: 2,
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 267,
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800',
    calories: 155,
    protein: 10,
    fat: 11,
    carbs: 32,
    badges: ['Tropical Fruits', 'Colorful', 'Lovebirds'],
    ingredients: ['0.25 cups dried papaya', '0.25 cups dried pineapple', '0.25 cups dried mango', '0.25 cups sunflower seeds', '2 tbsp pumpkin seeds', '2 tbsp millet', '1 tbsp dried hibiscus flowers'],
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
    prepTime: 25,
    servings: 3,
    difficulty: 'Medium',
    rating: 4.7,
    reviews: 189,
    image: 'https://images.unsplash.com/photo-1580156783729-1e93a8e90b78?w=800',
    calories: 195,
    protein: 13,
    fat: 16,
    carbs: 40,
    badges: ['High Energy', 'Active Birds', 'Conures'],
    ingredients: ['0.5 cups raw cashews', '0.25 cups raw pistachios', '0.25 cups dried berries', '0.25 cups whole oats', '2 tbsp pepitas', '2 tbsp flax seeds', '1 tbsp bee pollen'],
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
    prepTime: 20,
    servings: 4,
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 156,
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
    calories: 220,
    protein: 15,
    fat: 18,
    carbs: 42,
    badges: ['Large Birds', 'Nut-Heavy', 'Macaws'],
    ingredients: ['0.5 cups brazil nuts', '0.5 cups raw almonds', '0.25 cups raw macadamias', '0.25 cups dried papaya chunks', '0.25 cups dried coconut chunks', '2 tbsp pumpkin seeds', '2 tbsp sunflower seeds'],
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
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [servingsById, setServingsById] = useState<Record<string, number>>({});
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});

  const categories = ['All', 'Parrots', 'Canaries', 'Finches', 'Budgies', 'Cockatiels', 'Lovebirds', 'Conures', 'Macaws'];

  // Convert recipes to RecipeKit format
  const recipesWithMeasurements = useMemo(() => {
    return birdRecipes.map((recipe) => {
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
    const text = `${recipe.name} - Bird Food Recipe`;
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
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-sky-50">
      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="cyan"
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
          {filteredRecipes.map((recipe) => {
            const useMetric = !!metricFlags[recipe.id];
            const servings = servingsById[recipe.id] ?? recipe.servings;

            return (
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
                          {recipe.prepTime}min
                        </span>
                        <span className="flex items-center gap-1">
                          <Bird className="h-4 w-4" />
                          {recipe.servings} cups
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BIRD RATING */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Bird
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(recipe.rating)
                              ? 'fill-cyan-500 text-cyan-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="font-medium ml-1">{recipe.rating}</span>
                      <span className="text-gray-500 text-sm">({recipe.reviews})</span>
                    </div>
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
                              <Check className="h-4 w-4 text-cyan-500 mt-0.5" />
                              <span>
                                <span className="text-cyan-600 font-semibold">
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
                      className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                      onClick={() => openRecipeModal(recipe)}
                    >
                      View Recipe
                    </Button>
                    <Button variant="outline" size="icon" className="border-cyan-200 hover:border-cyan-400">
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
