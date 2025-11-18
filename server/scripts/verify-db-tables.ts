#!/usr/bin/env tsx
// Verify critical tables exist
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

async function verifyTables() {
  try {
    console.log("🔍 Checking critical tables...\n");

    const criticalTables = [
      'users',
      'posts',
      'recipes',
      'stores',
      'products'
    ];

    for (const tableName of criticalTables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        );
      `, [tableName]);

      const exists = result.rows[0].exists;
      if (exists) {
        // Count rows
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const count = countResult.rows[0].count;
        console.log(`✅ ${tableName}: ${count} rows`);
      } else {
        console.log(`❌ ${tableName}: MISSING`);
      }
    }

    console.log("\n🔍 Checking stores table structure...");
    const storesColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'stores'
      ORDER BY ordinal_position;
    `);

    if (storesColumns.rows.length > 0) {
      console.log("Stores columns:");
      storesColumns.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await pool.end();
  }
}

verifyTables();
