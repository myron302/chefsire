// Quick migration script to add in_store_only and related fields
const { readFileSync } = require('fs');
const { Pool } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function runMigration() {
  try {
    console.log('Running product delivery fields migration...');

    const sql = readFileSync('./server/drizzle/20251113_add_product_delivery_fields.sql', 'utf-8');

    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    // Check if it's just a "column already exists" error
    if (error.message.includes('already exists')) {
      console.log('⚠️  Columns may already exist - that\'s OK!');
    } else {
      throw error;
    }
  } finally {
    await pool.end();
  }
}

runMigration();
