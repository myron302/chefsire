# Wedding Square sandbox acceptance

## Completion boundary

Code, mocked provider tests and disposable PostgreSQL tests do not establish a
successful Square transaction. The acceptance gate remains closed until the
matrix below is exercised against the configured Square sandbox and its
results independently compared with the saved owner-bound Neon records.
Plesk application deployment remains the owner's step. Live billing is outside
this campaign; keep `SQUARE_LIVE_PAYMENTS_ENABLED=false`.

## Schema and configuration

Apply the reviewed, additive migrations in version order through
`20261102_05_wedding_square_card_updates.sql`. The November 2 correlation,
queue-lease and card-update migrations add nullable metadata and a separate
intent ledger. They do not create subscriptions, grant paid access, or enable
feature switches. Keep original enrollment fingerprints unchanged.

Use the sandbox merchant's own credential, verified location, distinct monthly
Premium/Elite plans and variations, the dedicated Wedding webhook signing key
and exact HTTPS notification URL, and the configured first-party HTTPS origin.
Do not put tokens, session cookies, card nonces or verification tokens in Git,
terminal transcripts or shared acceptance reports. The browser must use Square
sandbox-hosted fields. Never use a live payment card for this matrix.

The readiness report names missing configuration and schema without printing
values:

```bash
node scripts/wedding-square-sandbox-readiness.mjs
node --import tsx server/scripts/wedding-square-sandbox-provider-smoke.ts
```

The first command is read-only. The second independently GETs merchant,
location and catalog terms; it never creates a card, subscription or payment.
They must pass before the separately authorized interactive sandbox checkout.
Initial checkout additionally requires the card-recovery and payment-event
switches. All switches default off in an unconfigured deployment.

## Provider lifecycle matrix

Use dedicated tester accounts and preserve their planner content throughout.
For each row record the reviewed application commit, timestamp, operator,
observed app result and independent provider/Neon comparison in a private
operator record. A 2xx response alone is never a pass.

| Scenario | Required evidence |
| --- | --- |
| Active cardless trial | Trial remains exactly 336 hours. Authorizing enrollment does not charge before its end or reset the trial. Requested UTC date is no earlier than expiry. |
| Expired trial/new paid enrollment | Explicit current monthly consent, one saved owner intent, one provider Customer/Card/Subscription chain, matching merchant/customer/location/plan/price/currency. |
| Lost or duplicated enrollment request | No second subscription, provider write replay, fresh nonce collection, or optimistic paid access. Uncertain state stays blocked for reconciliation. |
| Initial settled invoice | Provider invoice PAID, payment COMPLETED/CAPTURED, exact order/owner/amount and coverage, complete dispute scan, then immutable invoice evidence. |
| Next monthly invoice | Same subscription, new unique invoice/payment, verified coverage; no new CreateSubscription request and no duplicate coverage. |
| Failed/uncertain payment | No paid grant or fabricated paid-through date. Trial/content survive. Existing-subscription payment-method recovery is available when eligible. |
| Payment notification | Exact provider payment maps to one saved owner invoice, independent payment/dispute check succeeds, and only that event is acknowledged. |
| Completed partial/full refund | Independent refund and payment GETs agree, payment lists returned funds, only matching evidence is revoked, and acknowledgement commits with revocation. |
| Pending/refused/unknown refund or dispute | No clean-payment claim from a webhook. Unverified outcomes stay pending/stale; a complete independent dispute audit is required for freshness. |
| Concurrent queue reclaim | A lost lease cannot revoke evidence or acknowledge an event. Fair claim timestamps keep unrelated events from starving another owner. |
| Existing card replacement | One durable update intent, one Card POST, one versioned card-only Subscription PUT. Original consent/fingerprint/trial/plan/cancellation/paid-through stay unchanged. |
| Lost card-update response | Check previous update performs only provider GETs, confirms saved replacement and owner, and never resubmits a Card POST or PUT. Unknown Card POST without an ID requires operator reconciliation. |
| Renewal after replacement | Confirmed replacement provenance is used for provider comparison while the original enrollment fingerprint still verifies unchanged. |
| Cancellation | Provider confirms cancellation/scheduled end; no local-only success. Verified existing paid coverage can last to its proven boundary. Failed requests remain reconciliation cases. |
| Cross-user/origin/merchant and malformed input | No provider write or paid grant, no leaked provider/card/customer IDs or secrets, no identity normalization. |
| Content preservation | Switching to Free, failed payment, cancellation, refund or dispute never deletes planner data. |

Payment events currently process one independently bounded event per hourly
tick. Run the gated worker again only after its prior invocation finishes when
performing operator acceptance. Subscription/invoice hints remain unacknowledged
unless event-specific proof exists; unrelated global scans cannot consume them.

## Final evidence and sign-off

```bash
node scripts/wedding-square-acceptance-evidence.mjs
```

This read-only aggregate report deliberately exits nonzero and always reports
`realProviderAcceptancePassed=false`: database counts cannot attest provider
execution. It includes missing enrollment, paid invoice, cancellation,
refund/dispute revocation, card replacement and unresolved-operation blockers.
Resolve every applicable discrepancy against Square before operator sign-off.
Do not turn an empty database or passing CI into a claimed completed lifecycle.

On November 2, 2026, the connected database contained zero Wedding Square
enrollments, subscriptions, invoice evidence, card setups and webhook events.
The Work Mode executor had no configured Square sandbox access token, and
plugin discovery exposed no usable Square connection. Real transaction
acceptance therefore remains unexecuted, independently of code/test completion.
