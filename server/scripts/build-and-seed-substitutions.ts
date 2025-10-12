// server/scripts/build-and-seed-substitutions.ts
// ONE-SHOT: Parse your PDFs, paraphrase substitutions, dedupe, seed Neon via Drizzle.
// Usage (no args needed): 
//   node --loader tsx server/scripts/build-and-seed-substitutions.ts
//
// If you want to pass custom PDF paths, you can: 
//   node --loader tsx server/scripts/build-and-seed-substitutions.ts "/abs/path/A.pdf" "/abs/path/B.pdf"

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
const DEFAULT_PDFS = [
  // adjust if your files are elsewhere; missing files will be skipped
  "/var/www/vhosts/chefsire.com/httpdocs/server/data/dokumen.pub_the-food-substitutions-bible-more-than-6500-substitutions-for-ingredients-equipements-amp-techniques-2nbsped-9780778802457.pdf",
  "/var/www/vhosts/chefsire.com/httpdocs/server/data/Ingredient Substitutions and Equivalents.pdf",
  "/var/www/vhosts/chefsire.com/httpdocs/server/data/ingredient-substitutions.pdf",
  "/var/www/vhosts/chefsire.com/httpdocs/server/data/E131.pdf", // optional; will be skipped if not present
];

// ---------- Types ----------
type Component = { item: string; amount?: number; unit?: string; note?: string };
type SubRow = {
  text: string;
  components: Component[];
  method?: Record<string, any>;
  context?: string;
  dietTags?: string[];
  allergenFlags?: string[];
  signature?: string;
  signatureHash?: string;
  variants?: any[];
  provenance?: any[];
};

// ---------- Utilities ----------
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

// Split “3 tbsp cocoa + 1 tbsp butter” into components
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

// Heuristic extraction of (ingredient, substitution) pairs from page text
function extractPairs(txt: string): Array<{ ingredient: string; sub: string }> {
  const lines = txt
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const pairs: Array<{ ingredient: string; sub: string }> = [];

  // Pattern A: “Ingredient = substitution”
  for (const l of lines) {
    const m = l.match(/^(.+?)\s*=\s*(.+)$/);
    if (m) {
      const ingredient = m[1].trim();
      const sub = m[2].trim();
      if (!/^(ingredient|amount|substitute)$/i.test(ingredient)) {
        pairs.push({ ingredient, sub });
      }
    }
  }

  // Pattern B: two/three “columns” lines
  for (const l of lines) {
    const cells = l.split(/\s{2,}|\t/g).map((s) => s.trim()).filter(Boolean);
    if (cells.length === 2) {
      const [ingredient, sub] = cells;
      if (!/^(ingredient|amount|substitute)/i.test(ingredient) && /[a-z]/i.test(sub)) {
        pairs.push({ ingredient, sub });
      }
    } else if (cells.length === 3) {
      const [ingredient, _amount, sub] = cells;
      if (!/^(ingredient|amount|substitute)/i.test(ingredient) && /[a-z]/i.test(sub)) {
        pairs.push({ ingredient, sub });
      }
    }
  }

  // de-dupe within this text chunk
  const seen = new Set<string>();
  return pairs.filter(({ ingredient, sub }) => {
    const k = ingredient.toLowerCase() + "||" + sub.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Non-verbatim house style
function paraphrase(ingredient: string, subText: string): { text: string; context?: string } {
  const ctx = subText.match(/\(([^)]+)\)/)?.[1] ?? "";
  const cleaned = subText.replace(/\s*\([^)]*\)\s*$/, ""); // strip trailing (…) if any
  const components = toComponents(cleaned);
  const rebuilt =
    components.length > 0
      ? components
          .map((c) => {
            const amt = c.amount != null ? String(c.amount) : "";
            const unit = c.unit ? ` ${c.unit}` : "";
            const name = c.item;
            return (amt + unit).trim() ? `${amt}${unit} ${name}`.trim() : name;
          })
          .join(" + ")
      : cleaned;

  const ctxSuffix = ctx ? ` — context: ${ctx.toLowerCase()}` : "";
  const text = `Swap for ${ingredient}: ${rebuilt}${ctxSuffix}`;
  return { text, context: ctx || undefined };
}

async function requirePdfParse() {
  try {
    const pdfParse = (await import("pdf-parse")).default || (await import("pdf-parse"));
    return pdfParse;
  } catch {
    console.error("❌ Missing dev dependency 'pdf-parse'. Install it with:  npm i -D pdf-parse");
    process.exit(1);
  }
}

async function pdfToText(pdfParse: any, filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const data = await pdfParse(buf);
  return String(data.text || "");
}

// ---------- DB ----------
function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`${name} is missing. Set it in server/.env`);
  }
  return v;
}
const DATABASE_URL = reqEnv("DATABASE_URL");
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

