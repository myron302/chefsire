import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from 'wouter';
import { 
  Droplets, Leaf, Heart, Sparkles, Clock, Users, Trophy, 
  Star, Flame, Target, Award, TrendingUp, Activity, Zap,
  ArrowLeft, Apple, Sun, Moon, Wind, FlaskConical
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';

export default function DetoxesHub() {
  const { userProgress, addDrinkToJournal } = useDrinks();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const categories = [
    {
      id: 'juice-cleanse',
      name: 'Detox Juices',
      description: 'Cold-pressed juices for deep cleansing',
      icon: Apple,
      image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&h=400&fit=crop',
      path: '/drinks/detoxes/juice',
      count: 32,
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-600',
      trending: true,
      avgCalories: 120,
      duration: '1-3 days',
      topBenefit: 'Deep Cleanse'
    },
    {
      id: 'detox-tea',
      name: 'Detox Teas',
      description: 'Herbal infusions for gentle detoxification',
      icon: Leaf,
      image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&h=400&fit=crop',
      path: '/drinks/detoxes/tea',
      count: 28,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-600',
      featured: true,
      avgCalories: 5,
      duration: 'Daily',
      topBenefit: 'Gentle Detox'
    },
    {
      id: 'infused-water',
      name: 'Detox Infused Waters',
      description: 'Fruit and herb infused hydration',
      icon: Droplets,
      image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600&h=400&fit=crop',
      path: '/drinks/detoxes/water',
      count: 24,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-600',
      avgCalories: 15,
      duration: 'All Day',
      topBenefit: 'Hydration'
    },
    {
      id: 'morning-detox',
      name: 'Morning Detox Drinks',
      description: 'Start your day with cleansing elixirs',
      icon: Sun,
      image: 'https://images.unsplash.com/photo-1587080266227-677cc2a4e76e?w=600&h=400&fit=crop',
      path: '/drinks/detoxes/morning',
      count: 20,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-600',
      trending: true,
      avgCalories: 45,
      duration: 'Morning',
      topBenefit: 'Metabolism Boost'
    },
    {
      id: 'liver-cleanse',
      name: 'Liver Cleanse',
      description: 'Support liver function naturally',
      icon: Heart,
      image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600&h=400&fit=crop',
      path: '/drinks/detoxes/liver',
      count: 18,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-600',
      avgCalories: 80,
      duration: '3-7 days',
      topBenefit: 'Liver Support'
    },
    {
      id: 'colon-cleanse',
      name: 'Colon Cleanse',
      description: 'Digestive system reset formulas',
      icon: Activity,
      image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&h=400&fit=crop',
      path: '/drinks/detoxes/colon',
      count: 16,
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-600',
      featured: true,
      avgCalories: 60,
      duration: '1-2 days',
      topBenefit: 'Gut Health'
    }
  ];

  const quickStats = [
    { label: 'Total Recipes', value: '138', icon: Trophy, color: 'text-yellow-600' },
    { label: 'Avg Calories', value: '65', icon: Flame, color: 'text-orange-600' },
    { label: 'Your Detoxes', value: userProgress.totalDrinksMade, icon: Star, color: 'text-purple-600' },
    { label: 'Cleanse Programs', value: '12', icon: Target, color: 'text-green-600' }
  ];

  const popularDetoxes = [
    { name: 'Lemon Ginger Blast', type: 'Morning', time: '5 min', rating: 4.9 },
    { name: 'Green Machine', type: 'Juice', time: '10 min', rating: 4.8 },
    { name: 'Cucumber Mint Water', type: 'Water', time: '2 min', rating: 4.9 },
    { name: 'Dandelion Tea', type: 'Tea', time: '8 min', rating: 4.7 }
  ];

  const cleanseBenefits = [
    { icon: Droplets, title: 'Hydration', description: 'Flush toxins with optimal hydration' },
    { icon: Leaf, title: 'Natural Ingredients', description: '100% organic fruits, herbs, and vegetables' },
    { icon: Zap, title: 'Energy Boost', description: 'Feel revitalized and refreshed' },
    { icon: Heart, title: 'Organ Support', description: 'Support liver, kidney, and digestive health' },
    { icon: Sparkles, title: 'Clear Skin', description: 'Achieve glowing, radiant complexion' },
    { icon: Target, title: 'Weight Management', description: 'Jumpstart healthy weight goals' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <Link href="/drinks">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Drinks Hub
            </Button>
          </Link>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <Sparkles className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-5xl font-bold mb-2">Detox Hub</h1>
              <p className="text-xl text-green-100">Cleanse, Refresh, Revitalize</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {quickStats.map((stat, index) => (
              <Card key={index} className="bg-white/10 backdrop-blur border-white/20">
                <CardContent className="p-4 text-center">
                  <stat.icon className={`h-8 w-8 mx-auto mb-2 ${stat.color}`} />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-green-100">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Quick Navigation */}
        <Card className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Target className="h-6 w-6 text-green-600" />
              Choose Your Detox Goal
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button variant="outline" className="justify-start">
                <Droplets className="mr-2 h-4 w-4" />
                Deep Cleanse
              </Button>
              <Button variant="outline" className="justify-start">
                <Zap className="mr-2 h-4 w-4" />
                Energy Boost
              </Button>
              <Button variant="outline" className="justify-start">
                <Heart className="mr-2 h-4 w-4" />
                Organ Support
              </Button>
              <Button variant="outline" className="justify-start">
                <Sparkles className="mr-2 h-4 w-4" />
                Glowing Skin
              </Button>
              <Button variant="outline" className="justify-start">
                <Target className="mr-2 h-4 w-4" />
                Weight Loss
              </Button>
              <Button variant="outline" className="justify-start">
                <Leaf className="mr-2 h-4 w-4" />
                Gentle Daily
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
                      <div className={`text-lg font-bold ${category.textColor}`}>{category.avgCalories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${category.bgColor}`}>
                      <div className={`text-lg font-bold ${category.textColor}`}>{category.duration}</div>
                      <div className="text-xs text-gray-600">Duration</div>
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

        {/* Popular Detoxes */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-500" />
              Most Popular This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {popularDetoxes.map((detox, index) => (
                <div key={index} className="p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className="bg-green-500 text-white">#{index + 1}</Badge>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{detox.rating}</span>
                    </div>
                  </div>
                  <h3 className="font-bold mb-2">{detox.name}</h3>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Leaf className="h-3 w-3" />
                      {detox.type}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {detox.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Benefits Grid */}
        <Card className="mb-8 bg-gradient-to-br from-green-50 to-teal-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-green-600" />
              Detox Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cleanseBenefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <benefit.icon className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{benefit.title}</h4>
                    <p className="text-sm text-gray-600">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cleanse Programs */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-blue-600" />
              Popular Cleanse Programs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-green-600 mb-1">1 Day</div>
                  <div className="text-sm text-gray-600">Quick Reset</div>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-green-600" />
                    6 juice servings
                  </li>
                  <li className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-green-600" />
                    Herbal teas
                  </li>
                  <li className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-green-600" />
                    Gentle cleanse
                  </li>
                </ul>
                <Button className="w-full mt-4 bg-green-600 hover:bg-green-700">
                  Start 1-Day Cleanse
                </Button>
              </div>

              <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-400 relative">
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white">
                  Most Popular
                </Badge>
                <div className="text-center mb-4 mt-2">
                  <div className="text-3xl font-bold text-blue-600 mb-1">3 Days</div>
                  <div className="text-sm text-gray-600">Deep Cleanse</div>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-600" />
                    18 juice servings
                  </li>
                  <li className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-blue-600" />
                    Daily teas
                  </li>
                  <li className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-blue-600" />
                    Full body reset
                  </li>
                </ul>
                <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
                  Start 3-Day Cleanse
                </Button>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-purple-600 mb-1">7 Days</div>
                  <div className="text-sm text-gray-600">Complete Reset</div>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-purple-600" />
                    42 juice servings
                  </li>
                  <li className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-purple-600" />
                    Herbal regimen
                  </li>
                  <li className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-purple-600" />
                    Total transformation
                  </li>
                </ul>
                <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700">
                  Start 7-Day Cleanse
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips Section */}
        <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-6 w-6 text-orange-500" />
              Detox Success Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-green-600">Before You Start</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Ease into it - reduce caffeine 2-3 days prior</li>
                  <li>• Stay hydrated with plenty of water</li>
                  <li>• Get adequate rest and sleep</li>
                  <li>• Choose organic ingredients when possible</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-blue-600">During Your Cleanse</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Listen to your body's signals</li>
                  <li>• Light exercise like yoga or walking</li>
                  <li>• Avoid strenuous workouts</li>
                  <li>• Keep a journal of how you feel</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-purple-600">After Completing</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Slowly reintroduce solid foods</li>
                  <li>• Start with fruits and vegetables</li>
                  <li>• Continue healthy eating habits</li>
                  <li>• Consider monthly mini-cleanses</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-orange-600">Important Notes</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Consult your doctor before starting</li>
                  <li>• Not for pregnant or nursing mothers</li>
                  <li>• Stop if you feel unwell</li>
                  <li>• Stay mindful of your health</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
