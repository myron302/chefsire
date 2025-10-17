import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dog, Cat, Bird, Rabbit,
  Clock, Heart, Target, Shield, 
  Search, Share2, ArrowLeft, Home, Sparkles, Award,
  Crown, ChevronRight, Star, Leaf
} from 'lucide-react';

const petCategories = [
  {
    id: 'dogs',
    name: 'Dogs',
    path: '/pet-food/dogs',
    icon: Dog,
    description: 'Nutritious homemade meals for your best friend',
    tagline: 'From puppy to senior',
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-50 to-orange-50',
    recipeCount: 8,
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800',
    badges: ['High Protein', 'All Ages', 'Balanced']
  },
  {
    id: 'cats',
    name: 'Cats',
    path: '/pet-food/cats',
    icon: Cat,
    description: 'High-protein, taurine-rich meals for felines',
    tagline: 'Kitten to senior care',
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-50 to-pink-50',
    recipeCount: 8,
    image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800',
    badges: ['Taurine-Rich', 'Low Carb', 'Essential']
  },
  {
    id: 'birds',
    name: 'Birds',
    path: '/pet-food/birds',
    icon: Bird,
    description: 'Seed mixes, fruits, and treats for feathered friends',
    tagline: 'All bird species',
    gradient: 'from-cyan-500 to-blue-500',
    bgGradient: 'from-cyan-50 to-blue-50',
    recipeCount: 8,
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800',
    badges: ['Seed Blends', 'Fresh Fruits', 'Variety']
  },
  {
    id: 'small-pets',
    name: 'Small Pets',
    path: '/pet-food/small-pets',
    icon: Rabbit,
    description: 'Hay-based diets and veggie mixes for small animals',
    tagline: 'Rabbits, guinea pigs & more',
    gradient: 'from-emerald-500 to-green-500',
    bgGradient: 'from-emerald-50 to-green-50',
    recipeCount: 8,
    image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800',
    badges: ['High Fiber', 'Fresh Veggies', 'Hay-Based']
  }
];

const featuredRecipes = [
  {
    id: 1,
    name: 'Puppy Growth Formula',
    category: 'Dogs',
    categoryColor: 'amber',
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800',
    prepTime: '25 min',
    difficulty: 'Easy',
    rating: 4.9,
    calories: 425
  },
  {
    id: 2,
    name: 'Adult Salmon & Tuna Bowl',
    category: 'Cats',
    categoryColor: 'purple',
    image: 'https://images.unsplash.com/photo-1606214174585-fe31582dc6ee?w=800',
    prepTime: '25 min',
    difficulty: 'Easy',
    rating: 4.8,
    calories: 360
  },
  {
    id: 3,
    name: 'Parrot Power Mix',
    category: 'Birds',
    categoryColor: 'cyan',
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800',
    prepTime: '15 min',
    difficulty: 'Easy',
    rating: 4.9,
    calories: 180
  },
  {
    id: 4,
    name: 'Guinea Pig Vitamin C Feast',
    category: 'Small Pets',
    categoryColor: 'emerald',
    image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800',
    prepTime: '15 min',
    difficulty: 'Easy',
    rating: 4.8,
    calories: 180
  }
];

