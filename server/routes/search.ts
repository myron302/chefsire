// server/routes/search.ts
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { storage } from "../storage";
import { searchRecipes } from "../services/recipes-service";
import { searchDrinks } from "../services/drinks-service";
import { db } from "../db";
import { posts, users } from "@shared/schema";
import { and, desc, eq, ilike } from "drizzle-orm";

const router = Router();

type DrinkIndexEntry = { name: string; route: string };
type DrinkIndexFile = {
  recipes?: Record<string, DrinkIndexEntry>;
  routes?: Array<{ route: string; title: string }>;
  duplicates?: Array<{ key: string; name: string; keptRoute: string; duplicateRoute: string }>;
  generatedAt?: string;
};

let drinkIndexCache: DrinkIndexFile | null | undefined;

function normalizeDrinkQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function loadDrinkIndex(): DrinkIndexFile | null {
  if (drinkIndexCache !== undefined) {
    return drinkIndexCache;
  }

  try {
    const filePath = path.join(process.cwd(), "server", "generated", "drink-index.json");
    const json = fs.readFileSync(filePath, "utf8");
    drinkIndexCache = JSON.parse(json) as DrinkIndexFile;
  } catch {
    drinkIndexCache = null;
  }

  return drinkIndexCache;
}

/**
 * GET /api/search/autocomplete
 * Unified autocomplete endpoint that searches across users, recipes, drinks, reviews, and pet food.
 * Returns top results from each category.
 */
