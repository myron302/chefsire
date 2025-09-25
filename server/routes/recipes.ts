// server/routes/recipes.ts
import { Router } from "express";
import { searchRecipes } from "../services/recipes-service";

// --------------------------- helpers ---------------------------------

/** parse "a,b,c" OR repeated ?key=a&key=b into string[] */
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

function toInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------- router ---------------------------------

const r = Router();

/**
 * GET /api/recipes/search
 * Accepts:
 *   q?: string
 *   cuisines?: string[] | "a,b,c"
 *   diets?: string[] | "a,b,c"
 *   mealTypes?: string[] | "a,b,c"
 *   compliance?: string[] | "a,b,c"   (Halal, Kosher, etc.)
 *   pageSize?/limit?: number
 *   offset?: number
 *
 * Always returns: { ok: true, items: RecipeItem[], total: number, source?: string }
 */
r.get("/recipes/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;

    const cuisines = parseList(req.query.cuisines);
    const diets = parseList(req.query.diets);
    const mealTypes = parseList(req.query.mealTypes);
    const compliance = parseList(req.query.compliance);

    // support either pageSize or limit
    const limit = toInt(
      (req.query.pageSize as any) ?? (req.query.limit as any),
      24
    );
    const offset = toInt(req.query.offset, 0);

    const sr: any = await searchRecipes({
      q,
      cuisines: cuisines.length ? cuisines : undefined,
      diets: diets.length ? diets : undefined,
      mealTypes: mealTypes.length ? mealTypes : undefined,
      compliance: compliance.length ? compliance : undefined,
      limit,
      offset,
    });

    // Normalize various possible shapes from the service into { items, total }
    const items: any[] = Array.isArray(sr)
      ? sr
      : Array.isArray(sr?.items)
      ? sr.items
      : Array.isArray(sr?.results)
      ? sr.results
      : [];
    const total: number =
      (typeof sr?.total === "number" ? sr.total : undefined) ?? items.length;

    res.json({
      ok: true,
      items,
      total,
      source: sr?.source ?? "aggregate",
      params: { q, cuisines, diets, mealTypes, compliance, limit, offset },
    });
  } catch (err: any) {
    console.error("GET /recipes/search error:", err?.stack || err);
    res.status(500).json({
      ok: false,
      items: [],
      total: 0,
      error: err?.message || "Search failed",
    });
  }
});

/**
 * POST /api/recipes/search
 * Body: { q?, cuisines?, diets?, mealTypes?, compliance?, limit?, offset? }
 */
r.post("/recipes/search", async (req, res) => {
  try {
    const body = req.body ?? {};

    const sr: any = await searchRecipes({
      q: typeof body.q === "string" ? body.q : undefined,
      cuisines: Array.isArray(body.cuisines) ? body.cuisines : parseList(body.cuisines),
      diets: Array.isArray(body.diets) ? body.diets : parseList(body.diets),
      mealTypes: Array.isArray(body.mealTypes) ? body.mealTypes : parseList(body.mealTypes),
      compliance: Array.isArray(body.compliance) ? body.compliance : parseList(body.compliance),
      limit: toInt(body.limit ?? body.pageSize, 24),
      offset: toInt(body.offset, 0),
    });

    const items: any[] = Array.isArray(sr)
      ? sr
      : Array.isArray(sr?.items)
      ? sr.items
      : Array.isArray(sr?.results)
      ? sr.results
      : [];
    const total: number =
      (typeof sr?.total === "number" ? sr.total : undefined) ?? items.length;

    res.json({
      ok: true,
      items,
      total,
      source: sr?.source ?? "aggregate",
    });
  } catch (err: any) {
    console.error("POST /recipes/search error:", err?.stack || err);
    res.status(500).json({
      ok: false,
      items: [],
      total: 0,
      error: err?.message || "Search failed",
    });
  }
});

/** quick health-check */
r.get("/recipes/health", (_req, res) => {
  res.json({ ok: true, router: "recipes" });
});

/** Back-compat alias: /api/search → /api/recipes/search */
r.get("/search", (req, res, next) => {
  req.url = "/recipes/search" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
  r.handle(req, res, next);
});

export default r;
