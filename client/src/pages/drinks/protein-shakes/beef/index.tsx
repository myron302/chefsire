import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Flame, Heart, Star, Search, Share2, ArrowLeft, ArrowRight,
  Plus, Camera, Zap, Leaf, Target, Sparkles, Apple, Wine, X,
  Moon, Dumbbell, Trophy, Activity, Shield
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

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

const beefProteinShakes = [
  {
    id: 'beef-1',
    name: 'Carnivore Power Blast',
    description: 'Grass-fed beef protein isolate with natural creatine',
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&h=300&fit=crop',
    proteinSource: 'Grass-Fed Beef Isolate',
    flavor: 'Natural Beef',
    nutrition: { calories: 120, protein: 28, carbs: 2, fat: 0.5, creatine: 0.5, iron: 4.5, bcaa: 6.2 },
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
    nutrition: { calories: 125, protein: 26, carbs: 3, fat: 1, creatine: 0.4, collagen: 2, glutamine: 3.8 },
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
    nutrition: { calories: 115, protein: 27, carbs: 2, fat: 0.5, creatine: 0.45, iron: 5, zinc: 3.2 },
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
    fitnessGoal: 'General Wellness',
    bestTime: 'Morning',
    absorption: 'Fast',
    bioavailability: 86
  }
];

const beefProteinBenefits = [
  { icon: Dumbbell, title: 'Natural Creatine', description: '0.4-0.5g per serving for strength gains', color: 'text-red-600' },
  { icon: Shield, title: 'High Iron Content', description: 'Supports energy and blood health', color: 'text-orange-600' },
  { icon: Zap, title: 'Fast Absorption', description: 'Quickly digested for rapid recovery', color: 'text-yellow-600' },
  { icon: Flame, title: 'Complete Amino Profile', description: 'All essential amino acids (BV 88)', color: 'text-red-600' },
  { icon: Trophy, title: 'Paleo & Keto Friendly', description: 'Perfect for low-carb diets', color: 'text-purple-600' },
  { icon: Heart, title: 'No Dairy Allergens', description: 'Lactose-free alternative to whey', color: 'text-pink-600' }
];

const fitnessGoals = [
  { id: 'muscle-building', name: 'Muscle Building', description: 'Maximize muscle growth with creatine', icon: Dumbbell, color: 'bg-red-500', recommendedIntake: '25-30g protein', timing: 'Post-workout within 30 minutes' },
  { id: 'strength', name: 'Strength Training', description: 'Power and performance focus', icon: Trophy, color: 'bg-orange-500', recommendedIntake: '28-32g protein', timing: 'Post-workout' },
  { id: 'endurance', name: 'Endurance', description: 'Sustained energy and recovery', icon: Activity, color: 'bg-blue-500', recommendedIntake: '20-25g protein', timing: 'Pre or post-workout' },
  { id: 'weight-loss', name: 'Weight Loss', description: 'Zero-carb options available', icon: Flame, color: 'bg-green-500', recommendedIntake: '25-30g protein', timing: 'Between meals' }
];

export default function BeefProteinPage() {
  const { addToFavorites, isFavorite, addToRecentlyViewed, userProgress, addPoints, incrementDrinksMade } = useDrinks();
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const getFilteredShakes = () => {
    let filtered = beefProteinShakes.filter(shake => {
      const matchesSearch = shake.name.toLowerCase().includes(searchQuery.toLowerCase()) || shake.description.toLowerCase().includes(searchQuery.toLowerCase());
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
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
              <Button size="sm" className="bg-red-600 hover:bg-red-700">
                <Camera className="h-4 w-4 mr-2" />
                Share Recipe
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <div className="text-2xl font-bold text-amber-600">3</div>
              <div className="text-sm text-gray-600">Formulas</div>
            </CardContent>
          </Card>
        </div>

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

        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'goals', label: 'By Goal', icon: Target },
            { id: 'featured', label: 'Featured', icon: Star }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <Button key={tab.id} variant={activeTab === tab.id ? "default" : "ghost"} onClick={() => setActiveTab(tab.id)} className={`flex-1 ${activeTab === tab.id ? 'bg-white shadow-sm' : ''}`}>
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
                <Input placeholder="Search beef proteins..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2">
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value)}>
                  <option value="">All Goals</option>
                  {fitnessGoals.map(goal => (<option key={goal.id} value={goal.name}>{goal.name}</option>))}
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
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
                      <Button variant="ghost" size="sm" onClick={() => addToFavorites({
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
                      })} className="text-gray-400 hover:text-red-500">
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
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{shake.rating}</span>
                        <span className="text-gray-500 text-sm">({shake.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{shake.difficulty}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleMakeShake(shake)}>
                        <Flame className="h-4 w-4 mr-2" />
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
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <Button size="lg" className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 shadow-lg" onClick={() => setActiveTab('browse')}>
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-600" />
              <span className="text-gray-600">Beef Proteins Found:</span>
              <span className="font-bold text-red-600">{filteredShakes.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">Your Level:</span>
              <span className="font-bold text-yellow-600">{userProgress.level}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to Top
          </Button>
        </div>
      </div>
    </div>
  );
}
