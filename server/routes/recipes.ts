// server/routes/recipes.ts
import { Router } from "express";
import { searchRecipes } from "../services/recipes-service";

const r = Router();

/**
 * GET /api/recipes/search
 * Query params:
 *  - q?: string
 *  - cuisines[]?: string
 *  - diets[]?: string
 *  - mealTypes[]?: string
 *  - pageSize?: number
 *  - offset?: number
 */
r.get("/recipes/search", async (req, res) => {
  try {
    // normalize arrays from query (?cuisines=a&cuisines=b OR ?cuisines=a,b)
    const toList = (v: unknown): string[] => {
      if (Array.isArray(v)) return v.flatMap(x => String(x).split(",")).map(s => s.trim()).filter(Boolean);
      if (typeof v === "string") return v.split(",").map(s => s.trim()).filter(Boolean);
      return [];
    };

    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const cuisines = toList(req.query.cuisines);
    const diets = toList(req.query.diets);
    const mealTypes = toList(req.query.mealTypes);

    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 24;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const items = await searchRecipes({
      q,
      cuisines,
      diets,
      mealTypes,
      pageSize,
      offset,
    });

    res.json({ items, total: items.length, params: { q, cuisines, diets, mealTypes, pageSize, offset } });
  } catch (err: any) {
    console.error("recipes.search error:", err);
    res.status(500).json({ error: "Search failed", details: err?.message || String(err) });
  }
});

export default r;
