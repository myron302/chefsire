// pages/drinks/protein-shakes/egg.tsx
import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Target, Heart, Star, Zap, Flame, Leaf, Apple, Sparkles, Moon, Wine,
  Search, ArrowLeft, ArrowRight, Share2, Camera, Plus, X, Check, Dumbbell
} from 'lucide-react';
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';
import RecipeKit, { Measured, RecipeKitHandle } from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// ---------- Data ----------
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const proteinSubcategories = [
  { id: 'whey', name: 'Whey Protein', icon: Zap, path: '/drinks/protein-shakes/whey', description: 'Fast absorption' },
  { id: 'plant', name: 'Plant-Based', icon: Leaf, path: '/drinks/protein-shakes/plant-based', description: 'Vegan friendly' },
  { id: 'casein', name: 'Casein', icon: Moon, path: '/drinks/protein-shakes/casein', description: 'Slow release' },
  { id: 'collagen', name: 'Collagen', icon: Sparkles, path: '/drinks/protein-shakes/collagen', description: 'Beauty support' },
  { id: 'beef', name: 'Beef Protein', icon: Flame, path: '/drinks/protein-shakes/beef', description: 'Natural creatine' }
];

// Egg protein recipes with measured recipes (serves 1 baseline)
const eggProteinRecipes = [
  {
    id: 'egg-1',
    name: 'Classic Egg White Power',
    flavor: 'Cinnamon Banana',
    protein: 28,
    carbs: 15,
    calories: 210,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 156,
    tags: ['Lactose-Free', 'Post-Workout', 'Muscle Building'],
    benefits: ['Complete amino acids', 'Easy digestion', 'No lactose'],
    ingredients: ['Egg White Protein', 'Banana', 'Oats', 'Cinnamon', 'Almond Milk'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg white protein'),
        m(1, 'cup', 'unsweetened almond milk'),
        // FIX: unit/item corrected (was unit="banana", item="ripe…")
        m(0.5, 'whole', 'banana', 'ripe, frozen preferred'),
        m(2, 'tbsp', 'rolled oats'),
        m(0.5, 'tsp', 'cinnamon'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Add milk, then protein and dry ingredients, then fruit.',
        'Blend 40–60 seconds until creamy.'
      ]
    }
  },
  {
    id: 'egg-2',
    name: 'Vanilla Egg Protein Delight',
    flavor: 'Vanilla Cream',
    protein: 30,
    carbs: 20,
    calories: 240,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 203,
    tags: ['High Protein', 'Morning Boost', 'Muscle Recovery'],
    benefits: ['Sustained energy', 'Rich in BCAAs', 'Smooth texture'],
    ingredients: ['Egg Protein', 'Vanilla', 'Greek Yogurt', 'Honey', 'Ice'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.75, 'cup', '2% milk or almond milk'),
        m(0.25, 'cup', 'Greek yogurt'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'honey or stevia to taste'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend liquids + protein 10 seconds.',
        'Add yogurt and sweetener; blend smooth.'
      ]
    }
  },
  {
    id: 'egg-3',
    name: 'Berry Egg Fusion',
    flavor: 'Mixed Berry',
    protein: 26,
    carbs: 18,
    calories: 220,
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 187,
    tags: ['Antioxidants', 'Recovery', 'Lactose-Free'],
    benefits: ['Antioxidant rich', 'Anti-inflammatory', 'Heart health'],
    ingredients: ['Egg Protein', 'Mixed Berries', 'Spinach', 'Chia', 'Coconut Water'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.75, 'cup', 'coconut water'),
        m(0.75, 'cup', 'mixed berries, frozen'),
        m(1, 'handful', 'spinach'),
        m(1, 'tsp', 'chia seeds'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend all until smooth; pulse to keep berry texture if preferred.'
      ]
    }
  },
  {
    id: 'egg-4',
    name: 'Chocolate Egg Power',
    flavor: 'Cocoa PB',
    protein: 32,
    carbs: 22,
    calories: 260,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 245,
    tags: ['Indulgent', 'Post-Workout', 'Strength'],
    benefits: ['Muscle growth', 'Energy boost', 'Great taste'],
    ingredients: ['Egg Protein', 'Cocoa', 'Peanut Butter', 'Banana', 'Milk'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'tbsp', 'unsweetened cocoa powder'),
        m(1, 'tbsp', 'peanut butter'),
        m(0.5, 'whole', 'banana', 'ripe'),
        m(1, 'cup', 'milk or almond milk'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend all 45–60 seconds until silky; add milk to thin as needed.'
      ]
    }
  },
  {
    id: 'egg-5',
    name: 'Green Egg Power Smoothie',
    flavor: 'Green Apple',
    protein: 27,
    carbs: 16,
    calories: 205,
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.5,
    reviews: 134,
    tags: ['Detox', 'Nutrient-Dense', 'Alkalizing'],
    benefits: ['Nutrient-dense', 'Digestive health', 'Clean protein'],
    ingredients: ['Egg Protein', 'Kale', 'Avocado', 'Apple', 'Lemon'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(1, 'cup', 'water or coconut water'),
        m(1, 'handful', 'kale'),
        m(0.25, 'medium', 'avocado'),
        m(0.5, 'small', 'green apple', 'cored'),
        m(1, 'tsp', 'fresh lemon juice'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend until bright and smooth; adjust lemon to taste.'
      ]
    }
  },
  {
    id: 'egg-6',
    name: 'Tropical Egg Protein',
    flavor: 'Mango Pineapple',
    protein: 29,
    carbs: 25,
    calories: 250,
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 178,
    tags: ['Tropical', 'Anti-Inflammatory', 'Recovery'],
    benefits: ['Tropical flavor', 'Anti-inflammatory', 'Immune boost'],
    ingredients: ['Egg Protein', 'Mango', 'Pineapple', 'Coconut Milk', 'Turmeric'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'egg protein'),
        m(0.5, 'cup', 'mango, frozen'),
        m(0.5, 'cup', 'pineapple, frozen'),
        m(0.75, 'cup', 'light coconut milk'),
        m(0.25, 'tsp', 'ground turmeric'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend all ingredients until smooth; add milk for thinner texture.'
      ]
    }
  }
];

