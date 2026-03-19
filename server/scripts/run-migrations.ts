// server/scripts/run-migrations.ts
// Idempotent, Plesk-safe migration runner.
// - Uses your env loader
// - Applies SQL from server/drizzle/
// - Skips files already applied (via a tiny _app_migrations table)
// - If objects already exist (applied by other tools), it records the file as applied and moves on

import "../lib/load-env";
import { Pool } from "@neondatabase/serverless";
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Set it in Plesk → Node.js → Custom environment variables, " +
      "or create /httpdocs/server/.env with DATABASE_URL=... (for NPM scripts)."
  );
}
if (!/[?&]sslmode=/.test(DATABASE_URL)) {
  DATABASE_URL += (DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=require";
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });

// Error codes we can safely ignore as "already applied"
const DUPLICATE_CODES = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object (index, constraint, etc.)
  "42701", // duplicate_column
  "23505", // unique_violation (e.g., creating unique index that exists)
]);

async function ensureLedger() {
  await pool.query(`
    create table if not exists _app_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function hasApplied(filename: string) {
  const r = await pool.query<{ filename: string }>(
    `select filename from _app_migrations where filename = $1`,
    [filename]
  );
  return r.rowCount > 0;
}

async function markApplied(filename: string) {
  await pool.query(
    `insert into _app_migrations (filename) values ($1)
     on conflict (filename) do nothing`,
    [filename]
  );
}

async function runMigrations() {
  console.log("🔄 Running database migrations (idempotent)…\n");

  try {
    await ensureLedger();

    const migrationSources = [
      { dir: join(__dirname, "../drizzle"), keyPrefix: "drizzle", priority: 0 }, // matches drizzle.config.ts: out
      { dir: join(__dirname, "../migrations"), keyPrefix: "server", priority: 1 }, // fallback for historical SQL files not copied into drizzle/
      { dir: join(__dirname, "../../migrations"), keyPrefix: "legacy", priority: 2 },
    ];

    const sqlFilesByName = new Map<
      string,
      { sourceDir: string; keyPrefix: string; filename: string; ledgerKey: string; priority: number }
    >();
    for (const source of migrationSources) {
      const files = await readdir(source.dir).catch(() => [] as string[]);
      for (const filename of files.filter((f) => f.endsWith(".sql")).sort()) {
        const nextFile = {
          sourceDir: source.dir,
          keyPrefix: source.keyPrefix,
          filename,
          ledgerKey: `${source.keyPrefix}:${filename}`,
          priority: source.priority,
        };
        const existing = sqlFilesByName.get(filename);
        if (!existing || nextFile.priority < existing.priority) {
          sqlFilesByName.set(filename, nextFile);
        }
      }
    }

    const sqlFiles = Array.from(sqlFilesByName.values());
    sqlFiles.sort((a, b) => a.filename.localeCompare(b.filename));

    if (sqlFiles.length === 0) {
      console.log("✅ No migrations found under server/drizzle, server/migrations, or /migrations.");
      return;
    }

    for (const file of sqlFiles) {
      if (await hasApplied(file.ledgerKey)) {
        console.log(`⏭️  Skipping already recorded: ${file.ledgerKey}`);
        continue;
      }

      console.log(`▶️  Running migration: ${file.ledgerKey}`);
      const filePath = join(file.sourceDir, file.filename);
      const sql = await readFile(filePath, "utf-8");

      try {
        // Single-shot execution of the file.
        // If the DB already has the objects, we catch + mark applied.
        await pool.query(sql);
        await markApplied(file.ledgerKey);
        console.log(`✅ Completed: ${file.ledgerKey}\n`);
      } catch (err: any) {
        const code = err?.code as string | undefined;

        if (code && DUPLICATE_CODES.has(code)) {
          console.warn(
            `⚠️  Objects already exist while applying ${file.ledgerKey} (code ${code}). Marking as applied and continuing.`
          );
          await markApplied(file.ledgerKey);
          continue;
        }

        // Some migrations have multiple statements; if the first statement failed
        // due to existing objects, we still treat the whole file as applied.
        const msg = (err && err.message) || String(err);
        if (/already exists/i.test(msg)) {
          console.warn(
            `⚠️  Detected "already exists" in ${file.ledgerKey}. Marking as applied and continuing.`
          );
          await markApplied(file.ledgerKey);
          continue;
        }

        console.error(`❌ Migration failed in ${file.ledgerKey}:`, err);
        throw err;
      }
    }

    console.log("🎉 All migrations complete.");
  } catch (error) {
    console.error("❌ Migration run failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations();
