// Check database state for Phase 2 tables
import "../lib/load-env";
import { Pool } from "@neondatabase/serverless";

let DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}
if (!/[?&]sslmode=/.test(DATABASE_URL)) {
  DATABASE_URL += (DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=require";
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });

async function checkState() {
  try {
    // Check if competition_entries table exists
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('competitions', 'competition_entries', 'competition_votes', 'competition_judges')
      ORDER BY table_name;
    `);

    console.log("\n📊 Competition-related tables:");
    if (tablesResult.rows.length === 0) {
      console.log("  ❌ No competition tables found");
    } else {
      for (const row of tablesResult.rows) {
        console.log(`  ✓ ${row.table_name}`);
      }
    }

    // Check competition_votes table structure if it exists
    const votesTableExists = tablesResult.rows.some(r => r.table_name === 'competition_votes');
    if (votesTableExists) {
      console.log("\n📋 competition_votes columns:");
      const columnsResult = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'competition_votes'
        ORDER BY ordinal_position;
      `);
      for (const row of columnsResult.rows) {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      }

      // Check indexes on competition_votes
      console.log("\n🔍 competition_votes indexes:");
      const indexesResult = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'competition_votes'
        ORDER BY indexname;
      `);
      for (const row of indexesResult.rows) {
        console.log(`  - ${row.indexname}`);
      }
    }

    // Check migration status
    console.log("\n📝 Applied migrations:");
    const migrationsResult = await pool.query(`
      SELECT filename, applied_at
      FROM _app_migrations
      WHERE filename LIKE '%phase2%' OR filename LIKE '%competition%'
      ORDER BY applied_at;
    `);
    for (const row of migrationsResult.rows) {
      console.log(`  ✓ ${row.filename} (${row.applied_at})`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkState();
