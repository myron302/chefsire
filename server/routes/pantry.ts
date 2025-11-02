import { Router } from "express";
import { db } from "@db";
import {
  pantryItemsEnhanced,
  barcodeLookup,
  households,
  householdMembers,
  recipeMatches,
  expiryReminders,
  recipes,
  users
} from "@db/schema";
import { eq, and, sql, desc, asc, lte, gte, or, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* =========================================================================
   PANTRY ITEMS CRUD
   ========================================================================= */

// Get all pantry items for user (including household items if part of one)
router.get("/items", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Check if user is part of a household
    const userHousehold = await db
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    const householdId = userHousehold[0]?.householdId;

    // Get items (personal + household)
    const items = await db
      .select()
      .from(pantryItemsEnhanced)
      .where(
        householdId
          ? or(
              eq(pantryItemsEnhanced.userId, userId),
              eq(pantryItemsEnhanced.householdId, householdId)
            )
          : eq(pantryItemsEnhanced.userId, userId)
      )
      .orderBy(desc(pantryItemsEnhanced.createdAt));

    // Get barcode data for items with barcodes
    const barcodes = items
      .map(item => item.barcode)
      .filter((b): b is string => !!b);

    let barcodeData: Record<string, any> = {};
    if (barcodes.length > 0) {
      const barcodeRecords = await db
        .select()
        .from(barcodeLookup)
        .where(inArray(barcodeLookup.barcode, barcodes));

      barcodeData = Object.fromEntries(
        barcodeRecords.map(b => [b.barcode, b])
      );
    }

    // Enhance items with barcode data
    const enhancedItems = items.map(item => ({
      ...item,
      barcodeData: item.barcode ? barcodeData[item.barcode] : null
    }));

    res.json({ items: enhancedItems });
  } catch (error) {
    console.error("Error fetching pantry items:", error);
    res.status(500).json({ error: "Failed to fetch pantry items" });
  }
});

// Add new pantry item
router.post("/items", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      name,
      barcode,
      category,
      quantity,
      unit,
      location,
      expirationDate,
      purchaseDate,
      openedDate,
      estimatedCost,
      store,
      notes,
      imageUrl,
      householdId,
      reorderThreshold
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: "Item name is required" });
    }

    // If household specified, verify user is member
    if (householdId) {
      const membership = await db
        .select()
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            eq(householdMembers.userId, userId)
          )
        )
        .limit(1);

      if (!membership.length) {
        return res.status(403).json({ error: "Not a member of this household" });
      }
    }

    // Create pantry item
    const [newItem] = await db
      .insert(pantryItemsEnhanced)
      .values({
        userId,
        householdId: householdId || null,
        name,
        barcode: barcode || null,
        category: category || null,
        quantity: quantity || null,
        unit: unit || null,
        location: location || null,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        openedDate: openedDate ? new Date(openedDate) : null,
        estimatedCost: estimatedCost || null,
        store: store || null,
        notes: notes || null,
        imageUrl: imageUrl || null,
        reorderThreshold: reorderThreshold || null,
        isRunningLow: false
      })
      .returning();

    // Create expiry reminders if expiration date is set
    if (expirationDate && newItem) {
      const expDate = new Date(expirationDate);
      const reminders = [
        { daysBefore: 7, reminderDate: new Date(expDate.getTime() - 7 * 24 * 60 * 60 * 1000) },
        { daysBefore: 3, reminderDate: new Date(expDate.getTime() - 3 * 24 * 60 * 60 * 1000) },
        { daysBefore: 1, reminderDate: new Date(expDate.getTime() - 1 * 24 * 60 * 60 * 1000) }
      ];

      const now = new Date();
      const futureReminders = reminders.filter(r => r.reminderDate > now);

      if (futureReminders.length > 0) {
        await db.insert(expiryReminders).values(
          futureReminders.map(r => ({
            userId,
            pantryItemId: newItem.id,
            reminderDate: r.reminderDate,
            daysBefore: r.daysBefore,
            status: "pending"
          }))
        );
      }
    }

    res.json({ item: newItem });
  } catch (error) {
    console.error("Error adding pantry item:", error);
    res.status(500).json({ error: "Failed to add pantry item" });
  }
});

