// server/routes/import-paprika.ts
//
// Mounted under /api/recipes via server/routes/index.ts
//
// Endpoints:
//   POST /api/recipes/import-paprika      (.paprikarecipes ZIP export; Paprika / AnyList-compatible)
//   POST /api/recipes/import-anylist      (.paprikarecipes ZIP export; alias using source "anylist")
//   POST /api/recipes/import-plan-to-eat  (.csv / .txt export from Plan to Eat)
//   POST /api/recipes/import-url          (public recipe page URL scraper via JSON-LD)
//
// Notes:
// - Uses ONLY built-in Node modules for ZIP parsing (no adm-zip needed)
// - Inserts imported recipes as standalone recipes (postId: null)

import { Router } from "express";
import multer from "multer";
import zlib from "zlib";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import { recipes } from "../../shared/schema";

const gunzip = promisify(zlib.gunzip);
const inflateRaw = promisify(zlib.inflateRaw);

const router = Router();

type ImportSource = "paprika" | "anylist" | "plan-to-eat" | "web";

type NormalizedRecipe = {
  title: string;
  ingredients: string[];
  instructions: string[];
  cookTime: number | null;
  servings: number | null;
  difficulty: string | null;
  cuisine: string | null;
  mealType: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  externalSource: string;
  externalId: string | null;
  nutrition: Record<string, any> | null;
  calories: number | null;
  protein: string | null;
  carbs: string | null;
  fat: string | null;
  fiber: string | null;
};

type ImportSummary = {
  ok: true;
  imported: number;
  skipped: number;
  total: number;
  errors?: string[];
};

type ImportFailure = {
  ok: false;
  error: string;
};

type ZipEntry = {
  name: string;
  data: Buffer;
  compression: number; // 0=stored, 8=deflated
};

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

type JsonLdRecipe = Record<string, any>;

// --------------------------------------------------------------------------------------
// Multer
// --------------------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// --------------------------------------------------------------------------------------
// ZIP parsing (no external deps)
// --------------------------------------------------------------------------------------
//
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
//
// This simple parser assumes sizes are present in local headers (works for Paprika/AnyList exports).

function parseZip(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);

    // Central directory or end of central directory — stop.
    if (sig === 0x02014b50 || sig === 0x06054b50) break;

    if (sig !== 0x04034b50) {
      // Unknown signature — stop parsing safely.
      break;
    }

    const flags = buf.readUInt16LE(offset + 6);
    const compression = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);

    // Bit 3 = data descriptor present (sizes may be zero in local header)
    if (flags & 0x0008) {
      throw new Error("Unsupported ZIP export (data descriptors enabled). Please re-export and try again.");
    }

    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    const dataOffset = nameEnd + extraLen;

    if (dataOffset < 0 || dataOffset > buf.length) break;
    if (nameEnd > buf.length) break;
    if (dataOffset + compSize > buf.length) break;

    const name = buf.slice(nameStart, nameEnd).toString("utf-8");
    const data = buf.slice(dataOffset, dataOffset + compSize);

    entries.push({ name, data, compression });

    offset = dataOffset + compSize;
  }

  return entries;
}

async function decompressZipEntry(entry: ZipEntry): Promise<Buffer> {
  if (entry.compression === 0) return entry.data; // stored
  if (entry.compression === 8) return (await inflateRaw(entry.data)) as Buffer; // deflated
  throw new Error(`Unsupported ZIP compression method: ${entry.compression}`);
}

// --------------------------------------------------------------------------------------
// Shared helpers
// --------------------------------------------------------------------------------------

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseInteger(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const n = parseInt(value.replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseDecimalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
  if (typeof value === "string") {
    const match = value.match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const n = Number(match[0]);
    if (!Number.isFinite(n)) return null;
    return n.toFixed(2);
  }
  return null;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u00a0/g, " ").trim();
}

