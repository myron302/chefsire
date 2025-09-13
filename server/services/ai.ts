// server/services/ai.ts
import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import OpenAI from "openai";

export type Nutrition = {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
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

export type AISubResponse = {
  query: string;
  substitutions: AISubItem[];
};

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

/**
 * Use OpenAI to generate smart substitutions.
 * You can pass an optional "useCase" (e.g., "baking cookies") to tailor suggestions.
 */
export async function aiSuggestSubstitutions(query: string, useCase?: string): Promise<AISubResponse> {
  if (!OPENAI_API_KEY) {
    // If no key, return empty response (so the route can still work without crashing)
    return { query, substitutions: [] };
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const system: ChatCompletionMessageParam = {
    role: "system",
    content:
      "You are a culinary assistant that suggests ingredient substitutions. " +
      "Return concise, practical swaps with ratios and a short note. " +
      "When plausible, include rough nutrition deltas (per 1 serving) as numbers for calories, fat, carbs, protein."
  };

  const user: ChatCompletionMessageParam = {
    role: "user",
    content:
      `Ingredient to replace: "${query}".` +
      (useCase ? ` Use case/context: ${useCase}.` : "") +
      " Return JSON ONLY with shape: {query, substitutions:[{substituteIngredient, ratio, category?, notes?, nutrition?:{original:{calories,fat,carbs,protein},substitute:{calories,fat,carbs,protein}}}]}. " +
      "Give 3–5 substitutions max."
  };

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [system, user],
    temperature: 0.4,
    response_format: { type: "json_object" }
  });

  const raw = completion.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw);
    // very light validation/normalization
    const substitutions: AISubItem[] = Array.isArray(parsed?.substitutions)
      ? parsed.substitutions.map((s: any) => ({
          substituteIngredient: String(s.substituteIngredient || "").trim(),
          ratio: String(s.ratio || "").trim(),
          category: s.category ? String(s.category) : undefined,
          notes: s.notes ? String(s.notes) : undefined,
          nutrition: s.nutrition?.original && s.nutrition?.substitute
            ? {
                original: {
                  calories: Number(s.nutrition.original.calories || 0),
                  fat: Number(s.nutrition.original.fat || 0),
                  carbs: Number(s.nutrition.original.carbs || 0),
                  protein: Number(s.nutrition.original.protein || 0),
                },
                substitute: {
                  calories: Number(s.nutrition.substitute.calories || 0),
                  fat: Number(s.nutrition.substitute.fat || 0),
                  carbs: Number(s.nutrition.substitute.carbs || 0),
                  protein: Number(s.nutrition.substitute.protein || 0),
                }
              }
            : undefined
        }))
      : [];

    return {
      query: String(parsed?.query || query),
      substitutions
    };
  } catch {
    return { query, substitutions: [] };
  }
}
