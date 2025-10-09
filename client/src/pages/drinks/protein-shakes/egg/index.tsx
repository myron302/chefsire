import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Target, Heart, Star, Zap, Award, TrendingUp, Clock,
  Leaf, Apple, Wine, Home, Sparkles, Calendar, ChefHat,
  FlaskConical, Dumbbell, Shield, Plus, Share2, Filter,
  ArrowRight, BookOpen, Flame, Droplets, ArrowLeft
} from 'lucide-react';

import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';

// Protein subcategories data (for sister nav)
const proteinSubcategories = [
  { name: 'Whey Protein', route: '/drinks/protein-shakes/whey', icon: Zap },
  { name: 'Plant-Based', route: '/drinks/protein-shakes/plant-based', icon: Leaf },
  { name: 'Casein', route: '/drinks/protein-shakes/casein', icon: Calendar },
  { name: 'Collagen', route: '/drinks/protein-shakes/collagen', icon: Sparkles },
  { name: 'Egg Protein', route: '/drinks/protein-shakes/egg', icon: Target }
];

// Other drink hubs (for cross-hub nav)
const otherDrinkHubs = [
  { name: 'Smoothies', route: '/drinks/smoothies', icon: Apple },
  { name: 'Detoxes', route: '/drinks/detoxes', icon: Droplets },
  { name: 'Potent Potables (21+)', route: '/drinks/potent-potables', icon: Wine }
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
  {
    icon: Target,
    title: 'Complete Protein',
    description: 'All 9 essential amino acids in optimal ratios',
    color: 'text-blue-600'
  },
  {
    icon: Shield,
    title: 'Lactose-Free',
    description: 'Perfect for those with dairy sensitivities',
    color: 'text-green-600'
  },
  {
    icon: Zap,
    title: 'Medium Absorption',
    description: 'Steady protein release for sustained recovery',
    color: 'text-orange-600'
  },
  {
    icon: Heart,
    title: 'Heart Healthy',
    description: 'Low in saturated fat and cholesterol',
    color: 'text-red-600'
  },
  {
    icon: Dumbbell,
    title: 'Muscle Building',
    description: 'High biological value (BV 100)',
    color: 'text-purple-600'
  },
  {
    icon: Droplets,
    title: 'Easy Digestion',
    description: 'Gentle on the stomach, minimal bloating',
    color: 'text-cyan-600'
  }
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
  const [location] = useLocation(); // For active nav state

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [filterTag, setFilterTag] = useState('All');

  const allTags = ['All', ...new Set(eggProteinRecipes.flatMap(r => r.tags))];

  const filteredRecipes = filterTag === 'All' 
    ? eggProteinRecipes 
    : eggProteinRecipes.filter(r => r.tags.includes(filterTag));

  const makeRecipe = (recipe) => {
    const drinkData = {
      id: recipe.id,
      name: recipe.name,
      category: 'protein-shakes' as const,
      description: `Egg protein shake with ${recipe.ingredients.join(', ')}`,
      ingredients: recipe.ingredients,
      nutrition: {
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: 5
      },
      difficulty: recipe.difficulty as 'Easy' | 'Medium' | 'Hard',
      prepTime: recipe.prepTime,
      rating: recipe.rating,
      tags: recipe.tags
    };

    addToRecentlyViewed(drinkData);
    incrementDrinksMade();
    addPoints(100);
    
    setSelectedRecipe(recipe);
    setTimeout(() => setSelectedRecipe(null), 3000);
  };

  const handleDrinkSelection = (drink) => {
    console.log('Selected drink:', drink);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Cross-Hub Navigation */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {otherDrinkHubs.map((hub) => {
              const Icon = hub.icon;
              return (
                <Link key={hub.route} href={hub.route}>
                  <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                    <Icon className="h-4 w-4 mr-2 text-blue-600" />
                    <span>{hub.name}</span>
                    <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                  </Button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sister Subpages Navigation */}
      <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Protein Shake Types</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {proteinSubcategories.map((page) => {
              const Icon = page.icon;
              const isActive = location.pathname === page.route;
              return (
                <Link key={page.route} href={page.route}>
                  <Button 
                    variant={isActive ? "default" : "outline"} 
                    className={`w-full justify-start ${isActive ? 'bg-amber-500 text-white hover:bg-amber-600' : 'hover:bg-amber-50 hover:border-amber-300'}`}
                    size="sm"
                  >
                    <Icon className="h-4 w-4 mr-2 text-amber-600" />
                    <span>{page.name}</span>
                    <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                  </Button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/drinks">
            <Button variant="ghost" size="sm" className="text-gray-500 mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Drinks Hub
            </Button>
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Target className="h-10 w-10 text-amber-500" />
            Egg Protein Shakes
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Complete amino acid profile • Lactose-free • Easy digestion
          </p>
        </div>
        <div className="text-right">
          <Badge className="bg-amber-500 text-white">
            <Award className="h-4 w-4 mr-1" />
            BV Score: 100
          </Badge>
        </div>
      </div>

      {/* Universal Search Popup */}
      <UniversalSearch onDrinkSelect={handleDrinkSelection} />

      {/* Success Notification */}
      {selectedRecipe && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 animate-in fade-in slide-in-from-top">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 rounded-full p-2">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-green-900">
                  Made {selectedRecipe.name}!
                </h4>
                <p className="text-sm text-green-700">+100 XP • {selectedRecipe.protein}g protein</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600"
                  onClick={() => makeRecipe(recipe)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Make (+100 XP)
                </Button>
                <Button variant="outline" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User Progress Footer */}
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