function parseMinutes(raw?: string | null): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // ISO 8601 durations: PT1H30M, PT45M, PT2H
  const iso = s.match(/^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (iso) {
    const h = iso[1] ? parseInt(iso[1], 10) : 0;
    const m = iso[2] ? parseInt(iso[2], 10) : 0;
    const sec = iso[3] ? parseInt(iso[3], 10) : 0;
    const total = h * 60 + m + Math.round(sec / 60);
    return total > 0 ? total : null;
  }

  // 1:30
  const colon = s.match(/^(\d+):(\d{1,2})$/);
  if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);

  // "1 h 30 m", "45 mins", "2 hours"
  let total = 0;
  let matched = false;

  const hours = s.match(/(\d+)\s*(h|hr|hrs|hour|hours)\b/i);
  if (hours) {
    total += parseInt(hours[1], 10) * 60;
    matched = true;
  }

  const mins = s.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/i);
  if (mins) {
    total += parseInt(mins[1], 10);
    matched = true;
  }

  if (matched) return total || null;

  // fallback: plain number = minutes
  if (/^\d+$/.test(s)) return parseInt(s, 10);

  return null;
}

function parseServings(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  if (typeof raw === "string") {
    // Handles "4", "Serves 6", "4-6"
    const range = raw.match(/(\d+)\s*-\s*(\d+)/);
    if (range) return parseInt(range[2], 10); // use upper bound
    const n = raw.match(/(\d+)/);
    return n ? parseInt(n[1], 10) : null;
  }
  return null;
}

function splitLines(raw?: string | null): string[] {
  if (!raw) return [];
  return normalizeWhitespace(raw)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function parseIngredientsLines(raw?: string | null): string[] {
  return splitLines(raw).filter((l) => !/^[-–—]+$/.test(l) && !/^\[.+\]$/.test(l));
}

function parseInstructionLines(raw?: string | null): string[] {
  const lines = normalizeWhitespace(raw || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines;
}

function inferCuisineAndMealType(categories: string[] | null | undefined): {
  cuisine: string | null;
  mealType: string | null;
} {
  const list = Array.isArray(categories) ? categories.filter(Boolean) : [];

  const cuisineHints = [
    "italian", "mexican", "chinese", "japanese", "indian", "french", "thai",
    "greek", "american", "mediterranean", "korean", "spanish", "vietnamese",
    "middle eastern", "caribbean"
  ];

  const mealTypeHints = [
    "breakfast", "lunch", "dinner", "snack", "dessert", "appetizer", "salad",
    "soup", "side", "side dish", "brunch"
  ];

  let cuisine: string | null = null;
  let mealType: string | null = null;

  for (const c of list) {
    const lower = c.toLowerCase();
    if (!cuisine && cuisineHints.some((h) => lower.includes(h))) cuisine = c;
    if (!mealType && mealTypeHints.some((h) => lower.includes(h))) mealType = c;
    if (cuisine && mealType) break;
  }

  return { cuisine, mealType };
}

function uniqueNonEmpty(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!item) continue;
    const v = item.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function makeFallbackExternalId(
  source: ImportSource,
  title: string,
  sourceUrl?: string | null,
): string {
  const base = `${source}|${(sourceUrl || "").trim().toLowerCase()}|${title.trim().toLowerCase()}`;
  return base.slice(0, 500);
}

function toRecipeInsert(row: NormalizedRecipe) {
  return {
    id: randomUUID(),
    postId: null,
    title: row.title.trim() || "Untitled Recipe",
    imageUrl: row.imageUrl,
    ingredients: row.ingredients.length ? row.ingredients : ["(No ingredients listed)"],
    instructions: row.instructions.length ? row.instructions : ["(No instructions listed)"],
    cookTime: row.cookTime,
    servings: row.servings,
    difficulty: row.difficulty,
    nutrition: row.nutrition,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    externalSource: row.externalSource,
    externalId: row.externalId,
    cuisine: row.cuisine,
    mealType: row.mealType,
    sourceUrl: row.sourceUrl,
  };
}

async function importNormalizedRecipes(items: NormalizedRecipe[]): Promise<ImportSummary> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  // Prevent duplicate inserts in the same request
  const inBatchKeys = new Set<string>();

  for (const item of items) {
    const title = item.title?.trim() || "Untitled Recipe";
    const externalId = item.externalId || makeFallbackExternalId(
      item.externalSource === "paprika" ? "paprika" :
      item.externalSource === "anylist" ? "anylist" :
      item.externalSource === "plan-to-eat" ? "plan-to-eat" : "web",
      title,
      item.sourceUrl
    );

    const batchKey = `${item.externalSource}|${externalId}`;
    if (inBatchKeys.has(batchKey)) {
      skipped++;
      continue;
    }

    try {
      // DB dedupe by externalSource + externalId
      const existing = await db
        .select({ id: recipes.id })
        .from(recipes)
        .where(and(eq(recipes.externalSource, item.externalSource), eq(recipes.externalId, externalId)))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        inBatchKeys.add(batchKey);
        continue;
      }

      const insertable = toRecipeInsert({
        ...item,
        externalId,
      });

      await db.insert(recipes).values(insertable as any);
      imported++;
      inBatchKeys.add(batchKey);
    } catch (err: any) {
      errors.push(title);
      console.error("[Recipe Import] Failed to insert recipe:", title, err?.message || err);
    }
  }

  return {
    ok: true,
    imported,
    skipped,
    total: items.length,
    errors: errors.length ? errors : undefined,
  };
}

