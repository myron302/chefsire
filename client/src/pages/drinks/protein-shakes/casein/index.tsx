import { useState, useRef, useEffect } from "react"
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
  Clipboard,
  RotateCcw,
  BarChart3,
} from "lucide-react"
import { useDrinks } from "@/contexts/DrinksContext"
import UniversalSearch from "@/components/UniversalSearch"
import RecipeKit, { Measured } from '@/components/recipes/RecipeKit';
import type { RecipeKitHandle } from '@/components/recipes/RecipeKit';

// ---------- Helpers ----------
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

// Scaling helpers to match Plant-Based page
const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));
const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = { 0: '', 1: '1/4', 2: '1/2', 3: '3/4' };
  const fracStr = fracMap[frac];
  if (!whole && fracStr) return fracStr;
  if (whole && fracStr) return `${whole} ${fracStr}`;
  return `${whole}`;
};
const scaleAmount = (baseAmount: number | string, servings: number) => {
  const n = typeof baseAmount === 'number' ? baseAmount : parseFloat(String(baseAmount));
  if (Number.isNaN(n)) return baseAmount;
  return toNiceFraction(n * servings);
};

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

// Casein protein shake data - ALL 9 RECIPES PRESERVED
const caseinShakes = [
  {
    id: "casein-1",
    name: "Midnight Muscle Recovery",
    description: "Slow-digesting micellar casein for 8-hour muscle feeding",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
    caseinType: "Micellar Casein",
    proteinType: "micellar",
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
    absorptionTime: "7-8 hours",
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
    leucineContent: "2.4g",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (35g)', 'micellar casein protein'),
        m(1, 'cup', 'cold milk or water'),
        m(1, 'tsp', 'natural vanilla extract'),
        m(1, 'pinch', 'sea salt'),
        m(4, 'ice cubes', 'ice', 'optional for thicker shake'),
        m(1, 'tbsp', 'Greek yogurt', 'for creaminess'),
        m(0.5, 'tsp', 'cinnamon', 'optional'),
        m(1, 'tsp', 'honey', 'natural sweetener')
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
    proteinType: "calcium-caseinate",
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
    absorptionTime: "6-7 hours",
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
    leucineContent: "2.2g",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (32g)', 'calcium caseinate'),
        m(1, 'cup', 'almond milk'),
        m(1, 'tbsp', 'cocoa powder'),
        m(1, 'tsp', 'natural sweetener'),
        m(1, 'pinch', 'sea salt'),
        m(1, 'tsp', 'MCT oil', 'for sustained energy'),
        m(0.25, 'tsp', 'vanilla extract')
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
    proteinType: "micellar",
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
    absorptionTime: "7-8 hours",
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
    leucineContent: "2.1g",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'micellar casein'),
        m(1, 'cup', 'milk or water'),
        m(0.5, 'cup', 'frozen strawberries'),
        m(1, 'tsp', 'honey', 'optional'),
        m(1, 'pinch', 'vanilla extract'),
        m(1, 'tbsp', 'chia seeds', 'for fiber'),
        m(0.25, 'cup', 'Greek yogurt')
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
    proteinType: "micellar",
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
    absorptionTime: "8+ hours",
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
    leucineContent: "2.3g",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (35g)', 'cookie dough casein'),
        m(1, 'cup', 'milk'),
        m(1, 'tbsp', 'Greek yogurt'),
        m(1, 'tsp', 'vanilla extract'),
        m(1, 'pinch', 'cinnamon'),
        m(1, 'tbsp', 'almond butter', 'for richness'),
        m(1, 'tsp', 'chocolate chips', 'optional')
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
    proteinType: "calcium-caseinate",
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
    absorptionTime: "6-7 hours",
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
    leucineContent: "2.0g",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (30g)', 'banana casein'),
        m(1, 'cup', 'coconut water'),
        m(0.5, 'banana', 'ripe'),
        m(1, 'tsp', 'honey', 'optional'),
        m(1, 'pinch', 'nutmeg'),
        m(1, 'tbsp', 'flax seeds', 'for omega-3'),
        m(0.25, 'tsp', 'cinnamon')
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
    proteinType: "micellar",
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
    absorptionTime: "7-8 hours",
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
    leucineContent: "2.2g",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (33g)', 'mocha casein'),
        m(1, 'cup', 'cold brew coffee'),
        m(2, 'tbsp', 'cream or milk alternative'),
        m(1, 'tsp', 'cocoa powder'),
        m(1, 'pinch', 'cinnamon'),
        m(1, 'tsp', 'maple syrup', 'optional sweetener'),
        m(0.25, 'tsp', 'vanilla extract')
      ],
      directions: [
        'Brew coffee and let cool completely',
        'Blend coffee with casein and cocoa',
        'Add cream and blend until frothy'
      ]
    }
  },
  {
    id: "casein-7",
    name: "Blueberry Serenity",
    description: "Antioxidant-rich blueberry casein for overnight repair",
    caseinType: "Micellar Casein",
    proteinType: "micellar",
    flavor: "Blueberry Vanilla",
    servingSize: "34g",
    nutrition: {
      calories: 145,
      protein: 26,
      carbs: 7,
      fat: 1.2,
      calcium: 335,
      antioxidants: 1200,
      vitamin_c: 15,
    },
    ingredients: ["Micellar Casein", "Blueberry Powder", "Vanilla Extract", "Acerola Cherry", "Probiotics"],
    benefits: ["Antioxidant Boost", "Immune Support", "Muscle Repair", "Digestive Health"],
    releaseTime: "7-8 hours",
    absorptionTime: "7-8 hours",
    absorption: "Slow",
    difficulty: "Easy",
    prepTime: 3,
    rating: 4.5,
    reviews: 789,
    trending: true,
    featured: false,
    price: 47.99,
    bestTime: "Before Bed",
    fitnessGoal: "Recovery",
    mixability: "Excellent",
    texture: "Smooth",
    leucineContent: "2.1g",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (34g)', 'blueberry casein'),
        m(1, 'cup', 'almond milk'),
        m(0.5, 'cup', 'frozen blueberries'),
        m(1, 'tsp', 'vanilla extract'),
        m(1, 'tbsp', 'Greek yogurt'),
        m(1, 'tsp', 'chia seeds'),
        m(1, 'pinch', 'lemon zest')
      ],
      directions: [
        'Blend casein with almond milk until smooth',
        'Add frozen blueberries and vanilla',
        'Blend until vibrant purple and creamy'
      ]
    }
  },
  {
    id: "casein-8",
    name: "Cinnamon Swirl Delight",
    description: "Warm cinnamon flavor for cozy evenings",
    caseinType: "Calcium Caseinate",
    proteinType: "calcium-caseinate",
    flavor: "Cinnamon Roll",
    servingSize: "31g",
    nutrition: {
      calories: 128,
      protein: 24,
      carbs: 5,
      fat: 1.3,
      calcium: 310,
      magnesium: 45,
      manganese: 0.8,
    },
    ingredients: ["Calcium Caseinate", "Cinnamon", "Natural Sweeteners", "Vanilla", "MCT Powder"],
    benefits: ["Blood Sugar Support", "Anti-Inflammatory", "Satiety", "Warm Comfort"],
    releaseTime: "6-7 hours",
    absorptionTime: "6-7 hours",
    absorption: "Slow",
    difficulty: "Easy",
    prepTime: 2,
    rating: 4.4,
    reviews: 523,
    trending: false,
    featured: false,
    price: 41.99,
    bestTime: "Evening",
    fitnessGoal: "Weight Management",
    mixability: "Good",
    texture: "Creamy",
    leucineContent: "2.0g",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (31g)', 'cinnamon casein'),
        m(1, 'cup', 'oat milk'),
        m(0.5, 'tsp', 'cinnamon'),
        m(1, 'tsp', 'honey'),
        m(1, 'pinch', 'nutmeg'),
        m(1, 'tbsp', 'pecans', 'optional crunch'),
        m(0.25, 'tsp', 'vanilla extract')
      ],
      directions: [
        'Combine all ingredients in blender',
        'Blend until warm cinnamon aroma develops',
        'Enjoy as comforting evening treat'
      ]
    }
  },
  {
    id: "casein-9",
    name: "Peanut Butter Dream",
    description: "Creamy peanut butter casein for sustained nourishment",
    caseinType: "Micellar Casein",
    proteinType: "micellar",
    flavor: "Peanut Butter Cup",
    servingSize: "36g",
    nutrition: {
      calories: 165,
      protein: 28,
      carbs: 6,
      fat: 3,
      calcium: 345,
      healthy_fats: 2.5,
      fiber: 2,
    },
    ingredients: ["Micellar Casein", "Peanut Flour", "Cocoa", "Natural Flavors", "Digestive Enzymes"],
    benefits: ["Sustained Energy", "Heart Health", "Muscle Preservation", "Satiety"],
    releaseTime: "8+ hours",
    absorptionTime: "8+ hours",
    absorption: "Very Slow",
    difficulty: "Easy",
    prepTime: 3,
    rating: 4.6,
    reviews: 934,
    trending: true,
    featured: true,
    price: 49.99,
    bestTime: "Before Bed",
    fitnessGoal: "Muscle Building",
    mixability: "Good",
    texture: "Rich",
    leucineContent: "2.5g",
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (36g)', 'peanut butter casein'),
        m(1, 'cup', 'milk'),
        m(1, 'tbsp', 'natural peanut butter'),
        m(1, 'tsp', 'cocoa powder'),
        m(1, 'tsp', 'maple syrup'),
        m(1, 'pinch', 'sea salt'),
        m(1, 'tbsp', 'oats', 'for thickness')
      ],
      directions: [
        'Blend casein with milk until smooth',
        'Add peanut butter and cocoa',
        'Blend until rich and creamy like peanut butter cup'
      ]
    }
  }
]

