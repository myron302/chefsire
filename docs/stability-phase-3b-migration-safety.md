# Stability Phase 3B — Database migration safety

## Root cause

`server/scripts/run-migrations.ts` (`npm run db:migrate`, also the second half of `db:apply:noninteractive`) applies **every** `*.sql` file in `server/drizzle/`, `server/migrations/` and `/migrations/` that is not yet in the `_app_migrations` ledger, sorted by filename. `server/drizzle/cleanup_phase2.sql` — a one-off developer helper containing ten `DROP TABLE IF EXISTS … CASCADE` statements for live tables (`competitions`, `competition_entries`, `competition_votes`, `competition_judges`, `seasonal_events`, `event_participants`, `event_leaderboard`, `cook_together_*`, `recipe_duets`) — lived in that directory. Its name sorts after all numeric files, so on any database whose ledger lacked `drizzle:cleanup_phase2.sql` it ran **last, once, successfully, and was then recorded**. The runner's only content check was for `CREATE INDEX CONCURRENTLY`.

Reproduced before the fix against a disposable local database: a `competitions` row existed, `applyMigration()` on the real file succeeded, the table was gone and the ledger recorded `drizzle:cleanup_phase2.sql`.

**This is a confirmed unsafe mechanism, not proof of data loss.** Production's ledger was not inspected (no production access in this phase). Before relying on production data in those tables, check `select * from _app_migrations where filename = 'drizzle:cleanup_phase2.sql'`: if the row exists, the tables were dropped (and `0002_phase2_social_explosion.sql`, already recorded, would not have recreated them); if it does not, the next unpatched deploy would have dropped them.

A second unsafe path existed: `npm run db:fix:phase2` / `fix-phase2-migration.sh` executed the same file directly and then deleted an `_app_migrations` row whose key (`0002_phase2_social_explosion.sql`) does not match the real `drizzle:`-prefixed keys.

## What changed

| Area | Before | After |
| --- | --- | --- |
| `cleanup_phase2.sql` | in `server/drizzle/`, executed by `db:migrate` | `server/migration-quarantine/` (moved with `git mv`, content byte-identical, sha256 `020f1db7…9954`); README explains why |
| Destructive SQL in a migration | executed | rejected **before `BEGIN`**; nothing sent to the database, no ledger row |
| Whole-run behaviour | files applied one by one | every *pending* file is validated first; one unsafe file stops the run with nothing applied |
| `db:fix:phase2` and `.sh` | dropped tables / rewrote ledger | disabled (exit 1, pointer to this doc) |
| Intentional destructive SQL | no distinct procedure | `server/scripts/run-destructive-migration.ts` (below) |
| Failure exit status | rethrown | `process.exitCode = 1` explicitly |

Code: `migration-safety.ts` (validator), `postgres-sql-scan.ts` (statement splitter, moved verbatim out of `migration-runner.ts` and re-exported), `migration-runner.ts` (guard in `applyMigration`, `discoverMigrations`, `runPendingMigrations`, `applyAuthorizedDestructiveMigration`), `run-migrations.ts` (now a thin CLI over `runPendingMigrations`).

## The guard

Not a keyword grep. Each top-level statement (split with the existing quote/comment/dollar-aware splitter) is tokenised: comments removed, string literals and quoted identifiers neutralised, and dollar-quoted `DO`/function bodies analysed recursively as code — including string literals inside them, since those can be `EXECUTE`d. Unterminated comments/strings/bodies are rejected. Blocked:

`DROP TABLE`, `DROP SCHEMA`, `DROP DATABASE`, `DROP OWNED`, `TRUNCATE`, `ALTER TABLE … DROP [COLUMN] x` (also without the `COLUMN` keyword), any `DROP … CASCADE`, `DELETE FROM` with no `WHERE`.

Allowed (still ordinary): `CREATE …`, `ADD COLUMN`, `ALTER COLUMN … SET/DROP DEFAULT/NOT NULL`, `DROP CONSTRAINT`, `DROP INDEX`, `UPDATE`, `DELETE … WHERE …`, mentions of these words in comments or string data.

### Reviewed historical exception

`server:20260928_square_oauth_hardening.sql` (empties the short-lived `square_oauth_transactions` table, drops its transient `superseded_at` column) is the only existing scanned file that trips the guard. It is allowed by `REVIEWED_HISTORICAL_DESTRUCTIVE`, which is **pinned to the file's sha256**: any edit re-arms the guard, and the list is code, not an env var or flag. A test asserts it has exactly one entry and that no scanned file is otherwise flagged. New entries need code review.

## Procedure for intentional destructive SQL

1. Put the SQL in `server/migration-quarantine/` (never in a scanned directory) in a reviewed PR.
2. Take and verify a backup / Neon branch.
3. Compute its hash: `sha256sum server/migration-quarantine/<file>.sql`.
4. Run, deliberately, against the intended database only:

```
DATABASE_URL=… npx tsx server/scripts/run-destructive-migration.ts \
  --file server/migration-quarantine/<file>.sql \
  --expect-database <current_database() of the target> \
  --authorize-sha256 <hash> --i-understand-data-loss
```

The script refuses unless the file is under the quarantine directory, the hash matches the bytes on disk, `current_database()` equals `--expect-database`, and the entry has not already run. It executes atomically and records `destructive:<file>` in the ledger. No npm script, deploy hook or `db:migrate` reaches it (a test enforces this).

## Compatibility

* **Ordering** is unchanged (filename sort, `drizzle` > `server` > `legacy` on name collisions).
* **Ledger** keys and schema are unchanged; no rows are read, rewritten or deleted. Moving the file does not touch an existing `drizzle:cleanup_phase2.sql` row (the runner iterates files, not ledger rows), so a database that already ran it keeps an accurate record. Already-recorded files are skipped without being re-read or re-validated.
* **Atomicity** is unchanged: each file and its ledger insert commit together; failure rolls back. Rerun after fixing is safe.
* **Schema push** (`db:push`, `tablesFilter`, see `schema-push-safety.md`) and `drizzle.config.ts` are untouched. `drizzle-kit generate` output goes to `server/drizzle/` and is validated like any other file; if drizzle-kit ever generates a `DROP`, `db:migrate` will now refuse it instead of applying it.

## Remaining risks

* The ledger stores filenames only, not checksums: an applied file edited later is not detected. Adding a checksum column would alter the production ledger and was deliberately left out.
* `ALTER COLUMN … TYPE` with a lossy `USING`, `UPDATE` without `WHERE`, `DELETE … WHERE true`, `DROP TYPE/VIEW/FUNCTION` (without `CASCADE`) and `DROP EXTENSION` are not blocked; the validator targets structural data loss, not every possible semantic one.
* Dollar-quoted text used as plain data that happens to contain a blocked phrase is rejected (fail closed; use a normal `'…'` literal).
* `run-migrations.ts` itself uses the Neon driver, so the CLI wrapper cannot be exercised against local PostgreSQL; the logic it calls (`runPendingMigrations`) is tested against real PostgreSQL.
* Whether production already ran `cleanup_phase2.sql` is still unknown.
