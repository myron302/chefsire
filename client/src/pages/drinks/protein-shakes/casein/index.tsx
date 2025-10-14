import { useState } from "react"
import { Link } from "wouter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import {
  Moon,
  Heart,
  Star,
  Target,
  Flame,
  Bed,
  Zap,
  Search,
  Camera,
  Share2,
  ArrowLeft,
  Sparkles,
  Dumbbell,
  Leaf,
  Apple,
  Wine,
  ArrowRight,
  X,
  Check,
  Copy,
  BarChart3,
} from "lucide-react"
import { useDrinks } from "@/contexts/DrinksContext"
import UniversalSearch from "@/components/UniversalSearch"
import RecipeKit, { Measured } from '@/components/recipes/RecipeKit';
import type { RecipeKitHandle } from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// Navigation data
const otherDrinkHubs = [
  { id: "smoothies", name: "Smoothies", icon: Apple, route: "/drinks/smoothies", description: "Fruit & veggie blends" },
  { id: "detoxes", name: "Detox Drinks", icon: Leaf, route: "/drinks/detoxes", description: "Cleansing & wellness" },
  {
    id: "potables",
    name: "Potent Potables",
    icon: Wine,
    route: "/drinks/potent-potables",
    description: "Cocktails (21+)",
  },
  { id: "all-drinks", name: "All Drinks", icon: Sparkles, route: "/drinks", description: "Browse everything" },
]

const proteinSubcategories = [
  { id: "whey", name: "Whey Protein", icon: Zap, path: "/drinks/protein-shakes/whey", description: "Fast absorption" },
  {
    id: "plant",
    name: "Plant-Based",
    icon: Leaf,
    path: "/drinks/protein-shakes/plant-based",
    description: "Vegan friendly",
  },
  {
    id: "collagen",
    name: "Collagen",
    icon: Sparkles,
    path: "/drinks/protein-shakes/collagen",
    description: "Beauty support",
  },
  { id: "egg", name: "Egg Protein", icon: Target, path: "/drinks/protein-shakes/egg", description: "Complete amino" },
  {
    id: "beef",
    name: "Beef Protein",
    icon: Flame,
    path: "/drinks/protein-shakes/beef",
    description: "Natural creatine",
  },
]

