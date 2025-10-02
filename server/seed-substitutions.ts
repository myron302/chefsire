// server/seed-substitutions.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import {
  substitutionIngredients,
  substitutions,
} from "../shared/schema.js"; // keep .js path like your existing seed.ts

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`${name} is missing. In production, set it in Plesk → Custom environment variables.`);
  }
  return v;
}

const DATABASE_URL = reqEnv("DATABASE_URL");
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

// ------- helpers -------
type Comp = { item: string; amount?: number; unit?: string; note?: string };
type Method = { action?: string; time_min?: number; time_max?: number; temperature?: string };

function makeText(components: Comp[], method?: Method, context?: string) {
  const base = components
    .map((c) =>
      `${c.amount ?? ""}${c.amount ? " " : ""}${c.unit ? c.unit + " " : ""}${c.item}${c.note ? ` (${c.note})` : ""}`.trim()
    )
    .join(" + ");
  const tail: string[] = [];
  if (method?.action) tail.push(method.action);
  if (method?.time_min != null || method?.time_max != null) {
    const r = `${method?.time_min ?? ""}${method?.time_max != null ? `–${method.time_max}` : ""}`;
    if (r) tail.push(`for ${r} min`);
  }
  if (method?.temperature) tail.push(`at ${method.temperature}`);
  return `${base}${tail.length ? `, ${tail.join(" ")}` : ""}${context ? ` (${context})` : ""}`.trim();
}

function signature(components: Comp[], method?: Method, context?: string) {
  const canon = [...components]
    .map((c) => `${(c.item || "").toLowerCase()}|${(c.unit || "").toLowerCase()}|${c.amount ?? ""}|${(c.note || "").toLowerCase()}`)
    .sort()
    .join("+");
  const parts = [canon];
  if (method?.action) parts.push(`a:${method.action.toLowerCase()}`);
  if (method?.time_min != null || method?.time_max != null) parts.push(`t:${method?.time_min ?? ""}-${method?.time_max ?? ""}`);
  if (method?.temperature) parts.push(`temp:${method.temperature.toLowerCase()}`);
  if (context) parts.push(`ctx:${context.toLowerCase()}`);
  const sig = parts.join("|");
  const hash = crypto.createHash("sha256").update(sig).digest("hex");
  return { sig, hash };
}

async function getOrCreateIngredientId(name: string) {
  // Use select/from/where (works without db.query.*)
  const existing = await db
    .select({ id: substitutionIngredients.id })
    .from(substitutionIngredients)
    .where(eq(substitutionIngredients.ingredient, name))
    .limit(1);

  if (existing[0]?.id) return existing[0].id;

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

  return inserted[0].id;
}

async function addSub(
  ingredient: string,
  components: Comp[],
  opts: { context?: string; method?: Method } = {}
) {
  const { context, method } = opts;
  const { sig, hash } = signature(components, method, context);
  const text = makeText(components, method, context);
  const ingredientId = await getOrCreateIngredientId(ingredient);

  try {
    await db.insert(substitutions).values({
      ingredientId,
      text,
      components,
      method: method || {},
      ratio: "",
      context: context || "",
      dietTags: [],
      allergenFlags: [],
      signature: sig,
      signatureHash: hash,
      variants: [],
      provenance: [],
    });
  } catch (e: any) {
    // Ignore duplicates enforced by (ingredient_id, signature_hash)
    const msg = String(e?.message || "").toLowerCase();
    if (!msg.includes("uniq_sub_signature_hash") && !msg.includes("unique")) {
      throw e;
    }
  }
}

// ------- main -------
async function seedSubs() {
  console.log("Seeding sample substitutions…");

  // Baking powder: 1 tsp = 1/4 tsp baking soda + 1/2 tsp cream of tartar + 1/4 tsp cornstarch
  await addSub(
    "Baking powder",
    [
      { item: "baking soda", amount: 0.25, unit: "teaspoon" },
      { item: "cream of tartar", amount: 0.5, unit: "teaspoon" },
      { item: "cornstarch", amount: 0.25, unit: "teaspoon" },
    ],
    { context: "baking" }
  );

  // Buttermilk: 1 cup milk + 1 tbsp lemon juice or white vinegar, rest 5–10 min
  await addSub(
    "Buttermilk",
    [
      { item: "milk", amount: 1, unit: "cup" },
      { item: "lemon juice or white vinegar", amount: 1, unit: "tablespoon" },
    ],
    { context: "baking", method: { action: "stand", time_min: 5, time_max: 10 } }
  );

  // Unsweetened chocolate: 3 tbsp cocoa + 1 tbsp butter
  await addSub(
    "Unsweetened chocolate",
    [
      { item: "cocoa powder", amount: 3, unit: "tablespoon" },
      { item: "butter", amount: 1, unit: "tablespoon" },
    ],
    { context: "baking" }
  );

  // Corn syrup: 1¼ cup sugar + ⅓ cup water
  await addSub(
    "Corn syrup",
    [
      { item: "granulated sugar", amount: 1.25, unit: "cup" },
      { item: "water", amount: 0.3333, unit: "cup" },
    ],
    { context: "baking" }
  );

  // Egg → applesauce: 1 egg = 1/4 cup applesauce
  await addSub(
    "Egg",
    [{ item: "applesauce", amount: 0.25, unit: "cup" }],
    { context: "baking" }
  );

  console.log("✅ Done seeding sample substitutions.");
}

seedSubs()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
