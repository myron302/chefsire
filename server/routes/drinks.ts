// server/routes/drinks.ts
import { Router } from "express";
import { and, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { listMeta, lookupDrink, randomDrink, searchDrinks } from "../services/drinks-service";
import { storage } from "../storage";
import { db } from "../db";
import { getCanonicalDrinkBySlug } from "../services/canonical-drinks-index";
import { 
  insertCustomDrinkSchema, 
  insertDrinkPhotoSchema,
  insertDrinkLikeSchema,
  insertDrinkSaveSchema,
  drinkEvents,
  drinkRecipes,
  follows,
  insertDrinkRecipeSchema,
  users,
} from "@shared/schema";
import { z } from "zod";
import { parseTrackedEventBody, resolveEngagementUserId } from "./engagement-events";
import { requireAuth } from "../middleware";

const r = Router();

type EventType = "view" | "remix" | "grocery_add";

const TRACKABLE_DRINK_EVENTS = new Set<EventType>(["view", "remix", "grocery_add"]);

function slugifyDrinkRecipeName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSlug(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().toLowerCase();
  return cleaned.length ? cleaned : undefined;
}

async function getUserRecipeBySlug(slug: string) {
  if (!db) return null;
  const rows = await db.select().from(drinkRecipes).where(eq(drinkRecipes.slug, slug)).limit(1);
  return rows[0] ?? null;
}

async function resolveDrinkDetailsBySlug(slug: string) {
  const canonicalRecipe = getCanonicalDrinkBySlug(slug);
  if (canonicalRecipe) {
    return {
      slug: canonicalRecipe.slug,
      name: canonicalRecipe.name,
      image: canonicalRecipe.image ?? null,
      route: canonicalRecipe.route,
      sourceCategoryRoute: canonicalRecipe.sourceRoute,
      source: "chefsire" as const,
      category: canonicalRecipe.sourceRoute.replace("/drinks/", "").split("/")[0] ?? "",
      subcategory: canonicalRecipe.sourceRoute.replace("/drinks/", "").split("/")[1] ?? null,
    };
  }

  const userRecipe = await getUserRecipeBySlug(slug);
  if (!userRecipe) return null;

  return {
    slug: userRecipe.slug,
    name: userRecipe.name,
    image: userRecipe.image ?? null,
    route: `/drinks/recipe/${userRecipe.slug}`,
    sourceCategoryRoute: `/drinks/${userRecipe.category}${userRecipe.subcategory ? `/${userRecipe.subcategory}` : ""}`,
    source: "chefsire" as const,
    category: userRecipe.category,
    subcategory: userRecipe.subcategory ?? null,
  };
}

type RemixChainNode = {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  isCanonical: boolean;
  remixedFromSlug: string | null;
  creatorId?: string | null;
  creatorUsername?: string | null;
};

function toRemixChainNodeFromCanonical(slug: string): RemixChainNode | null {
  const canonicalRecipe = getCanonicalDrinkBySlug(slug);
  if (!canonicalRecipe) return null;

  return {
    slug: canonicalRecipe.slug,
    name: canonicalRecipe.name,
    image: canonicalRecipe.image ?? null,
    route: canonicalRecipe.route,
    isCanonical: true,
    remixedFromSlug: null,
  };
}

function toRemixChainNodeFromUserRecipe(recipe: typeof drinkRecipes.$inferSelect): RemixChainNode {
  return {
    slug: recipe.slug,
    name: recipe.name,
    image: recipe.image ?? null,
    route: `/drinks/recipe/${recipe.slug}`,
    isCanonical: false,
    remixedFromSlug: recipe.remixedFromSlug ?? null,
    creatorId: recipe.userId ?? null,
  };
}

async function hydrateRemixNodeCreator(node: RemixChainNode): Promise<RemixChainNode> {
  if (!db || node.isCanonical || !node.creatorId) return node;

  const creator = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, node.creatorId))
    .limit(1);

  return {
    ...node,
    creatorUsername: creator[0]?.username ?? null,
  };
}

async function resolveRemixChainNode(slug: string): Promise<RemixChainNode | null> {
  const canonicalNode = toRemixChainNodeFromCanonical(slug);
  if (canonicalNode) return canonicalNode;

  const userRecipe = await getUserRecipeBySlug(slug);
  if (!userRecipe) return null;
  return toRemixChainNodeFromUserRecipe(userRecipe);
}

type CreatorLeaderboardRow = {
  userId: string;
  username: string | null;
  avatar: string | null;
  creatorScore: number;
  totalCreated: number;
  totalViews7d: number;
  totalRemixesReceived: number;
  totalGroceryAdds: number;
  followerCount?: number;
  topDrink: {
    slug: string;
    name: string;
    image: string | null;
    route: string;
    score: number;
  } | null;
};