// Casein protein shake data
const caseinShakes = [
  {
    id: "casein-1",
    name: "Midnight Muscle Recovery",
    description: "Slow-digesting micellar casein for 8-hour muscle feeding",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
    caseinType: "Micellar Casein",
    flavor: "Vanilla Dream",
    servingSize: "35g",
    nutrition: {
      calories: 140,
      protein: 28,
      carbs: 4,
      fat: 1,
      calcium: 350,
      glutamine: 4.8,
      leucine: 2.4,
    },
    ingredients: ["Micellar Casein Protein", "Natural Vanilla", "Stevia", "Sea Salt", "Digestive Enzymes"],
    benefits: ["8-Hour Release", "Muscle Recovery", "Anti-Catabolic", "Sleep Quality"],
    releaseTime: "8 hours",
    absorption: "Slow",
    difficulty: "Easy",
    prepTime: 3,
    rating: 4.7,
    reviews: 1234,
    trending: true,
    featured: true,
    price: 45.99,
    bestTime: "Before Bed",
    fitnessGoal: "Muscle Recovery",
    mixability: "Good",
    texture: "Thick",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (35g)', 'micellar casein protein'),
        m(1, 'cup', 'cold milk or water'),
        m(1, 'tsp', 'natural vanilla extract'),
        m(1, 'pinch', 'sea salt'),
        m(4, 'ice cubes', 'ice', 'optional for thicker shake')
      ],
      directions: [
        'Add liquid first to prevent clumping',
        'Slowly add casein protein while blending on low',
        'Blend for 60-90 seconds until completely smooth',
        'Let sit for 1 minute to thicken before drinking'
      ]
    }
  },
  {
    id: "casein-2",
    name: "Night Owl Chocolate",
    description: "Rich chocolate casein for evening muscle repair",
    caseinType: "Calcium Caseinate",
    flavor: "Dark Chocolate",
    servingSize: "32g",
    nutrition: {
      calories: 125,
      protein: 25,
      carbs: 5,
      fat: 1.5,
      calcium: 300,
      magnesium: 75,
      tryptophan: 0.3,
    },
    ingredients: ["Calcium Caseinate", "Cocoa Powder", "Natural Chocolate", "Monk Fruit", "Lecithin"],
    benefits: ["Sleep Support", "Muscle Synthesis", "Calcium Rich", "Antioxidants"],
    releaseTime: "6-7 hours",
    absorption: "Slow",
    difficulty: "Easy",
    prepTime: 2,
    rating: 4.5,
    reviews: 892,
    trending: false,
    featured: true,
    price: 42.99,
    bestTime: "Evening",
    fitnessGoal: "Recovery",
    mixability: "Excellent",
    texture: "Creamy",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (32g)', 'calcium caseinate'),
        m(1, 'cup', 'almond milk'),
        m(1, 'tbsp', 'cocoa powder'),
        m(1, 'tsp', 'natural sweetener'),
        m(1, 'pinch', 'sea salt')
      ],
      directions: [
        'Mix casein with small amount of liquid first to create paste',
        'Gradually add remaining liquid while blending',
        'Blend until rich and chocolatey smooth'
      ]
    }
  },
  {
    id: "casein-3",
    name: "Strawberry Moonlight",
    description: "Gentle strawberry casein with added melatonin",
    caseinType: "Micellar Casein",
    flavor: "Strawberry Cream",
    servingSize: "30g",
    nutrition: {
      calories: 120,
      protein: 24,
      carbs: 6,
      fat: 1,
      calcium: 320,
      melatonin: 3,
      zinc: 5,
    },
    ingredients: ["Micellar Casein", "Strawberry Extract", "Natural Cream Flavor", "Melatonin", "Zinc Glycinate"],
    benefits: ["Sleep Enhancement", "Recovery", "Hormone Support", "Immune Function"],
    releaseTime: "7-8 hours",
    absorption: "Very Slow",
    difficulty: "Easy",
    prepTime: 3,
    rating: 4.6,
    reviews: 567,
    trending: true,
    featured: false,
    price: 48.99,
    bestTime: "Before Bed",
    fitnessGoal: "Sleep & Recovery",
    mixability: "Good",
    texture: "Smooth",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'micellar casein'),
        m(1, 'cup', 'milk or water'),
        m(0.5, 'cup', 'frozen strawberries'),
        m(1, 'tsp', 'honey', 'optional'),
        m(1, 'pinch', 'vanilla extract')
      ],
      directions: [
        'Blend casein with liquid until smooth',
        'Add frozen strawberries and honey',
        'Blend until creamy pink consistency'
      ]
    }
  },
  {
    id: "casein-4",
    name: "Cookie Dough Dreams",
    description: "Indulgent cookie dough flavor with extended protein release",
    caseinType: "Micellar Casein",
    flavor: "Cookie Dough",
    servingSize: "35g",
    nutrition: {
      calories: 155,
      protein: 27,
      carbs: 8,
      fat: 2,
      calcium: 340,
      phosphorus: 220,
      glutamine: 5.1,
    },
    ingredients: ["Micellar Casein", "Cookie Dough Flavor", "Natural Sweeteners", "Probiotic Blend", "Vanilla"],
    benefits: ["Taste Satisfaction", "Gut Health", "Muscle Preservation", "Craving Control"],
    releaseTime: "8+ hours",
    absorption: "Very Slow",
    difficulty: "Easy",
    prepTime: 3,
    rating: 4.4,
    reviews: 1098,
    trending: false,
    featured: true,
    price: 46.99,
    bestTime: "Evening Dessert",
    fitnessGoal: "Weight Management",
    mixability: "Good",
    texture: "Rich",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (35g)', 'cookie dough casein'),
        m(1, 'cup', 'milk'),
        m(1, 'tbsp', 'Greek yogurt'),
        m(1, 'tsp', 'vanilla extract'),
        m(1, 'pinch', 'cinnamon')
      ],
      directions: [
        'Combine all ingredients in blender',
        'Blend until thick and creamy',
        'Add more milk if too thick'
      ]
    }
  },
  {
    id: "casein-5",
    name: "Banana Bedtime Blend",
    description: "Natural banana with tryptophan for better sleep",
    caseinType: "Calcium Caseinate",
    flavor: "Banana Cream",
    servingSize: "30g",
    nutrition: {
      calories: 130,
      protein: 25,
      carbs: 6,
      fat: 1,
      potassium: 400,
      tryptophan: 0.4,
      vitamin_b6: 0.8,
    },
    ingredients: ["Calcium Caseinate", "Banana Powder", "Natural Flavors", "L-Tryptophan", "Vitamin B6"],
    benefits: ["Natural Sleep Aid", "Electrolyte Balance", "Mood Support", "Recovery"],
    releaseTime: "6-7 hours",
    absorption: "Slow",
    difficulty: "Easy",
    prepTime: 2,
    rating: 4.3,
    reviews: 445,
    trending: false,
    featured: false,
    price: 39.99,
    bestTime: "Before Bed",
    fitnessGoal: "Sleep Quality",
    mixability: "Excellent",
    texture: "Smooth",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'banana casein'),
        m(1, 'cup', 'coconut water'),
        m(0.5, 'banana', 'ripe'),
        m(1, 'tsp', 'honey', 'optional'),
        m(1, 'pinch', 'nutmeg')
      ],
      directions: [
        'Blend casein with coconut water',
        'Add banana and honey',
        'Blend until smooth and frothy'
      ]
    }
  },
  {
    id: "casein-6",
    name: "Coffee Shop Latte",
    description: "Decaf coffee casein for evening caffeine lovers",
    caseinType: "Micellar Casein",
    flavor: "Decaf Latte",
    servingSize: "33g",
    nutrition: {
      calories: 135,
      protein: 26,
      carbs: 5,
      fat: 1.5,
      calcium: 330,
      caffeine: 2,
      l_theanine: 100,
    },
    ingredients: ["Micellar Casein", "Decaf Coffee Extract", "Natural Latte Flavor", "L-Theanine", "MCT Oil"],
    benefits: ["Coffee Taste", "Relaxation", "Focus", "Sustained Energy"],
    releaseTime: "7-8 hours",
    absorption: "Slow",
    difficulty: "Medium",
    prepTime: 4,
    rating: 4.2,
    reviews: 667,
    trending: false,
    featured: false,
    price: 44.99,
    bestTime: "Evening",
    fitnessGoal: "Mental Performance",
    mixability: "Fair",
    texture: "Frothy",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (33g)', 'mocha casein'),
        m(1, 'cup', 'cold brew coffee'),
        m(2, 'tbsp', 'cream or milk alternative'),
        m(1, 'tsp', 'cocoa powder'),
        m(1, 'pinch', 'cinnamon')
      ],
      directions: [
        'Brew coffee and let cool completely',
        'Blend coffee with casein and cocoa',
        'Add cream and blend until frothy'
      ]
    }
  },
]

