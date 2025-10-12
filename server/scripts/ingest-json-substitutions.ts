// server/scripts/ingest-json-substitutions.ts
import "./lib/load-env";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import {
  substitutionIngredients,
  substitutions,
  type InsertSubstitutionIngredient,
  type InsertSubstitution,
} from "../../shared/schema.js";

// ---------- Config ----------
const DATA_DIR = path.resolve("server/data/substitutions");
const GLOB = /\.json$/i; // we'll also try NDJSON with .json files

// ---------- Types ----------
type Component = { item: string; amount?: number; unit?: string; note?: string };

type BasicACItem = { ingredient: string; aka?: string[]; subs: string[] };
type NdjsonRich = {
  ingredient: string;
  subs: Array<{
    text: string;
    components?: Component[];
    method?: Record<string, any>;
    context?: string;
    diet_tags?: string[];
    allergen_flags?: string[];
    signature?: string;
    signature_hash?: string;
    signatureHash?: string;
    variants?: any[];
    provenance?: any[];
  }>;
};
type NdjsonSimple = { name: string; substitutions: string[] };

// ---------- Utils ----------
const pool = new Pool({ connectionString: reqEnv("DATABASE_URL") });
const db = drizzle(pool);

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`${name} is missing. Set it in server/.env`);
  return v;
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function toNumber(f: string): number | undefined {
  const t = f.trim();
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    if (b) return a / b;
  }
  const n = Number(t);
  return isFinite(n) ? n : undefined;
}

const UNIT_WORDS =
  "(?:tsp|teaspoon(?:s)?|tbsp|tablespoon(?:s)?|cup(?:s)?|oz|ounce(?:s)?|lb|pound(?:s)?|g|kg|ml|l|liter(?:s)?|pinch|dash)";
const AMT = "(?:\\d+(?:\\.\\d+)?|\\d+\\/\\d+)";
const RE_AMT_UNIT = new RegExp(`^\\s*(${AMT})\\s*(${UNIT_WORDS})?\\s+(.*)$`, "i");

function toComponents(subText: string): Component[] {
  const parts = subText
    .split(/\s*\+\s*|,\s*(?=\d|\b(?:plus|and)\b)/gi)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: Component[] = [];
  for (const p of parts) {
    const m = p.match(RE_AMT_UNIT);
    if (m) {
      const amt = toNumber(m[1]!);
      const unit = (m[2] || "").trim() || undefined;
      const item = m[3].trim();
      out.push({ item, amount: amt, unit });
    } else {
      out.push({ item: p });
    }
  }
  return out;
}

function normIng(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

function makeSignature(ingredient: string, text: string, components?: Component[]) {
  const compStr = components?.map(c => `${(c.amount ?? "").toString()} ${c.unit ?? ""} ${c.item}`.trim()).join(" + ") ?? "";
  const base = (text || compStr || "").toLowerCase().trim();
  return `${ingredient.toLowerCase()} | ${base}`;
}

// ---------- DB helpers ----------
async function getOrCreateIngredientId(name: string) {
  const existing = await db
    .select({ id: substitutionIngredients.id })
    .from(substitutionIngredients)
    .where(eq(substitutionIngredients.ingredient, name))
    .limit(1);

  if (existing[0]?.id) return existing[0].id;

  const inserted = await db
    .insert(substitutionIngredients)
    .values({ ingredient: name, aliases: [] } satisfies InsertSubstitutionIngredient)
    .returning({ id: substitutionIngredients.id });

  return inserted[0]!.id;
}

async function insertSubOnce(ingredientId: string, s: {
  text: string;
  components: Component[];
  method?: Record<string, any>;
  context?: string | null;
  dietTags?: string[];
  allergenFlags?: string[];
  signature: string;
  signatureHash: string;
  variants?: any[];
  provenance?: any[];
}) {
  try {
    await db.insert(substitutions).values({
      ingredientId,
      text: s.text,
      components: s.components,
      method: s.method ?? {},
      ratio: null,
      context: s.context ?? null,
      dietTags: s.dietTags ?? [],
      allergenFlags: s.allergenFlags ?? [],
      signature: s.signature,
      signatureHash: s.signatureHash,
      variants: s.variants ?? [],
      provenance: s.provenance ?? [],
    } satisfies InsertSubstitution);
    return 1;
  } catch (e: any) {
    const msg = String(e?.message || "").toLowerCase();
    if (msg.includes("duplicate key") || msg.includes("unique")) return 0;
    throw e;
  }
}

// ---------- Parsers for file shapes ----------
function tryParseJsonArray(file: string): BasicACItem[] | null {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const j = JSON.parse(raw);
    if (Array.isArray(j)) return j as BasicACItem[];
  } catch {}
  return null;
}

