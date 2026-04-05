import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

type JsonObject = Record<string, unknown>;

type Substitution = {
  text: string;
  signature_hash?: string;
  provenance?: unknown[];
  [key: string]: unknown;
};

type DatasetRow = {
  ingredient: string;
  subs: Substitution[];
};

type IngredientBucket = {
  ingredient: string;
  subs: Substitution[];
  seenText: Set<string>;
  seenHash: Set<string>;
};

const CURATED_INPUT = path.join(
  process.cwd(),
  "server/data/substitutions_seed_consolidated .jsonl"
);
const IMPORTED_INPUT = path.join(
  process.cwd(),
  "server/data/substitutions_from_pairs.jsonl"
);
const OUTPUT_FILE = path.join(
  process.cwd(),
  "server/data/substitutions_merged.jsonl"
);

function normalizeIngredient(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeSubText(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function toSubstitution(value: unknown): Substitution | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as JsonObject;
  const text = typeof candidate.text === "string" ? candidate.text : "";
  if (!text.trim()) {
    return null;
  }

  return {
    ...candidate,
    text: text.trim(),
    signature_hash:
      typeof candidate.signature_hash === "string"
        ? candidate.signature_hash
        : undefined,
    provenance: Array.isArray(candidate.provenance)
      ? candidate.provenance
      : undefined,
  };
}

function parseRow(line: string): DatasetRow | null {
  const parsed = JSON.parse(line) as JsonObject;

  if (typeof parsed.ingredient === "string" && Array.isArray(parsed.subs)) {
    const subs = parsed.subs.map(toSubstitution).filter(Boolean) as Substitution[];
    return { ingredient: parsed.ingredient, subs };
  }

  if (typeof parsed.name === "string" && Array.isArray(parsed.substitutions)) {
    const subs = parsed.substitutions
      .filter((entry) => typeof entry === "string")
      .map((entry) => ({ text: String(entry).trim() }))
      .filter((entry) => entry.text.length > 0);

    return {
      ingredient: parsed.name,
      subs,
    };
  }

  return null;
}

function ensureBucket(
  map: Map<string, IngredientBucket>,
  normalizedIngredient: string
): IngredientBucket {
  let bucket = map.get(normalizedIngredient);
  if (!bucket) {
    bucket = {
      ingredient: normalizedIngredient,
      subs: [],
      seenText: new Set<string>(),
      seenHash: new Set<string>(),
    };
    map.set(normalizedIngredient, bucket);
  }

  return bucket;
}

function addSubstitution(
  bucket: IngredientBucket,
  sub: Substitution,
  source: "curated" | "imported"
): { kept: boolean; duplicate: boolean } {
  const normalizedText = normalizeSubText(sub.text);
  const signatureHash = (sub.signature_hash ?? "").trim();

  const isDuplicateByText = normalizedText.length > 0 && bucket.seenText.has(normalizedText);
  const isDuplicateByHash = signatureHash.length > 0 && bucket.seenHash.has(signatureHash);

  if (isDuplicateByText || isDuplicateByHash) {
    return { kept: false, duplicate: true };
  }

  const outputSub: Substitution = {
    ...sub,
    text: sub.text.trim(),
  };

  if (source === "imported" && outputSub.provenance && !Array.isArray(outputSub.provenance)) {
    delete outputSub.provenance;
  }

  bucket.subs.push(outputSub);
  if (normalizedText.length > 0) {
    bucket.seenText.add(normalizedText);
  }
  if (signatureHash.length > 0) {
    bucket.seenHash.add(signatureHash);
  }

  return { kept: true, duplicate: false };
}

async function loadDataset(
  filePath: string,
  source: "curated" | "imported",
  map: Map<string, IngredientBucket>
) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing input file: ${filePath}`);
  }

  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let importedKept = 0;
  let importedRejected = 0;
  let duplicatesRemoved = 0;

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const row = parseRow(line);
    if (!row) {
      continue;
    }

    const normalizedIngredient = normalizeIngredient(row.ingredient);
    if (!normalizedIngredient) {
      continue;
    }

    const bucket = ensureBucket(map, normalizedIngredient);

    for (const sub of row.subs) {
      const result = addSubstitution(bucket, sub, source);
      if (!result.kept && result.duplicate) {
        duplicatesRemoved += 1;
      }

      if (source === "imported") {
        if (result.kept) {
          importedKept += 1;
        } else {
          importedRejected += 1;
        }
      }
    }
  }

  return { importedKept, importedRejected, duplicatesRemoved };
}

function writeOutput(map: Map<string, IngredientBucket>) {
  const ingredients = Array.from(map.values()).sort((a, b) =>
    a.ingredient.localeCompare(b.ingredient)
  );

  const lines = ingredients.map((bucket) =>
    JSON.stringify({ ingredient: bucket.ingredient, subs: bucket.subs })
  );

  fs.writeFileSync(OUTPUT_FILE, lines.join("\n") + "\n", "utf8");

  const totalSubstitutions = ingredients.reduce(
    (sum, bucket) => sum + bucket.subs.length,
    0
  );

  return {
    totalIngredients: ingredients.length,
    totalSubstitutions,
  };
}

async function main() {
  const buckets = new Map<string, IngredientBucket>();

  const curatedStats = await loadDataset(CURATED_INPUT, "curated", buckets);
  const importedStats = await loadDataset(IMPORTED_INPUT, "imported", buckets);

  const outputStats = writeOutput(buckets);

  const duplicatesRemoved =
    curatedStats.duplicatesRemoved + importedStats.duplicatesRemoved;

  console.log(`total ingredients: ${outputStats.totalIngredients}`);
  console.log(`total substitutions: ${outputStats.totalSubstitutions}`);
  console.log(`imported kept: ${importedStats.importedKept}`);
  console.log(`imported rejected: ${importedStats.importedRejected}`);
  console.log(`duplicates removed: ${duplicatesRemoved}`);
  console.log(`wrote: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
