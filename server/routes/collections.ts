// server/routes/collections.ts
import { Router, Request, Response } from "express";
import { storage } from "../storage";
import {
  recipeCollections,
  collectionRecipes,
  recipes,
  users,
  type InsertRecipeCollection,
  type InsertCollectionRecipe,
} from "../../shared/schema";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Get currently active featured/seasonal collections
router.get("/featured", async (req: Request, res: Response) => {
  try {
    const now = new Date();

    // Get collections that are:
    // 1. Public and featured
    // 2. Either have no date range, or are within their active date range
    const featuredCollections = await storage
      .select()
      .from(recipeCollections)
      .where(
        and(
          eq(recipeCollections.isPublic, true),
          eq(recipeCollections.isFeatured, true),
          // If activeFrom is set, check that we're past it
          sql`(${recipeCollections.activeFrom} IS NULL OR ${recipeCollections.activeFrom} <= ${now})`,
          // If activeTo is set, check that we haven't passed it
          sql`(${recipeCollections.activeTo} IS NULL OR ${recipeCollections.activeTo} >= ${now})`
        )
      )
      .orderBy(desc(recipeCollections.createdAt));

    res.json(featuredCollections);
  } catch (error: any) {
    console.error("Error fetching featured collections:", error);
    res.status(500).json({ error: "Failed to fetch featured collections" });
  }
});

// Get collections by seasonal tag (e.g., "winter", "summer", "holiday")
router.get("/seasonal/:tag", async (req: Request, res: Response) => {
  try {
    const { tag } = req.params;
    const now = new Date();

    const seasonalCollections = await storage
      .select()
      .from(recipeCollections)
      .where(
        and(
          eq(recipeCollections.isPublic, true),
          eq(recipeCollections.seasonalTag, tag),
          // Only show collections that are currently active
          sql`(${recipeCollections.activeFrom} IS NULL OR ${recipeCollections.activeFrom} <= ${now})`,
          sql`(${recipeCollections.activeTo} IS NULL OR ${recipeCollections.activeTo} >= ${now})`
        )
      )
      .orderBy(desc(recipeCollections.createdAt));

    res.json(seasonalCollections);
  } catch (error: any) {
    console.error("Error fetching seasonal collections:", error);
    res.status(500).json({ error: "Failed to fetch seasonal collections" });
  }
});

// Get all collections for a user
router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = (req as any).user?.id;

    // If viewing own collections, show all. Otherwise only public ones
    const collections = await storage
      .select()
      .from(recipeCollections)
      .where(
        and(
          eq(recipeCollections.userId, userId),
          userId === currentUserId ? undefined : eq(recipeCollections.isPublic, true)
        )
      )
      .orderBy(desc(recipeCollections.createdAt));

    res.json(collections);
  } catch (error: any) {
    console.error("Error fetching collections:", error);
    res.status(500).json({ error: "Failed to fetch collections" });
  }
});

// Get single collection with recipes
router.get("/:collectionId", async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params;
    const currentUserId = (req as any).user?.id;

    // Get collection
    const [collection] = await storage
      .select()
      .from(recipeCollections)
      .where(eq(recipeCollections.id, collectionId))
      .limit(1);

    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    // Check permissions
    if (!collection.isPublic && collection.userId !== currentUserId) {
      return res.status(403).json({ error: "This collection is private" });
    }

    // Get recipes in collection
    const collectionRecipesData = await storage
      .select({
        id: collectionRecipes.id,
        recipeId: collectionRecipes.recipeId,
        addedAt: collectionRecipes.addedAt,
        recipe: {
          id: recipes.id,
          title: recipes.title,
          imageUrl: recipes.imageUrl,
          cookTime: recipes.cookTime,
          servings: recipes.servings,
          difficulty: recipes.difficulty,
          averageRating: recipes.averageRating,
          reviewCount: recipes.reviewCount,
        },
      })
      .from(collectionRecipes)
      .leftJoin(recipes, eq(collectionRecipes.recipeId, recipes.id))
      .where(eq(collectionRecipes.collectionId, collectionId))
      .orderBy(desc(collectionRecipes.addedAt));

    res.json({
      ...collection,
      recipes: collectionRecipesData,
    });
  } catch (error: any) {
    console.error("Error fetching collection:", error);
    res.status(500).json({ error: "Failed to fetch collection" });
  }
});

// Create collection
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, description, isPublic } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Collection name is required" });
    }

    const newCollection: InsertRecipeCollection = {
      userId,
      name: name.trim(),
      description: description?.trim() || null,
      isPublic: isPublic || false,
    };

    const [collection] = await storage
      .insert(recipeCollections)
      .values(newCollection)
      .returning();

    res.status(201).json(collection);
  } catch (error: any) {
    console.error("Error creating collection:", error);
    res.status(500).json({ error: "Failed to create collection" });
  }
});

