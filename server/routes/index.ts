// server/routes/recipes.ts
import { Router } from "express";
import { searchRecipes } from "../services/recipes-service";

const r = Router();

/** parse "a,b,c" or repeated ?key=a&key=b into string[] */
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
 * Accepts:
 *   q?: string
 *   cuisines?: string[] | "a,b,c"       (mapped to MealDB "area")
 *   mealTypes?: string[] | "a,b,c"      (mapped to MealDB "category")
 *   diets?: string[] | "a,b,c"          (ignored by MealDB, but accepted)
 *   pageSize?: number
 *   offset?: number
 */
r.get("/recipes/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const cuisines = parseList(req.query.cuisines);
    const mealTypes = parseList(req.query.mealTypes);
    const diets = parseList(req.query.diets);

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

    const result = await searchRecipes({
      q,
      cuisines,
      mealTypes,
      diets,
      pageSize,
      offset,
    });

    // Your client sometimes expects { items: [...] }
    res.json({
      ok: true,
      total: result.total,
      items: result.results,
      source: result.source,
      params: { q, cuisines, mealTypes, diets, pageSize, offset },
    });
  } catch (err: any) {
    console.error("recipes search error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Search failed" });
  }
});

/** Optional back-compat: /api/search → /api/recipes/search */
r.get("/search", (req, res, next) => {
  req.url = "/recipes/search";
  (r as any).handle(req, res, next);
});

export default r;
