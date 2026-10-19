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

## The guard (revised after Codex review of `6af3a8e`)

The first version scanned for keywords and treated string literals inside procedural bodies as data or as SQL depending on position. Codex found four defects in it (all reproduced against that commit on a disposable database — see "Review findings" below). The guard is now one coherent design with a stated trust model.

**Trust model.** The validator never executes or evaluates SQL. It lexes exactly the statements the executor will send (`sql-tokens.ts`, a PostgreSQL-faithful lexer: comments dropped; strings, quoted identifiers and dollar-quoted bodies are single tokens), then applies structural rules (`migration-safety.ts`). It accepts only what it can *prove* is outside its deny rules, and **rejects anything whose effect depends on a runtime value instead of trying to evaluate it**. The lexer and the executor's splitter are cross-checked; if they disagree about statement boundaries the file is rejected (`PARSER DISAGREEMENT`).

Rejected:

| Class | Rule |
| --- | --- |
| Dynamic SQL / procedural execution | PL/pgSQL `EXECUTE` (any argument shape), `CALL`, `COPY`, top-level `EXECUTE`/`PREPARE`, functions that run SQL text (`query_to_xml*`, `cursor_to_xml*`, `dblink*`), `DO`/`CREATE FUNCTION|PROCEDURE` in any language except plpgsql/sql, bodies written as `E''`/`U&''` strings (not decoded). `EXECUTE FUNCTION|PROCEDURE` inside `CREATE TRIGGER` is allowed. |
| Unknown statement kinds | Top-level statements must begin with one of a fixed allowlist (`CREATE, ALTER, INSERT, UPDATE, DELETE, WITH, SELECT, VALUES, TABLE, COMMENT, GRANT, REVOKE, SET, RESET, DO, DROP, TRUNCATE, ANALYZE, REINDEX, REFRESH, LOCK, NOTIFY, BEGIN, COMMIT, END, SAVEPOINT, RELEASE, ROLLBACK`). Everything else (`MERGE`, `REASSIGN`, `COPY`, …) is rejected. |
| `DROP` | Default-deny: only `INDEX, TRIGGER, POLICY, RULE, VIEW, FUNCTION, PROCEDURE, TYPE, DOMAIN` plus `ALTER … DROP CONSTRAINT / DEFAULT / NOT NULL` pass. Inside `ALTER TABLE`, any other `DROP` is treated as a column drop (including `DROP "col"`, `DROP IDENTITY`, `DROP EXPRESSION`). Any `DROP … CASCADE` is rejected (`ON DELETE/UPDATE CASCADE` is not). |
| `TRUNCATE` | Rejected (except as a trigger event in `CREATE TRIGGER`). |
| `DELETE` | Parsed as a command: `DELETE FROM … [WHERE …] [RETURNING …]`. The `WHERE` must be at the **same parenthesis depth as that DELETE** and before its `RETURNING`; a `WHERE` inside a CTE, subquery or `USING (…)` does not count. Missing or trivially true (`TRUE`, `NOT FALSE`, `1 = 1`, empty) predicates are rejected. `DELETE` used as an event/privilege/action keyword (`ON DELETE CASCADE`, `AFTER DELETE ON`, `GRANT DELETE`, `FOR DELETE USING`) is recognised by shape; any other shape, and `MERGE … THEN DELETE`, is rejected as ambiguous. |
| Unparseable input | Unterminated comment/string/identifier/dollar quote. |
| Unicode-escaped identifiers | Every `U&"…"` identifier (any case of `U`, with or without `UESCAPE`, any escape character) and the `UESCAPE` keyword are rejected **without decoding**. |
| Function/procedure definitions | Parsed at definition level: `CREATE [OR REPLACE] FUNCTION|PROCEDURE name ( … )`, then **only tokens at the statement's own parenthesis depth after the argument list** are clause candidates. Exactly one `LANGUAGE` clause (operand: unquoted word, plain quoted identifier or plain string; must resolve to `sql` or `plpgsql`), exactly one `AS` definition followed by exactly one literal. Anything else — missing/duplicate/malformed language, unsupported language, missing/duplicate `AS`, `BEGIN ATOMIC`/`RETURN` bodies, unparseable header, unicode-escaped names — is rejected. Bodies of rejected definitions are still analysed so hidden destructive SQL is reported. |
| Ambiguous procedural bodies | A `DO` must contain exactly one body literal (the operand of `LANGUAGE` is excluded, so `DO LANGUAGE 'plpgsql' $$…$$` is analysed); adjacent literals (`'a'⏎'b'`, which PostgreSQL concatenates) and multi-literal function definitions are rejected. |
| Configuration changes | **One policy: routine migrations may not change session configuration.** Rejected: any mention of `set_config` (any case, quoted, schema-qualified), `pg_settings` and `pg_show_all_settings` (writable view / settings dump) regardless of arguments; every statement that *starts* with `SET`/`RESET` (including inside `DO`/function bodies after `THEN`/`ELSE`/`LOOP`/`BEGIN`) except `[SET|RESET] [SESSION|LOCAL] lock_timeout | statement_timeout | idle_in_transaction_session_timeout`; `SET NAMES`, `SET ROLE`, `SET SESSION AUTHORIZATION`, `SET TIME ZONE`, `SET SCHEMA`, `SET TRANSACTION`, `RESET ALL`; `ALTER DATABASE|ROLE|USER|GROUP|SYSTEM`. Additionally any mention of `standard_conforming_strings`/`client_encoding` (word, quoted identifier or string). |
| Session lexing assumptions | The runners verify the live session has `standard_conforming_strings = on` and `client_encoding = UTF8` **before running anything and again before COMMIT** (routine and destructive). A violation rolls the whole file back and writes no ledger entry. |

