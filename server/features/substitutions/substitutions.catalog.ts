// server/features/substitutions/substitutions.catalog.ts
export type Nutrition = {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
};

export type SubstitutionItem = {
  substituteIngredient: string;
  ratio: string;
  category?: string;
  notes?: string;
  nutrition?: {
    original: Nutrition;
    substitute: Nutrition;
  };
};

export type CatalogEntry = {
  originalIngredient: string;
  synonyms?: string[];
  category?: string;
  substitutions: SubstitutionItem[];
};

export const SUBSTITUTIONS_CATALOG: CatalogEntry[] = [
  {
    originalIngredient: "butter",
    synonyms: ["unsalted butter", "salted butter"],
    category: "dairy",
    substitutions: [
      {
        substituteIngredient: "margarine",
        ratio: "1:1",
        notes: "Similar fat content; slightly different flavor.",
        nutrition: {
          original: { calories: 102, fat: 11.5, carbs: 0, protein: 0.1 },
          substitute: { calories: 100, fat: 11, carbs: 0, protein: 0.1 },
        },
      },
      {
        substituteIngredient: "coconut oil",
        ratio: "1:1",
        notes: "Adds mild coconut aroma; solid at room temp.",
        nutrition: {
          original: { calories: 102, fat: 11.5, carbs: 0, protein: 0.1 },
          substitute: { calories: 117, fat: 13.6, carbs: 0, protein: 0 },
        },
      },
      {
        substituteIngredient: "olive oil",
        ratio: "1:0.75",
        notes: "Use ~25% less by volume (oil is 100% fat).",
        nutrition: {
          original: { calories: 102, fat: 11.5, carbs: 0, protein: 0.1 },
          substitute: { calories: 119, fat: 13.5, carbs: 0, protein: 0 },
        },
      },
      {
        substituteIngredient: "applesauce (unsweetened)",
        ratio: "1:1 (baking)",
        notes: "Cuts fat; crumb becomes more cakey/moist.",
        nutrition: {
          original: { calories: 102, fat: 11.5, carbs: 0, protein: 0.1 },
          substitute: { calories: 68, fat: 0.2, carbs: 18, protein: 0.2 },
        },
      },
    ],
  },
  {
    originalIngredient: "eggs",
    synonyms: ["egg"],
    category: "baking",
    substitutions: [
      {
        substituteIngredient: "ground flax + water",
        ratio: "1 Tbsp flax + 3 Tbsp water = 1 egg",
        notes: "Mix & rest 5 min. Good binder in bakes.",
        nutrition: {
          original: { calories: 72, fat: 4.8, carbs: 0.4, protein: 6.3 },
          substitute: { calories: 55, fat: 4.3, carbs: 3, protein: 1.9 },
        },
      },
      {
        substituteIngredient: "unsweetened applesauce",
        ratio: "1/4 cup = 1 egg",
        notes: "Adds moisture; alters texture.",
        nutrition: {
          original: { calories: 72, fat: 4.8, carbs: 0.4, protein: 6.3 },
          substitute: { calories: 25, fat: 0.1, carbs: 7, protein: 0.1 },
        },
      },
      {
        substituteIngredient: "silken tofu (blended)",
        ratio: "1/4 cup = 1 egg",
        notes: "Neutral binder; good in dense bakes.",
        nutrition: {
          original: { calories: 72, fat: 4.8, carbs: 0.4, protein: 6.3 },
          substitute: { calories: 43, fat: 2.4, carbs: 1.2, protein: 4.8 },
        },
      },
    ],
  },
  {
    originalIngredient: "milk",
    synonyms: ["whole milk", "2% milk", "dairy milk"],
    category: "dairy",
    substitutions: [
      {
        substituteIngredient: "oat milk (unsweetened)",
        ratio: "1:1",
        notes: "Slightly sweeter; good all-purpose swap.",
        nutrition: {
          original: { calories: 103, fat: 2.4, carbs: 12, protein: 8 },
          substitute: { calories: 90, fat: 1.5, carbs: 16, protein: 2 },
        },
      },
      {
        substituteIngredient: "almond milk (unsweetened)",
        ratio: "1:1",
        notes: "Very light; not ideal for reductions.",
        nutrition: {
          original: { calories: 103, fat: 2.4, carbs: 12, protein: 8 },
          substitute: { calories: 30, fat: 2.5, carbs: 1, protein: 1 },
        },
      },
    ],
  },
  {
    originalIngredient: "heavy cream",
    synonyms: ["whipping cream"],
    category: "dairy",
    substitutions: [
      {
        substituteIngredient: "evaporated milk",
        ratio: "1:1",
        notes: "Great in sauces/soups; won’t whip.",
        nutrition: {
          original: { calories: 408, fat: 43, carbs: 3, protein: 3 }, // per 1/2 cup
          substitute: { calories: 170, fat: 10, carbs: 12, protein: 8 },
        },
      },
      {
        substituteIngredient: "whole milk + butter",
        ratio: "3/4 cup milk + 1/4 cup butter = 1 cup cream",
        notes: "OK for cooking; not for whipping.",
      },
    ],
  },
  {
    originalIngredient: "sour cream",
    category: "dairy",
    substitutions: [
      {
        substituteIngredient: "plain Greek yogurt",
        ratio: "1:1",
        notes: "Tangy, higher protein; great cold or in bakes.",
        nutrition: {
          original: { calories: 240, fat: 24, carbs: 6, protein: 3 }, // 1/2 cup
          substitute: { calories: 80, fat: 2, carbs: 4, protein: 14 },
        },
      },
    ],
  },
  {
    originalIngredient: "sugar",
    synonyms: ["granulated sugar", "white sugar"],
    category: "sweeteners",
    substitutions: [
      {
        substituteIngredient: "honey",
        ratio: "1 cup sugar = 3/4 cup honey (reduce liquid 1/4 cup)",
        notes: "Adds moisture; browns faster.",
        nutrition: {
          original: { calories: 774, fat: 0, carbs: 200, protein: 0 }, // 1 cup
          substitute: { calories: 515, fat: 0, carbs: 139, protein: 0 }, // 3/4 cup
        },
      },
      {
        substituteIngredient: "maple syrup",
        ratio: "1 cup sugar = 3/4 cup syrup (reduce liquid 3 Tbsp)",
        notes: "Distinct maple flavor.",
      },
    ],
  },
  {
    originalIngredient: "vegetable oil",
    synonyms: ["canola oil", "neutral oil"],
    category: "oils",
    substitutions: [
      {
        substituteIngredient: "olive oil",
        ratio: "1:1",
        notes: "Adds flavor; fine for sautéing and many bakes.",
        nutrition: {
          original: { calories: 119, fat: 13.5, carbs: 0, protein: 0 }, // per Tbsp
          substitute: { calories: 119, fat: 13.5, carbs: 0, protein: 0 },
        },
      },
      {
        substituteIngredient: "melted butter",
        ratio: "1:1",
        notes: "Dairy flavor; different smoke point.",
      },
      {
        substituteIngredient: "applesauce (unsweetened)",
        ratio: "1:1 (baking)",
        notes: "Cuts fat/calories; changes texture.",
      },
    ],
  },
];

export const ALL_INGREDIENT_KEYS: string[] = Array.from(
  new Set(
    SUBSTITUTIONS_CATALOG.flatMap((c) => [
      c.originalIngredient,
      ...(c.synonyms || []),
    ]).map((s) => s.toLowerCase())
  )
);
