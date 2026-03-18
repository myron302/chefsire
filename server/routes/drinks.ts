// server/routes/drinks.ts
import { Router, type Request } from "express";
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
  drinkCollectionCheckoutSessions,
  drinkCollectionSalesLedger,
  drinkCollectionSquareWebhookEvents,
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
import { WebhooksHelper } from "square";
import { getSquareClient, getSquareConfigError, requireWebhookKey, squareConfig } from "../lib/square";

const r = Router();

type EventType = "view" | "remix" | "grocery_add";

type DrinkCollectionPurchaseStatus = "completed" | "refunded_pending" | "refunded" | "revoked";
type DrinkCollectionCheckoutStatus = "pending" | "completed" | "failed" | "canceled" | "refunded_pending" | "refunded" | "revoked";
type DrinkCollectionSalesLedgerStatus = "completed" | "refunded_pending" | "refunded" | "revoked";

type DrinkCollectionCheckoutSessionRecord = typeof drinkCollectionCheckoutSessions.$inferSelect;

type ResolvedCollectionPurchaseContext = {
  collection: typeof drinkCollections.$inferSelect;
  isOwner: boolean;
  alreadyOwned: boolean;
};

type CollectionAccessStatusInput = {
  purchaseStatus: DrinkCollectionPurchaseStatus;
  checkoutStatus: DrinkCollectionCheckoutStatus;
  ledgerStatus: DrinkCollectionSalesLedgerStatus;
  reason?: string | null;
  squarePaymentId?: string | null;
  squareOrderId?: string | null;
  refundedAt?: Date | null;
};

type SquareCheckoutVerificationResult = {
  status: DrinkCollectionCheckoutStatus;
  owned: boolean;
  collectionId: string;
  checkoutSessionId: string;
  squareOrderId?: string | null;
  squarePaymentId?: string | null;
  failureReason?: string | null;
};

type ParsedSquareOrderStatus = {
  status: DrinkCollectionCheckoutStatus;
  squareOrderId?: string | null;
  squarePaymentId?: string | null;
  failureReason?: string | null;
};

type SquareOrderVerificationPayload = {
  order: any;
  payment: any | null;
  squareOrderId: string | null;
  squarePaymentId: string | null;
};

type CollectionCheckoutSnapshot = {
  checkoutSessionId: string;
  status: DrinkCollectionCheckoutStatus;
  failureReason: string | null;
  updatedAt: string;
  verifiedAt: string | null;
  expiresAt: string | null;
};

type SquareWebhookEventBody = {
  event_id?: string;
  type?: string;
  created_at?: string;
  data?: {
    id?: string;
    type?: string;
    object?: Record<string, any> | null;
  } | null;
};

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
const PREMIUM_COLLECTION_PLATFORM_FEE_BPS = 1500;
const PREMIUM_COLLECTION_CREATOR_SHARE_BPS = 10000 - PREMIUM_COLLECTION_PLATFORM_FEE_BPS;

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
        status text NOT NULL DEFAULT 'completed',
        status_reason text,
        access_revoked_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT drink_collection_purchases_user_collection_idx UNIQUE (user_id, collection_id)
      );
    `);

    await db.execute(sql`ALTER TABLE drink_collection_purchases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';`);
    await db.execute(sql`ALTER TABLE drink_collection_purchases ADD COLUMN IF NOT EXISTS status_reason text;`);
    await db.execute(sql`ALTER TABLE drink_collection_purchases ADD COLUMN IF NOT EXISTS access_revoked_at timestamp;`);
    await db.execute(sql`ALTER TABLE drink_collection_purchases ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_checkout_sessions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        provider text NOT NULL DEFAULT 'square',
        status text NOT NULL DEFAULT 'pending',
        amount_cents integer NOT NULL,
        currency_code text NOT NULL DEFAULT 'USD',
        square_payment_link_id text,
        square_order_id text,
        square_payment_id text,
        provider_reference_id text NOT NULL UNIQUE,
        checkout_url text,
        last_verified_at timestamp,
        verified_at timestamp,
        refunded_at timestamp,
        access_revoked_at timestamp,
        failure_reason text,
        expires_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`ALTER TABLE drink_collection_checkout_sessions ADD COLUMN IF NOT EXISTS refunded_at timestamp;`);
    await db.execute(sql`ALTER TABLE drink_collection_checkout_sessions ADD COLUMN IF NOT EXISTS access_revoked_at timestamp;`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_square_webhook_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id text NOT NULL UNIQUE,
        event_type text NOT NULL,
        object_type text,
        object_id text,
        checkout_session_id varchar REFERENCES drink_collection_checkout_sessions(id) ON DELETE SET NULL,
        status text NOT NULL DEFAULT 'processed',
        received_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_sales_ledger (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        purchase_id varchar REFERENCES drink_collection_purchases(id) ON DELETE SET NULL,
        checkout_session_id varchar REFERENCES drink_collection_checkout_sessions(id) ON DELETE SET NULL,
        gross_amount_cents integer NOT NULL,
        platform_fee_cents integer,
        creator_share_cents integer,
        currency_code text NOT NULL DEFAULT 'USD',
        status text NOT NULL DEFAULT 'completed',
        status_reason text,
        refunded_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`ALTER TABLE drink_collection_sales_ledger ADD COLUMN IF NOT EXISTS status_reason text;`);
    await db.execute(sql`ALTER TABLE drink_collection_sales_ledger ADD COLUMN IF NOT EXISTS refunded_at timestamp;`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_user_idx ON drink_collections(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_public_idx ON drink_collections(is_public);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_user_updated_at_idx ON drink_collections(user_id, updated_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_public_updated_at_idx ON drink_collections(is_public, updated_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_items_slug_idx ON drink_collection_items(drink_slug);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_purchases_user_idx ON drink_collection_purchases(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_purchases_collection_idx ON drink_collection_purchases(collection_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_checkout_sessions_user_idx ON drink_collection_checkout_sessions(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_checkout_sessions_collection_idx ON drink_collection_checkout_sessions(collection_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_checkout_sessions_status_idx ON drink_collection_checkout_sessions(status);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_collection_checkout_sessions_payment_link_idx ON drink_collection_checkout_sessions(square_payment_link_id) WHERE square_payment_link_id IS NOT NULL;`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_collection_checkout_sessions_order_idx ON drink_collection_checkout_sessions(square_order_id) WHERE square_order_id IS NOT NULL;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_square_webhook_events_object_idx ON drink_collection_square_webhook_events(object_type, object_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_square_webhook_events_checkout_session_idx ON drink_collection_square_webhook_events(checkout_session_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_sales_ledger_user_idx ON drink_collection_sales_ledger(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_sales_ledger_collection_idx ON drink_collection_sales_ledger(collection_id);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_collection_sales_ledger_purchase_idx ON drink_collection_sales_ledger(purchase_id) WHERE purchase_id IS NOT NULL;`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_collection_sales_ledger_checkout_session_idx ON drink_collection_sales_ledger(checkout_session_id) WHERE checkout_session_id IS NOT NULL;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_sales_ledger_status_created_at_idx ON drink_collection_sales_ledger(status, created_at);`);

    await backfillDrinkCollectionSalesLedger();
  })();

  return _drinkCollectionsSchemaReady;
}

function estimateCollectionFinanceBreakdown(grossAmountCents: number) {
  const safeGross = Math.max(0, Number(grossAmountCents ?? 0));
  const platformFeeCents = Math.round((safeGross * PREMIUM_COLLECTION_PLATFORM_FEE_BPS) / 10000);
  const creatorShareCents = Math.max(0, safeGross - platformFeeCents);
  return {
    grossAmountCents: safeGross,
    platformFeeCents,
    creatorShareCents,
  };
}

function isCollectionAccessActive(status?: string | null): boolean {
  return status === "completed";
}

function isRefundRelatedStatus(status?: string | null): boolean {
  return status === "refunded_pending" || status === "refunded";
}

