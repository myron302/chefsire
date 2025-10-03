// client/src/pages/drinks/types/protein.ts
import { LucideIcon } from 'lucide-react';

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  iron?: number;
  bcaa?: number;
  omega3?: number;
  magnesium?: number;
  vitamin_c?: number;
  biotin?: number;
  calcium?: number;
  potassium?: number;
  vitamin_e?: number;
  folate?: number;
  vitamin_k?: number;
  [key: string]: string | number | undefined;
}

export interface ProteinRecipe {
  id: string;
  name: string;
  description: string;
  image?: string;
  ingredients: string[];
  benefits: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  prepTime: number;
  rating: number;
  reviews: number;
  trending: boolean;
  featured: boolean;
  estimatedCost?: number;
  price?: number;
  bestTime: string;
  fitnessGoal: string;
  nutrition: NutritionInfo;
  allergens: string[];
  // Protein-specific properties
  primaryProtein: string;
  proteinSources: string[];
  proteinType: string;
  flavor: string;
  servingSize: string;
  naturalProtein?: boolean;
  absorption?: string;
  bioavailability?: number;
  leucineContent?: number;
  collagenTypes?: string[];
  source?: string;
  certifications?: string[];
  sustainability?: string;
  allergenFree?: string[];
  wheyType?: string;
  absorptionTime?: string;
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

export interface ProteinSubcategory {
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

export interface ProteinSource {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  proteinPer100g: number;
  benefits: string[];
  bestFor: string;
  cost: string;
  allergens: string[];
}

export interface ProteinType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  benefits: string[];
  digestibility: number;
  sustainability: string;
  commonUses: string[];
}

export interface FitnessGoal {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  recommendedIntake: string;
  timing: string;
}

export interface CollagenType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  benefits: string[];
  sources: string[];
  percentage: string;
  primaryUse: string;
}

export interface CollagenSource {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bioavailability: string;
  absorption: string;
  benefits: string[];
  bestFor: string;
}

export interface BeautyGoal {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  recommendedTypes: string[];
  recommendedDosage: string;
  timeline: string;
}

export interface WheyType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  absorptionTime: string;
  proteinContent: string;
  bestFor: string;
}
