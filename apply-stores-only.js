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

// Only create stores table
const sql = `
CREATE TABLE IF NOT EXISTS "stores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"theme" jsonb DEFAULT '{}'::jsonb,
	"layout" jsonb,
	"published" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "stores_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "stores_handle_unique" UNIQUE("handle")
);

CREATE INDEX IF NOT EXISTS "stores_handle_idx" ON "stores" USING btree ("handle");
CREATE INDEX IF NOT EXISTS "stores_user_id_idx" ON "stores" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "stores_published_idx" ON "stores" USING btree ("published");

ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
`;

try {
  await pool.query(sql);
  console.log('✓ Stores table created successfully!');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}

await pool.end();
