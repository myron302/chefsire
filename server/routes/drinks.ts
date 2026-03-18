// server/routes/drinks.ts
import { Router } from "express";
import { and, asc, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { listMeta, lookupDrink, randomDrink, searchDrinks } from "../services/drinks-service";
import { storage } from "../storage";
import { db } from "../db";
import { getCanonicalDrinkBySlug } from "../services/canonical-drinks-index";
import { 
  insertCustomDrinkSchema, 
  insertDrinkPhotoSchema,
  insertDrinkLikeSchema,
  insertDrinkSaveSchema,
  drinkCollectionItems,
  drinkCollectionPurchases,
  drinkCollections,
  drinkChallengeSubmissions,
  drinkChallenges,
  drinkEvents,
  drinkRecipes,
  follows,
  insertDrinkCollectionSchema,
  insertDrinkChallengeSchema,
  insertDrinkRecipeSchema,
  users,
} from "@shared/schema";
import { z } from "zod";
import { parseTrackedEventBody, resolveEngagementUserId } from "./engagement-events";
import { optionalAuth, requireAuth } from "../middleware";

const r = Router();

type EventType = "view" | "remix" | "grocery_add";

type DrinkDetails = {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  remixedFromSlug?: string | null;
  sourceCategoryRoute: string;
  source: "chefsire";
  category: string;
  subcategory: string | null;
};

type DiscoveryDrinkCard = {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  creatorUsername: string | null;
  remixesCount: number;
  views7d: number;
};

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

function toDrinkRoute(slug: string, community = false): string {
  return community ? `/drinks/recipe/${slug}?community=1` : `/drinks/recipe/${slug}`;
}

function toDiscoveryDrinkCard(input: {
  slug: string;
  name: string;
  image?: string | null;
  route?: string;
  creatorUsername?: string | null;
  remixesCount?: number;
  views7d?: number;
}): DiscoveryDrinkCard {
  return {
    slug: input.slug,
    name: input.name,
    image: input.image ?? null,
    route: input.route ?? toDrinkRoute(input.slug),
    creatorUsername: input.creatorUsername ?? null,
    remixesCount: Number(input.remixesCount ?? 0),
    views7d: Number(input.views7d ?? 0),
  };
}

function parseLimitOffset(
  query: Record<string, unknown>,
  defaults: { limit: number; maxLimit: number; offset?: number },
) {
  const limitValue = Number(query.limit);
  const limit = Number.isFinite(limitValue)
    ? Math.max(1, Math.min(limitValue, defaults.maxLimit))
    : defaults.limit;

  const offsetValue = Number(query.offset);
  const offset = Number.isFinite(offsetValue) ? Math.max(0, offsetValue) : (defaults.offset ?? 0);
  return { limit, offset };
}

async function resolveDrinkDetailsBySlug(slug: string): Promise<DrinkDetails | null> {
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

async function resolveDrinkDetailsMapBySlugs(slugs: string[]): Promise<Map<string, DrinkDetails>> {
  const uniqueSlugs = [...new Set(slugs.filter(Boolean))];
  if (uniqueSlugs.length === 0) return new Map();

  const detailsBySlug = new Map<string, DrinkDetails>();
  const unresolved: string[] = [];

  for (const slug of uniqueSlugs) {
    const canonical = getCanonicalDrinkBySlug(slug);
    if (canonical) {
      detailsBySlug.set(slug, {
        slug: canonical.slug,
        name: canonical.name,
        image: canonical.image ?? null,
        route: canonical.route,
        sourceCategoryRoute: canonical.sourceRoute,
        source: "chefsire",
        category: canonical.sourceRoute.replace("/drinks/", "").split("/")[0] ?? "",
        subcategory: canonical.sourceRoute.replace("/drinks/", "").split("/")[1] ?? null,
      });
    } else {
      unresolved.push(slug);
    }
  }

  if (!db || unresolved.length === 0) return detailsBySlug;

  const userRecipes = await db
    .select({
      slug: drinkRecipes.slug,
      name: drinkRecipes.name,
      image: drinkRecipes.image,
      remixedFromSlug: drinkRecipes.remixedFromSlug,
      category: drinkRecipes.category,
      subcategory: drinkRecipes.subcategory,
    })
    .from(drinkRecipes)
    .where(inArray(drinkRecipes.slug, unresolved));

  for (const recipe of userRecipes) {
    detailsBySlug.set(recipe.slug, {
      slug: recipe.slug,
      name: recipe.name,
      image: recipe.image ?? null,
      route: toDrinkRoute(recipe.slug),
      remixedFromSlug: recipe.remixedFromSlug ?? null,
      sourceCategoryRoute: `/drinks/${recipe.category}${recipe.subcategory ? `/${recipe.subcategory}` : ""}`,
      source: "chefsire",
      category: recipe.category,
      subcategory: recipe.subcategory ?? null,
    });
  }

  return detailsBySlug;
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


const createDrinkCollectionItemBodySchema = z.object({
  drinkSlug: z.string().trim().min(1).max(200).transform((value) => value.toLowerCase()),
});

const updateDrinkCollectionBodySchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  isPublic: z.boolean().optional(),
  isPremium: z.boolean().optional(),
  priceCents: z.number().int().min(0).max(500000).optional(),
}).refine((value) => value.name !== undefined || value.description !== undefined || value.isPublic !== undefined || value.isPremium !== undefined || value.priceCents !== undefined, {
  message: "At least one field must be provided",
}).refine((value) => {
  if (value.isPremium === true && (value.priceCents ?? 0) <= 0) return false;
  if (value.isPremium === false && value.priceCents !== undefined && value.priceCents !== 0) return false;
  return true;
}, {
  message: "Premium collections require a positive price and free collections must use a price of 0",
});

function normalizeCollectionDescription(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

function logCollectionRouteError(route: string, req: any, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[drinks/collections${route}] Request failed`, {
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id ?? null,
    params: req.params,
    query: req.query,
    message,
    error,
  });
  return message;
}

function logCollectionDbUnavailable(route: string, req: any) {
  console.error(`[drinks/collections${route}] Database unavailable`, {
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id ?? null,
  });
}

function collectionServerError(message: string, fallback: string) {
  return {
    ok: false,
    error: process.env.NODE_ENV === "production" ? fallback : `${fallback}: ${message}`,
  };
}

function collectionAuthRequired(res: any) {
  return res.status(401).json({ ok: false, error: "Authentication required", code: "AUTH_REQUIRED" });
}

type CollectionErrorDetails = {
  status: number;
  fallback: string;
  code: string;
  debug: string;
};

function classifyCollectionError(error: unknown, defaultFallback: string): CollectionErrorDetails {
  const message = error instanceof Error ? error.message : String(error);
  const pgCode = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code ?? "") : "";

  if (pgCode === "42P01") {
    return {
      status: 503,
      fallback: "Collections storage is not initialized",
      code: "COLLECTIONS_TABLE_MISSING",
      debug: message,
    };
  }

  if (pgCode === "42703") {
    return {
      status: 503,
      fallback: "Collections schema is out of date",
      code: "COLLECTIONS_SCHEMA_MISMATCH",
      debug: message,
    };
  }

  return {
    status: 500,
    fallback: defaultFallback,
    code: "COLLECTIONS_QUERY_FAILED",
    debug: message,
  };
}

function collectionDbErrorResponse(error: unknown, fallback: string) {
  const details = classifyCollectionError(error, fallback);
  return {
    ok: false,
    error: process.env.NODE_ENV === "production" ? details.fallback : `${details.fallback}: ${details.debug}`,
    code: details.code,
  };
}

let _drinkCollectionsSchemaReady: Promise<void> | null = null;

async function ensureDrinkCollectionsSchema() {
  if (_drinkCollectionsSchemaReady) return _drinkCollectionsSchemaReady;

  _drinkCollectionsSchemaReady = (async () => {
    if (!db) {
      throw new Error("Database is not configured (missing DATABASE_URL)");
    }

    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collections (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name varchar(160) NOT NULL,
        description text,
        is_public boolean NOT NULL DEFAULT false,
        is_premium boolean NOT NULL DEFAULT false,
        price_cents integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      ALTER TABLE drink_collections
      ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;
    `);

    await db.execute(sql`
      ALTER TABLE drink_collections
      ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_items (
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        drink_slug varchar(200) NOT NULL,
        added_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT drink_collection_items_collection_drink_idx UNIQUE (collection_id, drink_slug)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_purchases (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT drink_collection_purchases_user_collection_idx UNIQUE (user_id, collection_id)
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_user_idx ON drink_collections(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_public_idx ON drink_collections(is_public);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_user_updated_at_idx ON drink_collections(user_id, updated_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_public_updated_at_idx ON drink_collections(is_public, updated_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_items_slug_idx ON drink_collection_items(drink_slug);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_purchases_user_idx ON drink_collection_purchases(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_purchases_collection_idx ON drink_collection_purchases(collection_id);`);
  })();

  return _drinkCollectionsSchemaReady;
}

