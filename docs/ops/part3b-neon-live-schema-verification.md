# Part 3b — read-only Neon production schema verification (2026-11-10)

This is a **metadata-only** check of ChefSire's currently deployed Neon PostgreSQL schema, using the Neon table-list and describe-table endpoints. No member rows, payment payloads, credentials, object bodies, SQL writes, migrations or Square operations were accessed or changed. It is a **targeted catalog sample**, not a complete audit of every table/FK and not evidence that deletion is legally authorized.

## Confirmed production constraints

| Existing production relation | Verified important constraints | Closure implication |
|---|---|---|
| `account_status` | `account_status_status_check` currently allows **restricted, suspended, deactivated only**, not `closed`; `user_id` FK CASCADE | Production cannot accept a `closed` row until owner-approved migration; do not run the draft migration automatically |
| `orders` | Buyer/seller/product foreign keys; includes `shipping_address`, Square capture request snapshot, refund attempt fields | Preserve entire transactional identity; separately minimize embedded personal details according to approved retention policy |
| `payment_methods` | User-related records with personal account email/details and encrypted Square credential fields | Not safe to treat as a generic ledger or to keep encrypted authorizations indefinitely; provider disconnect/revocation and evidence-preservation plan needed |
| `payout_schedules` | `seller_id REFERENCES users(id) ON DELETE CASCADE` | Do not delete users rows; a row may reflect automated scheduling settings, not a completed payout |
| `square_oauth_transactions` | `user_id REFERENCES users(id) ON DELETE CASCADE` | Transaction history may require retention but OAuth flows/credentials require separate privacy/retention decisions |
| `catering_booking_payment_attempts` | Both buyer and provider user FKs **RESTRICT**, booking and invoice FKs **RESTRICT**; processor sandbox CHECK | These are immovable payment/evidence dependencies; do not erase or rewrite them as ordinary booking content |
| `catering_booking_message_requests` | `booking_id`, `message_id`, `sender_id` all **RESTRICT** | Preserve booking-linked DM message identities/evidence; ordinary DM erasure cannot cascade through them |
| `wedding_square_invoice_evidence` | FK to wedding subscription, verified amount/currency and period CHECK constraints | Preserve invoice evidence chain and provider references; do not infer paid entitlement from local status alone |
| `meal_plan_purchases` | User and blueprint foreign keys; authoritative CHECK for `verified_paid`, `free_acquired`, legacy unverified | Retain verified purchase and paid creator access evidence |
| `creator_memberships` | Both subscriber and creator FKs **CASCADE**; plan FK CASCADE | Hard-deleting a user would destroy member/creator financial relationships |
| `creator_membership_sales_ledger` | Subscriber and creator identifiers, sales amounts/status, membership/checkout references | Retain creator sales and refund evidence |
| `drink_collection_purchases` | Buyer FK CASCADE, collection FK CASCADE | Both user and sold collection must remain connected to retained paid entitlements |
| `drink_collection_sales_ledger` | Buyer and collection FKs CASCADE; purchase/checkout FKs SET NULL | Historical creator earnings can be silently lost through cascade if hard-deleted |
| `drink_gifts` | Purchaser FK CASCADE, recipient FK SET NULL | Gift redemption and purchase obligations require their own retention decision |
| `admin_audit_log` | No user FK; actor label/reason/details remain free text | Append-only audit evidence can still contain identifying historical information; restrict/minimize per legal policy |

## Further checks required before feature activation

- Complete a read-only **every-table catalog FK inventory**, including dependencies into indirectly retained purchased products/content, and reconcile it with `docs/ops/part3b-readonly-fk-audit.sql`.
- Enumerate live provider payment/refund/dispute/unpaid invoice status via authenticated **read-only** Square APIs; never assume a local terminal label is sufficient.
- Confirm retention periods, privacy deletion exceptions, legal holds, backup expiry, and who may read retained financial/contract documents with accountant/lawyer.
- Verify no external worker, webhook, OAuth callback or content upload can recreate obligations after terminal closure, with lock-order tests.
- Keep `PERMANENT_CLOSURE_AVAILABLE = false`. The existing migration SQL must not be applied without Myron's explicit approval.

**This metadata check performed zero production mutations.**
