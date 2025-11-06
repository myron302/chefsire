// server/db/index.ts
import "../lib/load-env";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "../../shared/schema";

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
export const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : (null as any);
export const db = pool ? drizzle(pool, { schema }) : (null as any);

// Gracefully end pool only when it's present
process.on("beforeExit", () => {
  try {
    if (pool && typeof (pool as any).end === "function") (pool as any).end();
  } catch {}
});

// NOTE: keep exports compatible with the rest of your codebase
export * from "./";
