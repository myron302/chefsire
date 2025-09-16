// server/features/substitutions/substitutions.routes.ts
import express, { Router } from "express";
import {
  searchIngredients,
  getSubstitutions,
  generateAISubstitutions, // legacy/simple generator – kept for backward-compat route
} from "./substitutions.service";
import {
  suggestSubstitutionsAI, // upgraded OpenAI-backed suggester
  type AISubItem,
} from "../../services/ingredients-ai";
import { insertIngredientSubstitutionSchema } from "../../../shared/schema";
import { db } from "../../storage";

const router = Router();

// Ensure JSON parsing for POST requests (safe even if your app also does this globally)
router.use(express.json({ limit: "1mb" }));

/**
 * GET /api/ingredients/substitutions/search?q=but
 * Returns: { results: string[] }
 */
router.get("/api/ingredients/substitutions/search", (req, res) => {
  const q = String(req.query.q || "");
  const results = searchIngredients(q);
  res.json({ results });
});

/**
 * GET /api/ingredients/:ingredient/substitutions
 * Returns: { substitutions: SubstitutionItem[] }
 */
router.get("/api/ingredients/:ingredient/substitutions", (req, res) => {
  const ingredient = String(req.params.ingredient || "");
  const substitutions = getSubstitutions(ingredient);
  res.json({ substitutions });
});

/**
 * (Legacy) GET /api/ingredients/ai-substitution?q=butter
 * Returns: { query: string, substitutions: SubstitutionItem[] }
 *
 * NOTE: This keeps your old behavior via generateAISubstitutions()
 * so any existing callers won't break.
 */
router.get("/api/ingredients/ai-substitution", (req, res) => {
  const q = String(req.query.q || "");
  const payload = generateAISubstitutions(q);
  res.json(payload);
});

/* ============================================================================
 * NEW: OpenAI-powered endpoints with cuisine + dietary filters
 * ============================================================================
 */

type Ok = {
  ok: true;
  query: string;
  aiSubstitutions: AISubItem[]; // primary key your client reads
  substitutions: AISubItem[];   // alias for convenience/back-compat
};

type Err = { ok: false; error: string };

/**
 * GET /api/ingredients/:ingredient/ai-substitutions
 *
 * Optional query params:
 *   - cuisine=italian
 *   - dietary=vegan,gluten-free   (comma-separated)  OR  dietary=vegan&dietary=gluten-free (repeated)
 *
 * Examples:
 *   /api/ingredients/butter/ai-substitutions
 *   /api/ingredients/milk/ai-substitutions?dietary=dairy-free,vegan
 *   /api/ingredients/yogurt/ai-substitutions?cuisine=indian
 */
router.get("/api/ingredients/:ingredient/ai-substitutions", async (req, res) => {
  try {
    const ingredient = String(req.params.ingredient ?? "").trim();
    if (!ingredient) {
      const body: Err = { ok: false, error: "Missing ingredient in path." };
      return res.status(400).json(body);
    }

    const cuisine = req.query.cuisine ? String(req.query.cuisine).trim() : undefined;

    // dietary can be provided as a CSV string or repeated query params
    const dietaryRaw = req.query.dietary;
    let dietaryRestrictions: string[] = [];
    if (Array.isArray(dietaryRaw)) {
      dietaryRestrictions = dietaryRaw.flatMap((v) =>
        String(v)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    } else if (typeof dietaryRaw === "string" && dietaryRaw.trim()) {
      dietaryRestrictions = dietaryRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const { query, substitutions } = await suggestSubstitutionsAI(ingredient, {
      cuisine,
      dietaryRestrictions,
    });

    const body: Ok = {
      ok: true,
      query,
      aiSubstitutions: substitutions,
      substitutions, // alias
    };
    return res.json(body);
  } catch (err: any) {
    const body: Err = { ok: false, error: err?.message || "Unknown error" };
    return res.status(500).json(body);
  }
});

/**
 * POST /api/ingredients/ai-substitutions
 * Body: { ingredient: string, cuisine?: string, dietaryRestrictions?: string[] }
 */
router.post("/api/ingredients/ai-substitutions", async (req, res) => {
  try {
    const ingredient = String(req.body?.ingredient ?? "").trim();
    if (!ingredient) {
      const body: Err = { ok: false, error: "Body must include 'ingredient' string." };
      return res.status(400).json(body);
    }

    const cuisine = req.body?.cuisine ? String(req.body.cuisine).trim() : undefined;

    const dietaryRestrictions: string[] = Array.isArray(req.body?.dietaryRestrictions)
      ? (req.body.dietaryRestrictions as string[])
          .map((s) => String(s).trim())
          .filter(Boolean)
      : [];

    const { query, substitutions } = await suggestSubstitutionsAI(ingredient, {
      cuisine,
      dietaryRestrictions,
    });

    const body: Ok = {
      ok: true,
      query,
      aiSubstitutions: substitutions,
      substitutions, // alias
    };
    return res.json(body);
  } catch (err: any) {
    const body: Err = { ok: false, error: err?.message || "Unknown error" };
    return res.status(500).json(body);
  }
});

/**
 * POST /api/substitutions
 * Body: { originalIngredient: string, substituteIngredient: string, ratio: string, notes?: string, category?: string }
 * Creates a user-contributed substitution
 */
router.post("/api/substitutions", async (req, res) => {
  try {
    const parsed = insertIngredientSubstitutionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid substitution data", 
        details: parsed.error.errors 
      });
    }

    const result = await db.insertIngredientSubstitution(parsed.data);
    return res.json({ ok: true, substitution: result });
  } catch (err: any) {
    return res.status(500).json({ 
      ok: false, 
      error: err?.message || "Failed to create substitution" 
    });
  }
});

export default router;
