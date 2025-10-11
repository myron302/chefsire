import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Heart, Star, Search, Share2, ArrowLeft,
  Camera, Zap, Sparkles, X, Check, Apple, Sun, Droplets, Leaf
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

// Berry smoothies data
const berrySmoothies = [
  {
    id: 'berry-1',
    name: 'Triple Berry Blast',
    description: 'Strawberry, blueberry, and raspberry power',
    ingredients: ['1 cup strawberries', '1/2 cup blueberries', '1/2 cup raspberries', '1/2 banana', '1 cup almond milk', 'Ice'],
    benefits: ['Antioxidant powerhouse', 'Heart health', 'Brain boost', 'Anti-inflammatory'],
    nutrition: { calories: 220, protein: 5, carbs: 45, fiber: 10, sugar: 28 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 523,
    berryType: 'Mixed',
    featured: true,
    trending: true,
    bestTime: 'Morning/Afternoon',
    image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop'
  },
  {
    id: 'berry-2',
    name: 'Strawberry Fields',
    description: 'Classic strawberry smoothie perfection',
    ingredients: ['2 cups strawberries', '1/2 cup Greek yogurt', '1/4 cup oats', '1 tbsp honey', 'Ice'],
    benefits: ['Vitamin C boost', 'Protein rich', 'Sustained energy', 'Heart healthy'],
    nutrition: { calories: 280, protein: 12, carbs: 48, fiber: 8, sugar: 30 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 412,
    berryType: 'Strawberry',
    featured: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop'
  },
  {
    id: 'berry-3',
    name: 'Blueberry Bliss',
    description: 'Brain-boosting blueberry blend',
    ingredients: ['1.5 cups blueberries', '1/2 cup coconut milk', '1/4 cup cashews', '1 tbsp chia seeds', 'Ice'],
    benefits: ['Brain health', 'Memory boost', 'Antioxidants', 'Omega-3s'],
    nutrition: { calories: 310, protein: 8, carbs: 42, fiber: 11, sugar: 25 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 367,
    berryType: 'Blueberry',
    trending: true,
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&h=300&fit=crop'
  },
  {
    id: 'berry-4',
    name: 'Raspberry Revival',
    description: 'Tart raspberry refreshment',
    ingredients: ['1.5 cups raspberries', '1/2 cup Greek yogurt', '1/4 cup spinach', '1 tbsp maple syrup', 'Ice'],
    benefits: ['Digestive health', 'Fiber rich', 'Weight management', 'Vitamin C'],
    nutrition: { calories: 200, protein: 10, carbs: 35, fiber: 12, sugar: 18 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    reviews: 289,
    berryType: 'Raspberry',
    bestTime: 'Afternoon'
  },
  {
    id: 'berry-5',
    name: 'Blackberry Boost',
    description: 'Rich blackberry nutrition bomb',
    ingredients: ['1.5 cups blackberries', '1/2 banana', '1/2 cup oat milk', '1 tbsp almond butter', 'Ice'],
    benefits: ['Vitamin K', 'Bone health', 'Antioxidants', 'Healthy fats'],
    nutrition: { calories: 260, protein: 7, carbs: 44, fiber: 13, sugar: 22 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.7,
    reviews: 198,
    berryType: 'Blackberry',
    bestTime: 'Morning'
  },
  {
    id: 'berry-6',
    name: 'Açaí Power Bowl',
    description: 'Superfood açaí smoothie bowl',
    ingredients: ['2 açaí packets', '1/2 cup blueberries', '1/2 banana', '1/4 cup granola topping', '1/2 cup apple juice'],
    benefits: ['Superfood power', 'Energy boost', 'Antioxidants', 'Instagram-worthy'],
    nutrition: { calories: 350, protein: 6, carbs: 62, fiber: 9, sugar: 35 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.9,
    reviews: 645,
    berryType: 'Açaí',
    featured: true,
    trending: true,
    bestTime: 'Morning'
  },
  {
    id: 'berry-7',
    name: 'Berry Green Fusion',
    description: 'Berries meet green nutrition',
    ingredients: ['1 cup mixed berries', '1 cup spinach', '1/2 avocado', '1 cup coconut water', 'Ice'],
    benefits: ['Hidden greens', 'Complete nutrition', 'Healthy fats', 'Detoxifying'],
    nutrition: { calories: 240, protein: 5, carbs: 38, fiber: 11, sugar: 20 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 234,
    berryType: 'Mixed',
    bestTime: 'Morning'
  },
  {
    id: 'berry-8',
    name: 'Strawberry Banana Classic',
    description: 'The timeless favorite combination',
    ingredients: ['1.5 cups strawberries', '1 banana', '1 cup milk', '1/2 cup vanilla yogurt', 'Ice'],
    benefits: ['Classic taste', 'Kid-friendly', 'Potassium', 'Calcium'],
    nutrition: { calories: 290, protein: 11, carbs: 52, fiber: 7, sugar: 38 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 756,
    berryType: 'Strawberry',
    bestTime: 'Anytime'
  },
  {
    id: 'berry-9',
    name: 'Cranberry Citrus Zing',
    description: 'Tart cranberries with orange kick',
    ingredients: ['1 cup cranberries', '1 orange', '1/2 cup Greek yogurt', '1 tbsp honey', 'Ice'],
    benefits: ['UTI prevention', 'Immune boost', 'Vitamin C', 'Refreshing'],
    nutrition: { calories: 210, protein: 9, carbs: 40, fiber: 6, sugar: 28 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.4,
    reviews: 145,
    berryType: 'Cranberry',
    bestTime: 'Morning'
  }
];

const smoothieSubcategories = [
  { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Apple, description: 'High protein blends' },
  { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Sun, description: 'Morning fuel' },
  { id: 'workout', name: 'Workout', path: '/drinks/smoothies/workout', icon: Zap, description: 'Performance boost' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Leafy greens' },
  { id: 'tropical', name: 'Tropical', path: '/drinks/smoothies/tropical', icon: Sparkles, description: 'Island flavors' },
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

export default function BerrySmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite, 
    addToRecentlyViewed, 
    userProgress,
    addPoints,
    incrementDrinksMade
  } = useDrinks();

  const [activeTab, setActiveTab] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBerryType, setSelectedBerryType] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSmoothie, setSelectedSmoothie] = useState<any>(null);

  const getFilteredSmoothies = () => {
    let filtered = berrySmoothies.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBerryType = !selectedBerryType || smoothie.berryType.toLowerCase().includes(selectedBerryType.toLowerCase());
      
      return matchesSearch && matchesBerryType;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'fiber': return (b.nutrition.fiber || 0) - (a.nutrition.fiber || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        case 'time': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = berrySmoothies.filter(s => s.featured);
  const trendingSmoothies = berrySmoothies.filter(s => s.trending);

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
        fitnessGoal: 'Berry Nutrition',
        bestTime: selectedSmoothie.bestTime
      });
      incrementDrinksMade();
      addPoints(25);
    }
    setShowModal(false);
    setSelectedSmoothie(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-red-50">
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
                      <Check className="h-4 w-4 text-pink-600" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Berry Benefits:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {selectedSmoothie.benefits.map((benefit, idx) => (
                    <li key={idx}>• {benefit}</li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-pink-50 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-pink-600">{selectedSmoothie.nutrition.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-purple-600">{selectedSmoothie.nutrition.fiber}g</div>
                  <div className="text-xs text-gray-600">Fiber</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">{selectedSmoothie.prepTime}min</div>
                  <div className="text-xs text-gray-600">Prep</div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                  onClick={handleCompleteSmoothie}
                >
                  Complete Smoothie (+25 XP)
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
                <Heart className="h-6 w-6 text-pink-600" />
                <h1 className="text-2xl font-bold text-gray-900">Berry Smoothies</h1>
                <Badge className="bg-pink-100 text-pink-800">Antioxidant Rich</Badge>
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
              <Button size="sm" className="bg-pink-600 hover:bg-pink-700">
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
        <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Smoothie Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {smoothieSubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button variant="outline" className="w-full justify-start hover:bg-pink-50 hover:border-pink-300">
                      <Icon className="h-4 w-4 mr-2 text-pink-600" />
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
              <div className="text-2xl font-bold text-pink-600">260</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">9g</div>
              <div className="text-sm text-gray-600">Avg Fiber</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">4.7★</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{berrySmoothies.length}</div>
              <div className="text-sm text-gray-600">Recipes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
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
                      placeholder="Search berry smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={selectedBerryType}
                      onChange={(e) => setSelectedBerryType(e.target.value)}
                    >
                      <option value="">All Berry Types</option>
                      <option value="Mixed">Mixed Berries</option>
                      <option value="Strawberry">Strawberry</option>
                      <option value="Blueberry">Blueberry</option>
                      <option value="Raspberry">Raspberry</option>
                      <option value="Blackberry">Blackberry</option>
                      <option value="Açaí">Açaí</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Sort by Rating</option>
                      <option value="fiber">Sort by Fiber</option>
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
                          fitnessGoal: 'Berry Nutrition',
                          bestTime: smoothie.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-pink-100 text-pink-800">{smoothie.berryType}</Badge>
                      {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-pink-600">{smoothie.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-purple-600">{smoothie.nutrition.fiber}g</div>
                        <div className="text-gray-500">Fiber</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{smoothie.prepTime}min</div>
                        <div className="text-gray-500">Prep</div>
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
                        className="flex-1 bg-pink-600 hover:bg-pink-700"
                        onClick={() => handleMakeSmoothie(smoothie)}
                      >
                        <Heart className="h-4 w-4 mr-2" />
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

        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img 
                    src={smoothie.image} 
                    alt={smoothie.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-pink-500 text-white">Featured Berry</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-pink-100 text-pink-800">{smoothie.berryType}</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{smoothie.rating}</span>
                      <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-pink-600 hover:bg-pink-700"
                      onClick={() => handleMakeSmoothie(smoothie)}
                    >
                      <Heart className="h-4 w-4 mr-2" />
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
              <Card key={smoothie.id} className="hover:shadow-lg transition-shadow border-2 border-pink-200">
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
                    className="w-full bg-pink-600 hover:bg-pink-700"
                    onClick={() => handleMakeSmoothie(smoothie)}
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Try This Trend
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress (in-content) */}
        <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-pink-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-purple-600">
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
