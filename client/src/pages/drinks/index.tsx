import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
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
  Wine, Martini
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

// NEW: Quick Links to Spirit Pages
const spiritLinks = [
  { name: 'Vodka', route: '/drinks/potent-potables/vodka', icon: Droplets },
  { name: 'Whiskey & Bourbon', route: '/drinks/potent-potables/whiskey-bourbon', icon: Wine },
  { name: 'Tequila & Mezcal', route: '/drinks/potent-potables/tequila-mezcal', icon: Flame },
  { name: 'Rum', route: '/drinks/potent-potables/rum', icon: GlassWater },
  { name: 'Cognac & Brandy', route: '/drinks/potent-potables/cognac-brandy', icon: Wine },
  { name: 'Scotch & Irish', route: '/drinks/potent-potables/scotch-irish-whiskey', icon: Wine },
  { name: 'Virgin Cocktails', route: '/drinks/virgin-cocktails', icon: Sparkles }
];

const featuredRecipes = [
  {
    name: 'Green Goddess Bowl',
    category: 'Smoothies',
    image: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=250&h=180&fit=crop',
    rating: 4.8,
    time: '5 min',
    calories: 280,
    difficulty: 'Easy',
    tags: ['Antioxidants', 'Energy']
  },
  {
    name: 'Beast Mode Builder',
    category: 'Protein Shakes',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=250&h=180&fit=crop',
    rating: 4.9,
    time: '3 min',
    calories: 380,
    difficulty: 'Medium',
    tags: ['Muscle Building', 'Post-Workout']
  },
  {
    name: 'Cosmic Martini',
    category: 'Cocktails',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=250&h=180&fit=crop',
    rating: 4.7,
    time: '5 min',
    calories: 180,
    difficulty: 'Medium',
    tags: ['Elegant', 'Party']
  }
];

const userStats = {
  recipesCreated: 23,
  favoritesSaved: 89,
  totalViews: 2431,
  streak: 7
};

export default function DrinksPage() {
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowStats(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-4 flex items-center justify-center gap-4">
              <Droplets className="h-12 w-12" />
              Drinks Hub
            </h1>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Your ultimate destination for smoothies, protein shakes, detoxes, and cocktails
            </p>
          </div>

          {/* NEW: Quick Spirit Links */}
          <div className="mb-8">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold opacity-90">Browse Spirits</h3>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {spiritLinks.map(spirit => {
                const Icon = spirit.icon;
                return (
                  <Link key={spirit.route} href={spirit.route}>
                    <Button 
                      variant="outline" 
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-white/50 transition-all"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {spirit.name}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Quick Stats */}
          {showStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold">{userStats.recipesCreated}</div>
                <div className="text-sm opacity-80">Recipes Created</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{userStats.favoritesSaved}</div>
                <div className="text-sm opacity-80">Favorites Saved</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{userStats.totalViews.toLocaleString()}</div>
                <div className="text-sm opacity-80">Recipe Views</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold flex items-center justify-center gap-1">
                  <Flame className="h-6 w-6" />
                  {userStats.streak}
                </div>
                <div className="text-sm opacity-80">Day Streak</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Main Categories */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-center">Explore Drink Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {drinkCategories.map(category => (
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredRecipes.map((recipe, index) => (
              <Card key={index} className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
                <div className="relative h-40 overflow-hidden">
                  <img 
                    src={recipe.image} 
                    alt={recipe.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-white/90 text-gray-800 text-xs">
                      {recipe.category}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2 group-hover:text-purple-600 transition-colors">
                    {recipe.name}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {recipe.rating}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {recipe.time}
                    </span>
                    <span>{recipe.calories} cal</span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {recipe.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{recipe.difficulty}</Badge>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost">
                        <Heart className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <Plus className="h-12 w-12 mx-auto mb-4 text-blue-500" />
              <h3 className="text-xl font-semibold mb-2">Create Recipe</h3>
              <p className="text-gray-600 mb-4">Share your own drink creations</p>
              <Button className="w-full">Get Started</Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-xl font-semibold mb-2">Recipe Collection</h3>
              <p className="text-gray-600 mb-4">Browse your saved favorites</p>
              <Button variant="outline" className="w-full">View Collection</Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-purple-500" />
              <h3 className="text-xl font-semibold mb-2">Community</h3>
              <p className="text-gray-600 mb-4">Connect with other drink enthusiasts</p>
              <Button variant="outline" className="w-full">Join Community</Button>
            </CardContent>
          </Card>
        </div>

        {/* Bottom CTA */}
        <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Mix Things Up?</h2>
            <p className="text-xl opacity-90 mb-6">
              Discover thousands of recipes, build custom drinks, and join our community
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100">
                <Sparkles className="h-5 w-5 mr-2" />
                Start Exploring
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <PlayCircle className="h-5 w-5 mr-2" />
                Watch Tutorial
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
