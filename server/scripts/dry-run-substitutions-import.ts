import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { and, eq, sql } from "drizzle-orm";

import {
  substitutionIngredients,
  substitutions,
} from "../../shared/schema.js";

type Component = { item: string; amount?: number; unit?: string; note?: string };
type Method = { action?: string; time_min?: number; time_max?: number; temperature?: string };
type SubRow = {
  text: string;
  components?: Component[];
  method?: Method;
  context?: string;
  diet_tags?: string[];
  allergen_flags?: string[];
  signature?: string;
  signature_hash?: string;
  variants?: unknown[];
  provenance?: unknown[];
};
type Line = {
  ingredient: string;
  subs: SubRow[];
};

type Counters = {
  linesRead: number;
  subsSeen: number;
  wouldInsert: number;
  wouldSkipExisting: number;
  wouldUpdateIfSafeUpsertExists: number;
  possibleConflicts: number;
  missingIngredientRows: number;
  malformedLines: number;
};

const hadDatabaseUrlInProcessEnv = !!process.env.DATABASE_URL?.trim();
await import("../lib/load-env");
const databaseUrlSource = hadDatabaseUrlInProcessEnv
  ? "existing process env"
  : process.env.DATABASE_URL?.trim()
    ? "dotenv/env file loading"
    : "not found";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `${name} is missing. Set it in process env (e.g., Plesk Node.js environment variables) or /httpdocs/server/.env`
    );
  }
  return v;
}

