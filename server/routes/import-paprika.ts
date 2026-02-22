// server/routes/import-paprika.ts
//
// POST /api/recipes/import-paprika
// Accepts a .paprikarecipes file (ZIP of gzipped JSON files, one per recipe),
// parses them, and inserts them as standalone recipes for the authenticated user.
//
// Uses ONLY built-in Node modules for ZIP parsing — no adm-zip needed.

import { Router } from "express";
import multer from "multer";
import zlib from "zlib";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import { recipes } from "../../shared/schema";

const gunzip = promisify(zlib.gunzip);
const inflateRaw = promisify(zlib.inflateRaw);
const router = Router();

// ── Minimal ZIP parser (no external deps) ────────────────────────────────────
// ZIP local file header layout:
//   0–3   signature (0x04034b50)
//   4–5   version needed
//   6–7   general purpose bit flag
//   8–9   compression method (0=stored, 8=deflated)
//   10–11 last mod time
//   12–13 last mod date
//   14–17 crc-32
//   18–21 compressed size
//   22–25 uncompressed size
//   26–27 file name length
//   28–29 extra field length
//   30+   file name, extra field, then file data

type ZipEntry = { name: string; data: Buffer; compression: number };

function parseZip(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 < buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // not a local file header — end of entries

    const compression = buf.readUInt16LE(offset + 8);
    const compSize    = buf.readUInt32LE(offset + 18);
    const nameLen     = buf.readUInt16LE(offset + 26);
    const extraLen    = buf.readUInt16LE(offset + 28);
    const dataOffset  = offset + 30 + nameLen + extraLen;

    const name        = buf.slice(offset + 30, offset + 30 + nameLen).toString("utf-8");
    const data        = buf.slice(dataOffset, dataOffset + compSize);

    entries.push({ name, data, compression });
    offset = dataOffset + compSize;
  }

  return entries;
}

async function decompressEntry(entry: ZipEntry): Promise<Buffer> {
  if (entry.compression === 0) return entry.data; // stored — no compression
  if (entry.compression === 8) return inflateRaw(entry.data) as Promise<Buffer>; // deflated
  throw new Error(`Unsupported ZIP compression method: ${entry.compression}`);
}

// ── Multer ────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
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
  ingredients?: string;
  directions?: string;
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
  rating?: number;
  photo_data?: string;
  photo?: string;
  nutritional_info?: string;
};

function parseMinutes(s?: string): number | null {
  if (!s) return null;
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
    .split(/\n+/)
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

function mapPaprikaRecipe(p: PaprikaRecipe) {
  const cookTime =
    parseMinutes(p.cook_time) ||
    parseMinutes(p.total_time) ||
    parseMinutes(p.prep_time);

  const servings = p.servings
    ? parseInt(p.servings.replace(/[^\d]/g, "")) || null
    : null;

  const ingredients  = parseIngredients(p.ingredients);
  const instructions = parseInstructions(p.directions);

  const categories  = Array.isArray(p.categories) ? p.categories : [];
  const cuisineMap  = ["Italian", "Mexican", "Chinese", "Japanese", "Indian", "French", "Thai", "Greek", "American", "Mediterranean"];
  const mealTypeMap = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Appetizer", "Salad", "Soup", "Side Dish"];
  const cuisine   = categories.find((c) => cuisineMap.some((x) => c.toLowerCase().includes(x.toLowerCase()))) || null;
  const mealType  = categories.find((c) => mealTypeMap.some((x) => c.toLowerCase().includes(x.toLowerCase()))) || null;

  return {
    id: randomUUID(),
    postId: null,
    title: (p.name || "Untitled Recipe").trim(),
    imageUrl: p.photo || null,
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
      const zipEntries = parseZip(file.buffer);
      const parsed: PaprikaRecipe[] = [];

      for (const entry of zipEntries) {
        if (entry.name.endsWith("/")) continue; // directory entry

        let decompressed: Buffer;
        try {
          decompressed = await decompressEntry(entry);
        } catch {
          continue;
        }

        // Each entry inside is a gzipped JSON file
        let jsonBuf: Buffer;
        try {
          jsonBuf = await gunzip(decompressed) as Buffer;
        } catch {
          jsonBuf = decompressed; // not gzipped — try as raw JSON
        }

        try {
          const obj = JSON.parse(jsonBuf.toString("utf-8")) as PaprikaRecipe;
          if (obj.name) parsed.push(obj);
        } catch {
          console.warn("[Paprika Import] Skipped non-JSON entry:", entry.name);
        }
      }

      if (parsed.length === 0) {
        return res.status(400).json({ ok: false, error: "No recipes found in the file. Make sure it is a valid Paprika export." });
      }

      // Deduplicate: find existing paprika externalIds in the DB
      const existingIds = new Set<string>();
      try {
        const existing = await db
          .select({ externalId: recipes.externalId })
          .from(recipes)
          .where(eq(recipes.externalSource, "paprika"));
        existing.forEach((r) => { if (r.externalId) existingIds.add(r.externalId); });
      } catch {
        // dedup is best-effort — proceed even if this fails
      }

      let imported = 0;
      let skipped  = 0;
      const errors: string[] = [];

      for (const p of parsed) {
        try {
          const mapped = mapPaprikaRecipe(p);

          if (mapped.externalId && existingIds.has(mapped.externalId)) {
            skipped++;
            continue;
          }

          await db.insert(recipes).values(mapped as any);
          if (mapped.externalId) existingIds.add(mapped.externalId); // prevent dupes within same upload
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
