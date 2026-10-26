# Wedding Planner introductory trials

## Behavior and authorization

Authenticated accounts can POST `{ "tier": "premium" | "elite" }` to
`/api/wedding/subscription/trial`. No checkout, payment information, client ID,
date or entitlement status is accepted. The strict body schema rejects extra
fields. Existing authentication verifies the session and live account before
activation or protected access.

`wedding_intro_trials` is separate from legacy user subscription columns and
`subscription_history`. Its `user_id` primary key permits one introductory trial
across both tiers. A single `INSERT ... ON CONFLICT DO NOTHING RETURNING` is the
activation transaction: concurrent requests have one winner; conflicts return
409 `WEDDING_TRIAL_USED` without replacing or extending the original grant.
A failed insert grants nothing and returns a retryable 503.

PostgreSQL assigns activation and expiration timestamps, exactly 336 hours apart
(including across daylight-saving changes). Eligibility is the absence of a trial
row; expired and cancelled rows permanently consume introductory eligibility.
The additive schema restricts tiers and enforces the exact duration.

`weddingEntitlement` reads the authenticated account's trial using PostgreSQL
`statement_timestamp()`. Access requires activation <= server time < expiration
and no revocation. At the exact expiration boundary, effective access becomes
Free. No scheduled job is necessary. The read response includes `currentTier`,
`status`, `endsAt`, and `trial` with eligibility, tier, status, activation,
expiration, and remaining days rounded up. A consumed trial completes onboarding
permanently, so expiration never forces the selector again.

`hasAuthoritativePaidEntitlement()` is unchanged and remains false. Historical
paid columns, subscription history, Marketplace tiers, and client requests grant
no paid access. Square subscription checkout and paid upgrade routes remain
unavailable. Future verified payment reconciliation must supply authenticated
provider evidence to the entitlement resolver; this PR does not implement it.

Premium/Elite guards now protect invitation sending, calendar writes, registry
writes and event-detail writes. Elite guards protect saved insight writes. Saved
reads and explicit content deletion do not require a premium tier. Invitation
creation also rechecks entitlement inside a transaction after locking the user
row; Premium's 150-record cap cannot be bypassed by concurrent sends. Elite can
add beyond that cap. Existing guests above a cap are never trimmed.

The frontend selector posts Premium/Elite to the trial endpoint and Free to the
existing change endpoint. It prevents concurrent submissions, reconciles a 409
without replaying activation, refreshes active trial state at expiration and at
most every minute, shows server expiration/remaining days, and states that no
automatic charge occurs. Expired accounts see a voluntary upgrade offer; paid
checkout remains unavailable and is described honestly. Settings labels trial
expiration as “Ends”, rather than “Renews”. Existing CSV exports stay available.

## Preservation policy

Trial expiration is a read-time authorization decision and performs **no writes**.
Cancellation/downgrade revokes only the trial and updates existing subscription
metadata/history through the existing Free flow. No trial operation deletes,
resets or truncates guests, RSVPs, budgets, checklists, calendars, vendors, quotes,
registries, documents or attachments. There are no R2 calls or cleanup jobs in the
trial lifecycle. Reads remain scoped to their owner without tier filtering or
Free-limit truncation. The records remain available for future legitimate paid
access without copying, rebuilding or restoration jobs.

The same policy applies to Nutrition, Marketplace and all other subscription
domains: subscription expiry, downgrade, cancellation and payment failure are
never content-deletion signals. No non-Wedding subscription systems were
refactored. Explicit account/content deletion remains separate; deleting an
account also removes its trial metadata through the foreign key.

## Migration and deployment order

1. Review pending migrations and the database target through the existing safe
   migration workflow. Apply `server/drizzle/20261025_wedding_intro_trials.sql`
   using `npm run db:migrate` before releasing the application code. The runner
   applies each migration and ledger entry atomically.
2. Release the server, then the client containing the updated selector. New code
   fails closed if the trial table is missing/unavailable.
3. Verify an eligible test account, both read responses, and a protected action.
   Do not run integration tests against production.

The migration adds one table, a per-user primary key, a user foreign key and tier/
duration checks. It changes no existing rows or subscription history. It is
idempotent and has no backfill. For application rollback, retain the table and its
consumed-trial rows; dropping it would incorrectly restore trial eligibility.
No migration or deployment was run against Neon as part of this change.

## Validation