export default function PetFoodHub() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-purple-50 to-emerald-50">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-amber-600 via-purple-600 to-emerald-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Heart className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="bg-gradient-to-br from-amber-600 via-purple-600 to-emerald-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <div className="flex justify-center gap-4 mb-6">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
                <Dog className="h-8 w-8" />
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
                <Cat className="h-8 w-8" />
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
                <Bird className="h-8 w-8" />
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
                <Rabbit className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-6xl font-bold mb-4">Pet Food Recipes</h1>
            <p className="text-2xl text-white/90 mb-8">Nutritious homemade meals for your beloved companions</p>
            
            <div className="flex justify-center gap-4">
              <Button className="bg-white text-purple-600 hover:bg-white/90 gap-2">
                <Sparkles className="h-4 w-4" />
                Explore Recipes
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/20">
                Safety Guidelines
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
              <Home className="h-8 w-8 mb-2 mx-auto" />
              <div className="text-3xl font-bold">4</div>
              <div className="text-sm text-white/80">Pet Categories</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
              <Target className="h-8 w-8 mb-2 mx-auto" />
              <div className="text-3xl font-bold">32</div>
              <div className="text-sm text-white/80">Total Recipes</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
              <Shield className="h-8 w-8 mb-2 mx-auto" />
              <div className="text-3xl font-bold">100%</div>
              <div className="text-sm text-white/80">Vet-Approved</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
              <Heart className="h-8 w-8 mb-2 mx-auto" />
              <div className="text-3xl font-bold">Safe</div>
              <div className="text-sm text-white/80">Ingredients Only</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* SEARCH BAR */}
        <div className="mb-12">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6" />
            <Input
              type="text"
              placeholder="Search pet food recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg bg-white border-2 border-purple-200 focus:border-purple-400 rounded-xl"
            />
          </div>
        </div>

        {/* PET CATEGORIES */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">Choose Your Pet</h2>
            <p className="text-lg text-gray-600">Find the perfect recipes for your furry, feathered, or fuzzy friend</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {petCategories.map((category) => {
              const Icon = category.icon;
              return (
                <Link key={category.id} href={category.path}>
                  <Card className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-2 border-gray-200 hover:border-transparent overflow-hidden h-full">
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={category.image} 
                        alt={category.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-20 group-hover:opacity-30 transition-opacity`} />
                      <div className="absolute top-4 right-4">
                        <Badge className={`bg-gradient-to-r ${category.gradient} text-white`}>
                          {category.recipeCount} Recipes
                        </Badge>
                      </div>
                    </div>
                    
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-3 bg-gradient-to-br ${category.gradient} rounded-xl text-white`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900">{category.name}</h3>
                          <p className="text-sm text-gray-500">{category.tagline}</p>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">{category.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {category.badges.map((badge) => (
                          <Badge key={badge} variant="outline" className="text-xs">
                            {badge}
                          </Badge>
                        ))}
                      </div>

                      <Button className={`w-full bg-gradient-to-r ${category.gradient} hover:opacity-90 text-white`}>
                        Explore {category.name} Recipes
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* FEATURED RECIPES */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Featured Recipes</h2>
              <p className="text-lg text-gray-600">Popular picks across all pet categories</p>
            </div>
            <Button variant="outline" className="gap-2">
              <Star className="h-4 w-4" />
              View All
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredRecipes.map((recipe) => (
              <Card key={recipe.id} className="group hover:shadow-xl transition-all duration-300 border-gray-200 hover:border-purple-300 overflow-hidden">
                <div className="relative h-40 overflow-hidden">
                  <img 
                    src={recipe.image} 
                    alt={recipe.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3">
                    <Badge className={`bg-${recipe.categoryColor}-600 text-white`}>
                      {recipe.category}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{recipe.name}</h3>
                  
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {recipe.prepTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      {recipe.rating}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-gray-500">Calories:</span>
                      <span className="font-bold text-gray-900 ml-1">{recipe.calories}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{recipe.difficulty}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* WHY HOMEMADE */}
        <Card className="mb-12 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-3 text-purple-900">
              <Sparkles className="h-8 w-8" />
              Why Homemade Pet Food?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="p-3 bg-purple-600 rounded-xl text-white">
                    <Shield className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-purple-900 mb-2">Quality Control</h3>
                  <p className="text-gray-700">Know exactly what goes into your pet's bowl. No mystery ingredients or fillers.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="p-3 bg-pink-600 rounded-xl text-white">
                    <Heart className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-purple-900 mb-2">Better Health</h3>
                  <p className="text-gray-700">Fresh, whole ingredients provide superior nutrition and can help prevent health issues.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="p-3 bg-purple-600 rounded-xl text-white">
                    <Leaf className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-purple-900 mb-2">Customizable</h3>
                  <p className="text-gray-700">Tailor recipes to your pet's specific needs, allergies, and preferences.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SAFETY FIRST */}
        <Card className="mb-12 border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-3 text-red-900">
              <Shield className="h-8 w-8" />
              Safety First - Important Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 text-gray-800">
              <div>
                <h3 className="font-bold text-lg text-red-900 mb-3">Before You Start:</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Consult your veterinarian</strong> before switching to homemade food</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Transition gradually</strong> over 7-10 days to avoid digestive upset</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Add supplements</strong> as needed (calcium, vitamins, taurine for cats)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Monitor your pet's health</strong> closely during the transition</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-bold text-lg text-red-900 mb-3">Universal No-No's:</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✗</span>
                    <span><strong>Chocolate, caffeine, alcohol</strong> - toxic to all pets</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✗</span>
                    <span><strong>Grapes, raisins</strong> - can cause kidney failure</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✗</span>
                    <span><strong>Onions, garlic, chives</strong> - damage red blood cells</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✗</span>
                    <span><strong>Xylitol</strong> - artificial sweetener, extremely toxic</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded-lg">
              <p className="text-sm text-red-900 font-semibold">
                ⚠️ Each pet category page has detailed safety information specific to that animal. Always check before preparing any recipe.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* YOUR PROGRESS */}
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900 text-2xl">
              <Award className="h-6 w-6" />
              Your Pet Food Journey
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Dog className="h-10 w-10 text-white" />
                </div>
                <div className="font-bold text-2xl text-gray-900">3/8</div>
                <div className="text-sm text-gray-600">Dog Recipes</div>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Cat className="h-10 w-10 text-white" />
                </div>
                <div className="font-bold text-2xl text-gray-900">2/8</div>
                <div className="text-sm text-gray-600">Cat Recipes</div>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bird className="h-10 w-10 text-white" />
                </div>
                <div className="font-bold text-2xl text-gray-900">4/8</div>
                <div className="text-sm text-gray-600">Bird Recipes</div>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Rabbit className="h-10 w-10 text-white" />
                </div>
                <div className="font-bold text-2xl text-gray-900">5/8</div>
                <div className="text-sm text-gray-600">Small Pet Recipes</div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Crown className="h-6 w-6 text-purple-600" />
                  <span className="font-bold text-lg text-gray-900">Overall Level: 3</span>
                </div>
                <span className="text-sm text-gray-600">14/32 recipes completed</span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-3">
                <div className="bg-gradient-to-r from-amber-600 via-purple-600 to-emerald-600 h-3 rounded-full" style={{ width: '43.75%' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
