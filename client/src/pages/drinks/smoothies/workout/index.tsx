import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Dumbbell, Clock, Users, Trophy, Heart, Star, 
  Search, Filter, Share2, ArrowLeft, Activity,
  BarChart3, Sparkles, Plus, Camera, Zap, X, Check,
  Apple, Sun, Leaf, Palmtree, Droplets
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

// Workout smoothies data
const workoutSmoothies = [
  {
    id: 'workout-1',
    name: 'Pre-Workout Power Blend',
    description: 'Energy-boosting smoothie for intense workouts',
    ingredients: ['1 banana', '1/2 cup oats', '1 tbsp peanut butter', '1 cup almond milk', '1 tsp honey', 'Ice'],
    benefits: ['Sustained energy', 'Complex carbs', 'Healthy fats', 'Pre-workout fuel'],
    nutrition: { calories: 350, protein: 12, carbs: 48, fiber: 7 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 523,
    workoutType: 'Pre-Workout',
    energyLevel: 'High',
    featured: true,
    trending: true,
    bestTime: '30-60 min before workout',
    image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop'
  },
  {
    id: 'workout-2',
    name: 'Post-Workout Recovery',
    description: 'Protein-packed recovery smoothie',
    ingredients: ['1 cup mixed berries', '1 scoop protein powder', '1 banana', '1 cup coconut water', '1 tbsp chia seeds', 'Ice'],
    benefits: ['Muscle recovery', 'Protein synthesis', 'Rehydration', 'Antioxidants'],
    nutrition: { calories: 320, protein: 25, carbs: 42, fiber: 8 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 687,
    workoutType: 'Post-Workout',
    energyLevel: 'Recovery',
    featured: true,
    bestTime: 'Within 30 min after workout'
  },
  {
    id: 'workout-3',
    name: 'HIIT Energy Booster',
    description: 'Quick energy for high-intensity training',
    ingredients: ['1/2 cup pineapple', '1/2 banana', '1 cup spinach', '1/2 cup coconut water', '1 tbsp honey', 'Ice'],
    benefits: ['Quick energy', 'Electrolytes', 'Natural sugars', 'Hydration'],
    nutrition: { calories: 180, protein: 3, carbs: 42, fiber: 4 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 412,
    workoutType: 'Pre-Workout',
    energyLevel: 'Very High',
    trending: true,
    bestTime: '15-30 min before workout'
  },
  {
    id: 'workout-4',
    name: 'Endurance Builder',
    description: 'Sustained energy for long workouts',
    ingredients: ['1/2 cup oats', '1 banana', '2 tbsp almond butter', '1 cup milk', '1 tsp cinnamon', 'Ice'],
    benefits: ['Long-lasting energy', 'Slow-release carbs', 'Healthy fats', 'Stamina boost'],
    nutrition: { calories: 420, protein: 15, carbs: 52, fiber: 9 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 298,
    workoutType: 'Endurance',
    energyLevel: 'Sustained',
    bestTime: '1 hour before workout'
  },
  {
    id: 'workout-5',
    name: 'Strength Training Fuel',
    description: 'Muscle-building pre-workout blend',
    ingredients: ['1 cup Greek yogurt', '1/2 cup oats', '1 banana', '2 tbsp peanut butter', '1/2 cup milk', 'Ice'],
    benefits: ['Muscle fuel', 'Protein rich', 'Energy boost', 'Strength support'],
    nutrition: { calories: 480, protein: 28, carbs: 58, fiber: 7 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 534,
    workoutType: 'Strength',
    energyLevel: 'High',
    featured: true,
    bestTime: '45 min before workout'
  },
  {
    id: 'workout-6',
    name: 'Cardio Crush',
    description: 'Light and energizing for cardio sessions',
    ingredients: ['1 cup watermelon', '1/2 cup strawberries', '1/2 banana', '1 cup coconut water', '1 tbsp lime juice', 'Ice'],
    benefits: ['Hydration', 'Natural electrolytes', 'Light energy', 'Fat burning support'],
    nutrition: { calories: 160, protein: 3, carbs: 38, fiber: 4 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.5,
    reviews: 367,
    workoutType: 'Cardio',
    energyLevel: 'Medium',
    bestTime: '30 min before cardio'
  },
  {
    id: 'workout-7',
    name: 'Recovery Greens',
    description: 'Anti-inflammatory post-workout blend',
    ingredients: ['2 cups spinach', '1/2 avocado', '1/2 banana', '1 cup coconut water', '1 tbsp ginger', '1 tsp honey', 'Ice'],
    benefits: ['Reduces inflammation', 'Aids recovery', 'Nutrient dense', 'Alkalizing'],
    nutrition: { calories: 240, protein: 5, carbs: 32, fiber: 10 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 445,
    workoutType: 'Recovery',
    energyLevel: 'Recovery',
    bestTime: 'After workout'
  },
  {
    id: 'workout-8',
    name: 'Yoga Flow Blend',
    description: 'Light and energizing for yoga practice',
    ingredients: ['1 cup mango', '1/2 cup pineapple', '1/2 cup spinach', '1 cup coconut water', '1 tsp matcha powder', 'Ice'],
    benefits: ['Gentle energy', 'Mindful fuel', 'Antioxidants', 'Calm focus'],
    nutrition: { calories: 200, protein: 4, carbs: 44, fiber: 5 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 389,
    workoutType: 'Yoga',
    energyLevel: 'Gentle',
    trending: true,
    bestTime: '30-60 min before practice'
  }
];

const workoutTypes = [
  {
    id: 'pre-workout',
    name: 'Pre-Workout',
    icon: Zap,
    description: 'Energy boost before training',
    color: 'bg-orange-500',
    timing: '30-60 min before',
    focus: 'Energy & Performance'
  },
  {
    id: 'post-workout',
    name: 'Post-Workout',
    icon: Trophy,
    description: 'Recovery and muscle repair',
    color: 'bg-blue-500',
    timing: 'Within 30 min after',
    focus: 'Recovery & Protein'
  },
  {
    id: 'endurance',
    name: 'Endurance',
    icon: Activity,
    description: 'Sustained energy for long sessions',
    color: 'bg-green-500',
    timing: '1 hour before',
    focus: 'Stamina & Endurance'
  }
];

const smoothieSubcategories = [
  { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Apple, description: 'High protein blends' },
  { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Sun, description: 'Morning fuel' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Leafy greens' },
  { id: 'tropical', name: 'Tropical', path: '/drinks/smoothies/tropical', icon: Palmtree, description: 'Island flavors' },
  { id: 'berry', name: 'Berry', path: '/drinks/smoothies/berry', icon: Heart, description: 'Antioxidant rich' },
  { id: 'detox', name: 'Detox', path: '/drinks/smoothies/detox', icon: Droplets, description: 'Cleansing blends' },
  { id: 'dessert', name: 'Dessert', path: '/drinks/smoothies/dessert', icon: Sparkles, description: 'Sweet treats' }
];

const otherDrinkHubs = [
  { id: 'juices', name: 'Fresh Juices', route: '/drinks/juices', icon: Droplets, description: 'Cold-pressed nutrition' },
  { id: 'teas', name: 'Specialty Teas', route: '/drinks/teas', icon: Sun, description: 'Hot & iced teas' },
  { id: 'coffee', name: 'Coffee Drinks', route: '/drinks/coffee', icon: Zap, description: 'Artisan coffee' },
  { id: 'protein-shakes', name: 'Protein Shakes', route: '/drinks/protein-shakes', icon: Apple, description: 'Muscle fuel' }
];

export default function WorkoutSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [selectedWorkoutType, setSelectedWorkoutType] = useState('');
  const [selectedIntensity, setSelectedIntensity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSmoothie, setSelectedSmoothie] = useState<any>(null);

  const getFilteredSmoothies = () => {
    let filtered = workoutSmoothies.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesWorkoutType = !selectedWorkoutType || smoothie.workoutType.toLowerCase().includes(selectedWorkoutType.toLowerCase());
      const matchesIntensity = !selectedIntensity || smoothie.energyLevel.toLowerCase().includes(selectedIntensity.toLowerCase());
      
      return matchesSearch && matchesWorkoutType && matchesIntensity;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition?.protein || 0) - (a.nutrition?.protein || 0);
        case 'calories': return (a.nutrition?.calories || 0) - (b.nutrition?.calories || 0);
        case 'time': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = workoutSmoothies.filter(smoothie => smoothie.featured);
  const trendingSmoothies = workoutSmoothies.filter(smoothie => smoothie.trending);

  const handleMakeSmoothie = (smoothie: any) => {
    setSelectedSmoothie(smoothie);
    setShowModal(true);
  };

  const handleCompleteSmoothie = () => {
    if (selectedSmoothie) {
      addToRecentlyViewed({
        id: selectedSmoothie.id,
        name: selectedSmoothie.name,
        category: 'smoothies',
        description: selectedSmoothie.description,
        ingredients: selectedSmoothie.ingredients,
        nutrition: selectedSmoothie.nutrition,
        difficulty: selectedSmoothie.difficulty,
        prepTime: selectedSmoothie.prepTime,
        rating: selectedSmoothie.rating,
        fitnessGoal: selectedSmoothie.workoutType,
        bestTime: selectedSmoothie.bestTime
      });
      incrementDrinksMade();
      addPoints(30);
    }
    setShowModal(false);
    setSelectedSmoothie(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
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

      {/* Make Smoothie Modal */}
      {showModal && selectedSmoothie && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedSmoothie.name}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Ingredients:</h3>
                <ul className="space-y-2">
                  {selectedSmoothie.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-orange-600" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {selectedSmoothie.benefits && (
                <div>
                  <h3 className="font-semibold mb-2">Workout Benefits:</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {selectedSmoothie.benefits.map((benefit, idx) => (
                      <li key={idx}>• {benefit}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 p-3 bg-orange-50 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-orange-600">{selectedSmoothie.nutrition.protein}g</div>
                  <div className="text-xs text-gray-600">Protein</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{selectedSmoothie.nutrition.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">{selectedSmoothie.prepTime}min</div>
                  <div className="text-xs text-gray-600">Prep</div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
                  onClick={handleCompleteSmoothie}
                >
                  Complete Smoothie (+30 XP)
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
              <Link href="/drinks/smoothies">
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Smoothies
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Activity className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">Workout Smoothies</h1>
                <Badge className="bg-orange-100 text-orange-800">Performance</Badge>
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
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
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
                      <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SISTER SUBPAGES NAVIGATION */}
        <Card className="bg-gradient-to-r from-orange-50 to-green-50 border-orange-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {smoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-orange-50 hover:border-orange-300">
                      <Icon className="h-4 w-4 mr-2 text-orange-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{subcategory.name}</div>
                        <div className="text-xs text-gray-500">{subcategory.description}</div>
                      </div>
                      <ArrowLeft className="h-3 w-3 ml-auto rotate-180" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">15g+</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">4.6★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">4 min</div>
              <div className="text-sm text-gray-600">Avg Prep</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{workoutSmoothies.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'types', label: 'Workout Types', icon: Activity },
            { id: 'featured', label: 'Featured', icon: Star },
            { id: 'trending', label: 'Trending', icon: Zap }
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
                      placeholder="Search workout smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={selectedWorkoutType}
                      onChange={(e) => setSelectedWorkoutType(e.target.value)}
                    >
                      <option value="">All Workout Types</option>
                      {workoutTypes.map(type => (
                        <option key={type.id} value={type.name}>{type.name}</option>
                      ))}
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={selectedIntensity}
                      onChange={(e) => setSelectedIntensity(e.target.value)}
                    >
                      <option value="">All Intensities</option>
                      <option value="High">High Energy</option>
                      <option value="Recovery">Recovery</option>
                      <option value="Sustained">Sustained</option>
                      <option value="Gentle">Gentle</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="protein">Sort by Protein</option>
                      <option value="calories">Sort by Calories</option>
                      <option value="time">Sort by Prep Time</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Smoothie Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSmoothies.map(smoothie => (
                <Card key={smoothie.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToFavorites({
                          id: smoothie.id,
                          name: smoothie.name,
                          category: 'smoothies',
                          description: smoothie.description,
                          ingredients: smoothie.ingredients,
                          nutrition: smoothie.nutrition,
                          difficulty: smoothie.difficulty,
                          prepTime: smoothie.prepTime,
                          rating: smoothie.rating,
                          fitnessGoal: smoothie.workoutType,
                          bestTime: smoothie.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{smoothie.workoutType}</Badge>
                      <Badge className="bg-orange-100 text-orange-800">{smoothie.energyLevel}</Badge>
                      {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-orange-600">{smoothie.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="font-bold text-green-600">{smoothie.nutrition.calories}</div>
                        <div className="text-gray-500">Calories</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">{smoothie.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium text-xs">{smoothie.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Energy Level:</span>
                        <span className="font-medium">{smoothie.energyLevel}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{smoothie.rating}</span>
                        <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {smoothie.difficulty}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                        onClick={() => handleMakeSmoothie(smoothie)}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Make Smoothie
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

        {activeTab === 'types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workoutTypes.map(type => {
              const Icon = type.icon;
              const typeSmoothies = workoutSmoothies.filter(smoothie => 
                smoothie.workoutType.toLowerCase().includes(type.id.replace('-', ' '))
              );
              
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${type.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${type.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{type.name}</CardTitle>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Timing:</span>
                        <span className="font-medium">{type.timing}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Focus:</span>
                        <span className="font-medium">{type.focus}</span>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color.replace('bg-', 'text-')} mb-1`}>
                        {typeSmoothies.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedWorkoutType(type.name);
                          setActiveTab('browse');
                        }}
                      >
                        View {type.name} Smoothies
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
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  {smoothie.image && (
                    <img 
                      src={smoothie.image} 
                      alt={smoothie.name}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-yellow-500 text-white">Featured</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{smoothie.workoutType}</Badge>
                    <Badge className="bg-orange-100 text-orange-800">{smoothie.energyLevel}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{smoothie.rating}</span>
                      <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-orange-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{smoothie.nutrition.protein}g</div>
                      <div className="text-xs text-gray-600">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{smoothie.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.carbs}g</div>
                      <div className="text-xs text-gray-600">Carbs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">{smoothie.prepTime}min</div>
                      <div className="text-xs text-gray-600">Prep</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleMakeSmoothie(smoothie)}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Make This Smoothie
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

        {activeTab === 'trending' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="hover:shadow-lg transition-shadow border-2 border-orange-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                      <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                    </div>
                    <Badge className="bg-red-500 text-white">🔥 Trending</Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    onClick={() => handleMakeSmoothie(smoothie)}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Try This Trend
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress (in-content) */}
        <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-orange-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-yellow-600">
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
