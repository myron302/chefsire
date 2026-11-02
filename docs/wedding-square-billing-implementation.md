# Wedding Planner Square automatic billing — implementation gate

## Exact payment and refund notification reconciliation

`WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED` defaults off. When explicitly
enabled with the existing sandbox enrollment, webhook and reconciliation
gates, the hourly worker independently attests the merchant/location, claims
one payment/refund hint immediately before its 15-minute lease, and maps each provider
payment to its saved invoice and owner. Failed or unrelated events rotate
fairly and remain pending. No provider write is sent.

Payment acknowledgements require the existing owner-bound payment/dispute
refresh and its exact evidence revision. Completed refunds require independent
GETs of both refund and original payment, customer/location/amount agreement,
and proof that the payment lists that refund and returned funds. Revocation
of only that invoice and acknowledgement of its queue lease are atomic.
Pending, malformed or unverified refunds remain pending; no refund request is
created, and no paid-through date is extended. Subscription/invoice hints
require exact provider identity and original enrollment verification before
locked queue acknowledgement. Raw provider errors are checked before SDK
normalization. Lifecycle checks can reconcile current non-payment status but
never extend paid-through, refresh payment evidence, or promote PENDING based
on an ACTIVE subscription hint; renewal discovery verifies settled invoices.

Apply `20261102_04_wedding_square_webhook_reconciliation_lease.sql` after the
correlation migration before enabling the worker. Both have Drizzle parity
and PostgreSQL CI coverage.

## Existing-subscription card recovery

`WEDDING_SQUARE_SANDBOX_CARD_UPDATE_ENABLED` defaults off. Its additive
`20261102_05_wedding_square_card_updates.sql` migration records one-shot
owner-bound update attempts, source digests and provider versions. The
Settings subscription panel uses Square-hosted card fields and buyer
verification. The server reuses the verified owner customer and subscription;
it never creates another Customer or Subscription to recover a failed card.

A durable intent precedes one Card POST and one card-only, versioned
Subscription PUT. No cancellation, plan, price, trial, consent or paid-through
field is changed. Mixed-error or unknown results block another attempt.
Replacement reservation and cancellation claim use the same short owner
advisory-lock transaction. Cancellation excludes unresolved replacements and
compares the saved current card; a claimed cancellation excludes replacement.
Neither transaction holds a lock while waiting for Square. Two-connection
PostgreSQL tests exercise both provider-call orderings.
`POST /api/wedding/subscription/sandbox/payment-method/reconcile` accepts an
empty body and performs GET-only recovery of the saved replacement; it never
replays either write. Unknown Card POSTs without a returned ID remain an
operator reconciliation case.

The original enrollment card and fingerprint stay immutable. Confirmed
replacement provenance is read separately for ongoing provider verification
and first-charge activation. Keep the card-update switch enabled after
verified replacements so renewal readback can use this ledger. Initial
checkout requires payment-event handling and card recovery to be enabled.

Tests cover transport envelopes and version conflicts, owner/origin/body
authorization, lost PUT responses, nonce digest uniqueness, PostgreSQL
recovery and original enrollment evidence preservation. Real provider lifecycle
acceptance is still a separate gate; passing these tests does not establish a
Square charge.

## Webhook correlation metadata (November 2, 2026)

`20261102_03_wedding_square_webhook_object_correlation.sql` adds nullable
`square_object_id` with matching Drizzle declaration. Apply this reviewed
additive migration before enabling webhook intake with this version; the
readiness audit reports a blocker when the column is absent. Missing schema
continues to return retryable HTTP 503 rather than acknowledge lost events.

Signed notifications now retain only canonical `data.id` after validating
`data.type` against the event family. The ID is an untrusted provider lookup
hint. The raw provider object, card details, customer fields and payment status
are not stored. Existing notifications remain pending with NULL object IDs;
duplicate deliveries never replace the original metadata. This prepares
identity-bound provider GET reconciliation; it does not implement that worker,
acknowledge events as processed, enable billing, or grant entitlement.

## Product contract
- Existing cardless introductory trial lasts exactly 336 hours from Neon `wedding_intro_trials.activated_at`. Do not reset or extend it when a customer adds a payment method.
- The customer must explicitly consent to **monthly automatic recurring charges** at the displayed Premium ($24.99/month) or Elite ($49.99/month) price and tax disclosures; merely entering a card is not consent.
- With valid consent and a provider card on file, schedule Square billing for the trial end, **not at sign-up**. Store the exact consent text version, timestamp, tier, agreed amount/currency, customer and provider identifiers, and requested start date.
- If no consent/payment enrollment happens before expiry, effective entitlement reverts to Free; all planner content survives.
- Existing trials must be grandfathered, not back-charged. Already-expired users who opt into a new paid plan authorize an immediate first monthly payment with conspicuous checkout disclosure.
- Renew monthly until customer cancellation. A cancellation acknowledged by Square stops future renewals and retains verified paid entitlement only until the provider-confirmed paid-through time. There must never be local-only cancellation success.
- Failed charges require notifications and updating the payment method; never fabricate paid access; never delete content. Refunds/chargebacks must be reconciled.

