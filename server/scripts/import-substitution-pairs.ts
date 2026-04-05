import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";

type RawPair = {
  ingredient: string | null;
  substitution: string | null;
  ingredient_original_id?: string | null;
  substitution_original_id?: string | null;
  ingredient_processed_id?: string | null;
  substitution_processed_id?: string | null;
};

type Component = {
  item: string;
  amount?: number;
  unit?: string;
  note?: string;
};

type OutputSub = {
  text: string;
  components: Component[];
  method: Record<string, unknown>;
  context: string;
  diet_tags: string[];
  allergen_flags: string[];
  quality_score: number;
  signature: string;
  signature_hash: string;
  variants: unknown[];
  provenance: Array<Record<string, unknown>>;
};

type OutputRow = {
  ingredient: string;
  subs: OutputSub[];
};

const INPUT_FILE = path.join(
  process.cwd(),
  "server/data/substitution_pairs.json"
);

const OUTPUT_FILE = path.join(
  process.cwd(),
  "server/data/substitutions_from_pairs.jsonl"
);

const BAD_EXACT_SUBSTITUTIONS = new Set([
  "crushed",
  "chopped",
  "juice",
  "prepared",
  "fresh",
  "dried",
  "cooked",
  "can",
  "whipped",
  "clove",
]);

const BAD_EXACT_INGREDIENTS = new Set([
  "",
  "ingredient",
  "substitution",
]);

const BAD_PAIR_DENYLIST = new Set([
  "tea bag=>corn syrup",
  "sugar=>lemon",
  "butter=>almond",
  "corn oil=>broccoli",
  "onion powder=>bacon",
  "broccoli=>pasta",
]);

const SUSPICIOUS_GENERIC_WORDS = new Set([
  "mix",
  "sauce",
  "seasoning",
  "powder",
  "extract",
  "crumb",
  "crumbs",
  "oil",
  "milk",
  "cream",
  "broth",
  "fruit",
  "vegetable",
  "meat",
]);

const BAKING_TERMS = [
  "flour",
  "cake flour",
  "bread flour",
  "cornstarch",
  "arrowroot",
  "tapioca",
  "starch",
  "baking powder",
  "baking soda",
  "yeast",
  "cocoa",
  "breadcrumb",
  "bread crumb",
  "cracker crumb",
  "shortening",
];

const DAIRY_TERMS = [
  "milk",
  "cream",
  "half and half",
  "buttermilk",
  "yogurt",
  "butter",
  "cheese",
  "sour cream",
  "evaporated milk",
  "condensed milk",
  "ghee",
];

const SEASONING_TERMS = [
  "herb",
  "spice",
  "seed",
  "mint",
  "parsley",
  "cilantro",
  "oregano",
  "thyme",
  "rosemary",
  "sage",
  "basil",
  "dill",
  "fennel",
  "anise",
  "nutmeg",
  "cinnamon",
  "clove",
  "pepper",
  "paprika",
  "cumin",
  "coriander",
  "bay leaf",
  "seasoning",
];

const PROTEIN_TERMS = [
  "beef",
  "chicken",
  "pork",
  "lamb",
  "turkey",
  "duck",
  "ham",
  "bacon",
  "fish",
  "shrimp",
  "crab",
  "lobster",
  "tofu",
  "tempeh",
  "bean",
  "lentil",
  "egg",
];

const PRODUCE_TERMS = [
  "onion",
  "garlic",
  "celery",
  "broccoli",
  "spinach",
  "lettuce",
  "tomato",
  "pepper",
  "peppercorn",
  "carrot",
  "cabbage",
  "mushroom",
  "zucchini",
  "squash",
  "apple",
  "banana",
  "lemon",
  "lime",
  "orange",
  "fruit",
];