// --------------------------------------------------------------------------------------
// Paprika / AnyList (.paprikarecipes)
// --------------------------------------------------------------------------------------

function parsePaprikaDifficulty(raw?: string, rating?: number): string | null {
  if (raw) {
    const lower = raw.toLowerCase();
    if (lower.includes("easy")) return "easy";
    if (lower.includes("hard") || lower.includes("advanced")) return "hard";
    if (lower.includes("medium") || lower.includes("intermediate")) return "medium";
  }

  if (typeof rating === "number") {
    if (rating <= 2) return "easy";
    if (rating >= 4) return "hard";
    return "medium";
  }

  return null;
}

function mapPaprikaRecipeToNormalized(p: PaprikaRecipe, source: "paprika" | "anylist"): NormalizedRecipe {
  const cookTime =
    parseMinutes(p.cook_time || null) ??
    parseMinutes(p.total_time || null) ??
    parseMinutes(p.prep_time || null);

  const servings = parseServings(p.servings);

  const ingredients = parseIngredientsLines(p.ingredients || null);
  const instructions = parseInstructionLines(p.directions || p.notes || null);

  const categories = Array.isArray(p.categories) ? p.categories.filter((c): c is string => typeof c === "string") : [];
  const { cuisine, mealType } = inferCuisineAndMealType(categories);

  const sourceUrl = sanitizeText(p.source_url) || sanitizeText(p.source);
  const title = sanitizeText(p.name) || "Untitled Recipe";

  return {
    title,
    ingredients: ingredients.length ? ingredients : ["(No ingredients listed)"],
    instructions: instructions.length ? instructions : ["(No instructions listed)"],
    cookTime,
    servings,
    difficulty: parsePaprikaDifficulty(p.difficulty, p.rating),
    cuisine,
    mealType,
    sourceUrl,
    imageUrl: sanitizeText(p.photo),
    externalSource: source,
    externalId: sanitizeText(p.uid) || makeFallbackExternalId(source, title, sourceUrl),
    nutrition: p.nutritional_info ? { raw: p.nutritional_info } : null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
  };
}

async function parsePaprikaLikeFile(file: Express.Multer.File, source: "paprika" | "anylist"): Promise<NormalizedRecipe[]> {
  const lower = file.originalname.toLowerCase();
  if (!lower.endsWith(".paprikarecipes") && !lower.endsWith(".zip")) {
    throw new Error("File must be a .paprikarecipes export.");
  }

  const zipEntries = parseZip(file.buffer);
  if (!zipEntries.length) throw new Error("Could not read the ZIP file. Make sure it is a valid export.");

  const parsed: PaprikaRecipe[] = [];

  for (const entry of zipEntries) {
    if (entry.name.endsWith("/")) continue; // directory
    if (entry.data.length === 0) continue;

    let decompressed: Buffer;
    try {
      decompressed = await decompressZipEntry(entry);
    } catch {
      continue;
    }

    // In Paprika exports, each entry is often gzipped JSON.
    let jsonBuf: Buffer;
    try {
      jsonBuf = (await gunzip(decompressed)) as Buffer;
    } catch {
      jsonBuf = decompressed;
    }

    try {
      const obj = JSON.parse(jsonBuf.toString("utf-8")) as PaprikaRecipe;
      if (sanitizeText(obj.name)) parsed.push(obj);
    } catch {
      // non-recipe entries are ignored
      continue;
    }
  }

  if (!parsed.length) {
    throw new Error("No recipes found in the file. Make sure it is a valid Paprika/AnyList export.");
  }

  return parsed.map((p) => mapPaprikaRecipeToNormalized(p, source));
}

