// Quick script to create wedding_rsvp_invitations table
// Run with: tsx server/scripts/create-wedding-table.ts

import "../lib/load-env";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function createWeddingTable() {
  try {
    console.log("🔄 Creating wedding_rsvp_invitations table...");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wedding_rsvp_invitations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

        -- The user who created the wedding event (couple)
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Guest information
        guest_name VARCHAR(255) NOT NULL,
        guest_email VARCHAR(255) NOT NULL,

        -- RSVP token (hashed using SHA-256)
        token_hash VARCHAR(64) NOT NULL UNIQUE,

        -- RSVP status: 'pending', 'accepted', 'declined'
        rsvp_status VARCHAR(20) NOT NULL DEFAULT 'pending',

        -- Plus one allowed
        plus_one BOOLEAN DEFAULT false,

        -- Optional: Wedding event details
        event_date TIMESTAMP,
        event_location TEXT,
        event_message TEXT,

        -- Token expiry (30 days by default)
        expires_at TIMESTAMP NOT NULL DEFAULT (now() + interval '30 days'),

        -- When the guest responded
        responded_at TIMESTAMP,

        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    console.log("✅ Table created successfully");

    // Create indexes
    console.log("🔄 Creating indexes...");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS wri_user_idx ON wedding_rsvp_invitations(user_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS wri_token_hash_idx ON wedding_rsvp_invitations(token_hash);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS wri_email_idx ON wedding_rsvp_invitations(guest_email);
    `);

    console.log("✅ Indexes created successfully");
    console.log("🎉 Wedding RSVP table is ready!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating table:", error);
    process.exit(1);
  }
}

createWeddingTable();
