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

**Method (escaping-rejection model).** An `async` function turns *any* throw into a rejection: an `await`, a `.then()` chain, an explicit
`throw`, **or a plain synchronous helper call that throws**. A site is *protected* only if it is inside the `try` block of a statement that has a
`catch`. The `catch` block and the `finally` block of that same statement are **not** protected by it: recovery logic (a ledger settlement, a
database update, a logging/error-mapping helper) can reject just as well. Protection nests: a catch/finally that sits inside an *outer*
try-with-catch's try block is protected by the outer one; a try inside a catch protects only its own try block; `try/finally` without `catch`
protects nothing. Nested functions are not walked. Every unprotected site is counted wherever it is (`where`: body | catch | finally); `sites`,
`catchRisk` (the subset in catch/finally), class and severity all describe this one model. A handler is never "safe" merely because it contains a try/catch.
Calls are risk sites unless allow-listed: only response plumbing on `res` (`status/json/send/set/type/...`), `next()`, `console.*` and a few
side-effect-free builtins (regex `.test`, `Math.*`, `parseInt`, `Array.isArray`, ...). Business-logic helpers are never assumed safe.
Severity: **strong** = an unprotected `await`/`throw`/`.then()` can escape; **potential** = only unprotected calls to helpers the analysis cannot
prove safe can escape. Neither proves a rejection happens at runtime; that is established separately by the runtime tests below.

*Corrections.* (1) Codex P2 #1: the first audit counted only `await`/`.then(` and so missed call-only handlers such as `GET /api/auth/verify-email`.
(2) Codex P2 #2: the second version promoted only explicit `throw`s found in catch/finally, so handlers whose *recovery* awaited or called something
(`POST /api/payments/create-payment` -> `await settleMarketplaceCaptureFailure(...)`, `POST /api/payments/refund` -> `await db.update(orders)...`)
were classified as guarded. Reported counts: 60 (first), 41 (second), **267** (this model). Each earlier set is contained in the next (all 41 remain).

Results on `main` (the audit run on this branch without the forwarding installed gives the identical list; 23 `asyncHandler`-wrapped layers
are excluded as already forwarding): 1,418 layers; 1,363 async (guarded 1,088, static-safe 8, **at risk 267**), 55 sync/error-handler.
**267 layers are exposed on `main`: 27 strong (an await/throw/.then can escape) + 240 potential (only unanalysed helper calls can escape).**
228 of the 267 have their risk *only* inside a catch/finally block (recovery/logging/error-mapping helpers); the 39 others have unprotected code in the body.
The potential findings are dominated by error-reporting helpers inside catch blocks (`logCollectionRouteError` 170, `collectionServerError` 154,
`invalid` 39, `collectionDbErrorResponse`/`classifyCollectionError` 15 each): they are plausible to be harmless, but the analysis does not read
them and so does not clear them. With the forwarding installed: `atRiskExposed 0`, `uncoveredAsync 0`, 1,418/1,418 layers forwarded.

| Category | At risk | Strong | Potential (helper calls) | Notes |
| --- | ---: | ---: | ---: | --- |
| Other (mostly drinks collections) | 160 | 1 | 159 | catch blocks calling `logCollectionRouteError`/`collectionServerError` |
| Catering bookings & billing | 37 | 0 | 37 | no unprotected await/throw/.then; 37 catch blocks call `invalid(error, res, next)` |
| Users / social | 35 | 12 | 23 | `/api/follows/*`, recipe imports, `PUT /api/users/:id/subscription`, quests admin |
| Messaging / notifications | 8 | 6 | 2 | `/api/dm/threads*` |
| Square payments / payouts | 7 | 3 | 4 | **`POST /api/payments/create-payment`, `POST /api/payments/refund`** (strong, in catch), payouts admin middleware, drinks Square webhook catch helpers |
| Nutrition / meal planning | 7 | 0 | 7 | campaigns, AI lookup/suggestions, substitutions |
| Marketplace / subscriptions | 6 | 1 | 5 | `/api/subscriptions/*` |
| Auth / OAuth | 3 | 0 | 3 | `GET /api/auth/verify-email` (call-only) and two catch helpers |
| Wedding | 3 | 3 | 0 | `/api/wedding/vendor-listings*` |
| Uploads / media | 1 | 1 | 0 | `POST /api/recipes/import-paprika` |

The 27 strong layers: `import-paprika/anylist/plan-to-eat/url`, `PUT /api/users/:id/subscription`, drinks admin checkout-attribution summary,
6 `/api/dm/*`, `quests/create|seed`, `follows/*` (6), `POST /api/subscriptions/cancel`, **`payments/create-payment`, `payments/refund`**,
`payouts/process-seller-payout` (admin middleware), 3 `wedding/vendor-listings*`.

**Runtime-confirmed** (the failure was actually reproduced): `GET /api/dm/threads` and the other DM/follows routes in
`async-failure-http.test.ts`; `POST /api/payments/create-payment` with a Square decline (faked at the HTTP layer, no network) **and** a rejecting
recovery transaction -> exactly one Square request, one recovery attempt, `500 {"error":"Internal Server Error"}`, no ledger write, no
unhandled rejection, next request succeeds (on unpatched Express 4 that recovery rejection is an unhandled rejection -> `exit(1)`). The synthetic
await and call-only handlers are in `async-error-forwarding.test.ts`. Everything else is a **static finding**.

Limits of the audit: it cannot see promises returned from non-`async` functions, un-awaited fire-and-forget calls, property access that
throws (`req.body.x.y` on `undefined`), implicit conversions, or `router.param` callbacks; it does not read helper implementations, so
error-reporting helpers are over-reported as potential risks (the conservative direction).

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

* `server/lib/async-handler-analysis.test.ts` (29): call-only helper calls, expression-bodied arrows, explicit throws, `await`, `.then()`, partial try/catch;
  catch/finally recovery (await, helper call, `.then`, throw, database update); nested try/catch (handled internally vs. escaping); static responses; rejected-promise
  recovery; nested-function exclusion; the real `GET /api/auth/verify-email`, `POST /api/payments/create-payment` and `POST /api/payments/refund`.
* `server/lib/async-error-forwarding.test.ts` (16): isolated-process BASELINE (crash) and FIXED (survival), GET/POST/middleware rejections, sync
  throws, 401-before-handler, inline/array/nested arrays, `route()`, mounted + nested routers, preserved intentional statuses
  (400/401/403/404/409/429/503), error after headers sent, `next()`-then-reject, non-Error and control-flow rejection values, arity-4/router/idempotency.
* `server/routes/async-failure-http.test.ts` (17): real `app.ts`; create-payment with a Square decline whose recovery also rejects (fake Square via fetch interception); 7 real failing routes; log-once; auth before DB; static 503s; Square webhook
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

### Verification after the Codex P2 corrections (audit/test/docs only; runtime forwarding untouched)

* Focused files (analysis, forwarding, async-failure HTTP, Phase 2A init isolation / CORS / retryable-init / mount safety, Square environment guard,
  catering Square payments, marketplace payment/reconciliation tests): 232 tests, 232 pass, 0 fail, 0 skipped, run against a disposable local PostgreSQL
  with all three test-database variables set (without it: 172 tests, 154 pass, 0 fail, 18 skipped).
* The earlier full PostgreSQL-backed run (4,026 pass / 0 fail / 10 skipped, plus the 10 skipped files rerun with their own env vars: 440 pass / 0 fail)
  was against the unchanged runtime; these commits change only the audit tool, its tests, test child scripts and docs.
* `build:server`, `build:client` succeed; `tsc --incremental false`: identical error set on main and branch, 0 in new files.