// --------------------------------------------------------------------------------------
// Plan to Eat CSV/TXT import
// --------------------------------------------------------------------------------------

function detectDelimiter(text: string): "," | "\t" {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function parseDelimited(text: string, delimiter: "," | "\t"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  // tail
  row.push(cell);
  if (row.some((v) => v.length > 0)) rows.push(row);

  return rows;
}

function headerIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias.toLowerCase());
    if (idx !== -1) return idx;
  }

  // fuzzy contains fallback
  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i];
    if (aliases.some((a) => h.includes(a.toLowerCase()))) return i;
  }

  return -1;
}

function parseCategoriesFromText(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\|;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapPlanToEatRow(headers: string[], row: string[]): NormalizedRecipe | null {
  const get = (...aliases: string[]) => {
    const idx = headerIndex(headers, aliases);
    return idx >= 0 ? (row[idx] ?? "") : "";
  };

  const title =
    sanitizeText(get("name", "title", "recipe", "recipe name")) ||
    null;

  if (!title) return null;

  const ingredientsRaw = get("ingredients", "ingredient", "ingredient list");
  const instructionsRaw = get("directions", "instructions", "method");
  const notesRaw = get("notes", "description");

  const prepTime = get("prep time", "prep_time");
  const cookTime = get("cook time", "cook_time");
  const totalTime = get("total time", "total_time", "time");

  const servingsRaw = get("servings", "yield", "recipe yield");
  const sourceUrl = sanitizeText(get("source url", "url", "recipe url", "link"));
  const sourceText = sanitizeText(get("source", "author", "from"));
  const imageUrl = sanitizeText(get("image", "image url", "photo", "photo url"));
  const categories = parseCategoriesFromText(get("categories", "category", "tags", "tag"));

  const { cuisine, mealType } = inferCuisineAndMealType(categories);

  const computedCookTime =
    parseMinutes(cookTime) ??
    parseMinutes(totalTime) ??
    parseMinutes(prepTime);

  const ingredients = parseIngredientsLines(ingredientsRaw || undefined);
  const instructions = parseInstructionLines(
    instructionsRaw || notesRaw || undefined
  );

  const mergedSourceUrl = sourceUrl || sourceText || null;

  return {
    title,
    ingredients: ingredients.length ? ingredients : ["(No ingredients listed)"],
    instructions: instructions.length ? instructions : ["(No instructions listed)"],
    cookTime: computedCookTime,
    servings: parseServings(servingsRaw),
    difficulty: null,
    cuisine,
    mealType,
    sourceUrl: mergedSourceUrl,
    imageUrl,
    externalSource: "plan-to-eat",
    externalId: makeFallbackExternalId("plan-to-eat", title, mergedSourceUrl),
    nutrition: null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
  };
}

async function parsePlanToEatFile(file: Express.Multer.File): Promise<NormalizedRecipe[]> {
  const name = file.originalname.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".txt")) {
    throw new Error("Please upload a Plan to Eat .csv or .txt export file.");
  }

  const text = file.buffer.toString("utf-8");
  if (!text.trim()) throw new Error("The uploaded file is empty.");

  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);

  if (rows.length < 2) {
    throw new Error("Could not find any recipe rows in the Plan to Eat export.");
  }

  const headers = rows[0].map((h) => normalizeWhitespace(h));
  const dataRows = rows.slice(1);

  const items: NormalizedRecipe[] = [];
  for (const row of dataRows) {
    const mapped = mapPlanToEatRow(headers, row);
    if (mapped) items.push(mapped);
  }

  if (!items.length) {
    throw new Error("No recipes could be parsed from the Plan to Eat file.");
  }

  return items;
}

