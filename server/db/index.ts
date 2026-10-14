// server/db/index.ts
import "../lib/load-env";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "../../shared/schema";
import { resolveDbSettings } from "../lib/db-config";
import { describeDatabaseError } from "../lib/db-availability";

let DATABASE_URL = process.env.DATABASE_URL?.trim();

// If DATABASE_URL is not present, warn but do NOT throw — export null-safe values.
if (!DATABASE_URL) {
  // Keep process running — DB-backed endpoints will return 503 via storage/getDb
  console.warn(
    "WARNING: DATABASE_URL is missing. Set it in Plesk → Node.js → Custom environment variables, " +
    "or create /httpdocs/server/.env with DATABASE_URL=... (for NPM scripts)."
  );
}

if (DATABASE_URL && !/[?&]sslmode=/.test(DATABASE_URL)) {
  DATABASE_URL += (DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=require";
}

// Only create pool/db if DATABASE_URL is provided
// max:5 keeps us under Neon free-tier's connection limit (was 2 pools × default 10 = 20 connections)
//
// connectionTimeoutMillis (Phase 2C): the Pool used to have none, so a black-holed or unreachable database left every request that needed a
// connection waiting forever. It bounds both a new connection's handshake and the wait for a free pooled connection; it never aborts a query that
// is already running, so it cannot interrupt a transaction. See lib/db-config for the knobs and docs/stability-phase-2c-database-auth-resilience.md.
const settings = resolveDbSettings();
for (const warning of settings.warnings) console.warn(`[db] ${warning}`);

export const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, max: 5, connectionTimeoutMillis: settings.connectionTimeoutMillis })
  : (null as any);

if (pool) {
  // An idle pooled connection that the database or network drops emits "error" on the pool. With no listener Node treats that as an uncaught
  // exception, and server/index.ts exits on those: one Neon restart or network blip while the pool sat idle would take the whole site down.
  // The pool discards the broken client itself; the next request simply opens a new connection.
  pool.on("error", (error: unknown) => {
    console.error(`[db] Idle pool connection error (connection discarded): ${describeDatabaseError(error)}`);
  });
  if (settings.statementTimeoutMs > 0) {
    // OPT-IN, server-enforced (the statement is cancelled by Postgres, so its transaction aborts atomically). Queued on the new connection
    // before any caller's query, because a pg client runs its queries in order.
    pool.on("connect", (client: any) => {
      client.query(`SET statement_timeout = ${settings.statementTimeoutMs}`).catch((error: unknown) => {
        console.error(`[db] Could not apply statement_timeout: ${describeDatabaseError(error)}`);
      });
    });
  }
}
export const db = pool ? drizzle(pool, { schema }) : (null as any);

// Gracefully end pool only when it's present
process.on("beforeExit", () => {
  try {
    if (pool && typeof (pool as any).end === "function") (pool as any).end();
  } catch {}
});
