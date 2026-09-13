import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCateringDepositTerms, serializeCateringInvoice, serializeCateringPayment } from "./catering-booking-billing";
import { cateringBillingFacts } from "../services/catering-booking-billing-policy";
import type { CateringBookingBillingRecord, CateringBookingInvoice, CateringBookingPayment } from "@shared/schema";

/**
 * WHAT A CUSTOMER RECEIVES, AND WHAT THEY MUST NEVER.
 *
 * The method is the one Phase 2K used: build the whole customer payload, change a provider-private fact, build it
 * again, and assert byte identity -- with counterfactuals proving a SHARED fact does move it, so the test cannot
 * pass by measuring nothing.
 */

const NOW = new Date("2026-09-10T12:00:00.000Z");
const invoiceRow = (patch: Partial<CateringBookingInvoice> = {}): CateringBookingInvoice => ({
  id: "inv-1", bookingId: "booking-abc12345", invoiceNumber: 1, invoiceKind: "deposit",
  amountCents: 50_000, currency: "USD", status: "issued", dueOn: "2026-10-01",
  issuedAt: NOW, voidedAt: null, voidReason: null,
  createdBy: "user-provider", voidedBy: null, createdAt: NOW, updatedAt: NOW, ...patch,
} as CateringBookingInvoice);
const paymentRow = (patch: Partial<CateringBookingPayment> = {}): CateringBookingPayment => ({
  id: "pay-1", bookingId: "booking-abc12345", invoiceId: "inv-1", amountCents: 20_000, currency: "USD",
  paymentMethod: "bank_transfer", paymentSource: "provider_recorded", status: "recorded", receivedOn: "2026-09-08",
  reference: "INTERNAL-LEDGER-4471", recordedBy: "user-provider", voidedAt: null, voidedBy: null, voidReason: null,
  idempotencyKey: "key-abcdefgh", processor: null, processorPaymentId: null, createdAt: NOW, updatedAt: NOW, ...patch,
} as CateringBookingPayment);
const termsRow = (patch: Partial<CateringBookingBillingRecord> = {}): CateringBookingBillingRecord => ({
  bookingId: "booking-abc12345", depositMode: "percentage", depositAmountCents: null, depositPercentBp: 2_500,
  depositDueOn: "2026-10-01", termsUpdatedBy: "user-provider", createdAt: NOW, updatedAt: NOW, ...patch,
} as CateringBookingBillingRecord);

