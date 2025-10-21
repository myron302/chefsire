import { Pool } from '@neondatabase/serverless';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from server/.env
const envPath = join(__dirname, 'server', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([^=]+)=(.+)\s*$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in server/.env');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const sqlPath = join(__dirname, 'server', 'drizzle', '0000_lively_forgotten_one.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

try {
  await pool.query(sql);
  console.log('✓ Migration applied successfully - stores table created!');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}

await pool.end();
