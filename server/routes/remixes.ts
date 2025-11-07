// server/routes/remixes.ts
import { Router } from "express";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { recipeRemixes, recipes, users } from "../../shared/schema";

const router = Router();

// GET /api/remixes - Get all public remixes
router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const remixes = await db
      .select({
        remix: recipeRemixes,
        originalRecipe: recipes,
        user: users,
      })
      .from(recipeRemixes)
      .innerJoin(recipes, eq(recipeRemixes.originalRecipeId, recipes.id))
      .innerJoin(users, eq(recipeRemixes.userId, users.id))
      .where(eq(recipeRemixes.isPublic, true))
      .orderBy(desc(recipeRemixes.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({ remixes, count: remixes.length, limit, offset });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/remixes/recipe/:recipeId - Get all remixes of a specific recipe
router.get("/recipe/:recipeId", async (req, res) => {
  try {
    const { recipeId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const remixes = await db
      .select({
        remix: recipeRemixes,
        remixedRecipe: recipes,
        user: users,
      })
      .from(recipeRemixes)
      .innerJoin(recipes, eq(recipeRemixes.remixedRecipeId, recipes.id))
      .innerJoin(users, eq(recipeRemixes.userId, users.id))
      .where(
        and(
          eq(recipeRemixes.originalRecipeId, recipeId),
          eq(recipeRemixes.isPublic, true)
        )
      )
      .orderBy(desc(recipeRemixes.likesCount))
      .limit(limit);

    return res.json({ remixes, count: remixes.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/remixes/user/:userId - Get user's remixes
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const includePrivate = req.query.includePrivate === "true";

    let query = db
      .select({
        remix: recipeRemixes,
        originalRecipe: recipes,
      })
      .from(recipeRemixes)
      .innerJoin(recipes, eq(recipeRemixes.originalRecipeId, recipes.id))
      .where(eq(recipeRemixes.userId, userId))
      .orderBy(desc(recipeRemixes.createdAt));

    if (!includePrivate) {
      query = db
        .select({
          remix: recipeRemixes,
          originalRecipe: recipes,
        })
        .from(recipeRemixes)
        .innerJoin(recipes, eq(recipeRemixes.originalRecipeId, recipes.id))
        .where(
          and(
            eq(recipeRemixes.userId, userId),
            eq(recipeRemixes.isPublic, true)
          )
        )
        .orderBy(desc(recipeRemixes.createdAt)) as any;
    }

    const remixes = await query;

    return res.json({ remixes });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/remixes - Create a new remix
router.post("/", async (req, res) => {
  try {
    const {
      originalRecipeId,
      remixedRecipeId,
      userId,
      remixType,
      changes,
      isPublic = true,
    } = req.body;

    if (!originalRecipeId || !remixedRecipeId || !userId) {
      return res.status(400).json({
        error: "originalRecipeId, remixedRecipeId, and userId are required",
      });
    }

    // Verify recipes exist
    const [originalRecipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, originalRecipeId))
      .limit(1);

    const [remixedRecipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, remixedRecipeId))
      .limit(1);

    if (!originalRecipe || !remixedRecipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Create the remix
    const [remix] = await db
      .insert(recipeRemixes)
      .values({
        originalRecipeId,
        remixedRecipeId,
        userId,
        remixType: remixType || "variation",
        changes: changes || {},
        isPublic,
      })
      .returning();

    // Increment remix count on original
    await db.execute(sql`
      UPDATE recipe_remixes
      SET remix_count = remix_count + 1
      WHERE original_recipe_id = ${originalRecipeId}
    `);

    return res.json({ remix });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/remixes/:id - Update a remix
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, ...updates } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const [updated] = await db
      .update(recipeRemixes)
      .set(updates)
      .where(and(eq(recipeRemixes.id, id), eq(recipeRemixes.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Remix not found or not authorized" });
    }

    return res.json({ remix: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/remixes/:id - Delete a remix
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const [deleted] = await db
      .delete(recipeRemixes)
      .where(and(eq(recipeRemixes.id, id), eq(recipeRemixes.userId, userId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Remix not found or not authorized" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/remixes/:id/like - Like a remix
router.post("/:id/like", async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .update(recipeRemixes)
      .set({ likesCount: sql`${recipeRemixes.likesCount} + 1` })
      .where(eq(recipeRemixes.id, id));

    const [updated] = await db
      .select()
      .from(recipeRemixes)
      .where(eq(recipeRemixes.id, id))
      .limit(1);

    return res.json({ remix: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/remixes/:id/save - Save a remix
router.post("/:id/save", async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .update(recipeRemixes)
      .set({ savesCount: sql`${recipeRemixes.savesCount} + 1` })
      .where(eq(recipeRemixes.id, id));

    const [updated] = await db
      .select()
      .from(recipeRemixes)
      .where(eq(recipeRemixes.id, id))
      .limit(1);

    return res.json({ remix: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
