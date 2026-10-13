# Stability Phase 2B — Express async error handling and process stability

Base: `main` @ `8785ca5` (Phase 2A, PR #1319). Express in this repo: **4.21.2** (does not catch rejected promises).

## 1. Reproduced root cause

Express 4 only catches *synchronous* throws from a handler. An `async` handler that rejects returns a rejected promise that nothing
awaits. Observed (all on `main`, using isolated child processes):

| Observation | Evidence |
| --- | --- |
| The rejection bypasses Express's error handler | synthetic app, `server/lib/async-failure-child.ts unpatched`: the error handler never ran, no response was produced |
| `server/index.ts` terminates the process on it | its policy is `process.on("unhandledRejection", () => process.exit(1))`; the child exited with code 1 |
| A real route, with the real `server/app.ts` | `GET /api/dm/threads` (authenticated, database failing) on `main`: `unhandledRejection` -> `exit(1)`, **no response sent** (`async-failure-app-child.ts` run in a worktree of `8785ca5`) |
| Same test file run in-process on `main` | the first failing request left the client hanging until killed (the request is never answered) |
| One bad request affects unrelated users | the process exit drops every in-flight request and every connection; under Passenger the app restarts (cold start, new Neon connections) |

On this branch the same scripted requests return a generic `500 {"error":"Internal Server Error"}` and the next request (`/healthz`) is `200`.
No production server was crashed; every crash above was in a disposable child process against an unreachable database address.

## 2. Audit (`server/scripts/audit-async-handlers.ts`, reproducible)

Walks the real router tree (read-only; uses `router.stack` in a tool, never in runtime code) and classifies every registered handler and
middleware layer (1,418 on `main`). `--patched` installs the forwarding first and verifies coverage.

Classification on `main` (before): async-fully-guarded (one `try/catch`, no rethrow) **1,274**; already wrapped (`asyncHandler`/`.catch(next)`) **40**;
sync **32**; async **unguarded 34**; async **partially guarded 38** (awaits/calls outside the `try`, or `catch` rethrows).
Of those 72 candidates, **60 can actually reject** (an `await`/call outside any `catch`); the other 12 are static responses
(e.g. `GET /api/square/locations`, `/api/payouts/pending-balance`, the `*/tiers` lists) that cannot reject. So the Phase 2A estimate
(~108) over-counted: many handlers have a guard that starts after a few statements, or are wrapped.

Confirmed-vulnerable (60) by category:

| Category | Count | Examples |
| --- | ---: | --- |
| Nutrition / meal planning | 28 | meal-plan likes/saves/comments, creators, shared-week comments, campaigns, AI lookup |
| Users / social | 16 | `/api/follows/*`, recipe search/random/trending, recipe imports, `/api/reviews` |
| Messaging / notifications | 6 | `/api/dm/threads*`, thread read/messages |
| Wedding | 3 | `/api/wedding/vendor-listings*` |
| Marketplace / subscriptions | 2 | `/api/subscriptions/upgrade|cancel|downgrade` (all `requireAuth` first) |
| Other | 2 | drinks admin summary, barcode lookup |
| Auth / OAuth | 1 | `GET /api/auth/verify-email` |
| Uploads / media | 1 | `POST /api/recipes/import-paprika` |
| Square payments / webhooks | 1 | a layer on `/api/payouts/process-seller-payout` (payouts are disabled: the handler only returns the fixed 503 refusal) |
| Catering bookings & billing | **0** | every catering/Square payment/webhook handler already has a full `try/catch` (Square webhook answers `{ok:false}` itself) |

Real-route reproductions: `GET /api/dm/threads`, `GET /api/dm/threads/:id/messages`, `POST /api/dm/threads/:id/read`,
`GET /api/follows/requests/incoming`, `DELETE /api/follows/:id`, `POST /api/follows/requests/:id/accept`,
`GET /api/meal-planner/week/shared/:token/comments` (see `async-failure-http.test.ts`). Limits of the audit: it cannot see
promises returned from non-`async` functions, un-awaited fire-and-forget calls, or `router.param` callbacks (see residual risks).

## 3. Architecture

`server/lib/async-error-forwarding.ts`, installed by one side-effect import (`async-error-forwarding.install`) placed **before** `./routes`
in `server/app.ts` and `server/index.ts`.

* It wraps the handler functions passed to Express's **public** registration methods: `Route.prototype[get|post|…|all]` (which backs
  `router.get/post/…`, `app.get/…`, `router.route()`) and `Router.use` (which backs `app.use`). `Layer`, `router.stack`, `handle_request`
  and the router's matching are **not** touched, so route matching, order and method behaviour are Express's own.
