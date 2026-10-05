# Square provider connection: Phase 2Q Gate 0

Gate 0 makes a provider's connected Square account trustworthy. It does **not** move money: there is no Catering payment,
payment link, webhook, processor refund, payout or platform fee in this change.

## Environment

| Variable | Required | Meaning |
| --- | --- | --- |
| `SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY` | **Yes** (to connect or to use a connection) | Exactly 32 random bytes, base64 (`openssl rand -base64 32`; 43 chars unpadded base64url or 44 with `=`). Constant-byte keys are refused. Missing or malformed: every operation fails closed. There is no plaintext fallback, in any environment. |
| `SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS` | No | Decrypt-only previous key, for rotation. |
| `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET` | Yes | Existing. The secret is now also required to start an authorization. |
| `SQUARE_ENV` | Existing | `production` or `sandbox`; any other value is a configuration ERROR (never guessed; the provider OAuth application then reads as not configured). **Now also selects the OAuth authorize host and the SDK environment for the marketplace and provider connections.** When it is absent the prior `NODE_ENV` fallback is preserved: `NODE_ENV=production` is Square production, anything else is Sandbox, so an existing production deployment is never silently moved to Sandbox. Gate 0 development and tests are Sandbox only. |

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

## Schema and migrations

Applied automatically by `npm run db:migrate`, in order, all safe next to an OLD application server:

* `20261007_square_connection_hardening.sql`: additive columns on `payment_methods` (`encrypted_access_token`,
  `encrypted_refresh_token`, `token_expires_at`, `last_refreshed_at`, `location_*`, `merchant_name`, `granted_scopes`,
  `status_changed_at`, `disconnected_at`), index `(provider, provider_id)`, and constraints: `account_status` allowlist
  (`NOT VALID`); the **sealed-credential pair** CHECK (below); and "a `needs_reauthorization`/`disconnected` row holds no secret".
  Connection state reuses `account_status`: `active` | `needs_reauthorization` | `disconnected` (historical `pending|disabled|rejected`
  stay allowed). **It does NOT install the plaintext-blocking constraint** (see "Staged plaintext enforcement").
* `20261008_square_credential_generation.sql`: `credential_generation` (below).
* `20261009_square_merchant_revocation.sql`: `merchant_revoked_at` on `payment_methods`. **Superseded and no longer read or written**;
  left in place (nullable) so older code keeps working. Anything it holds is copied into the table below.
* `20261010_square_merchant_revocations.sql`: `square_merchant_revocations`, the merchant-level revocation history (below).
* `20261011_square_credential_pair_repair.sql`: idempotent repair for a database that applied an earlier revision of 20261007
  (weak pair CHECK, early plaintext constraint). A no-op on a clean database.
* `20261012_square_merchant_id_width.sql`: `square_merchant_revocations.merchant_id` and `payment_methods.location_id` are `text`
  (no length cap), matching `payment_methods.provider_id`. A merchant id longer than the former `varchar(64)` could be stored on a
  connection but would have made the confirmed-disconnect history INSERT fail after Square had already revoked the grant.

**Drizzle parity.** `drizzle-kit push` (`npm run db:push`, `db:push:accept`) treats `shared/schema` as authoritative, so every Gate 0
database object it could otherwise remove is declared there with the migration's final shape: `square_merchant_revocations` (merchant
history, `merchant_id text` primary key) and its CHECKs, `payment_methods.location_id text`, the four `payment_methods` CHECKs
(`account_status`, `credential_generation`, sealed pair, dead-holds-no-secret) and `payment_methods_provider_merchant_idx`. Without
these a push on a fresh database never creates the history table and a push on a migrated one DROPS it (and the CHECKs and index) and
narrows `location_id` back to `varchar(64)`. `square-schema-parity.postgres.test.ts` runs the real `drizzle-kit push` on throw-away
databases (fresh, then migrated with history rows) and asserts nothing is dropped or narrowed. The append-only trigger is
database-only; a push does not touch triggers.

**Sealed-credential pair CHECK.** Exactly two states are valid: neither token stored; or BOTH stored, both `sqenc:v1:%`, with
`token_expires_at`, on a `square` row. Every `LIKE` is guarded by an explicit `IS NOT NULL`: a CHECK passes on TRUE *or NULL*, so
the earlier `LIKE`-only form accepted a one-token row. A pre-existing violating row (possible only on a database that applied
the earlier revision) leaves the repaired constraint `NOT VALID`: enforced for every new write, validated once repaired.

