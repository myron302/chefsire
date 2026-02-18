import express, { type Request, type Response } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware";
import { groceryListItems, pantryItems } from "../../shared/schema.js";

const router = express.Router();

// ============================================================
// GROCERY / SHOPPING LIST (shared by Pantry + Nutrition)
//
// IMPORTANT:
// - Both Pantry "Shopping List" and Nutrition "Grocery List" hit the same API:
//     /api/meal-planner/grocery-list
// - Your shared/schema.ts includes columns (location, is_running_low) that are
//   missing in server/drizzle/20251225_advanced_meal_planning.sql for older DBs.
//   When Postgres is missing those columns, Drizzle select/returning will error.
// - To avoid breaking existing deployments, we ensure/patch the table at runtime.
// ============================================================

let _groceryListSchemaReady: Promise<void> | null = null;

async function ensureGroceryListSchema() {
  if (_groceryListSchemaReady) return _groceryListSchemaReady;

  _groceryListSchemaReady = (async () => {
    // Create the table if missing (fresh installs). This matches shared/schema.ts.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grocery_list_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_plan_id VARCHAR REFERENCES meal_plans(id),
        list_name TEXT DEFAULT 'My Grocery List',
        ingredient_name TEXT NOT NULL,
        quantity TEXT,
        unit TEXT,
        location TEXT,
        category TEXT,
        estimated_price DECIMAL(8, 2),
        actual_price DECIMAL(8, 2),
        store TEXT,
        aisle TEXT,
        priority TEXT DEFAULT 'normal',
        is_pantry_item BOOLEAN DEFAULT false,
        purchased BOOLEAN DEFAULT false,
        purchased_at TIMESTAMP,
        notes TEXT,
        is_running_low BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Patch older DBs where the table exists but is missing newer columns.
    await db.execute(sql`ALTER TABLE grocery_list_items ADD COLUMN IF NOT EXISTS location TEXT;`);
    await db.execute(sql`ALTER TABLE grocery_list_items ADD COLUMN IF NOT EXISTS is_running_low BOOLEAN DEFAULT false;`);

    // Helpful indexes (safe if already present).
    await db.execute(sql`CREATE INDEX IF NOT EXISTS grocery_list_items_user_idx ON grocery_list_items(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS grocery_list_items_category_idx ON grocery_list_items(category);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS grocery_list_items_purchased_idx ON grocery_list_items(purchased);`);
  })();

  return _groceryListSchemaReady;
}

function andAll(conds: any[]) {
  if (conds.length === 1) return conds[0];
  return and(...conds);
}

// ------------------------------------------------------------
// Add grocery list item
// POST /api/meal-planner/grocery-list
// ------------------------------------------------------------
router.post("/grocery-list", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureGroceryListSchema();

    const userId = req.user!.id;
    const {
      mealPlanId,
      listName,
      ingredientName,
      quantity,
      unit,
      location,
      category,
      estimatedPrice,
      store,
      aisle,
      priority,
      isPantryItem,
      notes,
      isRunningLow,
    } = req.body;

    if (!ingredientName) {
      return res.status(400).json({ message: "Ingredient name is required" });
    }

    const [item] = await db
      .insert(groceryListItems)
      .values({
        userId,
        mealPlanId,
        listName: listName || "My Grocery List",
        ingredientName,
        quantity,
        unit,
        location,
        category,
        estimatedPrice,
        store,
        aisle,
        priority: priority || "normal",
        isPantryItem: isPantryItem || false,
        notes,
        isRunningLow: isRunningLow ?? false,
      })
      .returning();

    res.json({ item });
  } catch (error) {
    console.error("Error adding grocery item:", error);
    res.status(500).json({ message: "Failed to add grocery item" });
  }
});