async function upsertDrinkCollectionSalesLedgerEntry(
  tx: typeof db,
  input: {
    creatorUserId: string;
    collectionId: string;
    purchaseId: string | null;
    checkoutSessionId: string | null;
    grossAmountCents: number;
    currencyCode: string | null | undefined;
    createdAt: Date;
    status?: DrinkCollectionSalesLedgerStatus;
    statusReason?: string | null;
    refundedAt?: Date | null;
  },
) {
  if (!tx) {
    throw new Error("Database unavailable");
  }

  const finance = estimateCollectionFinanceBreakdown(input.grossAmountCents);
  const values = {
    userId: input.creatorUserId,
    collectionId: input.collectionId,
    purchaseId: input.purchaseId,
    checkoutSessionId: input.checkoutSessionId,
    grossAmountCents: finance.grossAmountCents,
    platformFeeCents: finance.platformFeeCents,
    creatorShareCents: finance.creatorShareCents,
    currencyCode: normalizeSquareCurrencyCode(input.currencyCode),
    status: input.status ?? "completed",
    statusReason: input.statusReason ?? null,
    refundedAt: input.refundedAt ?? null,
    createdAt: input.createdAt,
    updatedAt: new Date(),
  } as const;

  if (input.checkoutSessionId) {
    await tx
      .insert(drinkCollectionSalesLedger)
      .values(values)
      .onConflictDoUpdate({
        target: drinkCollectionSalesLedger.checkoutSessionId,
        set: {
          userId: values.userId,
          collectionId: values.collectionId,
          purchaseId: values.purchaseId,
          grossAmountCents: values.grossAmountCents,
          platformFeeCents: values.platformFeeCents,
          creatorShareCents: values.creatorShareCents,
          currencyCode: values.currencyCode,
          status: values.status,
          statusReason: values.statusReason,
          refundedAt: values.refundedAt,
          createdAt: values.createdAt,
          updatedAt: values.updatedAt,
        },
      });
    return;
  }

  if (input.purchaseId) {
    await tx
      .insert(drinkCollectionSalesLedger)
      .values(values)
      .onConflictDoUpdate({
        target: drinkCollectionSalesLedger.purchaseId,
        set: {
          userId: values.userId,
          collectionId: values.collectionId,
          checkoutSessionId: values.checkoutSessionId,
          grossAmountCents: values.grossAmountCents,
          platformFeeCents: values.platformFeeCents,
          creatorShareCents: values.creatorShareCents,
          currencyCode: values.currencyCode,
          status: values.status,
          statusReason: values.statusReason,
          refundedAt: values.refundedAt,
          createdAt: values.createdAt,
          updatedAt: values.updatedAt,
        },
      });
  }
}

async function backfillDrinkCollectionSalesLedger() {
  if (!db) return;

  const completedSessions = await db
    .select({
      sessionId: drinkCollectionCheckoutSessions.id,
      purchaserUserId: drinkCollectionCheckoutSessions.userId,
      collectionId: drinkCollectionCheckoutSessions.collectionId,
      amountCents: drinkCollectionCheckoutSessions.amountCents,
      currencyCode: drinkCollectionCheckoutSessions.currencyCode,
      verifiedAt: drinkCollectionCheckoutSessions.verifiedAt,
      updatedAt: drinkCollectionCheckoutSessions.updatedAt,
      creatorUserId: drinkCollections.userId,
    })
    .from(drinkCollectionCheckoutSessions)
    .innerJoin(drinkCollections, eq(drinkCollectionCheckoutSessions.collectionId, drinkCollections.id))
    .where(eq(drinkCollectionCheckoutSessions.status, "completed"))
    .orderBy(desc(drinkCollectionCheckoutSessions.verifiedAt), desc(drinkCollectionCheckoutSessions.updatedAt));

  for (const session of completedSessions) {
    const purchaseRows = await db
      .select({
        id: drinkCollectionPurchases.id,
        createdAt: drinkCollectionPurchases.createdAt,
        status: drinkCollectionPurchases.status,
        statusReason: drinkCollectionPurchases.statusReason,
        accessRevokedAt: drinkCollectionPurchases.accessRevokedAt,
      })
      .from(drinkCollectionPurchases)
      .where(
        and(
          eq(drinkCollectionPurchases.userId, session.purchaserUserId),
          eq(drinkCollectionPurchases.collectionId, session.collectionId),
        ),
      )
      .limit(1);

    const purchase = purchaseRows[0];
    if (!purchase) continue;

    await upsertDrinkCollectionSalesLedgerEntry(db, {
      creatorUserId: session.creatorUserId,
      collectionId: session.collectionId,
      purchaseId: purchase.id,
      checkoutSessionId: session.sessionId,
      grossAmountCents: Number(session.amountCents ?? 0),
      currencyCode: session.currencyCode,
      createdAt: purchase.createdAt ?? session.verifiedAt ?? session.updatedAt ?? new Date(),
      status: purchase.status === "completed" ? "completed" : purchase.status,
      statusReason: purchase.statusReason,
      refundedAt: purchase.accessRevokedAt,
    });
  }
}

function getCollectionCheckoutBaseUrl(req: Request) {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim() || process.env.CLIENT_URL?.trim();
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/$/, "");
  const host = req.get("host");
  if (!host) throw new Error("Unable to determine checkout redirect host");
  return `${req.protocol}://${host}`;
}

function buildCollectionCheckoutRedirectUrl(req: Request, collectionId: string, checkoutSessionId: string) {
  const baseUrl = getCollectionCheckoutBaseUrl(req);
  return `${baseUrl}/drinks/collections/${encodeURIComponent(collectionId)}?checkoutSessionId=${encodeURIComponent(checkoutSessionId)}&squareCheckout=return`;
}

function formatCollectionCheckoutReferenceId(checkoutSessionId: string) {
  return `drink_collection_checkout:${checkoutSessionId}`;
}

function normalizeSquareCurrencyCode(value?: string | null) {
  const normalized = String(value || "USD").trim().toUpperCase();
  return normalized || "USD";
}

function bigintAmountToNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.length > 0) return Number(value);
  return 0;
}

function sumTenderAmounts(tenders: any[] | null | undefined) {
  return (tenders ?? []).reduce((sum, tender) => sum + bigintAmountToNumber(tender?.amountMoney?.amount), 0);
}

async function resolveCollectionPurchaseContext(collectionId: string, viewerUserId: string): Promise<ResolvedCollectionPurchaseContext> {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const rows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, collectionId)).limit(1);
  const collection = rows[0];
  if (!collection) {
    const error = new Error("Collection not found");
    (error as any).status = 404;
    throw error;
  }

  const isOwner = viewerUserId === collection.userId;
  if (!collection.isPublic && !isOwner) {
    const error = new Error("Collection is private");
    (error as any).status = 403;
    throw error;
  }

  if (!collection.isPremium) {
    const error = new Error("Collection is already free");
    (error as any).status = 400;
    throw error;
  }

  const ownedCollectionIds = await loadOwnedCollectionIdsForUser(viewerUserId);
  return {
    collection,
    isOwner,
    alreadyOwned: isOwner || ownedCollectionIds.has(collection.id),
  };
}

