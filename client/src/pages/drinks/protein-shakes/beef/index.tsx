// pages/drinks/protein-shakes/beef.tsx
import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Target, Heart, Star, Zap, Flame, Leaf, Sparkles, Moon, Wine,
  Search, ArrowLeft, ArrowRight, Camera, X, Plus, Dumbbell, Trophy, 
  Activity, Shield, Copy, Share2, BarChart3
} from 'lucide-react';
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';
import RecipeKit, { Measured } from '@/components/recipes/RecipeKit';
import type { RecipeKitHandle } from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
type Nutrition = { calories?: number; protein?: number; carbs?: number; fat?: number; creatine?: number; iron?: number };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

const scaleAmount = (amt: number | string, factor: number): number | string => {
  if (typeof amt === 'number') return Math.round((amt * factor + Number.EPSILON) * 100) / 100;
  return amt;
};

// ---------- Cross-nav ----------
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Leaf, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const proteinSubcategories = [
  { id: 'whey', name: 'Whey Protein', icon: Zap, path: '/drinks/protein-shakes/whey', description: 'Fast absorption' },
  { id: 'plant', name: 'Plant-Based', icon: Leaf, path: '/drinks/protein-shakes/plant-based', description: 'Vegan friendly' },
  { id: 'casein', name: 'Casein', icon: Moon, path: '/drinks/protein-shakes/casein', description: 'Slow release' },
  { id: 'collagen', name: 'Collagen', icon: Sparkles, path: '/drinks/protein-shakes/collagen', description: 'Beauty support' },
  { id: 'egg', name: 'Egg Protein', icon: Target, path: '/drinks/protein-shakes/egg', description: 'Complete amino' }
];

