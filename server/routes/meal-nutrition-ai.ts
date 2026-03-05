// server/routes/meal-nutrition-ai.ts
import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { requireAuth } from "../middleware";

const router = Router();

// ── Debug route — visit /api/meal-planner/ai/debug-status ────────────────────
// Use this to confirm the key is loaded in production Plesk environment
router.get("/ai/debug-status", (_req: Request, res: Response) => {
  const key = process.env.OPENAI_API_KEY;
  res.json({
    hasKey: !!key,
    keyPrefix: key ? key.substring(0, 7) + "..." : "not set",
    nodeEnv: process.env.NODE_ENV || "not set",
    cwd: process.cwd(),
    timestamp: new Date().toISOString(),
  });
});

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim() === "") {
    console.warn("[meal-nutrition-ai] OPENAI_API_KEY is missing — using fallback data");
    return null;
  }
  return new OpenAI({ apiKey: key.trim() });
}

// POST /api/meal-planner/ai/nutrition-lookup
router.post("/ai/nutrition-lookup", requireAuth, async (req: Request, res: Response) => {
  const { mealName, servingSize } = req.body as { mealName?: string; servingSize?: string };

  if (!mealName || mealName.trim().length < 2) {
    return res.status(400).json({ error: "mealName is required" });
  }

  const client = getOpenAI();

  if (!client) {
    const fallback = buildFallbackNutrition(mealName);
    console.log(`[meal-nutrition-ai] fallback for "${mealName}":`, JSON.stringify(fallback));
    return res.json(fallback);
  }

  const serving = servingSize || "1 standard serving";
  const prompt = `Estimate nutritional information for: "${mealName.trim()}" (${serving}).
Return ONLY a JSON object, no markdown, no extra text:
{"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"servingSize":string}`;

  try {
    console.log(`[meal-nutrition-ai] OpenAI lookup for: "${mealName}"`);
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 200,
      messages: [
        { role: "system", content: "You are a nutrition database. Return only valid JSON, no prose, no markdown fences." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
    console.log(`[meal-nutrition-ai] raw response: ${raw}`);
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const nutrition = {
      calories: Math.round(Number(parsed.calories) || 0),
      protein: Math.round(Number(parsed.protein) || 0),
      carbs: Math.round(Number(parsed.carbs) || 0),
      fat: Math.round(Number(parsed.fat) || 0),
      fiber: Math.round(Number(parsed.fiber) || 0),
      sugar: Math.round(Number(parsed.sugar) || 0),
      servingSize: String(parsed.servingSize || serving),
    };

    console.log(`[meal-nutrition-ai] sending nutrition:`, JSON.stringify(nutrition));
    return res.json(nutrition);
  } catch (err: any) {
    console.error("[meal-nutrition-ai] OpenAI error:", err?.message || String(err));
    return res.json(buildFallbackNutrition(mealName));
  }
});

// POST /api/meal-planner/ai/recipe-suggestions
router.post("/ai/recipe-suggestions", requireAuth, async (req: Request, res: Response) => {
  const { mealType, calorieGoal, dietaryPreferences, count = 4 } = req.body as {
    mealType?: string; calorieGoal?: number; dietaryPreferences?: string[]; count?: number;
  };

  const client = getOpenAI();
  if (!client) return res.json({ recipes: buildFallbackRecipes(mealType) });

  const preferences = dietaryPreferences?.length ? dietaryPreferences.join(", ") : "none";
  const calTarget = calorieGoal ? `around ${calorieGoal} calories per day` : "balanced";
  const mealLabel = mealType || "any meal";

  const prompt = `Generate ${count} recipe suggestions for ${mealLabel}. Dietary restrictions: ${preferences}. Calorie goal: ${calTarget}.
Return ONLY a JSON array, no markdown:
[{"name":string,"description":string,"calories":number,"protein":number,"carbs":number,"fat":number,"prepTime":string,"difficulty":"Easy"|"Medium"|"Hard","tags":string[]}]`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 900,
      messages: [
        { role: "system", content: "You are a culinary AI. Return only valid JSON arrays, no markdown." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "[]";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return res.json({ recipes: buildFallbackRecipes(mealType) });

    const recipes = parsed.slice(0, count).map((r: any) => ({
      name: String(r.name || "Unnamed"),
      description: String(r.description || ""),
      calories: Math.round(Number(r.calories) || 400),
      protein: Math.round(Number(r.protein) || 25),
      carbs: Math.round(Number(r.carbs) || 40),
      fat: Math.round(Number(r.fat) || 15),
      prepTime: String(r.prepTime || "30 min"),
      difficulty: ["Easy", "Medium", "Hard"].includes(r.difficulty) ? r.difficulty : "Medium",
      tags: Array.isArray(r.tags) ? r.tags.slice(0, 3) : [],
    }));

    return res.json({ recipes });
  } catch (err: any) {
    console.error("[meal-nutrition-ai] recipe error:", err?.message || String(err));
    return res.json({ recipes: buildFallbackRecipes(mealType) });
  }
});

// ── Fallback helpers ──────────────────────────────────────────────────────────

const FOOD_DB: Record<string, { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; servingSize: string }> = {
  egg:       { calories: 78,  protein: 6,  carbs: 1,  fat: 5,  fiber: 0, sugar: 0, servingSize: "1 egg" },
  eggs:      { calories: 156, protein: 12, carbs: 1,  fat: 10, fiber: 0, sugar: 0, servingSize: "2 eggs" },
  bacon:     { calories: 161, protein: 12, carbs: 0,  fat: 12, fiber: 0, sugar: 0, servingSize: "3 strips" },
  toast:     { calories: 79,  protein: 3,  carbs: 15, fat: 1,  fiber: 1, sugar: 1, servingSize: "1 slice" },
  bread:     { calories: 79,  protein: 3,  carbs: 15, fat: 1,  fiber: 1, sugar: 1, servingSize: "1 slice" },
  oatmeal:   { calories: 158, protein: 5,  carbs: 27, fat: 3,  fiber: 4, sugar: 1, servingSize: "1 cup" },
  pancakes:  { calories: 350, protein: 9,  carbs: 56, fat: 10, fiber: 2, sugar: 8, servingSize: "3 pancakes" },
  waffles:   { calories: 310, protein: 8,  carbs: 45, fat: 12, fiber: 1, sugar: 6, servingSize: "2 waffles" },
  yogurt:    { calories: 150, protein: 17, carbs: 9,  fat: 4,  fiber: 0, sugar: 7, servingSize: "1 cup" },
  banana:    { calories: 89,  protein: 1,  carbs: 23, fat: 0,  fiber: 3, sugar: 12, servingSize: "1 medium" },
  apple:     { calories: 72,  protein: 0,  carbs: 19, fat: 0,  fiber: 3, sugar: 14, servingSize: "1 medium" },
  orange:    { calories: 62,  protein: 1,  carbs: 15, fat: 0,  fiber: 3, sugar: 12, servingSize: "1 medium" },
  avocado:   { calories: 160, protein: 2,  carbs: 9,  fat: 15, fiber: 7, sugar: 1,  servingSize: "1/2 avocado" },
  chicken:   { calories: 335, protein: 38, carbs: 0,  fat: 19, fiber: 0, sugar: 0,  servingSize: "1 breast" },
  salmon:    { calories: 367, protein: 39, carbs: 0,  fat: 22, fiber: 0, sugar: 0,  servingSize: "1 fillet" },
  beef:      { calories: 350, protein: 30, carbs: 0,  fat: 24, fiber: 0, sugar: 0,  servingSize: "4 oz" },
  steak:     { calories: 420, protein: 38, carbs: 0,  fat: 28, fiber: 0, sugar: 0,  servingSize: "6 oz" },
  rice:      { calories: 206, protein: 4,  carbs: 45, fat: 0,  fiber: 1, sugar: 0,  servingSize: "1 cup cooked" },
  pasta:     { calories: 220, protein: 8,  carbs: 43, fat: 1,  fiber: 3, sugar: 1,  servingSize: "1 cup cooked" },
  salad:     { calories: 150, protein: 5,  carbs: 12, fat: 8,  fiber: 4, sugar: 3,  servingSize: "1 bowl" },
  burger:    { calories: 540, protein: 27, carbs: 40, fat: 28, fiber: 2, sugar: 8,  servingSize: "1 burger" },
  sandwich:  { calories: 350, protein: 18, carbs: 40, fat: 12, fiber: 3, sugar: 4,  servingSize: "1 sandwich" },
  pizza:     { calories: 570, protein: 23, carbs: 68, fat: 21, fiber: 3, sugar: 6,  servingSize: "2 slices" },
  soup:      { calories: 180, protein: 8,  carbs: 22, fat: 6,  fiber: 4, sugar: 3,  servingSize: "1.5 cups" },
  tuna:      { calories: 290, protein: 40, carbs: 0,  fat: 13, fiber: 0, sugar: 0,  servingSize: "1 can" },
  shrimp:    { calories: 200, protein: 38, carbs: 3,  fat: 3,  fiber: 0, sugar: 0,  servingSize: "4 oz" },
  broccoli:  { calories: 55,  protein: 4,  carbs: 11, fat: 0,  fiber: 5, sugar: 3,  servingSize: "1 cup" },
  spinach:   { calories: 41,  protein: 5,  carbs: 7,  fat: 0,  fiber: 4, sugar: 1,  servingSize: "1 cup" },
  potato:    { calories: 130, protein: 3,  carbs: 30, fat: 0,  fiber: 3, sugar: 1,  servingSize: "1 medium" },
  milk:      { calories: 149, protein: 8,  carbs: 12, fat: 8,  fiber: 0, sugar: 12, servingSize: "1 cup" },
  cheese:    { calories: 113, protein: 7,  carbs: 0,  fat: 9,  fiber: 0, sugar: 0,  servingSize: "1 oz" },
  almonds:   { calories: 164, protein: 6,  carbs: 6,  fat: 14, fiber: 3, sugar: 1,  servingSize: "1 oz" },
  coffee:    { calories: 5,   protein: 0,  carbs: 1,  fat: 0,  fiber: 0, sugar: 0,  servingSize: "1 cup" },
  juice:     { calories: 112, protein: 1,  carbs: 26, fat: 0,  fiber: 0, sugar: 22, servingSize: "1 cup" },
  sausage:   { calories: 290, protein: 17, carbs: 1,  fat: 24, fiber: 0, sugar: 0,  servingSize: "2 links" },
  ham:       { calories: 130, protein: 17, carbs: 2,  fat: 6,  fiber: 0, sugar: 1,  servingSize: "3 oz" },
  turkey:    { calories: 220, protein: 30, carbs: 0,  fat: 11, fiber: 0, sugar: 0,  servingSize: "4 oz" },
  quinoa:    { calories: 222, protein: 8,  carbs: 39, fat: 4,  fiber: 5, sugar: 2,  servingSize: "1 cup" },
  granola:   { calories: 450, protein: 10, carbs: 66, fat: 18, fiber: 5, sugar: 22, servingSize: "1 cup" },
  smoothie:  { calories: 280, protein: 8,  carbs: 52, fat: 4,  fiber: 5, sugar: 35, servingSize: "16 oz" },
};

function buildFallbackNutrition(mealName: string) {
  const name = mealName.toLowerCase();

  // Try splitting "eggs, toast and bacon" into parts
  const parts = name.split(/[,&+]|\band\b|\bwith\b/).map((s) => s.trim()).filter(Boolean);

  if (parts.length > 1) {
    let combined = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
    let matched = 0;
    const servings: string[] = [];

    for (const part of parts) {
      for (const [key, val] of Object.entries(FOOD_DB)) {
        if (part.includes(key)) {
          combined.calories += val.calories;
          combined.protein += val.protein;
          combined.carbs += val.carbs;
          combined.fat += val.fat;
          combined.fiber += val.fiber;
          combined.sugar += val.sugar;
          servings.push(val.servingSize);
          matched++;
          break;
        }
      }
    }

    if (matched > 0) {
      return { ...combined, servingSize: servings.join(" + ") };
    }
  }

  // Single item scan
  for (const [key, val] of Object.entries(FOOD_DB)) {
    if (name.includes(key)) return val;
  }

  return { calories: 400, protein: 25, carbs: 40, fat: 14, fiber: 4, sugar: 5, servingSize: "1 serving" };
}

function buildFallbackRecipes(_mealType?: string) {
  return [
    { name: "Grilled Chicken & Quinoa Bowl", description: "Tender grilled chicken over fluffy quinoa with roasted vegetables and tahini.", calories: 520, protein: 45, carbs: 42, fat: 14, prepTime: "25 min", difficulty: "Easy", tags: ["High Protein", "Gluten Free"] },
    { name: "Mediterranean Salmon", description: "Herb-crusted salmon with Greek salad, olives, and whole grain pita.", calories: 480, protein: 38, carbs: 30, fat: 22, prepTime: "20 min", difficulty: "Medium", tags: ["Omega-3", "Heart Healthy"] },
    { name: "Turkey & Sweet Potato Skillet", description: "Lean ground turkey with caramelized sweet potato, kale, and warming spices.", calories: 450, protein: 40, carbs: 48, fat: 10, prepTime: "30 min", difficulty: "Easy", tags: ["High Protein", "Low Fat"] },
    { name: "Veggie Buddha Bowl", description: "Roasted chickpeas, avocado, brown rice, and a lemon-tahini drizzle.", calories: 420, protein: 16, carbs: 58, fat: 18, prepTime: "15 min", difficulty: "Easy", tags: ["Vegan", "Fiber Rich"] },
  ];
}

export default router;
