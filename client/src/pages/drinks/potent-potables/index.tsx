import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import RequireAgeGate from "@/components/RequireAgeGate";
import {
  Sparkles, Clock, Users, Trophy, Heart, Star,
  Target, Flame, Droplets, Wine, ArrowRight,
  GlassWater, Martini, ChefHat, ArrowLeft, Home,
  FlaskConical, Leaf, Apple, Zap, Coffee, Dumbbell, TrendingUp
} from 'lucide-react';
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';
import RecipeKit from '@/components/recipes/RecipeKit';
import { otherDrinkHubs } from '../data/detoxes';

type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

const parseIngredient = (ingredient: string): Measured => {
  const fractionMap: Record<string, number> = { '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };
  const parts = ingredient.trim().replace(/\sof\s/i, ' ').replace(/[()]/g, '').split(/\s+/);
  if (parts.length < 2) return m('1', 'item', ingredient);
  let amountStr = parts[0];
  let amount: number | string = fractionMap[amountStr] ?? (isNaN(Number(amountStr)) ? amountStr : Number(amountStr));
  let unit = parts[1];
  let item = parts.slice(2).join(' ').trim();
  return m(amount, unit, item);
};

const potentPotablesSubcategories = [
  {
    id: 'vodka',
    name: 'Vodka',
    icon: Droplets,
    count: 12,
    route: '/drinks/potent-potables/vodka',
    description: 'Clean & versatile',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&h=400&fit=crop',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    textColor: 'text-cyan-600',
    trending: true,
    avgCalories: 180,
    avgTime: '3 min',
    topBenefit: 'Versatile Base'
  },
  {
    id: 'gin',
    name: 'Gin',
    icon: Droplets,
    count: 10,
    route: '/drinks/potent-potables/gin',
    description: 'Botanical spirits',
    image: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=600&h=400&fit=crop',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-600',
    featured: true,
    avgCalories: 170,
    avgTime: '4 min',
    topBenefit: 'Botanical Blend'
  },
  {
    id: 'whiskey-bourbon',
    name: 'Whiskey & Bourbon',
    icon: Wine,
    count: 12,
    route: '/drinks/potent-potables/whiskey-bourbon',
    description: 'Kentucky classics',
    image: 'https://images.unsplash.com/photo-1527281400098-808424fc2815?w=600&h=400&fit=crop',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-600',
    trending: true,
    avgCalories: 200,
    avgTime: '5 min',
    topBenefit: 'Classic Strength'
  },
  {
    id: 'tequila-mezcal',
    name: 'Tequila & Mezcal',
    icon: Flame,
    count: 12,
    route: '/drinks/potent-potables/tequila-mezcal',
    description: 'Agave spirits',
    image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&h=400&fit=crop',
    bgColor: 'bg-lime-50',
    borderColor: 'border-lime-200',
    textColor: 'text-lime-600',
    avgCalories: 190,
    avgTime: '3 min',
    topBenefit: 'Agave Power'
  },
  {
    id: 'rum',
    name: 'Rum',
    icon: GlassWater,
    count: 12,
    route: '/drinks/potent-potables/rum',
    description: 'Caribbean vibes',
    image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=400&fit=crop',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-600',
    featured: true,
    avgCalories: 210,
    avgTime: '6 min',
    topBenefit: 'Tropical Vibes'
  },
  {
    id: 'cognac-brandy',
    name: 'Cognac & Brandy',
    icon: Wine,
    count: 12,
    route: '/drinks/potent-potables/cognac-brandy',
    description: 'French elegance',
    image: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=600&h=400&fit=crop',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-600',
    avgCalories: 220,
    avgTime: '4 min',
    topBenefit: 'Refined Taste'
  },
  {
    id: 'daiquiri',
    name: 'Daiquiri',
    icon: Droplets,
    count: 8,
    route: '/drinks/potent-potables/daiquiri',
    description: 'Rum classics',
    image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&h=400&fit=crop',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    textColor: 'text-cyan-600',
    avgCalories: 160,
    avgTime: '3 min',
    topBenefit: 'Refreshing Citrus'
  },
  {
    id: 'martinis',
    name: 'Martinis',
    icon: Martini,
    count: 8,
    route: '/drinks/potent-potables/martinis',
    description: 'Timeless classics',
    image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&h=400&fit=crop',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-600',
    featured: true,
    avgCalories: 150,
    avgTime: '2 min',
    topBenefit: 'Sophisticated'
  },
  {
    id: 'scotch-irish-whiskey',
    name: 'Scotch & Irish',
    icon: Wine,
    count: 12,
    route: '/drinks/potent-potables/scotch-irish-whiskey',
    description: 'UK whiskeys',
    image: 'https://images.unsplash.com/photo-1582946526295-02e0d3a8fdd0?w=600&h=400&fit=crop',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-600',
    avgCalories: 195,
    avgTime: '4 min',
    topBenefit: 'Smoky Notes'
  },
  {
    id: 'liqueurs',
    name: 'Liqueurs',
    icon: Wine,
    count: 15,
    route: '/drinks/potent-potables/liqueurs',
    description: 'Sweet spirits',
    image: 'https://images.unsplash.com/photo-1560508801-bbaf5f39cb6a?w=600&h=400&fit=crop',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-600',
    avgCalories: 240,
    avgTime: '5 min',
    topBenefit: 'Sweet Indulgence'
  },
  {
    id: 'spritz',
    name: 'Spritz & Mimosas',
    icon: Sparkles,
    count: 10,
    route: '/drinks/potent-potables/spritz',
    description: 'Bubbly brunch',
    image: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=600&h=400&fit=crop',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-600',
    trending: true,
    avgCalories: 140,
    avgTime: '2 min',
    topBenefit: 'Bubbly Fun'
  },
  {
    id: 'hot-drinks',
    name: 'Hot Drinks',
    icon: Coffee,
    count: 8,
    route: '/drinks/potent-potables/hot-drinks',
    description: 'Warm cocktails',
    image: 'https://images.unsplash.com/photo-1574271143515-e7a6c1d6511c?w=600&h=400&fit=crop',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-600',
    avgCalories: 230,
    avgTime: '7 min',
    topBenefit: 'Cozy Warmth'
  },
  {
    id: 'cocktails',
    name: 'Classic Cocktails',
    icon: GlassWater,
    count: 15,
    route: '/drinks/potent-potables/cocktails',
    description: 'Timeless recipes',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&h=400&fit=crop',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-600',
    avgCalories: 185,
    avgTime: '4 min',
    topBenefit: 'Time Honored'
  },
  {
    id: 'seasonal',
    name: 'Seasonal',
    icon: Sparkles,
    count: 10,
    route: '/drinks/potent-potables/seasonal',
    description: 'Holiday specials',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&h=400&fit=crop',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-600',
    avgCalories: 175,
    avgTime: '5 min',
    topBenefit: 'Festive Spirit'
  },
  {
    id: 'mocktails',
    name: 'Mocktails',
    icon: Sparkles,
    count: 12,
    route: '/drinks/potent-potables/mocktails',
    description: 'Zero-proof',
    image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&h=400&fit=crop',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-600',
    featured: true,
    avgCalories: 120,
    avgTime: '4 min',
    topBenefit: 'Guilt Free'
  }
];

const featuredCocktails = [
  {
    id: 'featured-1', name: "Old Fashioned", spirit: "Whiskey", difficulty: "Easy", rating: 4.9, reviews: 5234, time: "5 min", prepTime: 5,
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop",
    tags: ['Classic', 'Strong', 'Sophisticated'],
    ingredients: ['2 oz Bourbon', '1 Sugar Cube', '2 dashes Angostura Bitters', 'Orange Peel', 'Maraschino Cherry', '1 Large Ice Cube'],
    instructions: 'Muddle sugar cube with bitters in glass. Add bourbon and large ice cube. Stir gently. Express orange peel over drink and garnish with cherry.',
    description: 'The grandfather of cocktails - bourbon, sugar, and bitters perfection'
  },
  {
    id: 'featured-2', name: "Margarita", spirit: "Tequila", difficulty: "Easy", rating: 4.8, reviews: 4892, time: "3 min", prepTime: 3,
    image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop",
    tags: ['Citrus', 'Refreshing', 'Party'],
    ingredients: ['2 oz Tequila', '1 oz Fresh Lime Juice', '0.75 oz Triple Sec', '0.5 oz Simple Syrup', 'Salt for rim', 'Lime Wheel'],
    instructions: 'Rim glass with salt. Shake tequila, lime juice, triple sec, and simple syrup with ice. Strain into glass with fresh ice. Garnish with lime wheel.',
    description: 'The ultimate party cocktail - tequila, lime, and a salted rim'
  },
  {
    id: 'featured-3', name: "Mojito", spirit: "Rum", difficulty: "Medium", rating: 4.7, reviews: 3654, time: "7 min", prepTime: 7,
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
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const cocktailsWithMeasurements = useMemo(() => {
    return featuredCocktails.map((c) => {
      const measurements = c.ingredients.map((ing: string) => parseIngredient(ing));
      return { ...c, recipe: { servings: 1, measurements, directions: [c.instructions] } };
    });
  }, []);

  const openRecipeModal = (cocktail: any) => {
    const cocktailWithRecipe = cocktailsWithMeasurements.find(c => c.id === cocktail.id);
    setSelectedRecipe(cocktailWithRecipe);
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
        {selectedRecipe && (
          <RecipeKit open={showKit} onClose={() => { setShowKit(false); setSelectedRecipe(null); }} accent="purple" pointsReward={35} onComplete={handleCompleteRecipe}
            item={{ id: selectedRecipe.id, name: selectedRecipe.name, prepTime: selectedRecipe.prepTime, directions: selectedRecipe.recipe?.directions || [], 
              measurements: selectedRecipe.recipe?.measurements || [], baseNutrition: {}, defaultServings: 1 }} />
        )}

        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
          <div className="bg-gradient-to-r from-red-700 via-purple-800 to-gray-900 text-white py-12 px-6 rounded-xl shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-10 right-10 w-40 h-40 bg-pink-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
              <Link href="/drinks">
                <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
                  <ArrowLeft className="mr-2 h-4 w-4" />Back to Drinks Hub
                </Button>
              </Link>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur hover:scale-110 transition-transform">
                  <Wine className="h-12 w-12" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-2">Potent Potables 🍸</h1>
                  <p className="text-xl text-purple-100">Explore 168 expertly crafted cocktails, mocktails, and specialty beverages</p>
                  <p className="text-sm text-purple-200 mt-1">From classic martinis to tropical tiki drinks - your mixology journey starts here</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Martini, value: '168', label: 'Total Recipes', sublabel: 'Always growing', color: 'text-pink-300' },
                  { icon: Star, value: '4.8★', label: 'Avg Rating', sublabel: 'Highly rated', color: 'text-yellow-300' },
                  { icon: Trophy, value: userProgress.totalDrinksMade, label: 'Cocktails Made', sublabel: 'Keep mixing!', color: 'text-orange-300' },
                  { icon: Heart, value: favorites.filter(f => f.category === 'potent-potables' || f.category === 'cocktails').length, label: 'Favorites', sublabel: 'Your collection', color: 'text-red-300' }
                ].map((stat, idx) => (
                  <Card key={idx} className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all hover:scale-105 cursor-pointer group">
                    <CardContent className="p-4 text-center">
                      <stat.icon className={`h-8 w-8 mx-auto mb-2 ${stat.color} ${idx === 0 ? 'group-hover:rotate-12' : idx === 1 ? 'group-hover:rotate-180' : 'group-hover:scale-110'} transition-transform`} />
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-sm text-purple-100">{stat.label}</div>
                      <div className="text-xs text-purple-200 mt-1">{stat.sublabel}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="max-w-md mx-auto mt-6 text-center">
                <Badge className="bg-orange-500 text-white text-xs px-4 py-1 hover:bg-orange-600 transition-colors">
                  🔞 21+ Content • Please drink responsibly
                </Badge>
              </div>
            </div>
          </div>

          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <GlassWater className="h-6 w-6 text-purple-600" />
                Explore Other Drink Categories
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {otherDrinkHubs.filter(hub => hub.id !== 'potent-potables').map((hub) => {
                  const Icon = hub.icon;
                  return (
                    <Link key={hub.id} href={hub.route}>
                      <Button
                        variant="outline"
                        className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:bg-white hover:shadow-lg transition-all"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className={`p-2 ${hub.color} rounded-lg`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="font-bold text-base">{hub.name}</div>
                            <div className="text-xs text-gray-600">{hub.description}</div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="text-xs text-gray-500 ml-11">{hub.count}</div>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="max-w-2xl mx-auto">
            <UniversalSearch onSelectDrink={(drink) => console.log('Selected:', drink)} placeholder="Search all drinks or find cocktail inspiration..." className="w-full" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <GlassWater className="h-6 w-6 text-purple-600" />
              Browse Spirit Categories
            </h2>
            <div className="grid md:grid-cols-5 gap-6">
              {potentPotablesSubcategories.map((category) => {
                const Icon = category.icon;
                return (
                  <Link key={category.id} href={category.route}>
                    <Card
                      className={`cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${category.borderColor} overflow-hidden`}
                      onMouseEnter={() => setHoveredCard(category.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <div className="relative h-48 overflow-hidden">
                        {category.image && (
                          <img
                            src={category.image}
                            alt={category.name}
                            className={`w-full h-full object-cover transition-transform duration-300 ${
                              hoveredCard === category.id ? 'scale-110' : 'scale-100'
                            }`}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                        {category.trending && (
                          <div className="absolute top-3 left-3">
                            <Badge className="bg-orange-500 text-white border-0">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Trending
                            </Badge>
                          </div>
                        )}

                        {category.featured && (
                          <div className="absolute top-3 left-3">
                            <Badge className="bg-purple-500 text-white border-0">
                              <Star className="h-3 w-3 mr-1" />
                              Featured
                            </Badge>
                          </div>
                        )}

                        <div className="absolute bottom-3 right-3">
                          <div className={`p-2 bg-white/90 rounded-full`}>
                            <Icon className={`h-5 w-5 ${category.textColor}`} />
                          </div>
                        </div>
                      </div>

                      <CardHeader>
                        <CardTitle className="text-xl flex items-center justify-between">
                          {category.name}
                          <Badge variant="outline">{category.count} recipes</Badge>
                        </CardTitle>
                        <p className="text-gray-600">{category.description}</p>
                      </CardHeader>

                      <CardContent>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className={`text-center p-3 rounded-lg ${category.bgColor} aspect-square flex flex-col items-center justify-center w-full`}>
                            <div className={`text-lg font-bold ${category.textColor}`}>{category.avgCalories}</div>
                            <div className="text-xs text-gray-600 whitespace-nowrap">Calories</div>
                          </div>
                          <div className={`text-center p-3 rounded-lg ${category.bgColor} aspect-square flex flex-col items-center justify-center w-full`}>
                            <div className={`text-lg font-bold ${category.textColor}`}>{category.avgTime}</div>
                            <div className="text-xs text-gray-600 whitespace-nowrap">Prep Time</div>
                          </div>
                          <div className={`text-center p-3 rounded-lg ${category.bgColor} aspect-square flex flex-col items-center justify-center w-full`}>
                            <div className={`text-lg font-bold ${category.textColor}`}>
                              <Trophy className="h-5 w-5 mx-auto" />
                            </div>
                            <div className="text-xs text-gray-600 whitespace-nowrap">Top Rated</div>
                          </div>
                        </div>

                        <div className={`flex items-center gap-2 p-2 rounded ${category.bgColor}`}>
                          <Target className={`h-4 w-4 ${category.textColor}`} />
                          <span className="text-sm font-medium">{category.topBenefit}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          {favorites.filter(f => f.category === 'potent-potables' || f.category === 'cocktails').length > 0 && (
            <Card className="bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-purple-500 fill-purple-500" />
                  Your Favorite Cocktails ({favorites.filter(f => f.category === 'potent-potables' || f.category === 'cocktails').length})
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {favorites.filter(f => f.category === 'potent-potables' || f.category === 'cocktails').slice(0, 5).map((drink) => (
                    <div key={drink.id} className="flex-shrink-0 bg-white rounded-lg p-3 shadow-sm min-w-[200px] hover:shadow-md transition-shadow">
                      <div className="font-medium text-sm mb-1">{drink.name}</div>
                      <div className="text-xs text-gray-600 mb-2">Cocktail</div>
                      <Button size="sm" variant="outline" className="w-full text-xs hover:bg-purple-50">
                        <Zap className="w-3 h-3 mr-1" />Make Again
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
                <Star className="w-7 h-7 text-yellow-500 fill-yellow-500" />Featured Cocktails
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Try these crowd favorites - perfectly balanced, easy to make, and guaranteed to impress
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredCocktails.map((cocktail) => (
                <Card key={cocktail.id} className="overflow-hidden hover:shadow-2xl transition-all hover:scale-105 cursor-pointer group" onClick={() => openRecipeModal(cocktail)}>
                  <div className="relative">
                    <img src={cocktail.image} alt={cocktail.name} className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-2">
                      <Badge className="bg-purple-500 text-white">{cocktail.spirit}</Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Button variant="ghost" size="sm" className="bg-white/80 hover:bg-white text-gray-600"
                        onClick={(e) => { e.stopPropagation(); addToFavorites({ id: cocktail.id, name: cocktail.name, category: 'cocktails', timestamp: Date.now() }); }}>
                        <Heart className={`h-4 w-4 ${isFavorite(cocktail.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold group-hover:text-purple-600 transition-colors">{cocktail.name}</h3>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="text-sm font-bold">{cocktail.rating}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{cocktail.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1"><Clock className="w-4 h-4" /><span>{cocktail.time}</span></div>
                      <div className="flex items-center gap-1"><Users className="w-4 h-4" /><span>{cocktail.reviews.toLocaleString()}</span></div>
                      <Badge variant="outline">{cocktail.difficulty}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {cocktail.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                    </div>
                    <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 group-hover:scale-105 transition-transform">
                      View Recipe
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="bg-gradient-to-r from-purple-50 to-orange-50 border-purple-200">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
                  <ChefHat className="w-6 h-6 text-purple-600" />Mixology 101
                </h3>
                <p className="text-gray-600 max-w-2xl mx-auto">Master the fundamentals of cocktail making with these essential tips and techniques</p>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { title: 'Essential Techniques', icon: Target, color: 'purple', items: [
                    { label: 'Shaking vs Stirring', desc: 'Shake fruity drinks, stir spirit-forward cocktails' },
                    { label: 'Muddling', desc: 'Gently press herbs to release oils without bitterness' },
                    { label: 'Building', desc: 'Layer ingredients directly in the serving glass' },
                    { label: 'Garnishing', desc: 'Add visual appeal and aromatic elements' }
                  ]},
                  { title: 'Bar Essentials', icon: Wine, color: 'orange', items: [
                    { label: 'Quality spirits', desc: 'Invest in good base liquors' },
                    { label: 'Fresh citrus', desc: 'Always juice lemons and limes fresh' },
                    { label: 'Simple syrup', desc: 'Make your own 1:1 sugar-water ratio' },
                    { label: 'Bitters', desc: 'Build a collection of aromatic flavors' }
                  ]},
                  { title: 'Pro Tips', icon: Sparkles, color: 'pink', items: [
                    { label: 'Fresh ingredients', desc: 'Quality in = quality out' },
                    { label: 'Measure accurately', desc: 'Use a jigger for consistency' },
                    { label: 'Chill glassware', desc: 'Keep glasses in freezer for best results' },
                    { label: 'Taste and adjust', desc: 'Balance sweet, sour, and spirit to preference' }
                  ]}
                ].map((section) => (
                  <div key={section.title} className="bg-white/50 rounded-lg p-4 hover:bg-white transition-colors">
                    <h4 className={`font-semibold mb-3 text-${section.color}-600 flex items-center gap-2`}>
                      <section.icon className="w-5 h-5" />{section.title}
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-2">
                      {section.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className={`text-${section.color}-500 mt-0.5`}>•</span>
                          <span><strong>{item.label}:</strong> {item.desc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <h3 className="text-lg font-bold mb-2">Explore More Drinks</h3>
                  <p className="text-gray-600 mb-4">Discover smoothies, protein shakes, and detoxes to balance your cocktail adventures</p>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    {[
                      { href: '/drinks/smoothies', icon: Apple, label: 'Smoothies' },
                      { href: '/drinks/protein-shakes', icon: FlaskConical, label: 'Protein Shakes' },
                      { href: '/drinks/detoxes', icon: Leaf, label: 'Detoxes' }
                    ].map((item) => (
                      <Link key={item.href} href={item.href}>
                        <Button variant="outline" size="sm" className="hover:bg-purple-50">
                          <item.icon className="w-4 h-4 mr-1" />{item.label}
                        </Button>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="text-center bg-white rounded-lg p-4 shadow-sm">
                  <Trophy className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <div className="text-3xl font-bold text-purple-600 mb-1">{userProgress.totalDrinksMade}</div>
                  <div className="text-sm text-gray-600 mb-2">Total Drinks Made</div>
                  <Progress value={userProgress.dailyGoalProgress} className="w-32 mb-2" />
                  <div className="text-xs text-gray-500">Daily Goal: {userProgress.dailyGoalProgress}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAgeGate>
  );
}
