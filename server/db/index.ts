// server/db/index.ts
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

/**
 * Drizzle + Neon connection (ESM friendly)
 * Set DATABASE_URL in server/.env (dev) or Plesk Node.js env vars (prod).
 */
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn(
    "⚠️  DATABASE_URL is not set. Set it in server/.env (dev) or Plesk Node.js env vars (prod)."
  );
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
});

export const db = drizzle(pool);
