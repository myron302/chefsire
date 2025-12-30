// server/routes/pantry.ts
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { storage } from "../storage";

/**
 * NOTE:
 * - Adds a PATCH /api/pantry/items/:id for partial updates (e.g., isRunningLow)
 * - Expiring-soon route uses a stable URL including the days parameter so React Query keys match
 */

export const r = Router();

// ---------- Schemas ----------
const CreateItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  location: z.string().optional(),
  expirationDate: z.string().nullable().optional(),
  notes: z.string().optional(),
  isRunningLow: z.boolean().optional(),
});

const UpdateItemSchema = CreateItemSchema.partial().extend({
  id: z.string().min(1),
});

const PatchItemSchema = z.object({
  isRunningLow: z.boolean().optional(),
  name: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  location: z.string().optional(),
  expirationDate: z.string().nullable().optional(),
  notes: z.string().optional(),
});

// ---------- Helpers ----------
function assertUser(req: any) {
  const userId = req.user?.id as string | undefined;
  if (!userId) throw new Error("NOT_AUTHENTICATED");
  return userId;
}

// ---------- Routes ----------

// Get all pantry items for current user
r.get("/items", requireAuth, async (req, res) => {
  try {
    const userId = assertUser(req);
    const items = await storage.pantry.listItems(userId);
    res.json(items);
  } catch (e: any) {
    if (e?.message === "NOT_AUTHENTICATED") return res.status(401).json({ message: "Not authenticated" });
    res.status(500).json({ message: "Failed to fetch items" });
  }
});

// Create item
r.post("/items", requireAuth, async (req, res) => {
  try {
    const userId = assertUser(req);
    const body = CreateItemSchema.parse(req.body);
    const created = await storage.pantry.createItem(userId, body);
    res.status(201).json(created);
  } catch (e: any) {
    const status = e?.name === "ZodError" ? 400 : 500;
    res.status(status).json({ message: "Failed to create item", details: e?.issues || e?.message });
  }
});

// Full update (PUT) - expects a safe subset from client; server will ignore unknowns
r.put("/items/:id", requireAuth, async (req, res) => {
  try {
    const userId = assertUser(req);
    const id = z.string().min(1).parse(req.params.id);
    const data = UpdateItemSchema.parse({ ...req.body, id });
    const updated = await storage.pantry.updateItem(userId, id, data);
    res.json(updated);
  } catch (e: any) {
    const status = e?.name === "ZodError" ? 400 : 500;
    res.status(status).json({ message: "Failed to update item", details: e?.issues || e?.message });
  }
});

// Partial update (PATCH) - lightweight toggles (e.g., isRunningLow)
r.patch("/items/:id", requireAuth, async (req, res) => {
  try {
    const userId = assertUser(req);
    const id = z.string().min(1).parse(req.params.id);
    const patch = PatchItemSchema.parse(req.body);
    const updated = await storage.pantry.patchItem(userId, id, patch);
    res.json(updated);
  } catch (e: any) {
    const status = e?.name === "ZodError" ? 400 : 500;
    res.status(status).json({ message: "Failed to patch item", details: e?.issues || e?.message });
  }
});

// Delete
r.delete("/items/:id", requireAuth, async (req, res) => {
  try {
    const userId = assertUser(req);
    const id = z.string().min(1).parse(req.params.id);
    await storage.pantry.deleteItem(userId, id);
    res.status(204).end();
  } catch (e: any) {
    const status = e?.name === "ZodError" ? 400 : 500;
    res.status(status).json({ message: "Failed to delete item" });
  }
});

// Expiring soon - stable query string so the client queryKey matches invalidations
r.get("/expiring-soon", requireAuth, async (req, res) => {
  try {
    const userId = assertUser(req);
    const days = z.coerce.number().int().min(1).max(60).default(7).parse(req.query.days);
    const items = await storage.pantry.getExpiringSoon(userId, days);
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: "Failed to load expiring items" });
  }
});

// Items marked running low
r.get("/running-low", requireAuth, async (req, res) => {
  try {
    const userId = assertUser(req);
    const items = await storage.pantry.getRunningLow(userId);
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: "Failed to load low items" });
  }
});

export default r;
