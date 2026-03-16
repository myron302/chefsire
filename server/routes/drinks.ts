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
import { optionalAuth, requireAuth } from "../middleware";

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

type RemixDiscoverySort = "recent" | "popular";

function normalizeRemixDiscoverySort(value: unknown): RemixDiscoverySort {
  if (typeof value !== "string") return "recent";
  const normalized = value.trim().toLowerCase();
  return normalized === "popular" ? "popular" : "recent";
}

type MostRemixedDrinkItem = {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  sourceCategoryRoute: string | null;
  remixCount: number;
  views7d: number;
  lastRemixAt: Date | null;
};

function canonicalRouteForUserRecipe(recipe: { category: string; subcategory: string | null }): string {
  return `/drinks/${recipe.category}${recipe.subcategory ? `/${recipe.subcategory}` : ""}`;
}

function resolveMostRemixedTieBreaker(a: MostRemixedDrinkItem, b: MostRemixedDrinkItem): number {
  return (
    b.remixCount - a.remixCount ||
    b.views7d - a.views7d ||
    ((b.lastRemixAt?.getTime() ?? 0) - (a.lastRemixAt?.getTime() ?? 0)) ||
    a.slug.localeCompare(b.slug)
  );
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
    remixesCount: number;
  } | null;
};

type TrendingCreatorRow = CreatorLeaderboardRow & {
  recentCreatedCount: number;
  publicRoute: string;
};

type CreatorActivityType = "view" | "grocery_add" | "remix" | "follow";

type CreatorActivityItem = {
  type: CreatorActivityType;
  createdAt: string;
  actorUserId: string | null;
  actorUsername: string | null;
  targetDrinkSlug: string | null;
  targetDrinkName: string | null;
  route: string | null;
  message: string;
  count?: number;
  uniqueActors?: number;
};

type WhatsNewFeedType =
  | "remix"
  | "trending_drink"
  | "trending_creator"
  | "followed_creator_post"
  | "most_remixed_highlight";

type WhatsNewFeedItem = {
  type: WhatsNewFeedType;
  createdAt: string;
  title: string;
  subtitle: string;
  image: string | null;
  route: string;
  relatedUserId: string | null;
  relatedUsername: string | null;
  relatedDrinkSlug: string | null;
};

function toActivityDateKey(value: Date | null | undefined): string {
  if (!value) return "unknown";
  return value.toISOString().slice(0, 10);
}

function toReadableDay(value: Date | null | undefined): string {
  if (!value) return "recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(value);
}

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
          remixesCount,
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

