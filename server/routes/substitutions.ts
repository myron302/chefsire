// server/routes/substitutions.ts
import { Router } from "express";
import { z } from "zod";
import { aiSuggestSubstitutions } from "../services/ai"; // existing helper you had

const r = Router();

/**
 * POST /api/substitutions
 * Body:
 *  ingredient: string (required)
 *  quantity?: number
 *  unit?: string
 *  context?: { diet?: string[], allergens?: string[], cuisines?: string[], notes?: string }
 */
const bodySchema = z.object({
  ingredient: z.string().min(1, "ingredient is required"),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  context: z
    .object({
      diet: z.array(z.string()).optional(),
      allergens: z.array(z.string()).optional(),
      cuisines: z.array(z.string()).optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

r.post("/", async (req, res) => {
  try {
    const input = bodySchema.parse(req.body);

    const result = await aiSuggestSubstitutions({
      ingredient: input.ingredient,
      quantity: input.quantity,
      unit: input.unit,
      context: input.context,
    });

    res.json({
      ok: true,
      ingredient: input.ingredient,
      suggestions: result?.suggestions ?? [],
      rationale: result?.rationale,
      nutritionDelta: result?.nutritionDelta, // if your ai.ts returns it
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("[substitutions] error:", error);
    res.status(500).json({ message: "Failed to generate substitutions" });
  }
});

export default r;
