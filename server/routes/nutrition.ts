// server/routes/nutrition.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const r = Router();

/**
 * Canonical routes under /api/nutrition/*
 * Plus back-compat routes that mimic the old /api/users/:id/nutrition/* paths.
 *
 * Storage methods expected:
 *  - enableNutritionPremium(userId: string, trialDays: number)
 *  - updateNutritionGoals(userId: string, goals: { dailyCalorieGoal?: number; macroGoals?: { protein:number; carbs:number; fat:number }; dietaryRestrictions?: string[] })
 *  - logNutrition(userId: string, data: {...})
 *  - getDailyNutritionSummary(userId: string, date: Date)
 *  - getNutritionLogs(userId: string, start: Date, end: Date)
 *  - getUser(userId: string)
 */

// ---------- Canonical routes ----------

/** POST /api/nutrition/users/:id/trial  */
r.post("/users/:id/trial", async (req, res) => {
  try {
    const updatedUser = await storage.enableNutritionPremium(req.params.id, 30);
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    res.json({
      message: "Nutrition premium trial activated",
      user: updatedUser,
      trialEndsAt: (updatedUser as any).nutritionTrialEndsAt,
    });
  } catch {
    res.status(500).json({ message: "Failed to start nutrition trial" });
  }
});

/** PUT /api/nutrition/users/:id/goals */
r.put("/users/:id/goals", async (req, res) => {
  try {
    const goalsSchema = z.object({
      dailyCalorieGoal: z.number().min(800).max(5000).optional(),
      macroGoals: z
        .object({
          protein: z.number().min(0).max(100),
          carbs: z.number().min(0).max(100),
          fat: z.number().min(0).max(100),
        })
        .optional(),
      dietaryRestrictions: z.array(z.string()).optional(),
    });
    const goals = goalsSchema.parse(req.body);

    const updatedUser = await storage.updateNutritionGoals(req.params.id, goals);
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Nutrition goals updated", user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid goals data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update nutrition goals" });
  }
});

/** POST /api/nutrition/log */
r.post("/log", async (req, res) => {
  try {
    const logSchema = z.object({
      userId: z.string(),
      date: z.string().transform((str) => new Date(str)),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      recipeId: z.string().optional(),
      customFoodName: z.string().optional(),
      servings: z.number().min(0.1).max(20).default(1),
      calories: z.number().min(0),
      protein: z.number().min(0).optional(),
      carbs: z.number().min(0).optional(),
      fat: z.number().min(0).optional(),
      fiber: z.number().min(0).optional(),
      imageUrl: z.string().url().optional(),
    });
    const logData = logSchema.parse(req.body);

    const nutritionLog = await storage.logNutrition(logData.userId, logData);
    res.status(201).json({ message: "Nutrition logged successfully", log: nutritionLog });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid nutrition data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to log nutrition" });
  }
});

/** GET /api/nutrition/users/:id/daily/:date */
r.get("/users/:id/daily/:date", async (req, res) => {
  try {
    const date = new Date(req.params.date);
    if (isNaN(date.getTime())) return res.status(400).json({ message: "Invalid date format" });

    const summary = await storage.getDailyNutritionSummary(req.params.id, date);
    const user = await storage.getUser(req.params.id);

    const response = {
      date: req.params.date,
      summary,
      goals: user
        ? {
            dailyCalorieGoal: (user as any).dailyCalorieGoal,
            macroGoals: (user as any).macroGoals,
          }
        : null,
      progress: (user as any)?.dailyCalorieGoal
        ? {
            calorieProgress: Math.round((summary.totalCalories / (user as any).dailyCalorieGoal) * 100),
          }
        : null,
    };

    res.json(response);
  } catch {
    res.status(500).json({ message: "Failed to fetch daily nutrition" });
  }
});

/** GET /api/nutrition/users/:id/logs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD */
r.get("/users/:id/logs", async (req, res) => {
  try {
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
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
  } catch {
    res.status(500).json({ message: "Failed to fetch nutrition logs" });
  }
});

// ---------- Back-compat aliases (old paths) ----------
r.post("/users/:id/trial", async (req, res, next) => next()); // handled above
r.put("/users/:id/goals", async (req, res, next) => next()); // same handler path
r.get("/users/:id/daily/:date", async (req, res, next) => next());
r.get("/users/:id/logs", async (req, res, next) => next());

export default r;