// upsert ingredient by exact name (case-sensitive)
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

// insert substitution if signatureHash not seen
async function insertSubOnce(ingredientId: string, ingName: string, s: SubRow) {
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
      signature: s.signature!,
      signatureHash: s.signatureHash!,
      variants: s.variants ?? [],
      provenance: s.provenance ?? [],
    } satisfies InsertSubstitution);
    return 1;
  } catch (e: any) {
    // Unique constraint on signature_hash will throw if dup — ignore
    if (String(e?.message || "").toLowerCase().includes("duplicate key")) return 0;
    // also ignore “already exists” flavors
    if (String(e?.message || "").toLowerCase().includes("unique")) return 0;
    throw e;
  }
}

// ---------- Main ----------
(async function main() {
  console.log("🔎 Scanning PDFs and seeding substitutions…");

  const pdfArgs = process.argv.slice(2).filter((a) => a && !a.startsWith("-"));
  const pdfs = (pdfArgs.length ? pdfArgs : DEFAULT_PDFS).filter((p) => {
    const exists = fs.existsSync(p);
    if (!exists) console.warn(`⚠️  Missing PDF (skipping): ${p}`);
    return exists;
  });

  if (pdfs.length === 0) {
    console.error("❌ No PDFs found. Place your files at the DEFAULT_PDFS paths or pass absolute paths as args.");
    process.exit(1);
  }

  const pdfParse = await requirePdfParse();

  const byIngredient = new Map<string, Map<string, SubRow>>();
  let rawPairs = 0;

  for (const pdf of pdfs) {
    console.log(`📖 Reading: ${pdf}`);
    const text = await pdfToText(pdfParse, pdf);
    const pairs = extractPairs(text);
    rawPairs += pairs.length;

    for (const { ingredient, sub } of pairs) {
      const ing = ingredient.replace(/\s+/g, " ").trim();
      const { text: paraphrased, context } = paraphrase(ing, sub);
      const components = toComponents(sub.replace(/\s*\([^)]*\)\s*$/, ""));

      const signature = `${ing.toLowerCase()} | ${paraphrased.toLowerCase()}`;
      const signatureHash = sha256(signature);

      if (!byIngredient.has(ing)) byIngredient.set(ing, new Map());
      const subsMap = byIngredient.get(ing)!;
      if (!subsMap.has(signatureHash)) {
        subsMap.set(signatureHash, {
          text: paraphrased,
          components,
          method: {},
          context,
          dietTags: [],
          allergenFlags: [],
          signature,
          signatureHash,
          variants: [],
          provenance: [{ file: path.basename(pdf) }],
        });
      }
    }
  }

  console.log(`🧮 Collated raw pairs: ${rawPairs}`);
  // Insert into DB
  let inserted = 0;
  let ingCount = 0;

  for (const [ingredient, subsMap] of byIngredient) {
    const ingredientId = await getOrCreateIngredientId(ingredient);
    ingCount++;
    for (const sub of subsMap.values()) {
      inserted += await insertSubOnce(ingredientId, ingredient, sub);
    }
  }

  console.log(`✅ Done. Ingredients upserted: ${ingCount}, substitutions inserted: ${inserted}`);
  await pool.end();
})().catch(async (e) => {
  console.error("❌ Build/seed failed:", e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
