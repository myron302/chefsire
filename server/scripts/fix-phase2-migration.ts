#!/usr/bin/env tsx
// DISABLED (Stability Phase 3B). This script used to execute cleanup_phase2.sql (DROP TABLE … CASCADE on the
// competitions / seasonal-events / cook-together / duets tables) and then delete an _app_migrations row whose key
// (`0002_phase2_social_explosion.sql`) does not match the real ledger keys (`drizzle:…`). Both actions are unsafe
// against a database holding real data. The SQL now lives in server/migration-quarantine/ and may only be run
// through server/scripts/run-destructive-migration.ts. See docs/stability-phase-3b-migration-safety.md.
console.error(
  "db:fix:phase2 is disabled: it dropped Phase 2 tables with CASCADE and rewrote migration history.\n" +
    "See docs/stability-phase-3b-migration-safety.md for the explicitly authorized procedure."
);
process.exit(1);
