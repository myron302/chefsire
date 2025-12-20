// server/routes/recipes.ts
import { Router } from "express";
import { searchRecipes } from "../services/recipes-service";
import { storage } from "../storage";

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

/**
 * POST /api/recipes/:id/save
 * Save a recipe for the authenticated user
 */
router.post("/:id/save", async (req, res) => {
  try {
    const { userId } = req.body;
    const recipeId = req.params.id;
    
    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }
    
    const save = await storage.saveRecipe(userId, recipeId);
    res.status(201).json({ ok: true, save });
  } catch (err: any) {
    console.error("recipe save error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Save failed" });
  }
});

/**
 * DELETE /api/recipes/:id/save
 * Unsave a recipe for the authenticated user
 */
router.delete("/:id/save", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const recipeId = req.params.id;
    
    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }
    
    const success = await storage.unsaveRecipe(userId, recipeId);
    if (!success) {
      return res.status(404).json({ ok: false, error: "Save not found" });
    }
    
    res.json({ ok: true, message: "Recipe unsaved successfully" });
  } catch (err: any) {
    console.error("recipe unsave error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Unsave failed" });
  }
});

/**
 * GET /api/recipes/:id/save-status
 * Check if a recipe is saved by the user
 */
router.get("/:id/save-status", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const recipeId = req.params.id;
    
    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }
    
    const isSaved = await storage.isRecipeSaved(userId, recipeId);
    res.json({ ok: true, isSaved });
  } catch (err: any) {
    console.error("recipe save status error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Check failed" });
  }
});

/**
 * GET /api/users/:id/saved-recipes
 * Get all saved recipes for a user
 */
router.get("/users/:id/saved-recipes", async (req, res) => {
  try {
    const userId = req.params.id;
    const recipes = await storage.getUserSavedRecipes(userId);
    res.json({ ok: true, recipes });
  } catch (err: any) {
    console.error("get saved recipes error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Fetch failed" });
  }
});

export default router;
