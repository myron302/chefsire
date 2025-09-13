// server/features/substitutions/substitutions.catalog.ts
// A small, well-typed seed catalog you can expand anytime.

export type Nutrition = {
  calories: number;
  fat: number;     // grams
  carbs: number;   // grams
  protein: number; // grams
};

export type SubstitutionItem = {
  substituteIngredient: string;
  ratio: string; // e.g. "1:1", "1 Tbsp : 1 Tbsp + 1 tsp water"
  category?: string;
  notes?: string;
  nutrition?: {
    original: Nutrition;
    substitute: Nutrition;
  };
};

export type CatalogEntry = {
  originalIngredient: string;
  synonyms?: string[]; // helps search (e.g. "granulated sugar" => "sugar")
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
        notes: "Similar fat content. Taste/texture slightly different.",
        nutrition: {
          original: { calories: 102, fat: 11.5, carbs: 0, protein: 0.1 },
          substitute: { calories: 100, fat: 11, carbs: 0, protein: 0.1 },
        },
      },
      {
        substituteIngredient: "coconut oil",
        ratio: "1:1",
        notes: "Solid at room temp; adds slight coconut flavor.",
        nutrition: {
          original: { calories: 102, fat: 11.5, carbs: 0, protein: 0.1 },
          substitute: { calories: 117, fat: 13.6, carbs: 0, protein: 0 },
        },
      },
      {
        substituteIngredient: "olive oil",
        ratio: "1:0.75",
        notes: "Use 3/4 the volume (oil is 100% fat). Good for sautéing, less ideal for flaky baking.",
        nutrition: {
          original: { calories: 102, fat: 11.5, carbs: 0, protein: 0.1 },
          substitute: { calories: 119, fat: 13.5, carbs: 0, protein: 0 },
        },
      },
      {
        substituteIngredient: "applesauce (unsweetened)",
        ratio: "1:1 (for baking portions only)",
        notes: "Reduces fat and calories; changes texture to more moist/cakey.",
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
        notes: "Mix and rest 5 min. Good binder for baked goods.",
        nutrition: {
          original: { calories: 72, fat: 4.8, carbs: 0.4, protein: 6.3 },
          substitute: { calories: 55, fat: 4.3, carbs: 3, protein: 1.9 },
        },
      },
      {
        substituteIngredient: "unsweetened applesauce",
        ratio: "1/4 cup = 1 egg (in baking)",
        notes: "Adds moisture; may change crumb/texture.",
        nutrition: {
          original: { calories: 72, fat: 4.8, carbs: 0.4, protein: 6.3 },
          substitute: { calories: 25, fat: 0.1, carbs: 7, protein: 0.1 },
        },
      },
      {
        substituteIngredient: "silken tofu (blended)",
        ratio: "1/4 cup = 1 egg",
        notes: "Neutral taste; good binding in dense bakes.",
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
        notes: "Good general replacement; slightly sweeter.",
        nutrition: {
          original: { calories: 103, fat: 2.4, carbs: 12, protein: 8 },
          substitute: { calories: 90, fat: 1.5, carbs: 16, protein: 2 },
        },
      },
      {
        substituteIngredient: "almond milk (unsweetened)",
        ratio: "1:1",
        notes: "Lighter body; not great for heavy cream reductions.",
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
        notes: "Good in sauces/soups; not for whipping.",
        nutrition: {
          original: { calories: 408, fat: 43, carbs: 3, protein: 3 }, // per 1/2 cup
          substitute: { calories: 170, fat: 10, carbs: 12, protein: 8 },
        },
      },
      {
        substituteIngredient: "whole milk + butter",
        ratio: "3/4 cup milk + 1/4 cup butter = 1 cup cream",
        notes: "Okay in cooking; won’t whip.",
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
        notes: "Tangy with higher protein; great cold or in baking.",
        nutrition: {
          original: { calories: 240, fat: 24, carbs: 6, protein: 3 }, // per 1/2 cup
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
        notes: "Adds moisture and flavor; browns faster.",
        nutrition: {
          original: { calories: 774, fat: 0, carbs: 200, protein: 0 }, // 1 cup sugar
          substitute: { calories: 515, fat: 0, carbs: 139, protein: 0 }, // 3/4 cup honey
        },
      },
      {
        substituteIngredient: "maple syrup",
        ratio: "1 cup sugar = 3/4 cup syrup (reduce liquid 3 Tbsp)",
        notes: "Distinct flavor; moisture increase.",
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
        notes: "Adds dairy flavor; different melting/smoke point.",
      },
      {
        substituteIngredient: "applesauce (unsweetened)",
        ratio: "1:1 (in baking portions)",
        notes: "Cuts fat/calories; changes texture.",
      },
    ],
  },
];

// Lightweight search index (build once)
export const ALL_INGREDIENT_KEYS: string[] = Array.from(
  new Set(
    SUBSTITUTIONS_CATALOG.flatMap((c) => [
      c.originalIngredient,
      ...(c.synonyms || []),
    ]).map((s) => s.toLowerCase())
  )
);
