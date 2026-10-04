# Square provider connection: Phase 2Q Gate 0

Gate 0 makes a provider's connected Square account trustworthy. It does **not** move money: there is no Catering payment,
payment link, webhook, processor refund, payout or platform fee in this change.

## Environment

| Variable | Required | Meaning |
| --- | --- | --- |
| `SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY` | **Yes** (to connect or to use a connection) | Exactly 32 random bytes, base64 (`openssl rand -base64 32`; 43 chars unpadded base64url or 44 with `=`). Constant-byte keys are refused. Missing or malformed: every operation fails closed. There is no plaintext fallback, in any environment. |
| `SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS` | No | Decrypt-only previous key, for rotation. |
| `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET` | Yes | Existing. The secret is now also required to start an authorization. |
| `SQUARE_ENV` | Existing | `production` or `sandbox` (default). **Now also selects the OAuth authorize host and the SDK environment for the marketplace and provider connections.** Previously the OAuth path keyed off `NODE_ENV`, and always used the production authorize host. |

## Encryption

AES-256-GCM, random 96-bit nonce per value, 128-bit tag, format `sqenc:v1:<keyId>:<iv>:<ciphertext>:<tag>` (base64url).
`keyId` is derived from the key, so a value names the key that sealed it. The associated data is
`payment_methods:<row id>:square_access_token|square_refresh_token`, so a ciphertext moved to another row or column does not
open. A wrong key, tamper or malformed value raises one error type with no secret in its message, and **a decryption fault
never demotes or deletes a connection** (it reports `configuration_error`).

Rotation: set the new key as `…_KEY`, the old as `…_KEY_PREVIOUS`, deploy, run
`npx tsx server/scripts/migrate-square-oauth-tokens.ts --reseal` (re-seals every credential under the new key, row by row under
its lock, without changing the credential or its generation; reports unopenable rows by id), and remove the previous key only
when it reports `failed: []`. A token refresh also always re-seals both the access and refresh token under the current key.

## Schema (`server/migrations/20261007_square_connection_hardening.sql`, `20261008_square_credential_generation.sql`)

Additive on `payment_methods`: `encrypted_access_token`, `encrypted_refresh_token`, `token_expires_at`, `last_refreshed_at`,
`location_id`, `location_name`, `location_currency`, `merchant_name`, `granted_scopes`, `status_changed_at`,
`disconnected_at`; index `(provider, provider_id)`. Connection state reuses `account_status`:
`active` | `needs_reauthorization` | `disconnected` (historical `pending|disabled|rejected` remain allowed). Constraints:
credentials are a sealed pair with an expiry; a `needs_reauthorization`/`disconnected` row holds no secret; a plaintext
`accessToken`/`refreshToken` can no longer be written to `account_details` (`NOT VALID`, so legacy rows do not block the
migration). No row is deleted; historical merchant/location identity is kept.

Rollback: all columns are nullable and constraints are guarded, so the previous application version keeps running. To remove
the change, drop the constraints, then the columns. After rows are converted, rolling back loses the (encrypted) tokens and
providers must reconnect.

## Credential generation (snapshot identity)

`payment_methods.credential_generation` (bigint, NOT NULL, default 1; `20261008_square_credential_generation.sql`) names the
credential snapshot a row currently represents. It is advanced in the SAME statement as the change by every path that
installs, replaces, rotates or removes credentials: OAuth (re)connect, token refresh, legacy conversion, transition to
`needs_reauthorization`, and disconnect. Facts-only verification writes (merchant name, scopes, location, verification time)
do not advance it. It is a counter incremented under the row lock, so two changes never share a value.

A verification starts from one read (id, status, merchant, generation) and decrypts the token from that same read. Its
success write and every failure / needs-reauthorization write include `id`, `provider_id`, `credential_generation` and
`status = 'active'` in the `WHERE`. If zero rows match, nothing is overwritten or cleared; the evaluation restarts from a fresh
read (at most 3 times, then `verification_unavailable`). `getReadyConnectedCredentials` never carries a token across a re-read:
after evaluating readiness it re-reads the row, requires it to be active, the same generation, sealed and located, and
decrypts the CURRENT credential at that point. Status is always checked before location, so a disconnected or revoked row
that retains merchant/location history can never read as active. `reportAuthorizationFailure` must name the generation of the
credential that was rejected; a report about replaced credentials is ignored.

