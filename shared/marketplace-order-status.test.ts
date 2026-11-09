import test from "node:test";
import assert from "node:assert/strict";
import { canMarkShipped, orderStatusLabel, orderStatusSentence } from "./marketplace-order-status";

test("pickup orders are picked up, never shipped or delivered", () => {
  assert.equal(canMarkShipped("shipped"), true);
  for (const m of ["pickup", "in_store", "digital", null]) assert.equal(canMarkShipped(m), false);
  assert.equal(orderStatusLabel("delivered", "pickup"), "Picked up");
  assert.equal(orderStatusLabel("delivered", "shipped"), "Delivered");
  assert.equal(orderStatusLabel("delivered", "digital"), "Completed");
  assert.equal(orderStatusLabel("processing", "pickup"), "Being prepared for pickup");
  assert.equal(orderStatusLabel(null, "pickup"), "Waiting for the seller");
  assert.equal(orderStatusSentence("processing", "pickup"), "is being prepared for pickup");
  assert.equal(orderStatusSentence("delivered", "pickup"), "has been picked up");
  assert.equal(orderStatusSentence("delivered", "shipped"), "has been delivered");
  assert.equal(orderStatusSentence("shipped", "shipped"), "has shipped");
  assert.equal(orderStatusSentence("cancelled", "pickup"), "was cancelled");
  assert.equal(orderStatusSentence("tracking_updated", "shipped"), "has updated tracking information");
});
