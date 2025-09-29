import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Droplets, Clock, Heart, Star, Target, Flame, Leaf, Sparkles,
  Search, Share2, ArrowLeft, Plus, Zap, Apple, Activity, Camera
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const detoxJuices = [
  {
    id: 'detox-juice-1',
    name: 'Green Detox Elixir',
    description: 'Powerful blend of greens for deep cleansing',
    detoxType: 'Deep Cleanse',
    detoxLevel: 'Intense',
    servingSize: '16 oz',
    nutrition: {
      calories: 95,
      carbs: 22,
      fiber: 6,
      sugar: 14,
      vitamin_c: 180,
      chlorophyll: 'Very High'
    },
    ingredients: ['Cucumber (1 large)', 'Celery (4 stalks)', 'Kale (2 cups)', 'Green Apple (1 small)', 'Lemon (1 whole)', 'Ginger (1 inch)', 'Parsley (1/4 cup)'],
    benefits: ['Liver Support', 'Alkalizing', 'Anti-inflammatory', 'Hydration'],
    difficulty: 'Medium',
    prepTime: 8,
    rating: 4.6,
    reviews: 892,
    trending: true,
    featured: true,
    estimatedCost: 4.50,
    bestTime: 'Morning Fasted',
    duration: '1-Day',
    allergens: [],
    category: 'Green Juices'
  },
  {
    id: 'detox-juice-2',
    name: 'Beet & Carrot Liver Flush',
    description: 'Root vegetables for liver detoxification',
    detoxType: 'Liver Support',
    detoxLevel: 'Moderate',
    servingSize: '12 oz',
    nutrition: {
      calories: 110,
      carbs: 26,
      fiber: 4,
      sugar: 20,
      vitamin_a: 250,
      antioxidants: 'High'
    },
    ingredients: ['Beetroot (1 medium)', 'Carrots (3 medium)', 'Green Apple (1 medium)', 'Lemon (1/2)', 'Ginger (1/2 inch)', 'Turmeric (1/4 tsp)'],
    benefits: ['Liver Cleanse', 'Blood Purifying', 'Antioxidants', 'Energy Boost'],
    difficulty: 'Easy',
    prepTime: 6,
    rating: 4.8,
    reviews: 1234,
    trending: false,
    featured: true,
    estimatedCost: 3.75,
    bestTime: 'Afternoon',
    duration: '1-Day',
    allergens: [],
    category: 'Root Juices'
  },
  {
    id: 'detox-juice-3',
    name: 'Citrus Immunity Boost',
    description: 'Vitamin C packed citrus for immune system',
    detoxType: 'Immune Support',
    detoxLevel: 'Gentle',
    servingSize: '14 oz',
    nutrition: {
      calories: 140,
      carbs: 34,
      fiber: 2,
      sugar: 28,
      vitamin_c: 300,
      natural_enzymes: 'High'
    },
    ingredients: ['Oranges (3 large)', 'Grapefruit (1 medium)', 'Lemon (1 whole)', 'Lime (1 whole)', 'Fresh Mint (6 leaves)', 'Cayenne Pepper (pinch)'],
    benefits: ['Immune Boost', 'Vitamin C', 'Metabolism', 'Hydration'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.5,
    reviews: 678,
    trending: true,
    featured: false,
    estimatedCost: 3.25,
    bestTime: 'Morning',
    duration: '1-Day',
    allergens: [],
    category: 'Citrus Juices'
  },
  {
    id: 'detox-juice-4',
    name: 'Red Cleanse Revitalizer',
    description: 'Antioxidant-rich red fruits and vegetables',
    detoxType: 'Antioxidant',
    detoxLevel: 'Gentle',
    servingSize: '14 oz',
    nutrition: {
      calories: 125,
      carbs: 30,
      fiber: 5,
      sugar: 24,
      anthocyanins: 'Very High',
      lycopene: 'High'
    },
    ingredients: ['Tomatoes (2 large)', 'Red Bell Pepper (1 large)', 'Strawberries (1 cup)', 'Watermelon (2 cups)', 'Lemon (1/2)', 'Basil (4 leaves)'],
    benefits: ['Antioxidants', 'Skin Health', 'Heart Support', 'Anti-aging'],
    difficulty: 'Easy',
    prepTime: 6,
    rating: 4.4,
    reviews: 445,
    trending: false,
    featured: true,
    estimatedCost: 4.00,
    bestTime: 'Midday',
    duration: '1-Day',
    allergens: [],
    category: 'Red Juices'
  },
  {
    id: 'detox-juice-5',
    name: 'Digestive Reset Blend',
    description: 'Gentle on stomach, promotes gut health',
    detoxType: 'Digestive',
    detoxLevel: 'Gentle',
    servingSize: '12 oz',
    nutrition: {
      calories: 85,
      carbs: 20,
      fiber: 4,
      sugar: 14,
      enzymes: 'High',
      probiotics: 'Present'
    },
    ingredients: ['Pineapple (1.5 cups)', 'Papaya (1 cup)', 'Fresh Ginger (1 inch)', 'Lemon (1/2)', 'Fennel (1/4 bulb)', 'Mint (8 leaves)'],
    benefits: ['Digestive Enzymes', 'Gut Health', 'Bloating Relief', 'Soothing'],
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.7,
    reviews: 789,
    trending: false,
    featured: false,
    estimatedCost: 4.25,
    bestTime: 'After Meals',
    duration: '1-Day',
    allergens: [],
    category: 'Digestive Juices'
  },
  {
    id: 'detox-juice-6',
    name: 'Metabolism Fire Tonic',
    description: 'Spicy blend to boost metabolism and circulation',
    detoxType: 'Metabolic',
    detoxLevel: 'Intense',
    servingSize: '10 oz',
    nutrition: {
      calories: 70,
      carbs: 16,
      fiber: 3,
      sugar: 10,
      capsaicin: 'High',
      warming_properties: 'Very High'
    },
    ingredients: ['Green Apple (2 medium)', 'Lemon (1 whole)', 'Fresh Ginger (2 inches)', 'Cayenne Pepper (1/4 tsp)', 'Turmeric (1 tsp)', 'Black Pepper (pinch)'],
    benefits: ['Metabolism Boost', 'Thermogenic', 'Anti-inflammatory', 'Circulation'],
    difficulty: 'Medium',
    prepTime: 6,
    rating: 4.3,
    reviews: 556,
    trending: true,
    featured: true,
    estimatedCost: 2.75,
    bestTime: 'Morning',
    duration: '1-Day',
    allergens: [],
    category: 'Spicy Juices'
  },
  {
    id: 'detox-juice-7',
    name: 'Hydration Hero',
    description: 'Maximum hydration with electrolytes',
    detoxType: 'Hydration',
    detoxLevel: 'Gentle',
    servingSize: '16 oz',
    nutrition: {
      calories: 60,
      carbs: 14,
      fiber: 2,
      sugar: 10,
      electrolytes: 'Very High',
      potassium: 650
    },
    ingredients: ['Cucumber (2 large)', 'Coconut Water (1 cup)', 'Celery (3 stalks)', 'Lime (1 whole)', 'Fresh Mint (10 leaves)', 'Sea Salt (pinch)'],
    benefits: ['Deep Hydration', 'Electrolytes', 'Cooling', 'Skin Glow'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 923,
    trending: false,
    featured: false,
    estimatedCost: 3.50,
    bestTime: 'Post-Workout',
    duration: '1-Day',
    allergens: [],
    category: 'Hydrating Juices'
  },
  {
    id: 'detox-juice-8',
    name: 'Purple Power Cleanse',
    description: 'Antioxidant-rich purple produce for cellular health',
    detoxType: 'Cellular',
    detoxLevel: 'Moderate',
    servingSize: '14 oz',
    nutrition: {
      calories: 135,
      carbs: 32,
      fiber: 6,
      sugar: 26,
      anthocyanins: 'Very High',
      resveratrol: 'High'
    },
    ingredients: ['Red Cabbage (1 cup)', 'Blueberries (1 cup)', 'Blackberries (1/2 cup)', 'Red Grapes (1 cup)', 'Lemon (1/2)', 'Ginger (1/2 inch)'],
    benefits: ['Cellular Health', 'Brain Health', 'Anti-aging', 'Antioxidants'],
    difficulty: 'Medium',
    prepTime: 7,
    rating: 4.5,
    reviews: 667,
    trending: true,
    featured: false,
    estimatedCost: 5.25,
    bestTime: 'Anytime',
    duration: '1-Day',
    allergens: [],
    category: 'Purple Juices'
  }
];

const detoxTypes = [
  {
    id: 'deep-cleanse',
    name: 'Deep Cleanse',
    description: 'Intensive detoxification and system reset',
    icon: Flame,
    color: 'text-orange-600',
    intensity: 'Intense',
    duration: '1-3 Days',
    benefits: ['Full System Reset', 'Liver Support', 'Alkalizing']
  },
  {
    id: 'gentle-detox',
    name: 'Gentle Detox',
    description: 'Mild cleansing for daily wellness',
    icon: Leaf,
    color: 'text-green-600',
    intensity: 'Gentle',
    duration: 'Daily',
    benefits: ['Maintenance', 'Hydration', 'Nutrition']
  },
  {
    id: 'targeted',
    name: 'Targeted Support',
    description: 'Specific organ or system focus',
    icon: Target,
    color: 'text-blue-600',
    intensity: 'Moderate',
    duration: '1-5 Days',
    benefits: ['Organ Support', 'Specific Goals', 'Therapeutic']
  },
  {
    id: 'metabolic',
    name: 'Metabolic Boost',
    description: 'Enhance metabolism and energy',
    icon: Zap,
    color: 'text-yellow-600',
    intensity: 'Moderate',
    duration: '1-7 Days',
    benefits: ['Metabolism', 'Energy', 'Weight Support']
  }
];

export default function DetoxJuicesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedDetoxType, setSelectedDetoxType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [detoxIntensity, setDetoxIntensity] = useState(['Any']);
  const [maxCalories, setMaxCalories] = useState([200]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const getFilteredJuices = () => {
    let filtered = detoxJuices.filter(juice => {
      const matchesSearch = juice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           juice.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedDetoxType || juice.detoxType.toLowerCase().includes(selectedDetoxType.toLowerCase());
      const matchesCategory = !selectedCategory || juice.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesIntensity = detoxIntensity[0] === 'Any' || juice.detoxLevel === detoxIntensity[0];
      const matchesCalories = juice.nutrition.calories <= maxCalories[0];
      
      return matchesSearch && matchesType && matchesCategory && matchesIntensity && matchesCalories;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        case 'intensity':
          const intensityOrder = { 'Intense': 3, 'Moderate': 2, 'Gentle': 1 };
          return (intensityOrder[b.detoxLevel] || 0) - (intensityOrder[a.detoxLevel] || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredJuices = getFilteredJuices();
  const featuredJuices = detoxJuices.filter(juice => juice.featured);

  const handleMakeJuice = (juice: any) => {
    addToRecentlyViewed({
      id: juice.id,
      name: juice.name,
      category: 'detoxes',
      description: juice.description,
      ingredients: juice.ingredients,
      nutrition: juice.nutrition,
      difficulty: juice.difficulty,
      prepTime: juice.prepTime,
      rating: juice.rating,
      bestTime: juice.bestTime
    });
    incrementDrinksMade();
    addPoints(25);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {showUniversalSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4">
            <UniversalSearch onClose={() => setShowUniversalSearch(false)} />
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="text-gray-500">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Detoxes
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Droplets className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Detox Juices</h1>
                <Badge className="bg-green-100 text-green-800">Cleansing</Badge>
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
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                <Camera className="h-4 w-4 mr-2" />
                Share Recipe
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">105</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">4.2g</div>
              <div className="text-sm text-gray-600">Avg Fiber</div>
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
              <div className="text-2xl font-bold text-emerald-600">8</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'detox-types', label: 'Detox Types', icon: Target },
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
          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search detox juices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedDetoxType}
                  onChange={(e) => setSelectedDetoxType(e.target.value)}
                >
                  <option value="">All Detox Types</option>
                  <option value="Deep Cleanse">Deep Cleanse</option>
                  <option value="Liver">Liver Support</option>
                  <option value="Digestive">Digestive</option>
                  <option value="Immune">Immune Support</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="Green">Green Juices</option>
                  <option value="Root">Root Juices</option>
                  <option value="Citrus">Citrus Juices</option>
                  <option value="Red">Red Juices</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={detoxIntensity[0]}
                  onChange={(e) => setDetoxIntensity([e.target.value])}
                >
                  <option value="Any">Any Intensity</option>
                  <option value="Intense">Intense</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Gentle">Gentle</option>
                </select>
                
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white min-w-[120px]">
                  <span>Max Cal:</span>
                  <Slider
                    value={maxCalories}
                    onValueChange={setMaxCalories}
                    max={200}
                    min={50}
                    step={10}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500">{maxCalories[0]}</span>
                </div>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="calories">Sort by Calories</option>
                  <option value="intensity">Sort by Intensity</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJuices.map(juice => (
                <Card key={juice.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{juice.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{juice.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToFavorites({
                          id: juice.id,
                          name: juice.name,
                          category: 'detoxes',
                          description: juice.description,
                          ingredients: juice.ingredients,
                          nutrition: juice.nutrition,
                          difficulty: juice.difficulty,
                          prepTime: juice.prepTime,
                          rating: juice.rating,
                          bestTime: juice.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(juice.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-100 text-green-800">{juice.detoxType}</Badge>
                      <Badge variant="outline">{juice.detoxLevel}</Badge>
                      {juice.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-green-600">{juice.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{juice.nutrition.fiber}g</div>
                        <div className="text-gray-500">Fiber</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-orange-600">{juice.prepTime}m</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Benefits:</h4>
                      <div className="flex flex-wrap gap-1">
                        {juice.benefits.slice(0, 3).map((benefit, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{juice.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">{juice.duration}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{juice.rating}</span>
                        <span className="text-gray-500 text-sm">({juice.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {juice.difficulty}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleMakeJuice(juice)}
                      >
                        <Droplets className="h-4 w-4 mr-2" />
                        Make Juice
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

        {activeTab === 'detox-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {detoxTypes.map(type => {
              const Icon = type.icon;
              const typeJuices = detoxJuices.filter(juice => 
                juice.detoxLevel === type.intensity ||
                juice.detoxType.toLowerCase().includes(type.name.toLowerCase())
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
                        <div className="text-sm font-medium text-gray-700 mb-1">Intensity</div>
                        <div className="text-lg font-bold text-green-600">{type.intensity}</div>
                      </div>
                      
                      <div className="text-center bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Duration</div>
                        <div className="text-sm text-blue-800">{type.duration}</div>
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
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color} mb-1`}>
                        {typeJuices.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setDetoxIntensity([type.intensity]);
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
            {featuredJuices.map(juice => (
              <Card key={juice.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative bg-gradient-to-br from-green-100 to-emerald-100 h-48 flex items-center justify-center">
                  <Droplets className="h-24 w-24 text-green-600 opacity-20" />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-green-500 text-white">Featured Cleanse</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-green-800">{juice.nutrition.calories} Cal</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{juice.name}</CardTitle>
                  <p className="text-gray-600">{juice.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-green-100 text-green-800">{juice.detoxType}</Badge>
                    <Badge variant="outline">{juice.detoxLevel}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{juice.rating}</span>
                      <span className="text-gray-500 text-sm">({juice.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-green-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{juice.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{juice.nutrition.fiber}g</div>
                      <div className="text-xs text-gray-600">Fiber</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{juice.prepTime}m</div>
                      <div className="text-xs text-gray-600">Prep Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-600">${juice.estimatedCost}</div>
                      <div className="text-xs text-gray-600">Cost</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Detox Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {juice.benefits.map((benefit, index) => (
                        <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-green-600 font-semibold">{juice.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Duration:</div>
                        <div className="text-blue-600 font-semibold">{juice.duration}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {juice.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Leaf className="h-3 w-3 text-green-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleMakeJuice(juice)}
                    >
                      <Droplets className="h-4 w-4 mr-2" />
                      Start Cleanse
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

      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="rounded-full w-14 h-14 bg-green-600 hover:bg-green-700 shadow-lg"
          onClick={() => setActiveTab('browse')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">Detox Juices Found:</span>
              <span className="font-bold text-green-600">{filteredJuices.length}</span>
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