async function loadOwnedCollectionIdsForUser(userId?: string | null): Promise<Set<string>> {
  if (!db || !userId) return new Set();

  const rows = await db
    .select({ collectionId: drinkCollectionPurchases.collectionId })
    .from(drinkCollectionPurchases)
    .where(eq(drinkCollectionPurchases.userId, userId));

  return new Set(rows.map((row) => row.collectionId));
}

async function resolveCollectionWithItems(
  collection: typeof drinkCollections.$inferSelect,
  viewerUserId?: string | null,
  ownedCollectionIds?: Set<string>,
) {
  if (!db) return null;

  const creatorRows = await db
    .select({
      username: users.username,
      avatar: users.avatar,
    })
    .from(users)
    .where(eq(users.id, collection.userId))
    .limit(1);

  const creator = creatorRows[0];

  const itemRows = await db
    .select({
      drinkSlug: drinkCollectionItems.drinkSlug,
      addedAt: drinkCollectionItems.addedAt,
    })
    .from(drinkCollectionItems)
    .where(eq(drinkCollectionItems.collectionId, collection.id));

  const detailsBySlug = await resolveDrinkDetailsMapBySlugs(itemRows.map((row) => row.drinkSlug));

  const items = itemRows.map((row) => ({
    id: `${collection.id}:${row.drinkSlug}`,
    drinkSlug: row.drinkSlug,
    drinkName: detailsBySlug.get(row.drinkSlug)?.name ?? row.drinkSlug,
    image: detailsBySlug.get(row.drinkSlug)?.image ?? null,
    route: detailsBySlug.get(row.drinkSlug)?.route ?? `/drinks/recipe/${encodeURIComponent(row.drinkSlug)}`,
    remixedFromSlug: detailsBySlug.get(row.drinkSlug)?.remixedFromSlug ?? null,
    addedAt: row.addedAt,
    drink: detailsBySlug.get(row.drinkSlug) ?? null,
  }));

  const coverImage = items[0]?.image ?? null;
  const isOwner = Boolean(viewerUserId && viewerUserId === collection.userId);
  const isOwned = isOwner || Boolean(viewerUserId && ownedCollectionIds?.has(collection.id));

  return {
    ...collection,
    creatorUsername: creator?.username ?? null,
    creatorAvatar: creator?.avatar ?? null,
    route: `/drinks/collections/${collection.id}`,
    coverImage,
    itemsCount: itemRows.length,
    items,
    ownedByViewer: isOwned,
  };
}

async function resolvePublicCollectionCards(inputRows: Array<typeof drinkCollections.$inferSelect>, viewerUserId?: string | null) {
  const ownedCollectionIds = await loadOwnedCollectionIdsForUser(viewerUserId);
  const collections = await Promise.all(inputRows.map((row) => resolveCollectionWithItems(row, viewerUserId, ownedCollectionIds)));
  return collections.filter(Boolean);
}

function featuredCollectionScore(collection: {
  itemsCount: number;
  updatedAt: Date;
}): number {
  const recencyHours = Math.max(0, (Date.now() - new Date(collection.updatedAt).getTime()) / (1000 * 60 * 60));
  const recencyPoints = Math.max(0, 240 - recencyHours);
  return Number(collection.itemsCount) * 100 + recencyPoints;
}

function normalizeRemixDiscoverySort(value: unknown): RemixDiscoverySort {
  if (typeof value !== "string") return "recent";
  const normalized = value.trim().toLowerCase();
  return normalized === "popular" ? "popular" : "recent";
}

function challengeIsActiveNow(challenge: typeof drinkChallenges.$inferSelect, now = new Date()): boolean {
  if (!challenge.isActive) return false;
  return challenge.startsAt.getTime() <= now.getTime() && challenge.endsAt.getTime() >= now.getTime();
}

const challengeSubmissionBodySchema = z.object({
  drinkSlug: z.string().trim().min(1).max(200).optional(),
});

const CHALLENGE_SEEDS: Array<{
  slug: string;
  title: string;
  description: string;
  theme: string;
  originalDrinkSlug?: string;
  challengeType: string;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
}> = [
  {
    slug: "remix-a-tom-collins",
    title: "Remix a Tom Collins",
    description: "Put your spin on the classic Tom Collins. Keep it bright, balanced, and summer-ready.",
    theme: "Classic Remix",
    originalDrinkSlug: "tom-collins",
    challengeType: "remix",
    startsAt: new Date("2026-05-01T00:00:00.000Z"),
    endsAt: new Date("2026-06-15T23:59:59.000Z"),
    isActive: true,
  },
  {
    slug: "best-summer-spritz",
    title: "Best Summer Spritz",
    description: "Craft a light and refreshing spritz for hot weather hangouts.",
    theme: "Seasonal",
    challengeType: "open",
    startsAt: new Date("2026-05-15T00:00:00.000Z"),
    endsAt: new Date("2026-08-31T23:59:59.000Z"),
    isActive: true,
  },
  {
    slug: "zero-proof-week",
    title: "Zero-Proof Week",
    description: "Showcase alcohol-free creativity with mindful, flavor-forward builds.",
    theme: "Zero-Proof",
    challengeType: "zero-proof",
    startsAt: new Date("2026-06-01T00:00:00.000Z"),
    endsAt: new Date("2026-06-08T23:59:59.000Z"),
    isActive: true,
  },
];

