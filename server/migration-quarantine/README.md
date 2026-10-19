# Migration quarantine

SQL in this directory is **never** discovered or executed by `npm run db:migrate`
(`server/scripts/run-migrations.ts` scans only `server/drizzle/`, `server/migrations/` and `/migrations/`).
Files are kept for historical reference. Do not move a file back into a scanned directory.

| File | Why quarantined |
| --- | --- |
| `cleanup_phase2.sql` | Ten `DROP TABLE IF EXISTS … CASCADE` statements for the live Phase 2 tables (`competitions`, `competition_entries`, `competition_votes`, `competition_judges`, `seasonal_events`, `event_participants`, `event_leaderboard`, `cook_together_*`, `recipe_duets`). It was a one-off developer helper ("run this BEFORE 0002") but sat in `server/drizzle/`, where the migration runner picked it up as an ordinary migration. Byte-for-byte unchanged from its original location (`git log --follow` shows the history). |

Intentional destructive SQL may only be executed with `server/scripts/run-destructive-migration.ts`.
See `docs/stability-phase-3b-migration-safety.md`.
