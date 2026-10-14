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
middleware layer (1,418 on `main`) with a TypeScript-AST analysis (`server/lib/async-handler-analysis.ts`). `--patched` installs the
forwarding first and verifies coverage.

**Method.** An `async` function turns *any* throw into a rejection: an `await`, a `.then()` chain, an explicit `throw`, **or a plain
synchronous helper call that throws** (`res.send(renderPage(token))`). A handler is *at risk* when any of those sits outside a
`try { } catch { }` whose catch does not rethrow (code inside `catch`/`finally` is not protected by its own try; a `throw` in a catch counts).
Nested functions are not walked. Calls are risk sites unless allow-listed: only response plumbing on `res` (`status/json/send/set/type/...`),
`next()`, `console.*`, and a few side-effect-free builtins (regex `.test`, `Math.*`, `parseInt`, `Array.isArray`, ...). An unanalysed helper is
never assumed safe. Severity: **strong** = an unprotected `await`/`throw`/`.then()`; **potential** = only unprotected calls to helpers the
analysis cannot prove safe. Neither proves a rejection happens at runtime; runtime failure is established separately by the tests below.

*Correction (Codex P2).* The first version of this audit only counted `await`/`.then(` in unguarded handlers, so call-only handlers such as
`GET /api/auth/verify-email` (`verifyEmailPage(token)`) were omitted, while handlers that merely called `res.status().json()` outside a
`try` were over-counted. The previously reported "60" is superseded.

Results on `main`: 1,418 layers; 1,363 async (async fully guarded 1,314, static-safe 8), 55 sync/error-handler. Running the same audit on this
branch without the forwarding installed gives the same 41 exposed layers (23 `asyncHandler`-wrapped layers are excluded as already forwarding).
**41 layers are exposed on `main`: 25 strong (await/throw/then) + 16 potential (call-only).** Previous report: 60. Against that list:
37 kept, **22 removed** as false positives of the old heuristic (19 meal-social paths flagged only through the shared, fully guarded
`requireMealSocialSchema` middleware, `USE /api/meal-planner` (`initGuard`), and `resend-verification` / `drops/:dropId/click`, whose only code
outside the `try` is `res.*`), **4 added**, all call-only:
`GET /api/auth/verify-email`, `POST /api/square/subscription-link`, `POST /api/subscriptions/upgrade`, `POST /api/subscriptions/downgrade`
(each calls a zod `.safeParse`/`.object(...)` or template helper outside any `try`).
With the forwarding installed: `atRiskExposed 0`, `uncoveredAsync 0`, 1,418/1,418 layers forwarded.
A further 226 fully guarded handlers call a helper inside their `catch` block (informational: only matters if the catch itself throws).

| Category | At risk | Strong | Call-only (potential) | Examples |
| --- | ---: | ---: | ---: | --- |
| Users / social | 16 | 12 | 4 | `/api/follows/*`, recipe search/imports, `/api/reviews`, `GET /api/posts/feed` |
| Nutrition / meal planning | 7 | 0 | 7 | `/api/meal-planner/campaigns/*`, AI lookup/suggestions, substitutions |
| Messaging / notifications | 6 | 6 | 0 | `/api/dm/threads*`, thread read/messages |
| Wedding | 3 | 3 | 0 | `/api/wedding/vendor-listings*` |
| Marketplace / subscriptions | 3 | 1 | 2 | `/api/subscriptions/upgrade|downgrade|cancel` |
| Square payments / payouts | 2 | 1 | 1 | admin middleware on `/api/payouts/process-seller-payout`; `POST /api/square/subscription-link` (disabled stub) |
| Other | 2 | 1 | 1 | drinks admin summary, barcode lookup |
| Auth / OAuth | 1 | 0 | 1 | `GET /api/auth/verify-email` |
| Uploads / media | 1 | 1 | 0 | `POST /api/recipes/import-paprika` |
| Catering bookings & billing | **0** | 0 | 0 | every handler has a full `try/catch` |

**Runtime-confirmed** (the failure was actually reproduced, see `async-failure-http.test.ts` and the isolated-process tests):
`GET /api/dm/threads` (and the same process-exit on `main`), `GET /api/dm/threads/:id/messages`, `POST /api/dm/threads/:id/read`,
`GET /api/follows/requests/incoming`, `DELETE /api/follows/:id`, `POST /api/follows/requests/:id/accept`, plus the synthetic `await` and
call-only handlers in `async-error-forwarding.test.ts`. All other at-risk layers are **static findings**; for the call-only ones
(including `verify-email`, whose `verifyEmailPage` is a pure template function) a runtime failure is possible but not demonstrated.
The meal-social routes tested earlier are `asyncHandler`-wrapped and guarded by `initGuard` on `main`, so they are not in the exposed list.

Limits of the audit: it cannot see promises returned from non-`async` functions, un-awaited fire-and-forget calls, property access that
throws (`req.body.x.y` on `undefined`), implicit conversions, or `router.param` callbacks (see residual risks).

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
* Coverage is **verified, not assumed**: `audit-async-handlers.ts --patched` reports 1,418/1,418 layers forwarded, `uncoveredAsync: 0`, `atRiskExposed: 0`. Call-only async failures are covered by the same wrapper (tests: isolated-process baseline crash vs. survival, exactly-once delivery).
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

* `server/lib/async-handler-analysis.test.ts` (12): the audit detects call-only, no-await helper calls, expression-bodied arrows, explicit throws,
  `await`, `.then()`, partial try/catch, catch-rethrow, nested calls; does not flag static-response handlers; classifies the real `GET /api/auth/verify-email`.
* `server/lib/async-error-forwarding.test.ts` (16): isolated-process BASELINE (crash) and FIXED (survival), GET/POST/middleware rejections, sync
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
* The audit is a static guide (see limits above); the runtime forwarding is what provides the guarantee. Call-only findings are potential risks, not proven failures.

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

### Verification after the Codex P2 correction (audit-only change; runtime forwarding untouched)

* Focused runtime/regression files (analysis, forwarding, async-failure HTTP, Phase 2A init isolation/CORS/retryable-init/mount safety, Square env guard,
  catering Square payments): 99 tests, 98 pass, 0 fail, 1 skipped (PostgreSQL-backed, covered by the earlier disposable-database run).
* The earlier full PostgreSQL-backed run (4,026 pass / 0 fail / 10 skipped, plus the 10 skipped files rerun with their own env vars: 440 pass / 0 fail)
  was against the unchanged runtime; this commit changes only the audit tool, its tests, a test child script and docs.
* `build:server`, `build:client` succeed; `tsc --incremental false`: 3,193 errors on both main and branch, diff empty, 0 in new files.
