// server/db/index.ts
import "../lib/load-env"; // <-- hydrate env from Plesk or server/.env before reading it

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

/**
 * Drizzle + Neon connection (ESM friendly)
 * DATABASE_URL must come from Plesk env (prod) or server/.env (dev).
 */
let DATABASE_URL = process.env.DATABASE_URL?.trim();

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Set it in Plesk → Node.js → Custom environment variables, " +
    "or create /httpdocs/server/.env with DATABASE_URL=... (for NPM scripts)."
  );
}

// Ensure Neon SSL unless you already have it
if (!/[?&]sslmode=/.test(DATABASE_URL)) {
  DATABASE_URL += (DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=require";
}

export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool);

// Optional: graceful shutdown in scripts or when Plesk restarts
process.on("beforeExit", () => {
  try { pool.end(); } catch {}
});