`DO` and `CREATE FUNCTION|PROCEDURE` bodies are lexed and analysed recursively as code (depth-limited).

**Intentionally unsupported in routine migrations** (move to the authorized procedure or restructure): dynamic SQL of any kind, `CALL`, `COPY`, `MERGE`, non-plpgsql/sql procedural languages, `E''`/`U&''` DO bodies, `ALTER TABLE … DROP COLUMN`, `DROP TABLE/SCHEMA/…`, `TRUNCATE`, unbounded `DELETE`.

**Not detected** (a static guard cannot): effects of *calling* routines that already exist in the database; lossy `ALTER COLUMN … TYPE … USING`; `UPDATE` without `WHERE`; `DELETE … WHERE <always-true expression other than the trivial forms above>`; `CREATE EXTENSION`. A structurally bounded DELETE is not a proof it is semantically bounded — review remains required.

### Reviewed historical exception

`server:20260928_square_oauth_hardening.sql` is the only file in the scanned directories that trips the guard, and for exactly two operations (a test pins this): `DELETE FROM square_oauth_transactions;` (step 2: short-lived OAuth attempts that predate browser binding and can never be claimed again) and `DROP COLUMN IF EXISTS superseded_at` (a transient bookkeeping column of that same table). Reviewed again in this revision: neither statement touches `payment_methods`, stored seller credentials or any other table. The exception is pinned to the file's SHA-256 (`37df1397…1099`) in `REVIEWED_HISTORICAL_DESTRUCTIVE`; any edit re-arms the guard. There is no environment variable or flag that adds to it.

## Procedure for intentional destructive SQL

1. Put the SQL in `server/migration-quarantine/` (never in a scanned directory) in a reviewed PR.
2. Take and verify a backup / Neon branch.
3. Against the **intended** target, read-only, print its identity: `DATABASE_URL=… npx tsx server/scripts/run-destructive-migration.ts --print-target-identity`. Compare the reported database, host and (on Neon) endpoint/timeline ids with the console.
4. Compute the file hash: `sha256sum server/migration-quarantine/<file>.sql`.
5. Run, deliberately:

