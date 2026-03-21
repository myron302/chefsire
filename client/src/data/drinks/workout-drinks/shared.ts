export type Measured = { amount: number | string; unit: string; item: string; note?: string };

export const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({
  amount,
  unit,
  item,
  note,
});

export type WorkoutDrinkRecipe = {
  id: string;
  name: string;
  description: string;
  image?: string;
  nutrition: { calories?: number; protein?: number; carbs?: number; fat?: number };
  difficulty: 'Easy' | 'Medium' | 'Hard';
  prepTime: number;
  rating: number;
  reviews: number;
  trending?: boolean;
  featured?: boolean;
  tags: string[];
  bestTime: string;
  goal: string;
  ingredients: string[];
  recipe: { servings: number; measurements: Measured[]; directions: string[] };
  [key: string]: any;
};
