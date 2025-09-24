// server/routes/recipes.ts
import { Router } from "express";
import { searchRecipes } from "../services/recipes-service";

const r = Router();

/** Helper: parse "a,b,c" OR repeated ?key=a&key=b into string[] */
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
 *   cuisines?: string[] | "a,b,c"
 *   diets?: string[] | "a,b,c"
 *   mealTypes?: string[] | "a,b,c"
 *   pageSize?: number
 *   offset?: number
 */
r.get("/recipes/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const cuisines = parseList(req.query.cuisines);
    const diets = parseList(req.query.diets);
    const mealTypes = parseList(req.query.mealTypes);

    const pageSize =
      typeof req.query.pageSize === "string" ? Number(req.query.pageSize) :
      typeof req.query.pageSize === "number" ? req.query.pageSize :
      24;

    const offset =
      typeof req.query.offset === "string" ? Number(req.query.offset) :
      typeof req.query.offset === "number" ? req.query.offset :
      0;

    const items = await searchRecipes({
      q,
      cuisines: cuisines.length ? cuisines : undefined,
      diets: diets.length ? diets : undefined,
      mealTypes: mealTypes.length ? mealTypes : undefined,
      pageSize,
      offset,
    });

    res.json({
      ok: true,
      total: items.length,
      items,
      params: { q, cuisines, diets, mealTypes, pageSize, offset },
    });
  } catch (err: any) {
    console.error("recipes search error:", err);
    res
      .status(500)
      .json({ ok: false, error: err?.message || "Search failed" });
  }
});

/** Back-compat alias: /api/search (kept just in case something still calls it) */
r.get("/search", (req, res, next) => {
  // Forward to the canonical handler
  (r as any).handle({ ...req, url: "/recipes/search" }, res, next);
});

export default r;