No row is deleted; historical merchant/location identity is kept.

## Staged plaintext enforcement, rolling deploys and rollback

**Finalization is durable across `db:push` / `db:push:accept`.** `drizzle-kit push` treats `shared/schema` as authoritative and cannot
represent the plaintext CHECK (declaring it there would enforce it BEFORE old servers are drained), so a push would otherwise drop a
finalized database's enforcement. The finalizer therefore records a one-way marker row in `square_plaintext_enforcement_state` (declared
in the Drizzle schema so a push never drops it; a trigger forbids UPDATE/DELETE) in the same transaction that installs and validates the
constraint. `push-schema.ts` runs `enforce-square-plaintext-finalization.ts` after every push: if the marker is empty (not finalized) it
does nothing, preserving the staged rollout; if finalized it verifies the validated constraint and reinstalls it if the push removed it,
and the push FAILS (non-zero) if plaintext tokens are present and it cannot. An absent constraint is never read as "finalized": only the
marker is. Re-running the finalizer or the push is idempotent. Test: `square-plaintext-finalization-durability.postgres.test.ts` (runs the
real `db:push` and `db:push:accept` script on throw-away databases).

The constraint that forbids plaintext tokens in `account_details` is **not** in the automatic migrations. Even `NOT VALID` a CHECK is
enforced on every new INSERT/UPDATE, so installing it while an old server still runs the legacy OAuth callback would make that
callback fail. It is an explicit **finalization** step.

1. **Deploy (migrations + new application).** An old server that is still running (rolling deploy) can keep writing plaintext
   tokens, INSERT and UPDATE; nothing rejects it. The new application never writes plaintext. It converts legacy rows lazily when an
   owner is next checked and in bulk with `npx tsx server/scripts/migrate-square-oauth-tokens.ts [--dry-run]`.
2. **Mixed versions.** If an old server reconnects a provider over a row the new application already converted, the plaintext it
   writes is newer than the sealed credential (its expiry differs). The next time the new application checks the row it installs
   that newer credential (advancing the credential generation), clears every verification fact (scopes, location, merchant name)
   and re-verifies with Square; plaintext that merely repeats the sealed credential is stripped.
3. **Detect what remains** (ids and counts only, never a token):
   `npx tsx server/scripts/finalize-square-plaintext-enforcement.ts --check` (exit 2 while any plaintext row remains).
4. **Finalize, only after every old server is drained and the rollback window is intentionally closed:**
   `npx tsx server/scripts/finalize-square-plaintext-enforcement.ts --confirm-old-servers-drained`. It refuses (listing row ids) while
   plaintext remains; otherwise it locks the table, adds the constraint `NOT VALID`, validates it, and commits. Re-running is a
   no-op. **Validate afterwards:** `--check` reports `enforcementInstalled: true, plaintextRows: 0`, and
   `SELECT convalidated FROM pg_constraint WHERE conname = 'payment_methods_no_plaintext_oauth_token_check'` is `t`.
   (The conversion script's closing message says exactly this. It never tells an operator to VALIDATE the constraint directly: the
   migrations do not install it, so the finalizer is the only thing that does.)
5. **Rollback.** Before finalization, rolling the application back is safe for writes (the old server's plaintext writes are
   accepted) and the new columns are ignored. Two limits are real: a connection the new application already converted no longer
   carries plaintext, so the OLD code cannot use or display it (providers reconnect on the old code); and a plaintext write by the old
   server is only recognised by the new application once it is running again. **After finalization, rolling back to application
   code that writes plaintext is NOT safe: its OAuth callback is rejected by the constraint.** To roll back past finalization,
   first `ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_no_plaintext_oauth_token_check;`.

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

**`migrate-square-oauth-tokens.ts --dry-run` is trustworthy.** It runs the real classification (`convertLegacyRow`) row by row inside
transactions that are always rolled back, so it reports `found`, `wouldConvert`, `alreadyConverted` and every `malformed` row (id and a
safe reason: `missing_or_non_string_token`, `invalid_expiry`, `inactive_connection_with_secrets`, `sealed_credential_unreadable`)
without persisting anything, and exits 2 when any row is malformed, like the real run. A row whose pair is already sealed and has no
plaintext residue is not a candidate. Only a dry run that reports no malformed rows means the migration is clean.

