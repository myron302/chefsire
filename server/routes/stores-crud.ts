import { Router } from "express";
import { db } from "../db";
import { stores, users, orders } from "../../shared/schema.js";
import { eq, count, sum, sql } from "drizzle-orm";
import { SUBSCRIPTION_TIERS } from "./subscriptions";
import { requireAuth, optionalAuth } from "../middleware/auth";

const router = Router();

/**
 * STORE CRUD ROUTER
 * -----------------
 * Handles create, update, publish, and layout editing for user storefronts.
 * Private (requires authentication).
 * Requires Starter tier or higher for store builder access.
 */

// GET /api/stores/user/:userId - Get user's store (for owner)
// NOTE: This route must come BEFORE /:handle to avoid matching conflicts
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const store = await db.query.stores.findFirst({
      where: eq(stores.userId, userId),
    });

    res.json({ ok: true, store: store || null });
  } catch (error) {
    console.error("Error fetching user store:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch store" });
  }
});

// GET /api/stores/check-handle/:handle - Check if a handle is available
// Must come BEFORE /:handle to avoid being swallowed by that route
router.get("/check-handle/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    if (!handle || handle.length < 3 || !/^[a-z0-9-]+$/.test(handle)) {
      return res.json({ available: false, reason: "invalid" });
    }
    const existing = await db.query.stores.findFirst({
      where: eq(stores.handle, handle),
    });
    res.json({ available: !existing });
  } catch (error) {
    console.error("Error checking handle:", error);
    res.status(500).json({ available: false, reason: "error" });
  }
});

// GET /api/stores/:handle - Public view of a store (with optional auth)
router.get("/:handle", optionalAuth, async (req, res) => {
  try {
    const { handle } = req.params;
    const store = await db.query.stores.findFirst({
      where: eq(stores.handle, handle),
    });

    if (!store) {
      return res.status(404).json({ ok: false, error: "Store not found" });
    }

    // Check if the requesting user is the store owner
    const isOwner = req.user && req.user.id === store.userId;

    // Only show unpublished stores to the owner
    if (!store.published && !isOwner) {
      return res.status(404).json({ ok: false, error: "Store not available" });
    }

    res.json({ ok: true, store });
  } catch (error) {
    console.error("Error fetching store:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch store" });
  }
});

// POST /api/stores - Create a store
router.post("/", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    // Get user's subscription tier from their user record
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Determine subscription tier (free, starter, pro, enterprise)
    // Check both subscriptionTier and subscription fields for backwards compatibility
    const userTier = (user as any).subscription || user.subscriptionTier || "free";

    const { handle, name, bio } = req.body;
    if (!handle || !name) {
      return res.status(400).json({ ok: false, error: "Handle and name required" });
    }

    // Create store with user's subscription tier, published by default
    const [newStore] = await db
      .insert(stores)
      .values({
        userId: req.user.id,
        handle,
        name,
        bio: bio || null,
        subscriptionTier: userTier,
        published: true,
      })
      .returning();

    res.json({ ok: true, store: newStore });
  } catch (error: any) {
    console.error("[StoreCreate] Error creating store:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      table: error.table,
      constraint: error.constraint,
      stack: error.stack?.split('\n').slice(0, 5),
    });
    if (error.code === "23505") {
      return res.status(400).json({ ok: false, error: "Handle already taken", detail: error.detail });
    }
    if (error.code === "42P01") {
      return res.status(500).json({ ok: false, error: "Stores table does not exist in database. Run: npm run db:push", code: error.code });
    }
    res.status(500).json({ ok: false, error: error.message || "Failed to create store", code: error.code });
  }
});

// PATCH /api/stores-crud/:id - Update store details
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { id } = req.params;
    const { name, bio, theme, customization, layout } = req.body;

    const existing = await db.query.stores.findFirst({
      where: eq(stores.id, id),
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    // Build update object - only include fields that are provided
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (theme !== undefined) updateData.theme = theme;

    // Support both customization and layout fields
    if (customization !== undefined) {
      updateData.layout = { ...existing.layout, ...customization };
    } else if (layout !== undefined) {
      updateData.layout = layout;
    }

    const [updated] = await db
      .update(stores)
      .set(updateData)
      .where(eq(stores.id, id))
      .returning();

    res.json({ ok: true, store: updated });
  } catch (error) {
    console.error("Error updating store:", error);
    res.status(500).json({ ok: false, error: "Failed to update store" });
  }
});

// PATCH /api/stores-crud/:id/layout - Update store layout
router.patch("/:id/layout", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { id } = req.params;
    const { layout } = req.body;

    const existing = await db.query.stores.findFirst({
      where: eq(stores.id, id),
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    const [updated] = await db
      .update(stores)
      .set({
        layout,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, id))
      .returning();

    res.json({ ok: true, store: updated });
  } catch (error) {
    console.error("Error updating layout:", error);
    res.status(500).json({ ok: false, error: "Failed to update layout" });
  }
});

// PATCH /api/stores-crud/:id/publish - Toggle published status
router.patch("/:id/publish", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { id } = req.params;
    const { published } = req.body;

    const existing = await db.query.stores.findFirst({
      where: eq(stores.id, id),
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    const [updated] = await db
      .update(stores)
      .set({
        published: published ?? !existing.published,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, id))
      .returning();

    res.json({ ok: true, store: updated });
  } catch (error) {
    console.error("Error publishing store:", error);
    res.status(500).json({ ok: false, error: "Failed to update publish status" });
  }
});

// GET /api/stores/:id/stats - Get store statistics (views, sales, revenue)
router.get("/:id/stats", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { id } = req.params;

    // Verify ownership
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, id),
    });

    if (!store || store.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    // Get sales count and revenue from orders
    const salesData = await db
      .select({
        totalSales: count(orders.id),
        totalRevenue: sum(orders.sellerAmount),
      })
      .from(orders)
      .where(eq(orders.sellerId, store.userId));

    const stats = {
      totalViews: store.viewCount || 0,
      totalSales: salesData[0]?.totalSales || 0,
      totalRevenue: parseFloat(salesData[0]?.totalRevenue || "0"),
    };

    res.json({ ok: true, stats });
  } catch (error) {
    console.error("Error fetching store stats:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch stats" });
  }
});

// PATCH /api/stores/:id/increment-view - Increment view count
router.patch("/:id/increment-view", async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .update(stores)
      .set({
        viewCount: sql`${stores.viewCount} + 1`,
      })
      .where(eq(stores.id, id));

    res.json({ ok: true });
  } catch (error) {
    console.error("Error incrementing view count:", error);
    res.status(500).json({ ok: false, error: "Failed to increment view count" });
  }
});

export default router;
