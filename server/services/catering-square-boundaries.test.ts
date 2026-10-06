import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * PHASE 2Q BOUNDARIES, asserted against the source.
 *
 * Behaviour is proven by the Postgres suites. This file pins the architectural claims those suites cannot observe from outside:
 * that Catering money never touches ChefSire's own Square account, that nothing in this phase refunds, pays out or takes a fee,
 * that the sandbox gate sits in front of every Square call, and that exactly one function writes a processor payment.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const FILES = {
  service: "server/services/catering-square-payments.ts",
  instance: "server/services/catering-square-payments-instance.ts",
  policy: "server/services/catering-square-payment-policy.ts",
  route: "server/routes/catering-square-payments.ts",
  serializer: "server/serializers/catering-booking-payment-attempt.ts",
  contract: "shared/catering-square-payments.ts",
  state: "client/src/pages/services/catering-square-payment-state.ts",
  component: "client/src/components/catering/BookingSquarePayments.tsx",
};
const sources = Object.fromEntries(Object.entries(FILES).map(([name, file]) => [name, code(read(file))])) as Record<keyof typeof FILES, string>;
const checkoutSection = code(read("server/lib/square-checkout.ts"));

test("Catering money never goes through ChefSire's own Square account: no platform client, token, location or config anywhere in Phase 2Q", () => {
  for (const [name, body] of Object.entries(sources)) {
    for (const forbidden of ["createPlatformSquareClient", "getSquareClient", "SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID", "squareConfig", "lib/square\"", "lib/square-client"]) {
      assert.equal(body.includes(forbidden), false, `${name}: ${forbidden}`);
    }
  }
  assert.equal(checkoutSection.includes("createPlatformSquareClient"), false);
  assert.equal(checkoutSection.includes("SQUARE_ACCESS_TOKEN"), false);
  // Every Square call in the checkout adapter is made as the PROVIDER, with the access token it was handed.
  assert.equal((checkoutSection.match(/createConnectedSquareClient\(accessToken, options\)/g) ?? []).length, 4);
});

