// server/services/ai.ts
import type { ClientOptions } from "openai";

// Lazy/optional import so builds don't break if OPENAI_API_KEY is missing
let OpenAICtor: any = null;
if (process.env.OPENAI_API_KEY) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    OpenAICtor = (await import("openai")).default;
  } catch {
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

type Options = {
  cuisine?: string;
  dietaryRestrictions?: string[]; // e.g. ["Halal","Kosher","Vegan"]
};

/**
 * Server-side AI substitution helper used by
 * GET /api/ingredients/:ingredient/ai-substitutions
 */
export async function aiSuggestSubstitutions(
  ingredient: string,
  opts: Options = {}
): Promise<AISubItem[]> {
  const q = ingredient.trim();
  if (!q) return [];

  // If no key or OpenAI client is unavailable, return canned ideas for a few staples
  if (!process.env.OPENAI_API_KEY || !OpenAICtor) {
    const samples: Record<string, AISubItem[]> = {
      butter: [
        {
          substituteIngredient: "Olive oil",
          ratio: "¾ cup olive oil = 1 cup butter",
          category: "oils",
          notes:
            "Great for sautéing; in baking expect different flavor/texture. Reduce liquids slightly if batter seems too loose.",
          nutrition: {
            // ~1 cup butter vs ¾ cup olive oil (approx, illustrative only)
            original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
            substitute: { calories: 1433, fat: 162, carbs: 0, protein: 0 },
          },
        },
        {
          substituteIngredient: "Coconut oil",
          ratio: "1:1 by volume",
          category: "oils",
          notes:
            "Solid at room temp similar to butter; adds coconut aroma; nice in cookies and some cakes.",
          nutrition: {
            original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
            substitute: { calories: 1879, fat: 218, carbs: 0, protein: 0 },
          },
        },
        {
          substituteIngredient: "Unsweetened applesauce (baking)",
          ratio: "½ cup applesauce = 1 cup butter",
          category: "baking",
          notes:
            "Cuts fat/calories; best in quick breads/muffins. Texture becomes softer; don’t overmix.",
          nutrition: {
            original: { calories: 1628, fat: 184, carbs: 1, protein: 2 },
            substitute: { calories: 100, fat: 0, carbs: 27, protein: 0 },
          },
        },
      ],
      eggs: [
        {
          substituteIngredient: "Ground flax + water",
          ratio: "1 Tbsp ground flax + 3 Tbsp water = 1 egg",
          category: "baking",
          notes:
            "Let gel 5–10 min. Works in muffins/quick breads/cookies; not good for meringues.",
          nutrition: {
            original: { calories: 72, fat: 5, carbs: 0.4, protein: 6 },
            substitute: { calories: 55, fat: 4.3, carbs: 3, protein: 1.9 },
          },
        },
        {
          substituteIngredient: "Unsweetened applesauce (baking)",
          ratio: "¼ cup applesauce = 1 egg",
          category: "baking",
          notes: "Adds moisture; can make crumb denser. Add pinch baking powder if needed.",
          nutrition: {
            original: { calories: 72, fat: 5, carbs: 0.4, protein: 6 },
            substitute: { calories: 50, fat: 0, carbs: 13, protein: 0 },
          },
        },
      ],
      milk: [
        {
          substituteIngredient: "Oat milk (unsweetened)",
          ratio: "1:1",
          category: "dairy-free",
          notes: "Neutral flavor; good for most uses. Choose barista type for foam.",
          nutrition: {
            original: { calories: 150, fat: 8, carbs: 12, protein: 8 }, // 1 cup whole milk approx
            substitute: { calories: 120, fat: 5, carbs: 16, protein: 3 },
          },
        },
      ],
    };

    // crude cuisine/diet hinting: filter out options that conflict
    let subs = samples[q.toLowerCase()] ?? [];
    const dr = (opts.dietaryRestrictions || []).map((s) => s.toLowerCase());
    if (dr.includes("vegan")) {
      subs = subs.filter(
        (s) =>
          !/(ghee|butter|cheese|yogurt|milk|cream)/i.test(
            (s.notes || "") + " " + s.substituteIngredient
          )
      );
    }
    if (dr.includes("halal")) {
      subs = subs.filter(
        (s) =>
          !/(wine|rum|brandy|vodka|beer|tequila|pork|bacon|prosciutto|ham)/i.test(
            (s.notes || "") + " " + s.substituteIngredient
          )
      );
    }
    if (dr.includes("kosher")) {
      subs = subs.filter(
        (s) =>
          !/(pork|bacon|prosciutto|ham|shrimp|prawn|crab|lobster|clam|mussel|oyster|scallop)/i.test(
            (s.notes || "") + " " + s.substituteIngredient
          )
      );
    }
    return subs;
  }

  // Real OpenAI call
  const client = new OpenAICtor({
    apiKey: process.env.OPENAI_API_KEY,
  } as ClientOptions);

  const restrictionLine = [
    opts.cuisine ? `Cuisine focus: ${opts.cuisine}.` : "",
    opts.dietaryRestrictions?.length
      ? `Honor these dietary rules if possible: ${opts.dietaryRestrictions.join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const prompt = `
You are a culinary assistant. Suggest 3–5 practical substitutions for the ingredient: "${q}".
${restrictionLine}

Return ONLY valid JSON in this exact shape:
{
  "substitutions": [
    {
      "substituteIngredient": "string",
      "ratio": "string",
      "category": "string",
      "notes": "string",
      "nutrition": {
        "original": { "calories": number, "fat": number, "carbs": number, "protein": number },
        "substitute": { "calories": number, "fat": number, "carbs": number, "protein": number }
      }
    }
  ]
}

Notes must be concise, cooking-relevant, and honest about trade-offs. Use approximate nutrition for the typical amount implied by your ratio.
`;

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  const text = resp.choices?.[0]?.message?.content?.trim() || "";
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed?.substitutions) ? parsed.substitutions : [];
    return arr as AISubItem[];
  } catch {
    return [];
  }
}