async function getTrendingDrinkCreators(limit = 25): Promise<TrendingCreatorRow[]> {
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(limit, 100));
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const createdRows = await db
    .select({
      userId: drinkRecipes.userId,
      totalCreated: sql<number>`count(*)`,
      recentCreatedCount: sql<number>`count(*) filter (where ${drinkRecipes.createdAt} > ${sevenDaysAgo})`,
    })
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
    .where(and(inArray(drinkRecipes.remixedFromSlug, recipeSlugs), gt(drinkRecipes.createdAt, sevenDaysAgo)))
    .groupBy(drinkRecipes.remixedFromSlug);

  const profiles = await db
    .select({ id: users.id, username: users.username, avatar: users.avatar, followersCount: users.followersCount })
    .from(users)
    .where(inArray(users.id, creatorIds));

  const createdByUser = new Map(
    createdRows
      .filter((row): row is { userId: string; totalCreated: number; recentCreatedCount: number } => Boolean(row.userId))
      .map((row) => [row.userId, {
        totalCreated: Number(row.totalCreated ?? 0),
        recentCreatedCount: Number(row.recentCreatedCount ?? 0),
      }])
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

  const rows: TrendingCreatorRow[] = creatorIds.map((creatorId) => {
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
          remixesCount,
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

    const createdStats = createdByUser.get(creatorId) ?? { totalCreated: creatorRecipeRows.length, recentCreatedCount: 0 };
    const creatorScore =
      (totals.totalViews7d * 1) +
      (totals.totalRemixesReceived * 4) +
      (totals.totalGroceryAdds * 2) +
      (createdStats.recentCreatedCount * 1);

    const creatorProfile = profileById.get(creatorId);
    return {
      userId: creatorId,
      username: creatorProfile?.username ?? null,
      avatar: creatorProfile?.avatar ?? null,
      creatorScore,
      totalCreated: createdStats.totalCreated,
      recentCreatedCount: createdStats.recentCreatedCount,
      totalViews7d: totals.totalViews7d,
      totalRemixesReceived: totals.totalRemixesReceived,
      totalGroceryAdds: totals.totalGroceryAdds,
      followerCount: creatorProfile?.followersCount ?? 0,
      topDrink: totals.topDrink,
      publicRoute: `/drinks/creator/${encodeURIComponent(creatorId)}`,
    };
  });

  return rows
    .sort((a, b) =>
      b.creatorScore - a.creatorScore ||
      b.totalViews7d - a.totalViews7d ||
      b.totalRemixesReceived - a.totalRemixesReceived ||
      b.recentCreatedCount - a.recentCreatedCount
    )
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
r.get("/remixes", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const sort = normalizeRemixDiscoverySort(req.query?.sort);
    const limitValue = Number(req.query?.limit);
    const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(limitValue, 60)) : 30;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const remixRows = await db
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
        views7d: sql<number>`count(${drinkEvents.id}) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} >= ${sevenDaysAgo})`,
      })
      .from(drinkRecipes)
      .leftJoin(users, eq(drinkRecipes.userId, users.id))
      .leftJoin(drinkEvents, eq(drinkEvents.slug, drinkRecipes.slug))
      .where(sql`${drinkRecipes.remixedFromSlug} is not null`)
      .groupBy(
        drinkRecipes.id,
        drinkRecipes.slug,
        drinkRecipes.name,
        drinkRecipes.image,
        drinkRecipes.createdAt,
        drinkRecipes.userId,
        users.username,
        users.avatar,
        drinkRecipes.remixedFromSlug
      )
      .orderBy(sort === "popular"
        ? [desc(sql`count(${drinkEvents.id}) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} >= ${sevenDaysAgo})`), desc(drinkRecipes.createdAt)]
        : [desc(drinkRecipes.createdAt)])
      .limit(limit);
    const remixSlugs = remixRows.map((row) => row.slug);
    const remixesCountRows = remixSlugs.length
      ? await db
          .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
          .from(drinkRecipes)
          .where(inArray(drinkRecipes.remixedFromSlug, remixSlugs))
          .groupBy(drinkRecipes.remixedFromSlug)
      : [];

    const remixesCountBySlug = new Map(
      remixesCountRows
        .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
        .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
    );

    const items = remixRows.map((entry) => {
      const sourceSlug = entry.remixedFromSlug ?? null;
      const canonicalSource = sourceSlug ? getCanonicalDrinkBySlug(sourceSlug) : null;
      const sourceRoute = canonicalSource?.route ?? (sourceSlug ? `/drinks/recipe/${sourceSlug}` : null);

      return {
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        image: entry.image ?? null,
        createdAt: entry.createdAt,
        userId: entry.userId ?? null,
        creatorUsername: entry.creatorUsername ?? null,
        creatorAvatar: entry.creatorAvatar ?? null,
        remixedFromSlug: sourceSlug,
        route: `/drinks/recipe/${entry.slug}?community=1`,
        sourceRoute,
        views7d: Number(entry.views7d ?? 0),
        remixesCount: remixesCountBySlug.get(entry.slug) ?? 0,
      };
    });

    return res.json({ ok: true, sort, count: items.length, items });
  } catch (error) {
    console.error("Error fetching remix discovery feed:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch remix discovery feed" });
  }
});

