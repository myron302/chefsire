import "../lib/load-env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { enforcePayoutIntegrity } from "./payout-integrity-enforcement";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for payout integrity enforcement");

  const here = path.dirname(fileURLToPath(import.meta.url));
  const sql = await readFile(path.join(here, "../migrations/20260919_payout_integrity.sql"), "utf8");
  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    const state = await enforcePayoutIntegrity(client, sql, process.argv.includes("--allow-missing"));
    if (!state.payouts || !state.commissions) {
      console.log("Partial payout schema detected; existing-table invariants verified and schema repair may proceed.");
      return;
    }
    console.log("Payout integrity invariants verified.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Payout integrity enforcement failed.");
  console.error(error);
  process.exit(1);
});