async function seedDrinkChallengesIfEmpty() {
  if (!db) return;

  const existing = await db.select({ id: drinkChallenges.id }).from(drinkChallenges).limit(1);
  if (existing.length > 0) return;

  await db.insert(drinkChallenges).values(CHALLENGE_SEEDS);
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

type DrinkNotificationType = "view_summary" | "grocery_add" | "remix" | "follow";

type DrinkNotificationItem = {
  id: string;
  type: DrinkNotificationType;
  createdAt: string;
  title: string;
  subtitle: string;
  route: string | null;
  relatedDrinkSlug: string | null;
  relatedUsername: string | null;
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

type CreatorBadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  isPublic: boolean;
};

type CreatorBadgeProgress = {
  current: number;
  target: number;
  label: string;
};

const CREATOR_BADGE_DEFINITIONS: CreatorBadgeDefinition[] = [
  { id: "first-drink-published", title: "First Drink Published", description: "Published your first drink recipe.", icon: "🍹", isPublic: true },
  { id: "first-remix-created", title: "First Remix Created", description: "Shared your first remix.", icon: "🧪", isPublic: true },
  { id: "first-remix-received", title: "First Remix Received", description: "Another creator remixed one of your drinks.", icon: "🔁", isPublic: true },
  { id: "100-views", title: "100 Views", description: "Reached 100 total views across your drinks.", icon: "👀", isPublic: true },
  { id: "10-grocery-adds", title: "10 Grocery Adds", description: "Got added to grocery lists 10 times.", icon: "🛒", isPublic: true },
  { id: "5-followers", title: "5 Followers", description: "Reached 5 creator followers.", icon: "🤝", isPublic: true },
  { id: "trending-creator", title: "Trending Creator", description: "Ranked among the top trending drink creators this week.", icon: "📈", isPublic: true },
  { id: "top-creator", title: "Top Creator", description: "Ranked among the top creators on the leaderboard.", icon: "🏆", isPublic: true },
];

async function buildCreatorBadges(userId: string) {
  if (!db) {
    return {
      badges: CREATOR_BADGE_DEFINITIONS.map((badge) => ({ ...badge, isEarned: false, earnedAt: null, progress: null as CreatorBadgeProgress | null })),
    };
  }

  const [profile] = await db
    .select({ followersCount: users.followersCount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const recipes = await db
    .select({ slug: drinkRecipes.slug, createdAt: drinkRecipes.createdAt, remixedFromSlug: drinkRecipes.remixedFromSlug })
    .from(drinkRecipes)
    .where(eq(drinkRecipes.userId, userId))
    .orderBy(asc(drinkRecipes.createdAt));

  const recipeSlugs = recipes.map((recipe) => recipe.slug);

  const eventTotals = recipeSlugs.length > 0
    ? await db
        .select({
          totalViews: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view')`,
          totalGroceryAdds: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add')`,
        })
        .from(drinkEvents)
        .where(inArray(drinkEvents.slug, recipeSlugs))
    : [{ totalViews: 0, totalGroceryAdds: 0 }];

  const [firstRemixReceived] = recipeSlugs.length > 0
    ? await db
        .select({ createdAt: drinkRecipes.createdAt })
        .from(drinkRecipes)
        .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
        .orderBy(asc(drinkRecipes.createdAt))
        .limit(1)
    : [];

  const trendingRows = await getTrendingDrinkCreators(10);
  const leaderboardRows = await getDrinkCreatorLeaderboard(10);

  const firstDrink = recipes[0] ?? null;
  const firstRemixCreated = recipes.find((recipe) => Boolean(recipe.remixedFromSlug)) ?? null;
  const totalViews = Number(eventTotals[0]?.totalViews ?? 0);
  const totalGroceryAdds = Number(eventTotals[0]?.totalGroceryAdds ?? 0);
  const followerCount = Number(profile?.followersCount ?? 0);
  const isTrendingCreator = trendingRows.some((row) => row.userId === userId);
  const isTopCreator = leaderboardRows.some((row) => row.userId === userId);

  const earnedById = new Map<string, { isEarned: boolean; earnedAt: string | null; progress: CreatorBadgeProgress | null }>([
    ["first-drink-published", { isEarned: Boolean(firstDrink), earnedAt: firstDrink?.createdAt ? new Date(firstDrink.createdAt).toISOString() : null, progress: null }],
    ["first-remix-created", { isEarned: Boolean(firstRemixCreated), earnedAt: firstRemixCreated?.createdAt ? new Date(firstRemixCreated.createdAt).toISOString() : null, progress: null }],
    ["first-remix-received", { isEarned: Boolean(firstRemixReceived), earnedAt: firstRemixReceived?.createdAt ? new Date(firstRemixReceived.createdAt).toISOString() : null, progress: null }],
    ["100-views", { isEarned: totalViews >= 100, earnedAt: totalViews >= 100 ? new Date().toISOString() : null, progress: { current: totalViews, target: 100, label: "Views" } }],
    ["10-grocery-adds", { isEarned: totalGroceryAdds >= 10, earnedAt: totalGroceryAdds >= 10 ? new Date().toISOString() : null, progress: { current: totalGroceryAdds, target: 10, label: "Grocery adds" } }],
    ["5-followers", { isEarned: followerCount >= 5, earnedAt: followerCount >= 5 ? new Date().toISOString() : null, progress: { current: followerCount, target: 5, label: "Followers" } }],
    ["trending-creator", { isEarned: isTrendingCreator, earnedAt: isTrendingCreator ? new Date().toISOString() : null, progress: null }],
    ["top-creator", { isEarned: isTopCreator, earnedAt: isTopCreator ? new Date().toISOString() : null, progress: null }],
  ]);

  return {
    badges: CREATOR_BADGE_DEFINITIONS.map((definition) => {
      const computed = earnedById.get(definition.id);
      return {
        ...definition,
        isEarned: computed?.isEarned ?? false,
        earnedAt: computed?.earnedAt ?? null,
        progress: computed?.progress ?? null,
      };
    }),
  };
}

function toActivityDateKey(value: Date | null | undefined): string {
  if (!value) return "unknown";
  return value.toISOString().slice(0, 10);
}

function toReadableDay(value: Date | null | undefined): string {
  if (!value) return "recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(value);
}

function buildDrinkNotificationFeed(userId: string, items: CreatorActivityItem[]): DrinkNotificationItem[] {
  return items.map((item) => {
    const baseId = [
      item.type,
      item.createdAt,
      item.targetDrinkSlug ?? "none",
      item.actorUserId ?? item.actorUsername ?? "none",
      item.count ?? "1",
    ].join(":");

    if (item.type === "remix") {
      return {
        id: `remix:${baseId}`,
        type: "remix",
        createdAt: item.createdAt,
        title: item.targetDrinkName
          ? `Your drink ${item.targetDrinkName} was remixed`
          : "One of your drinks was remixed",
        subtitle: item.actorUsername
          ? `@${item.actorUsername} published a remix based on your original drink.`
          : "A creator published a remix based on your original drink.",
        route: item.route,
        relatedDrinkSlug: item.targetDrinkSlug,
        relatedUsername: item.actorUsername,
      };
    }

    if (item.type === "grocery_add") {
      return {
        id: `grocery:${baseId}`,
        type: "grocery_add",
        createdAt: item.createdAt,
        title: item.targetDrinkName
          ? `Your drink ${item.targetDrinkName} got grocery adds`
          : "One of your drinks got grocery adds",
        subtitle: item.count && item.count > 0
          ? `${item.count} shopping-list add${item.count === 1 ? "" : "s"} ${item.uniqueActors && item.uniqueActors > 0 ? `from ${item.uniqueActors} creator${item.uniqueActors === 1 ? "" : "s"}` : ""}.`
          : "Creators added this drink to their shopping lists.",
        route: item.route,
        relatedDrinkSlug: item.targetDrinkSlug,
        relatedUsername: null,
      };
    }

    if (item.type === "follow") {
      return {
        id: `follow:${baseId}`,
        type: "follow",
        createdAt: item.createdAt,
        title: "You gained a new follower",
        subtitle: item.actorUsername
          ? `@${item.actorUsername} started following your creator profile.`
          : "A new creator started following your creator profile.",
        route: `/drinks/creator/${userId}`,
        relatedDrinkSlug: null,
        relatedUsername: item.actorUsername,
      };
    }

    return {
      id: `views:${baseId}`,
      type: "view_summary",
      createdAt: item.createdAt,
      title: item.targetDrinkName
        ? `Your drink ${item.targetDrinkName} got new views`
        : "One of your drinks got new views",
      subtitle: item.count && item.count > 0
        ? `${item.count} view${item.count === 1 ? "" : "s"}${item.uniqueActors && item.uniqueActors > 0 ? ` from ${item.uniqueActors} person${item.uniqueActors === 1 ? "" : "s"}` : ""}.`
        : "Your drink had recent view activity.",
      route: item.route,
      relatedDrinkSlug: item.targetDrinkSlug,
      relatedUsername: null,
    };
  });
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
          route: toDrinkRoute(recipe.slug),
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


r.get("/challenges", async (_req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await seedDrinkChallengesIfEmpty();

    const rows = await db
      .select({
        id: drinkChallenges.id,
        slug: drinkChallenges.slug,
        title: drinkChallenges.title,
        description: drinkChallenges.description,
        theme: drinkChallenges.theme,
        originalDrinkSlug: drinkChallenges.originalDrinkSlug,
        challengeType: drinkChallenges.challengeType,
        startsAt: drinkChallenges.startsAt,
        endsAt: drinkChallenges.endsAt,
        isActive: drinkChallenges.isActive,
        createdAt: drinkChallenges.createdAt,
        submissionsCount: sql<number>`count(${drinkChallengeSubmissions.id})`,
      })
      .from(drinkChallenges)
      .leftJoin(drinkChallengeSubmissions, eq(drinkChallengeSubmissions.challengeId, drinkChallenges.id))
      .groupBy(
        drinkChallenges.id,
        drinkChallenges.slug,
        drinkChallenges.title,
        drinkChallenges.description,
        drinkChallenges.theme,
        drinkChallenges.originalDrinkSlug,
        drinkChallenges.challengeType,
        drinkChallenges.startsAt,
        drinkChallenges.endsAt,
        drinkChallenges.isActive,
        drinkChallenges.createdAt,
      )
      .orderBy(desc(drinkChallenges.startsAt));

    const items = rows.map((row) => ({
      ...row,
      isActive: challengeIsActiveNow(row),
      submissionsCount: Number(row.submissionsCount ?? 0),
    }));

    return res.json({ ok: true, count: items.length, items });
  } catch (error) {
    console.error("Error loading drink challenges:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink challenges" });
  }
});

r.get("/challenges/:slug", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await seedDrinkChallengesIfEmpty();

    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ ok: false, error: "Invalid challenge slug" });

    const rows = await db.select().from(drinkChallenges).where(eq(drinkChallenges.slug, slug)).limit(1);
    const challenge = rows[0];
    if (!challenge) return res.status(404).json({ ok: false, error: "Challenge not found" });

    const canonicalDrink = challenge.originalDrinkSlug ? getCanonicalDrinkBySlug(challenge.originalDrinkSlug) : null;

    return res.json({
      ok: true,
      challenge: {
        ...challenge,
        isActive: challengeIsActiveNow(challenge),
      },
      canonicalDrink: canonicalDrink
        ? {
            slug: canonicalDrink.slug,
            name: canonicalDrink.name,
            route: canonicalDrink.route,
            image: canonicalDrink.image ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error("Error loading drink challenge:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink challenge" });
  }
});

