// server/routes/users.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const r = Router();

/**
 * NOTE: This router is intended to be mounted like:
 *   routes.use("/users", usersRouter)
 * That means every route here should be RELATIVE, e.g. "/:id" not "/users/:id".
 *
 * Final URLs will look like:
 *   GET  /api/users/:id
 *   GET  /api/users/username/:username
 *   POST /api/users
 *   ...
 */

/* ------------------------------------------------------------------ */
/* Users & profile basics                                              */
/* ------------------------------------------------------------------ */
r.get("/:id", async (req, res) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("GET /users/:id error", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

r.get("/username/:username", async (req, res) => {
  try {
    const user = await storage.getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("GET /users/username/:username error", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

r.post("/", async (req, res) => {
  try {
    const schema = z.object({
      id: z.string().optional(),
      username: z.string(),
      email: z.string().email(),
      password: z.string(),
      displayName: z.string().optional(),
      bio: z.string().optional(),
      avatar: z.string().url().optional(),
      specialty: z.string().optional(),
      isChef: z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    const created = await storage.createUser(body as any);
    res.status(201).json(created);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ message: "Invalid user data", errors: error.issues });
    }
    console.error("POST /users error", error);
    res.status(500).json({ message: "Failed to create user" });
  }
});

r.get("/:id/suggested", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 5);
    const list = await storage.getSuggestedUsers(req.params.id, isNaN(limit) ? 5 : limit);
    res.json(list);
  } catch (error) {
    console.error("GET /users/:id/suggested error", error);
    res.status(500).json({ message: "Failed to fetch suggested users" });
  }
});

/* ------------------------------------------------------------------ */
/* Catering settings (per-user)                                        */
/* ------------------------------------------------------------------ */
r.post("/:id/catering/enable", async (req, res) => {
  try {
    const schema = z.object({
      location: z.string().min(3, "Postal/area required"),
      radius: z.number().min(5).max(100),
      bio: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const updated = await storage.enableCatering(req.params.id, body.location, body.radius, body.bio);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering enabled", user: updated });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid data", errors: error.issues });
    console.error("POST /users/:id/catering/enable error", error);
    res.status(500).json({ message: "Failed to enable catering" });
  }
});

r.post("/:id/catering/disable", async (req, res) => {
  try {
    const updated = await storage.disableCatering(req.params.id);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering disabled", user: updated });
  } catch (error) {
    console.error("POST /users/:id/catering/disable error", error);
    res.status(500).json({ message: "Failed to disable catering" });
  }
});

r.put("/:id/catering/settings", async (req, res) => {
  try {
    const schema = z.object({
      location: z.string().min(3).optional(),
      radius: z.number().min(5).max(100).optional(),
      bio: z.string().optional(),
      available: z.boolean().optional(),
    });
    const settings = schema.parse(req.body);
    const updated = await storage.updateCateringSettings(req.params.id, settings);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering settings updated", user: updated });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid data", errors: error.issues });
    console.error("PUT /users/:id/catering/settings error", error);
    res.status(500).json({ message: "Failed to update catering settings" });
  }
});

r.get("/:id/catering/status", async (req, res) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      cateringEnabled: (user as any).cateringEnabled || false,
      cateringAvailable: (user as any).cateringAvailable || false,
      cateringLocation: (user as any).cateringLocation,
      cateringRadius: (user as any).cateringRadius,
      cateringBio: (user as any).cateringBio,
      isChef: (user as any).isChef,
    });
  } catch (error) {
    console.error("GET /users/:id/catering/status error", error);
    res.status(500).json({ message: "Failed to fetch status" });
  }
});

/* ------------------------------------------------------------------ */
/* Subscription (simple example)                                      */
/* ------------------------------------------------------------------ */
r.put("/:id/subscription", async (req, res) => {
  try {
    const schema = z.object({
      tier: z.enum(["free", "starter", "professional", "enterprise", "premium_plus"]),
      paymentMethod: z.string().optional(),
    });
    const { tier } = schema.parse(req.body);
    const ends = new Date();
    ends.setDate(ends.getDate() + 30);
    const updated = await storage.updateUser(req.params.id, {
      subscriptionTier: tier as any,
      subscriptionStatus: "active" as any,
      subscriptionEndsAt: ends as any,
    } as any);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Subscription updated", user: updated });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ message: "Invalid subscription data", errors: error.issues });
    console.error("PUT /users/:id/subscription error", error);
    res.status(500).json({ message: "Failed to update subscription" });
  }
});

r.get("/:id/subscription/info", async (req, res) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const getCommissionRate = (tier: string, monthlyRevenue: number) => {
      const tiers = {
        free: { base: 10, thresholds: [] as { amount: number; rate: number }[] },
        starter: { base: 8, thresholds: [{ amount: 1000, rate: 7 }, { amount: 2500, rate: 6 }] },
        professional: { base: 5, thresholds: [{ amount: 2500, rate: 4 }, { amount: 5000, rate: 3 }] },
        enterprise: { base: 3, thresholds: [{ amount: 5000, rate: 2.5 }, { amount: 10000, rate: 2 }] },
        premium_plus: { base: 1, thresholds: [{ amount: 10000, rate: 0.5 }] },
      } as const;
      const t = (tiers as any)[tier] || tiers.free;
      for (const th of [...t.thresholds].reverse()) if (monthlyRevenue >= th.amount) return th.rate;
      return t.base;
    };

    const mr = parseFloa
