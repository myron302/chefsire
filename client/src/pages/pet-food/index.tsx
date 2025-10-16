import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Dog, Cat, Bird, Rabbit, Heart, Star, Leaf, Apple, 
  Clock, Users, Award, Sparkles, Target, Calendar,
  AlertCircle, CheckCircle, Info, ArrowRight, PlayCircle,
  Utensils, Snowflake, Thermometer, Scale, Fish, Flame,
  Eye, Plus, BookOpen, Share2, ShieldAlert, Bone
} from 'lucide-react';

const petCategories = [
  {
    id: 'dogs',
    name: 'Dog Recipes',
    route: '/pet-food/dogs',
    icon: Dog,
    color: 'from-amber-400 to-orange-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200',
    description: 'Nutritious homemade meals for your canine companion',
    recipeCount: 156,
    featured: true,
    ageGroups: ['Puppy', 'Adult', 'Senior'],
    popularRecipes: ['Chicken & Rice', 'Beef Stew', 'Turkey Meatballs'],
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop'
  },
  {
    id: 'cats',
    name: 'Cat Recipes',
    route: '/pet-food/cats',
    icon: Cat,
    color: 'from-purple-400 to-pink-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-200',
    description: 'Healthy homemade food for your feline friend',
    recipeCount: 98,
    featured: true,
    ageGroups: ['Kitten', 'Adult', 'Senior'],
    popularRecipes: ['Salmon Pate', 'Chicken Liver', 'Tuna Medley'],
    image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop'
  },
  {
    id: 'birds',
    name: 'Bird Recipes',
    route: '/pet-food/birds',
    icon: Bird,
    color: 'from-blue-400 to-cyan-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    description: 'Nutritious mixes for parrots, canaries, and more',
    recipeCount: 45,
    featured: false,
    ageGroups: ['Chick', 'Adult'],
    popularRecipes: ['Seed Mix', 'Fruit Blend', 'Veggie Medley'],
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400&h=300&fit=crop'
  },
  {
    id: 'small-pets',
    name: 'Small Pets',
    route: '/pet-food/small-pets',
    icon: Rabbit,
    color: 'from-green-400 to-emerald-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    borderColor: 'border-green-200',
    description: 'Recipes for rabbits, guinea pigs, hamsters, and more',
    recipeCount: 62,
    featured: false,
    ageGroups: ['Young', 'Adult'],
    popularRecipes: ['Veggie Mix', 'Hay Blend', 'Pellet Plus'],
    image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&h=300&fit=crop'
  }
];

const featuredRecipes = [
  {
    id: 'pf-1',
    name: 'Chicken & Sweet Potato Delight',
    petType: 'Dogs',
    description: 'Protein-rich meal perfect for active dogs',
    image: 'https://images.unsplash.com/photo-1567529692333-de9fd6772897?w=400&h=300&fit=crop',
    prepTime: 35,
    servings: 8,
    organic: true,
    difficulty: 'Easy',
    rating: 4.9,
    reviews: 892,
    ingredients: ['Chicken Breast', 'Sweet Potato', 'Carrots', 'Green Beans', 'Brown Rice'],
    nutrition: {
      calories: 285,
      protein: 24,
      fat: 8,
      carbs: 32,
      fiber: 4
    },
    suitableFor: ['Puppy', 'Adult', 'Senior'],
    specialDiet: ['Grain-Free Option']
  },
  {
    id: 'pf-2',
    name: 'Salmon & Tuna Pate',
    petType: 'Cats',
    description: 'Omega-3 rich recipe for healthy coat and skin',
    image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop',
    prepTime: 20,
    servings: 6,
    organic: false,
    difficulty: 'Easy',
    rating: 4.8,
    reviews: 654,
    ingredients: ['Wild Salmon', 'Tuna', 'Chicken Liver', 'Fish Oil', 'Taurine Supplement'],
    nutrition: {
      calories: 180,
      protein: 18,
      fat: 12,
      carbs: 2,
      taurine: 'High'
    },
    suitableFor: ['Kitten', 'Adult', 'Senior'],
    specialDiet: ['High Protein', 'Low Carb']
  },
  {
    id: 'pf-3',
    name: 'Beef & Vegetable Stew',
    petType: 'Dogs',
    description: 'Hearty meal packed with vitamins and minerals',
    image: 'https://images.unsplash.com/photo-1606193309091-8f0b45328815?w=400&h=300&fit=crop',
    prepTime: 45,
    servings: 10,
    organic: true,
    difficulty: 'Medium',
    rating: 4.7,
    reviews: 523,
    ingredients: ['Ground Beef', 'Pumpkin', 'Spinach', 'Blueberries', 'Quinoa'],
    nutrition: {
      calories: 310,
      protein: 22,
      fat: 14,
      carbs: 28,
      fiber: 5
    },
    suitableFor: ['Adult', 'Senior'],
    specialDiet: ['High Fiber', 'Weight Management']
  }
];

