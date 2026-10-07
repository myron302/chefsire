import assert from "node:assert/strict";
import test from "node:test";
import type { CateringBookingPaymentAttempt } from "@shared/schema";
import { serializeCateringPaymentAttempt, visibleCateringPaymentAttempts } from "./catering-booking-payment-attempt";

const row = (overrides: Partial<CateringBookingPaymentAttempt> = {}): CateringBookingPaymentAttempt => ({
  id: "att-1", bookingId: "b-1", invoiceId: "inv-1", customerId: "cust-1", providerId: "prov-1", processor: "square", processorEnvironment: "sandbox",
  merchantId: "MERCHANT_SECRET", locationId: "LOC_SECRET", currency: "USD", amountCents: 40000, idempotencyKey: "chefsire-cat-att-1", state: "pending",
  squarePaymentLinkId: "LINK_SECRET", squareOrderId: "ORDER_SECRET", checkoutUrl: "https://square.link/u/abc", squarePaymentId: null, processorAmountCents: null,
  processorCurrency: null, processorPaymentCount: 0, paymentId: null, reconciliationReason: null, failureCode: "square_refused", lastCheckedAt: null, verifiedAt: null, completedAt: null, closedAt: null,
  createdAt: new Date("2030-01-01T00:00:00Z"), updatedAt: new Date("2030-01-01T00:00:00Z"), ...overrides,
});
const completed = row({ state: "completed", checkoutUrl: "https://square.link/u/abc", squarePaymentId: "PAYMENT_REF", processorAmountCents: 40000, processorCurrency: "USD", processorPaymentCount: 1, paymentId: "ledger-1", completedAt: new Date("2030-01-02T00:00:00Z") });
const reconciled = row({ state: "reconciliation_required", squarePaymentId: "PAYMENT_REF", processorAmountCents: 60000, processorCurrency: "USD", processorPaymentCount: 1, reconciliationReason: "payable_changed" });
const SECRETS = ["MERCHANT_SECRET", "LOC_SECRET", "LINK_SECRET", "ORDER_SECRET", "chefsire-cat-att-1", "idempotency", "square_refused", "cust-1", "prov-1", "merchantId", "locationId"];

test("a customer's pending attempt carries the checkout URL and nothing from Square's internals", () => {
  const view = serializeCateringPaymentAttempt(row(), "customer");
  assert.equal(view.checkoutUrl, "https://square.link/u/abc");
  assert.deepEqual(Object.keys(view).sort(), ["amountCents", "checkoutUrl", "completedAt", "createdAt", "currency", "id", "invoiceId", "state", "updatedAt"]);
  const text = JSON.stringify(view);
  for (const secret of SECRETS) assert.equal(text.includes(secret), false, secret);
});

test("the provider never receives a checkout URL: a provider is not the payer", () => {
  assert.equal(serializeCateringPaymentAttempt(row(), "provider").checkoutUrl, undefined);
});

test("the checkout URL exists only while the attempt is pending", () => {
  for (const state of ["creating", "completed", "failed", "expired", "cancelled", "superseded", "reconciliation_required"] as const) {
    assert.equal(serializeCateringPaymentAttempt(row({ state, checkoutUrl: "https://square.link/u/abc" }), "customer").checkoutUrl, undefined, state);
  }
});

test("a completed attempt names its ledger payment to both; only the provider is given the Square payment reference", () => {
  const customer = serializeCateringPaymentAttempt(completed, "customer");
  const provider = serializeCateringPaymentAttempt(completed, "provider");
  assert.equal(customer.paymentId, "ledger-1");
  assert.equal(provider.paymentId, "ledger-1");
  assert.equal(customer.squarePaymentId, undefined);
  assert.equal(provider.squarePaymentId, "PAYMENT_REF");
  assert.equal(JSON.stringify(customer).includes("PAYMENT_REF"), false);
});

test("a reconciliation shows what actually moved and why, with the Square reference for the provider alone", () => {
  const customer = serializeCateringPaymentAttempt(reconciled, "customer");
  const provider = serializeCateringPaymentAttempt(reconciled, "provider");
  for (const view of [customer, provider]) {
    assert.equal(view.state, "reconciliation_required");
    assert.equal(view.processorAmountCents, 60000);
    assert.equal(view.reconciliationReason, "payable_changed");
    assert.equal(view.paymentId, undefined, "it was never credited");
  }
  assert.equal(customer.squarePaymentId, undefined);
  assert.equal(provider.squarePaymentId, "PAYMENT_REF");
});

