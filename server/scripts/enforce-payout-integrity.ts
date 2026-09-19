import "../lib/load-env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { splitPostgresStatements } from "./migration-runner";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for payout integrity enforcement");

  const here = path.dirname(fileURLToPath(import.meta.url));
  const sql = await readFile(path.join(here, "../migrations/20260919_payout_integrity.sql"), "utf8");
  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    await client.query("BEGIN");
    for (const statement of splitPostgresStatements(sql)) await client.query(statement);
    await client.query("COMMIT");
    console.log("Payout integrity invariants verified.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Payout integrity enforcement failed.");
  console.error(error);
  process.exit(1);
});
