// server/services/ai.ts
import OpenAI from "openai";

type Nutrition = { calories: number; fat: number; carbs: number; protein: number };

export type AISubOption = {
  substituteIngredient: string;
  ratio: string;
  category?: string;
  notes?: string;
  nutrition?: {
    original: Nutrition;
    substitute: Nutrition;
  };
};

type SuggestOpts = {
  cuisine?: string;
  dietaryRestrictions?: string[];
};

const FALLBACK: Record<string, AISubOption[]> = {
  butter: [
    {
      substituteIngredient: "Olive oil",
      ratio: "3/4 cup oil = 1 cup butter",
      category: "oils",
      notes: "Best for sautéing and many baked goods; flavor will change slightly.",
      nutrition: {
        original: { calories: 102, fat: 12, carbs: 0, protein: 0 },   // per tbsp
        substitute: { calories: 119, fat: 14, carbs: 0, protein: 0 },
      },
    },
    {
      substituteIngredient: "Unsweetened applesauce",
      ratio: "1:1 in cakes/muffins",
      category: "baking",
      notes: "Keeps bakes moist; reduce other liquids slightly.",
      nutrition: {
        original: { calories: 102, fat: 12, carbs: 0, protein: 0 },
        substitute: { calories: 15, fat: 0, carbs: 4, protein: 0 },
      },
    },
  ],
  eggs: [
    {
      substituteIngredient: "Ground flax + water",
      ratio: "1 tbsp ground flax + 3 tbsp water = 1 egg",
      category: "vegan",
      notes: "Great binder for cookies/muffins; not ideal for airy meringues.",
      nutrition: {
        original: { calories: 72, fat: 5, carbs: 0, protein: 6 },
        substitute: { calories: 37, fat: 3, carbs: 2, protein: 1 },
      },
    },
  ],
};

export async function aiSuggestSubstitutions(
  ingredient: string,
  opts: SuggestOpts
): Promise<AISubOption[]> {
  const key = process.env.OPENAI_API_KEY;

  // If there’s no key, return predictable fallback so the UI still works
  if (!key) {
    const f = FALLBACK[ingredient.toLowerCase()];
    return f ? f : [];
  }

  const client = new OpenAI({ apiKey: key });

  const system = `
You are a culinary assistant. Given an ingredient, propose 2–5 sensible substitutions with:
- substituteIngredient (string)
- ratio (string)
- category (short string)
- notes (1–2 helpful sentences)
- nutrition.original and nutrition.substitute (calories, fat, carbs, protein per common serving)

Return ONLY valid JSON array. Do not add prose. Numbers should be realistic but approximate is fine.
`;

  const user = JSON.stringify({
    ingredient,
    cuisine: opts.cuisine || null,
    dietaryRestrictions: opts.dietaryRestrictions || [],
  });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "[]";
    // Be defensive: sometimes models wrap JSON in code fences
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "");
    const parsed = JSON.parse(cleaned);

    // Validate very lightly
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 6);
  } catch (error) {
    // On any AI error, fall back to static examples so the endpoint never 500s
    const f = FALLBACK[ingredient.toLowerCase()];
    return f ? f : [];
  }
}

export type RecipeModification = {
  modifiedTitle: string;
  modifiedIngredients: Array<{
    original: string;
    modified: string;
    reason?: string;
  }>;
  modifiedInstructions: string[];
  nutritionChanges?: {
    before: Nutrition;
    after: Nutrition;
    description: string;
  };
  notes?: string[];
};

export async function modifyRecipeWithAI(
  recipe: {
    title: string;
    ingredients: string[];
    instructions: string[];
  },
  modificationType: "vegan" | "low-sugar" | "high-protein" | "gluten-free" | "low-carb"
): Promise<RecipeModification> {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    // Return a fallback response when no API key is available
    return {
      modifiedTitle: `${recipe.title} (${modificationType})`,
      modifiedIngredients: recipe.ingredients.map(ing => ({
        original: ing,
        modified: ing,
        reason: "AI modifications unavailable - OpenAI API key not configured"
      })),
      modifiedInstructions: recipe.instructions,
      notes: ["AI recipe modification requires OpenAI API key configuration"]
    };
  }

  const client = new OpenAI({ apiKey: key });

  const modificationPrompts: Record<string, string> = {
    vegan: "Make this recipe completely vegan by replacing all animal products (meat, dairy, eggs, honey) with plant-based alternatives while maintaining taste and texture.",
    "low-sugar": "Reduce the sugar content by at least 50% by using natural sweeteners, reducing portions, or removing unnecessary sugars while maintaining flavor.",
    "high-protein": "Increase the protein content by adding protein-rich ingredients or replacing lower-protein items with high-protein alternatives.",
    "gluten-free": "Make this recipe gluten-free by replacing wheat-based ingredients with gluten-free alternatives.",
    "low-carb": "Reduce carbohydrates by replacing high-carb ingredients with low-carb alternatives while maintaining satisfaction."
  };

  const system = `
You are an expert culinary AI assistant specializing in recipe modifications. Given a recipe and a modification type, provide detailed changes to make the recipe match the requested dietary preference.

Return ONLY valid JSON with this exact structure:
{
  "modifiedTitle": "Updated recipe title",
  "modifiedIngredients": [
    {
      "original": "Original ingredient",
      "modified": "Modified ingredient with measurements",
      "reason": "Brief explanation of why this change works"
    }
  ],
  "modifiedInstructions": ["Step 1...", "Step 2..."],
  "nutritionChanges": {
    "before": {"calories": 0, "fat": 0, "carbs": 0, "protein": 0},
    "after": {"calories": 0, "fat": 0, "carbs": 0, "protein": 0},
    "description": "Brief summary of nutritional improvements"
  },
  "notes": ["Helpful tip 1", "Helpful tip 2"]
}

Be specific with measurements and practical with substitutions.`;

  const user = JSON.stringify({
    recipe,
    modification: modificationType,
    goal: modificationPrompts[modificationType]
  });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "");
    const parsed = JSON.parse(cleaned);

    return parsed as RecipeModification;
  } catch (error) {
    console.error("AI recipe modification error:", error);
    // Fallback response
    return {
      modifiedTitle: `${recipe.title} (${modificationType})`,
      modifiedIngredients: recipe.ingredients.map(ing => ({
        original: ing,
        modified: ing,
        reason: "Unable to modify - AI service unavailable"
      })),
      modifiedInstructions: recipe.instructions,
      notes: ["AI modification temporarily unavailable. Please try again later."]
    };
  }
}
