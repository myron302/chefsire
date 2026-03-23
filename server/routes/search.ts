// server/routes/search.ts
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storage } from "../storage";
import { searchRecipes } from "../services/recipes-service";
import { searchDrinks } from "../services/drinks-service";
import { db } from "../db";
import { posts, users } from "@shared/schema";
import { and, desc, eq, ilike } from "drizzle-orm";
import { parseContentSourceFilter } from "@shared/content-source";

const router = Router();

type DrinkIndexEntry = { name: string; route: string };
type DrinkRouteIndexEntry = { route: string; title: string };
type DrinkRouteSearchEntry = {
  id: string;
  name: string;
  route: string;
  category?: string;
  isHub: boolean;
  keywords: string[];
};
type DrinkIndexFile = {
  recipes?: Record<string, DrinkIndexEntry>;
  routes?: DrinkRouteIndexEntry[];
  duplicates?: Array<{ key: string; name: string; keptRoute: string; duplicateRoute: string }>;
  generatedAt?: string;
};

const DRINK_CATEGORY_HUBS: DrinkRouteSearchEntry[] = [
  { id: 'caffeinated', name: 'Caffeinated Drinks', route: '/drinks/caffeinated', category: 'caffeinated', isHub: true, keywords: ['coffee', 'tea', 'energy', 'caffeine'] },
  { id: 'smoothies', name: 'Smoothies', route: '/drinks/smoothies', category: 'smoothies', isHub: true, keywords: ['blends', 'fruit', 'veggie'] },
  { id: 'protein-shakes', name: 'Protein Shakes', route: '/drinks/protein-shakes', category: 'protein-shakes', isHub: true, keywords: ['whey', 'casein', 'plant based', 'collagen'] },
  { id: 'detoxes', name: 'Detoxes & Cleanses', route: '/drinks/detoxes', category: 'detoxes', isHub: true, keywords: ['juice', 'tea', 'water', 'cleanse'] },
  { id: 'workout-drinks', name: 'Workout Drinks', route: '/drinks/workout-drinks', category: 'workout-drinks', isHub: true, keywords: ['pre workout', 'post workout', 'hydration', 'energy boosters'] },
  { id: 'potent-potables', name: 'Potent Potables', route: '/drinks/potent-potables', category: 'potent-potables', isHub: true, keywords: ['cocktails', 'mocktails', 'spirits', 'zero proof'] },
];

let drinkIndexCache: DrinkIndexFile | null | undefined;
let drinkIndexLooseCache: Record<string, DrinkIndexEntry> | null | undefined;
let drinkRouteSearchCache: DrinkRouteSearchEntry[] | null | undefined;

