// server/routes/recipes.ts
import { Router } from "express";
import { searchRecipes } from "../services/recipes-service";

const router = Router();

function noStore(res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

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
 * If q is missing/empty => returns a random page (fresh each request)
 */
router.get("/search", async (req, res) => {
  noStore(res);
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
      q, // empty or undefined triggers randomness in the service
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

/**
 * GET /api/recipes/random?count=24
 * Always random, ignores q and pagination, and returns 'count' items.
 */
router.get("/random", async (req, res) => {
  noStore(res);
  try {
    const count =
      typeof req.query.count === "string"
        ? Number(req.query.count)
        : typeof req.query.count === "number"
        ? req.query.count
        : 24;

    const out = await searchRecipes({ q: "", pageSize: count, offset: 0 });
    res.json({ ok: true, items: out.results, total: out.total, source: out.source });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Random failed" });
  }
});

export default router;
