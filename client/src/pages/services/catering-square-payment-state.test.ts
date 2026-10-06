import assert from "node:assert/strict";
import test from "node:test";
import type { CateringPaymentAttemptView } from "@shared/catering-square-payments";
import {
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
