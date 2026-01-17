// server/routes/search.ts
import { Router } from "express";
import { storage } from "../storage";
import { searchRecipes } from "../services/recipes-service";

const router = Router();

/**
 * GET /api/search/autocomplete
 * Unified autocomplete endpoint that searches across users, recipes, and drinks
 * Returns top 5 results from each category
 */
router.get("/autocomplete", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";

    if (!query || query.trim().length === 0) {
      return res.json({
        users: [],
        recipes: [],
        drinks: []
      });
    }

    const trimmedQuery = query.trim();

    // Search in parallel for better performance
    const [users, recipesResult, customDrinks] = await Promise.all([
      // Search users
      storage.searchUsers(trimmedQuery, 5).then(users =>
        users.map(user => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          specialty: user.specialty,
          isChef: user.isChef,
          type: "user" as const,
        }))
      ),

      // Search recipes (external APIs)
      searchRecipes({ q: trimmedQuery, pageSize: 5, offset: 0 })
        .then(result => result.results.map(recipe => ({
          id: recipe.id,
          title: recipe.title,
          imageUrl: recipe.image,
          cookTime: recipe.readyInMinutes,
          source: recipe.source || "external",
          type: "recipe" as const,
        })))
        .catch(() => []),

      // Search custom drinks
      storage.getPublicCustomDrinks(undefined, 100)
        .then(drinks =>
          drinks
            .filter(drink =>
              drink.name.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
              drink.description?.toLowerCase().includes(trimmedQuery.toLowerCase())
            )
            .slice(0, 5)
            .map(drink => ({
              id: drink.id,
              name: drink.name,
              imageUrl: drink.imageUrl,
              category: drink.category,
              type: "drink" as const,
            }))
        )
        .catch(() => []),
    ]);

    res.json({
      users,
      recipes: recipesResult,
      drinks: customDrinks,
      query: trimmedQuery,
    });
  } catch (error) {
    console.error("Autocomplete error:", error);
    res.status(500).json({
      message: "Failed to perform autocomplete search",
      users: [],
      recipes: [],
      drinks: [],
    });
  }
});

export default router;
