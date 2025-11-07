// scripts/run-phase1-migration.js
// Run Phase 1 database migration in Plesk environment
require('dotenv').config({ path: 'server/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting Phase 1 migration...');

  // Read DATABASE_URL from environment
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.log('💡 Make sure server/.env exists with DATABASE_URL set');
    process.exit(1);
  }

  console.log('📊 Connecting to database...');
  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../server/drizzle/0001_phase1_daily_addiction_features.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Running migration SQL...');

    // Execute the migration
    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📋 Tables created:');
    console.log('   - notifications');
    console.log('   - daily_quests');
    console.log('   - quest_progress');
    console.log('   - recipe_remixes');
    console.log('   - ai_suggestions');
    console.log('');
    console.log('🎉 Phase 1 database is ready!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
