// client/src/types/detox.ts
import { LucideIcon } from 'lucide-react';

export interface NutritionInfo {
  calories: number;
  sugar?: number;
  carbs?: number;
  fiber?: number;
  caffeine?: number;
  vitamin_c?: number;
  vitamin_a?: number;
  electrolytes?: string;
  antioxidants?: string;
  chlorophyll?: string;
  thermogenic?: string;
  [key: string]: string | number | undefined;
}

export interface DetoxRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  benefits: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  prepTime: number;
  rating: number;
  reviews: number;
  trending: boolean;
  featured: boolean;
  estimatedCost: number;
  bestTime: string;
  duration: string;
  allergens: string[];
  nutrition: NutritionInfo;
  // Type-specific properties
  waterType?: string;
  flavorProfile?: string;
  infusionTime?: string;
  temperature?: string;
  teaType?: string;
  detoxFocus?: string;
  brewTemp?: string;
  steepTime?: string;
  detoxType?: string;
  detoxLevel?: string;
  servingSize?: string;
  category?: string;
}

export interface DrinkCategory {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  route: string;
  color: string;
  count: string;
}

export interface DetoxSubcategory {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  image?: string;
  path: string;
  count: number;
  bgColor: string;
  borderColor: string;
  textColor: string;
  trending?: boolean;
  featured?: boolean;
  avgCalories: number;
  duration: string;
  topBenefit: string;
}

export interface WaterType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  benefits: string[];
  bestFor: string;
  caffeine?: string;
}

export interface DetoxType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  intensity: string;
  duration: string;
  benefits: string[];
}