```
DATABASE_URL=… npx tsx server/scripts/run-destructive-migration.ts \
  --file server/migration-quarantine/<file>.sql \
  --expect-database <database name> \
  --expect-target-fingerprint <fingerprint from step 3> \
  --authorize-sha256 <hash> --i-understand-data-loss
```

Safeguards, in order, inside **one transaction**: SQL hash equals the authorization (before any database access) → `BEGIN` → transaction-scoped advisory lock (overlapping invocations queue) → the target's identity is re-read and must equal the authorized database name **and** fingerprint → the ledger row `destructive:<file>` is claimed with `INSERT … ON CONFLICT DO NOTHING RETURNING` (no row = already applied or owned elsewhere → stop) → only then are the statements executed → `COMMIT`. Any failure rolls back statements *and* the claim, so a corrected retry is possible. No npm script, deploy hook or `db:migrate` reaches it (a test enforces this).

### Target identity: what is and is not proven

A database name is not an identity (two servers or Neon branches can share one). The fingerprint is a SHA-256 over: database name; `pg_database.oid`; `pg_control_system().system_identifier`; host and port from the connection string (Neon `-pooler` suffix removed); and, when the compute reports them, `neon.endpoint_id` / `neon.timeline_id`.

* Server-reported (not a label): system identifier, database OID, Neon ids. Client-side: host/port — it proves *where this invocation is connecting*, not what is behind it.
* **Fails closed** when `pg_control_system()` is unreadable, when the server reports no identity, when the connection string is unparseable, and when a `*.neon.tech` host is used but the compute reports neither `neon.endpoint_id` nor `neon.timeline_id`. In those cases destructive execution is refused, not skipped.
* **Limit (unverified here):** a database branch created from another may share `system_identifier` and database OID with its parent. Branch separation therefore rests on the Neon ids/host. I could not check, without touching Neon, whether Neon computes expose `neon.endpoint_id`/`neon.timeline_id`; if they do not, destructive execution is simply unavailable against Neon until target verification is extended. The Neon behaviour is exercised only by a simulation (a session setting standing in for the extension) in the tests.
* The fingerprint also binds the route: authorizing via a direct URL and running via another route changes the host and is refused.

## Compatibility

* **Ordering** is unchanged (filename sort, `drizzle` > `server` > `legacy` on name collisions).
* **Ledger** keys and schema are unchanged; no rows are read, rewritten or deleted. Moving the file does not touch an existing `drizzle:cleanup_phase2.sql` row (the runner iterates files, not ledger rows), so a database that already ran it keeps an accurate record. Already-recorded files are skipped without being re-read or re-validated.
* **Atomicity** is unchanged: each file and its ledger insert commit together; failure rolls back. Rerun after fixing is safe.
* **Schema push** (`db:push`, `tablesFilter`, see `schema-push-safety.md`) and `drizzle.config.ts` are untouched. `drizzle-kit generate` output goes to `server/drizzle/` and is validated like any other file; if drizzle-kit ever generates a `DROP`, `db:migrate` will now refuse it instead of applying it.

## Remaining risks

* The ledger stores filenames only, not checksums: an applied file edited later is not detected. Adding a checksum column would alter the production ledger and was deliberately left out.
* Pre-existing database routines can change session state the guard only re-checks for two settings (see Round 4).
* See "Not detected" above: the guard is structural and cannot see into pre-existing routines or prove a predicate is selective.
* Restricting routine migrations to the constructs listed above may reject a legitimate future migration (for example `EXECUTE format(…)` for constraint-name discovery); such a migration must be restructured or go through review.
* Concurrent *routine* `db:migrate` runs are not serialized by this PR (only destructive runs are).
* `run-migrations.ts` itself uses the Neon driver, so the CLI wrapper cannot be exercised against local PostgreSQL; the logic it calls (`runPendingMigrations`) is tested against real PostgreSQL.
* Whether production already ran `cleanup_phase2.sql` is still unknown.

