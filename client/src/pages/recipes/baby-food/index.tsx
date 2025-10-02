import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Baby, Heart, Star, Leaf, Apple, Droplets, Cookie, 
  Clock, Users, Award, Sparkles, Target, Calendar,
  AlertCircle, CheckCircle, Info, ArrowRight, PlayCircle,
  Utensils, Snowflake, Thermometer, Scale
} from 'lucide-react';

const ageStages = [
  {
    id: 'purees',
    name: 'First Foods (4-6 Months)',
    route: '/recipes/baby-food/purees',
    icon: Droplets,
    color: 'from-pink-400 to-rose-400',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-200',
    description: 'Single-ingredient purees for first tastes',
    texture: 'Smooth Purees',
    recipeCount: 24,
    featured: true,
    milestones: ['First foods', 'Iron-fortified', 'Single ingredients'],
    averageCalories: 45,
    examples: ['Sweet Potato', 'Avocado', 'Banana']
  },
  {
    id: 'mashed',
    name: 'Exploring Textures (6-8 Months)',
    route: '/recipes/baby-food/mashed',
    icon: Apple,
    color: 'from-orange-400 to-amber-400',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-200',
    description: 'Thicker textures and flavor combinations',
    texture: 'Mashed & Lumpy',
    recipeCount: 32,
    featured: true,
    milestones: ['Combination foods', 'Thicker textures', 'Allergen introduction'],
    averageCalories: 65,
    examples: ['Apple & Pear', 'Chicken & Veggies', 'Yogurt Blends']
  },
  {
    id: 'finger-foods',
    name: 'Self-Feeding (8-12 Months)',
    route: '/recipes/baby-food/finger-foods',
    icon: Cookie,
    color: 'from-green-400 to-emerald-400',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    borderColor: 'border-green-200',
    description: 'Soft finger foods for independent eating',
    texture: 'Soft Chunks',
    recipeCount: 28,
    featured: true,
    milestones: ['Pincer grasp', 'Self-feeding', 'Family foods'],
    averageCalories: 85,
    examples: ['Veggie Tots', 'Mini Muffins', 'Soft Pasta']
  },
  {
    id: 'toddler',
    name: 'Toddler Meals (12+ Months)',
    route: '/recipes/baby-food/toddler',
    icon: Utensils,
    color: 'from-blue-400 to-cyan-400',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    description: 'Transitioning to family meals',
    texture: 'Regular Foods',
    recipeCount: 36,
    featured: true,
    milestones: ['Family meals', 'More variety', 'Self-feeding mastery'],
    averageCalories: 120,
    examples: ['Mini Pizzas', 'Pasta Bakes', 'Sandwich Quarters']
  }
];

const featuredRecipes = [
  {
    id: 'bf-1',
    name: 'Organic Sweet Potato Puree',
    stage: 'First Foods (4-6 Months)',
    description: 'Creamy, nutrient-dense first food rich in vitamin A',
    image: 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=400&h=300&fit=crop',
    prepTime: 25,
    servings: 8,
    organic: true,
    allergens: [],
    nutrition: {
      calories: 42,
      protein: 1,
      carbs: 10,
      fat: 0,
      fiber: 2,
      iron: 0.4,
      vitaminA: 'Very High'
    },
    difficulty: 'Easy',
    freezable: true,
    rating: 4.9,
    reviews: 1234
  },
  {
    id: 'bf-2',
    name: 'Banana & Avocado Mash',
    stage: 'Exploring Textures (6-8 Months)',
    description: 'Creamy combination with healthy fats for brain development',
    image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop',
    prepTime: 5,
    servings: 2,
    organic: true,
    allergens: [],
    nutrition: {
      calories: 68,
      protein: 1,
      carbs: 12,
      fat: 3,
      fiber: 3,
      potassium: 'High',
      omega3: 'Present'
    },
    difficulty: 'Easy',
    freezable: false,
    rating: 4.8,
    reviews: 892
  },
  {
    id: 'bf-3',
    name: 'Veggie & Quinoa Bites',
    stage: 'Self-Feeding (8-12 Months)',
    description: 'Perfect finger food with complete protein',
    image: 'https://images.unsplash.com/photo-1551218372-3f4d5c4c3c7c?w=400&h=300&fit=crop',
    prepTime: 30,
    servings: 12,
    organic: false,
    allergens: [],
    nutrition: {
      calories: 45,
      protein: 2,
      carbs: 7,
      fat: 1,
      fiber: 2,
      iron: 0.8,
      complete_protein: true
    },
    difficulty: 'Medium',
    freezable: true,
    rating: 4.7,
    reviews: 567
  }
];

