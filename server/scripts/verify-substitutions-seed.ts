import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

import { substitutionIngredients, substitutions } from "../../shared/schema.js";

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
      `${name} is missing. Set it in process env (e.g., Plesk Node.js environment variables) or /httpdocs/server/.env`,
    );
  }
  return v;
}

const DATABASE_URL = reqEnv("DATABASE_URL");
const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
const db = drizzle(pool);

async function main() {
  console.log(
    `[verify-substitutions-seed] DATABASE_URL source: ${databaseUrlSource}`,
  );

  const [ingredientsCountRows, substitutionsCountRows, sampleIngredientRows] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(substitutionIngredients),
      db.select({ count: sql<number>`count(*)` }).from(substitutions),
      db
        .select({ ingredient: substitutionIngredients.ingredient })
        .from(substitutionIngredients)
        .orderBy(substitutionIngredients.ingredient)
        .limit(5),
    ]);

  const ingredientsCount = Number(ingredientsCountRows[0]?.count ?? 0);
  const substitutionsCount = Number(substitutionsCountRows[0]?.count ?? 0);

  console.log(`substitution_ingredients rows: ${ingredientsCount}`);
  console.log(`substitutions rows: ${substitutionsCount}`);

  if (sampleIngredientRows.length === 0) {
    console.log("sample substitution_ingredients: (none)");
  } else {
    console.log("sample substitution_ingredients:");
    for (const row of sampleIngredientRows) {
      console.log(`- ${String(row.ingredient ?? "")}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("[verify-substitutions-seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
