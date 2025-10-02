export interface SmoothieNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  // ... other nutrition fields
}

export interface BaseSmoothie {
  id: string;
  name: string;
  description: string;
  image?: string;
  nutrition: SmoothieNutrition;
  ingredients: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  prepTime: number;
  rating: number;
  reviews?: number;
  trending?: boolean;
  featured?: boolean;
  estimatedCost?: number;
  bestTime: string;
  category: string;
}

export interface WorkoutSmoothie extends BaseSmoothie {
  workoutType: string;
  energyLevel: string;
  caffeineContent?: string;
  proteinContent?: string;
}

export interface ProteinSmoothie extends BaseSmoothie {
  primaryProtein: string;
  proteinSources: string[];
  naturalProtein: boolean;
  allergens: string[];
}

export interface GreenSmoothie extends BaseSmoothie {
  primaryGreens: string;
  greensContent: string[];
  superfoods: string[];
  fitnessGoal: string;
}

export interface DessertSmoothie extends BaseSmoothie {
  dessertType: string;
  flavorProfile: string;
  guiltFactor: string;
  healthySwaps: string[];
}

export interface BreakfastSmoothie extends BaseSmoothie {
  breakfastType: string;
  energyLevel: string;
  satietyLevel: string;
  energyDuration: string;
  morningBenefits: string[];
}
