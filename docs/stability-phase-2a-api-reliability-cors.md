# Stability Phase 2A — API reliability and CORS security

Scope: one initialization failure that could disable unrelated API endpoints, and a permissive credentialed-CORS default. No migration was
run, no database was touched, and no deployment setting changed.

## 1. API-wide failure propagation

### Root causes (reproduced against `main` @ `1791188` before any change)

1. **Router-level middleware on a router mounted without a path.** `routes/index.ts` does `r.use(mealSocialRouter)` (no prefix, because
   its URLs are absolute: `/meal-plans/:id/like`, `/meal-plan-creators`, `/me/saved-meal-planner-items` …) and `meal-social.ts` registered
   its schema initialization with `router.use(ensureSchemaMiddleware)`. Express runs router-level middleware for **every request that reaches
   the router**, whether or not one of its routes matches. Everything that fell through the routers mounted before it ran the DDL first:
   `GET /api`, `/api/dm/*`, `/api/notifications`, `/api/catering/*` **including `POST /api/catering/webhooks/square`**, `/api/wedding/*`,
   `/api/square*`, `/api/payments`, … and every unknown `/api/*` path. While the DDL failed they all answered
   `500 {"message":"Meal planner social schema is not ready"}`; an unknown path answered 500 instead of 404.
2. **The rejected promise was cached for the life of the process.** `schemaReady` was assigned before it settled and never cleared. One
   transient failure (a Neon cold start, a dropped connection) at the first request made every later request fail even after the database
   returned. Reproduction: DDL attempted exactly once, then 500 forever.
3. **Initialization ran before authentication**, so an unauthenticated caller could trigger the DDL on any of those paths.
4. **No handler in `meal-social.ts` caught its own errors.** Express 4 does not route a rejected async handler to the error handler, and
   `server/index.ts` exits the process on `unhandledRejection`: a database error inside any of those routes was a process restart.
5. **The sibling initializers had the same two defects**, and one leaked driver text: `meal-planner-advanced.ts` answered with
   `details: String(e.message)` — database host names, SQL and driver messages in an HTTP body.

### Fix

* `server/lib/retryable-init.ts` — a small primitive replacing the cache-the-promise pattern:
  * success is cached forever; a burst of callers shares **one** run (no concurrent DDL);
  * failure is **not** cached, but is rate limited: the next attempt is allowed after 1 s, then 2 s, 4 s … capped at 30 s. Callers inside the
    window are refused immediately **without touching the database**, so an outage (or a flood of unauthenticated requests during one)
    cannot become a retry storm. Worst case is one attempt per 30 s for the whole process;
  * a caller never waits more than 15 s on a running attempt; an attempt wedged for 60 s is written off (a late success still counts);
  * callers only ever see `InitializationUnavailableError` (fixed message). The driver error stays in `cause` and the server log;
  * `initGuard()` turns that into `503` + `Retry-After` + `{ message, code, retryable: true }` with no driver detail.
* `meal-social.ts`: the router-level `router.use` is gone. Each of the 19 routes names the guard explicitly, **after** `requireAuth`/`optionalAuth`
  (so an anonymous caller gets 401, cannot trigger the DDL and cannot learn its state), and is wrapped in the existing `asyncHandler` so a
  database error becomes the generic 500 instead of a process exit. The DDL statements are unchanged (same `CREATE … IF NOT EXISTS`).
  `ensureMealSocialSchema()` keeps its signature for `meal-plans.ts` and `meal-planner-week.ts`, which call it inside their own try/catch.
* `meal-planner-advanced` and `meal-planner-week` initializers use the same primitive and `initGuard`; the `details` leak is removed.
  Their guards are still router-level, but those routers are mounted at `/meal-planner`, so the blast radius is that prefix only (see below).
* Route contracts: all paths, methods, authentication and success bodies are unchanged. The only visible change is the failure status,
  500 → 503 (with `Retry-After`), for “initialization not ready”.

## 2. CORS and Socket.IO origin policy

### Verification of the audit claim

`cors({ credentials: true, origin: process.env.CLIENT_URL || true })`: with `CLIENT_URL` unset, `origin: true` **reflects the request's Origin**
with `Access-Control-Allow-Credentials: true` (reproduced in `cors-http.test.ts`, test 1). Socket.IO was worse: both servers used
`cors: { origin: true, credentials: true }` **unconditionally**, whatever `CLIENT_URL` said, and a WebSocket handshake has no CORS check at
all in browsers, so nothing on the server side refused a foreign page. Practical reach is limited by `SameSite=Lax` on `auth_token` (a foreign
*site* does not send the cookie), but same-site sibling origins (any subdomain) and anything that holds a Bearer token are not covered by that.
When `CLIENT_URL` *was* set, the HTTP side sent that one fixed string; it was never normalized (a trailing slash silently disabled it).

### Policy (`server/lib/cors-policy.ts`, used by `app.ts` and both realtime servers)

| Source | Meaning |
| --- | --- |
| `CLIENT_URL`, `APP_BASE_URL`, `APP_URL` | the application's own public URL(s). In a production runtime they must be `https` and not loopback |
| `CORS_ALLOWED_ORIGINS` | extra approved origins (comma/space separated), any runtime — e.g. `capacitor://localhost` for a mobile web view |
| `CORS_DEV_ORIGINS` | development origins; honoured only when `NODE_ENV` is `development` or `test`, ignored with a warning otherwise |