const proteinTypes = [
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

  const [activeTab, setActiveTab] = useState<"browse"|"protein-types"|"goals"|"featured">("browse")
  const [selectedProteinType, setSelectedProteinType] = useState("")
  const [selectedGoal, setSelectedGoal] = useState("")
  const [selectedTiming, setSelectedTiming] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"rating"|"protein"|"price"|"release-time">("rating")
  const [showUniversalSearch, setShowUniversalSearch] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null)
  const [showKit, setShowKit] = useState(false)
  const [servingsById, setServingsById] = useState<Record<string, number>>({})
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({})

  // RecipeKit refs
  const kitRefs = useRef<Record<string, RecipeKitHandle | null>>({})

  // deep-link (?id=casein-1) — scroll card into view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get("id")
    if (id) {
      const el = document.getElementById(`card-${id}`)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [])

  const handleSharePage = async () => {
    const shareData = {
      title: "Casein Protein Shakes",
      text: "Browse slow-digesting casein protein shakes for overnight recovery.",
      url: typeof window !== "undefined" ? window.location.href : ""
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`)
        alert("Link copied to clipboard!")
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`)
        alert("Link copied to clipboard!")
      } catch {
        alert("Unable to share on this device.")
      }
    }
  }

  const handleShareShake = async (shake: any, servingsOverride?: number) => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const servings = servingsOverride ?? servingsById[shake.id] ?? (shake.recipe?.servings || 1)
    const preview = (shake?.recipe?.measurements || [])
      .slice(0, 4)
      .map((r: Measured) => {
        const scaled =
          typeof r.amount === "number"
            ? `${scaleAmount(r.amount, servings)} ${r.unit}`
            : `${r.amount} ${r.unit}`
        return `${scaled} ${r.item}`
      })
      .join(" · ")
    const text = `${shake.name} • ${shake.flavor} • ${shake.caseinType}\n${preview || (shake.ingredients?.slice(0,4)?.join(", ") ?? "")}`
    const shareData = { title: shake.name, text, url }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(`${shake.name}\n${text}\n${url}`)
        alert("Recipe copied to clipboard!")
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shake.name}\n${text}\n${url}`)
        alert("Recipe copied to clipboard!")
      } catch {
        alert("Unable to share on this device.")
      }
    }
  }

  const openRecipeModal = (recipe: any) => {
    setSelectedRecipe(recipe)
    setShowKit(true)
  }

  const handleCompleteRecipe = () => {
    if (selectedRecipe) {
      const drinkData = {
        id: selectedRecipe.id,
        name: selectedRecipe.name,
        category: "protein-shakes" as const,
        description: selectedRecipe.description,
        ingredients: selectedRecipe.recipe?.measurements?.map((x: Measured) => `${x.amount} ${x.unit} ${x.item}`) || [],
        nutrition: selectedRecipe.nutrition,
        difficulty: selectedRecipe.difficulty as "Easy" | "Medium" | "Hard",
        prepTime: selectedRecipe.prepTime,
        rating: selectedRecipe.rating,
        fitnessGoal: selectedRecipe.fitnessGoal,
        bestTime: selectedRecipe.bestTime
      }
      addToRecentlyViewed(drinkData)
      incrementDrinksMade()
      addPoints(30)
    }
    setShowKit(false)
    setSelectedRecipe(null)
  }

  // Filter and sort shakes
  const getFilteredShakes = () => {
    const filtered = caseinShakes.filter((shake) => {
      const matchesSearch =
        shake.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shake.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType =
        !selectedProteinType || shake.proteinType === selectedProteinType
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

      {/* RecipeKit Modal */}
      {selectedRecipe && (
        <RecipeKit
          open={showKit}
          onClose={() => { setShowKit(false); setSelectedRecipe(null); }}
          accent="purple"
          pointsReward={30}
          onComplete={handleCompleteRecipe}
          item={{
            id: selectedRecipe.id,
            name: selectedRecipe.name,
            prepTime: selectedRecipe.prepTime,
            directions: selectedRecipe.recipe?.directions || [],
            measurements: selectedRecipe.recipe?.measurements || [],
            baseNutrition: selectedRecipe.nutrition || {},
            defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1
          }}
        />
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
