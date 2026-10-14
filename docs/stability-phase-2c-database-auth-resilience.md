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

**Frontend** (`client/src/lib/session-verification.ts`, `UserContext`): 401/4xx = invalid (clear, as before); 5xx/429/408 = *unavailable* → keep the signed-in state exactly as for a network error and re-check in the background at most 3 times (5 s, 15 s, 45 s) — no polling loop. The browser cookie is never touched by an outage.

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
