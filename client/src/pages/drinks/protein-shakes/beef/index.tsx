import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Beef, Heart, Star, Search, Share2, ArrowLeft, ArrowRight,
  Camera, Zap, Leaf, Target, Sparkles, Apple, Wine, X,
  Moon, Dumbbell, Flame, Trophy, Activity, Shield, Check
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

// NAVIGATION DATA
const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit & veggie blends' },
  { id: 'detoxes', name: 'Detox Drinks', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing & wellness' },
  { id: 'potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails (21+)' },
  { id: 'all-drinks', name: 'All Drinks', icon: Sparkles, route: '/drinks', description: 'Browse everything' }
];

const proteinSubcategories = [
  { id: 'whey', name: 'Whey Protein', icon: Zap, path: '/drinks/protein-shakes/whey', description: 'Fast absorption' },
  { id: 'plant', name: 'Plant-Based', icon: Leaf, path: '/drinks/protein-shakes/plant-based', description: 'Vegan friendly' },
  { id: 'casein', name: 'Casein', icon: Moon, path: '/drinks/protein-shakes/casein', description: 'Slow release' },
  { id: 'collagen', name: 'Collagen', icon: Sparkles, path: '/drinks/protein-shakes/collagen', description: 'Beauty support' },
  { id: 'egg', name: 'Egg Protein', icon: Target, path: '/drinks/protein-shakes/egg', description: 'Complete amino' }
];