// Update pantry item
router.patch("/items/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const itemId = req.params.id;
    const updates = req.body;

    // Verify ownership or household membership
    const [item] = await db
      .select()
      .from(pantryItemsEnhanced)
      .where(eq(pantryItemsEnhanced.id, itemId))
      .limit(1);

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Check if user owns the item or is in the household
    let canEdit = item.userId === userId;
    if (item.householdId) {
      const membership = await db
        .select()
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, item.householdId),
            eq(householdMembers.userId, userId)
          )
        )
        .limit(1);

      if (membership.length > 0) {
        canEdit = true;
      }
    }

    if (!canEdit) {
      return res.status(403).json({ error: "Not authorized to edit this item" });
    }

    // Update item
    const [updatedItem] = await db
      .update(pantryItemsEnhanced)
      .set({
        ...updates,
        expirationDate: updates.expirationDate ? new Date(updates.expirationDate) : undefined,
        purchaseDate: updates.purchaseDate ? new Date(updates.purchaseDate) : undefined,
        openedDate: updates.openedDate ? new Date(updates.openedDate) : undefined,
        updatedAt: new Date()
      })
      .where(eq(pantryItemsEnhanced.id, itemId))
      .returning();

    // Update expiry reminders if expiration date changed
    if (updates.expirationDate) {
      // Delete old reminders
      await db
        .delete(expiryReminders)
        .where(eq(expiryReminders.pantryItemId, itemId));

      // Create new ones
      const expDate = new Date(updates.expirationDate);
      const reminders = [
        { daysBefore: 7, reminderDate: new Date(expDate.getTime() - 7 * 24 * 60 * 60 * 1000) },
        { daysBefore: 3, reminderDate: new Date(expDate.getTime() - 3 * 24 * 60 * 60 * 1000) },
        { daysBefore: 1, reminderDate: new Date(expDate.getTime() - 1 * 24 * 60 * 60 * 1000) }
      ];

      const now = new Date();
      const futureReminders = reminders.filter(r => r.reminderDate > now);

      if (futureReminders.length > 0) {
        await db.insert(expiryReminders).values(
          futureReminders.map(r => ({
            userId,
            pantryItemId: itemId,
            reminderDate: r.reminderDate,
            daysBefore: r.daysBefore,
            status: "pending"
          }))
        );
      }
    }

    res.json({ item: updatedItem });
  } catch (error) {
    console.error("Error updating pantry item:", error);
    res.status(500).json({ error: "Failed to update pantry item" });
  }
});

// Delete pantry item
router.delete("/items/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const itemId = req.params.id;

    // Verify ownership or household membership
    const [item] = await db
      .select()
      .from(pantryItemsEnhanced)
      .where(eq(pantryItemsEnhanced.id, itemId))
      .limit(1);

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    let canDelete = item.userId === userId;
    if (item.householdId) {
      const membership = await db
        .select()
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, item.householdId),
            eq(householdMembers.userId, userId)
          )
        )
        .limit(1);

      if (membership.length > 0) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: "Not authorized to delete this item" });
    }

    await db
      .delete(pantryItemsEnhanced)
      .where(eq(pantryItemsEnhanced.id, itemId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting pantry item:", error);
    res.status(500).json({ error: "Failed to delete pantry item" });
  }
});

/* =========================================================================
   BARCODE OPERATIONS
   ========================================================================= */

