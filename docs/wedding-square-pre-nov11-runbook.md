# Wedding Square acceptance: remaining provider work

## Verified on November 5, 2026

Premium initial payment/invoice/activation, scheduled cancellation, completed
partial/full refund and paid-access revocation have real Square/Neon evidence.
Square still reports ACTIVE with cancellation/billing end on December 5.
Do not report natural expiration before Square reaches that date.

Elite subscription `f2485d55-cba4-4141-90c5-0b5f0ab22ce9` is PENDING with
start date November 11 UTC. Its existing cardless trial dates are preserved.
The actual card replacement is confirmed in Square and Neon; duplicate GET-only
reconciliation preserves the provider version and original enrollment fingerprint.
There is no Elite invoice, payment or paid entitlement yet.

The real renewal selector scanned both subscriptions and recorded no new evidence;
an immediate repeat scanned none. Actual Square 401 rejection and subsequent
valid-credential card reconciliation have been verified. These are provider API
recovery checks, not successful declined-renewal recovery.

## Provider-supported fixtures available before the first Elite charge

`operator/square-sandbox-fixtures.cjs` is a private, operator-triggered test tool.
Never mount it as a route or run it automatically at app start or in CI.
The owner must perform its final execution step for financial actions.

It requires the exact verified Elite tester, token-attested merchant/location,
Square Sandbox, live billing explicitly false and all eleven lifecycle switches
false. It performs no application financial-table writes. It uses official
Square test tokens and durable private intents before provider writes:

1. A $49.99 standalone payment expected to decline.
2. A $49.99 standalone recovery payment, independently read and then refunded.
3. An $88.01 standalone payment that triggers Square's sandbox dispute fixture.

Existing reference-matched fixtures are reused. Unknown write outcomes block
resubmission. Credentials and payment source tokens are not persisted in receipts.
These payments are not Wedding subscription invoice evidence and must never be
inserted into the trusted invoice ledger or counted as renewals/paid entitlement.

After the owner executes the tool, independently GET each provider result; verify
the recovery refund completes; retrieve the real dispute and exercise the reviewed
dispute readback. Compare all fixture events with Neon and prove that unmatched
payments/disputes cannot grant or revoke another payment's entitlement. Real
Wedding-linked dispute revocation remains distinct from this adapter/intake test.

## November 11 UTC: exact acceptance sequence

1. GET the existing Elite subscription. Verify its original customer/location,
   Elite variation, confirmed replacement card, UTC start date and current status.
2. Use only Square's subscription-listed invoice IDs. GET the newest invoice,
   its order and canonical CARD payment. Require PAID invoice and COMPLETED/captured
   payment, exact owner/merchant/location/order links and $49.99 USD.
3. Require provider-backed coverage dates, no refunds, and a complete dispute
   audit before recording evidence. Neither ACTIVE status nor a webhook is proof
   of payment. Never invent invoice IDs, coverage dates or successful responses.
4. In a process-scoped sandbox-only window, run the reviewed renewal discovery,
   owner-bound PENDING-to-ACTIVE verifier and evidence ledger. Confirm one immutable
   invoice record and one subscription, with no duplicate CreateSubscription.
5. Verify paid entitlement and frontend status only after that evidence passes.
   Preserve the original trial, consent, enrollment fingerprint and replacement
   provenance. Run duplicate reconciliation and confirm no extra financial writes.
6. Reconcile actual signed invoice/payment/subscription deliveries with Neon.
   Test supported refund/cancellation/recovery scenarios and distinguish actual
   provider execution from simulated lost responses or future renewals.
7. Restore every temporary lifecycle switch to false, verify the running app,
   and confirm live billing remains false. Preserve all rollback/configuration/data.

Actual monthly renewal, final expiration and declined-recurring-invoice recovery
must remain unverified until their corresponding provider behavior is observed.
