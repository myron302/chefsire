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


/* ============================================
   FILE 2: drizzle.config.ts (AT PROJECT ROOT)
   REPLACE YOUR ENTIRE FILE WITH THIS
   ============================================ */

// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let DATABASE_URL = (process.env.DATABASE_URL ?? "").trim();

if (!DATABASE_URL) {
  const envPath = path.resolve(__dirname, "server", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
      if (m) {
        DATABASE_URL = m[1].trim();
        break;
      }
    }
  }
}

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it in environment variables or create server/.env with DATABASE_URL=..."
  );
}

if (!/[?&]sslmode=/.test(DATABASE_URL)) {
  DATABASE_URL += (DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=require";
}

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./server/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: DATABASE_URL },
});