// Beef protein shake data
const beefProteinShakes = [
  {
    id: 'beef-1',
    name: 'Carnivore Power Blast',
    description: 'Grass-fed beef protein isolate with natural creatine',
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&h=300&fit=crop',
    proteinSource: 'Grass-Fed Beef Isolate',
    flavor: 'Natural Beef',
    servingSize: '30g',
    nutrition: {
      calories: 120,
      protein: 28,
      carbs: 2,
      fat: 0.5,
      creatine: 0.5,
      iron: 4.5,
      bcaa: 6.2
    },
    ingredients: ['Grass-Fed Beef Protein Isolate', 'Natural Flavors', 'Sea Salt', 'Digestive Enzymes'],
    benefits: ['Natural Creatine', 'High Iron', 'Complete Amino Profile', 'Paleo-Friendly'],
    certifications: ['Grass-Fed', 'Hormone-Free', 'Paleo', 'Keto-Friendly'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.7,
    reviews: 523,
    trending: true,
    featured: true,
    price: 54.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Eggs'],
    source: 'Grass-Fed Bovine',
    fitnessGoal: 'Muscle Building',
    bestTime: 'Post-Workout',
    absorption: 'Fast',
    bioavailability: 88
  },
  {
    id: 'beef-2',
    name: 'Primal Strength Formula',
    description: 'Hydrolyzed beef protein with collagen peptides',
    proteinSource: 'Hydrolyzed Beef Protein',
    flavor: 'Chocolate Beef',
    servingSize: '32g',
    nutrition: {
      calories: 125,
      protein: 26,
      carbs: 3,
      fat: 1,
      creatine: 0.4,
      collagen: 2,
      glutamine: 3.8
    },
    ingredients: ['Hydrolyzed Beef Protein', 'Beef Collagen', 'Cocoa Powder', 'Monk Fruit', 'MCT Oil'],
    benefits: ['Joint Support', 'Muscle Recovery', 'Gut Health', 'Keto-Friendly'],
    certifications: ['Grass-Fed', 'Paleo', 'Keto', 'Whole30'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 445,
    trending: false,
    featured: true,
    price: 52.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Eggs'],
    source: 'Grass-Fed Bovine',
    fitnessGoal: 'Strength',
    bestTime: 'Post-Workout',
    absorption: 'Very Fast',
    bioavailability: 92
  },
  {
    id: 'beef-3',
    name: 'Paleo Performance Shake',
    description: 'Clean beef protein for ancestral nutrition',
    proteinSource: 'Beef Protein Isolate',
    flavor: 'Vanilla Bean',
    servingSize: '30g',
    nutrition: {
      calories: 115,
      protein: 27,
      carbs: 2,
      fat: 0.5,
      creatine: 0.45,
      iron: 5,
      zinc: 3.2
    },
    ingredients: ['Grass-Fed Beef Protein', 'Vanilla Bean Extract', 'Stevia', 'Himalayan Salt'],
    benefits: ['Paleo Approved', 'Clean Ingredients', 'Natural Energy', 'Iron Rich'],
    certifications: ['Grass-Fed', 'Paleo Certified', 'Non-GMO', 'Hormone-Free'],
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.5,
    reviews: 367,
    trending: true,
    featured: false,
    price: 49.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Eggs', 'Nuts'],
    source: 'Grass-Fed Bovine',
    fitnessGoal: 'General Wellness',
    bestTime: 'Morning',
    absorption: 'Fast',
    bioavailability: 86
  },
  {
    id: 'beef-4',
    name: 'Iron Warrior Blend',
    description: 'High-iron beef protein for endurance athletes',
    proteinSource: 'Beef Protein Concentrate',
    flavor: 'Berry Beef',
    servingSize: '35g',
    nutrition: {
      calories: 135,
      protein: 29,
      carbs: 4,
      fat: 1,
      iron: 6.5,
      b12: 2.4,
      creatine: 0.55
    },
    ingredients: ['Grass-Fed Beef Protein', 'Freeze-Dried Berries', 'Beet Root Powder', 'Natural Sweetener'],
    benefits: ['High Iron', 'Endurance Support', 'Energy Production', 'Blood Health'],
    certifications: ['Grass-Fed', 'Paleo', 'Non-GMO'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 289,
    trending: false,
    featured: true,
    price: 51.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Eggs'],
    source: 'Grass-Fed Bovine',
    fitnessGoal: 'Endurance',
    bestTime: 'Pre-Workout',
    absorption: 'Fast',
    bioavailability: 85
  },
  {
    id: 'beef-5',
    name: 'Keto Carnivore Stack',
    description: 'Zero-carb beef protein for ketogenic diet',
    proteinSource: 'Beef Protein Isolate',
    flavor: 'Unflavored',
    servingSize: '28g',
    nutrition: {
      calories: 110,
      protein: 27,
      carbs: 0,
      fat: 0.5,
      creatine: 0.5,
      sodium: 150,
      potassium: 200
    },
    ingredients: ['Grass-Fed Beef Protein Isolate', 'Sea Salt', 'Sunflower Lecithin'],
    benefits: ['Zero Carb', 'Keto-Friendly', 'Clean Label', 'Carnivore Diet'],
    certifications: ['Grass-Fed', 'Keto Certified', 'Carnivore Approved'],
    difficulty: 'Easy',
    prepTime: 1,
    rating: 4.3,
    reviews: 198,
    trending: false,
    featured: false,
    price: 56.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Eggs', 'Nuts', 'Grains'],
    source: 'Grass-Fed Bovine',
    fitnessGoal: 'Weight Loss',
    bestTime: 'Anytime',
    absorption: 'Fast',
    bioavailability: 88
  },
  {
    id: 'beef-6',
    name: 'Collagen Plus Beef Fusion',
    description: 'Beef protein with added collagen for joint health',
    proteinSource: 'Beef Protein + Collagen',
    flavor: 'Coffee Mocha',
    servingSize: '35g',
    nutrition: {
      calories: 130,
      protein: 25,
      carbs: 3,
      fat: 1.5,
      collagen: 5,
      creatine: 0.4,
      glycine: 3.5
    },
    ingredients: ['Grass-Fed Beef Protein', 'Bovine Collagen', 'Cold Brew Coffee', 'Cocoa', 'MCT Oil'],
    benefits: ['Joint Support', 'Skin Health', 'Energy Boost', 'Recovery'],
    certifications: ['Grass-Fed', 'Paleo', 'Keto-Friendly'],
    difficulty: 'Medium',
    prepTime: 3,
    rating: 4.8,
    reviews: 412,
    trending: true,
    featured: true,
    price: 58.99,
    allergenFree: ['Dairy', 'Soy', 'Gluten', 'Eggs'],
    source: 'Grass-Fed Bovine',
    fitnessGoal: 'Recovery',
    bestTime: 'Post-Workout',
    absorption: 'Fast',
    bioavailability: 90
  }
];

const beefProteinBenefits = [
  {
    icon: Dumbbell,
    title: 'Natural Creatine',
    description: '0.4-0.5g per serving for strength gains',
    color: 'text-red-600'
  },
  {
    icon: Shield,
    title: 'High Iron Content',
    description: 'Supports energy and blood health',
    color: 'text-orange-600'
  },
  {
    icon: Zap,
    title: 'Fast Absorption',
    description: 'Quickly digested for rapid recovery',
    color: 'text-yellow-600'
  },
  {
    icon: Flame,
    title: 'Complete Amino Profile',
    description: 'All essential amino acids (BV 88)',
    color: 'text-red-600'
  },
  {
    icon: Trophy,
    title: 'Paleo & Keto Friendly',
    description: 'Perfect for low-carb diets',
    color: 'text-purple-600'
  },
  {
    icon: Heart,
    title: 'No Dairy Allergens',
    description: 'Lactose-free alternative to whey',
    color: 'text-pink-600'
  }
];

const fitnessGoals = [
  {
    id: 'muscle-building',
    name: 'Muscle Building',
    description: 'Maximize muscle growth with creatine',
    icon: Dumbbell,
    color: 'bg-red-500',
    recommendedIntake: '25-30g protein',
    timing: 'Post-workout within 30 minutes'
  },
  {
    id: 'strength',
    name: 'Strength Training',
    description: 'Power and performance focus',
    icon: Trophy,
    color: 'bg-orange-500',
    recommendedIntake: '28-32g protein',
    timing: 'Post-workout'
  },
  {
    id: 'endurance',
    name: 'Endurance',
    description: 'Sustained energy and recovery',
    icon: Activity,
    color: 'bg-blue-500',
    recommendedIntake: '20-25g protein',
    timing: 'Pre or post-workout'
  },
  {
    id: 'weight-loss',
    name: 'Weight Loss',
    description: 'Zero-carb options available',
    icon: Flame,
    color: 'bg-green-500',
    recommendedIntake: '25-30g protein',
    timing: 'Between meals'
  }
];

export default function BeefProteinPage() {
  const { addToFavorites, isFavorite, addToRecentlyViewed, userProgress, addPoints, incrementDrinksMade } = useDrinks();
  
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [selectedShake, setSelectedShake] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Share handlers
  const handleSharePage = async () => {
    const shareData = {
      title: 'Beef Protein',
      text: 'Explore beef protein options, benefits, and natural creatine.',
      url: typeof window !== 'undefined' ? window.location.href : ''
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const handleShareShake = async (shake) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `${shake.name} • ${shake.fitnessGoal} • ${shake.proteinSource}\n${shake.description}`;
    const shareData = {
      title: shake.name,
      text,
      url
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shake.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shake.name}\n${text}\n${url}`);
        alert('Recipe copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const getFilteredShakes = () => {
    let filtered = beefProteinShakes.filter(shake => {
      const matchesSearch = shake.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           shake.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGoal = !selectedGoal || shake.fitnessGoal.toLowerCase().includes(selectedGoal.toLowerCase());
      return matchesSearch && matchesGoal;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
        case 'price': return (a.price || 0) - (b.price || 0);
        case 'creatine': return (b.nutrition.creatine || 0) - (a.nutrition.creatine || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredShakes = getFilteredShakes();
  const featuredShakes = beefProteinShakes.filter(shake => shake.featured);

  const handleMakeShake = (shake) => {
    setSelectedShake(shake);
    setShowModal(true);
  };

  const handleCompleteShake = () => {
    if (selectedShake) {
      addToRecentlyViewed({
        id: selectedShake.id,
        name: selectedShake.name,
        category: 'protein-shakes',
        description: selectedShake.description,
        ingredients: selectedShake.ingredients,
        nutrition: selectedShake.nutrition,
        difficulty: selectedShake.difficulty,
        prepTime: selectedShake.prepTime,
        rating: selectedShake.rating,
        fitnessGoal: selectedShake.fitnessGoal,
        bestTime: selectedShake.bestTime
      });
      incrementDrinksMade();
      addPoints(30);
    }
    setShowModal(false);
    setSelectedShake(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20"
          onClick={() => setShowUniversalSearch(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">Search All Drinks</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowUniversalSearch(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Make Shake Modal */}
      {showModal && selectedShake && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedShake.name}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Ingredients:</h3>
                <ul className="space-y-2">
                  {selectedShake.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Benefits:</h3>
                <div className="flex flex-wrap gap-1">
                  {selectedShake.benefits.map((benefit, idx) => (
                    <Badge key={idx} className="bg-red-100 text-red-800 text-xs">
                      {benefit}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Allergen-Free:</h3>
                <div className="flex flex-wrap gap-1">
                  {selectedShake.allergenFree.map((allergen, idx) => (
                    <Badge key={idx} className="bg-blue-100 text-blue-800 text-xs">
                      {allergen}-Free
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-red-50 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-red-600">{selectedShake.nutrition.protein}g</div>
                  <div className="text-xs text-gray-600">Protein</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{selectedShake.nutrition.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-orange-600">{selectedShake.nutrition.creatine}g</div>
                  <div className="text-xs text-gray-600">Creatine</div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleCompleteShake}
                >
                  Complete Shake (+30 XP)
                </Button>
              </div>
            </div>
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
                <Flame className="h-6 w-6 text-red-600" />
                <h1 className="text-2xl font-bold text-gray-900">Beef Protein</h1>
                <Badge className="bg-red-100 text-red-800">Carnivore</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setShowUniversalSearch(true)}>
                <Search className="h-4 w-4 mr-2" />
                Universal Search
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Recipe
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cross-Hub Navigation */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{hub.name}</div>
                        <div className="text-xs text-gray-500">{hub.description}</div>
                      </div>
                      <ArrowRight className="h-3 w-3 ml-auto" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sister Subpages Navigation */}
        <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Protein Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-red-50 hover:border-red-300">
                      <Icon className="h-4 w-4 mr-2 text-red-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{subcategory.name}</div>
                        <div className="text-xs text-gray-500">{subcategory.description}</div>
                      </div>
                      <ArrowRight className="h-3 w-3 ml-auto" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">27g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">0.5g</div>
              <div className="text-sm text-gray-600">Natural Creatine</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">5mg</div>
              <div className="text-sm text-gray-600">Avg Iron</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">6</div>
              <div className="text-sm text-gray-600">Formulas</div>
            </CardContent>
          </Card>
        </div>

        {/* Benefits Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Star className="h-6 w-6 text-red-500" />
              Why Beef Protein?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {beefProteinBenefits.map((benefit, index) => (
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'goals', label: 'By Goal', icon: Target },
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
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search beef proteins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedGoal}
                  onChange={(e) => setSelectedGoal(e.target.value)}
                >
                  <option value="">All Goals</option>
                  {fitnessGoals.map(goal => (
                    <option key={goal.id} value={goal.name}>{goal.name}</option>
                  ))}
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
                  <option value="price">Sort by Price</option>
                  <option value="creatine">Sort by Creatine</option>
                </select>
              </div>
            </div>

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
                      <Badge className="bg-red-100 text-red-800">{shake.proteinSource}</Badge>
                      <Badge variant="outline">{shake.flavor}</Badge>
                      {shake.trending && <Badge className="bg-orange-100 text-orange-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-red-600">{shake.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-orange-600">{shake.nutrition.creatine}g</div>
                        <div className="text-gray-500">Creatine</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-600">${shake.price}</div>
                        <div className="text-gray-500">Price</div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{shake.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Absorption:</span>
                        <span className="font-medium">{shake.absorption}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{shake.rating}</span>
                        <span className="text-gray-500 text-sm">({shake.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {shake.difficulty}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-red-600 hover:bg-red-700"
                        onClick={() => handleMakeShake(shake)}
                      >
                        <Flame className="h-4 w-4 mr-2" />
                        Make Shake
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleShareShake(shake)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Goals Tab */}
        {activeTab === 'goals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {fitnessGoals.map(goal => {
              const Icon = goal.icon;
              const goalShakes = beefProteinShakes.filter(shake => 
                shake.fitnessGoal.toLowerCase().includes(goal.name.toLowerCase())
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
                        <div className="text-sm font-medium text-gray-700 mb-1">Recommended Intake:</div>
                        <div className="text-lg font-bold text-red-600">{goal.recommendedIntake}</div>
                      </div>
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Timing:</div>
                        <div className="text-sm text-blue-800">{goal.timing}</div>
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
                          setSelectedGoal(goal.name);
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
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&h=300&fit=crop';
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-red-500 text-white">Featured Beef</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-red-800">{shake.nutrition.creatine}g Creatine</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{shake.name}</CardTitle>
                  <p className="text-gray-600">{shake.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-red-100 text-red-800">{shake.proteinSource}</Badge>
                    <Badge variant="outline">{shake.flavor}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{shake.rating}</span>
                      <span className="text-gray-500 text-sm">({shake.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-red-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600">{shake.nutrition.protein}g</div>
                      <div className="text-xs text-gray-600">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{shake.nutrition.creatine}g</div>
                      <div className="text-xs text-gray-600">Creatine</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-600">${shake.price}</div>
                      <div className="text-xs text-gray-600">Price</div>
                    </div>
                  </div>

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

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Allergen-Free:</h4>
                    <div className="flex flex-wrap gap-1">
                      {shake.allergenFree.map((allergen, index) => (
                        <Badge key={index} className="bg-blue-100 text-blue-800 text-xs">
                          {allergen}-Free
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {shake.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Flame className="h-3 w-3 text-red-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      onClick={() => handleMakeShake(shake)}
                    >
                      <Flame className="h-4 w-4 mr-2" />
                      Make This Shake
                    </Button>
                    <Button variant="outline" onClick={() => handleShareShake(shake)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress (in-content) */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mt-8">
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
    </div>
  );
}
