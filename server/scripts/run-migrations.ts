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

function isDuplicate(err: any): boolean {
  if (err?.code && DUPLICATE_CODES.has(err.code)) return true;
  const msg: string = (err?.message ?? String(err)).toLowerCase();
  return msg.includes("already exists");
}

async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      // XX000 = Neon control-plane not ready (project waking up). Retry with backoff.
      const isNeonWakeup = err?.code === "XX000" || /control plane request failed/i.test(err?.message ?? "");
      if (!isNeonWakeup || attempt === maxAttempts) throw err;
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s
      console.warn(`⚠️  ${label}: Neon not ready (attempt ${attempt}/${maxAttempts}), retrying in ${delay / 1000}s…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function ensureLedger() {
  await withRetry(
    () => pool.query(`
      create table if not exists _app_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      );
    `),
    "ensureLedger"
  );
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

/**
 * Run one migration file using a dedicated connection from the pool.
 *
 * Normal path (no CONCURRENTLY):
 *   BEGIN → for each statement: SAVEPOINT → execute → RELEASE (or ROLLBACK TO on
 *   tolerable duplicate errors) → COMMIT → record in ledger.
 *
 *   All statements share the same connection, so DDL from earlier statements is
 *   visible to later ones. This is critical for Neon's serverless driver where
 *   each pool.query() call is an independent HTTP request.
 *
 *   Per-statement SAVEPOINTs let us tolerate individual "object already exists"
 *   errors (idempotent re-runs) without aborting the whole transaction. The ledger
 *   is written ONLY after a successful COMMIT, so a failed migration never poisons
 *   the ledger.
 *
 * CONCURRENTLY fallback:
 *   CREATE INDEX CONCURRENTLY cannot run inside a transaction. Files containing it
 *   use the old per-statement approach on the dedicated client (still one connection,
 *   no transaction wrapper).
 */
async function applyMigration(sql: string, ledgerKey: string): Promise<void> {
  const statements = sql
    .split(/;/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^--/.test(s));

  if (statements.length === 0) return;

  const hasConcurrently = /\bCONCURRENTLY\b/i.test(sql);
  const client = await pool.connect();

  try {
    if (hasConcurrently) {
      // CONCURRENTLY can't run inside a transaction. Use the per-statement path on
      // a single dedicated connection so DDL visibility is still guaranteed.
      for (let i = 0; i < statements.length; i++) {
        try {
          await client.query(statements[i]);
        } catch (err) {
          if (isDuplicate(err)) {
            console.warn(`    ↩️  Statement ${i + 1}: object already exists, skipping.`);
          } else {
            throw err;
          }
        }
      }
    } else {
      // Transactional path: one connection, explicit BEGIN/COMMIT, per-statement SAVEPOINTs.
      await client.query("BEGIN");
      try {
        for (let i = 0; i < statements.length; i++) {
          const sp = `s_${i}`;
          await client.query(`SAVEPOINT ${sp}`);
          try {
            await client.query(statements[i]);
            await client.query(`RELEASE SAVEPOINT ${sp}`);
          } catch (err) {
            if (isDuplicate(err)) {
              console.warn(`    ↩️  Statement ${i + 1}: object already exists, skipping.`);
              await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
              await client.query(`RELEASE SAVEPOINT ${sp}`);
            } else {
              // Non-tolerable error: roll back everything and surface the failure.
              await client.query("ROLLBACK");
              throw err;
            }
          }
        }
        await client.query("COMMIT");
      } catch (err) {
        // Ensure we don't leave an open transaction if COMMIT itself fails.
        try { await client.query("ROLLBACK"); } catch { /* ignore secondary error */ }
        throw err;
      }
    }
  } finally {
    client.release();
  }

  // Record in the ledger only after a successful commit — never in a catch block.
  await markApplied(ledgerKey);
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
        await applyMigration(sql, file.ledgerKey);
        console.log(`✅ Completed: ${file.ledgerKey}\n`);
      } catch (err: any) {
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

