// server/scripts/run-migrations.ts
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

const pool = new Pool({ connectionString: DATABASE_URL });

async function runMigrations() {
  console.log("🔄 Running database migrations...\n");

  try {
    // ✅ Point to Drizzle’s generated SQL directory
    const migrationsDir = join(__dirname, "../drizzle");
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

    if (sqlFiles.length === 0) {
      console.log("✅ No migrations to run.");
      return;
    }

    for (const file of sqlFiles) {
      console.log(`Running migration: ${file}`);
      const filePath = join(migrationsDir, file);
      const sql = await readFile(filePath, "utf-8");

      await pool.query(sql);
      console.log(`✅ ${file} completed\n`);
    }

    console.log("🎉 All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations();