// ---------- UI ----------
export default function EggProteinPage() {
  const {
    userProgress,
    addPoints,
    incrementDrinksMade,
    addToFavorites,
    isFavorite,
    addToRecentlyViewed
  } = useDrinks();

  const [filterTag, setFilterTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'prepTime'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  // per-card refs for RecipeKit
  const kitRefs = useRef<Record<string, RecipeKitHandle | null>>({});

  const allTags = ['All', ...new Set(eggProteinRecipes.flatMap(r => r.tags))];

  // Filter + sort
  const filteredRecipes = useMemo(() => {
    let filtered = eggProteinRecipes.filter(recipe => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        recipe.name.toLowerCase().includes(q) ||
        recipe.ingredients.some((ing: string) => ing.toLowerCase().includes(q)) ||
        (recipe.flavor || '').toLowerCase().includes(q);
      const matchesTag = filterTag === 'All' || recipe.tags.includes(filterTag);
      return matchesSearch && matchesTag;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.protein || 0) - (a.protein || 0);
        case 'calories': return (a.calories || 0) - (b.calories || 0);
        case 'prepTime': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  }, [searchQuery, filterTag, sortBy]);

  // Share handlers
  const handleSharePage = async () => {
    const shareData = {
      title: 'Egg Protein Shakes',
      text: 'Browse egg protein shake recipes and benefits.',
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

  const handleShareRecipe = async (recipe: any) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const preview = recipe?.recipe?.measurements?.slice(0, 4)
      .map((r: Measured) => `${r.amount} ${r.unit} ${r.item}`).join(' · ');
    const text = `${recipe.name} • ${recipe.protein}g protein • ${recipe.calories} cal\n${preview || recipe.ingredients.join(', ')}`;
    const shareData = { title: recipe.name, text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
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
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
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

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 -mx-4 -mt-6 px-4 md:-mx-6 md:px-6">
        <div className="max-w-7xl mx-auto">
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
                <Target className="h-6 w-6 text-amber-600" />
                <h1 className="text-2xl font-bold text-gray-900">Egg Protein Shakes</h1>
                <Badge className="bg-amber-100 text-amber-800">BV Score: 100</Badge>
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
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Recipes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Hub Navigation */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
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
      <Card className="bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200">
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
                  <Button variant="outline" className="w-full justify-start hover:bg-amber-50 hover:border-amber-300">
                    <Icon className="h-4 w-4 mr-2 text-amber-600" />
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

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search egg protein recipes..."
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
                <option value="prepTime">Sort by Prep Time</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map((recipe) => (
          <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              {/* Title + Favorite */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-lg">{recipe.name}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const drinkData = {
                      id: recipe.id,
                      name: recipe.name,
                      category: 'protein-shakes' as const,
                      description: `${recipe.flavor || ''} egg protein shake`,
                      ingredients: recipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || recipe.ingredients,
                      nutrition: { calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: 5 },
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

              {/* Rating / Reviews / Difficulty (TOP — matches your Egg layout) */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{recipe.rating}</span>
                </div>
                <span className="text-sm text-muted-foreground">({recipe.reviews} reviews)</span>
                <Badge variant="outline" className="ml-auto">{recipe.difficulty}</Badge>
              </div>

              {/* Macros */}
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div>
                  <div className="font-bold text-blue-600">{recipe.protein}g</div>
                  <div className="text-xs text-muted-foreground">Protein</div>
                </div>
                <div>
                  <div className="font-bold text-green-600">{recipe.carbs}g</div>
                  <div className="text-xs text-muted-foreground">Carbs</div>
                </div>
                <div>
                  <div className="font-bold text-amber-600">{recipe.calories}</div>
                  <div className="text-xs text-muted-foreground">Calories</div>
                </div>
              </div>

              {/* RecipeKit preview */}
              {recipe.recipe?.measurements && (
                <RecipeKit
                  ref={(el) => { kitRefs.current[recipe.id] = el; }}
                  id={recipe.id}
                  name={recipe.name}
                  measurements={recipe.recipe.measurements}
                  directions={recipe.recipe.directions}
                  nutrition={{ calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: 5 }}
                  prepTime={recipe.prepTime}
                  onComplete={() => {
                    // Award only on complete to avoid double counting
                    incrementDrinksMade();
                    addPoints(100);
                    addToRecentlyViewed({
                      id: recipe.id,
                      name: recipe.name,
                      category: 'protein-shakes',
                      description: `${recipe.flavor || ''} egg protein shake`,
                      ingredients: recipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || recipe.ingredients,
                      nutrition: { calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: 5 },
                      difficulty: recipe.difficulty,
                      prepTime: recipe.prepTime,
                      rating: recipe.rating,
                      tags: recipe.tags
                    });
                  }}
                />
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {recipe.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Benefits */}
              <div className="mb-3 text-xs text-muted-foreground">
                Benefits: {recipe.benefits.join(' · ')}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => {
                    // no XP here — only onComplete
                    const anchor = document.getElementById(recipe.id);
                    anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    kitRefs.current[recipe.id]?.open?.();
                  }}
                >
                  <Dumbbell className="h-4 w-4 mr-2" />
                  Make Shake (+100 XP)
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleShareRecipe(recipe)}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Your Progress */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
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
  );
}
