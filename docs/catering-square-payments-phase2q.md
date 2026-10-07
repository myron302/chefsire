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
unconfirmed closure is never recorded as confirmed. That durable external-link state is separate from the attempt's business state: a
locally `cancelled`/`superseded`/`expired` attempt whose link is unconfirmed keeps being retried, from customer and provider status reads,
billing reads by either participant, billing mutations and stale sweeps, with atomic claiming and exponential backoff (30s doubling to a
15-minute cap; `square_link_close_attempts` / `_attempted_at`) so concurrent paths share one Square call and an outage is not hammered, but
retries never stop while the link is unconfirmed. Money that
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

The billing view lists **every** `reconciliation_required` attempt plus a bounded window (50) of the most recent other attempts, so the
history cap can never hide unresolved money that moved (that attempt row may be the only provider-visible record of it).

## Every completed Square payment is kept (Codex repair pass 3)

An order can show more than one completed payment. `catering_attempt_square_payments` holds **one row per completed Square payment**
(unique `square_payment_id`, so a payment is evidence for exactly one attempt), with its own amount, tip, currency, Square
`created_at`/`updated_at` and the completion time the accounting date derives from. They are written in the same transaction, **before** the
attempt can become terminal, and nothing is merged or chosen between: with more than one payment the attempt's `square_payment_id` is NULL
(there is no single reference), `processor_payment_count` says how many, and the amount is shown only when the payments share one currency.
A new webhook for an attempt that already consumed a payment audits Square again; a completed payment not yet recorded is added as evidence
and the attempt becomes `reconciliation_required` / `multiple_payments` while the ledger row already credited is left untouched. A replay
finds nothing new. The provider view lists every payment with its Square reference; the customer view lists amounts and times, never ids.

## The accounting date is Square's date

`received_on` is the day SQUARE completed the payment, in the provider's calendar (the same `cateringBillingDay` every billing date uses),
not the day ChefSire verified it. The completion time is the payment's `updated_at` (when it reached `COMPLETED`), or `created_at` if a
refund has since moved `updated_at`. A missing, malformed or future time is never replaced by ChefSire's clock: the money is kept as
`reconciliation_required` / `payment_timestamp_invalid`, with the evidence.

## Client retry lifecycle

The uncertain-checkout retry timer belongs to a scheduler keyed by viewer + booking + invoice. It is cleared on unmount and whenever that
identity changes, a retry re-sends the request it was scheduled for, and every success/error callback checks that its identity is still
the one on screen before it sets state, retries or redirects.

## Stale checkouts after amendments, and the Square connection lifecycle (Codex repair pass 4)

* An accepted amendment re-judges the booking's open checkouts against the NEW ledger, after its transaction commits (same
  `closeStaleOpenAttempts` every billing change uses). Billing itself refuses a price reduction that would leave live invoices asking for more
  than is owed, so a reduction cannot lower an invoice's payable; what the hook protects is a checkout already made stale by an earlier credit or
  payment. The billing view also refuses to OFFER any open checkout the ledger no longer supports, even before the sweep has closed it.
* Before the provider's Square credential is discarded (disconnect) or replaced by a DIFFERENT merchant's (OAuth callback), every open checkout
  is closed locally and its Square link is deleted with the OLD credential, with no backoff. If a link cannot be closed the change is REFUSED
  (`409 connection_in_use`, or `?error=connection_in_use` on the callback) with the credential untouched; it succeeds when Square answers.
  A provider with no usable credential can still disconnect (nothing to close with). Re-authorizing the SAME merchant touches nothing. Attempts
  keep the merchant they were created for, and settlement refuses to judge an order with a different merchant's credential. Residual window: a
  customer opening a NEW checkout in the instants between the guard and the credential change; it is bounded by that being one request, and such
  a checkout would be closed locally and retried if the same merchant reconnects.
* The attempt-status poll counts CONSECUTIVE failures (a success resets them), per viewer + booking + attempt. At the threshold the screen says
  so, with "Check again" and "Dismiss", instead of sitting on "Checking your payment".

## Overlapping settlements and consumed attempts