async function getDrinkCreatorLeaderboard(limit = 10): Promise<CreatorLeaderboardRow[]> {
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(limit, 50));
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const createdRows = await db
    .select({ userId: drinkRecipes.userId, totalCreated: sql<number>`count(*)` })
    .from(drinkRecipes)
    .where(sql`${drinkRecipes.userId} is not null`)
    .groupBy(drinkRecipes.userId);

  if (createdRows.length === 0) return [];

  const creatorIds = createdRows.map((row) => row.userId).filter((userId): userId is string => Boolean(userId));
  if (creatorIds.length === 0) return [];

  const creatorRecipes = await db
    .select({ slug: drinkRecipes.slug, name: drinkRecipes.name, image: drinkRecipes.image, userId: drinkRecipes.userId })
    .from(drinkRecipes)
    .where(inArray(drinkRecipes.userId, creatorIds));

  if (creatorRecipes.length === 0) return [];

  const recipeSlugs = creatorRecipes.map((recipe) => recipe.slug);

  const eventRows = await db
    .select({
      slug: drinkEvents.slug,
      views7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view')`,
      groceryAdds7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add')`,
    })
    .from(drinkEvents)
    .where(and(inArray(drinkEvents.slug, recipeSlugs), gt(drinkEvents.createdAt, sevenDaysAgo)))
    .groupBy(drinkEvents.slug);

  const remixedByOthersRows = await db
    .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
    .from(drinkRecipes)
    .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
    .groupBy(drinkRecipes.remixedFromSlug);

  const profiles = await db
    .select({ id: users.id, username: users.username, avatar: users.avatar, followersCount: users.followersCount })
    .from(users)
    .where(inArray(users.id, creatorIds));

  const createdByUser = new Map(
    createdRows
      .filter((row): row is { userId: string; totalCreated: number } => Boolean(row.userId))
      .map((row) => [row.userId, Number(row.totalCreated ?? 0)])
  );

  const eventsBySlug = new Map(
    eventRows.map((row) => [row.slug, { views7d: Number(row.views7d ?? 0), groceryAdds7d: Number(row.groceryAdds7d ?? 0) }])
  );

  const remixesBySlug = new Map(
    remixedByOthersRows
      .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
      .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
  );

  const profileById = new Map(profiles.map((profile) => [profile.id, {
    username: profile.username,
    avatar: profile.avatar,
    followersCount: Number(profile.followersCount ?? 0),
  }]));

  const recipesByCreator = new Map<string, Array<typeof creatorRecipes[number]>>();
  for (const recipe of creatorRecipes) {
    if (!recipe.userId) continue;
    const current = recipesByCreator.get(recipe.userId) ?? [];
    current.push(recipe);
    recipesByCreator.set(recipe.userId, current);
  }

  const rows: CreatorLeaderboardRow[] = creatorIds.map((creatorId) => {
    const creatorRecipeRows = recipesByCreator.get(creatorId) ?? [];
    const totals = creatorRecipeRows.reduce((acc, recipe) => {
      const metrics = eventsBySlug.get(recipe.slug) ?? { views7d: 0, groceryAdds7d: 0 };
      const remixesCount = remixesBySlug.get(recipe.slug) ?? 0;
      const recipeScore = metrics.views7d + (remixesCount * 4) + (metrics.groceryAdds7d * 2);

      if (!acc.topDrink || recipeScore > acc.topDrink.score) {
        acc.topDrink = {
          slug: recipe.slug,
          name: recipe.name,
          image: recipe.image ?? null,
          route: `/drinks/recipe/${recipe.slug}`,
          score: recipeScore,
        };
      }

      acc.totalViews7d += metrics.views7d;
      acc.totalRemixesReceived += remixesCount;
      acc.totalGroceryAdds += metrics.groceryAdds7d;
      return acc;
    }, {
      totalViews7d: 0,
      totalRemixesReceived: 0,
      totalGroceryAdds: 0,
      topDrink: null as CreatorLeaderboardRow["topDrink"],
    });

    const totalCreated = createdByUser.get(creatorId) ?? creatorRecipeRows.length;
    const creatorScore =
      (totals.totalViews7d * 1) +
      (totals.totalRemixesReceived * 4) +
      (totals.totalGroceryAdds * 2) +
      (totalCreated * 0.5);

    const creatorProfile = profileById.get(creatorId);

    return {
      userId: creatorId,
      username: creatorProfile?.username ?? null,
      avatar: creatorProfile?.avatar ?? null,
      creatorScore,
      totalCreated,
      totalViews7d: totals.totalViews7d,
      totalRemixesReceived: totals.totalRemixesReceived,
      totalGroceryAdds: totals.totalGroceryAdds,
      followerCount: creatorProfile?.followersCount ?? 0,
      topDrink: totals.topDrink,
    };
  });

  return rows
    .sort((a, b) => b.creatorScore - a.creatorScore || b.totalViews7d - a.totalViews7d || b.totalRemixesReceived - a.totalRemixesReceived)
    .slice(0, safeLimit);
}


// Submit a user drink recipe
r.post("/submit", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ ok: false, error: "name is required" });
    }

    const baseSlug = slugifyDrinkRecipeName(name) || "user-drink";
    let slug = baseSlug;
    let suffix = 2;

    while (await getUserRecipeBySlug(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const parsed = insertDrinkRecipeSchema.parse({
      slug,
      name,
      description: str(req.body?.description),
      ingredients: Array.isArray(req.body?.ingredients) ? req.body.ingredients.map((v: unknown) => String(v)).filter(Boolean) : [],
      instructions: Array.isArray(req.body?.instructions) ? req.body.instructions.map((v: unknown) => String(v)).filter(Boolean) : [],
      glassware: str(req.body?.glassware),
      method: str(req.body?.method),
      prepTime: typeof req.body?.prepTime === "number" ? req.body.prepTime : undefined,
      servingSize: str(req.body?.servingSize),
      difficulty: str(req.body?.difficulty),
      spiritType: str(req.body?.spiritType),
      abv: str(req.body?.abv),
      image: str(req.body?.image),
      category: str(req.body?.category) || "smoothies",
      subcategory: str(req.body?.subcategory),
      remixedFromSlug: normalizeSlug(req.body?.remixedFromSlug),
      userId: resolveEngagementUserId(req),
    });

    const rows = await db.insert(drinkRecipes).values({ ...parsed, source: "chefsire" }).returning();
    return res.status(201).json({ ok: true, recipe: rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Invalid drink recipe data", details: error.errors });
    }

    console.error("Error submitting drink recipe:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Failed to submit drink recipe" : `Failed to submit drink recipe: ${errorMessage}`,
    });
  }
});

// Fetch remixes linked to a source canonical drink slug
r.get("/remixes/:slug", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const sourceSlug = normalizeSlug(req.params?.slug);
    if (!sourceSlug) {
      return res.status(400).json({ ok: false, error: "slug is required" });
    }

    const remixes = await db
      .select({
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        creatorUsername: users.username,
        creatorId: drinkRecipes.userId,
      })
      .from(drinkRecipes)
      .leftJoin(users, eq(drinkRecipes.userId, users.id))
      .where(eq(drinkRecipes.remixedFromSlug, sourceSlug))
      .orderBy(desc(drinkRecipes.createdAt))
      .limit(24);

    const items = remixes.map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      image: entry.image ?? null,
      creatorName: entry.creatorUsername ?? null,
      creatorId: entry.creatorId ?? null,
      createdAt: entry.createdAt,
      route: `/drinks/recipe/${entry.slug}?community=1`,
      remixedFromSlug: sourceSlug,
    }));

    return res.json({ ok: true, slug: sourceSlug, count: items.length, items });
  } catch (error) {
    console.error("Error fetching drink remixes:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink remixes" });
  }
});