* Entries are normalized to bare origins. `*`, `null`, paths, query strings, userinfo and lists-in-one-value are rejected and reported once at startup.
* Nothing configured ⇒ nothing allowed (fail closed). Production is “anything that is not explicitly `development`/`test`”, matching `jwt-config`.
* An allowed origin is answered with **its own** value, `Access-Control-Allow-Credentials: true` and `Vary: Origin`. Never a wildcard, never a reflection of an unlisted origin. A received `Origin` must already be canonical to match.
* An untrusted origin gets **no CORS headers** (the browser will not expose the response); a **preflight** from it gets `403`. Non-preflight requests are
  not rejected — CORS protects reads, and rejecting them would break form-POST OAuth callbacks and other legitimate cross-site navigations.
* No `Origin` header ⇒ not a browser cross-origin request (same-origin GET, curl, native mobile, **Square's server-to-server webhook**, OAuth redirects) ⇒ untouched.
* Same-origin requests are untouched; a same-origin preflight is never refused (authority compared with `Host`/first `X-Forwarded-Host`, scheme ignored because TLS ends at the proxy).
* Socket.IO: `cors` uses the same allowlist and `allowRequest` refuses a **handshake** whose `Origin` is neither allowlisted nor the server's own (this is the control that
  actually protects a WebSocket). A handshake with no `Origin` is a non-browser client and proceeds to the namespace's token authentication, which is unchanged.

### Socket.IO: one server per HTTP server

`attachDmRealtime` and `attachNotificationRealtime` each created a `Server` on the same HTTP server and the same path `/socket.io`. Reproduced on clean `main`:
polling to `/dm` fails with “Invalid namespace”, and **a WebSocket upgrade throws `handleUpgrade() was called more than once`**, an uncaught exception that
`server/index.ts` turns into `process.exit(1)` — any remote client could restart the server. `realtime/socket-server.ts` now hands both modules a single shared
`Server` (with the origin policy applied once).

## 3. Operational notes

* Set `CLIENT_URL` (or `APP_BASE_URL`/`APP_URL`) to the production `https://…` origin. The SPA is served by this same server, so same-origin traffic works without it; the setting
  matters only for genuinely cross-origin browser clients and for Socket.IO from another origin. The startup log prints `[cors] …` warnings for anything refused.
* The global error handler now returns `message`/`stack` only when `NODE_ENV` is exactly `development` (it used to return them whenever `NODE_ENV` was anything but `production`).
* The notification socket no longer emits `e.message` to the client on a handler failure (it sends a fixed message; the DM socket already did this).
* Nothing here runs DDL at deploy time; the meal-planner tables are still created lazily by the same idempotent statements, now with recovery.

## 4. Tests

| File | Covers |
| --- | --- |
| `server/lib/retryable-init.test.ts` | success cached, single-flight, failure not cached, backoff/cap, no retry storm, opaque errors, hung/wedged attempts, no unhandled rejection, `initGuard` |
| `server/routes/api-init-isolation.test.ts` | real `app`: real driver against an unreachable DB, unrelated APIs stay up and never run the DDL, Square catering webhook routing, unknown `/api/*` 404, auth-before-init, bounded retries, recovery, concurrency, handler errors, advanced-schema sanitization |
| `server/lib/cors-policy.test.ts` | origin normalization/refusals, production vs development, missing `CLIENT_URL`, same-origin, env re-read |
| `server/routes/cors-http.test.ts` | real `app`: reproduction of the old behavior, allowed/disallowed/same-origin/dev origins, credentials, preflight, duplicate `Origin`, webhook + OAuth compatibility |
| `server/realtime/socket-origin-policy.test.ts` | both namespaces on one server over websocket and polling, allowed/disallowed/missing-config/same-origin/no-Origin/dev origins, CORS headers on polling |
| `server/realtime/notification-socket-error-disclosure.test.ts` | database failures in notification-socket handlers produce fixed messages, no driver text |
| `server/routes/routes-mount-safety.test.ts` | structural guard: a router mounted without a path prefix may contain only routes (no router-level middleware); each meal-social route is `[auth, schema guard, handler]` |
| `server/routes/meal-social-recovery.postgres.test.ts` | **real PostgreSQL** (`TEST_DATABASE_URL`): driver-level connection failure, bounded refusal, recovery, idempotent DDL, one initialization for 30 concurrent first requests |

Measured while verifying (disposable PostgreSQL 16, two OS processes starting the **unchanged** DDL at the same instant on an empty schema): the loser failed in 10 of 12 rounds
(the known concurrent `CREATE TABLE IF NOT EXISTS` race); with the tables already present, 0 of 8. Before this change a loser stayed broken until restart (two workers, or
an old and a new process during a restart); now it is refused for the 1 s window and then initializes (6 of 6 rounds healed on the second attempt).

## 5. Remaining concerns (not changed here)

See the PR description for the full list. Highlights: `/meal-planner/*` still shares the advanced/week router-level guards (campaigns and AI nutrition sit behind them); Express 4 async handlers
elsewhere without `try/catch` still exit the process on a rejection; the Neon pool has no `connectionTimeoutMillis`; CORS is not a CSRF control (same-site cross-origin state-changing requests rely
on `SameSite=Lax` and the few `requireSameOriginJson` routes); `trust proxy` is hard-coded to 1 hop.