* Wrapper rules: arity-4 error handlers are never wrapped (the wrapper has `length === 3` so Express classifies it as an ordinary handler);
  routers/sub-apps (`.handle`/`.stack`) are never wrapped; already-wrapped functions are not wrapped twice; synchronous throws
  propagate to Express untouched; a rejection is forwarded at most once, and not at all if the handler already called `next()` (that
  would re-enter the chain) — it is logged instead, never swallowed and never an `unhandledRejection`. Rejection values `next()` would
  misread as control flow (`undefined`, `null`, `"route"`, `"router"`) are wrapped in an `Error` (original in `cause`).
* No-op on Express >= 5.
* `asyncHandler` (existing utility) now delegates to the same implementation, so explicitly wrapped routes are recognised and not wrapped again.
* `server/app.ts` global error handler: if `res.headersSent`, delegate to `next(err)` (Express's default closes the connection) instead of
  throwing `ERR_HTTP_HEADERS_SENT` from a second `res.status().json()`. Response bodies are otherwise unchanged (generic 500 outside `NODE_ENV=development`).
* Coverage is **verified, not assumed**: `audit-async-handlers.ts --patched` reports 1,418/1,418 layers forwarded, `uncoveredAsync: 0`.
* `unhandledRejection` -> `exit(1)` in `server/index.ts` is deliberately **unchanged** (last-resort policy for genuine stray rejections).

## 4. Why authentication and payment security are unchanged

The wrapper never changes which function runs or in what order; it only adds a `.then(undefined, onRejected)` to the promise a handler
already returned. A rejected auth middleware now yields a 500 through the error handler rather than hanging/crashing — it cannot turn a
rejection into a *pass*: the downstream handler runs only if `next()` is called without an error, which the wrapper never does on the
handler's behalf. Tests: 401 before the handler with zero database calls; origin/JSON guard on catering pay runs before the database;
cross-site credentialed mutation still refused. Payment handlers all had their own `try/catch`; they never reach the wrapper's rejection
path, so every response contract is byte-identical: Square webhook unsigned/forged -> 401 with no DB work; valid-signature + database
down -> non-2xx `{ok:false}` (Square retries; never acknowledged); payment-attempt status failure -> 500, never a 200 reading as
"unpaid"; pay with DB down -> existing 503 contract. A caught exception performs no ledger write (no code path was added that writes).
No provider credentials, driver text, hostnames, SQL or stacks appear in any failure response (asserted).

## 5. Tests

* `server/lib/async-error-forwarding.test.ts` (13): isolated-process BASELINE (crash) and FIXED (survival), GET/POST/middleware rejections, sync
  throws, 401-before-handler, inline/array/nested arrays, `route()`, mounted + nested routers, preserved intentional statuses
  (400/401/403/404/409/429/503), error after headers sent, `next()`-then-reject, non-Error and control-flow rejection values, arity-4/router/idempotency.
* `server/routes/async-failure-http.test.ts` (16): real `app.ts`; 7 real failing routes; log-once; auth before DB; static 503s; Square webhook
  fail-closed and processing-failure; payment status/pay under DB failure; origin protection; isolated-process survival with the `exit(1)` policy.

## 6. Residual risks / not covered

* Fire-and-forget promises inside handlers (`void send()`/un-awaited `.then` without `.catch`), timers and cron jobs are not Express handlers and are not
  covered; they can still reach `unhandledRejection`. Audit candidate for the next phase.
* `router.param(name, fn)` callbacks (arity 4) are not wrapped (none are used in `server/`).
* Handlers that return a promise from a non-`async` function are wrapped (thenable check) but the *audit* classifies them `sync`.
* Handlers already running `next(); throw` style are logged, not forwarded, by design.
* Socket.IO listeners were handled in Phase 2A and are unaffected.
* Pre-existing: `error-handler.ts#errorHandler` (not mounted anywhere) maps messages containing "constraint" to 400; left untouched.
* The audit's try/catch classification is syntactic; it is a guide, the forwarding is what provides the guarantee.

## 7. Follow-ups

1. Bounded, logged policy for `unhandledRejection` (log + keep serving for non-fatal sources, exit only for state corruption) after a release of soak data.
2. Sweep for fire-and-forget promises (`@typescript-eslint/no-floating-promises` on `server/routes`, `services`, `cron`).
3. Request-id middleware + include it in `[ERROR]` logs (none exists today).
4. Upgrade path to Express 5 (the installer already no-ops).

## 8. Verification results (this branch)

* Full available server/shared suite (`tsx --test`, 257 files): **3,565 tests, 3,383 pass, 0 fail, 182 skipped**. The skips are the
  PostgreSQL-backed suites, which need a disposable database; none was available, and production Neon was not touched. (One earlier run
  failed `square-environment-selection.test.ts` because my child script read `SQUARE_ENV` directly; fixed, re-run green.)
* `npm run build:server` and `npm run build:client`: succeed. The server bundle starts and answers `/healthz` 200 / unauthenticated `/api/dm/threads` 401.
* `npm run check` (`tsc`): fails on the repository's known errors, **identical to `main`**: 3,193 errors on both after normalising line numbers
  (`diff` empty); 0 introduced by this branch.