## Review findings addressed (Codex, commit `6af3a8e`)

Reproduced against the reviewed commit on a disposable local database before fixing:

| # | Finding | Reproduction (old code) | Root cause | Fix |
| --- | --- | --- | --- | --- |
| 1 (P1) | Dynamic SQL bypass | `DO 'BEGIN EXECUTE ''DROP TABLE users''; END';`, `DO $$ BEGIN EXECUTE 'DR' \|\| 'OP TABLE users'; END $$;`, `EXECUTE format('DROP %s users','TABLE')` were accepted and the table was dropped | String literals were inspected independently of their role; single-quoted bodies were treated as data and concatenated/assembled SQL was never visible | Reject `EXECUTE`/dynamic-SQL functions/`CALL`/`COPY`; parse single-quoted and dollar-quoted bodies as code; default-deny statements and `DROP` kinds |
| 2 (P1) | DELETE guard used any WHERE | `WITH marker AS (SELECT 1 WHERE true) DELETE FROM users;` was accepted and emptied the table | Statement-wide `\bWHERE\b` test | Per-command parse; WHERE must be at the DELETE's own depth |
| 3 (P1) | Authorization named only the database | Authorization accepted for any server with the same database name | `current_database()` is not an identity | Target fingerprint (server-reported ids + route), fail-closed |
| 4 (P2) | Check-then-run race | Two overlapping runs both succeeded and the destructive SQL executed twice (`INSERT … ON CONFLICT DO NOTHING` hid the collision) | Ledger read before the transaction, no mutual exclusion | Advisory xact lock + atomic ledger claim before any statement, one transaction |

## Round 3: Unicode-escaped identifiers and the lexing boundary (Codex, commit `d4b6a8c`)

**Finding.** The prohibited-function check compared a quoted identifier's *raw* text against a list, but `U&"query\005fto\005fxml"` (and `UESCAPE` variants) is a quoted identifier PostgreSQL decodes to `query_to_xml` — the scanner accepted it. Verified on a disposable database: PostgreSQL returns the same result for the escaped and plain spelling, and `d4b6a8c` accepted the escaped statement. `postgres-sql-scan.ts` (the splitter) was reviewed too: it only needs `"…"` pairing, which is identical for `U&"…"`, so it is not affected; only the classification was.

**Correction chosen: reject, not decode.** Two options were evaluated. Decoding would require re-implementing PostgreSQL's identifier rules (four-/six-digit escapes, surrogate pairs, `UESCAPE` operand restrictions, doubled escape characters, malformed-sequence errors) and then trusting that our decoder and the server agree forever; any divergence is a bypass. Rejecting needs no decoder, handles malformed and alternate-delimiter forms for free (they are all `U&"` tokens), and costs nothing in practice: no migration in the repository uses a Unicode-escaped identifier. Standard quoted identifiers (`"Order Items"`, `"Query_To_Xml"`) and `U&'…'` *string data* still work; the tokenizer tags identifier flavour (`plain`/`unicode`) so a unicode identifier can never be treated as an ordinary quoted name.

**Same-class weaknesses found while reviewing the tokenizer, all reproduced against `d4b6a8c` and fixed here** (each emptied a table on the disposable database):

| Bypass | Why it worked | Fix |
| --- | --- | --- |
| `DO 'BEGIN '⏎'EXECUTE …'` | adjacent literals are concatenated by PostgreSQL; only the first was analysed | exactly one body literal; adjacent/multi-literal rejected |
| `DO LANGUAGE 'plpgsql' $$…$$` shape | the language literal was mistaken for the body | `LANGUAGE`'s operand excluded from body candidates |
| `SET standard_conforming_strings = off; SELECT '\''; DELETE …; SELECT '\''` | under non-standard strings `\'` escapes the quote, so the guard saw a string where PostgreSQL saw code | setting names rejected anywhere + runtime assertion that the session has standard strings and UTF-8 |
| Unicode spaces (U+00A0, …) | JS `\s` treats them as whitespace; PostgreSQL does not | lexer whitespace is exactly ` \t\n\r\f\v`; keyword folding is ASCII-only like PostgreSQL |

