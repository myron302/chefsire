// server/services/ingredients-ai.ts
import OpenAI from "openai";
import { z } from "zod";

/** ─────────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────────*/
export type Nutrition = {
  calories: number; // total calories for the amount implied by `ratio`
  fat: number;      // grams
  carbs: number;    // grams
  protein: number;  // grams
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

/** Zod schema to validate/clean AI output */
const NutritionSchema = z.object({
  calories: z.number().finite(),
  fat: z.number().finite(),
  carbs: z.number().finite(),
  protein: z.number().finite(),
});

const AISubItemSchema = z.object({
  substituteIngredient: z.string().min(1),
  ratio: z.string().min(1),
  category: z.string().optional(),
  notes: z.string().optional(),
  nutrition: z
    .object({
      original: NutritionSchema,
      substitute: NutritionSchema,
    })
    .optional(),
});

const AIResponseSchema = z.object({
  query: z.string(),
  substitutions: z.array(AISubItemSchema).min(1).max(6),
});

/** Small helper for deduping by ingredient name */
function norm(s: string) {
  return s.trim().toLowerCase();
}

/** ─────────────────────────────────────────────────────────────────────────────
 * Static fallbacks when OPENAI_API_KEY is missing or AI fails
 * ────────────────────────────────────────────────────────────────────────────*/
const STATIC_FALLBACK: Record<string, AISubItem[]> = {
  butter: [
    {
      substituteIngredient: "Olive oil",
      ratio: "¾ cup oil = 1 cup butter",
      category: "oils",
      notes:
        "Great for sautéing and some baking; flavor changes slightly. For cookies, chill dough.",
      nutrition: {
        original: { calories: 1628, fat: 184, carbs: 1, protein: 2 }, // ~1 cup butter
        substitute: { calories: 1910, fat: 216, carbs: 0, protein: 0 }, // ~¾ cup oil
      },
    },
    {
      substituteIngredient: "Unsweetened applesauce",
      ratio: "½ cup applesauce = 1 cup butter (cakes/muffins)",
      category: "baking",
      notes: "Reduces fat and calories; texture more moist/denser. Cut other liquids slightly.",
      nutrition: {
        original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
        substitute: { calories: 100, fat: 0, carbs: 27, protein: 0 },
      },
    },
    {
      substituteIngredient: "Coconut oil",
      ratio: "1:1 by volume",
      category: "oils",
      notes: "Adds coconut aroma; similar solidity at room temp helps structure.",
      nutrition: {
        original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
        substitute: { calories: 1879, fat: 218, carbs: 0, protein: 0 },
      },
    },
  ],
  eggs: [
    {
      substituteIngredient: "Ground flax + water",
      ratio: "1 Tbsp ground flax + 3 Tbsp water = 1 egg",
      category: "vegan",
      notes: "Let sit 5–10 min to gel; good binder for quick breads, cookies, pancakes.",
      nutrition: {
        original: { calories: 72, fat: 5, carbs: 0.4, protein: 6 },
        substitute: { calories: 55, fat: 4.3, carbs: 3, protein: 1.9 },
      },
    },
    {
      substituteIngredient: "Unsweetened applesauce",
      ratio: "¼ cup applesauce = 1 egg (in cakes/muffins)",
      category: "baking",
      notes: "Adds moisture; not suitable for airy foams/meringues.",
      nutrition: {
        original: { calories: 72, fat: 5, carbs: 0.4, protein: 6 },
        substitute: { calories: 25, fat: 0, carbs: 7, protein: 0 },
      },
    },
  ],
};

/** ─────────────────────────────────────────────────────────────────────────────
 * Main entry used by your routes
 * Keep the existing signature so you don't have to change your server routes.
 * Returns: { query, substitutions }
 * ────────────────────────────────────────────────────────────────────────────*/
export async function suggestSubstitutionsAI(query: string) {
  const trimmed = (query ?? "").trim();
  if (!trimmed) {
    return { query: "", substitutions: [] as AISubItem[] };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fallback = STATIC_FALLBACK[norm(trimmed)] ?? [];
    return { query: trimmed, substitutions: fallback };
  }

  const client = new OpenAI({ apiKey });

  // You can tune these as needed:
  const MODEL = "gpt-4o-mini";
  const TEMPERATURE = 0.3;

  const system = `
You are a concise culinary expert. Given an ingredient, return smart substitutions with exact swap ratios and one or two practical cooking notes.
Dietary tags (vegan, gluten-free, kosher, halal) should influence choices when obvious.
Return JSON only, no prose. Keep items high quality and relevant to the ingredient. Prefer 3–5 items.
Include rough nutrition comparison per the amount implied by the ratio (calories total, grams of fat/carbs/protein).
`;

  // We force a JSON object, then validate with Zod.
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      response_format: { type: "json_object" }, // force a parsable JSON object
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            ingredient: trimmed,
            // Future: pass cuisine/dietary here if your route collects them
          }),
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    // Parse JSON and validate/clean it
    const parsed = AIResponseSchema.safeParse(JSON.parse(content));

    if (!parsed.success) {
      // If AI returns unexpected shape, fall back gracefully
      const fallback = STATIC_FALLBACK[norm(trimmed)] ?? [];
      return { query: trimmed, substitutions: fallback };
    }

    // Dedup by substituteIngredient (case-insensitive), keep stable order
    const seen = new Set<string>();
    const deduped = parsed.data.substitutions.filter((s) => {
      const k = norm(s.substituteIngredient);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return { query: parsed.data.query || trimmed, substitutions: deduped.slice(0, 6) };
  } catch (err) {
    // Any AI/network error -> serve static suggestions if we have them
    const fallback = STATIC_FALLBACK[norm(trimmed)] ?? [];
    return { query: trimmed, substitutions: fallback };
  }
}
