// server/scripts/run-migrations.ts
// Idempotent, Plesk-safe migration runner.
// - Uses your env loader
// - Applies SQL from server/drizzle/
// - Skips files already applied (via a tiny _app_migrations table)
// - Applies each transaction-compatible file and its ledger entry atomically
// - Rejects transaction-incompatible operations; migrations must not use CREATE INDEX CONCURRENTLY
// - Rejects destructive SQL (DROP TABLE/SCHEMA/COLUMN, TRUNCATE, unconditional DELETE, DROP … CASCADE) for every
//   pending file BEFORE anything runs. See docs/stability-phase-3b-migration-safety.md.

import "../lib/load-env";
import { Pool } from "@neondatabase/serverless";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { runPendingMigrations } from "./migration-runner";

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

async function runMigrations() {
  console.log("🔄 Running database migrations (idempotent)…\n");

  try {
    await ensureLedger();

    // server/migration-quarantine/ is deliberately NOT listed: quarantined SQL is never discovered here.
    const migrationSources = [
      { dir: join(__dirname, "../drizzle"), keyPrefix: "drizzle", priority: 0 }, // matches drizzle.config.ts: out
      { dir: join(__dirname, "../migrations"), keyPrefix: "server", priority: 1 }, // fallback for historical SQL files not copied into drizzle/
      { dir: join(__dirname, "../../migrations"), keyPrefix: "legacy", priority: 2 },
    ];

    const { applied, skipped } = await runPendingMigrations(pool, migrationSources);
    if (applied.length + skipped.length === 0) {
      console.log("✅ No migrations found under server/drizzle, server/migrations, or /migrations.");
      return;
    }
    console.log("🎉 All migrations complete.");
  } catch (error) {
    console.error("❌ Migration run failed:", error);
    // Fail closed: a rejected/failed run must make `npm run db:migrate` (and any deploy chained on it) fail.
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigrations();
