import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inspectWeddingSquareInvoicePaymentLinkage,
  WeddingSquareInvoicePaymentLinkageError,
} from "./wedding-square-invoice-payment-linkage";

const expected = {
  subscriptionId: "sub-wedding-1",
  customerId: "customer-wedding-1",
  locationId: "location-wedding-1",
};
const invoice = {
  invoice: {
    id: "invoice-1",
    subscriptionId: expected.subscriptionId,
    orderId: "order-1",
    locationId: expected.locationId,
    primaryRecipient: { customerId: expected.customerId },
    status: "PAID",
  },
};
const payment = {
  payment: {
    id: "payment-1",
    orderId: "order-1",
    locationId: expected.locationId,
    customerId: expected.customerId,
    status: "COMPLETED",
    amountMoney: { amount: 2499n, currency: "USD" },
    totalMoney: { amount: 2499n, currency: "USD" },
  },
};
const errorType = WeddingSquareInvoicePaymentLinkageError;

function sandbox(fn: () => void) {
  const keys = ["SQUARE_ENV", "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "SQUARE_CURRENCY"] as const;
  const old = keys.map((key) => process.env[key]);
  process.env.SQUARE_ENV = "sandbox";
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  process.env.SQUARE_CURRENCY = "USD";
  try { fn(); }
  finally {
    keys.forEach((key, i) => {
      if (old[i] === undefined) delete process.env[key];
      else process.env[key] = old[i];
    });
  }
}

function inspect(saved: unknown = expected, i: unknown = invoice, p: unknown = payment) {
  return inspectWeddingSquareInvoicePaymentLinkage(saved, i, p);
}

test("matching invoice and payment return a non-entitling reconciliation candidate only", () => sandbox(() => {
  const result = inspect();
  assert.deepEqual(result, {
    invoiceId: "invoice-1", paymentId: "payment-1",
    subscriptionId: "sub-wedding-1",
    requiresOperatorReconciliation: true,
    requiresAmountAndCoverageVerification: true,
    grantsEntitlement: false,
    safeToResubmit: false,
  });
  assert.ok(Object.isFrozen(result));
  assert.equal("paidThrough" in result, false);
  assert.equal("customerId" in result, false);
}));

test("cross-subscription, cross-customer, cross-location and cross-order evidence fails closed", () => sandbox(() => {
  const badInvoices = [
    { ...invoice.invoice, subscriptionId: "sub-unrelated" },
    { ...invoice.invoice, primaryRecipient: { customerId: "another-customer" } },
    { ...invoice.invoice, locationId: "another-location" },
    { ...invoice.invoice, orderId: "another-order" },
  ];
  for (const changed of badInvoices) {
    assert.throws(() => inspect(expected, { invoice: changed }), errorType);
  }
  const badPayments = [
    { ...payment.payment, customerId: "another-customer" },
    { ...payment.payment, locationId: "another-location" },
    { ...payment.payment, orderId: "another-order" },
  ];
  for (const changed of badPayments) {
    assert.throws(() => inspect(expected, invoice, { payment: changed }), errorType);
  }
  for (const key of ["subscriptionId", "customerId", "locationId"] as const) {
    assert.throws(() => inspect({ ...expected, [key]: "other" }), errorType);
  }
}));

test("unpaid, pending, partially refunded and malformed provider envelopes are rejected", () => sandbox(() => {
  for (const status of ["DRAFT", "UNPAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED", "REFUNDED", null]) {
    assert.throws(() => inspect(expected, { invoice: { ...invoice.invoice, status } }), errorType);
  }
  for (const status of ["PENDING", "APPROVED", "FAILED", "CANCELED", null]) {
    assert.throws(() => inspect(expected, invoice, { payment: { ...payment.payment, status } }), errorType);
  }
  for (const errors of [[{ code: "ERROR" }], "malformed", null]) {
    assert.throws(() => inspect(expected, { ...invoice, errors }), errorType);
    assert.throws(() => inspect(expected, invoice, { ...payment, errors }), errorType);
  }
  for (const value of [null, {}, { invoice: null }, { payment: null }]) {
    assert.throws(() => inspect(expected, value, payment), errorType);
    assert.throws(() => inspect(expected, invoice, value), errorType);
  }
  assert.equal(inspect(expected, { ...invoice, errors: [] }, { ...payment, errors: [] }).grantsEntitlement, false);
}));

test("refunds, tips, currency, nonpositive amounts and mismatched totals cannot pass", () => sandbox(() => {
  const badPayments = [
    { ...payment.payment, refundedMoney: { amount: 1n, currency: "USD" } },
    { ...payment.payment, refundedMoney: { amount: 0n, currency: "CAD" } },
    { ...payment.payment, refundIds: ["refund-1"] },
    { ...payment.payment, refundIds: null },
    { ...payment.payment, tipMoney: { amount: 1n, currency: "USD" } },
    { ...payment.payment, amountMoney: { amount: 0n, currency: "USD" } },
    { ...payment.payment, amountMoney: { amount: -1n, currency: "USD" } },
    { ...payment.payment, amountMoney: { amount: 2499, currency: "USD" } },
    { ...payment.payment, amountMoney: { amount: 2499n, currency: "CAD" } },
    { ...payment.payment, totalMoney: { amount: 2500n, currency: "USD" } },
    { ...payment.payment, totalMoney: { amount: 2499n, currency: "CAD" } },
    { ...payment.payment, totalMoney: undefined },
  ];
  for (const changed of badPayments) {
    assert.throws(() => inspect(expected, invoice, { payment: changed }), errorType);
  }
  assert.equal(inspect(expected, invoice, {
    payment: { ...payment.payment, refundedMoney: { amount: 0n, currency: "USD" }, refundIds: [] },
  }).grantsEntitlement, false);
}));

test("malformed provider and persisted identifiers cannot match even byte-for-byte", () => sandbox(() => {
  const bad = "same" + String.fromCharCode(0) + "id";
  for (const key of ["subscriptionId", "customerId", "locationId"] as const) {
    assert.throws(() => inspect({ ...expected, [key]: bad }), errorType);
  }
  for (const key of ["id", "subscriptionId", "orderId", "locationId"] as const) {
    assert.throws(() => inspect(expected, { invoice: { ...invoice.invoice, [key]: "bad\tvalue" } }), errorType);
  }
  assert.throws(() => inspect(expected, {
    invoice: { ...invoice.invoice, primaryRecipient: { customerId: bad } },
  }), errorType);
  for (const key of ["id", "orderId", "locationId", "customerId"] as const) {
    assert.throws(() => inspect(expected, invoice, { payment: { ...payment.payment, [key]: bad } }), errorType);
  }
}));

test("sandbox-only guard never accepts live, disabled or unsupported currency mode", () => sandbox(() => {
  for (const [key, value] of [
    ["SQUARE_ENV", "production"],
    ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "false"],
    ["SQUARE_CURRENCY", "CAD"],
  ] as const) {
    const before = process.env[key];
    process.env[key] = value;
    try { assert.throws(() => inspect(), errorType); }
    finally { if (before === undefined) delete process.env[key]; else process.env[key] = before; }
  }
  const candidate = inspect();
  assert.equal(candidate.requiresAmountAndCoverageVerification, true);
  assert.equal(candidate.grantsEntitlement, false);
}));