const safetyWarnings = [
  {
    icon: ShieldAlert,
    title: 'Toxic Foods to Avoid',
    items: [
      'Chocolate, coffee, and caffeine',
      'Grapes and raisins',
      'Onions, garlic, and chives',
      'Xylitol (artificial sweetener)',
      'Avocado (for dogs)',
      'Alcohol and raw yeast dough'
    ],
    color: 'bg-red-50 border-red-200 text-red-800'
  },
  {
    icon: AlertCircle,
    title: 'Safe Preparation',
    items: [
      'Cook meat thoroughly to kill bacteria',
      'Remove bones that can splinter',
      'Wash all fruits and vegetables',
      'Cool food to room temperature before serving',
      'Use clean utensils and bowls',
      'Store properly to prevent spoilage'
    ],
    color: 'bg-yellow-50 border-yellow-200 text-yellow-800'
  },
  {
    icon: Heart,
    title: 'Nutritional Balance',
    items: [
      'Consult your vet before switching diets',
      'Ensure proper protein levels',
      'Include essential vitamins and minerals',
      'Monitor portion sizes based on weight',
      'Provide fresh water at all times',
      'Gradual diet transitions over 7-10 days'
    ],
    color: 'bg-green-50 border-green-200 text-green-800'
  }
];

const nutritionGuidelines = [
  {
    icon: Scale,
    title: 'Portion Control',
    description: 'Feed based on your pet\'s weight, age, and activity level. Typical adult dog: 2-3% of body weight daily.'
  },
  {
    icon: Thermometer,
    title: 'Food Temperature',
    description: 'Serve food at room temperature. Never feed frozen or very hot food to prevent digestive issues.'
  },
  {
    icon: Snowflake,
    title: 'Storage Guidelines',
    description: 'Refrigerate for up to 3 days or freeze for up to 3 months. Label containers with date and contents.'
  },
  {
    icon: Target,
    title: 'Balanced Diet',
    description: 'Include proteins (40-50%), vegetables (30-40%), and grains (10-20%). Add supplements as recommended by vet.'
  }
];

const userStats = {
  recipesAvailable: 361,
  vetApproved: 248,
  communityFavorites: 89,
  avgRating: 4.8
};

