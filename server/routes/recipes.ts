// server/routes/recipes.ts
import { Router } from "express";
import { z } from "zod";
import { searchRecipes } from "../services/recipes-service";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import { resolveSaveRouteUserId } from "./recipes/auth";
import { normalizeIngredients, normalizeInstructions, withItemsFromResults } from "./recipes/serializers";
import {
  DEFAULT_RECIPES_PAGE_SIZE,
  DEFAULT_TRENDING_LIMIT,
  parseNumberParam,
  parseRecipeSearchParams,
} from "./recipes/search-params";

const router = Router();

function noStore(res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

/**
 * USER-CREATED RECIPES (for social posts / club posts)
 *
 * - Regular social recipes are linked to posts via recipes.postId
 * - Club recipes may have postId = null and are managed via /api/clubs routes
 */


/**
 * POST /api/recipes
 * Create a recipe linked to a post you own (recipes.postId = posts.id)
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      postId: z.string().min(1),
      title: z.string().min(1),
      imageUrl: z.string().optional().nullable(),
      ingredients: z.any().optional(),
      instructions: z.any().optional(),
      cookTime: z.number().int().positive().optional().nullable(),
      servings: z.number().int().positive().optional().nullable(),
      difficulty: z.string().optional().nullable(),
    });

    const body = schema.parse(req.body);

    const post = await storage.getPost(body.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Only the post owner can attach a recipe to their post
    if (post.userId !== req.user!.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const ingredients = normalizeIngredients(body.ingredients);
    const instructions = normalizeInstructions(body.instructions);

    if (!ingredients.length) {
      return res.status(400).json({ message: "At least one ingredient is required" });
    }
    if (!instructions.length) {
      return res.status(400).json({ message: "At least one instruction step is required" });
    }

    const recipe = await storage.createRecipe({
      postId: body.postId,
      title: body.title.trim(),
      imageUrl: body.imageUrl ?? null,
      ingredients,
      instructions,
      cookTime: body.cookTime ?? null,
      servings: body.servings ?? null,
      difficulty: body.difficulty ?? null,
    } as any);

    res.status(201).json(recipe);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid payload", issues: err.issues });
    console.error("create recipe error:", err);
    res.status(500).json({ message: "Failed to create recipe" });
  }
});

/**
 * GET /api/recipes/by-post/:postId
 * Fetch the recipe attached to a post you own (used for editing).
 */
router.get("/by-post/:postId", requireAuth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const post = await storage.getPost(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.userId !== req.user!.id) return res.status(403).json({ message: "Not allowed" });

    const recipe = await storage.getRecipeByPostId(postId);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });

    res.json(recipe);
  } catch (err: any) {
    console.error("get recipe by post error:", err);
    res.status(500).json({ message: "Failed to fetch recipe" });
  }
});

/**
 * PATCH /api/recipes/:id
 * Update a recipe linked to one of your posts.
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const recipeId = req.params.id;

    const schema = z.object({
      title: z.string().min(1).optional(),
      imageUrl: z.string().optional().nullable(),
      ingredients: z.any().optional(),
      instructions: z.any().optional(),
      cookTime: z.number().int().positive().optional().nullable(),
      servings: z.number().int().positive().optional().nullable(),
      difficulty: z.string().optional().nullable(),
    });

    const body = schema.parse(req.body);

    const existing = await storage.getRecipe(recipeId);
    if (!existing) return res.status(404).json({ message: "Recipe not found" });

    // This endpoint is only for post-linked recipes (club recipes are managed by /api/clubs)
    if (!existing.postId) {
      return res.status(403).json({ message: "This recipe can only be updated from its club post" });
    }

    const post = await storage.getPost(existing.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.userId !== req.user!.id) return res.status(403).json({ message: "Not allowed" });

    const updates: any = {};

    if (typeof body.title === "string") updates.title = body.title.trim();
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
    if (body.cookTime !== undefined) updates.cookTime = body.cookTime;
    if (body.servings !== undefined) updates.servings = body.servings;
    if (body.difficulty !== undefined) updates.difficulty = body.difficulty;

    if (body.ingredients !== undefined) {
      const ingredients = normalizeIngredients(body.ingredients);
      if (!ingredients.length) return res.status(400).json({ message: "At least one ingredient is required" });
      updates.ingredients = ingredients;
    }

    if (body.instructions !== undefined) {
      const instructions = normalizeInstructions(body.instructions);
      if (!instructions.length) return res.status(400).json({ message: "At least one instruction step is required" });
      updates.instructions = instructions;
    }

    const updatedRecipe = await storage.updateRecipe(recipeId, updates);
    if (!updatedRecipe) return res.status(404).json({ message: "Recipe not found" });

    res.json(updatedRecipe);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid payload", issues: err.issues });
    console.error("update recipe error:", err);
    res.status(500).json({ message: "Failed to update recipe" });
  }
});

/**
 * GET /api/recipes/search
 * If q is missing/empty => returns a random page (fresh each request)
 */