// Fetch remix lineage for a canonical or community drink recipe
r.get("/remix-chain/:slug", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const slug = normalizeSlug(req.params?.slug);
    if (!slug) {
      return res.status(400).json({ ok: false, error: "slug is required" });
    }

    const currentNode = await resolveRemixChainNode(slug);
    if (!currentNode) {
      return res.status(404).json({ ok: false, error: "Recipe not found" });
    }

    const current = await hydrateRemixNodeCreator(currentNode);

    const ancestors: RemixChainNode[] = [];
    const ancestorSeen = new Set<string>([current.slug]);
    let parentSlug = current.remixedFromSlug;

    while (parentSlug && !ancestorSeen.has(parentSlug) && ancestors.length < 16) {
      ancestorSeen.add(parentSlug);
      const parentNode = await resolveRemixChainNode(parentSlug);
      if (!parentNode) break;
      ancestors.push(await hydrateRemixNodeCreator(parentNode));
      parentSlug = parentNode.remixedFromSlug;
    }

    const descendants: Array<RemixChainNode & { parentSlug: string; depth: number }> = [];
    const descendantSeen = new Set<string>([current.slug]);
    let frontier = [current.slug];
    let depth = 1;

    while (frontier.length > 0 && depth <= 6 && descendants.length < 200) {
      const rows = await db
        .select()
        .from(drinkRecipes)
        .where(inArray(drinkRecipes.remixedFromSlug, frontier))
        .orderBy(desc(drinkRecipes.createdAt));

      if (rows.length === 0) break;

      const nextFrontier: string[] = [];
      for (const row of rows) {
        if (descendantSeen.has(row.slug)) continue;
        descendantSeen.add(row.slug);
        descendants.push({
          ...(await hydrateRemixNodeCreator(toRemixChainNodeFromUserRecipe(row))),
          parentSlug: row.remixedFromSlug ?? current.slug,
          depth,
        });
        nextFrontier.push(row.slug);
      }

      frontier = nextFrontier;
      depth += 1;
    }

    const children = descendants.filter((entry) => entry.depth === 1);

    return res.json({
      ok: true,
      current,
      parent: ancestors[0] ?? null,
      children,
      ancestors,
      descendants,
    });
  } catch (error) {
    console.error("Error fetching drink remix chain:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink remix chain" });
  }
});

// Fetch a user-submitted drink recipe
r.get("/user/:slug", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }
    const slug = String(req.params?.slug ?? "").trim();
    if (!slug) return res.status(400).json({ ok: false, error: "slug is required" });

    const recipe = await getUserRecipeBySlug(slug);
    if (!recipe) return res.status(404).json({ ok: false, error: "Recipe not found" });

    const creator = recipe.userId
      ? await db.select({ username: users.username }).from(users).where(eq(users.id, recipe.userId)).limit(1)
      : [];

    return res.json({
      ok: true,
      recipe: {
        ...recipe,
        creatorId: recipe.userId ?? null,
        creatorUsername: creator[0]?.username ?? null,
      },
    });
  } catch (error) {
    console.error("Error fetching user drink recipe:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink recipe" });
  }
});

// Track canonical drink recipe events
r.post("/events", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const parsed = parseTrackedEventBody(req.body, TRACKABLE_DRINK_EVENTS);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ ok: false, error: parsed.error });
    }

    const { slug, eventType } = parsed;

    const canonicalRecipe = getCanonicalDrinkBySlug(slug);
    const userRecipe = canonicalRecipe ? null : await getUserRecipeBySlug(slug);
    if (!canonicalRecipe && !userRecipe) {
      return res.status(404).json({ ok: false, error: "Unknown drink slug" });
    }

    await db.insert(drinkEvents).values({
      slug,
      eventType,
      userId: resolveEngagementUserId(req),
    });

    return res.status(201).json({ ok: true });
  } catch (error: any) {
    console.error("Error logging drink event:", error);
    return res.status(500).json({ ok: false, error: "Failed to log drink event" });
  }
});