// --------------------------------------------------------------------------------------
// URL import (public recipe page scraper via JSON-LD)
// --------------------------------------------------------------------------------------

function isLikelyPrivateHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();

  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;
  if (h === "::1") return true;

  // IPv4 private/local ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast/reserved
  }

  return false;
}

function normalizeImportUrl(raw: string): string {
  const url = new URL(raw);
  if (!/^https?:$/i.test(url.protocol)) {
    throw new Error("Only http(s) URLs are supported.");
  }
  if (isLikelyPrivateHost(url.hostname)) {
    throw new Error("That URL host is not allowed.");
  }
  url.hash = ""; // avoid duplicate imports by fragment
  return url.toString();
}

function extractLdJsonBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const content = match[1]?.trim();
    if (content) blocks.push(content);
  }
  return blocks;
}

function safeJsonParse(str: string): any | null {
  try {
    return JSON.parse(str);
  } catch {
    // Some sites HTML-escape JSON-LD or include invalid whitespace/comments.
    // Try a couple of low-risk cleanups.
    const cleaned = str
      .replace(/^\s*<!--/, "")
      .replace(/-->\s*$/, "")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

function flattenJsonLdCandidates(node: any): any[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flattenJsonLdCandidates);

  const out = [node];
  if (node["@graph"]) out.push(...flattenJsonLdCandidates(node["@graph"]));
  if (node.graph) out.push(...flattenJsonLdCandidates(node.graph));
  return out;
}

function hasRecipeType(v: any): boolean {
  if (!v) return false;
  const t = v["@type"];
  if (Array.isArray(t)) return t.some((x) => typeof x === "string" && x.toLowerCase() === "recipe");
  return typeof t === "string" && t.toLowerCase() === "recipe";
}

function pickRecipeJsonLd(html: string): JsonLdRecipe | null {
  const blocks = extractLdJsonBlocks(html);

  for (const block of blocks) {
    const parsed = safeJsonParse(block);
    if (!parsed) continue;

    const candidates = flattenJsonLdCandidates(parsed);
    for (const c of candidates) {
      if (c && typeof c === "object" && hasRecipeType(c)) {
        return c as JsonLdRecipe;
      }
    }
  }

  return null;
}

function getJsonLdImage(recipeObj: JsonLdRecipe): string | null {
  const image = recipeObj.image;
  if (!image) return null;

  if (typeof image === "string") return sanitizeText(image);
  if (Array.isArray(image)) {
    for (const item of image) {
      if (typeof item === "string" && sanitizeText(item)) return sanitizeText(item);
      if (item && typeof item === "object") {
        const url = sanitizeText(item.url) || sanitizeText(item.contentUrl);
        if (url) return url;
      }
    }
    return null;
  }

  if (typeof image === "object") {
    return sanitizeText(image.url) || sanitizeText(image.contentUrl);
  }

  return null;
}

function parseJsonLdInstructions(input: any): string[] {
  if (!input) return [];

  if (typeof input === "string") {
    return parseInstructionLines(input);
  }

  if (Array.isArray(input)) {
    const steps: string[] = [];

    for (const item of input) {
      if (!item) continue;

      if (typeof item === "string") {
        steps.push(item.trim());
        continue;
      }

      if (typeof item === "object") {
        // HowToStep / HowToSection
        if (typeof item.text === "string") {
          const text = item.name && item.name !== item.text
            ? `${String(item.name).trim()}: ${item.text.trim()}`
            : item.text.trim();
          if (text) steps.push(text);
          continue;
        }

        if (Array.isArray(item.itemListElement)) {
          const nested = parseJsonLdInstructions(item.itemListElement);
          steps.push(...nested);
          continue;
        }

        if (typeof item.name === "string" && item.name.trim()) {
          steps.push(item.name.trim());
          continue;
        }
      }
    }

    return uniqueNonEmpty(steps);
  }

  return [];
}

function extractNutrition(recipeObj: JsonLdRecipe) {
  const nutrition = recipeObj.nutrition && typeof recipeObj.nutrition === "object"
    ? recipeObj.nutrition
    : null;

  if (!nutrition) {
    return {
      nutrition: null as Record<string, any> | null,
      calories: null as number | null,
      protein: null as string | null,
      carbs: null as string | null,
      fat: null as string | null,
      fiber: null as string | null,
    };
  }

  const calories = parseInteger(nutrition.calories);
  const protein = parseDecimalString(nutrition.proteinContent);
  const carbs = parseDecimalString(nutrition.carbohydrateContent);
  const fat = parseDecimalString(nutrition.fatContent);
  const fiber = parseDecimalString(nutrition.fiberContent);

  return {
    nutrition,
    calories,
    protein,
    carbs,
    fat,
    fiber,
  };
}

function parseRecipeYieldToMealTypeAndServings(recipeObj: JsonLdRecipe): {
  servings: number | null;
  mealType: string | null;
} {
  const yieldRaw = recipeObj.recipeYield;
  const servings = parseServings(Array.isArray(yieldRaw) ? yieldRaw[0] : yieldRaw);

  const categories: string[] = [];
  const recipeCategory = recipeObj.recipeCategory;
  if (typeof recipeCategory === "string") categories.push(recipeCategory);
  if (Array.isArray(recipeCategory)) {
    categories.push(...recipeCategory.filter((x: any) => typeof x === "string"));
  }

  const { mealType } = inferCuisineAndMealType(categories);
  return { servings, mealType };
}

function mapJsonLdRecipeToNormalized(recipeObj: JsonLdRecipe, url: string): NormalizedRecipe {
  const title = sanitizeText(recipeObj.name) || "Imported Recipe";

  const ingredients = Array.isArray(recipeObj.recipeIngredient)
    ? recipeObj.recipeIngredient.filter((x: any) => typeof x === "string").map((x: string) => x.trim()).filter(Boolean)
    : parseIngredientsLines(sanitizeText(recipeObj.ingredients) || undefined);

  const instructions = parseJsonLdInstructions(recipeObj.recipeInstructions);

  const categories: string[] = [];
  const recipeCategory = recipeObj.recipeCategory;
  const recipeCuisine = recipeObj.recipeCuisine;

  if (typeof recipeCategory === "string") categories.push(recipeCategory);
  if (Array.isArray(recipeCategory)) categories.push(...recipeCategory.filter((x: any) => typeof x === "string"));
  if (typeof recipeCuisine === "string") categories.push(recipeCuisine);
  if (Array.isArray(recipeCuisine)) categories.push(...recipeCuisine.filter((x: any) => typeof x === "string"));

  const { cuisine, mealType: inferredMealType } = inferCuisineAndMealType(categories);
  const { servings, mealType: yieldMealType } = parseRecipeYieldToMealTypeAndServings(recipeObj);
  const nutritionBits = extractNutrition(recipeObj);

  const cookTime =
    parseMinutes(sanitizeText(recipeObj.totalTime)) ??
    parseMinutes(sanitizeText(recipeObj.cookTime)) ??
    parseMinutes(sanitizeText(recipeObj.prepTime));

  const host = new URL(url).hostname.replace(/^www\./i, "");

  return {
    title,
    ingredients: ingredients.length ? ingredients : ["(No ingredients listed)"],
    instructions: instructions.length ? instructions : ["(No instructions listed)"],
    cookTime,
    servings,
    difficulty: null,
    cuisine,
    mealType: inferredMealType || yieldMealType,
    sourceUrl: url,
    imageUrl: getJsonLdImage(recipeObj),
    externalSource: "web",
    externalId: url, // stable dedupe key
    nutrition: nutritionBits.nutrition,
    calories: nutritionBits.calories,
    protein: nutritionBits.protein,
    carbs: nutritionBits.carbs,
    fat: nutritionBits.fat,
    fiber: nutritionBits.fiber,
  };
}

async function fetchPublicRecipeHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "ChefSireRecipeImporter/1.0 (+https://chefsire.com)",
        "accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch page (HTTP ${res.status}).`);
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("URL did not return an HTML page.");
    }

    const contentLength = parseInteger(res.headers.get("content-length"));
    if (contentLength && contentLength > 4 * 1024 * 1024) {
      throw new Error("Page is too large to import.");
    }

    const html = await res.text();
    if (html.length > 4_500_000) {
      throw new Error("Page is too large to import.");
    }

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

