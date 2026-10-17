# Stability Phase 2C — Database outage resilience and authentication reliability

Base: `main` @ `a45f1e5` (Phase 2B, PR #1320). Scope: database connectivity and authentication reliability only.
Nothing here touches production Neon, Plesk, Square production, ledger balances or purchase-entitlement authority.

## 1. Confirmed root causes (measured, not assumed)

All measurements use a deterministic WebSocket<->TCP bridge in front of a disposable local PostgreSQL
(`server/test-support/neon-fault-proxy.ts`), driving the **real** `server/db` pool (`@neondatabase/serverless` over WebSocket). Numbers are from `main` before this change.

| Failure | Behaviour on `main` |
| --- | --- |
| Connection refused | rejects in ~20 ms (`socket hang up`) — fine |
| Black-holed / unreachable endpoint (accepts, never answers) | **never settles** (still pending after 20 s); the `Pool` had no `connectionTimeoutMillis`, so every request that needed a connection waited forever |
| Delayed handshake (3 s) | succeeds after 3 s — fine |
| Connection cut while a query runs | rejects in ~0.5 s (`Connection terminated unexpectedly`) — fine |
| **Idle pooled connection dropped** (Neon restart/suspend, network partition) | **uncaught exception** — the pool had no `'error'` listener, Node escalates it, and `server/index.ts` answers `uncaughtException` with `process.exit(1)`. One network blip while the pool was idle can take the whole site down |
| Recovery after an outage | the next query works (no poisoned state in the pool) — fine |
| Authentication while the database is unreachable | `resolveSessionUser` caught the lookup error and returned `null`, so `requireAuth`, `/api/auth/me`, change-password and every protected route answered **401 "Not authenticated"/BAD_TOKEN** — telling a valid user they were logged out. `optionalAuth` silently made the same user *anonymous* |
| Black-holed database + authenticated request | the request hangs indefinitely (no bound on the lookup) |
| Login / signup during an outage | generic `500 "Login failed"` / `"Failed to create account"` (not retryable-marked) |
| **Frontend** (`UserContext`) | any non-OK answer from `/api/auth/me` — including a 500/503 — **cleared `localStorage.user` and logged the user out of the UI**. Only a thrown network error kept the session |

Query vs. connection: only *connection acquisition* was unbounded. A query already running on a healthy connection is not bounded by anything, by design (see §3).

## 2. Existing behaviour that was kept (and verified)

* Phase 2A: `retryable-init` single-flight initialisation with backoff, API isolation; Phase 2B: central rejection forwarding. Both suites pass unchanged.
* Pool size 5, pooling, SSL handling, drizzle setup are untouched. The shared auth-version revocation model is untouched.
* No automatic retries were added anywhere. A failed connection attempt is not retried by the pool; the next *request* opens a new attempt.

## 3. Timeout strategy

| Setting | Default | Range | Meaning |
| --- | --- | --- | --- |
| `DB_CONNECT_TIMEOUT_MS` | 15000 | 1000–120000 | `connectionTimeoutMillis`: bounds a new connection's handshake **and** the wait for a free pooled connection (pool exhaustion). Long enough for a Neon compute to wake from suspend, well under a proxy's 60 s. Never interrupts a query that is already running |
| `AUTH_LOOKUP_TIMEOUT_MS` | 8000 | 1000–60000 | bounds the read-only session `SELECT` behind every authenticated request. Abandoning a read-only SELECT has no side effects |
| `DB_STATEMENT_TIMEOUT_MS` | 0 (off) | 0 or 1000–600000 | **opt-in** server-side `statement_timeout` set on each new connection. The *server* cancels the statement, so it fails definitively and its transaction aborts atomically (tested). Off by default because poolers can reject session `SET` and a too-low value would turn slow-but-legitimate writes into failures |

Invalid values never disable a protection and never stop the site booting: the default is used and a warning names the variable (never a value, never `DATABASE_URL`).
Validation lives in `server/lib/db-config.ts` (unit-tested).

**Why there is no global client-side query timeout.** A client-side timeout rejects the caller but cannot cancel the server, and cannot tell
"did not happen" from "happened, reply lost". Reproduced (`db-outage.postgres.test.ts`): `COMMIT` executed, the reply swallowed — the caller sees neither success nor
failure, and the row **is committed**. Treating that as failure and retrying would double-credit. So: no automatic retry of any payment or ledger write exists or was added;
connection-acquisition timeouts are safe because they can only fire *before* a statement is sent (definitively "nothing happened"); an in-flight connection loss is reported
as an error, never as success, and reconciliation (existing idempotency keys / `capture_reconciliation`) decides.

Also fixed: `pool.on("error")` now logs a redacted one-liner (code + message with any connection string removed) and the pool discards the broken client.

## 4. Authentication classification

`checkSession()` (`server/lib/auth-session.ts`) returns one of three verdicts; `resolveSessionUser()` keeps its old contract (user or `null`, never "valid" without the database) for existing callers.

| Case | Meaning | Response |
| --- | --- | --- |
| A | missing, malformed, expired, tampered token; missing/ non-integer `av` claim | 401 as before — decided before any database access |
| B | database answered: account unknown, or `auth_version` differs (revoked) | 401 as before — fail closed |
| C | the lookup could not complete (refused, timed out, reset, error) | **503** `{"error":"Service temporarily unavailable. Please try again in a moment.","code":"SERVICE_UNAVAILABLE","retryable":true}` + `Retry-After: 5` + `Cache-Control: no-store`. Nothing granted, no cookie set or cleared, no detail |

Applied to: `requireAuth`, `optionalAuth`, `GET /api/auth/me`, `POST /api/auth/change-password`.
`optionalAuth`: no token / invalid token stays anonymous; a **cryptographically valid token whose session cannot be checked is a 503**, not anonymous (anonymous would show a signed-in user the logged-out view of private data, or let a write run as nobody).
Login, signup, resend-verification, email-verification POST and the change-password write translate **connectivity** errors (`isDatabaseUnavailableError`, a list of connectivity signatures — not "any error") to the same 503;
application errors (constraint violations, bugs) keep their existing handling. The Google OAuth callback redirects to `/login?error=service-unavailable` (no session issued) instead of `google-auth-failed`.

**Frontend**: see §4a. 401/4xx = invalid (clear); 5xx/429/408/network/malformed = *unavailable* → no verdict about the session, bounded retries, recoverable state. The browser cookie is never touched by an outage.

## 4a. Client session lifecycle (Codex P2 repairs)

All session decisions live in one framework-free controller (`client/src/lib/session-controller.ts`); `UserProvider` only binds it to React and the browser. One retry policy, one staleness rule, for the initial cached check, the Google OAuth return, background retries, login, logout and refresh.

* **One reader of `/api/auth/me`** (`verifySessionOnce`): returns `valid` *with the user validated from that very response*, `invalid` (401/4xx), `unavailable` (5xx/429/408/network/**malformed 2xx**), or `cancelled`. No caller issues a second GET to obtain the user, and a 2xx with an incomplete user is never persisted or treated as verified.
* **Epoch (generation).** Bumped, with every in-flight request aborted, by logout, by the *start* and the *success* of a login, and by unmount. Every async step captures it and re-checks after **every** await (request, body parsing, retry sleep) before touching state or `localStorage`; a stale step does nothing. Verification *runs* additionally supersede each other (only one active; `retry()` during a run is a no-op).
* **OAuth return** (`?google-login=success`): the cached profile (possibly another account) is never shown; with no verified identity no user is invented. On an unavailable answer the marker stays in the URL, `pendingOAuth` stays true and the same bounded retries run (1 attempt + 3 retries at 5/15/45 s). Valid → user persisted from that response, marker removed (path, other query parameters and fragment preserved). 401 → pending state and stale cache cleared. Exhausted → `sessionStatus: "unavailable"`, a visible notice with **Try again** (`retrySession()`), never silently "invalid".
* **Cached session**: not shown until the first answer; on an outage the cached profile is shown for UI continuity only (`sessionStatus: "unavailable"` — not "authenticated"); the server still decides every protected request, and the controller never sends a credential from `localStorage`.
* **Cookie ordering (Codex P2).** The session is one cookie in one jar; what ends up there is decided by the order in which login/logout *responses* are delivered, which a client cannot reorder once requests are in flight. The previous design let a superseded login's late response issue a "cleanup" logout, and that logout deleted the cookie of a newer login that had already succeeded (reproduced: UI and storage said Bob, the jar was empty). Now every cookie-changing request (login, logout) goes through **one FIFO queue**: a request is sent only after the previous one has been delivered, so the final cookie is always the last intent's. A login superseded while queued is never sent; a superseded login already in flight is not adopted and issues **no** cleanup from its own handler, because the logout/login the user actually asked for is already queued behind it. Only when the jar may hold a session the UI did not adopt (a superseded login the server accepted) and the newest login is *rejected* is a logout run inside that login's own queue slot, so cookie, UI and storage agree. A hung request is aborted after 30 s (`mutationTimeoutMs`) so it cannot hold the queue. A failed login or a network error never signs out an unrelated existing session.
* **Logout**: bumps the epoch first, then clears local state, records a persisted *logout intent*, then calls the server. If the server call fails the intent stays: a reload does **not** restore the session from the lingering cookie (it retries the logout and stays signed out). A new password login or a Google return clears the intent. A login superseded by logout drops the cookie it just caused.
* Additive context fields: `sessionStatus`, `retrySession`. Existing `UserContext` members are unchanged.

## 4b. Codex P1 repairs (identity mismatch and lookup resource exhaustion)

**P1-1 — a 2xx login can change the cookie even when its body is unusable.** *Root cause (reproduced):* the controller treated a login whose JSON was missing, truncated, not JSON, lacked `user`, or failed `parseUser` as "Unexpected server response" and returned — leaving the *previous* user in React state and `localStorage` while the browser had already applied the new `Set-Cookie`, so the UI said Alice while the server authenticated Bob. A superseded login with such a body also did not mark the jar as suspect. *Fix, inside the serialized queue:* every 2xx is treated as "the cookie may have changed". If the body is usable the user is adopted as before. If not, the controller (1) immediately stops showing/storing anyone, (2) performs **one** authoritative `GET /api/auth/me` in the same queue slot (so it sees the new cookie), and adopts exactly that server identity; if the server says 401 it stays signed out; if the server cannot say (outage/malformed) the uncertain session is **cleared** (signed out locally, logout intent persisted, logout sent) rather than guessed at. A superseded login (any 2xx) marks the jar as suspect and is neither adopted nor reconciled; the newer intent decides, and a newer *rejected* login removes the leftover session. Epoch and serialization are unchanged.

**P1-2 — stalled authentication lookups pinned the pool.** *Root cause (reproduced):* `pool.query` keeps its client checked out until the query finishes; `withReadTimeout` only stopped *waiting*. With 5 clients, five stalled session lookups (lock wait on `users`, or replies that never arrive) left 5 backends waiting on the server and all 5 clients in use after the HTTP 503s had been sent; every later request, including ones needing no `users` row, then failed on connection timeout. *Fix (`server/lib/bounded-read.ts`, used only by the read-only session lookup `server/lib/session-user-read.ts`):* check one client out, open `BEGIN READ ONLY; SET LOCAL statement_timeout = <deadline-250ms>` (one round trip) so **Postgres cancels** a server-side stall, run the SELECT, and on any timeout/failure **destroy** the connection (`release(true)`: removed from the pool, socket ended) so a network-side stall frees its slot at once; a healthy lookup commits off the critical path and returns its client normally (cost: one extra round trip on the authentication critical path). A late-arriving connection after the deadline is released unused; a checked-out client always has an `error` listener (a dying connection otherwise raised an uncaught exception — found by the new tests). `SET LOCAL` ends with the transaction, so it never leaks onto the shared pool (tested: `show statement_timeout` = 0 afterwards). **Writes, payment transactions and `COMMIT`s never go through this path** (tested: a 2.2 s write transaction on the same pool completes with a 1.5 s lookup deadline). `admin-authority.test.ts` now substitutes the documented session-lookup seam, because the session check no longer goes through `storage.getUser`.

## 4c. Third review round (three P1s) — one lifecycle, audited end to end

**P1-1 — login body aborted before it was read.** *Cause (reproduced with a real `fetch` and a real HTTP server — the earlier fake `Response`s had already-buffered bodies and hid it):* `mutationFetch` aborted its `AbortController` in `finally` as soon as the response *headers* arrived. Fetch aborts reading as well as connecting, so `res.json()` then rejected, an ordinary successful login looked like an unusable body, and every login paid a `/api/auth/me` reconciliation (or failed). *Fix:* a single `withMutationDeadline` wraps the whole exchange — request **and** body read — and the abort signal stays live until the exchange is finished; completing cancels the timers, it never aborts the request. If the deadline fires the request is aborted; a fetch that ignores the abort is abandoned after a 2 s grace, so the queue can never be left pending. Successful logins are adopted from their own body with no `/me`; truncated/HTML/invalid-JSON 2xx bodies and a body cut off by the deadline still go through the reconciliation of §4b.

**P1-2 — a foreign cookie survived a failed replacement login.** *Cause:* a superseded login that the server accepted left its cookie in the jar and set `foreignCookieSuspected`, but a later queued login that failed at the *network* or *deadline* layer returned without looking at that flag. *Fix, inside the same queue slot:* every login outcome now settles the jar. (a) No response at all (offline/refused/reset — the browser applied no Set-Cookie for *this* request): if a foreign session is suspected it is dropped (UI and storage cleared, logout sent, intent persisted). (b) Deadline (nothing proves no Set-Cookie was applied): if a foreign session is already known the jar is cleared — Alice, whom the user abandoned, is never adopted; otherwise the server-authoritative identity is read once and adopted (answer lost after the server applied Carol's cookie → Carol; nothing changed → the existing session is confirmed), and an unavailable server clears the uncertain session. (c) Rejected login (non-2xx): unchanged, plus the foreign drop. A superseded login still never cleans up from its own handler, and a cleanup runs *before* any later queued login, so it cannot delete a newer success (tested: A stale → C network failure → cleanup → D succeeds, no logout between D's request and its adoption). A failed cleanup keeps the persisted logout intent, so a reload does not restore the leftover session.

**P1-3 — unbounded COMMIT.** *Cause (reproduced by swallowing the COMMIT reply on pool clients):* the SELECT was bounded, but the transaction's `COMMIT` ran in the background with no deadline; five stalled COMMITs pinned all five clients forever. *Fix:* every phase of `runBoundedRead` now ends in release-or-destroy: acquire (pool `connectionTimeoutMillis` + the overall deadline; a connection arriving late is released unused), `BEGIN … SET LOCAL` and the SELECT (overall deadline + server-side `statement_timeout`), and **COMMIT (its own deadline, `min(timeout, 2 s)`)** after which the client is destroyed — safe because the transaction is read-only and the server rolls it back when the socket closes. `release` is idempotent, so a COMMIT that completes after the destroy changes nothing. Nothing is a bare `Promise.race` that abandons an operation while keeping its connection. Writes, payment transactions and uncertain COMMITs elsewhere remain untouched (a long write transaction on the same pool is tested to complete).

*Neighbouring paths closed in the same pass:* a throwing `localStorage` (private mode/quota) no longer breaks sign-in/out mid-commit (the cache is best-effort); an unexpected exception in a login slot resolves to an error and marks the jar suspect instead of rejecting the caller; the reconciliation uses the same bounded exchange (a hung `/me` that ignores abort ends in a cleared session, not a pending queue); `logout`'s response body is cancelled rather than read.

## 4d. Fourth review round (two P2s)

**P2-1 — an untrusted URL marker cancelled a pending logout.** *Cause (reproduced: forged `?google-login=success` after a failed logout restored Alice, erased the persisted intent and sent no logout):* `start()` treated the marker as proof of a completed Google sign-in and removed `LOGOUT_PENDING_KEY`. The marker is only a URL; it can be typed, bookmarked or replayed from history. *Fix:* a genuine sign-in is now **bound to the browser that started it**. Clicking "Continue with Google" (`googleSignInUrl`, used by the login and signup pages) records a single-use nonce (10 min, same lifetime as the server's OAuth cookies) in `localStorage` and passes it as `client_state`; `/api/auth/google` stores it in an httpOnly cookie scoped to the callback path (strict shape `[A-Za-z0-9_-]{16,64}`, anything else is ignored and cleared); the callback clears the cookie and echoes the nonce as `oauth_state` next to the marker. Only a callback whose `oauth_state` equals the unexpired, unconsumed nonce may supersede a pending logout. A bare, forged, wrong, expired or replayed marker leaves the intent in force: the controller stays signed out, strips the untrusted parameters from the URL, and retries the logout (no `/me`, no adoption of the lingering cookie). When **nothing is pending** the marker behaves exactly as before (an authoritative `/api/auth/me` read; account switching unchanged), and a genuine completion still verifies the identity with the server rather than trusting the URL. The epoch/queue/serialization logic is untouched.

**P2-2 — a database outage swallowed by `AuthService.createAndSendVerification`.** *Cause (reproduced: 500 on every outage path):* the method caught every exception from token deletion/insertion **and** from the mailer and returned `{success:false,error:message}`, so the route's database-unavailable handler never ran. *Fix:* the method still never throws, but classifies by **phase** and returns a structured `cause`: `database_unavailable` (token write failed with a connectivity signature; `error` is the fixed text "Service temporarily unavailable", the driver text only in the server log), `email_delivery` (token stored, mail failed; message kept; a mail server refusing connections is never mistaken for a database outage), or `unknown`. Callers: `POST /auth/resend-verification` and the two routes in `auth.verification.ts` answer a retryable 503 (+ `Retry-After: 5`) for `database_unavailable` and keep their 500s for the rest; `POST /auth/signup` keeps its 201 contract (the account already exists, a 503 would invite a duplicate signup) and now logs a detail-free cause. The verification router's own database reads (`db.select`) are mapped to 503 as well.

## 4e. Fifth review round (P2: a reconciled account must be the one requested)

*Cause (reproduced with a working harness: Alice signed in, a 2xx gateway page for Bob's login that did not replace her cookie, `/api/auth/me` answering Alice):* `reconcileUncertainSession` treated *any* server-confirmed identity as proof that the requested login succeeded, so Bob's login returned `{ok:true}` while Alice's session was what existed. *Fix — one identity rule for every login branch:* the reconciliation now receives the normalized (trimmed, lower-cased) address the user typed and reports success only when the server-authoritative account matches it. A different account is never reported as success: if a foreign session was already suspected in the jar (a stale, abandoned login the server accepted) it is dropped (cleared + logout), never displayed; otherwise it is the session that genuinely exists (the previous user, or one another tab created), so it is shown — UI, storage and cookie agree — and a failed attempt does **not** log it out. The same function serves the unusable-body branch and the deadline branch (previously the deadline branch had its own copy of the check). Neighbouring branch reviewed and fixed: a **usable** body that names a different account than the one requested (a cached or substituted response) is no longer trusted; it is cross-checked with the server like an unusable one. Unchanged by design: no response (network) → nothing changed; non-2xx → failure; superseded → discarded, the newer intent decides; OAuth and cached-user checks have no requested identity (the server's answer is the truth); outage during reconciliation → uncertain session cleared.

## 5. Recovery

No shared promise or auth state is cached on failure (the session lookup is stateless; `retryable-init` already discards rejected promises). Tested end to end through the real app: refuse → 503; black hole → 503; connection cut and restored → 200 again for valid sessions, 401 for revoked ones, same process, no restart. 25 concurrent requests in a black hole → all settle within the bound; connection attempts ≤ number of requests; none after they end.

## 6. Security and financial invariants

* A session is never "valid" without the database's authoritative say-so (`checkSession` only returns `valid` after reading the row and matching the version).
* Outage ⇒ fail closed with a retryable status; never anonymous for a signed-in caller; never an unverified payment reported as unpaid/paid; no entitlement granted.
* Square webhook: unsigned/forged still 401 with **zero** database connections; a valid delivery during an outage is not acknowledged (non-2xx `{ok:false}`) so Square retries; idempotency is the existing key-based design, untouched.
* Payment/entitlement/catering routes during an outage are refused at authentication (503) and **no row changes** (asserted); refunds/reversals are never automatic.
* No `DATABASE_URL`, driver text, host, port or SQL appears in any response (asserted) or in the new log lines (redacted).
* Cookies, JWT checks, `av` revocation, roles and admin checks are unchanged. CSRF/origin protections untouched.

## 7. Plesk / Neon compatibility

Only standard `pg.Pool` options are used (`connectionTimeoutMillis`), which `@neondatabase/serverless` forwards. No startup `options` parameter (poolers reject it). The statement timeout is opt-in and applied with a plain `SET`. Defaults are chosen for Passenger behind nginx (60 s upstream timeout). `.env.example` documents the three variables.

## 8. Tests

* `server/lib/db-config.test.ts`, `server/lib/db-availability.test.ts`, `client/src/lib/session-verification.test.ts` — unit.
* `server/db/db-outage.postgres.test.ts` (13) — real pool through the fault bridge: refused, black hole, delayed, cut mid-request, idle drop, recovery, retry storm, pool exhaustion, statement timeout (server cancels, transaction atomic), uncertain COMMIT.
* `server/routes/auth-db-outage.postgres.test.ts` (15) — real app + real pool + real users table: cases A/B/C, optional auth, login, signup, OAuth, recovery, retry storm, Square webhook, payments/entitlements.
* Both PostgreSQL files need `TEST_DATABASE_URL` (loopback-only guard) and are skipped otherwise. On `main`'s code the same tests **hang** at the first black hole and fail on the refused case (401 instead of 503).

## 9. Known limitations / not changed

* Socket.IO handshake still answers `unauthorized` when the session cannot be verified (the client evicts that socket only; no login state is cleared).
* `requireAdmin` → `hasCurrentAdminAuthority` still denies (403) on a lookup error; it always runs after `requireAuth`, which already returns 503 first.
* Other routes' unexpected database failures still return the generic 500 through the global handler (Phase 2B contract); only authentication paths map to 503.
* Many routes issue several queries; there is no per-route query budget (deliberately — see §3).
* Server shutdown: the pool is ended on `beforeExit`; no SIGTERM drain was added (Passenger restarts are abrupt; connections are closed by the OS).

## 10. Remaining stability campaign work

Error-message leakage in individual routes; lazy schema initialisation outside meal-social/advanced; CSRF hardening; a bounded `unhandledRejection` policy; floating promises in handlers and cron; request-id/correlation logging; optional retry-with-idempotency for *read* paths if desired.

## 11. Verification results

Disposable local PostgreSQL 16 (loopback only, deleted afterwards); production Neon, Plesk and Square production were not touched.

* Complete server/shared/client suite (`tsx --test`, 331 files, one at a time, all three test-database variables set, so **nothing is skipped**): **5,860 tests, 5,857 pass, 3 fail, 0 skipped, 0 cancelled.**
* The 3 failures are `client/src/lib/socket-lifecycle.test.ts` ("a handshake the server refuses is evicted…", "logging in after a rejected connection…", "an expired explicit token is evicted…"). Verified on a clean checkout of `main` (`a45f1e5`): the same file fails the same 3 of 13 there. Not related to this PR (the client socket cache is untouched).
* An earlier full run also showed two failures that were investigated rather than dismissed:
  * `db-outage` "no retry storm": my assertion raced with connection attempts the pool had begun just before the requests timed out (each bounded by the same timeout). Fixed by letting those drain and then requiring a bounded, *stable* count.
  * `drink-collection-premium-access.test.ts`: fails on `main` too when run alone or after `auth-account-prehijack` (3/3 runs on a clean `main` checkout) and passed in the later full run; it is timing-dependent (a fire-and-forget `sendNewFollowerNotification` promise rejecting after the test body — a Phase 2B "floating promise" residual). My two suites now run in their own scratch databases so they cannot change what other files see.
* New PostgreSQL-backed tests: `db-outage.postgres.test.ts` 13/13, `auth-db-outage.postgres.test.ts` 15/15. Unit tests: `db-config` 5, `db-availability` 6, `session-verification` 5. On `main`'s code the same PostgreSQL tests hang at the first black hole (and `/api/auth/me` answers 401 for a refusing database).
* `npm run build:client` and `npm run build:server` succeed. `tsc --incremental false`: 3,193 errors on `main` and on this branch, identical after normalising line numbers (an interim 3,194 was my fault-proxy file; fixed).

### Cookie-race verification (second client P2)

* `session-cookie-races.test.ts` (13): fake server whose Set-Cookie takes effect at delivery, delivery order chosen by the test; invariants (cookie = UI user = localStorage) after every scenario. `session-cookie-races.postgres.test.ts` (4): the same controller against the **real** login/logout/me routes, real JWTs and real Set-Cookie headers on a disposable PostgreSQL; the server's own `/me` view of the jar is compared with the UI. On the previous controller these fail (B sent immediately, stray cleanup logout deletes B's cookie).
* Also fixed: `db/index.ts` `beforeExit` called `pool.end()` without observing the returned promise, so a pool that was already ended caused an unhandled rejection.
* Run: client + Phase 2A/2B/2C server, auth, catering Square and marketplace suites (disposable PostgreSQL): 1,862 tests, 1,859 pass, 3 fail, 0 skipped. The 3 are `socket-lifecycle.test.ts`, re-verified failing identically on `main` (`a45f1e5`, `expected 'connected', actual 'refused'`). Builds pass; `tsc` 3,193 errors on both, identical.

### Client lifecycle verification (Codex P2 repairs)

* `session-controller.test.ts` (25 deterministic tests: fake fetch/storage/location/timers, every response and retry delay released by the test): OAuth 503→200, network→200, 401, exhausted + user retry, URL/query/fragment preserved, no cached account shown after OAuth; cached 503→200 with one request per check, cached 401; malformed 200s; flapping 503/401; logout during retry delay / in-flight / after-200-before-apply; failed server logout + reload; new login vs old in-flight check (including a check started mid-login); login superseded by logout; stale refresh; unmount; bounded retries; no Authorization header or non-`/api/auth/*` request. Mutation checks: removing the logout invalidation fails 5 tests, removing the epoch check fails 2.
* `session-verification.test.ts` (6), `UserContext.render.test.tsx` (3: the real `UserProvider` rendered with the server renderer — this runner has no DOM, so effects do not run; the lifecycle is therefore tested at the controller, with source assertions that the provider delegates to it).
* All 72 client test files + Phase 2A/2B/2C server, catering Square payment and marketplace suites against a disposable PostgreSQL: 1,845 tests, 1,842 pass, 3 fail (`socket-lifecycle.test.ts`, which fails the same 3 on `main`), 0 skipped. Builds pass; `tsc` 3,193 errors on main and branch, identical.
* Remaining client risks: a hard reload mid-login can still show a stale cached profile until the first check answers (by design: it is only shown after an answer or an outage); the Socket.IO client is not part of this lifecycle.

### Verification of the two P1 repairs

* Reproduced before changing code: P1-1 — with Alice signed in, a 200 login for Bob with a malformed/truncated/user-less/incomplete body left Alice in the UI and `localStorage` while the cookie was Bob's (7 failing tests on the previous controller, including 3 against the real routes). P1-2 — after 8 concurrent session lookups against a lock on `users` the HTTP responses were 503 but **5 server backends were still waiting and all 5 pool clients were checked out**; with swallowed replies the pool stayed pinned after the network recovered.
* After the fixes: `auth-lookup-exhaustion.postgres.test.ts` (7: server-side stall cancelled and pool recovered while the lock is still held, network-side stall destroyed and pool serves again, 3 repeated waves return to baseline, no `statement_timeout` leakage, long write transaction unaffected, no uncaught/unhandled), `bounded-read.test.ts` (8), `session-cookie-races.test.ts` (26) and `session-cookie-races.postgres.test.ts` (7, real routes and Set-Cookie).
* Complete suite (338 files, disposable PostgreSQL, nothing skipped): **5,941 tests, 5,937 pass, 4 fail, 0 skipped.** The 4: the 3 `socket-lifecycle.test.ts` tests (fail identically on `main` a45f1e5) and `drink-collection-premium-access.test.ts`, whose failure is not an assertion: "asynchronous activity after the test ended … TypeError: fetch failed" — the drinks service's fire-and-forget request to TheCocktailDB, unreachable in this sandbox, rejecting after the test finished. On a clean `main` checkout the same file failed in 11 of 14 runs here (passed 3 times), so it is timing-dependent and pre-existing, not introduced by this PR; it is a test-hermeticity / floating-promise issue for a later phase.
* Found by the new tests and fixed: a checked-out pool client whose connection dies had no `error` listener (uncaught exception); `admin-authority.test.ts` now uses the session-lookup test seam because the session check no longer goes through `storage.getUser`.
* `build:client`, `build:server` pass; `tsc` 3,193 errors on both main and branch, identical.

### Verification of the third review round (three P1s)

* Reproduced before changing code: P1-1 — with a real `fetch` and a real HTTP server, an ordinary successful login (even with an instant body) was cut by the abort and fell into `/api/auth/me` reconciliation (2 tests failed; the earlier fake-`Response` tests had hidden it). P1-2 — Alice → Bob → Carol with Carol failing at the network layer / deadline left Alice's cookie in the jar and sent no cleanup (4 tests failed). P1-3 — with the COMMIT reply swallowed on pool clients, five requests left 5 of 5 clients checked out indefinitely (2 tests failed).
* After: `session-login-fetch.test.ts` (7, real fetch/HTTP), `session-cookie-races.test.ts` (33), `session-controller.test.ts` (27), `bounded-read.test.ts` (14, incl. stalled COMMIT / BEGIN / late commit / five concurrent), `auth-lookup-exhaustion.postgres.test.ts` (9, real Neon driver: stalled COMMIT with five and 3x10 concurrent requests return the pool to idle and leave no `idle in transaction` backend), plus the earlier Phase 2C PostgreSQL suites (58 tests across the five PG files, none skipped).
* Complete suite (339 files, disposable PostgreSQL): **5,966 tests, 5,961 pass, 5 fail** (4 of the 5 are the known ones below; the 5th is the slow-test timeout), 0 skipped:
  * 3 x `socket-lifecycle.test.ts` — fail identically on `main`.
  * `drink-collection-premium-access.test.ts` — fails on `main` too (external TheCocktailDB fetch rejecting after the test ends; unreachable in this sandbox).
  * `schema-push-safety.postgres.test.ts` "push never drops undeclared tables…" — **times out at its own hard 1,200,000 ms cap**. It takes 1,170–1,260 s in this sandbox (it ran 1,166–1,170 s and passed in earlier runs, 1,209 s and 1,260 s here and failed). Run on a clean `main` checkout under the same conditions it also failed at 1,227 s. It spawns drizzle-kit/npx and does not touch authentication, the pool or the client; not caused by this PR.
* `build:client`, `build:server` pass. `tsc`: 3,193 errors on `main` (`a45f1e5`) and on the branch, same codes and locations; one pre-existing error in the untouched `server/routes/drinks.ts` renders a union member's `readonly` modifier differently in its message text.

### Verification of the fourth review round (two P2s)

* Reproduced first: P2-1 — a forged `?google-login=success` after a failed logout restored Alice, erased the persisted intent and sent no logout; P2-2 — every database-outage path through `createAndSendVerification` answered 500 (4 route tests + the service-contract test failed).
* New tests: `session-cookie-races.test.ts` (+7: forged marker, wrong/expired/replayed state, genuine Google sign-in after a failed logout, reload and replay of an old callback URL, account switching, abandoned sign-in, no behaviour change without a pending logout), `google-signin.test.ts` (4), `google-oauth-state.test.ts` (4: nonce cookie on initiation, malformed values ignored, echo on callback with destination preserved, unchanged callback without it), `resend-verification-outage.test.ts` (9: healthy, outage on deletion, outage on insertion, every connectivity signature, delivery failure incl. a mailer ECONNREFUSED stays 500, non-connectivity database errors stay 500, service contract, verification router, signup 201 contract).
* Previous P1 protections re-run: the whole Phase 2C set (session controller/cookie races/real-fetch login, bounded read, outage, lookup exhaustion incl. stalled COMMIT, real-route cookie races) — 158 tests, 0 failures, 0 skipped.
* Complete suite (342 files, disposable PostgreSQL): **5,989 tests, 5,986 pass, 3 fail, 0 skipped** — the 3 `socket-lifecycle.test.ts` tests, which fail identically on `main` (`a45f1e5`, re-run at the time). `drink-collection-premium-access` and `schema-push-safety.postgres` (both timing-dependent in this sandbox) passed in this run.
* `build:client`, `build:server` pass. `tsc`: 3,193 errors on `main` and the branch, identical by file and error code.

### Verification of the fifth review round

* Reproduced before the fix (previous controller, 4 failing tests): Bob reported successful while the server confirmed Alice; a usable body naming another account trusted; a mismatching reconciled account adopted while a foreign session was suspected; another tab's session handling.
* New/changed tests (`session-cookie-races.test.ts`, +9; `session-cookie-races.postgres.test.ts`, +1 against the real routes): Alice → Bob with the cookie unchanged (failure, Alice kept, no logout); a body naming another account; Bob's cookie genuinely installed (success; typed address normalized for case and whitespace); temporary database outage during reconciliation (cleared, cleanup logout); superseded by another login (old verdict discarded, Carol's cookie not logged out); superseded by logout; mismatching account with a foreign session already suspected (dropped); another tab's Carol session (shown, not logged out); the deadline path (match → success, mismatch → failure). Every scenario asserts cookie = UI = localStorage. Two older tests were corrected because they mocked a login body whose address differed from the one typed.
* Client + Phase 2C/auth/catering/marketplace/Phase 2A-2B suites against a disposable PostgreSQL: 2,016 tests, 2,013 pass, 3 fail (the `socket-lifecycle.test.ts` tests, failing identically on `main` a45f1e5, re-run), 0 skipped. `build:client`/`build:server` pass; `tsc` 3,193 errors on `main` and on the branch, identical by file and code.

## 4f. Per-attempt verification deadline and indeterminate OAuth state (Codex P1/P2 on 29d654e)

**P1 root cause.** `verifySessionOnce()` had no deadline of its own; a stalled `/api/auth/me` (no headers, or headers then a stalled body) never settled, so the bounded retry loop and `refreshUser()` could hang forever.
**Fix.** Each attempt now has a 10 s deadline (`SESSION_VERIFY_TIMEOUT_MS`) covering header wait *and* body read. A child AbortController is linked to the caller's signal; the timer aborts the attempt and the result is `unavailable` with reason `timeout` (never `invalid`). Caller cancellation (logout, supersede, account switch, dispose) still yields `cancelled`. The response is not aborted before its body is read, and the timer and listeners are released in `finally`.
**P2 root cause.** During Google OAuth with no cached user, the first 503 published `loading:false, user:null`, which guards read as logged out.
**Fix.** While OAuth verification has no verified identity, the controller stays `loading:true, sessionStatus:"checking"` through all retries; exhaustion publishes `loading:false, sessionStatus:"unavailable"` (recoverable via `retry()`), and only a definitive 401 yields `anonymous`. `client/src/lib/auth-guard.ts` (`shouldRedirectToLogin`) redirects only on confirmed `anonymous`; applied to `catering-provider.tsx`, the only automatic `!user` redirect found in the audit (other `!user` uses are click handlers or render-time prompts).
**Tests.** `session-verify-deadline.test.ts`, `auth-guard.test.ts`, and additions to `session-controller.test.ts` / `session-cookie-races.test.ts`.

## 4g. Concurrent Google OAuth initiations (Codex P2, discussion r4298188693)

**Reproduced.** `beginGoogleSignIn()` wrote one shared `auth_oauth_initiation` record, so a second tab's click overwrote the first tab's nonce; the first tab's callback then failed `consumeOAuthInitiation()` and a pending logout wrongly won. (Test "two tabs start Google sign-in…" fails on the previous controller.)
**Fix.** Each initiation is stored under its own key `auth_oauth_initiation:<nonce>` (no shared read-modify-write, so tabs cannot clobber each other). Consumption checks only the presented nonce's key (exact match, shape check, 10-minute TTL, single use; a forged/unknown nonce burns nothing). The legacy single key is still honoured. Expired records are pruned on begin/consume and the count is capped at 16. An untrusted callback still cannot cancel a pending logout.
**Limitations.** Pruning is best-effort (needs `Storage.key/length`; falls back to no pruning); storage disabled => a pending logout wins (fail-safe).
**Coverage added.** Stalled-`/me` exhaustion, logout/newer-login/OAuth-supersession during stalled verification, late response after timeout, `refresh()` settling after deadline/dispose, cached other-account identity never shown during OAuth.

## 4h. Server-side per-flow OAuth correlation (Codex P2, discussion r4300724668)

**Reproduced.** `/auth/google` stored the destination and the client nonce in two shared cookies (`oauth_return_to`, `oauth_client_state`). With a real cookie jar, tab 2's initiation overwrote tab 1's values and the first callback cleared the cookies, so the second callback lost its nonce/destination (and the first echoed the wrong ones). `server/routes/google-oauth-concurrency.test.ts` fails 7 of 11 on the previous code.
**Fix.** `server/lib/oauth-flow.ts`: each initiation mints a random flow id, passes it as the OAuth `state` (Google echoes it; passport-oauth2 forwards a string `state` and, with the default null store, does not verify it), and stores `{destination, clientState, issuedAt}` in a cookie named `oauth_flow_<id>`, sealed with HMAC-SHA256 (key = the existing JWT secret, domain-separated, MAC covers the id). The callback reads and clears only the cookie named by its own `state`. Expiry: Max-Age 10 min plus embedded timestamp. Single use: cleared on callback. Cap: 8 flows per browser; stale/invalid/oldest evicted at initiation (cookie Path is `/api/auth/google` so initiation can see them). `state` is only a lookup key: with no valid sealed cookie the callback is a plain Google sign-in (marker only, no nonce echo, no destination). Legacy shared cookies are cleared and ignored. Authentication itself, session issuance and the pending-logout rules (which depend on the client nonce being echoed) are unchanged.
**Limits.** The flow cookie is sealed against tampering but, like any cookie, a replay within 10 minutes from the same browser before the callback clears it is possible; the client nonce is single-use on the client side. Browsers cap cookies per domain; we keep at most 8 flow cookies.
