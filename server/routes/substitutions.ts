// server/routes/substitutions.ts
import { Router } from "express";
import { z } from "zod";

const r = Router();

/**
 * Super-light, local substitutions engine.
 * - Works without any API keys.
 * - Applies simple filtering for diet/allergy flags.
 * - You can later swap this logic for your AI helper in services/ingredients-ai.ts.
 */

type Suggestion = { substitute: string; note?: string };

// Base catalog of common swaps
const CATALOG: Record<string, Suggestion[]> = {
  butter: [
    { substitute: "olive oil", note: "Good for sautéing and baking (reduce by ~20%)." },
    { substitute: "coconut oil", note: "Adds mild coconut flavor; solid at room temp." },
    { substitute: "vegan butter", note: "Closest one-to-one for butter in baking." },
    { substitute: "ghee", note: "Clarified butter; not vegan, lower lactose." },
    { substitute: "applesauce", note: "Baking only; reduces fat, adds moisture." },
  ],
  milk: [
    { substitute: "oat milk", note: "Neutral flavor; good for coffee and sauces." },
    { substitute: "soy milk", note: "Higher protein; good general-purpose." },
    { substitute: "almond milk", note: "Light texture; avoid if nut allergy." },
    { substitute: "coconut milk (carton)", note: "Slight coconut flavor; thin body." },
  ],
  cream: [
    { substitute: "coconut cream", note: "Rich & dairy-free; coconut flavor." },
    { substitute: "cashew cream", note: "Soaked cashews blended; silky dairy-free." },
    { substitute: "evaporated milk", note: "Lower fat than cream; not dairy-free." },
    { substitute: "Greek yogurt + milk", note: "Tangy; cooking only, not whipping." },
  ],
  egg: [
    { substitute: "flax egg", note: "1 tbsp ground flax + 3 tbsp water; binding in baking." },
    { substitute: "chia egg", note: "1 tbsp chia + 3 tbsp water; similar to flax." },
    { substitute: "aquafaba (3 tbsp)", note: "Whips like egg white; meringues, binding." },
    { substitute: "applesauce (1/4 cup)", note: "Moisture in cakes/muffins; mild apple note." },
  ],
  honey: [
    { substitute: "maple syrup", note: "1:1; distinct maple flavor." },
    { substitute: "agave nectar", note: "1:1; neutral flavor." },
    { substitute: "simple syrup", note: "Less viscous; adjust liquids." },
  ],
  "wheat flour": [
    { substitute: "gluten-free all-purpose blend", note: "1:1 in many recipes; check binder." },
    { substitute: "almond flour", note: "Lower carb; needs extra binder/egg." },
    { substitute: "oat flour", note: "Homemade from oats; good for quick breads." },
  ],
  yogurt: [
    { substitute: "coconut yogurt", note: "Dairy-free; coconut flavor." },
    { substitute: "silken tofu (blended)", note: "Neutral protein boost; add lemon for tang." },
    { substitute: "sour cream", note: "Not dairy-free; similar tang and fat." },
  ],
  cheese: [
    { substitute: "nutritional yeast", note: "Cheesy umami; dairy-free." },
    { substitute: "vegan cheese (shreds)", note: "Melts vary by brand." },
    { substitute: "tofu ricotta", note: "Blended tofu + lemon + herbs for ricotta-style." },
  ],
};

const DIET_BLOCKLIST: Record<string, RegExp[]> = {
  // remove these suggestions if diet includes key
  vegan: [/\b(ghee|yogurt|sour cream|cheese|evaporated milk)\b/i],
  vegetarian: [], // (nothing extra beyond meat; catalog has no meats)
  paleo: [/\b(agave|simple syrup|oat|soy|almond flour|evaporated milk)\b/i],
  keto: [/\b(simple syrup|maple syrup|agave|oat|oat milk)\b/i],
  gluten_free: [/\b(wheat|flour(?!.*gluten-free))\b/i],
};

const ALLERGY_BLOCKLIST: Record<string, RegExp[]> = {
  dairy: [/\b(milk|yogurt|cheese|cream|ghee|evaporated milk|sour cream)\b/i],
  nuts: [/\b(almond|cashew)\b/i],
  soy: [/\b(soy)\b/i],
  coconut: [/\b(coconut)\b/i],
  egg: [/\b(egg)\b/i],
};

function filterByDietAndAllergies(
  suggestions: Suggestion[],
  diet: string[],
  allergies: string[],
): Suggestion[] {
  const dietRules = diet.flatMap((d) => DIET_BLOCKLIST[d.toLowerCase()] ?? []);
  const allergyRules = allergies.flatMap((a) => ALLERGY_BLOCKLIST[a.toLowerCase()] ?? []);
  const rules = [...dietRules, ...allergyRules];

  if (rules.length === 0) return suggestions;

  return suggestions.filter((s) => !rules.some((rx) => rx.test(s.substitute)));
}

r.get("/substitutions/health", (_req, res) => {
  res.json({ ok: true, engine: "local", catalogSize: Object.keys(CATALOG).length });
});

r.post("/substitutions/suggest", async (req, res) => {
  try {
    const schema = z.object({
      items: z.array(z.string().min(1)).min(1),
      diet: z.array(z.string()).optional().default([]),
      allergies: z.array(z.string()).optional().default([]),
    });

    const { items, diet, allergies } = schema.parse(req.body);

    const results = items.map((raw) => {
      const key = raw.toLowerCase().trim();
      const base =
        CATALOG[key] ??
        // try loose matches (e.g., “whole milk” -> “milk”)
        (Object.keys(CATALOG).find((k) => key.includes(k)) ? CATALOG[Object.keys(CATALOG).find((k) => key.includes(k)) as string] : []);

      const filtered = filterByDietAndAllergies(base, diet, allergies);

      return {
        original: raw,
        suggestions: filtered,
        found: filtered.length > 0,
      };
    });

    res.json({
      substitutions: results,
      info: {
        diet,
        allergies,
        note:
          "This is a local heuristic engine. For richer, context-aware swaps you can plug in your AI helper later.",
      },
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid request", errors: e.issues });
    console.error("substitutions/suggest error", e);
    res.status(500).json({ message: "Failed to generate substitutions" });
  }
});

export default r;
