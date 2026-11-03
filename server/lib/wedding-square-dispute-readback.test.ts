import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareDisputeReadback, WeddingSquareDisputeReadbackError } from "./wedding-square-dispute-readback";

const dispute = { dispute: { id: "dispute-1", location_id: "loc-1", state: "WON",
  amount_money: { amount: 100, currency: "USD" }, disputed_payment: { payment_id: "payment-1" } } };
const payment = { payment: { id: "payment-1", location_id: "loc-1", customer_id: "customer-1",
  amount_money: { amount: 2499, currency: "USD" } } };
async function enabled(fn: () => Promise<void>) {
  const vars = { SQUARE_ENV: "sandbox", SQUARE_LIVE_PAYMENTS_ENABLED: "false", SQUARE_ACCESS_TOKEN: "offline-test",
    SQUARE_LOCATION_ID: "loc-1", WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
    WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED: "true", WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED: "true" };
  const old = { ...process.env }; Object.assign(process.env, vars);
  try { await fn(); } finally { for (const k of Object.keys(vars)) {
    if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k];
  } }
}
test("dispute readback GETs exact dispute then payment, including partial and WON disputes", () => enabled(async () => {
  const requests: string[] = [];
  const service = createWeddingSquareDisputeReadback(async (url, init) => {
    requests.push(url); assert.equal(init.method, "GET"); assert.equal(init.redirect, "error");
    return Response.json(requests.length === 1 ? dispute : payment);
  });
  assert.deepEqual(await service.inspect("dispute-1"), { disputeId: "dispute-1", paymentId: "payment-1",
    customerId: "customer-1", locationId: "loc-1", amountCents: 2499, grantsEntitlement: false });
  assert.deepEqual(requests, ["https://connect.squareupsandbox.com/v2/disputes/dispute-1",
    "https://connect.squareupsandbox.com/v2/payments/payment-1"]);
}));
test("malformed, mixed-error, foreign and wrong-price provider readbacks fail closed", () => enabled(async () => {
  const cases = [
    [{ ...dispute, errors: [{ code: "FAIL" }] }, payment],
    [{ ...dispute, errors: null }, payment],
    [{ dispute: { ...dispute.dispute, id: "foreign" } }, payment],
    [{ dispute: { ...dispute.dispute, location_id: "foreign" } }, payment],
    [dispute, { payment: { ...payment.payment, id: "foreign" } }],
    [dispute, { payment: { ...payment.payment, customer_id: " padded " } }],
    [dispute, { payment: { ...payment.payment, location_id: "foreign" } }],
    [dispute, { payment: { ...payment.payment, amount_money: { amount: 999, currency: "USD" } } }],
    [{ dispute: { ...dispute.dispute, amount_money: { amount: 2500, currency: "USD" } } }, payment],
  ];
  for (const bodies of cases) {
    let calls = 0;
    const service = createWeddingSquareDisputeReadback(async () => Response.json(bodies[calls++]));
    await assert.rejects(service.inspect("dispute-1"), WeddingSquareDisputeReadbackError);
  }
  const failed = createWeddingSquareDisputeReadback(async () => { throw Error("private provider error"); });
  await assert.rejects(failed.inspect("dispute-1"), e => e instanceof WeddingSquareDisputeReadbackError && !e.message.includes("private"));
}));
test("production, live switch, missing credentials and padded dispute IDs do no provider work", () => enabled(async () => {
  let calls = 0;
  const service = createWeddingSquareDisputeReadback(async () => { calls++; return Response.json(dispute); });
  for (const [k, v] of [["SQUARE_ENV", "production"], ["SQUARE_LIVE_PAYMENTS_ENABLED", "true"],
    ["SQUARE_ACCESS_TOKEN", ""], ["WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED", "false"]]) {
    const old = process.env[k]; process.env[k] = v;
    await assert.rejects(service.inspect("dispute-1"), WeddingSquareDisputeReadbackError); process.env[k] = old;
  }
  await assert.rejects(service.inspect(" dispute-1"), WeddingSquareDisputeReadbackError);
  assert.equal(calls, 0);
}));
