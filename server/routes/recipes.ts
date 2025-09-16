import { Router } from "express";
import { fetchRecipes } from "../features/recipes.service";
import { getRecipes } from "../features/recipes/recipes.get";

const router = Router();

// Simple mock auth (using the same pattern as main routes.ts)
const authenticateUser = (req: any, _res: any, next: any) => {
  req.user = { id: "user-123" };
  next();
};

// POST /api/recipes/fetch-recipes - Fetch and insert recipes from external APIs
router.post("/fetch-recipes", authenticateUser, async (_req, res) => {
  try {
    const result = await fetchRecipes();
    res.status(201).json({
      message: "Recipes fetched and inserted successfully",
      success: result.success,
      count: result.count,
    });
  } catch (error) {
    console.error("Error fetching recipes:", error);
    res.status(500).json({ message: "Failed to fetch recipes" });
  }
});

// GET /api/recipes - Get recipes from database (up to 50)
router.get("/", getRecipes);

export default router;