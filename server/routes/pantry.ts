// server/routes/pantry.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";

const r = Router();


// ===== Household Pantry (shared) =====

r.get("/household", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const info = await storage.getHouseholdInfoForUser(userId);
    return res.json(info ? info : { household: null, members: [], userRole: null });
  } catch (error: any) {
    console.error("pantry/household/get error", error);
    return res.status(500).json({ message: error?.message || "Failed to load household" });
  }
});

r.post("/household", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const body = z.object({ name: z.string().min(1) }).parse(req.body);
    const household = await storage.createHousehold(userId, body.name);
    const info = await storage.getHouseholdInfoForUser(userId);
    return res.status(201).json(info ? info : { household, members: [], userRole: "owner" });
  } catch (error: any) {
    console.error("pantry/household/create error", error);
    return res.status(400).json({ message: error?.message || "Failed to create household" });
  }
});

r.post("/household/join", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const body = z.object({ inviteCode: z.string().min(1) }).parse(req.body);
    await storage.joinHousehold(userId, body.inviteCode.trim().toUpperCase());
    const info = await storage.getHouseholdInfoForUser(userId);
    return res.json(info ? info : { household: null, members: [], userRole: null });
  } catch (error: any) {
    console.error("pantry/household/join error", error);
    return res.status(400).json({ message: error?.message || "Failed to join household" });
  }
});

r.post("/household/leave", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await storage.leaveHousehold(userId);
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("pantry/household/leave error", error);
    return res.status(400).json({ message: error?.message || "Failed to leave household" });
  }
});

// Bulk move personal pantry items into the household pantry.
// Returns duplicates so the UI can prompt the user to merge / keep both / discard.
r.post("/household/sync", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const result = await storage.syncPersonalPantryToHousehold(userId);
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("pantry/household/sync error", error);
    return res.status(400).json({ message: error?.message || "Failed to sync pantry" });
  }
});

r.post("/household/resolve-duplicates", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const body = z.object({
      decisions: z.array(
        z.object({
          incomingId: z.string().min(1),
          existingId: z.string().min(1),
          action: z.enum(["merge", "keepBoth", "discardIncoming"]),
        })
      ),
    }).parse(req.body);

    const result = await storage.resolveHouseholdDuplicates(userId, body.decisions);
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("pantry/household/resolve-duplicates error", error);
    return res.status(400).json({ message: error?.message || "Failed to resolve duplicates" });
  }
});


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
    res.json({ items }); // Wrap in object to match frontend expectations
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
      location: z.string().optional(),
      isRunningLow: z.boolean().optional(),
      householdId: z.string().nullable().optional(),
      expirationDate: z.string().datetime().optional(),
      notes: z.string().optional(),
      imageUrl: z.string().optional(),
    });

    const body = schema.parse(req.body);

    const membership = await storage.getUserHouseholdMembership(userId);

    // If client tries to create a household item, ensure the user is actually in that household.
    let householdId: string | null | undefined = body.householdId;
    if (householdId) {
      if (!membership || membership.householdId !== householdId) {
        return res.status(403).json({ message: "Not allowed to add items to that household" });
      }
    }

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
      location: body.location,
      isRunningLow: body.isRunningLow,
      householdId: householdId,
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
    res.json({ items }); // Wrap in object to match frontend expectations
  } catch (error) {
    console.error("pantry/expiring-soon error", error);
    res.status(500).json({ message: "Failed to fetch expiring items" });
  }
});

// Delete pantry item by ID


// Update pantry item (alias used by some front-end components)
r.put("/items/:itemId", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const schema = z.object({
      name: z.string().min(1).optional(),
      category: z.string().optional(),
      quantity: z.union([z.number(), z.string()]).optional(),
      unit: z.string().optional(),
      location: z.string().optional(),
      expirationDate: z.string().datetime().optional(),
      notes: z.string().optional(),
      isRunningLow: z.boolean().optional(),
      householdId: z.string().nullable().optional(),
    });
    const body = schema.parse(req.body);

    const membership = await storage.getUserHouseholdMembership(userId);
    let householdId: string | null | undefined = body.householdId;
    if (householdId) {
      if (!membership || membership.householdId !== householdId) {
        return res.status(403).json({ message: "Not allowed to move items to that household" });
      }
    }

    let quantityNum: number | undefined;
    if (body.quantity !== undefined) {
      quantityNum = typeof body.quantity === "string" ? parseFloat(body.quantity) : body.quantity;
      if (isNaN(quantityNum)) quantityNum = undefined;
    }

    const updated = await storage.updatePantryItem(req.params.itemId, {
      name: body.name,
      category: body.category,
      quantity: quantityNum,
      unit: body.unit,
      location: body.location,
      householdId: householdId,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
      notes: body.notes,
      isRunningLow: body.isRunningLow,
    });

    if (!updated) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item updated", item: updated });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid update", errors: error.issues });
    console.error("pantry/items/update error", error);
    res.status(500).json({ message: "Failed to update pantry item" });
  }
});

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
r.put("/pantry/:itemId", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      category: z.string().optional(),
      quantity: z.union([z.number(), z.string()]).optional(),
      unit: z.string().optional(),
      location: z.string().optional(),
      expirationDate: z.string().datetime().optional(),
      notes: z.string().optional(),
      isRunningLow: z.boolean().optional(),
      householdId: z.string().nullable().optional(),
    });
    const body = schema.parse(req.body);

    const membership = await storage.getUserHouseholdMembership(userId);

    // Only allow setting householdId to your own household (or null to make it personal)
    let householdId: string | null | undefined = body.householdId;
    if (householdId) {
      if (!membership || membership.householdId !== householdId) {
        return res.status(403).json({ message: "Not allowed to move items to that household" });
      }
    }

    // Convert quantity to number if it's a string
    let quantityNum: number | undefined;
    if (body.quantity !== undefined) {
      quantityNum = typeof body.quantity === 'string' ? parseFloat(body.quantity) : body.quantity;
      if (isNaN(quantityNum)) quantityNum = undefined;
    }

    const updated = await storage.updatePantryItem(req.params.itemId, {
      name: body.name,
      category: body.category,
      quantity: quantityNum,
      unit: body.unit,
      location: body.location,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
      notes: body.notes,
      isRunningLow: body.isRunningLow,
      householdId: householdId,
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
