// server/routes/nutrition.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

/**
 * POST /api/nutrition/users/:id/trial
 * Body: { days?: number }  (default 30)
 */
r.post("/users/:id/trial", async (req, res, next) => {
  try {
    const days = Number(req.body?.days ?? 30);
    const user = await storage.enableNutritionPremium(req.params.id, days);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Nutrition premium trial activated", user, trialEndsAt: (user as any).nutritionTrialEnd });
  } catch (e) { next(e); }
});

/**
 * PUT /api/nutrition/users/:id/goals
 * Body: { dailyCalorieGoal?, macroGoals?, dietaryRestrictions? }
 */
r.put("/users/:id/goals", async (req, res, next) => {
  try {
    const updated = await storage.updateNutritionGoals(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Nutrition goals updated", user: updated });
  } catch (e) { next(e); }
});

/**
 * POST /api/nutrition/log
 * Body: { userId, date, mealType, recipeId?, customFoodName?, servings, calories, protein?, carbs?, fat?, fiber?, imageUrl? }
 */
r.post("/log", async (req, res, next) => {
  try {
    const { userId, ...log } = req.body || {};
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const entry = await storage.logNutrition(String(userId), log);
    res.status(201).json({ message: "Nutrition logged successfully", log: entry });
  } catch (e) { next(e); }
});

/**
 * GET /api/nutrition/users/:id/daily/:date
 * :date format YYYY-MM-DD
 */
r.get("/users/:id/daily/:date", async (req, res, next) => {
  try {
    const date = new Date(req.params.date);
    if (isNaN(date.getTime())) return res.status(400).json({ message: "Invalid date format" });

    const summary = await storage.getDailyNutritionSummary(req.params.id, date);
    const user = await storage.getUser(req.params.id);

    res.json({
      date: req.params.date,
      summary,
      goals: user
        ? { dailyCalorieGoal: (user as any).dailyCalorieGoal, macroGoals: (user as any).macroGoals }
        : null,
      progress:
        user && (user as any).dailyCalorieGoal
          ? { calorieProgress: Math.round((Number(summary.totalCalories || 0) / Number((user as any).dailyCalorieGoal)) * 100) }
          : null,
    });
  } catch (e) { next(e); }
});

/**
 * GET /api/nutrition/users/:id/logs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
r.get("/users/:id/logs", async (req, res, next) => {
  try {
    const startDate = new Date(String(req.query.startDate || ""));
    const endDate   = new Date(String(req.query.endDate || ""));
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    const logs = await storage.getNutritionLogs(req.params.id, startDate, endDate);
    res.json({
      logs,
      dateRange: {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      },
      total: logs.length,
    });
  } catch (e) { next(e); }
});

export default r;