function normalizeDrinkQuery(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeDrinkQueryLoose(value: string): string {
  return normalizeDrinkQuery(value).replace(/[^a-z0-9\s&/-]/g, "");
}

function lookupDrinkRecipeByQuery(index: DrinkIndexFile | null, query: string): DrinkIndexEntry | null {
  if (!index?.recipes) return null;

  const strictKey = normalizeDrinkQuery(query);
  if (strictKey && index.recipes[strictKey]) {
    return index.recipes[strictKey];
  }

  const looseKey = normalizeDrinkQueryLoose(query);
  if (!looseKey) return null;

  if (drinkIndexLooseCache === undefined || drinkIndexLooseCache === null) {
    drinkIndexLooseCache = {};
    for (const [key, value] of Object.entries(index.recipes)) {
      const loose = normalizeDrinkQueryLoose(key);
      if (loose && !drinkIndexLooseCache[loose]) {
        drinkIndexLooseCache[loose] = value;
      }
    }
  }

  return drinkIndexLooseCache[looseKey] || null;
}

function slugSegmentToTitle(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function categoryNameFromSegment(segment: string): string {
  switch (segment) {
    case "caffeinated":
      return "Caffeinated Drinks";
    case "protein-shakes":
      return "Protein Shakes";
    case "detoxes":
      return "Detoxes & Cleanses";
    case "workout-drinks":
      return "Workout Drinks";
    case "potent-potables":
      return "Potent Potables";
    default:
      return slugSegmentToTitle(segment);
  }
}

function buildDrinkRouteSearchEntries(index: DrinkIndexFile | null): DrinkRouteSearchEntry[] {
  const routeMap = new Map<string, DrinkRouteSearchEntry>();

  for (const hub of DRINK_CATEGORY_HUBS) {
    routeMap.set(hub.route, hub);
  }

  for (const routeEntry of index?.routes ?? []) {
    const route = String(routeEntry.route ?? "").trim();
    if (!route.startsWith("/drinks/")) continue;

    const segments = route.replace(/^\/drinks\//, "").split("/").filter(Boolean);
    if (segments.length < 2) continue;

    const category = segments[0];
    const leaf = segments[segments.length - 1];
    const title = String(routeEntry.title ?? "").trim() || slugSegmentToTitle(leaf);
    const categoryName = categoryNameFromSegment(category);
    const entry: DrinkRouteSearchEntry = {
      id: `${category}-${leaf}`,
      name: title,
      route,
      category,
      isHub: false,
      keywords: [leaf, category, categoryName, route.replace(/^\/drinks\//, '').replace(/\//g, ' '), `${categoryName} ${title}`],
    };

    routeMap.set(route, entry);
  }

  return [...routeMap.values()];
}

function scoreDrinkRouteMatch(entry: DrinkRouteSearchEntry, query: string): number {
  const normalizedQuery = normalizeDrinkQuery(query);
  if (!normalizedQuery) return Number.POSITIVE_INFINITY;

  const normalizedName = normalizeDrinkQuery(entry.name);
  const normalizedId = normalizeDrinkQuery(entry.id.replace(/-/g, ' '));
  const normalizedRoute = normalizeDrinkQuery(entry.route.replace(/^\/drinks\//, '').replace(/\//g, ' '));
  const normalizedKeywords = entry.keywords.map((keyword) => normalizeDrinkQuery(keyword));

  if (normalizedName == normalizedQuery) return entry.isHub ? 0 : 1;
  if (normalizedId == normalizedQuery) return entry.isHub ? 2 : 3;
  if (normalizedRoute == normalizedQuery) return entry.isHub ? 4 : 5;
  if (normalizedKeywords.includes(normalizedQuery)) return entry.isHub ? 6 : 7;
  if (normalizedName.startsWith(normalizedQuery)) return entry.isHub ? 8 : 9;
  if (normalizedId.startsWith(normalizedQuery)) return entry.isHub ? 10 : 11;
  if (normalizedRoute.startsWith(normalizedQuery)) return entry.isHub ? 12 : 13;
  if (normalizedName.includes(normalizedQuery)) return entry.isHub ? 14 : 15;
  if (normalizedKeywords.some((keyword) => keyword.includes(normalizedQuery))) return entry.isHub ? 16 : 17;
  if (normalizedRoute.includes(normalizedQuery)) return entry.isHub ? 18 : 19;
  return Number.POSITIVE_INFINITY;
}

function loadDrinkIndex(): DrinkIndexFile | null {
  if (drinkIndexCache !== undefined) {
    return drinkIndexCache;
  }

  try {
    const routesDir = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(routesDir, "..", "generated", "drink-index.json");
    const json = fs.readFileSync(filePath, "utf8");
    drinkIndexCache = JSON.parse(json) as DrinkIndexFile;
    drinkIndexLooseCache = null;
    drinkRouteSearchCache = null;
  } catch {
    drinkIndexCache = null;
    drinkIndexLooseCache = null;
    drinkRouteSearchCache = null;
  }

  return drinkIndexCache;
}

function loadDrinkRouteSearchEntries(index: DrinkIndexFile | null): DrinkRouteSearchEntry[] {
  if (drinkRouteSearchCache !== undefined && drinkRouteSearchCache !== null) {
    return drinkRouteSearchCache;
  }

  drinkRouteSearchCache = buildDrinkRouteSearchEntries(index);
  return drinkRouteSearchCache;
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
        petFoods: []
      });
    }

    const trimmedQuery = query.trim();
    const qLower = trimmedQuery.toLowerCase();
    const source = parseContentSourceFilter(req.query.source);
    const drinkIndex = loadDrinkIndex();
    const drinkRoutes = loadDrinkRouteSearchEntries(drinkIndex);

    const PET_FOOD_ROUTES: Array<{ id: string; name: string; route: string }> = [
      { id: "pet-food", name: "Pet Food", route: "/pet-food" },
      { id: "dogs", name: "Dog Food", route: "/pet-food/dogs" },
      { id: "cats", name: "Cat Food", route: "/pet-food/cats" },
      { id: "birds", name: "Bird Food", route: "/pet-food/birds" },
      { id: "small-pets", name: "Small Pets", route: "/pet-food/small-pets" }
    ];

    const rankedDrinkRoutes = drinkRoutes
      .map((entry) => ({ entry, score: scoreDrinkRouteMatch(entry, trimmedQuery) }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((a, b) => a.score - b.score || a.entry.route.length - b.entry.route.length || a.entry.name.localeCompare(b.entry.name));

    const drinkCategoryMatches = rankedDrinkRoutes
      .slice(0, 5)
      .map(({ entry }) => ({
        id: entry.id,
        name: entry.name,
        category: entry.category,
        route: entry.route,
        type: "drink" as const,
        matchKind: "category" as const
      }));

    const bestDrinkRoute = rankedDrinkRoutes[0]?.entry.route ?? null;
    const exactDrinkRouteMatch = rankedDrinkRoutes.find(({ score }) => score <= 7)?.entry ?? null;

    const exactDrinkRecipe = exactDrinkRouteMatch ? null : lookupDrinkRecipeByQuery(drinkIndex, trimmedQuery);

    const exactDrinkMatch = exactDrinkRecipe
      ? {
          id: `indexed-${normalizeDrinkQuery(exactDrinkRecipe.name)}`,
          name: exactDrinkRecipe.name,
          route: exactDrinkRecipe.route,
          type: "drink" as const,
          matchKind: "recipe-exact" as const
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
        type: "pet-food" as const
      }));

    const [foundUsers, recipesResult, cocktailDbDrinks, reviewPosts] = await Promise.all([
      storage
        .searchUsers(trimmedQuery, 5)
        .then((list) =>
          list.map((user) => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            specialty: user.specialty,
            isChef: user.isChef,
            type: "user" as const
          }))
        )
        .catch(() => []),

      searchRecipes({ q: trimmedQuery, pageSize: 5, offset: 0, source })
        .then((result) =>
          result.results.map((recipe) => ({
            id: recipe.id,
            title: recipe.title,
            imageUrl: recipe.image,
            cookTime: recipe.readyInMinutes,
            source: recipe.source || "external",
            type: "recipe" as const
          }))
        )
        .catch(() => []),

      searchDrinks({ q: trimmedQuery, pageSize: 5, offset: 0, source })
        .then(({ results }) =>
          results.slice(0, 5).map((d) => ({
            id: d.id,
            name: d.title,
            imageUrl: d.imageUrl || undefined,
            category: d.category || undefined,
            route: bestDrinkRoute || `/drinks?q=${encodeURIComponent(trimmedQuery)}`,
            type: "drink" as const,
            matchKind: "external" as const,
            source: d.source
          }))
        )
        .catch(() => []),

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
                  avatar: row.user.avatar
                }
              }))
            )
            .catch(() => [])
        : Promise.resolve([]))
    ]);

    const mergedDrinks = [exactDrinkMatch, ...drinkCategoryMatches, ...cocktailDbDrinks]
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .filter((drink, index, array) => {
        const key = `${drink.name.toLowerCase()}|${(drink as any).route || ""}`;
        return index === array.findIndex((candidate) => `${candidate.name.toLowerCase()}|${(candidate as any).route || ""}` === key);
      })
      .slice(0, 10);

    const reviews = (reviewPosts as any[]).map((p) => {
      const cap = String(p.caption || "").trim();
      const firstLine = cap.split("\n")[0] || "";
      const raw = firstLine.replace(/^📝\s*Review:\s*/i, "").trim();
      const name = raw.split(",")[0]?.trim() || raw || "Review";
      return {
        id: p.id,
        name,
        route: `/reviews?q=${encodeURIComponent(name)}`,
        type: "review" as const
      };
    });

    res.json({
      source,
      users: foundUsers,
      recipes: recipesResult,
      drinks: mergedDrinks,
      reviews,
      petFoods: petFoodMatches,
      query: trimmedQuery
    });
  } catch (error) {
    console.error("Autocomplete error:", error);
    res.status(500).json({
      message: "Failed to perform autocomplete search",
      users: [],
      recipes: [],
      drinks: [],
      reviews: [],
      petFoods: []
    });
  }
});

export default router;
