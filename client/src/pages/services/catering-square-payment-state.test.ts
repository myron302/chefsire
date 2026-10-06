import assert from "node:assert/strict";
import test from "node:test";
import type { CateringPaymentAttemptView } from "@shared/catering-square-payments";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_ATTEMPT_LOOKUP_FAILED_COPY,
  CATERING_ATTEMPT_LOOKUP_MAX_FAILURES,
  CATERING_SQUARE_POLL_MS,
  CateringAttemptLookupError,
  cateringAttemptLookupIsTerminal,
  cateringAttemptPollInterval,
  cateringOpenAttemptFor,
  cateringProviderVisibleAttempts,
  cateringReturnedAttemptId,
  cateringSafeCheckoutUrl,
  cateringSquareDisplay,
  cateringSquarePayAvailable,
  cateringSquareReconciliationCopy,
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
  assert.equal(cateringAttemptPollInterval({ error: lookupError(404), errorUpdateCount: 1 }), false);
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
    assert.equal(cateringAttemptPollInterval({ error: lookupError(status), errorUpdateCount: 1 }), CATERING_SQUARE_POLL_MS, `${status} retried`);
    assert.equal(cateringAttemptPollInterval({ error: lookupError(status), errorUpdateCount: CATERING_ATTEMPT_LOOKUP_MAX_FAILURES }), false, `${status} bounded`);
  }
  assert.equal(cateringAttemptLookupIsTerminal(new Error("no status")), false);
  assert.equal(cateringAttemptLookupIsTerminal(null), false);
});

test("a transient failure does not leave a permanent false terminal state: once data arrives polling follows the attempt again", () => {
  assert.equal(cateringAttemptPollInterval({ error: lookupError(503), errorUpdateCount: 1, data: attempt() }), CATERING_SQUARE_POLL_MS);
});

test("no endless fetching after a deterministic 404: simulate the interval loop and count fetches", () => {
  let fetches = 0;
  let state: Parameters<typeof cateringAttemptPollInterval>[0] = {};
  for (let tick = 0; tick < 50; tick += 1) {
    if (cateringAttemptPollInterval(state) === false) break;
    fetches += 1;
    state = { error: lookupError(404), errorUpdateCount: (state.errorUpdateCount ?? 0) + 1 };
  }
  assert.equal(fetches, 1, "one lookup, then silence");
  let transient = 0;
  state = {};
  for (let tick = 0; tick < 50; tick += 1) {
    if (cateringAttemptPollInterval(state) === false) break;
    transient += 1;
    state = { error: lookupError(503), errorUpdateCount: (state.errorUpdateCount ?? 0) + 1 };
  }
  assert.equal(transient, CATERING_ATTEMPT_LOOKUP_MAX_FAILURES, "and a persistent outage is bounded too");
});

test("the failure copy is safe: it does not say whether the attempt exists and never claims payment", () => {
  assert.equal(/not found|does not exist|unauthori[sz]ed|forbidden|404/i.test(CATERING_ATTEMPT_LOOKUP_FAILED_COPY), false);
  assert.match(CATERING_ATTEMPT_LOOKUP_FAILED_COPY, /Nothing has been marked as paid/);
});

const component = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingSquarePayments.tsx"), "utf8");

test("the component stops polling through the pure interval, retries only transient failures, and renders a dismissible error", () => {
  assert.ok(component.includes("refetchInterval: (polled: { state: { data?: CateringPaymentAttemptView; error?: unknown; errorUpdateCount?: number } }) => cateringAttemptPollInterval(polled.state)"));
  assert.ok(component.includes("retry: (failures: number, error: unknown) => !cateringAttemptLookupIsTerminal(error) && failures < 2"));
  assert.ok(component.includes("throw new CateringAttemptLookupError("));
  assert.ok(component.includes("response.status"), "the HTTP status is what classifies the failure");
  const failedBranch = component.slice(component.indexOf("{failed ? <>"), component.indexOf(": polled ? <>"));
  assert.ok(failedBranch.includes("CATERING_ATTEMPT_LOOKUP_FAILED_COPY") && failedBranch.includes("onClick={dismiss}") && failedBranch.includes('role="alert"'));
});

test("dismissing only hides the banner and consumes the URL hint: no request, no mutation, nothing marked paid, no new attempt", () => {
  const dismiss = component.slice(component.indexOf("const dismiss = () => {"), component.indexOf("const attempts = customer"));
  assert.ok(dismiss.includes("setReturned(null)"));
  assert.ok(dismiss.includes('url.searchParams.delete("squareAttempt")') && dismiss.includes("window.history.replaceState"));
  for (const forbidden of ["fetch(", "mutate(", "mutation", "setQueryData", "invalidateQueries", "start."]) assert.equal(dismiss.includes(forbidden), false, forbidden);
  // with the hint cleared the attempt query is disabled, so it cannot fire again
  assert.ok(component.includes("useAttemptPolling(bookingId, userId, customer ? returned : null, refreshBilling)"));
  assert.ok(component.includes("enabled: attemptId !== null"));
  // and the invoice's own pay control is a separate component, untouched by the banner
  assert.ok(component.includes("export function InvoiceSquarePayment"));
});
