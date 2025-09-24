// server/routes/users.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const r = Router();

/**
 * Users & profile basics
 */
r.get("/users/:id", async (req, res) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (e) {
    console.error("users/:id error", e);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

r.get("/users/username/:username", async (req, res) => {
  try {
    const user = await storage.getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (e) {
    console.error("users/username error", e);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

r.post("/users", async (req, res) => {
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
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid user data", errors: e.issues });
    console.error("users/create error", e);
    res.status(500).json({ message: "Failed to create user" });
  }
});

r.get("/users/:id/suggested", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 5);
    const list = await storage.getSuggestedUsers(req.params.id, isNaN(limit) ? 5 : limit);
    res.json(list);
  } catch (e) {
    console.error("users/suggested error", e);
    res.status(500).json({ message: "Failed to fetch suggested users" });
  }
});

/**
 * Catering settings (per-user)
 */
r.post("/users/:id/catering/enable", async (req, res) => {
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
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid data", errors: e.issues });
    console.error("catering/enable error", e);
    res.status(500).json({ message: "Failed to enable catering" });
  }
});

r.post("/users/:id/catering/disable", async (req, res) => {
  try {
    const updated = await storage.disableCatering(req.params.id);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering disabled", user: updated });
  } catch (e) {
    console.error("catering/disable error", e);
    res.status(500).json({ message: "Failed to disable catering" });
  }
});

r.put("/users/:id/catering/settings", async (req, res) => {
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
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid data", errors: e.issues });
    console.error("catering/settings error", e);
    res.status(500).json({ message: "Failed to update catering settings" });
  }
});

r.get("/users/:id/catering/status", async (req, res) => {
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
  } catch (e) {
    console.error("catering/status error", e);
    res.status(500).json({ message: "Failed to fetch status" });
  }
});

/**
 * Subscription (simple example)
 */
r.put("/users/:id/subscription", async (req, res) => {
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
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid subscription data", errors: e.issues });
    console.error("subscription/update error", e);
    res.status(500).json({ message: "Failed to update subscription" });
  }
});

r.get("/users/:id/subscription/info", async (req, res) => {
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

    const mr = parseFloat((user as any).monthlyRevenue || "0");
    const rate = getCommissionRate((user as any).subscriptionTier || "free", mr);

    res.json({
      subscriptionTier: (user as any).subscriptionTier,
      subscriptionStatus: (user as any).subscriptionStatus,
      subscriptionEndsAt: (user as any).subscriptionEndsAt,
      monthlyRevenue: (user as any).monthlyRevenue,
      currentCommissionRate: rate,
      tierPricing: {
        starter: { price: 15, baseRate: 8 },
        professional: { price: 35, baseRate: 5 },
        enterprise: { price: 75, baseRate: 3 },
        premium_plus: { price: 150, baseRate: 1 },
      },
    });
  } catch (e) {
    console.error("subscription/info error", e);
    res.status(500).json({ message: "Failed to fetch subscription info" });
  }
});

/**
 * Nutrition (trial + goals + summaries)
 */
r.post("/users/:id/nutrition/trial", async (req, res) => {
  try {
    const updated = await storage.enableNutritionPremium(req.params.id, 30);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Nutrition trial activated", user: updated, trialEndsAt: (updated as any).nutritionTrialEnd });
  } catch (e) {
    console.error("nutrition/trial error", e);
    res.status(500).json({ message: "Failed to start nutrition trial" });
  }
});

r.put("/users/:id/nutrition/goals", async (req, res) => {
  try {
    const schema = z.object({
      dailyCalorieGoal: z.number().min(800).max(5000).optional(),
      macroGoals: z.object({ protein: z.number().min(0).max(100), carbs: z.number().min(0).max(100), fat: z.number().min(0).max(100) }).optional(),
      dietaryRestrictions: z.array(z.string()).optional(),
    });
    const goals = schema.parse(req.body);
    const updated = await storage.updateNutritionGoals(req.params.id, goals as any);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Nutrition goals updated", user: updated });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid goals data", errors: e.issues });
    console.error("nutrition/goals error", e);
    res.status(500).json({ message: "Failed to update goals" });
  }
});

r.get("/users/:id/nutrition/daily/:date", async (req, res) => {
  try {
    const d = new Date(req.params.date);
    if (isNaN(d.getTime())) return res.status(400).json({ message: "Invalid date" });
    const summary = await storage.getDailyNutritionSummary(req.params.id, d);
    const user = await storage.getUser(req.params.id);

    res.json({
      date: req.params.date,
      summary,
      goals: user ? { dailyCalorieGoal: (user as any).dailyCalorieGoal, macroGoals: (user as any).macroGoals } : null,
      progress: (user as any)?.dailyCalorieGoal
        ? { calorieProgress: Math.round(((summary as any).totalCalories / (user as any).dailyCalorieGoal) * 100) }
        : null,
    });
  } catch (e) {
    console.error("nutrition/daily error", e);
    res.status(500).json({ message: "Failed to fetch daily nutrition" });
  }
});

r.get("/users/:id/nutrition/logs", async (req, res) => {
  try {
    const start = new Date(String(req.query.startDate));
    const end = new Date(String(req.query.endDate));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    const logs = await storage.getNutritionLogs(req.params.id, start, end);
    res.json({
      logs,
      dateRange: { startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] },
      total: logs.length,
    });
  } catch (e) {
    console.error("nutrition/logs error", e);
    res.status(500).json({ message: "Failed to fetch logs" });
  }
});

export default r;