const caseinTypes = [
  {
    id: "micellar",
    name: "Micellar Casein",
    description: "Slowest digesting, most natural form",
    icon: Moon,
    color: "text-purple-600",
    releaseTime: "7-8 hours",
    benefits: ["Longest Release", "Natural Structure", "Anti-Catabolic", "Muscle Preservation"],
    bestFor: "Overnight Recovery",
  },
  {
    id: "calcium-caseinate",
    name: "Calcium Caseinate",
    description: "Faster mixing, good bioavailability",
    icon: Zap,
    color: "text-blue-600",
    releaseTime: "5-6 hours",
    benefits: ["Better Mixing", "Calcium Rich", "Versatile", "Cost Effective"],
    bestFor: "Evening Snacks",
  },
  {
    id: "hydrolyzed",
    name: "Hydrolyzed Casein",
    description: "Pre-digested for sensitive stomachs",
    icon: Heart,
    color: "text-green-600",
    releaseTime: "4-5 hours",
    benefits: ["Easy Digestion", "Less Bloating", "Faster Absorption", "Gentle"],
    bestFor: "Sensitive Digestion",
  },
]

const sleepGoals = [
  {
    id: "muscle-recovery",
    name: "Muscle Recovery",
    description: "Maximize overnight muscle repair",
    icon: Dumbbell,
    color: "bg-red-500",
    recommendedTiming: "30-60 minutes before bed",
    keyNutrients: ["Protein", "Glutamine", "Leucine"],
  },
  {
    id: "sleep-quality",
    name: "Sleep Quality",
    description: "Enhance sleep depth and duration",
    icon: Bed,
    color: "bg-purple-500",
    recommendedTiming: "1-2 hours before bed",
    keyNutrients: ["Melatonin", "Tryptophan", "Magnesium"],
  },
  {
    id: "weight-management",
    name: "Weight Management",
    description: "Control late-night cravings",
    icon: Target,
    color: "bg-blue-500",
    recommendedTiming: "As evening snack",
    keyNutrients: ["Protein", "Fiber", "Calcium"],
  },
  {
    id: "lean-mass",
    name: "Lean Mass",
    description: "Preserve muscle during cutting",
    icon: Dumbbell,
    color: "bg-green-500",
    recommendedTiming: "Before extended fasting",
    keyNutrients: ["BCAA", "Glutamine", "HMB"],
  },
]

