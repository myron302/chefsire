# Catering Phase 2Q — Square SANDBOX processor-backed customer payments

**Status: sandbox only.** Nothing in this phase configures, activates or calls production Square. Production activation is a
separate, later launch step.

## Funds flow

```
CUSTOMER
   │  pays on Square's hosted checkout (no card field in ChefSire)
   ▼
Square hosted checkout / payment link        ← created UNDER THE PROVIDER'S OWN connected Square account
   ▼
PROVIDER'S CONNECTED SQUARE ACCOUNT          ← their OAuth credential, verified merchant, verified card-capable location
   ▼
funds settle directly to that provider
```

ChefSire **never receives, holds or routes** the money. It uses no platform Square account for Catering, takes no fee, runs no
payout and issues no refund. What ChefSire does is *record* a payment in the existing Catering ledger — and only after reading fresh,
authenticated evidence back from Square with the provider's own credential.

* The checkout is created with `checkout.paymentLinks.create` using the provider's decrypted OAuth token from the Gate 0 service
  (`getReadyConnectedCredentials(providerId)`), at the provider's verified location. ChefSire's own reference (the attempt id) is put
  on the Square order (`reference_id`), and the attempt id also derives the Square idempotency key.
* The platform client (`SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`) is never used. `catering-square-boundaries.test.ts` pins that.

## Scope (V1)

Square only · USD only · Square **sandbox** only · hosted checkout · the provider's connected account · no platform fee · no
processor refund · no payout rail · no split settlement · no FX · no production activation. A customer pays an **existing issued**
invoice. The customer never supplies an amount.

## Attempt persistence and state machine

`catering_booking_payment_attempts` (migration `20261014_catering_square_payments.sql`, declared in
`shared/schema/domains/catering-square-payments.ts`). Integer cents. No credential is stored. `processor_environment` is CHECKed to
`'sandbox'`, so a production row is unrepresentable until a later phase deliberately changes the constraint.

| state | meaning |
| --- | --- |
| `creating` | attempt persisted (with its idempotency key) **before** the Square call; Square's answer not yet known |
| `pending` | Square created the checkout; the customer can pay |
| `completed` | fresh Square evidence + fits the ledger now → ledger row written in the same commit |
| `reconciliation_required` | Square confirmed money **moved** but it cannot be credited as a normal payment; evidence kept |
| `failed` | Square definitively refused to create it |
| `cancelled` / `expired` / `superseded` | the checkout was closed before any money moved |

A payment can still arrive on a checkout ChefSire believed closed (`failed`, `cancelled`, `expired`, `superseded`); settlement
accepts any attempt that has not already consumed a payment, so money that moved is never discarded. Browser redirects are never
read as success.

Database invariants: one open (`creating`/`pending`) attempt per invoice; unique idempotency key, Square order, payment link, Square
payment id and ledger row; a `completed` row must name its ledger row and Square payment; `reconciliation_required` must keep its
evidence and may have no ledger link; a Square payment id exists only on the two money-moved states.

## Endpoints

* `POST /api/catering/bookings/:id/billing/invoices/:invoiceId/pay` — customer only. Authenticated, same-origin JSON, **empty strict
  body**. Role comes from the persisted booking: a provider gets 403 (and nothing is created), a stranger or a wrong booking/invoice
  gets the existing non-enumerating 404. Amount/currency are derived under the billing lock from the invoice's **effective
  payable** (Phase 2P), never the face amount. Zero payable, void, cancelled booking, non-USD → refused. An existing compatible open
  attempt is returned; an incompatible one is superseded (link deleted best-effort). `202` while Square's answer was uncertain
  (`creating`): the same request again resumes the same checkout.
* `GET /api/catering/bookings/:id/billing/payment-attempts/:attemptId` — either participant (the customer only their own). A
  customer's read asks Square (throttled per attempt) and answers with whatever settlement concludes; a provider's read is DB-only.
* `POST /api/catering/webhooks/square` — Square signature (HMAC-SHA256) over the **raw body** and the **exact configured URL**
  (`SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL`, `SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY`; no default; the URL is never derived from the
  request). Fails closed (503) when not sandbox or not configured; 401 on a bad signature.

## Authoritative verification and convergence

`settleAttempt` is the **only** path from Square to the ledger. Webhook, poll and retry all call it. It:

1. refuses unless Square is configured for the sandbox;
2. resolves the **provider's** current credential and refuses if the connection now belongs to a different merchant than the attempt;
3. reads the order and each of its payments **fresh** from Square;
4. compares every identifier: the order, its location, ChefSire's reference, each payment's order and location; only a `COMPLETED`
   payment is money in hand (`APPROVED`/`PENDING` is *processing*); the amount (incl. tip) and currency must equal what was asked;