test("no Square payment reference is shown for a state that is not money that moved", () => {
  for (const state of ["pending", "creating", "failed", "cancelled"] as const) {
    assert.equal(serializeCateringPaymentAttempt(row({ state, squarePaymentId: "PAYMENT_REF" }), "provider").squarePaymentId, undefined, state);
  }
});

test("a customer sees only their own attempts in the billing view; the provider sees every attempt on the booking", () => {
  const rows = [row({ id: "mine" }), row({ id: "theirs", customerId: "cust-2" })];
  assert.deepEqual(visibleCateringPaymentAttempts(rows, "customer", "cust-1").map((entry) => entry.id), ["mine"]);
  assert.deepEqual(visibleCateringPaymentAttempts(rows, "customer", "stranger"), []);
  assert.deepEqual(visibleCateringPaymentAttempts(rows, "provider", "prov-1").map((entry) => entry.id), ["mine", "theirs"]);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The invoice's payable figure, which is what a Square checkout would be for
 * ------------------------------------------------------------------------------------------------------------- */

import type { CateringBookingInvoice } from "@shared/schema";
import { cateringBillingFacts } from "../services/catering-booking-billing-policy";
import { serializeCateringInvoice } from "./catering-booking-billing";

const invoiceRow = (overrides: Partial<CateringBookingInvoice> = {}): CateringBookingInvoice => ({
  id: "inv-1", bookingId: "b-1", invoiceNumber: 1, invoiceKind: "deposit", amountCents: 40000, currency: "USD", status: "issued", dueOn: null,
  issuedAt: new Date("2030-01-01T00:00:00Z"), voidedAt: null, voidReason: null, createdBy: "prov-1", voidedBy: null,
  createdAt: new Date("2030-01-01T00:00:00Z"), updatedAt: new Date("2030-01-01T00:00:00Z"), ...overrides,
});

test("every invoice view carries the server-derived payable, and it follows the ledger rather than the face amount", () => {
  const rows = [invoiceRow(), invoiceRow({ id: "inv-2", invoiceNumber: 2, invoiceKind: "balance", amountCents: 60000 })];
  const adjustment = { id: "adj-1", bookingId: "b-1", entryKind: "credit", source: "provider_recorded", status: "posted", amountCents: 30000, currency: "USD", reason: "x", reference: null, paymentId: null, amendmentId: null, idempotencyKey: "k", recordedBy: "prov-1", reversedAt: null, reversedBy: null, reversalReason: null, createdAt: new Date("2030-01-01T00:00:00Z") };
  const facts = cateringBillingFacts({ booking: { status: "confirmed", agreedPrice: "1000.00", currency: "USD" }, terms: undefined, invoices: rows, payments: [], adjustments: [adjustment as never], asOfDate: "2030-02-01" });
  for (const role of ["customer", "provider"] as const) {
    assert.deepEqual(rows.map((entry) => serializeCateringInvoice(entry, facts, role).payableCents), [40000, 30000], role);
  }
  const voided = serializeCateringInvoice(invoiceRow({ status: "void", voidedAt: new Date(), voidedBy: "prov-1" }), facts, "customer");
  assert.equal(voided.payableCents, 0, "nothing is payable on a withdrawn request");
});

test("a multiple-payments reconciliation lists EVERY Square payment; the provider sees each id, the customer sees none, and no single reference is invented", () => {
  const evidence = [
    { id: "e1", attemptId: "att-1", squarePaymentId: "PAY_ONE", amountCents: 40000, tipCents: 0, currency: "USD", squareCreatedAt: new Date("2030-05-01T10:00:00Z"), squareUpdatedAt: new Date("2030-05-01T10:00:00Z"), completedAt: new Date("2030-05-01T10:00:00Z"), createdAt: new Date() },
    { id: "e2", attemptId: "att-1", squarePaymentId: "PAY_TWO", amountCents: 15000, tipCents: 0, currency: "USD", squareCreatedAt: null, squareUpdatedAt: null, completedAt: null, createdAt: new Date() },
  ];
  const multi = { ...row({ state: "reconciliation_required", reconciliationReason: "multiple_payments", processorPaymentCount: 2, processorAmountCents: 55000, processorCurrency: "USD", squarePaymentId: null }), processorPayments: evidence };
  const provider = serializeCateringPaymentAttempt(multi, "provider");
  const customer = serializeCateringPaymentAttempt(multi, "customer");
  assert.equal(provider.squarePaymentId, undefined);
  assert.equal(provider.processorPaymentCount, 2);
  assert.deepEqual(provider.processorPayments, [
    { amountCents: 40000, tipCents: 0, currency: "USD", completedAt: "2030-05-01T10:00:00.000Z", squarePaymentId: "PAY_ONE" },
    { amountCents: 15000, tipCents: 0, currency: "USD", completedAt: null, squarePaymentId: "PAY_TWO" },
  ]);
  assert.deepEqual(customer.processorPayments?.map((payment) => payment.amountCents), [40000, 15000]);
  const text = JSON.stringify(customer);
  assert.equal(text.includes("PAY_ONE") || text.includes("PAY_TWO"), false);
});

/* Codex repair pass 6: processor currency, and which Square payment backs the Catering ledger payment */
const evidence = (id: string, amountCents: number, currency: string, completedAt = "2030-05-01T10:00:00Z") =>
  ({ id: `ev-${id}`, attemptId: "att-1", squarePaymentId: id, amountCents, tipCents: 0, currency, squareCreatedAt: new Date(completedAt), squareUpdatedAt: new Date(completedAt), completedAt: new Date(completedAt), createdAt: new Date(completedAt) });

test("processor money carries the currency Square reported, never the invoice's", () => {
  const view = serializeCateringPaymentAttempt({ ...reconciled, reconciliationReason: "currency_mismatch", processorAmountCents: 10000, processorCurrency: "EUR", currency: "USD", processorPayments: [evidence("PAY_EUR", 10000, "EUR")] }, "provider");
  assert.equal(view.currency, "USD");
  assert.equal(view.processorCurrency, "EUR");
  assert.deepEqual(view.processorPayments?.map((payment) => [payment.amountCents, payment.currency]), [[10000, "EUR"]]);
  const customer = serializeCateringPaymentAttempt({ ...reconciled, processorAmountCents: 10000, processorCurrency: "EUR", processorPayments: [evidence("PAY_EUR", 10000, "EUR")] }, "customer");
  assert.equal(customer.processorCurrency, "EUR");
  assert.equal(JSON.stringify(customer).includes("PAY_EUR"), false, "a customer is still not given the Square id");
  // mixed currencies: there is no single processor currency to report
  const mixed = serializeCateringPaymentAttempt({ ...reconciled, processorAmountCents: null, processorCurrency: null, processorPaymentCount: 2, processorPayments: [evidence("A", 100, "EUR"), evidence("B", 50, "USD")] }, "provider");
  assert.equal(mixed.processorCurrency, undefined);
  assert.equal(mixed.processorAmountCents, undefined);
});

test("the ledger-backed Square payment is the one whose id is STORED on the ledger payment, never one that merely has the same amount", () => {
  const base = { ...reconciled, squarePaymentId: null, paymentId: "ledger-1", processorPaymentCount: 3, reconciliationReason: "multiple_payments" as const };
  const payments = [evidence("P1", 40000, "USD", "2030-05-01T10:00:00Z"), evidence("P2", 40000, "USD", "2030-05-01T11:00:00Z"), evidence("P3", 700, "USD", "2030-05-01T12:00:00Z")];
  const provider = serializeCateringPaymentAttempt({ ...base, processorPayments: payments, creditedSquarePaymentId: "P1" }, "provider");
  assert.equal(provider.ledgerCredited, true);
  assert.deepEqual(provider.processorPayments?.map((payment) => [payment.squarePaymentId, payment.creditedToLedger === true]), [["P1", true], ["P2", false], ["P3", false]], "P2 has P1's amount and is still NOT the credited one");
  // no stored ledger processor id: nothing is marked, whatever the amounts
  const unknown = serializeCateringPaymentAttempt({ ...base, processorPayments: payments, creditedSquarePaymentId: null }, "provider");
  assert.equal(unknown.processorPayments?.some((payment) => payment.creditedToLedger), false);
  // never marks anything for a customer, and never exposes the flag or ids
  const customer = serializeCateringPaymentAttempt({ ...base, processorPayments: payments, creditedSquarePaymentId: "P1" }, "customer");
  const text = JSON.stringify(customer);
  assert.equal(/creditedToLedger|ledgerCredited|"P1"|"P2"|creditedSquarePaymentId/.test(text), false);
});

test("no payment from the attempt was credited: not ledgerCredited, no evidence row is marked", () => {
  const view = serializeCateringPaymentAttempt({ ...reconciled, paymentId: null, processorPayments: [evidence("ONLY", 60000, "USD")], creditedSquarePaymentId: null }, "provider");
  assert.equal(view.ledgerCredited, undefined);
  assert.equal(view.processorPayments?.[0].creditedToLedger, undefined);
});