// Lookup barcode
router.get("/barcode/:barcode", requireAuth, async (req, res) => {
  try {
    const barcode = req.params.barcode;

    const [barcodeData] = await db
      .select()
      .from(barcodeLookup)
      .where(eq(barcodeLookup.barcode, barcode))
      .limit(1);

    if (barcodeData) {
      // Increment scan count
      await db
        .update(barcodeLookup)
        .set({
          scannedCount: sql`${barcodeLookup.scannedCount} + 1`,
          lastScannedAt: new Date()
        })
        .where(eq(barcodeLookup.barcode, barcode));
    }

    res.json({ barcodeData: barcodeData || null });
  } catch (error) {
    console.error("Error looking up barcode:", error);
    res.status(500).json({ error: "Failed to lookup barcode" });
  }
});

// Add barcode to cache (crowd-sourced data)
router.post("/barcode", requireAuth, async (req, res) => {
  try {
    const {
      barcode,
      productName,
      brand,
      category,
      defaultUnit,
      averageShelfLife,
      commonAllergens,
      imageUrl,
      nutritionPer100g
    } = req.body;

    if (!barcode || !productName) {
      return res.status(400).json({ error: "Barcode and product name are required" });
    }

    // Check if already exists
    const existing = await db
      .select()
      .from(barcodeLookup)
      .where(eq(barcodeLookup.barcode, barcode))
      .limit(1);

    let result;
    if (existing.length > 0) {
      // Update existing
      [result] = await db
        .update(barcodeLookup)
        .set({
          productName,
          brand: brand || existing[0].brand,
          category: category || existing[0].category,
          defaultUnit: defaultUnit || existing[0].defaultUnit,
          averageShelfLife: averageShelfLife || existing[0].averageShelfLife,
          commonAllergens: commonAllergens || existing[0].commonAllergens,
          imageUrl: imageUrl || existing[0].imageUrl,
          nutritionPer100g: nutritionPer100g || existing[0].nutritionPer100g,
          scannedCount: sql`${barcodeLookup.scannedCount} + 1`,
          lastScannedAt: new Date()
        })
        .where(eq(barcodeLookup.barcode, barcode))
        .returning();
    } else {
      // Insert new
      [result] = await db
        .insert(barcodeLookup)
        .values({
          barcode,
          productName,
          brand: brand || null,
          category: category || null,
          defaultUnit: defaultUnit || null,
          averageShelfLife: averageShelfLife || null,
          commonAllergens: commonAllergens || [],
          imageUrl: imageUrl || null,
          nutritionPer100g: nutritionPer100g || null
        })
        .returning();
    }

    res.json({ barcodeData: result });
  } catch (error) {
    console.error("Error adding barcode:", error);
    res.status(500).json({ error: "Failed to add barcode" });
  }
});

/* =========================================================================
   RECIPE MATCHING
   ========================================================================= */

// Get recipe matches based on pantry
router.get("/recipe-matches", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const minScore = parseFloat(req.query.minScore as string) || 0.5;

    // Get user's pantry items
    const userHousehold = await db
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    const householdId = userHousehold[0]?.householdId;

    const pantryItems = await db
      .select()
      .from(pantryItemsEnhanced)
      .where(
        householdId
          ? or(
              eq(pantryItemsEnhanced.userId, userId),
              eq(pantryItemsEnhanced.householdId, householdId)
            )
          : eq(pantryItemsEnhanced.userId, userId)
      );

    const pantryIngredients = new Set(
      pantryItems.map(item => item.name.toLowerCase().trim())
    );

    // Get all recipes and calculate match scores
    const allRecipes = await db.select().from(recipes).limit(100);

    const matches = allRecipes
      .map(recipe => {
        const recipeIngredients = recipe.ingredients || [];
        const matchingCount = recipeIngredients.filter(ing =>
          pantryIngredients.has(ing.toLowerCase().trim())
        ).length;

        const matchScore = recipeIngredients.length > 0
          ? matchingCount / recipeIngredients.length
          : 0;

        const missingIngredients = recipeIngredients.filter(
          ing => !pantryIngredients.has(ing.toLowerCase().trim())
        );

        return {
          ...recipe,
          matchScore,
          matchingIngredients: recipeIngredients.filter(ing =>
            pantryIngredients.has(ing.toLowerCase().trim())
          ),
          missingIngredients
        };
      })
      .filter(r => r.matchScore >= minScore)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 20);

    res.json({ recipes: matches });
  } catch (error) {
    console.error("Error calculating recipe matches:", error);
    res.status(500).json({ error: "Failed to calculate recipe matches" });
  }
});