function hashSignature(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function normIngredient(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

function normalizeIngredientForCompare(name: string) {
  return name
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"[\]\\?<>+|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const datasetPath = path.resolve("server/data/substitutions_merged.jsonl");

console.log(
  `[dry-run-substitutions-import] DATABASE_URL source: ${databaseUrlSource}`
);
const DATABASE_URL = reqEnv("DATABASE_URL");
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function findIngredientIdByName(ingredientName: string) {
  const rows = await db
    .select({ id: substitutionIngredients.id })
    .from(substitutionIngredients)
    .where(eq(substitutionIngredients.ingredient, ingredientName))
    .limit(1);

  return rows[0]?.id ?? null;
}

async function readExistingBySignatureHash(ingredientId: string, signatureHash: string) {
  const rows = await db
    .select({
      id: substitutions.id,
      text: substitutions.text,
      signature: substitutions.signature,
      signatureHash: substitutions.signatureHash,
      context: substitutions.context,
      components: substitutions.components,
      method: substitutions.method,
      dietTags: substitutions.dietTags,
      allergenFlags: substitutions.allergenFlags,
      variants: substitutions.variants,
      provenance: substitutions.provenance,
    })
    .from(substitutions)
    .where(and(
      eq(substitutions.ingredientId, ingredientId),
      eq(substitutions.signatureHash, signatureHash),
    ))
    .limit(1);

  return rows[0] ?? null;
}

async function readLiveDbIngredientDiagnostics() {
  const substitutionIngredientCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(substitutionIngredients);
  const substitutionsCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(substitutions);

  const dbIngredientRows = await db
    .select({ ingredient: substitutionIngredients.ingredient })
    .from(substitutionIngredients);

  return {
    substitutionIngredientsCount: Number(substitutionIngredientCountRows[0]?.count ?? 0),
    substitutionsCount: Number(substitutionsCountRows[0]?.count ?? 0),
    dbIngredients: dbIngredientRows.map((row) => String(row.ingredient || "")),
  };
}

async function readDatasetIngredients() {
  const datasetIngredientSet = new Set<string>();
  const rl = readline.createInterface({
    input: fs.createReadStream(datasetPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as Partial<Line>;
      const ingredient = normIngredient(String(parsed.ingredient || ""));
      if (ingredient) datasetIngredientSet.add(ingredient);
    } catch {
      // ignore malformed lines for diagnostics
    }
  }

  return [...datasetIngredientSet];
}

function printIngredientMatchingDiagnostics(dbIngredients: string[], datasetIngredients: string[]) {
  const dbIngredientSet = new Set(dbIngredients);
  const normalizedDbIngredients = new Map<string, string[]>();

  for (const ingredient of dbIngredients) {
    const normalized = normalizeIngredientForCompare(ingredient);
    if (!normalized) continue;
    const existing = normalizedDbIngredients.get(normalized) ?? [];
    existing.push(ingredient);
    normalizedDbIngredients.set(normalized, existing);
  }

  let exactMatches = 0;
  let normalizedMatches = 0;
  const missingEvenAfterNormalization: string[] = [];
  const exactFailedNormalizedSucceededExamples: Array<{ dataset: string; db: string }> = [];

  for (const ingredient of datasetIngredients) {
    if (dbIngredientSet.has(ingredient)) {
      exactMatches += 1;
      normalizedMatches += 1;
      continue;
    }

    const normalized = normalizeIngredientForCompare(ingredient);
    const normalizedCandidates = normalizedDbIngredients.get(normalized) ?? [];
    if (normalizedCandidates.length > 0) {
      normalizedMatches += 1;
      if (exactFailedNormalizedSucceededExamples.length < 20) {
        exactFailedNormalizedSucceededExamples.push({
          dataset: ingredient,
          db: normalizedCandidates[0],
        });
      }
      continue;
    }

    missingEvenAfterNormalization.push(ingredient);
  }

  console.log("\n===== Live DB ingredient diagnostics =====");
  console.log(`substitution_ingredients rows: ${dbIngredients.length}`);
  console.log(`Sample substitution_ingredients ingredient names (up to 20): ${dbIngredients.slice(0, 20).join(", ") || "(none)"}`);
  console.log(`Sample substitutions_merged.jsonl ingredient names (up to 20): ${datasetIngredients.slice(0, 20).join(", ") || "(none)"}`);
  console.log(`Exact ingredient matches (dataset -> DB): ${exactMatches}`);
  console.log(`Normalized ingredient matches (dataset -> DB): ${normalizedMatches}`);
  console.log(`Dataset ingredients not found in DB after normalization: ${missingEvenAfterNormalization.length}`);
  console.log("Examples where exact match failed but normalized match succeeds (up to 20):");
  if (exactFailedNormalizedSucceededExamples.length === 0) {
    console.log("  (none)");
  } else {
    for (const example of exactFailedNormalizedSucceededExamples) {
      console.log(`  dataset="${example.dataset}" -> db="${example.db}"`);
    }
  }
}

function hasDataDifferences(existing: Awaited<ReturnType<typeof readExistingBySignatureHash>>, incoming: {
  text: string;
  signature: string;
  components: unknown;
  method: unknown;
  context: string;
  dietTags: unknown;
  allergenFlags: unknown;
  variants: unknown;
  provenance: unknown;
}) {
  if (!existing) return false;

  return (
    existing.text !== incoming.text ||
    existing.signature !== incoming.signature ||
    JSON.stringify(existing.components ?? []) !== JSON.stringify(incoming.components ?? []) ||
    JSON.stringify(existing.method ?? {}) !== JSON.stringify(incoming.method ?? {}) ||
    (existing.context ?? "") !== incoming.context ||
    JSON.stringify(existing.dietTags ?? []) !== JSON.stringify(incoming.dietTags ?? []) ||
    JSON.stringify(existing.allergenFlags ?? []) !== JSON.stringify(incoming.allergenFlags ?? []) ||
    JSON.stringify(existing.variants ?? []) !== JSON.stringify(incoming.variants ?? []) ||
    JSON.stringify(existing.provenance ?? []) !== JSON.stringify(incoming.provenance ?? [])
  );
}

async function runDryImportReport() {
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Dataset not found at ${datasetPath}`);
  }

  const liveDbDiagnostics = await readLiveDbIngredientDiagnostics();
  const datasetIngredients = await readDatasetIngredients();

  console.log("===== Live DB row counts =====");
  console.log(`substitution_ingredients rows: ${liveDbDiagnostics.substitutionIngredientsCount}`);
  console.log(`substitutions rows: ${liveDbDiagnostics.substitutionsCount}`);
  printIngredientMatchingDiagnostics(liveDbDiagnostics.dbIngredients, datasetIngredients);

  const counters: Counters = {
    linesRead: 0,
    subsSeen: 0,
    wouldInsert: 0,
    wouldSkipExisting: 0,
    wouldUpdateIfSafeUpsertExists: 0,
    possibleConflicts: 0,
    missingIngredientRows: 0,
    malformedLines: 0,
  };

  const ingredientIdCache = new Map<string, string | null>();

  const rl = readline.createInterface({
    input: fs.createReadStream(datasetPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  console.log("🧪 Dry-run substitution import");
  console.log(`📄 Dataset: ${datasetPath}`);
  console.log("🔐 Existing DB uniqueness key used for substitutions: (ingredient_id, signature_hash)");
  console.log("🔎 Existence check logic: ingredient exact match on substitution_ingredients.ingredient, then substitution match by signature_hash under that ingredient_id");

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    counters.linesRead += 1;

    let parsed: Line;
    try {
      parsed = JSON.parse(line);
    } catch {
      counters.malformedLines += 1;
      continue;
    }

    const ingredientName = normIngredient(parsed.ingredient || "");
    if (!ingredientName || !Array.isArray(parsed.subs)) continue;

    if (!ingredientIdCache.has(ingredientName)) {
      ingredientIdCache.set(ingredientName, await findIngredientIdByName(ingredientName));
    }
    const ingredientId = ingredientIdCache.get(ingredientName) ?? null;

    for (const sub of parsed.subs) {
      counters.subsSeen += 1;

      const text = String(sub.text || "").trim();
      const components = Array.isArray(sub.components) ? sub.components : [];
      const method = sub.method ?? {};
      const context = sub.context ?? "";
      const dietTags = Array.isArray(sub.diet_tags) ? sub.diet_tags : [];
      const allergenFlags = Array.isArray(sub.allergen_flags) ? sub.allergen_flags : [];
      const variants = Array.isArray(sub.variants) ? sub.variants : [];
      const provenance = Array.isArray(sub.provenance) ? sub.provenance : [];
      const signature = sub.signature || text;
      const signatureHash = sub.signature_hash || hashSignature(signature);

      if (!ingredientId) {
        counters.missingIngredientRows += 1;
        counters.wouldInsert += 1;
        continue;
      }

      const existing = await readExistingBySignatureHash(ingredientId, signatureHash);
      if (!existing) {
        counters.wouldInsert += 1;
        continue;
      }

      const incoming = {
        text,
        signature,
        components,
        method,
        context,
        dietTags,
        allergenFlags,
        variants,
        provenance,
      };

      const differs = hasDataDifferences(existing, incoming);
      if (!differs) {
        counters.wouldSkipExisting += 1;
        continue;
      }

      counters.wouldUpdateIfSafeUpsertExists += 1;
      counters.possibleConflicts += 1;
    }
  }

  console.log("\n===== Dry-run summary =====");
  console.log(`Lines read: ${counters.linesRead}`);
  console.log(`Malformed lines skipped: ${counters.malformedLines}`);
  console.log(`Substitutions seen: ${counters.subsSeen}`);
  console.log(`Would insert: ${counters.wouldInsert}`);
  console.log(`Would skip as already existing: ${counters.wouldSkipExisting}`);
  console.log(`Would update only if safe upsert logic exists: ${counters.wouldUpdateIfSafeUpsertExists}`);
  console.log(`Possible conflicts: ${counters.possibleConflicts}`);
  console.log(`Rows that would require creating missing ingredient records first: ${counters.missingIngredientRows}`);
  console.log("\nℹ️ This is a read-only dry run. No writes were executed.");
}

(async function main() {
  try {
    await runDryImportReport();
  } catch (error) {
    console.error("❌ Dry run failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