// Fetch canonical/original drinks ranked by remix activity.
r.get("/most-remixed", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const limitValue = Number(req.query?.limit);
    const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(limitValue, 100)) : 24;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const remixAggregateRows = await db
      .select({
        slug: drinkRecipes.remixedFromSlug,
        remixCount: sql<number>`count(*)`,
        lastRemixAt: sql<Date>`max(${drinkRecipes.createdAt})`,
      })
      .from(drinkRecipes)
      .where(sql`${drinkRecipes.remixedFromSlug} is not null`)
      .groupBy(drinkRecipes.remixedFromSlug);

    const sourceSlugs = remixAggregateRows
      .map((row) => row.slug)
      .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);

    if (sourceSlugs.length === 0) {
      return res.json({ ok: true, count: 0, items: [] });
    }

    const viewRows = await db
      .select({
        slug: drinkEvents.slug,
        views7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} >= ${sevenDaysAgo})`,
      })
      .from(drinkEvents)
      .where(inArray(drinkEvents.slug, sourceSlugs))
      .groupBy(drinkEvents.slug);

    const userSourceRows = await db
      .select({
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        category: drinkRecipes.category,
        subcategory: drinkRecipes.subcategory,
      })
      .from(drinkRecipes)
      .where(inArray(drinkRecipes.slug, sourceSlugs));

    const views7dBySlug = new Map(viewRows.map((row) => [row.slug, Number(row.views7d ?? 0)]));
    const userSourceBySlug = new Map(userSourceRows.map((row) => [row.slug, row]));

    const rankedItems: MostRemixedDrinkItem[] = remixAggregateRows
      .filter((row): row is { slug: string; remixCount: number; lastRemixAt: Date | null } => Boolean(row.slug))
      .map((row) => {
        const canonical = getCanonicalDrinkBySlug(row.slug);
        const userSource = userSourceBySlug.get(row.slug);

        const route = canonical?.route ?? `/drinks/recipe/${row.slug}`;
        const sourceCategoryRoute = canonical?.sourceRoute ?? (userSource ? canonicalRouteForUserRecipe({
          category: userSource.category,
          subcategory: userSource.subcategory ?? null,
        }) : null);

        return {
          slug: row.slug,
          name: canonical?.name ?? userSource?.name ?? row.slug,
          image: canonical?.image ?? userSource?.image ?? null,
          route,
          sourceCategoryRoute,
          remixCount: Number(row.remixCount ?? 0),
          views7d: views7dBySlug.get(row.slug) ?? 0,
          lastRemixAt: row.lastRemixAt ? new Date(row.lastRemixAt) : null,
        };
      })
      .sort(resolveMostRemixedTieBreaker)
      .slice(0, limit);

    return res.json({
      ok: true,
      count: rankedItems.length,
      items: rankedItems.map((item) => ({
        slug: item.slug,
        name: item.name,
        image: item.image,
        route: item.route,
        sourceCategoryRoute: item.sourceCategoryRoute,
        remixCount: item.remixCount,
        views7d: item.views7d,
      })),
    });
  } catch (error) {
    console.error("Error fetching most remixed drinks:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch most remixed drinks" });
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
          remixesCount: Number(row.remixes ?? 0),
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
        const baseScore = Number(row.score ?? 0);
        const followedBoost = creatorId && followedCreatorSet.has(creatorId)
          ? Math.min(6, Math.max(1.5, baseScore * 0.2))
          : 0;
        return {
          ...row,
          rankScore: baseScore + followedBoost,
          followedBoost,
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

    const recommendationPool = scopedRows.length > 0 ? scopedRows : rankedRows;

    const remixesCountRows = recommendationPool.length > 0
      ? await db
          .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
          .from(drinkRecipes)
          .where(inArray(drinkRecipes.remixedFromSlug, recommendationPool.map((row) => row.slug)))
          .groupBy(drinkRecipes.remixedFromSlug)
      : [];

    const remixesCountBySlug = new Map(
      remixesCountRows
        .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
        .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
    );

    const mapped = await Promise.all(recommendationPool.map(async (row) => {
      const item = await resolveDrinkDetailsBySlug(row.slug);
      if (!item || recentSet.has(item.slug)) return null;
      return {
        slug: item.slug,
        name: item.name,
        image: item.image,
        route: item.route,
        sourceCategoryRoute: item.sourceCategoryRoute,
        source: item.source,
        remixesCount: remixesCountBySlug.get(item.slug) ?? 0,
        isFollowedCreator: row.isFollowedCreator,
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

r.get("/whats-new", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 80)) : 40;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const viewerId = req.user?.id ?? null;

    const recentRemixRows = await db
      .select({
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
        userId: drinkRecipes.userId,
        username: users.username,
      })
      .from(drinkRecipes)
      .leftJoin(users, eq(drinkRecipes.userId, users.id))
      .where(sql`${drinkRecipes.remixedFromSlug} is not null`)
      .orderBy(desc(drinkRecipes.createdAt))
      .limit(20);

    const trendingDrinkRows = await db
      .select({
        remixedFromSlug: drinkRecipes.remixedFromSlug,
        remixesCount: sql<number>`count(*)`,
        lastRemixAt: sql<Date>`max(${drinkRecipes.createdAt})`,
      })
      .from(drinkRecipes)
      .where(and(sql`${drinkRecipes.remixedFromSlug} is not null`, gt(drinkRecipes.createdAt, sevenDaysAgo)))
      .groupBy(drinkRecipes.remixedFromSlug)
      .orderBy(desc(sql`count(*)`))
      .limit(12);

    const trendingCreators = await getTrendingDrinkCreators(8);
    const mostRemixedRows = await db
      .select({
        remixedFromSlug: drinkRecipes.remixedFromSlug,
        remixesCount: sql<number>`count(*)`,
      })
      .from(drinkRecipes)
      .where(sql`${drinkRecipes.remixedFromSlug} is not null`)
      .groupBy(drinkRecipes.remixedFromSlug)
      .orderBy(desc(sql`count(*)`))
      .limit(6);

    let followedRows: Array<{
      slug: string;
      name: string;
      image: string | null;
      createdAt: Date;
      userId: string | null;
      username: string | null;
    }> = [];

    if (viewerId) {
      const followedCreatorRows = await db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, viewerId));

      const followedCreatorIds = followedCreatorRows.map((row) => row.followingId).filter(Boolean);
      if (followedCreatorIds.length > 0) {
        followedRows = await db
          .select({
            slug: drinkRecipes.slug,
            name: drinkRecipes.name,
            image: drinkRecipes.image,
            createdAt: drinkRecipes.createdAt,
            userId: drinkRecipes.userId,
            username: users.username,
          })
          .from(drinkRecipes)
          .innerJoin(users, eq(drinkRecipes.userId, users.id))
          .where(inArray(drinkRecipes.userId, followedCreatorIds))
          .orderBy(desc(drinkRecipes.createdAt))
          .limit(20);
      }
    }

    const items: WhatsNewFeedItem[] = [];

    for (const row of recentRemixRows) {
      const sourceSlug = row.remixedFromSlug ?? null;
      const canonicalSource = sourceSlug ? getCanonicalDrinkBySlug(sourceSlug) : null;
      const sourceName = canonicalSource?.name ?? sourceSlug ?? "another drink";
      items.push({
        type: "remix",
        createdAt: (row.createdAt ? new Date(row.createdAt) : new Date()).toISOString(),
        title: `New remix of ${sourceName}`,
        subtitle: row.username
          ? `@${row.username} shared \"${row.name}\" as a remix.`
          : `A community creator shared \"${row.name}\" as a remix.`,
        image: row.image ?? canonicalSource?.image ?? null,
        route: `/drinks/recipe/${row.slug}?community=1`,
        relatedUserId: row.userId ?? null,
        relatedUsername: row.username ?? null,
        relatedDrinkSlug: sourceSlug,
      });
    }

    for (const row of trendingDrinkRows) {
      if (!row.remixedFromSlug) continue;
      const canonicalDrink = getCanonicalDrinkBySlug(row.remixedFromSlug);
      const drinkName = canonicalDrink?.name ?? row.remixedFromSlug;
      items.push({
        type: "trending_drink",
        createdAt: (row.lastRemixAt ? new Date(row.lastRemixAt) : new Date()).toISOString(),
        title: `${drinkName} is trending this week`,
        subtitle: `${Number(row.remixesCount ?? 0).toLocaleString()} new remixes in the last 7 days.`,
        image: canonicalDrink?.image ?? null,
        route: canonicalDrink?.route ?? `/drinks/recipe/${row.remixedFromSlug}`,
        relatedUserId: null,
        relatedUsername: null,
        relatedDrinkSlug: row.remixedFromSlug,
      });
    }

    for (const [index, creator] of trendingCreators.entries()) {
      items.push({
        type: "trending_creator",
        createdAt: new Date(Date.now() - (index * 5 * 60 * 1000)).toISOString(),
        title: `${creator.username ? `@${creator.username}` : "A creator"} is trending`,
        subtitle: `Trending creator this week with ${creator.totalRemixesReceived.toLocaleString()} remixes received.`,
        image: creator.avatar ?? creator.topDrink?.image ?? null,
        route: creator.publicRoute,
        relatedUserId: creator.userId,
        relatedUsername: creator.username ?? null,
        relatedDrinkSlug: creator.topDrink?.slug ?? null,
      });
    }

    for (const row of followedRows) {
      if (!row.userId) continue;
      items.push({
        type: "followed_creator_post",
        createdAt: (row.createdAt ? new Date(row.createdAt) : new Date()).toISOString(),
        title: "A creator you follow posted a new drink",
        subtitle: row.username
          ? `@${row.username} published \"${row.name}\".`
          : `A followed creator published \"${row.name}\".`,
        image: row.image ?? null,
        route: `/drinks/recipe/${row.slug}`,
        relatedUserId: row.userId,
        relatedUsername: row.username ?? null,
        relatedDrinkSlug: row.slug,
      });
    }

    for (const row of mostRemixedRows) {
      if (!row.remixedFromSlug) continue;
      const canonicalDrink = getCanonicalDrinkBySlug(row.remixedFromSlug);
      const name = canonicalDrink?.name ?? row.remixedFromSlug;
      items.push({
        type: "most_remixed_highlight",
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        title: `${name} is one of the most remixed drinks`,
        subtitle: `${Number(row.remixesCount ?? 0).toLocaleString()} total remixes so far.`,
        image: canonicalDrink?.image ?? null,
        route: "/drinks/most-remixed",
        relatedUserId: null,
        relatedUsername: null,
        relatedDrinkSlug: row.remixedFromSlug,
      });
    }

    const unique = new Set<string>();
    const deduped = items.filter((item) => {
      const key = `${item.type}:${item.route}:${item.relatedUserId ?? "none"}:${item.relatedDrinkSlug ?? "none"}`;
      if (unique.has(key)) return false;
      unique.add(key);
      return true;
    });

    const mixed = deduped
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return res.json({
      ok: true,
      count: mixed.length,
      itemTypes: [
        "remix",
        "trending_drink",
        "trending_creator",
        "followed_creator_post",
        "most_remixed_highlight",
      ],
      items: mixed,
    });
  } catch (error) {
    console.error("Error loading drinks what's new feed:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drinks what's new feed" });
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

