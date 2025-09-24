// server/routes/substitutions.ts
import { Router } from "express";
import { z } from "zod";

// Optional: lightweight, rule-based fallback so this works even without an API key
const BASIC_SUBS: Record<string, string[]> = {
  butter: ["olive oil", "coconut oil", "ghee"],
  milk: ["oat milk", "almond milk", "soy milk"],
  egg: ["flax egg (1 tbsp ground flax + 3 tbsp water)", "unsweetened applesauce", "silken tofu"],
  cream: ["evaporated milk", "half-and-half", "coconut cream"],
  buttermilk: ["milk + 1 tbsp lemon juice (per cup)"],
  yogurt: ["sour cream", "buttermilk", "coconut yogurt"],
  sugar: ["honey (reduce liquid)", "maple syrup", "coconut sugar"],
  wheat_flour: ["oat flour", "almond flour", "gluten-free blend"],
  soy_sauce: ["tamari", "coconut aminos"],
  fish_sauce: ["soy sauce + a touch of anchovy paste", "mushroom soy (veg-ish)"],
  mayonnaise: ["Greek yogurt", "aioli"],
};

const r = Router();

/**
 * POST /api/substitutions/suggest
 * Body: { items: string[], diet?: string[], allergies?: string[] }
 * Returns simple suggestions without needing an AI key; can be swapped to LLM later.
 */
r.post("/substitutions/suggest", async (req, res) => {
  try {
    const schema = z.object({
      items: z.array(z.string()).min(1),
      diet: z.array(z.string()).optional(),       // e.g. ["vegan", "gluten-free", "kosher"]
      allergies: z.array(z.string()).optional(),  // e.g. ["nuts", "dairy"]
    });

    const body = schema.parse(req.body);
    const { items, diet = [], allergies = [] } = body;

    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "_");

    const suggestions = items.map((raw) => {
      const key = norm(raw);
      const base = BASIC_SUBS[key] || BASIC_SUBS[raw.toLowerCase()] || [];

      // Filter very simply by allergies/diet words if present in suggestion text
      const filtered = base.filter((s) => {
        const low = s.toLowerCase();
        if (allergies.includes("nuts") && /almond|peanut|nut/.test(low)) return false;
        if (allergies.includes("dairy") && /milk|cream|yogurt|cheese|butter/.test(low)) return false;
        if (diet.includes("vegan") && /egg|yogurt|milk|cream|butter|mayonnaise|fish|anchovy/.test(low)) return false;
        if (diet.includes("gluten-free") && /wheat|flour (?!blend)/.test(low)) return false;
        return true;
      });

      return {
        item: raw,
        suggestions: filtered.length ? filtered : base,
        note: filtered.length ? undefined : (base.length ? "Some options may not fit your filters" : "No known basic substitutions; try a broader search"),
      };
    });

    res.json({ suggestions, filters: { diet, allergies } });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid request", errors: e.issues });
    console.error("substitutions/suggest error", e);
    res.status(500).json({ message: "Failed to suggest substitutions" });
  }
});

export default r;
