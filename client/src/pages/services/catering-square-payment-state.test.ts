import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_SQUARE_CHECKOUT_MAX_AGE_MS, cateringCheckoutPastExpiry, CATERING_ATTEMPT_VERIFICATION_UNAVAILABLE_MESSAGE, CATERING_SQUARE_COPY, CATERING_SQUARE_NOTIFICATIONS, CATERING_SQUARE_RECONCILIATION_COPY, CATERING_RECONCILIATION_REASONS, type CateringPaymentAttemptView } from "@shared/catering-square-payments";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_ATTEMPT_LOOKUP_FAILED_COPY,
  CATERING_ATTEMPT_LOOKUP_UNREACHABLE_COPY,
  cateringAttemptLookupStatus,
  cateringAttemptPollIdentity,
  createConsecutiveFailureCounter,
  CATERING_ATTEMPT_LOOKUP_MAX_FAILURES,
  CATERING_SQUARE_POLL_MS,
  CateringAttemptLookupError,
  cateringAttemptLookupIsTerminal,
  cateringAttemptPollInterval,
  cateringCheckoutIdentity,
  cateringCheckoutRedirectTarget,
  createCheckoutRetryScheduler,
  cateringOpenAttemptFor,
  cateringProviderVisibleAttempts,
  cateringReturnedAttemptId,
  cateringSafeCheckoutUrl,
  cateringSquareDisplay,
  cateringSquarePayAvailable,
  cateringSquareReconciliationCopy,
  cateringInvoicePaymentInReview,
  cateringLookupCountsAsSuccess,
  cateringLookupIsVerificationUnavailable,
} from "./catering-square-payment-state";

const attempt = (overrides: Partial<CateringPaymentAttemptView> = {}): CateringPaymentAttemptView => ({
  id: "att-1", invoiceId: "inv-1", state: "pending", amountCents: 40000, currency: "USD", createdAt: "2030-01-01T00:00:00.000Z", updatedAt: "2030-01-01T00:00:00.000Z", completedAt: null, ...overrides,
});
const invoice = { id: "inv-1", status: "issued" as const, payableCents: 40000, currency: "USD" };
const billing = (overrides: Record<string, unknown> = {}) => ({ bookingStatus: "confirmed" as const, squareCheckout: { enabled: true }, paymentAttempts: [] as CateringPaymentAttemptView[], ...overrides });

test("Pay is offered to the customer only: enabled deployment, live booking, a live invoice with something payable, and no open checkout", () => {
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing(), invoice }), true);
  assert.equal(cateringSquarePayAvailable({ role: "provider", billing: billing(), invoice }), false);
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing({ squareCheckout: { enabled: false } }), invoice }), false);
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing({ bookingStatus: "cancelled" }), invoice }), false);
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing(), invoice: { ...invoice, status: "void" as never } }), false);
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing(), invoice: { ...invoice, payableCents: 0 } }), false);
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing(), invoice: { ...invoice, currency: "EUR" } }), false);
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing({ paymentAttempts: [attempt()] }), invoice }), false, "the open checkout is shown instead");
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing({ paymentAttempts: [attempt({ state: "cancelled" })] }), invoice }), true, "a closed one does not block a new one");
});

test("the open attempt is the one that is creating or pending, for that invoice only", () => {
  const attempts = [attempt({ id: "a", state: "cancelled" }), attempt({ id: "b", invoiceId: "inv-2" }), attempt({ id: "c", state: "creating" })];
  assert.equal(cateringOpenAttemptFor(attempts, "inv-1")?.id, "c");
  assert.equal(cateringOpenAttemptFor(attempts, "inv-3"), undefined);
});

test("each state has one honest phase; confirmed means completed and nothing else", () => {
  const phase = (state: CateringPaymentAttemptView["state"], role: "provider" | "customer" = "customer") => cateringSquareDisplay(attempt({ state, checkoutUrl: "https://square.link/u/x" }), role).phase;
  assert.equal(phase("creating"), "creating");
  assert.equal(phase("pending"), "awaiting");
  assert.equal(phase("completed"), "confirmed");
  assert.equal(phase("reconciliation_required"), "reconciliation");
  assert.equal(phase("failed"), "failed");
  for (const closed of ["expired", "cancelled", "superseded"] as const) assert.equal(phase(closed), "closed");
  for (const state of ["creating", "pending", "failed", "expired", "cancelled", "superseded", "reconciliation_required"] as const) assert.notEqual(phase(state), "confirmed", state);
});

test("polling is for a pending checkout only, and only a customer is offered the checkout link", () => {
  assert.equal(cateringSquareDisplay(attempt(), "customer").polling, true);
  assert.equal(cateringSquareDisplay(attempt({ state: "completed" }), "customer").polling, false);
  assert.equal(cateringSquareDisplay(attempt({ checkoutUrl: "https://square.link/u/x" }), "customer").canContinue, true);
  assert.equal(cateringSquareDisplay(attempt({ checkoutUrl: "https://square.link/u/x" }), "provider").canContinue, false);
  assert.equal(cateringSquareDisplay(attempt(), "customer").canContinue, false, "no URL, no link");
});

test("reconciliation wording differs by audience and never promises an automatic refund or says ChefSire holds the money", () => {
  for (const reason of ["payable_changed", "invoice_not_payable", "booking_cancelled", "amount_mismatch", "currency_mismatch", "multiple_payments"] as const) {
    for (const role of ["customer", "provider"] as const) {
      const copy = cateringSquareReconciliationCopy(reason, role)!;
      assert.ok(copy.length > 20, `${reason}/${role}`);
      assert.equal(/refund(ed)? automatically|chefsire (holds|has your)/i.test(copy), false, copy);
    }
  }
  assert.equal(cateringSquareReconciliationCopy(undefined, "customer"), null);
});

test("the provider's panel hides superseded checkouts and keeps every one that holds money or evidence", () => {
  const visible = cateringProviderVisibleAttempts([attempt({ id: "1", state: "superseded" }), attempt({ id: "2", state: "completed" }), attempt({ id: "3", state: "reconciliation_required" })]);
  assert.deepEqual(visible.map((row) => row.id), ["2", "3"]);
});

