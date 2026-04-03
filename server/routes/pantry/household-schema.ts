import { sql } from "drizzle-orm";
import { db } from "../../db";

let householdSchemaReady: Promise<void> | null = null;

export async function ensureHouseholdSchema() {
  if (householdSchemaReady) return householdSchemaReady;

  householdSchemaReady = (async () => {
    // These tables are created without gen_random_uuid() so we don't depend on pgcrypto.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pantry_households (
        id varchar PRIMARY KEY,
        name text NOT NULL,
        owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invite_code text NOT NULL UNIQUE,
        created_at timestamp DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pantry_household_members (
        id varchar PRIMARY KEY,
        household_id varchar NOT NULL REFERENCES pantry_households(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'member',
        created_at timestamp DEFAULT now(),
        UNIQUE (household_id, user_id)
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS pantry_household_members_user_idx
      ON pantry_household_members(user_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS pantry_household_members_household_idx
      ON pantry_household_members(household_id);
    `);

    // Household invites table for pending invitations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pantry_household_invites (
        id varchar PRIMARY KEY,
        household_id varchar NOT NULL REFERENCES pantry_households(id) ON DELETE CASCADE,
        invited_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invited_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamp DEFAULT now(),
        UNIQUE (household_id, invited_user_id)
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS pantry_household_invites_user_idx
      ON pantry_household_invites(invited_user_id);
    `);

    // Add household_id to pantry_items if missing (nullable; personal pantry items stay null)
    await db.execute(sql`
      ALTER TABLE pantry_items
      ADD COLUMN IF NOT EXISTS household_id varchar REFERENCES pantry_households(id) ON DELETE SET NULL;
    `);
  })();

  return householdSchemaReady;
}
