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
  } catch (err) {
    // On any AI error, fall back to static examples so the endpoint never 500s
    const f = FALLBACK[ingredient.toLowerCase()];
    return f ? f : [];
  }
}