### Is the fail-closed claim sufficient?

The guarantee is now: *a statement is accepted only if every token the guard understood is permitted and nothing in it depends on a construct the guard cannot lex or decode.* What backs that: an allowlist of statement kinds; deny-by-default `DROP`; rejection of every dynamic/escaped/ambiguous construct listed above; a lexer/splitter cross-check; and a live check of the two session settings the lexer assumes.

Constructs that cannot be analysed reliably and are therefore rejected explicitly: dynamic SQL, `CALL`, `COPY`, non-plpgsql/sql languages, `E''`/`U&''` procedural bodies, adjacent/multiple body literals, Unicode-escaped identifiers and `UESCAPE`, lexing-changing settings, unknown statement kinds, meta-commands, unterminated tokens.

Remaining limits (unchanged in kind, listed for honesty): the guard is a static analysis of text. It cannot see what an *existing* routine does when called, lossy `ALTER COLUMN … TYPE … USING`, `UPDATE` without `WHERE`, always-true predicates beyond the trivial forms, server-side settings changed outside the file (checked only for the two above), or PostgreSQL grammar added after this review. New server versions should be re-reviewed against this list.

## Round 4: computed `set_config()` names (Codex, commit `772f582`)

**Finding.** Round 3 rejected any token spelling a parse-relevant setting name, but a name can be *computed*: `SELECT set_config('standard_conforming_' || 'strings', 'off', false);` contains no such token. The next statements were then lexed by PostgreSQL under non-standard string rules while the guard had read them under standard rules, so `SELECT '\''; DELETE FROM victim; SELECT '\'';` looked like two string literals and executed a DELETE.

**Reproduced on `772f582`** (disposable database): concatenated name, `format()`-built name, `pg_catalog."set_config"(lower(…)||…)` and `UPDATE pg_settings SET setting = 'off' WHERE name = 'standard_conforming_' || 'strings'` were all accepted and each emptied the table; `SET NAMES 'SJIS'` was accepted and silently switched the session's `client_encoding` (a second, separate hole in the name-matching approach — `NAMES` is an alias).

**Root cause.** Name-matching is the wrong abstraction for configuration. The set of dangerous settings is open-ended and names can be computed, so the guard cannot decide *which setting* is being changed. The correct rule is name-independent: a routine migration does not change configuration at all.

**Correction.**
1. `set_config`, `pg_settings` and `pg_show_all_settings` are rejected wherever they appear as an identifier (unquoted in any case, quoted, schema-qualified; `U&"…"` spellings are already rejected as unicode-escaped identifiers). Arguments are never inspected. Strings and bodies cannot indirectly call them because `EXECUTE`, `query_to_xml`, `dblink`, `CALL`, `PREPARE` and `COPY` are all rejected, and function/DO bodies are lexed as code.
2. A statement that starts with `SET`/`RESET` is a configuration command and is rejected unless it is one of three timeouts that cannot affect parsing. "Starts a statement" includes the first token of a piece and the token after `THEN`/`ELSE`/`LOOP`/`BEGIN`/`ATOMIC` in procedural bodies. `UPDATE … SET`, `ON DELETE SET NULL`, `ALTER … SET DEFAULT/NOT NULL/DATA TYPE` never start a statement and are unaffected. No historical migration contains a `SET`/`RESET` command, `set_config` or `pg_settings`.
3. `ALTER DATABASE|ROLE|USER|GROUP|SYSTEM` is rejected (persistent configuration; `ALTER ROLE/USER` also changes credentials).
4. **Defence in depth:** the live-session assertion (standard strings on, UTF-8) is repeated immediately before COMMIT, inside the transaction, for routine and destructive runs. If anything the static scan could not see — for example a function that already exists in the database and calls `set_config` — changes lexing, the whole file (and the destructive claim) rolls back. Tested with exactly such a pre-existing function.

