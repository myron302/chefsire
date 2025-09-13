// server/services/ingredients-ai.ts
import type { ClientOptions } from "openai";

// NOTE: We only import 'openai' if an API key is present so build won't fail.
let OpenAICtor: any = null;
if (process.env.OPENAI_API_KEY) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    OpenAICtor = (await import("openai")).default;
  } catch (_err) {
    OpenAICtor = null;
  }
}

export type Nutrition = {
  calories: number;
  fat: number;     // grams
  carbs: number;   // grams
  protein: number; // grams
};

export type AISubItem = {
  substituteIngredient: string;
  ratio: string;
  category?: string;
  notes?: string;
  nutrition?: {
    original: Nutrition;
    substitute: Nutrition;
  };
};

export async function suggestSubstitutionsAI(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: "", substitutions: [] as AISubItem[] };
  }

  // Fallback if no key or OpenAI not available
  if (!process.env.OPENAI_API_KEY || !OpenAICtor) {
    // Simple canned ideas + nutrition deltas
    const samples: Record<string, AISubItem[]> = {
      butter: [
        {
          substituteIngredient: "Olive oil",
          ratio: "¾ cup olive oil = 1 cup butter",
          category: "oils",
          notes: "Good for sautéing and some baking; expect different flavor and texture.",
          nutrition: {
            original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },     // 1 cup butter (approx)
            substitute: { calories: 1910, fat: 216, carbs: 0, protein: 0 },   // 1 cup olive oil (approx)
          },
        },
        {
          substituteIngredient: "Coconut oil",
          ratio: "1:1 by volume",
          category: "oils",
          notes: "Adds coconut aroma; solid at room temp similar to butter texture.",
          nutrition: {
            original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
            substitute: { calories: 1879, fat: 218, carbs: 0, protein: 0 },
          },
        },
        {
          substituteIngredient: "Applesauce (unsweetened)",
          ratio: "½ cup applesauce = 1 cup butter (in cakes/muffins)",
          category: "baking",
          notes: "Cuts fat & calories; use in moist cakes/muffins; texture changes.",
          nutrition: {
            original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
            substitute: { calories: 100, fat: 0, carbs: 27, protein: 0 }, // ~½ cup applesauce
          },
        },
      ],
      eggs: [
        {
          substituteIngredient: "Ground flax + water",
          ratio: "1 Tbsp ground flax + 3 Tbsp water = 1 egg",
          category: "baking",
          notes: "Let gel 5–10 min; best for quick breads/muffins/cookies.",
          nutrition: {
            original: { calories: 72, fat: 5, carbs: 0.4, protein: 6 },
            substitute: { calories: 55, fat: 4.3, carbs: 3, protein: 1.9 },
          },
        },
      ],
    };
    return { query: trimmed, substitutions: samples[trimmed.toLowerCase()] ?? [] };
  }

  // With OpenAI
  const client = new OpenAICtor({
    apiKey: process.env.OPENAI_API_KEY,
  } as ClientOptions);

  const prompt = `
You are a culinary assistant. The user needs an ingredient substitution for: "${trimmed}".

Return a short JSON array called "substitutions". Each item must have:
- substituteIngredient (string),
- ratio (string),
- category (string, e.g. "baking", "dairy", "oils"),
- notes (string, practical cooking tips),
- nutrition (object with original and substitute objects of { calories, fat, carbs, protein } numeric grams, calories total per typical amount used in substitution ratio).

Keep it brief (3–5 best options).
Return only valid JSON with keys: { "query": string, "substitutions": AISubItem[] }.
`;

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  const text = resp.choices?.[0]?.message?.content?.trim() || "";
  // Try parsing JSON, fallback to empty
  try {
    const parsed = JSON.parse(text);
    // basic safety
    if (parsed && Array.isArray(parsed.substitutions)) {
      return {
        query: parsed.query || trimmed,
        substitutions: parsed.substitutions as AISubItem[],
      };
    }
  } catch (_err) {
    // ignore
  }

  // Final fallback
  return { query: trimmed, substitutions: [] as AISubItem[] };
}
