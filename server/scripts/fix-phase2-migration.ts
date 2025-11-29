#!/usr/bin/env tsx
// Fix Phase 2 migration by cleaning up partial tables and re-running
import "../lib/load-env";
import { Pool } from "@neondatabase/serverless";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}
if (!/[?&]sslmode=/.test(DATABASE_URL)) {
  DATABASE_URL += (DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=require";
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });

async function fixMigration() {
  try {
    console.log("🧹 Cleaning up partial Phase 2 tables...\n");

    // Read and execute cleanup script
    const cleanupPath = join(__dirname, "../drizzle/cleanup_phase2.sql");
    const cleanupSql = await readFile(cleanupPath, "utf-8");
    await pool.query(cleanupSql);
    console.log("✅ Cleanup completed\n");

    // Remove the migration record so it can be re-run
    console.log("🗑️  Removing migration record for Phase 2...");
    await pool.query(`
      DELETE FROM _app_migrations
      WHERE filename = '0002_phase2_social_explosion.sql'
    `);
    console.log("✅ Migration record removed\n");

    console.log("📋 Now run: npm run db:migrate");
    console.log("   This will re-apply the Phase 2 migration cleanly.\n");

  } catch (error) {
    console.error("❌ Fix failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixMigration();