/* =========================================================================
   EXPIRY TRACKING
   ========================================================================= */

// Get items expiring soon
router.get("/expiring-soon", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 7;

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    // Get user's household if any
    const userHousehold = await db
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    const householdId = userHousehold[0]?.householdId;

    // Get expiring items
    const expiringItems = await db
      .select()
      .from(pantryItemsEnhanced)
      .where(
        and(
          householdId
            ? or(
                eq(pantryItemsEnhanced.userId, userId),
                eq(pantryItemsEnhanced.householdId, householdId)
              )
            : eq(pantryItemsEnhanced.userId, userId),
          lte(pantryItemsEnhanced.expirationDate, futureDate),
          gte(pantryItemsEnhanced.expirationDate, now)
        )
      )
      .orderBy(asc(pantryItemsEnhanced.expirationDate));

    res.json({ items: expiringItems });
  } catch (error) {
    console.error("Error fetching expiring items:", error);
    res.status(500).json({ error: "Failed to fetch expiring items" });
  }
});

/* =========================================================================
   HOUSEHOLD MANAGEMENT
   ========================================================================= */

// Get user's household
router.get("/household", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const membership = await db
      .select({
        household: households,
        role: householdMembers.role
      })
      .from(householdMembers)
      .leftJoin(households, eq(householdMembers.householdId, households.id))
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    if (!membership.length) {
      return res.json({ household: null });
    }

    const household = membership[0].household;
    const userRole = membership[0].role;

    // Get all members
    const members = await db
      .select({
        user: users,
        role: householdMembers.role,
        joinedAt: householdMembers.joinedAt
      })
      .from(householdMembers)
      .leftJoin(users, eq(householdMembers.userId, users.id))
      .where(eq(householdMembers.householdId, household!.id));

    res.json({
      household: {
        ...household,
        userRole,
        members
      }
    });
  } catch (error) {
    console.error("Error fetching household:", error);
    res.status(500).json({ error: "Failed to fetch household" });
  }
});

// Create household
router.post("/household", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Household name is required" });
    }

    // Check if user already in a household
    const existing = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Already a member of a household" });
    }

    // Generate invite code
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Create household
    const [household] = await db
      .insert(households)
      .values({
        name,
        ownerId: userId,
        inviteCode
      })
      .returning();

    // Add owner as member
    await db.insert(householdMembers).values({
      householdId: household.id,
      userId,
      role: "owner"
    });

    res.json({ household });
  } catch (error) {
    console.error("Error creating household:", error);
    res.status(500).json({ error: "Failed to create household" });
  }
});

// Join household with invite code
router.post("/household/join", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: "Invite code is required" });
    }

    // Check if user already in a household
    const existing = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Already a member of a household" });
    }

    // Find household by invite code
    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.inviteCode, inviteCode.toUpperCase()))
      .limit(1);

    if (!household) {
      return res.status(404).json({ error: "Invalid invite code" });
    }

    // Add user to household
    await db.insert(householdMembers).values({
      householdId: household.id,
      userId,
      role: "member"
    });

    res.json({ household });
  } catch (error) {
    console.error("Error joining household:", error);
    res.status(500).json({ error: "Failed to join household" });
  }
});

// Leave household
router.post("/household/leave", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get user's household membership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    if (!membership) {
      return res.status(404).json({ error: "Not a member of any household" });
    }

    // Can't leave if you're the owner
    if (membership.role === "owner") {
      return res.status(400).json({
        error: "Owner cannot leave household. Transfer ownership or delete the household first."
      });
    }

    // Remove membership
    await db
      .delete(householdMembers)
      .where(eq(householdMembers.userId, userId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error leaving household:", error);
    res.status(500).json({ error: "Failed to leave household" });
  }
});

export default router;
