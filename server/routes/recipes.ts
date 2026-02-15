// server/routes/recipes.ts
import { Router } from "express";
import { z } from "zod";
import { searchRecipes } from "../services/recipes-service";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";

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
 * USER-CREATED RECIPES (for social posts / club posts)
 *
 * - Regular social recipes are linked to posts via recipes.postId
 * - Club recipes may have postId = null and are managed via /api/clubs routes
 */

type IngredientRow = {
  amount?: string | number;
  unit?: string;
  ingredient?: string;
  name?: string;
};
type InstructionRow = { step?: string; text?: string };

function normalizeIngredients(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    // Already array of strings
    if (input.every((x) => typeof x === "string")) {
      return (input as string[]).map((s) => s.trim()).filter(Boolean);
    }

    // Array of objects -> join into a nice single string per row
    return (input as any[])
      .map((row: IngredientRow) => {
        const amount = row.amount ?? "";
        const unit = row.unit ?? "";
        const name = row.ingredient ?? row.name ?? "";
        const joined = [amount, unit, name]
          .map((x) => String(x ?? "").trim())
          .filter(Boolean)
          .join(" ");
        return joined.trim();
      })
      .filter(Boolean);
  }
  return [];
}

function normalizeInstructions(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    // Already array of strings
    if (input.every((x) => typeof x === "string")) {
      return (input as string[]).map((s) => s.trim()).filter(Boolean);
    }

    // Array of objects -> extract text
    return (input as any[])
      .map((row: InstructionRow) => String(row.step ?? row.text ?? "").trim())
      .filter(Boolean);
  }
  return [];
}

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

    const page =
      typeof req.query.page === "string"
        ? Number(req.query.page)
        : typeof req.query.page === "number"
        ? req.query.page
        : undefined;

    const result = await searchRecipes({
      q,
      cuisines,
      diets,
      mealTypes,
      pageSize: Number.isFinite(pageSize) ? pageSize : 24,
      page: page && Number.isFinite(page) ? page : undefined,
    });

    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("recipes search error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Search failed" });
  }
});

/**
 * GET /api/recipes/random
 * Returns a random page of recipes (fresh each request)
 */
router.get("/random", async (_req, res) => {
  noStore(res);
  try {
    const result = await searchRecipes({ pageSize: 24 });
    res.json({ ok: true, ...result });
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
    const limit =
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : typeof req.query.limit === "number"
        ? req.query.limit
        : 10;

    const recipes = await storage.getTrendingRecipes(Number.isFinite(limit) ? limit : 10);
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
