import OpenAI from "openai";

type Nutrition = { calories: number; fat: number; carbs: number; protein: number };

export type AISubItem = {
  substituteIngredient: string;
  ratio: string;
  category?: string;
  notes?: string;
  nutrition?: { original: Nutrition; substitute: Nutrition };
};

export type AISubOptions = {
  cuisine?: string;
  dietaryRestrictions?: string[];
};

const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Simple, curated fallbacks so the feature still works without a key
function mockSubs(ingredient: string): AISubItem[] {
  const lower = ingredient.toLowerCase();
  if (lower.includes("butter")) {
    return [
      {
        substituteIngredient: "Margarine",
        ratio: "1:1",
        category: "dairy",
        notes: "Closest texture; watch saltiness.",
        nutrition: {
          original: { calories: 102, fat: 12, carbs: 0, protein: 0 },
          substitute: { calories: 100, fat: 11, carbs: 0, protein: 0 },
        },
      },
      {
        substituteIngredient: "Olive oil",
        ratio: "3:4 (oil:butter)",
        category: "oils",
        notes: "Good for sautéing; not ideal for laminated doughs.",
        nutrition: {
          original: { calories: 102, fat: 12, carbs: 0, protein: 0 },
          substitute: { calories: 90, fat: 10, carbs: 0, protein: 0 },
        },
      },
      {
        substituteIngredient: "Applesauce (unsweetened)",
        ratio: "1:1 in baking",
        category: "sweeteners",
        notes: "Reduces fat; expect moister crumb.",
        nutrition: {
          original: { calories: 102, fat: 12, carbs: 0, protein: 0 },
          substitute: { calories: 25, fat: 0, carbs: 7, protein: 0 },
        },
      },
    ];
  }
  if (lower.includes("egg")) {
    return [
      {
        substituteIngredient: "Flax egg (1 Tbsp ground flax + 3 Tbsp water)",
        ratio: "1:1 per egg",
        category: "baking",
        notes: "Great binder for quick breads and cookies (vegan).",
        nutrition: {
          original: { calories: 72, fat: 5, carbs: 0, protein: 6 },
          substitute: { calories: 37, fat: 3, carbs: 2, protein: 1 },
        },
      },
      {
        substituteIngredient: "Unsweetened yogurt",
        ratio: "1/4 cup per egg (baking)",
        notes: "Adds moisture; not a binder for airy cakes.",
      },
    ];
  }
  return [
    {
      substituteIngredient: "Coconut oil",
      ratio: "1:1",
      category: "oils",
      notes: "Solid at room temp; similar melt to butter in some bakes.",
    },
  ];
}

export async function aiSuggestSubstitutions(
  ingredient: string,
  opts: AISubOptions = {}
): Promise<AISubItem[]> {
  // If there’s no key, return mock suggestions so the UI works in development/demo
  if (!OPENAI_KEY) {
    return mockSubs(ingredient);
  }

  try {
    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const sys = `You are a culinary expert. Given an ingredient, suggest 2-5 practical substitutions with ratios, short notes, category, and rough nutrition deltas. Return JSON only.`;
    const user = JSON.stringify({
      ingredient,
      cuisine: opts.cuisine ?? null,
      dietaryRestrictions: opts.dietaryRestrictions ?? [],
      format: {
        subs: [
          {
            substituteIngredient: "string",
            ratio: "string (like '1:1' or '3:4 oil:butter')",
            category: "string?",
            notes: "string?",
            nutrition: {
              original: { calories: 0, fat: 0, carbs: 0, protein: 0 },
              substitute: { calories: 0, fat: 0, carbs: 0, protein: 0 },
            },
          },
        ],
      },
    });

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });

    const text = resp.choices?.[0]?.message?.content?.trim() || "";
    // Try to extract JSON
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return mockSubs(ingredient);
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const items: AISubItem[] =
      parsed.subs ||
      parsed.substitutions ||
      parsed.items ||
      mockSubs(ingredient);

    // Light normalization
    return items
      .map((x) => ({
        substituteIngredient: x.substituteIngredient || x.name || "Substitute",
        ratio: x.ratio || "1:1",
        category: x.category,
        notes: x.notes,
        nutrition: x.nutrition,
      }))
      .slice(0, 5);
  } catch (e) {
    console.error("OpenAI error:", e);
    return mockSubs(ingredient);
  }
}
