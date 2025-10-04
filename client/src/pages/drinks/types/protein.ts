export interface ProteinNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  calcium?: number;
  vitamin_c?: number;
  biotin?: number;
  glucosamine?: number;
  chondroitin?: number;
  omega_3?: number;
  selenium?: number;
  glycine?: number;
  proline?: number;
  lysine?: number;
  silica?: number;
  curcumin?: number;
  resveratrol?: number;
  iron?: number;
  bcaa?: number;
  magnesium?: number;
  potassium?: number;
  vitamin_e?: number;
  beta_glucan?: number;
  caffeine?: number;
  melatonin?: number;
  zinc?: number;
  phosphorus?: number;
  glutamine?: number;
  leucine?: number;
  tryptophan?: number;
  vitamin_b6?: number;
  l_theanine?: number;
}

export interface ProteinShake {
  id: string;
  name: string;
  description: string;
  image?: string;
  proteinType: 'whey' | 'casein' | 'plant' | 'collagen' | 'egg' | 'beef';
  proteinSource: string;
  flavor: string;
  servingSize: string;
  nutrition: ProteinNutrition;
  ingredients: string[];
  benefits: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  prepTime: number;
  rating: number;
  reviews: number;
  trending: boolean;
  featured: boolean;
  price: number;
  bestTime: string;
  fitnessGoal: string;
  
  // Whey-specific properties
  wheyType?: 'Isolate' | 'Concentrate' | 'Hydrolyzed' | 'Whey-Casein Blend';
  absorptionTime?: string;
  leucineContent?: string;
  
  // Casein-specific properties
  caseinType?: 'Micellar Casein' | 'Calcium Caseinate' | 'Hydrolyzed Casein';
  releaseTime?: string;
  absorption?: 'Fast' | 'Slow' | 'Very Slow' | 'Medium';
  mixability?: 'Good' | 'Excellent' | 'Fair';
  texture?: 'Thick' | 'Creamy' | 'Smooth' | 'Rich' | 'Frothy';
  
  // Collagen-specific properties
  collagenTypes?: string[];
  source?: string;
  bioavailability?: number;
  certifications?: string[];
  ageGroup?: string;
  
  // Plant-based specific properties
  allergenFree?: string[];
  sustainability?: string;
  certifications?: string[];
}

export interface ProteinType {
  id: string;
  name: string;
  description: string;
  icon: any; // Lucide icon component
  color: string;
  absorption?: string;
  timing?: string;
  biovalue?: number;
  benefits?: string[];
  releaseTime?: string;
  bestFor?: string;
  digestibility?: number;
  sustainability?: string;
  commonUses?: string[];
  proteinContent?: string;
}

export interface FitnessGoal {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  protein: number;
  carbs: number;
  recommendedIntake?: string;
  timing?: string;
  keyNutrients?: string[];
  recommendedTiming?: string;
}

export interface Supplement {
  id: string;
  name: string;
  amount: string;
  benefit: string;
  timing: string;
}

export interface WorkoutPhase {
  name: string;
  timing: string;
  icon: any;
  color: string;
  focus: string;
  recommendations: string[];
}

export interface PopularRecipe {
  name: string;
  protein: number;
  carbs: number;
  calories: number;
  ingredients: string[];
  rating: number;
  reviews: number;
  goal: string;
}
