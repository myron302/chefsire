# ChefSire Part 3b: initial ledger and sensitive-data inventory

Source: `shared/schema/domains/*.ts` on main, inspected 2026-11-10. This is a **schema-source inventory**, not a production catalog audit or legal retention decision. SQL migrations, dynamic tables, provider-side Square records and media references must also be inventoried before any erasure engine can run. Tracking: #1486.

## Retain financial evidence and transactional foreign keys

| Related tables | Why no destructive cleanup | Sensitive fields to review separately |
| --- | --- | --- |
| `orders`, order-linked `products`, `subscription_history` | Buyer/seller history, fulfillment, trusted Square payment/refund reconciliation, subscription history | `shipping_address`, `capture_request_snapshot`, refund reasons, tracking and provider identifiers |
| `commissions`, `payouts`, `payout_schedules` | Seller commission/payout status, balances, amounts, settlement | `payouts.metadata`, method destination, failure details; payout schedules CASCADE from users |
| `payment_methods`, `square_oauth_transactions` | **Review before changing:** payment/provider authorization state, possible reconciliation ties, not all should be retained forever | `account_email`, `account_details`, encrypted access/refresh tokens; both tables can CASCADE from users |
| `wedding_square_subscriptions`, `wedding_square_enrollment_attempts`, `wedding_square_card_setup_attempts`, `wedding_square_card_updates` | Provider subscriptions, customer/card identity and trustworthy subscription state | Square customer/card IDs, request/idempotency keys, provider statuses |
| `wedding_square_invoice_evidence`, `wedding_square_webhook_events` | Invoice/payment evidence and durable webhook history; not all have direct `users.id` FKs | Provider invoice/payment IDs, event payloads, timestamps, possible embedded PII |
| `catering_bookings`, `catering_booking_payment_attempts`, `catering_attempt_square_payments`, `catering_square_webhook_events` | Catering customer/provider terms and provider payment reconciliation | Event/booking terms, Square IDs, attempts, reason metadata |
| `catering_booking_invoices`, `catering_booking_payments`, `catering_booking_adjustments`, `catering_booking_billing` | Invoices, payments, adjustments, balances and agreed terms | Payment method, processor ID, notes, private billing data |
| `catering_offer_revisions`, `catering_booking_amendments`, `catering_booking_closeout`, `catering_booking_closeout_items`, `catering_booking_activity` | May be essential to contract/dispute evidence; decide individually | Terms, private notes, messages, activity metadata |
| `catering_booking_details`, `catering_booking_access_details`, `catering_booking_staff_assignments`, `catering_booking_files`, `catering_booking_storage_orphans` | **Conditional:** fulfillment/legal evidence or delete when no longer necessary | Address, phone, names, access/security notes, file content |
| **Unfulfilled paid creator assets**: `meal_plan_purchases` (verified paid), `drink_bundle_purchases`, `drink_collection_purchases` | Even completed payments can imply future buyer access. A creator's account closure cannot delete a blueprint/bundle/collection that another member paid for. This is distinct from unsettled money and must be resolved through content preservation/transfer or a justified refund | Buyer identity, product versions/assets and paid entitlement records |
| `meal_plan_purchases`, `meal_plan_blueprints`, `blueprint_versions` | Paid ownership, creator sales/entitlements and historical purchased asset references | Provider payment IDs/status, creator identifiers, descriptions |
| `drink_bundle_purchases`, `drink_bundle_checkout_sessions`, `drink_bundle_square_webhook_events`, purchased `drink_bundles` | **Additional commerce ledger not listed in initial handoff**; preserve paid sales and reconcile Square | Payment link/ID, refund and status reasons, checkout reference |
| `drink_collections`, `drink_collection_purchases`, `drink_collection_checkout_sessions`, `drink_collection_sales_ledger`, `drink_collection_square_webhook_events`, `drink_gifts` | **CRITICAL nested creator-commerce tables**: paid access, payments, gifts, buyer entitlement and creator revenue; user/collection CASCADE relationships could erase accounting | Payment links, Square order/payment IDs, recipient identifiers, refunds, discounts, creator earnings, gift redemption codes |
| `creator_membership_plans`, `creator_memberships`, `creator_membership_checkout_sessions`, `creator_membership_sales_ledger` | **CRITICAL newly discovered nested schema**: paid membership commitments, checkout attempts, revenue history; these have CASCADE user FKs and may be linked to Square evidence | Subscriber and creator IDs, provider payment references, Square subscription/payment IDs, sale statuses and amounts |
| `wedding_intro_trials`, `nutrition_intro_trials` | Eligibility/consumption history (prevents repeated introductory trials); independently set lawful retention period | User ID and activation/revocation timestamps |
| `admin_audit_log` | Append-only actor, action, reason and evidence | Historic `actor_label` and `details` may contain identifying information; don't erase wholesale, assess restricted handling |

## Disjoint content and privacy

- `users`: name, email, phone, profile fields, OAuth IDs, password, verification, avatar and catering details. Keep immutable internal ID for ledger joins only. Check all JSON fields and retained subscription tier/status.
- `posts`, `recipes`, `stories`, `comments`, `likes`, `follows`, `notifications`, `custom_drinks`, `drink_photos`, `club_posts`, plus other social/creator tables: remove or pseudonymize only after verifying no purchased product/reference would be broken.
- `pantry_items`, `meal_plans`, `meal_plan_entries`, `nutrition_logs`, `body_metrics`, `water_logs`, `family_members`, `allergen_profiles`, `adaptive_planner_profiles`, `nutrition_personality_profiles`, and snapshots may contain sensitive dietary/health/family data.
- `wedding_rsvp_invitations`, `wedding_event_details`, `wedding_calendar_events`, wedding planner records contain **third-party personal data**. Analyze guest and partner rights independently before deleting shared records.
- Direct messages and their attachments/thread metadata need a schema and legal-hold audit before implementing the text-redaction policy; do not erase the counterparty's own authored messages.
- `stores`, `store_drops`, and `products`: preserve purchased product/transaction context, hide listings, do not immediately recycle seller handles; unpurchased listings have separate deletion rules.
- `catering_booking_message_requests`, `catering_booking_conversations` link social DM messages to financial/contract bookings; blanket DM deletion would destroy dispute evidence.

## Implementation gates (not complete)

1. **Production catalog truth:** inspect actual `pg_constraint` FK delete actions, user-related columns, triggers, stored procedures, view dependencies, and live/current tables, including migrations outside domain files. No production changes in this stage.
2. **Square provider truth:** map local to provider subscription/invoice/order/payment/refund/dispute records and identify ambiguous or unresolved states; do not infer final billing from cache.
3. **Open obligations:** enforce returns, refunds, disputes, payout holds/debt, memberships, unfulfilled downloads, booking deposits/invoices and pending provider states.
4. **Concurrency:** lock live customer rows before every financial write, and closure must hold compatible locks for full eligibility check and irreversible commit.
5. **Field-level retention:** distinguish record required for accounting/contract/compliance from unnecessary PII inside the same row. Reconcile legal hold, deletion request, backup and media outbox lifecycles.
6. **Enablement:** default OFF, independent schema approval and owner legal/retention sign-off. This inventory alone does not authorize account closure.

**Conclusion:** a hard delete of `users` is unsafe; several ledger-adjacent tables use CASCADE FKs, and the initial list omitted the drink-bundle checkout/purchase family and catering invoice/payment/adjustment evidence. Preserve or explicitly reparent those before any erasure executes.