A consumed attempt (`completed` / `reconciliation_required`) means only "do not credit the ledger a second time". It never means "ignore newer completed Square payments". When two settlements overlap, the one that takes the attempt row lock second may hold fresher evidence than the winner (for example P1+P2 against P1). Inside `recordConfirmedPayment`, after the billing lock, booking row and attempt row are held, a consumed attempt routes the evidence it already fetched through `auditAdditionalPaymentsInTx`: every completed payment not yet recorded is stored as its own evidence row (unique by Square payment id), the attempt becomes `reconciliation_required` / `multiple_payments`, and nothing is credited, clamped or merged. The result is `reconciliation_required` (webhook: `processed` with that outcome); `already_settled` is returned only when there is no new evidence. No Square call happens under the locks, and lock order is unchanged.

## Unreadable evidence, credential disposal and readiness (repair pass 4)

- **Unknown evidence is never "already settled".** For ANY attempt, consumed or not, a failed fresh Square read (outage, credential not ready, merchant changed) is `unavailable` and the webhook event is stored `failed` (not `processed`), so Square's redelivery of the same event audits any new payment later. `already_settled` is returned only when the evidence WAS read and held nothing new.
- **A credential that is on file is not discardable just because it is not ready.** `closeProviderCheckouts` decides from persisted state (`storedCredentialState`: presence and merchant only): no credential on file, or no live/unconfirmed Catering link for that merchant, means safe; otherwise the credential must be obtainable to close the links, and any link still unconfirmed (or a credential that cannot be obtained) refuses the disconnect or merchant change (`409 connection_in_use`). The credential is preserved for a retry.
- **Checkout readiness** (`cateringSquarePaymentsEnabled`) = Square SANDBOX **and** `SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL` (absolute https URL, no credentials/fragment) **and** `SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY`, via the single `cateringSquareWebhookConfig()` the webhook route also verifies with. Without it the pay endpoint answers 503, the billing view advertises no checkout, and no Square link is created. Cleaning up and settling what already exists needs only the sandbox (`cateringSquareSandboxReady`), so missing webhook configuration never strands a live link or moved money.

## In-flight checkout creation and credential disposal (repair pass 5)

"No `square_payment_link_id` yet" does not mean nothing external can still appear. Durable state plus serialization close that window:

- **Durable marker.** `square_create_started_at` is committed BEFORE Square is asked to create a checkout; `square_create_resolved_at` is set only once the outcome is known (link ids recorded, Square definitively refused, or never sent). Started and not resolved is an *unresolved create*, whatever the attempt's local state is (a local cancel does not resolve it). An uncertain outcome (timeout, network fault, 5xx) is never resolved.
- **Serialization without a long transaction.** The marker is written in one short transaction that takes the billing lock and a SHARED lock on the provider's connection row. A disconnect or merchant change holds that row exclusively and, under it, asks `credentialStillNeeded` (second question): any open attempt, unconfirmed link or unresolved create refuses the change. So either the marker is committed first (and the change is refused) or the credential is already gone (and the creator makes no Square call, failing the attempt `provider_credential_changed`). Lock order: billing lock then connection row for creators; connection row then plain reads for disconnect, so there is no cycle.
- **Guard.** `closeProviderCheckouts` treats unresolved creates like unconfirmed links: a recent one (under 2 minutes) is waited for; a stale one is reconciled by re-sending the SAME idempotency key (Square returns the existing link, never a second), recorded on the closed attempt and deleted with the still-present credential. Anything still unresolved refuses disposal.
- **Create after local cancel.** The link is kept on the closed attempt, the create is resolved, and the delete runs immediately with the old credential; the checkout URL is never exposed.

## Provider reconciliation view: currency and ledger-backed payment (repair pass 6)

- Processor money is shown only in the currency Square reported (`processorCurrency`, or each evidence row's own `currency`). One row uses its own amount and currency; several rows of one currency show the total with a count; mixed currencies are never summed or relabelled (neutral headline, each payment on its own row).
- The provider view says whether anything was credited: `ledgerCredited` (the attempt has a ledger payment) and, per evidence row, `creditedToLedger`, true only for the payment whose Square id is STORED on that ledger payment (matched by id, never by amount). Copy differs: nothing credited vs. "one payment was already credited, additional payments were NOT credited automatically; do not apply the credited payment again". Customers receive neither flag nor Square ids. Presentation only: the accounting is unchanged.
