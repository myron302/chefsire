import "../lib/load-env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { enforceMarketplaceCheckoutAtomicity } from "./marketplace-checkout-atomicity-enforcement";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for marketplace checkout atomicity enforcement");

  const here = path.dirname(fileURLToPath(import.meta.url));
  const sql = await readFile(path.join(here, "../migrations/20260922_atomic_marketplace_checkout.sql"), "utf8");
  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    const state = await enforceMarketplaceCheckoutAtomicity(client, sql, process.argv.includes("--allow-missing"));
    if (!state.orders || !state.products || !state.commissions) {
      console.log("Partial marketplace checkout schema detected; existing-table invariants verified and schema repair may proceed.");
      return;
    }
    console.log("Marketplace checkout atomicity invariants verified.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Marketplace checkout atomicity enforcement failed.");
  console.error(error);
  process.exit(1);
});
