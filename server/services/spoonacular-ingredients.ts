// server/services/spoonacular-ingredients.ts
export type SpoonacularSubstitution = {
  substituteIngredient: string;
  ratio: string;
  category?: string;
  notes?: string;
  nutrition?: {
    original: {
      calories: number;
      fat: number;
      carbs: number;
      protein: number;
    };
    substitute: {
      calories: number;
      fat: number;
      carbs: number; 
      protein: number;
    };
  };
};

const SPOON_KEY = process.env.SPOONACULAR_API_KEY || "";

// Fallback data for demonstration when API key is not available
const FALLBACK_SUBSTITUTIONS: Record<string, SpoonacularSubstitution[]> = {
  "butter": [
    {
      substituteIngredient: "Olive Oil",
      ratio: "3/4 cup olive oil for 1 cup butter",
      category: "oils",
      notes: "Best for sautéing and baking, adds a mild fruity flavor.",
      nutrition: {
        original: { calories: 102, fat: 12, carbs: 0, protein: 0 },
        substitute: { calories: 119, fat: 14, carbs: 0, protein: 0 }
      }
    },
    {
      substituteIngredient: "Coconut Oil",
      ratio: "1 cup coconut oil for 1 cup butter",
      category: "oils",
      notes: "Solid at room temperature, adds a light coconut flavor."
    }
  ],
  "eggs": [
    {
      substituteIngredient: "Applesauce",
      ratio: "1/4 cup applesauce for 1 egg",
      category: "binding",
      notes: "Works well in baking, adds moisture but may make results denser."
    },
    {
      substituteIngredient: "Flax Egg",
      ratio: "1 tbsp ground flax + 3 tbsp water for 1 egg",
      category: "binding",
      notes: "Mix and let sit for 5 minutes. Great vegan alternative."
    }
  ],
  "milk": [
    {
      substituteIngredient: "Almond Milk",
      ratio: "1 cup almond milk for 1 cup milk",
      category: "dairy-free",
      notes: "Lower in calories and protein. Choose unsweetened for cooking."
    },
    {
      substituteIngredient: "Oat Milk",
      ratio: "1 cup oat milk for 1 cup milk",
      category: "dairy-free",
      notes: "Creamy texture, works well in coffee and baking."
    }
  ]
};

export async function fetchSpoonacularSubstitutions(ingredient: string): Promise<SpoonacularSubstitution[]> {
  if (!SPOON_KEY) {
    console.warn("No Spoonacular API key found, using fallback data");
    const normalizedIngredient = ingredient.toLowerCase().trim();
    return FALLBACK_SUBSTITUTIONS[normalizedIngredient] || [];
  }

  try {
    const encodedIngredient = encodeURIComponent(ingredient);
    const url = `https://api.spoonacular.com/food/ingredients/substitutes?ingredientName=${encodedIngredient}&apiKey=${SPOON_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Spoonacular API error: ${response.status} ${response.statusText}`);
      // Fall back to demo data on API error
      const normalizedIngredient = ingredient.toLowerCase().trim();
      return FALLBACK_SUBSTITUTIONS[normalizedIngredient] || [];
    }

    const data = await response.json();
    
    // Handle Spoonacular API response format
    if (!data.substitutes || !Array.isArray(data.substitutes)) {
      console.warn(`No substitutes found for ${ingredient}`);
      return [];
    }

    return data.substitutes.map((sub: any) => ({
      substituteIngredient: sub.name || sub,
      ratio: "1:1", // Spoonacular doesn't always provide ratios, default to 1:1
      category: "general", // Can be enhanced later with ingredient classification
      notes: `Substitute for ${ingredient}`,
      // Nutrition data would need separate API calls for detailed info
      nutrition: undefined
    }));

  } catch (error) {
    console.error("Error fetching Spoonacular substitutions:", error);
    // Fall back to demo data on error
    const normalizedIngredient = ingredient.toLowerCase().trim();
    return FALLBACK_SUBSTITUTIONS[normalizedIngredient] || [];
  }
}

export async function searchSpoonacularIngredients(query: string): Promise<string[]> {
  if (!SPOON_KEY) {
    console.warn("No Spoonacular API key found, using fallback data");
    // Return common ingredients that match the query
    const commonIngredients = [
      "butter", "eggs", "milk", "flour", "sugar", "salt", "pepper", "onion",
      "garlic", "olive oil", "coconut oil", "vanilla", "baking powder", "baking soda"
    ];
    const normalizedQuery = query.toLowerCase();
    return commonIngredients.filter(ingredient => 
      ingredient.includes(normalizedQuery)
    ).slice(0, 10);
  }

  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.spoonacular.com/food/ingredients/autocomplete?query=${encodedQuery}&number=10&apiKey=${SPOON_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Spoonacular ingredient search error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: any) => item.name).filter(Boolean);

  } catch (error) {
    console.error("Error searching Spoonacular ingredients:", error);
    return [];
  }
}