Final validation on 2026-10-26: **49 passed, 0 failed, 0 skipped** across 15 test
files, with a disposable PostgreSQL 16 container. Both bundle builds and
`git diff --check` pass. No production database was connected or migrated.

React and React Test Renderer are both locked at 18.3.1. The renderer was already
a declared development dependency; `npm ci --include=dev --ignore-scripts`
restores it without changing React or runtime dependencies. The added development
dependency `jsdom@26.1.0` lets React DOM replay StrictMode effects on the same
mounted workspace, which React Test Renderer 18 does not simulate.

Run each file below with `node --import tsx <file>` after installing development
dependencies. For the two PostgreSQL files, set `TEST_DATABASE_URL` to an isolated,
disposable database; never substitute production `DATABASE_URL`. In validation,
application `DATABASE_URL` was explicitly set to a dummy local connection while
all real queries were directed to the disposable test database.

| Tests | Passed |
| --- | ---: |
| `server/lib/subscription-security.test.ts` | 5 |
| `server/routes/subscription-authorization.test.ts` | 7 |
| `server/routes/subscription-read-state.test.ts` | 2 |
| `server/routes/subscription-checkout.test.ts` | 4 |
| `server/routes/subscription-routing.test.ts` | 4 |
| `server/routes/nutrition-subscription-cancellation.test.ts` | 3 |
| `server/routes/wedding-onboarding.test.ts` | 1 |
| `server/routes/wedding-trial.test.ts` | 1 |
| `server/lib/wedding-invitations.test.ts` | 1 |
| `server/routes/wedding-feature-access.test.ts` | 1 |
| `client/src/pages/services/wedding-planning/weddingSubscription.test.ts` | 2 |
| `client/src/pages/services/wedding-planning/useWeddingSubscription.test.ts` | 5 |
| `client/src/pages/services/wedding-planning/weddingRegistry.test.ts` | 7 |
| `server/migrations/wedding-trial.postgres.test.ts` | 1 |
| `server/routes/wedding-registry-links.postgres.test.ts` | 5 |

The trial migration test now exercises real concurrent cross-tier inserts,
duplicates, account isolation, Premium/Elite guards, cancellation, future-start
denial, the exact PostgreSQL expiration boundary, migration reruns, and content/
history preservation. The registry PostgreSQL tests exercise real route handlers
and SQL: Free/expired deletion, add/edit denial, concurrent deletion, final empty
lists through private/public reads, invalid requests, owner isolation, and recovery
from a real SQL statement failure.

The registry React tests render the actual workspace, registry section, and
persistence/subscription hooks. Only browser integrations, UI primitives and
unrelated views are stubbed. They cover serialized rapid deletions, sequential
removal to empty and reload, stale GET/DELETE responses, account changes (including
A to B to A), unmount/remount, actual React DOM StrictMode effect replay, and
failed/malformed response recovery. Hook tests also verify failure retry cadence,
expiration reconciliation, suppression of overlapping polling/writes, and cleanup.
There are no source-string-only assertions in the new registry suites.

PostgreSQL suites intentionally skip when `TEST_DATABASE_URL` is absent. They did
not skip in the final run. The disposable container and test schemas were removed
after validation. Expected SQL-error logs in negative tests are asserted failures
of the operation, not failures of the test suite.

`npm run build:client` and `npm run build:server` pass. Vite reports existing
chunk-size and static/dynamic-import warnings; esbuild reports the existing large
server bundle. Unrelated TypeScript diagnostics remain documented separately in
`docs/wedding-trial-typescript-baseline.md`; this validation does not claim a clean
repository-wide TypeScript check.

## Existing feature limitations / authorization follow-up

No remaining Wedding backend operation was found trusting raw `weddingTier` or
Marketplace flags to grant premium access. The legacy vendor-messaging hook now
checks effective Wedding entitlement rather than `user.subscription`.

However, `/api/wedding/vendor-message` has no server implementation. Saved-vendor
selections, some planning/AI calculations and budget optimization are browser
state/presentation, not authoritative backend services. Custom websites,
coordinator assignment and priority response fulfillment are also not implemented
by the existing Wedding routes. These do not become working services merely by
activating Elite. Future endpoints must use server Wedding entitlement checks.
The unused raw `userTier` read in `server/routes/stores-crud.ts` remains an audit
follow-up outside this Wedding PR; it currently does not authorize an operation.
Nutrition's recorded-state helper is used only for provider-cancellation decisions,
not premium authorization. Non-Wedding premium helpers remain fail closed.
