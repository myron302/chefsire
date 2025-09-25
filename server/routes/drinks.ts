// server/routes/drinks.ts
import { Router } from "express";
import { listMeta, lookupDrink, randomDrink, searchDrinks } from "../services/drinks-service";

const r = Router();

// Small helper to coerce query values into strings
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * GET /api/drinks/search
 * Query:
 *   q?: string
 *   ingredient?: string
 *   category?: string
 *   alcoholic?: "Alcoholic" | "Non_Alcoholic" | "Optional alcohol"
 *   pageSize?: number
 *   offset?: number
 */
r.get("/drinks/search", async (req, res) => {
  try {
    const pageSize = Number.isFinite(Number(req.query.pageSize))
      ? Number(req.query.pageSize)
      : undefined;
    const offset = Number.isFinite(Number(req.query.offset))
      ? Number(req.query.offset)
      : undefined;

    const result = await searchDrinks({
      q: str(req.query.q),
      ingredient: str(req.query.ingredient),
      category: str(req.query.category),
      alcoholic: str(req.query.alcoholic),
      pageSize,
      offset,
    });

    res.json({ ok: true, total: result.total, items: result.results, params: result.params });
  } catch (err: any) {
    console.error("drinks search error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Search failed" });
  }
});

// GET /api/drinks/random
r.get("/drinks/random", async (_req, res) => {
  try {
    const d = await randomDrink();
    if (!d) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, item: d });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed" });
  }
});

// GET /api/drinks/lookup/:id (idDrink from CocktailDB)
r.get("/drinks/lookup/:id", async (req, res) => {
  try {
    const d = await lookupDrink(String(req.params.id));
    if (!d) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, item: d });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed" });
  }
});

// GET /api/drinks/meta (categories, alcoholic types, glasses, ingredients)
r.get("/drinks/meta", async (_req, res) => {
  try {
    const meta = await listMeta();
    res.json({ ok: true, ...meta });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed" });
  }
});

export default r;
