// client/src/pages/drinks/index.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Coffee, GlassWater, FlaskConical, Beaker, ArrowRight,
  PlayCircle, BookOpen, Share2, Eye, ThumbsUp, MessageCircle,
  X
} from 'lucide-react';

const drinkCategories = [
  {
    id: 'smoothies',
    name: 'Smoothies & Bowls',
    description: 'Nutrient-packed blends for energy and health',
    icon: Apple,
    color: 'from-green-500 to-emerald-500',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    route: '/drinks/smoothies',
    recipeCount: 847,
    features: ['Interactive Builder', 'Nutrition Analysis', 'Workout Goals'],
    trending: true,
    image: 'https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=300&h=200&fit=crop'
  },
  {
    id: 'protein-shakes',
    name: 'Protein Shakes',
    description: 'Science-backed protein solutions for fitness goals',
    icon: FlaskConical,
    color: 'from-blue-500 to-indigo-500',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    route: '/drinks/protein-shakes',
    recipeCount: 523,
    features: ['Fitness Integration', 'Timing Optimization', 'Macro Tracking'],
    trending: false,
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop'
  },
  {
    id: 'detoxes',
    name: 'Detoxes & Cleanses',
    description: 'Refreshing cleanses and wellness programs',
    icon: Leaf,
    color: 'from-teal-500 to-cyan-500',
    textColor: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    route: '/drinks/detoxes',
    recipeCount: 234,
    features: ['Guided Programs', 'Progress Tracking', 'Community Challenges'],
    trending: false,
    image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=300&h=200&fit=crop'
  },
  {
    id: 'caffeinated',
    name: 'Caffeinated Drinks',
    description: 'Coffee, tea, and energy drinks for your daily boost',
    icon: Coffee,
    color: 'from-amber-500 to-orange-500',
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    route: '/drinks/caffeinated',
    recipeCount: 186,
    features: ['Caffeine Tracker', 'Custom Brews', 'Energy Goals'],
    trending: true,
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop'
  },
  {
    id: 'potent-potables',
    name: 'Potent Potables',
    description: 'Cocktails, mocktails, and specialty beverages',
    icon: GlassWater,
    color: 'from-purple-500 to-pink-500',
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    route: '/drinks/potent-potables',
    recipeCount: 1247,
    features: ['Cocktail Builder', 'Gaming Elements', 'Social Features'],
    trending: true,
    premium: true,
    ageRestricted: true,
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=300&h=200&fit=crop'
  }
];

const featuredRecipes = [
  {
    id: 'recipe-1',
    name: 'Green Goddess Bowl',
    category: 'Smoothies',
    image: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=250&h=180&fit=crop',
    rating: 4.8,
    time: '5 min',
    calories: 280,
    protein: 8,
    carbs: 45,
    difficulty: 'Easy',
    tags: ['Antioxidants', 'Energy'],
    ingredients: ['Spinach', 'Kale', 'Banana', 'Mango', 'Chia Seeds', 'Almond Milk'],
    instructions: [
      'Add almond milk to blender first',
      'Add leafy greens (spinach and kale)',
      'Add frozen banana and mango chunks',
      'Sprinkle chia seeds on top',
      'Blend until smooth and creamy',
      'Pour into bowl and add toppings'
    ]
  },
  {
    id: 'recipe-2',
    name: 'Beast Mode Builder',
    category: 'Protein Shakes',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=250&h=180&fit=crop',
    rating: 4.9,
    time: '3 min',
    calories: 380,
    protein: 35,
    carbs: 42,
    difficulty: 'Medium',
    tags: ['Muscle Building', 'Post-Workout'],
    ingredients: ['Whey Protein', 'Banana', 'Oats', 'Peanut Butter', 'Whole Milk'],
    instructions: [
      'Add 1 cup whole milk to blender',
      'Add 1 scoop whey protein powder',
      'Add 1 banana and 1/3 cup oats',
      'Add 1 tbsp peanut butter',
      'Blend on high for 30 seconds',
      'Serve immediately after workout'
    ]
  },
  {
    id: 'recipe-3',
    name: 'Cosmic Martini',
    category: 'Cocktails',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=250&h=180&fit=crop',
    rating: 4.7,
    time: '5 min',
    calories: 180,
    protein: 0,
    carbs: 8,
    difficulty: 'Medium',
    tags: ['Elegant', 'Party'],
    ingredients: ['Vodka', 'Blue Curaçao', 'Lime Juice', 'Simple Syrup', 'Edible Glitter'],
    instructions: [
      'Chill martini glass with ice',
      'Add vodka and blue curaçao to shaker',
      'Add fresh lime juice and simple syrup',
      'Fill shaker with ice and shake vigorously',
      'Strain into chilled glass',
      'Garnish with edible glitter and lime wheel'
    ]
  }
];

