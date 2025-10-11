import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Palmtree, Sun, Heart, Star, Search, Share2, ArrowLeft,
  Camera, Zap, Waves, Droplets, X, Check, Apple, Leaf, Sparkles
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

// Tropical smoothies data
const tropicalSmoothies = [
  {
    id: 'tropical-1',
    name: 'Island Paradise',
    description: 'Mango, pineapple, and coconut blend',
    ingredients: ['1 cup mango chunks', '1/2 cup pineapple', '1/4 cup coconut milk', '1/2 banana', 'Ice'],
    benefits: ['Vitamin C boost', 'Immune support', 'Tropical energy', 'Hydrating'],
    nutrition: { calories: 280, protein: 4, carbs: 58, fiber: 5, sugar: 45 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.8,
    reviews: 342,
    flavor: 'Sweet & Tropical',
    featured: true,
    trending: true,
    bestTime: 'Morning/Afternoon',
    image: 'https://images.unsplash.com/photo-1546548970-71785318a17b?w=400&h=300&fit=crop'
  },
  {
    id: 'tropical-2',
    name: 'Piña Colada Dream',
    description: 'Classic tropical vacation in a glass',
    ingredients: ['1 cup pineapple chunks', '1/2 cup coconut cream', '1/4 cup Greek yogurt', '1 tbsp honey', 'Ice'],
    benefits: ['Digestive enzymes', 'Creamy satisfaction', 'Energy boost', 'Tropical flavor'],
    nutrition: { calories: 320, protein: 8, carbs: 52, fiber: 4, sugar: 42 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.9,
    reviews: 445,
    flavor: 'Creamy Coconut',
    featured: true,
    bestTime: 'Afternoon',
    image: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&h=300&fit=crop'
  },
  {
    id: 'tropical-3',
    name: 'Mango Madness',
    description: 'Pure mango bliss with tropical twist',
    ingredients: ['1.5 cups mango', '1/2 orange juice', '1/4 cup passion fruit', '1 tbsp lime juice', 'Ice'],
    benefits: ['Antioxidant rich', 'Vitamin A', 'Eye health', 'Skin glow'],
    nutrition: { calories: 240, protein: 3, carbs: 56, fiber: 6, sugar: 48 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 298,
    flavor: 'Sweet Mango',
    bestTime: 'Morning',
    image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=300&fit=crop'
  },
  {
    id: 'tropical-4',
    name: 'Passionfruit Paradise',
    description: 'Exotic passionfruit with pineapple',
    ingredients: ['3 passionfruit', '1 cup pineapple', '1/2 banana', '1/2 cup coconut water', 'Ice'],
    benefits: ['Exotic flavor', 'Vitamin C', 'Hydration', 'Digestive support'],
    nutrition: { calories: 260, protein: 4, carbs: 60, fiber: 8, sugar: 44 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.6,
    reviews: 187,
    flavor: 'Tangy Tropical',
    trending: true,
    bestTime: 'Afternoon'
  },
  {
    id: 'tropical-5',
    name: 'Hawaiian Sunrise',
    description: 'Papaya, guava, and citrus sunshine',
    ingredients: ['1 cup papaya', '1/2 cup guava juice', '1/2 orange', '1 tbsp honey', 'Ice'],
    benefits: ['Digestive enzymes', 'Immune boost', 'Morning energy', 'Tropical vibes'],
    nutrition: { calories: 220, protein: 3, carbs: 52, fiber: 5, sugar: 40 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.5,
    reviews: 156,
    flavor: 'Citrus Tropical',
    bestTime: 'Morning'
  },
  {
    id: 'tropical-6',
    name: 'Coconut Beach Bliss',
    description: 'Creamy coconut with tropical fruits',
    ingredients: ['1/2 cup coconut milk', '1 cup mixed tropical fruit', '1/2 banana', '1 tbsp coconut flakes', 'Ice'],
    benefits: ['Healthy fats', 'Sustained energy', 'Creamy texture', 'Tropical escape'],
    nutrition: { calories: 340, protein: 5, carbs: 48, fiber: 6, sugar: 38 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 234,
    flavor: 'Creamy Coconut',
    featured: true,
    bestTime: 'Afternoon'
  },
  {
    id: 'tropical-7',
    name: 'Dragon Fruit Delight',
    description: 'Vibrant pink dragon fruit blend',
    ingredients: ['1 dragon fruit', '1/2 cup pineapple', '1/2 banana', '1/2 cup coconut water', 'Ice'],
    benefits: ['Antioxidants', 'Instagram-worthy', 'Vitamin C', 'Exotic taste'],
    nutrition: { calories: 200, protein: 3, carbs: 48, fiber: 7, sugar: 35 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.9,
    reviews: 389,
    flavor: 'Mild Sweet',
    trending: true,
    bestTime: 'Morning/Afternoon'
  },
  {
    id: 'tropical-8',
    name: 'Tropical Green Fusion',
    description: 'Spinach meets tropical paradise',
    ingredients: ['1 cup spinach', '1 cup mango', '1/2 pineapple', '1/2 cup coconut water', 'Ice'],
    benefits: ['Green nutrition', 'Tropical taste', 'Vitamin boost', 'Hidden veggies'],
    nutrition: { calories: 210, protein: 4, carbs: 50, fiber: 6, sugar: 38 },
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.6,
    reviews: 267,
    flavor: 'Tropical Green',
    bestTime: 'Morning'
  }
];

const smoothieSubcategories = [
  { id: 'protein', name: 'Protein', path: '/drinks/smoothies/protein', icon: Apple, description: 'High protein blends' },
  { id: 'breakfast', name: 'Breakfast', path: '/drinks/smoothies/breakfast', icon: Sun, description: 'Morning fuel' },
  { id: 'workout', name: 'Workout', path: '/drinks/smoothies/workout', icon: Zap, description: 'Performance boost' },
  { id: 'green', name: 'Green', path: '/drinks/smoothies/green', icon: Leaf, description: 'Leafy greens' },
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

export default function TropicalSmoothiesPage() {
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
  const [selectedFlavor, setSelectedFlavor] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSmoothie, setSelectedSmoothie] = useState<any>(null);

  const getFilteredSmoothies = () => {
    let filtered = tropicalSmoothies.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFlavor = !selectedFlavor || smoothie.flavor.toLowerCase().includes(selectedFlavor.toLowerCase());
      
      return matchesSearch && matchesFlavor;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        case 'time': return (a.prepTime || 0) - (b.prepTime || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = tropicalSmoothies.filter(s => s.featured);
  const trendingSmoothies = tropicalSmoothies.filter(s => s.trending);

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
        fitnessGoal: 'Tropical Energy',
        bestTime: selectedSmoothie.bestTime
      });
      incrementDrinksMade();
      addPoints(25);
    }
    setShowModal(false);
    setSelectedSmoothie(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50">
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
              <div>
                <h3 className="font-semibold mb-2">Tropical Benefits:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {selectedSmoothie.benefits.map((benefit, idx) => (
                    <li key={idx}>• {benefit}</li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-orange-50 rounded-lg">
                <div className="text-center">
                  <div className="font-bold text-orange-600">{selectedSmoothie.nutrition.calories}</div>
                  <div className="text-xs text-gray-600">Calories</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{selectedSmoothie.nutrition.fiber}g</div>
                  <div className="text-xs text-gray-600">Fiber</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">{selectedSmoothie.prepTime}min</div>
                  <div className="text-xs text-gray-600">Prep</div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button 
                  className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
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
                <Palmtree className="h-6 w-6 text-orange-600" />
                <h1 className="text-2xl font-bold text-gray-900">Tropical Smoothies</h1>
                <Badge className="bg-orange-100 text-orange-800">Island Vibes</Badge>
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
        <Card className="bg-gradient-to-r from-orange-50 to-pink-50 border-orange-200">
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
              <div className="text-2xl font-bold text-orange-600">250</div>
              <div className="text-sm text-gray-600">Avg Calories</div>
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
              <div className="text-2xl font-bold text-blue-600">4 min</div>
              <div className="text-sm text-gray-600">Avg Prep</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{tropicalSmoothies.length}</div>
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
                      placeholder="Search tropical smoothies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={selectedFlavor}
                      onChange={(e) => setSelectedFlavor(e.target.value)}
                    >
                      <option value="">All Flavors</option>
                      <option value="Sweet">Sweet & Tropical</option>
                      <option value="Creamy">Creamy Coconut</option>
                      <option value="Tangy">Tangy Tropical</option>
                      <option value="Citrus">Citrus Tropical</option>
                    </select>
                    
                    <select 
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Sort by Rating</option>
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
                          fitnessGoal: 'Tropical Energy',
                          bestTime: smoothie.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-orange-100 text-orange-800">{smoothie.flavor}</Badge>
                      {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-orange-600">{smoothie.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
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
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                        onClick={() => handleMakeSmoothie(smoothie)}
                      >
                        <Palmtree className="h-4 w-4 mr-2" />
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
                    <Badge className="bg-orange-500 text-white">Featured Tropical</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-orange-100 text-orange-800">{smoothie.flavor}</Badge>
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
                      className="flex-1 bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleMakeSmoothie(smoothie)}
                    >
                      <Palmtree className="h-4 w-4 mr-2" />
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
                    <Palmtree className="h-4 w-4 mr-2" />
                    Try This Trend
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress (in-content) */}
        <Card className="bg-gradient-to-r from-orange-50 to-pink-50 border-orange-200">
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
