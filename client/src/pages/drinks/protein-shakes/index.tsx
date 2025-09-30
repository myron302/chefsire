import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from 'wouter';
import { 
  Dumbbell, Zap, Clock, Users, Trophy, Heart, Star, 
  Flame, Target, Award, TrendingUp, Activity, Sparkles,
  ArrowLeft, Milk, Apple, Leaf, Droplets, Timer
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';

export default function ProteinShakesHub() {
  const { userProgress, addDrinkToJournal } = useDrinks();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const categories = [
    {
      id: 'high-protein',
      name: 'High-Protein Smoothies',
      description: '25g+ protein per serving for serious muscle building',
      icon: Dumbbell,
      image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&h=400&fit=crop',
      path: '/drinks/protein-shakes/high-protein',
      count: 24,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-600',
      trending: true,
      avgProtein: '28g',
      avgCalories: 350,
      topBenefit: 'Muscle Building'
    },
    {
      id: 'post-workout',
      name: 'Post-Workout Recovery',
      description: 'Optimal recovery with protein and carbs',
      icon: Zap,
      image: 'https://images.unsplash.com/photo-1622484211850-cc4be63b3780?w=600&h=400&fit=crop',
      path: '/drinks/protein-shakes/post-workout',
      count: 18,
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-600',
      featured: true,
      avgProtein: '25g',
      avgCalories: 400,
      topBenefit: 'Fast Recovery'
    },
    {
      id: 'meal-replacement',
      name: 'Meal Replacement Shakes',
      description: 'Complete nutrition in a convenient shake',
      icon: Apple,
      image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=600&h=400&fit=crop',
      path: '/drinks/protein-shakes/meal-replacement',
      count: 20,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-600',
      avgProtein: '22g',
      avgCalories: 450,
      topBenefit: 'Balanced Nutrition'
    },
    {
      id: 'weight-loss',
      name: 'Weight Loss Shakes',
      description: 'Low-calorie, high-protein for fat loss',
      icon: Target,
      image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&h=400&fit=crop',
      path: '/drinks/protein-shakes/weight-loss',
      count: 16,
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-600',
      trending: true,
      avgProtein: '24g',
      avgCalories: 250,
      topBenefit: 'Fat Burning'
    },
    {
      id: 'plant-based',
      name: 'Plant-Based Protein',
      description: 'Vegan protein from plants only',
      icon: Leaf,
      image: 'https://images.unsplash.com/photo-1600718374662-0483d2b88379?w=600&h=400&fit=crop',
      path: '/drinks/protein-shakes/plant-based',
      count: 22,
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-600',
      avgProtein: '20g',
      avgCalories: 300,
      topBenefit: '100% Vegan'
    },
    {
      id: 'performance',
      name: 'Athletic Performance',
      description: 'Enhanced formulas for peak performance',
      icon: Activity,
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
      path: '/drinks/protein-shakes/performance',
      count: 15,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-600',
      featured: true,
      avgProtein: '30g',
      avgCalories: 380,
      topBenefit: 'Peak Performance'
    }
  ];

  const quickStats = [
    { label: 'Total Recipes', value: '115', icon: Trophy, color: 'text-yellow-600' },
    { label: 'Avg Protein', value: '25g', icon: Dumbbell, color: 'text-blue-600' },
    { label: 'Your Shakes', value: userProgress.totalDrinksMade, icon: Star, color: 'text-purple-600' },
    { label: 'Calories Range', value: '250-450', icon: Flame, color: 'text-orange-600' }
  ];

  const popularRecipes = [
    { name: 'Chocolate PB Power', protein: '32g', time: '3 min', rating: 4.9 },
    { name: 'Vanilla Berry Blast', protein: '28g', time: '4 min', rating: 4.8 },
    { name: 'Green Machine', protein: '24g', time: '5 min', rating: 4.7 },
    { name: 'Tropical Thunder', protein: '26g', time: '3 min', rating: 4.9 }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <Link href="/drinks">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Drinks Hub
            </Button>
          </Link>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <Dumbbell className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-5xl font-bold mb-2">Protein Shakes Hub</h1>
              <p className="text-xl text-blue-100">Fuel Your Fitness Goals</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {quickStats.map((stat, index) => (
              <Card key={index} className="bg-white/10 backdrop-blur border-white/20">
                <CardContent className="p-4 text-center">
                  <stat.icon className={`h-8 w-8 mx-auto mb-2 ${stat.color}`} />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-blue-100">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Quick Navigation */}
        <Card className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Target className="h-6 w-6 text-blue-600" />
              Find Your Perfect Shake
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button variant="outline" className="justify-start">
                <Dumbbell className="mr-2 h-4 w-4" />
                Muscle Building
              </Button>
              <Button variant="outline" className="justify-start">
                <Zap className="mr-2 h-4 w-4" />
                Energy Boost
              </Button>
              <Button variant="outline" className="justify-start">
                <Target className="mr-2 h-4 w-4" />
                Weight Loss
              </Button>
              <Button variant="outline" className="justify-start">
                <Leaf className="mr-2 h-4 w-4" />
                Plant-Based
              </Button>
              <Button variant="outline" className="justify-start">
                <Clock className="mr-2 h-4 w-4" />
                Quick & Easy
              </Button>
              <Button variant="outline" className="justify-start">
                <Heart className="mr-2 h-4 w-4" />
                Low Calorie
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Category Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {categories.map((category) => (
            <Link key={category.id} href={category.path}>
              <Card 
                className={`cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${category.borderColor} overflow-hidden`}
                onMouseEnter={() => setHoveredCard(category.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="relative h-48 overflow-hidden">
                  {category.image ? (
                    <img 
                      src={category.image} 
                      alt={category.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    {category.trending && (
                      <Badge className="bg-red-500 text-white text-xs">
                        <Flame className="h-3 w-3 mr-1" />
                        Trending
                      </Badge>
                    )}
                    {category.featured && (
                      <Badge className="bg-yellow-500 text-white text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                    )}
                  </div>
                  <div className="absolute bottom-3 right-3">
                    <div className={`p-3 rounded-full ${category.bgColor} border ${category.borderColor}`}>
                      <category.icon className={`h-6 w-6 ${category.textColor}`} />
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
                    <div className={`text-center p-3 rounded-lg ${category.bgColor}`}>
                      <div className={`text-lg font-bold ${category.textColor}`}>{category.avgProtein}</div>
                      <div className="text-xs text-gray-600">Protein</div>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${category.bgColor}`}>
                      <div className={`text-lg font-bold ${category.textColor}`}>{category.avgCalories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${category.bgColor}`}>
                      <div className={`text-lg font-bold ${category.textColor}`}>
                        <Trophy className="h-5 w-5 mx-auto" />
                      </div>
                      <div className="text-xs text-gray-600">Top Rated</div>
                    </div>
                  </div>

                  <div className={`flex items-center gap-2 p-2 rounded ${category.bgColor}`}>
                    <Target className={`h-4 w-4 ${category.textColor}`} />
                    <span className="text-sm font-medium">{category.topBenefit}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Popular Recipes */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-orange-500" />
              Most Popular This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {popularRecipes.map((recipe, index) => (
                <div key={index} className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className="bg-blue-500 text-white">#{index + 1}</Badge>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{recipe.rating}</span>
                    </div>
                  </div>
                  <h3 className="font-bold mb-2">{recipe.name}</h3>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Dumbbell className="h-3 w-3" />
                      {recipe.protein}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {recipe.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Protein Guide */}
        <Card className="mb-8 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-600" />
              Protein Intake Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-blue-600">Muscle Building</h4>
                <p className="text-sm text-gray-700 mb-2">1.6-2.2g per kg body weight</p>
                <Progress value={80} className="h-2" />
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-green-600">Weight Loss</h4>
                <p className="text-sm text-gray-700 mb-2">1.2-1.6g per kg body weight</p>
                <Progress value={60} className="h-2" />
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-purple-600">Maintenance</h4>
                <p className="text-sm text-gray-700 mb-2">0.8-1.2g per kg body weight</p>
                <Progress value={40} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips Section */}
        <Card className="bg-gradient-to-r from-orange-50 to-pink-50 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-6 w-6 text-orange-500" />
              Pro Tips for Perfect Shakes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-blue-600">Timing Matters</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Within 30 min post-workout for recovery</li>
                  <li>• Morning for sustained energy</li>
                  <li>• Between meals to increase protein</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-purple-600">Maximize Results</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Use frozen fruit for thickness</li>
                  <li>• Add healthy fats for satiety</li>
                  <li>• Blend with ice for volume</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
