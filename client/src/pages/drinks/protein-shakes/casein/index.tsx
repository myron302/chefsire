import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Moon, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Bed, Timer,
  Award, TrendingUp, ChefHat, Zap, Gift, Plus, Search,
  Filter, Shuffle, Camera, Share2, ArrowLeft, Activity,
  BarChart3, Sparkles, Crown, Dumbbell, Zzz
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import { caseinProteinShakes } from '../../data/protein';

// Casein-specific data
const caseinTypes = [
  {
    id: 'micellar',
    name: 'Micellar Casein',
    description: 'Slowest digesting, most natural form',
    icon: Moon,
    color: 'text-purple-600',
    releaseTime: '7-8 hours',
    benefits: ['Longest Release', 'Natural Structure', 'Anti-Catabolic', 'Muscle Preservation'],
    bestFor: 'Overnight Recovery'
  },
  {
    id: 'calcium-caseinate',
    name: 'Calcium Caseinate',
    description: 'Faster mixing, good bioavailability',
    icon: Zap,
    color: 'text-blue-600',
    releaseTime: '5-6 hours',
    benefits: ['Better Mixing', 'Calcium Rich', 'Versatile', 'Cost Effective'],
    bestFor: 'Evening Snacks'
  },
  {
    id: 'hydrolyzed',
    name: 'Hydrolyzed Casein',
    description: 'Pre-digested for sensitive stomachs',
    icon: Bed,
    color: 'text-green-600',
    releaseTime: '4-5 hours',
    benefits: ['Easy Digestion', 'Less Bloating', 'Faster Absorption', 'Gentle'],
    bestFor: 'Sensitive Digestion'
  }
];

const sleepGoals = [
  {
    id: 'muscle-recovery',
    name: 'Muscle Recovery',
    description: 'Maximize overnight muscle repair',
    icon: Activity,
    color: 'bg-red-500',
    recommendedTiming: '30-60 minutes before bed',
    keyNutrients: ['Protein', 'Glutamine', 'Leucine']
  },
  {
    id: 'sleep-quality',
    name: 'Sleep Quality',
    description: 'Enhance sleep depth and duration',
    icon: Zzz,
    color: 'bg-purple-500',
    recommendedTiming: '1-2 hours before bed',
    keyNutrients: ['Melatonin', 'Tryptophan', 'Magnesium']
  },
  {
    id: 'weight-management',
    name: 'Weight Management',
    description: 'Control late-night cravings',
    icon: Target,
    color: 'bg-blue-500',
    recommendedTiming: 'As evening snack',
    keyNutrients: ['Protein', 'Fiber', 'Calcium']
  },
  {
    id: 'lean-mass',
    name: 'Lean Mass',
    description: 'Preserve muscle during cutting',
    icon: Dumbbell,
    color: 'bg-green-500',
    recommendedTiming: 'Before extended fasting',
    keyNutrients: ['BCAA', 'Glutamine', 'HMB']
  }
];