test("a return from Square names only an attempt id, and anything else in the URL is ignored", () => {
  assert.equal(cateringReturnedAttemptId("?squareAttempt=3f2c1e9a-1111-4222-8333-444455556666"), "3f2c1e9a-1111-4222-8333-444455556666");
  assert.equal(cateringReturnedAttemptId("?squareAttempt=../../x"), null);
  assert.equal(cateringReturnedAttemptId("?squareAttempt=" + "a".repeat(65)), null);
  assert.equal(cateringReturnedAttemptId("?status=paid&amount=1"), null, "a success claim in the URL is not read at all");
  assert.equal(cateringReturnedAttemptId(""), null);
});

test("the browser is only ever sent to an https Square host", () => {
  for (const ok of ["https://square.link/u/abc", "https://sandbox.square.link/u/abc", "https://connect.squareupsandbox.com/v2/checkout?x=1", "https://checkout.square.site/pay/abc"]) assert.ok(cateringSafeCheckoutUrl(ok), ok);
  for (const bad of ["http://square.link/u/abc", "https://evil.example/square.link", "https://square.link.evil.example/u", "javascript:alert(1)", "not a url", ""]) assert.equal(cateringSafeCheckoutUrl(bad), null, bad);
  assert.equal(cateringSafeCheckoutUrl(undefined), null);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Codex repair pass 1: a failed attempt lookup must never poll forever
 * ------------------------------------------------------------------------------------------------------------- */

const lookupError = (status: number | null) => new CateringAttemptLookupError("x", status);

test("a pending or creating attempt keeps being polled", () => {
  assert.equal(cateringAttemptPollInterval({ data: attempt() }), CATERING_SQUARE_POLL_MS);
  assert.equal(cateringAttemptPollInterval({ data: attempt({ state: "creating" }) }), CATERING_SQUARE_POLL_MS);
});

test("a completed or other terminal attempt stops polling", () => {
  for (const state of ["completed", "reconciliation_required", "failed", "expired", "cancelled", "superseded"] as const) {
    assert.equal(cateringAttemptPollInterval({ data: attempt({ state }) }), false, state);
  }
});

test("with no data yet it polls, but only until something has gone wrong", () => {
  assert.equal(cateringAttemptPollInterval({}), CATERING_SQUARE_POLL_MS);
});

test("a 404 (unknown, stale or someone else's attempt, which look identical) stops polling at once, even with no data", () => {
  assert.equal(cateringAttemptPollInterval({ error: lookupError(404) }), false);
  assert.equal(cateringAttemptPollInterval({ error: lookupError(404), consecutiveFailures: 1 }), false);
});

test("every deterministic 4xx stops polling: unauthorized, forbidden, malformed", () => {
  for (const status of [400, 401, 403, 404, 410, 422]) {
    assert.equal(cateringAttemptLookupIsTerminal(lookupError(status)), true, String(status));
    assert.equal(cateringAttemptPollInterval({ error: lookupError(status) }), false, String(status));
  }
});

test("transient failures (network, 5xx, 408, 429) are not terminal, and are retried only a bounded number of times", () => {
  for (const status of [null, 500, 502, 503, 408, 429]) {
    assert.equal(cateringAttemptLookupIsTerminal(lookupError(status)), false, String(status));
    assert.equal(cateringAttemptPollInterval({ error: lookupError(status), consecutiveFailures: 1 }), CATERING_SQUARE_POLL_MS, `${status} retried`);
    assert.equal(cateringAttemptPollInterval({ error: lookupError(status), consecutiveFailures: CATERING_ATTEMPT_LOOKUP_MAX_FAILURES }), false, `${status} bounded`);
  }
  assert.equal(cateringAttemptLookupIsTerminal(new Error("no status")), false);
  assert.equal(cateringAttemptLookupIsTerminal(null), false);
});

test("a transient failure does not leave a permanent false terminal state: once data arrives polling follows the attempt again", () => {
  assert.equal(cateringAttemptPollInterval({ error: lookupError(503), consecutiveFailures: 1, data: attempt() }), CATERING_SQUARE_POLL_MS);
});

test("no endless fetching after a deterministic 404: simulate the interval loop and count fetches", () => {
  let fetches = 0;
  let state: Parameters<typeof cateringAttemptPollInterval>[0] = {};
  for (let tick = 0; tick < 50; tick += 1) {
    if (cateringAttemptPollInterval(state) === false) break;
    fetches += 1;
    state = { error: lookupError(404), consecutiveFailures: (state.consecutiveFailures ?? 0) + 1 };
  }
  assert.equal(fetches, 1, "one lookup, then silence");
  let transient = 0;
  state = {};
  for (let tick = 0; tick < 50; tick += 1) {
    if (cateringAttemptPollInterval(state) === false) break;
    transient += 1;
    state = { error: lookupError(503), consecutiveFailures: (state.consecutiveFailures ?? 0) + 1 };
  }
  assert.equal(transient, CATERING_ATTEMPT_LOOKUP_MAX_FAILURES, "and a persistent outage is bounded too");
});

test("the failure copy is safe: it does not say whether the attempt exists and never claims payment", () => {
  assert.equal(/not found|does not exist|unauthori[sz]ed|forbidden|404/i.test(CATERING_ATTEMPT_LOOKUP_FAILED_COPY), false);
  assert.match(CATERING_ATTEMPT_LOOKUP_FAILED_COPY, /Nothing has been marked as paid/);
});

const component = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingSquarePayments.tsx"), "utf8");

test("the component stops polling through the pure interval, retries only transient failures, and renders a dismissible error", () => {
  assert.ok(component.includes("cateringAttemptPollInterval({ data: polled.state.data, error: polled.state.error, consecutiveFailures: counter.count() })"));
  assert.ok(component.includes("retry: false"), "the poll interval is the retry, bounded by the consecutive-failure cutoff");
  assert.equal(component.includes("errorUpdateCount"), false, "the cumulative counter is never consulted");
  assert.ok(component.includes("throw new CateringAttemptLookupError("));
  assert.ok(component.includes("response.status"), "the HTTP status is what classifies the failure");
  const failedBranch = component.slice(component.indexOf("{failed ? <>"), component.indexOf(": polled ? <>"));
  assert.ok(failedBranch.includes("CATERING_ATTEMPT_LOOKUP_FAILED_COPY") && failedBranch.includes("onClick={dismiss}") && failedBranch.includes('role="alert"'));
});

test("dismissing only hides the banner and consumes the URL hint: no request, no mutation, nothing marked paid, no new attempt", () => {
  const dismiss = component.slice(component.indexOf("const dismiss = () => {"), component.indexOf("const attempts = customer"));
  assert.ok(dismiss.includes("setDismissedIdentity(cateringReturnedAttemptIdentity(userId, bookingId, returned))"), "the dismissal names the exact viewer + booking + attempt");
  assert.ok(dismiss.includes('url.searchParams.delete("squareAttempt")') && dismiss.includes("window.history.replaceState"));
  for (const forbidden of ["fetch(", "mutate(", "mutation", "setQueryData", "invalidateQueries", "start."]) assert.equal(dismiss.includes(forbidden), false, forbidden);
  // with the hint cleared the attempt query is disabled, so it cannot fire again
  assert.ok(component.includes("useAttemptPolling(bookingId, userId, customer ? returned : null, refreshBilling)"));
  assert.ok(component.includes("enabled: attemptId !== null"));
  // and the invoice's own pay control is a separate component, untouched by the banner
  assert.ok(component.includes("export function InvoiceSquarePayment"));
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Codex repair pass 3: the uncertain-checkout retry cannot outlive the checkout it belongs to
 * ------------------------------------------------------------------------------------------------------------- */

/** A controllable clock: timers fire only when the test says so, so "before it fires" and "after it fires" are exact. */
function fakeTimers() {
  let next = 1;
  const pending = new Map<number, () => void>();
  return {
    timers: { setTimeout: (run: () => void) => { const id = next++; pending.set(id, run); return id; }, clearTimeout: (handle: unknown) => { pending.delete(handle as number); } },
    fireAll() { for (const [id, run] of [...pending]) { pending.delete(id); run(); } },
    count: () => pending.size,
  };
}
const identityA = cateringCheckoutIdentity("user-1", "booking-1", "invoice-1");
const identityOtherInvoice = cateringCheckoutIdentity("user-1", "booking-1", "invoice-2");
const identityOtherBooking = cateringCheckoutIdentity("user-1", "booking-2", "invoice-1");

test("the current checkout's legitimate retry still fires exactly once", () => {
  const clock = fakeTimers();
  const scheduler = createCheckoutRetryScheduler(clock.timers);
  scheduler.setIdentity(identityA);
  let posts = 0;
  assert.equal(scheduler.schedule(identityA, () => { posts += 1; }, 2000), true);
  assert.equal(scheduler.pending(), true);
  clock.fireAll();
  assert.equal(posts, 1);
  assert.equal(scheduler.pending(), false);
  clock.fireAll();
  assert.equal(posts, 1, "one timer, one retry");
});

test("unmounting before the retry fires cancels it: the handle is cleared and nothing posts", () => {
  const clock = fakeTimers();
  const scheduler = createCheckoutRetryScheduler(clock.timers);
  scheduler.setIdentity(identityA);
  let posts = 0;
  scheduler.schedule(identityA, () => { posts += 1; }, 2000);
  scheduler.dispose();
  assert.equal(clock.count(), 0, "the timer itself was cleared, not merely ignored");
  clock.fireAll();
  assert.equal(posts, 0);
  assert.equal(scheduler.isCurrent(identityA), false);
  assert.equal(scheduler.schedule(identityA, () => { posts += 1; }, 1), false, "and nothing can be scheduled after unmount");
});

test("switching to another invoice before the retry fires cancels the old retry", () => {
  const clock = fakeTimers();
  const scheduler = createCheckoutRetryScheduler(clock.timers);
  scheduler.setIdentity(identityA);
  let posts: string[] = [];
  scheduler.schedule(identityA, () => posts.push("old invoice"), 2000);
  scheduler.setIdentity(identityOtherInvoice);
  assert.equal(clock.count(), 0);
  clock.fireAll();
  assert.deepEqual(posts, []);
  // the new invoice's own retry works
  scheduler.schedule(identityOtherInvoice, () => posts.push("new invoice"), 2000);
  clock.fireAll();
  assert.deepEqual(posts, ["new invoice"]);
});

test("switching to another booking before the retry fires cancels the old retry", () => {
  const clock = fakeTimers();
  const scheduler = createCheckoutRetryScheduler(clock.timers);
  scheduler.setIdentity(identityA);
  const posts: string[] = [];
  scheduler.schedule(identityA, () => posts.push("old booking"), 2000);
  scheduler.setIdentity(identityOtherBooking);
  clock.fireAll();
  assert.deepEqual(posts, []);
});

test("even a timer that fires anyway re-checks its identity first: a stale callback cannot run", () => {
  // A timer implementation that cannot be cleared (the worst case) must still not run a stale retry.
  const stuck: (() => void)[] = [];
  const scheduler = createCheckoutRetryScheduler({ setTimeout: (run) => { stuck.push(run); return stuck.length; }, clearTimeout: () => undefined });
  scheduler.setIdentity(identityA);
  let posts = 0;
  scheduler.schedule(identityA, () => { posts += 1; }, 2000);
  scheduler.setIdentity(identityOtherInvoice);
  for (const run of stuck) run();
  assert.equal(posts, 0);
});

test("a retry for an identity that is not on screen is refused outright, and scheduling replaces rather than stacks", () => {
  const clock = fakeTimers();
  const scheduler = createCheckoutRetryScheduler(clock.timers);
  scheduler.setIdentity(identityA);
  assert.equal(scheduler.schedule(identityOtherInvoice, () => undefined, 1), false);
  assert.equal(clock.count(), 0);
  let posts = 0;
  scheduler.schedule(identityA, () => { posts += 1; }, 1);
  scheduler.schedule(identityA, () => { posts += 1; }, 1);
  assert.equal(clock.count(), 1, "never two retries pending for one checkout");
  clock.fireAll();
  assert.equal(posts, 1, "so a retry cannot become a second checkout request");
});

test("a stale callback cannot redirect to an old checkout: the target exists only for the identity still on screen, a pending attempt and a Square URL", () => {
  const scheduler = createCheckoutRetryScheduler(fakeTimers().timers);
  scheduler.setIdentity(identityA);
  const attemptFor = { state: "pending", checkoutUrl: "https://square.link/u/old" };
  const isCurrent = (identity: string) => scheduler.isCurrent(identity);
  assert.equal(cateringCheckoutRedirectTarget({ startedFor: identityA, isCurrent, attempt: attemptFor }), "https://square.link/u/old", "the legitimate redirect");
  scheduler.setIdentity(identityOtherInvoice);
  assert.equal(cateringCheckoutRedirectTarget({ startedFor: identityA, isCurrent, attempt: attemptFor }), null, "the customer left that invoice");
  scheduler.dispose();
  assert.equal(cateringCheckoutRedirectTarget({ startedFor: identityOtherInvoice, isCurrent, attempt: attemptFor }), null, "or left the page");
  scheduler.setIdentity(identityA);
  assert.equal(cateringCheckoutRedirectTarget({ startedFor: identityA, isCurrent, attempt: { state: "creating" } }), null);
  assert.equal(cateringCheckoutRedirectTarget({ startedFor: identityA, isCurrent, attempt: { state: "pending", checkoutUrl: "https://evil.example/x" } }), null);
  assert.equal(cateringCheckoutRedirectTarget({ startedFor: identityA, isCurrent, attempt: undefined }), null);
});

test("the component wires it all: the timer is the scheduler's, unmount and identity changes dispose it, and every callback is identity-guarded", () => {
  assert.equal(/setTimeout\(/.test(component), false, "no raw timer in the component");
  assert.ok(component.includes("retryScheduler.setIdentity(identity)") && component.includes("return () => retryScheduler.dispose();"));
  assert.ok(component.includes("[identity, retryScheduler]"), "the effect re-runs, and so cleans up, whenever the viewer, booking or invoice changes");
  assert.ok(component.includes("retryScheduler.schedule(request.identity, () => start.mutate(request), CATERING_SQUARE_CREATE_RETRY_MS)"), "the retry re-sends the request it was scheduled for, never the screen's current invoice");
  const onSuccess = component.slice(component.indexOf("onSuccess: async (body, request)"), component.indexOf("onError: async (error: Error, request)"));
  assert.ok(onSuccess.indexOf("if (!retryScheduler.isCurrent(request.identity)) return;") < onSuccess.indexOf("window.location.assign"), "the identity check precedes any redirect");
  assert.ok(onSuccess.indexOf("if (!retryScheduler.isCurrent(request.identity)) return;") < onSuccess.indexOf("retryScheduler.schedule"), "and any further retry");
  assert.ok(onSuccess.includes("cateringCheckoutRedirectTarget("));
  const onError = component.slice(component.indexOf("onError: async (error: Error, request)"), component.indexOf("const pressPay"));
  assert.ok(onError.indexOf("isCurrent(request.identity)") < onError.indexOf("setMessage"), "a stale failure cannot write a message either");
  assert.ok(component.includes("cateringInvoicePayPath(request.bookingId, request.invoiceId)"), "the request names the booking and invoice it was started for");
  assert.ok(component.includes("const MAX") === false && component.includes("retries.current < CATERING_SQUARE_CREATE_RETRIES"), "the retry count stays bounded");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Codex repair pass 4: CONSECUTIVE failures, reset by a success
 * ------------------------------------------------------------------------------------------------------------- */

/** Runs a sequence of fetch outcomes through the same counter + interval logic the hook uses, returning each decision. */
function simulate(outcomes: ("ok" | "fail" | 404)[], counter = createConsecutiveFailureCounter()) {
  const decisions: (number | false)[] = [];
  let data: ReturnType<typeof attempt> | undefined;
  let error: unknown;
  for (const outcome of outcomes) {
    if (outcome === "ok") { counter.succeeded(); data = attempt(); error = undefined; }
    else { counter.failed(); error = lookupError(outcome === 404 ? 404 : 503); }
    decisions.push(cateringAttemptPollInterval({ data, error, consecutiveFailures: counter.count() }));
  }
  return { decisions, counter, data, error };
}

test("three CONSECUTIVE failures reach the cutoff", () => {
  const { decisions } = simulate(["fail", "fail", "fail"]);
  assert.deepEqual(decisions, [CATERING_SQUARE_POLL_MS, CATERING_SQUARE_POLL_MS, false]);
});

test("failure, success, failure is NOT two consecutive failures", () => {
  const { decisions, counter } = simulate(["fail", "ok", "fail"]);
  assert.equal(counter.count(), 1);
  assert.deepEqual(decisions, [CATERING_SQUARE_POLL_MS, CATERING_SQUARE_POLL_MS, CATERING_SQUARE_POLL_MS]);
});

test("many separated transient failure episodes never disable polling: the old cumulative count would have", () => {
  const counter = createConsecutiveFailureCounter();
  const episodes = Array.from({ length: 10 }, () => ["fail", "ok"] as const).flat();
  const { decisions } = simulate([...episodes, "fail"], counter);
  assert.equal(decisions.every((decision) => decision === CATERING_SQUARE_POLL_MS), true, "ten failures in total, never three in a row");
  assert.equal(counter.count(), 1);
  assert.equal(cateringAttemptLookupStatus({ error: lookupError(503), consecutiveFailures: counter.count() }), null, "and no error state is shown");
});

test("a successful fetch resets the consecutive failure count to zero", () => {
  const counter = createConsecutiveFailureCounter();
  counter.failed(); counter.failed();
  assert.equal(counter.count(), 2);
  counter.succeeded();
  assert.equal(counter.count(), 0);
  assert.equal(counter.failed(), 1);
});

test("a terminal lookup error still stops polling immediately, whatever the count", () => {
  assert.equal(simulate([404]).decisions[0], false);
  assert.equal(simulate(["ok", 404]).decisions[1], false);
  assert.equal(cateringAttemptLookupStatus({ error: lookupError(404), consecutiveFailures: 0 }), "terminal");
});

test("reaching the threshold is a truthful recoverable state, not an endless 'Checking your payment'", () => {
  assert.equal(cateringAttemptLookupStatus({ error: lookupError(503), consecutiveFailures: CATERING_ATTEMPT_LOOKUP_MAX_FAILURES }), "exhausted");
  assert.equal(cateringAttemptLookupStatus({ error: lookupError(503), consecutiveFailures: CATERING_ATTEMPT_LOOKUP_MAX_FAILURES - 1 }), null);
  // even with a cached earlier success, the exhausted state is what is reported
  const { data, error, counter } = simulate(["ok", "fail", "fail", "fail"]);
  assert.ok(data);
  assert.equal(cateringAttemptLookupStatus({ error, consecutiveFailures: counter.count() }), "exhausted");
  assert.match(CATERING_ATTEMPT_LOOKUP_UNREACHABLE_COPY, /Retry status check/);
  assert.match(CATERING_ATTEMPT_LOOKUP_UNREACHABLE_COPY, /Nothing has been marked as paid/);
  assert.equal(/not found|does not exist|unauthori[sz]ed|forbidden|404/i.test(CATERING_ATTEMPT_LOOKUP_UNREACHABLE_COPY), false);
  const banner = component.slice(component.indexOf("{failed ? <>"), component.indexOf(": polled ? <>"));
  const exhaustedBranch = banner.slice(banner.indexOf(": exhausted ? <>"));
  assert.ok(exhaustedBranch.includes("CATERING_ATTEMPT_LOOKUP_UNREACHABLE_COPY") && exhaustedBranch.includes("onClick={recheck}") && exhaustedBranch.includes("onClick={dismiss}"), "a recovery action and a dismiss");
});

test("the recheck action resets the lifecycle, then asks again; it never marks anything paid or creates an attempt", () => {
  const recheck = component.slice(component.indexOf("const recheck = () =>"), component.indexOf("return { attempt: query.data"));
  assert.ok(recheck.includes("counter.reset()") && recheck.includes("query.refetch()"));
  for (const forbidden of [/mutate\(/, /\bfetch\(/, /setQueryData/, /start\./]) assert.equal(forbidden.test(recheck), false, String(forbidden));
});

test("a different attempt, invoice, booking or viewer gets a fresh failure lifecycle; an unmount leaves nothing behind", () => {
  const base = cateringAttemptPollIdentity("user-1", "booking-1", "attempt-1");
  for (const other of [cateringAttemptPollIdentity("user-1", "booking-1", "attempt-2"), cateringAttemptPollIdentity("user-1", "booking-2", "attempt-1"), cateringAttemptPollIdentity("user-2", "booking-1", "attempt-1"), cateringAttemptPollIdentity("user-1", "booking-1", null)]) {
    assert.notEqual(other, base);
  }
  // a counter is created per identity, so a new identity cannot inherit the previous one's failures
  assert.ok(component.includes("useMemo(() => createConsecutiveFailureCounter(), [identity])"));
  const first = createConsecutiveFailureCounter();
  first.failed(); first.failed();
  const second = createConsecutiveFailureCounter();
  assert.equal(second.count(), 0);
  assert.equal(first.count(), 2, "and the old one is untouched by the new one");
  // the query key also names the attempt, so TanStack never shares one query between two attempts
  assert.ok(component.includes("queryKey: attemptKey(userId, bookingId, attemptId ?? \"none\")"));
});

/* Codex repair pass 6 */
import { CATERING_SQUARE_COPY } from "@shared/catering-square-payments";
import { cateringSquareEvidenceLabel, cateringSquareHeadline } from "./catering-square-payment-state";
const fmt = (cents: number, currency: string) => `${currency} ${(cents / 100).toFixed(2)}`;
const ev = (id: string, amountCents: number, currency: string, extra: Record<string, unknown> = {}) => ({ squarePaymentId: id, amountCents, tipCents: 0, currency, completedAt: "2030-05-01T10:00:00.000Z", ...extra });

test("headline: an ordinary USD payment is shown in USD", () => {
  assert.equal(cateringSquareHeadline(attempt({ state: "completed", processorAmountCents: 40000, processorCurrency: "USD", processorPayments: [ev("P", 40000, "USD")] }), fmt), "USD 400.00");
  assert.equal(cateringSquareHeadline(attempt(), fmt), "USD 400.00", "before money moved: the amount asked for, in the invoice's currency");
});

test("headline: an invoice in USD that Square took in EUR shows EUR, never USD", () => {
  const view = attempt({ state: "reconciliation_required", currency: "USD", amountCents: 10000, processorAmountCents: 10000, processorCurrency: "EUR", processorPayments: [ev("PAY_EUR", 10000, "EUR")] });
  assert.equal(cateringSquareHeadline(view, fmt), "EUR 100.00");
  // with no evidence rows the amount is still read with ITS currency, and is never relabelled as the invoice's
  assert.equal(cateringSquareHeadline(attempt({ currency: "USD", processorAmountCents: 10000, processorCurrency: "EUR" }), fmt), "EUR 100.00");
  assert.equal(cateringSquareHeadline(attempt({ currency: "USD", processorAmountCents: 10000 }), fmt), CATERING_SQUARE_COPY.reconciliationNeutralHeadline, "an unknown processor currency is not guessed");
});

test("headline: several payments in one currency show the total and the count; mixed currencies are never summed or relabelled", () => {
  assert.equal(cateringSquareHeadline(attempt({ processorAmountCents: 40700, processorCurrency: "USD", processorPayments: [ev("A", 40000, "USD"), ev("B", 700, "USD")] }), fmt), "USD 407.00 across 2 Square payments");
  // same currency but the server has no aggregate (the total cannot be represented): nothing is summed or invented client-side
  const overflow = cateringSquareHeadline(attempt({ processorPayments: [ev("A", 6_000_000_000, "USD"), ev("B", 6_000_000_000, "USD")] }), fmt);
  assert.equal(overflow, CATERING_SQUARE_COPY.reconciliationNeutralHeadline);
  assert.equal(/\$|USD|\d|^0/.test(overflow), false, "not $0, not an unknown total, not the invoice amount");
  const mixed = cateringSquareHeadline(attempt({ currency: "USD", processorPayments: [ev("A", 10000, "EUR"), ev("B", 5000, "USD")] }), fmt);
  assert.equal(mixed, CATERING_SQUARE_COPY.reconciliationNeutralHeadline);
  assert.equal(/EUR|USD|\d/.test(mixed), false);
});

test("provider copy states whether anything was credited, and never says nothing was credited when a payment was", () => {
  const nothing = cateringSquareDisplay({ state: "reconciliation_required" }, "provider").label;
  const partly = cateringSquareDisplay({ state: "reconciliation_required", ledgerCredited: true }, "provider").label;
  assert.match(nothing, /No payment from this checkout was added to the Catering ledger/);
  assert.match(partly, /already credited to the Catering ledger/);
  assert.match(partly, /NOT credited automatically/);
  assert.match(partly, /do not apply the credited payment again/i);
  assert.equal(/No payment from this checkout was added|NOT added to the ledger/i.test(partly), false);
  assert.equal(/already credited/i.test(nothing), false);
  // the customer's copy is unchanged and never asks them to pay again
  const customer = cateringSquareDisplay({ state: "reconciliation_required", ledgerCredited: true }, "customer").label;
  assert.equal(customer, CATERING_SQUARE_COPY.reconciliation);
  assert.match(customer, /do not make another payment/);
});

test("evidence rows: the ledger-backed payment is marked credited; every other is additional; with nothing credited none is", () => {
  assert.equal(cateringSquareEvidenceLabel({ creditedToLedger: true }, true), CATERING_SQUARE_COPY.evidenceCredited);
  assert.equal(cateringSquareEvidenceLabel({}, true), CATERING_SQUARE_COPY.evidenceAdditional);
  assert.equal(cateringSquareEvidenceLabel({}, undefined), CATERING_SQUARE_COPY.evidenceNotCredited);
  assert.notEqual(CATERING_SQUARE_COPY.evidenceCredited, CATERING_SQUARE_COPY.evidenceAdditional);
});

test("the provider panel formats the headline and labels through these helpers, not attempt.currency with processor cents", () => {
  const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../components/catering/BookingSquarePayments.tsx"), "utf8");
  assert.equal(/processorAmountCents \?\? attempt\.amountCents/.test(source), false);
  assert.ok(source.includes("cateringSquareHeadline(attempt, money)") && source.includes("cateringSquareEvidenceLabel(payment, attempt.ledgerCredited)"));
});

/* Codex repair pass 10: the returned Square attempt follows the CURRENT navigation */
import { cateringActiveReturnedAttempt, cateringReturnedAttemptIdentity } from "./catering-square-payment-state";
const A = "aaaaaaaa-1111-4222-8333-444455556666";
const B = "bbbbbbbb-1111-4222-8333-444455556666";
const nav = (search: string, bookingId: string, dismissedIdentity: string | null = null, userId = "user-1") => cateringActiveReturnedAttempt({ search, userId, bookingId, dismissedIdentity });

test("nav: Booking A with squareAttempt=A uses A, and only A", () => {
  assert.equal(nav(`?squareAttempt=${A}`, "booking-A"), A);
  assert.equal(cateringAttemptPollIdentity("user-1", "booking-A", nav(`?squareAttempt=${A}`, "booking-A")), cateringAttemptPollIdentity("user-1", "booking-A", A));
});

test("nav: A + attempt A -> Booking B with NO attempt clears it: nothing is polled or shown for B, and A's poll identity is gone", () => {
  const onA = nav(`?squareAttempt=${A}`, "booking-A");
  const onB = nav("", "booking-B");
  assert.equal(onA, A);
  assert.equal(onB, null, "no stale attempt");
  assert.notEqual(cateringAttemptPollIdentity("user-1", "booking-B", onB), cateringAttemptPollIdentity("user-1", "booking-A", onA), "a different polling identity: its failure counter starts from zero");
});

test("nav: A + attempt A -> Booking B + attempt B adopts B; A is never asked about under B", () => {
  const onB = nav(`?squareAttempt=${B}`, "booking-B");
  assert.equal(onB, B);
  assert.notEqual(cateringAttemptPollIdentity("user-1", "booking-B", onB), cateringAttemptPollIdentity("user-1", "booking-A", A));
  // the attempt can only ever be paired with the CURRENT booking: there is no input that yields A for booking B
  assert.equal(nav(`?squareAttempt=${B}`, "booking-B") === A, false);
});

test("nav: a panel that started with no attempt notices one that appears later (no reload needed)", () => {
  assert.equal(nav("", "booking-B"), null);
  assert.equal(nav(`?squareAttempt=${B}`, "booking-B"), B);
});

test("nav: dismissing A on Booking A does NOT suppress B on Booking B, and does not bring A back", () => {
  const dismissedA = cateringReturnedAttemptIdentity("user-1", "booking-A", A);
  assert.equal(nav(`?squareAttempt=${A}`, "booking-A", dismissedA), null, "A stays dismissed");
  assert.equal(nav(`?squareAttempt=${B}`, "booking-B", dismissedA), B, "B is not suppressed");
  assert.equal(nav("", "booking-B", dismissedA), null, "and nothing stale is shown on a booking with no attempt");
  // the dismissal is for that booking: the SAME attempt id under another booking or viewer is a different identity
  assert.equal(nav(`?squareAttempt=${A}`, "booking-C", dismissedA), A);
  assert.equal(nav(`?squareAttempt=${A}`, "booking-A", dismissedA, "user-2"), A);
});

test("nav: changing the attempt on the SAME booking (A -> B) switches to B, and A's dismissal does not hide B", () => {
  const dismissedA = cateringReturnedAttemptIdentity("user-1", "booking-A", A);
  assert.equal(nav(`?squareAttempt=${A}`, "booking-A"), A);
  assert.equal(nav(`?squareAttempt=${B}`, "booking-A"), B);
  assert.equal(nav(`?squareAttempt=${B}`, "booking-A", dismissedA), B);
});

test("nav: malformed squareAttempt values are rejected exactly as before, whatever the navigation", () => {
  for (const bad of ["?squareAttempt=../../x", "?squareAttempt=", "?squareAttempt=a b", `?squareAttempt=${"x".repeat(65)}`, "?squareAttempt=a%2Fb", "?other=1"]) assert.equal(nav(bad, "booking-A"), null, bad);
});

test("nav: the URL only ever selects what to ASK the server about; the component cannot turn it into a payment or reach another booking", () => {
  const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../components/catering/BookingSquarePayments.tsx"), "utf8");
  // derived from the reactive router search, never captured once at mount, and never from window.location in state initialisation
  assert.ok(source.includes('import { useSearch } from "wouter"') && source.includes("const search = useSearch();"));
  assert.ok(source.includes("cateringActiveReturnedAttempt({ search, userId, bookingId, dismissedIdentity })"));
  assert.equal(/useState<string \| null>\(\(\) => \(typeof window/.test(source), false, "no useState initialiser reading the URL");
  assert.equal(/setReturned/.test(source), false);
  // the lookup is always for the CURRENT booking and attempt, under a key scoped by viewer, booking and attempt
  assert.ok(source.includes('["catering", "square-attempt", userId, bookingId, attemptId]'));
  assert.ok(source.includes("fetch(cateringPaymentAttemptPath(bookingId, attemptId!), { credentials: \"include\" })"));
  assert.ok(source.includes("enabled: attemptId !== null"));
  // no cache-wide deletion, and the client only ever READS an attempt: it never posts a payment or writes a ledger row from the return
  assert.equal(/removeQueries|resetQueries|clear\(\)/.test(source), false);
  const polling = source.slice(source.indexOf("function useAttemptPolling"), source.indexOf("export function SquarePaymentsPanel"));
  assert.equal(/method: "POST"/.test(polling), false);
  assert.ok(source.includes('"confirmed" is\n *    shown only when the server says an attempt is `completed`') || source.includes("shown only when the server says an attempt is `completed`"));
});

/* Post-merge hotfix: an unresolved refund review qualifies "paid" wording for both actors */
test("a completed attempt with an unresolved refund review is never presented as plainly settled", () => {
  assert.equal(cateringSquareDisplay({ state: "completed" }, "customer").label, CATERING_SQUARE_COPY.completed);
  const customer = cateringSquareDisplay({ state: "completed", refundReview: true }, "customer");
  const provider = cateringSquareDisplay({ state: "completed", refundReview: true }, "provider");
  assert.equal(customer.label, CATERING_SQUARE_COPY.completedRefundReviewCustomer);
  assert.match(customer.label, /returned/);
  assert.match(provider.label, /ledger was NOT changed/);
  assert.equal(customer.phase, "confirmed", "the payment itself is still confirmed: only the wording is qualified");
  assert.match(CATERING_SQUARE_COPY.returnReviewNoticeCustomer, /may not be fully settled/);
  assert.match(CATERING_SQUARE_COPY.returnReviewNoticeProvider, /NOT changed/);
});

test("PASS2: an invoice with a reconciliation_required attempt offers no Pay (even with no open checkout); other invoices stay payable; the server stays authoritative", () => {
  const reviewed = attempt({ id: "r", state: "reconciliation_required" });
  assert.equal(cateringInvoicePaymentInReview([reviewed], "inv-1"), true);
  assert.equal(cateringInvoicePaymentInReview([reviewed], "inv-2"), false);
  assert.equal(cateringInvoicePaymentInReview([attempt({ state: "completed" })], "inv-1"), false);
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing({ paymentAttempts: [reviewed] }), invoice }), false);
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing({ paymentAttempts: [reviewed, attempt({ id: "x", state: "cancelled" })] }), invoice }), false);
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing({ paymentAttempts: [reviewed] }), invoice: { ...invoice, id: "inv-2" } }), true);
});

test("PASS2: the component shows payment-review messaging instead of the Pay button, and never tells the customer to pay again", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.join(dir, "../../components/catering/BookingSquarePayments.tsx"), "utf8");
  assert.match(source, /cateringInvoicePaymentInReview/);
  assert.match(source, /CATERING_SQUARE_COPY\.paymentReview/);
  assert.match(CATERING_SQUARE_COPY.paymentReview, /do not make another payment/i);
});

