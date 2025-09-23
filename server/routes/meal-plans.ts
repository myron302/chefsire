// server/routes/meal-plans.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

/**
 * POST /api/meal-plans
 * Body: { userId, name, startDate, endDate, isTemplate? }
 */
r.post("/", async (req, res, next) => {
  try {
    const { userId, name, startDate, endDate, isTemplate = false } = req.body || {};
    if (!userId || !name || !startDate || !endDate) {
      return res.status(400).json({ message: "userId, name, startDate, endDate are required" });
    }
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (!(s < e)) return res.status(400).json({ message: "End date must be after start date" });

    const plan = await storage.createMealPlan(String(userId), {
      name: String(name),
      startDate: s,
      endDate: e,
      isTemplate: Boolean(isTemplate),
    });
    res.status(201).json({ message: "Meal plan created successfully", mealPlan: plan });
  } catch (e) { next(e); }
});

/**
 * GET /api/meal-plans/:id
 */
r.get("/:id", async (req, res, next) => {
  try {
    const plan = await storage.getMealPlan(req.params.id);
    if (!plan) return res.status(404).json({ message: "Meal plan not found" });
    res.json(plan);
  } catch (e) { next(e); }
});

/**
 * GET /api/meal-plans/users/:id
 */
r.get("/users/:id", async (req, res, next) => {
  try {
    const items = await storage.getUserMealPlans(req.params.id);
    res.json({ mealPlans: items, total: items.length });
  } catch (e) { next(e); }
});

/**
 * POST /api/meal-plans/:id/entries
 * Body: { recipeId?, date, mealType, servings, customName?, customCalories? }
 */
r.post("/:id/entries", async (req, res, next) => {
  try {
    const { date, mealType, servings } = req.body || {};
    if (!date || !mealType || typeof servings !== "number") {
      return res.status(400).json({ message: "date, mealType, and numeric servings are required" });
    }
    const entry = await storage.addMealPlanEntry(req.params.id, {
      recipeId: req.body.recipeId,
      date: new Date(date),
      mealType: String(mealType),
      servings: Number(servings),
      customName: req.body.customName,
      customCalories: req.body.customCalories != null ? Number(req.body.customCalories) : undefined,
    });
    res.status(201).json({ message: "Meal plan entry added", entry });
  } catch (e) { next(e); }
});

export default r;