## Verified repository findings
- `server/routes/square.ts` deliberately returns HTTP 503 for subscription checkout. Do not enable the old checkout link: the existing flow has no recurring subscription evidence path.
- `server/routes/wedding-subscription.ts` rejects paid tier changes and provider-dependent cancellation. `subscription_history` alone is not evidence and legacy `users.wedding_tier` flags must never enable access.
- `server/lib/square-integration.ts` provides a platform Square SDK v43 client. This is distinct from provider-connected Catering Square accounts. Resolve the platform's actual active merchant, location, catalog subscription plan variation IDs, and subscription-enabled permissions before activation.
- Existing cardless trial authorization is server-verified by `weddingEntitlement`; keep it independently working through billing development.

## Initial safe database foundation
`docs/sql-pending/wedding_square_billing_foundation.sql.txt` adds:
1. `wedding_square_subscriptions`: owner/merchant/provider binding, explicit consent, tier, price, subscription ID, provider status, payment verification boundary; one live provider subscription per account.
2. `wedding_square_webhook_events`: replay-safe event identity scoped by environment and merchant; webhooks are triggers, not proof.
3. `wedding_square_invoice_evidence`: unique provider invoice and payment IDs with amounts and covered periods.

The DDL is deliberately held as **.sql.txt outside server/drizzle** so routine `npm run db:migrate` cannot apply it, and schema-table-coverage tests that scan executable migrations do not mistakenly treat these proposed tables as deployed schema. Before activation, move the reviewed DDL into a versioned migration, declare all three tables (including invoice evidence) in Drizzle and add schema parity tests in the **same implementation PR**. These tables are **not wired to an endpoint**, and they do not authorize paid Wedding access.

## Next implementation work, required before payments can be switched on
1. Set up **sandbox-only** Square catalog subscription plan variations for Premium and Elite. Confirm location, merchant, amounts, currency, monthly cadence, timezone, tax handling, and API version. Configure dedicated Wedding webhook URL and signature key; do not share unrelated Catering hooks.
2. Build authenticated payment enrollment: Square secure tokenization (never raw card data in ChefSire), customer/card creation or reuse, server-side canonical tier/price selection, explicit consent capture, persisted idempotency and a per-user lock. No provider subscription without a durable owner-bound intent; support recovery after timeouts.
3. Square `CreateSubscription` with `card_id` and `start_date`, with **date/timezone precision caveat**: Square's start date is YYYY-MM-DD and could start before the exact 336-hour trial expiration. Either select a non-early billing date with clear notice or use a Square-managed zero-cost phase proven to honor the exact entitlement boundary. Test DST, same-day cutoff, and retries. Never silently shorten a trial.
4. Signed raw-body webhook endpoint with correct notification URL and signature verification; dedup/event replays, fetch the actual subscription/customer/plan/invoice/payment from Square, and verify merchant, location, user binding, amount, currency, invoice/payment completion, and paid coverage. Reconciliation must work without a browser callback and survive webhook loss.
5. Implement paid entitlement from **provider-confirmed paid periods**, not PENDING subscription or card presence. Keep free trial entitlement effective until expiry; avoid entitlement gaps or granting Elite based on a Premium payment.
6. Implement cancel-at-period-end with Square confirmation, idempotent retries and recovery. Handle renewal, failure, refund, chargeback, plan switch, late webhook, and mismatched provider IDs; protect against two active paid subscriptions.
7. Add user-facing Upcoming Charge, Manage Billing, Cancel, and Update Payment Method UX, accurate cancellation confirmations and renewal email notices, while preserving all user data. Never imply Square is active while disabled.
8. Integration tests on disposable Neon/PostgreSQL and Square sandbox: same-user concurrency, multi-account spoofing, duplicate webhooks, provider outage, trial expiry, no-card expiry, payment failure, cancellation, correct payment-to-tier authorization, partial refunds, and re-enrollment.
9. Readiness gates: builds/tests; Codex/Greptile review; sandbox end-to-end results; safe migration apply; production Square settings verified; deploy behind explicit feature flag default OFF; enable live only after a signed-off check.

## Square primary documentation
- https://developer.squareup.com/reference/square/subscriptions-api/create-subscription
- https://developer.squareup.com/docs/subscriptions-api/manage-subscriptions
- https://developer.squareup.com/reference/square/webhooks/subscription.updated
- https://developer.squareup.com/docs/webhooks/v2webhook-events-tech-ref

**Status:** initial schema and architecture gate only. Square billing is **NOT IMPLEMENTED** by this PR; no money can be collected through it.
