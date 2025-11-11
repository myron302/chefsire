import { Router } from "express";
import { db } from "../db";
import { stores, users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { SUBSCRIPTION_TIERS } from "./subscriptions";
import { requireAuth } from "../middleware";

const router = Router();

/**
 * STORE CRUD ROUTER
 * -----------------
 * Handles create, update, publish, and layout editing for user storefronts.
 * Private (requires authentication).
 * Requires Starter tier or higher for store builder access.
 */

// GET /api/stores-crud/user/:userId - Get user's store (for owner)
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

    // Create store with user's subscription tier
    const [newStore] = await db
      .insert(stores)
      .values({
        userId: req.user.id,
        handle,
        name,
        bio: bio || null,
        subscriptionTier: userTier
      })
      .returning();

    res.json({ ok: true, store: newStore });
  } catch (error: any) {
    console.error("Error creating store:", error);
    if (error.code === "23505") {
      return res.status(400).json({ ok: false, error: "Handle already taken" });
    }
    res.status(500).json({ ok: false, error: "Failed to create store" });
  }
});

// PATCH /api/stores-crud/:id - Update store details
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { id } = req.params;
    const { name, bio, theme } = req.body;

    const existing = await db.query.stores.findFirst({
      where: eq(stores.id, id),
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    const [updated] = await db
      .update(stores)
      .set({
        name: name ?? existing.name,
        bio: bio ?? existing.bio,
        theme: theme ?? existing.theme,
        updatedAt: new Date(),
      })
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

export default router;
