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

27 targeted tests pass across subscription security, paid checkout protections,
read-state contracts, Nutrition cancellation, Wedding onboarding, trial routes,
invitation limits, real route middleware and frontend request routing. Coverage
includes concurrent/duplicate/cross-tier requests, strict client input rejection,
account scoping, exact expiry boundary, active Premium/Elite authorization,
expired denial, consumed eligibility after cancellation/downgrade, failed writes,
Free onboarding, and readable records above Free limits.

Commands: run each of the following with `node --import tsx <file>`:

- `server/lib/subscription-security.test.ts`
- `server/routes/subscription-authorization.test.ts`
- `server/routes/subscription-read-state.test.ts`
- `server/routes/subscription-checkout.test.ts`
- `server/routes/nutrition-subscription-cancellation.test.ts`
- `server/routes/wedding-onboarding.test.ts`
- `server/routes/wedding-trial.test.ts`
- `server/lib/wedding-invitations.test.ts`
- `server/routes/wedding-feature-access.test.ts`
- `client/src/pages/services/wedding-planning/weddingSubscription.test.ts`

`npm run build:client`, `npm run build:server`, and `git diff --check` pass.
Vite reports existing chunk-size and static/dynamic-import warnings.

The opt-in PostgreSQL migration/concurrency/preservation test is
`server/migrations/wedding-trial.postgres.test.ts`; run with an isolated
`TEST_DATABASE_URL`. It explicitly never uses application `DATABASE_URL`. It was
skipped here because no isolated PostgreSQL service/test URL is available. The
passing route tests use a database double; they do not replace that integration
check. The existing `useWeddingSubscription.test.ts` React-renderer suite could
not run because `react-test-renderer` is absent; dependency installation failed
with an unreachable shell proxy. The frontend request tests and client build ran.

Unrelated TypeScript diagnostics are documented separately in
`docs/wedding-trial-typescript-baseline.md`.

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
