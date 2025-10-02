import { 
  Apple, Zap, Leaf, IceCream, Coffee, Dumbbell, Crown,
  Target, Activity, Flame, Droplets, Sparkles, Cookie,
  Cake, Heart, Trophy, Sun, TreePine, Milk, Banana
} from 'lucide-react';
import { 
  SmoothieSubcategory, WorkoutSmoothie, ProteinSmoothie, 
  GreenSmoothie, DessertSmoothie, BreakfastSmoothie,
  WorkoutType, ProteinSource, GreensType, DessertType, BreakfastType
} from '@/types/smoothies';

// Shared drink categories for cross-navigation (same as detoxes)
export const otherDrinkHubs = [
  {
    id: 'smoothies',
    name: 'Smoothies',
    description: 'Nutrient-packed blends',
    icon: Apple,
    route: '/drinks/smoothies',
    color: 'bg-green-500',
    count: '847 recipes'
  },
  {
    id: 'protein-shakes',
    name: 'Protein Shakes',
    description: 'Fitness-focused nutrition',
    icon: Dumbbell,
    route: '/drinks/protein-shakes',
    color: 'bg-blue-500',
    count: '523 recipes'
  },
  {
    id: 'detoxes',
    name: 'Detoxes & Cleanses',
    description: 'Purifying beverages',
    icon: Leaf,
    route: '/drinks/detoxes',
    color: 'bg-teal-500',
    count: '26 recipes'
  },
  {
    id: 'potent-potables',
    name: 'Potent Potables',
    description: 'Cocktails & beverages',
    icon: GlassWater,
    route: '/drinks/potent-potables',
    color: 'bg-purple-500',
    count: '1247 recipes'
  }
];

// Smoothie subcategories (like detoxSubcategories)
export const smoothieSubcategories: SmoothieSubcategory[] = [
  {
    id: 'protein',
    name: 'High-Protein',
    description: 'Natural protein for muscle building',
    icon: Zap,
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    path: '/drinks/smoothies/protein',
    count: 24,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-600',
    trending: true,
    avgCalories: 320,
    duration: 'Post-workout',
    topBenefit: 'Muscle Building'
  },
  {
    id: 'green',
    name: 'Green Superfood',
    description: 'Nutrient-dense greens and superfoods',
    icon: Leaf,
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&h=400&fit=crop',
    path: '/drinks/smoothies/green',
    count: 28,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-600',
    featured: true,
    avgCalories: 210,
    duration: 'Morning',
    topBenefit: 'Detoxification'
  },
  {
    id: 'dessert',
    name: 'Dessert',
    description: 'Guilt-free indulgent flavors',
    icon: IceCream,
    image: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=600&h=400&fit=crop',
    path: '/drinks/smoothies/dessert',
    count: 32,
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-600',
    avgCalories: 280,
    duration: 'Evening',
    topBenefit: 'Satisfaction'
  },
  {
    id: 'breakfast',
    name: 'Breakfast',
    description: 'Morning fuel with balanced nutrition',
    icon: Coffee,
    image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=600&h=400&fit=crop',
    path: '/drinks/smoothies/breakfast',
    count: 26,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-600',
    trending: true,
    avgCalories: 420,
    duration: 'Morning',
    topBenefit: 'Sustained Energy'
  },
  {
    id: 'workout',
    name: 'Workout',
    description: 'Pre and post-workout energy',
    icon: Dumbbell,
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    path: '/drinks/smoothies/workout',
    count: 22,
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-600',
    featured: true,
    avgCalories: 350,
    duration: 'Workout',
    topBenefit: 'Performance'
  }
];

// All smoothie recipes in one place
export const workoutSmoothies: WorkoutSmoothie[] = [/* all workout smoothies */];
export const proteinSmoothies: ProteinSmoothie[] = [/* all protein smoothies */];
export const greenSmoothies: GreenSmoothie[] = [/* all green smoothies */];
export const dessertSmoothies: DessertSmoothie[] = [/* all dessert smoothies */];
export const breakfastSmoothies: BreakfastSmoothie[] = [/* all breakfast smoothies */];

// All category types
export const workoutTypes: WorkoutType[] = [/*...*/];
export const proteinSources: ProteinSource[] = [/*...*/];
export const greensTypes: GreensType[] = [/*...*/];
export const dessertTypes: DessertType[] = [/*...*/];
export const breakfastTypes: BreakfastType[] = [/*...*/];

// Ingredients for smoothie creation
export const ingredients = { /*...*/ };
export const workoutGoals = [/*...*/];
export const premadeRecipes = [/*...*/];
