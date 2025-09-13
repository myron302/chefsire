// server/features/substitutions/substitutions.routes.ts
import { Router } from "express";
import {
  searchIngredients,
  getSubstitutions,
  generateAISubstitutions,
} from "./substitutions.service";

const router = Router();

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
 * GET /api/ingredients/ai-substitution?q=butter
 * Returns: { query: string, substitutions: SubstitutionItem[] }
 */
router.get("/api/ingredients/ai-substitution", (req, res) => {
  const q = String(req.query.q || "");
  const payload = generateAISubstitutions(q);
  res.json(payload);
});

export default router;
