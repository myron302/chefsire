// server/routes/recipes.ts
import { Router } from "express";
import { z } from "zod";

import { storage } from "../storage";
import {
  insertRecipeSchema,
} from "../../shared/schema";

import {
  fetchSpoonacularRecipes,
  fetchEdamamRecipes,
  mergeDedupRecipes,
  type NormalizedRecipe,
} from "../services/recipes-providers";

import { fetchRecipes as fetchTheMealDbRecipes } from "../services/recipes-service";

const r = Router();

// Import TheMealDB data into local DB
r.post("/fetch-recipes", async (_req, res) => {
  try {
    const result = await fetchTheMealDbRecipes();
    res.status(201).json({
      message: "Recipes fetched and processed",
      success: result.success,
      inserted: result.count,
      processed: result.processed,
    });
  } catch (e) {
    console.error("[routes/recipes] fetch-recipes error:", e);
    res.status(500).json({ message: "Failed to fetch recipes" });
  }
});

// Unified search across external + local
r.get("/search", async (req, res) => {
  try {
    const querySchema = z.object({
      q: z.string().optional(),
      cuisines: z.string().optional(),
      diets: z.string().optional(),
      mealTypes: z.string().optional(),
      maxReadyMinutes: z.coerce.number().optional(),
      pageSize: z.coerce.number().min(1).max(50).default(24),
      offset: z.coerce.number().min(0).default(0),
      source: z.enum(["all", "external", "local"]).default("all"),
    });

    const parsed = querySchema.parse(req.query);

    const cuisines = parsed.cuisines?.split(",").map((s) => s.trim()).filter(Boolean) || [];
    const diets = parsed.diets?.split(",").map((s) => s.trim()).filter(Boolean) || [];
    const mealTypes = parsed.mealTypes?.split(",").map((s) => s.trim()).filter(Boolean) || [];

    const searchReq = {
      q: parsed.q,
      cuisines,
      diets,
      mealTypes,
      maxReadyMinutes: parsed.maxReadyMinutes,
      pageSize: parsed.pageSize,
      offset: parsed.offset,
    };

    let external: NormalizedRecipe[] = [];
    if (parsed.source === "all" || parsed.source === "external") {
      const [spoon, edam] = await Promise.all([
        fetchSpoonacularRecipes(searchReq).catch(() => []),
        fetchEdamamRecipes(searchReq).catch(() => []),
      ]);
      external = mergeDedupRecipes(spoon, edam);
    }

    let local: NormalizedRecipe[] = [];
    if (parsed.source === "all" || parsed.source === "local") {
      const maybeSearch = (storage as any).searchLocalRecipes;
      if (typeof maybeSearch === "function") {
        const loc = await maybeSearch(searchReq);
        local = Array.isArray(loc) ? loc : [];
      }
    }

    const results =
      parsed.source === "external"
        ? external
        : parsed.source === "local"
        ? local
        : mergeDedupRecipes(local, external);

    res.json({
      results,
      total: results.length,
      source: parsed.source,
      pageSize: parsed.pageSize,
      offset: parsed.offset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid search params", errors: error.errors });
    }
    console.error("[routes/recipes] search error:", error);
    res.status(500).json({ message: "Failed to search recipes" });
  }
});

// Trending local recipes
r.get("/trending", async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || "5", 10);
    const items = await storage.getTrendingRecipes(limit);
    res.json(items);
  } catch (e) {
    console.error("[routes/recipes] trending error:", e);
    res.status(500).json({ message: "Failed to fetch trending recipes" });
  }
});

// Recipe by post ID
r.get("/post/:postId", async (req, res) => {
  try {
    const recipe = await storage.getRecipeByPostId(req.params.postId);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });
    res.json(recipe);
  } catch (e) {
    console.error("[routes/recipes] by-post error:", e);
    res.status(500).json({ message: "Failed to fetch recipe" });
  }
});

// Create a recipe (local)
r.post("/", async (req, res) => {
  try {
    const recipeData = insertRecipeSchema.parse(req.body);
    const recipe = await storage.createRecipe(recipeData);
    res.status(201).json(recipe);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid recipe data", errors: error.errors });
    }
    console.error("[routes/recipes] create error:", error);
    res.status(500).json({ message: "Failed to create recipe" });
  }
});

export default r;