r.get("/challenges/:slug/submissions", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await seedDrinkChallengesIfEmpty();

    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ ok: false, error: "Invalid challenge slug" });

    const challengeRows = await db.select().from(drinkChallenges).where(eq(drinkChallenges.slug, slug)).limit(1);
    const challenge = challengeRows[0];
    if (!challenge) return res.status(404).json({ ok: false, error: "Challenge not found" });

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });

    const rows = await db
      .select({
        id: drinkChallengeSubmissions.id,
        challengeId: drinkChallengeSubmissions.challengeId,
        userId: drinkChallengeSubmissions.userId,
        drinkSlug: drinkChallengeSubmissions.drinkSlug,
        createdAt: drinkChallengeSubmissions.createdAt,
        username: users.username,
        avatar: users.avatar,
      })
      .from(drinkChallengeSubmissions)
      .leftJoin(users, eq(users.id, drinkChallengeSubmissions.userId))
      .where(eq(drinkChallengeSubmissions.challengeId, challenge.id))
      .orderBy(desc(drinkChallengeSubmissions.createdAt))
      .limit(limit)
      .offset(offset);

    const detailsBySlug = await resolveDrinkDetailsMapBySlugs(rows.map((row) => row.drinkSlug));

    const submissions = rows.map((row) => ({
      id: row.id,
      challengeId: row.challengeId,
      userId: row.userId,
      drinkSlug: row.drinkSlug,
      createdAt: row.createdAt,
      creatorUsername: row.username ?? null,
      creatorAvatar: row.avatar ?? null,
      drink: detailsBySlug.get(row.drinkSlug) ?? null,
    }));

    return res.json({
      ok: true,
      challenge: { ...challenge, isActive: challengeIsActiveNow(challenge) },
      count: submissions.length,
      limit,
      offset,
      submissions,
    });
  } catch (error) {
    console.error("Error loading challenge submissions:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch challenge submissions" });
  }
});

r.post("/challenges/:slug/join", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ ok: false, error: "Invalid challenge slug" });

    const rows = await db.select().from(drinkChallenges).where(eq(drinkChallenges.slug, slug)).limit(1);
    const challenge = rows[0];
    if (!challenge) return res.status(404).json({ ok: false, error: "Challenge not found" });
    if (!challengeIsActiveNow(challenge)) {
      return res.status(400).json({ ok: false, error: "Challenge is not currently active" });
    }

    const body = challengeSubmissionBodySchema.parse(req.body ?? {});
    const userId = resolveEngagementUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

    if (!body.drinkSlug) {
      return res.json({
        ok: true,
        challenge,
        submitRoute: `/drinks/submit?remix=${encodeURIComponent(challenge.originalDrinkSlug || "")}&challenge=${encodeURIComponent(challenge.slug)}`,
      });
    }

    const normalizedDrinkSlug = normalizeSlug(body.drinkSlug);
    if (!normalizedDrinkSlug) return res.status(400).json({ ok: false, error: "Invalid drink slug" });

    const drink = await resolveDrinkDetailsBySlug(normalizedDrinkSlug);
    if (!drink) return res.status(404).json({ ok: false, error: "Drink not found" });

    const inserted = await db
      .insert(drinkChallengeSubmissions)
      .values({
        challengeId: challenge.id,
        userId,
        drinkSlug: normalizedDrinkSlug,
      })
      .onConflictDoNothing()
      .returning();

    return res.status(inserted.length > 0 ? 201 : 200).json({
      ok: true,
      challengeId: challenge.id,
      challengeSlug: challenge.slug,
      joined: inserted.length > 0,
      submission: inserted[0] ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Invalid join request", details: error.errors });
    }

    console.error("Error joining challenge:", error);
    return res.status(500).json({ ok: false, error: "Failed to join challenge" });
  }
});

