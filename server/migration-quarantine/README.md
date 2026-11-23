# Migration quarantine

SQL in this directory is **never** discovered or executed by `npm run db:migrate`
(`server/scripts/run-migrations.ts` scans only `server/drizzle/`, `server/migrations/` and `/migrations/`).
Files are kept for historical reference. Do not move a file back into a scanned directory.

| File | Why quarantined |
| --- | --- |
| `20260928_drop_superseded_at.sql` | One `ALTER TABLE … DROP COLUMN IF EXISTS superseded_at`, lifted out of `server/migrations/20260928_square_oauth_hardening.sql`. The validator refused that whole file for it, so no migration could run. The column is created by no migration that ever shipped (only by an earlier unmerged one) and is **absent from production**, verified 2026-11-22 — so this is a developer-machine repair, not pending production work. |
| `cleanup_phase2.sql` | Ten `DROP TABLE IF EXISTS … CASCADE` statements for the live Phase 2 tables (`competitions`, `competition_entries`, `competition_votes`, `competition_judges`, `seasonal_events`, `event_participants`, `event_leaderboard`, `cook_together_*`, `recipe_duets`). It was a one-off developer helper ("run this BEFORE 0002") but sat in `server/drizzle/`, where the migration runner picked it up as an ordinary migration. Byte-for-byte unchanged from its original location (`git log --follow` shows the history). |

Intentional destructive SQL may only be executed with `server/scripts/run-destructive-migration.ts`.
See `docs/stability-phase-3b-migration-safety.md`.
