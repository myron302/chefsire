// server/routes/substitutions.ts
import "dotenv/config";
import { Router, Request, Response } from "express";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { and, eq, ilike, sql } from "drizzle-orm";
import {
  substitutionIngredients,
  substitutions,
} from "../../shared/schema.js";

// ---- DB (local, safe to reuse) ----
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Set it in server/.env");
}
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

// ---- Router ----
const router = Router();

/**
 * GET /api/substitutions
 *
 * Query params:
 *  - q: free text search (ingredient name or substitution text)
 *  - ingredient: exact ingredient filter (e.g. "Buttermilk")
 *  - limit: number (default 20, max 100)
 *  - offset: number (default 0)
 *
 * Returns:
 *  {
 *    items: [{
 *      id, ingredientId, ingredient, aliases, text, components, method, context, dietTags, allergenFlags
 *    }],
 *    total, limit, offset
 *  }
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const ingredientFilter = (req.query.ingredient as string | undefined)?.trim();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    // Build WHERE
    const whereParts = [];
    if (ingredientFilter) {
      whereParts.push(eq(substitutionIngredients.ingredient, ingredientFilter));
    }
    if (q) {
      // search in ingredient name OR substitution free text
      whereParts.push(
        ilike(substitutionIngredients.ingredient, `%${q}%`)
      );
      whereParts.push(
        ilike(substitutions.text, `%${q}%`)
      );
    }

    // If both ingredient and q are present, we want (ingredient = X) AND (ingredient ILIKE q OR text ILIKE q)
    // Build a single AND with combined OR for q if needed:
    const where =
      ingredientFilter && q
        ? and(
            eq(substitutionIngredients.ingredient, ingredientFilter),
            // OR over two conditions:
            sql`${substitutionIngredients.ingredient} ILIKE ${"%" + q + "%"} OR ${substitutions.text} ILIKE ${"%" + q + "%"}`
          )
        : q
        ? // Only q (OR between name/text)
          sql`${substitutionIngredients.ingredient} ILIKE ${"%" + q + "%"} OR ${substitutions.text} ILIKE ${"%" + q + "%"}`
        : ingredientFilter
        ? eq(substitutionIngredients.ingredient, ingredientFilter)
        : undefined;

    // Count total
    const totalRows = await db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(substitutions)
      .innerJoin(
        substitutionIngredients,
        eq(substitutions.ingredientId, substitutionIngredients.id)
      )
      .where(where as any);

    const total = totalRows[0]?.count ?? 0;

    // Page of results
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
      .innerJoin(
        substitutionIngredients,
        eq(substitutions.ingredientId, substitutionIngredients.id)
      )
      .where(where as any)
      .limit(limit)
      .offset(offset);

    res.json({
      items: rows,
      total,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("GET /api/substitutions error:", err);
    res.status(500).json({ error: "Failed to fetch substitutions" });
  }
});

/**
 * GET /api/substitutions/:ingredient
 * Quick convenience endpoint to fetch by exact ingredient name.
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
      .innerJoin(
        substitutionIngredients,
        eq(substitutions.ingredientId, substitutionIngredients.id)
      )
      .where(eq(substitutionIngredients.ingredient, name));

    res.json({ items: rows, total: rows.length });
  } catch (err: any) {
    console.error("GET /api/substitutions/:ingredient error:", err);
    res.status(500).json({ error: "Failed to fetch substitutions" });
  }
});

export default router;