**Assessment of the boundary.** The guard cannot be made reliable by recognising specific *settings*; it is reliable only where the rule is structural and name-independent. The design now has three layers: (a) structural rejection of everything that can change configuration or run computed SQL, (b) a live check of the two assumptions the lexer makes, before the work and before COMMIT, (c) single-transaction execution so a failed layer-(b) check undoes the file. What it still cannot do is understand what an *existing* routine does when called; that is the residual risk, now bounded by layer (b) for the lexing assumptions only. Settings that influence semantics without affecting lexing (for example `search_path` changed inside a pre-existing routine) are not re-checked.

## Round 5: which `LANGUAGE` clause? (Codex, commit `395df8b`)

**Finding.** The function check used the *first* `LANGUAGE` token anywhere in the statement. A parameter named `language` is such a token, and the token after it (its type) was read as the language. With a parameter typed by a domain called `sql` or `plpgsql`, the guard decided the function was SQL/PL/pgSQL while PostgreSQL used the real clause at the end.

**Reproduced on `395df8b`** (disposable database, superuser): `CREATE DOMAIN sql AS text; CREATE FUNCTION evil2(language sql, b text, c bool) RETURNS text AS 'set_config_by_name' LANGUAGE internal;` was accepted and PostgreSQL created a function in language `internal` — an alias of the builtin behind `set_config`, under a name no token rule recognises. The same shape works for `plperl`/`plpython`. (The runtime pre-COMMIT check from round 4 still limits the lexing-setting consequences, but the guard itself had misclassified the definition.)

**Root cause.** Clause identification by "first matching keyword" with no syntactic context.

**Correction.** Definitions are parsed structurally (table above). Parameter names, types, defaults and return-type tokens cannot influence any decision: the argument list is skipped by parenthesis matching, and only depth-0 tokens after it count. A valid definition has exactly one `LANGUAGE` and one `AS`, so any other count is invalid or unattributable and is rejected rather than resolved by position (the "last token" shortcut is deliberately not used). A return type that is itself *spelled* `language` yields two depth-0 `LANGUAGE` tokens and is rejected: a documented false positive that costs nothing in practice. `DO` is handled by the same operand rules (no parentheses exist, so every `LANGUAGE` is a clause; duplicates rejected).

**Related first-match ambiguities audited and fixed in the same change:**

| Location | Problem | Fix |
| --- | --- | --- |
| `DO` / `CREATE FUNCTION` recognition | only recognised as the *first token* of a piece, so `DO $$ BEGIN CREATE FUNCTION … LANGUAGE internal …; END $$` and nested `DO` bodies were not examined | recognised at every statement start (piece start, or after `BEGIN`/`THEN`/`ELSE`/`LOOP`/`ATOMIC`) |
| `isCreateTrigger` (unlocks `EXECUTE FUNCTION`, trigger-event `TRUNCATE`) | "TRIGGER within 4 tokens of any CREATE", so `CREATE TABLE t (trigger int) …` unlocked it | exact `CREATE [OR REPLACE] [CONSTRAINT|EVENT] TRIGGER` shape |
| `ALTER TABLE` / `DROP` | first `ALTER TABLE` occurrence defines the context; a later `DROP` is judged under it | unchanged: a mis-attribution can only make the check *stricter* (the ALTER TABLE allowlist is a subset of the general one) |
| `DELETE`'s `WHERE` | first `WHERE` at the DELETE's own depth | unchanged: depth-0 `WHERE` of the same extent can only belong to that DELETE |
| `SET`/`RESET` statement starts | piece start / after lead words | unchanged (round 4) |

**Remaining limits specific to this area.** `CREATE FUNCTION` is the only construct that embeds foreign code; `CREATE LANGUAGE`/`CREATE EXTENSION` are not blocked (a function using the new language is, because only `sql`/`plpgsql` are accepted). Functions created by an earlier migration are not re-examined.
