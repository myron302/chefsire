// server/routes/pantry.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

/**
 * GET /api/pantry/users/:id
 */
r.get("/users/:id", async (req, res, next) => {
  try {
    const items = await storage.getPantryItems(req.params.id);
    res.json({ pantryItems: items, total: items.length });
  } catch (e) { next(e); }
});

/**
 * POST /api/pantry/users/:id
 * Body: { name, category?, quantity?, unit?, expirationDate?, notes? }
 */
r.post("/users/:id", async (req, res, next) => {
  try {
    if (!req.body?.name) return res.status(400).json({ message: "name is required" });
    const item = await storage.addPantryItem(req.params.id, req.body);
    res.status(201).json({ message: "Pantry item added", item });
  } catch (e) { next(e); }
});

/**
 * PUT /api/pantry/:itemId
 */
r.put("/:itemId", async (req, res, next) => {
  try {
    const updated = await storage.updatePantryItem(req.params.itemId, req.body || {});
    if (!updated) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item updated", item: updated });
  } catch (e) { next(e); }
});

/**
 * DELETE /api/pantry/:itemId
 */
r.delete("/:itemId", async (req, res, next) => {
  try {
    const ok = await storage.deletePantryItem(req.params.itemId);
    if (!ok) return res.status(404).json({ message: "Pantry item not found" });
    res.json({ message: "Pantry item deleted" });
  } catch (e) { next(e); }
});

/**
 * GET /api/pantry/users/:id/expiring?days=7
 */
r.get("/users/:id/expiring", async (req, res, next) => {
  try {
    const days = Number(req.query.days ?? 7);
    const items = await storage.getExpiringItems(req.params.id, days);
    res.json({ expiringItems: items, daysAhead: days, total: items.length });
  } catch (e) { next(e); }
});

/**
 * GET /api/pantry/users/:id/recipe-suggestions
 * Query: requireAllIngredients, maxMissingIngredients, includeExpiringSoon, limit
 */
r.get("/users/:id/recipe-suggestions", async (req, res, next) => {
  try {
    const options = {
      requireAllIngredients: String(req.query.requireAllIngredients ?? "false") === "true",
      maxMissingIngredients: Number(req.query.maxMissingIngredients ?? 3),
      includeExpiringSoon:   String(req.query.includeExpiringSoon ?? "true") === "true",
      limit:                 Number(req.query.limit ?? 20),
    };
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
  } catch (e) { next(e); }
});

export default r;