const NO_REPAY_RE = /do not make another payment until the review is complete/i;
const CLAIMS_AMOUNT_CHANGED = /what you owe|amount (you owe|owed|payable)|balance (changed|dropped)|you owe/i;
const CLAIMS_REFUND_ISSUED = /(was|has been|were) (refunded|returned)|refund(ed)? (to you|issued)|we (have )?refunded|money back/i;

test("PASS3: the generic reconciliation wording is reason-neutral: it never claims the amount owed changed or a refund was issued, and says not to pay again", () => {
  for (const text of [CATERING_SQUARE_COPY.reconciliation, CATERING_SQUARE_COPY.paymentReview, CATERING_SQUARE_NOTIFICATIONS.customerReconciliation.message]) {
    assert.equal(CLAIMS_AMOUNT_CHANGED.test(text), false, text);
    assert.equal(CLAIMS_REFUND_ISSUED.test(text), false, text);
    assert.match(text, /needs additional review/i);
    assert.match(text, /caterer has been notified/i);
    assert.match(text, NO_REPAY_RE);
  }
  assert.equal(CATERING_SQUARE_COPY.reconciliation, CATERING_SQUARE_COPY.paymentReview, "one wording across the card, the invoice and the refusal");
  assert.equal(CATERING_SQUARE_NOTIFICATIONS.customerReconciliation.message, CATERING_SQUARE_COPY.reconciliation, "the notification agrees with the banner");
  const provider = CATERING_SQUARE_NOTIFICATIONS.providerReconciliation.message;
  assert.equal(CLAIMS_AMOUNT_CHANGED.test(provider) || CLAIMS_REFUND_ISSUED.test(provider), false);
  assert.match(provider, /not to pay again/i);
});

