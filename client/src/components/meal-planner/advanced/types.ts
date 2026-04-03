export interface Recommendation {
  id: string;
  recipe?: any;
  recommendationType: string;
  reason: string;
  score: string;
  targetDate: string;
  mealType: string;
}

export interface Leftover {
  id: string;
  recipeName: string;
  quantity: string;
  storedDate: string;
  expiryDate?: string;
  storageLocation: string;
  consumed: boolean;
}

export interface MealPrepSchedule {
  id: string;
  prepDay: string;
  prepTime?: string;
  batchRecipes: any[];
  shoppingDay?: string;
  completed: boolean;
  reminderEnabled: boolean;
}

// Shape returned by GET /api/achievements
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  unlocked: boolean;
  progress: number;
}

export interface GroceryItem {
  id: string;
  ingredientName: string;
  quantity?: string;
  category?: string;
  estimatedPrice?: string;
  actualPrice?: string;
  purchased: boolean;
  isPantryItem: boolean;
  aisle?: string;
  priority: string;
}

export interface LeftoverFormState {
  recipeName: string;
  quantity: string;
  storageLocation: string;
  expiryDate: string;
}

export interface BudgetSummary {
  estimated: number;
  actual: number;
  difference: number;
}
