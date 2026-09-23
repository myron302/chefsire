# P1-05 marketplace checkout security audit

## Authoritative lifecycle

The browser creates one checkout identity and sends a product ID, integer
quantity, fulfillment choice, address, and that identity to
`POST /api/orders/checkout`. There is no cart or `order_items` implementation in
the authoritative marketplace flow: one order references one product. The
server loads the product, seller/store tier, price, shipping cost, and
commission rules. Checkout inserts an immutable, `unreserved` order and does
**not** mutate inventory, revenue, or commission.

`POST /api/payments/create-payment` validates that modern order snapshot, builds
one Square request identity, and enters a short database transaction. A single
conditional product update reserves stock only when `inventory >= quantity`
(with `NULL` retaining the existing unlimited-stock meaning), while a
compare-and-set changes that same order from `unverified/unreserved` to
`capture_pending/reserved`. Both changes commit or roll back together. No
database transaction spans the Square network request.

P1-03's evidence-first Square boundary is unchanged. A retry of
`capture_pending` reconciles the durable provider reference rather than issuing
a new request. Only `COMPLETED` Square evidence for the exact server-authored
amount reaches the local capture transaction. That transaction changes
inventory from `reserved` to `sold`, credits seller revenue once, inserts one
commission, and increments sales count. A definitive Square decline atomically
releases stock; an ambiguous outcome remains reserved and reconcilable.
Fulfillment never creates revenue. Provider-confirmed refunds retain the sold
inventory classification (a refund does not prove a physical return) while
reversing financial accounting through P1-03.

## Audit answers

1. **Previous decrement point:** checkout inserted an order and then decremented
   the product in a separate statement, before any payment request.
2. **Before capture:** yes; the old decrement had no reservation state. The new
   pre-capture decrement is an explicit payment-attempt reservation, never a
   sold classification.
3. **Failure leakage:** previously any checkout abandonment or payment failure
   left stock reduced. Now checkout does not touch stock and an authoritative
   decline transactionally releases a payment reservation. Ambiguity remains
   reserved because it is unsafe to infer provider failure.
4. **Retry double decrement:** checkout retry previously created another order
   and decrement. Checkout is now uniquely idempotent; payment reservation is a
   compare-and-set from `unreserved` and rolls back if that transition loses.
5. **Final-unit concurrency:** the old read/check/later-write could let both
   buyers succeed. PostgreSQL row locking plus the conditional decrement lets
   only one payment attempt reserve the final unit.
6. **Atomic availability:** yes after repair; the stock predicate and decrement
   are one SQL update, backed by a nonnegative constraint.
7. **Order/inventory coordination:** checkout no longer needs coordination
   because it does not mutate inventory. Reservation and `capture_pending`,
   release and failed capture, and sold/revenue/commission/capture are each
   transactionally coordinated.
8. **DB succeeds/provider fails:** the durable request identity and reservation
   exist first. A provider-confirmed decline releases stock; an ambiguous error
   retains the reservation and blocks a new charge pending reconciliation.
9. **Provider succeeds/process crashes:** the durable identity and P1-03
   `capture_pending`/`capture_reconciliation` evidence states recover the same
   provider payment without a second charge or duplicate accounting.
10. **Revenue/commission before capture:** P1-03 already prevented this. P1-05
    retains complete Square evidence as the only gateway to the accounting
    transaction and adds one-commission-per-order database uniqueness.
11. **Fulfillment-created revenue:** no. Seller summaries and payouts retain the
    P1-03 verified-earning predicate; fulfillment changes no financial fields.
    The seller also cannot advance a modern order into processing, shipment, or
    delivery until that same verified-capture predicate holds.
12. **Client authority:** the former client-selected `deliveryMethod` affected
    commission. Delivery method is now derived from database product facts and
    validated fulfillment. Price, seller, shipping, tier, commission, totals,
    provider identifiers, and payment state all come from server/provider data.
13. **Duplicate orders:** prevented by a unique buyer/checkout identity and
    immutable-input replay comparison.
14. **Duplicate charges:** P1-03's durable Square idempotency/reference identity
    and reconciliation path remain unchanged.
15. **Immutable identities:** checkout identity is bound to product, quantity,
    fulfillment, and address; provider identity remains bound to the durable
    server-authored order request.
16. **Out-of-transaction mutations:** all stock/payment-state pairs and all
    verified capture/accounting mutations now share their invariant-protecting
    transaction. The Square call stays outside a database transaction.
17. **Legacy entry:** historical `unverified` rows remain
    `legacy_unverified`; they cannot reserve, charge, cancel as safely unpaid,
    become sold, or enter modern accounting. P1-03 durable capture attempts and
    provider-evidenced capture/refund states are preserved using their stored
    order economics and stable capture identity, so deployment does not break
    an already-required reconciliation.

## Adversarial review and deferred scope

The review attempted duplicate HTTP checkout, conflicting reuse of a checkout
key, concurrent final-unit payment, repeat payment preparation, client price and
seller/accounting injection, delivered-without-capture, forged sold state,
definitive and ambiguous provider failures, duplicate commission, and legacy
promotion. Route compare-and-set predicates, provider evidence checks, and
database constraints fail closed for each case.

No P1-06 payout OAuth state work or P2-01 general payment/refund redesign was
performed. The existing P1-03 refund and provider reconciliation machinery was
changed only where inventory reservation release/capture required it.
