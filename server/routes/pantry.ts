// server/routes/pantry.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const r = Router();

/**
 * App-level pantry for the **current user**.
 * If you want real auth, replace the mock and read user id from auth middleware.
 */
const authenticateUser = (req: any, _res: any, next: any) => {
  // TODO: replace with real auth; keeping for back-compat
  req.user = req.user ?? { id: "user-123" };
  next();
};

r.get("/", authenticateUser, async (req, res) => {
  try {
    const items = await storage.getPantryItems(req.user.id);
    res.json(items);
  } catch (e) {
    console.error("[pantry] list error:", e);
    res.status(500).json({ error: "Failed to fetch pantry items" });
  }
});

r.post("/", authenticateUser, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      quantity: z.number().min(0).optional(),
      unit: z.string().optional(),
      expirationDate: z.string().transform((s) => new Date(s)).optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const item = await storage.addPantryItem(req.user.id, data);
    res.status(201).json(item);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid item data", errors: e.errors });
    }
    console.error("[pantry] create error:", e);
    res.status(500).json({ error: "Failed to add pantry item" });
  }
});

r.put("/:itemId", authenticateUser, async (req, res) => {
  try {
    const schema = z.object({
      quantity: z.number().min(0).optional(),
      expirationDate: z.string().transform((s) => new Date(s)).optional(),
      notes: z.string().optional(),
    });
    const updates = schema.parse(req.body);

    const item = await storage.updatePantryItem(req.params.itemId, updates);
    if (!item) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item updated", item });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid update data", errors: e.errors });
    }
    console.error("[pantry] update error:", e);
    res.status(500).json({ message: "Failed to update pantry item" });
  }
});

r.delete("/:itemId", authenticateUser, async (req, res) => {
  try {
    const success = await storage.deletePantryItem(req.params.itemId);
    if (!success) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item deleted" });
  } catch (e) {
    console.error("[pantry] delete error:", e);
    res.status(500).json({ message: "Failed to delete pantry item" });
  }
});

r.get("/recipe-suggestions", authenticateUser, async (req, res) => {
  try {
    const schema = z.object({
      requireAll: z.string().optional(),
      maxMissing: z.string().optional(),
      includeExpiring: z.string().optional(),
      limit: z.string().optional(),
    });

    const parsed = schema.parse(req.query);
    const requireAllIngredients = parsed.requireAll === "true";
    const maxMissingIngredients = parsed.maxMissing ? parseInt(parsed.maxMissing) : 3;
    const includeExpiringSoon = parsed.includeExpiring !== "false";
    const limit = parsed.limit ? parseInt(parsed.limit) : 20;

    const suggestions = await storage.getRecipesFromPantryItems(req.user.id, {
      requireAllIngredients,
      maxMissingIngredients,
      includeExpiringSoon,
      limit,
    });

    res.json(suggestions);
  } catch (e) {
    console.error("[pantry] suggestions error:", e);
    res.status(500).json({ error: "Failed to fetch recipe suggestions" });
  }
});

/**
 * Also support user-scoped pantry endpoints by id (back-compat with your old routes)
 */
r.get("/user/:id", async (req, res) => {
  try {
    const items = await storage.getPantryItems(req.params.id);
    res.json({ pantryItems: items, total: items.length });
  } catch (e) {
    console.error("[pantry] user list error:", e);
    res.status(500).json({ message: "Failed to fetch pantry items" });
  }
});

r.post("/user/:id", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      quantity: z.number().min(0).optional(),
      unit: z.string().optional(),
      expirationDate: z.string().transform((s) => new Date(s)).optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const item = await storage.addPantryItem(req.params.id, data);
    res.status(201).json({ message: "Pantry item added", item });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid item data", errors: e.errors });
    }
    console.error("[pantry] user create error:", e);
    res.status(500).json({ message: "Failed to add pantry item" });
  }
});

r.get("/user/:id/expiring", async (req, res) => {
  try {
    const daysAhead = parseInt((req.query.days as string) || "7", 10);
    const expiringItems = await storage.getExpiringItems(req.params.id, daysAhead);
    res.json({ expiringItems, daysAhead, total: expiringItems.length });
  } catch (e) {
    console.error("[pantry] expiring error:", e);
    res.status(500).json({ message: "Failed to fetch expiring items" });
  }
});

r.get("/user/:id/recipe-suggestions", async (req, res) => {
  try {
    const schema = z.object({
      requireAllIngredients: z.coerce.boolean().default(false),
      maxMissingIngredients: z.coerce.number().min(0).max(10).default(3),
      includeExpiringSoon: z.coerce.boolean().default(true),
      limit: z.coerce.number().min(1).max(50).default(20),
    });
    const options = schema.parse(req.query);

    const suggestions = await storage.getRecipesFromPantryItems(req.params.id, options);
    res.json({
      suggestions,
      options,
      total: suggestions.length,
      message:
        suggestions.length === 0
          ? "No recipes found. Try adding more ingredients to your pantry."
          : undefined,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid parameters", errors: e.errors });
    }
    console.error("[pantry] user suggestions error:", e);
    res.status(500).json({ message: "Failed to get recipe suggestions" });
  }
});

export default r;
