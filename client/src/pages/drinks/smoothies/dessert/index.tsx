import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  IceCream, Clock, Star, Heart, Flame, Sparkles, Cookie,
  Search, Share2, ArrowLeft, Cake, Candy, ChefHat, Plus,
  Zap, Trophy
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';

const dessertSmoothies = [
  {
    id: 'dessert-1',
    name: 'Chocolate Brownie Bliss',
    description: 'Rich chocolate indulgence without the guilt',
    image: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=400&h=300&fit=crop',
    dessertType: 'Chocolate',
    flavorProfile: 'Rich & Decadent',
    guiltFactor: 'None',
    category: 'Chocolate Lovers',
    nutrition: { calories: 280, protein: 15, carbs: 38, fat: 8, fiber: 10, added_sugar: 0 },
    ingredients: ['Cocoa Powder', 'Banana', 'Greek Yogurt', 'Almond Butter', 'Dates', 'Vanilla'],
    healthySwaps: ['Dates for sugar', 'Cocoa for chocolate', 'Greek yogurt for cream'],
    benefits: ['Antioxidants', 'Protein Rich', 'Natural Sweetness'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.9,
    reviews: 2345,
    trending: true,
    estimatedCost: 3.50,
    bestTime: 'Dessert'
  },
  {
    id: 'dessert-2',
    name: 'Strawberry Cheesecake Dream',
    description: 'Creamy cheesecake flavor with fresh berries',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
    dessertType: 'Cheesecake',
    flavorProfile: 'Creamy & Tangy',
    guiltFactor: 'Low',
    category: 'Fruity Delights',
    nutrition: { calories: 320, protein: 18, carbs: 42, fat: 10, fiber: 8, added_sugar: 0 },
    ingredients: ['Strawberries', 'Cream Cheese', 'Greek Yogurt', 'Graham Crackers', 'Honey', 'Vanilla'],
    healthySwaps: ['Honey for sugar', 'Greek yogurt for heavy cream', 'Fresh berries'],
    benefits: ['Vitamin C', 'Probiotics', 'Calcium'],
    difficulty: 'Easy',
    prepTime: 4,
    rating: 4.8,
    reviews: 1987,
    trending: true,
    estimatedCost: 4.25,
    bestTime: 'Dessert'
  },
  {
    id: 'dessert-3',
    name: 'Peanut Butter Cup',
    description: 'Classic candy bar flavors in smoothie form',
    image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop',
    dessertType: 'Chocolate',
    flavorProfile: 'Nutty & Sweet',
    guiltFactor: 'None',
    category: 'Chocolate Lovers',
    nutrition: { calories: 340, protein: 20, carbs: 35, fat: 14, fiber: 6, added_sugar: 0 },
    ingredients: ['Peanut Butter', 'Cocoa Powder', 'Banana', 'Protein Powder', 'Dates', 'Almond Milk'],
    healthySwaps: ['Natural PB', 'Dates for sweetness', 'Cocoa powder'],
    benefits: ['High Protein', 'Healthy Fats', 'Energy'],
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    reviews: 1654,
    trending: false,
    estimatedCost: 3.75,
    bestTime: 'Snack'
  }
];

const dessertTypes = [
  {
    id: 'chocolate',
    name: 'Chocolate Dreams',
    description: 'Rich cocoa-based treats',
    icon: Cookie,
    color: 'text-amber-600',
    keyBenefit: 'Antioxidants',
    healthyIngredients: ['Cocoa Powder', 'Dark Chocolate', 'Cacao Nibs'],
    popularFlavors: ['Brownie', 'Mocha', 'Mint Chip'],
    avgCalories: 300,
    guiltLevel: 'None'
  },
  {
    id: 'fruity',
    name: 'Fruity Delights',
    description: 'Fresh fruit-forward desserts',
    icon: Sparkles,
    color: 'text-pink-600',
    keyBenefit: 'Vitamins',
    healthyIngredients: ['Berries', 'Mango', 'Peaches'],
    popularFlavors: ['Berry Cheesecake', 'Peach Cobbler', 'Tropical'],
    avgCalories: 280,
    guiltLevel: 'None'
  },
  {
    id: 'creamy',
    name: 'Creamy Classics',
    description: 'Smooth and indulgent',
    icon: IceCream,
    color: 'text-purple-600',
    keyBenefit: 'Satisfaction',
    healthyIngredients: ['Greek Yogurt', 'Avocado', 'Cashews'],
    popularFlavors: ['Vanilla Bean', 'Cookies & Cream', 'Caramel'],
    avgCalories: 320,
    guiltLevel: 'Low'
  },
  {
    id: 'bakery',
    name: 'Bakery Inspired',
    description: 'Like fresh-baked treats',
    icon: Cake,
    color: 'text-orange-600',
    keyBenefit: 'Comfort',
    healthyIngredients: ['Oats', 'Cinnamon', 'Vanilla'],
    popularFlavors: ['Cinnamon Roll', 'Banana Bread', 'Pumpkin Pie'],
    avgCalories: 310,
    guiltLevel: 'Low'
  }
];

const dessertCategories = [
  {
    id: 'guilt-free',
    name: 'Guilt-Free Treats',
    description: 'Zero added sugar, all natural',
    icon: Heart,
    color: 'bg-green-500',
    calorieRange: '200-300',
    sweetenerType: 'Dates, Banana, Honey'
  },
  {
    id: 'protein-rich',
    name: 'Protein Desserts',
    description: '15g+ protein per serving',
    icon: Trophy,
    color: 'bg-blue-500',
    calorieRange: '280-350',
    sweetenerType: 'Natural + Protein'
  },
  {
    id: 'comfort',
    name: 'Comfort Classics',
    description: 'Nostalgic favorites made healthy',
    icon: Cookie,
    color: 'bg-amber-500',
    calorieRange: '300-400',
    sweetenerType: 'Honey, Maple'
  },
  {
    id: 'celebration',
    name: 'Celebration Treats',
    description: 'Special occasion indulgences',
    icon: Sparkles,
    color: 'bg-pink-500',
    calorieRange: '350-450',
    sweetenerType: 'Mixed Natural'
  }
];

export default function DessertSmoothiesPage() {
  const { 
    addToFavorites, 
    isFavorite,
    addToRecentlyViewed,
    userProgress,
    incrementDrinksMade,
    addPoints
  } = useDrinks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDessertType, setSelectedDessertType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [maxCalories, setMaxCalories] = useState([450]);
  const [onlyNaturalSweetener, setOnlyNaturalSweetener] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [activeTab, setActiveTab] = useState('browse');

  const getFilteredSmoothies = () => {
    let filtered = dessertSmoothies.filter(smoothie => {
      const matchesSearch = smoothie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           smoothie.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedDessertType || smoothie.dessertType === selectedDessertType;
      const matchesCategory = !selectedCategory || smoothie.category.includes(selectedCategory);
      const matchesCalories = smoothie.nutrition.calories <= maxCalories[0];
      const matchesSweetener = !onlyNaturalSweetener || smoothie.nutrition.added_sugar === 0;
      
      return matchesSearch && matchesType && matchesCategory && matchesCalories && matchesSweetener;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'protein': return (b.nutrition.protein || 0) - (a.nutrition.protein || 0);
        case 'cost': return (a.estimatedCost || 0) - (b.estimatedCost || 0);
        case 'calories': return (a.nutrition.calories || 0) - (b.nutrition.calories || 0);
        default: return 0;
      }
    });

    return filtered;
  };

  const filteredSmoothies = getFilteredSmoothies();
  const featuredSmoothies = dessertSmoothies.filter(s => s.trending);

  const handleMakeSmoothie = (smoothie: any) => {
    addToRecentlyViewed({
      id: smoothie.id,
      name: smoothie.name,
      category: 'smoothies',
      description: smoothie.description,
      ingredients: smoothie.ingredients,
      nutrition: smoothie.nutrition,
      difficulty: smoothie.difficulty,
      prepTime: smoothie.prepTime,
      rating: smoothie.rating,
      fitnessGoal: 'Dessert',
      bestTime: smoothie.bestTime
    });
    incrementDrinksMade();
    addPoints(25);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <IceCream className="h-6 w-6 text-pink-600" />
                <h1 className="text-2xl font-bold text-gray-900">Dessert Smoothies</h1>
                <Badge className="bg-pink-100 text-pink-800">Guilt-Free</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Level {userProgress.level}</span>
                <div className="w-px h-4 bg-gray-300" />
                <span>{userProgress.totalPoints} XP</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'browse', label: 'Browse All', icon: Search },
            { id: 'dessert-types', label: 'Dessert Types', icon: Cookie },
            { id: 'categories', label: 'Categories', icon: Sparkles },
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
                  placeholder="Search dessert smoothies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedDessertType}
                  onChange={(e) => setSelectedDessertType(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="Chocolate">Chocolate</option>
                  <option value="Cheesecake">Cheesecake</option>
                  <option value="Ice Cream">Ice Cream</option>
                </select>
                
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white min-w-[120px]">
                  <span>Max:</span>
                  <Slider
                    value={maxCalories}
                    onValueChange={setMaxCalories}
                    max={450}
                    min={200}
                    step={25}
                    className="flex-1"
                  />
                  <span className="text-xs">{maxCalories[0]}</span>
                </div>
                
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                  <input
                    type="checkbox"
                    checked={onlyNaturalSweetener}
                    onChange={(e) => setOnlyNaturalSweetener(e.target.checked)}
                  />
                  Natural
                </label>
              </div>
            </div>

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
                          fitnessGoal: 'Dessert',
                          bestTime: smoothie.bestTime
                        })}
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-pink-100 text-pink-800">{smoothie.dessertType}</Badge>
                      {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-pink-600">{smoothie.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
                        <div className="text-gray-500">Fiber</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-purple-600">{smoothie.prepTime}m</div>
                        <div className="text-gray-500">Time</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{smoothie.rating}</span>
                        <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-pink-600 hover:bg-pink-700"
                        onClick={() => handleMakeSmoothie(smoothie)}
                      >
                        <ChefHat className="h-4 w-4 mr-2" />
                        Make It
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

        {activeTab === 'dessert-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dessertTypes.map(type => {
              const Icon = type.icon;
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
                    <Button className="w-full" onClick={() => setActiveTab('browse')}>
                      Explore {type.name}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dessertCategories.map(category => {
              const Icon = category.icon;
              return (
                <Card key={category.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 ${category.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${category.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <p className="text-sm text-gray-600">{category.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={() => setActiveTab('browse')}>
                      View {category.name}
                    </Button>
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
                <div className="relative h-48">
                  <img 
                    src={smoothie.image} 
                    alt={smoothie.name}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-4 left-4 bg-pink-500 text-white">Featured</Badge>
                </div>
                
                <CardHeader>
                  <CardTitle>{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                </CardHeader>
                
                <CardContent>
                  <Button 
                    className="w-full bg-pink-600 hover:bg-pink-700"
                    onClick={() => handleMakeSmoothie(smoothie)}
                  >
                    <ChefHat className="h-4 w-4 mr-2" />
                    Make This Dessert
                  </Button>
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
          className="rounded-full w-14 h-14 bg-pink-600 hover:bg-pink-700 shadow-lg"
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
              <ChefHat className="h-4 w-4 text-pink-600" />
              <span className="text-gray-600">Found:</span>
              <span className="font-bold text-pink-600">{filteredSmoothies.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">Level:</span>
              <span className="font-bold text-yellow-600">{userProgress.level}</span>
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