// --------------------------------------------------------------------------------------
// Route wrappers
// --------------------------------------------------------------------------------------

function getUploadedFile(req: any): Express.Multer.File | undefined {
  // multer.single("recipesFile") puts it on req.file
  if (req?.file) return req.file as Express.Multer.File;

  // fallback if frontend sends "file" and we later switch to .any()
  const files = req?.files as Record<string, Express.Multer.File[]> | Express.Multer.File[] | undefined;
  if (Array.isArray(files) && files[0]) return files[0];
  if (files && !Array.isArray(files)) {
    return files.recipesFile?.[0] || files.file?.[0];
  }

  return undefined;
}

function requireUserId(req: any): string {
  const userId = req?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

async function handlePaprikaLikeImport(
  req: any,
  res: any,
  source: "paprika" | "anylist",
) {
  try {
    requireUserId(req);

    const file = getUploadedFile(req);
    if (!file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" } satisfies ImportFailure);
    }

    const items = await parsePaprikaLikeFile(file, source);
    const result = await importNormalizedRecipes(items);
    return res.json(result);
  } catch (err: any) {
    console.error(`[Recipe Import] ${source} import error:`, err);
    const msg = err?.message || "Import failed";
    const status = /auth/i.test(msg) ? 401 : 400;
    return res.status(status).json({ ok: false, error: msg } satisfies ImportFailure);
  }
}

async function handlePlanToEatImport(req: any, res: any) {
  try {
    requireUserId(req);

    const file = getUploadedFile(req);
    if (!file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" } satisfies ImportFailure);
    }

    const items = await parsePlanToEatFile(file);
    const result = await importNormalizedRecipes(items);
    return res.json(result);
  } catch (err: any) {
    console.error("[Recipe Import] Plan to Eat import error:", err);
    const msg = err?.message || "Import failed";
    const status = /auth/i.test(msg) ? 401 : 400;
    return res.status(status).json({ ok: false, error: msg } satisfies ImportFailure);
  }
}

async function handleUrlImport(req: any, res: any) {
  try {
    requireUserId(req);

    const rawUrl = sanitizeText(req?.body?.url);
    if (!rawUrl) {
      return res.status(400).json({ ok: false, error: "Please provide a URL." } satisfies ImportFailure);
    }

    const url = normalizeImportUrl(rawUrl);
    const html = await fetchPublicRecipeHtml(url);
    const recipeObj = pickRecipeJsonLd(html);

    if (!recipeObj) {
      return res.status(400).json({
        ok: false,
        error: "Could not find recipe structured data on that page. Try another recipe URL.",
      } satisfies ImportFailure);
    }

    const item = mapJsonLdRecipeToNormalized(recipeObj, url);
    const result = await importNormalizedRecipes([item]);
    return res.json(result);
  } catch (err: any) {
    console.error("[Recipe Import] URL import error:", err);
    const msg = err?.message || "URL import failed";
    const status = /auth/i.test(msg) ? 401 : 400;
    return res.status(status).json({ ok: false, error: msg } satisfies ImportFailure);
  }
}

// --------------------------------------------------------------------------------------
// Routes
// --------------------------------------------------------------------------------------

// Paprika export (.paprikarecipes)
router.post(
  "/import-paprika",
  requireAuth,
  upload.single("recipesFile"),
  async (req, res) => {
    await handlePaprikaLikeImport(req, res, "paprika");
  }
);

// AnyList export (same .paprikarecipes-style format support via alias)
router.post(
  "/import-anylist",
  requireAuth,
  upload.single("recipesFile"),
  async (req, res) => {
    await handlePaprikaLikeImport(req, res, "anylist");
  }
);

// Plan to Eat export (.csv / .txt)
router.post(
  "/import-plan-to-eat",
  requireAuth,
  upload.single("recipesFile"),
  async (req, res) => {
    await handlePlanToEatImport(req, res);
  }
);

// Public URL recipe import (JSON-LD schema.org Recipe)
router.post(
  "/import-url",
  requireAuth,
  async (req, res) => {
    await handleUrlImport(req, res);
  }
);

export default router;