// Trending canonical drink recipes
r.get("/trending", async (_req, res) => {
  try {
    if (!db) {
      return res.json({
        ok: true,
        window: "7d",
        ranking: { formula: "views_last_24h * 3 + views_days_2_to_7 * 1 + remix_events * 4 + shopping_list_adds * 2" },
        items: [],
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const views24hSql = sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${oneDayAgo})`;
    const views7dSql = sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`;
    const remixesSql = sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'remix' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`;
    const groceryAddsSql = sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`;
    const scoreSql = sql<number>`(
      (${views24hSql} * 3)
      + (greatest(${views7dSql} - ${views24hSql}, 0) * 1)
      + (${remixesSql} * 4)
      + (${groceryAddsSql} * 2)
    )`;

    const rows = await db
      .select({
        slug: drinkEvents.slug,
        score: scoreSql,
        views24h: views24hSql,
        views7d: views7dSql,
        remixes: remixesSql,
        groceryAdds: groceryAddsSql,
      })
      .from(drinkEvents)
      .where(gt(drinkEvents.createdAt, sevenDaysAgo))
      .groupBy(drinkEvents.slug)
      .orderBy(desc(scoreSql), desc(views24hSql), desc(remixesSql), desc(groceryAddsSql), desc(views7dSql))
      .limit(10);

    const resolved = await Promise.all(rows.map((row) => resolveDrinkDetailsBySlug(row.slug)));

    const items = resolved
      .map((item, index) => {
        if (!item) return null;
        const row = rows[index];
        return {
          slug: item.slug,
          name: item.name,
          image: item.image,
          route: item.route,
          sourceCategoryRoute: item.sourceCategoryRoute,
          source: item.source,
          score: Number(row.score ?? 0),
          views7d: Number(row.views7d ?? 0),
          views24h: Number(row.views24h ?? 0),
          remixes: Number(row.remixes ?? 0),
          groceryAdds: Number(row.groceryAdds ?? 0),
        };
      })
      .filter(Boolean);

    return res.json({
      ok: true,
      window: "7d",
      ranking: {
        formula: "views_last_24h * 3 + views_days_2_to_7 * 1 + remix_events * 4 + shopping_list_adds * 2",
      },
      items,
    });
  } catch (error: any) {
    console.error("Error getting trending drinks:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch trending drinks" });
  }
});

// Trending canonical drinks scoped to a source category route
r.get("/trending/by-category", async (req, res) => {
  try {
    const sourceCategoryRoute = typeof req.query?.sourceCategoryRoute === "string"
      ? req.query.sourceCategoryRoute.trim()
      : "";

    if (!sourceCategoryRoute) {
      return res.status(400).json({ ok: false, error: "sourceCategoryRoute is required" });
    }

    if (!db) {
      return res.json({
        ok: true,
        sourceCategoryRoute,
        items: [],
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const hotScoreSql = sql<number>`
      (
        (sum(case when ${drinkEvents.createdAt} >= ${oneDayAgo} then 1 else 0 end) * 3)
        + (sum(case when ${drinkEvents.createdAt} >= ${sevenDaysAgo} then 1 else 0 end) * 1)
        + (count(*) * 0.3)
        - ((extract(epoch from (now() - max(${drinkEvents.createdAt}))) / 3600.0) * 0.05)
      )
    `;

    const rows = await db
      .select({
        slug: drinkEvents.slug,
        score: hotScoreSql,
        views7d: sql<number>`sum(case when ${drinkEvents.createdAt} >= ${sevenDaysAgo} then 1 else 0 end)`,
        views24h: sql<number>`sum(case when ${drinkEvents.createdAt} >= ${oneDayAgo} then 1 else 0 end)`,
      })
      .from(drinkEvents)
      .where(and(eq(drinkEvents.eventType, "view"), gt(drinkEvents.createdAt, thirtyDaysAgo)))
      .groupBy(drinkEvents.slug)
      .orderBy(desc(hotScoreSql), desc(sql`sum(case when ${drinkEvents.createdAt} >= ${oneDayAgo} then 1 else 0 end)`), desc(sql`sum(case when ${drinkEvents.createdAt} >= ${sevenDaysAgo} then 1 else 0 end)`));

    const resolved = await Promise.all(rows.map((row) => resolveDrinkDetailsBySlug(row.slug)));

    const items = resolved
      .map((item, index) => {
        if (!item || item.sourceCategoryRoute !== sourceCategoryRoute) return null;
        const row = rows[index];
        return {
          slug: item.slug,
          name: item.name,
          image: item.image,
          route: item.route,
          sourceCategoryRoute: item.sourceCategoryRoute,
          source: item.source,
          score: Number(row.score ?? 0),
          views7d: Number(row.views7d ?? 0),
          views24h: Number(row.views24h ?? 0),
        };
      })
      .filter(Boolean)
      .slice(0, 6);

    return res.json({
      ok: true,
      sourceCategoryRoute,
      items,
    });
  } catch (error: any) {
    console.error("Error getting category trending drinks:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch category trending drinks" });
  }
});

// Recommended canonical drinks based on recently viewed slugs
r.get("/recommended", async (req, res) => {
  try {
    const recentFromQuery = typeof req.query?.recent === "string" ? req.query.recent : "";
    const recentFromBody = Array.isArray(req.body?.recent)
      ? req.body.recent.join(",")
      : typeof req.body?.recent === "string"
        ? req.body.recent
        : "";

    const recentSlugs = (recentFromQuery || recentFromBody)
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean);

    const recentSet = new Set(recentSlugs);

    if (!db) {
      return res.json({ ok: true, items: [] });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        slug: drinkEvents.slug,
        score: sql<number>`sum(case when ${drinkEvents.createdAt} >= ${oneDayAgo} then 2 else 1 end)`,
        views7d: sql<number>`count(*)`,
      })
      .from(drinkEvents)
      .where(and(eq(drinkEvents.eventType, "view"), gt(drinkEvents.createdAt, sevenDaysAgo)))
      .groupBy(drinkEvents.slug);

    const viewerId = resolveEngagementUserId(req);
    const followedCreatorIds = viewerId
      ? (await db
          .select({ followingId: follows.followingId })
          .from(follows)
          .where(eq(follows.followerId, viewerId)))
          .map((row) => row.followingId)
      : [];

    const followedCreatorSet = new Set(followedCreatorIds);
    const recipeCreators = await db
      .select({ slug: drinkRecipes.slug, userId: drinkRecipes.userId })
      .from(drinkRecipes)
      .where(inArray(drinkRecipes.slug, rows.map((row) => row.slug)));

    const creatorBySlug = new Map(
      recipeCreators
        .filter((row): row is { slug: string; userId: string } => Boolean(row.slug) && Boolean(row.userId))
        .map((row) => [row.slug, row.userId])
    );

    const rankedRows = rows
      .map((row) => {
        const creatorId = creatorBySlug.get(row.slug);
        const followedBoost = creatorId && followedCreatorSet.has(creatorId) ? 8 : 0;
        return {
          ...row,
          rankScore: Number(row.score ?? 0) + followedBoost,
          isFollowedCreator: followedBoost > 0,
        };
      })
      .sort((a, b) => b.rankScore - a.rankScore || Number(b.score ?? 0) - Number(a.score ?? 0) || Number(b.views7d ?? 0) - Number(a.views7d ?? 0));

    const recentDetails = await Promise.all(recentSlugs.map((slug) => resolveDrinkDetailsBySlug(slug)));
    const recentCategoryRoutes = new Set(
      recentDetails
        .map((entry) => entry?.sourceCategoryRoute)
        .filter((route): route is string => Boolean(route))
    );

    const scopedRows: typeof rankedRows = [];
    for (const row of rankedRows) {
      if (recentCategoryRoutes.size === 0) {
        scopedRows.push(row);
        continue;
      }
      const details = await resolveDrinkDetailsBySlug(row.slug);
      if (details && recentCategoryRoutes.has(details.sourceCategoryRoute)) {
        scopedRows.push(row);
      }
    }

    const mapped = await Promise.all(scopedRows.map(async (row) => {
      const item = await resolveDrinkDetailsBySlug(row.slug);
      if (!item || recentSet.has(item.slug)) return null;
      return {
        slug: item.slug,
        name: item.name,
        image: item.image,
        route: item.route,
        sourceCategoryRoute: item.sourceCategoryRoute,
        source: item.source,
      };
    }));

    const items = mapped.filter(Boolean).slice(0, 8);

    return res.json({ ok: true, items });
  } catch (error: any) {
    console.error("Error getting recommended drinks:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch recommended drinks" });
  }
});