test("the provider's own connected credential is the only one ever used, resolved for the PROVIDER and never the customer", () => {
  const body = sources.service;
  const uses = [...body.matchAll(/connections\.getReadyConnectedCredentials\(([^)]*)\)/g)].map((match) => match[1]);
  assert.ok(uses.length >= 3, "create, settle and close each resolve it");
  for (const argument of uses) assert.match(argument, /providerId/, argument);
  assert.ok(sources.instance.includes("connections: squareConnections"), "production wiring uses the Gate 0 service");
  // The token is never stored, returned or logged: it only flows into the Square adapter as an argument.
  assert.deepEqual(body.match(/console\.\w+\([^\n]*/g), ["console.warn(JSON.stringify({ event, ...fields })) };"], "the only console use is the default logger, which prints fixed fields");
  for (const call of body.match(/log\.warn\([^;]*;/g) ?? []) assert.equal(/accessToken|credentials/.test(call), false, call);
  assert.equal(/\.set\(\{[^}]*(accessToken|token)/i.test(body), false, "no token column is ever written");
});

test("this phase adds no processor refund, payout, platform fee, split settlement or FX", () => {
  for (const [name, body] of Object.entries(sources)) {
    for (const forbidden of ["refunds.", "refundPayment", "payouts.", "createPayout", "appFeeMoney", "app_fee", "applicationFee", "additionalRecipients", "splitPayment", "exchangeRate", "convertCurrency", "transfer"]) {
      assert.equal(body.toLowerCase().includes(forbidden.toLowerCase()), false, `${name}: ${forbidden}`);
    }
  }
  for (const forbidden of ["refunds.", "payouts.", "appFeeMoney", "additionalRecipients"]) assert.equal(checkoutSection.includes(forbidden), false, forbidden);
  const calls = [...checkoutSection.matchAll(/\)\.(checkout\.paymentLinks\.\w+|orders\.\w+|payments\.\w+)\(/g)].map((match) => match[1]).sort();
  assert.deepEqual(calls, ["checkout.paymentLinks.create", "checkout.paymentLinks.delete", "orders.get", "payments.get"], "the whole Square surface this phase uses");
});

test("SANDBOX ONLY: every Square call is behind the sandbox gate, and every entry point checks it first", () => {
  const api = checkoutSection.slice(checkoutSection.indexOf("export function createSquareCheckoutApi"));
  assert.equal((api.match(/assertSquareSandboxOnly\(\);/g) ?? []).length, 4, "one per Square call");
  for (const method of ["createPaymentLink", "deletePaymentLink", "retrieveOrder", "retrievePayment"]) {
    const at = api.indexOf(`async ${method}(`);
    assert.ok(api.slice(at, api.indexOf("createConnectedSquareClient", at)).includes("assertSquareSandboxOnly();"), method);
  }
  const body = sources.service;
  assert.ok(body.includes("if (!enabled()) return { kind: \"unavailable\" };"), "create");
  assert.ok(body.includes("if (!enabled()) return { outcome: \"unavailable\", reason: \"sandbox_only\", attempt: first };"), "settle");
  assert.ok(body.includes("if (!enabled()) return { kind: \"retry\", reason: \"sandbox_only\" };"), "webhook");
  assert.ok(sources.route.includes("if (!service.enabled()) return res.status(503)"), "webhook route");
  assert.ok(sources.service.includes("processorEnvironment: \"sandbox\""));
  // No code path configures or names production Square credentials.
  for (const [name, text] of Object.entries(sources)) for (const forbidden of ["connect.squareup.com", "SquareEnvironment.Production", "\"production\""]) assert.equal(text.includes(forbidden), false, `${name}: ${forbidden}`);
});

test("exactly ONE function can write a processor payment into the ledger, and it is the settlement transaction", () => {
  const body = sources.service;
  assert.equal((body.match(/insert\(cateringBookingPayments\)/g) ?? []).length, 1);
  const txStart = body.indexOf("async function recordConfirmedPayment");
  assert.ok(body.indexOf("insert(cateringBookingPayments)") > txStart);
  const inside = body.slice(txStart, body.indexOf("async function notifyCompleted"));
  // under the billing lock, the booking row lock and the attempt row lock, in that order, before it reads the ledger
  const order = ["lockCateringBilling(tx", "lockedBooking(tx", "FOR UPDATE", "lockedFacts(tx", "insert(cateringBookingPayments)"].map((needle) => inside.indexOf(needle));
  assert.ok(order.every((at) => at !== -1), JSON.stringify(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "lock order, then the CURRENT payable, then the credit");
  assert.ok(inside.includes('paymentSource: "processor"') && inside.includes('paymentMethod: "card_online"') && inside.includes("processorPaymentId: confirmed.paymentId"));
  assert.ok(inside.includes("recordedBy: null"));
  // and nothing else in the codebase inserts a processor payment
  for (const file of ["server/routes/catering-booking-billing.ts", "server/routes/catering-square-payments.ts", "server/services/catering-booking-adjustments.ts"]) {
    assert.equal(/paymentSource: "processor"/.test(read(file)), false, file);
  }
});

test("webhook, poll and retry all reach the ledger through settleAttempt and nothing else", () => {
  const body = sources.service;
  assert.equal((body.match(/recordConfirmedPayment\(/g) ?? []).length, 2, "its definition and its single call");
  assert.ok(body.includes("const settled = await settleAttempt(attempt.id);"), "the webhook path");
  assert.ok(body.includes("await settleAttempt(attempt.id);"), "the status path");
  // The webhook handler reads identifiers only; it never reads an amount, a status or a payment object from the payload.
  const webhook = sources.route.slice(sources.route.indexOf("export function squareWebhookInputOf"), sources.route.indexOf("export function createCateringSquarePaymentsRouter"));
  for (const forbidden of ["amount", "status", "currency", "total_money"]) assert.equal(webhook.includes(forbidden), false, forbidden);
});

test("the webhook is guarded by Square's signature over the raw body and the exact configured URL, before anything is parsed or stored", () => {
  const route = sources.route;
  const handler = route.slice(route.indexOf('router.post("/webhooks/square"'));
  const order = ["service.enabled()", "webhookConfig()", "x-square-hmacsha256-signature", "WebhooksHelper.verifySignature", "squareWebhookInputOf(req.body)", "service.handleWebhookEvent"].map((needle) => handler.indexOf(needle));
  assert.ok(order.every((at) => at !== -1), JSON.stringify(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(handler.includes("requestBody: rawBody") && handler.includes("notificationUrl: config.notificationUrl") && handler.includes("signatureKey: config.signatureKey"));
  assert.ok(route.includes("SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL") && route.includes("SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY"));
  assert.equal(handler.includes("req.get(\"host\")") || handler.includes("req.originalUrl") || handler.includes("req.protocol"), false, "the URL is configured, never derived from the request");
});

test("the pay route is customer-only by construction: authenticated, same-origin JSON, strict empty body, role from the persisted booking", () => {
  const route = sources.route;
  const pay = route.slice(route.indexOf('router.post("/bookings/:id/billing/invoices/:invoiceId/pay"'), route.indexOf('router.get("/bookings/:id/billing/payment-attempts/:attemptId"'));
  assert.ok(pay.includes("requireAuth, requireSameOriginJson"));
  assert.ok(pay.includes("cateringSquarePayRequestSchema.parse(req.body ?? {})"));
  assert.equal(/req\.body\./.test(pay), false, "nothing is read from the body");
  assert.ok(sources.service.includes('cateringWorkspaceRole(booking, input.userId) !== "customer"'));
  assert.ok(sources.service.includes("locked.customerId !== input.userId"), "re-checked under the lock");
  assert.ok(sources.service.includes("deriveCateringSquareAmount({ invoice: cateringInvoiceFactOf(invoiceRow), facts })"));
  assert.ok(sources.contract.includes("cateringSquarePayRequestSchema = z.object({}).strict()"));
});

test("no network call is made while the billing lock is held", () => {
  const body = sources.service;
  for (const fn of ["createPayment", "recordConfirmedPayment", "closeStaleOpenAttempts"]) {
    const start = body.indexOf(fn === "createPayment" ? "const prepared = await db.transaction" : fn === "recordConfirmedPayment" ? "return db.transaction(async (tx: Executor) => {\n      const seen" : "const closed = await db.transaction");
    assert.notEqual(start, -1, fn);
    const end = body.indexOf("\n    });\n", start);
    const transaction = body.slice(start, end);
    for (const call of ["checkout.", "connections.", "fetch(", "notify("]) assert.equal(transaction.includes(call), false, `${fn}: ${call} inside a transaction`);
  }
});

test("the attempt serializer is an explicit projection: no spread of a row, and no Square internals", () => {
  const body = sources.serializer;
  assert.equal(/\.\.\.row\b/.test(body), false);
  for (const forbidden of ["idempotencyKey", "squareOrderId", "squarePaymentLinkId", "merchantId", "locationId", "failureCode", "customerId:", "providerId:"]) {
    assert.equal(body.replace(/visibleCateringPaymentAttempts[\s\S]*$/, "").includes(forbidden), false, forbidden);
  }
});

test("the environment example documents the sandbox-only Catering webhook settings and carries no production Square value", () => {
  const example = read(".env.example");
  assert.ok(example.includes("SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY") && example.includes("SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL"));
  for (const line of example.split("\n").filter((entry) => /CATERING_WEBHOOK/.test(entry) && !entry.trim().startsWith("#"))) assert.match(line, /=\s*$/, "no value is committed");
});

test("booking cancellation closes open checkouts in its OWN transaction (database only) and removes Square links only after it commits", () => {
  const route = code(read("server/routes/catering-bookings.ts"));
  const cancel = route.slice(route.indexOf('r.post("/bookings/:id/cancel"'), route.indexOf("res.json({ booking: serializeCateringBooking(updated) });", route.indexOf('r.post("/bookings/:id/cancel"')));
  const order = ["lockCateringBilling(tx, id)", "update(cateringBookings)", "closeOpenAttemptsInTransaction(tx, id, now)", "if (!updated)", "cateringSquarePayments.sweepClosedLinks(id).catch(() => undefined)"].map((needle) => cancel.indexOf(needle));
  assert.ok(order.every((at) => at !== -1), JSON.stringify(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "billing lock, booking update, local close (same transaction), then Square cleanup after commit and never fatal");
  const inTransaction = sources.service.slice(sources.service.indexOf("export async function closeOpenAttemptsInTransaction"));
  for (const call of ["checkout.", "connections.", "fetch("]) assert.equal(inTransaction.includes(call), false, `no ${call} in the cancellation transaction`);
  // the closure timestamp is written only after a Square confirmation, and a 404 (already gone) is the only failure treated as one
  const sweep = sources.service.slice(sources.service.indexOf("async function sweepClosedLinks"), sources.service.indexOf("async function fetchEvidence"));
  assert.ok(sweep.indexOf("deletePaymentLink") < sweep.indexOf("squareLinkClosedAt: now()"));
  assert.ok(sweep.includes("squareFailureStatus(error) !== 404"));
});