See "Staged plaintext enforcement" above for the rollout. The conversion (`migrate-square-oauth-tokens.ts`, or lazily per owner) seals
each row under its row lock, removes the plaintext in the same statement, is idempotent, prints counts and row ids only, and exits 2 if
any row was malformed (those are left untouched and shown as "Needs reconnect"). Converted legacy connections are installed
UNVERIFIED and are not trusted until Square confirms their merchant, scopes and location; the previous scope set lacks the
order/payment-read scopes, so those providers see "Needs reconnect" once.

## Refresh, revocation, disconnect

**Verification tickets apply to destructive outcomes too.** A verification attempt takes a ticket (`verification_attempt`) before it asks
Square. A success write applies only while `verification_applied < ticket`. A verification-derived DESTRUCTIVE outcome (invalid
credential, merchant mismatch, lost scope -> `needs_reauthorization`, tokens cleared, generation advanced) applies only if the attempt is
also the newest ticket issued (`verification_attempt = ticket`) and no newer attempt was applied. An older observation therefore can
neither undo a newer success nor demote a connection a newer attempt is verifying; a newer destructive outcome still applies. Refresh
and payment-call rejections carry no ticket and stay bound to the credential generation alone.

**Incomplete sealed rows are classified before any UPDATE.** `convertLegacyRow` decides whether the sealed state is complete
(`hasCompleteSealedCredential`) before touching a row: an access-only, refresh-only or expiry-less sealed row (left in place by the NOT
VALID pair CHECK, and which would raise 23514 on ANY update of it) is reported as `incomplete_sealed_credential` and left as it is, unless
it carries a COMPLETE plaintext pair, which reseals both tokens and the expiry in one statement. Expiry-only residue on a row with no
sealed credential is still removed. A 23514 on one row is reported per row; during disconnect the reconciliation runs in a savepoint so
the local disconnect always completes.

**What counts as a usable SHARED connection.** The shared-merchant check that can suppress a merchant-wide revoke counts only an ACTIVE
row holding a credential the application can actually use: a complete sealed pair (BOTH `sqenc:v1:` tokens AND `token_expires_at`) or,
during the staged rollout, a complete legacy plaintext pair (non-empty string access AND refresh token and a parseable `tokenExpiresAt`).
A one-token row (which the NOT VALID pair CHECK deliberately leaves in place on upgrade) is not usable by readiness/refresh, so it neither
suppresses the revoke nor is deleted. Key-rotation `--reseal` classifies such a row as `incomplete_credential_pair` BEFORE building any
UPDATE (dry run and real run agree), never writes it, and keeps rotating the healthy rows after it.

**Mixed-version reconnect is reconciled BEFORE disconnect chooses anything.** An old server that reconnects a row the new
application already sealed moves `provider_id` to the new merchant and writes that merchant's tokens as plaintext, leaving the
previous merchant's sealed pair in place; a sealed token being present therefore proves nothing about being current. Under the
row lock, whenever ANY legacy secret key (`accessToken`, `refreshToken`, `tokenExpiresAt`) is on the row, `disconnect` first runs
`convertLegacyRow` (sealed pair opened and compared with the plaintext by token VALUE: identical -> plaintext stripped; different ->
the plaintext is the newer authorization, resealed under the current key, generation advanced, verification facts cleared;
malformed or unreadable -> nothing changes), reloads the row, and requires that no legacy residue remains. Only then are the merchant
(`provider_id`), the revoke token, the shared-connection decision and the revocation-history target taken, all from that one snapshot.
If coherence cannot be proven (malformed plaintext, sealed pair unreadable, encryption not configured) NO Square revoke is made and
no revocation epoch is recorded: the local disconnect still completes with `providerRevocation: "unconfirmed"`. A stale sealed token
is never used. Lock order is unchanged: (users row) -> merchant advisory lock(s) ascending -> the `payment_methods` row; the
reconciliation happens inside the row lock already held, so it adds no lock and cannot form a cycle. If the row moved to another
merchant while waiting, the attempt restarts against the merchant it is on now.