export default function CaseinProteinPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedCaseinType, setSelectedCaseinType] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedTiming, setSelectedTiming] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  // Filter and sort shakes
  const getFilteredShakes = () => {
    let filtered = caseinProteinShakes.filter(shake => {
      const matchesSearch = shake.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           shake.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedCaseinType || shake.caseinType.toLowerCase().includes(selectedCaseinType.toLowerCase());
      const matchesGoal = !selectedGoal || shake.fitnessGoal.toLowerCase().includes(selectedGoal.toLowerCase());
      const matchesTiming = !selectedTiming || shake.bestTime.toLowerCase().includes(selectedTiming.toLowerCase());
      
      return matchesSearch && matchesType && matchesGoal && matchesTiming;
    });

    // Sort results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
        case 'price': return (a.price || 0) - (b.price || 0);
        case 'release-time': return parseFloat(b.releaseTime) - parseFloat(a.releaseTime);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredShakes = getFilteredShakes();
  const featuredShakes = caseinProteinShakes.filter(shake => shake.featured);
  const trendingShakes = caseinProteinShakes.filter(shake => shake.trending);

  const handleMakeShake = (shake: any) => {
    addToRecentlyViewed({
      id: shake.id,
      name: shake.name,
      category: 'protein-shakes',
      description: shake.description,
      ingredients: shake.ingredients,
      nutrition: shake.nutrition,
      difficulty: shake.difficulty,
      prepTime: shake.prepTime,
      rating: shake.rating,
      fitnessGoal: shake.fitnessGoal,
      bestTime: shake.bestTime
    });
    incrementDrinksMade();
    addPoints(30);
    
    console.log(`Made ${shake.name}! +30 XP`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4">
            <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                <Moon className="h-6 w-6 text-purple-600" />
                <h1 className="text-2xl font-bold text-gray-900">Casein Protein</h1>
                <Badge className="bg-purple-100 text-purple-800">Night Time</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowUniversalSearch(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                <Camera className="h-4 w-4 mr-2" />
                Share Recipe
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Link href="/drinks/smoothies">
                <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                  <Dumbbell className="h-4 w-4 mr-2 text-green-600" />
                  <span>Smoothies</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/protein-shakes">
                <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 border-blue-400">
                  <Zap className="h-4 w-4 mr-2 text-blue-600" />
                  <span className="font-semibold">Protein Shakes Hub</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/detoxes">
                <Button variant="outline" className="w-full justify-start hover:bg-teal-50 hover:border-teal-300">
                  <Droplets className="h-4 w-4 mr-2 text-teal-600" />
                  <span>Detoxes</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/potent-potables">
                <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                  <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
                  <span>Potent Potables</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* SISTER PROTEIN TYPES NAVIGATION */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Protein Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Link href="/drinks/protein-shakes/whey">
                <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                  <Zap className="h-4 w-4 mr-2 text-blue-600" />
                  <span>Whey Protein</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/protein-shakes/casein">
                <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300 border-purple-400">
                  <Moon className="h-4 w-4 mr-2 text-purple-600" />
                  <span className="font-semibold">Casein Protein</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/protein-shakes/plant-based">
                <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                  <Leaf className="h-4 w-4 mr-2 text-green-600" />
                  <span>Plant-Based</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/protein-shakes/collagen">
                <Button variant="outline" className="w-full justify-start hover:bg-pink-50 hover:border-pink-300">
                  <Sparkles className="h-4 w-4 mr-2 text-pink-600" />
                  <span>Collagen</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">7hrs</div>
              <div className="text-sm text-gray-600">Avg Release</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">26g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">330mg</div>
              <div className="text-sm text-gray-600">Avg Calcium</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">6</div>
              <div className="text-sm text-gray-600">Night Formulas</div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'casein-types', label: 'Casein Types', icon: Moon },
            { id: 'sleep-goals', label: 'Sleep Goals', icon: Bed },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 ${activeTab === tab.id ? 'bg-white shadow-sm' : ''}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div>
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search casein proteins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedCaseinType}
                  onChange={(e) => setSelectedCaseinType(e.target.value)}
                >
                  <option value="">All Casein Types</option>
                  <option value="micellar">Micellar Casein</option>
                  <option value="calcium">Calcium Caseinate</option>
                  <option value="hydrolyzed">Hydrolyzed Casein</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedGoal}
                  onChange={(e) => setSelectedGoal(e.target.value)}
                >
                  <option value="">All Goals</option>
                  <option value="Recovery">Muscle Recovery</option>
                  <option value="Sleep">Sleep Quality</option>
                  <option value="Weight">Weight Management</option>
                  <option value="Performance">Mental Performance</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedTiming}
                  onChange={(e) => setSelectedTiming(e.target.value)}
                >
                  <option value="">All Timing</option>
                  <option value="bed">Before Bed</option>
                  <option value="evening">Evening</option>
                  <option value="dessert">Evening Dessert</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
                  <option value="price">Sort by Price</option>
                  <option value="release-time">Sort by Release Time</option>
                </select>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShakes.map(shake => (
                <Card key={shake.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{shake.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{shake.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToFavorites({
                          id: shake.id,
                          name: shake.name,
                          category: 'protein-shakes',
                          description: shake.description,
                          ingredients: shake.ingredients,
                          nutrition: shake.nutrition,
                          difficulty: shake.difficulty,
                          prepTime: shake.prepTime,
                          rating: shake.rating,
                          fitnessGoal: shake.fitnessGoal,
                          bestTime: shake.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(shake.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-purple-100 text-purple-800">{shake.caseinType}</Badge>
                      <Badge variant="outline">{shake.flavor}</Badge>
                      {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Nutrition Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-purple-600">{shake.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{shake.releaseTime}</div>
                        <div className="text-gray-500">Release</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-600">${shake.price}</div>
                        <div className="text-gray-500">Price</div>
                      </div>
                    </div>

                    {/* Key Details */}
                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{shake.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Absorption:</span>
                        <span className="font-medium">{shake.absorption}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Texture:</span>
                        <span className="font-medium">{shake.texture}</span>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{shake.rating}</span>
                        <span className="text-gray-500 text-sm">({shake.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {shake.mixability} Mix
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-purple-600 hover:bg-purple-700"
                        onClick={() => handleMakeShake(shake)}
                      >
                        <Moon className="h-4 w-4 mr-2" />
                        Make Shake
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Casein Types Tab */}
        {activeTab === 'casein-types' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {caseinTypes.map(type => {
              const Icon = type.icon;
              const typeShakes = caseinProteinShakes.filter(shake => 
                shake.caseinType.toLowerCase().includes(type.id.replace('-', ' '))
              );
              
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${type.color}`} />
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-center bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Release Time</div>
                        <div className="text-2xl font-bold text-purple-600">{type.releaseTime}</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Key Benefits:</h4>
                        <div className="flex flex-wrap gap-1">
                          {type.benefits.map((benefit, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Best For:</div>
                        <div className="text-sm text-blue-800">{type.bestFor}</div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color} mb-1`}>
                        {typeShakes.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Options</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedCaseinType(type.id);
                          setActiveTab('browse');
                        }}
                      >
                        Explore {type.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Sleep Goals Tab */}
        {activeTab === 'sleep-goals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sleepGoals.map(goal => {
              const Icon = goal.icon;
              const goalShakes = caseinProteinShakes.filter(shake => 
                shake.fitnessGoal.toLowerCase().includes(goal.name.toLowerCase().split(' ')[0])
              );
              
              return (
                <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${goal.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${goal.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        <p className="text-sm text-gray-600">{goal.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Timing:</div>
                        <div className="text-sm text-purple-800">{goal.recommendedTiming}</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Key Nutrients:</h4>
                        <div className="flex flex-wrap gap-1">
                          {goal.keyNutrients.map((nutrient, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {nutrient}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${goal.color.replace('bg-', 'text-')} mb-1`}>
                        {goalShakes.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Perfect Matches</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedGoal(goal.name.split(' ')[0]);
                          setActiveTab('browse');
                        }}
                      >
                        View {goal.name} Options
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Featured Tab */}
        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredShakes.map(shake => (
              <Card key={shake.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img 
                    src={shake.image} 
                    alt={shake.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop';
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-purple-500 text-white">Featured Casein</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-purple-800">{shake.releaseTime}</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{shake.name}</CardTitle>
                  <p className="text-gray-600">{shake.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-purple-100 text-purple-800">{shake.caseinType}</Badge>
                    <Badge variant="outline">{shake.flavor}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{shake.rating}</span>
                      <span className="text-gray-500 text-sm">({shake.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Enhanced nutrition display */}
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-purple-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">{shake.nutrition.protein}g</div>
                      <div className="text-xs text-gray-600">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{shake.nutrition.calcium}mg</div>
                      <div className="text-xs text-gray-600">Calcium</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-600">${shake.price}</div>
                      <div className="text-xs text-gray-600">Price</div>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Key Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {shake.benefits.map((benefit, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Timing & Usage */}
                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-purple-600 font-semibold">{shake.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Release Time:</div>
                        <div className="text-blue-600 font-semibold">{shake.releaseTime}</div>
                      </div>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {shake.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Moon className="h-3 w-3 text-purple-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                      onClick={() => handleMakeShake(shake)}
                    >
                      <Moon className="h-4 w-4 mr-2" />
                      Make This Shake
                    </Button>
                    <Button variant="outline">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="rounded-full w-14 h-14 bg-purple-600 hover:bg-purple-700 shadow-lg"
          onClick={() => setActiveTab('browse')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Bottom Stats Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-purple-600" />
              <span className="text-gray-600">Casein Proteins Found:</span>
              <span className="font-bold text-purple-600">{filteredShakes.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">Your Level:</span>
              <span className="font-bold text-yellow-600">{userProgress.level}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <span className="text-gray-600">XP:</span>
              <span className="font-bold text-green-600">{userProgress.totalPoints}</span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to Top
          </Button>
        </div>
      </div>
    </div>
  );
}
