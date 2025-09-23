// server/routes/meal-plans.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const r = Router();

/**
 * Expected storage methods:
 *  - createMealPlan(userId: string, data: { name: string; startDate: Date; endDate: Date; isTemplate?: boolean })
 *  - getMealPlan(planId: string)
 *  - getUserMealPlans(userId: string)
 *  - addMealPlanEntry(planId: string, entry: { recipeId?: string; date: Date; mealType: "breakfast"|"lunch"|"dinner"|"snack"; servings: number; customName?: string; customCalories?: number })
 */

/** POST /api/meal-plans */
r.post("/", async (req, res) => {
  try {
    const planSchema = z.object({
      userId: z.string(),
      name: z.string().min(1),
      startDate: z.string().transform((str) => new Date(str)),
      endDate: z.string().transform((str) => new Date(str)),
      isTemplate: z.boolean().default(false),
    });

    const planData = planSchema.parse(req.body);
    if (planData.startDate >= planData.endDate) {
      return res.status(400).json({ message: "End date must be after start date" });
    }

    const mealPlan = await storage.createMealPlan(planData.userId, planData);
    res.status(201).json({ message: "Meal plan created successfully", mealPlan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid meal plan data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create meal plan" });
  }
});

/** GET /api/meal-plans/:id */
r.get("/:id", async (req, res) => {
  try {
    const mealPlan = await storage.getMealPlan(req.params.id);
    if (!mealPlan) return res.status(404).json({ message: "Meal plan not found" });
    res.json(mealPlan);
  } catch {
    res.status(500).json({ message: "Failed to fetch meal plan" });
  }
});

/** GET /api/meal-plans/users/:id */
r.get("/users/:id", async (req, res) => {
  try {
    const mealPlans = await storage.getUserMealPlans(req.params.id);
    res.json({ mealPlans, total: mealPlans.length });
  } catch {
    res.status(500).json({ message: "Failed to fetch meal plans" });
  }
});

/** POST /api/meal-plans/:id/entries */
r.post("/:id/entries", async (req, res) => {
  try {
    const entrySchema = z.object({
      recipeId: z.string().optional(),
      date: z.string().transform((str) => new Date(str)),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      servings: z.number().min(0.1).max(20).default(1),
      customName: z.string().optional(),
      customCalories: z.number().min(0).optional(),
    });

    const entryData = entrySchema.parse(req.body);
    const entry = await storage.addMealPlanEntry(req.params.id, entryData);
    res.status(201).json({ message: "Meal plan entry added", entry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid entry data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to add meal plan entry" });
  }
});

export default r;
