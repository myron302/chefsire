import "dotenv/config";
import { Router, Request, Response } from "express";

// Always export ONE router
const router = Router();

const DATABASE_URL = process.env.DATABASE_URL ?? "";

/* ---------------------------------------------
   SAFE MODE: when DATABASE_URL is missing
---------------------------------------------- */
if (!DATABASE_URL) {
  router.get("/", (_req, res) => {
    res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message:
        "Substitutions database not configured (missing DATABASE_URL in server/.env or Plesk).",
    });
  });

  router.get("/:ingredient", (_req, res) => {
    res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message:
        "Substitutions database not configured (missing DATABASE_URL in server/.env or Plesk).",
    });
  });

  export default router;
}

/* ---------------------------------------------
   NORMAL MODE: when DATABASE_URL is available
---------------------------------------------- */
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { and, eq, sql } from "drizzle-orm";
import {
  substitutionIngredients,
  substitutions,
} from "../../shared/schema.js";

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

/**
 * GET /api/substitutions
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const ingredientFilter = (req.query.ingredient as string | undefined)?.trim();
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1),
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
      })
      .from(substitutions)
      .innerJoin(
        substitutionIngredients,
        eq(substitutions.ingredientId, substitutionIngredients.id)
      )
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
 */
router.get("/:ingredient", async (req: Request, res: Response) => {
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
