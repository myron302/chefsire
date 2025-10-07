// server/routes/substitutions.ts
import "dotenv/config";
import { Router, Request, Response } from "express";

import { and, eq, ilike, sql } from "drizzle-orm";

// Only import DB libs if we have a URL to avoid loading failures in some envs
const DATABASE_URL = process.env.DATABASE_URL || "";

// Always export a router; we’ll attach either live routes or 503 handlers.
const router = Router();

if (!DATABASE_URL) {
  // ────────────────────────────────────────────────────────────────────────────
  // NO DB MODE: expose the endpoints but respond with 503 (doesn't crash app)
  // ────────────────────────────────────────────────────────────────────────────
  router.get("/", (_req, res) => {
    res
      .status(503)
      .json({
        error: "substitutions_unavailable",
        message:
          "Substitutions API is disabled (no DATABASE_URL set). Add DATABASE_URL in server/.env or Plesk → Node.js → Environment Variables and restart.",
      });
  });

  router.get("/:ingredient", (_req, res) => {
    res
      .status(503)
      .json({
        error: "substitutions_unavailable",
        message:
          "Substitutions API is disabled (no DATABASE_URL set). Add DATABASE_URL and restart.",
      });
  });
} else {
  // ────────────────────────────────────────────────────────────────────────────
  // DB MODE: real implementation
  // ────────────────────────────────────────────────────────────────────────────
  // These imports can be deferred to DB mode to avoid bundling errors
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require("@neondatabase/serverless");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { drizzle } = require("drizzle-orm/neon-serverless");

  // Shared schema
  // NOTE: keep .js extension if your build emits .js
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { substitutionIngredients, substitutions } = require("../../shared/schema.js");

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  /**
   * GET /api/substitutions
   *
   * Query params:
   *  - q: free text search (ingredient name or substitution text)
   *  - ingredient: exact ingredient filter (e.g. "Buttermilk")
   *  - limit: number (default 20, max 100)
   *  - offset: number (default 0)
   */
  router.get("/", async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string | undefined)?.trim();
      const ingredientFilter = (req.query.ingredient as string | undefined)?.trim();
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
      const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

      // WHERE builder
      const where =
        ingredientFilter && q
          ? and(
              eq(substitutionIngredients.ingredient, ingredientFilter),
              // OR over name/text:
              sql`${substitutionIngredients.ingredient} ILIKE ${"%" + q + "%"} OR ${substitutions.text} ILIKE ${"%" + q + "%"}`
            )
          : q
          ? sql`${substitutionIngredients.ingredient} ILIKE ${"%" + q + "%"} OR ${substitutions.text} ILIKE ${"%" + q + "%"}`
          : ingredientFilter
          ? eq(substitutionIngredients.ingredient, ingredientFilter)
          : undefined;

      // Count
      const totalRows = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(substitutions)
        .innerJoin(substitutionIngredients, eq(substitutions.ingredientId, substitutionIngredients.id))
        .where(where as any);

      const total = totalRows[0]?.count ?? 0;

      // Page
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
        })
        .from(substitutions)
        .innerJoin(substitutionIngredients, eq(substitutions.ingredientId, substitutionIngredients.id))
        .where(where as any)
        .limit(limit)
        .offset(offset);

      res.json({ items: rows, total, limit, offset });
    } catch (err: any) {
      console.error("GET /api/substitutions error:", err);
      res.status(500).json({ error: "Failed to fetch substitutions" });
    }
  });

  /**
   * GET /api/substitutions/:ingredient
   * Quick fetch by exact ingredient name.
   */
  router.get("/:ingredient", async (req: Request, res: Response) => {
    try {
      const name = (req.params.ingredient || "").trim();
      if (!name) return res.status(400).json({ error: "ingredient path param is required" });

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
        })
        .from(substitutions)
        .innerJoin(substitutionIngredients, eq(substitutions.ingredientId, substitutionIngredients.id))
        .where(eq(substitutionIngredients.ingredient, name));

      res.json({ items: rows, total: rows.length });
    } catch (err: any) {
      console.error("GET /api/substitutions/:ingredient error:", err);
      res.status(500).json({ error: "Failed to fetch substitutions" });
    }
  });
}

export default router;