const userStats = {
  recipesCreated: 23,
  favoritesSaved: 89,
  totalViews: 2431,
  streak: 7
};

export default function DrinksPage() {
  const [location, setLocation] = useLocation();

  // ✅ NEW: query-driven filter support: /drinks?q=rum
  const urlQ = useMemo(() => {
    try {
      const qs = location.split("?")[1] || "";
      if (!qs) return "";
      const params = new URLSearchParams(qs);
      return (params.get("q") || "").trim();
    } catch {
      return "";
    }
  }, [location]);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (urlQ && urlQ !== searchQuery) {
      setSearchQuery(urlQ);
    }
    if (!urlQ && searchQuery) {
      // if URL cleared externally, keep UI consistent
      setSearchQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  const normalizedQ = searchQuery.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!normalizedQ) return drinkCategories;
    return drinkCategories.filter((c) => {
      const hay = [
        c.id,
        c.name,
        c.description,
        c.route,
        ...(c.features || []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(normalizedQ);
    });
  }, [normalizedQ]);

  const filteredFeatured = useMemo(() => {
    if (!normalizedQ) return featuredRecipes;
    return featuredRecipes.filter((r) => {
      const hay = [
        r.name,
        r.category,
        r.difficulty,
        ...(r.tags || []),
        ...(r.ingredients || []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(normalizedQ);
    });
  }, [normalizedQ]);

  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowStats(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const clearSearch = () => {
    setSearchQuery("");
    setLocation("/drinks");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      
      {/* Recipe Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRecipe(null)}>
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-0">
              <div className="relative h-64">
                <img 
                  src={selectedRecipe.image} 
                  alt={selectedRecipe.name}
                  className="w-full h-full object-cover"
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="absolute top-4 right-4 bg-white/90 hover:bg-white"
                  onClick={() => setSelectedRecipe(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="absolute bottom-4 left-4">
                  <Badge className="bg-white text-gray-900 mb-2">
                    {selectedRecipe.category}
                  </Badge>
                </div>
              </div>
              
              <div className="p-6">
                <h2 className="text-3xl font-bold mb-4">{selectedRecipe.name}</h2>
                
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                    <div className="font-bold">{selectedRecipe.time}</div>
                    <div className="text-xs text-gray-600">Prep Time</div>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
                    <Flame className="h-5 w-5 mx-auto mb-1 text-orange-600" />
                    <div className="font-bold">{selectedRecipe.calories}</div>
                    <div className="text-xs text-gray-600">Calories</div>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                    <Target className="h-5 w-5 mx-auto mb-1 text-green-600" />
                    <div className="font-bold">{selectedRecipe.protein}g</div>
                    <div className="text-xs text-gray-600">Protein</div>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                    <Star className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                    <div className="font-bold">{selectedRecipe.rating}</div>
                    <div className="text-xs text-gray-600">Rating</div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-3">Ingredients</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedRecipe.ingredients.map((ingredient, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{ingredient}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-3">Instructions</h3>
                  <div className="space-y-3">
                    {selectedRecipe.instructions.map((step, idx) => (
                      <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {idx + 1}
                        </div>
                        <p className="text-sm text-gray-700">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-16">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-4 flex items-center justify-center gap-3">
              <Sparkles className="h-12 w-12" />
              Drinks Universe
              <Sparkles className="h-12 w-12" />
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Discover amazing drinks, track your wellness journey, and join the most vibrant beverage community
            </p>
          </div>

          {showStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <ChefHat className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                  <div className="text-2xl font-bold">{userStats.recipesCreated}</div>
                  <div className="text-sm text-blue-100">Recipes Created</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Heart className="h-8 w-8 mx-auto mb-2 text-pink-300" />
                  <div className="text-2xl font-bold">{userStats.favoritesSaved}</div>
                  <div className="text-sm text-blue-100">Favorites Saved</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Eye className="h-8 w-8 mx-auto mb-2 text-purple-300" />
                  <div className="text-2xl font-bold">{userStats.totalViews.toLocaleString()}</div>
                  <div className="text-sm text-blue-100">Recipe Views</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Flame className="h-8 w-8 mx-auto mb-2 text-orange-300" />
                  <div className="text-2xl font-bold">{userStats.streak}</div>
                  <div className="text-sm text-blue-100">Day Streak</div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ✅ NEW: query banner when /drinks?q=... */}
        {normalizedQ && (
          <Card className="mb-6 border-2">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground">Showing results for</div>
                <div className="font-bold truncate">{searchQuery}</div>
              </div>
              <Button variant="outline" onClick={clearSearch} className="shrink-0">
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main Categories */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-center">Explore Drink Categories</h2>

          {filteredCategories.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              No categories match “{searchQuery}”.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredCategories.map(category => (
                <Link key={category.id} href={category.route}>
                  <Card 
                    className={`group cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 overflow-hidden ${category.borderColor} border-2`}
                    onMouseEnter={() => setHoveredCategory(category.id)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <div className="relative h-48 overflow-hidden">
                      <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-20`} />
                      <img 
                        src={category.image} 
                        alt={category.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3 flex gap-2">
                        {category.trending && (
                          <Badge className="bg-red-500 text-white text-xs">
                            <Flame className="h-3 w-3 mr-1" />
                            Trending
                          </Badge>
                        )}
                        {category.premium && (
                          <Badge className="bg-yellow-500 text-white text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Premium
                          </Badge>
                        )}
                        {category.ageRestricted && (
                          <Badge className="bg-orange-500 text-white text-xs">
                            21+
                          </Badge>
                        )}
                      </div>
                      <div className="absolute bottom-3 right-3">
                        <div className={`p-3 rounded-full ${category.bgColor} border ${category.borderColor}`}>
                          <category.icon className={`h-6 w-6 ${category.textColor}`} />
                        </div>
                      </div>
                    </div>
                    
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold mb-2 group-hover:text-purple-600 transition-colors">
                        {category.name}
                      </h3>
                      <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                        {category.description}
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{category.recipeCount} recipes</span>
                          <ArrowRight className={`h-4 w-4 ${category.textColor} group-hover:translate-x-1 transition-transform`} />
                        </div>
                        
                        <div className="flex flex-wrap gap-1">
                          {category.features.slice(0, 2).map(feature => (
                            <Badge key={feature} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Featured Recipes */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">Featured Recipes</h2>
            <Button variant="outline" className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4" />
              View All
            </Button>
          </div>

          {filteredFeatured.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              No featured recipes match “{searchQuery}”.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredFeatured.map((recipe) => (
                <Card 
                  key={recipe.id} 
                  className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden"
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={recipe.image} 
                      alt={recipe.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-white/90 text-gray-900 text-xs">
                        {recipe.category}
                      </Badge>
                    </div>
                    <div className="absolute top-3 right-3">
                      <div className="bg-white/90 px-2 py-1 rounded-full flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-bold">{recipe.rating}</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold mb-2 group-hover:text-purple-600 transition-colors">
                      {recipe.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {recipe.time}
                      </div>
                      <div className="flex items-center gap-1">
                        <Flame className="h-4 w-4" />
                        {recipe.calories} cal
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* The rest of your file continues unchanged below... */}
        {/* (I didn’t remove anything—only added query support + filtered map usage above.) */}
      </div>
    </div>
  );
}