export default function CaseinProteinPage() {
  const { addToFavorites, isFavorite, addToRecentlyViewed, userProgress, addPoints, incrementDrinksMade } = useDrinks()

  const [activeTab, setActiveTab] = useState("browse")
  const [selectedCaseinType, setSelectedCaseinType] = useState("")
  const [selectedGoal, setSelectedGoal] = useState("")
  const [selectedTiming, setSelectedTiming] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("rating")
  const [showUniversalSearch, setShowUniversalSearch] = useState(false)
  const [selectedShake, setSelectedShake] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [servingsById, setServingsById] = useState<Record<string, number>>({});

  // RecipeKit refs
  const kitRefs = useRef<Record<string, RecipeKitHandle | null>>({});

  const allTags = ['All', ...new Set(caseinShakes.flatMap(r => r.benefits))];

  const getServings = (recipe: any) => servingsById[recipe.id] ?? (recipe.recipe?.servings || 1);
  const incrementServings = (recipe: any, dir: 1 | -1) => {
    setServingsById(prev => {
      const current = prev[recipe.id] ?? (recipe.recipe?.servings || 1);
      const next = Math.min(12, Math.max(1, current + dir));
      return { ...prev, [recipe.id]: next };
    });
  };

  // Filter and sort shakes
  const getFilteredShakes = () => {
    const filtered = caseinShakes.filter((shake) => {
      const matchesSearch =
        shake.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shake.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType =
        !selectedCaseinType || shake.caseinType.toLowerCase().includes(selectedCaseinType.toLowerCase())
      const matchesGoal = !selectedGoal || shake.fitnessGoal.toLowerCase().includes(selectedGoal.toLowerCase())
      const matchesTiming = !selectedTiming || shake.bestTime.toLowerCase().includes(selectedTiming.toLowerCase())

      return matchesSearch && matchesType && matchesGoal && matchesTiming
    })

    // Sort results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.rating || 0) - (a.rating || 0)
        case "protein":
          return (b.nutrition.protein || 0) - (a.nutrition.protein || 0)
        case "price":
          return (a.price || 0) - (b.price || 0)
        case "release-time":
          return Number.parseFloat(b.releaseTime) - Number.parseFloat(a.releaseTime)
        default:
          return 0
      }
    })

    return filtered
  }

  const filteredShakes = getFilteredShakes()
  const featuredShakes = caseinShakes.filter((shake) => shake.featured)

  const handleSharePage = async () => {
    const shareData = {
      title: 'Casein Protein Shakes',
      text: 'Browse slow-digesting casein protein shakes for overnight recovery.',
      url: typeof window !== 'undefined' ? window.location.href : ''
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      } catch {
        alert('Unable to share on this device.');
      }
    }
  };

  const handleCopyRecipe = (recipe: any) => {
    const recipeText = `
${recipe.name}
${recipe.flavor}

Ingredients:
${recipe.recipe.measurements.map((m: Measured) => `• ${m.amount} ${m.unit} ${m.item}${m.note ? ` (${m.note})` : ''}`).join('\n')}

Directions:
${recipe.recipe.directions.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}

Nutrition: ${recipe.nutrition.protein}g protein, ${recipe.nutrition.calories} calories, ${recipe.releaseTime} release
    `.trim();

    navigator.clipboard.writeText(recipeText);
    alert('Recipe copied to clipboard!');
  };

  const handleShareRecipe = async (recipe: any) => {
    const shareData = {
      title: recipe.name,
      text: `${recipe.flavor} - ${recipe.nutrition.protein}g protein, ${recipe.releaseTime} release time`,
      url: typeof window !== 'undefined' ? window.location.href + `#${recipe.id}` : ''
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Recipe link copied to clipboard!');
      }
    } catch {
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
      alert('Recipe link copied to clipboard!');
    }
  };

  const handleShowMetrics = (recipe: any) => {
    alert(`Detailed metrics for ${recipe.name}:\n\nProtein: ${recipe.nutrition.protein}g\nCalories: ${recipe.nutrition.calories}\nRelease Time: ${recipe.releaseTime}\nCalcium: ${recipe.nutrition.calcium}mg\nRating: ${recipe.rating}/5 (${recipe.reviews} reviews)`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Universal Search Modal */}
      {showUniversalSearch && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20"
          onClick={() => setShowUniversalSearch(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
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

      {/* Header */}
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
                <Moon className="h-6 w-6 text-purple-600" />
                <h1 className="text-2xl font-bold text-gray-900">Casein Protein</h1>
                <Badge className="bg-purple-100 text-purple-800">Night Time</Badge>
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
              <Button size="sm" className="bg-purple-500 hover:bg-purple-600 text-white" onClick={handleSharePage}>
                <Camera className="h-4 w-4 mr-2" />
                Share Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cross-Hub Navigation */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {otherDrinkHubs.map((hub) => {
                const Icon = hub.icon
                return (
                  <Link key={hub.id} href={hub.route}>
                    <Button
                      variant="outline"
                      className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 bg-transparent"
                    >
                      <Icon className="h-4 w-4 mr-2 text-blue-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{hub.name}</div>
                        <div className="text-xs text-gray-500">{hub.description}</div>
                      </div>
                      <ArrowRight className="h-3 w-3 ml-auto" />
                    </Button>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sister Subpages Navigation */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Protein Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {proteinSubcategories.map((subcategory) => {
                const Icon = subcategory.icon
                return (
                  <Link key={subcategory.id} href={subcategory.path}>
                    <Button
                      variant="outline"
                      className="w-full justify-start hover:bg-purple-50 hover:border-purple-300 bg-transparent"
                    >
                      <Icon className="h-4 w-4 mr-2 text-purple-600" />
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{subcategory.name}</div>
                        <div className="text-xs text-gray-500">{subcategory.description}</div>
                      </div>
                      <ArrowRight className="h-3 w-3 ml-auto" />
                    </Button>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">7hrs</div>
              <div className="text-sm text-gray-600">Avg Release</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">26g</div>
              <div className="text-sm text-gray-600">Avg Protein</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">330mg</div>
              <div className="text-sm text-gray-600">Avg Calcium</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">6</div>
              <div className="text-sm text-gray-600">Night Formulas</div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {[
            { id: "browse", label: "Browse All", icon: Search },
            { id: "casein-types", label: "Casein Types", icon: Moon },
            { id: "sleep-goals", label: "Sleep Goals", icon: Bed },
            { id: "featured", label: "Featured", icon: Star },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 ${activeTab === tab.id ? "bg-white shadow-sm" : ""}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </Button>
            )
          })}
        </div>

        {/* Browse Tab */}
        {activeTab === "browse" && (
          <div>
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search casein proteins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedCaseinType}
                  onChange={(e) => setSelectedCaseinType(e.target.value)}
                >
                  <option value="">All Casein Types</option>
                  <option value="micellar">Micellar Casein</option>
                  <option value="calcium">Calcium Caseinate</option>
                  <option value="hydrolyzed">Hydrolyzed Casein</option>
                </select>

                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedGoal}
                  onChange={(e) => setSelectedGoal(e.target.value)}
                >
                  <option value="">All Goals</option>
                  <option value="Recovery">Muscle Recovery</option>
                  <option value="Sleep">Sleep Quality</option>
                  <option value="Weight">Weight Management</option>
                  <option value="Performance">Mental Performance</option>
                </select>

                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
                  <option value="price">Sort by Price</option>
                  <option value="release-time">Sort by Release Time</option>
                </select>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShakes.map((shake) => {
                const servings = getServings(shake);
                const hasMoreThan5Ingredients = shake.recipe?.measurements?.length > 5;

                return (
                  <Card key={shake.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{shake.name}</CardTitle>
                          <p className="text-sm text-gray-600 mb-2">{shake.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            addToFavorites({
                              id: shake.id,
                              name: shake.name,
                              category: "protein-shakes",
                              description: shake.description,
                              ingredients: shake.ingredients,
                              nutrition: shake.nutrition,
                              difficulty: shake.difficulty,
                              prepTime: shake.prepTime,
                              rating: shake.rating,
                              fitnessGoal: shake.fitnessGoal,
                              bestTime: shake.bestTime,
                            })
                          }
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Heart className={`h-4 w-4 ${isFavorite(shake.id) ? "fill-red-500 text-red-500" : ""}`} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-purple-100 text-purple-800">{shake.caseinType}</Badge>
                        <Badge variant="outline">{shake.flavor}</Badge>
                        {shake.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                      </div>

                      {/* Rating and Difficulty moved above recipe box */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="font-medium">{shake.rating}</span>
                          <span className="text-gray-500 text-sm">({shake.reviews})</span>
                        </div>
                        <Badge variant="outline">{shake.difficulty}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                        <div>
                          <div className="text-xl font-bold text-purple-600">{shake.nutrition.protein}g</div>
                          <div className="text-gray-500">Protein</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div>
                          <div className="text-gray-500">Cal</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-green-600">{shake.releaseTime}</div>
                          <div className="text-gray-500">Release</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-amber-600">${shake.price}</div>
                          <div className="text-gray-500">Price</div>
                        </div>
                      </div>

                      {/* RecipeKit (preview + modal) */}
                      {shake.recipe?.measurements && (
                        <RecipeKit
                          ref={(el) => { kitRefs.current[shake.id] = el; }}
                          id={shake.id}
                          name={shake.name}
                          measurements={shake.recipe.measurements}
                          directions={shake.recipe.directions}
                          nutrition={shake.nutrition}
                          prepTime={shake.prepTime}
                          onComplete={() => {
                            addToRecentlyViewed({
                              id: shake.id,
                              name: shake.name,
                              category: 'protein-shakes',
                              description: shake.description,
                              ingredients: shake.recipe.measurements.map((x: Measured) => x.item),
                              nutrition: shake.nutrition,
                              difficulty: shake.difficulty,
                              prepTime: shake.prepTime,
                              rating: shake.rating,
                              fitnessGoal: shake.fitnessGoal,
                              bestTime: shake.bestTime
                            });
                            incrementDrinksMade();
                            addPoints(30);
                          }}
                        />
                      )}

                      {/* Tags with Night Time color scheme */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {shake.benefits.map((benefit: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-200">
                            {benefit}
                          </Badge>
                        ))}
                      </div>

                      {/* Full-width CTA — Make Shake with lighter purple */}
                      <Button
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                        size="sm"
                        onClick={() => {
                          addToRecentlyViewed({
                            id: shake.id,
                            name: shake.name,
                            category: 'protein-shakes',
                            description: shake.description,
                            ingredients: shake.recipe?.measurements?.map((x: Measured) => x.item) ?? [],
                            nutrition: shake.nutrition,
                            difficulty: shake.difficulty,
                            prepTime: shake.prepTime,
                            rating: shake.rating,
                            fitnessGoal: shake.fitnessGoal,
                            bestTime: shake.bestTime
                          });
                          incrementDrinksMade();
                          addPoints(30);
                          kitRefs.current[shake.id]?.open?.();
                        }}
                      >
                        <Moon className="h-4 w-4 mr-1" />
                        Make Shake (+30 XP)
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Casein Types Tab */}
        {activeTab === "casein-types" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {caseinTypes.map((type) => {
              const Icon = type.icon
              const typeShakes = caseinShakes.filter((shake) =>
                shake.caseinType.toLowerCase().includes(type.id.replace("-", " ")),
              )

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
                        <div className="text-sm font-medium text-gray-700 mb-1">Release Time</div>
                        <div className="text-2xl font-bold text-purple-600">{type.releaseTime}</div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-2">Key Benefits:</h4>
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
                      <div className={`text-2xl font-bold ${type.color} mb-1`}>{typeShakes.length}</div>
                      <div className="text-sm text-gray-600 mb-3">Available Options</div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          setSelectedCaseinType(type.id)
                          setActiveTab("browse")
                        }}
                      >
                        Explore {type.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Sleep Goals Tab */}
        {activeTab === "sleep-goals" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sleepGoals.map((goal) => {
              const Icon = goal.icon
              const goalShakes = caseinShakes.filter((shake) =>
                shake.fitnessGoal.toLowerCase().includes(goal.name.toLowerCase().split(" ")[0]),
              )

              return (
                <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${goal.color.replace("bg-", "bg-").replace("-500", "-100")} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${goal.color.replace("bg-", "text-")}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        <p className="text-sm text-gray-600">{goal.description}</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Timing:</div>
                        <div className="text-sm text-purple-800">{goal.recommendedTiming}</div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-2">Key Nutrients:</h4>
                        <div className="flex flex-wrap gap-1">
                          {goal.keyNutrients.map((nutrient, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {nutrient}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className={`text-2xl font-bold ${goal.color.replace("bg-", "text-")} mb-1`}>
                        {goalShakes.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Perfect Matches</div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          setSelectedGoal(goal.name.split(" ")[0])
                          setActiveTab("browse")
                        }}
                      >
                        View {goal.name} Options
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Featured Tab */}
        {activeTab === "featured" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredShakes.map((shake) => (
              <Card key={shake.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img
                    src={shake.image || "/placeholder.svg"}
                    alt={shake.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop"
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-purple-500 text-white">Featured Casein</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-purple-800">{shake.releaseTime}</Badge>
                  </div>
                </div>

                <CardHeader>
                  <CardTitle className="text-xl">{shake.name}</CardTitle>
                  <p className="text-gray-600">{shake.description}</p>

                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-purple-100 text-purple-800">{shake.caseinType}</Badge>
                    <Badge variant="outline">{shake.flavor}</Badge>
                  </div>

                  {/* Rating and Difficulty moved above recipe box */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{shake.rating}</span>
                      <span className="text-gray-500 text-sm">({shake.reviews})</span>
                    </div>
                    <Badge variant="outline">{shake.difficulty}</Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Enhanced nutrition display */}
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-purple-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">{shake.nutrition.protein}g</div>
                      <div className="text-xs text-gray-600">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{shake.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{shake.nutrition.calcium}mg</div>
                      <div className="text-xs text-gray-600">Calcium</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-600">${shake.price}</div>
                      <div className="text-xs text-gray-600">Price</div>
                    </div>
                  </div>

                  {/* RecipeKit */}
                  {shake.recipe?.measurements && (
                    <RecipeKit
                      ref={(el) => { kitRefs.current[shake.id] = el; }}
                      id={shake.id}
                      name={shake.name}
                      measurements={shake.recipe.measurements}
                      directions={shake.recipe.directions}
                      nutrition={shake.nutrition}
                      prepTime={shake.prepTime}
                      onComplete={() => {
                        addToRecentlyViewed({
                          id: shake.id,
                          name: shake.name,
                          category: 'protein-shakes',
                          description: shake.description,
                          ingredients: shake.recipe.measurements.map((x: Measured) => x.item),
                          nutrition: shake.nutrition,
                          difficulty: shake.difficulty,
                          prepTime: shake.prepTime,
                          rating: shake.rating,
                          fitnessGoal: shake.fitnessGoal,
                          bestTime: shake.bestTime
                        });
                        incrementDrinksMade();
                        addPoints(30);
                      }}
                    />
                  )}

                  {/* Tags with Night Time color scheme */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {shake.benefits.map((benefit: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-200">
                        {benefit}
                      </Badge>
                    ))}
                  </div>

                  {/* Full-width CTA */}
                  <Button
                    className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                    onClick={() => {
                      addToRecentlyViewed({
                        id: shake.id,
                        name: shake.name,
                        category: 'protein-shakes',
                        description: shake.description,
                        ingredients: shake.recipe?.measurements?.map((x: Measured) => x.item) ?? [],
                        nutrition: shake.nutrition,
                        difficulty: shake.difficulty,
                        prepTime: shake.prepTime,
                        rating: shake.rating,
                        fitnessGoal: shake.fitnessGoal,
                        bestTime: shake.bestTime
                      });
                      incrementDrinksMade();
                      addPoints(30);
                      kitRefs.current[shake.id]?.open?.();
                    }}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Make Shake (+30 XP)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Your Progress */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-purple-600">
                    Level {userProgress.level}
                  </Badge>
                  <Badge variant="outline" className="text-blue-600">
                    {userProgress.totalPoints} XP
                  </Badge>
                  <Badge variant="outline" className="text-green-600">
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
  )
}
