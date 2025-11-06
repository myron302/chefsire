import { Router } from "express";
import { db } from "../db";
import { stores } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * STORE CRUD ROUTER
 * -----------------
 * Handles create, update, publish, and layout editing for user storefronts.
 * Private (requires authentication).
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

// POST /api/stores-crud - Create a store
router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { handle, name, bio } = req.body;
    if (!handle || !name) {
      return res.status(400).json({ ok: false, error: "Handle and name required" });
    }

    const [newStore] = await db
      .insert(stores)
      .values({
        userId: req.user.id,
        handle,
        name,
        bio: bio || null,
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
router.patch("/:id", async (req, res) => {
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
router.patch("/:id/layout", async (req, res) => {
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
router.patch("/:id/publish", async (req, res) => {
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
