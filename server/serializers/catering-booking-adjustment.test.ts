import assert from "node:assert/strict";
import test from "node:test";
import type { CateringBookingAdjustment } from "@shared/schema";
import { serializeCateringAdjustment } from "./catering-booking-adjustment";

const row = (over: Partial<CateringBookingAdjustment> = {}): CateringBookingAdjustment => ({
  id: "adj-1", bookingId: "booking-1", entryKind: "refund", source: "provider_recorded", status: "posted", amountCents: 5000, currency: "USD",
  reason: "Returned by transfer", reference: "PRIVATE-REF", paymentId: "pay-1", amendmentId: null, idempotencyKey: "secret-key-1", recordedBy: "provider-1",
  reversedAt: null, reversedBy: null, reversalReason: null, createdAt: new Date("2026-03-01T10:00:00.000Z"), ...over,
});

test("the customer's projection carries shared facts only, and no provider-only or internal key exists in it", () => {
  const view = serializeCateringAdjustment(row(), "customer", new Map());
  assert.deepEqual(Object.keys(view).sort(), ["amendmentNumber", "amountCents", "createdAt", "currency", "id", "kind", "paymentId", "reason", "reversalReason", "reversedAt", "source", "status"]);
  const text = JSON.stringify(view);
  for (const leaked of ["PRIVATE-REF", "secret-key-1", "provider-1", "recordedBy", "reversedBy", "idempotency", "bookingId", "booking-1"]) assert.equal(text.includes(leaked), false, leaked);
});

test("the provider additionally sees their own reference, and still nothing internal", () => {
  const view = serializeCateringAdjustment(row(), "provider", new Map());
  assert.equal(view.reference, "PRIVATE-REF");
  const text = JSON.stringify(view);
  for (const leaked of ["secret-key-1", "provider-1", "recordedBy", "reversedBy", "idempotency"]) assert.equal(text.includes(leaked), false, leaked);
});

test("an amendment-generated entry names its amendment by number, and a reversed entry says when and why", () => {
  const view = serializeCateringAdjustment(row({ entryKind: "charge", source: "amendment", amendmentId: "am-1", paymentId: null, reference: null }), "customer", new Map([["am-1", 2]]));
  assert.deepEqual([view.kind, view.source, view.amendmentNumber, view.paymentId], ["charge", "amendment", 2, null]);
  const reversed = serializeCateringAdjustment(row({ status: "reversed", reversedAt: new Date("2026-03-02T10:00:00.000Z"), reversalReason: "Wrong booking" }), "customer", new Map());
  assert.deepEqual([reversed.status, reversed.reversedAt, reversed.reversalReason], ["reversed", "2026-03-02T10:00:00.000Z", "Wrong booking"]);
});

test("money stays integer cents and the currency is explicit on every projection", () => {
  const view = serializeCateringAdjustment(row({ amountCents: 12345 }), "customer", new Map());
  assert.equal(Number.isInteger(view.amountCents), true);
  assert.equal(view.currency, "USD");
});

test("reversibility is a provider-only, server-supplied fact: absent for the customer, present and honest for the provider", () => {
  const customer = serializeCateringAdjustment(row(), "customer", new Map(), { reversible: true, blockedReason: null });
  assert.equal("reversible" in customer || "reversalBlockedReason" in customer, false, "even a true verdict is never handed to a customer");
  const open = serializeCateringAdjustment(row(), "provider", new Map(), { reversible: true, blockedReason: null });
  assert.deepEqual([open.reversible, open.reversalBlockedReason], [true, null]);
  const blocked = serializeCateringAdjustment(row(), "provider", new Map(), { reversible: false, blockedReason: "Withdraw that request first." });
  assert.deepEqual([blocked.reversible, blocked.reversalBlockedReason], [false, "Withdraw that request first."]);
  assert.equal(serializeCateringAdjustment(row(), "provider", new Map()).reversible, false, "no verdict means no control");
});