// ------------------------------------------------------------
// Get grocery list
// GET /api/meal-planner/grocery-list?purchased=false&mealPlanId=...
// ------------------------------------------------------------
router.get("/grocery-list", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureGroceryListSchema();

    const userId = req.user!.id;
    const { mealPlanId, purchased } = req.query;

    const conds: any[] = [eq(groceryListItems.userId, userId)];

    if (purchased === "false") {
      conds.push(eq(groceryListItems.purchased, false));
    }

    if (mealPlanId) {
      conds.push(eq(groceryListItems.mealPlanId, mealPlanId as string));
    }

    const items = await db
      .select()
      .from(groceryListItems)
      .where(andAll(conds))
      .orderBy(groceryListItems.category, groceryListItems.aisle);

    // Budget summary
    const totalEstimated = items.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0);
    const totalActual = items.reduce((sum, item) => sum + Number(item.actualPrice || 0), 0);

    res.json({
      items,
      budget: {
        estimated: totalEstimated,
        actual: totalActual,
        difference: totalActual - totalEstimated,
      },
    });
  } catch (error) {
    console.error("Error fetching grocery list:", error);
    res.status(500).json({ message: "Failed to fetch grocery list" });
  }
});

// ------------------------------------------------------------
// Optimized grocery list (store layout)
// GET /api/meal-planner/grocery-list/optimized?store=...
// ------------------------------------------------------------
router.get("/grocery-list/optimized", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureGroceryListSchema();

    const userId = req.user!.id;
    const { store } = req.query;

    const conds: any[] = [
      eq(groceryListItems.userId, userId),
      eq(groceryListItems.purchased, false),
    ];

    if (store) {
      conds.push(eq(groceryListItems.store, store as string));
    }

    const items = await db
      .select()
      .from(groceryListItems)
      .where(andAll(conds))
      .orderBy(groceryListItems.aisle, groceryListItems.category);

    const grouped = items.reduce((acc, item) => {
      const key = (item.category || "Other").toLowerCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    const storeLayoutOrder = [
      "produce",
      "bakery",
      "meat",
      "seafood",
      "dairy",
      "frozen",
      "pantry",
      "beverages",
      "snacks",
      "condiments",
      "other",
    ];

    const optimized = storeLayoutOrder
      .map((category) => ({ category, items: grouped[category] || [] }))
      .filter((g) => g.items.length > 0);

    res.json({ optimized, totalItems: items.length });
  } catch (error) {
    console.error("Error optimizing grocery list:", error);
    res.status(500).json({ message: "Failed to optimize grocery list" });
  }
});

// ------------------------------------------------------------
// Check grocery items against pantry (marks is_pantry_item)
// POST /api/meal-planner/grocery-list/check-pantry
// ------------------------------------------------------------
router.post("/grocery-list/check-pantry", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureGroceryListSchema();

    const userId = req.user!.id;

    const groceryItems = await db
      .select()
      .from(groceryListItems)
      .where(and(eq(groceryListItems.userId, userId), eq(groceryListItems.purchased, false)));

    const pantryIngredients = await db
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, userId));

    const updates: Promise<any>[] = [];

    for (const grocery of groceryItems) {
      const gName = (grocery.ingredientName || "").toLowerCase().trim();
      if (!gName) continue;

      const inPantry = pantryIngredients.some((p) => {
        const pName = (p.name || "").toLowerCase().trim();
        if (!pName) return false;
        return pName.includes(gName) || gName.includes(pName);
      });

      if (inPantry && !grocery.isPantryItem) {
        updates.push(
          db
            .update(groceryListItems)
            .set({ isPantryItem: true })
            .where(and(eq(groceryListItems.id, grocery.id), eq(groceryListItems.userId, userId)))
        );
      }
    }

    await Promise.all(updates);

    res.json({ message: "Pantry check complete", matched: updates.length });
  } catch (error) {
    console.error("Error checking pantry:", error);
    res.status(500).json({ message: "Failed to check pantry" });
  }
});

// ------------------------------------------------------------
// Update grocery list item
// PATCH /api/meal-planner/grocery-list/:id
// ------------------------------------------------------------
router.patch("/grocery-list/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureGroceryListSchema();

    const userId = req.user!.id;
    const { id } = req.params;
    const { ingredientName, quantity, unit, location, category, notes, isRunningLow } = req.body;

    const [updated] = await db
      .update(groceryListItems)
      .set({
        ingredientName,
        quantity,
        unit,
        location,
        category,
        notes,
        isRunningLow,
      })
      .where(and(eq(groceryListItems.id, id), eq(groceryListItems.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Grocery item not found" });
    }

    res.json({ item: updated });
  } catch (error) {
    console.error("Error updating grocery item:", error);
    res.status(500).json({ message: "Failed to update grocery item" });
  }
});

