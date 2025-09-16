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

export async function fetchSpoonacularSubstitutions(ingredient: string): Promise<SpoonacularSubstitution[]> {
  if (!SPOON_KEY) {
    console.warn("No Spoonacular API key found");
    return [];
  }

  try {
    const encodedIngredient = encodeURIComponent(ingredient);
    const url = `https://api.spoonacular.com/food/ingredients/substitutes?ingredientName=${encodedIngredient}&apiKey=${SPOON_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Spoonacular API error: ${response.status} ${response.statusText}`);
      return [];
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
    return [];
  }
}

export async function searchSpoonacularIngredients(query: string): Promise<string[]> {
  if (!SPOON_KEY) {
    console.warn("No Spoonacular API key found");
    return [];
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