export default function PetFoodHub() {
  const [selectedPetType, setSelectedPetType] = useState('all');
  const [showOrganic, setShowOrganic] = useState(false);

  const filteredRecipes = featuredRecipes.filter(recipe => {
    const matchesPetType = selectedPetType === 'all' || recipe.petType.toLowerCase().includes(selectedPetType);
    const matchesOrganic = !showOrganic || recipe.organic;
    return matchesPetType && matchesOrganic;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white py-12 px-6 shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
                <Bone className="h-12 w-12" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">Pet Food Recipes</h1>
            </div>
            <p className="text-xl text-orange-100 mb-6">
              Healthy, homemade meals for your beloved pets
            </p>
            
            <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Pet Type:</label>
                <select 
                  value={selectedPetType}
                  onChange={(e) => setSelectedPetType(e.target.value)}
                  className="px-4 py-2 border border-white/30 rounded-md bg-white/10 backdrop-blur text-white"
                >
                  <option value="all">All Pets</option>
                  <option value="dogs">Dogs</option>
                  <option value="cats">Cats</option>
                  <option value="birds">Birds</option>
                  <option value="small">Small Pets</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="organic-toggle"
                  checked={showOrganic}
                  onChange={(e) => setShowOrganic(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="organic-toggle" className="text-sm font-medium flex items-center gap-1">
                  <Leaf className="h-4 w-4" />
                  Organic Only
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <Card className="bg-white/10 backdrop-blur border-white/20">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{userStats.recipesAvailable}</div>
                  <div className="text-sm text-orange-100">Total Recipes</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur border-white/20">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{userStats.vetApproved}</div>
                  <div className="text-sm text-orange-100">Vet Approved</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur border-white/20">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{userStats.communityFavorites}</div>
                  <div className="text-sm text-orange-100">Community Favs</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur border-white/20">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{userStats.avgRating}</div>
                  <div className="text-sm text-orange-100">Avg Rating</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Pet Categories Navigation */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-orange-600" />
            Choose Your Pet Type
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {petCategories.map(category => {
              const Icon = category.icon;
              
              return (
                <Link key={category.id} href={category.route}>
                  <Card className={`cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 border-2 ${category.borderColor}`}> 
                    <div className={`h-2 bg-gradient-to-r ${category.color}`} />
                    <div className="relative h-40 overflow-hidden">
                      <img 
                        src={category.image} 
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className={`absolute bottom-3 right-3 p-3 rounded-full ${category.bgColor}`}> 
                        <Icon className={`h-8 w-8 ${category.textColor}`} />
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-lg font-bold">{category.name}</h3>
                        {category.featured && (
                          <Badge className="bg-orange-500">
                            <Star className="h-3 w-3 mr-1" />
                            Popular
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                      
                      <div className="mb-4">
                        <div className="text-xs font-medium text-gray-700 mb-2">Age Groups:</div>
                        <div className="flex flex-wrap gap-1">
                          {category.ageGroups.map((age, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {age}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="font-bold text-lg">{category.recipeCount}</div>
                          <div className="text-xs text-gray-600">Recipes</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="flex items-center justify-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="font-bold text-lg">4.8</span>
                          </div>
                          <div className="text-xs text-gray-600">Rating</div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-xs font-medium text-gray-700 mb-1">Popular:</div>
                        <div className="text-xs text-gray-600">
                          {category.popularRecipes.slice(0, 2).join(', ')}...
                        </div>
                      </div>
                      
                      <Button className={`w-full bg-gradient-to-r ${category.color} text-white`}> 
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Explore Recipes
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Featured Recipes */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-500" />
            Featured Recipes
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredRecipes.map(recipe => (
              <Card key={recipe.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48 bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                  <img 
                    src={recipe.image} 
                    alt={recipe.name}
                    className="w-full h-full object-cover"
                  />
                  {recipe.organic && (
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-green-500 text-white">
                        <Leaf className="h-3 w-3 mr-1" />
                        Organic
                      </Badge>
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-white text-gray-900">
                      {recipe.petType}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2">{recipe.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                  
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                    <div>
                      <div className="font-bold text-orange-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">{recipe.prepTime}m</div>
                      <div className="text-gray-500">Prep</div>
                    </div>
                    <div>
                      <div className="font-bold text-green-600">{recipe.servings}</div>
                      <div className="text-gray-500">Servings</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium text-sm">{recipe.rating}</span>
                      <span className="text-gray-500 text-sm">({recipe.reviews})</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{recipe.difficulty}</Badge>
                  </div>

                  <div className="mb-4">
                    <div className="text-xs font-medium text-gray-700 mb-1">Suitable for:</div>
                    <div className="flex flex-wrap gap-1">
                      {recipe.suitableFor.map((age, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {age}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full bg-orange-600 hover:bg-orange-700">
                    <PlayCircle className="h-4 w-4 mr-2" />
                    View Recipe
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Safety Warnings */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-500" />
            Important Safety Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {safetyWarnings.map((warning, idx) => {
              const Icon = warning.icon;
              return (
                <Card key={idx} className={`border-2 ${warning.color}`}> 
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Icon className="h-8 w-8" />
                      <h3 className="font-bold text-lg">{warning.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {warning.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Nutrition Guidelines */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Target className="h-6 w-6 text-green-600" />
            Nutrition Guidelines
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {nutritionGuidelines.map((guideline, idx) => {
              const Icon = guideline.icon;
              return (
                <Card key={idx} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <Icon className="h-10 w-10 text-orange-600 mb-3" />
                    <h3 className="font-bold mb-2">{guideline.title}</h3>
                    <p className="text-sm text-gray-600">{guideline.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <Card className="bg-gradient-to-r from-orange-600 to-red-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Cook for Your Pet?</h2>
            <p className="text-xl opacity-90 mb-6">
              Join thousands of pet parents making healthy, homemade meals
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
                <Sparkles className="h-5 w-5 mr-2" />
                Browse All Recipes
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <BookOpen className="h-5 w-5 mr-2" />
                Read Guide
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}