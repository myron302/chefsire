// server/routes/import-paprika.ts
//
// POST /api/recipes/import-paprika
// Accepts a .paprikarecipes file (ZIP of gzipped JSON files, one per recipe),
// parses them, and inserts them as standalone recipes for the authenticated user.

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import { promisify } from "util";
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import { recipes, posts } from "../../shared/schema";

const gunzip = promisify(zlib.gunzip);
const router = Router();

// ── Multer: memory storage for Paprika files (typically < 50 MB) ──────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    // Paprika exports as .paprikarecipes — treat as application/zip
    const ok =
      file.originalname.toLowerCase().endsWith(".paprikarecipes") ||
      file.mimetype === "application/zip" ||
      file.mimetype === "application/octet-stream";
    if (ok) cb(null, true);
    else cb(new Error("Please upload a .paprikarecipes file."));
  },
});

// ── Paprika JSON → ChefSire recipe mapper ────────────────────────────────────

type PaprikaRecipe = {
  uid?: string;
  name?: string;
  ingredients?: string;       // newline-separated plain text
  directions?: string;        // newline-separated plain text
  description?: string;
  notes?: string;
  servings?: string;
  total_time?: string;
  prep_time?: string;
  cook_time?: string;
  categories?: string[];
  source?: string;
  source_url?: string;
  difficulty?: string;
  rating?: number;             // 0–5
  photo_data?: string;         // base64 JPEG
  photo?: string;              // URL
  nutritional_info?: string;
  scale?: string;
};

function parseMinutes(s?: string): number | null {
  if (!s) return null;
  // formats: "30 mins", "1 hr 15 mins", "45 minutes", "1:30"
  const hours = s.match(/(\d+)\s*h/i);
  const mins  = s.match(/(\d+)\s*m/i);
  const colon = s.match(/^(\d+):(\d+)$/);
  if (colon) return parseInt(colon[1]) * 60 + parseInt(colon[2]);
  return (hours ? parseInt(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1]) : 0) || null;
}

function parseIngredients(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.match(/^-+$/) && !l.match(/^\[.+\]$/));
}

function parseInstructions(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/\n{1,}/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseDifficulty(raw?: string, rating?: number): string | null {
  if (raw) {
    const lower = raw.toLowerCase();
    if (lower.includes("easy")) return "easy";
    if (lower.includes("hard") || lower.includes("advanced")) return "hard";
    if (lower.includes("medium") || lower.includes("intermediate")) return "medium";
  }
  if (rating != null) {
    if (rating <= 2) return "easy";
    if (rating >= 4) return "hard";
    return "medium";
  }
  return null;
}

function mapPaprikaRecipe(p: PaprikaRecipe, userId: string) {
  const cookTime =
    parseMinutes(p.cook_time) ||
    parseMinutes(p.total_time) ||
    parseMinutes(p.prep_time);

  const servings = p.servings
    ? parseInt(p.servings.replace(/[^\d]/g, "")) || null
    : null;

  const ingredients  = parseIngredients(p.ingredients);
  const instructions = parseInstructions(p.directions);

  // Derive cuisine / meal type from categories
  const categories  = Array.isArray(p.categories) ? p.categories : [];
  const cuisineMap  = ["Italian", "Mexican", "Chinese", "Japanese", "Indian", "French", "Thai", "Greek", "American", "Mediterranean"];
  const mealTypeMap = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Appetizer", "Salad", "Soup", "Side Dish"];
  const cuisine   = categories.find((c) => cuisineMap.some((x) => c.toLowerCase().includes(x.toLowerCase()))) || null;
  const mealType  = categories.find((c) => mealTypeMap.some((x) => c.toLowerCase().includes(x.toLowerCase()))) || null;

  return {
    id: randomUUID(),
    postId: null,
    title: (p.name || "Untitled Recipe").trim(),
    imageUrl: p.photo || null,          // URL photos only; base64 handled separately
    ingredients: ingredients.length ? ingredients : ["(No ingredients listed)"],
    instructions: instructions.length ? instructions : ["(No instructions listed)"],
    cookTime,
    servings,
    difficulty: parseDifficulty(p.difficulty, p.rating),
    externalSource: "paprika",
    externalId: p.uid || null,
    cuisine,
    mealType,
    sourceUrl: p.source_url || p.source || null,
    // nutrition fields — Paprika stores as plain text, best-effort parse
    calories: null,
    nutrition: p.nutritional_info ? { raw: p.nutritional_info } : null,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post(
  "/import-paprika",
  requireAuth,
  upload.single("recipesFile"),
  async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ ok: false, error: "No file uploaded" });

    if (!file.originalname.toLowerCase().endsWith(".paprikarecipes")) {
      return res.status(400).json({ ok: false, error: "File must be a .paprikarecipes export" });
    }

    try {
      const zip = new AdmZip(file.buffer);
      const entries = zip.getEntries();

      const parsed: PaprikaRecipe[] = [];

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        const rawBuf = zip.readFile(entry);
        if (!rawBuf) continue;

        let jsonBuf: Buffer;

        // Each entry inside is a gzipped JSON file
        try {
          jsonBuf = await gunzip(rawBuf) as Buffer;
        } catch {
          // Not gzipped — try as raw JSON
          jsonBuf = rawBuf;
        }

        try {
          const obj = JSON.parse(jsonBuf.toString("utf-8")) as PaprikaRecipe;
          if (obj.name) parsed.push(obj);
        } catch {
          console.warn("[Paprika Import] Skipped non-JSON entry:", entry.entryName);
        }
      }

      if (parsed.length === 0) {
        return res.status(400).json({ ok: false, error: "No recipes found in the file. Make sure it is a valid Paprika export." });
      }

      // Deduplicate against existing externalId for this user's recipes
      // (simple check: if same externalId already exists, skip)
      const existingIds = new Set<string>();
      try {
        const existing = await db
          .select({ externalId: recipes.externalId })
          .from(recipes)
          .innerJoin(posts, (recipes as any).postId === posts.id);
        existing.forEach((r) => { if (r.externalId) existingIds.add(r.externalId); });
      } catch {
        // dedup is best-effort
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const p of parsed) {
        try {
          const mapped = mapPaprikaRecipe(p, userId);

          if (mapped.externalId && existingIds.has(mapped.externalId)) {
            skipped++;
            continue;
          }

          await db.insert(recipes).values(mapped as any);
          imported++;
        } catch (err: any) {
          errors.push(p.name || "Unknown");
          console.error("[Paprika Import] Failed to insert recipe:", p.name, err?.message);
        }
      }

      return res.json({
        ok: true,
        imported,
        skipped,
        total: parsed.length,
        errors: errors.length ? errors : undefined,
      });
    } catch (err: any) {
      console.error("[Paprika Import] Processing error:", err);
      return res.status(500).json({ ok: false, error: err?.message || "Import failed" });
    }
  }
);

export default router;
