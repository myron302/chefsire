// server/routes/users.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  insertUserSchema,
} from "../../shared/schema";

const r = Router();

/** -------------------------
 * Users (core)
 * -------------------------- */
r.get("/:id", async (req, res) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

r.get("/username/:username", async (req, res) => {
  try {
    const user = await storage.getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

r.post("/", async (req, res) => {
  try {
    const userData = insertUserSchema.parse(req.body);
    const user = await storage.createUser(userData);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid user data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create user" });
  }
});

r.get("/:id/suggested", async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || "5", 10);
    const users = await storage.getSuggestedUsers(req.params.id, limit);
    res.json(users);
  } catch {
    res.status(500).json({ message: "Failed to fetch suggested users" });
  }
});

/** -------------------------
 * Catering (enable/disable/settings/status)
 * -------------------------- */
r.post("/:id/catering/enable", async (req, res) => {
  try {
    const enableCateringSchema = z.object({
      location: z.string().min(5, "Postal code required"),
      radius: z.number().min(5).max(100),
      bio: z.string().optional(),
    });
    const { location, radius, bio } = enableCateringSchema.parse(req.body);

    const updatedUser = await storage.enableCatering(req.params.id, location, radius, bio);
    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json({
      message: "Catering enabled successfully",
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to enable catering" });
  }
});

r.post("/:id/catering/disable", async (req, res) => {
  try {
    const updatedUser = await storage.disableCatering(req.params.id);
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering disabled successfully", user: updatedUser });
  } catch {
    res.status(500).json({ message: "Failed to disable catering" });
  }
});

r.put("/:id/catering/settings", async (req, res) => {
  try {
    const updateSchema = z.object({
      location: z.string().min(5).optional(),
      radius: z.number().min(5).max(100).optional(),
      bio: z.string().optional(),
      available: z.boolean().optional(),
    });
    const settings = updateSchema.parse(req.body);

    const updatedUser = await storage.updateCateringSettings(req.params.id, settings);
    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Catering settings updated", user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update catering settings" });
  }
});

r.get("/:id/catering/status", async (req, res) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      cateringEnabled: user.cateringEnabled || false,
      cateringAvailable: user.cateringAvailable || false,
      cateringLocation: user.cateringLocation,
      cateringRadius: user.cateringRadius,
      cateringBio: user.cateringBio,
      isChef: user.isChef,
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch catering status" });
  }
});

/** -------------------------
 * Catering inquiries
 * -------------------------- */
r.post("/catering/inquiries", async (req, res) => {
  try {
    const inquirySchema = z.object({
      customerId: z.string(),
      chefId: z.string(),
      eventDate: z.string().transform((str) => new Date(str)),
      guestCount: z.number().min(1).optional(),
      eventType: z.string().optional(),
      cuisinePreferences: z.array(z.string()).default([]),
      budget: z.string().optional(),
      message: z.string().min(10),
    });

    const inquiryData = inquirySchema.parse(req.body);
    const inquiry = await storage.createCateringInquiry(inquiryData);

    res.status(201).json({ message: "Catering inquiry sent successfully", inquiry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid inquiry data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create catering inquiry" });
  }
});

r.get("/:id/catering/inquiries", async (req, res) => {
  try {
    const inquiries = await storage.getCateringInquiries(req.params.id);
    res.json({ inquiries, total: inquiries.length });
  } catch {
    res.status(500).json({ message: "Failed to fetch catering inquiries" });
  }
});

r.put("/catering/inquiries/:id", async (req, res) => {
  try {
    const updateSchema = z.object({
      status: z.enum(["pending", "accepted", "declined", "completed"]).optional(),
      message: z.string().optional(),
    });
    const updates = updateSchema.parse(req.body);

    const inquiry = await storage.updateCateringInquiry(req.params.id, updates);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

    res.json({ message: "Inquiry updated successfully", inquiry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid update data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update inquiry" });
  }
});

/** -------------------------
 * Subscriptions
 * -------------------------- */
r.put("/:id/subscription", async (req, res) => {
  try {
    const subscriptionSchema = z.object({
      tier: z.enum(["free", "starter", "professional", "enterprise", "premium_plus"]),
      paymentMethod: z.string().optional(),
    });
    const { tier } = subscriptionSchema.parse(req.body);

    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 30);

    const updatedUser = await storage.updateUser(req.params.id, {
      subscriptionTier: tier,
      subscriptionStatus: "active",
      subscriptionEndsAt,
    });

    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Subscription updated successfully", user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid subscription data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update subscription" });
  }
});

r.get("/:id/subscription/info", async (req, res) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const getCommissionRate = (tier: string, monthlyRevenue: number) => {
      const rates = {
        free: { base: 10, thresholds: [] as { amount: number; rate: number }[] },
        starter: { base: 8, thresholds: [{ amount: 1000, rate: 7 }, { amount: 2500, rate: 6 }] },
        professional: { base: 5, thresholds: [{ amount: 2500, rate: 4 }, { amount: 5000, rate: 3 }] },
        enterprise: { base: 3, thresholds: [{ amount: 5000, rate: 2.5 }, { amount: 10000, rate: 2 }] },
        premium_plus: { base: 1, thresholds: [{ amount: 10000, rate: 0.5 }] },
      } as const;

      const tierRates = (rates as any)[tier] || rates.free;
      for (const t of [...tierRates.thresholds].reverse()) {
        if (monthlyRevenue >= t.amount) return t.rate;
      }
      return tierRates.base;
    };

    const currentRate = getCommissionRate(user.subscriptionTier || "free", parseFloat(user.monthlyRevenue || "0"));

    res.json({
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEndsAt: user.subscriptionEndsAt,
      monthlyRevenue: user.monthlyRevenue,
      currentCommissionRate: currentRate,
      tierPricing: {
        starter: { price: 15, baseRate: 8 },
        professional: { price: 35, baseRate: 5 },
        enterprise: { price: 75, baseRate: 3 },
        premium_plus: { price: 150, baseRate: 1 },
      },
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch subscription info" });
  }
});

export default r;
