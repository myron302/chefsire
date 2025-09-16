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

export type AISuggestOpts = {
  cuisine?: string;
  dietaryRestrictions?: string[];
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
  substitutions: z.array(AISubItemSchema).min(1).max(12),
});

/** Small helper for deduping by ingredient name */
const norm = (s: string) => s.trim().toLowerCase();

/** ─────────────────────────────────────────────────────────────────────────────
 * Static fallbacks when OPENAI_API_KEY is missing or AI fails
 * (ensures the UI still returns something for common ingredients)
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
        // ~1 cup butter vs ¾ cup oil
        original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
        substitute: { calories: 1910, fat: 216, carbs: 0, protein: 0 },
      },
    },
    {
      substituteIngredient: "Unsweetened applesauce",
      ratio: "½ cup applesauce = 1 cup butter (cakes/muffins)",
      category: "baking",
      notes: "Reduces fat and calories; texture more moist/denser. Cut other liquids slightly.",
      nutrition: {
        original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
        substitute: { calories: 100, fat: 0, carbs: 27, protein: 0 }, // ~½ cup
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
      ratio: "¼ cup applesauce = 1 egg (cakes/muffins)",
      category: "baking",
      notes: "Adds moisture; not suitable for airy foams/meringues.",
      nutrition: {
        original: { calories: 72, fat: 5, carbs: 0.4, protein: 6 },
        substitute: { calories: 25, fat: 0, carbs: 7, protein: 0 },
      },
    },
  ],
  milk: [
    {
      substituteIngredient: "Unsweetened almond milk",
      ratio: "1:1 in most recipes",
      category: "plant-based dairy",
      notes: "Neutral, slightly nutty. Low protein; can be thin—add 1–2 tsp oil for richer results.",
      nutrition: {
        // ~1 cup whole milk vs 1 cup unsweetened almond milk
        original: { calories: 149, fat: 8, carbs: 12, protein: 8 },
        substitute: { calories: 40, fat: 3, carbs: 1, protein: 1 },
      },
    },
    {
      substituteIngredient: "Soy milk (unsweetened)",
      ratio: "1:1 in most recipes",
      category: "plant-based dairy",
      notes: "Closest protein content to dairy; good for custards and baking.",
      nutrition: {
        original: { calories: 149, fat: 8, carbs: 12, protein: 8 },
        substitute: { calories: 100, fat: 4, carbs: 5, protein: 7 },
      },
    },
    {
      substituteIngredient: "Oat milk (barista or full-fat)",
      ratio: "1:1 in most recipes",
      category: "plant-based dairy",
      notes: "Creamy; great in coffee and baking. Slightly sweeter; watch added sugar.",
      nutrition: {
        original: { calories: 149, fat: 8, carbs: 12, protein: 8 },
        substitute: { calories: 120, fat: 5, carbs: 16, protein: 3 },
      },
    },
    {
      substituteIngredient: "Half water + half heavy cream",
      ratio: "½ cup water + ½ cup cream = 1 cup milk",
      category: "dairy",
      notes: "Good emergency swap if only cream on hand; richer than milk.",
      nutrition: {
        original: { calories: 149, fat: 8, carbs: 12, protein: 8 },
        substitute: { calories: 205, fat: 22, carbs: 3, protein: 3 }, // approx
      },
    },
  ],
};

/** ─────────────────────────────────────────────────────────────────────────────
 * Main entry used by your routes (backwards compatible)
 * You can now pass optional { cuisine, dietaryRestrictions }.
 * Returns: { query, substitutions }
 * ────────────────────────────────────────────────────────────────────────────*/
export async function suggestSubstitutionsAI(
  query: string,
  opts: AISuggestOpts = {}
) {
  const trimmed = (query ?? "").trim();
  if (!trimmed) {
    return { query: "", substitutions: [] as AISubItem[] };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fallback = STATIC_FALLBACK[norm(trimmed)] ?? [];
    return { query: trimmed, substitutions: maybeFilterByDiet(fallback, opts) };
  }

  const client = new OpenAI({ apiKey });

  // You can tune these as needed:
  const MODEL = "gpt-4o";
  const TEMPERATURE = 0.3;

  const system = `
You are a concise culinary expert. Given an ingredient, return smart substitutions with exact swap ratios and one or two practical cooking notes.
If dietaryRestrictions are provided (e.g., vegan, vegetarian, kosher, halal, gluten-free, dairy-free, nut-free), prioritize options that comply.
If cuisine is provided, bias toward regionally appropriate substitutes.
Return JSON only, no prose. Prefer 8–10 items (max 12).
Include rough nutrition comparison per the amount implied by the ratio (calories total, grams fat/carbs/protein).
`;

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
            cuisine: opts.cuisine || null,
            dietaryRestrictions: opts.dietaryRestrictions || [],
          }),
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    const parsed = AIResponseSchema.safeParse(JSON.parse(content));

    if (!parsed.success) {
      const fallback = STATIC_FALLBACK[norm(trimmed)] ?? [];
      return { query: trimmed, substitutions: maybeFilterByDiet(fallback, opts) };
    }

    // Dedup by substituteIngredient (case-insensitive), keep stable order
    const seen = new Set<string>();
    const deduped = parsed.data.substitutions.filter((s) => {
      const k = norm(s.substituteIngredient);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Optional post-filter if user adds strict dietary rules
    const filtered = maybeFilterByDiet(deduped, opts);

    return {
      query: parsed.data.query || trimmed,
      substitutions: filtered.slice(0, 12),
    };
  } catch (_err) {
    const fallback = STATIC_FALLBACK[norm(trimmed)] ?? [];
    return { query: trimmed, substitutions: maybeFilterByDiet(fallback, opts) };
  }
}

/** Basic dietary post-filter to avoid obviously non-compliant items */
function maybeFilterByDiet(items: AISubItem[], opts: AISuggestOpts): AISubItem[] {
  const rules = (opts.dietaryRestrictions || []).map(norm);
  if (!rules.length) return items;

  const isVeganLike = rules.some((r) => ["vegan", "plant-based"].includes(r));
  const isDairyFree = rules.includes("dairy-free");
  const isGlutenFree = rules.includes("gluten-free");
  const isNutFree = rules.includes("nut-free");

  return items.filter((it) => {
    const name = norm(it.substituteIngredient);

    if (isVeganLike) {
      // crude blocklist for animal products
      if (/(butter|ghee|milk|cream|cheese|yogurt|egg|gelatin|honey)/i.test(name)) return false;
    }
    if (isDairyFree) {
      if (/(butter|ghee|milk|cream|cheese|yogurt)/i.test(name)) return false;
    }
    if (isGlutenFree) {
      if (/(wheat|barley|rye|malt)/i.test(name)) return false;
    }
    if (isNutFree) {
      if (/(almond|cashew|peanut|pecan|walnut|hazelnut|pistachio|macadamia)/i.test(name)) {
        return false;
      }
    }
    return true;
  });
}
