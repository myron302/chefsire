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

const DATABASE_URL = process.env.DATABASE_URL ?? "";

// Initialize DB only if configured
let db: ReturnType<typeof drizzle> | null = null;
if (DATABASE_URL) {
  const pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzle(pool);
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

  try {
    const q = (req.query.q as string | undefined)?.trim();
    const ingredientFilter = (req.query.ingredient as string | undefined)?.trim();
    const context = (req.query.context as string | undefined)?.trim();
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? "10"), 10) || 10, 1),
      100
    );
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const where =
      ingredientFilter && q
        ? and(
            eq(substitutionIngredients.ingredient, ingredientFilter),
            sql`${substitutionIngredients.ingredient} ILIKE ${"%" + q + "%"} OR ${substitutions.text} ILIKE ${"%" + q + "%"}`
          )
        : q
        ? sql`${substitutionIngredients.ingredient} ILIKE ${"%" + q + "%"} OR ${substitutions.text} ILIKE ${"%" + q + "%"}`
        : ingredientFilter
        ? eq(substitutionIngredients.ingredient, ingredientFilter)
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
      .limit(Math.min(Math.max(offset + limit, 50), 500));

    const rankedRows = rankSubstitutions(rows, { requestedContext: context });
    const pagedItems = rankedRows.slice(offset, offset + limit);
    const tiers = tierSubstitutions(rankedRows);

    res.json({ items: pagedItems, total, limit, offset, tiers });
  } catch (err: any) {
    console.error("GET /api/substitutions error:", err);
    res.status(500).json({ error: "Failed to fetch substitutions" });
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

  try {
    const name = (req.params.ingredient || "").trim();
    if (!name)
      return res.status(400).json({ error: "ingredient path param is required" });

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
      .where(eq(substitutionIngredients.ingredient, name));

    const rankedRows = rankSubstitutions(rows);
    const tiers = tierSubstitutions(rankedRows);

    res.json({ items: rankedRows, total: rankedRows.length, tiers });
  } catch (err: any) {
    console.error("GET /api/substitutions/:ingredient error:", err);
    res.status(500).json({ error: "Failed to fetch substitutions" });
  }
});

export default router;
