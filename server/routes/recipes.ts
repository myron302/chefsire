// server/routes/recipes.ts
import { Router } from "express";
import { storage } from "../models/storage";

const r = Router();

/**
 * GET /api/recipes/search
 * Query params:
 *   q?: string
 *   cuisines?: comma list
 *   diets?: comma list
 *   mealTypes?: comma list
 *   pageSize?: number (default 24)
 *   offset?: number (default 0)
 */
r.get("/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;

    const toList = (v: unknown) =>
      typeof v === "string"
        ? v.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    const cuisines = toList(req.query.cuisines);
    const diets = toList(req.query.diets);
    const mealTypes = toList(req.query.mealTypes);

    const pageSize =
      typeof req.query.pageSize === "string" ? Number(req.query.pageSize) : 24;
    const offset =
      typeof req.query.offset === "string" ? Number(req.query.offset) : 0;

    // Local DB search (your storage already implements this; it currently
    // primarily respects `q`, but we pass all params for future expansion).
    const local = await storage.searchLocalRecipes({
      q,
      cuisines,
      diets,
      mealTypes,
      pageSize,
      offset,
    });

    return res.json({
      items: local,
      total: local.length,
      source: "local",
    });
  } catch (err: any) {
    console.error("recipes.search error:", err);
    return res
      .status(500)
      .json({ message: err?.message || "Search failed", code: "RECIPES_SEARCH_FAILED" });
  }
});

export default r;