async function loadCheckoutSessionForUser(checkoutSessionId: string, userId: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(drinkCollectionCheckoutSessions)
    .where(
      and(
        eq(drinkCollectionCheckoutSessions.id, checkoutSessionId),
        eq(drinkCollectionCheckoutSessions.userId, userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

function getCollectionCheckoutPollStatus(session: DrinkCollectionCheckoutSessionRecord): DrinkCollectionCheckoutStatus {
  if (session.status === "completed") return "completed";
  if (session.status === "failed") return "failed";
  if (session.status === "canceled") return "canceled";
  if (session.status === "refunded_pending") return "refunded_pending";
  if (session.status === "refunded") return "refunded";
  if (session.status === "revoked") return "revoked";
  return "pending";
}

function toCollectionCheckoutSnapshot(session?: DrinkCollectionCheckoutSessionRecord | null): CollectionCheckoutSnapshot | null {
  if (!session) return null;
  return {
    checkoutSessionId: session.id,
    status: getCollectionCheckoutPollStatus(session),
    failureReason: session.failureReason ?? null,
    updatedAt: session.updatedAt.toISOString(),
    verifiedAt: session.verifiedAt ? session.verifiedAt.toISOString() : null,
    expiresAt: session.expiresAt ? session.expiresAt.toISOString() : null,
  };
}

async function loadLatestCheckoutSessionForUserCollection(userId: string, collectionId: string) {
  if (!db) return null;

  const rows = await db
    .select()
    .from(drinkCollectionCheckoutSessions)
    .where(
      and(
        eq(drinkCollectionCheckoutSessions.userId, userId),
        eq(drinkCollectionCheckoutSessions.collectionId, collectionId),
      ),
    )
    .orderBy(desc(drinkCollectionCheckoutSessions.updatedAt), desc(drinkCollectionCheckoutSessions.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function loadCheckoutSessionForWebhookLookup(input: {
  checkoutSessionId?: string | null;
  squareOrderId?: string | null;
  squarePaymentId?: string | null;
  providerReferenceId?: string | null;
}) {
  if (!db) return null;

  const conditions: any[] = [];
  if (input.checkoutSessionId) conditions.push(eq(drinkCollectionCheckoutSessions.id, input.checkoutSessionId));
  if (input.squareOrderId) conditions.push(eq(drinkCollectionCheckoutSessions.squareOrderId, input.squareOrderId));
  if (input.squarePaymentId) conditions.push(eq(drinkCollectionCheckoutSessions.squarePaymentId, input.squarePaymentId));
  if (input.providerReferenceId) conditions.push(eq(drinkCollectionCheckoutSessions.providerReferenceId, input.providerReferenceId));
  if (!conditions.length) return null;

  const rows = await db
    .select()
    .from(drinkCollectionCheckoutSessions)
    .where(or(...conditions))
    .orderBy(desc(drinkCollectionCheckoutSessions.updatedAt), desc(drinkCollectionCheckoutSessions.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function grantCollectionPurchase(
  session: DrinkCollectionCheckoutSessionRecord,
  input: { squarePaymentId?: string | null; squareOrderId?: string | null } = {},
) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  await db.transaction(async (tx) => {
    const collectionRows = await tx
      .select({
        creatorUserId: drinkCollections.userId,
        priceCents: drinkCollections.priceCents,
      })
      .from(drinkCollections)
      .where(eq(drinkCollections.id, session.collectionId))
      .limit(1);

    const collection = collectionRows[0];
    if (!collection) {
      throw new Error("Collection not found for premium purchase grant");
    }

    const now = new Date();
    const insertedPurchase = await tx
      .insert(drinkCollectionPurchases)
      .values({
        userId: session.userId,
        collectionId: session.collectionId,
        status: "completed",
        statusReason: null,
        accessRevokedAt: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [drinkCollectionPurchases.userId, drinkCollectionPurchases.collectionId],
        set: {
          status: "completed",
          statusReason: null,
          accessRevokedAt: null,
          updatedAt: now,
        },
      })
      .returning({
        id: drinkCollectionPurchases.id,
        createdAt: drinkCollectionPurchases.createdAt,
      });

    const purchase = insertedPurchase[0] ?? (await tx
      .select({
        id: drinkCollectionPurchases.id,
        createdAt: drinkCollectionPurchases.createdAt,
      })
      .from(drinkCollectionPurchases)
      .where(
        and(
          eq(drinkCollectionPurchases.userId, session.userId),
          eq(drinkCollectionPurchases.collectionId, session.collectionId),
        ),
      )
      .limit(1))[0];

    if (!purchase) {
      throw new Error("Purchase ownership record missing after premium collection grant");
    }

    await tx
      .update(drinkCollectionCheckoutSessions)
      .set({
        status: "completed",
        squareOrderId: input.squareOrderId ?? session.squareOrderId,
        squarePaymentId: input.squarePaymentId ?? session.squarePaymentId,
        verifiedAt: now,
        refundedAt: null,
        accessRevokedAt: null,
        lastVerifiedAt: now,
        failureReason: null,
        updatedAt: now,
      })
      .where(eq(drinkCollectionCheckoutSessions.id, session.id));

    await upsertDrinkCollectionSalesLedgerEntry(tx as typeof db, {
      creatorUserId: collection.creatorUserId,
      collectionId: session.collectionId,
      purchaseId: purchase.id,
      checkoutSessionId: session.id,
      grossAmountCents: Number(session.amountCents ?? collection.priceCents ?? 0),
      currencyCode: session.currencyCode,
      createdAt: purchase.createdAt ?? session.verifiedAt ?? session.updatedAt ?? new Date(),
      status: "completed",
      statusReason: null,
      refundedAt: null,
    });
  });
}

async function updateCollectionAccessState(
  session: DrinkCollectionCheckoutSessionRecord,
  input: CollectionAccessStatusInput,
) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    const revokeTimestamp = input.purchaseStatus === "completed" ? null : (input.refundedAt ?? now);

    const purchaseRows = await tx
      .select({
        id: drinkCollectionPurchases.id,
        createdAt: drinkCollectionPurchases.createdAt,
      })
      .from(drinkCollectionPurchases)
      .where(
        and(
          eq(drinkCollectionPurchases.userId, session.userId),
          eq(drinkCollectionPurchases.collectionId, session.collectionId),
        ),
      )
      .limit(1);

    const existingPurchase = purchaseRows[0] ?? null;

    if (existingPurchase) {
      await tx
        .update(drinkCollectionPurchases)
        .set({
          status: input.purchaseStatus,
          statusReason: input.reason ?? null,
          accessRevokedAt: revokeTimestamp,
          updatedAt: now,
        })
        .where(eq(drinkCollectionPurchases.id, existingPurchase.id));
    }

    await tx
      .update(drinkCollectionCheckoutSessions)
      .set({
        status: input.checkoutStatus,
        squareOrderId: input.squareOrderId ?? session.squareOrderId,
        squarePaymentId: input.squarePaymentId ?? session.squarePaymentId,
        refundedAt: isRefundRelatedStatus(input.checkoutStatus) ? (input.refundedAt ?? now) : null,
        accessRevokedAt: input.checkoutStatus === "completed" ? null : revokeTimestamp,
        failureReason: input.reason ?? null,
        lastVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(drinkCollectionCheckoutSessions.id, session.id));

    if (existingPurchase || input.ledgerStatus === "completed") {
      await tx
        .update(drinkCollectionSalesLedger)
        .set({
          purchaseId: existingPurchase?.id ?? null,
          status: input.ledgerStatus,
          statusReason: input.reason ?? null,
          refundedAt: isRefundRelatedStatus(input.ledgerStatus) ? (input.refundedAt ?? now) : null,
          updatedAt: now,
        })
        .where(eq(drinkCollectionSalesLedger.checkoutSessionId, session.id));
    }
  });
}

function parseSquareOrderState(order: any, payment: any | null, expectedAmountCents: number): ParsedSquareOrderStatus {
  const orderState = String(order?.state || "").toUpperCase();
  const tenderTotal = sumTenderAmounts(order?.tenders);
  const squarePaymentId = payment?.id ?? order?.tenders?.find((tender: any) => tender?.paymentId || tender?.id)?.paymentId ?? order?.tenders?.find((tender: any) => tender?.paymentId || tender?.id)?.id ?? null;
  const paymentStatus = String(payment?.status || "").toUpperCase();
  const paymentAmount = bigintAmountToNumber(payment?.amountMoney?.amount);

  if (orderState === "COMPLETED" && tenderTotal >= expectedAmountCents) {
    if (!payment || (paymentStatus === "COMPLETED" && paymentAmount >= expectedAmountCents)) {
      return {
        status: "completed",
        squareOrderId: order?.id ?? null,
        squarePaymentId,
      };
    }
  }

  if (paymentStatus === "FAILED") {
    return {
      status: "failed",
      squareOrderId: order?.id ?? null,
      squarePaymentId,
      failureReason: "Square reported the payment as failed.",
    };
  }

  if (paymentStatus === "CANCELED" || orderState === "CANCELED") {
    return {
      status: "canceled",
      squareOrderId: order?.id ?? null,
      squarePaymentId,
      failureReason: "Square checkout was canceled before payment completed.",
    };
  }

  return {
    status: "pending",
    squareOrderId: order?.id ?? null,
    squarePaymentId,
  };
}

async function fetchSquareOrderVerification(session: DrinkCollectionCheckoutSessionRecord): Promise<SquareOrderVerificationPayload | null> {
  if (!session.squareOrderId) return null;

  const squareClient = getSquareClient();
  const orderResponse = await squareClient.orders.get({ orderId: session.squareOrderId });
  const order = orderResponse?.order ?? null;
  if (!order) return null;

  const paymentId = order.tenders?.find((tender) => tender?.paymentId || tender?.id)?.paymentId
    ?? order.tenders?.find((tender) => tender?.paymentId || tender?.id)?.id
    ?? session.squarePaymentId
    ?? null;

  let payment = null;
  if (paymentId) {
    try {
      const paymentResponse = await squareClient.payments.get({ paymentId });
      payment = paymentResponse?.payment ?? null;
    } catch (error) {
      console.warn("[drinks/collections] Failed to retrieve Square payment", {
        checkoutSessionId: session.id,
        paymentId,
        error,
      });
    }
  }

  return {
    order,
    payment,
    squareOrderId: order.id ?? session.squareOrderId ?? null,
    squarePaymentId: payment?.id ?? paymentId,
  };
}


function getSquareWebhookNotificationUrl(req: Request) {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim() || process.env.CLIENT_URL?.trim();
  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/$/, "")}${req.originalUrl}`;
  }

  const host = req.get("host");
  if (!host) {
    throw new Error("Unable to determine Square webhook host");
  }

  return `${req.protocol}://${host}${req.originalUrl}`;
}

function extractSquareWebhookObject(payload: SquareWebhookEventBody) {
  const objectEnvelope = payload.data?.object ?? null;
  const objectType = String(payload.data?.type || "").trim().toLowerCase();
  if (!objectEnvelope || !objectType) {
    return { objectType, resource: null as Record<string, any> | null };
  }

  const resource = (objectEnvelope as Record<string, any>)[objectType] ?? objectEnvelope;
  return {
    objectType,
    resource: resource && typeof resource === "object" ? (resource as Record<string, any>) : null,
  };
}

async function resolveWebhookSessionFromPayload(payload: SquareWebhookEventBody) {
  const { resource } = extractSquareWebhookObject(payload);
  const checkoutSessionId = typeof resource?.metadata?.checkoutSessionId === "string" ? resource.metadata.checkoutSessionId : null;
  const providerReferenceId = typeof resource?.referenceId === "string"
    ? resource.referenceId
    : typeof resource?.order?.referenceId === "string"
      ? resource.order.referenceId
      : null;
  const squareOrderId = typeof resource?.orderId === "string"
    ? resource.orderId
    : typeof resource?.id === "string" && String(payload.data?.type || "").toLowerCase() === "order"
      ? resource.id
      : null;
  const squarePaymentId = typeof resource?.id === "string" && String(payload.data?.type || "").toLowerCase() === "payment"
    ? resource.id
    : typeof resource?.paymentId === "string"
      ? resource.paymentId
      : null;

  let session = await loadCheckoutSessionForWebhookLookup({
    checkoutSessionId,
    squareOrderId,
    squarePaymentId,
    providerReferenceId,
  });

  if (!session && squarePaymentId) {
    try {
      const squareClient = getSquareClient();
      const paymentResponse = await squareClient.payments.get({ paymentId: squarePaymentId });
      const payment = paymentResponse?.payment ?? null;
      session = await loadCheckoutSessionForWebhookLookup({
        checkoutSessionId,
        squareOrderId: payment?.orderId ?? squareOrderId,
        squarePaymentId,
        providerReferenceId,
      });
    } catch (error) {
      console.warn("[drinks/collections] Failed webhook payment lookup", {
        eventId: payload.event_id,
        squarePaymentId,
        error,
      });
    }
  }

  return {
    session,
    resource,
    checkoutSessionId,
    providerReferenceId,
    squareOrderId,
    squarePaymentId,
  };
}

function doesWebhookMatchSession(
  session: DrinkCollectionCheckoutSessionRecord,
  input: {
    resource: Record<string, any> | null;
    checkoutSessionId?: string | null;
    providerReferenceId?: string | null;
    squareOrderId?: string | null;
    squarePaymentId?: string | null;
  },
) {
  const metadata = input.resource?.metadata ?? null;
  if (input.checkoutSessionId && input.checkoutSessionId !== session.id) return false;
  if (input.providerReferenceId && input.providerReferenceId !== session.providerReferenceId) return false;
  if (input.squareOrderId && session.squareOrderId && input.squareOrderId !== session.squareOrderId) return false;
  if (input.squarePaymentId && session.squarePaymentId && input.squarePaymentId !== session.squarePaymentId) return false;
  if (metadata?.collectionId && metadata.collectionId !== session.collectionId) return false;
  if (metadata?.userId && metadata.userId !== session.userId) return false;
  return true;
}

function getPaymentAmountDetails(resource: Record<string, any> | null) {
  const amountMoney = resource?.amountMoney ?? resource?.totalMoney ?? resource?.approvedMoney ?? null;
  return {
    amountCents: bigintAmountToNumber(amountMoney?.amount),
    currencyCode: normalizeSquareCurrencyCode(amountMoney?.currency),
  };
}

function mapSquareRefundState(refundStatus: string): CollectionAccessStatusInput | null {
  const normalized = refundStatus.trim().toUpperCase();
  if (!normalized) return null;

  if (normalized === "COMPLETED") {
    return {
      purchaseStatus: "refunded",
      checkoutStatus: "refunded",
      ledgerStatus: "refunded",
      reason: "Square reported that this premium collection payment was refunded.",
      refundedAt: new Date(),
    };
  }

  if (normalized === "PENDING") {
    return {
      purchaseStatus: "refunded_pending",
      checkoutStatus: "refunded_pending",
      ledgerStatus: "refunded_pending",
      reason: "Square reported that a refund is pending for this premium collection payment.",
      refundedAt: new Date(),
    };
  }

  return null;
}

async function recordSquareWebhookEvent(input: {
  eventId: string;
  eventType: string;
  objectType?: string | null;
  objectId?: string | null;
  checkoutSessionId?: string | null;
  createdAt?: string | null;
  status?: string;
}) {
  if (!db) throw new Error("Database unavailable");

  const insertResult = await db
    .insert(drinkCollectionSquareWebhookEvents)
    .values({
      eventId: input.eventId,
      eventType: input.eventType,
      objectType: input.objectType ?? null,
      objectId: input.objectId ?? null,
      checkoutSessionId: input.checkoutSessionId ?? null,
      status: input.status ?? "processed",
      createdAt: input.createdAt ? new Date(input.createdAt) : null,
    })
    .onConflictDoNothing({ target: drinkCollectionSquareWebhookEvents.eventId })
    .returning({ id: drinkCollectionSquareWebhookEvents.id });

  return insertResult.length > 0;
}

async function reconcileSquareWebhookEvent(payload: SquareWebhookEventBody) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const eventId = String(payload.event_id || "").trim();
  const eventType = String(payload.type || "").trim().toLowerCase();
  const { objectType, resource } = extractSquareWebhookObject(payload);
  const objectId = typeof payload.data?.id === "string" ? payload.data.id : typeof resource?.id === "string" ? resource.id : null;

  if (!eventId || !eventType) {
    return { ok: false, ignored: true, reason: "invalid_event" } as const;
  }

  const inserted = await recordSquareWebhookEvent({
    eventId,
    eventType,
    objectType,
    objectId,
    createdAt: payload.created_at ?? null,
    status: "received",
  });

  if (!inserted) {
    return { ok: true, duplicate: true, ignored: true, eventId, eventType } as const;
  }

  const lookup = await resolveWebhookSessionFromPayload(payload);
  if (!lookup.session || !doesWebhookMatchSession(lookup.session, lookup)) {
    await db
      .update(drinkCollectionSquareWebhookEvents)
      .set({
        checkoutSessionId: lookup.session?.id ?? null,
        status: "ignored",
      })
      .where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));

    return { ok: true, ignored: true, eventId, eventType, reason: "session_not_found" } as const;
  }

  const session = lookup.session;
  await db
    .update(drinkCollectionSquareWebhookEvents)
    .set({
      checkoutSessionId: session.id,
      status: "processing",
    })
    .where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));

  const metadata = resource?.metadata ?? null;
  if (metadata?.collectionId && metadata.collectionId !== session.collectionId) {
    await updateCollectionAccessState(session, {
      purchaseStatus: "revoked",
      checkoutStatus: "revoked",
      ledgerStatus: "revoked",
      squareOrderId: lookup.squareOrderId,
      squarePaymentId: lookup.squarePaymentId,
      reason: "Square webhook metadata did not match the expected collection.",
    });
    await db.update(drinkCollectionSquareWebhookEvents).set({ status: "rejected" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
    return { ok: true, ignored: true, eventId, eventType, reason: "collection_mismatch" } as const;
  }

  if (metadata?.userId && metadata.userId !== session.userId) {
    await updateCollectionAccessState(session, {
      purchaseStatus: "revoked",
      checkoutStatus: "revoked",
      ledgerStatus: "revoked",
      squareOrderId: lookup.squareOrderId,
      squarePaymentId: lookup.squarePaymentId,
      reason: "Square webhook metadata did not match the expected purchaser.",
    });
    await db.update(drinkCollectionSquareWebhookEvents).set({ status: "rejected" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
    return { ok: true, ignored: true, eventId, eventType, reason: "user_mismatch" } as const;
  }

  const paymentDetails = getPaymentAmountDetails(resource);
  const shouldValidateAmount = eventType.startsWith("payment.") || eventType.startsWith("order.");
  const amountMismatch = shouldValidateAmount && paymentDetails.amountCents > 0 && paymentDetails.amountCents < session.amountCents;
  const currencyMismatch = shouldValidateAmount && paymentDetails.amountCents > 0 && paymentDetails.currencyCode !== normalizeSquareCurrencyCode(session.currencyCode);

  if (amountMismatch || currencyMismatch) {
    await updateCollectionAccessState(session, {
      purchaseStatus: "revoked",
      checkoutStatus: "revoked",
      ledgerStatus: "revoked",
      squareOrderId: lookup.squareOrderId,
      squarePaymentId: lookup.squarePaymentId,
      reason: amountMismatch
        ? `Square reported ${paymentDetails.amountCents} cents, which is less than the expected ${session.amountCents} cents.`
        : `Square reported ${paymentDetails.currencyCode}, which did not match ${normalizeSquareCurrencyCode(session.currencyCode)}.`,
    });
    await db.update(drinkCollectionSquareWebhookEvents).set({ status: "rejected" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
    return { ok: true, ignored: true, eventId, eventType, reason: amountMismatch ? "amount_mismatch" : "currency_mismatch" } as const;
  }

  if (eventType.startsWith("payment.")) {
    const paymentStatus = String(resource?.status || "").toUpperCase();
    if (paymentStatus === "COMPLETED") {
      await grantCollectionPurchase(session, {
        squareOrderId: lookup.squareOrderId ?? resource?.orderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.id ?? session.squarePaymentId,
      });
      await db.update(drinkCollectionSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
      return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: "completed" } as const;
    }

    if (paymentStatus === "FAILED") {
      await updateCollectionAccessState(session, {
        purchaseStatus: "revoked",
        checkoutStatus: "failed",
        ledgerStatus: "revoked",
        squareOrderId: lookup.squareOrderId ?? resource?.orderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.id ?? session.squarePaymentId,
        reason: resource?.delayAction ?? resource?.sourceType
          ? `Square reported the payment as failed (${paymentStatus}).`
          : "Square reported the payment as failed.",
      });
      await db.update(drinkCollectionSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
      return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: "failed" } as const;
    }

    if (paymentStatus === "CANCELED") {
      await updateCollectionAccessState(session, {
        purchaseStatus: "revoked",
        checkoutStatus: "canceled",
        ledgerStatus: "revoked",
        squareOrderId: lookup.squareOrderId ?? resource?.orderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.id ?? session.squarePaymentId,
        reason: "Square checkout was canceled before payment completed.",
      });
      await db.update(drinkCollectionSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
      return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: "canceled" } as const;
    }
  }

  if (eventType.startsWith("order.")) {
    const parsed = parseSquareOrderState(resource, null, session.amountCents);
    if (parsed.status === "completed") {
      await grantCollectionPurchase(session, {
        squareOrderId: parsed.squareOrderId ?? lookup.squareOrderId ?? session.squareOrderId,
        squarePaymentId: parsed.squarePaymentId ?? lookup.squarePaymentId ?? session.squarePaymentId,
      });
    } else if (parsed.status === "failed" || parsed.status === "canceled") {
      await updateCollectionAccessState(session, {
        purchaseStatus: "revoked",
        checkoutStatus: parsed.status,
        ledgerStatus: "revoked",
        squareOrderId: parsed.squareOrderId ?? lookup.squareOrderId ?? session.squareOrderId,
        squarePaymentId: parsed.squarePaymentId ?? lookup.squarePaymentId ?? session.squarePaymentId,
        reason: parsed.failureReason ?? "Square updated the order to a non-completed state.",
      });
    } else {
      await db
        .update(drinkCollectionCheckoutSessions)
        .set({
          squareOrderId: parsed.squareOrderId ?? lookup.squareOrderId ?? session.squareOrderId,
          squarePaymentId: parsed.squarePaymentId ?? lookup.squarePaymentId ?? session.squarePaymentId,
          lastVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(drinkCollectionCheckoutSessions.id, session.id));
    }

    await db.update(drinkCollectionSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
    return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: getCollectionCheckoutPollStatus(session) } as const;
  }

  if (eventType.startsWith("refund.")) {
    const refundStatus = String(resource?.status || "").toUpperCase();
    const refundState = mapSquareRefundState(refundStatus);
    if (refundState) {
      await updateCollectionAccessState(session, {
        ...refundState,
        squarePaymentId: lookup.squarePaymentId ?? resource?.paymentId ?? session.squarePaymentId,
        squareOrderId: lookup.squareOrderId ?? session.squareOrderId,
      });
    } else if ((refundStatus === "FAILED" || refundStatus === "REJECTED" || refundStatus === "CANCELED")
      && session.status === "refunded_pending") {
      await grantCollectionPurchase(session, {
        squareOrderId: lookup.squareOrderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.paymentId ?? session.squarePaymentId,
      });
    }
    await db.update(drinkCollectionSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
    return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: refundStatus } as const;
  }

  await db.update(drinkCollectionSquareWebhookEvents).set({ status: "ignored" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
  return { ok: true, ignored: true, eventId, eventType, reason: "unsupported_event" } as const;
}

async function verifyCollectionCheckoutSession(session: DrinkCollectionCheckoutSessionRecord): Promise<SquareCheckoutVerificationResult> {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const ownedCollectionIds = await loadOwnedCollectionIdsForUser(session.userId);
  if (ownedCollectionIds.has(session.collectionId)) {
    await db
      .update(drinkCollectionCheckoutSessions)
      .set({
        status: "completed",
        verifiedAt: session.verifiedAt ?? new Date(),
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(drinkCollectionCheckoutSessions.id, session.id));

    return {
      status: "completed",
      owned: true,
      collectionId: session.collectionId,
      checkoutSessionId: session.id,
      squareOrderId: session.squareOrderId,
      squarePaymentId: session.squarePaymentId,
      failureReason: null,
    };
  }

  if (getCollectionCheckoutPollStatus(session) !== "pending") {
    return {
      status: getCollectionCheckoutPollStatus(session),
      owned: false,
      collectionId: session.collectionId,
      checkoutSessionId: session.id,
      squareOrderId: session.squareOrderId,
      squarePaymentId: session.squarePaymentId,
      failureReason: session.failureReason,
    };
  }

  const verification = await fetchSquareOrderVerification(session);
  if (!verification) {
    await db
      .update(drinkCollectionCheckoutSessions)
      .set({
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(drinkCollectionCheckoutSessions.id, session.id));

    return {
      status: "pending",
      owned: false,
      collectionId: session.collectionId,
      checkoutSessionId: session.id,
      squareOrderId: session.squareOrderId,
      squarePaymentId: session.squarePaymentId,
      failureReason: null,
    };
  }

  const parsed = parseSquareOrderState(verification.order, verification.payment, session.amountCents);

  if (parsed.status === "completed") {
    await grantCollectionPurchase(session, {
      squareOrderId: parsed.squareOrderId,
      squarePaymentId: parsed.squarePaymentId,
    });
    return {
      status: "completed",
      owned: true,
      collectionId: session.collectionId,
      checkoutSessionId: session.id,
      squareOrderId: parsed.squareOrderId,
      squarePaymentId: parsed.squarePaymentId,
      failureReason: null,
    };
  }

  await db
    .update(drinkCollectionCheckoutSessions)
    .set({
      status: parsed.status === "pending" ? session.status : parsed.status,
      squareOrderId: parsed.squareOrderId ?? session.squareOrderId,
      squarePaymentId: parsed.squarePaymentId ?? session.squarePaymentId,
      failureReason: parsed.failureReason ?? null,
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(drinkCollectionCheckoutSessions.id, session.id));

  return {
    status: parsed.status,
    owned: false,
    collectionId: session.collectionId,
    checkoutSessionId: session.id,
    squareOrderId: parsed.squareOrderId ?? session.squareOrderId,
    squarePaymentId: parsed.squarePaymentId ?? session.squarePaymentId,
    failureReason: parsed.failureReason ?? null,
  };
}

async function loadOwnedCollectionIdsForUser(userId?: string | null): Promise<Set<string>> {
  if (!db || !userId) return new Set();

  const rows = await db
    .select({ collectionId: drinkCollectionPurchases.collectionId })
    .from(drinkCollectionPurchases)
    .where(
      and(
        eq(drinkCollectionPurchases.userId, userId),
        eq(drinkCollectionPurchases.status, "completed"),
      ),
    );

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

async function loadCollectionCreatorsMap(userIds: string[]) {
  if (!db || userIds.length === 0) return new Map<string, { username: string | null; avatar: string | null }>();

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      avatar: users.avatar,
    })
    .from(users)
    .where(inArray(users.id, [...new Set(userIds)]));

  return new Map(rows.map((row) => [row.id, { username: row.username ?? null, avatar: row.avatar ?? null }]));
}

async function loadCollectionCoverImagesMap(collectionIds: string[]) {
  if (!db || collectionIds.length === 0) return new Map<string, string | null>();

  const rows = await db
    .select({
      collectionId: drinkCollectionItems.collectionId,
      drinkSlug: drinkCollectionItems.drinkSlug,
      addedAt: drinkCollectionItems.addedAt,
    })
    .from(drinkCollectionItems)
    .where(inArray(drinkCollectionItems.collectionId, [...new Set(collectionIds)]))
    .orderBy(asc(drinkCollectionItems.collectionId), asc(drinkCollectionItems.addedAt));

  const firstDrinkByCollectionId = new Map<string, string>();
  for (const row of rows) {
    if (!firstDrinkByCollectionId.has(row.collectionId)) {
      firstDrinkByCollectionId.set(row.collectionId, row.drinkSlug);
    }
  }

  const detailsBySlug = await resolveDrinkDetailsMapBySlugs([...firstDrinkByCollectionId.values()]);
  const coverImages = new Map<string, string | null>();

  for (const [collectionId, drinkSlug] of firstDrinkByCollectionId.entries()) {
    coverImages.set(collectionId, detailsBySlug.get(drinkSlug)?.image ?? null);
  }

  return coverImages;
}

async function loadPurchasedCollectionsForUser(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const rows = await db
    .select({
      purchaseId: drinkCollectionPurchases.id,
      collectionId: drinkCollectionPurchases.collectionId,
      purchaseStatus: drinkCollectionPurchases.status,
      purchaseStatusReason: drinkCollectionPurchases.statusReason,
      accessRevokedAt: drinkCollectionPurchases.accessRevokedAt,
      purchasedAt: drinkCollectionPurchases.createdAt,
      collectionName: drinkCollections.name,
      collectionDescription: drinkCollections.description,
      collectionIsPublic: drinkCollections.isPublic,
      collectionIsPremium: drinkCollections.isPremium,
      collectionPriceCents: drinkCollections.priceCents,
      collectionUpdatedAt: drinkCollections.updatedAt,
      collectionUserId: drinkCollections.userId,
    })
    .from(drinkCollectionPurchases)
    .innerJoin(drinkCollections, eq(drinkCollectionPurchases.collectionId, drinkCollections.id))
    .where(eq(drinkCollectionPurchases.userId, userId))
    .orderBy(desc(drinkCollectionPurchases.createdAt));

  const creatorMap = await loadCollectionCreatorsMap(rows.map((row) => row.collectionUserId));
  const coverImagesMap = await loadCollectionCoverImagesMap(rows.map((row) => row.collectionId));

  return rows.map((row) => {
    const creator = creatorMap.get(row.collectionUserId);
    return {
      purchaseId: row.purchaseId,
      collectionId: row.collectionId,
      status: row.purchaseStatus,
      statusReason: row.purchaseStatusReason,
      accessRevokedAt: row.accessRevokedAt,
      name: row.collectionName,
      description: row.collectionDescription,
      isPublic: row.collectionIsPublic,
      isPremium: row.collectionIsPremium,
      priceCents: row.collectionPriceCents,
      purchasedAt: row.purchasedAt,
      updatedAt: row.collectionUpdatedAt,
      userId: row.collectionUserId,
      creatorUsername: creator?.username ?? null,
      creatorAvatar: creator?.avatar ?? null,
      coverImage: coverImagesMap.get(row.collectionId) ?? null,
      route: `/drinks/collections/${row.collectionId}`,
    };
  });
}

async function loadBuyerCollectionOrders(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const purchaseRows = await db
    .select({
      purchaseId: drinkCollectionPurchases.id,
      collectionId: drinkCollectionPurchases.collectionId,
      purchaseStatus: drinkCollectionPurchases.status,
      purchaseStatusReason: drinkCollectionPurchases.statusReason,
      accessRevokedAt: drinkCollectionPurchases.accessRevokedAt,
      purchasedAt: drinkCollectionPurchases.createdAt,
      updatedAt: drinkCollectionPurchases.updatedAt,
      collectionName: drinkCollections.name,
      collectionUserId: drinkCollections.userId,
      ledgerId: drinkCollectionSalesLedger.id,
      grossAmountCents: drinkCollectionSalesLedger.grossAmountCents,
      currencyCode: drinkCollectionSalesLedger.currencyCode,
      refundedAt: drinkCollectionSalesLedger.refundedAt,
    })
    .from(drinkCollectionPurchases)
    .innerJoin(drinkCollections, eq(drinkCollectionPurchases.collectionId, drinkCollections.id))
    .leftJoin(drinkCollectionSalesLedger, eq(drinkCollectionSalesLedger.purchaseId, drinkCollectionPurchases.id))
    .where(eq(drinkCollectionPurchases.userId, userId))
    .orderBy(desc(drinkCollectionPurchases.createdAt));

  const activeOwnedCollectionIds = new Set(
    purchaseRows
      .filter((row) => row.purchaseStatus === "completed")
      .map((row) => row.collectionId),
  );
  const creatorMap = await loadCollectionCreatorsMap(purchaseRows.map((row) => row.collectionUserId));

  const pendingCheckoutRows = await db
    .select({
      checkoutSessionId: drinkCollectionCheckoutSessions.id,
      collectionId: drinkCollectionCheckoutSessions.collectionId,
      status: drinkCollectionCheckoutSessions.status,
      statusReason: drinkCollectionCheckoutSessions.failureReason,
      amountCents: drinkCollectionCheckoutSessions.amountCents,
      currencyCode: drinkCollectionCheckoutSessions.currencyCode,
      purchasedAt: drinkCollectionCheckoutSessions.verifiedAt,
      createdAt: drinkCollectionCheckoutSessions.createdAt,
      refundedAt: drinkCollectionCheckoutSessions.refundedAt,
      accessRevokedAt: drinkCollectionCheckoutSessions.accessRevokedAt,
      squareOrderId: drinkCollectionCheckoutSessions.squareOrderId,
      collectionName: drinkCollections.name,
      collectionUserId: drinkCollections.userId,
    })
    .from(drinkCollectionCheckoutSessions)
    .innerJoin(drinkCollections, eq(drinkCollectionCheckoutSessions.collectionId, drinkCollections.id))
    .where(
      and(
        eq(drinkCollectionCheckoutSessions.userId, userId),
        eq(drinkCollectionCheckoutSessions.status, "pending"),
      ),
    )
    .orderBy(desc(drinkCollectionCheckoutSessions.createdAt));

  const pendingCreators = await loadCollectionCreatorsMap(
    pendingCheckoutRows
      .map((row) => row.collectionUserId)
      .filter((creatorUserId) => !creatorMap.has(creatorUserId)),
  );

  const orders = [
    ...purchaseRows.map((row) => {
      const creator = creatorMap.get(row.collectionUserId);
      const refundedAt = row.refundedAt ?? row.accessRevokedAt ?? null;
      return {
        orderId: row.ledgerId ?? row.purchaseId,
        purchaseId: row.purchaseId,
        collectionId: row.collectionId,
        collectionName: row.collectionName,
        collectionRoute: `/drinks/collections/${row.collectionId}`,
        creatorUserId: row.collectionUserId,
        creatorUsername: creator?.username ?? null,
        grossAmountCents: Number(row.grossAmountCents ?? 0),
        currency: normalizeSquareCurrencyCode(row.currencyCode ?? squareConfig.currency ?? "USD"),
        status: row.purchaseStatus,
        statusReason: row.purchaseStatusReason,
        purchasedAt: (row.purchasedAt ?? row.updatedAt).toISOString(),
        refundedAt: refundedAt ? refundedAt.toISOString() : null,
        owned: row.purchaseStatus === "completed",
      };
    }),
    ...pendingCheckoutRows
      .filter((row) => !activeOwnedCollectionIds.has(row.collectionId))
      .map((row) => {
        const creator = creatorMap.get(row.collectionUserId) ?? pendingCreators.get(row.collectionUserId);
        const purchasedAt = row.purchasedAt ?? row.createdAt;
        const refundedAt = row.refundedAt ?? row.accessRevokedAt ?? null;
        return {
          orderId: row.squareOrderId ?? row.checkoutSessionId,
          purchaseId: null,
          collectionId: row.collectionId,
          collectionName: row.collectionName,
          collectionRoute: `/drinks/collections/${row.collectionId}`,
          creatorUserId: row.collectionUserId,
          creatorUsername: creator?.username ?? null,
          grossAmountCents: Number(row.amountCents ?? 0),
          currency: normalizeSquareCurrencyCode(row.currencyCode ?? squareConfig.currency ?? "USD"),
          status: row.status === "pending" ? "pending" : row.status,
          statusReason: row.statusReason,
          purchasedAt: purchasedAt.toISOString(),
          refundedAt: refundedAt ? refundedAt.toISOString() : null,
          owned: false,
        };
      }),
  ];

  return orders.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
}

async function loadCreatorCollectionOrders(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const collectionRows = await db
    .select({
      id: drinkCollections.id,
      name: drinkCollections.name,
      userId: drinkCollections.userId,
    })
    .from(drinkCollections)
    .where(and(eq(drinkCollections.userId, userId), eq(drinkCollections.isPremium, true)));

  if (collectionRows.length === 0) {
    return [];
  }

  const collectionIds = collectionRows.map((row) => row.id);
  const collectionNameMap = new Map(collectionRows.map((row) => [row.id, row.name]));

  const ledgerRows = await db
    .select({
      ledgerId: drinkCollectionSalesLedger.id,
      purchaseId: drinkCollectionSalesLedger.purchaseId,
      checkoutSessionId: drinkCollectionSalesLedger.checkoutSessionId,
      collectionId: drinkCollectionSalesLedger.collectionId,
      grossAmountCents: drinkCollectionSalesLedger.grossAmountCents,
      currencyCode: drinkCollectionSalesLedger.currencyCode,
      status: drinkCollectionSalesLedger.status,
      statusReason: drinkCollectionSalesLedger.statusReason,
      refundedAt: drinkCollectionSalesLedger.refundedAt,
      purchasedAt: drinkCollectionSalesLedger.createdAt,
    })
    .from(drinkCollectionSalesLedger)
    .where(inArray(drinkCollectionSalesLedger.collectionId, collectionIds))
    .orderBy(desc(drinkCollectionSalesLedger.createdAt));

  return ledgerRows.map((row, index) => ({
    orderId: row.ledgerId,
    purchaseId: row.purchaseId,
    checkoutSessionId: row.checkoutSessionId,
    collectionId: row.collectionId,
    collectionName: collectionNameMap.get(row.collectionId) ?? "Premium collection",
    collectionRoute: `/drinks/collections/${row.collectionId}`,
    grossAmountCents: Number(row.grossAmountCents ?? 0),
    currency: normalizeSquareCurrencyCode(row.currencyCode ?? squareConfig.currency ?? "USD"),
    status: row.status,
    statusReason: row.statusReason,
    purchasedAt: row.purchasedAt.toISOString(),
    refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
    buyerLabel: `Private buyer ${index + 1}`,
    buyerVisibility: "private" as const,
  }));
}

async function loadCreatorCollectionSalesSummary(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const premiumCollections = await db
    .select({
      id: drinkCollections.id,
      name: drinkCollections.name,
      description: drinkCollections.description,
      priceCents: drinkCollections.priceCents,
      updatedAt: drinkCollections.updatedAt,
      isPublic: drinkCollections.isPublic,
      createdAt: drinkCollections.createdAt,
    })
    .from(drinkCollections)
    .where(and(eq(drinkCollections.userId, userId), eq(drinkCollections.isPremium, true)))
    .orderBy(desc(drinkCollections.updatedAt));

  if (premiumCollections.length === 0) {
    return {
      totals: {
        premiumCollections: 0,
        purchases: 0,
        grossRevenueCents: 0,
        refundedSalesCount: 0,
        refundedRevenueCents: 0,
      },
      collections: [] as Array<{
        id: string;
        name: string;
        description: string | null;
        isPublic: boolean;
        priceCents: number;
        purchases: number;
        grossRevenueCents: number;
        refundedSalesCount: number;
        refundedRevenueCents: number;
        lastPurchasedAt: string | null;
        updatedAt: string;
        route: string;
        coverImage: string | null;
      }>,
    };
  }

  const collectionIds = premiumCollections.map((collection) => collection.id);
  const coverImagesMap = await loadCollectionCoverImagesMap(collectionIds);
  const ledgerRows = await db
    .select({
      id: drinkCollectionSalesLedger.id,
      collectionId: drinkCollectionSalesLedger.collectionId,
      grossAmountCents: drinkCollectionSalesLedger.grossAmountCents,
      status: drinkCollectionSalesLedger.status,
      createdAt: drinkCollectionSalesLedger.createdAt,
    })
    .from(drinkCollectionSalesLedger)
    .where(
      inArray(drinkCollectionSalesLedger.collectionId, collectionIds),
    )
    .orderBy(desc(drinkCollectionSalesLedger.createdAt));

  const salesByCollectionId = new Map<string, {
    purchases: number;
    grossRevenueCents: number;
    refundedSalesCount: number;
    refundedRevenueCents: number;
    lastPurchasedAt: Date | null;
  }>();
  for (const entry of ledgerRows) {
    const existing = salesByCollectionId.get(entry.collectionId) ?? {
      purchases: 0,
      grossRevenueCents: 0,
      refundedSalesCount: 0,
      refundedRevenueCents: 0,
      lastPurchasedAt: null,
    };

    if (entry.status === "completed") {
      existing.purchases += 1;
      existing.grossRevenueCents += Number(entry.grossAmountCents ?? 0);
      if (!existing.lastPurchasedAt || entry.createdAt > existing.lastPurchasedAt) {
        existing.lastPurchasedAt = entry.createdAt;
      }
    } else if (entry.status === "refunded" || entry.status === "refunded_pending" || entry.status === "revoked") {
      existing.refundedSalesCount += 1;
      existing.refundedRevenueCents += Number(entry.grossAmountCents ?? 0);
    }

    salesByCollectionId.set(entry.collectionId, existing);
  }

  const collections = premiumCollections.map((collection) => {
    const stats = salesByCollectionId.get(collection.id) ?? {
      purchases: 0,
      grossRevenueCents: 0,
      refundedSalesCount: 0,
      refundedRevenueCents: 0,
      lastPurchasedAt: null as Date | null,
    };

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isPublic: collection.isPublic,
      priceCents: Number(collection.priceCents ?? 0),
      purchases: stats.purchases,
      grossRevenueCents: stats.grossRevenueCents,
      refundedSalesCount: stats.refundedSalesCount,
      refundedRevenueCents: stats.refundedRevenueCents,
      lastPurchasedAt: stats.lastPurchasedAt ? stats.lastPurchasedAt.toISOString() : null,
      updatedAt: collection.updatedAt.toISOString(),
      route: `/drinks/collections/${collection.id}`,
      coverImage: coverImagesMap.get(collection.id) ?? null,
    };
  });

  return {
    totals: {
      premiumCollections: premiumCollections.length,
      purchases: collections.reduce((sum, collection) => sum + collection.purchases, 0),
      grossRevenueCents: collections.reduce((sum, collection) => sum + collection.grossRevenueCents, 0),
      refundedSalesCount: collections.reduce((sum, collection) => sum + collection.refundedSalesCount, 0),
      refundedRevenueCents: collections.reduce((sum, collection) => sum + collection.refundedRevenueCents, 0),
    },
    collections,
  };
}

async function loadCreatorCollectionFinanceSummary(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const premiumCollections = await db
    .select({
      id: drinkCollections.id,
    })
    .from(drinkCollections)
    .where(and(eq(drinkCollections.userId, userId), eq(drinkCollections.isPremium, true)));

  const recentSales = await db
    .select({
      id: drinkCollectionSalesLedger.id,
      collectionId: drinkCollectionSalesLedger.collectionId,
      checkoutSessionId: drinkCollectionSalesLedger.checkoutSessionId,
      purchaseId: drinkCollectionSalesLedger.purchaseId,
      collectionName: drinkCollections.name,
      grossAmountCents: drinkCollectionSalesLedger.grossAmountCents,
      platformFeeCents: drinkCollectionSalesLedger.platformFeeCents,
      creatorShareCents: drinkCollectionSalesLedger.creatorShareCents,
      currencyCode: drinkCollectionSalesLedger.currencyCode,
      status: drinkCollectionSalesLedger.status,
      statusReason: drinkCollectionSalesLedger.statusReason,
      refundedAt: drinkCollectionSalesLedger.refundedAt,
      createdAt: drinkCollectionSalesLedger.createdAt,
    })
    .from(drinkCollectionSalesLedger)
    .innerJoin(drinkCollections, eq(drinkCollectionSalesLedger.collectionId, drinkCollections.id))
    .where(eq(drinkCollectionSalesLedger.userId, userId))
    .orderBy(desc(drinkCollectionSalesLedger.createdAt))
    .limit(10);

  const totals = recentSales.filter((sale) => sale.status === "completed").reduce((acc, sale) => {
    acc.grossSalesCents += Number(sale.grossAmountCents ?? 0);
    acc.platformFeesCents += Number(sale.platformFeeCents ?? 0);
    acc.estimatedCreatorShareCents += Number(sale.creatorShareCents ?? 0);
    return acc;
  }, {
    grossSalesCents: 0,
    platformFeesCents: 0,
    estimatedCreatorShareCents: 0,
  });

  const completedCountRows = await db
    .select({
      count: sql<number>`count(*)::int`,
      grossSalesCents: sql<number>`coalesce(sum(${drinkCollectionSalesLedger.grossAmountCents}), 0)::int`,
      platformFeesCents: sql<number>`coalesce(sum(${drinkCollectionSalesLedger.platformFeeCents}), 0)::int`,
      estimatedCreatorShareCents: sql<number>`coalesce(sum(${drinkCollectionSalesLedger.creatorShareCents}), 0)::int`,
    })
    .from(drinkCollectionSalesLedger)
    .where(
      and(
        eq(drinkCollectionSalesLedger.userId, userId),
        eq(drinkCollectionSalesLedger.status, "completed"),
      ),
    );

  const aggregate = completedCountRows[0] ?? {
    count: 0,
    grossSalesCents: totals.grossSalesCents,
    platformFeesCents: totals.platformFeesCents,
    estimatedCreatorShareCents: totals.estimatedCreatorShareCents,
  };

  const refundedCountRows = await db
    .select({
      count: sql<number>`count(*)::int`,
      refundedSalesCents: sql<number>`coalesce(sum(${drinkCollectionSalesLedger.grossAmountCents}), 0)::int`,
    })
    .from(drinkCollectionSalesLedger)
    .where(
      and(
        eq(drinkCollectionSalesLedger.userId, userId),
        inArray(drinkCollectionSalesLedger.status, ["refunded", "refunded_pending", "revoked"]),
      ),
    );

  const refundedAggregate = refundedCountRows[0] ?? {
    count: 0,
    refundedSalesCents: 0,
  };

  return {
    summary: {
      grossSalesCents: Number(aggregate.grossSalesCents ?? 0),
      platformFeesCents: Number(aggregate.platformFeesCents ?? 0),
      estimatedCreatorShareCents: Number(aggregate.estimatedCreatorShareCents ?? 0),
      totalPremiumSalesCount: Number(aggregate.count ?? 0),
      refundedSalesCount: Number(refundedAggregate.count ?? 0),
      refundedSalesCents: Number(refundedAggregate.refundedSalesCents ?? 0),
      premiumCollectionsCount: premiumCollections.length,
      estimates: {
        usesEstimatedShareFormula: true,
        platformFeeBps: PREMIUM_COLLECTION_PLATFORM_FEE_BPS,
        creatorShareBps: PREMIUM_COLLECTION_CREATOR_SHARE_BPS,
      },
    },
    recentSales: recentSales.map((sale) => ({
      id: sale.id,
      collectionId: sale.collectionId,
      collectionName: sale.collectionName,
      purchaseId: sale.purchaseId,
      checkoutSessionId: sale.checkoutSessionId,
      grossAmountCents: Number(sale.grossAmountCents ?? 0),
      platformFeeCents: Number(sale.platformFeeCents ?? 0),
      creatorShareCents: Number(sale.creatorShareCents ?? 0),
      currencyCode: normalizeSquareCurrencyCode(sale.currencyCode),
      status: sale.status,
      statusReason: sale.statusReason,
      refundedAt: sale.refundedAt ? sale.refundedAt.toISOString() : null,
      createdAt: sale.createdAt.toISOString(),
      route: `/drinks/collections/${sale.collectionId}`,
    })),
    reportingNotes: [
      "Finance totals only include ledger rows that are still in completed status.",
      "Refunded, refund-pending, and revoked premium collection sales are separated from completed revenue totals and do not keep access active.",
      `Estimated platform fees and creator share use an internal ${PREMIUM_COLLECTION_PLATFORM_FEE_BPS / 100}% / ${PREMIUM_COLLECTION_CREATOR_SHARE_BPS / 100}% split for reporting readiness only.`,
      "No payouts are sent automatically yet. Square checkout captures sales, but creator transfers are not implemented in this dashboard.",
    ],
  };
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

r.get("/collections/purchased", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/purchased", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const collections = await loadPurchasedCollectionsForUser(req.user!.id);
    return res.json({
      ok: true,
      collections,
      count: collections.length,
    });
  } catch (error) {
    logCollectionRouteError("/purchased", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load purchased collections");
    const status = classifyCollectionError(error, "Failed to load purchased collections").status;
    return res.status(status).json(payload);
  }
});

r.get("/orders", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/orders", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const orders = await loadBuyerCollectionOrders(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      orders,
      count: orders.length,
      reportingNotes: [
        "Completed orders keep premium collection ownership active.",
        "Refunded, refund-pending, and revoked orders do not keep ownership active.",
        "Pending orders represent Square checkout activity that has not been granted ownership yet.",
      ],
    });
  } catch (error) {
    logCollectionRouteError("/orders", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load premium collection orders");
    const status = classifyCollectionError(error, "Failed to load premium collection orders").status;
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

r.get("/creator-dashboard/sales", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/creator-dashboard/sales", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const sales = await loadCreatorCollectionSalesSummary(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      totals: sales.totals,
      collections: sales.collections,
      reportingNotes: [
        "Active purchases only count when the ownership record is still in completed status.",
        "Refunded, refund-pending, and revoked premium sales are tracked separately and excluded from completed sales totals.",
        "Gross sales are reporting only and do not imply payouts or net earnings.",
      ],
    });
  } catch (error) {
    logCollectionRouteError("/creator-dashboard/sales", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load creator sales");
    const status = classifyCollectionError(error, "Failed to load creator sales").status;
    return res.status(status).json(payload);
  }
});

r.get("/creator-dashboard/orders", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/creator-dashboard/orders", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const orders = await loadCreatorCollectionOrders(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      orders,
      count: orders.length,
      reportingNotes: [
        "Completed sale means the premium collection purchase is still counted in finance totals.",
        "Refunded sale, pending refund, and revoked access stay visible for audit history but do not imply payouts.",
        "Buyer details stay privacy-safe in this dashboard.",
      ],
    });
  } catch (error) {
    logCollectionRouteError("/creator-dashboard/orders", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load creator order history");
    const status = classifyCollectionError(error, "Failed to load creator order history").status;
    return res.status(status).json(payload);
  }
});

r.get("/creator-dashboard/finance", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/creator-dashboard/finance", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const finance = await loadCreatorCollectionFinanceSummary(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      summary: finance.summary,
      recentSales: finance.recentSales,
      reportingNotes: finance.reportingNotes,
    });
  } catch (error) {
    logCollectionRouteError("/creator-dashboard/finance", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load creator finance");
    const status = classifyCollectionError(error, "Failed to load creator finance").status;
    return res.status(status).json(payload);
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
    const latestCheckoutSession = isOwner ? null : await loadLatestCheckoutSessionForUserCollection(req.user.id, collection.id);

    return res.json({
      ok: true,
      collectionId: collection.id,
      owned,
      checkout: toCollectionCheckoutSnapshot(latestCheckoutSession),
    });
  } catch (error) {
    const message = logCollectionRouteError("/:id/ownership", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to resolve ownership"));
  }
});

r.post("/collections/payments/square/webhook", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const signatureHeader = String(req.get("x-square-hmacsha256-signature") || "").trim();
    const rawBody = typeof (req as Request & { rawBody?: string }).rawBody === "string"
      ? (req as Request & { rawBody?: string }).rawBody!
      : JSON.stringify(req.body ?? {});

    if (!signatureHeader) {
      return res.status(400).json({ ok: false, error: "Missing Square webhook signature" });
    }

    const signatureKey = requireWebhookKey();
    const isValidSignature = await WebhooksHelper.verifySignature({
      requestBody: rawBody,
      signatureHeader,
      signatureKey,
      notificationUrl: getSquareWebhookNotificationUrl(req),
    });

    if (!isValidSignature) {
      return res.status(401).json({ ok: false, error: "Invalid Square webhook signature" });
    }

    const payload = (req.body ?? {}) as SquareWebhookEventBody;
    const result = await reconcileSquareWebhookEvent(payload);
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    const message = logCollectionRouteError("/collections/payments/square/webhook", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to process Square webhook"));
  }
});

r.post("/collections/:id/create-checkout", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const configError = getSquareConfigError();
    if (configError) {
      return res.status(503).json({
        ok: false,
        error: `${configError} Set SQUARE_ENV, SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and APP_BASE_URL before enabling premium collection checkout.`,
        code: "SQUARE_NOT_CONFIGURED",
      });
    }

    const context = await resolveCollectionPurchaseContext(req.params.id, req.user!.id);
    if (context.alreadyOwned) {
      return res.json({
        ok: true,
        collectionId: context.collection.id,
        owned: true,
        alreadyOwned: true,
      });
    }

    const insertedSessions = await db
      .insert(drinkCollectionCheckoutSessions)
      .values({
        userId: req.user!.id,
        collectionId: context.collection.id,
        provider: "square",
        status: "pending",
        amountCents: context.collection.priceCents,
        currencyCode: normalizeSquareCurrencyCode(squareConfig.currency),
        providerReferenceId: formatCollectionCheckoutReferenceId(crypto.randomUUID()),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        updatedAt: new Date(),
      })
      .returning();

    const checkoutSession = insertedSessions[0];
    const squareClient = getSquareClient();
    const redirectUrl = buildCollectionCheckoutRedirectUrl(req, context.collection.id, checkoutSession.id);
    const squareResponse = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: checkoutSession.providerReferenceId,
      order: {
        locationId: squareConfig.locationId!,
        referenceId: checkoutSession.providerReferenceId,
        metadata: {
          checkoutSessionId: checkoutSession.id,
          collectionId: context.collection.id,
          userId: req.user!.id,
        },
        lineItems: [
          {
            name: context.collection.name,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(context.collection.priceCents),
              currency: normalizeSquareCurrencyCode(squareConfig.currency) as any,
            },
            note: `Premium drink collection unlock for ${context.collection.name}`,
          },
        ],
      },
      checkoutOptions: {
        redirectUrl,
        allowTipping: false,
        askForShippingAddress: false,
      },
      paymentNote: `Premium collection unlock: ${context.collection.id}`,
      description: `ChefSire premium drink collection: ${context.collection.name}`,
    });

    const paymentLink = squareResponse.paymentLink;
    const orderId = paymentLink?.orderId ?? squareResponse.relatedResources?.orders?.[0]?.id ?? null;

    if (!paymentLink?.id || !paymentLink.url || !orderId) {
      await db
        .update(drinkCollectionCheckoutSessions)
        .set({
          status: "failed",
          failureReason: "Square did not return a usable checkout link.",
          lastVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(drinkCollectionCheckoutSessions.id, checkoutSession.id));

      return res.status(502).json({ ok: false, error: "Failed to create Square checkout link" });
    }

    await db
      .update(drinkCollectionCheckoutSessions)
      .set({
        squarePaymentLinkId: paymentLink.id,
        squareOrderId: orderId,
        checkoutUrl: paymentLink.url,
        updatedAt: new Date(),
      })
      .where(eq(drinkCollectionCheckoutSessions.id, checkoutSession.id));

    return res.status(201).json({
      ok: true,
      collectionId: context.collection.id,
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: paymentLink.url,
      squarePaymentLinkId: paymentLink.id,
      squareOrderId: orderId,
      amountCents: context.collection.priceCents,
      currencyCode: normalizeSquareCurrencyCode(squareConfig.currency),
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status || 500)
      : 500;
    const message = logCollectionRouteError("/:id/create-checkout", req, error);
    if (status !== 500) {
      return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : message });
    }
    return res.status(500).json(collectionServerError(message, "Failed to start Square checkout"));
  }
});