router.get("/search", async (req, res) => {
  noStore(res);
  try {
    const { q, cuisines, diets, mealTypes, source, pageSize, offset } = parseRecipeSearchParams(
      req.query as Record<string, unknown>,
    );

    const result = await searchRecipes({
      q,
      cuisines,
      diets,
      mealTypes,
      source,
      pageSize,
      offset,
    });

    // Return `items` (what the client expects) aliased from `results`.
    res.json({ ok: true, ...withItemsFromResults(result) });
  } catch (err: any) {
    console.error("recipes search error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Search failed" });
  }
});

/**
 * GET /api/recipes/random
 * Returns a random page of recipes (fresh each request)
 */
router.get("/random", async (req, res) => {
  noStore(res);
  try {
    const { source } = parseRecipeSearchParams(req.query as Record<string, unknown>);
    const result = await searchRecipes({ pageSize: DEFAULT_RECIPES_PAGE_SIZE, source });
    res.json({ ok: true, ...withItemsFromResults(result) });
  } catch (err: any) {
    console.error("recipes random error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Random failed" });
  }
});

/**
 * GET /api/recipes/trending
 * Returns top recipes by likes/reviews (DB-based)
 */
router.get("/trending", async (req, res) => {
  noStore(res);
  try {
    const limit = parseNumberParam(req.query.limit, DEFAULT_TRENDING_LIMIT);
    const recipes = await storage.getTrendingRecipes(limit);
    res.json({ ok: true, recipes });
  } catch (err: any) {
    console.error("recipes trending error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Trending failed" });
  }
});

/**
 * POST /api/recipes/:id/save
 * Save a recipe for the authenticated user
 */
router.post("/:id/save", requireAuth, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = resolveSaveRouteUserId(req, res);
    if (!userId) return;

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
router.delete("/:id/save", requireAuth, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = resolveSaveRouteUserId(req, res);
    if (!userId) return;

    const ok = await storage.unsaveRecipe(userId, recipeId);
    res.json({ ok });
  } catch (err: any) {
    console.error("recipe unsave error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Unsave failed" });
  }
});

/**
 * GET /api/recipes/:id/save-status?userId=...
 */
router.get("/:id/save-status", requireAuth, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = resolveSaveRouteUserId(req, res);
    if (!userId) return;

    const isSaved = await storage.isRecipeSaved(userId, recipeId);
    res.json({ ok: true, isSaved });
  } catch (err: any) {
    console.error("recipe save-status error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Save-status failed" });
  }
});

/**
 * GET /api/recipes/users/:id/saved-recipes
 */
router.get("/users/:id/saved-recipes", async (req, res) => {
  try {
    const userId = req.params.id;
    const recipes = await storage.getSavedRecipes(userId);
    res.json({ ok: true, recipes });
  } catch (err: any) {
    console.error("get saved recipes error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Fetch failed" });
  }
});

export default router;