const allergenInfo = [
  {
    name: 'Peanuts',
    icon: '🥜',
    introduction: '4-6 months',
    tips: 'Thin peanut butter with breast milk or water',
    color: 'bg-amber-100 text-amber-800'
  },
  {
    name: 'Eggs',
    icon: '🥚',
    introduction: '4-6 months',
    tips: 'Start with well-cooked egg yolk or whole egg',
    color: 'bg-yellow-100 text-yellow-800'
  },
  {
    name: 'Dairy',
    icon: '🥛',
    introduction: '6 months',
    tips: 'Yogurt and cheese before cow\'s milk',
    color: 'bg-blue-100 text-blue-800'
  },
  {
    name: 'Fish',
    icon: '🐟',
    introduction: '4-6 months',
    tips: 'Start with mild white fish, check for bones',
    color: 'bg-cyan-100 text-cyan-800'
  },
  {
    name: 'Wheat',
    icon: '🌾',
    introduction: '6 months',
    tips: 'Baby cereal or toast strips',
    color: 'bg-orange-100 text-orange-800'
  },
  {
    name: 'Tree Nuts',
    icon: '🌰',
    introduction: '4-6 months',
    tips: 'Nut butters thinned, never whole nuts',
    color: 'bg-brown-100 text-brown-800'
  }
];

const safetyTips = [
  {
    icon: Thermometer,
    title: 'Temperature Safety',
    tip: 'Always test temperature before serving - food should be lukewarm'
  },
  {
    icon: AlertCircle,
    title: 'Choking Hazards',
    tip: 'Avoid honey (under 1 year), whole grapes, nuts, popcorn, and hard raw vegetables'
  },
  {
    icon: Snowflake,
    title: 'Storage Guidelines',
    tip: 'Refrigerate within 2 hours, use within 2-3 days, or freeze up to 3 months'
  },
  {
    icon: Scale,
    title: 'Portion Sizes',
    tip: 'Start with 1-2 tablespoons per feeding, let baby guide amounts'
  }
];

