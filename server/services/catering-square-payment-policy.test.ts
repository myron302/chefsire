import assert from "node:assert/strict";
import test from "node:test";
import type { CateringBillingFacts, CateringInvoiceFact, CateringPaymentFact } from "@shared/catering-booking-billing";
import type { SquareOrderFacts, SquarePaymentFacts } from "../lib/square-checkout";
import {
  cateringAttemptMatches,
  decideCateringSettlement,
  deriveCateringSquareAmount,
  evaluateSquareEvidence,
  squareCompletionTime,
  summarizeConfirmedPayments,
} from "./catering-square-payment-policy";

/** The pure rules of Phase 2Q, exactly as the service runs them. */

const invoice = (overrides: Partial<CateringInvoiceFact> = {}): CateringInvoiceFact => ({
  id: "inv-1", number: 1, kind: "deposit", amountCents: 40000, currency: "USD", status: "issued", dueOn: null, issuedAt: "2030-01-01T00:00:00.000Z", ...overrides,
});
const payment = (overrides: Partial<CateringPaymentFact> = {}): CateringPaymentFact => ({
  id: "pay-1", invoiceId: "inv-1", amountCents: 10000, currency: "USD", method: "cash", source: "provider_recorded", status: "recorded", receivedOn: "2030-01-02", ...overrides,
});
const facts = (overrides: Partial<CateringBillingFacts> = {}): CateringBillingFacts => ({
  bookingStatus: "confirmed", agreedTotalCents: 100000, currency: "USD",
  terms: { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null },
  invoices: [invoice(), invoice({ id: "inv-2", number: 2, kind: "balance", amountCents: 60000 })],
  payments: [], adjustments: [], asOfDate: "2030-02-01", ...overrides,
});
const credit = (amountCents: number) => ({ id: `adj-${amountCents}`, kind: "credit" as const, amountCents, currency: "USD", status: "posted" as const, source: "provider_recorded" as const, paymentId: null });

/* ------------------------------------------------------------------------------------------------------------- *
 * What may be asked for
 * ------------------------------------------------------------------------------------------------------------- */

test("the amount is the invoice's effective payable, from the ledger, never its face amount", () => {
  const base = facts();
  assert.deepEqual(deriveCateringSquareAmount({ invoice: base.invoices[0], facts: base }), { ok: true, amountCents: 40000, currency: "USD" });
  assert.deepEqual(deriveCateringSquareAmount({ invoice: base.invoices[1], facts: base }), { ok: true, amountCents: 60000, currency: "USD" });
  // received money is subtracted
  const part = facts({ payments: [payment()] });
  assert.equal(deriveCateringSquareAmount({ invoice: part.invoices[0], facts: part }).ok && (deriveCateringSquareAmount({ invoice: part.invoices[0], facts: part }) as { amountCents: number }).amountCents, 30000);
  // a credit lands on the LATER invoice first, because older requests own the balance first
  const credited = facts({ adjustments: [credit(30000)] });
  const asks = credited.invoices.map((row) => (deriveCateringSquareAmount({ invoice: row, facts: credited }) as { amountCents: number }).amountCents);
  assert.deepEqual(asks, [40000, 30000]);
});

test("zero payable, a void invoice, a draft, another currency and a cancelled booking are each refused with their own reason", () => {
  const credited = facts({ adjustments: [credit(100000)] });
  assert.equal((deriveCateringSquareAmount({ invoice: credited.invoices[0], facts: credited }) as { code: string }).code, "nothing_payable");
  const paid = facts({ payments: [payment({ amountCents: 40000 })] });
  assert.equal((deriveCateringSquareAmount({ invoice: paid.invoices[0], facts: paid }) as { code: string }).code, "nothing_payable");
  const base = facts();
  assert.equal((deriveCateringSquareAmount({ invoice: invoice({ status: "void" }), facts: base }) as { code: string }).code, "invoice_not_payable");
  assert.equal((deriveCateringSquareAmount({ invoice: invoice({ status: "draft" }), facts: base }) as { code: string }).code, "invoice_not_payable");
  assert.equal((deriveCateringSquareAmount({ invoice: undefined, facts: base }) as { code: string }).code, "invoice_missing");
  assert.equal((deriveCateringSquareAmount({ invoice: invoice({ currency: "EUR" }), facts: base }) as { code: string }).code, "currency_unsupported");
  assert.equal((deriveCateringSquareAmount({ invoice: base.invoices[0], facts: facts({ currency: "EUR" }) }) as { code: string }).code, "currency_unsupported");
  const cancelled = facts({ bookingStatus: "cancelled" });
  assert.equal((deriveCateringSquareAmount({ invoice: cancelled.invoices[0], facts: cancelled }) as { code: string }).code, "booking_cancelled");
});

