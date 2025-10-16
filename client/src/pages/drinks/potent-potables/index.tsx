import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import RequireAgeGate from "@/components/RequireAgeGate";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star,
  Target, Flame, Droplets, Wine, ArrowRight,
  GlassWater, Martini, ChefHat, ArrowLeft, Home,
  FlaskConical, Leaf, Apple, Zap, TrendingUp
} from 'lucide-react';
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';
import RecipeKit from '@/components/recipes/RecipeKit';

// Helper to parse ingredients
type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

const parseIngredient = (ingredient: string): Measured => {
  const fractionMap: Record<string, number> = {
    '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅛': 0.125
  };
  
  const parts = ingredient.trim().replace(/\sof\s/i, ' ').replace(/[()]/g, '').split(/\s+/);
  if (parts.length < 2) return m('1', 'item', ingredient);

  let amountStr = parts[0];
  let amount: number | string = fractionMap[amountStr] ?? 
    (isNaN(Number(amountStr)) ? amountStr : Number(amountStr));

  let unit = parts[1];
  let item = parts.slice(2).join(' ');

  return m(amount, unit, item);
};

const potentPotablesSubcategories = [
  { id: 'vodka', name: 'Vodka', icon: Droplets, count: 12, route: '/drinks/potent-potables/vodka', color: 'from-cyan-500 to-blue-500', description: 'Clean & versatile' },
  { id: 'whiskey-bourbon', name: 'Whiskey & Bourbon', icon: Wine, count: 12, route: '/drinks/potent-potables/whiskey-bourbon', color: 'from-amber-500 to-orange-500', description: 'Kentucky classics' },
  { id: 'tequila-mezcal', name: 'Tequila & Mezcal', icon: Flame, count: 12, route: '/drinks/potent-potables/tequila-mezcal', color: 'from-lime-500 to-green-500', description: 'Agave spirits' },
  { id: 'rum', name: 'Rum', icon: GlassWater, count: 12, route: '/drinks/potent-potables/rum', color: 'from-orange-500 to-red-500', description: 'Caribbean vibes' },
  { id: 'cognac-brandy', name: 'Cognac & Brandy', icon: Wine, count: 12, route: '/drinks/potent-potables/cognac-brandy', color: 'from-orange-600 to-red-600', description: 'French elegance' },
  { id: 'martinis', name: 'Martinis', icon: Martini, count: 8, route: '/drinks/potent-potables/martinis', color: 'from-purple-500 to-pink-500', description: 'Timeless classics' },
  { id: 'scotch-irish-whiskey', name: 'Scotch & Irish', icon: Wine, count: 12, route: '/drinks/potent-potables/scotch-irish-whiskey', color: 'from-amber-600 to-yellow-700', description: 'UK whiskeys' },
  { id: 'cocktails', name: 'Classic Cocktails', icon: GlassWater, count: 15, route: '/drinks/potent-potables/cocktails', color: 'from-blue-500 to-indigo-500', description: 'Timeless recipes' },
  { id: 'seasonal', name: 'Seasonal', icon: Sparkles, count: 10, route: '/drinks/potent-potables/seasonal', color: 'from-teal-500 to-cyan-500', description: 'Holiday specials' },
  { id: 'mocktails', name: 'Mocktails', icon: Sparkles, count: 12, route: '/drinks/potent-potables/mocktails', color: 'from-green-500 to-emerald-500', description: 'Zero-proof' }
];

const featuredCocktails = [
  {
    id: 'featured-1',
    name: "Old Fashioned",
    spirit: "Whiskey",
    difficulty: "Easy",
    rating: 4.9,
    reviews: 5234,
    time: "5 min",
    prepTime: 5,
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop",
    tags: ['Classic', 'Strong', 'Sophisticated'],
    ingredients: ['2 oz Bourbon', '1 Sugar Cube', '2 dashes Angostura Bitters', 'Orange Peel', 'Maraschino Cherry', '1 Large Ice Cube'],
    instructions: 'Muddle sugar cube with bitters in glass. Add bourbon and large ice cube. Stir gently. Express orange peel over drink and garnish with cherry.',
    description: 'The grandfather of cocktails - bourbon, sugar, and bitters perfection'
  },
  {
    id: 'featured-2',
    name: "Margarita",
    spirit: "Tequila",
    difficulty: "Easy",
    rating: 4.8,
    reviews: 4892,
    time: "3 min",
    prepTime: 3,
    image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop",
    tags: ['Citrus', 'Refreshing', 'Party'],
    ingredients: ['2 oz Tequila', '1 oz Fresh Lime Juice', '0.75 oz Triple Sec', '0.5 oz Simple Syrup', 'Salt for rim', 'Lime Wheel'],
    instructions: 'Rim glass with salt. Shake tequila, lime juice, triple sec, and simple syrup with ice. Strain into glass with fresh ice. Garnish with lime wheel.',
    description: 'The ultimate party cocktail - tequila, lime, and a salted rim'
  },
  {
    id: 'featured-3',
    name: "Mojito",
    spirit: "Rum",
    difficulty: "Medium",
    rating: 4.7,
    reviews: 3654,
    time: "7 min",
    prepTime: 7,
    image: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=300&fit=crop",
    tags: ['Minty', 'Refreshing', 'Summer'],
    ingredients: ['2 oz White Rum', '10 Fresh Mint Leaves', '0.75 oz Fresh Lime Juice', '0.5 oz Simple Syrup', 'Soda Water', 'Mint Sprig', 'Lime Wedge'],
    instructions: 'Muddle mint leaves with lime juice and simple syrup. Add rum and ice. Top with soda water. Stir gently. Garnish with mint sprig and lime wedge.',
    description: 'Cuban classic with fresh mint, lime, and white rum'
  }
];