router.get("/autocomplete", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";

    if (!query || query.trim().length === 0) {
      return res.json({
        users: [],
        recipes: [],
        drinks: [],
        reviews: [],
        petFoods: [],
      });
    }

    const trimmedQuery = query.trim();
    const qLower = trimmedQuery.toLowerCase();
    const drinkIndex = loadDrinkIndex();

    // --- Static site categories (drinks + pet food) ---
    // These routes exist as top-level categories/subpages in the app.
    const DRINK_ROUTES: Array<{ id: string; name: string; route: string; category?: string }> = [
      // Category hubs
      { id: "caffeinated", name: "Caffeinated Drinks", route: "/drinks/caffeinated", category: "caffeinated" },
      { id: "smoothies", name: "Smoothies", route: "/drinks/smoothies", category: "smoothies" },
      { id: "protein-shakes", name: "Protein Shakes", route: "/drinks/protein-shakes", category: "protein-shakes" },
      { id: "detoxes", name: "Detoxes & Cleanses", route: "/drinks/detoxes", category: "detoxes" },
      { id: "potent-potables", name: "Potent Potables", route: "/drinks/potent-potables", category: "potent-potables" },

      // Caffeinated
      { id: "espresso", name: "Espresso Drinks", route: "/drinks/caffeinated/espresso", category: "caffeinated" },
      { id: "cold-brew", name: "Cold Brew", route: "/drinks/caffeinated/cold-brew", category: "caffeinated" },
      { id: "tea", name: "Tea", route: "/drinks/caffeinated/tea", category: "caffeinated" },
      { id: "matcha", name: "Matcha", route: "/drinks/caffeinated/matcha", category: "caffeinated" },
      { id: "energy", name: "Energy Drinks", route: "/drinks/caffeinated/energy", category: "caffeinated" },
      { id: "specialty", name: "Specialty Coffee", route: "/drinks/caffeinated/specialty", category: "caffeinated" },
      { id: "lattes", name: "Lattes", route: "/drinks/caffeinated/lattes", category: "caffeinated" },
      { id: "iced", name: "Iced Coffee", route: "/drinks/caffeinated/iced", category: "caffeinated" },

      // Smoothies
      { id: "breakfast", name: "Breakfast Smoothies", route: "/drinks/smoothies/breakfast", category: "smoothies" },
      { id: "dessert", name: "Dessert Smoothies", route: "/drinks/smoothies/dessert", category: "smoothies" },
      { id: "green", name: "Green Smoothies", route: "/drinks/smoothies/green", category: "smoothies" },
      { id: "protein", name: "Protein Smoothies", route: "/drinks/smoothies/protein", category: "smoothies" },
      { id: "workout", name: "Workout Smoothies", route: "/drinks/smoothies/workout", category: "smoothies" },
      { id: "tropical", name: "Tropical Smoothies", route: "/drinks/smoothies/tropical", category: "smoothies" },
      { id: "berry", name: "Berry Smoothies", route: "/drinks/smoothies/berry", category: "smoothies" },
      { id: "detox-smoothies", name: "Detox Smoothies", route: "/drinks/smoothies/detox", category: "smoothies" },

      // Protein shakes
      { id: "whey", name: "Whey Protein", route: "/drinks/protein-shakes/whey", category: "protein-shakes" },
      { id: "casein", name: "Casein Protein", route: "/drinks/protein-shakes/casein", category: "protein-shakes" },
      { id: "collagen", name: "Collagen Protein", route: "/drinks/protein-shakes/collagen", category: "protein-shakes" },
      { id: "plant-based", name: "Plant-Based Protein", route: "/drinks/protein-shakes/plant-based", category: "protein-shakes" },
      { id: "egg", name: "Egg Protein", route: "/drinks/protein-shakes/egg", category: "protein-shakes" },
      { id: "beef", name: "Beef Protein", route: "/drinks/protein-shakes/beef", category: "protein-shakes" },

      // Detoxes
      { id: "juice", name: "Detox Juices", route: "/drinks/detoxes/juice", category: "detoxes" },
      { id: "detox-tea", name: "Detox Teas", route: "/drinks/detoxes/tea", category: "detoxes" },
      { id: "water", name: "Detox Waters", route: "/drinks/detoxes/water", category: "detoxes" },

      // Potent potables
      { id: "cocktails", name: "Cocktails", route: "/drinks/potent-potables/cocktails", category: "potent-potables" },
      { id: "mocktails", name: "Mocktails", route: "/drinks/potent-potables/mocktails", category: "potent-potables" },
      { id: "rum", name: "Rum", route: "/drinks/potent-potables/rum", category: "potent-potables" },
      { id: "vodka", name: "Vodka", route: "/drinks/potent-potables/vodka", category: "potent-potables" },
      { id: "whiskey-bourbon", name: "Whiskey & Bourbon", route: "/drinks/potent-potables/whiskey-bourbon", category: "potent-potables" },
      { id: "scotch-irish-whiskey", name: "Scotch & Irish Whiskey", route: "/drinks/potent-potables/scotch-irish-whiskey", category: "potent-potables" },
      { id: "gin", name: "Gin", route: "/drinks/potent-potables/gin", category: "potent-potables" },
      { id: "tequila-mezcal", name: "Tequila & Mezcal", route: "/drinks/potent-potables/tequila-mezcal", category: "potent-potables" },
      { id: "martinis", name: "Martinis", route: "/drinks/potent-potables/martinis", category: "potent-potables" },
      { id: "spritz", name: "Spritz", route: "/drinks/potent-potables/spritz", category: "potent-potables" },
      { id: "liqueurs", name: "Liqueurs", route: "/drinks/potent-potables/liqueurs", category: "potent-potables" },
      { id: "cognac-brandy", name: "Cognac & Brandy", route: "/drinks/potent-potables/cognac-brandy", category: "potent-potables" },
      { id: "daiquiri", name: "Daiquiri", route: "/drinks/potent-potables/daiquiri", category: "potent-potables" },
      { id: "hot-drinks", name: "Hot Drinks", route: "/drinks/potent-potables/hot-drinks", category: "potent-potables" },
      { id: "seasonal", name: "Seasonal", route: "/drinks/potent-potables/seasonal", category: "potent-potables" },
    ];

    const PET_FOOD_ROUTES: Array<{ id: string; name: string; route: string }> = [
      { id: "pet-food", name: "Pet Food", route: "/pet-food" },
      { id: "dogs", name: "Dog Food", route: "/pet-food/dogs" },
      { id: "cats", name: "Cat Food", route: "/pet-food/cats" },
      { id: "birds", name: "Bird Food", route: "/pet-food/birds" },
      { id: "small-pets", name: "Small Pets", route: "/pet-food/small-pets" },
    ];

    const drinkCategoryMatches = DRINK_ROUTES
      .filter(
        (x) =>
          x.name.toLowerCase().includes(qLower) ||
          x.id.toLowerCase().includes(qLower) ||
          x.route.toLowerCase().includes(qLower)
      )
      .slice(0, 5)
      .map((x) => ({
        id: x.id,
        name: x.name,
        category: x.category,
        route: x.route,
        type: "drink" as const,
        matchKind: "category" as const,
      }));

    // If the user's free-text query strongly matches a known drinks route,
    // prefer routing cocktail-name results to that category/subcategory page
    // so users land on pages that render recipe cards.
    const bestDrinkRoute = (() => {
      const exact = DRINK_ROUTES.find(
        (x) => x.id.toLowerCase() === qLower || x.name.toLowerCase() === qLower
      );
      if (exact) return exact.route;

      const containsId = DRINK_ROUTES.find((x) => x.id.toLowerCase().includes(qLower));
      if (containsId) return containsId.route;

      const containsName = DRINK_ROUTES.find((x) => x.name.toLowerCase().includes(qLower));
      if (containsName) return containsName.route;

      return null;
    })();

    const exactDrinkRouteMatch = DRINK_ROUTES.find(
      (x) => x.id.toLowerCase() === qLower || x.name.toLowerCase() === qLower
    );
    const exactDrinkRecipe = exactDrinkRouteMatch
      ? null
      : drinkIndex?.recipes?.[normalizeDrinkQuery(trimmedQuery)];

    const exactDrinkMatch = exactDrinkRecipe
      ? {
          id: `indexed-${normalizeDrinkQuery(exactDrinkRecipe.name)}`,
          name: exactDrinkRecipe.name,
          route: exactDrinkRecipe.route,
          type: "drink" as const,
          matchKind: "recipe-exact" as const,
        }
      : null;

    const petFoodMatches = PET_FOOD_ROUTES
      .filter(
        (x) =>
          x.name.toLowerCase().includes(qLower) ||
          x.id.toLowerCase().includes(qLower) ||
          x.route.toLowerCase().includes(qLower)
      )
      .slice(0, 5)
      .map((x) => ({
        id: x.id,
        name: x.name,
        route: x.route,
        type: "pet-food" as const,
      }));

    // Search in parallel for better performance
    const [foundUsers, recipesResult, cocktailDbDrinks, reviewPosts] = await Promise.all([
      // Search users
      storage.searchUsers(trimmedQuery, 5).then((list) =>
        list.map((user) => ({
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
        .then((result) =>
          result.results.map((recipe) => ({
            id: recipe.id,
            title: recipe.title,
            imageUrl: recipe.image,
            cookTime: recipe.readyInMinutes,
            source: recipe.source || "external",
            type: "recipe" as const,
          }))
        )
        .catch(() => []),

      // Search drinks by name (CocktailDB). We link to the drinks hub search.
      searchDrinks({ q: trimmedQuery, pageSize: 5, offset: 0 })
        .then(({ results }) =>
          results.slice(0, 5).map((d) => ({
            id: d.id,
            name: d.title,
            imageUrl: d.imageUrl || undefined,
            category: d.category || undefined,
            // Prefer a real drinks category/subcategory page when the query matches one,
            // otherwise fall back to the drinks hub query.
            route: bestDrinkRoute || `/drinks?q=${encodeURIComponent(trimmedQuery)}`,
            type: "drink" as const,
            matchKind: "external" as const,
          }))
        )
        .catch(() => []),

      // Search restaurant reviews (these are posts whose caption contains "📝 Review:")
      (db && typeof (db as any).select === "function"
        ? (db as any)
            .select({ post: posts, user: users })
            .from(posts)
            .innerJoin(users, eq(posts.userId, users.id))
            .where(and(ilike(posts.caption, "%📝 Review:%"), ilike(posts.caption, `%${trimmedQuery}%`)))
            .orderBy(desc(posts.createdAt))
            .limit(5)
            .then((rows: any[]) =>
              rows.map((row: any) => ({
                id: row.post.id,
                caption: row.post.caption,
                createdAt: row.post.createdAt,
                user: {
                  id: row.user.id,
                  username: row.user.username,
                  displayName: row.user.displayName,
                  avatar: row.user.avatar,
                },
              }))
            )
            .catch(() => [])
        : Promise.resolve([])),
    ]);

    // Merge drinks: category routes first (site navigation), then drink-name matches.
    const mergedDrinks = [exactDrinkMatch, ...drinkCategoryMatches, ...cocktailDbDrinks]
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .slice(0, 10);

    // Reviews: extract restaurant name from caption's first line when possible.
    const reviews = (reviewPosts as any[]).map((p) => {
      const cap = String(p.caption || "").trim();
      const firstLine = cap.split("\n")[0] || "";
      const raw = firstLine.replace(/^📝\s*Review:\s*/i, "").trim();
      const name = raw.split(",")[0]?.trim() || raw || "Review";
      return {
        id: p.id,
        name,
        route: `/reviews?q=${encodeURIComponent(name)}`,
        type: "review" as const,
      };
    });

    res.json({
      users: foundUsers,
      recipes: recipesResult,
      drinks: mergedDrinks,
      reviews,
      petFoods: petFoodMatches,
      query: trimmedQuery,
    });
  } catch (error) {
    console.error("Autocomplete error:", error);
    res.status(500).json({
      message: "Failed to perform autocomplete search",
      users: [],
      recipes: [],
      drinks: [],
      reviews: [],
      petFoods: [],
    });
  }
});

export default router;
