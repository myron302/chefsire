# Stability & security hardening — Phase 1: Square environment and schema-push safety

## A. Square environment selection

**One policy**: `server/lib/square-environment.ts` (`resolveSquareEnvironment`). Every Square integration reaches it through
`server/lib/square-integration.ts` (`squareEnvironmentName`, `squareApiEnvironment`, the client factories, `squareOauthAuthorizeUrl`,
`squareOauthApplication`). `server/lib/square.ts` (drink / membership / bundle checkout and its webhook) no longer has its own policy.

| `SQUARE_ENV` | `NODE_ENV` | `SQUARE_LIVE_PAYMENTS_ENABLED` | Result |
|---|---|---|---|
| unset / blank | not `production` | – | Sandbox |
| unset / blank | `production` | – | **configuration error** (not LIVE, not silently Sandbox) |
| `sandbox` | any | – | Sandbox |
| `production` | `production` | `true` | LIVE |
| `production` | `production` | anything else | configuration error |
| `production` | not `production` | – | configuration error |
| anything else | any | – | configuration error |

A configuration error means "not configured": clients are never built, the provider OAuth application reads as unconfigured (no authorize
URL), the marketplace capture/refund routes answer 503 before any state change, the public `square-config` route answers 503, the drink
checkout/webhook paths report the environment as not safely configured, and the reconciliation job's client factory throws (the cron loop logs
and retries). Error messages are fixed text and never echo the configured value.

Catering is unchanged and still Sandbox-only (`assertSquareSandboxOnly`): a fully, deliberately LIVE environment is refused for Catering too.

### What changed from the audited behaviour
* `square-integration.ts` (marketplace capture/refund/reconciliation, provider OAuth, Catering): an unset `SQUARE_ENV` under
  `NODE_ENV=production` **selected LIVE**. That fallback is removed. *Confirmed by reading the code and by the previous unit test that asserted it.*
* `lib/square.ts` (drinks/memberships/bundles + webhook) had a *second* policy: unset or any typo (`"prod"`) meant Sandbox, exact `production`
  meant LIVE with no safeguard, and it was frozen at import. Replaced by the shared policy, evaluated at use time.
* `routes/payments.ts` `square-config` derived the environment from `NODE_ENV` alone, so it could advertise a different environment from the
  one the server calls. It now reports the shared policy's answer.

### Deployment impact (action required before deploy)
* Production hosts that rely on the old fallback **must set `SQUARE_ENV` explicitly** (`sandbox` while LIVE is not intended) or those Square
  features report "not configured". Going LIVE later additionally needs `SQUARE_LIVE_PAYMENTS_ENABLED=true`.
* Drink/membership checkout now uses the shared client factory, which applies a 15 s request timeout (previously none).

## B. Schema synchronisation

### Root cause (reproduced on a disposable local PostgreSQL)
`drizzle-kit push` treats the declared schema as the whole database. With undeclared tables present it planned
`DROP TABLE "<table>" CASCADE` for each of them (plus `ALTER ... DISABLE ROW LEVEL SECURITY`), applies statements one at a time with no
transaction, and only asks for confirmation when it sees rows that would be lost (an empty table, an enum or a sequence is dropped silently).
`db:push:accept` passed `--force`, which skips even that confirmation.

### Undeclared tables (36 found in the repository, plus one external)
Found by comparing the real Drizzle metadata (`shared/schema.ts`, `shared/schema.dm.ts`) with every `CREATE TABLE` in `server/drizzle`,
`server/migrations`, `migrations`, route/service runtime DDL and scripts. They are listed with their origin in
`shared/schema-unmanaged-tables.ts`:

| Kind | Tables |
|---|---|
| migration ledger | `_app_migrations` |
| audit evidence | `legacy_credential_invalidations` |
| quarantine | `recipe_remixes_invalid_lineage` |
| external (Neon sample, not in repo) | `playing_with_neon` |
| historical hand-written SQL | competitions (4), cook-together (2), `event_*` (2), `recipe_duets`, `seasonal_events`, `health_*` (2), `recipe_timing_log`, `taste_profiles`, `user_analytics`, `user_goals`, `households`, `household_members` |
| runtime `CREATE TABLE IF NOT EXISTS` | meal-plan/shared-week social (8), `meal_planner_analytics_events`, `pantry_household_invites`, `wedding_*` (6) |

