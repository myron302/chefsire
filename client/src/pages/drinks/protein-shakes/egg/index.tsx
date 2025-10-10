import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Target, Heart, Star, Zap, Award, TrendingUp, Clock,
  Leaf, Apple, Wine, Home, Sparkles, Calendar, ChefHat,
  FlaskConical, Dumbbell, Shield, Plus, Share2, Filter,
  ArrowRight, BookOpen, Flame, Droplets, Search, ArrowLeft, Moon, X, Check, Camera
} from 'lucide-react';

import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';

// Navigation data
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

const eggProteinRecipes = [
  {
    id: 'egg-1',
    name: 'Classic Egg White Power',
    protein: 28,
    carbs: 15,
    calories: 210,
    ingredients: ['Egg White Protein', 'Banana', 'Oats', 'Cinnamon', 'Almond Milk'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 156,
    tags: ['Lactose-Free', 'Post-Workout', 'Muscle Building'],
    benefits: ['Complete amino acids', 'Easy digestion', 'No lactose']
  },
  {
    id: 'egg-2',
    name: 'Vanilla Egg Protein Delight',
    protein: 30,
    carbs: 20,
    calories: 240,
    ingredients: ['Egg Protein', 'Vanilla Extract', 'Greek Yogurt', 'Honey', 'Ice'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.8,
    reviews: 203,
    tags: ['High Protein', 'Morning Boost', 'Muscle Recovery'],
    benefits: ['Sustained energy', 'Rich in BCAAs', 'Smooth texture']
  },
  {
    id: 'egg-3',
    name: 'Berry Egg Fusion',
    protein: 26,
    carbs: 18,
    calories: 220,
    ingredients: ['Egg Protein', 'Mixed Berries', 'Spinach', 'Chia Seeds', 'Coconut Water'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 187,
    tags: ['Antioxidants', 'Recovery', 'Lactose-Free'],
    benefits: ['Antioxidant rich', 'Anti-inflammatory', 'Heart health']
  },
  {
    id: 'egg-4',
    name: 'Chocolate Egg Protein Shake',
    protein: 32,
    carbs: 22,
    calories: 260,
    ingredients: ['Egg Protein', 'Cocoa Powder', 'Peanut Butter', 'Banana', 'Milk'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 245,
    tags: ['Indulgent', 'Post-Workout', 'Strength'],
    benefits: ['Muscle growth', 'Energy boost', 'Great taste']
  },
  {
    id: 'egg-5',
    name: 'Green Egg Power Smoothie',
    protein: 27,
    carbs: 16,
    calories: 205,
    ingredients: ['Egg Protein', 'Kale', 'Avocado', 'Apple', 'Lemon', 'Water'],
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.5,
    reviews: 134,
    tags: ['Detox', 'Nutrient-Dense', 'Alkalizing'],
    benefits: ['Nutrient-dense', 'Digestive health', 'Clean protein']
  },
  {
    id: 'egg-6',
    name: 'Tropical Egg Protein',
    protein: 29,
    carbs: 25,
    calories: 250,
    ingredients: ['Egg Protein', 'Mango', 'Pineapple', 'Coconut Milk', 'Turmeric'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 178,
    tags: ['Tropical', 'Anti-Inflammatory', 'Recovery'],
    benefits: ['Tropical flavor', 'Anti-inflammatory', 'Immune boost']
  }
];

const eggProteinBenefits = [
  { icon: Target, title: 'Complete Protein', description: 'All 9 essential amino acids in optimal ratios', color: 'text-blue-600' },
  { icon: Shield, title: 'Lactose-Free', description: 'Perfect for those with dairy sensitivities', color: 'text-green-600' },
  { icon: Zap, title: 'Medium Absorption', description: 'Steady protein release for sustained recovery', color: 'text-orange-600' },
  { icon: Heart, title: 'Heart Healthy', description: 'Low in saturated fat and cholesterol', color: 'text-red-600' },
  { icon: Dumbbell, title: 'Muscle Building', description: 'High biological value (BV 100)', color: 'text-purple-600' },
  { icon: Droplets, title: 'Easy Digestion', description: 'Gentle on the stomach, minimal bloating', color: 'text-cyan-600' }
];

const sisterProteinPages = [
  { name: 'Whey Protein', route: '/drinks/protein-shakes/whey', icon: Zap },
  { name: 'Plant-Based', route: '/drinks/protein-shakes/plant-based', icon: Leaf },
  { name: 'Casein', route: '/drinks/protein-shakes/casein', icon: Calendar },
  { name: 'Collagen', route: '/drinks/protein-shakes/collagen', icon: Sparkles }
];

export default function EggProteinPage() {
  const { 
    userProgress, 
    addPoints, 
    incrementDrinksMade, 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed
  } = useDrinks();

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [filterTag, setFilterTag] = useState('All');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const allTags = ['All', ...new Set(eggProteinRecipes.flatMap(r => r.tags))];

  const filteredRecipes = filterTag === 'All' 
    ? eggProteinRecipes 
    : eggProteinRecipes.filter(r => r.tags.includes(filterTag));

  const makeRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setShowModal(true);
  };

  const handleCompleteRecipe = () => {
    if (selectedRecipe) {
      const drinkData = {
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: 'protein-shakes' as const,
        description: `Egg protein shake with ${selectedRecipe.ingredients.join(', ')}`,
        ingredients: selectedRecipe.ingredients,
        nutrition: {
          calories: selectedRecipe.calories,
          protein: selectedRecipe.protein,
          carbs: selectedRecipe.carbs,
          fat: 5
        },
        difficulty: selectedRecipe.difficulty as 'Easy' | 'Medium' | 'Hard',
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        tags: selectedRecipe.tags
      };

      addToRecentlyViewed(drinkData);
      incrementDrinksMade();
      addPoints(100);
    }
    
    setShowModal(false);
    setSelectedRecipe(null);
  };

  const handleDrinkSelection = (drink) => {
    console.log('Selected drink:', drink);
  };

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
        alert('Unable to share on this device.');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const handleShareRecipe = async (recipe) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `${recipe.name} • ${recipe.protein}g protein • ${recipe.calories} cal\n${recipe.ingredients.join(', ')}`;
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
        alert('Unable to share on this device.');
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

      {/* Make Recipe Modal */}
      {showModal && selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedRecipe.name}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Ingredients:</h3>
                <ul className="space-y-2">
                  {selectedRecipe.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Benefits:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {selectedRecipe.benefits.map((benefit, idx) => (
                    <li key={idx}>• {benefit}</li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-amber-50 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-amber-600">{selectedRecipe.protein}g</div>
                  <div className="text-xs text-gray-600">Protein</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{selectedRecipe.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-purple-600">{selectedRecipe.prepTime}min</div>
                  <div className="text-xs text-gray-600">Prep</div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600"
                  onClick={handleCompleteRecipe}
                >
                  Complete Recipe (+100 XP)
                </Button>
              </div>
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
                <Target className="h-6 w-6 text-amber-500" />
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
              <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600" onClick={handleSharePage}>
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
              const Icon = hub.icon;
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
      <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            Other Protein Types
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {proteinSubcategories.map((subcategory) => {
              const Icon = subcategory.icon;
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

      {/* Egg Protein Benefits */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-500" />
            Why Egg Protein?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eggProteinBenefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow">
                <benefit.icon className={`h-6 w-6 ${benefit.color} flex-shrink-0`} />
                <div>
                  <h3 className="font-semibold mb-1">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter Tags */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Filter:</span>
            {allTags.map(tag => (
              <Button
                key={tag}
                variant={filterTag === tag ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterTag(tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map((recipe) => (
          <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
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
                      description: `Egg protein shake`,
                      ingredients: recipe.ingredients,
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

              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{recipe.rating}</span>
                </div>
                <span className="text-sm text-muted-foreground">({recipe.reviews} reviews)</span>
                <Badge variant="outline" className="ml-auto">{recipe.difficulty}</Badge>
              </div>

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
                  <div className="font-bold text-orange-600">{recipe.calories}</div>
                  <div className="text-xs text-muted-foreground">Calories</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs font-medium mb-2">Ingredients:</div>
                <div className="text-sm text-muted-foreground">
                  {recipe.ingredients.join(', ')}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {recipe.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="mb-4">
                <div className="text-xs font-medium mb-1">Benefits:</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {recipe.benefits.map((benefit, i) => (
                    <li key={i}>• {benefit}</li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                <Button 
                  className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600"
                  onClick={() => makeRecipe(recipe)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Make (+100 XP)
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleShareRecipe(recipe)}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Your Progress (in-content) */}
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
