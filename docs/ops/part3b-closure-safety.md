# Part 3b: permanent-closure safety gate (stage 1)

Tracking issue: https://github.com/myron302/chefsire/issues/1486

## What this stage does

- Adds **closed** as a recognized, terminal status to both public visibility checks and member/staff login and status transition rules. No code in this stage creates that status.
- Disables the legacy **hard DELETE /api/users/:id** operation. Members with retained transaction records still receive the existing 409; all other authenticated self-delete requests receive 503 `PERMANENT_CLOSURE_DISABLED`. Deactivate remains available.
- The Settings page describes permanent closure as not yet available.
- Includes the future CHECK widening migration for review. **Do not run it against production without explicit owner approval.**

## Still missing; do not enable closure

- Complete field-level inventory of ledgers and retained PII; reconcile payment/provider obligations and legal holds.
- Every order, payout, subscription and catering financial write must serialize with closure's user row lock and honor terminal status.
- Single-transaction tombstoning and nonfinancial content erasure, safe DM body redaction, preserving buyer/seller ledger joins.
- Durable media deletion outbox, idempotency, privacy/retention review and comprehensive real-PostgreSQL regression suite.
- Separate customer/staff step-up authorization and repeatable account-closure audit proof.

**Permanent closure stays OFF in production.** This is not a complete Part 3b implementation. Neither merging nor deploying this PR authorizes running the SQL migration or erasing anyone's data.