r.get("/following-feed", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const viewerId = req.user.id;
    const followedCreatorRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, viewerId));

    const followedCreatorIds = followedCreatorRows.map((row) => row.followingId).filter(Boolean);
    if (followedCreatorIds.length === 0) {
      return res.json({ ok: true, followingCount: 0, items: [] });
    }

    const recipeRows = await db
      .select({
        id: drinkRecipes.id,
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        userId: drinkRecipes.userId,
        creatorUsername: users.username,
        creatorAvatar: users.avatar,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
      })
      .from(drinkRecipes)
      .innerJoin(users, eq(drinkRecipes.userId, users.id))
      .where(inArray(drinkRecipes.userId, followedCreatorIds))
      .orderBy(desc(drinkRecipes.createdAt))
      .limit(120);

    if (recipeRows.length === 0) {
      return res.json({ ok: true, followingCount: followedCreatorIds.length, items: [] });
    }

    const recipeSlugs = recipeRows.map((row) => row.slug);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const viewRows = await db
      .select({ slug: drinkEvents.slug, views7d: sql<number>`count(*)` })
      .from(drinkEvents)
      .where(
        and(
          inArray(drinkEvents.slug, recipeSlugs),
          eq(drinkEvents.eventType, "view"),
          gt(drinkEvents.createdAt, sevenDaysAgo),
        )
      )
      .groupBy(drinkEvents.slug);

    const remixRows = await db
      .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
      .from(drinkRecipes)
      .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
      .groupBy(drinkRecipes.remixedFromSlug);

    const viewsBySlug = new Map(viewRows.map((row) => [row.slug, Number(row.views7d ?? 0)]));
    const remixesBySlug = new Map(
      remixRows
        .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
        .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)]),
    );

    const items = recipeRows
      .map((row) => {
        const createdAtMs = row.createdAt ? new Date(row.createdAt).getTime() : 0;
        const views7d = viewsBySlug.get(row.slug) ?? 0;
        const remixesCount = remixesBySlug.get(row.slug) ?? 0;
        const engagementScore = (views7d * 0.75) + (remixesCount * 3);
        const rankScore = createdAtMs + (engagementScore * 60_000);

        return {
          id: row.id,
          slug: row.slug,
          name: row.name,
          image: row.image ?? null,
          createdAt: row.createdAt,
          userId: row.userId,
          creatorUsername: row.creatorUsername ?? "unknown",
          creatorAvatar: row.creatorAvatar ?? null,
          remixedFromSlug: row.remixedFromSlug ?? null,
          views7d,
          remixesCount,
          route: `/drinks/recipe/${row.slug}`,
          rankScore,
        };
      })
      .sort((a, b) => b.rankScore - a.rankScore)
      .map(({ rankScore, ...item }) => item)
      .slice(0, 60);

    return res.json({ ok: true, followingCount: followedCreatorIds.length, items });
  } catch (error) {
    console.error("Error loading following drinks feed:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch following drinks feed" });
  }
});


r.get("/creators/leaderboard", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? limitParam : 10;
    const leaderboard = await getDrinkCreatorLeaderboard(limit);

    return res.json({ ok: true, leaderboard, count: leaderboard.length });
  } catch (error) {
    console.error("Error fetching drink creator leaderboard:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink creator leaderboard" });
  }
});

