# P1-02 subscription authorization architecture

## Audit result

ChefSire has four independent subscription domains persisted on `users`:

* marketplace/creator: `subscription_tier`, `subscription_status`, `subscription_ends_at`;
* nutrition: `nutrition_premium`, `nutrition_trial_ends_at`;
* wedding planner: `wedding_tier`, `wedding_status`, `wedding_ends_at`;
* wedding vendor: `vendor_tier`, `vendor_status`, `vendor_ends_at`.

`subscription_history` is an audit/display table shared by the domains. It is not payment evidence. Store records have a historical `subscription_tier` migration column, but current store creation does not write it. Drink creator memberships and premium collection purchases have separate Square-backed commerce models and are not these subscription tiers.

## Provider evidence

Square checkout-link code exists for marketplace plans, but the repository has no subscription webhook/reconciliation flow that verifies customer ownership, the expected plan variation, payment/subscription status, or that maps verified Square subscription state back to these user columns. The request previously put a client-provided user ID into Square metadata. Therefore a checkout link, `paymentMethod`, plan/tier name, or history row is **not** authoritative subscription evidence.

There is no Stripe subscription implementation and no administrative/manual subscription override route.

## Mutation endpoints and policy

The audited mutation endpoints are:

* `POST /api/subscriptions/upgrade`, `/downgrade`, and `/cancel`;
* `PUT /api/users/:id/subscription` and generic `PUT /api/users/:id`;
* `POST /api/nutrition/subscription/change` and `/cancel`;
* `POST /api/nutrition/users/:id/trial` and `POST /api/users/:id/nutrition/trial`;
* `POST /api/wedding/subscription/change` and `/cancel`;
* `POST /api/vendors/subscription/change` and `/cancel`;
* `POST /api/square/subscription-link` (checkout creation only).

Before P1-02, all four domain change routes wrote paid state directly from `tier`; both nutrition trial routes were unauthenticated; the direct user subscription route was unauthenticated and could target any user; and the generic profile route allowlisted marketplace subscription fields. Paid changes also accepted a client `paymentMethod` and fabricated a 30-day paid-through date. Cancellation mutated local state while claiming external success without provider confirmation.

After P1-02, paid changes and trial grants fail closed with `SUBSCRIPTION_BILLING_NOT_CONFIGURED`. Provider-dependent cancellation fails honestly with `SUBSCRIPTION_CANCELLATION_UNAVAILABLE`. Free-domain changes remain available, are scoped to the authenticated account, create no provider evidence, and remove rather than grant entitlement. Square subscription checkout validates authenticated requests and returns `SUBSCRIPTION_BILLING_UNAVAILABLE` before loading or calling Square, so customers cannot be charged by an incomplete activation pipeline.

## Existing and legacy state

This repair does not rewrite historical rows. The existing tier, status, and paid-through columns are retained as historical record only. The repository contains no provider subscription identifier, verified provider subscription event, or authorized administrative grant capable of distinguishing a legitimate historical purchase from a historical self-grant. Therefore neither a NULL nor a future `subscription_ends_at` authorizes paid access. All such marketplace records resolve to Free for authorization, and nutrition/wedding premium gates also fail closed.

Future billing work must add explicit provider-owned evidence and reconcile legacy records before any can become authorized. It must not fabricate provider IDs or rewrite historical financial data.

## Race and replay behavior

No subscription webhook exists, so no event is accepted or replayed. Repeated paid requests are read-only failures and cannot create conflicting tiers, duplicate history, or resurrect cancellation. Repeated Free transitions are idempotent removals. Subscription checkout cannot call `createPaymentLink`, even when Square credentials are configured. A future provider integration must add authenticated, uniquely identified and monotonic reconciliation before enabling checkout or paid mutation.

## Feature gates

Marketplace product limits and commission calculation resolve the canonical effective tier rather than trusting the recorded tier string. Because no authoritative subscription evidence exists, the effective paid tier is currently always Free. Wedding invitation sending and nutrition weekly meal planning now also require the same authoritative-evidence policy and therefore reject historical raw paid flags. No vendor-only backend premium operation was found; vendor tier is presently subscription display/state only.

## Effective subscription read contract

The canonical paid marketplace identifiers are `starter`, `professional`, `enterprise`, and `premium_plus`; StoreDashboard currently displays the first three. Subscription checkout validates this closed set before returning `SUBSCRIPTION_BILLING_UNAVAILABLE`. The historical `pro` checkout alias was not used by the current subscription model and is rejected.

Effective subscription reads return one internally consistent state. When authoritative evidence is absent, marketplace, nutrition, wedding, and vendor reads return the domain's Free tier with `status: "inactive"` and `endsAt: null`. Historical stored tier/status/end-date values remain in the database for reconciliation but are neither returned as effective state nor used for authorization. The settings UI likewise derives status and renewal display from effective tier and never falls back to raw user subscription fields.
