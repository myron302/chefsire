import "../lib/load-env";
import pg from "pg";
import { enforceMealPlanPaymentIntegrity } from "./meal-plan-payment-enforcement";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for meal-plan payment enforcement");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const state = await enforceMealPlanPaymentIntegrity(client, process.argv.includes("--allow-missing"));
    console.log(state.purchases
      ? "Meal-plan payment integrity invariants verified."
      : "Meal-plan purchases table absent; schema bootstrap may proceed.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Meal-plan payment integrity enforcement failed.");
  console.error(error);
  process.exit(1);
});