// ------------------------------------------------------------
// Mark item as purchased (or toggle)
// PATCH /api/meal-planner/grocery-list/:id/purchase
// ------------------------------------------------------------
router.patch("/grocery-list/:id/purchase", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureGroceryListSchema();

    const userId = req.user!.id;
    const { id } = req.params;
    const { actualPrice, toggle } = req.body;

    let purchased = true;
    if (toggle) {
      const [currentItem] = await db
        .select()
        .from(groceryListItems)
        .where(and(eq(groceryListItems.id, id), eq(groceryListItems.userId, userId)))
        .limit(1);

      if (currentItem) {
        purchased = !currentItem.purchased;
      }
    }

    const [updated] = await db
      .update(groceryListItems)
      .set({
        purchased,
        purchasedAt: purchased ? new Date() : null,
        actualPrice: actualPrice || null,
      })
      .where(and(eq(groceryListItems.id, id), eq(groceryListItems.userId, userId)))
      .returning();

    res.json({ item: updated });
  } catch (error) {
    console.error("Error purchasing item:", error);
    res.status(500).json({ message: "Failed to purchase item" });
  }
});

// ------------------------------------------------------------
// Delete grocery list item
// DELETE /api/meal-planner/grocery-list/:id
// ------------------------------------------------------------
router.delete("/grocery-list/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureGroceryListSchema();

    const userId = req.user!.id;
    const { id } = req.params;

    const [deleted] = await db
      .delete(groceryListItems)
      .where(and(eq(groceryListItems.id, id), eq(groceryListItems.userId, userId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Grocery item not found" });
    }

    res.json({ success: true, id });
  } catch (error) {
    console.error("Error deleting grocery item:", error);
    res.status(500).json({ message: "Failed to delete grocery item" });
  }
});

// ------------------------------------------------------------
// Grocery list savings report
// GET /api/meal-planner/grocery-list/savings-report?startDate=...&endDate=...
// ------------------------------------------------------------
router.get("/grocery-list/savings-report", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureGroceryListSchema();

    const userId = req.user!.id;
    const { startDate, endDate } = req.query;

    const conds: any[] = [eq(groceryListItems.userId, userId)];
    if (startDate) conds.push(gte(groceryListItems.createdAt, new Date(startDate as string)));
    if (endDate) conds.push(lte(groceryListItems.createdAt, new Date(endDate as string)));

    const items = await db
      .select()
      .from(groceryListItems)
      .where(andAll(conds));

    const totalEstimated = items.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0);
    const totalActual = items.reduce((sum, item) => sum + Number(item.actualPrice || 0), 0);
    const totalSaved = totalEstimated - totalActual;
    const savingsRate = totalEstimated > 0 ? ((totalSaved / totalEstimated) * 100).toFixed(1) : "0.0";

    const pantryOnly = items.filter((item) => item.isPantryItem);
    const pantrySavings = pantryOnly.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0);

    const categoryStats = items.reduce((acc, item) => {
      const category = item.category || "Other";
      if (!acc[category]) {
        acc[category] = { estimated: 0, actual: 0, saved: 0, count: 0 };
      }
      acc[category].estimated += Number(item.estimatedPrice || 0);
      acc[category].actual += Number(item.actualPrice || 0);
      acc[category].saved += Number(item.estimatedPrice || 0) - Number(item.actualPrice || 0);
      acc[category].count++;
      return acc;
    }, {} as Record<string, { estimated: number; actual: number; saved: number; count: number }>);

    const topSavingCategories = Object.entries(categoryStats)
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.saved - a.saved)
      .slice(0, 5);

    res.json({
      summary: {
        totalEstimated: totalEstimated.toFixed(2),
        totalActual: totalActual.toFixed(2),
        totalSaved: totalSaved.toFixed(2),
        savingsRate: `${savingsRate}%`,
        itemCount: items.length,
        purchasedCount: items.filter((i) => i.purchased).length,
      },
      pantry: {
        itemCount: pantryOnly.length,
        savings: pantrySavings.toFixed(2),
      },
      topSavingCategories,
      periodStart: startDate || items[0]?.createdAt || new Date(),
      periodEnd: endDate || new Date(),
    });
  } catch (error) {
    console.error("Error generating savings report:", error);
    res.status(500).json({ message: "Failed to generate savings report" });
  }
});

export default router;
