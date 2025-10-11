// client/src/pages/drinks/detoxes/tea/index.tsx
import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Coffee, Clock, Heart, Star, Target, Flame, Leaf, Sparkles,
  Search, Share2, ArrowLeft, Zap, Camera, Droplets,
  Apple, FlaskConical, GlassWater, Waves, X, Check
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';
import { DetoxRecipe } from '../../types/detox';

const detoxTeas: DetoxRecipe[] = [
  {
    id: 'tea-1',
    name: 'Green Tea Ginger Detox',
    description: 'Metabolic boosting blend with fresh ginger',
    ingredients: [
      '1 tsp loose green tea leaves',
      '1 inch fresh ginger, thinly sliced',
      'Juice of 1/2 lemon',
      '8 oz hot water (175°F)'
    ],
    benefits: ['Boosts metabolism', 'Aids digestion', 'Antioxidant rich'],
    nutrition: { calories: 5, caffeine: 30 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.8,
    reviews: 234,
    teaType: 'Green',
    detoxFocus: 'Metabolic',
    brewTemp: '175°F',
    steepTime: '3 minutes',
    bestTime: 'Morning',
    duration: 'All day',
    estimatedCost: 0.50,
    featured: true,
    trending: false
  },
  {
    id: 'tea-2',
    name: 'Dandelion Root Cleanse',
    description: 'Liver support with herbal roots',
    ingredients: [
      '1 tsp dandelion root',
      '1/2 tsp burdock root',
      '1 cinnamon stick',
      '8 oz hot water (212°F)'
    ],
    benefits: ['Liver detox', 'Blood purification', 'Anti-inflammatory'],
    nutrition: { calories: 2, caffeine: 0 },
    difficulty: 'Easy',
    prepTime: 7,
    rating: 4.7,
    reviews: 189,
    teaType: 'Herbal',
    detoxFocus: 'Liver Support',
    brewTemp: '212°F',
    steepTime: '5 minutes',
    bestTime: 'Evening',
    duration: 'Overnight',
    estimatedCost: 0.75,
    featured: false,
    trending: true
  },
  {
    id: 'tea-3',
    name: 'Peppermint Digestive Aid',
    description: 'Soothing herbal for gut health',
    ingredients: [
      '1 tbsp fresh peppermint leaves',
      '1/2 tsp fennel seeds',
      '8 oz hot water (212°F)'
    ],
    benefits: ['Relieves bloating', 'Improves digestion', 'Calms stomach'],
    nutrition: { calories: 3, caffeine: 0 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 456,
    teaType: 'Herbal',
    detoxFocus: 'Digestive',
    brewTemp: '212°F',
    steepTime: '4 minutes',
    bestTime: 'After meals',
    duration: '1 hour',
    estimatedCost: 0.40,
    featured: true,
    trending: false
  },
  {
    id: 'tea-4',
    name: 'Turmeric Golden Milk Tea',
    description: 'Anti-inflammatory golden blend',
    ingredients: [
      '1 tsp turmeric powder',
      '1/2 tsp black pepper',
      '1/2 cup almond milk',
      '1 tsp honey',
      '8 oz hot water (212°F)'
    ],
    benefits: ['Reduces inflammation', 'Supports immunity', 'Joint health'],
    nutrition: { calories: 45, caffeine: 0 },
    difficulty: 'Medium',
    prepTime: 8,
    rating: 4.6,
    reviews: 312,
    teaType: 'Herbal',
    detoxFocus: 'Anti-inflammatory',
    brewTemp: '212°F',
    steepTime: '5 minutes',
    bestTime: 'Evening',
    duration: 'All night',
    estimatedCost: 0.60,
    featured: false,
    trending: true
  },
  {
    id: 'tea-5',
    name: 'White Tea Skin Glow',
    description: 'Gentle white tea for radiant skin',
    ingredients: [
      '1 tsp white tea leaves',
      '1/2 tsp rose petals',
      '8 oz hot water (185°F)'
    ],
    benefits: ['Antioxidant protection', 'Skin hydration', 'Anti-aging'],
    nutrition: { calories: 2, caffeine: 15 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 167,
    teaType: 'White',
    detoxFocus: 'Anti-inflammatory',
    brewTemp: '185°F',
    steepTime: '2 minutes',
    bestTime: 'Morning',
    duration: 'Daytime',
    estimatedCost: 0.80,
    featured: true,
    trending: false
  },
  {
    id: 'tea-6',
    name: 'Oolong Fat Burner',
    description: 'Oolong for metabolic support',
    ingredients: [
      '1 tsp oolong tea leaves',
      '1/2 lemon peel',
      '8 oz hot water (195°F)'
    ],
    benefits: ['Fat metabolism', 'Weight management', 'Energy boost'],
    nutrition: { calories: 4, caffeine: 40 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.5,
    reviews: 278,
    teaType: 'Oolong',
    detoxFocus: 'Metabolic',
    brewTemp: '195°F',
    steepTime: '3 minutes',
    bestTime: 'Afternoon',
    duration: '3 hours',
    estimatedCost: 0.55,
    featured: false,
    trending: true
  },
  {
    id: 'tea-7',
    name: 'Chamomile Calm Detox',
    description: 'Relaxing herbal for stress detox',
    ingredients: [
      '1 tbsp chamomile flowers',
      '1/2 tsp lavender buds',
      '8 oz hot water (212°F)'
    ],
    benefits: ['Stress reduction', 'Liver gentle cleanse', 'Sleep support'],
    nutrition: { calories: 1, caffeine: 0 },
    difficulty: 'Easy',
    prepTime: 6,
    rating: 4.8,
    reviews: 389,
    teaType: 'Herbal',
    detoxFocus: 'Liver Support',
    brewTemp: '212°F',
    steepTime: '5 minutes',
    bestTime: 'Evening',
    duration: 'Overnight',
    estimatedCost: 0.45,
    featured: true,
    trending: false
  },
  {
    id: 'tea-8',
    name: 'Sencha Green Cleanse',
    description: 'Pure green tea for full body detox',
    ingredients: [
      '1 tsp sencha green tea',
      '1/2 tsp matcha powder',
      '8 oz hot water (175°F)'
    ],
    benefits: ['Full body cleanse', 'Detox enzymes', 'Immune boost'],
    nutrition: { calories: 6, caffeine: 35 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.9,
    reviews: 521,
    teaType: 'Green',
    detoxFocus: 'Digestive',
    brewTemp: '175°F',
    steepTime: '2 minutes',
    bestTime: 'Morning',
    duration: 'All day',
    estimatedCost: 0.70,
    featured: false,
    trending: true
  }
];

const teaTypes = [
  {
    id: 'green',
    name: 'Green Tea',
    description: 'Lightly oxidized for maximum antioxidants',
    icon: Leaf,
    color: 'text-green-500',
    caffeine: 'Low (20-45mg)',
    benefits: ['Metabolic boost', 'Antioxidants', 'Heart health'],
    bestFor: 'Morning cleanse'
  },
  {
    id: 'herbal',
    name: 'Herbal Tea',
    description: 'Caffeine-free blends from herbs and spices',
    icon: Sparkles,
    color: 'text-purple-500',
    caffeine: 'None',
    benefits: ['Digestion', 'Relaxation', 'Immune support'],
    bestFor: 'Evening wind-down'
  },
  {
    id: 'white',
    name: 'White Tea',
    description: 'Delicate and least processed tea',
    icon: Droplets,
    color: 'text-blue-500',
    caffeine: 'Very Low (15-30mg)',
    benefits: ['Skin health', 'Gentle detox', 'Anti-aging'],
    bestFor: 'Daily maintenance'
  },
  {
    id: 'oolong',
    name: 'Oolong Tea',
    description: 'Partially oxidized for balanced flavor',
    icon: Flame,
    color: 'text-orange-500',
    caffeine: 'Medium (30-50mg)',
    benefits: ['Weight management', 'Cholesterol control', 'Energy'],
    bestFor: 'Afternoon pick-me-up'
  }
];

const otherDrinkHubs = [
  { id: 'smoothies', name: 'Smoothies', route: '/drinks/smoothies', icon: Apple, description: 'Nutrient-packed blends' },
  { id: 'protein-shakes', name: 'Protein Shakes', route: '/drinks/protein-shakes', icon: FlaskConical, description: 'Fitness-focused nutrition' },
  { id: 'detoxes', name: 'Detoxes Hub', route: '/drinks/detoxes', icon: Leaf, description: 'Cleanse & wellness' },
  { id: 'potent-potables', name: 'Potent Potables', route: '/drinks/potent-potables', icon: GlassWater, description: 'Cocktails & beverages' }
];

export default function DetoxTeasPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedTeaType, setSelectedTeaType] = useState('');
  const [selectedFocus, setSelectedFocus] = useState('');
  const [caffeineLevel, setCaffeineLevel] = useState(['Any']);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedTea, setSelectedTea] = useState<DetoxRecipe | null>(null);

  const getFilteredTeas = () => {
    let filtered = detoxTeas.filter(tea => {
      const matchesSearch = tea.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           tea.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedTeaType || tea.teaType?.toLowerCase().includes(selectedTeaType.toLowerCase());
      const matchesFocus = !selectedFocus || tea.detoxFocus?.toLowerCase().includes(selectedFocus.toLowerCase());
      const matchesCaffeine = caffeineLevel[0] === 'Any' || 
        (caffeineLevel[0] === 'Caffeinated' && (tea.nutrition.caffeine || 0) > 0) ||
        (caffeineLevel[0] === 'Caffeine-Free' && (tea.nutrition.caffeine || 0) === 0);
      
      return matchesSearch && matchesType && matchesFocus && matchesCaffeine;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'prepTime': return (a.prepTime || 0) - (b.prepTime || 0);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredTeas = getFilteredTeas();
  const featuredTeas = detoxTeas.filter(tea => tea.featured);

  const handleMakeTea = (tea: DetoxRecipe) => {
    setSelectedTea(tea);
    setShowModal(true);
  };

  const handleCompleteTea = () => {
    if (selectedTea) {
      addToRecentlyViewed({
        id: selectedTea.id,
        name: selectedTea.name,
        category: 'detoxes',
        description: selectedTea.description,
        ingredients: selectedTea.ingredients,
        nutrition: selectedTea.nutrition,
        difficulty: selectedTea.difficulty,
        prepTime: selectedTea.prepTime,
        rating: selectedTea.rating,
        bestTime: selectedTea.bestTime
      });
      incrementDrinksMade();
      addPoints(20);
    }
    setShowModal(false);
    setSelectedTea(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setShowUniversalSearch(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

      {/* Make Tea Modal */}
      {showModal && selectedTea && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedTea.name}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Ingredients:</h3>
                <ul className="space-y-2">
                  {selectedTea.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-amber-600" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Benefits:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {selectedTea.benefits.map((benefit, idx) => (
                    <li key={idx}>• {benefit}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Brew Temp:</span>
                    <div className="font-medium">{selectedTea.brewTemp}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Steep Time:</span>
                    <div className="font-medium">{selectedTea.steepTime}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-amber-100 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-amber-600">{selectedTea.nutrition.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">{selectedTea.nutrition.caffeine}mg</div>
                  <div className="text-xs text-gray-600">Caffeine</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-orange-600">{selectedTea.prepTime}min</div>
                  <div className="text-xs text-gray-600">Prep</div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  onClick={handleCompleteTea}
                >
                  Complete Tea (+20 XP)
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
              <Link href="/drinks/detoxes">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Detoxes
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Coffee className="h-6 w-6 text-amber-600" />
                <h1 className="text-2xl font-bold text-gray-900">Detox Teas</h1>
                <Badge className="bg-amber-100 text-amber-800">Cleansing</Badge>
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
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                <Camera className="h-4 w-4 mr-2" />
                Share Recipe
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* CROSS-HUB NAVIGATION */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Link href="/drinks/smoothies">
                <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                  <Apple className="h-4 w-4 mr-2 text-green-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Smoothies</div>
                    <div className="text-xs text-gray-500">Nutrient-packed blends</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/protein-shakes">
                <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300">
                  <FlaskConical className="h-4 w-4 mr-2 text-blue-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Protein Shakes</div>
                    <div className="text-xs text-gray-500">Fitness-focused nutrition</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/detoxes">
                <Button variant="outline" className="w-full justify-start hover:bg-teal-50 hover:border-teal-300 border-teal-400">
                  <Leaf className="h-4 w-4 mr-2 text-teal-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Detoxes Hub</div>
                    <div className="text-xs text-gray-500">Cleanse & wellness</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/potent-potables">
                <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:border-purple-300">
                  <GlassWater className="h-4 w-4 mr-2 text-purple-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Potent Potables</div>
                    <div className="text-xs text-gray-500">Cocktails & beverages</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* SISTER SUBPAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Detox Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link href="/drinks/detoxes/juice">
                <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300">
                  <Droplets className="h-4 w-4 mr-2 text-green-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Detox Juices</div>
                    <div className="text-xs text-gray-500">Cold-pressed cleansing</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
              <Link href="/drinks/detoxes/water">
                <Button variant="outline" className="w-full justify-start hover:bg-cyan-50 hover:border-cyan-300">
                  <Waves className="h-4 w-4 mr-2 text-cyan-600" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">Infused Waters</div>
                    <div className="text-xs text-gray-500">Fruit & herb hydration</div>
                  </div>
                  <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">4</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">50%</div>
              <div className="text-sm text-gray-600">Caffeine-Free</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">100%</div>
              <div className="text-sm text-gray-600">Natural</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{detoxTeas.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'tea-types', label: 'Tea Types', icon: Coffee },
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

        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search detox teas..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2 items-center">
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-[120px]"
                      value={selectedTeaType}
                      onChange={(e) => setSelectedTeaType(e.target.value)}
                    >
                      <option value="">All Tea Types</option>
                      <option value="Green">Green Tea</option>
                      <option value="Herbal">Herbal</option>
                      <option value="White">White Tea</option>
                      <option value="Oolong">Oolong</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-[140px]"
                      value={selectedFocus}
                      onChange={(e) => setSelectedFocus(e.target.value)}
                    >
                      <option value="">All Focus Areas</option>
                      <option value="Metabolic">Metabolic</option>
                      <option value="Digestive">Digestive</option>
                      <option value="Liver">Liver Support</option>
                      <option value="Anti-inflammatory">Anti-inflammatory</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-[130px]"
                      value={caffeineLevel[0]}
                      onChange={(e) => setCaffeineLevel([e.target.value])}
                    >
                      <option value="Any">Any Caffeine</option>
                      <option value="Caffeinated">Caffeinated</option>
                      <option value="Caffeine-Free">Caffeine-Free</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-[120px]"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="prepTime">Sort by Prep Time</option>
                      <option value="cost">Sort by Cost</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tea Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeas.map(tea => (
                <Card key={tea.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{tea.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{tea.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToFavorites({
                          id: tea.id,
                          name: tea.name,
                          category: 'detoxes',
                          description: tea.description,
                          ingredients: tea.ingredients,
                          nutrition: tea.nutrition,
                          difficulty: tea.difficulty,
                          prepTime: tea.prepTime,
                          rating: tea.rating,
                          bestTime: tea.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(tea.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-amber-100 text-amber-800">{tea.teaType}</Badge>
                      <Badge variant="outline">{tea.detoxFocus}</Badge>
                      {tea.nutrition.caffeine === 0 && <Badge className="bg-green-100 text-green-800">Caffeine-Free</Badge>}
                      {tea.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-amber-600">{tea.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{tea.nutrition.caffeine}mg</div>
                        <div className="text-gray-500">Caffeine</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-orange-600">{tea.prepTime}m</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                    </div>

                    <div className="mb-4 bg-amber-50 p-3 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Brew:</span>
                          <span className="font-medium ml-1">{tea.brewTemp}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Steep:</span>
                          <span className="font-medium ml-1">{tea.steepTime}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Benefits:</h4>
                      <div className="flex flex-wrap gap-1">
                        {tea.benefits.slice(0, 3).map((benefit, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{tea.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">{tea.duration}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{tea.rating}</span>
                        <span className="text-gray-500 text-sm">({tea.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {tea.difficulty}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-amber-600 hover:bg-amber-700"
                        onClick={() => handleMakeTea(tea)}
                      >
                        <Coffee className="h-4 w-4 mr-2" />
                        Brew Tea
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

        {activeTab === 'tea-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {teaTypes.map(type => {
              const Icon = type.icon;
              const typeTeas = detoxTeas.filter(tea => 
                tea.teaType?.toLowerCase().includes(type.name.toLowerCase()) ||
                tea.category?.toLowerCase().includes(type.name.toLowerCase())
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
                        <div className="text-sm font-medium text-gray-700 mb-1">Caffeine Level</div>
                        <div className="text-lg font-bold text-amber-600">{type.caffeine}</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Benefits:</h4>
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
                        {typeTeas.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedTeaType(type.name.split(' ')[0]);
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

        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredTeas.map(tea => (
              <Card key={tea.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative bg-gradient-to-br from-amber-100 to-orange-100 h-48 flex items-center justify-center">
                  <Coffee className="h-24 w-24 text-amber-600 opacity-20" />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-amber-500 text-white">Featured Tea</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-amber-800">{tea.nutrition.caffeine}mg Caffeine</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{tea.name}</CardTitle>
                  <p className="text-gray-600">{tea.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-amber-100 text-amber-800">{tea.teaType}</Badge>
                    <Badge variant="outline">{tea.detoxFocus}</Badge>
                    {tea.nutrition.caffeine === 0 && <Badge className="bg-green-100 text-green-800">Caffeine-Free</Badge>}
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{tea.rating}</span>
                      <span className="text-gray-500 text-sm">({tea.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-amber-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-600">{tea.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{tea.nutrition.caffeine}mg</div>
                      <div className="text-xs text-gray-600">Caffeine</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{tea.prepTime}m</div>
                      <div className="text-xs text-gray-600">Prep Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">${tea.estimatedCost}</div>
                      <div className="text-xs text-gray-600">Cost</div>
                    </div>
                  </div>

                  <div className="mb-4 bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Brewing Instructions:</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Temperature:</span>
                        <div className="font-semibold text-amber-600">{tea.brewTemp}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Steep Time:</span>
                        <div className="font-semibold text-amber-600">{tea.steepTime}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Detox Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {tea.benefits.map((benefit, index) => (
                        <Badge key={index} className="bg-amber-100 text-amber-800 text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-amber-600 font-semibold">{tea.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Duration:</div>
                        <div className="text-blue-600 font-semibold">{tea.duration}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {tea.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Leaf className="h-3 w-3 text-amber-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-amber-600 hover:bg-amber-700"
                      onClick={() => handleMakeTea(tea)}
                    >
                      <Coffee className="h-4 w-4 mr-2" />
                      Brew This Tea
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

        {/* Your Progress (in-content) */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-amber-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-orange-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
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
