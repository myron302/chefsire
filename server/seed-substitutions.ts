// server/seed-substitutions.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";

import {
  substitutionIngredients,
  substitutions,
} from "../shared/schema.js";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`${name} is missing. Set it in server/.env`);
  return v;
}

const DATABASE_URL = reqEnv("DATABASE_URL");
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

// ---- dataset discovery ----
const candidateFiles = [
  path.join(process.cwd(), "server/data/substitutions_seed_consolidated.jsonl"),
  path.join(process.cwd(), "server/data/substitutions_seed_consolidated.ndjson"),
  path.join(process.cwd(), "data/substitutions_seed_consolidated.jsonl"),
  path.join(process.cwd(), "data/substitutions_seed_consolidated.ndjson"),
];
const datasetPath = candidateFiles.find((p) => fs.existsSync(p));

type Component = { item: string; amount?: number; unit?: string; note?: string };
type Method = { action?: string; time_min?: number; time_max?: number; temperature?: string };
type SubRow = {
  text: string;
  components: Component[];
  method?: Method;
  context?: string;
  diet_tags?: string[];
  allergen_flags?: string[];
  signature?: string;
  signature_hash?: string;
  variants?: any[];
  provenance?: any[];
};
type Line = {
  ingredient: string;
  subs: SubRow[];
};

function normalizeIngredientForCompare(name: string) {
  const withoutParentheticals = name.replace(/\([^)]*\)/g, " ");
  return withoutParentheticals
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"[\]\\?<>+|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ingredientIdByExactName = new Map<string, string>();
const ingredientIdByNormalizedName = new Map<string, string>();
let ingredientLookupLoaded = false;

async function loadIngredientLookup() {
  if (ingredientLookupLoaded) return;

  const rows = await db
    .select({
      id: substitutionIngredients.id,
      ingredient: substitutionIngredients.ingredient,
    })
    .from(substitutionIngredients);

  for (const row of rows) {
    const ingredientName = String(row.ingredient || "").replace(/\s+/g, " ").trim();
    if (!ingredientName) continue;
    if (!ingredientIdByExactName.has(ingredientName)) {
      ingredientIdByExactName.set(ingredientName, row.id);
    }

    const normalized = normalizeIngredientForCompare(ingredientName);
    if (normalized && !ingredientIdByNormalizedName.has(normalized)) {
      ingredientIdByNormalizedName.set(normalized, row.id);
    }
  }

  ingredientLookupLoaded = true;
}

// helpers
async function getOrCreateIngredientId(name: string) {
  await loadIngredientLookup();

  const exactCached = ingredientIdByExactName.get(name);
  if (exactCached) return exactCached;

  const normalized = normalizeIngredientForCompare(name);
  const normalizedCached = normalized ? ingredientIdByNormalizedName.get(normalized) : null;
  if (normalizedCached) return normalizedCached;

  const found = await db
    .select({ id: substitutionIngredients.id })
    .from(substitutionIngredients)
    .where(eq(substitutionIngredients.ingredient, name))
    .limit(1);
  if (found[0]?.id) {
    ingredientIdByExactName.set(name, found[0].id);
    if (normalized) ingredientIdByNormalizedName.set(normalized, found[0].id);
    return found[0].id;
  }

  const inserted = await db
    .insert(substitutionIngredients)
    .values({
      ingredient: name,
      aliases: [],
      group: "",
      pantryArea: "",
      notes: "",
      source: "",
    })
    .returning({ id: substitutionIngredients.id });

  ingredientIdByExactName.set(name, inserted[0].id);
  if (normalized) ingredientIdByNormalizedName.set(normalized, inserted[0].id);
  return inserted[0].id;
}

function hashSignature(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function seedFromJsonl(filePath: string) {
  console.log(`📄 Using dataset: ${filePath}`);

  // Optional: clear existing rows (comment out if you want append-only)
  // console.log("🧹 Clearing existing substitutions…");
  // await db.execute(sql`TRUNCATE TABLE ${substitutions} RESTART IDENTITY CASCADE;`);
  // await db.execute(sql`TRUNCATE TABLE ${substitutionIngredients} RESTART IDENTITY CASCADE;`);

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  const batchSize = 500;
  let pending: Parameters<typeof db.insert>[0][] = [];
  let totalInserted = 0;
  let totalSeen = 0;
  let totalLines = 0;

  async function flush() {
    if (pending.length === 0) return;
    try {
      await db.insert(substitutions).values(pending as any).onConflictDoNothing();
      totalInserted += pending.length;
    } catch (e: any) {
      // best-effort: if batch fails, try row-by-row to salvage
      for (const row of pending) {
        try {
          await db.insert(substitutions).values(row as any).onConflictDoNothing();
          totalInserted += 1;
        } catch {
          /* ignore dup/violations */
        }
      }
    } finally {
      pending = [];
      process.stdout.write(`\rInserted: ${totalInserted} (processed ${totalSeen} subs across ${totalLines} lines)…`);
    }
  }

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;
    totalLines += 1;

    let parsed: Line;
    try {
      parsed = JSON.parse(line);
    } catch {
      console.warn(`Skipping malformed JSON line ${totalLines}`);
      continue;
    }

    const ingredientName = (parsed.ingredient || "").trim();
    if (!ingredientName || !Array.isArray(parsed.subs)) continue;

    const ingredientId = await getOrCreateIngredientId(ingredientName);

    for (const sub of parsed.subs) {
      totalSeen += 1;
      const text = (sub.text || "").trim();
      const components = Array.isArray(sub.components) ? sub.components : [];
      const method = sub.method ?? {};
      const context = sub.context ?? "";
      const dietTags = Array.isArray(sub.diet_tags) ? sub.diet_tags : [];
      const allergenFlags = Array.isArray(sub.allergen_flags) ? sub.allergen_flags : [];
      const variants = Array.isArray(sub.variants) ? sub.variants : [];
      const provenance = Array.isArray(sub.provenance) ? sub.provenance : [];

      // signature may or may not be present; ensure we have a stable one
      const signature = sub.signature || text;
      const signatureHash = sub.signature_hash || hashSignature(signature);

      pending.push({
        ingredientId,
        text,
        components,
        method,
        ratio: "",
        context,
        dietTags,
        allergenFlags,
        signature,
        signatureHash,
        variants,
        provenance,
      } as any);

      if (pending.length >= batchSize) {
        await flush();
      }
    }
  }

  await flush();
  console.log(`\n✅ Done. Inserted ${totalInserted} substitution rows.`);
}

(async function main() {
  try {
    if (!datasetPath) {
      console.error(
        "❌ No dataset found. Place your JSONL/NDJSON file at one of these paths:\n" +
          candidateFiles.map((p) => " - " + p).join("\n")
      );
      process.exit(1);
    }
    await seedFromJsonl(datasetPath);
  } catch (error) {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