r.post("/challenges", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    const parsed = insertDrinkChallengeSchema.parse(req.body ?? {});
    const inserted = await db.insert(drinkChallenges).values(parsed).returning();
    return res.status(201).json({ ok: true, challenge: inserted[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Invalid challenge payload", details: error.errors });
    }

    console.error("Error creating challenge:", error);
    return res.status(500).json({ ok: false, error: "Failed to create challenge" });
  }
});

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
      challengeSlug: normalizeSlug(req.body?.challengeSlug),
      userId: resolveEngagementUserId(req),
    });

    const rows = await db.insert(drinkRecipes).values({ ...parsed, source: "chefsire" }).returning();

    const challengeSlug = normalizeSlug(req.body?.challengeSlug);
    if (challengeSlug && rows[0]?.slug && parsed.userId) {
      const challengeRows = await db.select().from(drinkChallenges).where(eq(drinkChallenges.slug, challengeSlug)).limit(1);
      const challenge = challengeRows[0];
      if (challenge) {
        await db
          .insert(drinkChallengeSubmissions)
          .values({
            challengeId: challenge.id,
            userId: parsed.userId,
            drinkSlug: rows[0].slug,
          })
          .onConflictDoNothing();
      }
    }

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
    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 30, maxLimit: 60 });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const remixRowsQuery = db
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
      );

    const remixRows = await (sort === "popular"
      ? remixRowsQuery
          .orderBy(
            desc(sql`count(${drinkEvents.id}) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} >= ${sevenDaysAgo})`),
            desc(drinkRecipes.createdAt)
          )
          .limit(limit)
          .offset(offset)
      : remixRowsQuery
          .orderBy(desc(drinkRecipes.createdAt))
          .limit(limit)
          .offset(offset));
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
        route: toDrinkRoute(entry.slug, true),
        sourceRoute,
        views7d: Number(entry.views7d ?? 0),
        remixesCount: remixesCountBySlug.get(entry.slug) ?? 0,
      };
    });

    return res.json({ ok: true, sort, count: items.length, limit, offset, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[drinks/remixes] Error fetching remix discovery feed:", {
      sort: normalizeRemixDiscoverySort(req.query?.sort),
      query: req.query,
      error,
      message,
    });
    return res.status(500).json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Failed to fetch remix discovery feed" : `Failed to fetch remix discovery feed: ${message}`,
    });
  }
});

// Fetch canonical/original drinks ranked by remix activity.
r.get("/most-remixed", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 24, maxLimit: 100 });
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
      .slice(offset, offset + limit);

    return res.json({
      ok: true,
      count: rankedItems.length,
      items: rankedItems.map((item) => ({
        slug: item.slug,
        name: item.name,
        image: item.image,
        route: item.route,
        sourceCategoryRoute: item.sourceCategoryRoute,
        remixesCount: item.remixCount,
        views7d: item.views7d,
      })),
      limit,
      offset,
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
    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 8, maxLimit: 24 });
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
      .groupBy(drinkEvents.slug)
      .orderBy(desc(sql<number>`sum(case when ${drinkEvents.createdAt} >= ${oneDayAgo} then 2 else 1 end)`), desc(sql<number>`count(*)`))
      .limit(300);

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

    const detailsBySlug = await resolveDrinkDetailsMapBySlugs([
      ...recentSlugs,
      ...rankedRows.map((row) => row.slug),
    ]);

    const recentCategoryRoutes = new Set(
      recentSlugs
        .map((slug) => detailsBySlug.get(slug)?.sourceCategoryRoute)
        .filter((route): route is string => Boolean(route))
    );

    const scopedRows: typeof rankedRows = recentCategoryRoutes.size === 0
      ? rankedRows
      : rankedRows.filter((row) => {
          const details = detailsBySlug.get(row.slug);
          return Boolean(details && recentCategoryRoutes.has(details.sourceCategoryRoute));
        });

    const recommendationPool = (scopedRows.length > 0 ? scopedRows : rankedRows).slice(0, 240);

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

    const mapped = recommendationPool.map((row) => {
      const item = detailsBySlug.get(row.slug);
      if (!item || recentSet.has(item.slug)) return null;
      return {
        ...toDiscoveryDrinkCard({
          slug: item.slug,
          name: item.name,
          image: item.image,
          route: item.route,
          remixesCount: remixesCountBySlug.get(item.slug) ?? 0,
          views7d: Number(row.views7d ?? 0),
        }),
        sourceCategoryRoute: item.sourceCategoryRoute,
        source: item.source,
        isFollowedCreator: row.isFollowedCreator,
      };
    });

    const items = mapped.filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(offset, offset + limit);

    return res.json({ ok: true, limit, offset, items });
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

    const viewerId = String(req.user.id ?? "").trim();
    if (!viewerId) {
      return res.status(401).json({ ok: false, error: "Unauthorized", code: "NO_USER" });
    }
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

    const recipeSlugs = recipeRows.map((row) => row.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const viewRows = recipeSlugs.length > 0
      ? await db
          .select({ slug: drinkEvents.slug, views7d: sql<number>`count(*)` })
          .from(drinkEvents)
          .where(
            and(
              inArray(drinkEvents.slug, recipeSlugs),
              eq(drinkEvents.eventType, "view"),
              gt(drinkEvents.createdAt, sevenDaysAgo),
            )
          )
          .groupBy(drinkEvents.slug)
      : [];

    const remixRows = recipeSlugs.length > 0
      ? await db
          .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
          .from(drinkRecipes)
          .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
          .groupBy(drinkRecipes.remixedFromSlug)
      : [];

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
    console.error("[drinks/following-feed] Error loading following drinks feed:", { viewerId: req.user?.id, error });
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ ok: false, error: process.env.NODE_ENV === "production" ? "Failed to fetch following drinks feed" : `Failed to fetch following drinks feed: ${message}` });
  }
});

r.get("/whats-new", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 40, maxLimit: 80 });
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
        subtitle: `Trending creator this week with ${Number(creator.totalRemixesReceived ?? 0).toLocaleString()} remixes received.`,
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
        route: toDrinkRoute(row.slug),
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
      .slice(offset, offset + limit);

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
      limit,
      offset,
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

