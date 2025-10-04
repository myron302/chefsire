import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Moon, Clock, Heart, Star, ArrowLeft, 
  Search, Share2, Plus, Zap, Apple, Leaf, Sparkles,
  FlaskConical, Target, Activity, Dumbbell, Bed,
  Camera, Crown, BarChart3
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
    icon: Bed, // Changed from Zzz to Bed
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
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
                  <Apple className="h-4 w-4 mr-2 text-green-600" />
                  <span>Smoothies</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/protein-shakes">
                <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 border-blue-400">
                  <FlaskConical className="h-4 w-4 mr-2 text-blue-600" />
                  <span className="font-semibold">Protein Shakes Hub</span>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/detoxes">
                <Button variant="outline" className="w-full justify-start hover:bg-teal-50 hover:border-teal-300">
                  <Leaf className="h-4 w-4 mr-2 text-teal-600" />
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

        {/* Rest of the page content remains the same */}
        {/* ... existing browse, casein-types, sleep-goals, and featured tabs ... */}
        
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
