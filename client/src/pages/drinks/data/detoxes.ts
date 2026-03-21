// client/src/pages/drinks/data/detoxes.ts
import {
  Droplets, Leaf, Heart, Sparkles, Clock, Users, Trophy,
  Star, Flame, Target, Award, TrendingUp, Activity, Zap,
  ArrowLeft, Apple, Sun, Moon, Wind, FlaskConical, Coffee,
  GlassWater, Dumbbell, IceCream, ArrowRight, Waves, Wine
} from 'lucide-react';
import { DrinkCategory, DetoxSubcategory, WaterType, DetoxType } from '../types/detox';
export { detoxJuices } from '@/data/drinks/detoxes/juice';
export { detoxTeas } from '@/data/drinks/detoxes/tea';
export { infusedWaters } from '@/data/drinks/detoxes/water';

// Shared drink categories for cross-navigation
export const otherDrinkHubs: DrinkCategory[] = [
  {
    id: 'smoothies',
    name: 'Smoothies',
    description: 'Nutrient-packed blends',
    icon: Apple,
    route: '/drinks/smoothies',
    color: 'bg-purple-600',
    count: '847 recipes'
  },
  {
    id: 'protein-shakes',
    name: 'Protein Shakes',
    description: 'Fitness-focused nutrition',
    icon: Dumbbell,
    route: '/drinks/protein-shakes',
    color: 'bg-blue-600',
    count: '523 recipes'
  },
  {
    id: 'detoxes',
    name: 'Detox Drinks',
    description: 'Cleanse & refresh',
    icon: Droplets,
    route: '/drinks/detoxes',
    color: 'bg-green-600',
    count: '26 recipes'
  },
  {
    id: 'caffeinated',
    name: 'Caffeinated Drinks',
    description: 'Coffee, tea & energy drinks',
    icon: Coffee,
    route: '/drinks/caffeinated',
    color: 'bg-amber-600',
    count: '186 recipes'
  },
  {
    id: 'potent-potables',
    name: 'Potent Potables',
    description: 'Cocktails & mocktails',
    icon: Wine,
    route: '/drinks/potent-potables',
    color: 'bg-purple-600',
    count: '1247 recipes'
  }
];

// Detox subcategories
export const detoxSubcategories: DetoxSubcategory[] = [
  {
    id: 'juice-cleanse',
    name: 'Detox Juices',
    description: 'Cold-pressed juices for deep cleansing',
    icon: Apple,
    image: '/images/detox-juice.svg',
    path: '/drinks/detoxes/juice',
    count: 8,
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-600',
    trending: true,
    avgCalories: 105,
    duration: '1-3 days',
    topBenefit: 'Deep Cleanse'
  },
  {
    id: 'detox-tea',
    name: 'Detox Teas',
    description: 'Herbal infusions for gentle detoxification',
    icon: Coffee,
    image: '/images/detox-tea.svg',
    path: '/drinks/detoxes/tea',
    count: 8,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-600',
    featured: true,
    avgCalories: 4,
    duration: 'Daily',
    topBenefit: 'Gentle Detox'
  },
  {
    id: 'infused-water',
    name: 'Detox Infused Waters',
    description: 'Fruit and herb infused hydration',
    icon: Droplets,
    image: '/images/detox-water.svg',
    path: '/drinks/detoxes/water',
    count: 10,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-600',
    avgCalories: 10,
    duration: 'All Day',
    topBenefit: 'Hydration'
  }
];

// Infused Waters Data
// Detox Teas Data
// Detox Juices Data
// Water Types
export const waterTypes: WaterType[] = [
  {
    id: 'hydrating',
    name: 'Hydrating Waters',
    description: 'Maximum hydration with electrolytes',
    icon: Waves,
    color: 'text-cyan-600',
    benefits: ['Hydration', 'Electrolytes', 'Cooling'],
    bestFor: 'All-day drinking and post-workout'
  },
  {
    id: 'detox',
    name: 'Detox Waters',
    description: 'Cleansing and metabolism support',
    icon: Sparkles,
    color: 'text-green-600',
    benefits: ['Cleansing', 'Metabolism', 'Digestion'],
    bestFor: 'Morning rituals and cleanses'
  },
  {
    id: 'antioxidant',
    name: 'Antioxidant Blends',
    description: 'Berry and fruit-based for cellular health',
    icon: Star,
    color: 'text-purple-600',
    benefits: ['Antioxidants', 'Anti-aging', 'Immune'],
    bestFor: 'Daily wellness and skin health'
  },
  {
    id: 'energizing',
    name: 'Energizing Waters',
    description: 'Citrus and light caffeine for natural energy',
    icon: Zap,
    color: 'text-orange-600',
    benefits: ['Energy', 'Vitamin C', 'Alertness'],
    bestFor: 'Morning and afternoon pick-me-up'
  }
];

// Tea Types
export const teaTypes: WaterType[] = [
  {
    id: 'green-tea',
    name: 'Green Tea Blends',
    description: 'Catechin-rich teas for metabolism and antioxidants',
    icon: Leaf,
    color: 'text-green-600',
    caffeine: 'Low-Moderate',
    benefits: ['Metabolism', 'Antioxidants', 'Fat Burning'],
    bestFor: 'Morning energy and weight support'
  },
  {
    id: 'herbal',
    name: 'Herbal Infusions',
    description: 'Caffeine-free botanical blends for targeted support',
    icon: Sparkles,
    color: 'text-purple-600',
    caffeine: 'None',
    benefits: ['Caffeine-Free', 'Therapeutic', 'Relaxing'],
    bestFor: 'Evening and sensitive individuals'
  },
  {
    id: 'white-oolong',
    name: 'White & Oolong',
    description: 'Delicate oxidation for highest antioxidant content',
    icon: Droplets,
    color: 'text-blue-600',
    caffeine: 'Very Low-Moderate',
    benefits: ['Highest Antioxidants', 'Gentle', 'Complex'],
    bestFor: 'All-day sipping and anti-aging'
  },
  {
    id: 'spiced',
    name: 'Spiced Detox',
    description: 'Warming spices for circulation and digestion',
    icon: Flame,
    color: 'text-orange-600',
    caffeine: 'Varies',
    benefits: ['Warming', 'Digestive', 'Circulation'],
    bestFor: 'Cold weather and after meals'
  }
];

// Detox Types
export const detoxTypes: DetoxType[] = [
  {
    id: 'deep-cleanse',
    name: 'Deep Cleanse',
    description: 'Intensive detoxification and system reset',
    icon: Flame,
    color: 'text-orange-600',
    intensity: 'Intense',
    duration: '1-3 Days',
    benefits: ['Full System Reset', 'Liver Support', 'Alkalizing']
  },
  {
    id: 'gentle-detox',
    name: 'Gentle Detox',
    description: 'Mild cleansing for daily wellness',
    icon: Leaf,
    color: 'text-green-600',
    intensity: 'Gentle',
    duration: 'Daily',
    benefits: ['Maintenance', 'Hydration', 'Nutrition']
  },
  {
    id: 'targeted',
    name: 'Targeted Support',
    description: 'Specific organ or system focus',
    icon: Target,
    color: 'text-blue-600',
    intensity: 'Moderate',
    duration: '1-5 Days',
    benefits: ['Organ Support', 'Specific Goals', 'Therapeutic']
  },
  {
    id: 'metabolic',
    name: 'Metabolic Boost',
    description: 'Enhance metabolism and energy',
    icon: Zap,
    color: 'text-yellow-600',
    intensity: 'Moderate',
    duration: '1-7 Days',
    benefits: ['Metabolism', 'Energy', 'Weight Support']
  }
];