export default function PotentPotablesPage() {
  const { userProgress, addToFavorites, isFavorite, favorites, incrementDrinksMade, addPoints } = useDrinks();
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);

  // Convert featured cocktails to RecipeKit format
  const cocktailsWithMeasurements = useMemo(() => {
    return featuredCocktails.map((c) => {
      const measurements = c.ingredients.map((ing: string) => parseIngredient(ing));
      return {
        ...c,
        recipe: {
          servings: 1,
          measurements,
          directions: [c.instructions]
        }
      };
    });
  }, []);

  const handleDrinkSelection = (drink) => {
    console.log('Selected drink from universal search:', drink);
  };

  const openRecipeModal = (cocktail: any) => {
    setSelectedRecipe(cocktail);
    setShowKit(true);
  };

  const handleCompleteRecipe = () => {
    if (selectedRecipe) {
      incrementDrinksMade();
      addPoints(35);
    }
    setShowKit(false);
    setSelectedRecipe(null);
  };

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        {/* RecipeKit Modal */}
        {selectedRecipe && (
          <RecipeKit
            open={showKit}
            onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
            accent="purple"
            pointsReward={35}
            onComplete={handleCompleteRecipe}
            item={{
              id: selectedRecipe.id,
              name: selectedRecipe.name,
              prepTime: selectedRecipe.prepTime,
              directions: selectedRecipe.recipe?.directions || [],
              measurements: selectedRecipe.recipe?.measurements || [],
              baseNutrition: {},
              defaultServings: 1
            }}
          />
        )}

        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
          
          {/* UNIFORM HERO SECTION */}
          <div className="bg-gradient-to-r from-red-700 via-purple-800 to-gray-900 text-white py-12 px-6 rounded-xl shadow-2xl relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-10 right-10 w-40 h-40 bg-pink-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
              <Link href="/drinks">
                <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Drinks Hub
                </Button>
              </Link>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur group-hover:scale-110 transition-transform">
                  <Wine className="h-12 w-12" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-2">Potent Potables 🍸</h1>
                  <p className="text-xl text-purple-100">Explore 127 expertly crafted cocktails, mocktails, and specialty beverages</p>
                  <p className="text-sm text-purple-200 mt-1">From classic martinis to tropical tiki drinks - your mixology journey starts here</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all hover:scale-105 cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <Martini className="h-8 w-8 mx-auto mb-2 text-pink-300" />
                    <div className="text-2xl font-bold">127</div>
                    <div className="text-sm text-purple-100">Total Recipes</div>
                    <div className="text-xs text-purple-200 mt-1">Always growing</div>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all hover:scale-105 cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <Star className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                    <div className="text-2xl font-bold">4.8★</div>
                    <div className="text-sm text-purple-100">Avg Rating</div>
                    <div className="text-xs text-purple-200 mt-1">Highly rated</div>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all hover:scale-105 cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <Trophy className="h-8 w-8 mx-auto mb-2 text-orange-300" />
                    <div className="text-2xl font-bold">{userProgress.totalDrinksMade}</div>
                    <div className="text-sm text-purple-100">Cocktails Made</div>
                    <div className="text-xs text-purple-200 mt-1">Keep mixing!</div>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all hover:scale-105 cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <Heart className="h-8 w-8 mx-auto mb-2 text-red-300" />
                    <div className="text-2xl font-bold">{favorites.filter(f => f.category === 'potent-potables' || f.category === 'cocktails').length}</div>
                    <div className="text-sm text-purple-100">Favorites</div>
                    <div className="text-xs text-purple-200 mt-1">Your collection</div>
                  </CardContent>
                </Card>
              </div>

              <div className="max-w-md mx-auto mt-6 text-center">
                <Badge className="bg-orange-500 text-white text-xs px-4 py-1">
                  🔞 21+ Content • Please drink responsibly
                </Badge>
              </div>
            </div>
          </div>

          {/* Cross-Hub Navigation - CENTERED */}
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Home className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-800">Explore Other Drink Categories</h3>
              </div>
              <p className="text-center text-sm text-gray-600 mb-4">
                Discover healthy smoothies, powerful protein shakes, and cleansing detox drinks
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/drinks">
                  <Button variant="outline" className="gap-2 hover:bg-indigo-50 hover:border-indigo-300">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    All Drinks
                    <Badge variant="secondary" className="ml-1">400+</Badge>
                  </Button>
                </Link>
                <Link href="/drinks/smoothies">
                  <Button variant="outline" className="gap-2 hover:bg-purple-50 hover:border-purple-300">
                    <Apple className="w-4 h-4 text-purple-500" />
                    Smoothies
                    <Badge variant="secondary" className="ml-1">132</Badge>
                  </Button