r.get("/creator/:userId/badges", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const requestedUserId = String(req.params?.userId ?? "").trim();
    if (!requestedUserId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const badgeData = await buildCreatorBadges(requestedUserId);
    const isOwnerView = Boolean(req.user?.id && req.user.id === requestedUserId);

    const privateBadges = badgeData.badges;
    const publicBadges = privateBadges
      .filter((badge) => badge.isPublic && badge.isEarned)
      .map((badge) => ({ ...badge, progress: null }));

    return res.json({
      ok: true,
      userId: requestedUserId,
      visibility: isOwnerView ? "private" : "public",
      badges: isOwnerView ? privateBadges : publicBadges,
      earnedCount: (isOwnerView ? privateBadges : publicBadges).filter((badge) => badge.isEarned).length,
      totalCount: isOwnerView ? privateBadges.length : publicBadges.length,
      nextMilestones: isOwnerView
        ? privateBadges
            .filter((badge) => !badge.isEarned && badge.progress)
            .sort((a, b) => {
              const ar = a.progress ? (a.progress.current / Math.max(a.progress.target, 1)) : 0;
              const br = b.progress ? (b.progress.current / Math.max(b.progress.target, 1)) : 0;
              return br - ar;
            })
            .slice(0, 2)
            .map((badge) => ({
              id: badge.id,
              title: badge.title,
              icon: badge.icon,
              description: badge.description,
              progress: badge.progress,
            }))
        : [],
    });
  } catch (error) {
    console.error("Error fetching drink creator badges:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch creator badges" });
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

    const authUserId = String(req.user.id ?? "").trim();
    if (!authUserId || requestedUserId !== authUserId) {
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

    const recipeSlugs = recipes.map((recipe) => recipe.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0);

    const eventRows = recipeSlugs.length > 0
      ? await db
          .select({
            slug: drinkEvents.slug,
            views24h: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${oneDayAgo})`,
            views7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`,
            groceryAdds: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`,
          })
          .from(drinkEvents)
          .where(and(inArray(drinkEvents.slug, recipeSlugs), gt(drinkEvents.createdAt, sevenDaysAgo)))
          .groupBy(drinkEvents.slug)
      : [];

    const remixedByOthersRows = recipeSlugs.length > 0
      ? await db
          .select({
            remixedFromSlug: drinkRecipes.remixedFromSlug,
            remixesCount: sql<number>`count(*)`,
          })
          .from(drinkRecipes)
          .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
          .groupBy(drinkRecipes.remixedFromSlug)
      : [];

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
    console.error("[drinks/creator/:userId] Error fetching creator drink metrics:", { requestedUserId: req.params?.userId, authUserId: req.user?.id, error });
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ ok: false, error: process.env.NODE_ENV === "production" ? "Failed to fetch creator drink metrics" : `Failed to fetch creator drink metrics: ${message}` });
  }
});


// Unified drinks notifications feed for the signed-in creator user
r.get("/notifications", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const requestedUserId = String(req.user.id ?? "").trim();
    if (!requestedUserId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? Math.max(10, Math.min(limitParam, 200)) : 80;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recipes = await db
      .select({ slug: drinkRecipes.slug, name: drinkRecipes.name })
      .from(drinkRecipes)
      .where(eq(drinkRecipes.userId, requestedUserId));

    const recipeSlugs = recipes.map((recipe) => recipe.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
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
      activityItems.push({
        type: "follow",
        createdAt: row.createdAt.toISOString(),
        actorUserId: row.actorUserId ?? null,
        actorUsername,
        targetDrinkSlug: null,
        targetDrinkName: null,
        route: `/drinks/creator/${requestedUserId}`,
        message: actorUsername ? `@${actorUsername} started following you` : "Someone started following you",
      });
    }

    const sorted = activityItems
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    const notifications = buildDrinkNotificationFeed(requestedUserId, sorted);

    const typeCounts = notifications.reduce(
      (acc, item) => {
        acc[item.type] += 1;
        return acc;
      },
      { view_summary: 0, grocery_add: 0, remix: 0, follow: 0 } as Record<DrinkNotificationType, number>,
    );

    return res.json({
      ok: true,
      userId: requestedUserId,
      generatedAt: new Date().toISOString(),
      items: notifications,
      summary: {
        totalItems: notifications.length,
        typeCounts,
        windowDays: 30,
        summarized: ["view_summary", "grocery_add"],
      },
    });
  } catch (error) {
    console.error("Error loading drinks notifications:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drinks notifications" });
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

    const authUserId = String(req.user.id ?? "").trim();
    if (!authUserId || requestedUserId !== authUserId) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? Math.max(10, Math.min(limitParam, 200)) : 80;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recipes = await db
      .select({ slug: drinkRecipes.slug, name: drinkRecipes.name })
      .from(drinkRecipes)
      .where(eq(drinkRecipes.userId, requestedUserId));

    const recipeSlugs = recipes.map((recipe) => recipe.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
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

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 24, maxLimit: 100 });

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
      .orderBy(desc(drinkRecipes.createdAt))
      .limit(limit)
      .offset(offset);

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
        limit,
        offset,
      });
    }

    const recipeSlugs = recipes.map((recipe) => recipe.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
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
        route: toDrinkRoute(recipe.slug),
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
        .slice(0, limit)
        .map(({ groceryAdds7d, score, ...item }) => item),
      limit,
      offset,
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

// Unified drinks community search (drinks, remixes, creators, challenges)
r.get("/community-search", async (req, res) => {
  try {
    const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      return res.json({
        ok: true,
        query: "",
        results: {
          drinks: [],
          remixes: [],
          creators: [],
          challenges: [],
        },
      });
    }

    const canonicalMatches = await searchDrinks({ q, source: "external", pageSize: 8, offset: 0 });
    const queryLike = `%${q}%`;

    let userRecipeMatches: Array<{
      slug: string;
      name: string;
      image: string | null;
      category: string;
      subcategory: string | null;
      remixedFromSlug: string | null;
      creatorUsername: string | null;
      createdAt: Date;
    }> = [];

    let creators: Array<{
      userId: string;
      username: string;
      avatar: string | null;
      followerCount: number;
      route: string;
    }> = [];

    let challenges: Array<{
      slug: string;
      title: string;
      description: string;
      route: string;
      isActive: boolean;
    }> = [];

    if (db) {
      userRecipeMatches = await db
        .select({
          slug: drinkRecipes.slug,
          name: drinkRecipes.name,
          image: drinkRecipes.image,
          category: drinkRecipes.category,
          subcategory: drinkRecipes.subcategory,
          remixedFromSlug: drinkRecipes.remixedFromSlug,
          creatorUsername: users.username,
          createdAt: drinkRecipes.createdAt,
        })
        .from(drinkRecipes)
        .leftJoin(users, eq(users.id, drinkRecipes.userId))
        .where(
          or(
            ilike(drinkRecipes.name, queryLike),
            ilike(drinkRecipes.description, queryLike),
            ilike(drinkRecipes.category, queryLike),
            ilike(drinkRecipes.subcategory, queryLike),
            ilike(users.username, queryLike),
          ),
        )
        .orderBy(desc(drinkRecipes.createdAt))
        .limit(24);

      creators = await db
        .select({
          userId: users.id,
          username: users.username,
          avatar: users.avatar,
          followerCount: users.followersCount,
        })
        .from(users)
        .where(
          and(
            or(ilike(users.username, queryLike), ilike(users.displayName, queryLike), ilike(users.bio, queryLike)),
            sql`exists (select 1 from ${drinkRecipes} dr where dr.user_id = ${users.id})`,
          ),
        )
        .limit(8)
        .then((rows) =>
          rows.map((row) => ({
            userId: row.userId,
            username: row.username,
            avatar: row.avatar ?? null,
            followerCount: Number(row.followerCount ?? 0),
            route: `/drinks/creator/${row.userId}`,
          })),
        );

      challenges = await db
        .select({
          slug: drinkChallenges.slug,
          title: drinkChallenges.title,
          description: drinkChallenges.description,
          isActive: drinkChallenges.isActive,
          startsAt: drinkChallenges.startsAt,
          endsAt: drinkChallenges.endsAt,
        })
        .from(drinkChallenges)
        .where(
          or(
            ilike(drinkChallenges.slug, queryLike),
            ilike(drinkChallenges.title, queryLike),
            ilike(drinkChallenges.description, queryLike),
            ilike(drinkChallenges.theme, queryLike),
          ),
        )
        .orderBy(desc(drinkChallenges.createdAt))
        .limit(8)
        .then((rows) =>
          rows.map((row) => ({
            slug: row.slug,
            title: row.title,
            description: row.description,
            route: `/drinks/challenges/${row.slug}`,
            isActive:
              row.isActive &&
              row.startsAt.getTime() <= Date.now() &&
              row.endsAt.getTime() >= Date.now(),
          })),
        );
    }

    const allSearchSlugs = [
      ...canonicalMatches.results.map((item) => item.sourceId),
      ...userRecipeMatches.map((recipe) => recipe.slug),
    ];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const viewsBySlug = new Map<string, number>();
    const remixesBySlug = new Map<string, number>();

    if (db && allSearchSlugs.length > 0) {
      const viewRows = await db
        .select({ slug: drinkEvents.slug, views7d: sql<number>`count(*)` })
        .from(drinkEvents)
        .where(
          and(
            inArray(drinkEvents.slug, allSearchSlugs),
            eq(drinkEvents.eventType, "view"),
            gt(drinkEvents.createdAt, sevenDaysAgo),
          ),
        )
        .groupBy(drinkEvents.slug);

      const remixRows = await db
        .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
        .from(drinkRecipes)
        .where(inArray(drinkRecipes.remixedFromSlug, allSearchSlugs))
        .groupBy(drinkRecipes.remixedFromSlug);

      for (const row of viewRows) {
        viewsBySlug.set(row.slug, Number(row.views7d ?? 0));
      }

      for (const row of remixRows) {
        if (row.remixedFromSlug) {
          remixesBySlug.set(row.remixedFromSlug, Number(row.remixesCount ?? 0));
        }
      }
    }

    const canonicalDrinkResults = canonicalMatches.results.map((item) => ({
      slug: item.sourceId,
      name: item.title,
      image: item.imageUrl ?? null,
      route: `/drinks/recipe/${item.sourceId}`,
      sourceCategoryRoute: null,
      views7d: viewsBySlug.get(item.sourceId) ?? 0,
      remixesCount: remixesBySlug.get(item.sourceId) ?? 0,
      isTrending: item.relevanceScore >= 0.85,
    }));

    const userDrinkResults = userRecipeMatches
      .filter((recipe) => !recipe.remixedFromSlug)
      .map((recipe) => ({
        slug: recipe.slug,
        name: recipe.name,
        image: recipe.image ?? null,
        route: `/drinks/recipe/${recipe.slug}`,
        sourceCategoryRoute: `/drinks/${recipe.category}${recipe.subcategory ? `/${recipe.subcategory}` : ""}`,
        views7d: viewsBySlug.get(recipe.slug) ?? 0,
        remixesCount: remixesBySlug.get(recipe.slug) ?? 0,
        isTrending: recipe.createdAt.getTime() >= sevenDaysAgo.getTime(),
      }));

    const remixResults = userRecipeMatches
      .filter((recipe) => Boolean(recipe.remixedFromSlug))
      .map((recipe) => ({
        slug: recipe.slug,
        name: recipe.name,
        image: recipe.image ?? null,
        route: `/drinks/recipe/${recipe.slug}`,
        remixedFromSlug: recipe.remixedFromSlug,
        creatorUsername: recipe.creatorUsername ?? null,
        views7d: viewsBySlug.get(recipe.slug) ?? 0,
        remixesCount: remixesBySlug.get(recipe.slug) ?? 0,
        isTrending: recipe.createdAt.getTime() >= sevenDaysAgo.getTime(),
      }));

    return res.json({
      ok: true,
      query: q,
      results: {
        drinks: [...userDrinkResults, ...canonicalDrinkResults].slice(0, 12),
        remixes: remixResults.slice(0, 12),
        creators,
        challenges,
      },
    });
  } catch (error) {
    console.error("Error searching drinks community:", error);
    return res.status(500).json({ ok: false, error: "Failed to search drinks community" });
  }
});

// Helper to coerce query values into strings
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// ========================================
// DRINK COLLECTIONS
// ========================================

r.post("/collections", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const requestedPremium = Boolean(req.body?.isPremium);
    const requestedPriceCents = Number(req.body?.priceCents ?? 0);

    if (requestedPremium && (!Number.isFinite(requestedPriceCents) || requestedPriceCents <= 0)) {
      return res.status(400).json({ ok: false, error: "Premium collections require a positive price" });
    }

    const parsed = insertDrinkCollectionSchema.safeParse({
      userId: req.user.id,
      name: req.body?.name,
      description: normalizeCollectionDescription(req.body?.description),
      isPublic: Boolean(req.body?.isPublic),
      isPremium: requestedPremium,
      priceCents: requestedPremium ? Math.round(requestedPriceCents) : 0,
    });

    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid collection payload", details: parsed.error.flatten() });
    }

    const createdRows = await db.insert(drinkCollections).values(parsed.data).returning();
    const created = createdRows[0];
    return res.status(201).json({ ok: true, collection: { ...created, itemsCount: 0, items: [] } });
  } catch (error) {
    logCollectionRouteError("", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to create collection");
    const status = classifyCollectionError(error, "Failed to create collection").status;
    return res.status(status).json(payload);
  }
});

r.get("/collections/mine", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("/mine", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 20, maxLimit: 100 });

    const rows = await db
      .select()
      .from(drinkCollections)
      .where(eq(drinkCollections.userId, req.user.id))
      .orderBy(desc(drinkCollections.updatedAt))
      .limit(limit)
      .offset(offset);

    const collections = await Promise.all(rows.map((row) => resolveCollectionWithItems(row, req.user?.id ?? null)));
    return res.json({ ok: true, limit, offset, collections: collections.filter(Boolean) });
  } catch (error) {
    logCollectionRouteError("/mine", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load collections");
    const status = classifyCollectionError(error, "Failed to load collections").status;
    return res.status(status).json(payload);
  }
});

r.get("/collections/public/:userId", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/public/:userId", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 20, maxLimit: 100 });

    const rows = await db
      .select()
      .from(drinkCollections)
      .where(and(eq(drinkCollections.userId, req.params.userId), eq(drinkCollections.isPublic, true)))
      .orderBy(desc(drinkCollections.updatedAt))
      .limit(limit)
      .offset(offset);

    const collections = await resolvePublicCollectionCards(rows, req.user?.id ?? null);
    return res.json({ ok: true, limit, offset, collections: collections.filter(Boolean) });
  } catch (error) {
    const message = logCollectionRouteError("/public/:userId", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load public collections"));
  }
});

r.get("/collections/explore", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/explore", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 24, maxLimit: 100 });

    const rows = await db
      .select()
      .from(drinkCollections)
      .where(eq(drinkCollections.isPublic, true))
      .orderBy(desc(drinkCollections.updatedAt))
      .limit(limit)
      .offset(offset);

    const collections = await resolvePublicCollectionCards(rows, req.user?.id ?? null);
    return res.json({ ok: true, limit, offset, collections });
  } catch (error) {
    const message = logCollectionRouteError("/explore", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load collections explore"));
  }
});

r.get("/collections/featured", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/featured", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const { limit } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 8, maxLimit: 24 });

    const rows = await db
      .select()
      .from(drinkCollections)
      .where(eq(drinkCollections.isPublic, true))
      .orderBy(desc(drinkCollections.updatedAt))
      .limit(100);

    const hydrated = await resolvePublicCollectionCards(rows, req.user?.id ?? null);
    const featured = hydrated
      .sort((a, b) => featuredCollectionScore(b) - featuredCollectionScore(a))
      .slice(0, limit);

    return res.json({
      ok: true,
      ranking: "Featured score = (public collection itemsCount × 100) + recency bonus from updatedAt.",
      collections: featured,
    });
  } catch (error) {
    const message = logCollectionRouteError("/featured", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load featured collections"));
  }
});


r.get("/collections/:id/ownership", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const rows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = rows[0];
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });

    const isOwner = req.user.id === collection.userId;
    const ownedCollectionIds = await loadOwnedCollectionIdsForUser(req.user.id);
    const owned = isOwner || ownedCollectionIds.has(collection.id);

    return res.json({ ok: true, collectionId: collection.id, owned });
  } catch (error) {
    const message = logCollectionRouteError("/:id/ownership", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to resolve ownership"));
  }
});

r.post("/collections/:id/purchase", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const rows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = rows[0];
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });

    const isOwner = req.user.id === collection.userId;
    if (!collection.isPublic && !isOwner) {
      return res.status(403).json({ ok: false, error: "Collection is private" });
    }

    if (!collection.isPremium) {
      return res.status(400).json({ ok: false, error: "Collection is already free" });
    }

    if (isOwner) {
      return res.json({ ok: true, collectionId: collection.id, owned: true, alreadyOwned: true });
    }

    const inserted = await db
      .insert(drinkCollectionPurchases)
      .values({
        userId: req.user.id,
        collectionId: collection.id,
      })
      .onConflictDoNothing({ target: [drinkCollectionPurchases.userId, drinkCollectionPurchases.collectionId] })
      .returning({ id: drinkCollectionPurchases.id });

    return res.status(inserted.length ? 201 : 200).json({
      ok: true,
      collectionId: collection.id,
      owned: true,
      alreadyOwned: inserted.length === 0,
    });
  } catch (error) {
    const message = logCollectionRouteError("/:id/purchase", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to unlock collection"));
  }
});

r.get("/collections/:id", optionalAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const rows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = rows[0];

    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });

    const isOwner = req.user?.id && req.user.id === collection.userId;
    if (!collection.isPublic && !isOwner) {
      return res.status(403).json({ ok: false, error: "Collection is private" });
    }

    const ownedCollectionIds = await loadOwnedCollectionIdsForUser(req.user?.id ?? null);
    const hydrated = await resolveCollectionWithItems(collection, req.user?.id ?? null, ownedCollectionIds);

    if (!hydrated) return res.status(500).json({ ok: false, error: "Failed to resolve collection" });

    const isOwned = Boolean(hydrated.ownedByViewer);
    if (hydrated.isPremium && !isOwner && !isOwned) {
      const previewLimit = 2;
      return res.json({
        ok: true,
        collection: {
          ...hydrated,
          isLocked: true,
          requiresUnlock: true,
          ownedByViewer: false,
          previewLimit,
          items: hydrated.items.slice(0, previewLimit),
        },
      });
    }

    return res.json({
      ok: true,
      collection: {
        ...hydrated,
        isLocked: false,
        requiresUnlock: false,
      },
    });
  } catch (error) {
    const message = logCollectionRouteError("/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load collection"));
  }
});

r.patch("/collections/:id", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("/:id", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (existing.userId !== req.user.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    const parsed = updateDrinkCollectionBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid collection update", details: parsed.error.flatten() });
    }

    const updatedRows = await db
      .update(drinkCollections)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: normalizeCollectionDescription(parsed.data.description) } : {}),
        ...(parsed.data.isPublic !== undefined ? { isPublic: parsed.data.isPublic } : {}),
        ...(parsed.data.isPremium !== undefined ? { isPremium: parsed.data.isPremium } : {}),
        ...(parsed.data.priceCents !== undefined ? { priceCents: parsed.data.priceCents } : {}),
        ...(parsed.data.isPremium === false ? { priceCents: 0 } : {}),
        updatedAt: new Date(),
      })
      .where(eq(drinkCollections.id, req.params.id))
      .returning();

    const hydrated = await resolveCollectionWithItems(updatedRows[0], req.user?.id ?? null);
    return res.json({ ok: true, collection: hydrated });
  } catch (error) {
    logCollectionRouteError("/:id", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to update collection");
    const status = classifyCollectionError(error, "Failed to update collection").status;
    return res.status(status).json(payload);
  }
});

r.delete("/collections/:id", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("/:id", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (existing.userId !== req.user.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    await db.delete(drinkCollections).where(eq(drinkCollections.id, req.params.id));
    return res.json({ ok: true, message: "Collection deleted" });
  } catch (error) {
    logCollectionRouteError("/:id", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to delete collection");
    const status = classifyCollectionError(error, "Failed to delete collection").status;
    return res.status(status).json(payload);
  }
});

r.post("/collections/:id/items", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("/:id/items", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (existing.userId !== req.user.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    const parsed = createDrinkCollectionItemBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid collection item payload", details: parsed.error.flatten() });
    }

    const drink = await resolveDrinkDetailsBySlug(parsed.data.drinkSlug);
    if (!drink) return res.status(404).json({ ok: false, error: "Drink slug not found" });

    await db
      .insert(drinkCollectionItems)
      .values({ collectionId: req.params.id, drinkSlug: parsed.data.drinkSlug })
      .onConflictDoNothing();

    await db
      .update(drinkCollections)
      .set({ updatedAt: new Date() })
      .where(eq(drinkCollections.id, req.params.id));

    const refreshedRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const hydrated = await resolveCollectionWithItems(refreshedRows[0], req.user?.id ?? null);
    return res.status(201).json({ ok: true, collection: hydrated });
  } catch (error) {
    logCollectionRouteError("/:id/items", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to add item");
    const status = classifyCollectionError(error, "Failed to add item").status;
    return res.status(status).json(payload);
  }
});

r.delete("/collections/:id/items/:slug", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("/:id/items/:slug", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (existing.userId !== req.user.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });

    await db
      .delete(drinkCollectionItems)
      .where(and(eq(drinkCollectionItems.collectionId, req.params.id), eq(drinkCollectionItems.drinkSlug, slug)));

    await db
      .update(drinkCollections)
      .set({ updatedAt: new Date() })
      .where(eq(drinkCollections.id, req.params.id));

    const refreshedRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const hydrated = await resolveCollectionWithItems(refreshedRows[0], req.user?.id ?? null);
    return res.json({ ok: true, collection: hydrated });
  } catch (error) {
    logCollectionRouteError("/:id/items/:slug", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to remove item");
    const status = classifyCollectionError(error, "Failed to remove item").status;
    return res.status(status).json(payload);
  }
});

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