// ---------- Data (Beef) ----------
const beefProteinShakes = [
  {
    id: 'beef-1',
    name: 'Carnivore Power Blast',
    flavor: 'Natural Beef',
    protein: 28,
    carbs: 2,
    calories: 120,
    creatine: 0.5,
    iron: 4.5,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 523,
    tags: ['Grass-Fed', 'Paleo-Friendly', 'Muscle Building', 'Natural Creatine'],
    benefits: ['Natural Creatine', 'High Iron', 'Complete Amino Profile', 'Paleo-Friendly'],
    ingredients: ['Grass-Fed Beef Protein Isolate', 'Natural Flavors', 'Sea Salt', 'Digestive Enzymes'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'grass-fed beef protein'),
        m(1, 'cup', 'cold water or milk'),
        m(1, 'tsp', 'honey or maple syrup', 'optional'),
        m(1, 'pinch', 'sea salt'),
        m(4, 'ice cubes', 'ice', 'optional')
      ],
      directions: [
        'Add liquid first, then slowly add beef protein while blending',
        'Blend for 45-60 seconds until completely smooth',
        'Add ice for colder, thicker consistency'
      ]
    }
  },
  {
    id: 'beef-2',
    name: 'Primal Strength Formula',
    flavor: 'Chocolate Beef',
    protein: 26,
    carbs: 3,
    calories: 125,
    creatine: 0.4,
    iron: 3.8,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 445,
    tags: ['Hydrolyzed', 'Joint Support', 'Keto-Friendly', 'Strength'],
    benefits: ['Joint Support', 'Muscle Recovery', 'Gut Health', 'Keto-Friendly'],
    ingredients: ['Hydrolyzed Beef Protein', 'Beef Collagen', 'Cocoa Powder', 'Monk Fruit', 'MCT Oil'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (32g)', 'hydrolyzed beef protein'),
        m(1, 'cup', 'almond milk'),
        m(1, 'tbsp', 'cocoa powder'),
        m(1, 'tsp', 'MCT oil'),
        m(1, 'pinch', 'sea salt')
      ],
      directions: [
        'Mix protein with small amount of liquid first to create paste',
        'Gradually add remaining liquid while blending',
        'Blend until rich and chocolatey'
      ]
    }
  },
  {
    id: 'beef-3',
    name: 'Paleo Performance Shake',
    flavor: 'Vanilla Bean',
    protein: 27,
    carbs: 2,
    calories: 115,
    creatine: 0.45,
    iron: 5.0,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 367,
    tags: ['Paleo Certified', 'Clean Ingredients', 'Iron Rich', 'General Wellness'],
    benefits: ['Paleo Approved', 'Clean Ingredients', 'Natural Energy', 'Iron Rich'],
    ingredients: ['Grass-Fed Beef Protein', 'Vanilla Bean Extract', 'Stevia', 'Himalayan Salt'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (28g)', 'beef protein isolate'),
        m(1, 'cup', 'coconut water'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'honey', 'optional'),
        m(1, 'pinch', 'cinnamon')
      ],
      directions: [
        'Combine all ingredients in blender',
        'Blend until smooth and frothy',
        'Enjoy as morning energy boost'
      ]
    }
  },
  {
    id: 'beef-4',
    name: 'Beef & Berry Recovery',
    flavor: 'Mixed Berry',
    protein: 25,
    carbs: 8,
    calories: 140,
    creatine: 0.4,
    iron: 4.2,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 289,
    tags: ['Antioxidant Boost', 'Muscle Recovery', 'Fiber Rich', 'Immune Support'],
    benefits: ['Antioxidant Boost', 'Muscle Recovery', 'Fiber Rich', 'Immune Support'],
    ingredients: ['Grass-Fed Beef Protein', 'Mixed Berry Blend', 'Acai Powder', 'Chia Seeds', 'Natural Berry Flavor'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'beef protein'),
        m(1, 'cup', 'unsweetened almond milk'),
        m(0.5, 'cup', 'mixed berries, frozen'),
        m(1, 'tsp', 'acai powder'),
        m(1, 'tsp', 'chia seeds'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend beef protein with almond milk first',
        'Add frozen berries and acai powder',
        'Blend until smooth, stir in chia seeds last'
      ]
    }
  },
  {
    id: 'beef-5',
    name: 'Coffee Beef Energizer',
    flavor: 'Mocha',
    protein: 26,
    carbs: 4,
    calories: 130,
    creatine: 0.42,
    iron: 3.5,
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.6,
    reviews: 412,
    tags: ['Pre-Workout', 'Sustained Energy', 'Mental Focus', 'Keto'],
    benefits: ['Sustained Energy', 'Mental Focus', 'Pre-Workout Boost', 'Mood Support'],
    ingredients: ['Hydrolyzed Beef Protein', 'Coffee Extract', 'Cocoa Powder', 'L-Theanine', 'Natural Mocha Flavor'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (33g)', 'mocha beef protein'),
        m(1, 'cup', 'cold brew coffee'),
        m(2, 'tbsp', 'cream or milk alternative'),
        m(1, 'tsp', 'cocoa powder'),
        m(1, 'pinch', 'cinnamon')
      ],
      directions: [
        'Brew coffee and let cool completely',
        'Blend coffee with beef protein and cocoa',
        'Add cream and blend until frothy'
      ]
    }
  },
  {
    id: 'beef-6',
    name: 'Tropical Beef Fusion',
    flavor: 'Pina Colada',
    protein: 24,
    carbs: 7,
    calories: 135,
    creatine: 0.38,
    iron: 3.2,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.3,
    reviews: 198,
    tags: ['Electrolyte Balance', 'Hydration', 'Tropical Taste', 'Digestive Support'],
    benefits: ['Electrolyte Balance', 'Digestive Support', 'Tropical Taste', 'Hydration'],
    ingredients: ['Beef Protein Isolate', 'Pineapple Extract', 'Coconut Cream Powder', 'Natural Flavors', 'Sea Salt'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (29g)', 'tropical beef protein'),
        m(1, 'cup', 'coconut water'),
        m(0.25, 'cup', 'pineapple chunks, frozen'),
        m(1, 'tsp', 'coconut cream powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend beef protein with coconut water',
        'Add frozen pineapple and coconut cream',
        'Blend until tropical smoothie consistency'
      ]
    }
  }
];