* A token expiring within 7 days is refreshed under the connection row's `FOR UPDATE` lock after re-reading the row, so
  concurrent callers refresh once. Square's code-flow refresh returns the same refresh token; a rotated one is sealed and stored
  in the same update. The refreshed token must still belong to the authorized merchant, else the connection is taken out of
  service.
* **Failure classification** (`classifySquareFailure`) decides from what Square SAID, never from HTTP status alone, because the
  token endpoint answers 400/401/403 both for a bad application secret and for a bad grant. Four classes:
  * `provider_credential_invalid`: the PROVIDER's credential is refused (a bearer call answered 401 / authentication error /
    `INSUFFICIENT_SCOPES`; or a token-endpoint body that positively says `invalid_grant` / invalid, revoked or expired
    refresh token or authorization code). **Only this class may clear credentials**, and only against the exact credential
    generation that failed.
  * `application_auth`: ChefSire's own application credentials are rejected (`INVALID_CLIENT`, `CLIENT_DISABLED`, "Not
    Authorized" / `service.not_authorized`, client-authentication text). Stored credentials are left untouched; readiness reports
    `configuration_error`; the log line is `square_application_auth_failed` (status and class only). Decided FIRST on the surfaces that present the application
    credentials (token grant / refresh, revoke). On a BEARER call (merchant, token status, locations, payments), which sends only the
    provider's access token, "not authorized" / `service.not_authorized` wording is the provider's token failing and classifies as
    `provider_credential_invalid` (-> `needs_reauthorization`, reconnect offered); only an explicit `INVALID_CLIENT` / `CLIENT_DISABLED` code
    still reads as `application_auth` there.
  * `transient`: network faults, timeouts, 5xx, 408, 429, whatever the body says. Nothing changes; `verification_unavailable`.
  * `unrecognized`: any other Square answer. Fails closed: nothing changes; `verification_unavailable`.
  The same classifier serves the authorization-code exchange (application-auth means "not configured", a bad grant means the
  provider was rejected), refresh, merchant / token-status / location lookups and revocation. The signals match the real SDK
  error structure (`SquareError.errors[]` with `category`/`code`/`detail`; a body without `errors` surfaces as `V1_ERROR` with
  `code` = the body's `type`). I could not reach Square's documentation from the build environment to confirm every real body, so
  recognition is deliberately conservative: an unfamiliar body never destroys a connection. The cost is that a truly revoked
  refresh token whose body is not recognised stays `verification_unavailable` until a bearer call (a 401) proves the access
  token dead too.
* Square answering that a credential is bad (provider class above) sets `needs_reauthorization` and clears every secret, keeping
  merchant/location identity. An outage never changes stored state:
  the connection reports `verification_unavailable` and is not payment ready.
* Disconnect (`POST /api/square-connection/disconnect`, owner only, JSON from the app's own origin) always completes locally:
  credentials are cleared and the row is marked `disconnected` (history kept). What happened at Square is reported as
  `providerRevocation` (and `providerRevoked`, true only for `revoked`):

  | Case | `providerRevocation` | What the provider is told |
  | --- | --- | --- |
  | Local disconnect; Square answered the revoke with an explicit `success: true` | `revoked` | ChefSire's access to the Square account is revoked. |
  | Local disconnect; another ACTIVE ChefSire account uses the same Square merchant, so revocation was intentionally skipped | `retained_for_shared_connection` | Disconnected here; the other account still uses it, so access in Square was left in place for it. Not an error. |
  | Local disconnect; Square unavailable, rejected ChefSire's application credentials, rejected the ACCESS TOKEN used for the call (`ACCESS_TOKEN_EXPIRED`, `ACCESS_TOKEN_REVOKED`, `UNAUTHORIZED`, any invalid-credential response: it says nothing about the grant, and an expired access token can coexist with a live refresh token), or answered 2xx WITHOUT an explicit `success: true` (false, missing, or with response-level errors) | `unconfirmed` | Disconnected from ChefSire, but we could not confirm Square revoked access; it may still be active; remove ChefSire from the connected apps in your Square account. |
  | Local disconnect; encryption/configuration fault or no stored credential left to revoke with | `unconfirmed` | Same warning. |
  | Nothing was connected / repeat disconnect | `not_applicable` | Nothing. |

* **Revocation is confirmed only by Square's explicit `success: true`** (no response-level errors). A resolved 2xx without it is
  unconfirmed: no merchant revocation epoch is recorded and the owner is not told access was revoked.
* **Configuration outages never trap a provider.** When the encryption key or Square application credentials are unavailable the
  status is `configuration_error`, and carries `canDisconnect` (true only when a not-yet-disconnected local connection exists; a
  boolean, never a credential). Local disconnect needs neither configuration: it clears credentials, marks the row disconnected, keeps
  non-secret history, makes no Square call, and reports `unconfirmed`.
* **Legacy reconciliation compares token VALUES.** When sealed credentials and plaintext both exist, the sealed pair is opened
  server-side and compared with the plaintext by value (digests + `timingSafeEqual`; nothing logged or stored). An identical pair is
  redundant residue and is removed (the sealed credential and its expiry stand, whatever the plaintext's expiry). A different pair
  is a distinct reconnect and is resealed under the current key as the newer credential (generation advanced, verification facts
  cleared) even when its expiry is identical. A single plaintext token, or non-string values, is malformed and left untouched. A
  sealed pair that cannot be opened is a configuration fault: plaintext does not overwrite it.
* **Merchant-scoped serialization.** Square revokes every token the application holds for a merchant, so "is anyone else still
  connected to this merchant?" must be decided atomically. OAuth persistence and disconnect first take
  `pg_advisory_xact_lock(hashtext('square-merchant:' || merchantId))`; the shared-connection check and the revoke decision run
  while holding it. Lock order, the only one used: users row (OAuth callback only) -> merchant locks, ascending by key
  (an account moving merchant locks both) -> the `payment_methods` row `FOR UPDATE`. Refresh and verification take only the row
  lock and never wait for a merchant lock while holding it, so there is no cycle. Outcomes: the last active connection to
  disconnect revokes exactly once (two concurrent last disconnects: one `retained_for_shared_connection`, one `revoked`); a
  reconnect that commits first makes a concurrent disconnect retain.
* **Legacy connections count as sharers.** During a rolling deploy an active connection can still hold its only credential as plaintext
  `account_details.accessToken`. The shared-merchant check therefore counts an active row on the merchant that holds EITHER a sealed
  access token OR a non-empty string `accessToken` (not merely any JSON), under the same merchant lock; a legacy connection that is
  itself the last one out is sealed first, in the disconnect transaction, so it can revoke. After finalization no legacy rows exist and
  the second branch is never true.
* **Merchant-level revocation history** (`square_merchant_revocations`, keyed by merchant id; no foreign key to users or connection
  rows, so it survives an account moving to another merchant, row reuse, disconnect and status changes; rows are never deleted and
  may only move forward). Because Square's revocation also kills a token issued to a concurrent authorization, a revoking disconnect
  writes `revoked_at` and increments `revocation_epoch` here, in the same transaction and under the same merchant lock. An
  authorization reads the merchant's epoch right after its code exchange; persistence, under the merchant lock, stores it only if
  ALL of: (1) the epoch has not advanced since; (2) no revocation is recorded after the authorization began; (3) Square says the token
  is live right now (`oauth/token/status`). (3) is the proof that a grant is NEWER than any revocation (a token issued before one is
  dead, and no revocation can interleave while the lock is held); (1) and (2) refuse early and close gaps in (3) (outage, stale
  clocks) and each is needed on its own (tests isolate all three). A refused authorization is `authorization_superseded`; one that
  could not be confirmed (Square unreachable) is not stored and the provider tries again. Residual risk: (2) compares service clocks;
  skew between instances cannot defeat (1) or (3). A connection Square itself rejects leaves the active set under its row lock only
  (there is nothing left to revoke for a credential Square has already refused). Merchant-specific facts that live on a connection
  row (merchant name, scopes, location) describe that row's current connection and are cleared when its credentials are replaced;
  they are not revocation evidence and are not kept immutably.
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
reconciliation and amount/currency verification are untouched. `SQUARE_ENV` decides the environment when set; when absent the prior `NODE_ENV` fallback applies (production in
`NODE_ENV=production`). Setting it explicitly in production is still recommended.

Not changed: `server/lib/square.ts` and the drinks code (already on the v43 API).
