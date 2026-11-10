# ChefSire back office Part 3b — permanent account closure

Tracking: [issue #1486](https://github.com/myron302/chefsire/issues/1486), draft PR #1487.

## Rollout state: HARD OFF

`server/lib/closure-feature.ts` hardcodes `PERMANENT_CLOSURE_AVAILABLE = false`.
Mutation primitives are restricted to `NODE_ENV=test` with the loopback
`CS_TEST_PG_URL` harness. **There is no public or staff endpoint capable of
permanently closing a member.** The legacy DELETE endpoint returns an explicit
disabled response instead of hard deleting records; Deactivate still works.
Do not change the hard switch, merge, deploy or execute production DDL until
the owner explicitly approves and legal/retention review is recorded.

## Implemented and regression-tested

- Closed account status is terminal across password/OAuth shared sign-in gates,
  staff reinstatement, and public visibility.
- Marketplace new-order creation and first payment reservation serialize with
  buyer/seller row locks and check status only after lock acquisition.
- Read-only local blocker inventory covers orders, refunds, payout obligations,
  Wedding subscriptions/card attempts, catering bookings/payments/invoices,
  meal plans, creator memberships/sales, drink collections/bundles/gifts, and
  digital-access obligations. Missing tables/errors reject preflight.
- Staff-only closure preview reports account status, local blockers, direct FK
  inventory, indirect FK cascade risks, owned private-content candidates,
  DM/evidence classifications, and store/download retention. **It never
  advertises closure as authorized**, even with zero local blockers.
- Test-only transaction primitives: random opaque identity tombstone (all
  sign-in credentials and profile PII cleared, cached entitlements reset,
  financial aggregate and user PK retained); ordinary sender-owned DM body
  and attachment redaction (booking evidence untouched); store and product
  unpublish (purchased products/digital files preserved); strictly reviewed
  private-content FK deletion with child-before-parent order and cascade-risk
  refusal; count-only closure audit; validated durable media-outbox queue.
- Isolated transaction prototype composes the primitives under a users-row
  lock, refuses local financial obligations/unclassified FKs/media requiring
  ownership analysis, and verifies rollback, counterparty retention,
  idempotency and actor checks. This is **NOT** a production closure service.
- Regression suites run under GitHub Actions with real disposable PostgreSQL
  and the normal application build.

## Production rollout blockers — do not bypass

1. Owner-approved legal/privacy/tax/payment retention policy: retention limits,
   third-party data and legal holds; delineation of protected financial evidence
   from unnecessary PII in JSON, addresses and audit logs.
2. Full Square provider-backed confirmation of terminal subscriptions,
   outstanding invoices, refunds/chargebacks/disputes, payout holds and creator
   billing. A local snapshot alone never authorizes deletion.
3. Compatible users-row locks or equivalent atomic status checks for EVERY
   competing financial write path (catering, creator purchases and memberships,
   digital purchases, subscription enrollment, payouts, background jobs), not
   just Marketplace orders and initial payment reservations.
4. Resolve every live direct and indirect FK/trigger dependency before
   unlocking private-content deletion. The conservative prototype refuses
   unreviewed shared or financial descendants.
5. Design + complete the media reference resolver and post-commit worker
   across local uploads, R2, shared media, paid downloads, caches and backups;
   currently the outbox schema/helper exists but **no object-deleting worker**
   is enabled. A member with unresolved media is refused by the prototype.
6. Member password/OAuth step-up, staff elevated step-up + members.close
   permission + reason, owner protections, legal-hold workflow, provider
   reconciliation evidence and final atomic coordinator/HTTP/UX tests.
7. Independent code review (Codex review quota was exhausted at last request).
8. Explicit owner approval for all required schema changes, including
   `2026-11-10-account-closure-preparation.sql` and
   `2026-11-10-account-closure-media-outbox.sql`, and a verified backup branch
   before any production migration. Neither SQL file has been applied.

**No current implementation should be described as completing Part 3b.**
A green PR build is proof only of the tests it ran, not legal or provider
approval to erase data.
