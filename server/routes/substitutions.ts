// server/routes/substitutions.ts
import "dotenv/config";
import { Router, Request, Response } from "express";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { and, eq, sql } from "drizzle-orm";
import {
  substitutionIngredients,
  substitutions,
} from "../../shared/schema.js";
import {
  rankSubstitutions,
  tierSubstitutions,
} from "../lib/substitution-ranking.js";

const router = Router();
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_SCAN_LIMIT = 500;
const MIN_RANKING_WINDOW = 50;
const INGREDIENT_CACHE_TTL_MS = 60_000;
const INGREDIENT_CACHE_MAX_ENTRIES = 300;

const DATABASE_URL = process.env.DATABASE_URL ?? "";

// Initialize DB only if configured
let db: ReturnType<typeof drizzle> | null = null;
if (DATABASE_URL) {
  const pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzle(pool);
}

type IngredientLookupRow = {
  id: string;
  ingredient: string;
  aliases: string[];
};

const ingredientLookupCache = new Map<
  string,
  { expiresAt: number; value: IngredientLookupRow | null }
>();

function normalizeIngredientLookup(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function upsertIngredientCache(
  cacheKey: string,
  value: IngredientLookupRow | null
): IngredientLookupRow | null {
  if (ingredientLookupCache.size >= INGREDIENT_CACHE_MAX_ENTRIES) {
    const oldestKey = ingredientLookupCache.keys().next().value;
    if (oldestKey) ingredientLookupCache.delete(oldestKey);
  }
  ingredientLookupCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + INGREDIENT_CACHE_TTL_MS,
  });
  return value;
}

async function resolveIngredientLookup(
  dbClient: NonNullable<typeof db>,
  ingredientRaw: string | undefined
): Promise<IngredientLookupRow | null> {
  const cacheKey = normalizeIngredientLookup(ingredientRaw);
  if (!cacheKey) return null;

  const cached = ingredientLookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) ingredientLookupCache.delete(cacheKey);

  const rows = await dbClient
    .select({
      id: substitutionIngredients.id,
      ingredient: substitutionIngredients.ingredient,
      aliases: substitutionIngredients.aliases,
    })
    .from(substitutionIngredients)
    .where(sql`lower(${substitutionIngredients.ingredient}) = ${cacheKey}`)
    .limit(1);

  return upsertIngredientCache(cacheKey, rows[0] ?? null);
}

/**
 * GET /api/substitutions
 *
 * Query params:
 *  - q: free text search (ingredient name or substitution text)
 *  - ingredient: exact ingredient filter (e.g. "Buttermilk")
 *  - context: ranking context hint (e.g. "baking", "dairy", "seasoning", "general")
 *  - limit: number (default 10, max 100)
 *  - offset: number (default 0)
 */
router.get("/", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message:
        "Substitutions DB not configured. Set DATABASE_URL in server/.env or Plesk → Node.js → Environment Variables.",
    });
  }

  const startedAt = process.hrtime.bigint();
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const ingredientFilter = (req.query.ingredient as string | undefined)?.trim();
    const normalizedIngredientFilter = normalizeIngredientLookup(ingredientFilter);
    const context = (req.query.context as string | undefined)?.trim();
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
    const ingredientLookup = normalizedIngredientFilter
      ? await resolveIngredientLookup(db, ingredientFilter)
      : null;

    const where =
      ingredientLookup && q
        ? and(
            eq(substitutions.ingredientId, ingredientLookup.id),
            sql`${substitutionIngredients.ingredient} ILIKE ${"%" + q + "%"} OR ${substitutions.text} ILIKE ${"%" + q + "%"}`
          )
        : q
        ? sql`${substitutionIngredients.ingredient} ILIKE ${"%" + q + "%"} OR ${substitutions.text} ILIKE ${"%" + q + "%"}`
        : ingredientLookup
        ? eq(substitutions.ingredientId, ingredientLookup.id)
        : normalizedIngredientFilter
        ? sql`1 = 0`
        : undefined;

    const totalRows = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(substitutions)
      .innerJoin(
        substitutionIngredients,
        eq(substitutions.ingredientId, substitutionIngredients.id)
      )
      .where(where as any);

    const total = totalRows[0]?.count ?? 0;

    const rows = await db
      .select({
        id: substitutions.id,
        ingredientId: substitutions.ingredientId,
        ingredient: substitutionIngredients.ingredient,
        aliases: substitutionIngredients.aliases,
        text: substitutions.text,
        components: substitutions.components,
        method: substitutions.method,
        ratio: substitutions.ratio,
        context: substitutions.context,
        dietTags: substitutions.dietTags,
        allergenFlags: substitutions.allergenFlags,
        provenance: substitutions.provenance,
      })
      .from(substitutions)
      .innerJoin(
        substitutionIngredients,
        eq(substitutions.ingredientId, substitutionIngredients.id)
      )
      .where(where as any)
      .limit(Math.min(Math.max(offset + limit, MIN_RANKING_WINDOW), MAX_SCAN_LIMIT));

    const rankedRows = rankSubstitutions(rows, { requestedContext: context });
    const pagedItems = rankedRows.slice(offset, offset + limit);
    const tiers = tierSubstitutions(rankedRows);

    res.json({ items: pagedItems, total, limit, offset, tiers });
  } catch (err: any) {
    console.error("GET /api/substitutions error:", err);
    res.status(500).json({ error: "Failed to fetch substitutions" });
  } finally {
    if (process.env.NODE_ENV === "development") {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      console.info(`[subs] GET /api/substitutions completed in ${elapsedMs.toFixed(1)}ms`);
    }
  }
});

/**
 * GET /api/substitutions/:ingredient
 */
router.get("/:ingredient", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message:
        "Substitutions DB not configured. Set DATABASE_URL in server/.env or Plesk → Node.js → Environment Variables.",
    });
  }

  const startedAt = process.hrtime.bigint();
  try {
    const name = (req.params.ingredient || "").trim();
    if (!name)
      return res.status(400).json({ error: "ingredient path param is required" });

    const ingredientLookup = await resolveIngredientLookup(db, name);
    if (!ingredientLookup) {
      return res.json({
        items: [],
        total: 0,
        tiers: { best_match: [], good_fallback: [], last_resort: [] },
      });
    }

    const rows = await db
      .select({
        id: substitutions.id,
        ingredientId: substitutions.ingredientId,
        text: substitutions.text,
        components: substitutions.components,
        method: substitutions.method,
        ratio: substitutions.ratio,
        context: substitutions.context,
        dietTags: substitutions.dietTags,
        allergenFlags: substitutions.allergenFlags,
        provenance: substitutions.provenance,
      })
      .from(substitutions)
      .where(eq(substitutions.ingredientId, ingredientLookup.id));

    const rowsWithIngredient = rows.map((row) => ({
      ...row,
      ingredient: ingredientLookup.ingredient,
      aliases: ingredientLookup.aliases,
    }));

    const rankedRows = rankSubstitutions(rowsWithIngredient);
    const tiers = tierSubstitutions(rankedRows);

    res.json({ items: rankedRows, total: rankedRows.length, tiers });
  } catch (err: any) {
    console.error("GET /api/substitutions/:ingredient error:", err);
    res.status(500).json({ error: "Failed to fetch substitutions" });
  } finally {
    if (process.env.NODE_ENV === "development") {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      console.info(`[subs] GET /api/substitutions/:ingredient completed in ${elapsedMs.toFixed(1)}ms`);
    }
  }
});

export default router;
