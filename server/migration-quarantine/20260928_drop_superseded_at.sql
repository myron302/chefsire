-- Quarantined: removes the `superseded_at` column from square_oauth_transactions.
--
-- Why it is here and not in server/migrations/: dropping a column is irreversible, and
-- routine migrations in this project must be non-destructive. 20260928_square_oauth_hardening.sql
-- used to carry this statement, which made every `npm run db:migrate` run fail the validator.
--
-- Who needs it: nobody on production. The live database was checked on 2026-11-22 and has
-- exactly nine columns on this table, none of them superseded_at. The column is created by no
-- migration that ever shipped -- only by an earlier unmerged one -- so it exists only on a
-- developer machine where that unmerged migration was applied.
--
-- How to run it, if your database has the column:
--   npx tsx server/scripts/run-destructive-migration.ts server/migration-quarantine/20260928_drop_superseded_at.sql
-- See docs/stability-phase-3b-migration-safety.md.
ALTER TABLE square_oauth_transactions
  DROP COLUMN IF EXISTS superseded_at;