r.get("/collections/checkout-sessions/:sessionId/status", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const checkoutSession = await loadCheckoutSessionForUser(req.params.sessionId, req.user!.id);
    if (!checkoutSession) {
      return res.status(404).json({ ok: false, error: "Checkout session not found" });
    }

    const verification = await verifyCollectionCheckoutSession(checkoutSession);
    return res.json({
      ok: true,
      ...verification,
    });
  } catch (error) {
    const message = logCollectionRouteError("/checkout-sessions/:sessionId/status", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to verify Square checkout"));
  }
});

r.post("/collections/:id/purchase", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const context = await resolveCollectionPurchaseContext(req.params.id, req.user!.id);
    if (context.alreadyOwned) {
      return res.status(200).json({
        ok: true,
        collectionId: context.collection.id,
        owned: true,
        alreadyOwned: true,
      });
    }

    return res.status(410).json({
      ok: false,
      error: "Direct premium unlock is disabled. Start Square checkout with POST /api/drinks/collections/:id/create-checkout instead.",
      code: "SQUARE_CHECKOUT_REQUIRED",
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status || 500)
      : 500;
    const message = logCollectionRouteError("/:id/purchase", req, error);
    if (status !== 500) {
      return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : message });
    }
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

    const latestCheckoutSession = req.user?.id && !isOwner
      ? await loadLatestCheckoutSessionForUserCollection(req.user.id, collection.id)
      : null;

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
          checkout: toCollectionCheckoutSnapshot(latestCheckoutSession),
        },
      });
    }

    return res.json({
      ok: true,
      collection: {
        ...hydrated,
        isLocked: false,
        requiresUnlock: false,
        checkout: toCollectionCheckoutSnapshot(latestCheckoutSession),
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
