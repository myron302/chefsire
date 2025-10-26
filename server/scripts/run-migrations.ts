import "dotenv/config";
import { Pool } from "pg";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  console.log("🔄 Running database migrations...\n");

  try {
    const migrationsDir = join(__dirname, "../migrations");
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
