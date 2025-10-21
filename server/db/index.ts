// server/db/index.ts
import "../lib/load-env";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "../../shared/schema";

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

export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool, { schema });

process.on("beforeExit", () => {
  try { pool.end(); } catch {}
});

export * from "../../shared/schema";
