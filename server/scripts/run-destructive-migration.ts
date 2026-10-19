// server/scripts/run-destructive-migration.ts
// The ONLY supported way to execute intentionally destructive SQL. It is deliberately NOT wired to any npm script,
// deploy hook or `db:migrate`. Every run needs all of:
//   --file <path>                 SQL file (must live under server/migration-quarantine/)
//   --expect-database <name>      must equal current_database() on the connection
//   --authorize-sha256 <hash>     must equal the SHA-256 of the file as it is on disk right now
//   --i-understand-data-loss      literal flag
// and a human who has taken a verified backup first. See docs/stability-phase-3b-migration-safety.md.

import "../lib/load-env";
import { Pool } from "@neondatabase/serverless";
import { readFile } from "fs/promises";
import { basename, dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { applyAuthorizedDestructiveMigration } from "./migration-runner";
import { sha256 } from "./migration-safety";

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUARANTINE_DIR = resolve(__dirname, "../migration-quarantine");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const file = arg("--file");
  const database = arg("--expect-database");
  const authorized = arg("--authorize-sha256");
  if (!file || !database || !authorized || !process.argv.includes("--i-understand-data-loss")) {
    throw new Error(
      "Refusing to run. Required: --file <path> --expect-database <name> --authorize-sha256 <hash> --i-understand-data-loss"
    );
  }
  const path = resolve(file);
  if (relative(QUARANTINE_DIR, path).startsWith("..")) {
    throw new Error("Destructive SQL must live under server/migration-quarantine/; refusing to run any other file.");
  }
  const sql = await readFile(path, "utf-8");
  if (sha256(sql) !== authorized) {
    throw new Error(`SHA-256 mismatch: file is ${sha256(sql)}, authorization is ${authorized}. Nothing was executed.`);
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is missing.");
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(`create table if not exists _app_migrations (filename text primary key, applied_at timestamptz not null default now())`);
    console.warn(`⚠️  Applying DESTRUCTIVE SQL ${basename(path)} to database "${database}"`);
    await applyAuthorizedDestructiveMigration(client, basename(path), sql, { sha256: authorized, databaseName: database });
    console.log("Done.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("❌", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
