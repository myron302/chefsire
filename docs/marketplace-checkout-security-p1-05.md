# P1-05 marketplace checkout security audit

## Authoritative lifecycle traced

The browser creates one checkout idempotency identity and sends only a product,
quantity, fulfillment choice, address, and that identity to `POST
/api/orders/checkout`. The server loads the product, seller/store tier, price,
shipping cost, and commission rules. In one database transaction it inserts the
immutable order snapshot and conditionally decrements finite inventory. That
decrement is a **reservation**, not a sale. A scheduled reconciler releases
expired reservations that never entered payment processing.

`POST /api/payments/create-payment` changes a live reservation to
`capture_pending` before its Square call. It preserves P1-03's stable Square
identity and evidence-first reconciliation. Only `COMPLETED` Square evidence
for the exact server-authored amount reaches the local capture transaction.
That transaction changes the reservation to `sold`, credits the seller once,
inserts commission, and increments the sales count. A definitive Square decline
atomically releases inventory; an ambiguous outcome retains the reservation for
provider reconciliation. Cancellation releases only a modern, unverified
reservation. Refund and fulfillment continue to use the separate P1-03 state
machines; fulfillment never creates revenue and refund does not claim returned
physical stock.

## Findings and answers

1. **Previous decrement point:** checkout decremented immediately after order
   insertion, before payment, in a separate statement.
2. **Before capture:** yes. It is now an explicit reversible reservation; stock
   becomes `sold` only in the verified-capture accounting transaction.
3. **Failure leakage:** previously yes. A definitive decline now releases the
   reservation transactionally; abandonment expires; ambiguous Square outcomes
   remain reserved and reconcilable rather than being guessed failed.
4. **Retry double decrement:** previously yes at checkout. A database-unique
   buyer/idempotency identity now returns the same immutable order.
5. **Final-unit concurrency:** previously oversell was possible because the
   read/check/write sequence raced. A conditional SQL decrement now permits
   only one reservation.
6. **Atomic availability:** now yes, through `inventory >= quantity` in the
   update predicate plus the nonnegative database constraint.
7. **Order/inventory coordination:** previously no; now both are in one DB
   transaction.
8. **DB succeeds/provider fails:** the reservation and durable attempt exist.
   Authoritative decline releases it; ambiguous failure stays reconcilable.
9. **Provider succeeds/process crashes:** P1-03's stable provider reference,
   `capture_pending`/`capture_reconciliation`, and persisted evidence recover
   the same charge without another provider request.
10. **Revenue/commission before capture:** no current P1-03 path did this, and
    capture accounting remains gated on complete Square evidence.
11. **Fulfillment-created revenue:** no; fulfillment and verified earnings stay
    separate.
12. **Client authority:** the client formerly selected `deliveryMethod`, which
    affected commission. It is now derived from database product facts and the
    validated fulfillment choice. Price, seller, shipping, tier, commission,
    totals, payment identifiers, and payment state are server/provider owned.
13. **Duplicate orders:** previously possible; now prevented by a partial unique
    index and immutable-input replay checks.
14. **Duplicate charges:** P1-03 already prevents them with one durable Square
    idempotency/reference identity and provider reconciliation; preserved.
15. **Immutable identities:** checkout identity is bound to product, quantity,
    fulfillment, and address; provider identity remains bound to its durable
    order snapshot.
16. **Out-of-transaction mutations:** the vulnerable order/inventory pair and
    decline/cancellation releases are now atomic. Verified capture keeps order,
    commission, revenue, and sales accounting in one transaction.
17. **Legacy entry:** pre-migration inventory is `legacy_unverified`; it cannot
    be charged or cancelled through the trusted reservation path.

## Intentional fail-closed boundaries

`ORDER CREATED`, `INVENTORY RESERVED`, `PAYMENT REQUESTED`, and
`FULFILLED/DELIVERED` remain distinct from `PAYMENT CAPTURED`. Expiration never
releases a `capture_pending` reservation, because a provider request may have
succeeded. Historical inventory mutations are not inferred or silently
replayed. Only complete Square evidence advances a reservation to `sold` and
makes revenue or commission authoritative.