test("PASS3: every reconciliation reason has accurate customer wording: only payable_changed may speak of what is owed, none claims a refund was issued, all say not to pay again, none leaks internals", () => {
  assert.equal(CATERING_RECONCILIATION_REASONS.length, 8);
  for (const reason of CATERING_RECONCILIATION_REASONS) {
    const text = CATERING_SQUARE_RECONCILIATION_COPY[reason].customer;
    assert.match(text, NO_REPAY_RE, reason);
    assert.equal(CLAIMS_REFUND_ISSUED.test(text), false, reason);
    assert.equal(/\b(PAYMENT_|sq0|token|ledger|idempotency|merchant)\b/i.test(text), false, reason);
    if (reason !== "payable_changed") assert.equal(CLAIMS_AMOUNT_CHANGED.test(text), false, `${reason} must not claim the amount owed changed`);
    assert.equal(cateringSquareReconciliationCopy(reason, "customer"), text);
  }
  for (const reason of ["multiple_payments", "currency_mismatch", "amount_mismatch", "payment_refunded", "payment_timestamp_invalid"] as const) {
    assert.equal(/changed/i.test(CATERING_SQUARE_RECONCILIATION_COPY[reason].customer), false, reason);
  }
  assert.match(CATERING_SQUARE_RECONCILIATION_COPY.payment_refunded.customer, /reports refund activity/i, "a refund is only ever described as something Square reports");
});