5. in **one transaction** — billing advisory lock → booking row → attempt row — recomputes the CURRENT payable and either inserts the
   ledger row (`payment_source='processor'`, `processor='square'`, `processor_payment_id`, `payment_method='card_online'`,
   `recorded_by` NULL), completes the attempt and writes the `billing_processor_payment_confirmed` activity row together, or keeps the
   evidence as `reconciliation_required`.

Duplicate credit is prevented three times: the attempt row lock + state, the attempt's unique `square_payment_id`, and the ledger's
existing unique `(processor, processor_payment_id)`. A webhook payload is only a trigger — only identifiers needed to find the attempt
are persisted (`catering_square_webhook_events`, unique `event_id`, retry state); nothing in a payload is used as evidence.

## Money moved but the payable changed

Example: checkout for $600, then a legitimate credit makes the payable $300, and Square confirms $600.
ChefSire does **not** clamp to $300, does **not** pretend only $300 moved, does **not** create an automatic refund, and does **not**
add a normal ledger credit. The attempt becomes `reconciliation_required` with `reconciliation_reason`, `square_payment_id`,
`processor_amount_cents` and `processor_currency` retained. The provider sees it (and the Square payment reference) in the billing
section and is notified; the customer sees a safe explanation and is told not to pay again. Reasons: `payable_changed`,
`invoice_not_payable`, `booking_cancelled`, `amount_mismatch` (incl. a tip), `currency_mismatch`, `multiple_payments`.

Booking cancellation closes the booking's open checkouts **in the cancellation transaction itself** (billing advisory lock → booking
update → local close, one commit), database only, so a cancelled booking never has a live checkout in the database and a Square outage
cannot roll back or block a cancellation. After the commit the Square links are removed best-effort (`sweepClosedLinks`);
`square_link_closed_at` is written **only** once Square confirms the link is gone (a delete, or a 404 meaning already absent), so an
unconfirmed closure is never recorded as confirmed and is retried by later sweeps (status checks and billing mutations). Money that
still lands on a link that could not be removed is recognised by settlement and routed to `reconciliation_required`.
A withdrawn invoice or a payable that fell below the checkout amount closes the checkout the same way, on the customer's next status
check and after every billing mutation.

## What did not change

Phase 2P external refund *records* remain records of money returned outside ChefSire; they are not Square refunds (those are
Phase 2R). The Phase 2L/2P authorization, idempotency, locking, adjustment and payment-void rules are unchanged; a processor payment
can't be taken back through the provider void route (`evaluatePaymentVoid` already refuses non-provider-recorded payments).

## Gate 0 parity fix found on the way

`payment_methods.verified_at`, `last_verified_at`, `created_at` and `updated_at` are `timestamptz` in the SQL migrations but were
declared `timestamp` in Drizzle. A database built by `db:push` therefore failed Gate 0's connection write ("inconsistent types deduced
for parameter"), and a push over a migrated database would narrow them. The Drizzle declarations now match the SQL.

## Operating it (sandbox)

1. Configure `SQUARE_ENV=sandbox`, the Square application id/secret and `SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY` (Gate 0).
2. Add a sandbox webhook subscription for `payment.created`, `payment.updated`, `order.created`, `order.updated`; set
   `SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL` to its exact URL (`…/api/catering/webhooks/square`) and
   `SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY` to its key.
3. Apply `server/migrations/20261014_catering_square_payments.sql` (or `npm run db:push`).

## Tests

Real-PostgreSQL suites (set `TEST_DATABASE_URL` to a loopback database whose name contains `test`):
`server/services/catering-square-payments.postgres.test.ts`, `server/routes/catering-square-payments-http.postgres.test.ts`,
`server/services/catering-square-schema.postgres.test.ts` (SQL migration ≡ `drizzle-kit push`, and push over a migrated DB is a
no-op). They use the real Gate 0 connection service with real sealed credentials, the real `square` SDK against
`server/test-support/fake-square.ts`, and a database cloned from a template built by `drizzle-kit push`. Pure/static suites:
`catering-square-payment-policy.test.ts`, `catering-square-boundaries.test.ts`, `catering-booking-payment-attempt.test.ts`,
`catering-square-payment-state.test.ts`.

The Phase 2L/2P/2N real-Postgres suites gated on `CATERING_TEST_PG_URL` (`catering-billing-adjustments-http`,
`catering-offer-negotiation-http`) build their schema from the migrations, so they now also apply `20261014_catering_square_payments.sql`:
the billing read lists Square checkout attempts, so that table is part of what the billing routes require.