export default function BabyFoodHub() {
  const [selectedStage, setSelectedStage] = useState(ageStages[0]);
  const [showOrganic, setShowOrganic] = useState(false);
  const [babyAge, setBabyAge] = useState(4);

  const filteredStages = ageStages.filter(stage => {
    if (babyAge < 6) return stage.id === 'purees';
    if (babyAge < 8) return ['purees', 'mashed'].includes(stage.id);
    if (babyAge < 12) return ['purees', 'mashed', 'finger-foods'].includes(stage.id);
    return true;
  });

  const filteredRecipes = showOrganic 
    ? featuredRecipes.filter(r => r.organic)
    : featuredRecipes;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 border-b border-purple-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Baby className="h-12 w-12 text-purple-600" />
              <h1 className="text-4xl font-bold text-gray-900">Baby Food Recipes</h1>
            </div>
            <p className="text-lg text-gray-700 mb-6">
              Age-appropriate, nutritious recipes for your little one's journey
            </p>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Baby's Age (months):</label>
                <input 
                  type="number" 
                  min="4" 
                  max="24"
                  value={babyAge}
                  onChange={(e) => setBabyAge(Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="organic-toggle"
                  checked={showOrganic}
                  onChange={(e) => setShowOrganic(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="organic-toggle" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Leaf className="h-4 w-4 text-green-600" />
                  Show Organic Only
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-pink-600">{ageStages.reduce((sum, stage) => sum + stage.recipeCount, 0)}</div>
                <div className="text-sm text-gray-600">Total Recipes</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-green-600">100%</div>
                <div className="text-sm text-gray-600">Safe & Tested</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-purple-600">4</div>
                <div className="text-sm text-gray-600">Age Stages</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">60%</div>
                <div className="text-sm text-gray-600">Organic Options</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Age Stages Navigation */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-purple-600" />
            Choose Your Baby's Stage
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredStages.map(stage => {
              const Icon = stage.icon;
              const isAvailable = filteredStages.includes(stage);
              
              return (
                <Link key={stage.id} href={stage.route}>
                  <Card className={`cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${
                    !isAvailable ? 'opacity-50 cursor-not-allowed' : ''
                  }`}>
                    <div className={`h-2 bg-gradient-to-r ${stage.color}`} />
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-full ${stage.bgColor}`}>
                          <Icon className={`h-8 w-8 ${stage.textColor}`} />
                        </div>
                        {stage.featured && (
                          <Badge className="bg-purple-500">
                            <Star className="h-3 w-3 mr-1" />
                            Popular
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className="text-lg font-bold mb-2">{stage.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">{stage.description}</p>
                      
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 mb-1">Texture Level</div>
                        <Badge variant="outline" className="text-xs">{stage.texture}</Badge>
                      </div>
                      
                      <div className="mb-4">
                        <div className="text-xs font-medium text-gray-700 mb-2">Key Milestones:</div>
                        <div className="space-y-1">
                          {stage.milestones.map((milestone, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs text-gray-600">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              {milestone}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="font-bold text-lg">{stage.recipeCount}</div>
                          <div className="text-xs text-gray-600">Recipes</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="font-bold text-lg">{stage.averageCalories}</div>
                          <div className="text-xs text-gray-600">Avg Cal</div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-xs font-medium text-gray-700 mb-1">Examples:</div>
                        <div className="flex flex-wrap gap-1">
                          {stage.examples.map((example, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {example}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <Button className={`w-full bg-gradient-to-r ${stage.color}`}>
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
                <div className="relative h-48 bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                  <Baby className="h-20 w-20 text-purple-400 opacity-30" />
                  {recipe.organic && (
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-green-500 text-white">
                        <Leaf className="h-3 w-3 mr-1" />
                        Organic
                      </Badge>
                    </div>
                  )}
                  {recipe.freezable && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-blue-500 text-white">
                        <Snowflake className="h-3 w-3 mr-1" />
                        Freezable
                      </Badge>
                    </div>
                  )}
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2">{recipe.name}</h3>
                  <Badge variant="outline" className="mb-2 text-xs">{recipe.stage}</Badge>
                  <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                  
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                    <div>
                      <div className="font-bold text-purple-600">{recipe.nutrition.calories}</div>
                      <div className="text-gray-500">Cal</div>
                    </div>
                    <div>
                      <div className="font-bold text-green-600">{recipe.prepTime}m</div>
                      <div className="text-gray-500">Prep</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">{recipe.servings}</div>
                      <div className="text-gray-500">Servings</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium text-sm">{recipe.rating}</span>
                      <span className="text-gray-500 text-xs">({recipe.reviews})</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{recipe.difficulty}</Badge>
                  </div>

                  <Button className="w-full bg-purple-600 hover:bg-purple-700">
                    <PlayCircle className="h-4 w-4 mr-2" />
                    View Recipe
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Allergen Introduction Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-orange-500" />
                Allergen Introduction Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Current guidelines recommend introducing common allergens early (around 4-6 months) to reduce allergy risk.
              </p>
              
              <div className="space-y-3">
                {allergenInfo.map((allergen, idx) => (
                  <div key={idx} className={`p-3 rounded-lg ${allergen.color}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{allergen.icon}</span>
                      <div className="flex-1">
                        <div className="font-semibold">{allergen.name}</div>
                        <div className="text-xs mb-1">Introduce: {allergen.introduction}</div>
                        <div className="text-xs">{allergen.tips}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-blue-800">
                    Always consult your pediatrician before introducing allergens, especially if there's a family history of allergies.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Safety Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-6 w-6 text-red-500" />
                Safety First
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {safetyTips.map((tip, idx) => {
                  const Icon = tip.icon;
                  return (
                    <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <Icon className="h-6 w-6 text-purple-600 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm mb-1">{tip.title}</div>
                        <div className="text-xs text-gray-600">{tip.tip}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Never Leave Baby Unattended
                </div>
                <p className="text-xs text-red-700">
                  Always supervise your baby during meals. Stay within arm's reach and know infant CPR.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Tips */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-600" />
              Parent Tips & Tricks
            </h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-purple-600">Batch Cooking</h4>
                <p className="text-sm text-gray-700">
                  Make large batches and freeze in ice cube trays for quick, portion-controlled meals. Label with date and contents.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-pink-600">Introduce New Foods</h4>
                <p className="text-sm text-gray-700">
                  Wait 3-5 days between new foods to watch for allergic reactions. Keep a food diary during this time.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-blue-600">Don't Force It</h4>
                <p className="text-sm text-gray-700">
                  It can take 10-15 tries before baby accepts a new food. Stay patient and keep offering without pressure.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