test("PASS3: the customer's card label for a reconciliation is the neutral wording for every reason, and ordinary statuses are unchanged", () => {
  for (const reason of CATERING_RECONCILIATION_REASONS) {
    const display = cateringSquareDisplay(attempt({ state: "reconciliation_required", reconciliationReason: reason }), "customer");
    assert.equal(display.label, CATERING_SQUARE_COPY.reconciliation);
    assert.equal(display.canContinue, false);
  }
  assert.equal(cateringSquareDisplay(attempt({ state: "completed" }), "customer").label, CATERING_SQUARE_COPY.completed);
  assert.equal(CATERING_SQUARE_COPY.completed, "Payment confirmed by Square.");
  assert.equal(CATERING_SQUARE_COPY.pending, "Your Square checkout is open. Finish paying there, then come back here.");
});

test("PASS4: a Square-unavailable answer is a counted failure that stops polling after the bound; a throttled answer neither resets nor adds; only a real check resets", () => {
  const unavailable = new CateringAttemptLookupError("x", 503, "catering_square_verification_unavailable");
  assert.equal(cateringLookupIsVerificationUnavailable(unavailable), true);
  assert.equal(cateringLookupIsVerificationUnavailable(new CateringAttemptLookupError("x", 503)), false);
  assert.equal(cateringAttemptLookupIsTerminal(unavailable), false, "retryable, not terminal");
  const counter = createConsecutiveFailureCounter();
  let polls = 0;
  for (let i = 0; i < 20; i += 1) {
    const interval = cateringAttemptPollInterval({ data: attempt(), error: unavailable, consecutiveFailures: counter.count() });
    if (interval === false) break;
    polls += 1;
    counter.failed();
  }
  assert.equal(polls, CATERING_ATTEMPT_LOOKUP_MAX_FAILURES, "polling is bounded");
  assert.equal(cateringAttemptLookupStatus({ error: unavailable, consecutiveFailures: counter.count() }), "exhausted");
  assert.equal(cateringLookupCountsAsSuccess("throttled"), false);
  assert.equal(cateringLookupCountsAsSuccess("unavailable"), false);
  assert.equal(cateringLookupCountsAsSuccess("checked"), true);
  assert.equal(cateringLookupCountsAsSuccess("not_needed"), true);
  // manual retry starts a fresh bounded run, and the same preserved attempt is polled again
  counter.reset();
  assert.equal(cateringAttemptPollInterval({ data: attempt(), error: unavailable, consecutiveFailures: counter.count() }), CATERING_SQUARE_POLL_MS);
});