test("an open attempt is reused only when amount, currency, merchant and location all still match", () => {
  const attempt = { amountCents: 40000, currency: "USD", merchantId: "M", locationId: "L" };
  assert.equal(cateringAttemptMatches(attempt, { ...attempt }), true);
  for (const change of [{ amountCents: 30000 }, { currency: "CAD" }, { merchantId: "M2" }, { locationId: "L2" }]) {
    assert.equal(cateringAttemptMatches(attempt, { ...attempt, ...change }), false, JSON.stringify(change));
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * What counts as evidence
 * ------------------------------------------------------------------------------------------------------------- */

const target = { attemptId: "att-1", squareOrderId: "ORDER_1", locationId: "LOC_1", amountCents: 40000, currency: "USD" };
const order = (overrides: Partial<SquareOrderFacts> = {}): SquareOrderFacts => ({ id: "ORDER_1", locationId: "LOC_1", referenceId: "att-1", state: "OPEN", totalCents: 40000, currency: "USD", paymentIds: [], ...overrides });
const squarePayment = (overrides: Partial<SquarePaymentFacts> = {}): SquarePaymentFacts => ({ id: "PAY_1", orderId: "ORDER_1", locationId: "LOC_1", status: "COMPLETED", totalCents: 40000, tipCents: 0, currency: "USD", createdAt: "2030-01-01T10:00:00Z", updatedAt: "2030-01-01T10:00:01Z", hasRefunds: false, ...overrides });

test("an unpaid open order is awaiting; approved is processing; a cancelled unpaid order is cancelled", () => {
  assert.deepEqual(evaluateSquareEvidence(target, order(), []), { kind: "awaiting" });
  assert.deepEqual(evaluateSquareEvidence(target, order({ paymentIds: ["PAY_1"] }), [squarePayment({ status: "APPROVED" })]), { kind: "processing" });
  assert.deepEqual(evaluateSquareEvidence(target, order({ paymentIds: ["PAY_1"] }), [squarePayment({ status: "PENDING" })]), { kind: "processing" });
  assert.deepEqual(evaluateSquareEvidence(target, order({ paymentIds: ["PAY_1"] }), [squarePayment({ status: "FAILED" })]), { kind: "awaiting" });
  assert.deepEqual(evaluateSquareEvidence(target, order({ state: "CANCELED" }), []), { kind: "cancelled" });
});

// completedAt is Square's created_at (the transaction time); updatedAt is carried as evidence only and never dates anything.
const evidence = (id: string, amountCents: number, currency = "USD", at = "2030-01-01T10:00:00.000Z", tipCents = 0) => ({
  paymentId: id, amountCents, tipCents, currency, createdAt: new Date(at), updatedAt: new Date("2030-01-01T10:00:01Z"), completedAt: new Date(at),
});

test("only a COMPLETED payment that exactly matches is confirmed without a mismatch, carrying Square's own timestamps", () => {
  assert.deepEqual(evaluateSquareEvidence(target, order({ paymentIds: ["PAY_1"] }), [squarePayment()]), { kind: "confirmed", payments: [evidence("PAY_1", 40000)], mismatch: null });
});

test("every completed payment is kept: two are two pieces of evidence, each with its own id, amount, currency and time, never merged or chosen between", () => {
  const verdict = evaluateSquareEvidence(target, order({ paymentIds: ["PAY_2", "PAY_1"] }), [
    squarePayment({ id: "PAY_2", totalCents: 15000, createdAt: "2030-01-01T12:00:00Z", updatedAt: "2030-01-05T00:00:00Z" }),
    squarePayment({ id: "PAY_1", totalCents: 40000, createdAt: "2030-01-01T10:00:00Z", updatedAt: "2030-01-01T10:00:01Z" }),
  ]);
  assert.equal(verdict.kind, "confirmed");
  if (verdict.kind !== "confirmed") return;
  assert.equal(verdict.mismatch, "multiple_payments");
  assert.deepEqual(verdict.payments.map((payment) => [payment.paymentId, payment.amountCents, payment.completedAt?.toISOString()]), [["PAY_1", 40000, "2030-01-01T10:00:00.000Z"], ["PAY_2", 15000, "2030-01-01T12:00:00.000Z"]], "deterministic: by Square time, then id");
  // three payments, mixed currencies: still all there
  const three = evaluateSquareEvidence(target, order({ paymentIds: ["A", "B", "C"] }), [squarePayment({ id: "A" }), squarePayment({ id: "B", currency: "CAD" }), squarePayment({ id: "C", totalCents: 100 })]);
  assert.equal(three.kind === "confirmed" && three.payments.length, 3);
});

test("a summary is honest: an amount only when the currency is one, a reference only when there is exactly one payment", () => {
  assert.deepEqual(summarizeConfirmedPayments([evidence("A", 100)]), { count: 1, amountCents: 100, currency: "USD", singlePaymentId: "A" });
  assert.deepEqual(summarizeConfirmedPayments([evidence("A", 100), evidence("B", 250)]), { count: 2, amountCents: 350, currency: "USD", singlePaymentId: null });
  assert.deepEqual(summarizeConfirmedPayments([evidence("A", 100), evidence("B", 250, "CAD")]), { count: 2, amountCents: null, currency: null, singlePaymentId: null });
});

test("a payment is dated from Square's created_at; updated_at (customer association, metadata, refunds) never moves it; missing or garbage is null, never 'now'", () => {
  assert.equal(squareCompletionTime({ createdAt: "2030-01-01T10:00:00Z" })?.toISOString(), "2030-01-01T10:00:00.000Z");
  // updated_at is not even an input
  assert.equal(squareCompletionTime({ createdAt: "2030-01-01T10:00:00Z", updatedAt: "2030-02-01T00:00:00Z", hasRefunds: true } as never)?.toISOString(), "2030-01-01T10:00:00.000Z");
  for (const bad of [null, "", "not a date", "2030-13-45T99:00:00Z"]) assert.equal(squareCompletionTime({ createdAt: bad }), null, String(bad));
});

test("an aggregate processor amount exists only for ONE currency and an exactly representable total within the attempt ceiling; otherwise null, never clamped", () => {
  const pay = (id: string, amountCents: number, currency = "USD") => ({ paymentId: id, amountCents, tipCents: 0, currency, createdAt: null, updatedAt: null, completedAt: null });
  assert.deepEqual(summarizeConfirmedPayments([pay("A", 40000)]), { count: 1, amountCents: 40000, currency: "USD", singlePaymentId: "A" });
  assert.equal(summarizeConfirmedPayments([pay("A", 40000), pay("B", 700)]).amountCents, 40700);
  assert.equal(summarizeConfirmedPayments([pay("A", 5_000_000_000), pay("B", 4_999_999_999)]).amountCents, 9_999_999_999, "exactly at the ceiling is accepted");
  assert.equal(summarizeConfirmedPayments([pay("A", 5_000_000_000), pay("B", 5_000_000_000)]).amountCents, null, "one cent over");
  const over = summarizeConfirmedPayments([pay("A", 6_000_000_000), pay("B", 6_000_000_000)]);
  assert.deepEqual([over.count, over.amountCents, over.currency], [2, null, "USD"]);
  assert.equal(summarizeConfirmedPayments([pay("A", 100, "EUR"), pay("B", 50)]).amountCents, null, "mixed currency");
  assert.equal(summarizeConfirmedPayments([pay("A", Number.MAX_SAFE_INTEGER), pay("B", Number.MAX_SAFE_INTEGER)]).amountCents, null, "no overflow, no precision loss");
  assert.equal(summarizeConfirmedPayments([pay("A", 1.5), pay("B", 1)]).amountCents, null, "not an integer");
});


test("a single payment with no usable Square time is confirmed as a payment_timestamp_invalid reconciliation, not dated by when ChefSire looked", () => {
  const verdict = evaluateSquareEvidence(target, order({ paymentIds: ["PAY_1"] }), [squarePayment({ createdAt: null, updatedAt: "2030-01-01T10:00:00Z" })]);
  assert.equal(verdict.kind === "confirmed" && verdict.mismatch, "payment_timestamp_invalid", "a valid updated_at never stands in for a missing created_at");
  assert.equal(verdict.kind === "confirmed" && verdict.payments[0].completedAt, null);
});

test("money that moved but is not what was asked for is CONFIRMED with a mismatch, never dropped and never treated as a match", () => {
  const confirmed = (p: Partial<SquarePaymentFacts>) => evaluateSquareEvidence(target, order({ paymentIds: ["PAY_1"] }), [squarePayment(p)]);
  assert.deepEqual(confirmed({ totalCents: 45000 }), { kind: "confirmed", payments: [evidence("PAY_1", 45000)], mismatch: "amount_mismatch" });
  assert.deepEqual(confirmed({ totalCents: 42000, tipCents: 2000 }), { kind: "confirmed", payments: [evidence("PAY_1", 42000, "USD", "2030-01-01T10:00:00.000Z", 2000)], mismatch: "amount_mismatch" });
  assert.deepEqual(confirmed({ currency: "CAD" }), { kind: "confirmed", payments: [evidence("PAY_1", 40000, "CAD")], mismatch: "currency_mismatch" });
  // a completed payment whose amount Square did not report is not trusted
  assert.deepEqual(confirmed({ totalCents: null }), { kind: "rejected", code: "order_total_mismatch" });
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Whether confirmed money fits the ledger now
 * ------------------------------------------------------------------------------------------------------------- */

const confirmed = (amountCents = 40000, mismatch: null | "amount_mismatch" = null) => ({ amountCents, currency: "USD", mismatch });

test("money that fits the CURRENT payable is credited in full", () => {
  const base = facts();
  assert.deepEqual(decideCateringSettlement({ confirmed: confirmed(), invoice: base.invoices[0], facts: base }), { kind: "credit", amountCents: 40000 });
  // payable GREW or stayed: still credited exactly what moved
  assert.deepEqual(decideCateringSettlement({ confirmed: confirmed(30000), invoice: base.invoices[0], facts: base }), { kind: "credit", amountCents: 30000 });
});

test("when the payable fell below what moved the money is NEVER clamped: it is reconciliation, whatever caused the fall", () => {
  const credited = facts({ adjustments: [credit(30000)] });
  assert.deepEqual(decideCateringSettlement({ confirmed: confirmed(60000), invoice: credited.invoices[1], facts: credited }), { kind: "reconcile", reason: "payable_changed" });
  const paidElsewhere = facts({ payments: [payment({ amountCents: 40000 })] });
  assert.deepEqual(decideCateringSettlement({ confirmed: confirmed(), invoice: paidElsewhere.invoices[0], facts: paidElsewhere }), { kind: "reconcile", reason: "payable_changed" });
  const partlyPaid = facts({ payments: [payment({ amountCents: 10000 })] });
  assert.deepEqual(decideCateringSettlement({ confirmed: confirmed(), invoice: partlyPaid.invoices[0], facts: partlyPaid }), { kind: "reconcile", reason: "payable_changed" });
});

test("a withdrawn invoice, a cancelled booking, a mismatch or another currency are each reconciliation with their own reason", () => {
  const base = facts();
  assert.deepEqual(decideCateringSettlement({ confirmed: confirmed(), invoice: invoice({ status: "void" }), facts: base }), { kind: "reconcile", reason: "invoice_not_payable" });
  assert.deepEqual(decideCateringSettlement({ confirmed: confirmed(), invoice: undefined, facts: base }), { kind: "reconcile", reason: "invoice_not_payable" });
  const cancelled = facts({ bookingStatus: "cancelled" });
  assert.deepEqual(decideCateringSettlement({ confirmed: confirmed(), invoice: cancelled.invoices[0], facts: cancelled }), { kind: "reconcile", reason: "booking_cancelled" });
  assert.deepEqual(decideCateringSettlement({ confirmed: confirmed(45000, "amount_mismatch"), invoice: base.invoices[0], facts: base }), { kind: "reconcile", reason: "amount_mismatch" });
  assert.deepEqual(decideCateringSettlement({ confirmed: { amountCents: 40000, currency: "CAD", mismatch: null }, invoice: base.invoices[0], facts: base }), { kind: "reconcile", reason: "currency_mismatch" });
});