r.get("/creators/trending", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? limitParam : 25;
    const creators = await getTrendingDrinkCreators(limit);

    return res.json({
      ok: true,
      creators,
      count: creators.length,
      rankingFormula: "score = totalViews7d*1 + totalRemixesReceived*4 + totalGroceryAdds*2 + recentCreatedCount*1",
    });
  } catch (error) {
    console.error("Error fetching trending drink creators:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch trending drink creators" });
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


// Lightweight creator activity feed derived from drink events/remixes/follows
r.get("/creator/:userId/activity", requireAuth, async (req, res) => {
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

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? Math.max(10, Math.min(limitParam, 200)) : 80;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recipes = await db
      .select({ slug: drinkRecipes.slug, name: drinkRecipes.name })
      .from(drinkRecipes)
      .where(eq(drinkRecipes.userId, requestedUserId));

    const recipeSlugs = recipes.map((recipe) => recipe.slug);
    const recipeNameBySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe.name]));

    const activityItems: CreatorActivityItem[] = [];

    if (recipeSlugs.length > 0) {
      const recentEvents = await db
        .select({
          slug: drinkEvents.slug,
          eventType: drinkEvents.eventType,
          createdAt: drinkEvents.createdAt,
          actorUserId: drinkEvents.userId,
          actorUsername: users.username,
        })
        .from(drinkEvents)
        .leftJoin(users, eq(users.id, drinkEvents.userId))
        .where(
          and(
            inArray(drinkEvents.slug, recipeSlugs),
            inArray(drinkEvents.eventType, ["view", "grocery_add"]),
            gt(drinkEvents.createdAt, thirtyDaysAgo),
          ),
        )
        .orderBy(desc(drinkEvents.createdAt))
        .limit(600);

      type DailyAggregate = {
        slug: string;
        eventType: "view" | "grocery_add";
        dateKey: string;
        createdAt: Date;
        totalCount: number;
        actorIds: Set<string>;
      };

      const dailyEventSummary = new Map<string, DailyAggregate>();
      for (const event of recentEvents) {
        if (!event.createdAt) continue;
        const normalizedEventType = event.eventType === "grocery_add" ? "grocery_add" : "view";
        const dateKey = toActivityDateKey(event.createdAt);
        const key = `${event.slug}:${normalizedEventType}:${dateKey}`;
        const existing = dailyEventSummary.get(key);
        if (existing) {
          existing.totalCount += 1;
          if (event.actorUserId) existing.actorIds.add(event.actorUserId);
        } else {
          dailyEventSummary.set(key, {
            slug: event.slug,
            eventType: normalizedEventType,
            dateKey,
            createdAt: event.createdAt,
            totalCount: 1,
            actorIds: new Set(event.actorUserId ? [event.actorUserId] : []),
          });
        }
      }

      for (const item of dailyEventSummary.values()) {
        const targetDrinkName = recipeNameBySlug.get(item.slug) ?? item.slug;
        const readableDay = toReadableDay(item.createdAt);
        const uniqueActors = item.actorIds.size;

        if (item.eventType === "view") {
          activityItems.push({
            type: "view",
            createdAt: item.createdAt.toISOString(),
            actorUserId: null,
            actorUsername: null,
            targetDrinkSlug: item.slug,
            targetDrinkName,
            route: `/drinks/recipe/${item.slug}`,
            message: `Your drink ${targetDrinkName} got ${item.totalCount} view${item.totalCount === 1 ? "" : "s"} on ${readableDay}`,
            count: item.totalCount,
            uniqueActors,
          });
        } else {
          activityItems.push({
            type: "grocery_add",
            createdAt: item.createdAt.toISOString(),
            actorUserId: null,
            actorUsername: null,
            targetDrinkSlug: item.slug,
            targetDrinkName,
            route: `/drinks/recipe/${item.slug}`,
            message: `Your drink ${targetDrinkName} was added to shopping lists ${item.totalCount} time${item.totalCount === 1 ? "" : "s"} on ${readableDay}`,
            count: item.totalCount,
            uniqueActors,
          });
        }
      }

      const remixRows = await db
        .select({
          slug: drinkRecipes.slug,
          name: drinkRecipes.name,
          remixedFromSlug: drinkRecipes.remixedFromSlug,
          createdAt: drinkRecipes.createdAt,
          actorUserId: drinkRecipes.userId,
          actorUsername: users.username,
        })
        .from(drinkRecipes)
        .leftJoin(users, eq(users.id, drinkRecipes.userId))
        .where(
          and(
            inArray(drinkRecipes.remixedFromSlug, recipeSlugs),
            gt(drinkRecipes.createdAt, thirtyDaysAgo),
          ),
        )
        .orderBy(desc(drinkRecipes.createdAt))
        .limit(250);

      for (const remix of remixRows) {
        const parentSlug = remix.remixedFromSlug;
        if (!parentSlug) continue;
        const parentName = recipeNameBySlug.get(parentSlug) ?? parentSlug;
        const remixName = remix.name ?? remix.slug;
        const actorIsCreator = remix.actorUserId === requestedUserId;
        const actorUsername = actorIsCreator ? null : remix.actorUsername ?? null;
        const actorUserId = actorIsCreator ? null : remix.actorUserId ?? null;
        const actorPrefix = actorUsername ? `@${actorUsername}` : "Someone";

        activityItems.push({
          type: "remix",
          createdAt: remix.createdAt.toISOString(),
          actorUserId,
          actorUsername,
          targetDrinkSlug: parentSlug,
          targetDrinkName: parentName,
          route: `/drinks/recipe/${remix.slug}`,
          message: `${actorPrefix} remixed your drink ${parentName} into ${remixName}`,
        });
      }
    }

    const followerRows = await db
      .select({
        createdAt: follows.createdAt,
        actorUserId: follows.followerId,
        actorUsername: users.username,
      })
      .from(follows)
      .leftJoin(users, eq(users.id, follows.followerId))
      .where(and(eq(follows.followingId, requestedUserId), gt(follows.createdAt, thirtyDaysAgo)))
      .orderBy(desc(follows.createdAt))
      .limit(100);

    for (const row of followerRows) {
      const actorUsername = row.actorUsername ?? null;
      const actorPrefix = actorUsername ? `@${actorUsername}` : "Someone";
      activityItems.push({
        type: "follow",
        createdAt: row.createdAt.toISOString(),
        actorUserId: row.actorUserId ?? null,
        actorUsername,
        targetDrinkSlug: null,
        targetDrinkName: null,
        route: `/drinks/creator/${requestedUserId}`,
        message: `${actorPrefix} started following you`,
      });
    }

    const sorted = activityItems
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    const typeCounts = sorted.reduce(
      (acc, item) => {
        acc[item.type] += 1;
        return acc;
      },
      { view: 0, grocery_add: 0, remix: 0, follow: 0 } as Record<CreatorActivityType, number>,
    );

    return res.json({
      ok: true,
      userId: requestedUserId,
      generatedAt: new Date().toISOString(),
      items: sorted,
      summary: {
        totalItems: sorted.length,
        typeCounts,
        windowDays: 30,
        summarized: ["view", "grocery_add"],
      },
    });
  } catch (error) {
    console.error("Error loading creator activity feed:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch creator activity" });
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
        mostRemixedDrinks: [],
        recentRemixActivity: [],
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

    const mostRemixedDrinks = [...items]
      .sort((a, b) => b.remixesCount - a.remixesCount || b.views7d - a.views7d || b.score - a.score)
      .slice(0, 8)
      .map((item) => ({
        slug: item.slug,
        name: item.name,
        image: item.image,
        route: item.route,
        remixesCount: item.remixesCount,
        views7d: item.views7d,
      }));

    const remixesReceivedRows = await db
      .select({
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
        createdAt: drinkRecipes.createdAt,
        creatorUsername: users.username,
      })
      .from(drinkRecipes)
      .leftJoin(users, eq(drinkRecipes.userId, users.id))
      .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
      .orderBy(desc(drinkRecipes.createdAt))
      .limit(20);

    const creatorPublishedRemixes = recipes
      .filter((recipe) => Boolean(recipe.remixedFromSlug))
      .slice(0, 20);

    const recentRemixActivity = [
      ...remixesReceivedRows.map((row) => ({
        type: "received_remix" as const,
        slug: row.slug,
        name: row.name,
        createdAt: row.createdAt,
        route: `/drinks/recipe/${row.slug}`,
        remixedFromSlug: row.remixedFromSlug ?? null,
        creatorUsername: row.creatorUsername ?? null,
      })),
      ...creatorPublishedRemixes.map((recipe) => ({
        type: "creator_published_remix" as const,
        slug: recipe.slug,
        name: recipe.name,
        createdAt: recipe.createdAt,
        route: `/drinks/recipe/${recipe.slug}`,
        remixedFromSlug: recipe.remixedFromSlug ?? null,
        creatorUsername: profile[0].username ?? null,
      })),
    ]
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 16);

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
      mostRemixedDrinks,
      recentRemixActivity,
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