// Creator dashboard metrics for a user's submitted/remixed drink recipes
r.get("/creator/:userId", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const requestedUserId = String(req.params?.userId ?? "").trim();
    if (!requestedUserId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    if (requestedUserId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recipes = await db
      .select({
        id: drinkRecipes.id,
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
      })
      .from(drinkRecipes)
      .where(eq(drinkRecipes.userId, requestedUserId))
      .orderBy(desc(drinkRecipes.createdAt));

    const creatorLeaderboard = await getDrinkCreatorLeaderboard(250);
    const creatorRank = creatorLeaderboard.findIndex((entry) => entry.userId === requestedUserId) + 1;
    const creatorLeaderboardEntry = creatorLeaderboard.find((entry) => entry.userId === requestedUserId) ?? null;

    if (recipes.length === 0) {
      return res.json({
        ok: true,
        userId: requestedUserId,
        summary: {
          creatorRank: creatorRank > 0 ? creatorRank : null,
          creatorScore: creatorLeaderboardEntry?.creatorScore ?? 0,
          totalCreated: 0,
          totalRemixesCreated: 0,
          totalViews7d: 0,
          totalRemixesReceived: 0,
          totalGroceryAdds: 0,
          topPerformingDrink: null,
          mostRemixedDrink: null,
          followerCount: Number((await db.select({ followersCount: users.followersCount }).from(users).where(eq(users.id, requestedUserId)).limit(1))[0]?.followersCount ?? 0),
          isFollowing: false,
        },
        items: [],
      });
    }

    const recipeSlugs = recipes.map((recipe) => recipe.slug);

    const eventRows = await db
      .select({
        slug: drinkEvents.slug,
        views24h: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${oneDayAgo})`,
        views7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`,
        groceryAdds: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`,
      })
      .from(drinkEvents)
      .where(and(inArray(drinkEvents.slug, recipeSlugs), gt(drinkEvents.createdAt, sevenDaysAgo)))
      .groupBy(drinkEvents.slug);

    const remixedByOthersRows = await db
      .select({
        remixedFromSlug: drinkRecipes.remixedFromSlug,
        remixesCount: sql<number>`count(*)`,
      })
      .from(drinkRecipes)
      .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
      .groupBy(drinkRecipes.remixedFromSlug);

    const eventsBySlug = new Map(
      eventRows.map((row) => [row.slug, {
        views24h: Number(row.views24h ?? 0),
        views7d: Number(row.views7d ?? 0),
        groceryAdds: Number(row.groceryAdds ?? 0),
      }])
    );

    const remixesBySlug = new Map(
      remixedByOthersRows
        .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
        .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
    );

    const items = recipes.map((recipe) => {
      const metrics = eventsBySlug.get(recipe.slug) ?? { views24h: 0, views7d: 0, groceryAdds: 0 };
      const remixesCount = remixesBySlug.get(recipe.slug) ?? 0;
      const score = (metrics.views24h * 3) + (Math.max(metrics.views7d - metrics.views24h, 0) * 1) + (remixesCount * 4) + (metrics.groceryAdds * 2);

      return {
        id: recipe.id,
        slug: recipe.slug,
        name: recipe.name,
        image: recipe.image ?? null,
        createdAt: recipe.createdAt,
        remixedFromSlug: recipe.remixedFromSlug ?? null,
        views7d: metrics.views7d,
        views24h: metrics.views24h,
        remixesCount,
        groceryAdds: metrics.groceryAdds,
        score,
      };
    });

    const totalCreated = items.length;
    const totalRemixesCreated = items.filter((item) => Boolean(item.remixedFromSlug)).length;
    const totalViews7d = items.reduce((sum, item) => sum + item.views7d, 0);
    const totalRemixesReceived = items.reduce((sum, item) => sum + item.remixesCount, 0);
    const totalGroceryAdds = items.reduce((sum, item) => sum + item.groceryAdds, 0);
    const [topPerformingDrink] = [...items].sort((a, b) => b.score - a.score || b.views7d - a.views7d || b.remixesCount - a.remixesCount);
    const [mostRemixedDrink] = [...items].sort((a, b) => b.remixesCount - a.remixesCount || b.score - a.score || b.views7d - a.views7d);

    return res.json({
      ok: true,
      userId: requestedUserId,
      summary: {
        creatorRank: creatorRank > 0 ? creatorRank : null,
        creatorScore: creatorLeaderboardEntry?.creatorScore ?? 0,
        totalCreated,
        totalRemixesCreated,
        totalViews7d,
        totalRemixesReceived,
        totalGroceryAdds,
        topPerformingDrink: topPerformingDrink
          ? {
            id: topPerformingDrink.id,
            slug: topPerformingDrink.slug,
            name: topPerformingDrink.name,
            image: topPerformingDrink.image,
            score: topPerformingDrink.score,
          }
          : null,
        mostRemixedDrink: mostRemixedDrink
          ? {
            id: mostRemixedDrink.id,
            slug: mostRemixedDrink.slug,
            name: mostRemixedDrink.name,
            image: mostRemixedDrink.image,
            remixesCount: mostRemixedDrink.remixesCount,
          }
          : null,
        followerCount: Number((await db.select({ followersCount: users.followersCount }).from(users).where(eq(users.id, requestedUserId)).limit(1))[0]?.followersCount ?? 0),
        isFollowing: false,
      },
      items,
    });
  } catch (error) {
    console.error("Error fetching creator drink metrics:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch creator drink metrics" });
  }
});



r.post("/creators/:userId/follow", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorId = String(req.params?.userId ?? "").trim();
    const viewerId = req.user.id;

    if (!creatorId) return res.status(400).json({ ok: false, error: "userId is required" });
    if (creatorId === viewerId) return res.status(400).json({ ok: false, error: "You cannot follow yourself" });

    const creator = await db.select({ id: users.id }).from(users).where(eq(users.id, creatorId)).limit(1);
    if (!creator[0]) return res.status(404).json({ ok: false, error: "Creator not found" });

    try {
      await storage.followUser(viewerId, creatorId);
    } catch {
      // ignore duplicate follows
    }

    const isFollowing = await storage.isFollowing(viewerId, creatorId);
    const creatorProfile = await db
      .select({ followersCount: users.followersCount })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    return res.json({ ok: true, isFollowing, followerCount: Number(creatorProfile[0]?.followersCount ?? 0) });
  } catch (error) {
    console.error("Error following drink creator:", error);
    return res.status(500).json({ ok: false, error: "Failed to follow creator" });
  }
});

r.delete("/creators/:userId/follow", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorId = String(req.params?.userId ?? "").trim();
    const viewerId = req.user.id;

    if (!creatorId) return res.status(400).json({ ok: false, error: "userId is required" });
    if (creatorId === viewerId) return res.status(400).json({ ok: false, error: "Invalid creator" });

    await storage.unfollowUser(viewerId, creatorId);

    const isFollowing = await storage.isFollowing(viewerId, creatorId);
    const creatorProfile = await db
      .select({ followersCount: users.followersCount })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    return res.json({ ok: true, isFollowing, followerCount: Number(creatorProfile[0]?.followersCount ?? 0) });
  } catch (error) {
    console.error("Error unfollowing drink creator:", error);
    return res.status(500).json({ ok: false, error: "Failed to unfollow creator" });
  }
});

r.get("/creators/:userId/follow-status", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorId = String(req.params?.userId ?? "").trim();
    const viewerId = req.user.id;

    if (!creatorId) return res.status(400).json({ ok: false, error: "userId is required" });

    const isFollowing = creatorId === viewerId ? false : await storage.isFollowing(viewerId, creatorId);
    const creatorProfile = await db
      .select({ followersCount: users.followersCount })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    return res.json({ ok: true, isFollowing, followerCount: Number(creatorProfile[0]?.followersCount ?? 0) });
  } catch (error) {
    console.error("Error checking drink creator follow status:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch follow status" });
  }
});


r.get("/creators/:userId", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorId = String(req.params?.userId ?? "").trim();
    if (!creatorId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const profile = await db
      .select({ id: users.id, username: users.username, avatar: users.avatar, followersCount: users.followersCount })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    if (!profile[0]) {
      return res.status(404).json({ ok: false, error: "Creator not found" });
    }

    const recipes = await db
      .select({
        id: drinkRecipes.id,
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
      })
      .from(drinkRecipes)
      .where(eq(drinkRecipes.userId, creatorId))
      .orderBy(desc(drinkRecipes.createdAt));

    if (recipes.length === 0) {
      return res.json({
        ok: true,
        userId: creatorId,
        username: profile[0].username ?? null,
        avatar: profile[0].avatar ?? null,
        followerCount: Number(profile[0].followersCount ?? 0),
        totalCreated: 0,
        totalViews7d: 0,
        totalRemixesReceived: 0,
        totalGroceryAdds: 0,
        topDrink: null,
        recentItems: [],
      });
    }

    const recipeSlugs = recipes.map((recipe) => recipe.slug);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const eventRows = await db
      .select({
        slug: drinkEvents.slug,
        views7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`,
        groceryAdds7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`,
      })
      .from(drinkEvents)
      .where(and(inArray(drinkEvents.slug, recipeSlugs), gt(drinkEvents.createdAt, sevenDaysAgo)))
      .groupBy(drinkEvents.slug);

    const remixedByOthersRows = await db
      .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
      .from(drinkRecipes)
      .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
      .groupBy(drinkRecipes.remixedFromSlug);

    const eventsBySlug = new Map(
      eventRows.map((row) => [row.slug, { views7d: Number(row.views7d ?? 0), groceryAdds7d: Number(row.groceryAdds7d ?? 0) }])
    );

    const remixesBySlug = new Map(
      remixedByOthersRows
        .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
        .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
    );

    const items = recipes.map((recipe) => {
      const metrics = eventsBySlug.get(recipe.slug) ?? { views7d: 0, groceryAdds7d: 0 };
      const remixesCount = remixesBySlug.get(recipe.slug) ?? 0;
      const score = metrics.views7d + (remixesCount * 4) + (metrics.groceryAdds7d * 2);

      return {
        id: recipe.id,
        slug: recipe.slug,
        name: recipe.name,
        image: recipe.image ?? null,
        createdAt: recipe.createdAt,
        remixedFromSlug: recipe.remixedFromSlug ?? null,
        route: `/drinks/recipe/${recipe.slug}`,
        views7d: metrics.views7d,
        remixesCount,
        groceryAdds7d: metrics.groceryAdds7d,
        score,
      };
    });

    const totalCreated = items.length;
    const totalViews7d = items.reduce((sum, item) => sum + item.views7d, 0);
    const totalRemixesReceived = items.reduce((sum, item) => sum + item.remixesCount, 0);
    const totalGroceryAdds = items.reduce((sum, item) => sum + item.groceryAdds7d, 0);
    const [topDrink] = [...items].sort((a, b) => b.score - a.score || b.views7d - a.views7d || b.remixesCount - a.remixesCount);

    return res.json({
      ok: true,
      userId: creatorId,
      username: profile[0].username ?? null,
      avatar: profile[0].avatar ?? null,
      followerCount: Number(profile[0].followersCount ?? 0),
      totalCreated,
      totalViews7d,
      totalRemixesReceived,
      totalGroceryAdds,
      topDrink: topDrink
        ? {
          slug: topDrink.slug,
          name: topDrink.name,
          image: topDrink.image,
          route: topDrink.route,
          score: topDrink.score,
        }
        : null,
      recentItems: items
        .slice(0, 24)
        .map(({ groceryAdds7d, score, ...item }) => item),
    });
  } catch (error) {
    console.error("Error fetching public drink creator profile:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch creator profile" });
  }
});


// Search drinks across canonical + user submissions
r.get("/search", async (req, res) => {
  try {
    const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
    if (!q) return res.json({ ok: true, items: [] });

    const canonicalMatches = searchDrinks({ q, source: "external", pageSize: 10, offset: 0 });

    let userMatches: any[] = [];
    if (db) {
      userMatches = await db
        .select()
        .from(drinkRecipes)
        .where(
          or(
            ilike(drinkRecipes.name, `%${q}%`),
            ilike(drinkRecipes.description, `%${q}%`),
            ilike(drinkRecipes.category, `%${q}%`),
            ilike(drinkRecipes.subcategory, `%${q}%`)
          )
        )
        .limit(20);
    }

    const external = (await canonicalMatches).results.map((item) => ({
      slug: item.sourceId,
      name: item.title,
      image: item.imageUrl ?? null,
      route: `/drinks/recipe/${item.sourceId}`,
      source: "external",
    }));

    const userItems = userMatches.map((item) => ({
      slug: item.slug,
      name: item.name,
      image: item.image ?? null,
      route: `/drinks/recipe/${item.slug}`,
      source: "chefsire",
      sourceCategoryRoute: `/drinks/${item.category}${item.subcategory ? `/${item.subcategory}` : ""}`,
    }));

    return res.json({ ok: true, items: [...userItems, ...external] });
  } catch (error) {
    console.error("Error searching drinks:", error);
    return res.status(500).json({ ok: false, error: "Failed to search drinks" });
  }
});

// Helper to coerce query values into strings
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// ========================================
// CUSTOM DRINKS API ROUTES (NEW)
// ========================================

// Get user's custom drinks
r.get("/custom-drinks/user/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { category } = req.query;
    
    const drinks = await storage.getUserCustomDrinks(
      userId, 
      category as string | undefined
    );
    res.json({ ok: true, drinks });
  } catch (error: any) {
    console.error("Error fetching user drinks:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch custom drinks" });
  }
});

// Get single custom drink
r.get("/custom-drinks/:id", async (req, res) => {
  try {
    const drink = await storage.getCustomDrinkWithUser(req.params.id);
    if (!drink) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    res.json({ ok: true, drink });
  } catch (error: any) {
    console.error("Error fetching drink:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch drink" });
  }
});

// Get public/community drinks
r.get("/custom-drinks/public", async (req, res) => {
  try {
    const { category, limit } = req.query;
    const drinks = await storage.getPublicCustomDrinks(
      category as string | undefined,
      limit ? parseInt(limit as string) : undefined
    );
    res.json({ ok: true, drinks });
  } catch (error: any) {
    console.error("Error fetching public drinks:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch public drinks" });
  }
});

// Create custom drink
r.post("/custom-drinks", requireAuth, async (req, res) => {
  try {
    const drinkData = insertCustomDrinkSchema.parse({
      ...req.body,
      userId: req.user.id,
    });
    
    const drink = await storage.createCustomDrink(drinkData);
    res.status(201).json({ ok: true, drink });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        ok: false,
        error: "Invalid drink data", 
        details: error.errors 
      });
    }
    console.error("Error creating drink:", error);
    res.status(500).json({ ok: false, error: "Failed to create custom drink" });
  }
});

// Update custom drink
r.patch("/custom-drinks/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const existing = await storage.getCustomDrink(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const updated = await storage.updateCustomDrink(id, req.body);
    res.json({ ok: true, drink: updated });
  } catch (error: any) {
    console.error("Error updating drink:", error);
    res.status(500).json({ ok: false, error: "Failed to update drink" });
  }
});

// Delete custom drink
r.delete("/custom-drinks/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const existing = await storage.getCustomDrink(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const success = await storage.deleteCustomDrink(id);
    if (success) {
      res.json({ ok: true, message: "Drink deleted successfully" });
    } else {
      res.status(500).json({ ok: false, error: "Failed to delete drink" });
    }
  } catch (error: any) {
    console.error("Error deleting drink:", error);
    res.status(500).json({ ok: false, error: "Failed to delete drink" });
  }
});

// ========================================
// DRINK PHOTOS
// ========================================

// Upload drink photo
r.post("/custom-drinks/:id/photo", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify drink exists and user owns it
    const drink = await storage.getCustomDrink(id);
    if (!drink) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    if (drink.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const photoData = insertDrinkPhotoSchema.parse({
      drinkId: id,
      userId: req.user.id,
      imageUrl: req.body.imageUrl,
      caption: req.body.caption,
    });
    
    const photo = await storage.createDrinkPhoto(photoData);
    
    // Also update the drink's imageUrl if it doesn't have one
    if (!drink.imageUrl) {
      await storage.updateCustomDrink(id, { imageUrl: photo.imageUrl });
    }
    
    res.status(201).json({ ok: true, photo });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        ok: false,
        error: "Invalid photo data", 
        details: error.errors 
      });
    }
    console.error("Error uploading photo:", error);
    res.status(500).json({ ok: false, error: "Failed to upload photo" });
  }
});

// Get drink photos
r.get("/custom-drinks/:id/photos", async (req, res) => {
  try {
    const photos = await storage.getDrinkPhotos(req.params.id);
    res.json({ ok: true, photos });
  } catch (error: any) {
    console.error("Error fetching photos:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch photos" });
  }
});

// Delete drink photo
r.delete("/drink-photos/:id", requireAuth, async (req, res) => {
  try {
    const success = await storage.deleteDrinkPhoto(req.params.id);
    if (success) {
      res.json({ ok: true, message: "Photo deleted successfully" });
    } else {
      res.status(404).json({ ok: false, error: "Photo not found" });
    }
  } catch (error: any) {
    console.error("Error deleting photo:", error);
    res.status(500).json({ ok: false, error: "Failed to delete photo" });
  }
});

// ========================================
// DRINK LIKES
// ========================================

// Like a drink
r.post("/custom-drinks/:id/like", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const like = await storage.likeDrink(req.user.id, id);
    res.status(201).json({ ok: true, like });
  } catch (error: any) {
    console.error("Error liking drink:", error);
    res.status(500).json({ ok: false, error: "Failed to like drink" });
  }
});

// Unlike a drink
r.delete("/custom-drinks/:id/like", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.unlikeDrink(req.user.id, id);
    if (success) {
      res.json({ ok: true, message: "Drink unliked" });
    } else {
      res.status(404).json({ ok: false, error: "Like not found" });
    }
  } catch (error: any) {
    console.error("Error unliking drink:", error);
    res.status(500).json({ ok: false, error: "Failed to unlike drink" });
  }
});

// Check if drink is liked
r.get("/custom-drinks/:id/liked", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const isLiked = await storage.isDrinkLiked(req.user.id, id);
    res.json({ ok: true, isLiked });
  } catch (error: any) {
    console.error("Error checking like status:", error);
    res.status(500).json({ ok: false, error: "Failed to check like status" });
  }
});

// ========================================
// DRINK SAVES/FAVORITES
// ========================================

// Save a drink
r.post("/custom-drinks/:id/save", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const save = await storage.saveDrink(req.user.id, id);
    res.status(201).json({ ok: true, save });
  } catch (error: any) {
    console.error("Error saving drink:", error);
    res.status(500).json({ ok: false, error: "Failed to save drink" });
  }
});

// Unsave a drink
r.delete("/custom-drinks/:id/save", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.unsaveDrink(req.user.id, id);
    if (success) {
      res.json({ ok: true, message: "Drink unsaved" });
    } else {
      res.status(404).json({ ok: false, error: "Save not found" });
    }
  } catch (error: any) {
    console.error("Error unsaving drink:", error);
    res.status(500).json({ ok: false, error: "Failed to unsave drink" });
  }
});

// Check if drink is saved
r.get("/custom-drinks/:id/saved", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const isSaved = await storage.isDrinkSaved(req.user.id, id);
    res.json({ ok: true, isSaved });
  } catch (error: any) {
    console.error("Error checking save status:", error);
    res.status(500).json({ ok: false, error: "Failed to check save status" });
  }
});

// Get user's saved drinks
r.get("/custom-drinks/saved/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { category } = req.query;
    const drinks = await storage.getUserSavedDrinks(
      userId,
      category as string | undefined
    );
    res.json({ ok: true, drinks });
  } catch (error: any) {
    console.error("Error fetching saved drinks:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch saved drinks" });
  }
});

// ========================================
// USER DRINK STATS
// ========================================

// Get user stats
r.get("/user-drink-stats/:userId", async (req, res) => {
  try {
    const stats = await storage.getUserDrinkStats(req.params.userId);
    res.json({ ok: true, stats });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch stats" });
  }
});

// Update user stats
r.patch("/user-drink-stats/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const updated = await storage.updateUserDrinkStats(userId, req.body);
    res.json({ ok: true, stats: updated });
  } catch (error: any) {
    console.error("Error updating stats:", error);
    res.status(500).json({ ok: false, error: "Failed to update stats" });
  }
});

// Award badge to user
r.post("/user-drink-stats/:userId/badge", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { badge } = req.body;
    
    if (!badge) {
      return res.status(400).json({ ok: false, error: "Badge name required" });
    }
    
    await storage.addBadge(userId, badge);
    res.json({ ok: true, message: "Badge awarded" });
  } catch (error: any) {
    console.error("Error awarding badge:", error);
    res.status(500).json({ ok: false, error: "Failed to award badge" });
  }
});

export default r;