// Update collection
router.put("/:collectionId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { collectionId } = req.params;
    const { name, description, isPublic, isFeatured, seasonalTag, activeFrom, activeTo } = req.body;

    // Check if collection exists and belongs to user
    const [existing] = await storage
      .select()
      .from(recipeCollections)
      .where(eq(recipeCollections.id, collectionId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Collection not found" });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: "You can only edit your own collections" });
    }

    // Update collection
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (seasonalTag !== undefined) updateData.seasonalTag = seasonalTag;
    if (activeFrom !== undefined) updateData.activeFrom = activeFrom ? new Date(activeFrom) : null;
    if (activeTo !== undefined) updateData.activeTo = activeTo ? new Date(activeTo) : null;

    const [updated] = await storage
      .update(recipeCollections)
      .set(updateData)
      .where(eq(recipeCollections.id, collectionId))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating collection:", error);
    res.status(500).json({ error: "Failed to update collection" });
  }
});

// Delete collection
router.delete("/:collectionId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { collectionId } = req.params;

    // Check if collection exists and belongs to user
    const [existing] = await storage
      .select()
      .from(recipeCollections)
      .where(eq(recipeCollections.id, collectionId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Collection not found" });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: "You can only delete your own collections" });
    }

    // Delete collection (cascade will delete collection_recipes)
    await storage.delete(recipeCollections).where(eq(recipeCollections.id, collectionId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting collection:", error);
    res.status(500).json({ error: "Failed to delete collection" });
  }
});

// Add recipe to collection
router.post("/:collectionId/recipes", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { collectionId } = req.params;
    const { recipeId } = req.body;

    if (!recipeId) {
      return res.status(400).json({ error: "Recipe ID is required" });
    }

    // Check if collection exists and belongs to user
    const [collection] = await storage
      .select()
      .from(recipeCollections)
      .where(eq(recipeCollections.id, collectionId))
      .limit(1);

    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    if (collection.userId !== userId) {
      return res.status(403).json({ error: "You can only add recipes to your own collections" });
    }

    // Check if recipe already in collection
    const existing = await storage
      .select()
      .from(collectionRecipes)
      .where(
        and(
          eq(collectionRecipes.collectionId, collectionId),
          eq(collectionRecipes.recipeId, recipeId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Recipe already in collection" });
    }

    // Add recipe to collection
    const newEntry: InsertCollectionRecipe = {
      collectionId,
      recipeId,
    };

    const [entry] = await storage.insert(collectionRecipes).values(newEntry).returning();

    // Update collection recipe count
    await storage
      .update(recipeCollections)
      .set({ recipeCount: sql`${recipeCollections.recipeCount} + 1` })
      .where(eq(recipeCollections.id, collectionId));

    res.status(201).json(entry);
  } catch (error: any) {
    console.error("Error adding recipe to collection:", error);
    res.status(500).json({ error: "Failed to add recipe to collection" });
  }
});

// Remove recipe from collection
router.delete("/:collectionId/recipes/:recipeId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { collectionId, recipeId } = req.params;

    // Check if collection exists and belongs to user
    const [collection] = await storage
      .select()
      .from(recipeCollections)
      .where(eq(recipeCollections.id, collectionId))
      .limit(1);

    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    if (collection.userId !== userId) {
      return res.status(403).json({ error: "You can only remove recipes from your own collections" });
    }

    // Remove recipe from collection
    const result = await storage
      .delete(collectionRecipes)
      .where(
        and(
          eq(collectionRecipes.collectionId, collectionId),
          eq(collectionRecipes.recipeId, recipeId)
        )
      )
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: "Recipe not in collection" });
    }

    // Update collection recipe count
    await storage
      .update(recipeCollections)
      .set({ recipeCount: sql`${recipeCollections.recipeCount} - 1` })
      .where(eq(recipeCollections.id, collectionId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error removing recipe from collection:", error);
    res.status(500).json({ error: "Failed to remove recipe from collection" });
  }
});

// Check if recipe is in any of user's collections
router.get("/check/:recipeId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { recipeId } = req.params;

    // Get all user's collections with this recipe
    const userCollections = await storage
      .select({
        collectionId: collectionRecipes.collectionId,
        collectionName: recipeCollections.name,
      })
      .from(collectionRecipes)
      .leftJoin(recipeCollections, eq(collectionRecipes.collectionId, recipeCollections.id))
      .where(
        and(
          eq(collectionRecipes.recipeId, recipeId),
          eq(recipeCollections.userId, userId)
        )
      );

    res.json(userCollections);
  } catch (error: any) {
    console.error("Error checking recipe collections:", error);
    res.status(500).json({ error: "Failed to check recipe collections" });
  }
});

export default router;
