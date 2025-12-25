// server/routes/pantry.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";

const r = Router();

/**
 * Pantry endpoints (user-id based; no session dependency).
 */

// Session-based endpoints (get user ID from session)
// Get current user's pantry
r.get("/items", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const items = await storage.getPantryItems(userId);
    res.json(items);
  } catch (error) {
    console.error("pantry/items/list error", error);
    res.status(500).json({ message: "Failed to fetch pantry items" });
  }
});

// Add item to current user's pantry
r.post("/items", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const schema = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      quantity: z.union([z.string(), z.number()]).optional(),
      unit: z.string().optional(),
      expirationDate: z.string().datetime().optional(),
      notes: z.string().optional(),
      imageUrl: z.string().optional(),
    });

    const body = schema.parse(req.body);

    // Convert quantity to number if it's a string
    let quantityNum: number | undefined;
    if (body.quantity !== undefined) {
      quantityNum = typeof body.quantity === 'string' ? parseFloat(body.quantity) : body.quantity;
      if (isNaN(quantityNum)) quantityNum = undefined;
    }

    const created = await storage.addPantryItem(userId, {
      name: body.name,
      category: body.category,
      quantity: quantityNum,
      unit: body.unit,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
      notes: body.notes,
    });

    res.status(201).json(created);
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid item", errors: error.issues });
    console.error("pantry/items/add error", error);
    res.status(500).json({ message: "Failed to add pantry item" });
  }
});

// Get expiring items for current user
r.get("/expiring-soon", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const days = Number(req.query.days ?? 7);
    const items = await storage.getExpiringItems(userId, isNaN(days) ? 7 : days);
    res.json(items);
  } catch (error) {
    console.error("pantry/expiring-soon error", error);
    res.status(500).json({ message: "Failed to fetch expiring items" });
  }
});

// Delete pantry item by ID
r.delete("/items/:itemId", requireAuth, async (req, res) => {
  try {
    const ok = await storage.deletePantryItem(req.params.itemId);
    if (!ok) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item deleted" });
  } catch (error) {
    console.error("pantry/items/delete error", error);
    res.status(500).json({ message: "Failed to delete pantry item" });
  }
});

// User-ID based endpoints (for backwards compatibility)
// Get a user's pantry
r.get("/users/:id/pantry", async (req, res) => {
  try {
    const items = await storage.getPantryItems(req.params.id);
    res.json({ pantryItems: items, total: items.length });
  } catch (error) {
    console.error("pantry/list error", error);
    res.status(500).json({ message: "Failed to fetch pantry items" });
  }
});

// Add pantry item
r.post("/users/:id/pantry", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      quantity: z.number().min(0).optional(),
      unit: z.string().optional(),
      expirationDate: z.string().datetime().optional(),
      notes: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const created = await storage.addPantryItem(req.params.id, {
      name: body.name,
      category: body.category,
      quantity: body.quantity,
      unit: body.unit,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
      notes: body.notes,
    });

    res.status(201).json({ message: "Pantry item added", item: created });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid item", errors: error.issues });
    console.error("pantry/add error", error);
    res.status(500).json({ message: "Failed to add pantry item" });
  }
});

// Update pantry item
r.put("/pantry/:itemId", async (req, res) => {
  try {
    const schema = z.object({
      quantity: z.number().min(0).optional(),
      expirationDate: z.string().datetime().optional(),
      notes: z.string().optional(),
    });
    const body = schema.parse(req.body);

    const updated = await storage.updatePantryItem(req.params.itemId, {
      quantity: body.quantity,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
      notes: body.notes,
    });

    if (!updated) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item updated", item: updated });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid update", errors: error.issues });
    console.error("pantry/update error", error);
    res.status(500).json({ message: "Failed to update pantry item" });
  }
});

// Delete pantry item
r.delete("/pantry/:itemId", async (req, res) => {
  try {
    const ok = await storage.deletePantryItem(req.params.itemId);
    if (!ok) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item deleted" });
  } catch (error) {
    console.error("pantry/delete error", error);
    res.status(500).json({ message: "Failed to delete pantry item" });
  }
});

// Expiring soon
r.get("/users/:id/pantry/expiring", async (req, res) => {
  try {
    const days = Number(req.query.days ?? 7);
    const items = await storage.getExpiringItems(req.params.id, isNaN(days) ? 7 : days);
    res.json({ expiringItems: items, daysAhead: days, total: items.length });
  } catch (error) {
    console.error("pantry/expiring error", error);
    res.status(500).json({ message: "Failed to fetch expiring items" });
  }
});

// Pantry-based recipe suggestions
r.get("/users/:id/pantry/recipe-suggestions", async (req, res) => {
  try {
    const schema = z.object({
      requireAllIngredients: z.coerce.boolean().default(false),
      maxMissingIngredients: z.coerce.number().min(0).max(10).default(3),
      includeExpiringSoon: z.coerce.boolean().default(true),
      limit: z.coerce.number().min(1).max(50).default(20),
    });
    const opts = schema.parse(req.query);

    const suggestions = await storage.getRecipesFromPantryItems(req.params.id, opts);
    res.json({
      suggestions,
      options: opts,
      total: suggestions.length,
      message:
        suggestions.length === 0
          ? "No matches yet. Try adding more items to your pantry."
          : undefined,
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid parameters", errors: e.issues });
    console.error("pantry/suggestions error", e);
    res.status(500).json({ message: "Failed to get suggestions" });
  }
});

export default r;