None of these is a payment, entitlement, refund, payout or order table; those are all declared. Evidence-bearing ones
(`legacy_credential_invalidations`, `_app_migrations`, `recipe_remixes_invalid_lineage`) are the reason the protection had to be structural.

**Why they were not added to the Drizzle schema in this PR.** Declaring an existing production table makes push manage it: any difference
between my declaration and Neon's real table (which this PR must not read) becomes `ALTER`/`DROP COLUMN` against live data. A declaration needs
a definition *proven identical* (the catering/Square tables have SQL↔Drizzle parity tests). That proof requires a read-only introspection of
Neon and is deferred (see "Remaining risks"). Until then they are excluded from push, which is the non-destructive option, and registered so
that nothing new can fall outside both lists (`server/lib/schema-table-coverage.test.ts`).

### Safeguards
1. **`tablesFilter` in `drizzle.config.ts`**, derived from the schema by `shared/schema-managed-tables.ts` (no second list): push cannot see,
   drop or alter any undeclared table.
2. **Plan review before apply** (`server/scripts/push-schema.ts`, pure logic in `server/lib/schema-push-plan.ts`). The plan is produced with
   `drizzle-kit push --strict --verbose` and a closed stdin (applies nothing). Statements that drop tables, columns, enums, sequences,
   views or schemas, truncate or delete, change a column type, or drop a constraint/index with no same-table replacement are **refused** with
   the statements listed. The CHECK `payouts_completed_transfer_check`, which push-schema re-asserts after every push, is the only exception.
3. **Explicit, plan-specific acknowledgement**: `npm run db:push -- --accept-plan=<token>`. The token is a hash of exactly the dangerous
   statements, so it cannot be reused for a different plan. `--force` / `db:push:accept` no longer bypasses anything on a real database. A
   loopback database whose name contains `test` (the existing disposable-harness convention) acknowledges implicitly.
4. **Atomic apply**: the reviewed plan runs in one transaction with `lock_timeout`; any failure rolls back everything (drizzle-kit alone leaves
   a partial schema). An unreadable or truncated plan is refused, never treated as empty.
5. A sequence still owned by or defaulted into a column of an undeclared table (drizzle-kit wants to drop it; the drop can never succeed and
   is never wanted) is skipped and reported.

The existing pre-/post-push enforcement scripts (payout, marketplace revenue/checkout atomicity, meal-plan payment, Square plaintext
finalization) are unchanged and still run in the same order. Indexes, CHECK and unique constraints, and trigger-based append-only protections
on declared and undeclared tables are verified unchanged by the PostgreSQL test below.

### Known pre-existing behaviour (not changed)
Every push re-plans a drop and re-add of ~50 foreign keys and a few indexes/constraints because drizzle-kit compares untruncated identifiers
while PostgreSQL truncates them at 63 characters. It is not data loss; it is now atomic. A future PR can fix the names.

### Verification
* `server/lib/schema-push-plan.test.ts`, `server/lib/schema-table-coverage.test.ts` — pure.
* `server/scripts/schema-push-safety.postgres.test.ts` — creates and drops its own database; runs the real push flow; proves undeclared tables,
  rows, sequences and triggers survive, destructive plans are refused/acknowledged/atomic, and constraints/indexes/triggers are unchanged.
  Skipped (not passed) when no local PostgreSQL that can `CREATE DATABASE` is reachable.

### Remaining risks
* Neon was not (and must not be) inspected here. The real production table set, sequences, enums and constraints may differ from what the
  repository implies; the first guarded push will print and refuse anything unexpected.
* Production likely holds `wedding_vendor_listings_id_seq` / `wedding_vendor_quotes_id_seq` (BIGSERIAL runtime tables): handled by item 5.
* Declaring the unmanaged tables (so they gain managed indexes/constraints) is follow-up work needing read-only prod introspection plus parity tests.