test("PASS4: the panel offers Retry status check and Dismiss when exhausted, uses Square-unavailable wording that never says nothing was charged, and stops polling on unmount", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.join(dir, "../../components/catering/BookingSquarePayments.tsx"), "utf8");
  assert.match(source, /Retry status check/);
  assert.match(source, /Dismiss/);
  assert.match(source, /CATERING_ATTEMPT_VERIFICATION_UNAVAILABLE_MESSAGE/);
  assert.match(source, /cateringLookupCountsAsSuccess\(body\.verification\)/);
  assert.match(source, /refetchInterval/, "polling is driven by the query's own interval, which TanStack stops on unmount");
  assert.equal(/setInterval\(/.test(source), false, "no hand-rolled timer that could outlive the component");
  assert.equal(/nothing was charged/i.test(CATERING_ATTEMPT_VERIFICATION_UNAVAILABLE_MESSAGE), false);
  assert.match(CATERING_ATTEMPT_VERIFICATION_UNAVAILABLE_MESSAGE, /do not pay again/i);
  assert.match(CATERING_ATTEMPT_VERIFICATION_UNAVAILABLE_MESSAGE, /has not been changed or cancelled/i);
});

test("PASS5: the lifetime boundary is deterministic: pending only, measured from the persisted link time, inclusive at the boundary", () => {
  const start = new Date("2030-01-01T00:00:00Z");
  const row = { state: "pending", squareCreateResolvedAt: start, createdAt: new Date("2020-01-01T00:00:00Z") };
  assert.equal(CATERING_SQUARE_CHECKOUT_MAX_AGE_MS, 180 * 24 * 60 * 60 * 1000);
  assert.equal(cateringCheckoutPastExpiry(row, new Date(start.getTime() + CATERING_SQUARE_CHECKOUT_MAX_AGE_MS - 1)), false);
  assert.equal(cateringCheckoutPastExpiry(row, new Date(start.getTime() + CATERING_SQUARE_CHECKOUT_MAX_AGE_MS)), true);
  assert.equal(cateringCheckoutPastExpiry({ ...row, squareCreateResolvedAt: null, createdAt: start }, new Date(start.getTime() + CATERING_SQUARE_CHECKOUT_MAX_AGE_MS)), true, "falls back to created_at");
  for (const state of ["creating", "completed", "expired", "cancelled", "reconciliation_required"]) assert.equal(cateringCheckoutPastExpiry({ ...row, state }, new Date(start.getTime() + 2 * CATERING_SQUARE_CHECKOUT_MAX_AGE_MS)), false, state);
  assert.equal(cateringCheckoutPastExpiry({ ...row, squareCreateResolvedAt: "garbage", createdAt: "garbage" }, new Date()), false, "an unreadable time never expires anything");
});

