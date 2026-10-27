# Wedding Planner Square automatic billing — implementation gate

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
`server/drizzle/20261027_wedding_square_billing_foundation.sql` adds:
1. `wedding_square_subscriptions`: owner/merchant/provider binding, explicit consent, tier, price, subscription ID, provider status, payment verification boundary; one live provider subscription per account.
2. `wedding_square_webhook_events`: replay-safe event identity scoped by environment and merchant; webhooks are triggers, not proof.
3. `wedding_square_invoice_evidence`: unique provider invoice and payment IDs with amounts and covered periods.

These tables are **not wired to an endpoint**. They do not authorize paid Wedding access. No production migration should run until the implementation and deployment plan are approved.

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