const beefProteinBenefits = [
  { icon: Dumbbell, title: 'Natural Creatine', description: '0.4-0.5g per serving for strength gains', color: 'text-red-600' },
  { icon: Shield, title: 'High Iron Content', description: 'Supports energy and blood health', color: 'text-orange-600' },
  { icon: Zap, title: 'Fast Absorption', description: 'Quickly digested for rapid recovery', color: 'text-yellow-600' },
  { icon: Flame, title: 'Complete Amino Profile', description: 'All essential amino acids (BV 88)', color: 'text-red-600' },
  { icon: Trophy, title: 'Paleo & Keto Friendly', description: 'Perfect for low-carb diets', color: 'text-purple-600' },
  { icon: Heart, title: 'No Dairy Allergens', description: 'Lactose-free alternative to whey', color: 'text-pink-600' }
];

// ---------- Component ----------
export default function BeefProteinPage() {
  const {
    userProgress,
    addPoints,
    incrementDrinksMade,
    addToFavorites,
    isFavorite,
    addToRecentlyViewed
  } = useDrinks();

  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [filterTag, setFilterTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'creatine'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showKit, setShowKit] = useState(false);

  // Serving incrementer (inline, per card)
  const [servingsById, setServingsById] = useState<Record<string, number>>({});

  const allTags = ['All', ...new Set(beefProteinShakes.flatMap(r => r.tags))];

  // Filter + sort
  const filteredRecipes = useMemo(() => {
    let filtered = beefProteinShakes.filter(recipe => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        recipe.name.toLowerCase().includes(q) ||
        recipe.ingredients.some((ing: string) => ing.toLowerCase().includes(q)) ||
        (recipe.flavor || '').toLowerCase().includes(q) ||
        recipe.tags.some(t => t.toLowerCase().includes(q)) ||
        (recipe.benefits || []).some((b: string) => b.toLowerCase().includes(q));
      const matchesTag = filterTag === 'All' || recipe.tags.includes(filterTag);
      return matchesSearch && matchesTag;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.protein || 0) - (a.protein || 0);
        case 'calories': return (a.calories || 0) - (b.calories || 0);
        case 'creatine': return (b.creatine || 0) - (a.creatine || 0);
        default: return 0;
      }
    });

    return filtered;
  }, [searchQuery, filterTag, sortBy]);

  const getServings = (recipe: any) => servingsById[recipe.id] ?? (recipe.recipe?.servings || 1);
  const incrementServings = (recipe: any, dir: 1 | -1) => {
    setServingsById(prev => {
      const current = prev[recipe.id] ?? (recipe.recipe?.servings || 1);
      const next = Math.min(12, Math.max(1, current + dir));
      return { ...prev, [recipe.id]: next };
    });
  };

  const openRecipeModal = (recipe: any) => {
    setSelectedRecipe(recipe);
    setShowKit(true);
  };

  const handleCompleteRecipe = () => {
    if (selectedRecipe) {
      const drinkData = {
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: 'protein-shakes' as const,
        description: `${selectedRecipe.flavor || ''} beef protein shake`,
        ingredients: selectedRecipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || selectedRecipe.ingredients,
        nutrition: {
          calories: selectedRecipe.calories,
          protein: selectedRecipe.protein,
          carbs: selectedRecipe.carbs,
          fat: 0.5,
          creatine: selectedRecipe.creatine,
          iron: selectedRecipe.iron
        } as Nutrition,
        difficulty: selectedRecipe.difficulty as 'Easy' | 'Medium' | 'Hard',
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        tags: selectedRecipe.tags
      };
      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(100);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  const handleSharePage = async () => {
    const shareData = {
      title: 'Beef Protein Shakes',
      text: 'Browse beef protein shake recipes with natural creatine and high iron.',
      url: typeof window !== 'undefined' ? window.location.href : ''
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const handleCopyRecipe = (recipe: any) => {
    const recipeText = `
${recipe.name}
${recipe.flavor}

Ingredients:
${recipe.recipe.measurements.map((m: Measured) => `• ${m.amount} ${m.unit} ${m.item}${m.note ? ` (${m.note})` : ''}`).join('\n')}

Directions:
${recipe.recipe.directions.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}

Nutrition: ${recipe.protein}g protein, ${recipe.calories} calories, ${recipe.creatine}g creatine
    `.trim();

    navigator.clipboard.writeText(recipeText);
    alert('Recipe copied to clipboard!');
  };

  const handleShareRecipe = async (recipe: any) => {
    const shareData = {
      title: recipe.name,
      text: `${recipe.flavor} - ${recipe.protein}g protein, ${recipe.creatine}g natural creatine`,
      url: typeof window !== 'undefined' ? window.location.href + `#${recipe.id}` : ''
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Recipe link copied to clipboard!');
      }
    } catch {
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
      alert('Recipe link copied to clipboard!');
    }
  };

  const handleShowMetrics = (recipe: any) => {
    // This would typically open a detailed metrics modal
    alert(`Detailed metrics for ${recipe.name}:\n\nProtein: ${recipe.protein}g\nCalories: ${recipe.calories}\nCreatine: ${recipe.creatine}g\nIron: ${recipe.iron}mg\nRating: ${recipe.rating}/5 (${recipe.reviews} reviews)`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setShowUniversalSearch(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">Search All Drinks</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowUniversalSearch(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Controlled RecipeKit Modal (popup) */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="red"
          pointsReward={100}
          onComplete={handleCompleteRecipe}
          item={{
            id: selectedRecipe.id,
            name: selectedRecipe.name,
            prepTime: selectedRecipe.prepTime,
            directions: selectedRecipe.recipe?.directions || [],
            measurements: selectedRecipe.recipe?.measurements || [],
            baseNutrition: { 
              calories: selectedRecipe.calories, 
              protein: selectedRecipe.protein,
              creatine: selectedRecipe.creatine,
              iron: selectedRecipe.iron
            },
            defaultServings: selectedRecipe.recipe?.servings || 1
          }}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/drinks/protein-shakes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Protein Shakes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Flame className="h-6 w-6 text-red-600" />
                <h1 className="text-2xl font-bold text-gray-900">Beef Protein Shakes</h1>
                <Badge className="bg-red-100 text-red-800">Natural Creatine</Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setShowUniversalSearch(true)}>
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cross-Hub Navigation */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon as any;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{hub.name}</div>
                        <div className="text-xs text-gray-500">{hub.description}</div>
                      </div>
                      <ArrowRight className="h-3 w-3 ml-auto" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sister Protein Pages Navigation */}
        <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Other Protein Types
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon as any;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-red-50 hover:border-red-300">
                      <Icon className="h-4 w-4 mr-2 text-red-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{subcategory.name}</div>
                        <div className="text-xs text-gray-500">{subcategory.description}</div>
                      </div>
                      <ArrowRight className="h-3 w-3 ml-auto" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Beef Protein Benefits */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Star className="h-6 w-6 text-red-500" />
              Why Beef Protein?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {beefProteinBenefits.map((benefit, index) => {
                const Icon = benefit.icon as any;
                return (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow">
                    <Icon className={`h-6 w-6 ${benefit.color} flex-shrink-0`} />
                    <div>
                      <h3 className="font-semibold mb-1">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">26g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">0.43g</div>
              <div className="text-sm text-gray-600">Avg Creatine</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">4.6mg</div>
              <div className="text-sm text-gray-600">Avg Iron</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">6</div>
              <div className="text-sm text-gray-600">Beef Formulas</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search beef protein recipes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                >
                  <option value="All">All Tags</option>
                  {allTags.filter(t => t !== 'All').map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
                  <option value="calories">Sort by Calories</option>
                  <option value="creatine">Sort by Creatine</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recipe Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => {
            const servings = getServings(recipe);
            const factor = (servings || 1) / (recipe.recipe?.servings || 1);
            const hasMoreThan5Ingredients = recipe.recipe?.measurements?.length > 5;

            return (
              <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{recipe.name}</CardTitle>

                      {/* Benefits directly below the title */}
                      {Array.isArray(recipe.benefits) && recipe.benefits.length > 0 && (
                        <div className="mt-0.5 mb-2 text-xs text-gray-600">
                          Benefits: {recipe.benefits.join(' · ')}
                        </div>
                      )}

                      <p className="text-sm text-gray-600">{recipe.flavor}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const drinkData = {
                          id: recipe.id,
                          name: recipe.name,
                          category: 'protein-shakes' as const,
                          description: `${recipe.flavor || ''} beef protein shake`,
                          ingredients: recipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || recipe.ingredients,
                          nutrition: { 
                            calories: recipe.calories, 
                            protein: recipe.protein, 
                            carbs: recipe.carbs, 
                            fat: 0.5,
                            creatine: recipe.creatine,
                            iron: recipe.iron
                          },
                          difficulty: recipe.difficulty as 'Easy' | 'Medium' | 'Hard',
                          prepTime: recipe.prepTime,
                          rating: recipe.rating
                        };
                        addToFavorites(drinkData);
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Heart className={`h-5 w-5 ${isFavorite(recipe.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Quick stats */}
                  <div className="grid grid-cols-4 gap-2 text-center mb-4">
                    <div>
                      <div className="font-bold text-red-600">{recipe.protein}g</div>
                      <div className="text-xs text-gray-500">Protein</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">{recipe.calories}</div>
                      <div className="text-xs text-gray-500">Calories</div>
                    </div>
                    <div>
                      <div className="font-bold text-orange-600">{recipe.creatine}g</div>
                      <div className="text-xs text-gray-500">Creatine</div>
                    </div>
                    <div>
                      <div className="font-bold text-amber-600">{recipe.iron}mg</div>
                      <div className="text-xs text-gray-500">Iron</div>
                    </div>
                  </div>

                  {/* Rating + Difficulty row */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{recipe.rating}</span>
                      <span className="text-gray-500 text-sm">({recipe.reviews})</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{recipe.difficulty}</Badge>
                  </div>

                  {/* Inline serving incrementer + compact measured preview */}
                  {recipe.recipe?.measurements && (
                    <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-900">
                          Recipe (serves {servings})
                        </div>
                        <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
                          <button
                            aria-label="decrease servings"
                            onClick={() => incrementServings(recipe, -1)}
                            className="px-2 py-1 text-sm hover:bg-gray-100"
                          >−</button>
                          <div className="px-3 py-1 text-sm border-l border-r border-gray-300">{servings}</div>
                          <button
                            aria-label="increase servings"
                            onClick={() => incrementServings(recipe, +1)}
                            className="px-2 py-1 text-sm hover:bg-gray-100"
                          >+</button>
                        </div>
                      </div>

                      <ul className="text-sm leading-6 text-gray-800 space-y-1">
                        {recipe.recipe.measurements.slice(0, 5).map((ing: Measured, i: number) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-red-500 font-medium min-w-[90px]">
                              {scaleAmount(ing.amount, factor)} {ing.unit}
                            </span>
                            <span className="flex-1">
                              {ing.item}{ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                      
                      {/* Show More button that opens the popup modal */}
                      {hasMoreThan5Ingredients && (
                        <div className="text-xs text-gray-600 mt-1">
                          <button
                            type="button"
                            onClick={() => openRecipeModal(recipe)}
                            className="underline underline-offset-2 hover:text-red-500"
                          >
                            Show more ({recipe.recipe.measurements.length - 5} more ingredients)
                          </button>
                        </div>
                      )}

                      {/* Copy, Share, Metrics buttons moved inside recipe div */}
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleCopyRecipe(recipe)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleShareRecipe(recipe)}
                        >
                          <Share2 className="h-3 w-3 mr-1" />
                          Share
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleShowMetrics(recipe)}
                        >
                          <BarChart3 className="h-3 w-3 mr-1" />
                          Metrics
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tags (full list) with Natural Creatine color scheme */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {recipe.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs bg-red-100 text-red-800 hover:bg-red-200">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Full-width CTA — Make Shake with lighter red */}
                  <Button
                    className="w-full bg-red-500 hover:bg-red-600 text-white"
                    onClick={() => openRecipeModal(recipe)}
                  >
                    <Flame className="h-4 w-4 mr-2" />
                    Make Shake (+100 XP)
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-purple-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-green-600">
                    {userProgress.totalDrinksMade} Drinks Made
                  </Badge>
                </div>
              </div>
              <div className="text-center">
                <Progress value={userProgress.dailyGoalProgress} className="w-32 mb-2" />
                <div className="text-xs text-gray-500">Daily Goal Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