## Legacy plaintext tokens

1. Deploy with the key set and apply the migration (`npm run db:migrate`).
2. `npx tsx server/scripts/migrate-square-oauth-tokens.ts --dry-run`, then without `--dry-run`. It seals each row under
   its row lock, removes the plaintext in the same statement, is idempotent, prints counts and row ids only, and exits 2 if any
   row was malformed (those are left untouched and shown as "Needs reconnect").
3. When it reports `found: 0`: `ALTER TABLE payment_methods VALIDATE CONSTRAINT payment_methods_no_plaintext_oauth_token_check;`
4. Even before step 2, an owner's legacy row is converted lazily when it is next checked. Converted legacy connections are
   **not trusted** until Square confirms their scopes; the previous scope set lacks the order/payment-read scopes, so those
   providers see "Needs reconnect" once.

## Refresh, revocation, disconnect

* A token expiring within 7 days is refreshed under the connection row's `FOR UPDATE` lock after re-reading the row, so
  concurrent callers refresh once. Square's code-flow refresh returns the same refresh token; a rotated one is sealed and stored
  in the same update. The refreshed token must still belong to the authorized merchant, else the connection is taken out of
  service.
* Square answering that a credential is bad (401, authentication error, rejected refresh, merchant mismatch, lost scope) sets
  `needs_reauthorization` and clears every secret, keeping merchant/location identity. An outage never changes stored state:
  the connection reports `verification_unavailable` and is not payment ready.
* Disconnect (`POST /api/square-connection/disconnect`, owner only, JSON from the app's own origin) revokes at Square unless
  another active ChefSire connection shares the merchant (Square revokes every token of the app for a merchant), clears the
  credentials and marks the row `disconnected`. If revocation cannot be confirmed the local disconnect still completes and the
  response says `providerRevoked: false`. Repeating is a no-op.
* No `oauth.authorization.revoked` webhook route was added: it needs a dashboard subscription and a verified, replay-safe
  endpoint, which is Phase 2Q webhook work. Revocation is detected on use and on re-check instead.

## Readiness

`getSquarePaymentReadiness(userId)` (`server/lib/square-connection.ts`) returns `not_connected | active |
needs_reauthorization | no_payment_location | configuration_error | verification_unavailable` and `paymentReady`.
It opens the sealed token, refreshes if due, and asks Square (at most every 6 hours unless forced) that the token's merchant is
the authorized merchant, that every required scope was granted, and that an ACTIVE location of that merchant advertises
`CREDIT_CARD_PROCESSING`; the chosen location is persisted. `getReadyConnectedCredentials(userId)` (server-side only) returns
a decrypted token solely when payment ready.

## Scopes

Requested: `MERCHANT_PROFILE_READ`, `PAYMENTS_WRITE`, `PAYMENTS_READ`, `ORDERS_WRITE`, `ORDERS_READ`.

* `MERCHANT_PROFILE_READ`: retrieve the merchant and list locations (needed now).
* `ORDERS_WRITE` + `PAYMENTS_WRITE`: create a Square-hosted checkout (`checkout.paymentLinks.create` creates an order and a
  payment link) under the provider's account (Phase 2Q).
* `PAYMENTS_READ` + `ORDERS_READ`: read a payment/order back before crediting it (Phase 2Q). Requested now so providers
  authorize once. Nothing about customers, invoices, payouts, bank accounts, items or team members.

## Marketplace SDK repair

`server/lib/square-client.ts` built `new Client(...)` from the root `square` export, which does not exist in the installed
v43, so marketplace capture/refund/reconciliation threw a `TypeError` before any request. It is now a thin adapter that
keeps the exact call shape those state machines use (`paymentsApi.createPayment/listPayments`, `refundsApi.refundPayment/
getPaymentRefund`, `{ result }` envelopes) on the supported `SquareClient`. The state machine, idempotency keys,
reconciliation and amount/currency verification are untouched. Because the environment now follows `SQUARE_ENV`, set it
explicitly in production.

Not changed: `server/lib/square.ts` and the drinks code (already on the v43 API).
