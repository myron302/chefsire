// server/routes/recipes.ts
import { Router } from "express";
import { searchRecipes } from "../services/recipes-service";

const router = Router();

function parseList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .flatMap((x) => String(x).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * GET /api/recipes/search
 * Query params:
 *   q?: string
 *   cuisines?: "a,b,c" or repeated &cuisines=a&cuisines=b
 *   diets?: "a,b,c"
 *   mealTypes?: "a,b,c"
 *   pageSize?: number  (default 24)
 *   offset?: number    (default 0)
 */
router.get("/recipes/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const cuisines = parseList(req.query.cuisines);
    const diets = parseList(req.query.diets);
    const mealTypes = parseList(req.query.mealTypes);

    const pageSize =
      typeof req.query.pageSize === "string"
        ? Number(req.query.pageSize)
        : typeof req.query.pageSize === "number"
        ? req.query.pageSize
        : 24;

    const offset =
      typeof req.query.offset === "string"
        ? Number(req.query.offset)
        : typeof req.query.offset === "number"
        ? req.query.offset
        : 0;

    const out = await searchRecipes({
      q,
      cuisines: cuisines.length ? cuisines : undefined,
      diets: diets.length ? diets : undefined,
      mealTypes: mealTypes.length ? mealTypes : undefined,
      pageSize,
      offset,
    });

    res.json({
      ok: true,
      total: out.total,
      source: out.source,
      items: out.results,
      params: { q, cuisines, diets, mealTypes, pageSize, offset },
    });
  } catch (err: any) {
    console.error("recipes search error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Search failed" });
  }
});

/** GET /api/recipes/random -> array of random meals (uses searchRecipes with q="") */
router.get("/recipes/random", async (_req, res) => {
  try {
    const out = await searchRecipes({ q: "" });
    res.json({ ok: true, items: out.results, total: out.total, source: out.source });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Random failed" });
  }
});

export const recipesRouter = router;   // named export
export default router;                  // default export (so either import style works)