const GRAIN_TERMS = [
  "rice",
  "pasta",
  "noodle",
  "bread",
  "oat",
  "barley",
  "quinoa",
  "couscous",
  "cracker",
  "breadcrumb",
  "bread crumb",
  "flour",
];

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[%(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function classifyFoodType(text: string): string {
  if (containsAny(text, BAKING_TERMS)) return "baking";
  if (containsAny(text, DAIRY_TERMS)) return "dairy";
  if (containsAny(text, SEASONING_TERMS)) return "seasoning";
  if (containsAny(text, PROTEIN_TERMS)) return "protein";
  if (containsAny(text, PRODUCE_TERMS)) return "produce";
  if (containsAny(text, GRAIN_TERMS)) return "grain";
  return "general";
}

function inferContext(ingredient: string, substitution: string): string {
  const joined = `${ingredient} ${substitution}`;

  if (containsAny(joined, BAKING_TERMS)) return "baking";
  if (containsAny(joined, DAIRY_TERMS)) return "dairy";
  if (containsAny(joined, SEASONING_TERMS)) return "seasoning";
  return "general";
}

function isSingleWord(text: string): boolean {
  return text.split(/\s+/).filter(Boolean).length === 1;
}

function looksOverlyGeneric(substitution: string): boolean {
  if (!substitution) return true;
  if (BAD_EXACT_SUBSTITUTIONS.has(substitution)) return true;
  if (substitution.length <= 2) return true;
  if (/^(fresh|dried|prepared|crushed|chopped|cooked)\b/.test(substitution)) return true;
  if (/^(whole|sliced|diced|minced|ground|grated)\b$/.test(substitution)) return true;
  return false;
}

function isBadPair(ingredient: string, substitution: string): boolean {
  if (!ingredient || !substitution) return true;
  if (BAD_EXACT_INGREDIENTS.has(ingredient) || BAD_EXACT_INGREDIENTS.has(substitution))
    return true;
  if (ingredient === substitution) return true;
  if (looksOverlyGeneric(substitution)) return true;
  if (BAD_PAIR_DENYLIST.has(`${ingredient}=>${substitution}`)) return true;
  return false;
}

function scorePair(ingredient: string, substitution: string): number {
  let score = 1.0;

  if (substitution.length < 4) score -= 0.2;
  if (isSingleWord(substitution) && SUSPICIOUS_GENERIC_WORDS.has(substitution)) score -= 0.3;
  if (/^(fresh|dried|prepared|cooked|plain|whole)\b/.test(substitution)) score -= 0.1;
  if (/\b(or|and\/or)\b/.test(substitution)) score -= 0.1;
  if (/\d/.test(substitution)) score -= 0.05;

  const ingredientType = classifyFoodType(ingredient);
  const substitutionType = classifyFoodType(substitution);

  if (
    ingredientType !== "general" &&
    substitutionType !== "general" &&
    ingredientType !== substitutionType
  ) {
    score -= 0.35;
  }

  if (ingredient.includes("oil") && substitutionType === "produce") score -= 0.35;
  if (ingredient.includes("powder") && substitutionType === "protein") score -= 0.35;
  if (ingredient.includes("sugar") && substitutionType === "produce") score -= 0.35;
  if (ingredient.includes("tea") && substitutionType === "baking") score -= 0.35;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function buildText(substitution: string, context: string): string {
  return `${substitution} (${context})`;
}

function toOutputSub(
  ingredient: string,
  substitution: string,
  raw: RawPair,
  qualityScore: number
): OutputSub {
  const context = inferContext(ingredient, substitution);
  const text = buildText(substitution, context);
  const signature = `${ingredient} => ${substitution} | context:${context}`;

  return {
    text,
    components: [{ item: substitution }],
    method: {},
    context,
    diet_tags: [],
    allergen_flags: [],
    quality_score: qualityScore,
    signature,
    signature_hash: sha256(signature),
    variants: [],
    provenance: [
      {
        source: "substitution_pairs.json",
        ingredient_original_id: raw.ingredient_original_id ?? null,
        substitution_original_id: raw.substitution_original_id ?? null,
        ingredient_processed_id: raw.ingredient_processed_id ?? null,
        substitution_processed_id: raw.substitution_processed_id ?? null,
      },
    ],
  };
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Missing input file: ${INPUT_FILE}`);
  }

  const grouped = new Map<string, Map<string, OutputSub>>();
  let seenRows = 0;
  let keptRows = 0;
  let rejectedRows = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT_FILE, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let jsonBuffer = "";
  for await (const line of rl) {
    jsonBuffer += `${line}\n`;
  }

  const rawData = JSON.parse(jsonBuffer) as RawPair[];

  for (const row of rawData) {
    seenRows += 1;

    const ingredient = normalizeText(row.ingredient);
    const substitution = normalizeText(row.substitution);

    if (isBadPair(ingredient, substitution)) {
      rejectedRows += 1;
      continue;
    }

    const qualityScore = scorePair(ingredient, substitution);
    if (qualityScore < 0.5) {
      rejectedRows += 1;
      continue;
    }

    if (!grouped.has(ingredient)) {
      grouped.set(ingredient, new Map<string, OutputSub>());
    }

    const subs = grouped.get(ingredient)!;
    if (!subs.has(substitution)) {
      subs.set(substitution, toOutputSub(ingredient, substitution, row, qualityScore));
      keptRows += 1;
    }
  }

  const outputRows: OutputRow[] = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ingredient, subs]) => ({
      ingredient: titleCase(ingredient),
      subs: [...subs.values()].sort((a, b) => {
        if (b.quality_score !== a.quality_score) {
          return b.quality_score - a.quality_score;
        }
        return a.text.localeCompare(b.text);
      }),
    }));

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(
    OUTPUT_FILE,
    `${outputRows.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8"
  );

  console.log("Done.");
  console.log(`Input file: ${INPUT_FILE}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log(`Rows seen: ${seenRows}`);
  console.log(`Rows kept: ${keptRows}`);
  console.log(`Rows rejected: ${rejectedRows}`);
  console.log(`Ingredients written: ${outputRows.length}`);
}

main().catch((error) => {
  console.error("import-substitution-pairs failed:");
  console.error(error);
  process.exit(1);
});
