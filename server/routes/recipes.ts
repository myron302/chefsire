// server/routes/recipes.ts
import { Router } from "express";
import { storage } from "../storage";
import { searchRecipes } from "../services/recipes-service"; // ← matches your filename

const r = Router();

// GET /api/recipes/trending?limit=5
r.get("/trending", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 5);
    const items = await storage.getTrendingRecipes(limit);
    res.json(items);
  } catch (e) { next(e); }
});

// GET /api/recipes/post/:postId
r.get("/post/:postId", async (req, res, next) => {
  try {
    const recipe = await storage.getRecipeByPostId(req.params.postId);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });
    res.json(recipe);
  } catch (e) { next(e); }
});

// GET /api/recipes/search
// q, cuisines, diets, mealTypes, maxReadyMinutes, pageSize, offset, source
r.get("/search", async (req, res, next) => {
  try {
    const params = {
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      cuisines:
        typeof req.query.cuisines === "string"
          ? req.query.cuisines.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      diets:
        typeof req.query.diets === "string"
          ? req.query.diets.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      mealTypes:
        typeof req.query.mealTypes === "string"
          ? req.query.mealTypes.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      maxReadyMinutes: req.query.maxReadyMinutes ? Number(req.query.maxReadyMinutes) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 24,
      offset: req.query.offset ? Number(req.query.offset) : 0,
      source: (["all", "external", "local"] as const).includes(String(req.query.source))
        ? (req.query.source as any)
        : "all",
    };

    const result = await searchRecipes(params);
    res.json(result);
  } catch (e) { next(e); }
});

// GET /api/recipes/:id
r.get("/:id", async (req, res, next) => {
  try {
    const recipe = await storage.getRecipe(req.params.id);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });
    res.json(recipe);
  } catch (e) { next(e); }
});

// POST /api/recipes
r.post("/", async (req, res, next) => {
  try {
    const created = await storage.createRecipe(req.body);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

// PUT /api/recipes/:id
r.put("/:id", async (req, res, next) => {
  try {
    const updated = await storage.updateRecipe(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Recipe not found" });
    res.json(updated);
  } catch (e) { next(e); }
});

export default r;