test("PASS5: an expired checkout is explained to the customer without claiming nothing was charged, never shows a link, and a new checkout is offered", () => {
  const display = cateringSquareDisplay(attempt({ state: "expired", checkoutUrl: "https://square.link/u/dead" }), "customer");
  assert.equal(display.label, CATERING_SQUARE_COPY.expired);
  assert.equal(display.canContinue, false, "a dead link is never offered");
  assert.equal(display.polling, false);
  assert.match(CATERING_SQUARE_COPY.expired, /expired/i);
  assert.match(CATERING_SQUARE_COPY.expired, /do not pay again/i);
  assert.equal(/nothing was charged/i.test(CATERING_SQUARE_COPY.expired + CATERING_SQUARE_COPY.checkoutVerifying), false);
  assert.match(CATERING_SQUARE_COPY.checkoutVerifying, /do not pay again/i);
  assert.equal(cateringSquarePayAvailable({ role: "customer", billing: billing({ paymentAttempts: [attempt({ state: "expired" })] }), invoice }), true, "a new checkout may be started once the old one is expired");
  const billingRoute = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../../server/routes/catering-booking-billing.ts"), "utf8");
  assert.match(billingRoute, /cateringCheckoutPastExpiry\(row, new Date\(\)\)/, "the customer's billing view does not carry a link past its lifetime");
});