const facts = (invoices: CateringBookingInvoice[], payments: CateringBookingPayment[]) => cateringBillingFacts({
  booking: { status: "confirmed", agreedPrice: "2000.00", currency: "USD" },
  terms: termsRow(), invoices, payments, asOfDate: "2026-09-13",
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Absent keys, not nulled ones
 * ------------------------------------------------------------------------------------------------------------- */

test("a customer's invoice carries no concurrency version at all -- the key is absent", () => {
  const state = facts([invoiceRow()], []);
  const customer = serializeCateringInvoice(invoiceRow(), state, "customer");
  assert.equal("updatedAt" in customer, false, "not null: absent");
  assert.equal(typeof serializeCateringInvoice(invoiceRow(), state, "provider").updatedAt, "string");
});

test("a customer's payment carries no provider reference at all -- the key is absent", () => {
  const customer = serializeCateringPayment(paymentRow(), "customer");
  assert.equal("reference" in customer, false);
  assert.equal(serializeCateringPayment(paymentRow(), "provider").reference, "INTERNAL-LEDGER-4471");
});

test("internal attribution reaches NEITHER actor", () => {
  const state = facts([invoiceRow()], [paymentRow()]);
  for (const role of ["provider", "customer"] as const) {
    const rendered = JSON.stringify({
      invoice: serializeCateringInvoice(invoiceRow(), state, role),
      payment: serializeCateringPayment(paymentRow(), role),
      ...(role === "provider" ? { terms: serializeCateringDepositTerms(termsRow(), 200_000) } : {}),
    });
    for (const secret of ["createdBy", "voidedBy", "recordedBy", "termsUpdatedBy", "user-provider", "voidReason"]) {
      assert.equal(rendered.includes(secret), false, `${role}: ${secret}`);
    }
  }
});

test("no processor object, identifier or idempotency key is serialized to anyone", () => {
  const withProcessor = paymentRow({ paymentSource: "processor", processor: "square", processorPaymentId: "sq-payment-XYZ", recordedBy: null, reference: null });
  for (const role of ["provider", "customer"] as const) {
    const rendered = JSON.stringify(serializeCateringPayment(withProcessor, role));
    for (const secret of ["processorPaymentId", "sq-payment-XYZ", "idempotencyKey", "key-abcdefgh"]) {
      assert.equal(rendered.includes(secret), false, `${role}: ${secret}`);
    }
  }
  // `source` IS shared, deliberately: it is what the customer-facing wording about the payment is built from.
  assert.equal(serializeCateringPayment(withProcessor, "customer").source, "processor");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * A private change moves nothing a customer can see
 * ------------------------------------------------------------------------------------------------------------- */

const customerPayload = (invoices: CateringBookingInvoice[], payments: CateringBookingPayment[]) => {
  const state = facts(invoices, payments);
  return JSON.stringify({
    invoices: invoices.map((row) => serializeCateringInvoice(row, state, "customer")),
    payments: payments.map((row) => serializeCateringPayment(row, "customer")),
  });
};

test("editing the caterer's private payment reference changes the customer payload by not one byte", () => {
  const before = customerPayload([invoiceRow()], [paymentRow()]);
  const after = customerPayload([invoiceRow()], [paymentRow({ reference: "COMPLETELY DIFFERENT INTERNAL NOTE" })]);
  assert.equal(after, before);
});

test("and neither does the invoice's concurrency version moving", () => {
  const before = customerPayload([invoiceRow()], [paymentRow()]);
  const after = customerPayload([invoiceRow({ updatedAt: new Date("2026-09-11T09:00:00.000Z") })], [paymentRow()]);
  assert.equal(after, before, "so provider activity cannot be inferred from a version they never see");
});

test("the counterfactual: a SHARED fact does move it, so the assertions above are not vacuous", () => {
  const before = customerPayload([invoiceRow()], [paymentRow()]);
  assert.notEqual(customerPayload([invoiceRow({ amountCents: 60_000 })], [paymentRow()]), before, "the amount");
  assert.notEqual(customerPayload([invoiceRow({ dueOn: "2026-11-01" })], [paymentRow()]), before, "the due date");
  assert.notEqual(customerPayload([invoiceRow()], [paymentRow({ amountCents: 30_000 })]), before, "what was credited");
  assert.notEqual(customerPayload([invoiceRow()], [paymentRow({ status: "voided", voidedAt: NOW, voidedBy: "user-provider" })]), before, "a withdrawn credit");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Structural
 * ------------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const serializer = fs.readFileSync(path.join(here, "catering-booking-billing.ts"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-billing.ts"), "utf8");

/** The file with its comments removed, so a regex tests the CODE rather than the prose describing it. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("not one database row is spread into a payload", () => {
  // A `{ ...row }` would ship every new column the day it was added. Every field is written out by hand; the only
  // spreads in the file are of objects this file has already projected itself.
  const body = code(serializer);
  for (const forbidden of ["...row", "...invoice", "...payment", "...record"]) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
  assert.ok(body.includes("...shared"), "projected objects are what get extended");
});

test("the route sends only serialized views, never a row it just read or wrote", () => {
  const body = code(route);
  // Every `res.json(...)` in the file, by the expression it is handed.
  const responses = [...body.matchAll(/res\.json\(([^\n]*)/g)].map((match) => match[1]);
  assert.ok(responses.length >= 5, `expected every route to answer: ${responses.length}`);
  for (const response of responses) {
    const safe = response.includes("billingView(") || response.includes("freshView(") || response.includes("serializeCateringDepositTerms(");
    assert.ok(safe, `raw payload: ${response}`);
  }
  // And the serializers are what the view is built from.
  assert.ok(body.includes("serializeCateringInvoice"));
  assert.ok(body.includes("serializeCateringPayment"));
});

test("the deposit terms are a provider-only key on the view, added after the customer's early return", () => {
  assert.ok(route.includes('if (input.role !== "provider") return view;'));
  const afterReturn = route.slice(route.indexOf('if (input.role !== "provider") return view;'));
  assert.ok(afterReturn.includes("terms: serializeCateringDepositTerms"), "terms are added only past that line");
  assert.ok(afterReturn.includes("issuable"), "and so is what may be issued, which is a provider control");
});