function parseNdjson<T = any>(file: string): T[] {
  const items: T[] = [];
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    try {
      items.push(JSON.parse(l));
    } catch {}
  }
  return items;
}

async function ingestArrayJson(file: string) {
  const arr = tryParseJsonArray(file);
  if (!arr) return 0;

  let ing = 0, subs = 0;
  for (const item of arr) {
    if (!item?.ingredient || !Array.isArray(item.subs)) continue;
    const ingName = normIng(item.ingredient);
    const ingredientId = await getOrCreateIngredientId(ingName);
    ing++;

    for (const s of item.subs) {
      const text = String(s).trim();
      if (!text) continue;
      const components = toComponents(text);
      const signature = makeSignature(ingName, text, components);
      const signatureHash = sha256(signature);

      subs += await insertSubOnce(ingredientId, {
        text,
        components,
        method: {},
        context: null,
        dietTags: [],
        allergenFlags: [],
        signature,
        signatureHash,
        variants: [],
        provenance: [{ file: path.basename(file) }],
      });
    }
  }
  console.log(`→ ${path.basename(file)}: upserted ${ing} ingredients, ${subs} subs`);
  return subs;
}

async function ingestNdjsonRich(file: string) {
  const lines = parseNdjson<NdjsonRich>(file);
  let ing = 0, subs = 0;
  for (const row of lines) {
    if (!row?.ingredient || !Array.isArray(row.subs)) continue;
    const ingName = normIng(row.ingredient);
    const ingredientId = await getOrCreateIngredientId(ingName);
    ing++;

    for (const sub of row.subs) {
      const text = String(sub.text || "").trim();
      const components = sub.components ?? toComponents(text);
      const signature = sub.signature || makeSignature(ingName, text, components);
      const signatureHash = sub.signatureHash || sub.signature_hash || sha256(signature);

      subs += await insertSubOnce(ingredientId, {
        text,
        components,
        method: sub.method ?? {},
        context: (sub as any).context ?? null,
        dietTags: (sub as any).diet_tags ?? [],
        allergenFlags: (sub as any).allergen_flags ?? [],
        signature,
        signatureHash,
        variants: sub.variants ?? [],
        provenance: [{ file: path.basename(file) }],
      });
    }
  }
  console.log(`→ ${path.basename(file)}: upserted ${ing} ingredients, ${subs} subs`);
  return subs;
}

async function ingestNdjsonSimple(file: string) {
  const lines = parseNdjson<NdjsonSimple>(file);
  let ing = 0, subs = 0;
  for (const row of lines) {
    if (!row?.name || !Array.isArray(row.substitutions)) continue;
    const ingName = normIng(row.name);
    const ingredientId = await getOrCreateIngredientId(ingName);
    ing++;

    for (const s of row.substitutions) {
      const text = String(s).trim();
      if (!text) continue;
      const components = toComponents(text);
      const signature = makeSignature(ingName, text, components);
      const signatureHash = sha256(signature);

      subs += await insertSubOnce(ingredientId, {
        text,
        components,
        method: {},
        context: null,
        dietTags: [],
        allergenFlags: [],
        signature,
        signatureHash,
        variants: [],
        provenance: [{ file: path.basename(file) }],
      });
    }
  }
  console.log(`→ ${path.basename(file)}: upserted ${ing} ingredients, ${subs} subs`);
  return subs;
}

// ---------- Main ----------
(async function main() {
  console.log("📦 Ingesting JSON/NDJSON substitutions from", DATA_DIR);
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => GLOB.test(f)).sort();
  if (files.length === 0) {
    console.error("❌ No .json files found.");
    process.exit(1);
  }

  let total = 0;
  for (const f of files) {
    const full = path.join(DATA_DIR, f);

    // Try array JSON first (your seed-A-C.json):
    const asArray = tryParseJsonArray(full);
    if (asArray) {
      total += await ingestArrayJson(full);
      continue;
    }

    // Otherwise treat as NDJSON; try rich then simple:
    const sample = fs.readFileSync(full, "utf8").trim().split(/\r?\n/)[0] || "";
    if (sample.includes('"subs":[') || sample.includes('"subs": [')) {
      total += await ingestNdjsonRich(full);
    } else if (sample.includes('"substitutions":')) {
      total += await ingestNdjsonSimple(full);
    } else {
      // Fallback: attempt rich first
      try {
        total += await ingestNdjsonRich(full);
      } catch {
        total += await ingestNdjsonSimple(full);
      }
    }
  }

  console.log(`✅ Done. Inserted/kept ${total} substitutions (dedupe-safe).`);
  await pool.end();
})().catch(async (e) => {
  console.error("❌ Ingestion failed:", e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
