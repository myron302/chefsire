# Payment/refund persistence and idempotency audit (P2-01)

Starting point: `d082f591a7148f9d52cd5433b00d289e135db3f7` (`#1297`).

## Inventory and classification

| Surface | Provider mutation and evidence path | Classification |
| --- | --- | --- |
| Store marketplace checkout/refund | Authenticated order checkout; server price and inventory snapshot; durable checkout/capture/refund identities; Square capture/refund; provider IDs and statuses persisted; transactional commission/accounting; reconciliation worker. | A — protected by #1293, #1294 and #1296. |
| Marketplace payouts | Seller/admin authorization; verified captured orders and commission claims; authoritative Square transfer evidence; unique claim; fail-closed reconciliation. | A — protected by #1293. |
| Marketplace, nutrition, wedding, and vendor subscriptions | Paid activation and provider cancellation are disabled; recorded legacy state cannot authorize paid access. | A — protected by #1295. |
| Square account connection | Authenticated user; server-random, browser-bound, expiring one-time state; authoritative merchant response. This connects an account but does not move money. | A/D — protected by #1297; not itself money movement. |
| Drink collections, bundles, gifts, and creator memberships | Authenticated checkout; server amount; durable checkout session and unique provider reference before Square payment-link creation; polling and signed Square webhook reconciliation; provider object/session/user/product/amount/currency binding; unique purchase/ledger records. Refunds are provider-originated and observed by polling/webhook. | B — real provider flow; existing durable evidence and replay controls were retained. |
| Meal-plan marketplace purchase | Authenticated route and server price, but previously inserted `completed`, a simulated transaction ID, entitlement, sales count, and creator revenue without calling a provider. | C — unprotected legacy path; remediated here. |
| Catering booking billing | Records operator-entered invoices/payments with booking-scoped authorization and idempotency. It expressly does not invoke a processor or represent a provider refund. | D — bookkeeping, not provider money movement. |
| Restaurant reservations, wedding planning, competitions, grocery “purchased” flags | No reachable payment-provider mutation was found. | D — not money movement. |

## Finding

### P1 — meal-plan purchase fabricated capture and accounting

The paid meal-plan purchase endpoint trusted a client-supplied payment-method
label, generated a `sim_...` transaction ID, immediately recorded the purchase
as `completed`, granted access, incremented `sales_count`, and credited creator
analytics. No payment provider request or evidence existed. Any authenticated
user could therefore obtain a paid plan for free, and retries/concurrency could
also duplicate non-transactional accounting. The marketplace and subscription
protections in #1294–#1296 do not cover this separate table and route.

The smallest safe remediation is fail-closed operation until a real provider
integration can durably claim a logical purchase before dispatch, persist an
immutable provider idempotency identity, verify capture, and atomically apply
entitlement/accounting. The route now returns 503 before any purchase or
accounting mutation. The schema default is `unverified`; the migration retains
historical rows while relabeling former `completed` rows `legacy_unverified`.

## Boundary, refund, webhook, and legacy conclusions

Marketplace captures and refunds retain stable server-side identities across
ambiguous outcomes; only definitive provider failure releases an attempt, and
provider success followed by local failure enters reconciliation. Full refunds
are capped at the authoritative captured total; partial marketplace refunds are
explicitly unsupported rather than guessed. Payment/refund accounting is
transactional and guarded by durable order/commission/ledger uniqueness.

Drink payment links are claimed locally before provider dispatch and use the
stored provider reference as Square's idempotency key. Successful entitlement
requires provider polling or a signature-verified webhook. Webhook event IDs
are unique, object lookup is bound back to the stored session, and product,
buyer, amount, and currency mismatches revoke rather than grant access. No
ChefSire endpoint initiates a drink refund, so no local refund idempotency key is
appropriate there; Square refund evidence drives access state.

No provider boundary existed for meal plans, so retrying it could never be made
safe by adding a random ID. It is disabled rather than simulating success. Old
rows are neither deleted nor promoted to verified, and are not automatically
charged or refunded.
