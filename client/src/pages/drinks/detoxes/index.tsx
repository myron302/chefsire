// client/src/pages/drinks/detoxes/index.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from 'wouter';
import {
  Droplets, Leaf, Heart, Sparkles, Clock, Users, Trophy,
  Star, Flame, Target, Award, TrendingUp, Activity, Zap,
  ArrowLeft, Apple, Sun, Moon, Wind, FlaskConical, Coffee,
  GlassWater, Dumbbell, IceCream, ArrowRight, Wine, Home,
  X, CheckCircle
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import { otherDrinkHubs, detoxSubcategories } from '../data/detoxes';

export default function DetoxesHub() {
  const { userProgress, addDrinkToJournal, incrementDrinksMade, addPoints } = useDrinks();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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

  const cleanseProgramsData = [
    {
      id: '1-day',
      duration: '1 Day',
      title: 'Quick Reset',
      servings: 6,
      color: 'green',
      description: 'Perfect for a quick refresh and digestive reset',
      benefits: ['Gentle cleanse', 'Digestive reset', 'Energy boost'],
      schedule: [
        { time: '7:00 AM', drink: 'Lemon Ginger Detox Water' },
        { time: '9:00 AM', drink: 'Green Detox Elixir' },
        { time: '12:00 PM', drink: 'Beet & Carrot Liver Flush' },
        { time: '3:00 PM', drink: 'Cucumber Mint Refresher' },
        { time: '6:00 PM', drink: 'Citrus Immunity Boost' },
        { time: '8:00 PM', drink: 'Morning Metabolism Boost Tea' }
      ]
    },
    {
      id: '3-day',
      duration: '3 Days',
      title: 'Deep Cleanse',
      servings: 18,
      color: 'blue',
      description: 'Comprehensive detox for full body reset',
      benefits: ['Full body reset', 'Deep cleansing', 'Renewed energy'],
      schedule: [
        { time: 'Daily Morning', drink: 'Green Detox Elixir + Morning Metabolism Boost Tea' },
        { time: 'Daily Midday', drink: 'Beet & Carrot Liver Flush + Cucumber Mint Refresher' },
        { time: 'Daily Evening', drink: 'Citrus Immunity Boost + Gentle Evening Cleanse Tea' }
      ]
    },
    {
      id: '7-day',
      duration: '7 Days',
      title: 'Complete Reset',
      servings: 42,
      color: 'purple',
      description: 'Total transformation with guided daily protocol',
      benefits: ['Total transformation', 'Maximum detox', 'Lifestyle reset'],
      schedule: [
        { time: 'Week Plan', drink: 'Customized daily rotation of all detox juices, teas, and waters' },
        { time: 'Daily Goal', drink: '6 servings per day with structured meal plan' },
        { time: 'Support', drink: 'Daily tips and motivation included' }
      ]
    }
  ];

  const startCleanse = async (programId: string) => {
    const program = cleanseProgramsData.find(p => p.id === programId);
    if (!program) return;

    setSelectedProgram(programId);
    setShowProgramModal(true);
  };

  const confirmCleanse = async () => {
    const program = cleanseProgramsData.find(p => p.id === selectedProgram);
    if (!program) return;

    try {
      // Save cleanse program to backend
      const response = await fetch('/api/custom-drinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${program.duration} ${program.title} Program`,
          category: 'detox-program',
          drinkType: 'cleanse-program',
          duration: program.duration,
          servings: program.servings,
          schedule: program.schedule,
          benefits: program.benefits,
          description: program.description,
          isPublic: false,
          isProgramActive: true,
          startDate: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start cleanse program');
      }

      // Award points based on program duration
      const points = programId === '1-day' ? 100 : programId === '3-day' ? 250 : 500;
      addPoints(points);
      incrementDrinksMade();

      setShowProgramModal(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedProgram(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to start cleanse:', error);
      alert('Failed to start cleanse program. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white p-8 rounded-3xl shadow-2xl animate-bounce">
            <div className="text-center">
              <Sparkles className="w-20 h-20 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Cleanse Program Started!</h2>
              <p className="text-xl">
                {selectedProgram === '1-day' && '+100 XP earned!'}
                {selectedProgram === '3-day' && '+250 XP earned!'}
                {selectedProgram === '7-day' && '+500 XP earned!'}
              </p>
              <p className="text-sm mt-2">Check your journal for the daily schedule</p>
            </div>
          </div>
        </div>
      )}

      {/* Program Details Modal */}
      {showProgramModal && selectedProgram && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              {cleanseProgramsData.filter(p => p.id === selectedProgram).map((program) => (
                <div key={program.id}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">{program.duration} {program.title}</h2>
                      <p className="text-gray-600">{program.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowProgramModal(false);
                        setSelectedProgram(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Heart className={`h-5 w-5 text-${program.color}-600`} />
                      Benefits
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {program.benefits.map((benefit, idx) => (
                        <div key={idx} className={`p-3 rounded-lg bg-${program.color}-50 border border-${program.color}-200`}>
                          <div className="flex items-center gap-2">
                            <CheckCircle className={`h-4 w-4 text-${program.color}-600`} />
                            <span className="text-sm font-medium">{benefit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock className={`h-5 w-5 text-${program.color}-600`} />
                      Schedule
                    </h3>
                    <div className="space-y-3">
                      {program.schedule.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className={`text-sm font-semibold text-${program.color}-600 min-w-[120px]`}>
                            {item.time}
                          </div>
                          <div className="text-sm text-gray-700">{item.drink}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg bg-${program.color}-50 border border-${program.color}-200 mb-6`}>
                    <div className="flex items-start gap-3">
                      <Droplets className={`h-5 w-5 text-${program.color}-600 mt-0.5`} />
                      <div>
                        <h4 className="font-semibold mb-1">Program Details</h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                          <li>• Duration: {program.duration}</li>
                          <li>• Total servings: {program.servings}</li>
                          <li>• Daily commitment: 10-15 minutes</li>
                          <li>• Difficulty: Easy</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowProgramModal(false);
                        setSelectedProgram(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className={`flex-1 bg-${program.color}-600 hover:bg-${program.color}-700`}
                      onClick={confirmCleanse}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start Program
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* UNIFORM HERO SECTION */}
        <div className="bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 text-white py-12 px-6 rounded-xl shadow-2xl">
          <div className="max-w-7xl mx-auto">
            <Link href="/drinks">
              <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Drinks Hub
              </Button>
            </Link>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
                <Sparkles className="h-12 w-12" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Detox Hub</h1>
                <p className="text-xl text-green-100">Cleanse, Refresh, Revitalize</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
                  <div className="text-2xl font-bold">26</div>
                  <div className="text-sm text-green-100">Total Recipes</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Droplets className="h-8 w-8 mx-auto mb-2 text-blue-300" />
                  <div className="text-2xl font-bold">40</div>
                  <div className="text-sm text-green-100">Avg Calories</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Star className="h-8 w-8 mx-auto mb-2 text-purple-300" />
                  <div className="text-2xl font-bold">{userProgress.totalDrinksMade}</div>
                  <div className="text-sm text-green-100">Detoxes Made</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/20 transition-all">
                <CardContent className="p-4 text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-green-300" />
                  <div className="text-2xl font-bold">12</div>
                  <div className="text-sm text-green-100">Cleanse Programs</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Cross-Hub Navigation */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <GlassWater className="h-6 w-6 text-purple-600" />
              Explore Other Drink Categories
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {otherDrinkHubs.filter(hub => hub.id !== 'detoxes').map((hub) => {
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

        {/* Subcategory Navigation */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Target className="h-6 w-6 text-green-600" />
            Browse Detox Types
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {detoxSubcategories.map((category) => (
              <Link key={category.id} href={category.path}>
                <Card 
                  className={`cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${category.borderColor} overflow-hidden`}
                  onMouseEnter={() => setHoveredCard(category.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className={`relative h-48 overflow-hidden ${category.bgColor}`}>
                    {/* Stock photo background */}
                    <img
                      src={category.image}
                      alt={category.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
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
                <Button
                  className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  onClick={() => startCleanse('1-day')}
                >
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
                <Button
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                  onClick={() => startCleanse('3-day')}
                >
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
                <Button
                  className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                  onClick={() => startCleanse('7-day')}
                >
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

        {/* User Progress */}
        <Card className="bg-gradient-to-r from-green-50 to-teal-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Your Detox Progress
                </h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-green-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-teal-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
                    {userProgress.totalDrinksMade} Detoxes Made
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
