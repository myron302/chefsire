# Wedding Square billing phase 2: server quote and non-early scheduling policy

This is a **non-chargeable, non-activated** implementation step. It introduces a canonical server price/consent policy, an authenticated read-only quote and regression tests. **No Square enrollment, card collection, billing tables, paid entitlement, cancellation API, production payments or live feature flags are enabled.**

## Endpoint
`GET /api/wedding/subscription/billing-quote?tier=premium|elite` (authenticated)

Returns canonical monthly amount in cents, USD currency, automatic renewal requirement, consent version, optional active trial expiration and a proposed first-charge `YYYY-MM-DD` date, and `billingAvailable:false`. It reads the server-owned Wedding trial, not caller-selected expiration/user ID.

## Important Square precision rule
Square CreateSubscription `start_date` is a date, not a UTC instant. Billing is tied to Square's subscription `timezone`. Until a tested provider-managed trial phase or equivalent exact-time billing solution exists, **choose the first UTC midnight not preceding the trial expiration and explicitly pass UTC as the Square subscription timezone**. This may postpone billing by part of a day; it never bills early. Display the actual first charge date and amount when asking for customer consent. Do not infer this from the customer's browser timezone or Square location defaults.

Docs:
- https://developer.squareup.com/reference/square/subscriptions-api/create-subscription
- https://developer.squareup.com/docs/subscriptions-api/subscription-billing

## Release gates to finish before charging
1. Move held DDL into a reviewed migration plus Drizzle declarations/parity tests, without silently touching Neon.
2. Implement durable owner-bound enrollment intent and retry/idempotency before Square CreateSubscription; use Square secure card tokenization and recorded consent.
3. Sandbox-only provider catalog-plan/customer/card/subscription integration with environment and merchant binding; reject misconfigured plans/prices or timezone mismatches.
4. Signed webhook processing plus authoritative provider retrieval and invoice/payment verification; paid entitlement only after covered paid periods are verified.
5. Failed-payment, cancel-at-period-end, refund, and plan switch reconciliation, owner-only manage billing UI and email notices.
6. Real Postgres and Square sandbox integration tests, reviewer sign-off, staged production environment with feature flag default OFF.

Run targeted tests with `node --import tsx --test server/lib/wedding-square-billing-policy.test.ts`.
